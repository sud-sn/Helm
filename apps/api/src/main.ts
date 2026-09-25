import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
// Serve the built web app: WEB_DIST_DIR, or apps/web/dist when it has been built (npm run build).
const builtWeb = fileURLToPath(new URL('../../web/dist', import.meta.url));
const webDistDir =
  config.webDistDir ?? (existsSync(`${builtWeb}/index.html`) ? builtWeb : undefined);
const app = await buildApp({ db: database.db, config: { ...config, webDistDir } });

if (app.ai) {
  app.log.info(app.ai.description, 'AI features are on (Azure OpenAI)');
}
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
