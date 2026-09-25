import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client, Cycle, Project, Ticket } from '@helm/shared';
import { roleAssignments, ticketEvents, tickets } from '../src/db/schema';
import {
  createCycle,
  createTestApp,
  grant,
  login,
  seedOrg,
  createUser,
  type TestApp,
} from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
});
afterAll(() => t.close());

describe('clients', () => {
  it('can only be created by Delivery Managers, with unique names', async () => {
    const pm = await login(t, 'pm');
    expect((await pm.post('/api/clients', { name: 'Initech' })).status).toBe(403);

    const dm = await login(t, 'dm');
    const created = await dm.post<Client>('/api/clients', {
      name: 'Initech',
      description: 'Payroll analytics',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Initech', projectCount: 0 });
    const duplicate = await dm.post<{ error: { code: string } }>('/api/clients', {
      name: 'initech',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CLIENT_NAME_TAKEN');
  });

  it('are visible only where people have access', async () => {
    const visible = async (username: string) =>
      (await (await login(t, username)).get<Client[]>('/api/clients')).body.map((c) => c.name);

    expect(await visible('dm')).toEqual(expect.arrayContaining(['Acme Corp', 'Globex', 'Initech']));
    expect(await visible('pm')).toEqual(['Acme Corp']);
    expect(await visible('cycledev')).toEqual(['Acme Corp']);
    expect(await visible('outsider')).toEqual(['Globex']);
    expect(await visible('acme.client')).toEqual(['Acme Corp']);
  });

  it('hide other clients entirely', async () => {
    const pm = await login(t, 'pm');
    expect((await pm.get(`/api/clients/${org.otherClient.id}`)).status).toBe(404);
    expect(
      (await pm.patch(`/api/clients/${org.otherClient.id}`, { name: 'Mine now' })).status,
    ).toBe(404);
  });

  it('can be renamed by their Project Manager and archived by a Delivery Manager', async () => {
    const pm = await login(t, 'pm');
    const renamed = await pm.patch<Client>(`/api/clients/${org.client.id}`, {
      description: 'Retail analytics',
    });
    expect(renamed.body.description).toBe('Retail analytics');

    const dm = await login(t, 'dm');
    const initech = (await dm.get<Client[]>('/api/clients')).body.find(
      (c) => c.name === 'Initech',
    )!;
    const archived = await dm.patch<Client>(`/api/clients/${initech.id}`, { archived: true });
    expect(archived.body.archivedAt).not.toBeNull();
    expect((await dm.get<Client[]>('/api/clients')).body.map((c) => c.name)).not.toContain(
      'Initech',
    );
    expect(
      (await dm.get<Client[]>('/api/clients?includeArchived=true')).body.map((c) => c.name),
    ).toContain('Initech');
  });
});

describe('projects', () => {
  it('are created by the client’s Project Manager with a unique key', async () => {
    const pm = await login(t, 'pm');
    const created = await pm.post<Project>('/api/projects', {
      clientId: org.client.id,
      key: 'acmebi',
      name: 'Acme BI Platform',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      key: 'ACMEBI',
      clientName: 'Acme Corp',
      openTicketCount: 0,
    });

    const taken = await pm.post<{ error: { code: string } }>('/api/projects', {
      clientId: org.client.id,
      key: 'ACME',
      name: 'Duplicate',
    });
    expect(taken.body.error.code).toBe('PROJECT_KEY_TAKEN');

    expect(
      (
        await pm.post('/api/projects', {
          clientId: org.otherClient.id,
          key: 'NOPE',
          name: 'Not mine',
        })
      ).status,
    ).toBe(404);
    const lead = await login(t, 'lead');
    expect(
      (
        await lead.post('/api/projects', {
          clientId: org.client.id,
          key: 'LEADP',
          name: 'Lead project',
        })
      ).status,
    ).toBe(403);
  });

  it('are listed by visibility, with open-ticket counts limited to what the caller can read', async () => {
    const lead = await login(t, 'lead');
    const inCycle = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'In sprint',
      cycleId: org.cycle.id,
    });
    const inBacklog = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'In backlog',
    });
    expect(inCycle.status).toBe(201);
    expect(inBacklog.status).toBe(201);

    const leadView = (await lead.get<Project[]>('/api/projects')).body.find(
      (p) => p.key === 'ACME',
    )!;
    expect(leadView.openTicketCount).toBe(2);

    const cycleDev = await login(t, 'cycledev');
    const cycleView = await cycleDev.get<Project[]>('/api/projects');
    expect(cycleView.body.map((p) => p.key)).toEqual(['ACME']);
    expect(cycleView.body[0]!.openTicketCount).toBe(1);

    expect((await cycleDev.get('/api/projects/GLX')).status).toBe(404);

    // Same counts on the single-project endpoint (a correlated subquery without joins).
    expect((await lead.get<Project>('/api/projects/ACME')).body.openTicketCount).toBe(2);
    expect((await cycleDev.get<Project>('/api/projects/ACME')).body.openTicketCount).toBe(1);
    const pm = await login(t, 'pm');
    expect((await pm.get<Project>('/api/projects/ACME')).body.openTicketCount).toBe(2);
  });
});

describe('cycles', () => {
  it('are planned by Project Managers and updated by Team Leads', async () => {
    const lead = await login(t, 'lead');
    expect((await lead.post('/api/projects/ACME/cycles', { name: 'Sprint 2' })).status).toBe(403);

    const pm = await login(t, 'pm');
    const created = await pm.post<Cycle>('/api/projects/ACME/cycles', {
      name: 'Sprint 2',
      startDate: '2026-10-01',
      endDate: '2026-10-14',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'planned', ticketCount: 0 });

    const bad = await pm.post('/api/projects/ACME/cycles', {
      name: 'Backwards',
      startDate: '2026-10-14',
      endDate: '2026-10-01',
    });
    expect(bad.status).toBe(400);

    const updated = await lead.patch<Cycle>(`/api/cycles/${created.body.id}`, {
      goal: 'Load customer dimension',
    });
    expect(updated.body.goal).toBe('Load customer dimension');
  });

  it('are listed per scope: cycle members only see their cycle', async () => {
    const cycleDev = await login(t, 'cycledev');
    const cycles = await cycleDev.get<Cycle[]>('/api/projects/ACME/cycles');
    expect(cycles.body.map((c) => c.name)).toEqual(['Sprint 1']);
  });

  it('move unfinished tickets when completed, recording history', async () => {
    const pm = await login(t, 'pm');
    const next = (await pm.get<Cycle[]>('/api/projects/ACME/cycles')).body.find(
      (c) => c.name === 'Sprint 2',
    )!;
    const lead = await login(t, 'lead');
    const done = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Finished work',
      cycleId: org.cycle.id,
      status: 'done',
    });

    const completed = await lead.post<{ cycle: Cycle; movedTickets: number }>(
      `/api/cycles/${org.cycle.id}/complete`,
      {
        moveOpenTicketsTo: next.id,
      },
    );
    expect(completed.status).toBe(200);
    expect(completed.body.cycle.status).toBe('completed');
    expect(completed.body.movedTickets).toBe(1);

    const [finished] = await t.db.select().from(tickets).where(eq(tickets.id, done.body.id));
    expect(finished!.cycleId).toBe(org.cycle.id);
    const moved = await lead.get<Ticket>('/api/tickets/ACME-1');
    expect(moved.body.cycleName).toBe('Sprint 2');
    const events = await t.db
      .select()
      .from(ticketEvents)
      .where(eq(ticketEvents.ticketId, moved.body.id));
    expect(events.map((e) => e.type)).toContain('cycle_changed');
  });

  it('send their tickets to the backlog and drop cycle grants when deleted', async () => {
    const pm = await login(t, 'pm');
    const temp = await createCycle(t, org.project.id, 'Throwaway');
    const temporaryMember = await createUser(t, { username: 'temp.member' });
    await grant(t, temporaryMember.id, 'DEVELOPER', 'cycle', temp.id);
    const lead = await login(t, 'lead');
    const ticket = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Orphan',
      cycleId: temp.id,
    });

    expect((await lead.delete(`/api/cycles/${temp.id}`)).status).toBe(403);
    expect((await pm.delete(`/api/cycles/${temp.id}`)).status).toBe(204);
    expect((await lead.get<Ticket>(`/api/tickets/${ticket.body.key}`)).body.cycleId).toBeNull();
    const grants = await t.db
      .select()
      .from(roleAssignments)
      .where(eq(roleAssignments.userId, temporaryMember.id));
    expect(grants).toHaveLength(0);
  });
});
