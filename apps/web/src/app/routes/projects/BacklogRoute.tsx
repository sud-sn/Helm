import { Anchor, Button, Card, Group, Select, Table, Text } from '@mantine/core';
import { Link } from 'react-router';
import { hasPermission } from '@helm/shared';
import { PriorityIcon, StatusTag, TypeIcon } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { TicketKey } from '@/components/TicketKey';
import { UserLabel } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { useCycles } from '@/features/cycles/api';
import { useTickets, useUpdateTicket } from '@/features/tickets/api';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { formatDate } from '@/lib/format';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { useProjectContext } from './ProjectLayoutRoute';

/** Tickets not yet planned into a cycle. Team Leads move them into a cycle from here. */
export function BacklogRoute() {
  const { project, openNewTicket } = useProjectContext();
  const user = useCurrentUser();
  const tickets = useTickets(project.key, {
    cycle: 'backlog',
    status: ['todo', 'in_progress', 'blocked', 'in_review', 'uat'],
  });
  const cycles = useCycles(project.key);
  const update = useUpdateTicket();
  const scope = { clientId: project.clientId, projectId: project.id, cycleId: null };
  const canPlan = hasPermission(user.grants, scope, 'ticket.update');
  const canCreate = hasPermission(user.grants, scope, 'ticket.create');
  const cycleOptions = (cycles.data ?? [])
    .filter((cycle) => cycle.status !== 'completed')
    .map((cycle) => ({ value: cycle.id, label: cycle.name }));

  return (
    <QueryState query={tickets}>
      {(items) =>
        items.length === 0 ? (
          <Card>
            <EmptyState
              icon={NavIcons.backlog}
              title="The backlog is empty"
              description="New tickets without a cycle land here, ready to be planned."
              action={
                canCreate ? (
                  <Button onClick={() => openNewTicket(null)}>New ticket</Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card p={0}>
            <Group justify="space-between" px="md" py="sm">
              <Text size="sm" c="dimmed">
                {items.length} open {items.length === 1 ? 'ticket' : 'tickets'} waiting to be
                planned
              </Text>
              {canCreate ? (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<ActionIcons.add size={14} stroke={ICON_STROKE} />}
                  onClick={() => openNewTicket(null)}
                >
                  New ticket
                </Button>
              ) : null}
            </Group>
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ticket</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Assignee</Table.Th>
                    <Table.Th>Due</Table.Th>
                    {canPlan ? <Table.Th w={220}>Plan into</Table.Th> : null}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((ticket) => (
                    <Table.Tr key={ticket.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <TypeIcon type={ticket.type} />
                          <PriorityIcon priority={ticket.priority} />
                          <TicketKey ticketKey={ticket.key} />
                          <Anchor
                            component={Link}
                            to={paths.ticket(ticket.key)}
                            size="sm"
                            c="var(--mantine-color-text)"
                            lineClamp={1}
                          >
                            {ticket.title}
                          </Anchor>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <StatusTag status={ticket.status} />
                      </Table.Td>
                      <Table.Td>
                        <UserLabel user={ticket.assignee} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(ticket.dueDate)}</Text>
                      </Table.Td>
                      {canPlan ? (
                        <Table.Td>
                          <Select
                            aria-label={`Move ${ticket.key} to a cycle`}
                            placeholder="Choose a cycle"
                            size="xs"
                            data={cycleOptions}
                            value={null}
                            onChange={(cycleId) =>
                              cycleId &&
                              update.mutate(
                                { key: ticket.key, cycleId },
                                {
                                  onSuccess: (moved) =>
                                    showSuccess(`${moved.key} planned into ${moved.cycleName}`),
                                },
                              )
                            }
                          />
                        </Table.Td>
                      ) : null}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )
      }
    </QueryState>
  );
}
