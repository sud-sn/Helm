import { describe, expect, it } from 'vitest';
import type { CurrentUser, Grant, Ticket } from '@helm/shared';
import { canChangeStatus, canEditTicket } from './ticket-permissions';

const scope = { clientId: 'client-1', projectId: 'project-1', cycleId: 'cycle-1' };

function user(id: string, grants: Partial<Grant>[]): CurrentUser {
  return {
    id,
    username: id,
    displayName: id,
    email: null,
    userType: 'staff',
    clientId: null,
    isAdmin: false,
    mustChangePassword: false,
    grants: grants.map((grant) => ({
      scopeType: 'project',
      clientId: 'client-1',
      projectId: 'project-1',
      cycleId: null,
      role: 'VIEWER',
      ...grant,
    })),
  };
}

const ticket = (assigneeId: string | null) =>
  ({
    ...scope,
    key: 'ACME-1',
    assignee: assigneeId ? { id: assigneeId, username: assigneeId, displayName: assigneeId } : null,
  }) as Ticket;

describe('ticket permissions', () => {
  it('lets a team lead edit any ticket in the project', () => {
    const lead = user('lead', [{ role: 'TEAM_LEAD' }]);
    expect(canEditTicket(lead, ticket('someone-else'))).toBe(true);
    expect(canChangeStatus(lead, ticket(null))).toBe(true);
  });

  it('lets a developer move only tickets assigned to them', () => {
    const dev = user('dev', [{ role: 'DEVELOPER' }]);
    expect(canChangeStatus(dev, ticket('dev'))).toBe(true);
    expect(canChangeStatus(dev, ticket('someone-else'))).toBe(false);
    expect(canEditTicket(dev, ticket('dev'))).toBe(false);
  });

  it('gives a developer on one cycle nothing on tickets outside it', () => {
    const cycleDev = user('dev', [{ role: 'DEVELOPER', scopeType: 'cycle', cycleId: 'cycle-2' }]);
    expect(canChangeStatus(cycleDev, ticket('dev'))).toBe(false);
  });

  it('keeps viewers read-only', () => {
    const viewer = user('viewer', [{ role: 'VIEWER' }]);
    expect(canChangeStatus(viewer, ticket('viewer'))).toBe(false);
  });
});
