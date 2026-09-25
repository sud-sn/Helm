import { and, desc, eq, lt } from 'drizzle-orm';
import type { AuditEntry } from '@helm/shared';
import { auditLog, users } from '../../db/schema';
import type { RequestContext } from '../../core/context';
import { userSummary } from '../../core/dto';

export async function listAuditEntries(
  ctx: RequestContext,
  query: { limit: number; before?: string; action?: string; actorId?: string },
): Promise<AuditEntry[]> {
  ctx.access.requireAdmin();
  const rows = await ctx.db
    .select({
      entry: auditLog,
      actor: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(
      and(
        query.action ? eq(auditLog.action, query.action) : undefined,
        query.actorId ? eq(auditLog.actorId, query.actorId) : undefined,
        query.before ? lt(auditLog.createdAt, new Date(query.before)) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(query.limit);
  return rows.map(({ entry, actor }) => ({
    id: entry.id,
    actor: userSummary(actor),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    data: entry.data,
    ip: entry.ip,
    createdAt: entry.createdAt.toISOString(),
  }));
}
