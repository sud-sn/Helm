import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries: the pooled database or an open transaction. */
export type Executor = Database | Transaction;

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export interface DatabaseOptions {
  max?: number;
  /**
   * Called when the server closes an idle pooled connection, for example during a database
   * restart or failover. The pool discards it and opens a new one for the next query.
   */
  onIdleError?: (error: Error) => void;
}

export function createDatabase(url: string, options: DatabaseOptions = {}): DatabaseHandle {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
  // Always listen: an 'error' event with no listener would crash the whole process.
  pool.on('error', (error) => options.onIdleError?.(error));
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
