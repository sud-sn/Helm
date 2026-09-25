import { inArray, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Coverage } from './access';

/**
 * A WHERE condition limiting rows to the caller's coverage. Pass the row's columns for each
 * level of its ancestry. Returns undefined when everything is covered (no filter needed).
 */
export function coverageCondition(
  coverage: Coverage,
  columns: { clientId?: AnyPgColumn; projectId?: AnyPgColumn; cycleId?: AnyPgColumn },
): SQL | undefined {
  if (coverage.all) return undefined;
  const parts: SQL[] = [];
  if (columns.clientId && coverage.clientIds.length > 0) {
    parts.push(inArray(columns.clientId, coverage.clientIds));
  }
  if (columns.projectId && coverage.projectIds.length > 0) {
    parts.push(inArray(columns.projectId, coverage.projectIds));
  }
  if (columns.cycleId && coverage.cycleIds.length > 0) {
    parts.push(inArray(columns.cycleId, coverage.cycleIds));
  }
  return parts.length > 0 ? or(...parts) : sql`false`;
}
