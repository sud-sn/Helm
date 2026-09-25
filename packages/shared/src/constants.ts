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

/** `suggested` items come from AI and wait for a person to accept (→ open) or dismiss them. */
export const ACTION_ITEM_STATUSES = ['suggested', 'open', 'converted', 'dismissed'] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  suggested: 'Suggested',
  open: 'Open',
  converted: 'Converted',
  dismissed: 'Dismissed',
};

/** Whether a person typed the action item or AI proposed it from the transcript. */
export const ACTION_ITEM_SOURCES = ['manual', 'ai'] as const;
export type ActionItemSource = (typeof ACTION_ITEM_SOURCES)[number];

/** What an AI call was for; every call is recorded (see the AI assistant admin page). */
export const AI_TASKS = ['meeting_action_items', 'page_draft', 'connection_test'] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const AI_TASK_LABELS: Record<AiTask, string> = {
  meeting_action_items: 'Action items from a transcript',
  page_draft: 'Document draft',
  connection_test: 'Connection test',
};

/** Documents the AI can draft from a developer's notes. Their sections are fixed in the API. */
export const DOC_TYPES = ['technical_spec', 'delivery_document'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  technical_spec: 'Technical specification',
  delivery_document: 'Delivery document',
};

export const DOC_TYPE_DESCRIPTIONS: Record<DocType, string> = {
  technical_spec:
    'How a pipeline, data model or report is built: sources, target, transformations, ' +
    'schedule, data quality, reporting, security, testing and deployment.',
  delivery_document:
    'What a cycle or release delivered: scope, changes, deployment, validation and UAT, ' +
    'known issues, support and sign-off.',
};

export const AI_RUN_STATUSES = ['succeeded', 'failed'] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

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
