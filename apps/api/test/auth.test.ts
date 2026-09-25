import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LoginResponse } from '@helm/shared';
import { auditLog, sessions, users } from '../src/db/schema';
import { Client, TEST_PASSWORD, createTestApp, createUser, login, type TestApp } from './harness';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp({ LOCKOUT_THRESHOLD: '3', LOCKOUT_MINUTES: '15' });
});
afterAll(() => t.close());

describe('login', () => {
  it('signs in with a username or email and sets an HttpOnly session cookie', async () => {
    await createUser(t, { username: 'priya' });
    await t.db.update(users).set({ email: 'priya@agency.test' }).where(eq(users.username, 'priya'));

    for (const loginName of ['priya', 'Priya', 'priya@agency.test']) {
      const client = new Client(t.app);
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-requested-with': 'helm' },
        payload: { login: loginName, password: TEST_PASSWORD },
      });
      expect(response.statusCode).toBe(200);
      const cookie = response.cookies.find((c) => c.name === 'helm_session');
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('Lax');
      client.cookie = `helm_session=${cookie!.value}`;

      const me = await client.get<LoginResponse>('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.username).toBe('priya');
      expect(me.body.unreadNotifications).toBe(0);
    }
  });

  it('gives the same answer for an unknown user and a wrong password', async () => {
    await createUser(t, { username: 'ravi' });
    const client = new Client(t.app);
    const unknown = await client.post('/api/auth/login', {
      login: 'nobody',
      password: 'whatever123',
    });
    const wrong = await client.post('/api/auth/login', {
      login: 'ravi',
      password: 'wrong password',
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    await createUser(t, { username: 'locky' });
    const client = new Client(t.app);
    for (let i = 0; i < 3; i++) {
      expect(
        (await client.post('/api/auth/login', { login: 'locky', password: 'nope-nope-nope' }))
          .status,
      ).toBe(401);
    }
    const locked = await client.post<{ error: { code: string } }>('/api/auth/login', {
      login: 'locky',
      password: TEST_PASSWORD,
    });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('refuses deactivated users', async () => {
    await createUser(t, { username: 'gone' });
    await t.db.update(users).set({ isActive: false }).where(eq(users.username, 'gone'));
    const response = await new Client(t.app).post('/api/auth/login', {
      login: 'gone',
      password: TEST_PASSWORD,
    });
    expect(response.status).toBe(401);
  });

  it('audits successful and failed logins', async () => {
    const entries = await t.db.select().from(auditLog);
    const actions = new Set(entries.map((entry) => entry.action));
    expect(actions.has('auth.login')).toBe(true);
    expect(actions.has('auth.login_failed')).toBe(true);
  });
});

describe('sessions', () => {
  it('requires a session for API routes', async () => {
    const response = await new Client(t.app).get<{ error: { code: string } }>('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const response = await new Client(t.app).request<{ error: { code: string } }>(
      'POST',
      '/api/auth/login',
      { login: 'x', password: 'y' },
      { csrf: false },
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_CHECK_FAILED');
  });

  it('ends the session on logout', async () => {
    await createUser(t, { username: 'leaver' });
    const client = await login(t, 'leaver');
    const cookie = client.cookie;
    expect((await client.post('/api/auth/logout')).status).toBe(204);
    const replay = new Client(t.app, cookie);
    expect((await replay.get('/api/auth/me')).status).toBe(401);
  });

  it('expires sessions', async () => {
    const user = await createUser(t, { username: 'sleepy' });
    const client = await login(t, 'sleepy');
    await t.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, user.id));
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });
});

describe('password changes', () => {
  it('forces a new password before anything else when an admin set a temporary one', async () => {
    await createUser(t, { username: 'newbie', mustChangePassword: true });
    const client = await login(t, 'newbie');

    const me = await client.get<LoginResponse>('/api/auth/me');
    expect(me.body.user.mustChangePassword).toBe(true);
    const blocked = await client.get<{ error: { code: string } }>('/api/users/directory');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await client.post('/api/auth/change-password', {
      currentPassword: TEST_PASSWORD,
      newPassword: 'a much better secret',
    });
    expect(changed.status).toBe(204);
    expect((await client.get('/api/users/directory')).status).toBe(200);

    await expect(login(t, 'newbie')).rejects.toThrow();
    await expect(login(t, 'newbie', 'a much better secret')).resolves.toBeInstanceOf(Client);
  });

  it('rejects a wrong current password, a reused password and short passwords', async () => {
    await createUser(t, { username: 'picky' });
    const client = await login(t, 'picky');
    expect(
      (
        await client.post('/api/auth/change-password', {
          currentPassword: 'wrong',
          newPassword: 'another secret!',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await client.post('/api/auth/change-password', {
          currentPassword: TEST_PASSWORD,
          newPassword: TEST_PASSWORD,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await client.post('/api/auth/change-password', {
          currentPassword: TEST_PASSWORD,
          newPassword: 'short',
        })
      ).status,
    ).toBe(400);
  });

  it('signs out other sessions but keeps the current one', async () => {
    await createUser(t, { username: 'twodevices' });
    const laptop = await login(t, 'twodevices');
    const phone = await login(t, 'twodevices');
    await laptop.post('/api/auth/change-password', {
      currentPassword: TEST_PASSWORD,
      newPassword: 'fresh password here',
    });
    expect((await laptop.get('/api/auth/me')).status).toBe(200);
    expect((await phone.get('/api/auth/me')).status).toBe(401);
  });
});
