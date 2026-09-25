import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { HttpError } from '../core/errors';

interface PgError {
  code?: string;
  constraint?: string;
}

function isPgError(error: unknown): error is PgError {
  return typeof error === 'object' && error !== null && 'code' in error && 'severity' in error;
}

/** Maps every thrown error to `{ error: { code, message, details? } }`. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    const cause = (error as { cause?: unknown }).cause;
    const pg = isPgError(error) ? error : isPgError(cause) ? cause : null;
    if (pg) {
      if (pg.code === '23505') {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'This already exists.',
            details: { constraint: pg.constraint },
          },
        });
      }
      if (pg.code === '23503') {
        return reply.status(409).send({
          error: {
            code: 'REFERENCE_CONFLICT',
            message: 'This is still referenced by other records.',
          },
        });
      }
      if (pg.code === '22P02') {
        return reply
          .status(400)
          .send({ error: { code: 'BAD_REQUEST', message: 'Malformed identifier.' } });
      }
    }

    const statusCode = (error as FastifyError).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: (error as FastifyError).code ?? 'BAD_REQUEST', message: error.message },
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  });
}
