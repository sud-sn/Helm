import { desc, eq } from 'drizzle-orm';
import type { AiRun, AiStatus, AiTestResult, Features } from '@helm/shared';
import { AiProviderError } from '../../core/ai';
import { aiNotConfigured } from '../../core/ai/http';
import type { RequestContext } from '../../core/context';
import { userSummary } from '../../core/dto';
import { HttpError } from '../../core/errors';
import { aiRuns, meetings, users } from '../../db/schema';

const TEST_PROMPT_VERSION = 'connection-test/1';

/** What the web app may offer this user. AI is for staff only; clients never trigger it. */
export function getFeatures(ctx: RequestContext): Features {
  return { ai: ctx.ai !== null && ctx.user.userType === 'staff' };
}

export async function getAiStatus(ctx: RequestContext): Promise<AiStatus> {
  ctx.access.requireAdmin();
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
  const recentRuns: AiRun[] = rows.map(({ run, requestedBy, meetingTitle }) => ({
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
  const ai = ctx.ai;
  return {
    enabled: ai !== null,
    provider: ai?.name ?? null,
    endpointHost: ai?.description.endpointHost ?? null,
    deployment: ai?.description.deployment ?? null,
    apiVersion: ai?.description.apiVersion ?? null,
    recentRuns,
  };
}

/** A tiny request that proves the endpoint, key, deployment and API version all work. */
export async function testAiConnection(ctx: RequestContext): Promise<AiTestResult> {
  ctx.access.requireAdmin();
  const ai = ctx.ai;
  if (!ai) throw aiNotConfigured();
  const run = {
    task: 'connection_test' as const,
    provider: ai.name,
    promptVersion: TEST_PROMPT_VERSION,
    requestedById: ctx.user.id,
  };
  try {
    const result = await ai.generateJson({
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
    if (!(error instanceof AiProviderError)) throw error;
    await ctx.db.insert(aiRuns).values({
      ...run,
      model: ai.description.deployment,
      status: 'failed',
      errorKind: error.kind,
    });
    // Administrators get the provider's own explanation; it never contains the key.
    throw new HttpError(502, 'AI_TEST_FAILED', error.message);
  }
}
