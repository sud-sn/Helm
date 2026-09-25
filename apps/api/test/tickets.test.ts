import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Comment,
  CreateCommentResponse,
  Notification,
  Ticket,
  TicketDetail,
  TicketEvent,
} from '@helm/shared';
import { auditLog, notifications } from '../src/db/schema';
import { createTestApp, login, seedOrg, type Client, type TestApp } from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;
let lead: Client;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
  lead = await login(t, 'lead');
});
afterAll(() => t.close());

async function notificationsFor(userId: string) {
  return t.db.select().from(notifications).where(eq(notifications.userId, userId));
}

describe('creating tickets', () => {
  it('numbers tickets per project', async () => {
    const first = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Load orders into staging',
    });
    const second = await lead.post<Ticket>('/api/projects/acme/tickets', {
      title: 'Build revenue dashboard',
      type: 'report',
      priority: 'high',
      labels: ['powerbi', 'powerbi', 'finance'],
    });
    expect(first.body.key).toBe('ACME-1');
    expect(second.body).toMatchObject({
      key: 'ACME-2',
      type: 'report',
      priority: 'high',
      labels: ['powerbi', 'finance'],
    });
    expect(second.body.reporter.username).toBe('lead');
  });

  it('is limited to Team Leads and above', async () => {
    for (const username of ['dev', 'ba', 'viewer']) {
      const client = await login(t, username);
      expect(
        (await client.post('/api/projects/ACME/tickets', { title: 'Not allowed' })).status,
      ).toBe(403);
    }
    const outsider = await login(t, 'outsider');
    expect((await outsider.post('/api/projects/ACME/tickets', { title: 'Hidden' })).status).toBe(
      404,
    );
  });

  it('only assigns people who can see the ticket, and tells them', async () => {
    const assigned = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Fix null customer ids',
      type: 'bug',
      assigneeId: org.users.dev.id,
    });
    expect(assigned.body.assignee?.username).toBe('dev');
    const devNotifications = await notificationsFor(org.users.dev.id);
    expect(devNotifications.map((n) => n.type)).toContain('ticket_assigned');

    for (const user of [org.users.outsider, org.users.clientUser, org.users.cycleDev]) {
      const response = await lead.post('/api/projects/ACME/tickets', {
        title: 'Nope',
        assigneeId: user.id,
      });
      expect(response.status).toBe(400);
    }
    const inCycle = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Sprint work',
      cycleId: org.cycle.id,
      assigneeId: org.users.cycleDev.id,
    });
    expect(inCycle.status).toBe(201);
  });

  it('validates input', async () => {
    const response = await lead.post<{ error: { code: string; details: { path: string }[] } }>(
      '/api/projects/ACME/tickets',
      { title: '', status: 'nonsense', dueDate: '31/12/2026' },
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['title', 'status', 'dueDate']),
    );
  });
});

describe('reading tickets', () => {
  it('limits cycle members to their cycle and hides tickets from client users', async () => {
    const cycleDev = await login(t, 'cycledev');
    const list = await cycleDev.get<Ticket[]>('/api/projects/ACME/tickets');
    expect(list.body.map((ticket) => ticket.title)).toEqual(['Sprint work']);
    expect((await cycleDev.get('/api/tickets/ACME-1')).status).toBe(404);

    const clientUser = await login(t, 'acme.client');
    expect((await clientUser.get('/api/projects/ACME/tickets')).status).toBe(404);
    expect((await clientUser.get('/api/tickets/ACME-1')).status).toBe(404);
  });

  it('filters and searches', async () => {
    const byType = await lead.get<Ticket[]>('/api/projects/ACME/tickets?type=bug');
    expect(byType.body.map((ticket) => ticket.key)).toEqual(['ACME-3']);
    const backlog = await lead.get<Ticket[]>(
      '/api/projects/ACME/tickets?cycle=backlog&assignee=none',
    );
    expect(backlog.body.map((ticket) => ticket.key)).toEqual(['ACME-2', 'ACME-1']);
    const byKey = await lead.get<Ticket[]>('/api/projects/ACME/tickets?q=ACME-2');
    expect(byKey.body.map((ticket) => ticket.key)).toEqual(['ACME-2']);
    const byTitle = await lead.get<Ticket[]>('/api/projects/ACME/tickets?q=revenue');
    expect(byTitle.body.map((ticket) => ticket.key)).toEqual(['ACME-2']);
  });

  it('lists my open tickets across projects', async () => {
    const dev = await login(t, 'dev');
    const mine = await dev.get<Ticket[]>('/api/my/tickets');
    expect(mine.body.map((ticket) => ticket.key)).toEqual(['ACME-3']);
  });
});

describe('updating tickets', () => {
  it('lets developers move their own tickets but nothing else', async () => {
    const dev = await login(t, 'dev');
    const moved = await dev.patch<Ticket>('/api/tickets/ACME-3', { status: 'in_progress' });
    expect(moved.status).toBe(200);
    expect(moved.body.status).toBe('in_progress');

    const renamed = await dev.patch<{ error: { message: string } }>('/api/tickets/ACME-3', {
      title: 'My title',
    });
    expect(renamed.status).toBe(403);
    expect((await dev.patch('/api/tickets/ACME-1', { status: 'done' })).status).toBe(403);
  });

  it('records history and notifies watchers about status changes', async () => {
    const dev = await login(t, 'dev');
    await dev.patch('/api/tickets/ACME-3', { status: 'done' });
    const ticket = await lead.get<TicketDetail>('/api/tickets/ACME-3');
    expect(ticket.body.completedAt).not.toBeNull();
    expect(ticket.body.watcherCount).toBe(2);

    const history = await lead.get<TicketEvent[]>('/api/tickets/ACME-3/events');
    expect(history.body.map((event) => event.type)).toEqual([
      'created',
      'status_changed',
      'status_changed',
    ]);
    expect(history.body[2]!.data).toEqual({ from: 'in_progress', to: 'done' });

    const leadNotes = await notificationsFor(org.users.lead.id);
    const statusNote = leadNotes.find(
      (n) => n.type === 'ticket_status_changed' && n.data.to === 'Done',
    );
    expect(statusNote?.data).toMatchObject({
      ticketKey: 'ACME-3',
      from: 'In Progress',
      to: 'Done',
    });

    const reopened = await dev.patch<Ticket>('/api/tickets/ACME-3', { status: 'in_review' });
    expect(reopened.body.completedAt).toBeNull();
  });

  it('checks both ends when moving between cycles and the backlog', async () => {
    const moved = await lead.patch<Ticket>('/api/tickets/ACME-1', {
      cycleId: org.cycle.id,
      priority: 'urgent',
    });
    expect(moved.body).toMatchObject({ cycleName: 'Sprint 1', priority: 'urgent' });
    const back = await lead.patch<Ticket>('/api/tickets/ACME-1', { cycleId: null });
    expect(back.body.cycleId).toBeNull();

    const other = await lead.patch('/api/tickets/ACME-1', {
      cycleId: '00000000-0000-4000-8000-000000000000',
    });
    expect(other.status).toBe(400);
  });

  it('reassigns and keeps assignees within scope', async () => {
    const reassigned = await lead.patch<Ticket>('/api/tickets/ACME-2', {
      assigneeId: org.users.ba.id,
    });
    expect(reassigned.body.assignee?.username).toBe('ba');
    expect(
      (await lead.patch('/api/tickets/ACME-2', { assigneeId: org.users.outsider.id })).status,
    ).toBe(400);
    const unassigned = await lead.patch<Ticket>('/api/tickets/ACME-2', { assigneeId: null });
    expect(unassigned.body.assignee).toBeNull();
  });

  it('lets people watch and unwatch', async () => {
    const viewer = await login(t, 'viewer');
    expect((await viewer.request('PUT', '/api/tickets/ACME-1/watch')).status).toBe(204);
    expect((await viewer.get<TicketDetail>('/api/tickets/ACME-1')).body.watching).toBe(true);
    expect((await viewer.delete('/api/tickets/ACME-1/watch')).status).toBe(204);
    expect((await viewer.get<TicketDetail>('/api/tickets/ACME-1')).body.watching).toBe(false);
  });

  it('lets Team Leads delete tickets, audited', async () => {
    const extra = await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Created by mistake',
    });
    const dev = await login(t, 'dev');
    expect((await dev.delete(`/api/tickets/${extra.body.key}`)).status).toBe(403);
    expect((await lead.delete(`/api/tickets/${extra.body.key}`)).status).toBe(204);
    expect((await lead.get(`/api/tickets/${extra.body.key}`)).status).toBe(404);
    const [entry] = await t.db.select().from(auditLog).where(eq(auditLog.action, 'ticket.deleted'));
    expect(entry?.data).toMatchObject({ key: extra.body.key });
  });
});

describe('comments and mentions', () => {
  it('notifies mentioned people who can see the ticket and reports the rest', async () => {
    const response = await lead.post<CreateCommentResponse>('/api/tickets/ACME-1/comments', {
      body: '@dev please clarify the Snowflake schema. cc @outsider and @nobody.',
    });
    expect(response.status).toBe(201);
    expect(response.body.unresolvedMentions.sort()).toEqual(['nobody', 'outsider']);

    const devMention = (await notificationsFor(org.users.dev.id)).find(
      (n) => n.type === 'mentioned',
    );
    expect(devMention?.data).toMatchObject({
      ticketKey: 'ACME-1',
      excerpt: expect.stringContaining('Snowflake'),
    });
    const outsiderNotes = await notificationsFor(org.users.outsider.id);
    expect(outsiderNotes).toHaveLength(0);
  });

  it('notifies watchers about new comments, but not the author', async () => {
    const dev = await login(t, 'dev');
    await dev.post('/api/tickets/ACME-1/comments', { body: 'Schema is in the data dictionary.' });
    const leadNotes = await t.db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, org.users.lead.id), eq(notifications.type, 'comment_added')),
      );
    expect(leadNotes.length).toBeGreaterThan(0);
    const devNotes = await t.db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, org.users.dev.id), eq(notifications.type, 'comment_added')),
      );
    expect(devNotes).toHaveLength(0);
  });

  it('keeps viewers and client users from commenting', async () => {
    const viewer = await login(t, 'viewer');
    expect((await viewer.post('/api/tickets/ACME-1/comments', { body: 'Hi' })).status).toBe(403);
    const clientUser = await login(t, 'acme.client');
    expect((await clientUser.post('/api/tickets/ACME-1/comments', { body: 'Hi' })).status).toBe(
      404,
    );
  });

  it('lets authors edit, and moderators delete', async () => {
    const dev = await login(t, 'dev');
    const comments = await dev.get<Comment[]>('/api/tickets/ACME-1/comments');
    const devComment = comments.body.find((c) => c.author.username === 'dev')!;
    const leadComment = comments.body.find((c) => c.author.username === 'lead')!;

    expect((await dev.patch(`/api/comments/${leadComment.id}`, { body: 'Hijack' })).status).toBe(
      403,
    );
    const edited = await dev.patch<Comment>(`/api/comments/${devComment.id}`, {
      body: 'Schema is in the wiki.',
    });
    expect(edited.body.body).toBe('Schema is in the wiki.');
    expect((await dev.delete(`/api/comments/${leadComment.id}`)).status).toBe(403);
    expect((await lead.delete(`/api/comments/${devComment.id}`)).status).toBe(204);
  });
});

describe('notifications', () => {
  it('are listed newest first with unread counts, and marked read by their owner only', async () => {
    const dev = await login(t, 'dev');
    const unread = await dev.get<{ count: number }>('/api/notifications/unread-count');
    expect(unread.body.count).toBeGreaterThan(0);

    const list = await dev.get<Notification[]>('/api/notifications?unread=true');
    expect(list.body.length).toBe(unread.body.count);
    expect(list.body[0]!.actor?.username).toBeDefined();

    const outsider = await login(t, 'outsider');
    expect((await outsider.post(`/api/notifications/${list.body[0]!.id}/read`)).status).toBe(404);
    expect((await dev.post(`/api/notifications/${list.body[0]!.id}/read`)).status).toBe(204);
    expect((await dev.get<{ count: number }>('/api/notifications/unread-count')).body.count).toBe(
      unread.body.count - 1,
    );

    await dev.post('/api/notifications/read-all');
    expect((await dev.get<{ count: number }>('/api/notifications/unread-count')).body.count).toBe(
      0,
    );
  });

  it('are counted in the login response', async () => {
    await lead.post('/api/tickets/ACME-1/comments', { body: '@dev one more thing' });
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-requested-with': 'helm' },
      payload: { login: 'dev', password: 'correct horse battery' },
    });
    expect(response.json()).toMatchObject({ unreadNotifications: 1 });
  });
});
