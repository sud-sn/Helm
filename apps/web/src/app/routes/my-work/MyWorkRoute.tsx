import { Anchor, Card, Divider, Stack, Text, Title } from '@mantine/core';
import type { Ticket } from '@helm/shared';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { useMyTickets } from '@/features/tickets/api';
import { TicketRow } from '@/features/tickets/components/TicketRow';
import { NavIcons } from '@/icons';
import { paths } from '@/lib/paths';

export function MyWorkRoute() {
  const tickets = useMyTickets();
  return (
    <>
      <PageHeader title="My work" description="Open tickets assigned to you, soonest due first." />
      <QueryState query={tickets}>
        {(items) => {
          if (items.length === 0) {
            return (
              <Card>
                <EmptyState
                  icon={NavIcons.myWork}
                  title="Nothing on your plate"
                  description="When a Team Lead assigns you a ticket it appears here, and you are notified the next time you sign in."
                />
              </Card>
            );
          }
          const byProject = new Map<string, Ticket[]>();
          for (const ticket of items)
            byProject.set(ticket.projectKey, [...(byProject.get(ticket.projectKey) ?? []), ticket]);
          return (
            <Stack gap="lg">
              {[...byProject.entries()].map(([projectKey, projectTickets]) => (
                <Card key={projectKey}>
                  <Title order={3} mb="xs">
                    <Anchor component={Link} to={paths.project(projectKey)} inherit>
                      {projectKey}
                    </Anchor>{' '}
                    <Text span c="dimmed" size="sm" fw={400}>
                      {projectTickets.length} open
                    </Text>
                  </Title>
                  {projectTickets.map((ticket, index) => (
                    <div key={ticket.id}>
                      {index > 0 ? <Divider /> : null}
                      <TicketRow ticket={ticket} showProject />
                    </div>
                  ))}
                </Card>
              ))}
            </Stack>
          );
        }}
      </QueryState>
    </>
  );
}
