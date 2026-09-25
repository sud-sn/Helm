import { and, eq, ne } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { sessions, users } from '../db/schema';
import type { AuthUser } from './auth-user';
import { randomToken, sha256 } from './security/tokens';

export const SESSION_COOKIE = 'helm_session';

const HOUR_MS = 60 * 60 * 1000;
/** Avoid a write on every request: only record activity this often. */
const LAST_SEEN_RESOLUTION_MS = 5 * 60 * 1000;

export interface NewSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export async function createSession(
  db: Executor,
  userId: string,
  ttlHours: number,
  meta: { ip: string | null; userAgent: string | null },
): Promise<NewSession> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ttlHours * HOUR_MS);
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    })
    .returning({ id: sessions.id });
  if (!row) throw new Error('Failed to create session');
  return { token, sessionId: row.id, expiresAt };
}

export interface ResolvedSession {
  user: AuthUser;
  /** Set when the expiry was pushed forward and the cookie should be re-issued. */
  renewedUntil: Date | null;
}

/** Looks up a session token; expired sessions and deactivated users resolve to null. */
export async function resolveSession(
  db: Executor,
  token: string,
  ttlHours: number,
): Promise<ResolvedSession | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      userType: users.userType,
      clientId: users.clientId,
      isAdmin: users.isAdmin,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)))
    .limit(1);
  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now || !row.isActive) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  // Sliding expiry: once half the lifetime has passed, extend it.
  const ttlMs = ttlHours * HOUR_MS;
  let renewedUntil: Date | null = null;
  if (row.expiresAt.getTime() - now < ttlMs / 2) {
    renewedUntil = new Date(now + ttlMs);
    await db
      .update(sessions)
      .set({ expiresAt: renewedUntil, lastSeenAt: new Date(now) })
      .where(eq(sessions.id, row.sessionId));
  } else if (now - row.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now) })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    user: {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      email: row.email,
      userType: row.userType,
      clientId: row.clientId,
      isAdmin: row.isAdmin,
      mustChangePassword: row.mustChangePassword,
      sessionId: row.sessionId,
    },
    renewedUntil,
  };
}

export async function deleteSession(db: Executor, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Signs a user out everywhere, optionally keeping the session making the request. */
export async function deleteUserSessions(
  db: Executor,
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  await db
    .delete(sessions)
    .where(
      exceptSessionId
        ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
        : eq(sessions.userId, userId),
    );
}
