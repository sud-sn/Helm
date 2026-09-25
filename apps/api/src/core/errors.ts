/**
 * Errors thrown by services. The error handler turns them into
 * `{ error: { code, message, details? } }` with the matching HTTP status.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);

export const unauthenticated = (message = 'Please sign in to continue.') =>
  new HttpError(401, 'UNAUTHENTICATED', message);

export const forbidden = (message = 'You do not have permission to do this.') =>
  new HttpError(403, 'FORBIDDEN', message);

/** Also used for resources the caller may not read, so their existence is not revealed. */
export const notFound = (what = 'Resource') =>
  new HttpError(404, 'NOT_FOUND', `${what} not found.`);

export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);
