import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { completeCycleSchema, createCycleSchema, idSchema, updateCycleSchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { projectKeyParams } from '../projects/projects.routes';
import {
  completeCycle,
  createCycle,
  deleteCycle,
  getCycle,
  listCycles,
  updateCycle,
} from './cycles.service';

const idParams = z.object({ id: idSchema });

export async function cycleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects/:key/cycles', async (request) =>
    listCycles(ctx(request), parse(projectKeyParams, request.params).key),
  );

  app.post('/projects/:key/cycles', async (request, reply) => {
    const created = await createCycle(
      ctx(request),
      parse(projectKeyParams, request.params).key,
      parse(createCycleSchema, request.body),
    );
    return reply.status(201).send(created);
  });

  app.get('/cycles/:id', async (request) =>
    getCycle(ctx(request), parse(idParams, request.params).id),
  );

  app.patch('/cycles/:id', async (request) =>
    updateCycle(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updateCycleSchema, request.body),
    ),
  );

  app.post('/cycles/:id/complete', async (request) =>
    completeCycle(
      ctx(request),
      parse(idParams, request.params).id,
      parse(completeCycleSchema, request.body ?? {}),
    ),
  );

  app.delete('/cycles/:id', async (request, reply) => {
    await deleteCycle(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });
}
