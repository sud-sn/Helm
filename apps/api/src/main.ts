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
// The server's own files (the generated secret key): HELM_DATA_DIR, or data/ in the repository.
const dataDir = config.dataDir ?? fileURLToPath(new URL('../../../data', import.meta.url));
const app = await buildApp({ db: database.db, config: { ...config, webDistDir, dataDir } });

if (config.migrateOnStart) await runMigrations(database);
const ai = await app.ai.state();
if (ai.provider) {
  app.log.info(
    { source: ai.source, ...ai.provider.description },
    'AI features are on (Azure OpenAI)',
  );
} else if (ai.problem) {
  app.log.warn(ai.problem);
}
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
