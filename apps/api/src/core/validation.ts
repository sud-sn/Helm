import type { z } from 'zod';

/**
 * Parses untrusted input with a schema from @helm/shared. A ZodError propagates to the error
 * handler, which answers 400 with the list of problems.
 */
export function parse<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return schema.parse(input);
}
