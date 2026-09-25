import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  canManageGrant,
  grantableRoles,
  isRoleAllowedForUserType,
  type GrantRoleInput,
  type Role,
  type RoleAssignment,
  type ScopeType,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, cycles, projects, roleAssignments, users } from '../../db/schema';
import { SCOPE_SEPARATOR, resolveScope, type ResolvedScope } from '../../core/access/scopes';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { notify } from '../notifications/notify';

const grantee = alias(users, 'grantee');
const granter = alias(users, 'granter');
const projectClient = alias(clients, 'project_client');
const cycleProject = alias(projects, 'cycle_project');
const cycleClient = alias(clients, 'cycle_client');

function selectAssignments(db: Executor) {
  return db
    .select({
      id: roleAssignments.id,
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      clientId: roleAssignments.clientId,
      projectId: roleAssignments.projectId,
      cycleId: roleAssignments.cycleId,
      createdAt: roleAssignments.createdAt,
      userId: grantee.id,
      username: grantee.username,
      displayName: grantee.displayName,
      userType: grantee.userType,
      granterId: granter.id,
      granterUsername: granter.username,
      granterDisplayName: granter.displayName,
      clientName: clients.name,
      projectKey: projects.key,
      projectClientName: projectClient.name,
      cycleName: cycles.name,
      cycleProjectKey: cycleProject.key,
      cycleClientName: cycleClient.name,
    })
    .from(roleAssignments)
    .innerJoin(grantee, eq(grantee.id, roleAssignments.userId))
    .leftJoin(granter, eq(granter.id, roleAssignments.grantedById))
    .leftJoin(clients, eq(clients.id, roleAssignments.clientId))
    .leftJoin(projects, eq(projects.id, roleAssignments.projectId))
    .leftJoin(projectClient, eq(projectClient.id, projects.clientId))
    .leftJoin(cycles, eq(cycles.id, roleAssignments.cycleId))
    .leftJoin(cycleProject, eq(cycleProject.id, cycles.projectId))
    .leftJoin(cycleClient, eq(cycleClient.id, cycleProject.clientId));
}

type AssignmentRow = Awaited<ReturnType<ReturnType<typeof selectAssignments>['execute']>>[number];

function toRoleAssignment(row: AssignmentRow): RoleAssignment {
  const label = (() => {
    switch (row.scopeType) {
      case 'workspace':
        return 'Workspace';
      case 'client':
        return row.clientName ?? '';
      case 'project':
        return [row.projectClientName, row.projectKey].join(SCOPE_SEPARATOR);
      case 'cycle':
        return [row.cycleClientName, row.cycleProjectKey, row.cycleName].join(SCOPE_SEPARATOR);
    }
  })();
  return {
    id: row.id,
    user: {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      userType: row.userType,
    },
    role: row.role,
    scopeType: row.scopeType,
    clientId: row.clientId,
    projectId: row.projectId,
    cycleId: row.cycleId,
    scopeLabel: label,
    grantedBy:
      row.granterId && row.granterUsername && row.granterDisplayName
        ? { id: row.granterId, username: row.granterUsername, displayName: row.granterDisplayName }
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireScope(
  ctx: RequestContext,
  scopeType: ScopeType,
  scopeId: string | null | undefined,
): Promise<ResolvedScope> {
  const resolved = await resolveScope(ctx.db, scopeType, scopeId);
  const visible = resolved && (ctx.access.isAdmin || ctx.access.can('member.read', resolved.scope));
  if (!resolved || !visible) throw notFound('Scope');
  return resolved;
}

/**
 * Everyone with access to a scope: grants on the scope itself, inherited grants from its
 * ancestors, and — for clients and projects — grants on the scopes inside it.
 */
export async function listScopeMembers(
  ctx: RequestContext,
  scopeType: ScopeType,
  scopeId: string | undefined,
): Promise<RoleAssignment[]> {
  const { scope } = await requireScope(ctx, scopeType, scopeId);
  const conditions: SQL[] = [eq(roleAssignments.scopeType, 'workspace')];
  if (scope.clientId) conditions.push(eq(roleAssignments.clientId, scope.clientId));
  if (scopeType === 'client' && scope.clientId) {
    conditions.push(
      eq(projects.clientId, scope.clientId),
      eq(cycleProject.clientId, scope.clientId),
    );
  }
  if (scope.projectId) conditions.push(eq(roleAssignments.projectId, scope.projectId));
  if (scopeType === 'project' && scope.projectId)
    conditions.push(eq(cycles.projectId, scope.projectId));
  if (scope.cycleId) conditions.push(eq(roleAssignments.cycleId, scope.cycleId));

  const rows = await selectAssignments(ctx.db)
    .where(and(eq(grantee.isActive, true), or(...conditions)))
    .orderBy(grantee.displayName);
  return rows.map(toRoleAssignment);
}

export async function listUserAssignments(
  ctx: RequestContext,
  userId: string,
): Promise<RoleAssignment[]> {
  if (!ctx.access.isAdmin && ctx.user.id !== userId) throw notFound('User');
  const rows = await selectAssignments(ctx.db)
    .where(eq(roleAssignments.userId, userId))
    .orderBy(roleAssignments.createdAt);
  return rows.map(toRoleAssignment);
}

export async function grantRole(
  ctx: RequestContext,
  input: GrantRoleInput,
): Promise<RoleAssignment> {
  const { db, access } = ctx;
  const target = await resolveScope(db, input.scopeType, input.scopeId);
  if (!target || !(access.isAdmin || access.can('member.read', target.scope)))
    throw notFound('Scope');

  const [user] = await db
    .select({
      id: users.id,
      isActive: users.isActive,
      userType: users.userType,
      clientId: users.clientId,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user) throw notFound('User');
  if (!user.isActive) throw badRequest('This user is deactivated.');
  if (!isRoleAllowedForUserType(input.role, user.userType)) {
    throw badRequest(
      user.userType === 'client'
        ? 'Client users can only be given the Client role.'
        : 'Staff members cannot be given the Client role.',
    );
  }
  if (user.userType === 'client' && target.clientId !== user.clientId) {
    throw badRequest('Client users can only be given access within their own company.');
  }
  const allowed = canManageGrant({
    actorId: access.userId,
    actorIsAdmin: access.isAdmin,
    actorGrants: access.grants,
    targetUserId: input.userId,
    target: { role: input.role, scopeType: input.scopeType, scope: target.scope },
  });
  if (!allowed) throw forbidden(`You cannot grant the ${ROLE_LABELS[input.role]} role here.`);

  const id = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, input.userId),
          eq(roleAssignments.role, input.role),
          eq(roleAssignments.scopeType, input.scopeType),
          sql`coalesce(${roleAssignments.clientId}, ${roleAssignments.projectId}, ${roleAssignments.cycleId}) is not distinct from ${input.scopeId}::uuid`,
        ),
      )
      .limit(1);
    if (existing) throw conflict('This person already has that role here.', 'ALREADY_GRANTED');

    const [created] = await tx
      .insert(roleAssignments)
      .values({
        userId: input.userId,
        role: input.role,
        scopeType: input.scopeType,
        clientId: input.scopeType === 'client' ? input.scopeId : null,
        projectId: input.scopeType === 'project' ? input.scopeId : null,
        cycleId: input.scopeType === 'cycle' ? input.scopeId : null,
        grantedById: access.userId,
      })
      .returning({ id: roleAssignments.id });
    if (!created) throw new Error('Insert failed');

    await notify(tx, {
      recipients: [input.userId],
      type: 'role_granted',
      actorId: access.userId,
      data: { role: input.role, scopeLabel: target.label },
    });
    await recordAudit(tx, {
      actorId: access.userId,
      action: 'role.granted',
      entityType: 'role_assignment',
      entityId: created.id,
      data: { userId: input.userId, role: input.role, scope: target.label },
      ip: ctx.ip,
    });
    return created.id;
  });

  const [row] = await selectAssignments(db).where(eq(roleAssignments.id, id));
  return toRoleAssignment(row!);
}

/**
 * Whether a grant appears in a member list the caller can read. Member lists show grants from the
 * scope's ancestors, so a Team Lead on a project also sees the client's Project Manager.
 */
async function isGrantVisible(ctx: RequestContext, target: ResolvedScope): Promise<boolean> {
  const { access, db } = ctx;
  if (access.isAdmin || access.can('member.read', target.scope)) return true;
  if (target.scopeType === 'workspace') {
    return access.grants.some((grant) => ROLE_PERMISSIONS[grant.role].has('member.read'));
  }
  if (!target.clientId) return false;
  const coverage = access.coverage('member.read');
  if (coverage.clientIds.includes(target.clientId)) return true;
  if (coverage.projectIds.length > 0) {
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(inArray(projects.id, coverage.projectIds), eq(projects.clientId, target.clientId)))
      .limit(1);
    if (row) return true;
  }
  if (coverage.cycleIds.length > 0) {
    const [row] = await db
      .select({ id: cycles.id })
      .from(cycles)
      .innerJoin(projects, eq(projects.id, cycles.projectId))
      .where(and(inArray(cycles.id, coverage.cycleIds), eq(projects.clientId, target.clientId)))
      .limit(1);
    if (row) return true;
  }
  return false;
}

export async function revokeRole(ctx: RequestContext, assignmentId: string): Promise<void> {
  const { db, access } = ctx;
  const [assignment] = await db
    .select()
    .from(roleAssignments)
    .where(eq(roleAssignments.id, assignmentId))
    .limit(1);
  if (!assignment) throw notFound('Role assignment');
  const target = await resolveScope(
    db,
    assignment.scopeType,
    assignment.clientId ?? assignment.projectId ?? assignment.cycleId,
  );
  if (!target || !(await isGrantVisible(ctx, target))) throw notFound('Role assignment');
  const allowed = canManageGrant({
    actorId: access.userId,
    actorIsAdmin: access.isAdmin,
    actorGrants: access.grants,
    targetUserId: assignment.userId,
    target: { role: assignment.role, scopeType: assignment.scopeType, scope: target.scope },
  });
  if (!allowed) throw forbidden(`You cannot remove the ${ROLE_LABELS[assignment.role]} role here.`);

  await db.transaction(async (tx) => {
    await tx.delete(roleAssignments).where(eq(roleAssignments.id, assignmentId));
    await recordAudit(tx, {
      actorId: access.userId,
      action: 'role.revoked',
      entityType: 'role_assignment',
      entityId: assignmentId,
      data: { userId: assignment.userId, role: assignment.role, scope: target.label },
      ip: ctx.ip,
    });
  });
}

export async function listGrantableRoles(
  ctx: RequestContext,
  scopeType: ScopeType,
  scopeId: string | undefined,
): Promise<Role[]> {
  const { scope } = await requireScope(ctx, scopeType, scopeId);
  return grantableRoles({
    actorIsAdmin: ctx.access.isAdmin,
    actorGrants: ctx.access.grants,
    scopeType,
    scope,
  });
}
