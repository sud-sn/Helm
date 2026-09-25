import { eq, inArray, or } from 'drizzle-orm';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  type ImportResult,
  type ImportRowResult,
  type ResourceScope,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type ticketListQuerySchema,
} from '@helm/shared';
import type { z } from 'zod';
import { cycles, users } from '../../db/schema';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { parseCsv, toCsv } from '../../core/csv';
import { badRequest } from '../../core/errors';
import { requireProject } from '../projects/projects.queries';
import { assertAssignable } from './tickets.queries';
import { insertTicket, listProjectTickets, type NormalizedTicketInput } from './tickets.service';

export const MAX_IMPORT_ROWS = 1000;

export const EXPORT_COLUMNS = [
  'key',
  'title',
  'description',
  'type',
  'status',
  'priority',
  'assignee',
  'reporter',
  'cycle',
  'due_date',
  'estimate_hours',
  'labels',
  'created_at',
  'updated_at',
  'completed_at',
] as const;

/** Header spellings commonly found in Excel trackers, mapped to Helm's columns. */
const HEADER_ALIASES: Record<string, string> = {
  summary: 'title',
  name: 'title',
  task: 'title',
  details: 'description',
  notes: 'description',
  state: 'status',
  owner: 'assignee',
  assigned_to: 'assignee',
  assignee_email: 'assignee',
  due: 'due_date',
  target_date: 'due_date',
  deadline: 'due_date',
  estimate: 'estimate_hours',
  hours: 'estimate_hours',
  effort: 'estimate_hours',
  tags: 'labels',
  sprint: 'cycle',
  phase: 'cycle',
  issue_type: 'type',
  ticket_type: 'type',
};

export function normaliseHeader(header: string): string {
  const snake = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return HEADER_ALIASES[snake] ?? snake;
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function lookup<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  extra: Record<string, T>,
) {
  const table = new Map<string, T>();
  for (const value of values) {
    table.set(squash(value), value);
    table.set(squash(labels[value]), value);
  }
  for (const [alias, value] of Object.entries(extra)) table.set(squash(alias), value);
  return (raw: string): T | undefined => table.get(squash(raw));
}

const toStatus = lookup<TicketStatus>(TICKET_STATUSES, TICKET_STATUS_LABELS, {
  open: 'todo',
  new: 'todo',
  backlog: 'todo',
  'not started': 'todo',
  wip: 'in_progress',
  doing: 'in_progress',
  started: 'in_progress',
  'on hold': 'blocked',
  review: 'in_review',
  'code review': 'in_review',
  testing: 'uat',
  qa: 'uat',
  closed: 'done',
  complete: 'done',
  completed: 'done',
  resolved: 'done',
  canceled: 'cancelled',
  "won't do": 'cancelled',
});
const toPriority = lookup<TicketPriority>(TICKET_PRIORITIES, TICKET_PRIORITY_LABELS, {
  critical: 'urgent',
  highest: 'urgent',
  p1: 'urgent',
  p2: 'high',
  normal: 'medium',
  p3: 'medium',
  p4: 'low',
  lowest: 'low',
});
const toType = lookup<TicketType>(TICKET_TYPES, TICKET_TYPE_LABELS, {
  defect: 'bug',
  issue: 'bug',
  etl: 'pipeline',
  elt: 'pipeline',
  report: 'report',
  dashboard: 'report',
  model: 'data_model',
  dq: 'data_quality',
  spike: 'investigation',
  research: 'investigation',
  story: 'task',
});

/** YYYY-MM-DD, or day-first DD/MM/YYYY and DD-MM-YYYY as exported by most Excel locales here. */
export function parseDate(raw: string): string | null | undefined {
  if (!raw) return null;
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dayFirst)
    [day, month, year] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
  else return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

interface PlannedTicket {
  row: ImportRowResult;
  input: NormalizedTicketInput | null;
}

/**
 * Imports tickets from a CSV exported from an existing tracker. Every row is validated first;
 * nothing is written unless all rows are valid (and `dryRun` is false).
 */
export async function importTickets(
  ctx: RequestContext,
  projectKey: string,
  input: { csv: string; dryRun: boolean },
): Promise<ImportResult> {
  const { db, access } = ctx;
  const project = await requireProject(db, access, projectKey);
  const projectScope: ResourceScope = {
    clientId: project.clientId,
    projectId: project.id,
    cycleId: null,
  };
  access.require('ticket.create', projectScope, 'You cannot import tickets into this project.');

  const parsed = parseCsv(input.csv, normaliseHeader);
  if (!parsed.headers.includes('title')) {
    throw badRequest('The file needs a header row with a "title" column (or "summary"/"name").');
  }
  if (parsed.rows.length === 0) throw badRequest('The file has no rows to import.');
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw badRequest(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  }
  if (parsed.errors.length > 0)
    throw badRequest('The file could not be read as CSV.', parsed.errors);

  const projectCycles = await db
    .select({ id: cycles.id, name: cycles.name })
    .from(cycles)
    .where(eq(cycles.projectId, project.id));
  const cycleByName = new Map(projectCycles.map((c) => [c.name.trim().toLowerCase(), c]));

  const people = [
    ...new Set(parsed.rows.map((r) => (r.assignee ?? '').toLowerCase()).filter(Boolean)),
  ];
  const peopleRows =
    people.length > 0
      ? await db
          .select({ id: users.id, username: users.username, email: users.email })
          .from(users)
          .where(or(inArray(users.username, people), inArray(users.email, people)))
      : [];
  const personByHandle = new Map<string, string>();
  for (const person of peopleRows) {
    personByHandle.set(person.username, person.id);
    if (person.email) personByHandle.set(person.email, person.id);
  }

  const planned: PlannedTicket[] = [];
  for (const [index, raw] of parsed.rows.entries()) {
    const errors: string[] = [];
    const title = (raw.title ?? '').trim();
    if (!title) errors.push('Title is empty.');
    if (title.length > 200) errors.push('Title is longer than 200 characters.');

    const status = raw.status ? toStatus(raw.status) : 'todo';
    if (!status) errors.push(`Unknown status "${raw.status}".`);
    const priority = raw.priority ? toPriority(raw.priority) : 'medium';
    if (!priority) errors.push(`Unknown priority "${raw.priority}".`);
    const type = raw.type ? toType(raw.type) : 'task';
    if (!type) errors.push(`Unknown type "${raw.type}".`);

    const dueDate = parseDate(raw.due_date ?? '');
    if (dueDate === undefined)
      errors.push(`Unreadable date "${raw.due_date}" (use YYYY-MM-DD or DD/MM/YYYY).`);

    let estimateHours: number | null = null;
    if (raw.estimate_hours) {
      const value = Number(raw.estimate_hours.replace(',', '.'));
      if (!Number.isFinite(value) || value < 0 || value > 10000)
        errors.push(`Invalid estimate "${raw.estimate_hours}".`);
      else estimateHours = Math.round(value * 10) / 10;
    }

    let cycleId: string | null = null;
    if (raw.cycle) {
      const cycle = cycleByName.get(raw.cycle.trim().toLowerCase());
      if (!cycle) errors.push(`No cycle named "${raw.cycle}" in ${project.key}.`);
      else cycleId = cycle.id;
    }
    const scope: ResourceScope = { ...projectScope, cycleId };
    if (cycleId && !access.can('ticket.create', scope))
      errors.push('You cannot create tickets in that cycle.');

    let assigneeId: string | null = null;
    if (raw.assignee) {
      const id = personByHandle.get(raw.assignee.toLowerCase());
      if (!id) errors.push(`No user "${raw.assignee}".`);
      else {
        try {
          await assertAssignable(db, id, scope);
          assigneeId = id;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Cannot be assigned.');
        }
      }
    }

    const labels = (raw.labels ?? '')
      .split(/[,;|]/)
      .map((label) => label.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 10);

    planned.push({
      row: { row: index + 2, title, errors },
      input:
        errors.length === 0
          ? {
              title,
              description: (raw.description ?? '').slice(0, 20000),
              type: type!,
              status: status!,
              priority: priority!,
              assigneeId,
              cycleId,
              dueDate: dueDate ?? null,
              estimateHours,
              labels: [...new Set(labels)],
            }
          : null,
    });
  }

  const valid = planned.every((plan) => plan.row.errors.length === 0);
  let created = 0;
  if (valid && !input.dryRun) {
    await db.transaction(async (tx) => {
      for (const plan of planned) {
        await insertTicket(tx, {
          project,
          input: plan.input!,
          actorId: ctx.user.id,
          source: 'import',
        });
        created++;
      }
      await recordAudit(tx, {
        actorId: ctx.user.id,
        action: 'tickets.imported',
        entityType: 'project',
        entityId: project.id,
        data: { projectKey: project.key, count: created },
        ip: ctx.ip,
      });
    });
  }
  return {
    dryRun: input.dryRun,
    valid,
    totalRows: planned.length,
    rows: planned.map((plan) => plan.row),
    created,
  };
}

export async function exportTickets(
  ctx: RequestContext,
  projectKey: string,
  query: z.output<typeof ticketListQuerySchema>,
): Promise<{ filename: string; csv: string }> {
  const list = await listProjectTickets(ctx, projectKey, { ...query, limit: 500, offset: 0 });
  const all = [...list];
  // Page through larger projects.
  for (let offset = 500; list.length === 500 && all.length === offset; offset += 500) {
    const next = await listProjectTickets(ctx, projectKey, { ...query, limit: 500, offset });
    all.push(...next);
    if (next.length < 500) break;
  }
  const rows = all.map((t) => [
    t.key,
    t.title,
    t.description,
    t.type,
    t.status,
    t.priority,
    t.assignee?.username,
    t.reporter.username,
    t.cycleName,
    t.dueDate,
    t.estimateHours,
    t.labels.join(', '),
    t.createdAt,
    t.updatedAt,
    t.completedAt,
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `${projectKey.toUpperCase()}-tickets-${date}.csv`,
    csv: toCsv([...EXPORT_COLUMNS], rows),
  };
}
