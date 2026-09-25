import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompleteCycleInput, CreateCycleInput, Cycle, UpdateCycleInput } from '@helm/shared';
import { api } from '@/lib/api-client';

export const cycleKeys = {
  all: ['cycles'] as const,
  list: (projectKey: string) => ['cycles', 'list', projectKey] as const,
};

/** Cycles of a project; waits until a project is chosen when the key is not known yet. */
export function useCycles(projectKey: string | null | undefined) {
  return useQuery({
    queryKey: cycleKeys.list(projectKey ?? ''),
    queryFn: () => api<Cycle[]>(`/projects/${projectKey}/cycles`),
    enabled: Boolean(projectKey),
  });
}

function useInvalidateDelivery() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: cycleKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ]);
}

export function useCreateCycle(projectKey: string) {
  const invalidate = useInvalidateDelivery();
  return useMutation({
    mutationFn: (input: CreateCycleInput) =>
      api<Cycle>(`/projects/${projectKey}/cycles`, { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useUpdateCycle() {
  const invalidate = useInvalidateDelivery();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCycleInput & { id: string }) =>
      api<Cycle>(`/cycles/${id}`, { method: 'PATCH', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useCompleteCycle() {
  const invalidate = useInvalidateDelivery();
  return useMutation({
    mutationFn: ({ id, ...input }: CompleteCycleInput & { id: string }) =>
      api<{ cycle: Cycle; movedTickets: number }>(`/cycles/${id}/complete`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteCycle() {
  const invalidate = useInvalidateDelivery();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/cycles/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
