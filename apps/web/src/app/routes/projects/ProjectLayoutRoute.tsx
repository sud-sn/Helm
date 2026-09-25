import { Button, Tabs } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { hasPermission, type Project } from '@helm/shared';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { useCurrentUser } from '@/features/auth/api';
import { useBoardCycle } from '@/features/cycles/board-cycle';
import { useProject } from '@/features/projects/api';
import { ProjectFormModal } from '@/features/projects/components/ProjectFormModal';
import { TicketFormModal } from '@/features/tickets/components/TicketFormModal';
import { useTicketCreateAccess } from '@/features/tickets/create-access';
import { ActionIcons, ICON_STROKE, NavIcons, type AppIcon } from '@/icons';
import { formatDate } from '@/lib/format';
import { paths } from '@/lib/paths';

const TABS: { value: string; label: string; icon: AppIcon }[] = [
  { value: 'board', label: 'Board', icon: NavIcons.board },
  { value: 'backlog', label: 'Backlog', icon: NavIcons.backlog },
  { value: 'tickets', label: 'Tickets', icon: NavIcons.tickets },
  { value: 'cycles', label: 'Cycles', icon: NavIcons.cycles },
  { value: 'pages', label: 'Pages', icon: NavIcons.pages },
  { value: 'meetings', label: 'Meetings', icon: NavIcons.meetings },
  { value: 'pitches', label: 'Pitches', icon: NavIcons.pitches },
  { value: 'members', label: 'Members', icon: NavIcons.members },
];

export interface ProjectContext {
  project: Project;
  openNewTicket: (cycleId?: string | null) => void;
}

export const useProjectContext = () => useOutletContext<ProjectContext>();

export function ProjectLayoutRoute() {
  const { key = '' } = useParams();
  const project = useProject(key.toUpperCase());
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ticketOpen, ticketModal] = useDisclosure(false);
  const [newTicketCycle, setNewTicketCycle] = useState<string | null>(null);
  const [settingsOpen, settings] = useDisclosure(false);
  const tab = pathname.split('/')[3] ?? 'board';
  // On the board, a new ticket goes into the cycle being shown; elsewhere into the backlog.
  const boardCycle = useBoardCycle(key.toUpperCase());
  const createAccess = useTicketCreateAccess(project.data);

  return (
    <QueryState query={project}>
      {(data) => {
        const scope = { clientId: data.clientId, projectId: data.id };
        const canCreateTickets = createAccess.any;
        const canEdit = hasPermission(user.grants, scope, 'project.update');
        const context: ProjectContext = {
          project: data,
          openNewTicket: (cycleId = null) => {
            setNewTicketCycle(cycleId);
            ticketModal.open();
          },
        };
        return (
          <>
            <PageHeader
              crumbs={[
                { label: 'Clients', to: paths.clients },
                { label: data.clientName, to: paths.client(data.clientId) },
                { label: data.key },
              ]}
              title={data.name}
              meta={
                data.status !== 'active' ? (
                  <Tag tone={data.status === 'on_hold' ? 'warning' : 'success'}>
                    {data.status === 'on_hold' ? 'On hold' : 'Completed'}
                  </Tag>
                ) : undefined
              }
              description={
                [data.description, data.targetDate ? `Target ${formatDate(data.targetDate)}` : null]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
              actions={
                <>
                  {canEdit ? (
                    <Button
                      variant="default"
                      leftSection={<NavIcons.settings size={16} stroke={ICON_STROKE} />}
                      onClick={settings.open}
                    >
                      Settings
                    </Button>
                  ) : null}
                  {canCreateTickets ? (
                    <Button
                      leftSection={<ActionIcons.add size={16} stroke={ICON_STROKE} />}
                      onClick={() =>
                        context.openNewTicket(
                          tab === 'board' ? (boardCycle.cycle?.id ?? null) : null,
                        )
                      }
                    >
                      New ticket
                    </Button>
                  ) : null}
                </>
              }
            />
            <Tabs
              value={tab}
              onChange={(value) => value && void navigate(paths.project(data.key, value))}
              mb="lg"
            >
              <Tabs.List>
                {TABS.map(({ value, label, icon: Icon }) => (
                  <Tabs.Tab
                    key={value}
                    value={value}
                    leftSection={<Icon size={16} stroke={ICON_STROKE} />}
                  >
                    {label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
            <Outlet context={context} />
            <TicketFormModal
              opened={ticketOpen}
              onClose={ticketModal.close}
              project={data}
              defaultCycleId={newTicketCycle}
            />
            <ProjectFormModal opened={settingsOpen} onClose={settings.close} project={data} />
          </>
        );
      }}
    </QueryState>
  );
}
