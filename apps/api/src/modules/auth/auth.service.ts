import { and, count, eq, isNull, or } from 'drizzle-orm';
import type { ChangePasswordInput, CurrentUser, LoginInput } from '@helm/shared';
import type { Config } from '../../config/env';
import type { Database } from '../../db/client';
import { notifications, users } from '../../db/schema';
import { loadGrants } from '../../core/access/access';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { HttpError, badRequest } from '../../core/errors';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../core/security/password';
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  type NewSession,
} from '../../core/sessions';

const INVALID_CREDENTIALS = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'The username or password is incorrect.');

export interface LoginResult {
  session: NewSession;
  user: CurrentUser;
  unreadNotifications: number;
}

export async function login(
  deps: { db: Database; config: Config },
  input: LoginInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<LoginResult> {
  const { db, config } = deps;
  const loginName = input.login.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, loginName), eq(users.email, loginName)))
    .limit(1);

  if (!user) {
    // Spend the same time as a real check so response timing does not reveal valid usernames.
    await verifyPassword(input.password, await dummyPasswordHash(config.passwordHashCost));
    await recordAudit(db, {
      actorId: null,
      action: 'auth.login_failed',
      data: { login: loginName, reason: 'unknown_user' },
      ip: meta.ip,
    });
    throw INVALID_CREDENTIALS();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new HttpError(
      429,
      'ACCOUNT_LOCKED',
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an administrator to reset your password.`,
    );
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk || !user.isActive) {
    if (!passwordOk) {
      const failures = user.failedLoginCount + 1;
      const lock = failures >= config.lockoutThreshold;
      await db
        .update(users)
        .set({
          failedLoginCount: lock ? 0 : failures,
          lockedUntil: lock
            ? new Date(Date.now() + config.lockoutMinutes * 60000)
            : user.lockedUntil,
        })
        .where(eq(users.id, user.id));
    }
    await recordAudit(db, {
      actorId: user.id,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: user.id,
      data: { reason: passwordOk ? 'inactive' : 'wrong_password' },
      ip: meta.ip,
    });
    throw INVALID_CREDENTIALS();
  }

  const session = await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    await recordAudit(tx, {
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ip: meta.ip,
    });
    return createSession(tx, user.id, config.sessionTtlHours, meta);
  });

  return {
    session,
    user: await getCurrentUser(db, user.id),
    unreadNotifications: await countUnread(db, user.id),
  };
}

export async function logout(ctx: RequestContext): Promise<void> {
  await deleteSession(ctx.db, ctx.user.sessionId);
  await recordAudit(ctx.db, {
    actorId: ctx.user.id,
    action: 'auth.logout',
    entityType: 'user',
    entityId: ctx.user.id,
    ip: ctx.ip,
  });
}

export async function getCurrentUser(db: Database, userId: string): Promise<CurrentUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  const grants = await loadGrants(db, userId);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    userType: user.userType,
    clientId: user.clientId,
    isAdmin: user.isAdmin,
    mustChangePassword: user.mustChangePassword,
    grants: grants.filter((grant) =>
      user.userType === 'client' ? grant.role === 'CLIENT' : grant.role !== 'CLIENT',
    ),
  };
}

export async function countUnread(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function changePassword(
  ctx: RequestContext,
  input: ChangePasswordInput,
): Promise<void> {
  const { db, config, user } = ctx;
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Your current password is incorrect.');
  }
  if (input.currentPassword === input.newPassword) {
    throw badRequest('Choose a password different from the current one.');
  }
  if (input.newPassword.toLowerCase().includes(row.username)) {
    throw badRequest('Your password must not contain your username.');
  }
  const passwordHash = await hashPassword(input.newPassword, config.passwordHashCost);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false, passwordChangedAt: new Date() })
      .where(eq(users.id, user.id));
    // Sign out other devices; keep the session that made the change.
    await deleteUserSessions(tx, user.id, user.sessionId);
    await recordAudit(tx, {
      actorId: user.id,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: user.id,
      ip: ctx.ip,
    });
  });
}
