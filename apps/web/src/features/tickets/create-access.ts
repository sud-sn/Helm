import { hasPermission, type Cycle } from '@helm/shared';
import { useCurrentUser } from '@/features/auth/api';
import { useCycles } from '@/features/cycles/api';

interface ProjectRef {
  id: string;
  key: string;
  clientId: string;
}

export interface TicketCreateAccess {
  /** May create backlog tickets (Team Lead or above on the project or its client). */
  backlog: boolean;
  /** Open cycles the user may add tickets to. */
  cycles: Cycle[];
  /** May create tickets anywhere in the project. */
  any: boolean;
}

/**
 * Where the current user may create tickets in a project. Mirrors the API, which checks
 * ticket.create at the new ticket's project and cycle: a Team Lead on one cycle can only add to it.
 */
export function useTicketCreateAccess(project: ProjectRef | null | undefined): TicketCreateAccess {
  const user = useCurrentUser();
  const cycles = useCycles(project?.key);
  if (!project) return { backlog: false, cycles: [], any: false };
  const scope = { clientId: project.clientId, projectId: project.id };
  const backlog = hasPermission(user.grants, { ...scope, cycleId: null }, 'ticket.create');
  const open = (cycles.data ?? []).filter(
    (cycle) =>
      cycle.status !== 'completed' &&
      hasPermission(user.grants, { ...scope, cycleId: cycle.id }, 'ticket.create'),
  );
  return { backlog, cycles: open, any: backlog || open.length > 0 };
}
