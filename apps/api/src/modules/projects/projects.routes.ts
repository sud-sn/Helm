import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createProjectSchema, idSchema, projectKeySchema, updateProjectSchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { createProject, getProject, listProjects, updateProject } from './projects.service';

export const projectKeyParams = z.object({ key: projectKeySchema });
const listQuery = z.object({ clientId: idSchema.optional() });

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects', async (request) =>
    listProjects(ctx(request), parse(listQuery, request.query)),
  );

  app.post('/projects', async (request, reply) => {
    const created = await createProject(ctx(request), parse(createProjectSchema, request.body));
    return reply.status(201).send(created);
  });

  app.get('/projects/:key', async (request) =>
    getProject(ctx(request), parse(projectKeyParams, request.params).key),
  );

  app.patch('/projects/:key', async (request) =>
    updateProject(
      ctx(request),
      parse(projectKeyParams, request.params).key,
      parse(updateProjectSchema, request.body),
    ),
  );
}
