import {
  Anchor,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  hasPermission,
  isOpenStatus,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
} from '@helm/shared';
import { PriorityTag, StatusTag, TypeIcon } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { TicketKey } from '@/components/TicketKey';
import { UserLabel } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { useCycles } from '@/features/cycles/api';
import {
  filtersToQuery,
  useAssignableUsers,
  useTickets,
  type TicketFilters,
} from '@/features/tickets/api';
import { ImportTicketsModal } from '@/features/tickets/components/ImportTicketsModal';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { formatDate, fromNow, isOverdue } from '@/lib/format';
import { paths } from '@/lib/paths';
import { useProjectContext } from './ProjectLayoutRoute';

/** Every ticket in the project as a filterable table, with CSV import and export. */
export function TicketsRoute() {
  const { project } = useProjectContext();
  const user = useCurrentUser();
  const cycles = useCycles(project.key);
  const assignable = useAssignableUsers(project.key, null);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search, 250);
  const [status, setStatus] = useState<TicketStatus[]>([]);
  const [type, setType] = useState<TicketType[]>([]);
  const [priority, setPriority] = useState<TicketPriority[]>([]);
  const [cycle, setCycle] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [importing, importer] = useDisclosure(false);
  const canImport = hasPermission(
    user.grants,
    { clientId: project.clientId, projectId: project.id },
    'ticket.create',
  );

  const filters: TicketFilters = {
    q: q || undefined,
    status: status.length ? status : undefined,
    type: type.length ? type : undefined,
    priority: priority.length ? priority : undefined,
    cycle: cycle ?? undefined,
    assignee: assignee ?? undefined,
  };
  const tickets = useTickets(project.key, filters);

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="wrap">
          <TextInput
            aria-label="Search"
            placeholder="Search title or key"
            leftSection={<ActionIcons.search size={16} stroke={ICON_STROKE} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={200}
          />
          <MultiSelect
            aria-label="Status"
            placeholder={status.length ? undefined : 'Status'}
            data={TICKET_STATUSES.map((value) => ({ value, label: TICKET_STATUS_LABELS[value] }))}
            value={status}
            onChange={(value) => setStatus(value as TicketStatus[])}
            clearable
            w={200}
          />
          <MultiSelect
            aria-label="Type"
            placeholder={type.length ? undefined : 'Type'}
            data={TICKET_TYPES.map((value) => ({ value, label: TICKET_TYPE_LABELS[value] }))}
            value={type}
            onChange={(value) => setType(value as TicketType[])}
            clearable
            w={180}
          />
          <MultiSelect
            aria-label="Priority"
            placeholder={priority.length ? undefined : 'Priority'}
            data={TICKET_PRIORITIES.map((value) => ({
              value,
              label: TICKET_PRIORITY_LABELS[value],
            }))}
            value={priority}
            onChange={(value) => setPriority(value as TicketPriority[])}
            clearable
            w={160}
          />
          <Select
            aria-label="Cycle"
            placeholder="Any cycle"
            data={[
              { value: 'backlog', label: 'Backlog' },
              ...(cycles.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={cycle}
            onChange={setCycle}
            clearable
            w={160}
          />
          <Select
            aria-label="Assignee"
            placeholder="Anyone"
            data={[
              { value: 'me', label: 'Me' },
              { value: 'none', label: 'Unassigned' },
              ...(assignable.data ?? [])
                .filter((p) => p.id !== user.id)
                .map((p) => ({ value: p.id, label: p.displayName })),
            ]}
            value={assignee}
            onChange={setAssignee}
            clearable
            searchable
            w={170}
          />
        </Group>
        <Group gap="xs">
          {canImport ? (
            <Button
              variant="default"
              leftSection={<ActionIcons.import size={16} stroke={ICON_STROKE} />}
              onClick={importer.open}
            >
              Import CSV
            </Button>
          ) : null}
          <Button
            component="a"
            href={`/api/projects/${project.key}/tickets/export${filtersToQuery(filters)}`}
            variant="default"
            leftSection={<ActionIcons.export size={16} stroke={ICON_STROKE} />}
          >
            Export CSV
          </Button>
        </Group>
      </Group>
      <QueryState query={tickets}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState
                icon={NavIcons.tickets}
                title="No tickets match"
                description="Try clearing some filters."
              />
            </Card>
          ) : (
            <Card p={0}>
              <Table.ScrollContainer minWidth={960}>
                <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Ticket</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Priority</Table.Th>
                      <Table.Th>Assignee</Table.Th>
                      <Table.Th>Cycle</Table.Th>
                      <Table.Th>Due</Table.Th>
                      <Table.Th>Updated</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((ticket) => {
                      const overdue = isOverdue(ticket.dueDate, isOpenStatus(ticket.status));
                      return (
                        <Table.Tr key={ticket.id}>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <TypeIcon type={ticket.type} />
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
                            <PriorityTag priority={ticket.priority} />
                          </Table.Td>
                          <Table.Td>
                            <UserLabel user={ticket.assignee} />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c={ticket.cycleName ? undefined : 'dimmed'}>
                              {ticket.cycleName ?? 'Backlog'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              c={overdue ? 'red.7' : undefined}
                              fw={overdue ? 600 : undefined}
                            >
                              {formatDate(ticket.dueDate)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {fromNow(ticket.updatedAt)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          )
        }
      </QueryState>
      <ImportTicketsModal opened={importing} onClose={importer.close} projectKey={project.key} />
    </>
  );
}
