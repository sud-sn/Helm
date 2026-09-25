import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page, PageSummary, PageVersion, Ticket } from '@helm/shared';
import { auditLog, notifications } from '../src/db/schema';
import { createTestApp, login, seedOrg, type Client, type TestApp } from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;
let dev: Client;
let page: Page;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
  dev = await login(t, 'dev');
});
afterAll(() => t.close());

describe('pages', () => {
  it('are written by developers and above', async () => {
    const created = await dev.post<Page>('/api/projects/ACME/pages', {
      title: 'Orders pipeline',
      body: '## Source\nSAP orders table',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      version: 1,
      visibility: 'internal',
      createdBy: { username: 'dev' },
    });
    page = created.body;

    const viewer = await login(t, 'viewer');
    expect((await viewer.post('/api/projects/ACME/pages', { title: 'Nope' })).status).toBe(403);
    expect((await viewer.get<Page>(`/api/pages/${page.id}`)).body.title).toBe('Orders pipeline');
  });

  it('keep every version and refuse stale saves', async () => {
    const saved = await dev.patch<Page>(`/api/pages/${page.id}`, {
      body: '## Source\nSAP ECC orders',
      expectedVersion: 1,
    });
    expect(saved.body.version).toBe(2);
    const stale = await dev.patch<{ error: { code: string } }>(`/api/pages/${page.id}`, {
      body: 'Overwrites the other edit',
      expectedVersion: 1,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');

    const versions = await dev.get<PageVersion[]>(`/api/pages/${page.id}/versions`);
    expect(versions.body.map((v) => v.version)).toEqual([2, 1]);
    expect(versions.body[1]!.body).toBe('## Source\nSAP orders table');
  });

  it('link to tickets of the same project only', async () => {
    const lead = await login(t, 'lead');
    const ticket = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Orders pipeline',
      cycleId: org.cycle.id,
    });
    const linked = await dev.post<Page>('/api/projects/ACME/pages', {
      title: 'Runbook',
      ticketId: ticket.body.id,
    });
    expect(linked.body.ticketKey).toBe(ticket.body.key);
    const ticketPages = await dev.get<PageSummary[]>(`/api/tickets/${ticket.body.key}/pages`);
    expect(ticketPages.body.map((p) => p.title)).toEqual(['Runbook']);

    const outsider = await login(t, 'outsider');
    const foreign = await outsider.post<Ticket>('/api/projects/GLX/tickets', { title: 'x' });
    expect(foreign.status).toBe(403);
    const dm = await login(t, 'dm');
    const globexTicket = await dm.post<Ticket>('/api/projects/GLX/tickets', {
      title: 'Globex work',
    });
    expect(
      (
        await dev.post('/api/projects/ACME/pages', {
          title: 'Wrong link',
          ticketId: globexTicket.body.id,
        })
      ).status,
    ).toBe(400);

    // Cycle members read pages linked to their cycle's tickets, not project-wide pages.
    const cycleDev = await login(t, 'cycledev');
    const visible = await cycleDev.get<PageSummary[]>('/api/projects/ACME/pages');
    expect(visible.body.map((p) => p.title)).toEqual(['Runbook']);
    expect((await cycleDev.get(`/api/pages/${page.id}`)).status).toBe(404);
  });

  it('stay internal until someone with sharing rights shares them', async () => {
    const clientUser = await login(t, 'acme.client');
    expect((await clientUser.get(`/api/pages/${page.id}`)).status).toBe(404);
    expect((await clientUser.get<PageSummary[]>('/api/projects/ACME/pages')).body).toEqual([]);

    expect(
      (await dev.request('PUT', `/api/pages/${page.id}/visibility`, { visibility: 'client' }))
        .status,
    ).toBe(403);
    const ba = await login(t, 'ba');
    const shared = await ba.request<Page>('PUT', `/api/pages/${page.id}/visibility`, {
      visibility: 'client',
    });
    expect(shared.body.visibility).toBe('client');

    const read = await clientUser.get<Page>(`/api/pages/${page.id}`);
    expect(read.body.body).toContain('SAP ECC orders');
    expect(
      (await clientUser.get<PageSummary[]>('/api/projects/ACME/pages')).body.map((p) => p.title),
    ).toEqual(['Orders pipeline']);
    // Clients read the current version only.
    expect((await clientUser.get(`/api/pages/${page.id}/versions`)).status).toBe(404);
    expect(
      (await clientUser.patch(`/api/pages/${page.id}`, { body: 'client edit', expectedVersion: 2 }))
        .status,
    ).toBe(403);

    const [note] = await t.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, org.users.clientUser.id),
          eq(notifications.type, 'content_shared'),
        ),
      );
    expect(note?.data).toMatchObject({ pageTitle: 'Orders pipeline' });
    const [audit] = await t.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'page.visibility_changed'));
    expect(audit?.data).toMatchObject({ visibility: 'client' });
  });

  it('are deleted by Team Leads', async () => {
    expect((await dev.delete(`/api/pages/${page.id}`)).status).toBe(403);
    const lead = await login(t, 'lead');
    expect((await lead.delete(`/api/pages/${page.id}`)).status).toBe(204);
    expect((await lead.get(`/api/pages/${page.id}`)).status).toBe(404);
  });
});
