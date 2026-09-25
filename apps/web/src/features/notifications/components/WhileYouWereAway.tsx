import { Button, Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AWAY_FLAG } from '@/features/auth/api';
import { pluralize } from '@/lib/format';
import { useMarkAllRead, useNotifications, useUnreadCount } from '../api';
import { summariseUnread } from '../summary';
import { NotificationItem } from './NotificationItem';

/**
 * Shown once right after signing in when there are unread notifications — Helm notifies people
 * when they log in rather than pushing updates live.
 */
export function WhileYouWereAway({
  clientView,
  allPath,
}: {
  clientView: boolean;
  allPath: string;
}) {
  const [opened, setOpened] = useState(() => {
    const flagged = sessionStorage.getItem(AWAY_FLAG) === '1';
    if (flagged) sessionStorage.removeItem(AWAY_FLAG);
    return flagged;
  });
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const list = useNotifications({ unread: true, limit: 30 });
  const items = summariseUnread(list.data ?? []);
  const markAll = useMarkAllRead();
  const count = unread.data ?? 0;
  const close = () => setOpened(false);

  return (
    <Modal
      opened={opened && items.length > 0}
      onClose={close}
      title={
        <Stack gap={0}>
          <Text fw={700} size="lg">
            While you were away
          </Text>
          <Text size="sm" c="dimmed">
            {pluralize(count, 'unread notification')}
          </Text>
        </Stack>
      }
      size="lg"
    >
      <ScrollArea.Autosize mah={440}>
        <Stack gap={2}>
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              clientView={clientView}
              onNavigate={close}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
      <Group justify="space-between" mt="md">
        <Button
          variant="default"
          onClick={() => {
            close();
            void navigate(allPath);
          }}
        >
          See all
        </Button>
        <Group gap="xs">
          <Button variant="subtle" onClick={() => markAll.mutate(undefined, { onSuccess: close })}>
            Mark all as read
          </Button>
          <Button onClick={close}>Continue</Button>
        </Group>
      </Group>
    </Modal>
  );
}
