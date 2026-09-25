import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClientSchema, idSchema, updateClientSchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { createClient, getClient, listClients, updateClient } from './clients.service';

const idParams = z.object({ id: idSchema });
const listQuery = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export async function clientRoutes(app: FastifyInstance): Promise<void> {
  app.get('/clients', async (request) =>
    listClients(ctx(request), parse(listQuery, request.query)),
  );

  app.post('/clients', async (request, reply) => {
    const created = await createClient(ctx(request), parse(createClientSchema, request.body));
    return reply.status(201).send(created);
  });

  app.get('/clients/:id', async (request) =>
    getClient(ctx(request), parse(idParams, request.params).id),
  );

  app.patch('/clients/:id', async (request) =>
    updateClient(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updateClientSchema, request.body),
    ),
  );
}
