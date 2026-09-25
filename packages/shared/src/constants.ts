/**
 * Domain vocabulary shared by the API and the web app.
 * Changing a list here changes validation on both sides; the database has
 * matching CHECK constraints, so add a migration when you add a value.
 */

export const TICKET_STATUSES = [
  'todo',
  'in_progress',
  'blocked',
  'in_review',
  'uat',
  'done',
  'cancelled',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  in_review: 'In Review',
  uat: 'UAT',
  done: 'Done',
  cancelled: 'Cancelled',
};

/** Columns shown on the Kanban board, left to right. Cancelled tickets are hidden. */
export const BOARD_STATUSES: readonly TicketStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'in_review',
  'uat',
  'done',
];

export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'in_review',
  'uat',
];

export const CLOSED_TICKET_STATUSES: readonly TicketStatus[] = ['done', 'cancelled'];

export function isOpenStatus(status: TicketStatus): boolean {
  return OPEN_TICKET_STATUSES.includes(status);
}

export const TICKET_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const TICKET_TYPES = [
  'task',
  'bug',
  'pipeline',
  'report',
  'data_model',
  'data_quality',
  'investigation',
] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  task: 'Task',
  bug: 'Bug',
  pipeline: 'Pipeline',
  report: 'Report / Dashboard',
  data_model: 'Data Model',
  data_quality: 'Data Quality',
  investigation: 'Investigation',
};

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
};

export const CYCLE_STATUSES = ['planned', 'active', 'completed'] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
};

/**
 * Pitch lifecycle (a proposal made by the team to the client):
 *   draft -> in_review (team submits) -> sent (a Project Manager approves and sends it)
 *   sent -> accepted | rejected | changes_requested (the client responds)
 *   changes_requested -> in_review (team revises and resubmits)
 *   any open state -> withdrawn (a Project Manager withdraws it)
 */
export const PITCH_STATUSES = [
  'draft',
  'in_review',
  'sent',
  'changes_requested',
  'accepted',
  'rejected',
  'withdrawn',
] as const;
export type PitchStatus = (typeof PITCH_STATUSES)[number];

export const PITCH_STATUS_LABELS: Record<PitchStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  sent: 'Sent to Client',
  changes_requested: 'Changes Requested',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Pitches can be edited in these states. */
export const PITCH_EDITABLE_STATUSES: readonly PitchStatus[] = ['draft', 'changes_requested'];

export const PITCH_FINAL_STATUSES: readonly PitchStatus[] = ['accepted', 'rejected', 'withdrawn'];

/** What a client can answer to a pitch that was sent to them. */
export const PITCH_RESPONSES = ['accepted', 'rejected', 'changes_requested'] as const;
export type PitchResponse = (typeof PITCH_RESPONSES)[number];

/**
 * Who can see a piece of content. Internal content never reaches client users;
 * client-visible content is shown to both the team and the client.
 */
export const VISIBILITIES = ['internal', 'client'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  internal: 'Internal',
  client: 'Shared with client',
};

export const ACTION_ITEM_STATUSES = ['open', 'converted', 'dismissed'] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: 'Open',
  converted: 'Converted',
  dismissed: 'Dismissed',
};

export const NOTIFICATION_TYPES = [
  'ticket_assigned',
  'mentioned',
  'ticket_status_changed',
  'comment_added',
  'role_granted',
  'pitch_submitted',
  'pitch_sent',
  'pitch_responded',
  'pitch_commented',
  'content_shared',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TICKET_EVENT_TYPES = [
  'created',
  'status_changed',
  'assigned',
  'cycle_changed',
  'updated',
  'imported',
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];
