import { Anchor, Badge, Button, Card, Group, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link } from 'react-router';
import { VisibilityTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { formatDate } from '@/lib/format';
import { paths } from '@/lib/paths';
import { useCan, useCanAnywhere } from '@/lib/permissions';
import { useMeetings } from '../api';
import { MeetingFormModal } from './MeetingFormModal';

export function MeetingsPanel({ clientId, projectId }: { clientId?: string; projectId?: string }) {
  const meetings = useMeetings({ clientId, projectId });
  const [opened, { open, close }] = useDisclosure(false);
  const canWriteHere = useCan('meeting.write', clientId ? { clientId, projectId } : null);
  const canWriteSomewhere = useCanAnywhere('meeting.write');
  const canWrite = clientId ? canWriteHere : canWriteSomewhere;

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Developers and analysts who attend a discussion record it here; Team Leads turn its action
          items into tickets.
        </Text>
        {canWrite ? (
          <Button leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />} onClick={open}>
            Record meeting
          </Button>
        ) : null}
      </Group>
      <QueryState query={meetings}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState
                icon={NavIcons.meetings}
                title="No meetings recorded yet"
                description="Paste or upload a transcript, write the minutes, and list the action items."
              />
            </Card>
          ) : (
            <Card p={0}>
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Meeting</Table.Th>
                      <Table.Th>Minutes</Table.Th>
                      <Table.Th ta="right">Open actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((meeting) => (
                      <Table.Tr key={meeting.id}>
                        <Table.Td w={120}>
                          <Text size="sm">{formatDate(meeting.meetingDate)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Anchor
                            component={Link}
                            to={paths.meeting(meeting.id)}
                            fw={600}
                            size="sm"
                          >
                            {meeting.title}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {meeting.clientName}
                            {meeting.projectKey ? ` · ${meeting.projectKey}` : ''} · recorded by{' '}
                            {meeting.createdBy.displayName}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <VisibilityTag visibility={meeting.minutesVisibility} />
                        </Table.Td>
                        <Table.Td ta="right">
                          {meeting.openActionItems > 0 ? (
                            <Badge variant="light" color="helm">
                              {meeting.openActionItems}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          )
        }
      </QueryState>
      <MeetingFormModal opened={opened} onClose={close} clientId={clientId} projectId={projectId} />
    </>
  );
}
