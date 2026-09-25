import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Dashboard, PortalHome, ProjectProgress, Ticket } from '@helm/shared';
import { createTestApp, login, seedOrg, type TestApp } from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
  const lead = await login(t, 'lead');
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await lead.post<Ticket>('/api/projects/ACME/tickets', {
    title: 'Overdue',
    assigneeId: org.users.dev.id,
    dueDate: yesterday,
  });
  await lead.post<Ticket>('/api/projects/ACME/tickets', {
    title: 'Blocked',
    status: 'blocked',
    cycleId: org.cycle.id,
  });
  await lead.post<Ticket>('/api/projects/ACME/tickets', {
    title: 'Done',
    status: 'done',
    cycleId: org.cycle.id,
  });
});
afterAll(() => t.close());

describe('staff dashboard', () => {
  it('summarises the work the caller can see', async () => {
    const dev = await login(t, 'dev');
    const dashboard = await dev.get<Dashboard>('/api/dashboard');
    expect(dashboard.body.me).toMatchObject({ openAssigned: 1, overdue: 1 });
    expect(dashboard.body.totals).toMatchObject({
      clients: 1,
      projects: 1,
      activeCycles: 1,
      openTickets: 2,
      overdueTickets: 1,
      blockedTickets: 1,
      completedLast7Days: 1,
    });
    expect(dashboard.body.byStatus.find((s) => s.status === 'blocked')?.count).toBe(1);
    expect(dashboard.body.activeCycles).toMatchObject([{ name: 'Sprint 1', total: 2, done: 1 }]);

    const cycleDev = await login(t, 'cycledev');
    const scoped = await cycleDev.get<Dashboard>('/api/dashboard');
    expect(scoped.body.totals.openTickets).toBe(1);

    const dm = await login(t, 'dm');
    expect((await dm.get<Dashboard>('/api/dashboard')).body.totals.clients).toBe(2);
  });

  it('is not available to client users', async () => {
    const clientUser = await login(t, 'acme.client');
    expect((await clientUser.get('/api/dashboard')).status).toBe(404);
  });
});

describe('client portal', () => {
  it('shows the client their projects’ progress without ticket details', async () => {
    const clientUser = await login(t, 'acme.client');
    const home = await clientUser.get<PortalHome>('/api/portal');
    expect(home.status).toBe(200);
    expect(home.body.client.name).toBe('Acme Corp');
    expect(home.body.projects).toHaveLength(1);
    const progress = home.body.projects[0]!;
    expect(progress.byStatus.find((s) => s.status === 'done')?.count).toBe(1);
    expect(progress.cycles[0]).toMatchObject({ name: 'Sprint 1', total: 2, done: 1 });
    expect(JSON.stringify(home.body)).not.toContain('Overdue');

    const direct = await clientUser.get<ProjectProgress>('/api/projects/ACME/progress');
    expect(direct.body.projectKey).toBe('ACME');
  });

  it('is only for client users, and progress stays within each company', async () => {
    const lead = await login(t, 'lead');
    expect((await lead.get('/api/portal')).status).toBe(404);
    const outsider = await login(t, 'outsider');
    expect((await outsider.get('/api/projects/ACME/progress')).status).toBe(404);
  });
});
