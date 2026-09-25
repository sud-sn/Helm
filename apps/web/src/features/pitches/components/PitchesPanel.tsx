import { Anchor, Button, Card, Group, SegmentedControl, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { PITCH_FINAL_STATUSES, type Pitch } from '@helm/shared';
import { PitchStatusTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { UserLabel } from '@/components/UserAvatar';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { fromNow } from '@/lib/format';
import { paths } from '@/lib/paths';
import { useCan, useCanAnywhere } from '@/lib/permissions';
import { usePitches } from '../api';
import { PitchFormModal } from './PitchFormModal';

type Filter = 'open' | 'decided' | 'all';

const matches = (pitch: Pitch, filter: Filter) =>
  filter === 'all' || (filter === 'decided') === PITCH_FINAL_STATUSES.includes(pitch.status);

export function PitchesPanel({ clientId, projectId }: { clientId?: string; projectId?: string }) {
  const pitches = usePitches({ clientId, projectId });
  const [filter, setFilter] = useState<Filter>('open');
  const [opened, { open, close }] = useDisclosure(false);
  const canWriteHere = useCan('pitch.write', clientId ? { clientId, projectId } : null);
  const canWriteSomewhere = useCanAnywhere('pitch.write');
  const canWrite = clientId ? canWriteHere : canWriteSomewhere;

  return (
    <>
      <Group justify="space-between" mb="md">
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          data={[
            { value: 'open', label: 'In progress' },
            { value: 'decided', label: 'Decided' },
            { value: 'all', label: 'All' },
          ]}
        />
        {canWrite ? (
          <Button leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />} onClick={open}>
            New pitch
          </Button>
        ) : null}
      </Group>
      <QueryState query={pitches}>
        {(items) => {
          const visible = items.filter((pitch) => matches(pitch, filter));
          if (visible.length === 0) {
            return (
              <Card>
                <EmptyState
                  icon={NavIcons.pitches}
                  title={filter === 'decided' ? 'No decided pitches yet' : 'No pitches in progress'}
                  description="Pitches are proposals the team sends to the client. A Project Manager reviews each one before it goes out."
                />
              </Card>
            );
          }
          return (
            <Card p={0}>
              <Table.ScrollContainer minWidth={720}>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Pitch</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Author</Table.Th>
                      <Table.Th ta="right">Effort</Table.Th>
                      <Table.Th>Updated</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visible.map((pitch) => (
                      <Table.Tr key={pitch.id}>
                        <Table.Td>
                          <Anchor component={Link} to={paths.pitch(pitch.id)} fw={600} size="sm">
                            {pitch.title}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {pitch.clientName}
                            {pitch.projectKey ? ` · ${pitch.projectKey}` : ' · new engagement'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <PitchStatusTag status={pitch.status} />
                        </Table.Td>
                        <Table.Td>
                          <UserLabel user={pitch.createdBy} />
                        </Table.Td>
                        <Table.Td ta="right" className="tabular">
                          {pitch.estimateHours != null ? `${pitch.estimateHours} h` : '—'}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {fromNow(pitch.updatedAt)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          );
        }}
      </QueryState>
      <PitchFormModal opened={opened} onClose={close} clientId={clientId} projectId={projectId} />
    </>
  );
}
