import { inArray, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Coverage } from './access';

/**
 * OR of the given conditions that fails closed: with no conditions it matches nothing.
 * (drizzle's `or()` of nothing is `undefined`, which would mean "no filter" — never what an
 * access check wants.)
 */
export function anyOf(conditions: (SQL | undefined)[]): SQL {
  const present = conditions.filter((condition): condition is SQL => condition !== undefined);
  return present.length > 0 ? (or(...present) ?? sql`false`) : sql`false`;
}

/**
 * A WHERE condition limiting rows to the caller's coverage. Pass the row's columns for each
 * level of its ancestry. Returns undefined when everything is covered (no filter needed).
 */
export function coverageCondition(
  coverage: Coverage,
  columns: { clientId?: AnyPgColumn; projectId?: AnyPgColumn; cycleId?: AnyPgColumn },
): SQL | undefined {
  if (coverage.all) return undefined;
  return anyOf([
    columns.clientId && coverage.clientIds.length > 0
      ? inArray(columns.clientId, coverage.clientIds)
      : undefined,
    columns.projectId && coverage.projectIds.length > 0
      ? inArray(columns.projectId, coverage.projectIds)
      : undefined,
    columns.cycleId && coverage.cycleIds.length > 0
      ? inArray(columns.cycleId, coverage.cycleIds)
      : undefined,
  ]);
}
