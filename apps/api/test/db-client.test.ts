import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../src/db/client';
import { createTestApp } from './harness';

describe('database pool', () => {
  it('survives the server closing an idle connection', async () => {
    const t = await createTestApp();
    const dropped: Error[] = [];
    const handle = createDatabase(t.config.databaseUrl, {
      max: 1,
      onIdleError: (error) => dropped.push(error),
    });
    try {
      const { rows } = await handle.pool.query<{ pid: number }>('select pg_backend_pid() as pid');
      // What a database restart or failover does to the pool's idle connection.
      await t.db.execute(sql`select pg_terminate_backend(${rows[0]!.pid})`);
      await vi.waitFor(() => expect(dropped).toHaveLength(1));

      const again = await handle.pool.query<{ ok: number }>('select 1 as ok');
      expect(again.rows[0]?.ok).toBe(1);
    } finally {
      await handle.close();
      await t.close();
    }
  });
});
