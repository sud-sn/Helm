import { describe, expect, it } from 'vitest';
import {
  excerpt,
  extractMentions,
  formatTicketKey,
  hasWrittenContent,
  parseTicketKey,
} from './text';

describe('extractMentions', () => {
  it('finds handles and trims trailing punctuation', () => {
    expect(extractMentions('@priya.s please check with @Ravi. Thanks @priya.s!')).toEqual([
      'priya.s',
      'ravi',
    ]);
  });

  it('ignores email addresses and short handles', () => {
    expect(extractMentions('mail ops@acme.com or ping @ab')).toEqual([]);
  });

  it('finds a mention at the start of a line', () => {
    expect(extractMentions('line one\n@dev_1 look')).toEqual(['dev_1']);
  });
});

describe('ticket keys', () => {
  it('round-trips', () => {
    expect(parseTicketKey(formatTicketKey('ACME', 104))).toEqual({
      projectKey: 'ACME',
      number: 104,
    });
  });

  it('normalises case and rejects malformed keys', () => {
    expect(parseTicketKey('acme-7')).toEqual({ projectKey: 'ACME', number: 7 });
    expect(parseTicketKey('ACME104')).toBeNull();
    expect(parseTicketKey('1ACME-2')).toBeNull();
  });
});

describe('excerpt', () => {
  it('collapses whitespace and truncates', () => {
    expect(excerpt('a  b\n\nc')).toBe('a b c');
    expect(excerpt('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('hasWrittenContent', () => {
  it('treats headings and empty bullets as nothing written', () => {
    expect(hasWrittenContent('## Summary\n\n## Decisions\n- \n\n## Next steps\n- ')).toBe(false);
    expect(hasWrittenContent('   \n\n')).toBe(false);
    expect(hasWrittenContent('1. \n- [ ] \n*')).toBe(false);
  });

  it('finds real content under the headings', () => {
    expect(hasWrittenContent('## Decisions\n- Cut-off moves to 02:00 UTC')).toBe(true);
    expect(hasWrittenContent('Agreed the scope.')).toBe(true);
    expect(hasWrittenContent('- [x] Share the spec')).toBe(true);
  });
});
