import {
  ActionIcon,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { AdminUser, TemporaryPasswordResponse } from '@helm/shared';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RoleTag } from '@/components/domain-tags';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { useCurrentUser } from '@/features/auth/api';
import { useAdminUser, useResetPassword, useUpdateUser } from '@/features/admin/api';
import { GrantAccessModal } from '@/features/admin/components/GrantAccessModal';
import { TemporaryPasswordModal } from '@/features/admin/components/TemporaryPasswordModal';
import { useRevokeRole, useUserAssignments } from '@/features/members/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { emptyToNull } from '@/lib/forms';
import { formatDateTime } from '@/lib/format';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';

export function UserRoute() {
  const { userId = '' } = useParams();
  const me = useCurrentUser();
  const user = useAdminUser(userId);
  const assignments = useUserAssignments(userId);
  const update = useUpdateUser(userId);
  const reset = useResetPassword(userId);
  const revoke = useRevokeRole();
  const [granting, grant] = useDisclosure(false);
  const [confirmReset, resetModal] = useDisclosure(false);
  const [password, setPassword] = useState<TemporaryPasswordResponse | null>(null);
  const self = userId === me.id;

  return (
    <QueryState query={user}>
      {(data) => (
        <>
          <PageHeader
            crumbs={[{ label: 'Users', to: paths.adminUsers }, { label: data.displayName }]}
            title={data.displayName}
            meta={
              <Group gap={6}>
                {data.userType === 'client' ? <Tag tone="client">{data.clientName}</Tag> : null}
                {data.isAdmin ? <Tag tone="special">Admin</Tag> : null}
                {!data.isActive ? <Tag tone="neutral">Deactivated</Tag> : null}
                {data.lockedUntil ? <Tag tone="danger">Locked</Tag> : null}
              </Group>
            }
            description={`@${data.username} · last sign-in ${data.lastLoginAt ? formatDateTime(data.lastLoginAt) : 'never'}`}
            actions={
              <>
                <Button
                  variant="default"
                  leftSection={<ActionIcons.key size={16} stroke={ICON_STROKE} />}
                  onClick={resetModal.open}
                >
                  Reset password
                </Button>
                <Button
                  variant={data.isActive ? 'default' : 'filled'}
                  color={data.isActive ? 'red' : undefined}
                  disabled={self}
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { isActive: !data.isActive },
                      {
                        onSuccess: (u) =>
                          showSuccess(
                            u.isActive
                              ? 'Account reactivated'
                              : 'Account deactivated and signed out',
                          ),
                      },
                    )
                  }
                >
                  {data.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </>
            }
          />
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <ProfileCard key={data.id} user={data} self={self} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Card>
                <Group justify="space-between" mb="md">
                  <Title order={3}>Access</Title>
                  <Button
                    size="xs"
                    leftSection={<ActionIcons.add size={14} stroke={ICON_STROKE} />}
                    onClick={grant.open}
                  >
                    Grant access
                  </Button>
                </Group>
                <QueryState query={assignments}>
                  {(items) =>
                    items.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        No access yet.{' '}
                        {data.userType === 'client' ? '' : 'Grant a role on a client or project.'}
                      </Text>
                    ) : (
                      <Table verticalSpacing="xs">
                        <Table.Tbody>
                          {items.map((assignment) => (
                            <Table.Tr key={assignment.id}>
                              <Table.Td>
                                <RoleTag role={assignment.role} />
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{assignment.scopeLabel}</Text>
                              </Table.Td>
                              <Table.Td w={40}>
                                <Tooltip label="Remove">
                                  <ActionIcon
                                    color="red"
                                    aria-label={`Remove ${assignment.role} on ${assignment.scopeLabel}`}
                                    onClick={() =>
                                      revoke.mutate(assignment.id, {
                                        onSuccess: () => showSuccess('Access removed'),
                                      })
                                    }
                                  >
                                    <ActionIcons.delete size={16} stroke={ICON_STROKE} />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )
                  }
                </QueryState>
              </Card>
            </Grid.Col>
          </Grid>
          <GrantAccessModal opened={granting} onClose={grant.close} user={data} />
          <ConfirmModal
            opened={confirmReset}
            onClose={resetModal.close}
            title="Reset password?"
            confirmLabel="Reset password"
            loading={reset.isPending}
            onConfirm={() =>
              reset.mutate(undefined, {
                onSuccess: (result) => {
                  resetModal.close();
                  setPassword(result);
                },
              })
            }
          >
            {data.displayName} is signed out everywhere and gets a new temporary password, which you
            will see once. Any lock is cleared.
          </ConfirmModal>
          <TemporaryPasswordModal result={password} onClose={() => setPassword(null)} />
        </>
      )}
    </QueryState>
  );
}

/** Keyed by user id, so it starts from the loaded profile without syncing state in an effect. */
function ProfileCard({ user, self }: { user: AdminUser; self: boolean }) {
  const update = useUpdateUser(user.id);
  const [profile, setProfile] = useState({
    displayName: user.displayName,
    email: user.email ?? '',
  });
  return (
    <Card>
      <Title order={3} mb="md">
        Profile
      </Title>
      <Stack>
        <TextInput
          label="Full name"
          value={profile.displayName}
          onChange={(e) => setProfile({ ...profile, displayName: e.currentTarget.value })}
        />
        <TextInput
          label="Email"
          value={profile.email}
          onChange={(e) => setProfile({ ...profile, email: e.currentTarget.value })}
        />
        {user.userType === 'staff' ? (
          <Switch
            label="Administrator"
            description={
              self
                ? 'You cannot remove your own administrator access'
                : 'Manages accounts, access and the audit log'
            }
            checked={user.isAdmin}
            disabled={self}
            onChange={(e) => update.mutate({ isAdmin: e.currentTarget.checked })}
          />
        ) : null}
        <Group justify="flex-end">
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { displayName: profile.displayName, email: emptyToNull(profile.email) },
                { onSuccess: () => showSuccess('Profile saved') },
              )
            }
          >
            Save profile
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
