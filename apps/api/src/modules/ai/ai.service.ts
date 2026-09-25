import { desc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { AiRun, AiStatus, AiTestResult, Features, aiSettingsSchema } from '@helm/shared';
import { AiProviderError, type LlmProvider } from '../../core/ai';
import { normalizeAzureEndpoint } from '../../core/ai/endpoint';
import { aiNotConfigured } from '../../core/ai/http';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { userSummary } from '../../core/dto';
import { HttpError, badRequest, conflict } from '../../core/errors';
import { aiRuns, aiSettings, meetings, users } from '../../db/schema';

const TEST_PROMPT_VERSION = 'connection-test/1';

/** What the web app may offer this user. AI is for staff only; clients never trigger it. */
export async function getFeatures(ctx: RequestContext): Promise<Features> {
  if (ctx.user.userType !== 'staff') return { ai: false };
  return { ai: (await ctx.ai.provider()) !== null };
}

async function recentRuns(ctx: RequestContext): Promise<AiRun[]> {
  const rows = await ctx.db
    .select({
      run: aiRuns,
      requestedBy: { id: users.id, username: users.username, displayName: users.displayName },
      meetingTitle: meetings.title,
    })
    .from(aiRuns)
    .leftJoin(users, eq(users.id, aiRuns.requestedById))
    .leftJoin(meetings, eq(meetings.id, aiRuns.meetingId))
    .orderBy(desc(aiRuns.createdAt))
    .limit(50);
  return rows.map(({ run, requestedBy, meetingTitle }) => ({
    id: run.id,
    task: run.task,
    model: run.model,
    promptVersion: run.promptVersion,
    status: run.status,
    errorKind: run.errorKind,
    requestedBy: userSummary(requestedBy),
    meeting: run.meetingId && meetingTitle ? { id: run.meetingId, title: meetingTitle } : null,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    durationMs: run.durationMs,
    createdAt: run.createdAt.toISOString(),
  }));
}

export async function getAiStatus(ctx: RequestContext): Promise<AiStatus> {
  ctx.access.requireAdmin();
  const state = await ctx.ai.state();
  const [saved] = ctx.ai.editable
    ? await ctx.db
        .select({
          settings: aiSettings,
          updatedBy: { id: users.id, username: users.username, displayName: users.displayName },
        })
        .from(aiSettings)
        .leftJoin(users, eq(users.id, aiSettings.updatedById))
        .where(eq(aiSettings.id, 1))
        .limit(1)
    : [];
  const description = state.provider?.description;
  return {
    enabled: state.provider !== null,
    provider: state.provider || saved ? 'azure-openai' : null,
    source: state.source,
    editable: ctx.ai.editable,
    endpoint: saved?.settings.endpoint ?? null,
    endpointHost:
      description?.endpointHost ?? (saved ? new URL(saved.settings.endpoint).host : null),
    deployment: description?.deployment ?? saved?.settings.deployment ?? null,
    apiVersion: description?.apiVersion ?? saved?.settings.apiVersion ?? null,
    keyHint: saved?.settings.apiKeyHint ?? null,
    updatedAt: saved?.settings.updatedAt.toISOString() ?? null,
    updatedBy: saved ? userSummary(saved.updatedBy) : null,
    problem: state.problem,
    recentRuns: await recentRuns(ctx),
  };
}

/**
 * A tiny request that proves the endpoint, key, deployment and API version all work. Recorded as
 * an AI run either way; failures carry the provider's own explanation (never the key).
 */
async function connectionTest(ctx: RequestContext, provider: LlmProvider): Promise<AiTestResult> {
  const run = {
    task: 'connection_test' as const,
    provider: provider.name,
    promptVersion: TEST_PROMPT_VERSION,
    requestedById: ctx.user.id,
  };
  try {
    const result = await provider.generateJson({
      schemaName: 'connection_test',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
      },
      system: 'This is a connection test. Reply with {"ok": true}.',
      user: 'Connection test.',
      maxOutputTokens: 20,
      temperature: 0,
    });
    await ctx.db.insert(aiRuns).values({
      ...run,
      model: result.model,
      status: 'succeeded',
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: result.durationMs,
      output: { ok: true, responseFormat: result.responseFormat },
    });
    return {
      model: result.model,
      durationMs: result.durationMs,
      responseFormat: result.responseFormat,
    };
  } catch (error) {
    if (error instanceof AiProviderError) {
      await ctx.db.insert(aiRuns).values({
        ...run,
        model: provider.description.deployment,
        status: 'failed',
        errorKind: error.kind,
      });
    }
    throw error;
  }
}

export async function testAiConnection(ctx: RequestContext): Promise<AiTestResult> {
  ctx.access.requireAdmin();
  const provider = await ctx.ai.provider();
  if (!provider) throw aiNotConfigured();
  try {
    return await connectionTest(ctx, provider);
  } catch (error) {
    if (!(error instanceof AiProviderError)) throw error;
    throw new HttpError(502, 'AI_TEST_FAILED', error.message);
  }
}

function requireEditable(ctx: RequestContext): void {
  if (!ctx.ai.editable) {
    throw conflict(
      "AI is configured by the server's environment variables. Change them there.",
      'AI_CONFIGURED_BY_ENVIRONMENT',
    );
  }
}

/**
 * Saves the Azure OpenAI connection, but only after it has answered a test request, so a typo
 * never switches on a broken AI. The key is stored encrypted; leaving it out keeps the saved one.
 */
export async function saveAiSettings(
  ctx: RequestContext,
  input: z.output<typeof aiSettingsSchema>,
): Promise<AiStatus> {
  ctx.access.requireAdmin();
  requireEditable(ctx);
  const endpoint = normalizeAzureEndpoint(input.endpoint);
  if (!endpoint.ok) {
    throw new HttpError(400, 'VALIDATION_ERROR', endpoint.message, [
      { path: 'endpoint', message: endpoint.message },
    ]);
  }
  const [saved] = await ctx.db.select().from(aiSettings).where(eq(aiSettings.id, 1)).limit(1);
  let apiKey = input.apiKey;
  if (!apiKey) {
    if (!saved) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Enter the API key.', [
        { path: 'apiKey', message: 'Required' },
      ]);
    }
    try {
      apiKey = ctx.ai.decrypt(saved.apiKeyEncrypted);
    } catch {
      throw badRequest('The saved key cannot be read any more. Enter the API key again.');
    }
  }

  const settings = {
    endpoint: endpoint.endpoint,
    deployment: input.deployment,
    apiVersion: input.apiVersion,
  };
  try {
    await connectionTest(ctx, ctx.ai.candidate({ ...settings, apiKey }));
  } catch (error) {
    if (!(error instanceof AiProviderError)) throw error;
    throw new HttpError(422, 'AI_TEST_FAILED', `Not saved: ${error.message}`);
  }

  let apiKeyEncrypted: string;
  try {
    apiKeyEncrypted = ctx.ai.encrypt(apiKey);
  } catch (error) {
    throw new HttpError(500, 'SECRET_KEY_UNAVAILABLE', (error as Error).message);
  }
  const values = {
    ...settings,
    apiKeyEncrypted,
    apiKeyHint: apiKey.slice(-4),
    updatedById: ctx.user.id,
  };
  await ctx.db.transaction(async (tx) => {
    await tx
      .insert(aiSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: aiSettings.id, set: { ...values, updatedAt: new Date() } });
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'ai.settings_saved',
      entityType: 'ai_settings',
      data: {
        endpointHost: new URL(settings.endpoint).host,
        deployment: settings.deployment,
        apiVersion: settings.apiVersion,
        keyChanged: Boolean(input.apiKey),
      },
      ip: ctx.ip,
    });
  });
  ctx.ai.invalidate();
  return getAiStatus(ctx);
}

/** Switches AI off by forgetting the saved connection, key included. */
export async function removeAiSettings(ctx: RequestContext): Promise<AiStatus> {
  ctx.access.requireAdmin();
  requireEditable(ctx);
  await ctx.db.transaction(async (tx) => {
    const removed = await tx
      .delete(aiSettings)
      .where(eq(aiSettings.id, 1))
      .returning({ id: aiSettings.id });
    if (removed.length > 0) {
      await recordAudit(tx, {
        actorId: ctx.user.id,
        action: 'ai.settings_removed',
        entityType: 'ai_settings',
        ip: ctx.ip,
      });
    }
  });
  ctx.ai.invalidate();
  return getAiStatus(ctx);
}
