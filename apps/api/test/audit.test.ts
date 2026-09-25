import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuditEntry } from '@helm/shared';
import { createTestApp, login, seedOrg, type TestApp } from './harness';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await seedOrg(t);
});
afterAll(() => t.close());

describe('audit log', () => {
  it('is readable by administrators, newest first, filterable by action', async () => {
    const admin = await login(t, 'admin');
    await login(t, 'dev');
    const all = await admin.get<AuditEntry[]>('/api/admin/audit?limit=10');
    expect(all.status).toBe(200);
    expect(all.body[0]!.action).toBe('auth.login');
    const logins = await admin.get<AuditEntry[]>('/api/admin/audit?action=auth.login');
    expect(logins.body.every((entry) => entry.action === 'auth.login')).toBe(true);
    expect(logins.body.map((entry) => entry.actor?.username)).toEqual(['dev', 'admin']);
  });

  it('is hidden from everyone else', async () => {
    const dm = await login(t, 'dm');
    expect((await dm.get('/api/admin/audit')).status).toBe(403);
  });
});
