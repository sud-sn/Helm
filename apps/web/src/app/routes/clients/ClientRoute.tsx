import { Button, Card, Group, SimpleGrid, Tabs } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { useClient, useUpdateClient } from '@/features/clients/api';
import { ClientFormModal } from '@/features/clients/components/ClientFormModal';
import { MeetingsPanel } from '@/features/meetings/components/MeetingsPanel';
import { MembersPanel } from '@/features/members/components/MembersPanel';
import { PitchesPanel } from '@/features/pitches/components/PitchesPanel';
import { useProjects } from '@/features/projects/api';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ProjectFormModal } from '@/features/projects/components/ProjectFormModal';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { paths } from '@/lib/paths';
import { useCan } from '@/lib/permissions';

export function ClientRoute() {
  const { clientId = '' } = useParams();
  const client = useClient(clientId);
  const projects = useProjects(clientId);
  const scope = { clientId };
  const canEdit = useCan('client.update', scope);
  const canArchive = useCan('client.create', {});
  const canCreateProject = useCan('project.create', scope);
  const update = useUpdateClient(clientId);
  const [editing, edit] = useDisclosure(false);
  const [creating, create] = useDisclosure(false);

  return (
    <QueryState query={client}>
      {(data) => (
        <>
          <PageHeader
            crumbs={[{ label: 'Clients', to: paths.clients }, { label: data.name }]}
            title={data.name}
            description={data.description || undefined}
            meta={data.archivedAt ? <Tag tone="neutral">Archived</Tag> : undefined}
            actions={
              <>
                {canEdit ? (
                  <Button
                    variant="default"
                    leftSection={<ActionIcons.edit size={16} stroke={ICON_STROKE} />}
                    onClick={edit.open}
                  >
                    Edit
                  </Button>
                ) : null}
                {canArchive ? (
                  <Button
                    variant="default"
                    leftSection={<ActionIcons.archive size={16} stroke={ICON_STROKE} />}
                    onClick={() => update.mutate({ archived: !data.archivedAt })}
                    loading={update.isPending}
                  >
                    {data.archivedAt ? 'Restore' : 'Archive'}
                  </Button>
                ) : null}
              </>
            }
          />
          <Tabs defaultValue="projects" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab
                value="projects"
                leftSection={<NavIcons.projects size={16} stroke={ICON_STROKE} />}
              >
                Projects
              </Tabs.Tab>
              <Tabs.Tab
                value="pitches"
                leftSection={<NavIcons.pitches size={16} stroke={ICON_STROKE} />}
              >
                Pitches
              </Tabs.Tab>
              <Tabs.Tab
                value="meetings"
                leftSection={<NavIcons.meetings size={16} stroke={ICON_STROKE} />}
              >
                Meetings
              </Tabs.Tab>
              <Tabs.Tab
                value="members"
                leftSection={<NavIcons.members size={16} stroke={ICON_STROKE} />}
              >
                Members
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="projects">
              {canCreateProject ? (
                <Group justify="flex-end" mb="md">
                  <Button
                    leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />}
                    onClick={create.open}
                  >
                    New project
                  </Button>
                </Group>
              ) : null}
              <QueryState query={projects}>
                {(items) =>
                  items.length === 0 ? (
                    <Card>
                      <EmptyState
                        icon={NavIcons.projects}
                        title="No projects for this client yet"
                      />
                    </Card>
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                      {items.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                    </SimpleGrid>
                  )
                }
              </QueryState>
            </Tabs.Panel>
            <Tabs.Panel value="pitches">
              <PitchesPanel clientId={clientId} />
            </Tabs.Panel>
            <Tabs.Panel value="meetings">
              <MeetingsPanel clientId={clientId} />
            </Tabs.Panel>
            <Tabs.Panel value="members">
              <MembersPanel scopeType="client" scopeId={clientId} scope={{ clientId }} />
            </Tabs.Panel>
          </Tabs>
          <ClientFormModal opened={editing} onClose={edit.close} client={data} />
          <ProjectFormModal opened={creating} onClose={create.close} clientId={clientId} />
        </>
      )}
    </QueryState>
  );
}
