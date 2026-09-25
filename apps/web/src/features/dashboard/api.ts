import { useQuery } from '@tanstack/react-query';
import type { Dashboard } from '@helm/shared';
import { api } from '@/lib/api-client';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') });
}
