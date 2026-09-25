import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RoleAssignment } from '@helm/shared';
import { notifications } from '../src/db/schema';
import { createUser, createTestApp, login, seedOrg, type TestApp } from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
});
afterAll(() => t.close());

const grantBody = (userId: string, role: string, scopeType: string, scopeId: string | null) => ({
  userId,
  role,
  scopeType,
  scopeId,
});

describe('granting roles', () => {
  it('lets a project manager staff their client and notifies the new member', async () => {
    const newcomer = await createUser(t, { username: 'newcomer' });
    const pm = await login(t, 'pm');
    const response = await pm.post<RoleAssignment>(
      '/api/role-assignments',
      grantBody(newcomer.id, 'DEVELOPER', 'project', org.project.id),
    );
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ role: 'DEVELOPER', scopeLabel: 'Acme Corp › ACME' });

    const [notification] = await t.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, newcomer.id), eq(notifications.type, 'role_granted')));
    expect(notification?.data).toMatchObject({ role: 'DEVELOPER', scopeLabel: 'Acme Corp › ACME' });
  });

  it('lets one team lead work across several clients', async () => {
    const roamer = await createUser(t, { username: 'roamer' });
    const dm = await login(t, 'dm');
    for (const clientId of [org.client.id, org.otherClient.id]) {
      const response = await dm.post(
        '/api/role-assignments',
        grantBody(roamer.id, 'TEAM_LEAD', 'client', clientId),
      );
      expect(response.status).toBe(201);
    }
    const roamerClient = await login(t, 'roamer');
    const me = await roamerClient.get<{ user: { grants: unknown[] } }>('/api/auth/me');
    expect(me.body.user.grants).toHaveLength(2);
  });

  it('only allows handing out roles below your own, inside your scope', async () => {
    const someone = await createUser(t, { username: 'someone' });
    const lead = await login(t, 'lead');
    expect(
      (
        await lead.post(
          '/api/role-assignments',
          grantBody(someone.id, 'PROJECT_MANAGER', 'project', org.project.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await lead.post(
          '/api/role-assignments',
          grantBody(someone.id, 'DEVELOPER', 'project', org.project.id),
        )
      ).status,
    ).toBe(201);
    // Outside the lead's scope the scope itself is invisible.
    expect(
      (
        await lead.post(
          '/api/role-assignments',
          grantBody(someone.id, 'DEVELOPER', 'project', org.otherProject.id),
        )
      ).status,
    ).toBe(404);

    const dev = await login(t, 'dev');
    expect(
      (
        await dev.post(
          '/api/role-assignments',
          grantBody(someone.id, 'VIEWER', 'project', org.project.id),
        )
      ).status,
    ).toBe(403);
  });

  it('forbids granting yourself anything unless you are an admin', async () => {
    const dm = await login(t, 'dm');
    const response = await dm.post(
      '/api/role-assignments',
      grantBody(org.users.dm.id, 'VIEWER', 'client', org.client.id),
    );
    expect(response.status).toBe(403);
  });

  it('keeps client users inside their own company and out of staff roles', async () => {
    const dm = await login(t, 'dm');
    const staffAsClient = await dm.post(
      '/api/role-assignments',
      grantBody(org.users.dev.id, 'CLIENT', 'client', org.client.id),
    );
    expect(staffAsClient.status).toBe(400);

    const clientAsDev = await dm.post(
      '/api/role-assignments',
      grantBody(org.users.clientUser.id, 'DEVELOPER', 'project', org.project.id),
    );
    expect(clientAsDev.status).toBe(400);

    const otherCompany = await dm.post(
      '/api/role-assignments',
      grantBody(org.users.clientUser.id, 'CLIENT', 'project', org.otherProject.id),
    );
    expect(otherCompany.status).toBe(400);
  });

  it('validates role and scope combinations and duplicates', async () => {
    const admin = await login(t, 'admin');
    const dmOnProject = await admin.post(
      '/api/role-assignments',
      grantBody(org.users.dev.id, 'DELIVERY_MANAGER', 'project', org.project.id),
    );
    expect(dmOnProject.status).toBe(400);

    const duplicate = await admin.post<{ error: { code: string } }>(
      '/api/role-assignments',
      grantBody(org.users.dev.id, 'DEVELOPER', 'project', org.project.id),
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ALREADY_GRANTED');
  });
});

describe('listing members', () => {
  it('shows direct, inherited and cycle-level members of a project', async () => {
    const lead = await login(t, 'lead');
    const response = await lead.get<RoleAssignment[]>(
      `/api/role-assignments?scopeType=project&scopeId=${org.project.id}`,
    );
    expect(response.status).toBe(200);
    const byUser = new Map(response.body.map((a) => [a.user.username, a]));
    expect(byUser.get('dm')?.scopeType).toBe('workspace');
    expect(byUser.get('pm')?.scopeType).toBe('client');
    expect(byUser.get('dev')?.scopeType).toBe('project');
    expect(byUser.get('cycledev')?.scopeLabel).toBe('Acme Corp › ACME › Sprint 1');
    expect(byUser.has('outsider')).toBe(false);
  });

  it('hides scopes the caller cannot see, including from client users', async () => {
    const outsider = await login(t, 'outsider');
    expect(
      (await outsider.get(`/api/role-assignments?scopeType=project&scopeId=${org.project.id}`))
        .status,
    ).toBe(404);
    const clientUser = await login(t, 'acme.client');
    expect(
      (await clientUser.get(`/api/role-assignments?scopeType=client&scopeId=${org.client.id}`))
        .status,
    ).toBe(404);
  });

  it('lists the roles the caller may grant', async () => {
    const lead = await login(t, 'lead');
    const response = await lead.get<string[]>(
      `/api/role-assignments/grantable-roles?scopeType=project&scopeId=${org.project.id}`,
    );
    expect(response.body).toEqual(['BUSINESS_ANALYST', 'DEVELOPER', 'VIEWER']);
  });
});

describe('revoking roles', () => {
  it('follows the same rules as granting', async () => {
    const lead = await login(t, 'lead');
    const members = await lead.get<RoleAssignment[]>(
      `/api/role-assignments?scopeType=project&scopeId=${org.project.id}`,
    );
    const pmGrant = members.body.find((a) => a.user.username === 'pm')!;
    const devGrant = members.body.find((a) => a.user.username === 'viewer')!;

    expect((await lead.delete(`/api/role-assignments/${pmGrant.id}`)).status).toBe(403);
    expect((await lead.delete(`/api/role-assignments/${devGrant.id}`)).status).toBe(204);
  });
});
