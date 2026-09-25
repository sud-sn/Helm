import { Button, Card, Group, SegmentedControl, Stack } from '@mantine/core';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { ActionIcons, ICON_STROKE, NavIcons } from '@/icons';
import { useMarkAllRead, useNotifications, useUnreadCount } from '../api';
import { NotificationItem } from './NotificationItem';

export function NotificationList({ clientView }: { clientView: boolean }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const list = useNotifications({ unread: filter === 'unread', limit: 100 });
  const unread = useUnreadCount();
  const markAll = useMarkAllRead();

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about your work, collected since you last looked."
        actions={
          <Button
            variant="default"
            leftSection={<ActionIcons.markAllRead size={16} stroke={ICON_STROKE} />}
            onClick={() => markAll.mutate()}
            disabled={!unread.data}
            loading={markAll.isPending}
          >
            Mark all as read
          </Button>
        }
      />
      <Group mb="sm">
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as 'all' | 'unread')}
          data={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: `Unread${unread.data ? ` (${unread.data})` : ''}` },
          ]}
        />
      </Group>
      <Card p={6}>
        <QueryState query={list}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState
                icon={NavIcons.notifications}
                title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                description="You will hear about assignments, mentions, status changes and shared documents here."
              />
            ) : (
              <Stack gap={2}>
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    clientView={clientView}
                  />
                ))}
              </Stack>
            )
          }
        </QueryState>
      </Card>
    </>
  );
}
