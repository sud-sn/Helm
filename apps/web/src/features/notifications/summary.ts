import type { Notification } from '@helm/shared';

/**
 * Turns unread notifications (newest first, as the API returns them) into the sign-in summary:
 * a summary rather than a log, so a ticket that moved several times shows only its latest move.
 */
export function summariseUnread(notifications: Notification[], limit = 10): Notification[] {
  const moved = new Set<string>();
  const summary: Notification[] = [];
  for (const notification of notifications) {
    const { ticketKey } = notification.data;
    if (notification.type === 'ticket_status_changed' && ticketKey) {
      if (moved.has(ticketKey)) continue;
      moved.add(ticketKey);
    }
    summary.push(notification);
    if (summary.length === limit) break;
  }
  return summary;
}
