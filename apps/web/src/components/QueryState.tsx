import { Alert, Center, Loader } from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActionIcons, ICON_STROKE } from '@/icons';

/** Renders loading and error states for a query, and the children once data is there. */
export function QueryState<T>({
  query,
  children,
  loader,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loader?: ReactNode;
}) {
  if (query.isPending) {
    return (
      loader ?? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )
    );
  }
  if (query.isError) {
    return (
      <Alert
        color="red"
        icon={<ActionIcons.warning size={18} stroke={ICON_STROKE} />}
        title="Could not load this"
      >
        {query.error.message}
      </Alert>
    );
  }
  return <>{children(query.data)}</>;
}

export function FullPageLoader() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}
