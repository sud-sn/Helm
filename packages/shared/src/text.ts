/**
 * Small text helpers shared by the API and the web app.
 */
import { PROJECT_KEY_PATTERN } from './schemas';

/**
 * Matches @username where the @ is not part of an email address or another word.
 * Group 2 is the raw handle; trailing dots, dashes and underscores are trimmed by extractMentions
 * so "@priya." at the end of a sentence resolves to "priya".
 */
const MENTION_PATTERN = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9][A-Za-z0-9._-]{0,40})/g;

/** Lowercased, de-duplicated usernames mentioned in a comment body. */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const handle = (match[2] ?? '').replace(/[._-]+$/, '').toLowerCase();
    if (handle.length >= 3) found.add(handle);
  }
  return [...found];
}

export function formatTicketKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

export function parseTicketKey(key: string): { projectKey: string; number: number } | null {
  const match = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})$/.exec(key.trim());
  if (!match) return null;
  const projectKey = (match[1] ?? '').toUpperCase();
  if (!PROJECT_KEY_PATTERN.test(projectKey)) return null;
  return { projectKey, number: Number(match[2]) };
}

/** Collapses whitespace and truncates for notification previews. */
export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
