import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, CreateClientInput, UpdateClientInput } from '@helm/shared';
import { api, query } from '@/lib/api-client';

export const clientKeys = {
  all: ['clients'] as const,
  list: (includeArchived: boolean) => ['clients', 'list', includeArchived] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
};

export function useClients(includeArchived = false) {
  return useQuery({
    queryKey: clientKeys.list(includeArchived),
    queryFn: () =>
      api<Client[]>(`/clients${query({ includeArchived: includeArchived || undefined })}`),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => api<Client>(`/clients/${id}`),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) =>
      api<Client>('/clients', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.all }),
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClientInput) =>
      api<Client>(`/clients/${id}`, { method: 'PATCH', body: input }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.all }),
  });
}
