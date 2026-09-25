import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  convertActionItemsSchema,
  createActionItemSchema,
  createMeetingSchema,
  idSchema,
  meetingListQuerySchema,
  updateActionItemSchema,
  updateMeetingSchema,
  visibilitySchemaInput,
} from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import {
  actionItemToPitch,
  convertActionItems,
  createActionItem,
  createMeeting,
  deleteActionItem,
  deleteMeeting,
  getMeeting,
  listActionItems,
  listMeetings,
  setMinutesVisibility,
  updateActionItem,
  updateMeeting,
} from './meetings.service';

const idParams = z.object({ id: idSchema });

export async function meetingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/meetings', async (request) =>
    listMeetings(ctx(request), parse(meetingListQuerySchema, request.query)),
  );

  app.post('/meetings', async (request, reply) => {
    const created = await createMeeting(ctx(request), parse(createMeetingSchema, request.body));
    return reply.status(201).send(created);
  });

  app.get('/meetings/:id', async (request) =>
    getMeeting(ctx(request), parse(idParams, request.params).id),
  );

  app.patch('/meetings/:id', async (request) =>
    updateMeeting(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updateMeetingSchema, request.body),
    ),
  );

  app.put('/meetings/:id/visibility', async (request) =>
    setMinutesVisibility(
      ctx(request),
      parse(idParams, request.params).id,
      parse(visibilitySchemaInput, request.body).visibility,
    ),
  );

  app.delete('/meetings/:id', async (request, reply) => {
    await deleteMeeting(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });

  app.get('/meetings/:id/action-items', async (request) =>
    listActionItems(ctx(request), parse(idParams, request.params).id),
  );

  app.post('/meetings/:id/action-items', async (request, reply) => {
    const created = await createActionItem(
      ctx(request),
      parse(idParams, request.params).id,
      parse(createActionItemSchema, request.body),
    );
    return reply.status(201).send(created);
  });

  app.post('/meetings/:id/action-items/convert', async (request, reply) => {
    const created = await convertActionItems(
      ctx(request),
      parse(idParams, request.params).id,
      parse(convertActionItemsSchema, request.body),
    );
    return reply.status(201).send(created);
  });

  app.patch('/action-items/:id', async (request) =>
    updateActionItem(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updateActionItemSchema, request.body),
    ),
  );

  app.delete('/action-items/:id', async (request, reply) => {
    await deleteActionItem(ctx(request), parse(idParams, request.params).id);
    return reply.status(204).send();
  });

  app.post('/action-items/:id/pitch', async (request, reply) => {
    const created = await actionItemToPitch(ctx(request), parse(idParams, request.params).id);
    return reply.status(201).send(created);
  });
}
