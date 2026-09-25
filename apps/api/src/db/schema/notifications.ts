import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { NOTIFICATION_TYPES, type NotificationData } from '@helm/shared';
import { createdAt, id, oneOf, timestamptz } from './_helpers';
import { users } from './users';

/**
 * Stored notifications, shown when the recipient next logs in. `data` holds a snapshot
 * (ticket key and title, etc.) so the text stays meaningful after the source changes.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    data: jsonb('data').$type<NotificationData>().notNull().default({}),
    readAt: timestamptz('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`${t.readAt} is null`),
    check('notifications_type_check', oneOf(t.type, NOTIFICATION_TYPES)),
  ],
);
