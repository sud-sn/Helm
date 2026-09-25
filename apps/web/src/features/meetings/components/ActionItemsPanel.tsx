import {
  ActionIcon,
  Alert,
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
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ActionItem, Meeting } from '@helm/shared';
import { ActionItemStatusTag } from '@/components/domain-tags';
import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { UserLabel } from '@/components/UserAvatar';
import { useFeatures } from '@/features/ai/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { pluralize } from '@/lib/format';
import { showInfo, showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { usePermissions } from '@/lib/permissions';
import {
  useActionItemToPitch,
  useActionItems,
  useCreateActionItem,
  useDeleteActionItem,
  useSuggestActionItems,
  useUpdateActionItem,
} from '../api';
import { useConversionTargets } from '../conversion';
import { ConvertActionItemsModal } from './ConvertActionItemsModal';

/** Asks AI to read the transcript; results arrive in the list as suggestions to review. */
function SuggestBar({ meeting }: { meeting: Meeting }) {
  const suggest = useSuggestActionItems(meeting.id);
  const hasTranscript = meeting.transcript.trim().length > 0;

  const run = () =>
    suggest.mutate(undefined, {
      onSuccess: ({ created, skipped }) => {
        const leftOut =
          skipped.unverified > 0
            ? ` ${pluralize(skipped.unverified, 'suggestion')} left out: not found in the transcript.`
            : '';
        if (created.length > 0) {
          showSuccess(
            `Check each one against its quote, then accept or dismiss it.${leftOut}`,
            `${pluralize(created.length, 'suggestion')} to review`,
          );
        } else {
          showInfo(`No new action items found in the transcript.${leftOut}`);
        }
      },
    });

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap={6} wrap="nowrap">
          <ActionIcons.suggest size={16} stroke={ICON_STROKE} aria-hidden />
          <Text size="sm" c="dimmed">
            {suggest.isPending
              ? 'Reading the transcript… this can take up to a minute.'
              : 'AI can read the transcript and suggest action items for you to review.'}
          </Text>
        </Group>
        <Tooltip label="Add the transcript first" disabled={hasTranscript}>
          <Button
            variant="light"
            size="xs"
            leftSection={<ActionIcons.suggest size={14} stroke={ICON_STROKE} />}
            onClick={run}
            loading={suggest.isPending}
            disabled={!hasTranscript}
          >
            Suggest from transcript
          </Button>
        </Tooltip>
      </Group>
      {suggest.error ? (
        <Alert color="red" withCloseButton onClose={() => suggest.reset()}>
          {suggest.error.message}
        </Alert>
      ) : null}
    </Stack>
  );
}

/**
 * Action items agreed in the meeting. Whoever records the meeting lists them, or asks AI to
 * suggest them from the transcript; suggestions wait for a person to accept or dismiss them. A
 * Team Lead then picks open items to turn into tickets.
 */
export function ActionItemsPanel({ meeting }: { meeting: Meeting }) {
  const scope = { clientId: meeting.clientId, projectId: meeting.projectId };
  const permissions = usePermissions(scope);
  const canWrite = permissions.has('meeting.write');
  const canPitch = permissions.has('pitch.write');
  const canConvert = useConversionTargets(meeting).targets.length > 0;
  const aiEnabled = useFeatures().data?.ai ?? false;
  const items = useActionItems(meeting.id);
  const create = useCreateActionItem(meeting.id);
  const update = useUpdateActionItem();
  const remove = useDeleteActionItem();
  const toPitch = useActionItemToPitch();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [converting, convert] = useDisclosure(false);
  const [acceptingAll, setAcceptingAll] = useState(false);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    create.mutate({ title: title.trim() }, { onSuccess: () => setTitle('') });
  };

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const busy = (item: ActionItem) => update.isPending && update.variables?.id === item.id;

  const acceptAll = async (suggestions: ActionItem[]) => {
    setAcceptingAll(true);
    try {
      await Promise.all(
        suggestions.map((item) => update.mutateAsync({ id: item.id, status: 'open' })),
      );
      showSuccess(`${pluralize(suggestions.length, 'action item')} accepted`);
    } finally {
      setAcceptingAll(false);
    }
  };

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
      {canWrite && aiEnabled ? <SuggestBar meeting={meeting} /> : null}
      <QueryState query={items}>
        {(list) => {
          const suggestions = list.filter((item) => item.status === 'suggested');
          return list.length === 0 ? (
            <Card>
              <EmptyState
                icon={ActionIcons.actionItem}
                title="No action items"
                description="List what was agreed in the meeting."
              />
            </Card>
          ) : (
            <Stack gap="md">
              {canWrite && suggestions.length > 0 ? (
                <Alert
                  color="violet"
                  icon={<ActionIcons.suggest size={18} stroke={ICON_STROKE} />}
                  title={`${pluralize(suggestions.length, 'suggestion')} to review`}
                >
                  <Group justify="space-between" gap="xs" wrap="wrap">
                    <Text size="sm">
                      Suggested by AI from the transcript. Check each one against its quote, then
                      accept or dismiss it.
                    </Text>
                    {suggestions.length > 1 ? (
                      <Button
                        size="compact-sm"
                        variant="light"
                        color="violet"
                        loading={acceptingAll}
                        onClick={() => void acceptAll(suggestions)}
                      >
                        Accept all
                      </Button>
                    ) : null}
                  </Group>
                </Alert>
              ) : null}
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
                    {list.map((item) => (
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
                          <Stack gap={2}>
                            <Group gap={6} wrap="nowrap">
                              {item.source === 'ai' ? (
                                <Tooltip label="Suggested by AI from the transcript">
                                  <ActionIcons.suggest
                                    size={14}
                                    stroke={ICON_STROKE}
                                    aria-label="Suggested by AI"
                                    style={{ flex: 'none' }}
                                  />
                                </Tooltip>
                              ) : null}
                              <Text
                                size="sm"
                                td={item.status === 'dismissed' ? 'line-through' : undefined}
                              >
                                {item.title}
                              </Text>
                            </Group>
                            {item.sourceQuote ? (
                              <Text
                                size="xs"
                                c="dimmed"
                                fs="italic"
                                lineClamp={3}
                                title={item.sourceQuote}
                              >
                                “{item.sourceQuote}”
                              </Text>
                            ) : null}
                            {item.suggestedAssignee ? (
                              <Group gap={4} wrap="nowrap">
                                <Text size="xs" c="dimmed">
                                  Owner:
                                </Text>
                                <UserLabel user={item.suggestedAssignee} />
                              </Group>
                            ) : null}
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
                          </Stack>
                        </Table.Td>
                        <Table.Td w={120}>
                          <ActionItemStatusTag status={item.status} />
                        </Table.Td>
                        <Table.Td w={96}>
                          {canWrite && item.status === 'suggested' ? (
                            <Group gap={4} wrap="nowrap" justify="flex-end">
                              <Tooltip label="Accept">
                                <ActionIcon
                                  variant="light"
                                  color="green"
                                  aria-label={`Accept ${item.title}`}
                                  loading={busy(item) && update.variables?.status === 'open'}
                                  disabled={busy(item)}
                                  onClick={() => update.mutate({ id: item.id, status: 'open' })}
                                >
                                  <ActionIcons.check size={16} stroke={ICON_STROKE} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Dismiss">
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`Dismiss ${item.title}`}
                                  loading={busy(item) && update.variables?.status === 'dismissed'}
                                  disabled={busy(item)}
                                  onClick={() =>
                                    update.mutate({ id: item.id, status: 'dismissed' })
                                  }
                                >
                                  <ActionIcons.close size={16} stroke={ICON_STROKE} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          ) : canWrite && item.status !== 'converted' ? (
                            <Group justify="flex-end">
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
                            </Group>
                          ) : null}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          );
        }}
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
