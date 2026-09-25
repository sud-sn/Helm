import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/**
 * Serves the built web app and falls back to index.html for client-side routes. API paths that
 * match nothing still get a JSON 404.
 */
export async function registerSpa(app: FastifyInstance, distDir: string): Promise<void> {
  const root = resolve(distDir);
  if (!existsSync(resolve(root, 'index.html'))) {
    app.log.warn({ root }, 'WEB_DIST_DIR has no index.html; the web app will not be served');
    return;
  }
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    index: ['index.html'],
    // Vite fingerprints everything in assets/, so those files never change and can be cached
    // for a year. Everything else, index.html above all, is revalidated so a release shows at once.
    cacheControl: false,
    setHeaders: (reply, filePath) => {
      reply.header(
        'Cache-Control',
        filePath.includes(`${sep}assets${sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.method !== 'GET') {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found.`,
        },
      });
    }
    return reply.type('text/html').sendFile('index.html');
  });
}
