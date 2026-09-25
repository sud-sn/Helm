import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiSettingsInput, AiStatus, AiTestResult, Features } from '@helm/shared';
import { api } from '@/lib/api-client';

export const aiKeys = {
  features: ['features'] as const,
  status: ['admin', 'ai'] as const,
};

/** What this user may be offered; AI stays hidden until Azure OpenAI is configured. */
export function useFeatures() {
  return useQuery({
    queryKey: aiKeys.features,
    queryFn: () => api<Features>('/features'),
    staleTime: 5 * 60_000,
  });
}

export function useAiStatus() {
  return useQuery({ queryKey: aiKeys.status, queryFn: () => api<AiStatus>('/admin/ai') });
}

function useApplyStatus() {
  const queryClient = useQueryClient();
  return (status: AiStatus) => {
    queryClient.setQueryData(aiKeys.status, status);
    // The admin's own screens show or hide AI buttons from this.
    void queryClient.invalidateQueries({ queryKey: aiKeys.features });
  };
}

/** Tests the connection with these settings on the server and saves them only if it works. */
export function useSaveAiSettings() {
  const apply = useApplyStatus();
  return useMutation({
    mutationFn: (input: AiSettingsInput) =>
      api<AiStatus>('/admin/ai/settings', { method: 'PUT', body: input }),
    // The form shows what went wrong next to the fields.
    meta: { silent: true },
    onSuccess: apply,
  });
}

export function useRemoveAiSettings() {
  const apply = useApplyStatus();
  return useMutation({
    mutationFn: () => api<AiStatus>('/admin/ai/settings', { method: 'DELETE' }),
    onSuccess: apply,
  });
}

export function useTestAiConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<AiTestResult>('/admin/ai/test', { method: 'POST', body: {} }),
    // The result, good or bad, is shown on the page.
    meta: { silent: true },
    onSettled: () => queryClient.invalidateQueries({ queryKey: aiKeys.status }),
  });
}
