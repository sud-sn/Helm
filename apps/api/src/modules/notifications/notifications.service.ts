import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import type { Notification } from '@helm/shared';
import { notifications, users } from '../../db/schema';
import type { RequestContext } from '../../core/context';
import { notFound } from '../../core/errors';
import { iso, userSummary } from '../../core/dto';

export async function listNotifications(
  ctx: RequestContext,
  query: { limit: number; before?: string; unread?: boolean },
): Promise<Notification[]> {
  const rows = await ctx.db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actor: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(
      and(
        eq(notifications.userId, ctx.user.id),
        query.unread ? isNull(notifications.readAt) : undefined,
        query.before ? lt(notifications.createdAt, new Date(query.before)) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(query.limit);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actor: userSummary(row.actor),
    data: row.data,
    readAt: iso(row.readAt),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markRead(ctx: RequestContext, notificationId: string): Promise<void> {
  const updated = await ctx.db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, ctx.user.id)))
    .returning({ id: notifications.id });
  if (updated.length === 0) throw notFound('Notification');
}

export async function markAllRead(ctx: RequestContext): Promise<{ updated: number }> {
  const updated = await ctx.db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { updated: updated.length };
}
