import type { FastifyInstance } from 'fastify';
import { changePasswordSchema, loginSchema, type LoginResponse } from '@helm/shared';
import { SESSION_COOKIE } from '../../core/sessions';
import { parse } from '../../core/validation';
import { clearSessionCookie, ctx, sessionCookieOptions } from '../../plugins/auth';
import { changePassword, countUnread, getCurrentUser, login, logout } from './auth.service';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/auth/login',
    {
      config: {
        public: true,
        rateLimit: { max: app.config.loginRateLimitPerMinute, timeWindow: '1 minute' },
      },
    },
    async (request, reply): Promise<LoginResponse> => {
      const input = parse(loginSchema, request.body);
      const result = await login(app, input, {
        ip: request.ip ?? null,
        userAgent: request.headers['user-agent'] ?? null,
      });
      reply.setCookie(
        SESSION_COOKIE,
        result.session.token,
        sessionCookieOptions(app, result.session.expiresAt),
      );
      return { user: result.user, unreadNotifications: result.unreadNotifications };
    },
  );

  app.post(
    '/auth/logout',
    { config: { allowPendingPasswordChange: true } },
    async (request, reply) => {
      await logout(ctx(request));
      clearSessionCookie(app, reply);
      return reply.status(204).send();
    },
  );

  app.get(
    '/auth/me',
    { config: { allowPendingPasswordChange: true } },
    async (request): Promise<LoginResponse> => {
      const { db, user } = ctx(request);
      return {
        user: await getCurrentUser(db, user.id),
        unreadNotifications: await countUnread(db, user.id),
      };
    },
  );

  app.post(
    '/auth/change-password',
    { config: { allowPendingPasswordChange: true } },
    async (request, reply) => {
      await changePassword(ctx(request), parse(changePasswordSchema, request.body));
      return reply.status(204).send();
    },
  );
}
