import { and, asc, desc, eq, isNotNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  PITCH_EDITABLE_STATUSES,
  PITCH_FINAL_STATUSES,
  excerpt,
  type CreatePitchInput,
  type Pitch,
  type PitchComment,
  type PitchResponse,
  type PitchStatus,
  type ResourceScope,
  type UpdatePitchInput,
  type Visibility,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, meetings, pitchComments, pitches, projects, users } from '../../db/schema';
import type { Access } from '../../core/access/access';
import { usersWithPermissionAt } from '../../core/access/audience';
import { canSeeClient } from '../../core/access/navigation';
import { anyOf, coverageCondition } from '../../core/access/conditions';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { iso, requiredUserSummary, userSummary } from '../../core/dto';
import { notify } from '../notifications/notify';

const author = alias(users, 'pitch_author');
const sender = alias(users, 'pitch_sender');
const responder = alias(users, 'pitch_responder');

function selectPitches(db: Executor) {
  return db
    .select({
      pitch: pitches,
      clientName: clients.name,
      projectKey: projects.key,
      meetingTitle: meetings.title,
      createdBy: { id: author.id, username: author.username, displayName: author.displayName },
      sentBy: { id: sender.id, username: sender.username, displayName: sender.displayName },
      respondedBy: {
        id: responder.id,
        username: responder.username,
        displayName: responder.displayName,
      },
    })
    .from(pitches)
    .innerJoin(clients, eq(clients.id, pitches.clientId))
    .leftJoin(projects, eq(projects.id, pitches.projectId))
    .leftJoin(meetings, eq(meetings.id, pitches.sourceMeetingId))
    .innerJoin(author, eq(author.id, pitches.createdById))
    .leftJoin(sender, eq(sender.id, pitches.sentById))
    .leftJoin(responder, eq(responder.id, pitches.respondedById));
}

type PitchRow = Awaited<ReturnType<ReturnType<typeof selectPitches>['execute']>>[number];

const pitchScope = (row: {
  pitch: { clientId: string; projectId: string | null };
}): ResourceScope => ({
  clientId: row.pitch.clientId,
  projectId: row.pitch.projectId,
});

/** Client users see sent pitches only, and never the internal back-and-forth states. */
function clientFacingStatus(status: PitchStatus): PitchStatus {
  return status === 'draft' || status === 'in_review' ? 'changes_requested' : status;
}

function toPitch(row: PitchRow, access: Access): Pitch {
  const p = row.pitch;
  const staffView = access.can('pitch.read', pitchScope(row));
  return {
    id: p.id,
    clientId: p.clientId,
    clientName: row.clientName,
    projectId: p.projectId,
    projectKey: row.projectKey,
    title: p.title,
    summary: p.summary,
    proposal: p.proposal,
    estimateHours: p.estimateHours,
    status: staffView ? p.status : clientFacingStatus(p.status),
    createdBy: requiredUserSummary(row.createdBy),
    sentBy: userSummary(row.sentBy),
    sentAt: iso(p.sentAt),
    respondedBy: userSummary(row.respondedBy),
    respondedAt: iso(p.respondedAt),
    respondedOnBehalf: p.respondedOnBehalf,
    responseNote: p.responseNote,
    sourceMeeting:
      staffView && p.sourceMeetingId && row.meetingTitle
        ? { id: p.sourceMeetingId, title: row.meetingTitle }
        : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function canReadPitch(access: Access, row: PitchRow): boolean {
  const scope = pitchScope(row);
  return (
    access.can('pitch.read', scope) ||
    (row.pitch.sentAt !== null && access.can('shared.read', scope))
  );
}

function readablePitchesCondition(access: Access): SQL | undefined {
  const staff = coverageCondition(access.coverage('pitch.read'), {
    clientId: pitches.clientId,
    projectId: pitches.projectId,
  });
  if (staff === undefined) return undefined;
  const shared = coverageCondition(access.coverage('shared.read'), {
    clientId: pitches.clientId,
    projectId: pitches.projectId,
  });
  return anyOf([staff, and(isNotNull(pitches.sentAt), shared)]);
}

async function requirePitch(ctx: RequestContext, pitchId: string): Promise<PitchRow> {
  const [row] = await selectPitches(ctx.db).where(eq(pitches.id, pitchId)).limit(1);
  if (!row || !canReadPitch(ctx.access, row)) throw notFound('Pitch');
  return row;
}

async function loadPitch(ctx: RequestContext, pitchId: string): Promise<Pitch> {
  return toPitch(await requirePitch(ctx, pitchId), ctx.access);
}

async function resolvePitchScope(
  ctx: RequestContext,
  clientId: string,
  projectId: string | null | undefined,
) {
  if (!projectId) return { clientId, projectId: null } satisfies ResourceScope;
  const [project] = await ctx.db
    .select({ clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project || project.clientId !== clientId)
    throw badRequest('That project does not belong to this client.');
  return { clientId, projectId } satisfies ResourceScope;
}

export async function listPitches(
  ctx: RequestContext,
  filter: { clientId?: string; projectId?: string },
): Promise<Pitch[]> {
  const rows = await selectPitches(ctx.db)
    .where(
      and(
        readablePitchesCondition(ctx.access),
        filter.clientId ? eq(pitches.clientId, filter.clientId) : undefined,
        filter.projectId ? eq(pitches.projectId, filter.projectId) : undefined,
      ),
    )
    .orderBy(desc(pitches.updatedAt));
  return rows.map((row) => toPitch(row, ctx.access));
}

export async function getPitch(ctx: RequestContext, pitchId: string): Promise<Pitch> {
  return loadPitch(ctx, pitchId);
}

/** Creates a draft. Used directly and when a meeting action item becomes a pitch. */
export async function insertPitch(
  tx: Executor,
  params: {
    clientId: string;
    projectId: string | null;
    title: string;
    summary: string;
    proposal: string;
    estimateHours: number | null;
    createdById: string;
    sourceMeetingId?: string | null;
  },
): Promise<string> {
  const [created] = await tx
    .insert(pitches)
    .values({ ...params, sourceMeetingId: params.sourceMeetingId ?? null })
    .returning({ id: pitches.id });
  return created!.id;
}

export async function createPitch(
  ctx: RequestContext,
  input: CreatePitchInput & { summary: string; proposal: string },
): Promise<Pitch> {
  if (!(await canSeeClient(ctx.db, ctx.access, input.clientId))) throw notFound('Client');
  const scope = await resolvePitchScope(ctx, input.clientId, input.projectId);
  ctx.access.require('pitch.write', scope, 'You cannot write pitches for this client.');
  const id = await insertPitch(ctx.db, {
    clientId: input.clientId,
    projectId: input.projectId ?? null,
    title: input.title,
    summary: input.summary,
    proposal: input.proposal,
    estimateHours: input.estimateHours ?? null,
    createdById: ctx.user.id,
  });
  return loadPitch(ctx, id);
}

export async function updatePitch(
  ctx: RequestContext,
  pitchId: string,
  input: UpdatePitchInput,
): Promise<Pitch> {
  const row = await requirePitch(ctx, pitchId);
  ctx.access.require('pitch.write', pitchScope(row), 'You cannot edit this pitch.');
  if (!PITCH_EDITABLE_STATUSES.includes(row.pitch.status)) {
    throw conflict(
      'Only drafts and pitches with requested changes can be edited.',
      'PITCH_NOT_EDITABLE',
    );
  }
  if (input.projectId !== undefined) {
    const scope = await resolvePitchScope(ctx, row.pitch.clientId, input.projectId);
    ctx.access.require('pitch.write', scope);
  }
  await ctx.db
    .update(pitches)
    .set({
      projectId: input.projectId,
      title: input.title,
      summary: input.summary,
      proposal: input.proposal,
      estimateHours: input.estimateHours,
    })
    .where(eq(pitches.id, pitchId));
  return loadPitch(ctx, pitchId);
}

function requireStatus(row: PitchRow, allowed: readonly PitchStatus[], action: string) {
  if (!allowed.includes(row.pitch.status)) {
    throw conflict(
      `This pitch cannot be ${action} while it is ${row.pitch.status.replace('_', ' ')}.`,
      'INVALID_PITCH_STATE',
    );
  }
}

/** The team asks a Project Manager to review the pitch before it goes to the client. */
export async function submitPitch(ctx: RequestContext, pitchId: string): Promise<Pitch> {
  const row = await requirePitch(ctx, pitchId);
  const scope = pitchScope(row);
  ctx.access.require('pitch.write', scope, 'You cannot submit this pitch.');
  requireStatus(row, PITCH_EDITABLE_STATUSES, 'submitted');
  await ctx.db.transaction(async (tx) => {
    await tx.update(pitches).set({ status: 'in_review' }).where(eq(pitches.id, pitchId));
    await notify(tx, {
      recipients: await usersWithPermissionAt(tx, scope, 'pitch.approve'),
      type: 'pitch_submitted',
      actorId: ctx.user.id,
      data: { pitchId, pitchTitle: row.pitch.title },
    });
  });
  return loadPitch(ctx, pitchId);
}

/** A Project Manager sends the pitch to the client, or returns it to the team. */
export async function reviewPitch(
  ctx: RequestContext,
  pitchId: string,
  input: { decision: 'send' | 'return'; note: string },
): Promise<Pitch> {
  const row = await requirePitch(ctx, pitchId);
  const scope = pitchScope(row);
  ctx.access.require('pitch.approve', scope, 'Only Project Managers can approve pitches.');
  requireStatus(row, ['in_review'], input.decision === 'send' ? 'sent' : 'returned');
  const now = new Date();
  await ctx.db.transaction(async (tx) => {
    if (input.decision === 'send') {
      await tx
        .update(pitches)
        .set({
          status: 'sent',
          sentAt: row.pitch.sentAt ?? now,
          sentById: ctx.user.id,
          respondedAt: null,
          respondedById: null,
          respondedOnBehalf: false,
          responseNote: '',
        })
        .where(eq(pitches.id, pitchId));
      await notify(tx, {
        recipients: await usersWithPermissionAt(tx, scope, 'pitch.respond'),
        type: 'pitch_sent',
        actorId: ctx.user.id,
        data: { pitchId, pitchTitle: row.pitch.title },
      });
      await recordAudit(tx, {
        actorId: ctx.user.id,
        action: 'pitch.sent',
        entityType: 'pitch',
        entityId: pitchId,
        data: { title: row.pitch.title },
        ip: ctx.ip,
      });
    } else {
      await tx.update(pitches).set({ status: 'draft' }).where(eq(pitches.id, pitchId));
      if (input.note.trim()) {
        await tx.insert(pitchComments).values({
          pitchId,
          authorId: ctx.user.id,
          body: input.note.trim(),
          visibility: 'internal',
        });
      }
      await notify(tx, {
        recipients: [row.pitch.createdById],
        type: 'pitch_commented',
        actorId: ctx.user.id,
        data: {
          pitchId,
          pitchTitle: row.pitch.title,
          excerpt: excerpt(input.note || 'Returned for changes'),
        },
      });
    }
  });
  return loadPitch(ctx, pitchId);
}

/**
 * The client's answer. Client users respond themselves; a Project Manager can record an answer
 * given another way (e-mail, a call), which is flagged as recorded on the client's behalf.
 */
export async function respondToPitch(
  ctx: RequestContext,
  pitchId: string,
  input: { response: PitchResponse; note: string },
): Promise<Pitch> {
  const row = await requirePitch(ctx, pitchId);
  const scope = pitchScope(row);
  const asClient = ctx.access.can('pitch.respond', scope);
  const onBehalf = !asClient && ctx.access.can('pitch.approve', scope);
  if (!asClient && !onBehalf) throw forbidden('Only the client can respond to this pitch.');
  requireStatus(row, ['sent'], 'answered');
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(pitches)
      .set({
        status: input.response,
        respondedAt: new Date(),
        respondedById: ctx.user.id,
        respondedOnBehalf: onBehalf,
        responseNote: input.note.trim(),
      })
      .where(eq(pitches.id, pitchId));
    const team = await usersWithPermissionAt(tx, scope, 'pitch.approve');
    await notify(tx, {
      recipients: [
        row.pitch.createdById,
        ...(row.pitch.sentById ? [row.pitch.sentById] : []),
        ...team,
      ],
      type: 'pitch_responded',
      actorId: ctx.user.id,
      data: { pitchId, pitchTitle: row.pitch.title, response: input.response },
    });
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'pitch.responded',
      entityType: 'pitch',
      entityId: pitchId,
      data: { response: input.response, onBehalf },
      ip: ctx.ip,
    });
  });
  return loadPitch(ctx, pitchId);
}

export async function withdrawPitch(ctx: RequestContext, pitchId: string): Promise<Pitch> {
  const row = await requirePitch(ctx, pitchId);
  ctx.access.require(
    'pitch.approve',
    pitchScope(row),
    'Only Project Managers can withdraw pitches.',
  );
  if (PITCH_FINAL_STATUSES.includes(row.pitch.status)) {
    throw conflict('This pitch is already closed.', 'INVALID_PITCH_STATE');
  }
  await ctx.db.transaction(async (tx) => {
    await tx.update(pitches).set({ status: 'withdrawn' }).where(eq(pitches.id, pitchId));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'pitch.withdrawn',
      entityType: 'pitch',
      entityId: pitchId,
      data: { title: row.pitch.title },
      ip: ctx.ip,
    });
  });
  return loadPitch(ctx, pitchId);
}

// ------------------------------------------------------------------ comments

export async function listPitchComments(
  ctx: RequestContext,
  pitchId: string,
): Promise<PitchComment[]> {
  const row = await requirePitch(ctx, pitchId);
  const staffView = ctx.access.can('pitch.read', pitchScope(row));
  const rows = await ctx.db
    .select({
      comment: pitchComments,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        userType: users.userType,
      },
    })
    .from(pitchComments)
    .innerJoin(users, eq(users.id, pitchComments.authorId))
    .where(
      and(
        eq(pitchComments.pitchId, pitchId),
        staffView ? undefined : eq(pitchComments.visibility, 'client'),
      ),
    )
    .orderBy(asc(pitchComments.createdAt));
  return rows.map((r) => ({
    id: r.comment.id,
    pitchId: r.comment.pitchId,
    author: r.author,
    body: r.comment.body,
    visibility: r.comment.visibility,
    createdAt: r.comment.createdAt.toISOString(),
  }));
}

export async function addPitchComment(
  ctx: RequestContext,
  pitchId: string,
  input: { body: string; visibility: Visibility },
): Promise<PitchComment> {
  const row = await requirePitch(ctx, pitchId);
  const scope = pitchScope(row);
  const staff = ctx.access.can('pitch.read', scope) && ctx.access.can('comment.create', scope);
  const client = ctx.access.can('pitch.comment', scope);
  if (!staff && !client) throw forbidden('You cannot comment on this pitch.');
  // Client comments are always visible to the client; the team shares explicitly.
  const visibility: Visibility = client ? 'client' : input.visibility;
  if (visibility === 'client' && !row.pitch.sentAt) {
    throw badRequest(
      'The client cannot see this pitch yet, so comments stay internal until it is sent.',
    );
  }

  const [created] = await ctx.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(pitchComments)
      .values({ pitchId, authorId: ctx.user.id, body: input.body, visibility })
      .returning();
    const team = [row.pitch.createdById, ...(row.pitch.sentById ? [row.pitch.sentById] : [])];
    const recipients =
      visibility === 'client'
        ? [...team, ...(await usersWithPermissionAt(tx, scope, 'pitch.comment'))]
        : team;
    await notify(tx, {
      recipients,
      type: 'pitch_commented',
      actorId: ctx.user.id,
      data: { pitchId, pitchTitle: row.pitch.title, excerpt: excerpt(input.body) },
    });
    return inserted;
  });
  return {
    id: created!.id,
    pitchId,
    author: {
      id: ctx.user.id,
      username: ctx.user.username,
      displayName: ctx.user.displayName,
      userType: ctx.user.userType,
    },
    body: created!.body,
    visibility: created!.visibility,
    createdAt: created!.createdAt.toISOString(),
  };
}
