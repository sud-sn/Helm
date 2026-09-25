import { NotificationList } from '@/features/notifications/components/NotificationList';

export function NotificationsRoute() {
  return <NotificationList clientView={false} />;
}

export function PortalNotificationsRoute() {
  return <NotificationList clientView />;
}
