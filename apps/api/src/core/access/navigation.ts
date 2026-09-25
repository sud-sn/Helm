import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { Executor } from '../../db/client';
import { clients, cycles, projects } from '../../db/schema';
import type { Access } from './access';
import { anyOf } from './conditions';

/**
 * Navigation visibility. Someone granted only a cycle must still see the cycle's project and
 * client in menus (names only); all other reads use the regular permission checks.
 */

export function visibleClientCondition(db: Executor, access: Access): SQL | undefined {
  const direct = access.coverage('client.read');
  if (direct.all) return undefined;
  const viaProjects = access.coverage('project.read').projectIds;
  const viaCycles = access.coverage('cycle.read').cycleIds;
  return anyOf([
    direct.clientIds.length > 0 ? inArray(clients.id, direct.clientIds) : undefined,
    viaProjects.length > 0
      ? inArray(
          clients.id,
          db
            .select({ id: projects.clientId })
            .from(projects)
            .where(inArray(projects.id, viaProjects)),
        )
      : undefined,
    viaCycles.length > 0
      ? inArray(
          clients.id,
          db
            .select({ id: projects.clientId })
            .from(cycles)
            .innerJoin(projects, eq(projects.id, cycles.projectId))
            .where(inArray(cycles.id, viaCycles)),
        )
      : undefined,
  ]);
}

export function visibleProjectCondition(db: Executor, access: Access): SQL | undefined {
  const direct = access.coverage('project.read');
  if (direct.all) return undefined;
  const viaCycles = access.coverage('cycle.read').cycleIds;
  return anyOf([
    direct.clientIds.length > 0 ? inArray(projects.clientId, direct.clientIds) : undefined,
    direct.projectIds.length > 0 ? inArray(projects.id, direct.projectIds) : undefined,
    viaCycles.length > 0
      ? inArray(
          projects.id,
          db.select({ id: cycles.projectId }).from(cycles).where(inArray(cycles.id, viaCycles)),
        )
      : undefined,
  ]);
}

export async function canSeeProject(
  db: Executor,
  access: Access,
  project: { id: string; clientId: string },
): Promise<boolean> {
  if (access.can('project.read', { clientId: project.clientId, projectId: project.id }))
    return true;
  const viaCycles = access.coverage('cycle.read').cycleIds;
  if (viaCycles.length === 0) return false;
  const [row] = await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(and(eq(cycles.projectId, project.id), inArray(cycles.id, viaCycles)))
    .limit(1);
  return Boolean(row);
}

export async function canSeeClient(
  db: Executor,
  access: Access,
  clientId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), visibleClientCondition(db, access)))
    .limit(1);
  return Boolean(row);
}
