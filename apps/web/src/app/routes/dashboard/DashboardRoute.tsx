import {
  Anchor,
  Card,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Meter } from '@/components/Meter';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { StatTile } from '@/components/StatTile';
import { useCurrentUser } from '@/features/auth/api';
import { useDashboard } from '@/features/dashboard/api';
import { StatusBars } from '@/features/dashboard/components/StatusBars';
import { TicketRow } from '@/features/tickets/components/TicketRow';
import { ActionIcons, NavIcons, PitchStatusIcons, StatusIcons } from '@/icons';
import { formatDate } from '@/lib/format';
import { paths } from '@/lib/paths';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function DashboardRoute() {
  const user = useCurrentUser();
  const dashboard = useDashboard();
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.displayName.split(' ')[0]}`}
        description="Everything below is limited to the clients and projects you have access to."
      />
      <QueryState query={dashboard}>
        {(data) => (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="md">
              <StatTile
                label="Open tickets"
                value={data.totals.openTickets}
                icon={StatusIcons.in_progress}
                tone="info"
              />
              <StatTile
                label="Overdue"
                value={data.totals.overdueTickets}
                icon={ActionIcons.due}
                tone={data.totals.overdueTickets > 0 ? 'danger' : 'neutral'}
              />
              <StatTile
                label="Blocked"
                value={data.totals.blockedTickets}
                icon={StatusIcons.blocked}
                tone={data.totals.blockedTickets > 0 ? 'danger' : 'neutral'}
              />
              <StatTile
                label="Done in 7 days"
                value={data.totals.completedLast7Days}
                icon={StatusIcons.done}
                tone="success"
              />
              <StatTile
                label="Pitches with client"
                value={data.totals.pitchesAwaitingClient}
                icon={PitchStatusIcons.sent}
                tone="client"
              />
            </SimpleGrid>

            <Grid gap="lg">
              <Grid.Col span={{ base: 12, lg: 7 }}>
                <Card h="100%">
                  <Group justify="space-between" mb="xs">
                    <Title order={3}>My work</Title>
                    <Anchor component={Link} to={paths.myWork} size="sm">
                      View all
                    </Anchor>
                  </Group>
                  <Text size="sm" c="dimmed" mb="sm">
                    {data.me.openAssigned} open · {data.me.dueThisWeek} due this week ·{' '}
                    <Text
                      span
                      c={data.me.overdue ? 'red.7' : undefined}
                      fw={data.me.overdue ? 600 : undefined}
                    >
                      {data.me.overdue} overdue
                    </Text>
                  </Text>
                  {data.me.tickets.length === 0 ? (
                    <EmptyState
                      icon={NavIcons.myWork}
                      title="Nothing assigned to you"
                      description="Tickets your Team Lead assigns to you will show up here."
                    />
                  ) : (
                    <Stack gap={0}>
                      {data.me.tickets.map((ticket, index) => (
                        <div key={ticket.id}>
                          {index > 0 ? <Divider /> : null}
                          <TicketRow ticket={ticket} />
                        </div>
                      ))}
                    </Stack>
                  )}
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 5 }}>
                <Card h="100%">
                  <Title order={3} mb="md">
                    Tickets by status
                  </Title>
                  <StatusBars counts={data.byStatus} />
                </Card>
              </Grid.Col>
            </Grid>

            <Grid gap="lg">
              <Grid.Col span={{ base: 12, lg: 5 }}>
                <Card h="100%">
                  <Title order={3} mb="md">
                    Active cycles
                  </Title>
                  {data.activeCycles.length === 0 ? (
                    <EmptyState icon={NavIcons.cycles} title="No active cycles" />
                  ) : (
                    <Stack gap="md">
                      {data.activeCycles.map((cycle) => (
                        <Meter
                          key={cycle.id}
                          done={cycle.done}
                          total={cycle.total}
                          label={
                            <Group gap={6} wrap="nowrap">
                              <Anchor
                                component={Link}
                                to={paths.project(cycle.projectKey)}
                                size="sm"
                                fw={600}
                              >
                                {cycle.projectKey}
                              </Anchor>
                              <Text size="sm" truncate>
                                {cycle.name}
                              </Text>
                              {cycle.endDate ? (
                                <Text size="xs" c="dimmed">
                                  ends {formatDate(cycle.endDate)}
                                </Text>
                              ) : null}
                            </Group>
                          }
                        />
                      ))}
                    </Stack>
                  )}
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 7 }}>
                <Card h="100%">
                  <Title order={3} mb="md">
                    Projects
                  </Title>
                  {data.projects.length === 0 ? (
                    <EmptyState
                      icon={NavIcons.projects}
                      title="No projects yet"
                      description="Projects you are a member of will show up here."
                    />
                  ) : (
                    <Table.ScrollContainer minWidth={520}>
                      <Table verticalSpacing="xs" className="tabular">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Project</Table.Th>
                            <Table.Th ta="right">Open</Table.Th>
                            <Table.Th ta="right">Blocked</Table.Th>
                            <Table.Th ta="right">Overdue</Table.Th>
                            <Table.Th ta="right">Done (30 days)</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {data.projects.map((project) => (
                            <Table.Tr key={project.id}>
                              <Table.Td>
                                <Anchor
                                  component={Link}
                                  to={paths.project(project.key)}
                                  size="sm"
                                  fw={600}
                                >
                                  {project.name}
                                </Anchor>
                                <Text size="xs" c="dimmed">
                                  {project.clientName} · {project.key}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">{project.open}</Table.Td>
                              <Table.Td ta="right" c={project.blocked ? 'red.7' : undefined}>
                                {project.blocked}
                              </Table.Td>
                              <Table.Td ta="right" c={project.overdue ? 'red.7' : undefined}>
                                {project.overdue}
                              </Table.Td>
                              <Table.Td ta="right">{project.doneLast30Days}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </Card>
              </Grid.Col>
            </Grid>
          </Stack>
        )}
      </QueryState>
    </>
  );
}
