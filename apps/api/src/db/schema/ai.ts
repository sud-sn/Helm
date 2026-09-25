import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { AI_RUN_STATUSES, AI_TASKS } from '@helm/shared';
import { createdAt, id, oneOf, updatedAt } from './_helpers';
import { meetings } from './meetings';
import { users } from './users';

/**
 * Every call to a language model: who asked, for what, which model and prompt version answered,
 * and what it cost. Inputs are not copied here (the transcript stays on its meeting); the
 * validated output is kept so a suggestion can always be traced to the run that produced it.
 */
export const aiRuns = pgTable(
  'ai_runs',
  {
    id: id(),
    task: text('task', { enum: AI_TASKS }).notNull(),
    provider: text('provider').notNull(),
    /** As reported by the provider, or the deployment name when the call failed. */
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    status: text('status', { enum: AI_RUN_STATUSES }).notNull(),
    errorKind: text('error_kind'),
    requestedById: uuid('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
    meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'set null' }),
    inputChars: integer('input_chars').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    output: jsonb('output'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ai_runs_created_at_idx').on(t.createdAt),
    index('ai_runs_meeting_id_idx').on(t.meetingId),
    check('ai_runs_task_check', oneOf(t.task, AI_TASKS)),
    check('ai_runs_status_check', oneOf(t.status, AI_RUN_STATUSES)),
  ],
);

/**
 * The Azure OpenAI connection an administrator entered on the AI assistant page (one row at most).
 * The key is stored encrypted (see core/security/secrets.ts) and is never sent to a browser; only
 * its last four characters are kept readable, to recognise it.
 */
export const aiSettings = pgTable(
  'ai_settings',
  {
    id: smallint('id').primaryKey().default(1),
    endpoint: text('endpoint').notNull(),
    deployment: text('deployment').notNull(),
    apiVersion: text('api_version').notNull(),
    apiKeyEncrypted: text('api_key_encrypted').notNull(),
    apiKeyHint: text('api_key_hint').notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: updatedAt(),
  },
  (t) => [check('ai_settings_single_row', sql`${t.id} = 1`)],
);
