import { Anchor, AppShell, Container, Group, Text } from '@mantine/core';
import { Link, Outlet } from 'react-router';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { WhileYouWereAway } from '@/features/notifications/components/WhileYouWereAway';
import { usePortalHome } from '@/features/portal/api';
import { paths } from '@/lib/paths';
import { ColorSchemeToggle } from './components/ColorSchemeToggle';
import { UserMenu } from './components/UserMenu';
import classes from './Layout.module.css';

/** The client portal: a simpler frame with no internal navigation. */
export function PortalLayout() {
  const home = usePortalHome();
  return (
    <AppShell header={{ height: 60 }} padding="lg">
      <AppShell.Header className={classes.header}>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="md" wrap="nowrap">
              <Anchor
                component={Link}
                to={paths.portal.home}
                underline="never"
                aria-label="Portal home"
              >
                <Logo onDark subtitle="Client portal" />
              </Anchor>
              {home.data ? (
                <Text c="navy.1" fw={600} className="hide-mobile">
                  {home.data.client.name}
                </Text>
              ) : null}
            </Group>
            <Group gap={6} wrap="nowrap">
              <NotificationBell clientView allPath={paths.portal.notifications} />
              <ColorSchemeToggle />
              <UserMenu accountPath={paths.portal.account} />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main className={classes.main}>
        <Container size="lg" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>
      <WhileYouWereAway clientView allPath={paths.portal.notifications} />
    </AppShell>
  );
}
