import { and, eq, inArray, or } from 'drizzle-orm';
import { ROLES, ROLE_PERMISSIONS, type Permission, type ResourceScope } from '@helm/shared';
import type { Executor } from '../../db/client';
import { roleAssignments, users } from '../../db/schema';

/**
 * Active users holding `permission` at a scope — e.g. the client users who should hear that a
 * pitch was sent, or the Project Managers who should review one.
 */
export async function usersWithPermissionAt(
  db: Executor,
  scope: ResourceScope,
  permission: Permission,
): Promise<string[]> {
  const roles = ROLES.filter((role) => ROLE_PERMISSIONS[role].has(permission));
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        eq(users.isActive, true),
        inArray(roleAssignments.role, roles),
        or(
          eq(roleAssignments.scopeType, 'workspace'),
          scope.clientId ? eq(roleAssignments.clientId, scope.clientId) : undefined,
          scope.projectId ? eq(roleAssignments.projectId, scope.projectId) : undefined,
          scope.cycleId ? eq(roleAssignments.cycleId, scope.cycleId) : undefined,
        ),
      ),
    );
  return rows.map((row) => row.id);
}
