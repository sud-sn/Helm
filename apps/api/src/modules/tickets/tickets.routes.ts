import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  commentBodySchema,
  createTicketSchema,
  idSchema,
  ticketListQuerySchema,
  updateTicketSchema,
} from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { projectKeyParams } from '../projects/projects.routes';
import { addComment, deleteComment, editComment, listComments } from './comments.service';
import {
  createTicket,
  deleteTicket,
  getTicket,
  listAssignableUsers,
  listMyTickets,
  listProjectTickets,
  listTicketEvents,
  setWatching,
  updateTicket,
} from './tickets.service';

const ticketParams = z.object({ key: z.string().trim().min(3).max(24) });
const idParams = z.object({ id: idSchema });
const assignableQuery = z.object({ cycleId: idSchema.optional() });

export async function ticketRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects/:key/tickets', async (request) =>
    listProjectTickets(
      ctx(request),
      parse(projectKeyParams, request.params).key,
      parse(ticketListQuerySchema, request.query),
    ),
  );

  app.post('/projects/:key/tickets', async (request, reply) => {
    const created = await createTicket(
      ctx(request),
      parse(projectKeyParams, request.params).key,
      parse(createTicketSchema, request.body),
    );
    return reply.status(201).send(created);
  });

  app.get('/projects/:key/assignable-users', async (request) =>
    listAssignableUsers(
      ctx(request),
      parse(projectKeyParams, request.params).key,
      parse(assignableQuery, request.query).cycleId,
    ),
  );

  app.get('/my/tickets', async (request) => listMyTickets(ctx(request)));

  app.get('/tickets/:key', async (request) =>
    getTicket(ctx(request), parse(ticketParams, request.params).key),
  );

  app.patch('/tickets/:key', async (request) =>
    updateTicket(
      ctx(request),
      parse(ticketParams, request.params).key,
      parse(updateTicketSchema, request.body),
    ),
  );

  app.delete('/tickets/:key', async (request, reply) => {
    await deleteTicket(ctx(request), parse(ticketParams, request.params).key);
    return reply.status(204).send();
  });

  app.get('/tickets/:key/events', async (request) =>
    listTicketEvents(ctx(request), parse(ticketParams, request.params).key),
  );

  app.put('/tickets/:key/watch', async (request, reply) => {
    await setWatching(ctx(request), parse(ticketParams, request.params).key, true);
    return reply.status(204).send();
  });

  app.delete('/tickets/:key/watch', async (request, reply) => {
    await setWatching(ctx(request), parse(ticketParams, request.params).key, false);
    return reply.status(204).send();
  });

  app.get('/tickets/:key/comments', async (request) =>
    listComments(ctx(request), parse(ticketParams, request.params).key),
  );

  app.post('/tickets/:key/comments', async (request, reply) => {
    const created = await addComment(
      ctx(request),
      parse(ticketParams, request.params).key,
      parse(commentBodySchema, request.body).body,
    );
    return reply.status(201).send(created);
  });

  app.patch('/comments/:id', async (request) =>
    editComment(
      ctx(request),
      parse(idParams, request.params).id,
      parse(commentBodySchema, request.body).body,
    ),
  );

  app.delete('/comments/:id', async (request, reply) => {
    await deleteComment(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });
}
