import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config/env';
import {
  AiConnection,
  createAzureOpenAiProvider,
  type LlmProvider,
  type ProviderFactory,
} from './core/ai';
import type { Database } from './db/client';
import { registerModules } from './modules';
import { registerAuth } from './plugins/auth';
import { registerCsrfGuard } from './plugins/csrf';
import { registerErrorHandler } from './plugins/error-handler';
import { registerSpa } from './plugins/spa';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    config: Config;
    /** The AI connection: environment settings, or what an administrator saved. */
    ai: AiConnection;
  }
}

export interface AppDependencies {
  db: Database;
  config: Config;
  /**
   * A fixed provider (tests pass a fake, or null for no AI). By default: the environment
   * settings if there are any, otherwise the settings saved on the AI assistant page.
   */
  ai?: LlmProvider | null;
  /** Builds providers from saved settings; tests pass a fake. */
  createAiProvider?: ProviderFactory;
}

export async function buildApp({
  db,
  config,
  ai,
  createAiProvider = (settings) => createAzureOpenAiProvider(settings),
}: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.logLevel === 'silent'
        ? false
        : {
            level: config.logLevel,
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
            ],
          },
    trustProxy: config.trustProxy,
    bodyLimit: 5 * 1024 * 1024,
  });

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate(
    'ai',
    new AiConnection({
      db,
      fixed: ai !== undefined ? ai : config.ai ? createAiProvider(config.ai) : undefined,
      createProvider: createAiProvider,
      secretKey: config.secretKey,
      dataDir: config.dataDir,
      timeoutMs: config.aiTimeoutMs,
    }),
  );

  registerErrorHandler(app);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  await app.register(
    async (api) => {
      registerCsrfGuard(api);
      registerAuth(api);
      api.get('/health', { config: { public: true } }, async () => {
        await db.execute('select 1');
        return { status: 'ok' };
      });
      await registerModules(api);
    },
    { prefix: '/api' },
  );

  if (config.webDistDir) await registerSpa(app, config.webDistDir);

  return app;
}
