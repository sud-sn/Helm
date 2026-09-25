import { notifications } from '@mantine/notifications';
import { ApiError } from './api-client';

export function showSuccess(message: string, title?: string) {
  notifications.show({ message, title, color: 'green', autoClose: 3500 });
}

/** Neutral news: nothing went wrong, but nothing changed either. */
export function showInfo(message: string, title?: string) {
  notifications.show({ message, title, color: 'gray', autoClose: 5000 });
}

export function showError(error: unknown, title = 'Something went wrong') {
  const message =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : 'Please try again in a moment.';
  notifications.show({ message, title, color: 'red', autoClose: 6000 });
}
