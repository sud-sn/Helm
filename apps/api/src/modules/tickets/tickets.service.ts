import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
  OPEN_TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  formatTicketKey,
  type ResourceScope,
  type Ticket,
  type TicketDetail,
  type TicketEvent,
  type UpdateTicketInput,
  type UserSummary,
} from '@helm/shared';
import type { z } from 'zod';
import type { Executor } from '../../db/client';
import {
  cycles,
  meetings,
  projects,
  ticketEvents,
  ticketWatchers,
  tickets,
  users,
} from '../../db/schema';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { badRequest, forbidden, notFound } from '../../core/errors';
import { userSummary } from '../../core/dto';
import { notify } from '../notifications/notify';
import {
  hasPermissionWithinProject,
  requireProject,
  type ProjectRow,
} from '../projects/projects.queries';
import {
  addWatchers,
  assertAssignable,
  assignableUsers,
  readableTicketsCondition,
  recordTicketEvent,
  requireReadableTicket,
  selectTickets,
  ticketScope,
  toTicket,
  watcherIds,
} from './tickets.queries';
import type { createTicketSchema, ticketListQuerySchema } from '@helm/shared';

export type NormalizedTicketInput = z.output<typeof createTicketSchema>;

/** Checks that a cycle belongs to the project and returns its name. */
async function requireCycleInProject(db: Executor, projectId: string, cycleId: string) {
  const [cycle] = await db
    .select({ id: cycles.id, name: cycles.name, status: cycles.status })
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), eq(cycles.projectId, projectId)))
    .limit(1);
  if (!cycle) throw badRequest('That cycle does not belong to this project.');
  return cycle;
}

/**
 * Inserts a ticket with the next project number, its creation event and watchers, and notifies
 * the assignee. Callers check permissions and validate references first. Runs inside `tx`.
 */
export async function insertTicket(
  tx: Executor,
  params: {
    project: Pick<ProjectRow, 'id' | 'key'>;
    input: NormalizedTicketInput;
    actorId: string;
    source?: 'manual' | 'import' | 'meeting';
    sourceMeetingId?: string | null;
  },
): Promise<{ id: string; key: string }> {
  const { project, input, actorId } = params;
  const [sequence] = await tx
    .update(projects)
    .set({ ticketSeq: sql`${projects.ticketSeq} + 1` })
    .where(eq(projects.id, project.id))
    .returning({ number: projects.ticketSeq });
  const number = sequence!.number;
  const now = new Date();
  const [created] = await tx
    .insert(tickets)
    .values({
      projectId: project.id,
      cycleId: input.cycleId ?? null,
      number,
      title: input.title,
      description: input.description,
      type: input.type,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      reporterId: actorId,
      dueDate: input.dueDate ?? null,
      estimateHours: input.estimateHours ?? null,
      labels: input.labels,
      source: params.source ?? 'manual',
      sourceMeetingId: params.sourceMeetingId ?? null,
      statusChangedAt: now,
      completedAt: input.status === 'done' ? now : null,
    })
    .returning({ id: tickets.id });
  const ticketId = created!.id;
  const key = formatTicketKey(project.key, number);

  await recordTicketEvent(
    tx,
    ticketId,
    actorId,
    params.source === 'import' ? 'imported' : 'created',
    {
      status: input.status,
      ...(params.sourceMeetingId ? { meetingId: params.sourceMeetingId } : {}),
    },
  );
  await addWatchers(tx, ticketId, [actorId, input.assigneeId]);
  if (input.assigneeId) {
    await notify(tx, {
      recipients: [input.assigneeId],
      type: 'ticket_assigned',
      actorId,
      data: { ticketKey: key, ticketTitle: input.title, projectKey: project.key },
    });
  }
  return { id: ticketId, key };
}

async function loadTicket(db: Executor, id: string): Promise<Ticket> {
  const [row] = await selectTickets(db).where(eq(tickets.id, id)).limit(1);
  if (!row) throw notFound('Ticket');
  return toTicket(row);
}

// ------------------------------------------------------------------ list & read

export async function listProjectTickets(
  ctx: RequestContext,
  projectKey: string,
  query: z.output<typeof ticketListQuerySchema>,
): Promise<Ticket[]> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  if (!(await hasPermissionWithinProject(ctx.db, ctx.access, project, 'ticket.read'))) {
    throw notFound('Project');
  }
  const filters: (SQL | undefined)[] = [
    eq(tickets.projectId, project.id),
    readableTicketsCondition(ctx.access),
  ];
  if (query.status?.length) filters.push(inArray(tickets.status, query.status));
  if (query.priority?.length) filters.push(inArray(tickets.priority, query.priority));
  if (query.type?.length) filters.push(inArray(tickets.type, query.type));
  if (query.cycle === 'backlog') filters.push(isNull(tickets.cycleId));
  else if (query.cycle) filters.push(eq(tickets.cycleId, query.cycle));
  if (query.assignee === 'me') filters.push(eq(tickets.assigneeId, ctx.user.id));
  else if (query.assignee === 'none') filters.push(isNull(tickets.assigneeId));
  else if (query.assignee) filters.push(eq(tickets.assigneeId, query.assignee));
  if (query.q) {
    const numberMatch = /^(?:[A-Za-z][A-Za-z0-9]*-|#)?(\d+)$/.exec(query.q);
    const pattern = `%${query.q.replace(/[%_\\]/g, '\\$&')}%`;
    filters.push(
      or(
        ilike(tickets.title, pattern),
        numberMatch ? eq(tickets.number, Number(numberMatch[1])) : undefined,
      ),
    );
  }
  const rows = await selectTickets(ctx.db)
    .where(and(...filters))
    .orderBy(desc(tickets.number))
    .limit(query.limit)
    .offset(query.offset);
  return rows.map(toTicket);
}

/** Open tickets assigned to the caller, across every project they can see. */
export async function listMyTickets(ctx: RequestContext): Promise<Ticket[]> {
  const rows = await selectTickets(ctx.db)
    .where(
      and(
        eq(tickets.assigneeId, ctx.user.id),
        inArray(tickets.status, [...OPEN_TICKET_STATUSES]),
        readableTicketsCondition(ctx.access),
      ),
    )
    .orderBy(sql`${tickets.dueDate} asc nulls last`, desc(tickets.updatedAt))
    .limit(200);
  return rows.map(toTicket);
}

export async function getTicket(ctx: RequestContext, key: string): Promise<TicketDetail> {
  const row = await requireReadableTicket(ctx.db, ctx.access, key);
  const watchers = await watcherIds(ctx.db, row.ticket.id);
  let sourceMeeting: TicketDetail['sourceMeeting'] = null;
  if (row.ticket.sourceMeetingId) {
    const [meeting] = await ctx.db
      .select({
        id: meetings.id,
        title: meetings.title,
        clientId: meetings.clientId,
        projectId: meetings.projectId,
      })
      .from(meetings)
      .where(eq(meetings.id, row.ticket.sourceMeetingId))
      .limit(1);
    if (
      meeting &&
      ctx.access.can('meeting.read', { clientId: meeting.clientId, projectId: meeting.projectId })
    ) {
      sourceMeeting = { id: meeting.id, title: meeting.title };
    }
  }
  return {
    ...toTicket(row),
    watching: watchers.includes(ctx.user.id),
    watcherCount: watchers.length,
    sourceMeeting,
  };
}

export async function listTicketEvents(ctx: RequestContext, key: string): Promise<TicketEvent[]> {
  const row = await requireReadableTicket(ctx.db, ctx.access, key);
  const events = await ctx.db
    .select({
      id: ticketEvents.id,
      type: ticketEvents.type,
      data: ticketEvents.data,
      createdAt: ticketEvents.createdAt,
      actor: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(ticketEvents)
    .leftJoin(users, eq(users.id, ticketEvents.actorId))
    .where(eq(ticketEvents.ticketId, row.ticket.id))
    .orderBy(asc(ticketEvents.createdAt), asc(ticketEvents.id));
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    actor: userSummary(event.actor),
    data: event.data,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function listAssignableUsers(
  ctx: RequestContext,
  projectKey: string,
  cycleId: string | undefined,
): Promise<UserSummary[]> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  if (cycleId) await requireCycleInProject(ctx.db, project.id, cycleId);
  const scope: ResourceScope = {
    clientId: project.clientId,
    projectId: project.id,
    cycleId: cycleId ?? null,
  };
  if (!ctx.access.can('ticket.read', scope)) throw notFound('Project');
  return assignableUsers(ctx.db, scope);
}

// ------------------------------------------------------------------ create, update, delete

export async function createTicket(
  ctx: RequestContext,
  projectKey: string,
  input: NormalizedTicketInput,
): Promise<Ticket> {
  const { db, access } = ctx;
  const project = await requireProject(db, access, projectKey);
  if (input.cycleId) await requireCycleInProject(db, project.id, input.cycleId);
  const scope: ResourceScope = {
    clientId: project.clientId,
    projectId: project.id,
    cycleId: input.cycleId ?? null,
  };
  access.require(
    'ticket.create',
    scope,
    input.cycleId
      ? 'You cannot create tickets in this cycle.'
      : 'You cannot create tickets in this project.',
  );
  if (input.assigneeId) await assertAssignable(db, input.assigneeId, scope);

  const created = await db.transaction((tx) =>
    insertTicket(tx, { project, input, actorId: ctx.user.id }),
  );
  return loadTicket(db, created.id);
}

const FULL_EDIT_ONLY_FIELDS = [
  'title',
  'description',
  'type',
  'priority',
  'assigneeId',
  'cycleId',
  'dueDate',
  'estimateHours',
  'labels',
] as const;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => v === b[i]);
  return (a ?? null) === (b ?? null);
}

export async function updateTicket(
  ctx: RequestContext,
  key: string,
  input: UpdateTicketInput,
): Promise<Ticket> {
  const { db, access, user } = ctx;
  const row = await requireReadableTicket(db, access, key);
  const current = row.ticket;
  const scope = ticketScope(row);

  // Only fields that actually change matter for permissions, history and notifications.
  const changed = Object.fromEntries(
    Object.entries(input).filter(
      ([field, value]) =>
        value !== undefined && !sameValue(value, current[field as keyof typeof current]),
    ),
  ) as UpdateTicketInput;
  if (Object.keys(changed).length === 0) return toTicket(row);

  const fullEdit = access.can('ticket.update', scope);
  if (!fullEdit) {
    const ownTicket = current.assigneeId === user.id && access.can('ticket.update_own', scope);
    if (!ownTicket) throw forbidden('You cannot edit this ticket.');
    const blocked = FULL_EDIT_ONLY_FIELDS.filter((field) => field in changed);
    if (blocked.length > 0) {
      throw forbidden('You can only change the status of tickets assigned to you.');
    }
  }

  let targetScope = scope;
  let targetCycleName: string | null = row.cycleName;
  if (changed.cycleId !== undefined) {
    if (changed.cycleId) {
      const cycle = await requireCycleInProject(db, current.projectId, changed.cycleId);
      targetCycleName = cycle.name;
    } else {
      targetCycleName = null;
    }
    targetScope = { ...scope, cycleId: changed.cycleId ?? null };
    access.require(
      'ticket.update',
      targetScope,
      changed.cycleId
        ? 'You cannot move tickets into that cycle.'
        : 'You cannot move tickets to the backlog.',
    );
  }
  const newAssigneeId = changed.assigneeId;
  let newAssignee: UserSummary | null = null;
  if (newAssigneeId) newAssignee = await assertAssignable(db, newAssigneeId, targetScope);
  else if (current.assigneeId && newAssigneeId === undefined) {
    // The ticket may be moving to a cycle its current assignee cannot see.
    if (changed.cycleId !== undefined) await assertAssignable(db, current.assigneeId, targetScope);
  }

  const now = new Date();
  const ticketKey = formatTicketKey(row.projectKey, current.number);
  await db.transaction(async (tx) => {
    const statusChanged = changed.status !== undefined;
    await tx
      .update(tickets)
      .set({
        ...changed,
        ...(statusChanged
          ? {
              statusChangedAt: now,
              completedAt: changed.status === 'done' ? now : null,
            }
          : {}),
      })
      .where(eq(tickets.id, current.id));

    if (statusChanged) {
      await recordTicketEvent(tx, current.id, user.id, 'status_changed', {
        from: current.status,
        to: changed.status,
      });
    }
    if (newAssigneeId !== undefined) {
      await recordTicketEvent(tx, current.id, user.id, 'assigned', {
        from: row.assignee?.displayName ?? null,
        to: newAssignee?.displayName ?? null,
      });
    }
    if (changed.cycleId !== undefined) {
      await recordTicketEvent(tx, current.id, user.id, 'cycle_changed', {
        from: row.cycleName,
        to: targetCycleName,
      });
    }
    const otherFields = Object.keys(changed).filter(
      (field) => !['status', 'assigneeId', 'cycleId'].includes(field),
    );
    if (otherFields.length > 0) {
      await recordTicketEvent(tx, current.id, user.id, 'updated', { fields: otherFields });
    }

    await addWatchers(tx, current.id, [newAssigneeId]);
    const title = changed.title ?? current.title;
    if (newAssigneeId) {
      await notify(tx, {
        recipients: [newAssigneeId],
        type: 'ticket_assigned',
        actorId: user.id,
        data: { ticketKey, ticketTitle: title, projectKey: row.projectKey },
      });
    }
    if (statusChanged) {
      const watchers = await watcherIds(tx, current.id);
      await notify(tx, {
        recipients: watchers.filter((id) => id !== newAssigneeId),
        type: 'ticket_status_changed',
        actorId: user.id,
        data: {
          ticketKey,
          ticketTitle: title,
          projectKey: row.projectKey,
          from: TICKET_STATUS_LABELS[current.status],
          to: TICKET_STATUS_LABELS[changed.status!],
        },
      });
    }
  });
  return loadTicket(db, current.id);
}

export async function deleteTicket(ctx: RequestContext, key: string): Promise<void> {
  const row = await requireReadableTicket(ctx.db, ctx.access, key);
  ctx.access.require('ticket.delete', ticketScope(row), 'You cannot delete this ticket.');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(tickets).where(eq(tickets.id, row.ticket.id));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'ticket.deleted',
      entityType: 'ticket',
      entityId: row.ticket.id,
      data: { key: formatTicketKey(row.projectKey, row.ticket.number), title: row.ticket.title },
      ip: ctx.ip,
    });
  });
}

export async function setWatching(
  ctx: RequestContext,
  key: string,
  watching: boolean,
): Promise<void> {
  const row = await requireReadableTicket(ctx.db, ctx.access, key);
  if (watching) {
    await addWatchers(ctx.db, row.ticket.id, [ctx.user.id]);
  } else {
    await ctx.db
      .delete(ticketWatchers)
      .where(
        and(eq(ticketWatchers.ticketId, row.ticket.id), eq(ticketWatchers.userId, ctx.user.id)),
      );
  }
}
