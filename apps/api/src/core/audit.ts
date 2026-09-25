import type { Executor } from '../db/client';
import { auditLog } from '../db/schema';

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'user.created'
  | 'user.updated'
  | 'user.password_reset'
  | 'role.granted'
  | 'role.revoked'
  | 'client.created'
  | 'client.updated'
  | 'project.created'
  | 'project.updated'
  | 'cycle.deleted'
  | 'ticket.deleted'
  | 'tickets.imported'
  | 'page.deleted'
  | 'page.visibility_changed'
  | 'meeting.deleted'
  | 'meeting.visibility_changed'
  | 'meeting.action_items_suggested'
  | 'ai.settings_saved'
  | 'ai.settings_removed'
  | 'pitch.sent'
  | 'pitch.responded'
  | 'pitch.withdrawn';

export interface AuditEntryInput {
  actorId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  ip?: string | null;
}

export async function recordAudit(executor: Executor, entry: AuditEntryInput): Promise<void> {
  await executor.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    data: entry.data ?? {},
    ip: entry.ip ?? null,
  });
}
