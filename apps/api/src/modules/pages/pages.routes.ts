import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createPageSchema, idSchema, updatePageSchema, visibilitySchemaInput } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { projectKeyParams } from '../projects/projects.routes';
import { getTicket } from '../tickets/tickets.service';
import {
  createPage,
  deletePage,
  getPage,
  listPageVersions,
  listProjectPages,
  listTicketPages,
  setPageVisibility,
  updatePage,
} from './pages.service';

const idParams = z.object({ id: idSchema });
const ticketParams = z.object({ key: z.string().trim().min(3).max(24) });

export async function pageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects/:key/pages', async (request) =>
    listProjectPages(ctx(request), parse(projectKeyParams, request.params).key),
  );

  app.post('/projects/:key/pages', async (request, reply) => {
    const created = await createPage(
      ctx(request),
      parse(projectKeyParams, request.params).key,
      parse(createPageSchema, request.body),
    );
    return reply.status(201).send(created);
  });

  app.get('/tickets/:key/pages', async (request) => {
    const ticket = await getTicket(ctx(request), parse(ticketParams, request.params).key);
    return listTicketPages(ctx(request), ticket.id);
  });

  app.get('/pages/:id', async (request) =>
    getPage(ctx(request), parse(idParams, request.params).id),
  );

  app.patch('/pages/:id', async (request) =>
    updatePage(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updatePageSchema, request.body),
    ),
  );

  app.put('/pages/:id/visibility', async (request) =>
    setPageVisibility(
      ctx(request),
      parse(idParams, request.params).id,
      parse(visibilitySchemaInput, request.body).visibility,
    ),
  );

  app.get('/pages/:id/versions', async (request) =>
    listPageVersions(ctx(request), parse(idParams, request.params).id),
  );

  app.delete('/pages/:id', async (request, reply) => {
    await deletePage(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });
}
