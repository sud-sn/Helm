import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** "3 hours ago" */
export const fromNow = (iso: string) => dayjs(iso).fromNow();

/** "25 Sep 2026" — day-first, unambiguous. */
export const formatDate = (value: string | null | undefined) =>
  value ? dayjs(value).format('D MMM YYYY') : '—';

/** "25 Sep 2026, 14:05" */
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dayjs(iso).format('D MMM YYYY, HH:mm') : '—';

export const todayIso = () => dayjs().format('YYYY-MM-DD');

export function isOverdue(dueDate: string | null, open: boolean): boolean {
  return Boolean(dueDate && open && dayjs(dueDate).isBefore(dayjs(), 'day'));
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
