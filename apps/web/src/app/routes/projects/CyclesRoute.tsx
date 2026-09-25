import { ActionIcon, Button, Card, Group, Menu, SimpleGrid, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { hasPermission, type Cycle } from '@helm/shared';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CycleStatusTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { Meter } from '@/components/Meter';
import { QueryState } from '@/components/QueryState';
import { useCurrentUser } from '@/features/auth/api';
import { useCycles, useDeleteCycle, useUpdateCycle } from '@/features/cycles/api';
import { CompleteCycleModal } from '@/features/cycles/components/CompleteCycleModal';
import { CycleFormModal } from '@/features/cycles/components/CycleFormModal';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { formatDate } from '@/lib/format';
import { showSuccess } from '@/lib/notify';
import { useProjectContext } from './ProjectLayoutRoute';

export function CyclesRoute() {
  const { project } = useProjectContext();
  const user = useCurrentUser();
  const cycles = useCycles(project.key);
  const update = useUpdateCycle();
  const remove = useDeleteCycle();
  const [formOpen, form] = useDisclosure(false);
  const [editing, setEditing] = useState<Cycle | undefined>();
  const [completing, setCompleting] = useState<Cycle | null>(null);
  const [deleting, setDeleting] = useState<Cycle | null>(null);
  const projectScope = { clientId: project.clientId, projectId: project.id };
  const canCreate = hasPermission(user.grants, projectScope, 'cycle.create');
  const can = (cycle: Cycle, permission: 'cycle.update' | 'cycle.delete') =>
    hasPermission(user.grants, { ...projectScope, cycleId: cycle.id }, permission);

  return (
    <>
      {canCreate ? (
        <Group justify="flex-end" mb="md">
          <Button
            leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />}
            onClick={() => {
              setEditing(undefined);
              form.open();
            }}
          >
            Plan a cycle
          </Button>
        </Group>
      ) : null}
      <QueryState query={cycles}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState
                icon={NavIcons.cycles}
                title="No cycles yet"
                description="Cycles are sprints or phases. Plan one, then move tickets into it from the backlog."
              />
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {items.map((cycle) => (
                <Card key={cycle.id}>
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={600}>{cycle.name}</Text>
                        <CycleStatusTag status={cycle.status} />
                      </Group>
                      {can(cycle, 'cycle.update') ? (
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon aria-label={`Actions for ${cycle.name}`}>
                              <ActionIcons.more size={18} stroke={ICON_STROKE} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<ActionIcons.edit size={14} stroke={ICON_STROKE} />}
                              onClick={() => {
                                setEditing(cycle);
                                form.open();
                              }}
                            >
                              Edit
                            </Menu.Item>
                            {cycle.status === 'planned' ? (
                              <Menu.Item
                                leftSection={<ActionIcons.start size={14} stroke={ICON_STROKE} />}
                                onClick={() =>
                                  update.mutate(
                                    { id: cycle.id, status: 'active' },
                                    { onSuccess: () => showSuccess(`${cycle.name} started`) },
                                  )
                                }
                              >
                                Start cycle
                              </Menu.Item>
                            ) : null}
                            {cycle.status !== 'completed' ? (
                              <Menu.Item
                                leftSection={
                                  <ActionIcons.complete size={14} stroke={ICON_STROKE} />
                                }
                                onClick={() => setCompleting(cycle)}
                              >
                                Complete cycle
                              </Menu.Item>
                            ) : null}
                            {can(cycle, 'cycle.delete') ? (
                              <>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={
                                    <ActionIcons.delete size={14} stroke={ICON_STROKE} />
                                  }
                                  onClick={() => setDeleting(cycle)}
                                >
                                  Delete
                                </Menu.Item>
                              </>
                            ) : null}
                          </Menu.Dropdown>
                        </Menu>
                      ) : null}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {cycle.startDate || cycle.endDate
                        ? `${formatDate(cycle.startDate)} – ${formatDate(cycle.endDate)}`
                        : 'No dates set'}
                    </Text>
                    {cycle.goal ? <Text size="sm">{cycle.goal}</Text> : null}
                    <Meter
                      done={cycle.doneCount}
                      total={cycle.ticketCount}
                      label={
                        <Text size="xs" c="dimmed">
                          Progress
                        </Text>
                      }
                    />
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )
        }
      </QueryState>
      <CycleFormModal
        opened={formOpen}
        onClose={form.close}
        projectKey={project.key}
        cycle={editing}
      />
      <CompleteCycleModal
        opened={Boolean(completing)}
        onClose={() => setCompleting(null)}
        cycle={completing}
        otherCycles={(cycles.data ?? []).filter(
          (c) => c.id !== completing?.id && c.status !== 'completed',
        )}
      />
      <ConfirmModal
        opened={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'cycle'}?`}
        confirmLabel="Delete cycle"
        danger
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              showSuccess('Cycle deleted; its tickets are back in the backlog');
              setDeleting(null);
            },
          })
        }
      >
        Its tickets move back to the backlog, and anyone granted access only to this cycle loses it.
      </ConfirmModal>
    </>
  );
}
