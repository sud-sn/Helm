import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ActionItem, Meeting } from '@helm/shared';
import { ActionItemStatusTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { usePermissions } from '@/lib/permissions';
import {
  useActionItemToPitch,
  useActionItems,
  useCreateActionItem,
  useDeleteActionItem,
  useUpdateActionItem,
} from '../api';
import { useConversionTargets } from '../conversion';
import { ConvertActionItemsModal } from './ConvertActionItemsModal';

/**
 * Action items agreed in the meeting. Whoever records the meeting lists them; a Team Lead picks
 * the ones to turn into tickets. (AI extraction will fill this same list later.)
 */
export function ActionItemsPanel({ meeting }: { meeting: Meeting }) {
  const scope = { clientId: meeting.clientId, projectId: meeting.projectId };
  const permissions = usePermissions(scope);
  const canWrite = permissions.has('meeting.write');
  const canPitch = permissions.has('pitch.write');
  const canConvert = useConversionTargets(meeting).targets.length > 0;
  const items = useActionItems(meeting.id);
  const create = useCreateActionItem(meeting.id);
  const update = useUpdateActionItem();
  const remove = useDeleteActionItem();
  const toPitch = useActionItemToPitch();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [converting, convert] = useDisclosure(false);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    create.mutate({ title: title.trim() }, { onSuccess: () => setTitle('') });
  };

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <Stack gap="md">
      {canWrite ? (
        <form onSubmit={add}>
          <Group gap="xs" align="flex-end">
            <TextInput
              style={{ flex: 1 }}
              label="New action item"
              placeholder="e.g. Move the revenue cut-off to 02:00 UTC"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <Button
              type="submit"
              variant="light"
              loading={create.isPending}
              disabled={!title.trim()}
            >
              Add
            </Button>
          </Group>
        </form>
      ) : null}
      <QueryState query={items}>
        {(list) =>
          list.length === 0 ? (
            <Card>
              <EmptyState
                icon={ActionIcons.actionItem}
                title="No action items"
                description="List what was agreed in the meeting."
              />
            </Card>
          ) : (
            <Card p={0}>
              <Group justify="space-between" px="md" py="sm">
                <Text size="sm" c="dimmed">
                  {!canConvert
                    ? 'A Team Lead turns open items into tickets.'
                    : selected.length > 0
                      ? `${selected.length} selected`
                      : 'Select open items to turn them into tickets'}
                </Text>
                {canConvert ? (
                  <Button
                    size="xs"
                    disabled={selected.length === 0}
                    onClick={convert.open}
                    leftSection={<ActionIcons.forward size={14} stroke={ICON_STROKE} />}
                  >
                    Create tickets
                  </Button>
                ) : null}
              </Group>
              <Table verticalSpacing="xs" horizontalSpacing="md">
                <Table.Tbody>
                  {list.map((item: ActionItem) => (
                    <Table.Tr key={item.id}>
                      {canConvert ? (
                        <Table.Td w={36}>
                          <Checkbox
                            aria-label={`Select ${item.title}`}
                            checked={selected.includes(item.id)}
                            disabled={item.status !== 'open'}
                            onChange={() => toggle(item.id)}
                          />
                        </Table.Td>
                      ) : null}
                      <Table.Td>
                        <Text
                          size="sm"
                          td={item.status === 'dismissed' ? 'line-through' : undefined}
                        >
                          {item.title}
                        </Text>
                        {item.ticket ? (
                          <Anchor
                            component={Link}
                            to={paths.ticket(item.ticket.key)}
                            size="xs"
                            ff="monospace"
                          >
                            {item.ticket.key}
                          </Anchor>
                        ) : null}
                        {item.pitch ? (
                          <Anchor component={Link} to={paths.pitch(item.pitch.id)} size="xs">
                            Pitch: {item.pitch.title}
                          </Anchor>
                        ) : null}
                      </Table.Td>
                      <Table.Td w={120}>
                        <ActionItemStatusTag status={item.status} />
                      </Table.Td>
                      <Table.Td w={48}>
                        {canWrite && item.status !== 'converted' ? (
                          <Menu position="bottom-end">
                            <Menu.Target>
                              <ActionIcon aria-label={`Actions for ${item.title}`}>
                                <ActionIcons.more size={16} stroke={ICON_STROKE} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {item.status === 'open' && canPitch ? (
                                <Menu.Item
                                  leftSection={
                                    <ActionIcons.forward size={14} stroke={ICON_STROKE} />
                                  }
                                  onClick={() =>
                                    toPitch.mutate(item.id, {
                                      onSuccess: ({ pitchId }) => {
                                        showSuccess('Draft pitch created');
                                        void navigate(paths.pitch(pitchId));
                                      },
                                    })
                                  }
                                >
                                  Turn into a pitch
                                </Menu.Item>
                              ) : null}
                              <Menu.Item
                                onClick={() =>
                                  update.mutate({
                                    id: item.id,
                                    status: item.status === 'open' ? 'dismissed' : 'open',
                                  })
                                }
                              >
                                {item.status === 'open' ? 'Dismiss' : 'Reopen'}
                              </Menu.Item>
                              <Menu.Item color="red" onClick={() => remove.mutate(item.id)}>
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        ) : null}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )
        }
      </QueryState>
      <ConvertActionItemsModal
        opened={converting}
        onClose={convert.close}
        meeting={meeting}
        items={(items.data ?? []).filter((item) => selected.includes(item.id))}
        onDone={() => setSelected([])}
      />
    </Stack>
  );
}
