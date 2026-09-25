/**
 * Request payload schemas. The API validates every body and query with these,
 * and the web app reuses them for form validation.
 */
import { z } from 'zod';
import {
  CYCLE_STATUSES,
  DOC_TYPES,
  PITCH_RESPONSES,
  PROJECT_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  VISIBILITIES,
} from './constants';
import { ROLES, SCOPE_TYPES, USER_TYPES, isRoleAllowedAtScope } from './rbac';

export const idSchema = z.guid();

/** 3–32 chars, lowercase, starts with a letter, ends with a letter or digit. */
export const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{1,30}[a-z0-9]$/;
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    'Use 3–32 lowercase letters, digits, dots, dashes or underscores, starting with a letter',
  );

export const PASSWORD_MIN_LENGTH = 10;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200);

export const displayNameSchema = z.string().trim().min(1, 'Required').max(100);
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email address'));

/** 2–10 characters, uppercase letters and digits, starting with a letter. Used in ticket keys. */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PROJECT_KEY_PATTERN, 'Use 2–10 uppercase letters or digits, starting with a letter');

export const dateSchema = z.iso.date();
const nameSchema = z.string().trim().min(1, 'Required').max(200);
const shortText = z.string().max(2000);
const longText = z.string().max(20000);
const hoursSchema = z.number().min(0).max(10000);
const visibilitySchema = z.enum(VISIBILITIES);

// ---------------------------------------------------------------- auth & users

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Required').max(254),
  password: z.string().min(1, 'Required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required').max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createUserSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    email: emailSchema.nullish(),
    /** Staff are agency employees; client users belong to one client company. */
    userType: z.enum(USER_TYPES).default('staff'),
    /** Required for client users: the company they belong to. */
    clientId: idSchema.nullish(),
    isAdmin: z.boolean().default(false),
    /** Omit to have the server generate a temporary password. */
    password: passwordSchema.optional(),
  })
  .refine((value) => (value.userType === 'client') === (value.clientId != null), {
    message: 'Client users need a client company; staff users must not have one',
    path: ['clientId'],
  })
  .refine((value) => !(value.userType === 'client' && value.isAdmin), {
    message: 'Client users cannot be administrators',
    path: ['isAdmin'],
  });
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: displayNameSchema.optional(),
  email: emailSchema.nullish(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: passwordSchema.optional(),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  userType: z.enum(USER_TYPES).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const grantRoleSchema = z
  .object({
    userId: idSchema,
    role: z.enum(ROLES),
    scopeType: z.enum(SCOPE_TYPES),
    scopeId: idSchema.nullable(),
  })
  .refine((value) => (value.scopeType === 'workspace') === (value.scopeId === null), {
    message: 'Workspace grants have no scope id; every other scope needs one',
    path: ['scopeId'],
  })
  .refine((value) => isRoleAllowedAtScope(value.role, value.scopeType), {
    message: 'This role cannot be granted at this scope',
    path: ['role'],
  });
export type GrantRoleInput = z.infer<typeof grantRoleSchema>;

export const scopeQuerySchema = z
  .object({
    scopeType: z.enum(SCOPE_TYPES),
    scopeId: idSchema.optional(),
  })
  .refine((value) => (value.scopeType === 'workspace') === (value.scopeId === undefined), {
    message: 'Workspace has no scope id; every other scope needs one',
    path: ['scopeId'],
  });

// ---------------------------------------------------------------- clients, projects, cycles

export const createClientSchema = z.object({
  name: nameSchema,
  description: shortText.default(''),
});
export type CreateClientInput = z.input<typeof createClientSchema>;

export const updateClientSchema = z.object({
  name: nameSchema.optional(),
  description: shortText.optional(),
  archived: z.boolean().optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const createProjectSchema = z.object({
  clientId: idSchema,
  key: projectKeySchema,
  name: nameSchema,
  description: shortText.default(''),
  startDate: dateSchema.nullish(),
  targetDate: dateSchema.nullish(),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: nameSchema.optional(),
  description: shortText.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: dateSchema.nullish(),
  targetDate: dateSchema.nullish(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

function endNotBeforeStart(value: { startDate?: string | null; endDate?: string | null }) {
  return !value.startDate || !value.endDate || value.endDate >= value.startDate;
}

export const createCycleSchema = z
  .object({
    name: nameSchema,
    goal: shortText.default(''),
    startDate: dateSchema.nullish(),
    endDate: dateSchema.nullish(),
    status: z.enum(CYCLE_STATUSES).default('planned'),
  })
  .refine(endNotBeforeStart, { message: 'End date is before start date', path: ['endDate'] });
export type CreateCycleInput = z.input<typeof createCycleSchema>;

export const updateCycleSchema = z
  .object({
    name: nameSchema.optional(),
    goal: shortText.optional(),
    startDate: dateSchema.nullish(),
    endDate: dateSchema.nullish(),
    status: z.enum(CYCLE_STATUSES).optional(),
  })
  .refine(endNotBeforeStart, { message: 'End date is before start date', path: ['endDate'] });
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;

export const completeCycleSchema = z.object({
  /** Where unfinished tickets go: the project backlog or another cycle of the same project. */
  moveOpenTicketsTo: z.union([z.literal('backlog'), idSchema]).default('backlog'),
});
export type CompleteCycleInput = z.input<typeof completeCycleSchema>;

// ---------------------------------------------------------------- tickets & comments

const labelSchema = z.string().trim().min(1).max(30);
const labelsSchema = z
  .array(labelSchema)
  .max(10)
  .transform((labels) => [...new Set(labels)]);

export const createTicketSchema = z.object({
  title: nameSchema,
  description: longText.default(''),
  type: z.enum(TICKET_TYPES).default('task'),
  status: z.enum(TICKET_STATUSES).default('todo'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  assigneeId: idSchema.nullish(),
  cycleId: idSchema.nullish(),
  dueDate: dateSchema.nullish(),
  estimateHours: hoursSchema.nullish(),
  labels: labelsSchema.default([]),
});
export type CreateTicketInput = z.input<typeof createTicketSchema>;

export const updateTicketSchema = z
  .object({
    title: nameSchema.optional(),
    description: longText.optional(),
    type: z.enum(TICKET_TYPES).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assigneeId: idSchema.nullish(),
    cycleId: idSchema.nullish(),
    dueDate: dateSchema.nullish(),
    estimateHours: hoursSchema.nullish(),
    labels: labelsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Nothing to update',
  });
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

const csvList = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .transform((raw) =>
      raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)));

export const ticketListQuerySchema = z.object({
  status: csvList(TICKET_STATUSES).optional(),
  priority: csvList(TICKET_PRIORITIES).optional(),
  type: csvList(TICKET_TYPES).optional(),
  /** A cycle id, or "backlog" for tickets without a cycle. */
  cycle: z.union([z.literal('backlog'), idSchema]).optional(),
  /** A user id, "me", or "none" for unassigned tickets. */
  assignee: z.union([z.literal('me'), z.literal('none'), idSchema]).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});
export type TicketListQuery = z.input<typeof ticketListQuerySchema>;

export const commentBodySchema = z.object({
  body: z.string().trim().min(1, 'Required').max(10000),
});
export type CommentBodyInput = z.infer<typeof commentBodySchema>;

// ---------------------------------------------------------------- pages

export const createPageSchema = z.object({
  title: nameSchema,
  body: z.string().max(200000).default(''),
  ticketId: idSchema.nullish(),
});
export type CreatePageInput = z.input<typeof createPageSchema>;

export const updatePageSchema = z.object({
  title: nameSchema.optional(),
  body: z.string().max(200000).optional(),
  ticketId: idSchema.nullish(),
  /** The version the edit was based on; a mismatch means someone else saved first. */
  expectedVersion: z.number().int().min(1),
});
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

/** A document the AI writes from a developer's notes, optionally with project context. */
export const draftPageSchema = z.object({
  docType: z.enum(DOC_TYPES),
  /** Empty: the AI suggests one. */
  title: z.string().trim().max(200).default(''),
  brief: z
    .string()
    .trim()
    .min(40, 'Describe it in a few sentences (at least 40 characters)')
    .max(20000),
  /** Include this cycle and its tickets. */
  cycleId: idSchema.nullish(),
  ticketKeys: z.array(z.string().trim().min(3).max(24)).max(30).default([]),
  meetingIds: z.array(idSchema).max(5).default([]),
  pageIds: z.array(idSchema).max(5).default([]),
});
export type DraftPageInput = z.input<typeof draftPageSchema>;

/** Share with the client or make internal again (pages and meeting minutes). */
export const visibilitySchemaInput = z.object({
  visibility: visibilitySchema,
});
export type VisibilityInput = z.infer<typeof visibilitySchemaInput>;

// ---------------------------------------------------------------- pitches

export const createPitchSchema = z.object({
  clientId: idSchema,
  /** Optional: a pitch can propose work for an existing project or a brand-new engagement. */
  projectId: idSchema.nullish(),
  title: nameSchema,
  summary: longText.default(''),
  proposal: longText.default(''),
  estimateHours: hoursSchema.nullish(),
});
export type CreatePitchInput = z.input<typeof createPitchSchema>;

export const updatePitchSchema = z
  .object({
    projectId: idSchema.nullish(),
    title: nameSchema.optional(),
    summary: longText.optional(),
    proposal: longText.optional(),
    estimateHours: hoursSchema.nullish(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Nothing to update',
  });
export type UpdatePitchInput = z.infer<typeof updatePitchSchema>;

export const pitchReviewSchema = z.object({
  /** Approve and send to the client, or return the draft to its authors. */
  decision: z.enum(['send', 'return']),
  note: shortText.default(''),
});
export type PitchReviewInput = z.input<typeof pitchReviewSchema>;

export const pitchResponseSchema = z.object({
  response: z.enum(PITCH_RESPONSES),
  note: shortText.default(''),
});
export type PitchResponseInput = z.input<typeof pitchResponseSchema>;

export const pitchCommentSchema = z.object({
  body: z.string().trim().min(1, 'Required').max(10000),
  /** Staff choose; comments by client users are always visible to the client. */
  visibility: visibilitySchema.default('internal'),
});
export type PitchCommentInput = z.input<typeof pitchCommentSchema>;

export const pitchListQuerySchema = z.object({
  clientId: idSchema.optional(),
  projectId: idSchema.optional(),
});

// ---------------------------------------------------------------- meetings

export const createMeetingSchema = z.object({
  clientId: idSchema,
  projectId: idSchema.nullish(),
  title: nameSchema,
  meetingDate: dateSchema,
  /** Free text, one name per line or comma separated; client-side attendees included. */
  attendees: shortText.default(''),
  /** Raw transcript as pasted or uploaded. Always internal. */
  transcript: z.string().max(500000).default(''),
  /** Minutes of meeting in Markdown. Can be shared with the client. */
  minutes: longText.default(''),
});
export type CreateMeetingInput = z.input<typeof createMeetingSchema>;

export const updateMeetingSchema = z
  .object({
    projectId: idSchema.nullish(),
    title: nameSchema.optional(),
    meetingDate: dateSchema.optional(),
    attendees: shortText.optional(),
    transcript: z.string().max(500000).optional(),
    minutes: longText.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Nothing to update',
  });
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

export const meetingListQuerySchema = z.object({
  clientId: idSchema.optional(),
  projectId: idSchema.optional(),
});

export const createActionItemSchema = z.object({
  title: nameSchema,
  description: longText.default(''),
  suggestedAssigneeId: idSchema.nullish(),
  dueDate: dateSchema.nullish(),
});
export type CreateActionItemInput = z.input<typeof createActionItemSchema>;

export const updateActionItemSchema = z
  .object({
    title: nameSchema.optional(),
    description: longText.optional(),
    suggestedAssigneeId: idSchema.nullish(),
    dueDate: dateSchema.nullish(),
    status: z.enum(['open', 'dismissed']).optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Nothing to update',
  });
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;

/** Turn open action items into tickets in one go. */
export const convertActionItemsSchema = z.object({
  projectId: idSchema,
  cycleId: idSchema.nullish(),
  items: z
    .array(
      z.object({
        actionItemId: idSchema,
        type: z.enum(TICKET_TYPES).default('task'),
        priority: z.enum(TICKET_PRIORITIES).default('medium'),
        assigneeId: idSchema.nullish(),
      }),
    )
    .min(1, 'Choose at least one action item')
    .max(100),
});
export type ConvertActionItemsInput = z.input<typeof convertActionItemsSchema>;

// ---------------------------------------------------------------- import, pagination

export const importTicketsSchema = z.object({
  csv: z.string().min(1, 'The file is empty').max(2_000_000, 'The file is larger than 2 MB'),
  /** Validate only; nothing is written. */
  dryRun: z.boolean().default(true),
});
export type ImportTicketsInput = z.input<typeof importTicketsSchema>;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** ISO timestamp; returns items created strictly before it. */
  before: z.iso.datetime({ offset: true }).optional(),
});

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const auditListQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  actorId: idSchema.optional(),
});

// ---------------------------------------------------------------- AI settings

/** The Azure OpenAI connection an administrator enters. The key is write-only. */
export const aiSettingsSchema = z.object({
  endpoint: z.string().trim().min(1, 'Required').max(300),
  deployment: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(64)
    .regex(/^[\w.-]+$/, 'Use the deployment name exactly as it appears in Azure'),
  apiVersion: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}(-preview)?$/, 'Use a version such as 2024-10-21')
    .default('2024-10-21'),
  /** Leave out to keep the key that is already saved. */
  apiKey: z.string().trim().min(8, 'This does not look like an API key').max(500).optional(),
});
export type AiSettingsInput = z.input<typeof aiSettingsSchema>;
