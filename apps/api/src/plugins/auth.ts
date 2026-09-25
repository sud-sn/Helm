import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loadAccess } from '../core/access/access';
import type { AuthUser } from '../core/auth-user';
import type { RequestContext } from '../core/context';
import { HttpError, unauthenticated } from '../core/errors';
import { SESSION_COOKIE, resolveSession } from '../core/sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    context: RequestContext | null;
  }
  interface FastifyContextConfig {
    /** Reachable without a session (login, health). Everything else requires one. */
    public?: boolean;
    /** Reachable while the user still has to replace a temporary password. */
    allowPendingPasswordChange?: boolean;
  }
}

export function sessionCookieOptions(app: FastifyInstance, expiresAt: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: app.config.cookieSecure,
    expires: expiresAt,
  };
}

export function clearSessionCookie(app: FastifyInstance, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: app.config.cookieSecure,
  });
}

/**
 * Session authentication for the API scope: resolves the cookie on every request and requires a
 * signed-in user on every route not marked `config: { public: true }`.
 */
export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('user', null);
  app.decorateRequest('context', null);

  app.addHook('onRequest', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const resolved = await resolveSession(app.db, token, app.config.sessionTtlHours);
    if (!resolved) {
      clearSessionCookie(app, reply);
      return;
    }
    request.user = resolved.user;
    if (resolved.renewedUntil) {
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(app, resolved.renewedUntil));
    }
  });

  app.addHook('preHandler', async (request) => {
    const config = request.routeOptions.config;
    if (config.public) return;
    const user = request.user;
    if (!user) throw unauthenticated();
    if (user.mustChangePassword && !config.allowPendingPasswordChange) {
      throw new HttpError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Please choose a new password before continuing.',
      );
    }
    request.context = {
      db: app.db,
      config: app.config,
      user,
      access: await loadAccess(app.db, user),
      ip: request.ip ?? null,
      ai: app.ai,
    };
  });
}

/** The request context of an authenticated route. */
export function ctx(request: FastifyRequest): RequestContext {
  if (!request.context) throw unauthenticated();
  return request.context;
}
