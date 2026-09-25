import { existsSync } from 'node:fs';
import { buildApp } from './app';
import { loadConfig } from './config/env';
import { ensureFirstAdmin } from './db/bootstrap';
import { createDatabase } from './db/client';
import { runMigrations } from './db/migrate';

// In development, read the repository's .env file if there is one.
for (const candidate of ['.env', '../../.env']) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const config = loadConfig();
const database = createDatabase(config.databaseUrl, {
  max: config.databasePoolMax,
  onIdleError: (err) =>
    app.log.warn({ err }, 'The database closed an idle connection; it will be replaced'),
});
const app = await buildApp({ db: database.db, config });

if (config.migrateOnStart) await runMigrations(database);
await ensureFirstAdmin(database.db, config, app.log);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await database.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.host, port: config.port });
