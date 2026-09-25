import { Alert, Button, Group, Modal, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  type ActionItem,
  type Meeting,
  type TicketPriority,
  type TicketType,
} from '@helm/shared';
import { useAssignableUsers } from '@/features/tickets/api';
import { useTicketCreateAccess } from '@/features/tickets/create-access';
import { apiErrors } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { useConvertActionItems } from '../api';
import { useConversionTargets } from '../conversion';

interface Choice {
  type: TicketType;
  priority: TicketPriority;
  assigneeId: string | null;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  meeting: Meeting;
  items: ActionItem[];
  onDone: () => void;
}

export function ConvertActionItemsModal({ opened, onClose, ...props }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Create tickets from action items" size="xl">
      <ConvertForm onClose={onClose} {...props} />
    </Modal>
  );
}

function ConvertForm({ onClose, meeting, items, onDone }: Omit<Props, 'opened'>) {
  const { targets, isPending } = useConversionTargets(meeting);
  const [chosenProjectId, setProjectId] = useState<string | null>(null);
  // Default to the meeting's project, once the list confirms the user may create tickets there.
  const projectId = chosenProjectId ?? targets.find((p) => p.id === meeting.projectId)?.id ?? null;
  const project = targets.find((p) => p.id === projectId);
  const access = useTicketCreateAccess(project);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const assignable = useAssignableUsers(project?.key, cycleId);
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        {
          type: 'task' as TicketType,
          priority: 'medium' as TicketPriority,
          assigneeId: item.suggestedAssignee?.id ?? null,
        },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const convert = useConvertActionItems(meeting.id);

  const setChoice = (id: string, change: Partial<Choice>) =>
    setChoices((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));

  const submit = () => {
    if (!projectId) return setError('Choose the project the tickets go to.');
    if (!cycleId && !access.backlog)
      return setError('Choose a cycle: you can add tickets to your cycles only.');
    convert.mutate(
      {
        projectId,
        cycleId,
        items: items.map((item) => ({ actionItemId: item.id, ...choices[item.id]! })),
      },
      {
        onSuccess: (tickets) => {
          showSuccess(`Created ${tickets.map((t) => t.key).join(', ')}`);
          onDone();
          onClose();
        },
        onError: (err) => setError(apiErrors(err).form ?? 'Could not create the tickets.'),
      },
    );
  };

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}
      {targets.length === 0 && !isPending ? (
        <Alert color="orange">
          You can only create tickets where you are a Team Lead or above.
        </Alert>
      ) : null}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label="Project"
          data={targets.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
          value={projectId}
          onChange={(value) => {
            setProjectId(value);
            setCycleId(null);
          }}
          allowDeselect={false}
        />
        <Select
          label="Cycle"
          placeholder={access.backlog || !project ? 'Backlog' : 'Choose a cycle'}
          data={access.cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
          value={cycleId}
          onChange={setCycleId}
          clearable={access.backlog}
          disabled={!project}
        />
      </SimpleGrid>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Action item</Table.Th>
            <Table.Th w={170}>Type</Table.Th>
            <Table.Th w={130}>Priority</Table.Th>
            <Table.Th w={200}>Assignee</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Text size="sm">{item.title}</Text>
              </Table.Td>
              <Table.Td>
                <Select
                  aria-label="Type"
                  data={TICKET_TYPES.map((value) => ({ value, label: TICKET_TYPE_LABELS[value] }))}
                  value={choices[item.id]?.type ?? 'task'}
                  onChange={(value) => value && setChoice(item.id, { type: value as TicketType })}
                  allowDeselect={false}
                />
              </Table.Td>
              <Table.Td>
                <Select
                  aria-label="Priority"
                  data={TICKET_PRIORITIES.map((value) => ({
                    value,
                    label: TICKET_PRIORITY_LABELS[value],
                  }))}
                  value={choices[item.id]?.priority ?? 'medium'}
                  onChange={(value) =>
                    value && setChoice(item.id, { priority: value as TicketPriority })
                  }
                  allowDeselect={false}
                />
              </Table.Td>
              <Table.Td>
                <Select
                  aria-label="Assignee"
                  placeholder="Unassigned"
                  data={(assignable.data ?? []).map((person) => ({
                    value: person.id,
                    label: person.displayName,
                  }))}
                  value={choices[item.id]?.assigneeId ?? null}
                  onChange={(value) => setChoice(item.id, { assigneeId: value })}
                  clearable
                  searchable
                  disabled={!project}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          loading={convert.isPending}
          disabled={!projectId || items.length === 0}
        >
          Create {items.length} {items.length === 1 ? 'ticket' : 'tickets'}
        </Button>
      </Group>
    </Stack>
  );
}
