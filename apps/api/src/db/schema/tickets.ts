import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { TICKET_EVENT_TYPES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from '@helm/shared';
import { createdAt, id, oneOf, timestamptz, updatedAt } from './_helpers';
import { meetings } from './meetings';
import { cycles, projects } from './org';
import { users } from './users';

export const TICKET_SOURCES = ['manual', 'import', 'meeting'] as const;

export const tickets = pgTable(
  'tickets',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Null means the ticket is in the project backlog. */
    cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    /** Per-project sequence number; the key is `${project.key}-${number}`. */
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    type: text('type', { enum: TICKET_TYPES }).notNull().default('task'),
    status: text('status', { enum: TICKET_STATUSES }).notNull().default('todo'),
    priority: text('priority', { enum: TICKET_PRIORITIES }).notNull().default('medium'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    dueDate: date('due_date', { mode: 'string' }),
    estimateHours: numeric('estimate_hours', { precision: 7, scale: 1, mode: 'number' }),
    labels: text('labels')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: text('source', { enum: TICKET_SOURCES }).notNull().default('manual'),
    sourceMeetingId: uuid('source_meeting_id').references((): AnyPgColumn => meetings.id, {
      onDelete: 'set null',
    }),
    statusChangedAt: timestamptz('status_changed_at').notNull().defaultNow(),
    completedAt: timestamptz('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('tickets_project_number_key').on(t.projectId, t.number),
    index('tickets_project_status_idx').on(t.projectId, t.status),
    index('tickets_cycle_id_idx').on(t.cycleId),
    index('tickets_assignee_status_idx').on(t.assigneeId, t.status),
    check('tickets_type_check', oneOf(t.type, TICKET_TYPES)),
    check('tickets_status_check', oneOf(t.status, TICKET_STATUSES)),
    check('tickets_priority_check', oneOf(t.priority, TICKET_PRIORITIES)),
    check('tickets_source_check', oneOf(t.source, TICKET_SOURCES)),
  ],
);

/** People who receive status-change and comment notifications for a ticket. */
export const ticketWatchers = pgTable(
  'ticket_watchers',
  {
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.ticketId, t.userId] }),
    index('ticket_watchers_user_id_idx').on(t.userId),
  ],
);

/** Append-only history: creation, status transitions, reassignment, cycle moves, field edits. */
export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type', { enum: TICKET_EVENT_TYPES }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('ticket_events_ticket_id_idx').on(t.ticketId, t.createdAt),
    check('ticket_events_type_check', oneOf(t.type, TICKET_EVENT_TYPES)),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: id(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('comments_ticket_id_idx').on(t.ticketId, t.createdAt)],
);
