import { Anchor, Group, Text } from '@mantine/core';
import { isOpenStatus, type Ticket } from '@helm/shared';
import { Link } from 'react-router';
import { PriorityIcon, StatusTag, TypeIcon } from '@/components/domain-tags';
import { TicketKey } from '@/components/TicketKey';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { formatDate, isOverdue } from '@/lib/format';
import { paths } from '@/lib/paths';

/** A compact one-line ticket for lists of the viewer's own work (My work, the dashboard), so no assignee. */
export function TicketRow({
  ticket,
  showProject = false,
}: {
  ticket: Ticket;
  showProject?: boolean;
}) {
  const overdue = isOverdue(ticket.dueDate, isOpenStatus(ticket.status));
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" py={6}>
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        <TypeIcon type={ticket.type} />
        <PriorityIcon priority={ticket.priority} />
        <TicketKey ticketKey={ticket.key} />
        <Anchor
          component={Link}
          to={paths.ticket(ticket.key)}
          c="var(--mantine-color-text)"
          size="sm"
          truncate
        >
          {ticket.title}
        </Anchor>
        {showProject && ticket.cycleName ? (
          <Text size="xs" c="dimmed" truncate>
            {ticket.cycleName}
          </Text>
        ) : null}
      </Group>
      <Group gap="sm" wrap="nowrap">
        {ticket.dueDate ? (
          <Group gap={4} wrap="nowrap">
            <ActionIcons.due
              size={14}
              stroke={ICON_STROKE}
              color={overdue ? 'var(--mantine-color-red-7)' : undefined}
            />
            <Text size="xs" c={overdue ? 'red.7' : 'dimmed'} fw={overdue ? 600 : 400}>
              {overdue ? 'Overdue · ' : ''}
              {formatDate(ticket.dueDate)}
            </Text>
          </Group>
        ) : null}
        <StatusTag status={ticket.status} />
      </Group>
    </Group>
  );
}
