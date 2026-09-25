import { Anchor, Button, Card, Group, Select, Switch, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { TICKET_STATUS_LABELS } from '@helm/shared';
import { EmptyState } from '@/components/EmptyState';
import { Meter } from '@/components/Meter';
import { QueryState } from '@/components/QueryState';
import { useCurrentUser } from '@/features/auth/api';
import { useBoardCycle } from '@/features/cycles/board-cycle';
import { useTickets, useUpdateTicket } from '@/features/tickets/api';
import { KanbanBoard } from '@/features/tickets/components/KanbanBoard';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { formatDate } from '@/lib/format';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { canChangeStatus } from '@/lib/ticket-permissions';
import { useProjectContext } from './ProjectLayoutRoute';

export function BoardRoute() {
  const { project, openNewTicket } = useProjectContext();
  const user = useCurrentUser();
  const { cycles, openCycles, cycle, choose } = useBoardCycle(project.key);
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search, 250);
  const tickets = useTickets(project.key, {
    cycle: cycle?.id,
    assignee: mine ? 'me' : undefined,
    q: q || undefined,
    status: ['todo', 'in_progress', 'blocked', 'in_review', 'uat', 'done'],
  });
  const update = useUpdateTicket();

  if (cycles.isSuccess && !cycle) {
    return (
      <Card>
        <EmptyState
          icon={NavIcons.cycles}
          title="No active cycle"
          description="The board shows one cycle at a time. Plan a cycle and move tickets into it from the backlog."
          action={
            <Button component={Link} to={paths.project(project.key, 'cycles')} variant="light">
              Go to cycles
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="wrap">
          <Select
            aria-label="Cycle"
            w={220}
            data={openCycles.map((c) => ({
              value: c.id,
              label: `${c.name}${c.status === 'planned' ? ' (planned)' : ''}`,
            }))}
            value={cycle?.id ?? null}
            onChange={(value) => value && choose(value)}
            allowDeselect={false}
          />
          <TextInput
            aria-label="Search tickets"
            placeholder="Search"
            leftSection={<ActionIcons.search size={16} stroke={ICON_STROKE} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={220}
          />
          <Switch
            label="Only my tickets"
            checked={mine}
            onChange={(e) => setMine(e.currentTarget.checked)}
          />
        </Group>
        {cycle ? (
          <Button
            variant="light"
            leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />}
            onClick={() => openNewTicket(cycle.id)}
          >
            Add to {cycle.name}
          </Button>
        ) : null}
      </Group>
      {cycle ? (
        <Card padding="sm" mb="md">
          <Meter
            done={cycle.doneCount}
            total={cycle.ticketCount}
            label={
              <Group gap="xs" wrap="nowrap">
                <Text fw={600} size="sm">
                  {cycle.name}
                </Text>
                {cycle.startDate || cycle.endDate ? (
                  <Text size="xs" c="dimmed">
                    {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                  </Text>
                ) : null}
                {cycle.goal ? (
                  <Text size="xs" c="dimmed" truncate>
                    · {cycle.goal}
                  </Text>
                ) : null}
              </Group>
            }
          />
        </Card>
      ) : null}
      <QueryState query={tickets}>
        {(items) => (
          <KanbanBoard
            tickets={items}
            canMove={(ticket) => canChangeStatus(user, ticket)}
            onMove={(ticket, status) =>
              update.mutate(
                { key: ticket.key, status },
                {
                  onSuccess: () =>
                    showSuccess(`${ticket.key} moved to ${TICKET_STATUS_LABELS[status]}`),
                },
              )
            }
          />
        )}
      </QueryState>
      <Text size="xs" c="dimmed" mt="xs">
        Drag cards between columns, or use a card’s menu. Developers can move tickets assigned to
        them.{' '}
        <Anchor component={Link} to={paths.project(project.key, 'tickets')} size="xs">
          See every ticket
        </Anchor>
      </Text>
    </>
  );
}
