import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { USER_TYPES } from '@helm/shared';
import { createdAt, id, oneOf, timestamptz, updatedAt } from './_helpers';
import { clients } from './org';

export const users = pgTable(
  'users',
  {
    id: id(),
    /** Lowercase login name, also used for @mentions. */
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    /** Lowercase; optional, unique when present. */
    email: text('email'),
    userType: text('user_type', { enum: USER_TYPES }).notNull().default('staff'),
    /** The client company a client user belongs to; null for staff. */
    clientId: uuid('client_id').references((): AnyPgColumn => clients.id, {
      onDelete: 'restrict',
    }),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    isAdmin: boolean('is_admin').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamptz('locked_until'),
    lastLoginAt: timestamptz('last_login_at'),
    passwordChangedAt: timestamptz('password_changed_at'),
    createdById: uuid('created_by_id').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_username_key').on(t.username),
    uniqueIndex('users_email_key').on(t.email),
    index('users_client_id_idx').on(t.clientId),
    check('users_user_type_check', oneOf(t.userType, USER_TYPES)),
    check(
      'users_client_company_check',
      sql`(${t.userType} = 'client') = (${t.clientId} is not null)`,
    ),
    check('users_client_not_admin_check', sql`not (${t.userType} = 'client' and ${t.isAdmin})`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the cookie token; the token itself is never stored. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_user_id_idx').on(t.userId),
  ],
);
