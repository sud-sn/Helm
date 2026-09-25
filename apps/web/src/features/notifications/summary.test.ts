import { describe, expect, it } from 'vitest';
import type { Notification, NotificationData, NotificationType } from '@helm/shared';
import { summariseUnread } from './summary';

let sequence = 0;
function notification(type: NotificationType, data: NotificationData): Notification {
  sequence += 1;
  return {
    id: `n${sequence}`,
    type,
    actor: null,
    data,
    readAt: null,
    createdAt: new Date(2026, 8, 25, 12, 60 - sequence).toISOString(),
  };
}

describe('summariseUnread', () => {
  it('keeps only the newest status change per ticket', () => {
    const newest = notification('ticket_status_changed', {
      ticketKey: 'ACME-1',
      from: 'todo',
      to: 'in_progress',
    });
    const older = notification('ticket_status_changed', {
      ticketKey: 'ACME-1',
      from: 'in_progress',
      to: 'todo',
    });
    const other = notification('ticket_status_changed', {
      ticketKey: 'ACME-2',
      from: 'todo',
      to: 'done',
    });

    expect(summariseUnread([newest, older, other]).map((n) => n.id)).toEqual([newest.id, other.id]);
  });

  it('never collapses assignments, mentions or comments', () => {
    const items = [
      notification('mentioned', { ticketKey: 'ACME-1' }),
      notification('comment_added', { ticketKey: 'ACME-1' }),
      notification('comment_added', { ticketKey: 'ACME-1' }),
      notification('ticket_assigned', { ticketKey: 'ACME-1' }),
    ];
    expect(summariseUnread(items)).toHaveLength(4);
  });

  it('stops at the limit after collapsing', () => {
    const items = [
      notification('ticket_status_changed', { ticketKey: 'ACME-1' }),
      notification('ticket_status_changed', { ticketKey: 'ACME-1' }),
      notification('mentioned', { ticketKey: 'ACME-2' }),
      notification('role_granted', {}),
    ];
    expect(summariseUnread(items, 2).map((n) => n.type)).toEqual([
      'ticket_status_changed',
      'mentioned',
    ]);
  });
});
