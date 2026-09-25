import { Anchor, Card, Group, Stack, Text } from '@mantine/core';
import { PROJECT_STATUS_LABELS, type Project } from '@helm/shared';
import { Link } from 'react-router';
import { Tag } from '@/components/Tag';
import { formatDate, pluralize } from '@/lib/format';
import { paths } from '@/lib/paths';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Card padding="md">
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text ff="monospace" size="xs" fw={600} c="dimmed">
            {project.key}
          </Text>
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
        <Anchor
          component={Link}
          to={paths.project(project.key)}
          fw={600}
          size="md"
          c="var(--mantine-color-text)"
        >
          {project.name}
        </Anchor>
        {project.description ? (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {project.description}
          </Text>
        ) : null}
        <Group gap="md" mt={4}>
          <Text size="xs" c="dimmed">
            {pluralize(project.openTicketCount, 'open ticket')}
          </Text>
          {project.targetDate ? (
            <Text size="xs" c="dimmed">
              Target {formatDate(project.targetDate)}
            </Text>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}
