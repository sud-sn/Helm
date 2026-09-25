import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  excerpt,
  extractMentions,
  formatTicketKey,
  hasPermission,
  type Comment,
  type CreateCommentResponse,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { comments, projects, tickets, users } from '../../db/schema';
import { loadGrants } from '../../core/access/access';
import type { RequestContext } from '../../core/context';
import { forbidden, notFound } from '../../core/errors';
import { requiredUserSummary } from '../../core/dto';
import { notify } from '../notifications/notify';
import { addWatchers, requireReadableTicket, ticketScope, watcherIds } from './tickets.queries';

function selectComments(db: Executor) {
  return db
    .select({
      id: comments.id,
      ticketId: comments.ticketId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId));
}

type CommentRow = Awaited<ReturnType<ReturnType<typeof selectComments>['execute']>>[number];

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    ticketId: row.ticketId,
    author: requiredUserSummary(row.author),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listComments(ctx: RequestContext, ticketKey: string): Promise<Comment[]> {
  const ticket = await requireReadableTicket(ctx.db, ctx.access, ticketKey);
  const rows = await selectComments(ctx.db)
    .where(eq(comments.ticketId, ticket.ticket.id))
    .orderBy(asc(comments.createdAt));
  return rows.map(toComment);
}

/**
 * Adds a comment. @mentions notify people who can read the ticket (others are reported back as
 * unresolved, so nothing leaks to people outside the scope); other watchers get a comment
 * notification. The author and mentioned people start watching the ticket.
 */
export async function addComment(
  ctx: RequestContext,
  ticketKey: string,
  body: string,
): Promise<CreateCommentResponse> {
  const { db, access, user } = ctx;
  const ticket = await requireReadableTicket(db, access, ticketKey);
  const scope = ticketScope(ticket);
  access.require('comment.create', scope, 'You cannot comment on this ticket.');

  const handles = extractMentions(body).filter((handle) => handle !== user.username);
  const candidates =
    handles.length > 0
      ? await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(
            and(
              inArray(users.username, handles),
              eq(users.isActive, true),
              eq(users.userType, 'staff'),
            ),
          )
      : [];
  const mentioned: string[] = [];
  for (const candidate of candidates) {
    if (hasPermission(await loadGrants(db, candidate.id), scope, 'ticket.read'))
      mentioned.push(candidate.id);
  }
  const resolvedNames = new Set(
    candidates.filter((c) => mentioned.includes(c.id)).map((c) => c.username),
  );
  const unresolvedMentions = handles.filter((handle) => !resolvedNames.has(handle));

  const key = formatTicketKey(ticket.projectKey, ticket.ticket.number);
  const notificationData = {
    ticketKey: key,
    ticketTitle: ticket.ticket.title,
    projectKey: ticket.projectKey,
    excerpt: excerpt(body),
  };

  const commentId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(comments)
      .values({ ticketId: ticket.ticket.id, authorId: user.id, body })
      .returning({ id: comments.id });
    const watchers = await watcherIds(tx, ticket.ticket.id);
    await addWatchers(tx, ticket.ticket.id, [user.id, ...mentioned]);
    await notify(tx, {
      recipients: mentioned,
      type: 'mentioned',
      actorId: user.id,
      data: notificationData,
    });
    await notify(tx, {
      recipients: watchers.filter((id) => !mentioned.includes(id)),
      type: 'comment_added',
      actorId: user.id,
      data: notificationData,
    });
    return created!.id;
  });

  const [row] = await selectComments(db).where(eq(comments.id, commentId));
  return { comment: toComment(row!), unresolvedMentions };
}

async function requireComment(ctx: RequestContext, commentId: string) {
  const [row] = await ctx.db
    .select({
      comment: comments,
      scope: {
        clientId: projects.clientId,
        projectId: tickets.projectId,
        cycleId: tickets.cycleId,
      },
    })
    .from(comments)
    .innerJoin(tickets, eq(tickets.id, comments.ticketId))
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!row || !ctx.access.can('ticket.read', row.scope)) throw notFound('Comment');
  return row;
}

export async function editComment(
  ctx: RequestContext,
  commentId: string,
  body: string,
): Promise<Comment> {
  const { comment } = await requireComment(ctx, commentId);
  if (comment.authorId !== ctx.user.id) throw forbidden('You can only edit your own comments.');
  await ctx.db.update(comments).set({ body }).where(eq(comments.id, commentId));
  const [row] = await selectComments(ctx.db).where(eq(comments.id, commentId));
  return toComment(row!);
}

export async function deleteComment(ctx: RequestContext, commentId: string): Promise<void> {
  const { comment, scope } = await requireComment(ctx, commentId);
  const mayDelete = comment.authorId === ctx.user.id || ctx.access.can('comment.moderate', scope);
  if (!mayDelete) throw forbidden('You can only delete your own comments.');
  await ctx.db.delete(comments).where(eq(comments.id, commentId));
}
