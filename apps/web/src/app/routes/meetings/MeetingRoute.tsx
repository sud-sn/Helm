import { Button, Card, Code, Group, ScrollArea, Switch, Tabs, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate, useParams } from 'react-router';
import { hasWrittenContent } from '@helm/shared';
import { ConfirmModal } from '@/components/ConfirmModal';
import { VisibilityTag } from '@/components/domain-tags';
import { Markdown } from '@/components/Markdown';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { useCurrentUser } from '@/features/auth/api';
import { useDeleteMeeting, useMeeting, useSetMinutesVisibility } from '@/features/meetings/api';
import { ActionItemsPanel } from '@/features/meetings/components/ActionItemsPanel';
import { MeetingFormModal } from '@/features/meetings/components/MeetingFormModal';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { formatDate } from '@/lib/format';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { usePermissions } from '@/lib/permissions';

/** One meeting: staff see minutes, transcript and action items; clients see shared minutes only. */
export function MeetingRoute() {
  const { meetingId = '' } = useParams();
  const user = useCurrentUser();
  const clientView = user.userType === 'client';
  const meeting = useMeeting(meetingId);
  const permissions = usePermissions(
    meeting.data ? { clientId: meeting.data.clientId, projectId: meeting.data.projectId } : null,
  );
  const share = useSetMinutesVisibility(meetingId);
  // An untouched minutes template is not worth sending to a client (the API refuses it too).
  const minutesWritten = meeting.data ? hasWrittenContent(meeting.data.minutes) : false;
  const remove = useDeleteMeeting();
  const navigate = useNavigate();
  const [editing, edit] = useDisclosure(false);
  const [deleting, del] = useDisclosure(false);

  return (
    <QueryState query={meeting}>
      {(data) => (
        <>
          <PageHeader
            crumbs={
              clientView
                ? [{ label: 'Home', to: paths.portal.home }, { label: 'Meeting minutes' }]
                : [{ label: 'Meetings', to: paths.meetings }, { label: data.title }]
            }
            title={data.title}
            meta={!clientView ? <VisibilityTag visibility={data.minutesVisibility} /> : undefined}
            description={`${formatDate(data.meetingDate)} · ${data.clientName}${data.projectKey ? ` · ${data.projectKey}` : ''}${
              data.attendees ? ` · ${data.attendees}` : ''
            }`}
            actions={
              clientView ? undefined : (
                <>
                  {permissions.has('content.share') ? (
                    <Tooltip
                      label={
                        minutesWritten || data.minutesVisibility === 'client'
                          ? 'Clients see the minutes only — never the transcript or action items'
                          : 'Write the minutes before sharing them'
                      }
                    >
                      <Switch
                        label="Share minutes with client"
                        // Show the new position while saving; it falls back if the request fails.
                        checked={
                          (share.isPending ? share.variables : data.minutesVisibility) === 'client'
                        }
                        disabled={
                          share.isPending ||
                          (!minutesWritten && data.minutesVisibility !== 'client')
                        }
                        onChange={(e) =>
                          share.mutate(e.currentTarget.checked ? 'client' : 'internal', {
                            onSuccess: (updated) =>
                              showSuccess(
                                updated.minutesVisibility === 'client'
                                  ? 'Minutes shared with the client'
                                  : 'Minutes are internal again',
                              ),
                          })
                        }
                      />
                    </Tooltip>
                  ) : null}
                  {permissions.has('meeting.write') ? (
                    <Button
                      variant="default"
                      leftSection={<ActionIcons.edit size={16} stroke={ICON_STROKE} />}
                      onClick={edit.open}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {permissions.has('meeting.delete') ? (
                    <Button variant="subtle" color="red" onClick={del.open}>
                      Delete
                    </Button>
                  ) : null}
                </>
              )
            }
          />
          {clientView ? (
            <Card>
              {data.minutes.trim() ? (
                <Markdown>{data.minutes}</Markdown>
              ) : (
                <Text c="dimmed">No minutes.</Text>
              )}
            </Card>
          ) : (
            <Tabs defaultValue="minutes" keepMounted={false}>
              <Tabs.List mb="md">
                <Tabs.Tab value="minutes">Minutes</Tabs.Tab>
                <Tabs.Tab
                  value="actions"
                  leftSection={<ActionIcons.actionItem size={16} stroke={ICON_STROKE} />}
                >
                  Action items
                </Tabs.Tab>
                <Tabs.Tab
                  value="transcript"
                  leftSection={<ActionIcons.transcript size={16} stroke={ICON_STROKE} />}
                >
                  Transcript
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="minutes">
                <Card>
                  {data.minutes.trim() ? (
                    <Markdown>{data.minutes}</Markdown>
                  ) : (
                    <Text c="dimmed">No minutes yet. Edit the meeting to write them.</Text>
                  )}
                </Card>
              </Tabs.Panel>
              <Tabs.Panel value="actions">
                <ActionItemsPanel meeting={data} />
              </Tabs.Panel>
              <Tabs.Panel value="transcript">
                <Card>
                  <Group gap={6} mb="sm">
                    <ActionIcons.lock size={14} stroke={ICON_STROKE} />
                    <Text size="xs" c="dimmed">
                      Internal. Transcripts are never shown to the client.
                    </Text>
                  </Group>
                  {data.transcript.trim() ? (
                    <ScrollArea.Autosize mah={560}>
                      <Code block style={{ whiteSpace: 'pre-wrap' }}>
                        {data.transcript}
                      </Code>
                    </ScrollArea.Autosize>
                  ) : (
                    <Text c="dimmed">No transcript.</Text>
                  )}
                </Card>
              </Tabs.Panel>
            </Tabs>
          )}
          {!clientView ? (
            <MeetingFormModal opened={editing} onClose={edit.close} meeting={data} />
          ) : null}
          <ConfirmModal
            opened={deleting}
            onClose={del.close}
            title="Delete this meeting?"
            confirmLabel="Delete"
            danger
            loading={remove.isPending}
            onConfirm={() =>
              remove.mutate(data.id, {
                onSuccess: () => {
                  showSuccess('Meeting deleted');
                  void navigate(paths.meetings);
                },
              })
            }
          >
            The transcript, minutes and action items are removed. Tickets already created from it
            stay.
          </ConfirmModal>
        </>
      )}
    </QueryState>
  );
}
