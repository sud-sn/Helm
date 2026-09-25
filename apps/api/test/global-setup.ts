import pg from 'pg';
import { createDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { MAINTENANCE_URL, TEMPLATE_DATABASE, TEST_DATABASE_URL, withDatabase } from './db-urls';

async function maintenance<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: MAINTENANCE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Builds a migrated template database once; each test file clones it (see harness.ts). */
export async function setup(): Promise<void> {
  await maintenance(async (client) => {
    await client.query(`drop database if exists "${TEMPLATE_DATABASE}" with (force)`);
    await client.query(`create database "${TEMPLATE_DATABASE}"`);
  });
  const handle = createDatabase(withDatabase(TEST_DATABASE_URL, TEMPLATE_DATABASE), { max: 1 });
  try {
    await runMigrations(handle);
  } finally {
    await handle.close();
  }
}

export async function teardown(): Promise<void> {
  await maintenance((client) =>
    client.query(`drop database if exists "${TEMPLATE_DATABASE}" with (force)`),
  );
}
