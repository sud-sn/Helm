import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createPitchSchema,
  idSchema,
  pitchCommentSchema,
  pitchListQuerySchema,
  pitchResponseSchema,
  pitchReviewSchema,
  updatePitchSchema,
} from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import {
  addPitchComment,
  createPitch,
  getPitch,
  listPitchComments,
  listPitches,
  respondToPitch,
  reviewPitch,
  submitPitch,
  updatePitch,
  withdrawPitch,
} from './pitches.service';

const idParams = z.object({ id: idSchema });

export async function pitchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pitches', async (request) =>
    listPitches(ctx(request), parse(pitchListQuerySchema, request.query)),
  );

  app.post('/pitches', async (request, reply) => {
    const created = await createPitch(ctx(request), parse(createPitchSchema, request.body));
    return reply.status(201).send(created);
  });

  app.get('/pitches/:id', async (request) =>
    getPitch(ctx(request), parse(idParams, request.params).id),
  );

  app.patch('/pitches/:id', async (request) =>
    updatePitch(
      ctx(request),
      parse(idParams, request.params).id,
      parse(updatePitchSchema, request.body),
    ),
  );

  app.post('/pitches/:id/submit', async (request) =>
    submitPitch(ctx(request), parse(idParams, request.params).id),
  );

  app.post('/pitches/:id/review', async (request) =>
    reviewPitch(
      ctx(request),
      parse(idParams, request.params).id,
      parse(pitchReviewSchema, request.body),
    ),
  );

  app.post('/pitches/:id/respond', async (request) =>
    respondToPitch(
      ctx(request),
      parse(idParams, request.params).id,
      parse(pitchResponseSchema, request.body),
    ),
  );

  app.post('/pitches/:id/withdraw', async (request) =>
    withdrawPitch(ctx(request), parse(idParams, request.params).id),
  );

  app.get('/pitches/:id/comments', async (request) =>
    listPitchComments(ctx(request), parse(idParams, request.params).id),
  );

  app.post('/pitches/:id/comments', async (request, reply) => {
    const created = await addPitchComment(
      ctx(request),
      parse(idParams, request.params).id,
      parse(pitchCommentSchema, request.body),
    );
    return reply.status(201).send(created);
  });
}
