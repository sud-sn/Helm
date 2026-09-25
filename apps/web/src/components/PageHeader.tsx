import { Anchor, Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface Crumb {
  label: string;
  to?: string;
}

/** Title, optional breadcrumbs and description on the left; actions on the right. */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Stack gap={6} mb="lg">
      {crumbs && crumbs.length > 0 ? (
        <Breadcrumbs separatorMargin={6}>
          {crumbs.map((crumb) =>
            crumb.to ? (
              <Anchor key={crumb.label} component={Link} to={crumb.to} size="sm" c="dimmed">
                {crumb.label}
              </Anchor>
            ) : (
              <Text key={crumb.label} size="sm" c="dimmed">
                {crumb.label}
              </Text>
            ),
          )}
        </Breadcrumbs>
      ) : null}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Group gap="sm" wrap="wrap">
            <Title order={1}>{title}</Title>
            {meta}
          </Group>
          {description ? (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
        {actions ? <Group gap="xs">{actions}</Group> : null}
      </Group>
    </Stack>
  );
}
