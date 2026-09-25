import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Grid,
  Group,
  Menu,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { hasPermission } from '@helm/shared';
import { ConfirmModal } from '@/components/ConfirmModal';
import { TypeTag } from '@/components/domain-tags';
import { Markdown } from '@/components/Markdown';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { useCurrentUser } from '@/features/auth/api';
import { useTicketPages } from '@/features/pages/api';
import { NewPageModal } from '@/features/pages/components/NewPageModal';
import { useDeleteTicket, useTicket, useUpdateTicket } from '@/features/tickets/api';
import { CommentThread } from '@/features/tickets/components/CommentThread';
import { TicketFields } from '@/features/tickets/components/TicketFields';
import { TicketHistory } from '@/features/tickets/components/TicketHistory';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { canEditTicket } from '@/lib/ticket-permissions';

export function TicketRoute() {
  const { key = '' } = useParams();
  const ticketKey = key.toUpperCase();
  const user = useCurrentUser();
  const ticket = useTicket(ticketKey);
  const pages = useTicketPages(ticketKey);
  const update = useUpdateTicket();
  const remove = useDeleteTicket();
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [deleting, del] = useDisclosure(false);
  const [newPage, newPageModal] = useDisclosure(false);

  return (
    <QueryState query={ticket}>
      {(data) => {
        const scope = { clientId: data.clientId, projectId: data.projectId, cycleId: data.cycleId };
        const full = canEditTicket(user, data);
        const canDelete = hasPermission(user.grants, scope, 'ticket.delete');
        const canWritePages = hasPermission(user.grants, scope, 'page.write');
        return (
          <>
            <PageHeader
              crumbs={[
                { label: data.projectKey, to: paths.project(data.projectKey) },
                {
                  label: data.cycleName ?? 'Backlog',
                  to: paths.project(data.projectKey, data.cycleName ? 'board' : 'backlog'),
                },
                { label: data.key },
              ]}
              title={
                editingTitle !== null ? (
                  <Group gap="xs">
                    <TextInput
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.currentTarget.value)}
                      aria-label="Title"
                      w={{ base: 260, md: 520 }}
                      autoFocus
                    />
                    <Button
                      size="xs"
                      onClick={() =>
                        update.mutate(
                          { key: data.key, title: editingTitle },
                          { onSuccess: () => setEditingTitle(null) },
                        )
                      }
                      loading={update.isPending}
                    >
                      Save
                    </Button>
                    <Button size="xs" variant="default" onClick={() => setEditingTitle(null)}>
                      Cancel
                    </Button>
                  </Group>
                ) : (
                  data.title
                )
              }
              meta={
                <Group gap="xs">
                  <Text ff="monospace" c="dimmed" size="sm">
                    {data.key}
                  </Text>
                  <TypeTag type={data.type} />
                </Group>
              }
              actions={
                full || canDelete ? (
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="default" size="lg" aria-label="Ticket actions">
                        <ActionIcons.more size={18} stroke={ICON_STROKE} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {full ? (
                        <Menu.Item
                          leftSection={<ActionIcons.edit size={14} stroke={ICON_STROKE} />}
                          onClick={() => setEditingTitle(data.title)}
                        >
                          Rename
                        </Menu.Item>
                      ) : null}
                      {canDelete ? (
                        <Menu.Item
                          color="red"
                          leftSection={<ActionIcons.delete size={14} stroke={ICON_STROKE} />}
                          onClick={del.open}
                        >
                          Delete ticket
                        </Menu.Item>
                      ) : null}
                    </Menu.Dropdown>
                  </Menu>
                ) : undefined
              }
            />
            <Grid gap="lg">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="lg">
                  <Card>
                    <Group justify="space-between" mb="xs">
                      <Title order={3}>Description</Title>
                      {full && editingDescription === null ? (
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<ActionIcons.edit size={14} stroke={ICON_STROKE} />}
                          onClick={() => setEditingDescription(data.description)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </Group>
                    {editingDescription !== null ? (
                      <Stack gap="xs">
                        <MarkdownEditor
                          value={editingDescription}
                          onChange={setEditingDescription}
                          minRows={6}
                        />
                        <Group justify="flex-end" gap="xs">
                          <Button
                            variant="default"
                            size="xs"
                            onClick={() => setEditingDescription(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            loading={update.isPending}
                            onClick={() =>
                              update.mutate(
                                { key: data.key, description: editingDescription },
                                { onSuccess: () => setEditingDescription(null) },
                              )
                            }
                          >
                            Save
                          </Button>
                        </Group>
                      </Stack>
                    ) : data.description.trim() ? (
                      <Markdown>{data.description}</Markdown>
                    ) : (
                      <Text c="dimmed" size="sm">
                        No description.
                      </Text>
                    )}
                  </Card>
                  <Card>
                    <Group justify="space-between" mb="xs">
                      <Title order={3}>Documentation</Title>
                      {canWritePages ? (
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<NavIcons.pages size={14} stroke={ICON_STROKE} />}
                          onClick={newPageModal.open}
                        >
                          Write a page
                        </Button>
                      ) : null}
                    </Group>
                    {(pages.data ?? []).length === 0 ? (
                      <Text size="sm" c="dimmed">
                        No pages linked yet. Document the job once it is done.
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {pages.data?.map((page) => (
                          <Anchor key={page.id} component={Link} to={paths.page(page.id)} size="sm">
                            {page.title}
                          </Anchor>
                        ))}
                      </Stack>
                    )}
                  </Card>
                  <Card>
                    <Tabs defaultValue="comments" keepMounted={false}>
                      <Tabs.List mb="md">
                        <Tabs.Tab
                          value="comments"
                          leftSection={<ActionIcons.comment size={16} stroke={ICON_STROKE} />}
                        >
                          Comments
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="history"
                          leftSection={<ActionIcons.history size={16} stroke={ICON_STROKE} />}
                        >
                          History
                        </Tabs.Tab>
                      </Tabs.List>
                      <Tabs.Panel value="comments">
                        <CommentThread ticket={data} />
                      </Tabs.Panel>
                      <Tabs.Panel value="history">
                        <TicketHistory ticketKey={data.key} />
                      </Tabs.Panel>
                    </Tabs>
                  </Card>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TicketFields ticket={data} />
              </Grid.Col>
            </Grid>
            <ConfirmModal
              opened={deleting}
              onClose={del.close}
              title={`Delete ${data.key}?`}
              confirmLabel="Delete ticket"
              danger
              loading={remove.isPending}
              onConfirm={() =>
                remove.mutate(data.key, {
                  onSuccess: () => {
                    showSuccess(`${data.key} deleted`);
                    void navigate(paths.project(data.projectKey, 'tickets'));
                  },
                })
              }
            >
              The ticket, its comments and history are removed permanently. To keep a record, set
              its status to Cancelled instead.
            </ConfirmModal>
            <NewPageModal
              opened={newPage}
              onClose={newPageModal.close}
              projectKey={data.projectKey}
              ticketId={data.id}
              defaultTitle={data.title}
            />
          </>
        );
      }}
    </QueryState>
  );
}
