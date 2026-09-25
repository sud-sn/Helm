import { and, desc, eq, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  DOC_TYPE_LABELS,
  formatTicketKey,
  type CreatePageInput,
  type Page,
  type PageSummary,
  type PageVersion,
  type ResourceScope,
  type UpdatePageInput,
  type Visibility,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, pageVersions, pages, projects, tickets, users } from '../../db/schema';
import type { Access } from '../../core/access/access';
import { usersWithPermissionAt } from '../../core/access/audience';
import { anyOf, coverageCondition } from '../../core/access/conditions';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { badRequest, conflict, notFound } from '../../core/errors';
import { requiredUserSummary } from '../../core/dto';
import { notify } from '../notifications/notify';
import { hasPermissionWithinProject, requireProject } from '../projects/projects.queries';
import { markdownToDocx } from './docx';

const creator = alias(users, 'page_creator');
const updater = alias(users, 'page_updater');

function selectPages(db: Executor) {
  return db
    .select({
      page: pages,
      projectKey: projects.key,
      projectName: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      ticketNumber: tickets.number,
      ticketCycleId: tickets.cycleId,
      createdBy: { id: creator.id, username: creator.username, displayName: creator.displayName },
      updatedBy: { id: updater.id, username: updater.username, displayName: updater.displayName },
    })
    .from(pages)
    .innerJoin(projects, eq(projects.id, pages.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(tickets, eq(tickets.id, pages.ticketId))
    .innerJoin(creator, eq(creator.id, pages.createdById))
    .innerJoin(updater, eq(updater.id, pages.updatedById));
}

type PageRow = Awaited<ReturnType<ReturnType<typeof selectPages>['execute']>>[number];

function toSummary(row: PageRow): PageSummary {
  return {
    id: row.page.id,
    projectId: row.page.projectId,
    projectKey: row.projectKey,
    clientId: row.clientId,
    ticketId: row.page.ticketId,
    ticketKey: row.ticketNumber != null ? formatTicketKey(row.projectKey, row.ticketNumber) : null,
    title: row.page.title,
    visibility: row.page.visibility,
    version: row.page.version,
    docType: row.page.docType,
    aiDrafted: row.page.aiRunId !== null,
    updatedBy: requiredUserSummary(row.updatedBy),
    updatedAt: row.page.updatedAt.toISOString(),
  };
}

function toPage(row: PageRow): Page {
  return {
    ...toSummary(row),
    body: row.page.body,
    clientName: row.clientName,
    projectName: row.projectName,
    createdBy: requiredUserSummary(row.createdBy),
    createdAt: row.page.createdAt.toISOString(),
  };
}

/** A page belongs to its project, and — when linked to a ticket in a cycle — to that cycle too. */
const pageScope = (row: PageRow): ResourceScope => ({
  clientId: row.clientId,
  projectId: row.page.projectId,
  cycleId: row.ticketCycleId,
});

function canReadPage(access: Access, row: PageRow): boolean {
  const scope = pageScope(row);
  return (
    access.can('page.read', scope) ||
    (row.page.visibility === 'client' && access.can('shared.read', scope))
  );
}

/** Pages the caller may read: everything they cover as staff, or client-visible pages as a client. */
export function readablePagesCondition(access: Access): SQL | undefined {
  const staff = coverageCondition(access.coverage('page.read'), {
    clientId: projects.clientId,
    projectId: pages.projectId,
    cycleId: tickets.cycleId,
  });
  if (staff === undefined) return undefined;
  const shared = coverageCondition(access.coverage('shared.read'), {
    clientId: projects.clientId,
    projectId: pages.projectId,
  });
  return anyOf([
    staff,
    shared === undefined
      ? eq(pages.visibility, 'client')
      : and(eq(pages.visibility, 'client'), shared),
  ]);
}

async function requirePage(ctx: RequestContext, pageId: string): Promise<PageRow> {
  const [row] = await selectPages(ctx.db).where(eq(pages.id, pageId)).limit(1);
  if (!row || !canReadPage(ctx.access, row)) throw notFound('Page');
  return row;
}

export async function loadPage(db: Executor, pageId: string): Promise<Page> {
  const [row] = await selectPages(db).where(eq(pages.id, pageId)).limit(1);
  if (!row) throw notFound('Page');
  return toPage(row);
}

export async function listProjectPages(
  ctx: RequestContext,
  projectKey: string,
): Promise<PageSummary[]> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  const allowed =
    (await hasPermissionWithinProject(ctx.db, ctx.access, project, 'page.read')) ||
    ctx.access.can('shared.read', { clientId: project.clientId, projectId: project.id });
  if (!allowed) throw notFound('Project');
  const rows = await selectPages(ctx.db)
    .where(and(eq(pages.projectId, project.id), readablePagesCondition(ctx.access)))
    .orderBy(desc(pages.updatedAt));
  return rows.map(toSummary);
}

export async function listTicketPages(
  ctx: RequestContext,
  ticketId: string,
): Promise<PageSummary[]> {
  const rows = await selectPages(ctx.db)
    .where(and(eq(pages.ticketId, ticketId), readablePagesCondition(ctx.access)))
    .orderBy(desc(pages.updatedAt));
  return rows.map(toSummary);
}

export async function getPage(ctx: RequestContext, pageId: string): Promise<Page> {
  return toPage(await requirePage(ctx, pageId));
}

/** A file name every operating system accepts, from the page title. */
function fileName(title: string, extension: string): string {
  const base = [...title]
    .map((char) => (char.charCodeAt(0) < 32 ? ' ' : char))
    .join('')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return `${base || 'page'}.${extension}`;
}

/** The page as a Word document, for whoever may read it (clients: pages shared with them). */
export async function exportPageDocx(
  ctx: RequestContext,
  pageId: string,
): Promise<{ fileName: string; data: Buffer }> {
  const page = await getPage(ctx, pageId);
  const subtitle = [
    page.docType ? DOC_TYPE_LABELS[page.docType] : null,
    `${page.clientName} · ${page.projectName} (${page.projectKey})`,
    `Version ${page.version}`,
    page.updatedAt.slice(0, 10),
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    fileName: fileName(page.title, 'docx'),
    data: await markdownToDocx({ title: page.title, subtitle, markdown: page.body }),
  };
}

/** Validates a ticket link and returns the scope the page will live in. */
async function linkedScope(
  db: Executor,
  project: { id: string; clientId: string },
  ticketId: string | null | undefined,
): Promise<ResourceScope> {
  if (!ticketId) return { clientId: project.clientId, projectId: project.id, cycleId: null };
  const [ticket] = await db
    .select({ projectId: tickets.projectId, cycleId: tickets.cycleId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticket || ticket.projectId !== project.id)
    throw badRequest('That ticket is not in this project.');
  return { clientId: project.clientId, projectId: project.id, cycleId: ticket.cycleId };
}

export async function createPage(
  ctx: RequestContext,
  projectKey: string,
  input: CreatePageInput & { body: string },
): Promise<Page> {
  const project = await requireProject(ctx.db, ctx.access, projectKey);
  const scope = await linkedScope(ctx.db, project, input.ticketId);
  ctx.access.require('page.write', scope, 'You cannot write pages here.');
  const pageId = await ctx.db.transaction(async (tx) => {
    const [created] = await tx
      .insert(pages)
      .values({
        projectId: project.id,
        ticketId: input.ticketId ?? null,
        title: input.title,
        body: input.body,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning({ id: pages.id });
    await tx.insert(pageVersions).values({
      pageId: created!.id,
      version: 1,
      title: input.title,
      body: input.body,
      createdById: ctx.user.id,
    });
    return created!.id;
  });
  return loadPage(ctx.db, pageId);
}

export async function updatePage(
  ctx: RequestContext,
  pageId: string,
  input: UpdatePageInput,
): Promise<Page> {
  const row = await requirePage(ctx, pageId);
  ctx.access.require('page.write', pageScope(row), 'You cannot edit this page.');
  if (input.ticketId !== undefined && input.ticketId !== row.page.ticketId) {
    const scope = await linkedScope(
      ctx.db,
      { id: row.page.projectId, clientId: row.clientId },
      input.ticketId,
    );
    ctx.access.require('page.write', scope, 'You cannot link this page to that ticket.');
  }
  const title = input.title ?? row.page.title;
  const body = input.body ?? row.page.body;
  await ctx.db.transaction(async (tx) => {
    // Optimistic concurrency: only save if nobody else saved since the editor loaded the page.
    const [updated] = await tx
      .update(pages)
      .set({
        title,
        body,
        ticketId: input.ticketId,
        version: row.page.version + 1,
        updatedById: ctx.user.id,
      })
      .where(and(eq(pages.id, pageId), eq(pages.version, input.expectedVersion)))
      .returning({ version: pages.version });
    if (!updated) {
      throw conflict(
        'Someone else saved this page while you were editing. Reload to see their changes.',
        'VERSION_CONFLICT',
      );
    }
    await tx.insert(pageVersions).values({
      pageId,
      version: updated.version,
      title,
      body,
      createdById: ctx.user.id,
    });
  });
  return loadPage(ctx.db, pageId);
}

export async function setPageVisibility(
  ctx: RequestContext,
  pageId: string,
  visibility: Visibility,
): Promise<Page> {
  const row = await requirePage(ctx, pageId);
  const scope = pageScope(row);
  ctx.access.require('content.share', scope, 'You cannot share pages with the client.');
  if (row.page.visibility === visibility) return toPage(row);
  await ctx.db.transaction(async (tx) => {
    await tx.update(pages).set({ visibility }).where(eq(pages.id, pageId));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'page.visibility_changed',
      entityType: 'page',
      entityId: pageId,
      data: { title: row.page.title, visibility },
      ip: ctx.ip,
    });
    if (visibility === 'client') {
      await notify(tx, {
        recipients: await usersWithPermissionAt(tx, scope, 'shared.read'),
        type: 'content_shared',
        actorId: ctx.user.id,
        data: { pageId, pageTitle: row.page.title, projectKey: row.projectKey },
      });
    }
  });
  return loadPage(ctx.db, pageId);
}

export async function listPageVersions(
  ctx: RequestContext,
  pageId: string,
): Promise<PageVersion[]> {
  const row = await requirePage(ctx, pageId);
  ctx.access.requireVisible('page.read', pageScope(row), 'Page');
  const versions = await ctx.db
    .select({
      version: pageVersions.version,
      title: pageVersions.title,
      body: pageVersions.body,
      createdAt: pageVersions.createdAt,
      createdBy: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(pageVersions)
    .innerJoin(users, eq(users.id, pageVersions.createdById))
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.version));
  return versions.map((v) => ({
    version: v.version,
    title: v.title,
    body: v.body,
    createdBy: requiredUserSummary(v.createdBy),
    createdAt: v.createdAt.toISOString(),
  }));
}

export async function deletePage(ctx: RequestContext, pageId: string): Promise<void> {
  const row = await requirePage(ctx, pageId);
  ctx.access.require('page.delete', pageScope(row), 'You cannot delete this page.');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(pages).where(eq(pages.id, pageId));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'page.deleted',
      entityType: 'page',
      entityId: pageId,
      data: { title: row.page.title, projectKey: row.projectKey },
      ip: ctx.ip,
    });
  });
}
