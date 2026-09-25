import { Button, Card, Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { hasPermission } from '@helm/shared';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { useCurrentUser } from '@/features/auth/api';
import { MeetingsPanel } from '@/features/meetings/components/MeetingsPanel';
import { MembersPanel } from '@/features/members/components/MembersPanel';
import { useProjectPages } from '@/features/pages/api';
import { NewPageModal } from '@/features/pages/components/NewPageModal';
import { PageList } from '@/features/pages/components/PageList';
import { PitchesPanel } from '@/features/pitches/components/PitchesPanel';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { paths } from '@/lib/paths';
import { useProjectContext } from './ProjectLayoutRoute';

export function ProjectPagesRoute() {
  const { project } = useProjectContext();
  const user = useCurrentUser();
  const pages = useProjectPages(project.key);
  const [creating, create] = useDisclosure(false);
  const canWrite = hasPermission(
    user.grants,
    { clientId: project.clientId, projectId: project.id },
    'page.write',
  );
  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Technical and functional documentation. Pages are internal until someone shares them with
          the client.
        </Text>
        {canWrite ? (
          <Button
            leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />}
            onClick={create.open}
          >
            New page
          </Button>
        ) : null}
      </Group>
      <QueryState query={pages}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState
                icon={NavIcons.pages}
                title="No pages yet"
                description="Document pipelines, data models and runbooks here. Link a page to a ticket from the ticket itself."
              />
            </Card>
          ) : (
            <PageList pages={items} pagePath={paths.page} />
          )
        }
      </QueryState>
      <NewPageModal opened={creating} onClose={create.close} projectKey={project.key} />
    </>
  );
}

export function ProjectMeetingsRoute() {
  const { project } = useProjectContext();
  return <MeetingsPanel clientId={project.clientId} projectId={project.id} />;
}

export function ProjectPitchesRoute() {
  const { project } = useProjectContext();
  return <PitchesPanel clientId={project.clientId} projectId={project.id} />;
}

export function ProjectMembersRoute() {
  const { project } = useProjectContext();
  return (
    <MembersPanel
      scopeType="project"
      scopeId={project.id}
      scope={{ clientId: project.clientId, projectId: project.id }}
    />
  );
}
