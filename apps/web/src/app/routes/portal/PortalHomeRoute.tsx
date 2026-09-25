import { Anchor, Button, Card, Grid, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { PROJECT_STATUS_LABELS } from '@helm/shared';
import { PitchStatusTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { Meter } from '@/components/Meter';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { useCurrentUser } from '@/features/auth/api';
import { StatusBars } from '@/features/dashboard/components/StatusBars';
import { usePortalHome } from '@/features/portal/api';
import { NavIcons } from '@/icons';
import { formatDate, fromNow } from '@/lib/format';
import { paths } from '@/lib/paths';

/** What the client sees: progress, proposals to answer, and what the team has shared. */
export function PortalHomeRoute() {
  const user = useCurrentUser();
  const home = usePortalHome();
  return (
    <QueryState query={home}>
      {(data) => (
        <>
          <PageHeader
            title={`Welcome, ${user.displayName.split(' ')[0]}`}
            description={`Delivery updates and proposals from your team at ${data.client.name}.`}
          />
          <Stack gap="lg">
            <Card>
              <Title order={3} mb="md">
                Proposals awaiting your response
              </Title>
              {data.pitchesAwaitingResponse.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nothing to review right now. You will be notified when the team sends a proposal.
                </Text>
              ) : (
                <Stack gap="sm">
                  {data.pitchesAwaitingResponse.map((pitch) => (
                    <Group key={pitch.id} justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Anchor component={Link} to={paths.portal.pitch(pitch.id)} fw={600}>
                          {pitch.title}
                        </Anchor>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          Sent {pitch.sentAt ? fromNow(pitch.sentAt) : ''} by{' '}
                          {pitch.sentBy?.displayName ?? 'the team'}
                          {pitch.estimateHours != null
                            ? ` · ${pitch.estimateHours} hours estimated`
                            : ''}
                        </Text>
                      </div>
                      <Group gap="sm" wrap="nowrap">
                        <PitchStatusTag status={pitch.status} clientView />
                        <Button component={Link} to={paths.portal.pitch(pitch.id)} size="xs">
                          Review
                        </Button>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              )}
            </Card>

            <Title order={2}>Delivery progress</Title>
            {data.projects.length === 0 ? (
              <Card>
                <EmptyState icon={NavIcons.projects} title="No projects yet" />
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
                {data.projects.map((project) => (
                  <Card key={project.projectId}>
                    <Group justify="space-between" mb="sm" wrap="nowrap">
                      <div>
                        <Text fw={600}>{project.projectName}</Text>
                        <Text size="xs" c="dimmed">
                          {project.projectKey}
                          {project.targetDate ? ` · target ${formatDate(project.targetDate)}` : ''}
                        </Text>
                      </div>
                      <Tag
                        tone={
                          project.status === 'active'
                            ? 'brand'
                            : project.status === 'on_hold'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {PROJECT_STATUS_LABELS[project.status]}
                      </Tag>
                    </Group>
                    <Grid gap="lg">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Text size="sm" fw={600} mb="xs">
                          Work by stage
                        </Text>
                        <StatusBars counts={project.byStatus} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Text size="sm" fw={600} mb="xs">
                          Cycles
                        </Text>
                        {project.cycles.length === 0 ? (
                          <Text size="sm" c="dimmed">
                            No cycles planned yet.
                          </Text>
                        ) : (
                          <Stack gap="sm">
                            {project.cycles.map((cycle) => (
                              <Meter
                                key={cycle.id}
                                done={cycle.done}
                                total={cycle.total}
                                label={
                                  <Text size="sm" truncate>
                                    {cycle.name}
                                    <Text span size="xs" c="dimmed">
                                      {' '}
                                      · {cycle.status}
                                    </Text>
                                  </Text>
                                }
                              />
                            ))}
                          </Stack>
                        )}
                      </Grid.Col>
                    </Grid>
                  </Card>
                ))}
              </SimpleGrid>
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Card>
                <Title order={3} mb="sm">
                  Shared documents
                </Title>
                {data.recentPages.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Nothing shared yet.
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {data.recentPages.map((page) => (
                      <Group key={page.id} justify="space-between" wrap="nowrap">
                        <Anchor component={Link} to={paths.portal.page(page.id)} size="sm" truncate>
                          {page.title}
                        </Anchor>
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {fromNow(page.updatedAt)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Card>
              <Card>
                <Title order={3} mb="sm">
                  Meeting minutes
                </Title>
                {data.recentMeetings.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No minutes shared yet.
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {data.recentMeetings.map((meeting) => (
                      <Group key={meeting.id} justify="space-between" wrap="nowrap">
                        <Anchor
                          component={Link}
                          to={paths.portal.meeting(meeting.id)}
                          size="sm"
                          truncate
                        >
                          {meeting.title}
                        </Anchor>
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(meeting.meetingDate)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Card>
            </SimpleGrid>
          </Stack>
        </>
      )}
    </QueryState>
  );
}
