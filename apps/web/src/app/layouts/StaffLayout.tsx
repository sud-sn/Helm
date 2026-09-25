import { Anchor, AppShell, Burger, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet } from 'react-router';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { WhileYouWereAway } from '@/features/notifications/components/WhileYouWereAway';
import { paths } from '@/lib/paths';
import { ColorSchemeToggle } from './components/ColorSchemeToggle';
import { StaffNavbar } from './components/StaffNavbar';
import { UserMenu } from './components/UserMenu';
import classes from './Layout.module.css';

export function StaffLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 272, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="white"
              aria-label="Menu"
            />
            <Anchor component={Link} to={paths.home} underline="never" aria-label="Helm home">
              <Logo onDark />
            </Anchor>
          </Group>
          <Group gap={6} wrap="nowrap">
            <NotificationBell clientView={false} allPath={paths.notifications} />
            <ColorSchemeToggle />
            <UserMenu accountPath={paths.account} />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <StaffNavbar onNavigate={close} />
      </AppShell.Navbar>
      <AppShell.Main className={classes.main}>
        <div className={classes.content}>
          <Outlet />
        </div>
      </AppShell.Main>
      <WhileYouWereAway clientView={false} allPath={paths.notifications} />
    </AppShell>
  );
}
