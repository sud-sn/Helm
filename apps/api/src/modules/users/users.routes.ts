import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createUserSchema,
  idSchema,
  resetPasswordSchema,
  updateUserSchema,
  userListQuerySchema,
  USER_TYPES,
} from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import {
  createUser,
  getUser,
  listUsers,
  resetPassword,
  updateUser,
  userDirectory,
} from './users.service';

const idParams = z.object({ id: idSchema });
const directoryQuery = z.object({
  q: z.string().trim().max(100).optional(),
  userType: z.enum(USER_TYPES).optional(),
  clientId: idSchema.optional(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users/directory', async (request) =>
    userDirectory(ctx(request), parse(directoryQuery, request.query)),
  );

  app.get('/admin/users', async (request) =>
    listUsers(ctx(request), parse(userListQuerySchema, request.query)),
  );

  app.post('/admin/users', async (request, reply) => {
    const created = await createUser(ctx(request), parse(createUserSchema, request.body));
    return reply.status(201).send(created);
  });

  app.get('/admin/users/:id', async (request) =>
    getUser(ctx(request), parse(idParams, request.params).id),
  );

  app.patch('/admin/users/:id', async (request) =>
    updateUser(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updateUserSchema, request.body),
    ),
  );

  app.post('/admin/users/:id/reset-password', async (request) =>
    resetPassword(
      ctx(request),
      parse(idParams, request.params).id,
      parse(resetPasswordSchema, request.body ?? {}),
    ),
  );
}
