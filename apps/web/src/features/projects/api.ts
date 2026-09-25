import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProjectInput,
  Project,
  ProjectProgress,
  UpdateProjectInput,
} from '@helm/shared';
import { api, query } from '@/lib/api-client';

export const projectKeys = {
  all: ['projects'] as const,
  list: (clientId?: string) => ['projects', 'list', clientId ?? 'all'] as const,
  detail: (key: string) => ['projects', 'detail', key] as const,
  progress: (key: string) => ['projects', 'progress', key] as const,
};

export function useProjects(clientId?: string) {
  return useQuery({
    queryKey: projectKeys.list(clientId),
    queryFn: () => api<Project[]>(`/projects${query({ clientId })}`),
  });
}

export function useProject(key: string) {
  return useQuery({
    queryKey: projectKeys.detail(key),
    queryFn: () => api<Project>(`/projects/${key}`),
  });
}

export function useProjectProgress(key: string) {
  return useQuery({
    queryKey: projectKeys.progress(key),
    queryFn: () => api<ProjectProgress>(`/projects/${key}/progress`),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api<Project>('/projects', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: () =>
      queryClient
        .invalidateQueries({ queryKey: ['projects'] })
        .then(() => queryClient.invalidateQueries({ queryKey: ['clients'] })),
  });
}

export function useUpdateProject(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      api<Project>(`/projects/${key}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
