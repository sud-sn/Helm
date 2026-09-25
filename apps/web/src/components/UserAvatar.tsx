import { Avatar, Group, Text, Tooltip } from '@mantine/core';
import type { UserSummary } from '@helm/shared';

const AVATAR_COLORS = ['helm', 'indigo', 'grape', 'cyan', 'teal', 'blue', 'violet', 'brass'];

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase();
}

export function UserAvatar({
  user,
  size = 'sm',
}: {
  user: UserSummary;
  size?: 'sm' | 'md' | 'lg' | number;
}) {
  return (
    <Tooltip label={`${user.displayName} (@${user.username})`}>
      <Avatar
        size={size}
        radius="xl"
        color={colorFor(user.id)}
        variant="light"
        alt={user.displayName}
      >
        {initials(user.displayName)}
      </Avatar>
    </Tooltip>
  );
}

export function UserLabel({
  user,
  fallback = 'Unassigned',
}: {
  user: UserSummary | null;
  fallback?: string;
}) {
  if (!user) {
    return (
      <Text size="sm" c="dimmed">
        {fallback}
      </Text>
    );
  }
  return (
    <Group gap={6} wrap="nowrap">
      <UserAvatar user={user} size={24} />
      <Text size="sm" truncate>
        {user.displayName}
      </Text>
    </Group>
  );
}
