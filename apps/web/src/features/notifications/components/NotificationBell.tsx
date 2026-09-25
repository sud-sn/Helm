import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { useMarkAllRead, useNotifications, useUnreadCount } from '../api';
import { NotificationItem } from './NotificationItem';

export function NotificationBell({
  clientView,
  allPath,
}: {
  clientView: boolean;
  allPath: string;
}) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const unread = useUnreadCount();
  const latest = useNotifications({ limit: 8 });
  const markAll = useMarkAllRead();
  const count = unread.data ?? 0;

  return (
    <Popover opened={opened} onChange={toggle} width={380} position="bottom-end" shadow="lg">
      <Popover.Target>
        <Tooltip label="Notifications">
          <Indicator
            label={count > 99 ? '99+' : count}
            size={18}
            disabled={count === 0}
            color="red"
            offset={4}
          >
            <ActionIcon
              variant="subtle"
              color="gray.0"
              size="lg"
              onClick={toggle}
              aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
            >
              <NavIcons.notifications size={20} stroke={ICON_STROKE} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="md" py="sm">
          <Text fw={600}>Notifications</Text>
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<ActionIcons.markAllRead size={14} stroke={ICON_STROKE} />}
            onClick={() => markAll.mutate()}
            disabled={count === 0}
          >
            Mark all read
          </Button>
        </Group>
        <Divider />
        <ScrollArea.Autosize mah={420}>
          <Stack gap={2} p={6}>
            {latest.data && latest.data.length > 0 ? (
              latest.data.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  clientView={clientView}
                  onNavigate={close}
                />
              ))
            ) : (
              <EmptyState icon={NavIcons.notifications} title="You're all caught up" />
            )}
          </Stack>
        </ScrollArea.Autosize>
        <Divider />
        <Button component={Link} to={allPath} variant="subtle" fullWidth radius={0} onClick={close}>
          View all notifications
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}
