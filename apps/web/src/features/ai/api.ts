import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiStatus, AiTestResult, Features } from '@helm/shared';
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

export function useTestAiConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<AiTestResult>('/admin/ai/test', { method: 'POST', body: {} }),
    // The result, good or bad, is shown on the page.
    meta: { silent: true },
    onSettled: () => queryClient.invalidateQueries({ queryKey: aiKeys.status }),
  });
}
