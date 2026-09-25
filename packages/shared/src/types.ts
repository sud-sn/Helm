/**
 * Shapes of API responses. Timestamps are ISO strings; calendar dates are YYYY-MM-DD.
 */
import type {
  ActionItemSource,
  ActionItemStatus,
  AiRunStatus,
  AiTask,
  CycleStatus,
  NotificationType,
  PitchStatus,
  ProjectStatus,
  TicketEventType,
  TicketPriority,
  TicketStatus,
  TicketType,
  Visibility,
} from './constants';
import type { Grant, Role, ScopeType, UserType } from './rbac';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------- users & access

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
}

export interface CurrentUser extends UserSummary {
  email: string | null;
  userType: UserType;
  /** The client company of a client user; null for staff. */
  clientId: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
  grants: Grant[];
}

export interface LoginResponse {
  user: CurrentUser;
  unreadNotifications: number;
}

export interface AdminUser extends UserSummary {
  email: string | null;
  userType: UserType;
  clientId: string | null;
  clientName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Returned when an admin creates a user or resets a password; the password is shown once. */
export interface TemporaryPasswordResponse {
  user: AdminUser;
  temporaryPassword: string | null;
}

export interface RoleAssignment {
  id: string;
  user: UserSummary & { userType: UserType };
  role: Role;
  scopeType: ScopeType;
  clientId: string | null;
  projectId: string | null;
  cycleId: string | null;
  /** Human-readable scope, e.g. "Acme Corp › ACME › Sprint 3". */
  scopeLabel: string;
  grantedBy: UserSummary | null;
  createdAt: string;
}

// ---------------------------------------------------------------- org structure

export interface Client {
  id: string;
  name: string;
  description: string;
  archivedAt: string | null;
  projectCount: number;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  openTicketCount: number;
  createdAt: string;
}

export interface Cycle {
  id: string;
  projectId: string;
  projectKey: string;
  clientId: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
  status: CycleStatus;
  ticketCount: number;
  doneCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------- tickets

export interface Ticket {
  id: string;
  key: string;
  number: number;
  projectId: string;
  projectKey: string;
  clientId: string;
  cycleId: string | null;
  cycleName: string | null;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: UserSummary | null;
  reporter: UserSummary;
  dueDate: string | null;
  estimateHours: number | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TicketDetail extends Ticket {
  watching: boolean;
  watcherCount: number;
  /** Set when the ticket was created from a meeting action item. */
  sourceMeeting: { id: string; title: string } | null;
}

export interface TicketEvent {
  id: number;
  type: TicketEventType;
  actor: UserSummary | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface Comment {
  id: string;
  ticketId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentResponse {
  comment: Comment;
  /** Mentioned usernames that were not notified because they do not exist or cannot see the ticket. */
  unresolvedMentions: string[];
}

// ---------------------------------------------------------------- notifications

export interface NotificationData {
  ticketKey?: string;
  ticketTitle?: string;
  projectKey?: string;
  from?: string;
  to?: string;
  excerpt?: string;
  role?: Role;
  scopeLabel?: string;
  pitchId?: string;
  pitchTitle?: string;
  response?: string;
  pageId?: string;
  pageTitle?: string;
  meetingId?: string;
  meetingTitle?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  actor: UserSummary | null;
  data: NotificationData;
  readAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- pages

export interface PageSummary {
  id: string;
  projectId: string;
  projectKey: string;
  clientId: string;
  ticketId: string | null;
  ticketKey: string | null;
  title: string;
  visibility: Visibility;
  version: number;
  updatedBy: UserSummary;
  updatedAt: string;
}

export interface Page extends PageSummary {
  body: string;
  createdBy: UserSummary;
  createdAt: string;
}

export interface PageVersion {
  version: number;
  title: string;
  body: string;
  createdBy: UserSummary;
  createdAt: string;
}

// ---------------------------------------------------------------- pitches

export interface Pitch {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectKey: string | null;
  title: string;
  summary: string;
  proposal: string;
  estimateHours: number | null;
  status: PitchStatus;
  createdBy: UserSummary;
  sentBy: UserSummary | null;
  sentAt: string | null;
  respondedBy: UserSummary | null;
  respondedAt: string | null;
  /** True when a staff member recorded the client's answer on their behalf. */
  respondedOnBehalf: boolean;
  responseNote: string;
  sourceMeeting: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PitchComment {
  id: string;
  pitchId: string;
  author: UserSummary & { userType: UserType };
  body: string;
  visibility: Visibility;
  createdAt: string;
}

// ---------------------------------------------------------------- meetings

export interface MeetingSummary {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectKey: string | null;
  title: string;
  meetingDate: string;
  minutesVisibility: Visibility;
  openActionItems: number;
  createdBy: UserSummary;
  createdAt: string;
}

export interface Meeting extends MeetingSummary {
  attendees: string;
  /** Empty for client users: transcripts are internal. */
  transcript: string;
  minutes: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  title: string;
  description: string;
  suggestedAssignee: UserSummary | null;
  dueDate: string | null;
  status: ActionItemStatus;
  source: ActionItemSource;
  /** For AI suggestions: the words in the transcript the item came from. Empty otherwise. */
  sourceQuote: string;
  ticket: { id: string; key: string } | null;
  pitch: { id: string; title: string } | null;
  createdAt: string;
}

export interface SuggestActionItemsResult {
  /** The model that produced the suggestions, e.g. gpt-4o-2024-11-20. */
  model: string;
  created: ActionItem[];
  skipped: {
    /** Proposed items whose quote could not be found in the transcript. */
    unverified: number;
    /** Proposed items that repeat an existing action item. */
    duplicates: number;
  };
}

// ---------------------------------------------------------------- AI

/** What the web app may offer; AI is off until an administrator configures Azure OpenAI. */
export interface Features {
  ai: boolean;
}

export interface AiRun {
  id: string;
  task: AiTask;
  model: string;
  promptVersion: string;
  status: AiRunStatus;
  errorKind: string | null;
  requestedBy: UserSummary | null;
  meeting: { id: string; title: string } | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  createdAt: string;
}

/** The administrator's view of the AI connection. The API key is never sent. */
export interface AiStatus {
  enabled: boolean;
  provider: 'azure-openai' | null;
  endpointHost: string | null;
  deployment: string | null;
  apiVersion: string | null;
  recentRuns: AiRun[];
}

export interface AiTestResult {
  model: string;
  durationMs: number;
  /** json_schema: the deployment supports structured outputs; json_object: JSON mode only. */
  responseFormat: 'json_schema' | 'json_object';
}

// ---------------------------------------------------------------- audit, import

export interface AuditEntry {
  id: number;
  actor: UserSummary | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  data: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface ImportRowResult {
  /** 1-based row number in the file, counting the header as row 1. */
  row: number;
  title: string;
  errors: string[];
}

export interface ImportResult {
  dryRun: boolean;
  valid: boolean;
  totalRows: number;
  rows: ImportRowResult[];
  created: number;
}

// ---------------------------------------------------------------- dashboards

export interface StatusCount {
  status: TicketStatus;
  count: number;
}

export interface Dashboard {
  me: {
    openAssigned: number;
    dueThisWeek: number;
    overdue: number;
    tickets: Ticket[];
  };
  totals: {
    clients: number;
    projects: number;
    activeCycles: number;
    openTickets: number;
    overdueTickets: number;
    blockedTickets: number;
    completedLast7Days: number;
    pitchesAwaitingClient: number;
  };
  byStatus: StatusCount[];
  projects: {
    id: string;
    key: string;
    name: string;
    clientName: string;
    open: number;
    overdue: number;
    blocked: number;
    doneLast30Days: number;
  }[];
  activeCycles: {
    id: string;
    name: string;
    projectKey: string;
    startDate: string | null;
    endDate: string | null;
    total: number;
    done: number;
  }[];
}

/** Aggregated delivery progress for one project, safe to show to client users. */
export interface ProjectProgress {
  projectId: string;
  projectKey: string;
  projectName: string;
  status: ProjectStatus;
  targetDate: string | null;
  byStatus: StatusCount[];
  cycles: {
    id: string;
    name: string;
    status: CycleStatus;
    startDate: string | null;
    endDate: string | null;
    total: number;
    done: number;
  }[];
}

export interface PortalHome {
  client: { id: string; name: string };
  projects: ProjectProgress[];
  pitchesAwaitingResponse: Pitch[];
  recentPages: PageSummary[];
  recentMeetings: MeetingSummary[];
}
