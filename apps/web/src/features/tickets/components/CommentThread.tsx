import { ActionIcon, Alert, Button, Group, Menu, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { hasPermission, type Ticket } from '@helm/shared';
import { Markdown } from '@/components/Markdown';
import { UserAvatar } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { fromNow } from '@/lib/format';
import {
  useAddComment,
  useAssignableUsers,
  useComments,
  useDeleteComment,
  useEditComment,
} from '../api';
import { MentionTextarea } from './MentionTextarea';

export function CommentThread({ ticket }: { ticket: Ticket }) {
  const user = useCurrentUser();
  const comments = useComments(ticket.key);
  const people = useAssignableUsers(ticket.projectKey, ticket.cycleId);
  const add = useAddComment(ticket.key);
  const edit = useEditComment(ticket.key);
  const remove = useDeleteComment(ticket.key);
  const [body, setBody] = useState('');
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const scope = { clientId: ticket.clientId, projectId: ticket.projectId, cycleId: ticket.cycleId };
  const canComment = hasPermission(user.grants, scope, 'comment.create');
  const canModerate = hasPermission(user.grants, scope, 'comment.moderate');

  const submit = () => {
    if (!body.trim()) return;
    add.mutate(body, {
      onSuccess: (result) => {
        setBody('');
        setUnresolved(result.unresolvedMentions);
      },
    });
  };

  return (
    <Stack gap="lg">
      {(comments.data ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">
          No comments yet.
        </Text>
      ) : null}
      {comments.data?.map((comment) => {
        const mine = comment.author.id === user.id;
        return (
          <Group key={comment.id} align="flex-start" wrap="nowrap" gap="sm">
            <UserAvatar user={comment.author} />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={6}>
                  <Text size="sm" fw={600}>
                    {comment.author.displayName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {fromNow(comment.createdAt)}
                    {comment.updatedAt !== comment.createdAt ? ' · edited' : ''}
                  </Text>
                </Group>
                {mine || canModerate ? (
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon size="sm" aria-label="Comment actions">
                        <ActionIcons.more size={14} stroke={ICON_STROKE} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {mine ? (
                        <Menu.Item
                          onClick={() => setEditing({ id: comment.id, body: comment.body })}
                        >
                          Edit
                        </Menu.Item>
                      ) : null}
                      <Menu.Item color="red" onClick={() => remove.mutate(comment.id)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                ) : null}
              </Group>
              {editing?.id === comment.id ? (
                <Stack gap="xs">
                  <Textarea
                    autosize
                    minRows={2}
                    value={editing.body}
                    onChange={(e) => setEditing({ id: comment.id, body: e.currentTarget.value })}
                    aria-label="Edit comment"
                  />
                  <Group gap="xs" justify="flex-end">
                    <Button size="xs" variant="default" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      loading={edit.isPending}
                      onClick={() => edit.mutate(editing, { onSuccess: () => setEditing(null) })}
                    >
                      Save
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Markdown>{comment.body}</Markdown>
              )}
            </Stack>
          </Group>
        );
      })}
      {canComment ? (
        <Stack gap="xs">
          {unresolved.length > 0 ? (
            <Alert color="orange" withCloseButton onClose={() => setUnresolved([])}>
              Not notified (no access to this ticket or unknown):{' '}
              {unresolved.map((u) => `@${u}`).join(', ')}
            </Alert>
          ) : null}
          <MentionTextarea
            value={body}
            onChange={setBody}
            people={(people.data ?? []).filter((person) => person.id !== user.id)}
            placeholder="Write a comment… Type @ to mention someone. Ctrl+Enter to send."
            onSubmit={submit}
          />
          <Group justify="flex-end">
            <Button onClick={submit} loading={add.isPending} disabled={!body.trim()}>
              Comment
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Stack>
  );
}
