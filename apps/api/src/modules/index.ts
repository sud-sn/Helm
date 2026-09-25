import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/auth.routes';
import { memberRoutes } from './members/members.routes';
import { userRoutes } from './users/users.routes';

/** Every business module registers its routes here, under the /api prefix. */
export async function registerModules(api: FastifyInstance): Promise<void> {
  await api.register(authRoutes);
  await api.register(userRoutes);
  await api.register(memberRoutes);
}
