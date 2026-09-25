import { ActionIcon, Anchor, Card, Group, Menu, Stack, Text } from '@mantine/core';
import {
  BOARD_STATUSES,
  TICKET_STATUS_LABELS,
  isOpenStatus,
  type Ticket,
  type TicketStatus,
} from '@helm/shared';
import { Link } from 'react-router';
import { PriorityIcon, TypeIcon } from '@/components/domain-tags';
import { TicketKey } from '@/components/TicketKey';
import { UserAvatar } from '@/components/UserAvatar';
import { ActionIcons, ICON_STROKE, StatusIcons } from '@/icons';
import { formatDate, isOverdue } from '@/lib/format';
import { paths } from '@/lib/paths';
import classes from './TicketCard.module.css';

/**
 * A board card. The "move" menu is the keyboard-accessible alternative to dragging.
 */
export function TicketCard({
  ticket,
  canMove,
  onMove,
  dragging = false,
}: {
  ticket: Ticket;
  canMove: boolean;
  onMove?: (status: TicketStatus) => void;
  dragging?: boolean;
}) {
  const overdue = isOverdue(ticket.dueDate, isOpenStatus(ticket.status));
  return (
    <Card
      padding="sm"
      radius="md"
      className={classes.card}
      data-dragging={dragging || undefined}
      data-movable={canMove || undefined}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" gap={6}>
          <Group gap={6} wrap="nowrap">
            <TypeIcon type={ticket.type} />
            <TicketKey ticketKey={ticket.key} />
          </Group>
          <Group gap={2} wrap="nowrap">
            <PriorityIcon priority={ticket.priority} />
            {canMove && onMove ? (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    size="sm"
                    aria-label={`Move ${ticket.key}`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ActionIcons.more size={14} stroke={ICON_STROKE} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Move to</Menu.Label>
                  {BOARD_STATUSES.filter((status) => status !== ticket.status).map((status) => {
                    const Icon = StatusIcons[status];
                    return (
                      <Menu.Item
                        key={status}
                        leftSection={<Icon size={14} stroke={ICON_STROKE} />}
                        onClick={() => onMove(status)}
                      >
                        {TICKET_STATUS_LABELS[status]}
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>
            ) : null}
          </Group>
        </Group>
        <Anchor
          component={Link}
          to={paths.ticket(ticket.key)}
          size="sm"
          fw={500}
          c="var(--mantine-color-text)"
          lineClamp={3}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ticket.title}
        </Anchor>
        <Group justify="space-between" wrap="nowrap" gap={6}>
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            {ticket.dueDate ? (
              <Text size="xs" c={overdue ? 'red.7' : 'dimmed'} fw={overdue ? 600 : 400}>
                {overdue ? 'Overdue ' : 'Due '}
                {formatDate(ticket.dueDate)}
              </Text>
            ) : null}
            {ticket.labels.slice(0, 2).map((label) => (
              <Text key={label} size="xs" c="dimmed" className={classes.label} truncate>
                #{label}
              </Text>
            ))}
          </Group>
          {ticket.assignee ? <UserAvatar user={ticket.assignee} size="sm" /> : null}
        </Group>
      </Stack>
    </Card>
  );
}
