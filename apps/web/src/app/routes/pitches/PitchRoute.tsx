import { Alert, Anchor, Card, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useParams } from 'react-router';
import { PitchStatusTag } from '@/components/domain-tags';
import { Markdown } from '@/components/Markdown';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { UserLabel } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { usePitch } from '@/features/pitches/api';
import { PitchActions } from '@/features/pitches/components/PitchActions';
import { PitchComments } from '@/features/pitches/components/PitchComments';
import { PitchFormModal } from '@/features/pitches/components/PitchFormModal';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { formatDateTime } from '@/lib/format';
import { paths } from '@/lib/paths';
import { usePermissions } from '@/lib/permissions';

const RESPONSE_LABEL = {
  accepted: 'Accepted',
  rejected: 'Declined',
  changes_requested: 'Changes requested',
} as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <div>{children}</div>
    </Stack>
  );
}

/** One pitch, for staff (/pitches/:id) and for the client (/portal/pitches/:id). */
export function PitchRoute() {
  const { pitchId = '' } = useParams();
  const user = useCurrentUser();
  const clientView = user.userType === 'client';
  const pitch = usePitch(pitchId);
  const [editing, edit] = useDisclosure(false);
  const permissions = usePermissions(
    pitch.data ? { clientId: pitch.data.clientId, projectId: pitch.data.projectId } : null,
  );
  const canComment = permissions.has('comment.create') || permissions.has('pitch.comment');

  return (
    <QueryState query={pitch}>
      {(data) => (
        <>
          <PageHeader
            crumbs={
              clientView
                ? [{ label: 'Home', to: paths.portal.home }, { label: 'Proposal' }]
                : [
                    { label: 'Pitches', to: paths.pitches },
                    { label: data.clientName, to: paths.client(data.clientId) },
                    { label: data.title },
                  ]
            }
            title={data.title}
            meta={<PitchStatusTag status={data.status} clientView={clientView} />}
            description={`${data.clientName}${data.projectKey ? ` · ${data.projectKey}` : ' · new engagement'}`}
            actions={<PitchActions pitch={data} onEdit={edit.open} />}
          />
          {data.respondedAt && data.responseNote ? (
            <Alert
              mb="lg"
              color={
                data.status === 'accepted' ? 'green' : data.status === 'rejected' ? 'red' : 'orange'
              }
              title={`${RESPONSE_LABEL[data.status as keyof typeof RESPONSE_LABEL] ?? 'Response'} by ${data.respondedBy?.displayName ?? 'the client'}`}
              icon={<ActionIcons.info size={18} stroke={ICON_STROKE} />}
            >
              {data.responseNote}
            </Alert>
          ) : null}
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="lg">
                <Card>
                  <Title order={3} mb="xs">
                    Summary
                  </Title>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{data.summary || '—'}</Text>
                  <Title order={3} mt="lg" mb="xs">
                    Proposal
                  </Title>
                  {data.proposal.trim() ? (
                    <Markdown>{data.proposal}</Markdown>
                  ) : (
                    <Text c="dimmed">No proposal yet.</Text>
                  )}
                </Card>
                <PitchComments pitch={data} canComment={canComment} />
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card>
                <Stack gap="md">
                  <Fact label="Estimated effort">
                    <Text>
                      {data.estimateHours != null ? `${data.estimateHours} hours` : 'Not estimated'}
                    </Text>
                  </Fact>
                  <Fact label="Written by">
                    <UserLabel user={data.createdBy} />
                  </Fact>
                  {data.sentAt ? (
                    <Fact label="Sent">
                      <Text size="sm">
                        {formatDateTime(data.sentAt)}
                        {data.sentBy ? ` by ${data.sentBy.displayName}` : ''}
                      </Text>
                    </Fact>
                  ) : null}
                  {data.respondedAt ? (
                    <Fact label="Answered">
                      <Text size="sm">
                        {formatDateTime(data.respondedAt)}
                        {data.respondedBy ? ` by ${data.respondedBy.displayName}` : ''}
                        {data.respondedOnBehalf ? ' (recorded on the client’s behalf)' : ''}
                      </Text>
                    </Fact>
                  ) : null}
                  {!clientView && data.sourceMeeting ? (
                    <Fact label="From meeting">
                      <Anchor component={Link} to={paths.meeting(data.sourceMeeting.id)} size="sm">
                        {data.sourceMeeting.title}
                      </Anchor>
                    </Fact>
                  ) : null}
                  {!clientView && !data.sentAt ? (
                    <Group gap={6}>
                      <ActionIcons.lock size={14} stroke={ICON_STROKE} />
                      <Text size="xs" c="dimmed">
                        The client cannot see this pitch until a Project Manager sends it.
                      </Text>
                    </Group>
                  ) : null}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
          {!clientView ? (
            <PitchFormModal opened={editing} onClose={edit.close} pitch={data} />
          ) : null}
        </>
      )}
    </QueryState>
  );
}
