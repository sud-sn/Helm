import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idSchema, notificationListQuerySchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { countUnread } from '../auth/auth.service';
import { listNotifications, markAllRead, markRead } from './notifications.service';

const idParams = z.object({ id: idSchema });

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications', async (request) =>
    listNotifications(ctx(request), parse(notificationListQuerySchema, request.query)),
  );

  app.get('/notifications/unread-count', async (request) => {
    const { db, user } = ctx(request);
    return { count: await countUnread(db, user.id) };
  });

  app.post('/notifications/:id/read', async (request, reply) => {
    await markRead(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });

  app.post('/notifications/read-all', async (request) => markAllRead(ctx(request)));
}
