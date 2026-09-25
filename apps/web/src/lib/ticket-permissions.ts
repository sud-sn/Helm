import { hasPermission, type CurrentUser, type Ticket } from '@helm/shared';

const scopeOf = (ticket: Ticket) => ({
  clientId: ticket.clientId,
  projectId: ticket.projectId,
  cycleId: ticket.cycleId,
});

/** Mirrors the API: full edits need ticket.update; assignees with ticket.update_own may change status. */
export function canChangeStatus(user: CurrentUser, ticket: Ticket): boolean {
  const scope = scopeOf(ticket);
  return (
    hasPermission(user.grants, scope, 'ticket.update') ||
    (ticket.assignee?.id === user.id && hasPermission(user.grants, scope, 'ticket.update_own'))
  );
}

export function canEditTicket(user: CurrentUser, ticket: Ticket): boolean {
  return hasPermission(user.grants, scopeOf(ticket), 'ticket.update');
}
