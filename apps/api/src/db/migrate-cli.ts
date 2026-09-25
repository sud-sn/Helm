/** `npm run db:migrate` — applies pending migrations to DATABASE_URL. */
import { loadConfig } from '../config/env';
import { createDatabase } from './client';
import { runMigrations } from './migrate';

const config = loadConfig();
const handle = createDatabase(config.databaseUrl, { max: 2 });
try {
  await runMigrations(handle);
  console.warn('Migrations applied.');
} finally {
  await handle.close();
}
