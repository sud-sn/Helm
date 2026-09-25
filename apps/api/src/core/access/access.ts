import { eq } from 'drizzle-orm';
import {
  ROLE_PERMISSIONS,
  hasPermission,
  permissionsAt,
  type Grant,
  type Permission,
  type ResourceScope,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { roleAssignments } from '../../db/schema';
import type { AuthUser } from '../auth-user';
import { forbidden, notFound } from '../errors';

/** Ids of the scopes where the caller holds a given permission. */
export interface Coverage {
  /** A workspace grant: everything is covered. */
  all: boolean;
  clientIds: string[];
  projectIds: string[];
  cycleIds: string[];
}

/** The caller's grants plus the checks services use. Built once per request. */
export class Access {
  constructor(
    readonly user: AuthUser,
    readonly grants: readonly Grant[],
  ) {}

  get userId(): string {
    return this.user.id;
  }

  get isAdmin(): boolean {
    return this.user.isAdmin;
  }

  get isClientUser(): boolean {
    return this.user.userType === 'client';
  }

  can(permission: Permission, scope: ResourceScope): boolean {
    return hasPermission(this.grants, scope, permission);
  }

  permissionsAt(scope: ResourceScope): Set<Permission> {
    return permissionsAt(this.grants, scope);
  }

  /** For reads: answers 404 when the caller may not see the resource. */
  requireVisible(permission: Permission, scope: ResourceScope, what: string): void {
    if (!this.can(permission, scope)) throw notFound(what);
  }

  /** For actions on something the caller can already see: answers 403. */
  require(permission: Permission, scope: ResourceScope, message?: string): void {
    if (!this.can(permission, scope)) throw forbidden(message);
  }

  requireAdmin(): void {
    if (!this.isAdmin) throw forbidden('Only administrators can do this.');
  }

  requireStaff(): void {
    if (this.isClientUser) throw notFound('Page');
  }

  coverage(permission: Permission): Coverage {
    const coverage: Coverage = { all: false, clientIds: [], projectIds: [], cycleIds: [] };
    for (const grant of this.grants) {
      if (!ROLE_PERMISSIONS[grant.role].has(permission)) continue;
      switch (grant.scopeType) {
        case 'workspace':
          coverage.all = true;
          break;
        case 'client':
          if (grant.clientId) coverage.clientIds.push(grant.clientId);
          break;
        case 'project':
          if (grant.projectId) coverage.projectIds.push(grant.projectId);
          break;
        case 'cycle':
          if (grant.cycleId) coverage.cycleIds.push(grant.cycleId);
          break;
      }
    }
    return coverage;
  }
}

export async function loadGrants(db: Executor, userId: string): Promise<Grant[]> {
  return db
    .select({
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      clientId: roleAssignments.clientId,
      projectId: roleAssignments.projectId,
      cycleId: roleAssignments.cycleId,
    })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, userId));
}

export async function loadAccess(db: Executor, user: AuthUser): Promise<Access> {
  const grants = await loadGrants(db, user.id);
  // Defence in depth: grants are validated when created, but never let a client user
  // act through a staff role (or a staff user through the client role).
  const usable = grants.filter((grant) =>
    user.userType === 'client' ? grant.role === 'CLIENT' : grant.role !== 'CLIENT',
  );
  return new Access(user, usable);
}
