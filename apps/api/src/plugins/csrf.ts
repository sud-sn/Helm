import type { FastifyInstance } from 'fastify';
import { HttpError } from '../core/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'helm';

/**
 * State-changing API requests must carry `X-Requested-With: helm`. Browsers do not let other
 * sites add custom headers without a CORS preflight, which this API never grants, so a forged
 * cross-site form or request cannot pass. Works together with SameSite=Lax session cookies.
 */
export function registerCsrfGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    const header = request.headers[CSRF_HEADER];
    if (typeof header !== 'string' || header.toLowerCase() !== CSRF_HEADER_VALUE) {
      throw new HttpError(
        403,
        'CSRF_CHECK_FAILED',
        'Request rejected: missing X-Requested-With header.',
      );
    }
  });
}
