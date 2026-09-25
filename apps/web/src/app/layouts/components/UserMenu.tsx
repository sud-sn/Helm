import { Avatar, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { ROLE_LABELS, ROLE_RANK, type Role } from '@helm/shared';
import { Link, useNavigate } from 'react-router';
import { initials } from '@/components/UserAvatar';
import { useCurrentUser, useLogout } from '@/features/auth/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { paths } from '@/lib/paths';

export function UserMenu({ accountPath }: { accountPath: string }) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const topRole = user.grants.reduce<Role | null>(
    (best, grant) => (!best || ROLE_RANK[grant.role] > ROLE_RANK[best] ? grant.role : best),
    null,
  );
  const summary =
    user.userType === 'client'
      ? 'Client'
      : topRole
        ? ROLE_LABELS[topRole]
        : 'No project access yet';

  return (
    <Menu width={240} position="bottom-end">
      <Menu.Target>
        <UnstyledButton aria-label="Account menu" px={4}>
          <Group gap={8} wrap="nowrap">
            <Avatar size={32} radius="xl" color="helm" variant="filled">
              {initials(user.displayName)}
            </Avatar>
            <div style={{ lineHeight: 1.1 }} className="hide-mobile">
              <Text size="sm" fw={600} c="white">
                {user.displayName}
              </Text>
              <Text size="xs" c="navy.2">
                {user.isAdmin ? `${summary} · Admin` : summary}
              </Text>
            </div>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Signed in as @{user.username}</Menu.Label>
        <Menu.Item
          component={Link}
          to={accountPath}
          leftSection={<ActionIcons.key size={16} stroke={ICON_STROKE} />}
        >
          Account & password
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<ActionIcons.logout size={16} stroke={ICON_STROKE} />}
          onClick={() =>
            logout.mutate(undefined, {
              onSettled: () => void navigate(paths.login, { replace: true }),
            })
          }
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
