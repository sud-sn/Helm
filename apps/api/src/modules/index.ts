import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/auth.routes';
import { clientRoutes } from './clients/clients.routes';
import { cycleRoutes } from './cycles/cycles.routes';
import { memberRoutes } from './members/members.routes';
import { notificationRoutes } from './notifications/notifications.routes';
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
}
