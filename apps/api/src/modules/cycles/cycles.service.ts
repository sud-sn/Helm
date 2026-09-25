import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  OPEN_TICKET_STATUSES,
  type CompleteCycleInput,
  type CreateCycleInput,
  type Cycle,
  type ResourceScope,
  type UpdateCycleInput,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { cycles, projects, tickets } from '../../db/schema';
import { coverageCondition } from '../../core/access/conditions';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { qualified } from '../../core/sql';
import { badRequest, notFound } from '../../core/errors';
import { requireProject } from '../projects/projects.queries';
import { recordTicketEvent } from '../tickets/tickets.queries';

const ticketCount = sql<number>`(select count(*)::int from ${tickets} where ${tickets.cycleId} = ${qualified(cycles.id)} and ${tickets.status} <> 'cancelled')`;
const doneCount = sql<number>`(select count(*)::int from ${tickets} where ${tickets.cycleId} = ${qualified(cycles.id)} and ${tickets.status} = 'done')`;

function selectCycles(db: Executor) {
  return db
    .select({
      cycle: cycles,
      projectKey: projects.key,
      clientId: projects.clientId,
      ticketCount,
      doneCount,
    })
    .from(cycles)
    .innerJoin(projects, eq(projects.id, cycles.projectId));
}

type CycleRow = Awaited<ReturnType<ReturnType<typeof selectCycles>['execute']>>[number];

function toCycle(row: CycleRow): Cycle {
  const c = row.cycle;
  return {
    id: c.id,
    projectId: c.projectId,
    projectKey: row.projectKey,
    clientId: row.clientId,
    name: c.name,
    goal: c.goal,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    ticketCount: row.ticketCount,
    doneCount: row.doneCount,
    createdAt: c.createdAt.toISOString(),
  };
}

const cycleScope = (row: CycleRow): ResourceScope => ({
  clientId: row.clientId,
  projectId: row.cycle.projectId,
  cycleId: row.cycle.id,
});

async function requireCycle(ctx: RequestContext, cycleId: string): Promise<CycleRow> {
  const [row] = await selectCycles(ctx.db).where(eq(cycles.id, cycleId)).limit(1);
  if (!row || !ctx.access.can('cycle.read', cycleScope(row))) throw notFound('Cycle');
  return row;
}

const STATUS_ORDER = sql`case ${cycles.status} when 'active' then 0 when 'planned' then 1 else 2 end`;

export async function listCycles(ctx: RequestContext, projectKey: string): Promise<Cycle[]> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  const rows = await selectCycles(ctx.db)
    .where(
      and(
        eq(cycles.projectId, project.id),
        coverageCondition(ctx.access.coverage('cycle.read'), {
          clientId: projects.clientId,
          projectId: cycles.projectId,
          cycleId: cycles.id,
        }),
      ),
    )
    .orderBy(STATUS_ORDER, sql`${cycles.startDate} asc nulls last`, asc(cycles.createdAt));
  return rows.map(toCycle);
}

export async function getCycle(ctx: RequestContext, cycleId: string): Promise<Cycle> {
  return toCycle(await requireCycle(ctx, cycleId));
}

export async function createCycle(
  ctx: RequestContext,
  projectKey: string,
  input: CreateCycleInput & { goal: string; status: Cycle['status'] },
): Promise<Cycle> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  ctx.access.require(
    'cycle.create',
    { clientId: project.clientId, projectId: project.id },
    'Only Project Managers can plan cycles.',
  );
  const [created] = await ctx.db
    .insert(cycles)
    .values({
      projectId: project.id,
      name: input.name,
      goal: input.goal,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
      createdById: ctx.user.id,
    })
    .returning({ id: cycles.id });
  return getCycle(ctx, created!.id);
}

export async function updateCycle(
  ctx: RequestContext,
  cycleId: string,
  input: UpdateCycleInput,
): Promise<Cycle> {
  const row = await requireCycle(ctx, cycleId);
  ctx.access.require('cycle.update', cycleScope(row));
  const startDate = input.startDate === undefined ? row.cycle.startDate : input.startDate;
  const endDate = input.endDate === undefined ? row.cycle.endDate : input.endDate;
  if (startDate && endDate && endDate < startDate)
    throw badRequest('End date is before start date.');
  await ctx.db
    .update(cycles)
    .set({
      name: input.name,
      goal: input.goal,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
    })
    .where(eq(cycles.id, cycleId));
  return getCycle(ctx, cycleId);
}

/** Moves every unfinished ticket out of a cycle, recording each move in the ticket's history. */
async function moveOpenTickets(
  tx: Executor,
  params: {
    fromCycle: { id: string; name: string };
    to: { id: string; name: string } | null;
    actorId: string;
  },
): Promise<number> {
  const open = await tx
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      and(
        eq(tickets.cycleId, params.fromCycle.id),
        inArray(tickets.status, [...OPEN_TICKET_STATUSES]),
      ),
    );
  if (open.length === 0) return 0;
  await tx
    .update(tickets)
    .set({ cycleId: params.to?.id ?? null })
    .where(
      inArray(
        tickets.id,
        open.map((t) => t.id),
      ),
    );
  for (const ticket of open) {
    await recordTicketEvent(tx, ticket.id, params.actorId, 'cycle_changed', {
      from: params.fromCycle.name,
      to: params.to?.name ?? null,
    });
  }
  return open.length;
}

export async function completeCycle(
  ctx: RequestContext,
  cycleId: string,
  input: CompleteCycleInput & { moveOpenTicketsTo: string },
): Promise<{ cycle: Cycle; movedTickets: number }> {
  const row = await requireCycle(ctx, cycleId);
  const scope = cycleScope(row);
  ctx.access.require('cycle.update', scope);

  let destination: { id: string; name: string } | null = null;
  if (input.moveOpenTicketsTo === 'backlog') {
    ctx.access.require(
      'ticket.update',
      { ...scope, cycleId: null },
      'You cannot move tickets to the project backlog.',
    );
  } else {
    const [target] = await ctx.db
      .select({ id: cycles.id, name: cycles.name, status: cycles.status })
      .from(cycles)
      .where(
        and(
          eq(cycles.id, input.moveOpenTicketsTo),
          eq(cycles.projectId, row.cycle.projectId),
          ne(cycles.id, cycleId),
        ),
      )
      .limit(1);
    if (!target || target.status === 'completed') {
      throw badRequest('Choose a planned or active cycle of the same project.');
    }
    ctx.access.require(
      'ticket.update',
      { ...scope, cycleId: target.id },
      'You cannot move tickets into that cycle.',
    );
    destination = { id: target.id, name: target.name };
  }

  const movedTickets = await ctx.db.transaction(async (tx) => {
    await tx.update(cycles).set({ status: 'completed' }).where(eq(cycles.id, cycleId));
    return moveOpenTickets(tx, {
      fromCycle: { id: cycleId, name: row.cycle.name },
      to: destination,
      actorId: ctx.user.id,
    });
  });
  return { cycle: await getCycle(ctx, cycleId), movedTickets };
}

export async function deleteCycle(ctx: RequestContext, cycleId: string): Promise<void> {
  const row = await requireCycle(ctx, cycleId);
  ctx.access.require('cycle.delete', cycleScope(row), 'Only Project Managers can delete cycles.');
  await ctx.db.transaction(async (tx) => {
    const all = await tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.cycleId, cycleId));
    for (const ticket of all) {
      await recordTicketEvent(tx, ticket.id, ctx.user.id, 'cycle_changed', {
        from: row.cycle.name,
        to: null,
      });
    }
    // Tickets fall back to the backlog (ON DELETE SET NULL); cycle-level grants go with the cycle.
    await tx.delete(cycles).where(eq(cycles.id, cycleId));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'cycle.deleted',
      entityType: 'cycle',
      entityId: cycleId,
      data: { name: row.cycle.name, projectKey: row.projectKey, ticketsMovedToBacklog: all.length },
      ip: ctx.ip,
    });
  });
}
