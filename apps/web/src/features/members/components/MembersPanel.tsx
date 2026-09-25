import { ActionIcon, Button, Card, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  canManageGrant,
  type ResourceScope,
  type RoleAssignment,
  type ScopeType,
} from '@helm/shared';
import { useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RoleTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { UserLabel } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { showSuccess } from '@/lib/notify';
import { useGrantableRoles, useRevokeRole, useScopeMembers } from '../api';
import { AddMemberModal } from './AddMemberModal';

type Group = 'direct' | 'inherited' | 'nested';

function groupOf(
  assignment: RoleAssignment,
  scopeType: ScopeType,
  scopeId: string | undefined,
): Group {
  const ownId = assignment.clientId ?? assignment.projectId ?? assignment.cycleId ?? undefined;
  if (assignment.scopeType === scopeType && ownId === scopeId) return 'direct';
  const order: ScopeType[] = ['workspace', 'client', 'project', 'cycle'];
  return order.indexOf(assignment.scopeType) < order.indexOf(scopeType) ? 'inherited' : 'nested';
}

const GROUP_TITLES: Record<Group, { title: string; hint: string }> = {
  direct: { title: 'Members', hint: 'Granted here' },
  nested: { title: 'Working on part of it', hint: 'Granted on a project or cycle inside' },
  inherited: { title: 'Inherited access', hint: 'Granted higher up; manage it there' },
};

export function MembersPanel({
  scopeType,
  scopeId,
  scope,
}: {
  scopeType: ScopeType;
  scopeId?: string;
  /** Full ancestry of the panel's scope, for client-side permission checks. */
  scope: ResourceScope;
}) {
  const user = useCurrentUser();
  const members = useScopeMembers(scopeType, scopeId);
  const grantable = useGrantableRoles(scopeType, scopeId);
  const revoke = useRevokeRole();
  const [adding, add] = useDisclosure(false);
  const [removing, setRemoving] = useState<RoleAssignment | null>(null);

  const canRemove = (assignment: RoleAssignment) =>
    canManageGrant({
      actorId: user.id,
      actorIsAdmin: user.isAdmin,
      actorGrants: user.grants,
      targetUserId: assignment.user.id,
      target: {
        role: assignment.role,
        scopeType: assignment.scopeType,
        scope: {
          clientId: assignment.clientId ?? scope.clientId,
          projectId:
            assignment.projectId ?? (assignment.scopeType === 'cycle' ? scope.projectId : null),
          cycleId: assignment.cycleId,
        },
      },
    });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          People with access here. Access flows down: someone added to a client can see all of its
          projects.
        </Text>
        {(grantable.data?.length ?? 0) > 0 ? (
          <Button
            leftSection={<ActionIcons.addUser size={16} stroke={ICON_STROKE} />}
            onClick={add.open}
          >
            Add member
          </Button>
        ) : null}
      </Group>
      <QueryState query={members}>
        {(items) => {
          if (items.length === 0) {
            return (
              <Card>
                <EmptyState icon={NavIcons.members} title="Nobody has been added yet" />
              </Card>
            );
          }
          const grouped: Record<Group, RoleAssignment[]> = {
            direct: [],
            nested: [],
            inherited: [],
          };
          for (const assignment of items)
            grouped[groupOf(assignment, scopeType, scopeId)].push(assignment);
          return (['direct', 'nested', 'inherited'] as const)
            .filter((group) => grouped[group].length > 0)
            .map((group) => (
              <Card key={group} p={0}>
                <Group px="md" pt="md" pb="xs" gap="xs">
                  <Text fw={600}>{GROUP_TITLES[group].title}</Text>
                  <Text size="xs" c="dimmed">
                    {GROUP_TITLES[group].hint}
                  </Text>
                </Group>
                <Table.ScrollContainer minWidth={560}>
                  <Table verticalSpacing="xs" horizontalSpacing="md" layout="fixed">
                    <Table.Tbody>
                      {grouped[group].map((assignment) => (
                        <Table.Tr key={assignment.id}>
                          <Table.Td w="38%">
                            <Group gap="xs" wrap="nowrap">
                              <UserLabel user={assignment.user} />
                              {assignment.user.userType === 'client' ? (
                                <Tag tone="client">Client user</Tag>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td w="24%">
                            <RoleTag role={assignment.role} />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {assignment.scopeLabel}
                            </Text>
                          </Table.Td>
                          <Table.Td w={48}>
                            {group !== 'inherited' && canRemove(assignment) ? (
                              <Tooltip label="Remove access">
                                <ActionIcon
                                  color="red"
                                  aria-label={`Remove ${assignment.user.displayName}`}
                                  onClick={() => setRemoving(assignment)}
                                >
                                  <ActionIcons.delete size={16} stroke={ICON_STROKE} />
                                </ActionIcon>
                              </Tooltip>
                            ) : null}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            ));
        }}
      </QueryState>
      <AddMemberModal
        opened={adding}
        onClose={add.close}
        scopeType={scopeType}
        scopeId={scopeId}
        clientId={scope.clientId ?? undefined}
        projectId={scopeType === 'project' ? scopeId : undefined}
        grantableRoles={grantable.data ?? []}
      />
      <ConfirmModal
        opened={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove access?"
        confirmLabel="Remove"
        danger
        loading={revoke.isPending}
        onConfirm={() =>
          removing &&
          revoke.mutate(removing.id, {
            onSuccess: () => {
              showSuccess(`${removing.user.displayName} no longer has access here`);
              setRemoving(null);
            },
          })
        }
      >
        {removing
          ? `${removing.user.displayName} will lose the ${removing.role.replace('_', ' ').toLowerCase()} role on ${removing.scopeLabel}.`
          : ''}
      </ConfirmModal>
    </Stack>
  );
}
