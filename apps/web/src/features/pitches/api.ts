import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePitchInput,
  Pitch,
  PitchComment,
  PitchCommentInput,
  PitchResponseInput,
  PitchReviewInput,
  UpdatePitchInput,
} from '@helm/shared';
import { api, query } from '@/lib/api-client';

export const pitchKeys = {
  all: ['pitches'] as const,
  list: (filter: { clientId?: string; projectId?: string }) => ['pitches', 'list', filter] as const,
  detail: (id: string) => ['pitches', 'detail', id] as const,
  comments: (id: string) => ['pitches', 'comments', id] as const,
};

export function usePitches(filter: { clientId?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: pitchKeys.list(filter),
    queryFn: () => api<Pitch[]>(`/pitches${query(filter)}`),
  });
}

export function usePitch(id: string) {
  return useQuery({ queryKey: pitchKeys.detail(id), queryFn: () => api<Pitch>(`/pitches/${id}`) });
}

export function usePitchComments(id: string) {
  return useQuery({
    queryKey: pitchKeys.comments(id),
    queryFn: () => api<PitchComment[]>(`/pitches/${id}/comments`),
  });
}

function useInvalidatePitches() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: pitchKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['portal'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreatePitch() {
  const invalidate = useInvalidatePitches();
  return useMutation({
    mutationFn: (input: CreatePitchInput) =>
      api<Pitch>('/pitches', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useUpdatePitch(id: string) {
  const invalidate = useInvalidatePitches();
  return useMutation({
    mutationFn: (input: UpdatePitchInput) =>
      api<Pitch>(`/pitches/${id}`, { method: 'PATCH', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

/** submit | review | respond | withdraw */
export function usePitchAction(id: string) {
  const invalidate = useInvalidatePitches();
  return useMutation({
    mutationFn: (
      action:
        | { type: 'submit' }
        | { type: 'withdraw' }
        | { type: 'review'; body: PitchReviewInput }
        | { type: 'respond'; body: PitchResponseInput },
    ) =>
      api<Pitch>(`/pitches/${id}/${action.type}`, {
        method: 'POST',
        body: 'body' in action ? action.body : {},
      }),
    onSuccess: invalidate,
  });
}

export function useAddPitchComment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PitchCommentInput) =>
      api<PitchComment>(`/pitches/${id}/comments`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pitchKeys.comments(id) }),
  });
}
