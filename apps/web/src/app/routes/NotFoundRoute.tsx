import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { HelmMark } from '@/components/Logo';

export function NotFoundRoute() {
  return (
    <Center mih="70vh">
      <Stack align="center" gap="sm">
        <HelmMark size={48} />
        <Title order={2}>Page not found</Title>
        <Text c="dimmed">The link may be old, or you may not have access to it.</Text>
        <Button component={Link} to="/" variant="light">
          Go home
        </Button>
      </Stack>
    </Center>
  );
}

/** Last-resort boundary for errors thrown while rendering a route. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <Center mih="70vh" p="md">
      <Stack align="center" gap="sm" maw={480} ta="center">
        <HelmMark size={48} />
        <Title order={2}>Something went wrong</Title>
        <Text c="dimmed">{message}</Text>
        <Button onClick={() => window.location.assign('/')} variant="light">
          Reload Helm
        </Button>
      </Stack>
    </Center>
  );
}
