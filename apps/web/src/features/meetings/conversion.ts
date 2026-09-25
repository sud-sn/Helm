import { hasPermission, type Meeting } from '@helm/shared';
import { useCurrentUser } from '@/features/auth/api';
import { useProjects } from '@/features/projects/api';
import { useTicketCreateAccess } from '@/features/tickets/create-access';

/**
 * The projects a meeting's action items can become tickets in: projects of the meeting's client
 * where the user may create tickets (Team Lead and above). Recording a meeting and listing its
 * action items needs less (developers and BAs do it); a Team Lead turns them into tickets.
 */
export function useConversionTargets(meeting: Meeting) {
  const user = useCurrentUser();
  const projects = useProjects(meeting.clientId);
  const meetingProject = projects.data?.find((project) => project.id === meeting.projectId);
  const meetingProjectAccess = useTicketCreateAccess(meetingProject);
  const targets = (projects.data ?? []).filter((project) =>
    project.id === meeting.projectId
      ? meetingProjectAccess.any
      : hasPermission(
          user.grants,
          { clientId: project.clientId, projectId: project.id },
          'ticket.create',
        ),
  );
  return { targets, isPending: projects.isPending };
}
