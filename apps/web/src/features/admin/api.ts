import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminUser,
  AuditEntry,
  CreateUserInput,
  TemporaryPasswordResponse,
  UpdateUserInput,
  UserType,
} from '@helm/shared';
import { api, query } from '@/lib/api-client';

export const adminKeys = {
  users: (filter: { q?: string; userType?: UserType; includeInactive?: boolean }) =>
    ['admin', 'users', filter] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  audit: (filter: { action?: string; before?: string }) => ['admin', 'audit', filter] as const,
};

export function useAdminUsers(filter: {
  q?: string;
  userType?: UserType;
  includeInactive?: boolean;
}) {
  return useQuery({
    queryKey: adminKeys.users(filter),
    queryFn: () => api<AdminUser[]>(`/admin/users${query(filter)}`),
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => api<AdminUser>(`/admin/users/${id}`),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      api<TemporaryPasswordResponse>('/admin/users', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) =>
      api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useResetPassword(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<TemporaryPasswordResponse>(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAuditLog(filter: { action?: string; before?: string }) {
  return useQuery({
    queryKey: adminKeys.audit(filter),
    queryFn: () => api<AuditEntry[]>(`/admin/audit${query({ ...filter, limit: 100 })}`),
  });
}
