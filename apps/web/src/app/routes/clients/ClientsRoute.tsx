import { Anchor, Button, Card, Group, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { useClients } from '@/features/clients/api';
import { ClientFormModal } from '@/features/clients/components/ClientFormModal';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { pluralize } from '@/lib/format';
import { paths } from '@/lib/paths';
import { useCan } from '@/lib/permissions';

export function ClientsRoute() {
  const [showArchived, setShowArchived] = useState(false);
  const clients = useClients(showArchived);
  const canCreate = useCan('client.create', {});
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Client accounts you work on. Access to each client is granted by its Project Manager."
        actions={
          canCreate ? (
            <Button leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />} onClick={open}>
              New client
            </Button>
          ) : null
        }
      />
      <Group mb="md">
        <Switch
          label="Show archived"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.currentTarget.checked)}
        />
      </Group>
      <QueryState query={clients}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState
                icon={NavIcons.clients}
                title="No clients yet"
                description={
                  canCreate
                    ? 'Add your first client, then create a project for it.'
                    : 'Ask a Delivery Manager or Project Manager to give you access to a client.'
                }
                action={canCreate ? <Button onClick={open}>Add a client</Button> : undefined}
              />
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {items.map((client) => (
                <Card key={client.id} padding="md">
                  <Stack gap={6}>
                    <Group justify="space-between" wrap="nowrap">
                      <Anchor
                        component={Link}
                        to={paths.client(client.id)}
                        fw={600}
                        size="lg"
                        c="var(--mantine-color-text)"
                      >
                        {client.name}
                      </Anchor>
                      {client.archivedAt ? <Tag tone="neutral">Archived</Tag> : null}
                    </Group>
                    {client.description ? (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {client.description}
                      </Text>
                    ) : null}
                    <Text size="xs" c="dimmed">
                      {pluralize(client.projectCount, 'project')}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )
        }
      </QueryState>
      <ClientFormModal opened={opened} onClose={close} />
    </>
  );
}
