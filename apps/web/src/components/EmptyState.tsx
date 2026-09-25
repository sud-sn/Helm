import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';
import { ICON_STROKE, type AppIcon } from '@/icons';

/** What is missing and what to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: AppIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Center py={48}>
      <Stack align="center" gap="xs" maw={420} ta="center">
        <ThemeIcon size={52} radius="xl" variant="light" color="gray">
          <Icon size={28} stroke={ICON_STROKE} />
        </ThemeIcon>
        <Text fw={600} size="md">
          {title}
        </Text>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
        {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
      </Stack>
    </Center>
  );
}
