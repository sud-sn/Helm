import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';
import { showError } from './notify';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

/**
 * One place that reacts to session problems: an expired session clears the current user (the
 * route guard then redirects to the login page); a required password change reloads the user.
 */
function handleSessionErrors(error: unknown) {
  if (!(error instanceof ApiError)) return;
  if (error.status === 401) queryClient.setQueryData(ME_QUERY_KEY, null);
  if (error.code === 'PASSWORD_CHANGE_REQUIRED')
    void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSessionErrors }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      handleSessionErrors(error);
      // Mutations that handle their own errors (e.g. forms showing field errors) opt out.
      if (mutation.meta?.silent) return;
      if (error instanceof ApiError && error.status === 401) return;
      showError(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}
