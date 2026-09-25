import { and, eq, inArray, sql } from 'drizzle-orm';
import { OPEN_TICKET_STATUSES, type Permission, type Project } from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, cycles, projects, tickets } from '../../db/schema';
import type { Access } from '../../core/access/access';
import { coverageCondition } from '../../core/access/conditions';
import { canSeeProject } from '../../core/access/navigation';
import { notFound } from '../../core/errors';

export type ProjectRow = typeof projects.$inferSelect & { clientName: string };

export async function findProjectByKey(db: Executor, key: string): Promise<ProjectRow | null> {
  const [row] = await db
    .select({ project: projects, clientName: clients.name })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.key, key.toUpperCase()))
    .limit(1);
  return row ? { ...row.project, clientName: row.clientName } : null;
}

/** Loads a project the caller can at least navigate to; 404 otherwise. */
export async function requireProject(
  db: Executor,
  access: Access,
  key: string,
): Promise<ProjectRow> {
  const project = await findProjectByKey(db, key);
  if (!project || !(await canSeeProject(db, access, project))) throw notFound('Project');
  return project;
}

/**
 * Whether the caller holds `permission` anywhere in the project: on the project (or above), or on
 * one of its cycles. Used for lists that cycle-scoped members see partially and others not at all.
 */
export async function hasPermissionWithinProject(
  db: Executor,
  access: Access,
  project: { id: string; clientId: string },
  permission: Permission,
): Promise<boolean> {
  if (access.can(permission, { clientId: project.clientId, projectId: project.id })) return true;
  const cycleIds = access.coverage(permission).cycleIds;
  if (cycleIds.length === 0) return false;
  const [row] = await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(and(eq(cycles.projectId, project.id), inArray(cycles.id, cycleIds)))
    .limit(1);
  return Boolean(row);
}

/** Open tickets in the project that the caller may read (so counts never leak hidden work). */
export function openTicketCountSql(access: Access) {
  const readable = coverageCondition(access.coverage('ticket.read'), {
    clientId: projects.clientId,
    projectId: tickets.projectId,
    cycleId: tickets.cycleId,
  });
  const conditions = and(
    eq(tickets.projectId, projects.id),
    inArray(tickets.status, [...OPEN_TICKET_STATUSES]),
    readable,
  );
  return sql<number>`(select count(*)::int from ${tickets} where ${conditions})`;
}

export function toProject(row: ProjectRow & { openTicketCount: number }): Project {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    key: row.key,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.startDate,
    targetDate: row.targetDate,
    openTicketCount: row.openTicketCount,
    createdAt: row.createdAt.toISOString(),
  };
}
