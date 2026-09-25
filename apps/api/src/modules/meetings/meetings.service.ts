import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  formatTicketKey,
  type ActionItem,
  type CreateActionItemInput,
  type CreateMeetingInput,
  type Meeting,
  type MeetingSummary,
  type ResourceScope,
  type Ticket,
  type UpdateActionItemInput,
  type UpdateMeetingInput,
  type Visibility,
  type convertActionItemsSchema,
} from '@helm/shared';
import type { z } from 'zod';
import type { Executor } from '../../db/client';
import {
  clients,
  cycles,
  meetingActionItems,
  meetings,
  pitches,
  projects,
  tickets,
  users,
} from '../../db/schema';
import type { Access } from '../../core/access/access';
import { usersWithPermissionAt } from '../../core/access/audience';
import { canSeeClient } from '../../core/access/navigation';
import { anyOf, coverageCondition } from '../../core/access/conditions';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { qualified } from '../../core/sql';
import { badRequest, conflict, notFound } from '../../core/errors';
import { requiredUserSummary, userSummary } from '../../core/dto';
import { notify } from '../notifications/notify';
import { insertPitch } from '../pitches/pitches.service';

import { assertAssignable, selectTickets, toTicket } from '../tickets/tickets.queries';
import { insertTicket } from '../tickets/tickets.service';

const creator = alias(users, 'meeting_creator');

const openActionItems = sql<number>`(select count(*)::int from ${meetingActionItems} where ${meetingActionItems.meetingId} = ${qualified(meetings.id)} and ${meetingActionItems.status} = 'open')`;

function selectMeetings(db: Executor) {
  return db
    .select({
      meeting: meetings,
      clientName: clients.name,
      projectKey: projects.key,
      openActionItems,
      createdBy: { id: creator.id, username: creator.username, displayName: creator.displayName },
    })
    .from(meetings)
    .innerJoin(clients, eq(clients.id, meetings.clientId))
    .leftJoin(projects, eq(projects.id, meetings.projectId))
    .innerJoin(creator, eq(creator.id, meetings.createdById));
}

type MeetingRow = Awaited<ReturnType<ReturnType<typeof selectMeetings>['execute']>>[number];

const meetingScope = (row: {
  meeting: { clientId: string; projectId: string | null };
}): ResourceScope => ({
  clientId: row.meeting.clientId,
  projectId: row.meeting.projectId,
});

function isStaffReader(access: Access, row: MeetingRow) {
  return access.can('meeting.read', meetingScope(row));
}

function toSummary(row: MeetingRow, access: Access): MeetingSummary {
  const staff = isStaffReader(access, row);
  return {
    id: row.meeting.id,
    clientId: row.meeting.clientId,
    clientName: row.clientName,
    projectId: row.meeting.projectId,
    projectKey: row.projectKey,
    title: row.meeting.title,
    meetingDate: row.meeting.meetingDate,
    minutesVisibility: row.meeting.minutesVisibility,
    openActionItems: staff ? row.openActionItems : 0,
    createdBy: requiredUserSummary(row.createdBy),
    createdAt: row.meeting.createdAt.toISOString(),
  };
}

function toMeeting(row: MeetingRow, access: Access): Meeting {
  const staff = isStaffReader(access, row);
  return {
    ...toSummary(row, access),
    attendees: row.meeting.attendees,
    // Transcripts are internal working material and never reach client users.
    transcript: staff ? row.meeting.transcript : '',
    minutes: row.meeting.minutes,
    updatedAt: row.meeting.updatedAt.toISOString(),
  };
}

function readableMeetingsCondition(access: Access): SQL | undefined {
  const staff = coverageCondition(access.coverage('meeting.read'), {
    clientId: meetings.clientId,
    projectId: meetings.projectId,
  });
  if (staff === undefined) return undefined;
  const shared = coverageCondition(access.coverage('shared.read'), {
    clientId: meetings.clientId,
    projectId: meetings.projectId,
  });
  return anyOf([staff, and(eq(meetings.minutesVisibility, 'client'), shared)]);
}

async function requireMeeting(ctx: RequestContext, meetingId: string): Promise<MeetingRow> {
  const [row] = await selectMeetings(ctx.db).where(eq(meetings.id, meetingId)).limit(1);
  const scope = row ? meetingScope(row) : null;
  const readable =
    row &&
    scope &&
    (ctx.access.can('meeting.read', scope) ||
      (row.meeting.minutesVisibility === 'client' && ctx.access.can('shared.read', scope)));
  if (!row || !readable) throw notFound('Meeting');
  return row;
}

async function resolveMeetingScope(
  ctx: RequestContext,
  clientId: string,
  projectId: string | null | undefined,
): Promise<ResourceScope> {
  if (!projectId) return { clientId, projectId: null };
  const [project] = await ctx.db
    .select({ clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project || project.clientId !== clientId)
    throw badRequest('That project does not belong to this client.');
  return { clientId, projectId };
}

export async function listMeetings(
  ctx: RequestContext,
  filter: { clientId?: string; projectId?: string },
): Promise<MeetingSummary[]> {
  const rows = await selectMeetings(ctx.db)
    .where(
      and(
        readableMeetingsCondition(ctx.access),
        filter.clientId ? eq(meetings.clientId, filter.clientId) : undefined,
        filter.projectId ? eq(meetings.projectId, filter.projectId) : undefined,
      ),
    )
    .orderBy(desc(meetings.meetingDate), desc(meetings.createdAt));
  return rows.map((row) => toSummary(row, ctx.access));
}

export async function getMeeting(ctx: RequestContext, meetingId: string): Promise<Meeting> {
  return toMeeting(await requireMeeting(ctx, meetingId), ctx.access);
}

export async function createMeeting(
  ctx: RequestContext,
  input: CreateMeetingInput & { attendees: string; transcript: string; minutes: string },
): Promise<Meeting> {
  if (!(await canSeeClient(ctx.db, ctx.access, input.clientId))) throw notFound('Client');
  const scope = await resolveMeetingScope(ctx, input.clientId, input.projectId);
  ctx.access.require('meeting.write', scope, 'You cannot record meetings here.');
  const [created] = await ctx.db
    .insert(meetings)
    .values({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      title: input.title,
      meetingDate: input.meetingDate,
      attendees: input.attendees,
      transcript: input.transcript,
      minutes: input.minutes,
      createdById: ctx.user.id,
    })
    .returning({ id: meetings.id });
  return getMeeting(ctx, created!.id);
}

export async function updateMeeting(
  ctx: RequestContext,
  meetingId: string,
  input: UpdateMeetingInput,
): Promise<Meeting> {
  const row = await requireMeeting(ctx, meetingId);
  ctx.access.require('meeting.write', meetingScope(row), 'You cannot edit this meeting.');
  if (input.projectId !== undefined) {
    const scope = await resolveMeetingScope(ctx, row.meeting.clientId, input.projectId);
    ctx.access.require('meeting.write', scope);
  }
  await ctx.db
    .update(meetings)
    .set({
      projectId: input.projectId,
      title: input.title,
      meetingDate: input.meetingDate,
      attendees: input.attendees,
      transcript: input.transcript,
      minutes: input.minutes,
    })
    .where(eq(meetings.id, meetingId));
  return getMeeting(ctx, meetingId);
}

export async function setMinutesVisibility(
  ctx: RequestContext,
  meetingId: string,
  visibility: Visibility,
): Promise<Meeting> {
  const row = await requireMeeting(ctx, meetingId);
  const scope = meetingScope(row);
  ctx.access.require('content.share', scope, 'You cannot share minutes with the client.');
  if (visibility === 'client' && !row.meeting.minutes.trim()) {
    throw badRequest('Write the minutes before sharing them with the client.');
  }
  if (row.meeting.minutesVisibility !== visibility) {
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(meetings)
        .set({ minutesVisibility: visibility })
        .where(eq(meetings.id, meetingId));
      await recordAudit(tx, {
        actorId: ctx.user.id,
        action: 'meeting.visibility_changed',
        entityType: 'meeting',
        entityId: meetingId,
        data: { title: row.meeting.title, visibility },
        ip: ctx.ip,
      });
      if (visibility === 'client') {
        await notify(tx, {
          recipients: await usersWithPermissionAt(tx, scope, 'shared.read'),
          type: 'content_shared',
          actorId: ctx.user.id,
          data: { meetingId, meetingTitle: row.meeting.title },
        });
      }
    });
  }
  return getMeeting(ctx, meetingId);
}

export async function deleteMeeting(ctx: RequestContext, meetingId: string): Promise<void> {
  const row = await requireMeeting(ctx, meetingId);
  ctx.access.require('meeting.delete', meetingScope(row), 'You cannot delete this meeting.');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(meetings).where(eq(meetings.id, meetingId));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'meeting.deleted',
      entityType: 'meeting',
      entityId: meetingId,
      data: { title: row.meeting.title },
      ip: ctx.ip,
    });
  });
}

// ------------------------------------------------------------------ action items

const suggested = alias(users, 'suggested_assignee');

function selectActionItems(db: Executor) {
  return db
    .select({
      item: meetingActionItems,
      suggestedAssignee: {
        id: suggested.id,
        username: suggested.username,
        displayName: suggested.displayName,
      },
      ticketNumber: tickets.number,
      ticketProjectKey: projects.key,
      pitchTitle: pitches.title,
    })
    .from(meetingActionItems)
    .leftJoin(suggested, eq(suggested.id, meetingActionItems.suggestedAssigneeId))
    .leftJoin(tickets, eq(tickets.id, meetingActionItems.ticketId))
    .leftJoin(projects, eq(projects.id, tickets.projectId))
    .leftJoin(pitches, eq(pitches.id, meetingActionItems.pitchId));
}

type ActionItemRow = Awaited<ReturnType<ReturnType<typeof selectActionItems>['execute']>>[number];

function toActionItem(row: ActionItemRow): ActionItem {
  const i = row.item;
  return {
    id: i.id,
    meetingId: i.meetingId,
    title: i.title,
    description: i.description,
    suggestedAssignee: userSummary(row.suggestedAssignee),
    dueDate: i.dueDate,
    status: i.status,
    ticket:
      i.ticketId && row.ticketNumber != null && row.ticketProjectKey
        ? { id: i.ticketId, key: formatTicketKey(row.ticketProjectKey, row.ticketNumber) }
        : null,
    pitch: i.pitchId && row.pitchTitle ? { id: i.pitchId, title: row.pitchTitle } : null,
    createdAt: i.createdAt.toISOString(),
  };
}

/** Action items are internal: they need staff read access to the meeting. */
async function requireStaffMeeting(ctx: RequestContext, meetingId: string): Promise<MeetingRow> {
  const row = await requireMeeting(ctx, meetingId);
  if (!isStaffReader(ctx.access, row)) throw notFound('Meeting');
  return row;
}

async function requireActionItem(ctx: RequestContext, itemId: string) {
  const [item] = await ctx.db
    .select({ id: meetingActionItems.id, meetingId: meetingActionItems.meetingId })
    .from(meetingActionItems)
    .where(eq(meetingActionItems.id, itemId))
    .limit(1);
  if (!item) throw notFound('Action item');
  const meeting = await requireStaffMeeting(ctx, item.meetingId);
  return { item, meeting };
}

export async function listActionItems(
  ctx: RequestContext,
  meetingId: string,
): Promise<ActionItem[]> {
  await requireStaffMeeting(ctx, meetingId);
  const rows = await selectActionItems(ctx.db)
    .where(eq(meetingActionItems.meetingId, meetingId))
    .orderBy(asc(meetingActionItems.createdAt));
  return rows.map(toActionItem);
}

async function loadActionItem(db: Executor, itemId: string): Promise<ActionItem> {
  const [row] = await selectActionItems(db).where(eq(meetingActionItems.id, itemId)).limit(1);
  if (!row) throw notFound('Action item');
  return toActionItem(row);
}

export async function createActionItem(
  ctx: RequestContext,
  meetingId: string,
  input: CreateActionItemInput & { description: string },
): Promise<ActionItem> {
  const meeting = await requireStaffMeeting(ctx, meetingId);
  ctx.access.require('meeting.write', meetingScope(meeting), 'You cannot edit this meeting.');
  const [created] = await ctx.db
    .insert(meetingActionItems)
    .values({
      meetingId,
      title: input.title,
      description: input.description,
      suggestedAssigneeId: input.suggestedAssigneeId ?? null,
      dueDate: input.dueDate ?? null,
      createdById: ctx.user.id,
    })
    .returning({ id: meetingActionItems.id });
  return loadActionItem(ctx.db, created!.id);
}

export async function updateActionItem(
  ctx: RequestContext,
  itemId: string,
  input: UpdateActionItemInput,
): Promise<ActionItem> {
  const { meeting } = await requireActionItem(ctx, itemId);
  ctx.access.require('meeting.write', meetingScope(meeting), 'You cannot edit this meeting.');
  const [current] = await ctx.db
    .select()
    .from(meetingActionItems)
    .where(eq(meetingActionItems.id, itemId));
  if (current!.status === 'converted')
    throw conflict('This action item was already converted.', 'ALREADY_CONVERTED');
  await ctx.db
    .update(meetingActionItems)
    .set({
      title: input.title,
      description: input.description,
      suggestedAssigneeId: input.suggestedAssigneeId,
      dueDate: input.dueDate,
      status: input.status,
    })
    .where(eq(meetingActionItems.id, itemId));
  return loadActionItem(ctx.db, itemId);
}

export async function deleteActionItem(ctx: RequestContext, itemId: string): Promise<void> {
  const { meeting } = await requireActionItem(ctx, itemId);
  ctx.access.require('meeting.write', meetingScope(meeting), 'You cannot edit this meeting.');
  await ctx.db.delete(meetingActionItems).where(eq(meetingActionItems.id, itemId));
}

/**
 * Turns selected open action items into tickets in one transaction. The Team Lead (or anyone who
 * may create tickets in the target project/cycle) picks type, priority and assignee per item.
 */
export async function convertActionItems(
  ctx: RequestContext,
  meetingId: string,
  input: z.output<typeof convertActionItemsSchema>,
): Promise<Ticket[]> {
  const meeting = await requireStaffMeeting(ctx, meetingId);
  const [project] = await ctx.db
    .select({ id: projects.id, key: projects.key, clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project || project.clientId !== meeting.meeting.clientId) {
    throw badRequest('Tickets must go to a project of the same client.');
  }
  if (input.cycleId) {
    const [cycle] = await ctx.db
      .select({ projectId: cycles.projectId })
      .from(cycles)
      .where(eq(cycles.id, input.cycleId))
      .limit(1);
    if (!cycle || cycle.projectId !== project.id)
      throw badRequest('That cycle does not belong to the project.');
  }
  const scope: ResourceScope = {
    clientId: project.clientId,
    projectId: project.id,
    cycleId: input.cycleId ?? null,
  };
  ctx.access.require('ticket.create', scope, 'You cannot create tickets in that project.');

  const itemIds = input.items.map((item) => item.actionItemId);
  if (new Set(itemIds).size !== itemIds.length)
    throw badRequest('Each action item can only be converted once.');
  const items = await ctx.db
    .select()
    .from(meetingActionItems)
    .where(
      and(eq(meetingActionItems.meetingId, meetingId), inArray(meetingActionItems.id, itemIds)),
    );
  if (items.length !== itemIds.length)
    throw badRequest('Some action items do not belong to this meeting.');
  if (items.some((item) => item.status !== 'open')) {
    throw conflict('Only open action items can be converted.', 'ALREADY_CONVERTED');
  }
  for (const choice of input.items) {
    if (choice.assigneeId) await assertAssignable(ctx.db, choice.assigneeId, scope);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const createdIds = await ctx.db.transaction(async (tx) => {
    const ids: string[] = [];
    for (const choice of input.items) {
      const item = byId.get(choice.actionItemId)!;
      const created = await insertTicket(tx, {
        project,
        actorId: ctx.user.id,
        source: 'meeting',
        sourceMeetingId: meetingId,
        input: {
          title: item.title,
          description: item.description,
          type: choice.type,
          status: 'todo',
          priority: choice.priority,
          assigneeId: choice.assigneeId ?? null,
          cycleId: input.cycleId ?? null,
          dueDate: item.dueDate,
          estimateHours: null,
          labels: [],
        },
      });
      await tx
        .update(meetingActionItems)
        .set({ status: 'converted', ticketId: created.id })
        .where(eq(meetingActionItems.id, item.id));
      ids.push(created.id);
    }
    return ids;
  });
  const rows = await selectTickets(ctx.db).where(inArray(tickets.id, createdIds));
  return rows.map(toTicket).sort((a, b) => a.number - b.number);
}

/** Starts a pitch draft from an action item that is really a proposal for new work. */
export async function actionItemToPitch(
  ctx: RequestContext,
  itemId: string,
): Promise<{ pitchId: string }> {
  const { meeting } = await requireActionItem(ctx, itemId);
  const scope = meetingScope(meeting);
  ctx.access.require('pitch.write', scope, 'You cannot write pitches for this client.');
  const [item] = await ctx.db
    .select()
    .from(meetingActionItems)
    .where(eq(meetingActionItems.id, itemId));
  if (item!.status !== 'open')
    throw conflict('Only open action items can be converted.', 'ALREADY_CONVERTED');
  const pitchId = await ctx.db.transaction(async (tx) => {
    const id = await insertPitch(tx, {
      clientId: meeting.meeting.clientId,
      projectId: meeting.meeting.projectId,
      title: item!.title,
      summary: item!.description,
      proposal: '',
      estimateHours: null,
      createdById: ctx.user.id,
      sourceMeetingId: meeting.meeting.id,
    });
    await tx
      .update(meetingActionItems)
      .set({ status: 'converted', pitchId: id })
      .where(eq(meetingActionItems.id, itemId));
    return id;
  });
  return { pitchId };
}
