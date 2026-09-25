import { describe, expect, it } from 'vitest';
import {
  canManageGrant,
  grantableRoles,
  hasPermission,
  highestRoleAt,
  isRoleAllowedForUserType,
  permissionsAt,
  type Grant,
} from './rbac';

const CLIENT = 'c1';
const PROJECT = 'p1';
const CYCLE = 'y1';
const OTHER_PROJECT = 'p2';

const grant = (
  role: Grant['role'],
  scopeType: Grant['scopeType'],
  id: string | null = null,
): Grant => ({
  role,
  scopeType,
  clientId: scopeType === 'client' ? id : null,
  projectId: scopeType === 'project' ? id : null,
  cycleId: scopeType === 'cycle' ? id : null,
});

const ticketInCycle = { clientId: CLIENT, projectId: PROJECT, cycleId: CYCLE };
const backlogTicket = { clientId: CLIENT, projectId: PROJECT, cycleId: null };

describe('scope inheritance', () => {
  it('lets a client grant cover every project and cycle of that client', () => {
    const grants = [grant('PROJECT_MANAGER', 'client', CLIENT)];
    expect(hasPermission(grants, ticketInCycle, 'ticket.update')).toBe(true);
    expect(hasPermission(grants, backlogTicket, 'ticket.update')).toBe(true);
    expect(hasPermission(grants, { clientId: 'other' }, 'client.read')).toBe(false);
  });

  it('keeps a cycle grant out of the project backlog and other cycles', () => {
    const grants = [grant('DEVELOPER', 'cycle', CYCLE)];
    expect(hasPermission(grants, ticketInCycle, 'ticket.read')).toBe(true);
    expect(hasPermission(grants, backlogTicket, 'ticket.read')).toBe(false);
    expect(hasPermission(grants, { ...ticketInCycle, cycleId: 'y2' }, 'ticket.read')).toBe(false);
  });

  it('gives a workspace grant access everywhere', () => {
    const grants = [grant('DELIVERY_MANAGER', 'workspace')];
    expect(hasPermission(grants, {}, 'client.create')).toBe(true);
    expect(hasPermission(grants, ticketInCycle, 'ticket.delete')).toBe(true);
  });
});

describe('role capabilities', () => {
  it('lets developers update their own tickets but not edit or create tickets', () => {
    const perms = permissionsAt([grant('DEVELOPER', 'project', PROJECT)], backlogTicket);
    expect(perms.has('ticket.update_own')).toBe(true);
    expect(perms.has('comment.create')).toBe(true);
    expect(perms.has('ticket.update')).toBe(false);
    expect(perms.has('ticket.create')).toBe(false);
  });

  it('makes viewers read-only', () => {
    const perms = permissionsAt([grant('VIEWER', 'project', PROJECT)], backlogTicket);
    expect([...perms].every((p) => p.endsWith('.read'))).toBe(true);
  });

  it('includes lower-ranked capabilities in higher roles', () => {
    const lead = permissionsAt([grant('TEAM_LEAD', 'project', PROJECT)], backlogTicket);
    const dev = permissionsAt([grant('DEVELOPER', 'project', PROJECT)], backlogTicket);
    for (const p of dev) expect(lead.has(p)).toBe(true);
  });

  it('reports the highest role at a scope', () => {
    const grants = [grant('VIEWER', 'client', CLIENT), grant('TEAM_LEAD', 'project', PROJECT)];
    expect(highestRoleAt(grants, backlogTicket)).toBe('TEAM_LEAD');
    expect(highestRoleAt(grants, { clientId: CLIENT, projectId: OTHER_PROJECT })).toBe('VIEWER');
    expect(highestRoleAt(grants, { clientId: 'x' })).toBeNull();
  });
});

describe('client users', () => {
  const clientGrants = [grant('CLIENT', 'client', CLIENT)];

  it('see progress and shared content but no internal work items', () => {
    const perms = permissionsAt(clientGrants, backlogTicket);
    expect(perms.has('progress.read')).toBe(true);
    expect(perms.has('shared.read')).toBe(true);
    expect(perms.has('pitch.respond')).toBe(true);
    for (const internal of [
      'ticket.read',
      'page.read',
      'meeting.read',
      'pitch.read',
      'member.read',
    ] as const) {
      expect(perms.has(internal)).toBe(false);
    }
  });

  it('only ever hold the CLIENT role, and staff never do', () => {
    expect(isRoleAllowedForUserType('CLIENT', 'client')).toBe(true);
    expect(isRoleAllowedForUserType('DEVELOPER', 'client')).toBe(false);
    expect(isRoleAllowedForUserType('CLIENT', 'staff')).toBe(false);
  });
});

describe('granting roles', () => {
  const base = { actorId: 'me', actorIsAdmin: false, targetUserId: 'someone' };

  it('allows granting only roles ranked below your own, inside your scope', () => {
    const actorGrants = [grant('PROJECT_MANAGER', 'project', PROJECT)];
    const projectScope = { clientId: CLIENT, projectId: PROJECT };
    expect(
      canManageGrant({
        ...base,
        actorGrants,
        target: { role: 'TEAM_LEAD', scopeType: 'project', scope: projectScope },
      }),
    ).toBe(true);
    expect(
      canManageGrant({
        ...base,
        actorGrants,
        target: { role: 'PROJECT_MANAGER', scopeType: 'project', scope: projectScope },
      }),
    ).toBe(false);
    expect(
      canManageGrant({
        ...base,
        actorGrants,
        target: {
          role: 'DEVELOPER',
          scopeType: 'project',
          scope: { clientId: CLIENT, projectId: OTHER_PROJECT },
        },
      }),
    ).toBe(false);
  });

  it('forbids changing your own grants unless you are an admin', () => {
    const actorGrants = [grant('DELIVERY_MANAGER', 'workspace')];
    const target = {
      role: 'DEVELOPER' as const,
      scopeType: 'project' as const,
      scope: backlogTicket,
    };
    expect(canManageGrant({ ...base, targetUserId: 'me', actorGrants, target })).toBe(false);
    expect(
      canManageGrant({ ...base, targetUserId: 'me', actorIsAdmin: true, actorGrants: [], target }),
    ).toBe(true);
  });

  it('rejects roles at scopes they do not belong to, even for admins', () => {
    expect(
      canManageGrant({
        ...base,
        actorIsAdmin: true,
        actorGrants: [],
        target: { role: 'DELIVERY_MANAGER', scopeType: 'project', scope: backlogTicket },
      }),
    ).toBe(false);
  });

  it('lets project managers invite client users but not developers or team leads', () => {
    const projectScope = { clientId: CLIENT, projectId: PROJECT };
    const target = { role: 'CLIENT' as const, scopeType: 'project' as const, scope: projectScope };
    expect(
      canManageGrant({
        ...base,
        actorGrants: [grant('PROJECT_MANAGER', 'client', CLIENT)],
        target,
      }),
    ).toBe(true);
    expect(
      canManageGrant({ ...base, actorGrants: [grant('TEAM_LEAD', 'project', PROJECT)], target }),
    ).toBe(false);
    expect(
      canManageGrant({ ...base, actorGrants: [grant('DEVELOPER', 'project', PROJECT)], target }),
    ).toBe(false);
  });

  it('lists grantable roles for a scope', () => {
    const roles = grantableRoles({
      actorIsAdmin: false,
      actorGrants: [grant('TEAM_LEAD', 'cycle', CYCLE)],
      scopeType: 'cycle',
      scope: ticketInCycle,
    });
    expect(roles).toEqual(['DEVELOPER', 'VIEWER']);
  });
});
