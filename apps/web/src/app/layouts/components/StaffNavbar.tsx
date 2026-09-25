import { Divider, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core';
import { useCurrentUser } from '@/features/auth/api';
import { useUnreadCount } from '@/features/notifications/api';
import { useProjects } from '@/features/projects/api';
import { NavIcons } from '@/icons';
import { paths } from '@/lib/paths';
import { NavItem } from './NavItem';

function Section({ label }: { label: string }) {
  return (
    <Text
      size="xs"
      fw={700}
      c="dimmed"
      tt="uppercase"
      px="sm"
      pt="md"
      pb={4}
      style={{ letterSpacing: 0.5 }}
    >
      {label}
    </Text>
  );
}

export function StaffNavbar({ onNavigate }: { onNavigate: () => void }) {
  const user = useCurrentUser();
  const unread = useUnreadCount();
  const projects = useProjects();
  const activeProjects = (projects.data ?? []).filter((project) => project.status !== 'completed');

  return (
    <ScrollArea type="scroll" style={{ flex: 1 }}>
      <Stack gap={2}>
        <NavItem
          to={paths.home}
          end
          label="Dashboard"
          icon={NavIcons.dashboard}
          onNavigate={onNavigate}
        />
        <NavItem to={paths.myWork} label="My work" icon={NavIcons.myWork} onNavigate={onNavigate} />
        <NavItem
          to={paths.notifications}
          label="Notifications"
          icon={NavIcons.notifications}
          count={unread.data}
          onNavigate={onNavigate}
        />

        <Section label="Delivery" />
        <NavItem
          to={paths.clients}
          label="Clients"
          icon={NavIcons.clients}
          onNavigate={onNavigate}
        />
        <NavItem
          to={paths.pitches}
          label="Pitches"
          icon={NavIcons.pitches}
          onNavigate={onNavigate}
        />
        <NavItem
          to={paths.meetings}
          label="Meetings"
          icon={NavIcons.meetings}
          onNavigate={onNavigate}
        />

        <Section label="Projects" />
        {activeProjects.length === 0 ? (
          <Text size="xs" c="dimmed" px="sm">
            {projects.isPending ? 'Loading…' : 'No projects yet'}
          </Text>
        ) : (
          activeProjects.map((project) => (
            <NavItem
              key={project.id}
              to={paths.project(project.key)}
              activePrefix={`/projects/${project.key}`}
              label={project.name}
              description={project.clientName}
              onNavigate={onNavigate}
              leftSection={
                <ThemeIcon
                  size={26}
                  variant="light"
                  radius="sm"
                  style={{ width: 'auto', minWidth: 26, paddingInline: 4 }}
                >
                  <Text size="10px" fw={700} ff="monospace">
                    {project.key}
                  </Text>
                </ThemeIcon>
              }
            />
          ))
        )}

        {user.isAdmin ? (
          <>
            <Divider my="sm" />
            <Section label="Administration" />
            <NavItem
              to={paths.adminUsers}
              label="Users"
              icon={NavIcons.users}
              onNavigate={onNavigate}
            />
            <NavItem
              to={paths.adminAudit}
              label="Audit log"
              icon={NavIcons.audit}
              onNavigate={onNavigate}
            />
          </>
        ) : null}
      </Stack>
    </ScrollArea>
  );
}
