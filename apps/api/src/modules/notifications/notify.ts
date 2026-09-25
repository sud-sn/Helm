import type { NotificationData, NotificationType } from '@helm/shared';
import type { Executor } from '../../db/client';
import { notifications } from '../../db/schema';

/**
 * Stores a notification for each recipient (minus the actor), inside the caller's transaction so
 * notifications exist exactly when the change that caused them does.
 */
export async function notify(
  executor: Executor,
  params: {
    recipients: Iterable<string>;
    type: NotificationType;
    actorId: string | null;
    data: NotificationData;
  },
): Promise<void> {
  const recipients = [...new Set(params.recipients)].filter((id) => id !== params.actorId);
  if (recipients.length === 0) return;
  await executor.insert(notifications).values(
    recipients.map((userId) => ({
      userId,
      type: params.type,
      actorId: params.actorId,
      data: params.data,
    })),
  );
}
