import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActionItem,
  ConvertActionItemsInput,
  CreateActionItemInput,
  CreateMeetingInput,
  Meeting,
  MeetingSummary,
  Ticket,
  UpdateActionItemInput,
  UpdateMeetingInput,
  Visibility,
} from '@helm/shared';
import { api, query } from '@/lib/api-client';

export const meetingKeys = {
  all: ['meetings'] as const,
  list: (filter: { clientId?: string; projectId?: string }) =>
    ['meetings', 'list', filter] as const,
  detail: (id: string) => ['meetings', 'detail', id] as const,
  actionItems: (id: string) => ['meetings', 'action-items', id] as const,
};

export function useMeetings(filter: { clientId?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: meetingKeys.list(filter),
    queryFn: () => api<MeetingSummary[]>(`/meetings${query(filter)}`),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => api<Meeting>(`/meetings/${id}`),
  });
}

export function useActionItems(meetingId: string, enabled = true) {
  return useQuery({
    queryKey: meetingKeys.actionItems(meetingId),
    queryFn: () => api<ActionItem[]>(`/meetings/${meetingId}/action-items`),
    enabled,
  });
}

function useInvalidateMeetings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: meetingKeys.all });
}

export function useCreateMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: CreateMeetingInput) =>
      api<Meeting>('/meetings', { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useUpdateMeeting(id: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: UpdateMeetingInput) =>
      api<Meeting>(`/meetings/${id}`, { method: 'PATCH', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useSetMinutesVisibility(id: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (visibility: Visibility) =>
      api<Meeting>(`/meetings/${id}/visibility`, { method: 'PUT', body: { visibility } }),
    onSuccess: invalidate,
  });
}

export function useDeleteMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/meetings/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreateActionItem(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: CreateActionItemInput) =>
      api<ActionItem>(`/meetings/${meetingId}/action-items`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateActionItem() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateActionItemInput & { id: string }) =>
      api<ActionItem>(`/action-items/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteActionItem() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/action-items/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useConvertActionItems(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConvertActionItemsInput) =>
      api<Ticket[]>(`/meetings/${meetingId}/action-items/convert`, { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: meetingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  });
}

export function useActionItemToPitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ pitchId: string }>(`/action-items/${id}/pitch`, { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: meetingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['pitches'] }),
      ]),
  });
}
