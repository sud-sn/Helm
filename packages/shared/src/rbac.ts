/**
 * Hierarchical, scoped RBAC. See docs/architecture/rbac.md for the full matrix.
 *
 * A user holds any number of role grants, each bound to a scope:
 *   workspace (the whole agency) > client > project > cycle.
 *
 * Two inheritance rules:
 *   - Capabilities flow up: senior roles include the permissions of the roles below them.
 *   - Access flows down: a grant on a client covers that client's projects, cycles and tickets.
 *
 * Users are either staff (agency employees) or client users (people at a client company).
 * Client users can only hold the CLIENT role, and only inside their own company.
 *
 * The API is authoritative; the web app uses the same functions only to decide what to show.
 */

export const USER_TYPES = ['staff', 'client'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const ROLES = [
  'DELIVERY_MANAGER',
  'PROJECT_MANAGER',
  'TEAM_LEAD',
  'BUSINESS_ANALYST',
  'DEVELOPER',
  'VIEWER',
  'CLIENT',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  DELIVERY_MANAGER: 'Delivery Manager',
  PROJECT_MANAGER: 'Project Manager',
  TEAM_LEAD: 'Team Lead',
  BUSINESS_ANALYST: 'Business Analyst',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
  CLIENT: 'Client',
};

/** Seniority, used to pick the role shown for a user at a scope. */
export const ROLE_RANK: Record<Role, number> = {
  CLIENT: 0,
  VIEWER: 0,
  DEVELOPER: 1,
  BUSINESS_ANALYST: 1,
  TEAM_LEAD: 2,
  PROJECT_MANAGER: 3,
  DELIVERY_MANAGER: 4,
};

export const STAFF_ROLES: readonly Role[] = ROLES.filter((role) => role !== 'CLIENT');

export function isRoleAllowedForUserType(role: Role, userType: UserType): boolean {
  return userType === 'client' ? role === 'CLIENT' : role !== 'CLIENT';
}

export const SCOPE_TYPES = ['workspace', 'client', 'project', 'cycle'] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  workspace: 'Workspace',
  client: 'Client',
  project: 'Project',
  cycle: 'Cycle',
};

/** Where each role may be granted. */
export const ROLE_ALLOWED_SCOPES: Record<Role, readonly ScopeType[]> = {
  DELIVERY_MANAGER: ['workspace'],
  PROJECT_MANAGER: ['client', 'project'],
  TEAM_LEAD: ['client', 'project', 'cycle'],
  BUSINESS_ANALYST: ['client', 'project'],
  DEVELOPER: ['client', 'project', 'cycle'],
  VIEWER: ['workspace', 'client', 'project', 'cycle'],
  CLIENT: ['client', 'project'],
};

export function isRoleAllowedAtScope(role: Role, scopeType: ScopeType): boolean {
  return ROLE_ALLOWED_SCOPES[role].includes(scopeType);
}

/** Which roles each role may hand out (inside the scopes it covers). Admins may grant any role. */
export const ROLE_GRANTABLE_ROLES: Record<Role, readonly Role[]> = {
  DELIVERY_MANAGER: [
    'PROJECT_MANAGER',
    'TEAM_LEAD',
    'BUSINESS_ANALYST',
    'DEVELOPER',
    'VIEWER',
    'CLIENT',
  ],
  PROJECT_MANAGER: ['TEAM_LEAD', 'BUSINESS_ANALYST', 'DEVELOPER', 'VIEWER', 'CLIENT'],
  TEAM_LEAD: ['BUSINESS_ANALYST', 'DEVELOPER', 'VIEWER'],
  BUSINESS_ANALYST: [],
  DEVELOPER: [],
  VIEWER: [],
  CLIENT: [],
};

export const PERMISSIONS = [
  'client.read',
  'client.create',
  'client.update',
  'project.read',
  'project.create',
  'project.update',
  'cycle.read',
  'cycle.create',
  'cycle.update',
  'cycle.delete',
  'ticket.read',
  'ticket.create',
  'ticket.update',
  /** Change the status of tickets assigned to you. */
  'ticket.update_own',
  'ticket.delete',
  'comment.create',
  'comment.moderate',
  'page.read',
  'page.write',
  'page.delete',
  'meeting.read',
  'meeting.write',
  'meeting.delete',
  /** Make a page or meeting minutes visible to the client. */
  'content.share',
  'pitch.read',
  /** Draft pitches, edit them and submit them for internal review. */
  'pitch.write',
  /** Approve a pitch and send it to the client, withdraw it, or record the client's decision. */
  'pitch.approve',
  /** Client side: accept, reject or request changes on a pitch sent to you. */
  'pitch.respond',
  /** Client side: comment on pitches sent to you. */
  'pitch.comment',
  /** Client side: read pages, minutes and pitches shared with the client. */
  'shared.read',
  /** Aggregated delivery progress (ticket counts per status), without ticket details. */
  'progress.read',
  'member.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER_PERMISSIONS: readonly Permission[] = [
  'client.read',
  'project.read',
  'cycle.read',
  'ticket.read',
  'page.read',
  'meeting.read',
  'pitch.read',
  'progress.read',
  'member.read',
];

const DEVELOPER_PERMISSIONS: readonly Permission[] = [
  ...VIEWER_PERMISSIONS,
  'comment.create',
  'ticket.update_own',
  'page.write',
  'meeting.write',
];

const BUSINESS_ANALYST_PERMISSIONS: readonly Permission[] = [
  ...DEVELOPER_PERMISSIONS,
  'content.share',
  'pitch.write',
];

const TEAM_LEAD_PERMISSIONS: readonly Permission[] = [
  ...BUSINESS_ANALYST_PERMISSIONS,
  'ticket.create',
  'ticket.update',
  'ticket.delete',
  'cycle.update',
  'comment.moderate',
  'page.delete',
  'meeting.delete',
];

const PROJECT_MANAGER_PERMISSIONS: readonly Permission[] = [
  ...TEAM_LEAD_PERMISSIONS,
  'client.update',
  'project.create',
  'project.update',
  'cycle.create',
  'cycle.delete',
  'pitch.approve',
];

const DELIVERY_MANAGER_PERMISSIONS: readonly Permission[] = [
  ...PROJECT_MANAGER_PERMISSIONS,
  'client.create',
];

const CLIENT_PERMISSIONS: readonly Permission[] = [
  'client.read',
  'project.read',
  'progress.read',
  'shared.read',
  'pitch.respond',
  'pitch.comment',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  VIEWER: new Set(VIEWER_PERMISSIONS),
  DEVELOPER: new Set(DEVELOPER_PERMISSIONS),
  BUSINESS_ANALYST: new Set(BUSINESS_ANALYST_PERMISSIONS),
  TEAM_LEAD: new Set(TEAM_LEAD_PERMISSIONS),
  PROJECT_MANAGER: new Set(PROJECT_MANAGER_PERMISSIONS),
  DELIVERY_MANAGER: new Set(DELIVERY_MANAGER_PERMISSIONS),
  CLIENT: new Set(CLIENT_PERMISSIONS),
};

/** A role bound to a scope. Exactly one of the ids is set, except for workspace grants (none). */
export interface Grant {
  role: Role;
  scopeType: ScopeType;
  clientId: string | null;
  projectId: string | null;
  cycleId: string | null;
}

/**
 * The position of a resource in the hierarchy. Pass every ancestor you know:
 * a ticket in a cycle is { clientId, projectId, cycleId }; a backlog ticket has cycleId null;
 * a workspace-level action (creating a client) is {}.
 */
export interface ResourceScope {
  clientId?: string | null;
  projectId?: string | null;
  cycleId?: string | null;
}

export function grantCovers(grant: Grant, scope: ResourceScope): boolean {
  switch (grant.scopeType) {
    case 'workspace':
      return true;
    case 'client':
      return scope.clientId != null && grant.clientId === scope.clientId;
    case 'project':
      return scope.projectId != null && grant.projectId === scope.projectId;
    case 'cycle':
      return scope.cycleId != null && grant.cycleId === scope.cycleId;
  }
}

export function rolesAt(grants: readonly Grant[], scope: ResourceScope): Role[] {
  const roles = new Set<Role>();
  for (const grant of grants) {
    if (grantCovers(grant, scope)) roles.add(grant.role);
  }
  return ROLES.filter((role) => roles.has(role));
}

export function permissionsAt(grants: readonly Grant[], scope: ResourceScope): Set<Permission> {
  const permissions = new Set<Permission>();
  for (const role of rolesAt(grants, scope)) {
    for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
  }
  return permissions;
}

export function hasPermission(
  grants: readonly Grant[],
  scope: ResourceScope,
  permission: Permission,
): boolean {
  return grants.some(
    (grant) => grantCovers(grant, scope) && ROLE_PERMISSIONS[grant.role].has(permission),
  );
}

/** The most senior role that applies at a scope, or null when the scope is not covered. */
export function highestRoleAt(grants: readonly Grant[], scope: ResourceScope): Role | null {
  let best: Role | null = null;
  for (const role of rolesAt(grants, scope)) {
    if (best === null || ROLE_RANK[role] > ROLE_RANK[best]) best = role;
  }
  return best;
}

export interface GrantTarget {
  role: Role;
  scopeType: ScopeType;
  /** Full ancestry of the target scope, e.g. a cycle target includes its projectId and clientId. */
  scope: ResourceScope;
}

/**
 * Whether an actor may grant (or revoke) `target.role` at the target scope.
 * Admins may grant any role that fits the scope. Everyone else needs a grant covering the target
 * scope whose role is allowed to hand out the target role, and may not change their own access.
 * User-type rules (client users only get CLIENT inside their company) are checked separately.
 */
export function canManageGrant(params: {
  actorId: string;
  actorIsAdmin: boolean;
  actorGrants: readonly Grant[];
  targetUserId: string;
  target: GrantTarget;
}): boolean {
  const { actorId, actorIsAdmin, actorGrants, targetUserId, target } = params;
  if (!isRoleAllowedAtScope(target.role, target.scopeType)) return false;
  if (actorIsAdmin) return true;
  if (actorId === targetUserId) return false;
  return actorGrants.some(
    (grant) =>
      grantCovers(grant, target.scope) && ROLE_GRANTABLE_ROLES[grant.role].includes(target.role),
  );
}

/** Roles an actor could grant at a scope; used to populate the "add member" form. */
export function grantableRoles(params: {
  actorIsAdmin: boolean;
  actorGrants: readonly Grant[];
  scopeType: ScopeType;
  scope: ResourceScope;
}): Role[] {
  const { actorIsAdmin, actorGrants, scopeType, scope } = params;
  return ROLES.filter((role) => {
    if (!isRoleAllowedAtScope(role, scopeType)) return false;
    if (actorIsAdmin) return true;
    return actorGrants.some(
      (grant) => grantCovers(grant, scope) && ROLE_GRANTABLE_ROLES[grant.role].includes(role),
    );
  });
}
