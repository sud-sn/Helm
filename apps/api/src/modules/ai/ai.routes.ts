import type { FastifyInstance } from 'fastify';
import { ctx } from '../../plugins/auth';
import { getAiStatus, getFeatures, testAiConnection } from './ai.service';

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/features', async (request) => getFeatures(ctx(request)));

  app.get('/admin/ai', async (request) => getAiStatus(ctx(request)));

  app.post(
    '/admin/ai/test',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request) => testAiConnection(ctx(request)),
  );
}
