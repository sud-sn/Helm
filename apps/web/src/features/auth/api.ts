import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangePasswordInput, CurrentUser, LoginInput, LoginResponse } from '@helm/shared';
import { ApiError, api } from '@/lib/api-client';
import { ME_QUERY_KEY } from '@/lib/query-client';

/** The signed-in user, or null when there is no session. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<LoginResponse | null> => {
      try {
        return await api<LoginResponse>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

/** Within authenticated routes the user always exists (the guard ensures it). */
export function useCurrentUser(): CurrentUser {
  const { data } = useMe();
  if (!data) throw new Error('useCurrentUser used outside an authenticated route');
  return data.user;
}

export const AWAY_FLAG = 'helm.showWhileAway';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api<LoginResponse>('/auth/login', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: (response) => {
      queryClient.setQueryData(ME_QUERY_KEY, response);
      // Show the "while you were away" summary once, right after signing in.
      if (response.unreadNotifications > 0) sessionStorage.setItem(AWAY_FLAG, '1');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api<void>('/auth/change-password', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}
