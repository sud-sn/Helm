import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiStatus, Features, Meeting, SuggestActionItemsResult } from '@helm/shared';
import type { AiConfig } from '../src/config/env';
import { AiProviderError, type ProviderFactory } from '../src/core/ai';
import { deriveEncryptionKey, encryptSecret } from '../src/core/security/secrets';
import { aiSettings, auditLog } from '../src/db/schema';
import { createTestApp, login, seedOrg, type Client, type TestApp } from './harness';

const GOOD_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/** Stands in for Azure: accepts GOOD_KEY and the gpt-4o deployment, rejects anything else. */
const built: AiConfig[] = [];
const createAiProvider: ProviderFactory = (config) => {
  built.push(config);
  return {
    name: 'azure-openai',
    description: {
      endpointHost: new URL(config.endpoint).host,
      deployment: config.deployment,
      apiVersion: config.apiVersion,
    },
    async generateJson(request) {
      if (config.apiKey !== GOOD_KEY) {
        throw new AiProviderError('auth', 'Azure OpenAI rejected the API key.', 401);
      }
      if (config.deployment !== 'gpt-4o') {
        throw new AiProviderError('not_found', `No deployment "${config.deployment}".`, 404);
      }
      return {
        output: request.schemaName === 'connection_test' ? { ok: true } : { actionItems: [] },
        model: 'gpt-4o-2024-11-20',
        usage: { inputTokens: 12, outputTokens: 3 },
        durationMs: 5,
        responseFormat: 'json_schema',
      };
    },
  };
};

const settings = {
  // A full target URI as copied from the Azure portal: only the resource part is kept.
  endpoint:
    'https://helm-test.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21',
  deployment: 'gpt-4o',
  apiVersion: '2024-10-21',
};

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;
let admin: Client;
let dev: Client;

beforeAll(async () => {
  t = await createTestApp({}, { createAiProvider });
  org = await seedOrg(t);
  admin = await login(t, 'admin');
  dev = await login(t, 'dev');
});
afterAll(() => t.close());

const status = async () => (await admin.get<AiStatus>('/api/admin/ai')).body;
const save = (body: Record<string, unknown>) =>
  admin.request('PUT', '/api/admin/ai/settings', body);

describe('AI settings on the admin page', () => {
  it('start empty and editable', async () => {
    expect(await status()).toMatchObject({
      enabled: false,
      editable: true,
      source: null,
      keyHint: null,
      problem: null,
    });
    expect((await dev.get<Features>('/api/features')).body).toEqual({ ai: false });
  });

  it('are only saved once Azure accepts them', async () => {
    const wrongKey = await save({ ...settings, apiKey: 'not-the-right-key-000' });
    expect(wrongKey.status).toBe(422);
    expect(wrongKey.body).toMatchObject({
      error: { code: 'AI_TEST_FAILED', message: expect.stringContaining('Not saved') },
    });
    expect(await t.db.select().from(aiSettings)).toEqual([]);

    const badEndpoint = await save({
      ...settings,
      endpoint: 'http://example.com',
      apiKey: GOOD_KEY,
    });
    expect(badEndpoint.status).toBe(400);
    expect(badEndpoint.body).toMatchObject({ error: { details: [{ path: 'endpoint' }] } });

    const noKey = await save(settings);
    expect(noKey.status).toBe(400);
    expect(noKey.body).toMatchObject({ error: { details: [{ path: 'apiKey' }] } });
  });

  it('store the key encrypted and never send it back', async () => {
    const saved = await admin.request<AiStatus>('PUT', '/api/admin/ai/settings', {
      ...settings,
      apiKey: GOOD_KEY,
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      enabled: true,
      source: 'admin',
      editable: true,
      endpoint: 'https://helm-test.openai.azure.com',
      endpointHost: 'helm-test.openai.azure.com',
      deployment: 'gpt-4o',
      keyHint: 'c5d6',
      updatedBy: { username: 'admin' },
    });
    expect(JSON.stringify(saved.body)).not.toContain(GOOD_KEY);

    const [row] = await t.db.select().from(aiSettings);
    expect(row!.apiKeyEncrypted).toMatch(/^v1\./);
    expect(row!.apiKeyEncrypted).not.toContain(GOOD_KEY);
    const audit = await t.db.select({ data: auditLog.data }).from(auditLog);
    expect(JSON.stringify(audit)).not.toContain(GOOD_KEY);
    const [entry] = await t.db
      .select({ data: auditLog.data })
      .from(auditLog)
      .where(eq(auditLog.action, 'ai.settings_saved'));
    expect(entry!.data).toMatchObject({ deployment: 'gpt-4o', keyChanged: true });
  });

  it('switch AI on for staff straight away, without a restart', async () => {
    expect((await dev.get<Features>('/api/features')).body).toEqual({ ai: true });
    const meeting = await dev.post<Meeting>('/api/meetings', {
      clientId: org.client.id,
      projectId: org.project.id,
      title: 'Kickoff',
      meetingDate: '2026-09-25',
      transcript: 'Dev: I will build the sales fact table.',
    });
    const suggested = await dev.post<SuggestActionItemsResult>(
      `/api/meetings/${meeting.body.id}/action-items/suggest`,
      {},
    );
    expect(suggested.status).toBe(200);
  });

  it('keep the saved key when the field is left empty', async () => {
    const updated = await admin.request<AiStatus>('PUT', '/api/admin/ai/settings', {
      ...settings,
      apiVersion: '2025-01-01-preview',
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ apiVersion: '2025-01-01-preview', keyHint: 'c5d6' });
    expect(built.at(-1)).toMatchObject({ apiKey: GOOD_KEY, apiVersion: '2025-01-01-preview' });

    const typo = await save({ ...settings, deployment: 'gpt4o' });
    expect(typo.status).toBe(422);
    expect(await status()).toMatchObject({ deployment: 'gpt-4o', enabled: true });
  });

  it('say so when the saved key can no longer be read, and accept it again', async () => {
    // What a changed or lost server secret looks like.
    await t.db.update(aiSettings).set({
      apiKeyEncrypted: encryptSecret(GOOD_KEY, deriveEncryptionKey('a-different-server-secret')),
    });
    t.app.ai.invalidate();
    expect(await status()).toMatchObject({
      enabled: false,
      source: 'admin',
      problem: expect.stringContaining('Enter the key again'),
    });
    expect((await dev.get<Features>('/api/features')).body).toEqual({ ai: false });
    expect((await save(settings)).status).toBe(400);

    expect((await save({ ...settings, apiKey: GOOD_KEY })).status).toBe(200);
    expect(await status()).toMatchObject({ enabled: true, problem: null });
  });

  it('can be removed, which switches AI off', async () => {
    const removed = await admin.request<AiStatus>('DELETE', '/api/admin/ai/settings');
    expect(removed.body).toMatchObject({ enabled: false, source: null, keyHint: null });
    expect(await t.db.select().from(aiSettings)).toEqual([]);
    expect((await dev.get<Features>('/api/features')).body).toEqual({ ai: false });
    const [entry] = await t.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'ai.settings_removed'));
    expect(entry).toBeDefined();
  });

  it('are for administrators only', async () => {
    const dm = await login(t, 'dm');
    expect(
      (await dm.request('PUT', '/api/admin/ai/settings', { ...settings, apiKey: GOOD_KEY })).status,
    ).toBe(403);
    expect((await dm.request('DELETE', '/api/admin/ai/settings')).status).toBe(403);
    expect((await dm.get('/api/admin/ai')).status).toBe(403);
  });
});

describe('when environment variables configure AI', () => {
  let envApp: TestApp;
  beforeAll(async () => {
    envApp = await createTestApp(
      {
        AZURE_OPENAI_ENDPOINT: 'https://from-env.openai.azure.com',
        AZURE_OPENAI_API_KEY: GOOD_KEY,
        AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
      },
      { createAiProvider },
    );
    await seedOrg(envApp);
  });
  afterAll(() => envApp.close());

  it('the page is read-only', async () => {
    const envAdmin = await login(envApp, 'admin');
    expect((await envAdmin.get<AiStatus>('/api/admin/ai')).body).toMatchObject({
      enabled: true,
      source: 'environment',
      editable: false,
      endpointHost: 'from-env.openai.azure.com',
    });
    const change = await envAdmin.request('PUT', '/api/admin/ai/settings', {
      ...settings,
      apiKey: GOOD_KEY,
    });
    expect(change.status).toBe(409);
    expect(change.body).toMatchObject({ error: { code: 'AI_CONFIGURED_BY_ENVIRONMENT' } });
    expect((await envAdmin.request('DELETE', '/api/admin/ai/settings')).status).toBe(409);
  });
});
