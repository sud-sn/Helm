import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { PITCH_STATUSES, VISIBILITIES } from '@helm/shared';
import { createdAt, id, oneOf, timestamptz, updatedAt } from './_helpers';
import { meetings } from './meetings';
import { clients, projects } from './org';
import { users } from './users';

/** A proposal made by the team to the client. */
export const pitches = pgTable(
  'pitches',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    /** Optional: a pitch may propose work for an existing project or a new engagement. */
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    proposal: text('proposal').notNull().default(''),
    estimateHours: numeric('estimate_hours', { precision: 8, scale: 1, mode: 'number' }),
    status: text('status', { enum: PITCH_STATUSES }).notNull().default('draft'),
    sourceMeetingId: uuid('source_meeting_id').references((): AnyPgColumn => meetings.id, {
      onDelete: 'set null',
    }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** First time the pitch was sent; from then on the client can see it. */
    sentAt: timestamptz('sent_at'),
    sentById: uuid('sent_by_id').references(() => users.id, { onDelete: 'set null' }),
    respondedAt: timestamptz('responded_at'),
    respondedById: uuid('responded_by_id').references(() => users.id, { onDelete: 'set null' }),
    respondedOnBehalf: boolean('responded_on_behalf').notNull().default(false),
    responseNote: text('response_note').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('pitches_client_id_idx').on(t.clientId, t.status),
    index('pitches_project_id_idx').on(t.projectId),
    check('pitches_status_check', oneOf(t.status, PITCH_STATUSES)),
  ],
);

export const pitchComments = pgTable(
  'pitch_comments',
  {
    id: id(),
    pitchId: uuid('pitch_id')
      .notNull()
      .references(() => pitches.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('internal'),
    createdAt: createdAt(),
  },
  (t) => [
    index('pitch_comments_pitch_id_idx').on(t.pitchId, t.createdAt),
    check('pitch_comments_visibility_check', oneOf(t.visibility, VISIBILITIES)),
  ],
);
