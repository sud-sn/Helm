import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { grantRoleSchema, idSchema, scopeQuerySchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import {
  grantRole,
  listGrantableRoles,
  listScopeMembers,
  listUserAssignments,
  revokeRole,
} from './members.service';

const idParams = z.object({ id: idSchema });

export async function memberRoutes(app: FastifyInstance): Promise<void> {
  app.get('/role-assignments', async (request) => {
    const query = parse(scopeQuerySchema, request.query);
    return listScopeMembers(ctx(request), query.scopeType, query.scopeId);
  });

  app.get('/role-assignments/grantable-roles', async (request) => {
    const query = parse(scopeQuerySchema, request.query);
    return listGrantableRoles(ctx(request), query.scopeType, query.scopeId);
  });

  app.get('/users/:id/role-assignments', async (request) =>
    listUserAssignments(ctx(request), parse(idParams, request.params).id),
  );

  app.post('/role-assignments', async (request, reply) => {
    const created = await grantRole(ctx(request), parse(grantRoleSchema, request.body));
    return reply.status(201).send(created);
  });

  app.delete('/role-assignments/:id', async (request, reply) => {
    await revokeRole(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });
}
