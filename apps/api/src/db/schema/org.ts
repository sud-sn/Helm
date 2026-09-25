import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { CYCLE_STATUSES, PROJECT_STATUSES, ROLES, SCOPE_TYPES } from '@helm/shared';
import { createdAt, id, oneOf, timestamptz, updatedAt } from './_helpers';
import { users } from './users';

/** A client company (an "account" in the PRD). */
export const clients = pgTable(
  'clients',
  {
    id: id(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    archivedAt: timestamptz('archived_at'),
    createdById: uuid('created_by_id').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('clients_name_key').on(sql`lower(${t.name})`)],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    /** Prefix of ticket keys, e.g. ACME in ACME-104. Immutable. */
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: PROJECT_STATUSES }).notNull().default('active'),
    startDate: date('start_date', { mode: 'string' }),
    targetDate: date('target_date', { mode: 'string' }),
    /** Last ticket number handed out; incremented in the ticket-creating transaction. */
    ticketSeq: integer('ticket_seq').notNull().default(0),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('projects_key_key').on(t.key),
    index('projects_client_id_idx').on(t.clientId),
    check('projects_status_check', oneOf(t.status, PROJECT_STATUSES)),
  ],
);

/** A sprint or phase within a project. */
export const cycles = pgTable(
  'cycles',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    goal: text('goal').notNull().default(''),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    status: text('status', { enum: CYCLE_STATUSES }).notNull().default('planned'),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('cycles_project_id_idx').on(t.projectId),
    check('cycles_status_check', oneOf(t.status, CYCLE_STATUSES)),
    check(
      'cycles_dates_check',
      sql`${t.startDate} is null or ${t.endDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
  ],
);

/**
 * A role granted to a user at one scope. One nullable foreign key per scope level keeps grants
 * consistent: deleting a cycle removes its grants, and a CHECK ensures the right one is set.
 */
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ROLES }).notNull(),
    scopeType: text('scope_type', { enum: SCOPE_TYPES }).notNull(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'cascade' }),
    grantedById: uuid('granted_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('role_assignments_user_id_idx').on(t.userId),
    index('role_assignments_client_id_idx').on(t.clientId),
    index('role_assignments_project_id_idx').on(t.projectId),
    index('role_assignments_cycle_id_idx').on(t.cycleId),
    uniqueIndex('role_assignments_unique_grant').on(
      t.userId,
      t.role,
      t.scopeType,
      sql`coalesce(${t.clientId}, ${t.projectId}, ${t.cycleId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    check('role_assignments_role_check', oneOf(t.role, ROLES)),
    check(
      'role_assignments_scope_check',
      sql`(${t.scopeType} = 'workspace' and ${t.clientId} is null and ${t.projectId} is null and ${t.cycleId} is null)
        or (${t.scopeType} = 'client' and ${t.clientId} is not null and ${t.projectId} is null and ${t.cycleId} is null)
        or (${t.scopeType} = 'project' and ${t.projectId} is not null and ${t.clientId} is null and ${t.cycleId} is null)
        or (${t.scopeType} = 'cycle' and ${t.cycleId} is not null and ${t.clientId} is null and ${t.projectId} is null)`,
    ),
  ],
);
