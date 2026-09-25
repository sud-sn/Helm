import { HttpError } from '../errors';
import type { AiProviderError } from './provider';

export function aiNotConfigured(): HttpError {
  return new HttpError(
    503,
    'AI_NOT_CONFIGURED',
    'AI features are not set up. An administrator can connect Azure OpenAI.',
  );
}

/**
 * What the person who asked sees when the provider fails. Administrators get the detailed
 * message (wrong key, missing deployment…) from the connection test on the AI assistant page.
 */
export function aiHttpError(error: AiProviderError): HttpError {
  switch (error.kind) {
    case 'rate_limited':
      return new HttpError(503, 'AI_BUSY', 'The AI service is busy. Try again in a minute.');
    case 'timeout':
      return new HttpError(504, 'AI_TIMEOUT', 'The AI service took too long to answer. Try again.');
    case 'auth':
    case 'not_found':
      return new HttpError(
        502,
        'AI_MISCONFIGURED',
        'The AI service is not set up correctly. Ask an administrator to check the AI assistant page.',
      );
    case 'rejected':
      return new HttpError(
        422,
        'AI_REJECTED',
        'Azure OpenAI declined this request (content filter or usage policy).',
      );
    case 'invalid_output':
      return new HttpError(502, 'AI_BAD_OUTPUT', 'The AI answer could not be used. Try again.');
    case 'unavailable':
      return new HttpError(
        502,
        'AI_UNAVAILABLE',
        'The AI service is unavailable right now. Try again shortly.',
      );
  }
}
