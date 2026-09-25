import { useQuery } from '@tanstack/react-query';
import type { PortalHome } from '@helm/shared';
import { api } from '@/lib/api-client';

export function usePortalHome() {
  return useQuery({ queryKey: ['portal', 'home'], queryFn: () => api<PortalHome>('/portal') });
}
