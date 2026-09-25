import { and, eq, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  parseTicketKey,
  type ResourceScope,
  type Ticket,
  type TicketEventType,
  type UserSummary,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import {
  cycles,
  projects,
  roleAssignments,
  ticketEvents,
  ticketWatchers,
  tickets,
  users,
} from '../../db/schema';
import { loadGrants, type Access } from '../../core/access/access';
import { coverageCondition } from '../../core/access/conditions';
import { badRequest, notFound } from '../../core/errors';
import { iso, requiredUserSummary, userSummary } from '../../core/dto';

const assignee = alias(users, 'assignee');
const reporter = alias(users, 'reporter');

export function selectTickets(db: Executor) {
  return db
    .select({
      ticket: tickets,
      projectKey: projects.key,
      clientId: projects.clientId,
      cycleName: cycles.name,
      assignee: { id: assignee.id, username: assignee.username, displayName: assignee.displayName },
      reporter: { id: reporter.id, username: reporter.username, displayName: reporter.displayName },
    })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .leftJoin(cycles, eq(cycles.id, tickets.cycleId))
    .leftJoin(assignee, eq(assignee.id, tickets.assigneeId))
    .innerJoin(reporter, eq(reporter.id, tickets.reporterId));
}

export type TicketRow = Awaited<ReturnType<ReturnType<typeof selectTickets>['execute']>>[number];

export function toTicket(row: TicketRow): Ticket {
  const t = row.ticket;
  return {
    id: t.id,
    key: `${row.projectKey}-${t.number}`,
    number: t.number,
    projectId: t.projectId,
    projectKey: row.projectKey,
    clientId: row.clientId,
    cycleId: t.cycleId,
    cycleName: row.cycleName,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    priority: t.priority,
    assignee: userSummary(row.assignee),
    reporter: requiredUserSummary(row.reporter),
    dueDate: t.dueDate,
    estimateHours: t.estimateHours,
    labels: t.labels,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: iso(t.completedAt),
  };
}

export function ticketScope(row: {
  clientId: string;
  ticket: { projectId: string; cycleId: string | null };
}): ResourceScope {
  return { clientId: row.clientId, projectId: row.ticket.projectId, cycleId: row.ticket.cycleId };
}

/** Tickets the caller may read. Requires the query to join `projects`. */
export function readableTicketsCondition(access: Access) {
  return coverageCondition(access.coverage('ticket.read'), {
    clientId: projects.clientId,
    projectId: tickets.projectId,
    cycleId: tickets.cycleId,
  });
}

export async function findTicketByKey(db: Executor, key: string): Promise<TicketRow | null> {
  const parsed = parseTicketKey(key);
  if (!parsed) return null;
  const [row] = await selectTickets(db)
    .where(and(eq(projects.key, parsed.projectKey), eq(tickets.number, parsed.number)))
    .limit(1);
  return row ?? null;
}

/** A ticket the caller may read, or 404. */
export async function requireReadableTicket(
  db: Executor,
  access: Access,
  key: string,
): Promise<TicketRow> {
  const row = await findTicketByKey(db, key);
  if (!row || !access.can('ticket.read', ticketScope(row))) throw notFound('Ticket');
  return row;
}

export async function recordTicketEvent(
  executor: Executor,
  ticketId: string,
  actorId: string | null,
  type: TicketEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  await executor.insert(ticketEvents).values({ ticketId, actorId, type, data });
}

export async function addWatchers(
  executor: Executor,
  ticketId: string,
  userIds: (string | null | undefined)[],
) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  await executor
    .insert(ticketWatchers)
    .values(ids.map((userId) => ({ ticketId, userId })))
    .onConflictDoNothing();
}

export async function watcherIds(executor: Executor, ticketId: string): Promise<string[]> {
  const rows = await executor
    .select({ userId: ticketWatchers.userId })
    .from(ticketWatchers)
    .where(eq(ticketWatchers.ticketId, ticketId));
  return rows.map((row) => row.userId);
}

const ASSIGNABLE_ROLES = ROLES.filter((role) => ROLE_PERMISSIONS[role].has('ticket.update_own'));

/** Throws 400 unless the user is active staff who can work on tickets at this scope. */
export async function assertAssignable(
  executor: Executor,
  userId: string,
  scope: ResourceScope,
): Promise<UserSummary> {
  const [user] = await executor
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      isActive: users.isActive,
      userType: users.userType,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || !user.isActive || user.userType !== 'staff') {
    throw badRequest('That person cannot be assigned tickets.');
  }
  const grants = await loadGrants(executor, userId);
  if (!hasPermission(grants, scope, 'ticket.update_own')) {
    throw badRequest(
      `${user.displayName} does not have access to this ${scope.cycleId ? 'cycle' : 'project'} and cannot be assigned.`,
    );
  }
  return { id: user.id, username: user.username, displayName: user.displayName };
}

/** Everyone who could be assigned a ticket at this scope, for pickers. */
export async function assignableUsers(
  executor: Executor,
  scope: ResourceScope,
): Promise<UserSummary[]> {
  const scopeConditions = [
    eq(roleAssignments.scopeType, 'workspace'),
    scope.clientId ? eq(roleAssignments.clientId, scope.clientId) : undefined,
    scope.projectId ? eq(roleAssignments.projectId, scope.projectId) : undefined,
    scope.cycleId ? eq(roleAssignments.cycleId, scope.cycleId) : undefined,
  ].filter((condition) => condition !== undefined);
  return executor
    .selectDistinct({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
    .where(
      and(
        eq(users.isActive, true),
        eq(users.userType, 'staff'),
        inArray(roleAssignments.role, ASSIGNABLE_ROLES),
        or(...scopeConditions),
      ),
    )
    .orderBy(users.displayName);
}
