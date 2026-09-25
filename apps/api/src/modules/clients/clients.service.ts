import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Client, CreateClientInput, UpdateClientInput } from '@helm/shared';
import { clients, projects } from '../../db/schema';
import {
  canSeeClient,
  visibleClientCondition,
  visibleProjectCondition,
} from '../../core/access/navigation';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { conflict, notFound } from '../../core/errors';
import { iso } from '../../core/dto';

async function projectCounts(
  ctx: RequestContext,
  clientIds: string[],
): Promise<Map<string, number>> {
  if (clientIds.length === 0) return new Map();
  const rows = await ctx.db
    .select({ clientId: projects.clientId, value: count() })
    .from(projects)
    .where(and(inArray(projects.clientId, clientIds), visibleProjectCondition(ctx.db, ctx.access)))
    .groupBy(projects.clientId);
  return new Map(rows.map((row) => [row.clientId, row.value]));
}

function toClient(row: typeof clients.$inferSelect, projectCount: number): Client {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    archivedAt: iso(row.archivedAt),
    projectCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listClients(
  ctx: RequestContext,
  options: { includeArchived?: boolean } = {},
): Promise<Client[]> {
  const rows = await ctx.db
    .select()
    .from(clients)
    .where(
      and(
        visibleClientCondition(ctx.db, ctx.access),
        options.includeArchived ? undefined : isNull(clients.archivedAt),
      ),
    )
    .orderBy(asc(sql`lower(${clients.name})`));
  const counts = await projectCounts(
    ctx,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toClient(row, counts.get(row.id) ?? 0));
}

export async function getClient(ctx: RequestContext, clientId: string): Promise<Client> {
  if (!(await canSeeClient(ctx.db, ctx.access, clientId))) throw notFound('Client');
  const [row] = await ctx.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!row) throw notFound('Client');
  const counts = await projectCounts(ctx, [row.id]);
  return toClient(row, counts.get(row.id) ?? 0);
}

async function assertNameFree(ctx: RequestContext, name: string, exceptId?: string) {
  const [existing] = await ctx.db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`lower(${clients.name}) = lower(${name})`)
    .limit(1);
  if (existing && existing.id !== exceptId) {
    throw conflict('A client with that name already exists.', 'CLIENT_NAME_TAKEN');
  }
}

export async function createClient(
  ctx: RequestContext,
  input: CreateClientInput & { description: string },
): Promise<Client> {
  ctx.access.require('client.create', {}, 'Only Delivery Managers can add clients.');
  await assertNameFree(ctx, input.name);
  const created = await ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({ name: input.name, description: input.description, createdById: ctx.user.id })
      .returning();
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'client.created',
      entityType: 'client',
      entityId: row!.id,
      data: { name: input.name },
      ip: ctx.ip,
    });
    return row!;
  });
  return toClient(created, 0);
}

export async function updateClient(
  ctx: RequestContext,
  clientId: string,
  input: UpdateClientInput,
): Promise<Client> {
  if (!(await canSeeClient(ctx.db, ctx.access, clientId))) throw notFound('Client');
  ctx.access.require('client.update', { clientId });
  if (input.name) await assertNameFree(ctx, input.name, clientId);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(clients)
      .set({
        name: input.name,
        description: input.description,
        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
      })
      .where(eq(clients.id, clientId));
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'client.updated',
      entityType: 'client',
      entityId: clientId,
      data: { changes: input },
      ip: ctx.ip,
    });
  });
  return getClient(ctx, clientId);
}
