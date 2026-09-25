import { check, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { DOC_TYPES, VISIBILITIES } from '@helm/shared';
import { createdAt, id, oneOf, updatedAt } from './_helpers';
import { aiRuns } from './ai';
import { projects } from './org';
import { tickets } from './tickets';
import { users } from './users';

/** Markdown documentation. The latest version is stored inline; every version in page_versions. */
export const pages = pgTable(
  'pages',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('internal'),
    version: integer('version').notNull().default(1),
    /** Set when the AI drafted the page as one of the fixed document types. */
    docType: text('doc_type', { enum: DOC_TYPES }),
    aiRunId: uuid('ai_run_id').references(() => aiRuns.id, { onDelete: 'set null' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedById: uuid('updated_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('pages_project_id_idx').on(t.projectId),
    index('pages_ticket_id_idx').on(t.ticketId),
    check('pages_visibility_check', oneOf(t.visibility, VISIBILITIES)),
    check('pages_doc_type_check', oneOf(t.docType, DOC_TYPES)),
  ],
);

export const pageVersions = pgTable(
  'page_versions',
  {
    id: id(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('page_versions_page_version_key').on(t.pageId, t.version)],
);
