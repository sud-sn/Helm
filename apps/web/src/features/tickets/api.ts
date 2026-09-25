import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Comment,
  CreateCommentResponse,
  CreateTicketInput,
  ImportResult,
  Ticket,
  TicketDetail,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  TicketType,
  UpdateTicketInput,
  UserSummary,
} from '@helm/shared';
import { api, query } from '@/lib/api-client';

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  type?: TicketType[];
  /** A cycle id or "backlog". */
  cycle?: string;
  /** A user id, "me" or "none". */
  assignee?: string;
  q?: string;
}

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (projectKey: string, filters: TicketFilters) =>
    ['tickets', 'list', projectKey, filters] as const,
  mine: ['tickets', 'mine'] as const,
  detail: (key: string) => ['tickets', 'detail', key] as const,
  events: (key: string) => ['tickets', 'events', key] as const,
  comments: (key: string) => ['tickets', 'comments', key] as const,
  assignable: (projectKey: string, cycleId: string | null) =>
    ['tickets', 'assignable', projectKey, cycleId] as const,
};

export function filtersToQuery(filters: TicketFilters) {
  return query({
    status: filters.status,
    priority: filters.priority,
    type: filters.type,
    cycle: filters.cycle,
    assignee: filters.assignee,
    q: filters.q,
  });
}

export function useTickets(projectKey: string, filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ticketKeys.list(projectKey, filters),
    queryFn: () => api<Ticket[]>(`/projects/${projectKey}/tickets${filtersToQuery(filters)}`),
  });
}

export function useMyTickets() {
  return useQuery({ queryKey: ticketKeys.mine, queryFn: () => api<Ticket[]>('/my/tickets') });
}

export function useTicket(key: string) {
  return useQuery({
    queryKey: ticketKeys.detail(key),
    queryFn: () => api<TicketDetail>(`/tickets/${key}`),
  });
}

export function useTicketEvents(key: string) {
  return useQuery({
    queryKey: ticketKeys.events(key),
    queryFn: () => api<TicketEvent[]>(`/tickets/${key}/events`),
  });
}

export function useComments(key: string) {
  return useQuery({
    queryKey: ticketKeys.comments(key),
    queryFn: () => api<Comment[]>(`/tickets/${key}/comments`),
  });
}

/** People who can be assigned tickets in a project (or cycle); waits until a project is chosen. */
export function useAssignableUsers(projectKey: string | null | undefined, cycleId: string | null) {
  return useQuery({
    queryKey: ticketKeys.assignable(projectKey ?? '', cycleId),
    queryFn: () =>
      api<UserSummary[]>(
        `/projects/${projectKey}/assignable-users${query({ cycleId: cycleId ?? undefined })}`,
      ),
    enabled: Boolean(projectKey),
    staleTime: 60_000,
  });
}

function useInvalidateTickets() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['cycles'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreateTicket(projectKey: string) {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      api<Ticket>(`/projects/${projectKey}/tickets`, { method: 'POST', body: input }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

/**
 * Updates a ticket. Status changes from the board are applied optimistically to every cached
 * list so cards move instantly; the cache is corrected if the server refuses.
 */
export function useUpdateTicket() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: ({ key, ...input }: UpdateTicketInput & { key: string }) =>
      api<Ticket>(`/tickets/${key}`, { method: 'PATCH', body: input }),
    onMutate: async ({ key, ...input }) => {
      if (input.status === undefined || Object.keys(input).length !== 1) return;
      await queryClient.cancelQueries({ queryKey: ['tickets', 'list'] });
      const snapshot = queryClient.getQueriesData<Ticket[]>({ queryKey: ['tickets', 'list'] });
      queryClient.setQueriesData<Ticket[]>({ queryKey: ['tickets', 'list'] }, (old) =>
        old?.map((ticket) => (ticket.key === key ? { ...ticket, status: input.status! } : ticket)),
      );
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.snapshot ?? [])
        queryClient.setQueryData(queryKey, data);
    },
    onSettled: invalidate,
  });
}

export function useDeleteTicket() {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (key: string) => api<void>(`/tickets/${key}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useWatchTicket(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (watch: boolean) =>
      api<void>(`/tickets/${key}/watch`, { method: watch ? 'PUT' : 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.detail(key) }),
  });
}

export function useAddComment(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<CreateCommentResponse>(`/tickets/${key}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKeys.comments(key) }),
        queryClient.invalidateQueries({ queryKey: ticketKeys.detail(key) }),
      ]),
  });
}

export function useEditComment(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api<Comment>(`/comments/${id}`, { method: 'PATCH', body: { body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.comments(key) }),
  });
}

export function useDeleteComment(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.comments(key) }),
  });
}

export function useImportTickets(projectKey: string) {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (input: { csv: string; dryRun: boolean }) =>
      api<ImportResult>(`/projects/${projectKey}/tickets/import`, { method: 'POST', body: input }),
    onSuccess: (result) => (result.created > 0 ? invalidate() : undefined),
  });
}
