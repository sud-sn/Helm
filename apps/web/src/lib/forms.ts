import { ApiError } from './api-client';
import type { z } from 'zod';

/** Validates with a shared zod schema; returns field errors keyed by the first path segment. */
export function validate<T extends z.ZodType>(
  schema: T,
  values: unknown,
): { data: z.output<T>; errors: null } | { data: null; errors: Record<string, string> } {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { data: parsed.data, errors: null };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

/** Field errors from a failed API call, plus a general message for everything else. */
export function apiErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError) {
    const fields = error.fieldErrors;
    return Object.keys(fields).length > 0 ? fields : { form: error.message };
  }
  return { form: 'Something went wrong. Please try again.' };
}

/** '' → null for optional text fields sent to the API. */
export const emptyToNull = (value: string) => (value.trim() === '' ? null : value.trim());
