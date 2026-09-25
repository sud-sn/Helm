import type { FastifyInstance } from 'fastify';
import { auditRoutes } from './audit/audit.routes';
import { authRoutes } from './auth/auth.routes';
import { clientRoutes } from './clients/clients.routes';
import { cycleRoutes } from './cycles/cycles.routes';
import { dashboardRoutes } from './dashboard/dashboard.routes';
import { meetingRoutes } from './meetings/meetings.routes';
import { memberRoutes } from './members/members.routes';
import { notificationRoutes } from './notifications/notifications.routes';
import { pageRoutes } from './pages/pages.routes';
import { pitchRoutes } from './pitches/pitches.routes';
import { projectRoutes } from './projects/projects.routes';
import { ticketRoutes } from './tickets/tickets.routes';
import { userRoutes } from './users/users.routes';

/** Every business module registers its routes here, under the /api prefix. */
export async function registerModules(api: FastifyInstance): Promise<void> {
  await api.register(authRoutes);
  await api.register(userRoutes);
  await api.register(memberRoutes);
  await api.register(clientRoutes);
  await api.register(projectRoutes);
  await api.register(cycleRoutes);
  await api.register(ticketRoutes);
  await api.register(notificationRoutes);
  await api.register(pageRoutes);
  await api.register(pitchRoutes);
  await api.register(meetingRoutes);
  await api.register(dashboardRoutes);
  await api.register(auditRoutes);
}
