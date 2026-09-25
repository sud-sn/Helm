import { Group, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import type { Notification } from '@helm/shared';
import { useNavigate } from 'react-router';
import { ICON_STROKE, NotificationIcons } from '@/icons';
import { fromNow } from '@/lib/format';
import { useMarkRead } from '../api';
import { describeNotification } from '../describe';
import classes from './NotificationItem.module.css';

export function NotificationItem({
  notification,
  clientView,
  onNavigate,
}: {
  notification: Notification;
  clientView: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const markRead = useMarkRead();
  const { text, detail, to } = describeNotification(notification, clientView);
  const Icon = NotificationIcons[notification.type];
  const unread = !notification.readAt;

  const open = () => {
    if (unread) markRead.mutate(notification.id);
    if (to) {
      onNavigate?.();
      void navigate(to);
    }
  };

  return (
    <UnstyledButton className={classes.item} data-unread={unread || undefined} onClick={open}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color={unread ? 'helm' : 'gray'} radius="xl" size={32}>
          <Icon size={17} stroke={ICON_STROKE} />
        </ThemeIcon>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={unread ? 600 : 400} lineClamp={2}>
            {text}
          </Text>
          {detail ? (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {detail}
            </Text>
          ) : null}
          <Text size="xs" c="dimmed">
            {fromNow(notification.createdAt)}
          </Text>
        </Stack>
        {unread ? <span className={classes.dot} aria-label="Unread" /> : null}
      </Group>
    </UnstyledButton>
  );
}
