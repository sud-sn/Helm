/** Small mappers shared by modules when turning rows into API shapes. */
import type { UserSummary } from '@helm/shared';

export function userSummary(
  row:
    { id: string | null; username: string | null; displayName: string | null } | null | undefined,
): UserSummary | null {
  if (!row?.id || !row.username || !row.displayName) return null;
  return { id: row.id, username: row.username, displayName: row.displayName };
}

/** For columns that are NOT NULL, where a missing user means a bug. */
export function requiredUserSummary(row: {
  id: string | null;
  username: string | null;
  displayName: string | null;
}): UserSummary {
  const summary = userSummary(row);
  if (!summary) throw new Error('Expected a user');
  return summary;
}

export const iso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;
