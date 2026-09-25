import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  OPEN_TICKET_STATUSES,
  type Dashboard,
  type PortalHome,
  type ProjectProgress,
  type StatusCount,
  type TicketStatus,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, cycles, pitches, projects, tickets } from '../../db/schema';
import { coverageCondition } from '../../core/access/conditions';
import { visibleClientCondition, visibleProjectCondition } from '../../core/access/navigation';
import type { RequestContext } from '../../core/context';
import { qualified } from '../../core/sql';
import { notFound } from '../../core/errors';
import { listMeetings } from '../meetings/meetings.service';
import { listProjectPages } from '../pages/pages.service';
import { listPitches } from '../pitches/pitches.service';
import { requireProject } from '../projects/projects.queries';
import { readableTicketsCondition } from '../tickets/tickets.queries';
import { listMyTickets } from '../tickets/tickets.service';

const OPEN = [...OPEN_TICKET_STATUSES];
const isOpen = inArray(tickets.status, OPEN);
const isOverdue = sql`${tickets.dueDate} < current_date and ${isOpen}`;

/** Counts with FILTER clauses, as integers. */
const countWhere = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})::int`;

export async function getDashboard(ctx: RequestContext): Promise<Dashboard> {
  const { db, access, user } = ctx;
  access.requireStaff();
  const readable = readableTicketsCondition(access);

  const [mine] = await db
    .select({
      openAssigned: countWhere(sql`${isOpen}`),
      dueThisWeek: countWhere(
        sql`${isOpen} and ${tickets.dueDate} between current_date and current_date + 7`,
      ),
      overdue: countWhere(isOverdue),
    })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(and(eq(tickets.assigneeId, user.id), readable));

  const [ticketTotals] = await db
    .select({
      openTickets: countWhere(sql`${isOpen}`),
      overdueTickets: countWhere(isOverdue),
      blockedTickets: countWhere(sql`${tickets.status} = 'blocked'`),
      completedLast7Days: countWhere(sql`${tickets.completedAt} >= now() - interval '7 days'`),
    })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(readable);

  const [clientTotal] = await db
    .select({ value: count() })
    .from(clients)
    .where(visibleClientCondition(db, access));
  const [projectTotal] = await db
    .select({ value: count() })
    .from(projects)
    .where(and(visibleProjectCondition(db, access), eq(projects.status, 'active')));
  const cycleCoverage = coverageCondition(access.coverage('cycle.read'), {
    clientId: projects.clientId,
    projectId: cycles.projectId,
    cycleId: cycles.id,
  });
  const [cycleTotal] = await db
    .select({ value: count() })
    .from(cycles)
    .innerJoin(projects, eq(projects.id, cycles.projectId))
    .where(and(eq(cycles.status, 'active'), cycleCoverage));
  const [pitchTotal] = await db
    .select({ value: count() })
    .from(pitches)
    .where(
      and(
        eq(pitches.status, 'sent'),
        coverageCondition(access.coverage('pitch.read'), {
          clientId: pitches.clientId,
          projectId: pitches.projectId,
        }),
      ),
    );

  const byStatusRows = await db
    .select({ status: tickets.status, count: count() })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(and(readable, sql`${tickets.status} <> 'cancelled'`))
    .groupBy(tickets.status);

  const projectRows = await db
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      clientName: clients.name,
      open: countWhere(sql`${isOpen}`),
      overdue: countWhere(isOverdue),
      blocked: countWhere(sql`${tickets.status} = 'blocked'`),
      doneLast30Days: countWhere(sql`${tickets.completedAt} >= now() - interval '30 days'`),
    })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(readable)
    .groupBy(projects.id, clients.name)
    .orderBy(
      desc(sql`count(*) filter (where ${isOverdue})`),
      desc(sql`count(*) filter (where ${isOpen})`),
    )
    .limit(20);

  const cycleRows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      projectKey: projects.key,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      total: sql<number>`(select count(*)::int from ${tickets} where ${tickets.cycleId} = ${qualified(cycles.id)} and ${tickets.status} <> 'cancelled')`,
      done: sql<number>`(select count(*)::int from ${tickets} where ${tickets.cycleId} = ${qualified(cycles.id)} and ${tickets.status} = 'done')`,
    })
    .from(cycles)
    .innerJoin(projects, eq(projects.id, cycles.projectId))
    .where(and(eq(cycles.status, 'active'), cycleCoverage))
    .orderBy(sql`${cycles.endDate} asc nulls last`)
    .limit(12);

  return {
    me: {
      openAssigned: mine?.openAssigned ?? 0,
      dueThisWeek: mine?.dueThisWeek ?? 0,
      overdue: mine?.overdue ?? 0,
      tickets: (await listMyTickets(ctx)).slice(0, 8),
    },
    totals: {
      clients: clientTotal?.value ?? 0,
      projects: projectTotal?.value ?? 0,
      activeCycles: cycleTotal?.value ?? 0,
      openTickets: ticketTotals?.openTickets ?? 0,
      overdueTickets: ticketTotals?.overdueTickets ?? 0,
      blockedTickets: ticketTotals?.blockedTickets ?? 0,
      completedLast7Days: ticketTotals?.completedLast7Days ?? 0,
      pitchesAwaitingClient: pitchTotal?.value ?? 0,
    },
    byStatus: orderStatusCounts(byStatusRows),
    projects: projectRows,
    activeCycles: cycleRows,
  };
}

const STATUS_ORDER: TicketStatus[] = ['todo', 'in_progress', 'blocked', 'in_review', 'uat', 'done'];

function orderStatusCounts(rows: { status: TicketStatus; count: number }[]): StatusCount[] {
  const counts = new Map(rows.map((row) => [row.status, row.count]));
  return STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

async function projectProgress(
  db: Executor,
  project: {
    id: string;
    key: string;
    name: string;
    status: ProjectProgress['status'];
    targetDate: string | null;
  },
): Promise<ProjectProgress> {
  const byStatus = await db
    .select({ status: tickets.status, count: count() })
    .from(tickets)
    .where(and(eq(tickets.projectId, project.id), sql`${tickets.status} <> 'cancelled'`))
    .groupBy(tickets.status);
  const cycleRows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      status: cycles.status,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      total: sql<number>`(select count(*)::int from ${tickets} where ${tickets.cycleId} = ${qualified(cycles.id)} and ${tickets.status} <> 'cancelled')`,
      done: sql<number>`(select count(*)::int from ${tickets} where ${tickets.cycleId} = ${qualified(cycles.id)} and ${tickets.status} = 'done')`,
    })
    .from(cycles)
    .where(eq(cycles.projectId, project.id))
    .orderBy(
      sql`case ${cycles.status} when 'active' then 0 when 'planned' then 1 else 2 end`,
      sql`${cycles.startDate} desc nulls last`,
    )
    .limit(8);
  return {
    projectId: project.id,
    projectKey: project.key,
    projectName: project.name,
    status: project.status,
    targetDate: project.targetDate,
    byStatus: orderStatusCounts(byStatus),
    cycles: cycleRows,
  };
}

/** Ticket counts per status and cycle progress — no ticket details — for staff and clients. */
export async function getProjectProgress(
  ctx: RequestContext,
  projectKey: string,
): Promise<ProjectProgress> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  ctx.access.requireVisible(
    'progress.read',
    { clientId: project.clientId, projectId: project.id },
    'Project',
  );
  return projectProgress(ctx.db, project);
}

/** The client portal's home page. */
export async function getPortalHome(ctx: RequestContext): Promise<PortalHome> {
  const { db, access, user } = ctx;
  if (!access.isClientUser || !user.clientId) throw notFound('Page');
  const [company] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, user.clientId))
    .limit(1);
  if (!company) throw notFound('Client');

  const visibleProjects = await db
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      status: projects.status,
      targetDate: projects.targetDate,
    })
    .from(projects)
    .where(
      and(
        eq(projects.clientId, company.id),
        coverageCondition(access.coverage('progress.read'), {
          clientId: projects.clientId,
          projectId: projects.id,
        }),
      ),
    )
    .orderBy(asc(projects.name));

  const recentPages = (
    await Promise.all(
      visibleProjects.map((project) => listProjectPages(ctx, project.key).catch(() => [])),
    )
  )
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);

  return {
    client: company,
    projects: await Promise.all(visibleProjects.map((project) => projectProgress(db, project))),
    pitchesAwaitingResponse: (await listPitches(ctx, { clientId: company.id })).filter(
      (p) => p.status === 'sent',
    ),
    recentPages,
    recentMeetings: (await listMeetings(ctx, { clientId: company.id })).slice(0, 10),
  };
}
