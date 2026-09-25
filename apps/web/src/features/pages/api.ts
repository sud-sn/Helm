import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePageInput,
  Page,
  PageSummary,
  PageVersion,
  UpdatePageInput,
  Visibility,
} from '@helm/shared';
import { api } from '@/lib/api-client';

export const pageKeys = {
  all: ['pages'] as const,
  project: (projectKey: string) => ['pages', 'project', projectKey] as const,
  ticket: (ticketKey: string) => ['pages', 'ticket', ticketKey] as const,
  detail: (id: string) => ['pages', 'detail', id] as const,
  versions: (id: string) => ['pages', 'versions', id] as const,
};

export function useProjectPages(projectKey: string) {
  return useQuery({
    queryKey: pageKeys.project(projectKey),
    queryFn: () => api<PageSummary[]>(`/projects/${projectKey}/pages`),
  });
}

export function useTicketPages(ticketKey: string) {
  return useQuery({
    queryKey: pageKeys.ticket(ticketKey),
    queryFn: () => api<PageSummary[]>(`/tickets/${ticketKey}/pages`),
  });
}

export function usePage(id: string) {
  return useQuery({ queryKey: pageKeys.detail(id), queryFn: () => api<Page>(`/pages/${id}`) });
}

export function usePageVersions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: pageKeys.versions(id),
    queryFn: () => api<PageVersion[]>(`/pages/${id}/versions`),
    enabled,
  });
}

export function useCreatePage(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePageInput) =>
      api<Page>(`/projects/${projectKey}/pages`, { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pageKeys.all }),
  });
}

export function useUpdatePage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePageInput) =>
      api<Page>(`/pages/${id}`, { method: 'PATCH', body: input }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pageKeys.all }),
  });
}

export function useSetPageVisibility(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visibility: Visibility) =>
      api<Page>(`/pages/${id}/visibility`, { method: 'PUT', body: { visibility } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pageKeys.all }),
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/pages/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pageKeys.all }),
  });
}
