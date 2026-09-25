import { sql, type SQL } from 'drizzle-orm';
import { timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const id = () => uuid('id').primaryKey().defaultRandom();

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const createdAt = () => timestamptz('created_at').notNull().defaultNow();

export const updatedAt = () =>
  timestamptz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** `column IN ('a', 'b')` with literal values, for CHECK constraints. Values come from code, never input. */
export function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  const literals = values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
  return sql`${column} in (${sql.raw(literals)})`;
}
