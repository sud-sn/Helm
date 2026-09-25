import { and, asc, eq } from 'drizzle-orm';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@helm/shared';
import { clients, projects } from '../../db/schema';
import { canSeeClient, visibleProjectCondition } from '../../core/access/navigation';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { badRequest, conflict, notFound } from '../../core/errors';
import {
  findProjectByKey,
  openTicketCountSql,
  requireProject,
  toProject,
} from './projects.queries';

export async function listProjects(
  ctx: RequestContext,
  filter: { clientId?: string } = {},
): Promise<Project[]> {
  const rows = await ctx.db
    .select({
      project: projects,
      clientName: clients.name,
      openTicketCount: openTicketCountSql(ctx.access),
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        visibleProjectCondition(ctx.db, ctx.access),
        filter.clientId ? eq(projects.clientId, filter.clientId) : undefined,
      ),
    )
    .orderBy(asc(clients.name), asc(projects.key));
  return rows.map((row) =>
    toProject({ ...row.project, clientName: row.clientName, openTicketCount: row.openTicketCount }),
  );
}

export async function getProject(ctx: RequestContext, key: string): Promise<Project> {
  const project = await requireProject(ctx.db, ctx.access, key);
  const [row] = await ctx.db
    .select({ openTicketCount: openTicketCountSql(ctx.access) })
    .from(projects)
    .where(eq(projects.id, project.id));
  return toProject({ ...project, openTicketCount: row?.openTicketCount ?? 0 });
}

export async function createProject(
  ctx: RequestContext,
  input: CreateProjectInput & { description: string },
): Promise<Project> {
  if (!(await canSeeClient(ctx.db, ctx.access, input.clientId))) throw notFound('Client');
  ctx.access.require(
    'project.create',
    { clientId: input.clientId },
    'Only Project Managers can add projects.',
  );
  const [company] = await ctx.db
    .select({ archivedAt: clients.archivedAt })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (company?.archivedAt) throw badRequest('This client is archived.');
  if (await findProjectByKey(ctx.db, input.key)) {
    throw conflict(`The key ${input.key} is already used by another project.`, 'PROJECT_KEY_TAKEN');
  }
  await ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({
        clientId: input.clientId,
        key: input.key,
        name: input.name,
        description: input.description,
        startDate: input.startDate ?? null,
        targetDate: input.targetDate ?? null,
        createdById: ctx.user.id,
      })
      .returning({ id: projects.id });
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'project.created',
      entityType: 'project',
      entityId: row!.id,
      data: { key: input.key, name: input.name },
      ip: ctx.ip,
    });
  });
  return getProject(ctx, input.key);
}

export async function updateProject(
  ctx: RequestContext,
  key: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const project = await requireProject(ctx.db, ctx.access, key);
  ctx.access.require('project.update', { clientId: project.clientId, projectId: project.id });
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({
        name: input.name,
        description: input.description,
        status: input.status,
        startDate: input.startDate,
        targetDate: input.targetDate,
      })
      .where(eq(projects.id, project.id));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'project.updated',
      entityType: 'project',
      entityId: project.id,
      data: { changes: input },
      ip: ctx.ip,
    });
  });
  return getProject(ctx, key);
}
