/** Where integration tests create their throwaway databases. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://helm:helm@localhost:5432/helm_test';

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

const baseName = new URL(TEST_DATABASE_URL).pathname.slice(1) || 'helm_test';

/** Migrated once per run by global-setup.ts; each test file clones it. */
export const TEMPLATE_DATABASE = `${baseName}_template`;
export const TEST_DATABASE_PREFIX = `${baseName}_`;

/** Connection to the server's maintenance database, for CREATE/DROP DATABASE. */
export const MAINTENANCE_URL = withDatabase(TEST_DATABASE_URL, 'postgres');
