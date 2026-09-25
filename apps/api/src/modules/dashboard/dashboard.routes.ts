import type { FastifyInstance } from 'fastify';
import { parse } from '../../core/validation';
import { ctx } from '../../plugins/auth';
import { projectKeyParams } from '../projects/projects.routes';
import { getDashboard, getPortalHome, getProjectProgress } from './dashboard.service';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', async (request) => getDashboard(ctx(request)));
  app.get('/portal', async (request) => getPortalHome(ctx(request)));
  app.get('/projects/:key/progress', async (request) =>
    getProjectProgress(ctx(request), parse(projectKeyParams, request.params).key),
  );
}
