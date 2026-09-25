import { Alert, Button, Card, Group, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import type { Pitch } from '@helm/shared';
import { VisibilityTag } from '@/components/domain-tags';
import { Tag } from '@/components/Tag';
import { UserAvatar } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { fromNow } from '@/lib/format';
import { useAddPitchComment, usePitchComments } from '../api';

/**
 * Discussion on a pitch. Staff choose whether a comment is visible to the client (only once the
 * pitch has been sent); everything a client writes is visible to both sides.
 */
export function PitchComments({ pitch, canComment }: { pitch: Pitch; canComment: boolean }) {
  const user = useCurrentUser();
  const clientView = user.userType === 'client';
  const comments = usePitchComments(pitch.id);
  const add = useAddPitchComment(pitch.id);
  const [body, setBody] = useState('');
  const [shareWithClient, setShareWithClient] = useState(false);
  const sent = Boolean(pitch.sentAt);

  const submit = () => {
    if (!body.trim()) return;
    add.mutate(
      { body, visibility: clientView || (sent && shareWithClient) ? 'client' : 'internal' },
      { onSuccess: () => setBody('') },
    );
  };

  return (
    <Card>
      <Text fw={600} mb="sm">
        Discussion
      </Text>
      <Stack gap="md">
        {(comments.data ?? []).length === 0 ? (
          <Text size="sm" c="dimmed">
            {clientView ? 'Ask the team a question about this proposal.' : 'No comments yet.'}
          </Text>
        ) : (
          comments.data?.map((comment) => (
            <Group key={comment.id} align="flex-start" wrap="nowrap" gap="sm">
              <UserAvatar user={comment.author} />
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6}>
                  <Text size="sm" fw={600}>
                    {comment.author.displayName}
                  </Text>
                  {comment.author.userType === 'client' ? <Tag tone="client">Client</Tag> : null}
                  {!clientView ? <VisibilityTag visibility={comment.visibility} /> : null}
                  <Text size="xs" c="dimmed">
                    {fromNow(comment.createdAt)}
                  </Text>
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {comment.body}
                </Text>
              </Stack>
            </Group>
          ))
        )}
        {canComment ? (
          <Stack gap="xs">
            {add.error ? <Alert color="red">{add.error.message}</Alert> : null}
            <Textarea
              placeholder={clientView ? 'Write to the team…' : 'Add a comment…'}
              autosize
              minRows={2}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
              aria-label="Comment"
            />
            <Group justify="space-between">
              {!clientView ? (
                <Switch
                  label={sent ? 'Visible to the client' : 'Internal until the pitch is sent'}
                  checked={sent && shareWithClient}
                  disabled={!sent}
                  onChange={(e) => setShareWithClient(e.currentTarget.checked)}
                />
              ) : (
                <span />
              )}
              <Button onClick={submit} loading={add.isPending} disabled={!body.trim()}>
                Comment
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
