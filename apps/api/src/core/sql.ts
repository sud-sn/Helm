import { getTableName, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * A column reference that always carries its table name ("cycles"."id").
 *
 * Drizzle leaves single-table queries unqualified, so inside a correlated subquery an outer
 * `${cycles.id}` would render as "id" and silently bind to the subquery's own table. Use this
 * for every outer reference in a correlated subquery.
 */
export function qualified(column: AnyPgColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
