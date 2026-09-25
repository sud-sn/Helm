import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@helm/shared';
import { api, query } from '@/lib/api-client';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unread: boolean, limit: number) => ['notifications', 'list', { unread, limit }] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

/** Unread badge. Refreshed when the tab regains focus; notifications are not pushed live. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => api<{ count: number }>('/notifications/unread-count'),
    select: (data) => data.count,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications({ unread = false, limit = 50 } = {}) {
  return useQuery({
    queryKey: notificationKeys.list(unread, limit),
    queryFn: () =>
      api<Notification[]>(`/notifications${query({ unread: unread || undefined, limit })}`),
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
