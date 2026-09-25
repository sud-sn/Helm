import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GrantRoleInput,
  Role,
  RoleAssignment,
  ScopeType,
  UserSummary,
  UserType,
} from '@helm/shared';
import { api, query } from '@/lib/api-client';
import { ME_QUERY_KEY } from '@/lib/query-client';

export const memberKeys = {
  all: ['members'] as const,
  scope: (scopeType: ScopeType, scopeId?: string) =>
    ['members', 'scope', scopeType, scopeId ?? null] as const,
  grantable: (scopeType: ScopeType, scopeId?: string) =>
    ['members', 'grantable', scopeType, scopeId ?? null] as const,
  user: (userId: string) => ['members', 'user', userId] as const,
  directory: (filter: { q?: string; clientId?: string; userType?: UserType }) =>
    ['members', 'directory', filter] as const,
};

export function useScopeMembers(scopeType: ScopeType, scopeId?: string) {
  return useQuery({
    queryKey: memberKeys.scope(scopeType, scopeId),
    queryFn: () => api<RoleAssignment[]>(`/role-assignments${query({ scopeType, scopeId })}`),
  });
}

export function useGrantableRoles(scopeType: ScopeType, scopeId?: string) {
  return useQuery({
    queryKey: memberKeys.grantable(scopeType, scopeId),
    queryFn: () => api<Role[]>(`/role-assignments/grantable-roles${query({ scopeType, scopeId })}`),
  });
}

export function useUserAssignments(userId: string) {
  return useQuery({
    queryKey: memberKeys.user(userId),
    queryFn: () => api<RoleAssignment[]>(`/users/${userId}/role-assignments`),
  });
}

export function useDirectory(
  filter: { q?: string; clientId?: string; userType?: UserType },
  enabled = true,
) {
  return useQuery({
    queryKey: memberKeys.directory(filter),
    queryFn: () =>
      api<(UserSummary & { userType: UserType })[]>(`/users/directory${query(filter)}`),
    enabled,
    staleTime: 60_000,
  });
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['tickets', 'assignable'] }),
    ]);
}

export function useGrantRole() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (input: GrantRoleInput) =>
      api<RoleAssignment>('/role-assignments', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useRevokeRole() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/role-assignments/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
