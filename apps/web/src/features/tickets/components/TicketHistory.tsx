import { Text, Timeline } from '@mantine/core';
import { TICKET_STATUS_LABELS, type TicketEvent, type TicketStatus } from '@helm/shared';
import { QueryState } from '@/components/QueryState';
import { ActionIcons, ICON_STROKE, StatusIcons } from '@/icons';
import { formatDateTime } from '@/lib/format';
import { useTicketEvents } from '../api';

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  type: 'type',
  priority: 'priority',
  dueDate: 'due date',
  estimateHours: 'estimate',
  labels: 'labels',
};

function describe(event: TicketEvent): string {
  const who = event.actor?.displayName ?? 'Someone';
  const d = event.data as Record<string, string | string[] | null>;
  switch (event.type) {
    case 'created':
      return d.meetingId
        ? `${who} created this from a meeting action item`
        : `${who} created this ticket`;
    case 'imported':
      return `${who} imported this ticket from a CSV file`;
    case 'status_changed':
      return `${who} moved it from ${TICKET_STATUS_LABELS[d.from as TicketStatus]} to ${TICKET_STATUS_LABELS[d.to as TicketStatus]}`;
    case 'assigned':
      return d.to ? `${who} assigned it to ${d.to}` : `${who} unassigned ${d.from ?? 'it'}`;
    case 'cycle_changed':
      return d.to ? `${who} moved it to ${d.to}` : `${who} moved it to the backlog`;
    case 'updated':
      return `${who} changed the ${((d.fields as string[]) ?? []).map((f) => FIELD_LABELS[f] ?? f).join(', ')}`;
  }
}

export function TicketHistory({ ticketKey }: { ticketKey: string }) {
  const events = useTicketEvents(ticketKey);
  return (
    <QueryState query={events}>
      {(items) => (
        <Timeline bulletSize={24} lineWidth={2} active={items.length}>
          {items.map((event) => {
            const Icon =
              event.type === 'status_changed'
                ? StatusIcons[(event.data.to as TicketStatus) ?? 'todo']
                : ActionIcons.history;
            return (
              <Timeline.Item key={event.id} bullet={<Icon size={14} stroke={ICON_STROKE} />}>
                <Text size="sm">{describe(event)}</Text>
                <Text size="xs" c="dimmed">
                  {formatDateTime(event.createdAt)}
                </Text>
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
    </QueryState>
  );
}
