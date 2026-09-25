import { eq } from 'drizzle-orm';
import type { ResourceScope, ScopeType } from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, cycles, projects } from '../../db/schema';

export interface ResolvedScope {
  scopeType: ScopeType;
  /** Full ancestry, ready for permission checks. */
  scope: ResourceScope;
  /** e.g. "Acme Corp › ACME › Sprint 3". */
  label: string;
  /** The client the scope belongs to; null for the workspace. */
  clientId: string | null;
}

export const SCOPE_SEPARATOR = ' › ';

/** Loads a scope and its ancestors. Returns null when the id does not exist. */
export async function resolveScope(
  db: Executor,
  scopeType: ScopeType,
  scopeId: string | null | undefined,
): Promise<ResolvedScope | null> {
  if (scopeType === 'workspace') {
    return { scopeType, scope: {}, label: 'Workspace', clientId: null };
  }
  if (!scopeId) return null;

  if (scopeType === 'client') {
    const [row] = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.id, scopeId))
      .limit(1);
    return row
      ? { scopeType, scope: { clientId: row.id }, label: row.name, clientId: row.id }
      : null;
  }

  if (scopeType === 'project') {
    const [row] = await db
      .select({
        id: projects.id,
        key: projects.key,
        clientId: clients.id,
        clientName: clients.name,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(eq(projects.id, scopeId))
      .limit(1);
    return row
      ? {
          scopeType,
          scope: { clientId: row.clientId, projectId: row.id },
          label: [row.clientName, row.key].join(SCOPE_SEPARATOR),
          clientId: row.clientId,
        }
      : null;
  }

  const [row] = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      projectId: projects.id,
      projectKey: projects.key,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(cycles)
    .innerJoin(projects, eq(projects.id, cycles.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(cycles.id, scopeId))
    .limit(1);
  return row
    ? {
        scopeType,
        scope: { clientId: row.clientId, projectId: row.projectId, cycleId: row.id },
        label: [row.clientName, row.projectKey, row.name].join(SCOPE_SEPARATOR),
        clientId: row.clientId,
      }
    : null;
}
