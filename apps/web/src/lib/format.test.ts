import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { formatDate, isOverdue, percent, pluralize } from './format';

describe('format helpers', () => {
  it('formats dates day-first and shows a dash for none', () => {
    expect(formatDate('2026-09-05')).toBe('5 Sep 2026');
    expect(formatDate(null)).toBe('—');
  });

  it('flags open tickets due before today as overdue', () => {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');
    expect(isOverdue(yesterday, true)).toBe(true);
    expect(isOverdue(today, true)).toBe(false);
    expect(isOverdue(yesterday, false)).toBe(false);
    expect(isOverdue(null, true)).toBe(false);
  });

  it('rounds percentages and handles an empty total', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });

  it('pluralises', () => {
    expect(pluralize(1, 'ticket')).toBe('1 ticket');
    expect(pluralize(2, 'ticket')).toBe('2 tickets');
    expect(pluralize(3, 'person', 'people')).toBe('3 people');
  });
});
