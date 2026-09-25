import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createPageSchema,
  draftPageSchema,
  idSchema,
  updatePageSchema,
  visibilitySchemaInput,
} from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { projectKeyParams } from '../projects/projects.routes';
import { getTicket } from '../tickets/tickets.service';
import { DOCX_MIME } from './docx';
import { draftPage } from './drafts.service';
import {
  createPage,
  deletePage,
  exportPageDocx,
  getPage,
  listPageVersions,
  listProjectPages,
  listTicketPages,
  setPageVisibility,
  updatePage,
} from './pages.service';

const idParams = z.object({ id: idSchema });

/** A download with its name, in plain ASCII for old clients and UTF-8 for the rest (RFC 6266). */
function attachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
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

  app.post(
    '/projects/:key/pages/draft',
    {
      config: {
        // Each draft costs money and takes a minute or two: a limit that stops runaway clicking.
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const result = await draftPage(
        ctx(request),
        parse(projectKeyParams, request.params).key,
        parse(draftPageSchema, request.body),
      );
      return reply.status(201).send(result);
    },
  );

  app.get('/tickets/:key/pages', async (request) => {
    const ticket = await getTicket(ctx(request), parse(ticketParams, request.params).key);
    return listTicketPages(ctx(request), ticket.id);
  });

  app.get('/pages/:id', async (request) =>
    getPage(ctx(request), parse(idParams, request.params).id),
  );

  app.get('/pages/:id/export.docx', async (request, reply) => {
    const file = await exportPageDocx(ctx(request), parse(idParams, request.params).id);
    return reply
      .header('content-type', DOCX_MIME)
      .header('content-disposition', attachment(file.fileName))
      .header('cache-control', 'private, no-store')
      .send(file.data);
  });

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
