import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { projects } from '../../db/schema';
import { anyOf, coverageCondition } from './conditions';

const dialect = new PgDialect();
const render = (condition: ReturnType<typeof anyOf>) => dialect.sqlToQuery(condition).sql;

describe('access conditions', () => {
  it('match nothing when the caller covers nothing', () => {
    const none = { all: false, clientIds: [], projectIds: [], cycleIds: [] };
    expect(
      render(coverageCondition(none, { clientId: projects.clientId, projectId: projects.id })!),
    ).toBe('false');
    expect(render(anyOf([undefined, undefined]))).toBe('false');
  });

  it('need no filter for workspace-wide access', () => {
    const all = { all: true, clientIds: [], projectIds: [], cycleIds: [] };
    expect(coverageCondition(all, { projectId: projects.id })).toBeUndefined();
  });

  it('combine the covered levels with OR', () => {
    const some = { all: false, clientIds: ['c1'], projectIds: ['p1'], cycleIds: [] };
    const sql = render(
      coverageCondition(some, { clientId: projects.clientId, projectId: projects.id })!,
    );
    expect(sql).toContain('"projects"."client_id" in');
    expect(sql).toContain(' or ');
  });
});
