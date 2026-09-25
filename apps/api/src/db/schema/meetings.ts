import { check, date, index, pgTable, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { ACTION_ITEM_STATUSES, VISIBILITIES } from '@helm/shared';
import { createdAt, id, oneOf, updatedAt } from './_helpers';
import { clients, projects } from './org';
import { pitches } from './pitches';
import { tickets } from './tickets';
import { users } from './users';

/** A discussion with the client or the team: transcript (internal) and minutes (shareable). */
export const meetings = pgTable(
  'meetings',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    meetingDate: date('meeting_date', { mode: 'string' }).notNull(),
    attendees: text('attendees').notNull().default(''),
    transcript: text('transcript').notNull().default(''),
    minutes: text('minutes').notNull().default(''),
    minutesVisibility: text('minutes_visibility', { enum: VISIBILITIES })
      .notNull()
      .default('internal'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('meetings_client_id_idx').on(t.clientId, t.meetingDate),
    index('meetings_project_id_idx').on(t.projectId),
    check('meetings_minutes_visibility_check', oneOf(t.minutesVisibility, VISIBILITIES)),
  ],
);

export const ACTION_ITEM_SOURCES = ['manual', 'ai'] as const;

/** Things agreed in a meeting; a Team Lead turns them into tickets or pitches. */
export const meetingActionItems = pgTable(
  'meeting_action_items',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    suggestedAssigneeId: uuid('suggested_assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueDate: date('due_date', { mode: 'string' }),
    status: text('status', { enum: ACTION_ITEM_STATUSES }).notNull().default('open'),
    ticketId: uuid('ticket_id').references((): AnyPgColumn => tickets.id, {
      onDelete: 'set null',
    }),
    pitchId: uuid('pitch_id').references((): AnyPgColumn => pitches.id, { onDelete: 'set null' }),
    /** 'ai' once extraction exists; the quote shows where in the transcript it came from. */
    source: text('source', { enum: ACTION_ITEM_SOURCES }).notNull().default('manual'),
    sourceQuote: text('source_quote').notNull().default(''),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('meeting_action_items_meeting_id_idx').on(t.meetingId),
    check('meeting_action_items_status_check', oneOf(t.status, ACTION_ITEM_STATUSES)),
    check('meeting_action_items_source_check', oneOf(t.source, ACTION_ITEM_SOURCES)),
  ],
);
