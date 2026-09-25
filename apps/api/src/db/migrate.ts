import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { DatabaseHandle } from './client';

/** Arbitrary constant so concurrent API instances apply migrations one at a time. */
const MIGRATION_LOCK_ID = 7_270_001;

/** The migrations folder, whether running from src/ (tsx) or from the dist/ bundle. */
export function defaultMigrationsFolder(): string {
  const candidates = ['../../drizzle', '../drizzle'].map((relative) =>
    fileURLToPath(new URL(relative, import.meta.url)),
  );
  const found = candidates.find((dir) => existsSync(`${dir}/meta/_journal.json`));
  if (!found) throw new Error(`No migrations found; looked in ${candidates.join(', ')}`);
  return found;
}

/**
 * Applies pending migrations while holding a PostgreSQL advisory lock. The migrations run on the
 * same connection that holds the lock, so this works even with a single-connection pool.
 */
export async function runMigrations(
  handle: DatabaseHandle,
  migrationsFolder = defaultMigrationsFolder(),
): Promise<void> {
  const connection = await handle.pool.connect();
  try {
    await connection.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await migrate(drizzle(connection), { migrationsFolder });
  } finally {
    await connection.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    connection.release();
  }
}
