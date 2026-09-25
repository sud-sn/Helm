import {
  Anchor,
  Button,
  Card,
  Group,
  SegmentedControl,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import type { TemporaryPasswordResponse, UserType } from '@helm/shared';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { UserAvatar } from '@/components/UserAvatar';
import { useAdminUsers } from '@/features/admin/api';
import { TemporaryPasswordModal } from '@/features/admin/components/TemporaryPasswordModal';
import { UserFormModal } from '@/features/admin/components/UserFormModal';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { fromNow } from '@/lib/format';
import { paths } from '@/lib/paths';

export function UsersRoute() {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search, 250);
  const [type, setType] = useState<'all' | UserType>('all');
  const [includeInactive, setIncludeInactive] = useState(false);
  const users = useAdminUsers({
    q: q || undefined,
    userType: type === 'all' ? undefined : type,
    includeInactive,
  });
  const [creating, create] = useDisclosure(false);
  const [created, setCreated] = useState<TemporaryPasswordResponse | null>(null);

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account is created here. New users choose their own password when they first sign in."
        actions={
          <Button
            leftSection={<ActionIcons.addUser size={16} stroke={ICON_STROKE} />}
            onClick={create.open}
          >
            New user
          </Button>
        }
      />
      <Group mb="md" gap="sm" wrap="wrap">
        <TextInput
          aria-label="Search users"
          placeholder="Search name, username or email"
          leftSection={<ActionIcons.search size={16} stroke={ICON_STROKE} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={280}
        />
        <SegmentedControl
          value={type}
          onChange={(value) => setType(value as 'all' | UserType)}
          data={[
            { value: 'all', label: 'Everyone' },
            { value: 'staff', label: 'Team' },
            { value: 'client', label: 'Client users' },
          ]}
        />
        <Switch
          label="Include deactivated"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.currentTarget.checked)}
        />
      </Group>
      <QueryState query={users}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState icon={NavIcons.users} title="No users match" />
            </Card>
          ) : (
            <Card p={0}>
              <Table.ScrollContainer minWidth={760}>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Person</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Last sign-in</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((user) => (
                      <Table.Tr key={user.id}>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <UserAvatar user={user} />
                            <div>
                              <Anchor
                                component={Link}
                                to={paths.adminUser(user.id)}
                                fw={600}
                                size="sm"
                              >
                                {user.displayName}
                              </Anchor>
                              <Text size="xs" c="dimmed">
                                @{user.username}
                                {user.email ? ` · ${user.email}` : ''}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            {user.userType === 'client' ? (
                              <Tag tone="client">{user.clientName ?? 'Client'}</Tag>
                            ) : (
                              <Tag tone="neutral">Team</Tag>
                            )}
                            {user.isAdmin ? <Tag tone="special">Admin</Tag> : null}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {!user.isActive ? (
                            <Tag tone="neutral">Deactivated</Tag>
                          ) : user.lockedUntil ? (
                            <Tag tone="danger">Locked</Tag>
                          ) : user.mustChangePassword ? (
                            <Tag tone="warning">Awaiting first sign-in</Tag>
                          ) : (
                            <Tag tone="success">Active</Tag>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {user.lastLoginAt ? fromNow(user.lastLoginAt) : 'Never'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          )
        }
      </QueryState>
      <UserFormModal opened={creating} onClose={create.close} onCreated={setCreated} />
      <TemporaryPasswordModal result={created} onClose={() => setCreated(null)} />
    </>
  );
}
