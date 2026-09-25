import type { FastifyInstance, FastifyRequest } from 'fastify';
import { aiSettingsSchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import {
  getAiStatus,
  getFeatures,
  removeAiSettings,
  saveAiSettings,
  testAiConnection,
} from './ai.service';

// Saving and testing call Azure: a limit that stops runaway clicking.
const outboundLimit = {
  rateLimit: {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
  },
};

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/features', async (request) => getFeatures(ctx(request)));

  app.get('/admin/ai', async (request) => getAiStatus(ctx(request)));

  app.put('/admin/ai/settings', { config: outboundLimit }, async (request) =>
    saveAiSettings(ctx(request), parse(aiSettingsSchema, request.body)),
  );

  app.delete('/admin/ai/settings', async (request) => removeAiSettings(ctx(request)));

  app.post('/admin/ai/test', { config: outboundLimit }, async (request) =>
    testAiConnection(ctx(request)),
  );
}
