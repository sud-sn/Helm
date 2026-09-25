import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminUser, RoleAssignment, TemporaryPasswordResponse } from '@helm/shared';
import { roleAssignments } from '../src/db/schema';
import { Client, createTestApp, login, seedOrg, type TestApp } from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;
let admin: Client;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
  admin = await login(t, 'admin');
});
afterAll(() => t.close());

describe('admin user management', () => {
  it('is only available to administrators', async () => {
    const dm = await login(t, 'dm');
    expect((await dm.get('/api/admin/users')).status).toBe(403);
    expect((await dm.post('/api/admin/users', { username: 'x.y', displayName: 'X' })).status).toBe(
      403,
    );
  });

  it('creates a staff user with a one-time temporary password', async () => {
    const created = await admin.post<TemporaryPasswordResponse>('/api/admin/users', {
      username: 'Meera.K',
      displayName: 'Meera K',
      email: 'Meera@Agency.test',
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({
      username: 'meera.k',
      email: 'meera@agency.test',
      userType: 'staff',
      mustChangePassword: true,
    });
    expect(created.body.temporaryPassword).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);

    const meera = await login(t, 'meera.k', created.body.temporaryPassword!);
    const me = await meera.get<{ user: { mustChangePassword: boolean } }>('/api/auth/me');
    expect(me.body.user.mustChangePassword).toBe(true);
  });

  it('creates client users inside their company with the Client role', async () => {
    const missingCompany = await admin.post('/api/admin/users', {
      username: 'bob.acme',
      displayName: 'Bob',
      userType: 'client',
    });
    expect(missingCompany.status).toBe(400);

    const created = await admin.post<TemporaryPasswordResponse>('/api/admin/users', {
      username: 'bob.acme',
      displayName: 'Bob (Acme)',
      userType: 'client',
      clientId: org.client.id,
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ userType: 'client', clientName: 'Acme Corp' });
    const grants = await t.db
      .select()
      .from(roleAssignments)
      .where(eq(roleAssignments.userId, created.body.user.id));
    expect(grants).toMatchObject([
      { role: 'CLIENT', scopeType: 'client', clientId: org.client.id },
    ]);
  });

  it('rejects duplicate usernames and client administrators', async () => {
    const duplicate = await admin.post<{ error: { code: string } }>('/api/admin/users', {
      username: 'dev',
      displayName: 'Another dev',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('USERNAME_TAKEN');

    const clientAdmin = await admin.post('/api/admin/users', {
      username: 'evil.client',
      displayName: 'Evil',
      userType: 'client',
      clientId: org.client.id,
      isAdmin: true,
    });
    expect(clientAdmin.status).toBe(400);
  });

  it('protects the last administrator and the admin themself', async () => {
    const self = await admin.patch(`/api/admin/users/${org.users.admin.id}`, { isActive: false });
    expect(self.status).toBe(400);
    const selfDemote = await admin.patch(`/api/admin/users/${org.users.admin.id}`, {
      isAdmin: false,
    });
    expect(selfDemote.status).toBe(400);
  });

  it('signs out deactivated users immediately', async () => {
    const viewer = await login(t, 'viewer');
    const deactivated = await admin.patch<AdminUser>(`/api/admin/users/${org.users.viewer.id}`, {
      isActive: false,
    });
    expect(deactivated.body.isActive).toBe(false);
    expect((await viewer.get('/api/auth/me')).status).toBe(401);
    await admin.patch(`/api/admin/users/${org.users.viewer.id}`, { isActive: true });
  });

  it('resets passwords, unlocking the account and forcing a change', async () => {
    const reset = await admin.post<TemporaryPasswordResponse>(
      `/api/admin/users/${org.users.outsider.id}/reset-password`,
    );
    expect(reset.status).toBe(200);
    expect(reset.body.user.mustChangePassword).toBe(true);
    await expect(login(t, 'outsider')).rejects.toThrow();
    await expect(login(t, 'outsider', reset.body.temporaryPassword!)).resolves.toBeInstanceOf(
      Client,
    );
  });

  it('lists a user’s role assignments for admins', async () => {
    const response = await admin.get<RoleAssignment[]>(
      `/api/users/${org.users.pm.id}/role-assignments`,
    );
    expect(response.body).toMatchObject([{ role: 'PROJECT_MANAGER', scopeLabel: 'Acme Corp' }]);
  });
});

describe('user directory', () => {
  it('lists active staff for staff, and client users only when asked by company', async () => {
    const lead = await login(t, 'lead');
    const staff = await lead.get<{ username: string }[]>('/api/users/directory?q=de');
    expect(staff.body.map((u) => u.username)).toContain('dev');
    expect(staff.body.map((u) => u.username)).not.toContain('acme.client');

    const clientPeople = await lead.get<{ username: string }[]>(
      `/api/users/directory?clientId=${org.client.id}`,
    );
    expect(clientPeople.body.map((u) => u.username)).toContain('acme.client');
  });

  it('is hidden from client users', async () => {
    const clientUser = await login(t, 'acme.client');
    expect((await clientUser.get('/api/users/directory')).status).toBe(404);
  });
});
