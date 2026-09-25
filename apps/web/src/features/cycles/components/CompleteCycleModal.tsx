import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { Cycle } from '@helm/shared';
import { showSuccess } from '@/lib/notify';
import { useCompleteCycle } from '../api';

export function CompleteCycleModal({
  opened,
  onClose,
  cycle,
  otherCycles,
}: {
  opened: boolean;
  onClose: () => void;
  cycle: Cycle | null;
  otherCycles: Cycle[];
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={cycle ? `Complete ${cycle.name}` : 'Complete cycle'}
    >
      {cycle ? (
        <CompleteCycleForm cycle={cycle} otherCycles={otherCycles} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function CompleteCycleForm({
  cycle,
  otherCycles,
  onClose,
}: {
  cycle: Cycle;
  otherCycles: Cycle[];
  onClose: () => void;
}) {
  const complete = useCompleteCycle();
  const [target, setTarget] = useState('backlog');
  const open = cycle.ticketCount - cycle.doneCount;

  return (
    <Stack>
      <Text size="sm">
        {open > 0
          ? `${open} ticket${open === 1 ? ' is' : 's are'} not done yet. Where should they go?`
          : 'Every ticket in this cycle is done.'}
      </Text>
      {open > 0 ? (
        <Select
          label="Move unfinished tickets to"
          data={[
            { value: 'backlog', label: 'The project backlog' },
            ...otherCycles.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={target}
          onChange={(value) => setTarget(value ?? 'backlog')}
          allowDeselect={false}
        />
      ) : null}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={complete.isPending}
          onClick={() =>
            complete.mutate(
              { id: cycle.id, moveOpenTicketsTo: target },
              {
                onSuccess: ({ movedTickets }) => {
                  showSuccess(
                    movedTickets > 0
                      ? `${cycle.name} completed; ${movedTickets} tickets moved`
                      : `${cycle.name} completed`,
                  );
                  onClose();
                },
              },
            )
          }
        >
          Complete cycle
        </Button>
      </Group>
    </Stack>
  );
}
