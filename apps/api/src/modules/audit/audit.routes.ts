import type { FastifyInstance } from 'fastify';
import { auditListQuerySchema } from '@helm/shared';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { listAuditEntries } from './audit.service';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/audit', async (request) =>
    listAuditEntries(ctx(request), parse(auditListQuerySchema, request.query)),
  );
}
