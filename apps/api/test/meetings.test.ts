import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ActionItem,
  Meeting,
  MeetingSummary,
  Pitch,
  Ticket,
  TicketDetail,
} from '@helm/shared';
import { notifications } from '../src/db/schema';
import { createTestApp, login, seedOrg, type Client, type TestApp } from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;
let dev: Client;
let meeting: Meeting;
const items: ActionItem[] = [];

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
  dev = await login(t, 'dev');
});
afterAll(() => t.close());

describe('meetings', () => {
  it('are recorded by the developers and analysts who attended', async () => {
    const created = await dev.post<Meeting>('/api/meetings', {
      clientId: org.client.id,
      projectId: org.project.id,
      title: 'Weekly sync with Acme finance',
      meetingDate: '2026-09-24',
      attendees: 'Priya (Acme), Dev, BA',
      transcript: 'Priya: the revenue numbers are off by a day...',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ minutesVisibility: 'internal', projectKey: 'ACME' });
    meeting = created.body;

    const viewer = await login(t, 'viewer');
    expect(
      (
        await viewer.post('/api/meetings', {
          clientId: org.client.id,
          projectId: org.project.id,
          title: 'x',
          meetingDate: '2026-09-24',
        })
      ).status,
    ).toBe(403);
    const clientUser = await login(t, 'acme.client');
    expect((await clientUser.get(`/api/meetings/${meeting.id}`)).status).toBe(404);
    expect((await clientUser.get<MeetingSummary[]>('/api/meetings')).body).toEqual([]);
  });

  it('collect action items', async () => {
    for (const title of [
      'Fix revenue cut-off time',
      'Add refunds to the dashboard',
      'Propose inventory streaming',
    ]) {
      const created = await dev.post<ActionItem>(`/api/meetings/${meeting.id}/action-items`, {
        title,
      });
      expect(created.status).toBe(201);
      items.push(created.body);
    }
    const listed = await dev.get<ActionItem[]>(`/api/meetings/${meeting.id}/action-items`);
    expect(listed.body.map((i) => i.status)).toEqual(['open', 'open', 'open']);
    const summary = await dev.get<MeetingSummary[]>('/api/meetings');
    expect(summary.body[0]!.openActionItems).toBe(3);
  });

  it('share minutes, never transcripts or action items, with the client', async () => {
    const ba = await login(t, 'ba');
    const empty = await ba.request('PUT', `/api/meetings/${meeting.id}/visibility`, {
      visibility: 'client',
    });
    expect(empty.status).toBe(400);
    await dev.patch(`/api/meetings/${meeting.id}`, {
      minutes: '## Decisions\n- Cut-off moves to 02:00 UTC',
    });
    expect(
      (await dev.request('PUT', `/api/meetings/${meeting.id}/visibility`, { visibility: 'client' }))
        .status,
    ).toBe(403);
    const shared = await ba.request<Meeting>('PUT', `/api/meetings/${meeting.id}/visibility`, {
      visibility: 'client',
    });
    expect(shared.body.minutesVisibility).toBe('client');

    const clientUser = await login(t, 'acme.client');
    const seen = await clientUser.get<Meeting>(`/api/meetings/${meeting.id}`);
    expect(seen.body.minutes).toContain('02:00 UTC');
    expect(seen.body.transcript).toBe('');
    expect((await clientUser.get(`/api/meetings/${meeting.id}/action-items`)).status).toBe(404);
    const [note] = await t.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, org.users.clientUser.id),
          eq(notifications.type, 'content_shared'),
        ),
      );
    expect(note?.data).toMatchObject({ meetingTitle: 'Weekly sync with Acme finance' });
  });

  it('turn action items into tickets in one go (Team Lead)', async () => {
    const body = {
      projectId: org.project.id,
      cycleId: org.cycle.id,
      items: [
        {
          actionItemId: items[0]!.id,
          type: 'bug',
          priority: 'high',
          assigneeId: org.users.cycleDev.id,
        },
        { actionItemId: items[1]!.id, type: 'report' },
      ],
    };
    expect((await dev.post(`/api/meetings/${meeting.id}/action-items/convert`, body)).status).toBe(
      403,
    );

    const lead = await login(t, 'lead');
    const converted = await lead.post<Ticket[]>(
      `/api/meetings/${meeting.id}/action-items/convert`,
      body,
    );
    expect(converted.status).toBe(201);
    expect(converted.body.map((ticket) => [ticket.key, ticket.type, ticket.cycleName])).toEqual([
      ['ACME-1', 'bug', 'Sprint 1'],
      ['ACME-2', 'report', 'Sprint 1'],
    ]);
    const detail = await lead.get<TicketDetail>('/api/tickets/ACME-1');
    expect(detail.body.sourceMeeting).toMatchObject({ title: 'Weekly sync with Acme finance' });

    const listed = await lead.get<ActionItem[]>(`/api/meetings/${meeting.id}/action-items`);
    expect(listed.body.map((i) => i.ticket?.key ?? i.status)).toEqual(['ACME-1', 'ACME-2', 'open']);
    const again = await lead.post(`/api/meetings/${meeting.id}/action-items/convert`, {
      projectId: org.project.id,
      items: [{ actionItemId: items[0]!.id }],
    });
    expect(again.status).toBe(409);

    const otherClient = await lead.post(`/api/meetings/${meeting.id}/action-items/convert`, {
      projectId: org.otherProject.id,
      items: [{ actionItemId: items[2]!.id }],
    });
    expect(otherClient.status).toBe(400);
  });

  it('turn a proposal into a pitch draft', async () => {
    const ba = await login(t, 'ba');
    const created = await ba.post<{ pitchId: string }>(`/api/action-items/${items[2]!.id}/pitch`);
    expect(created.status).toBe(201);
    const pitch = await ba.get<Pitch>(`/api/pitches/${created.body.pitchId}`);
    expect(pitch.body).toMatchObject({ title: 'Propose inventory streaming', status: 'draft' });
    expect(pitch.body.sourceMeeting?.id).toBe(meeting.id);
  });

  it('are deleted by Team Leads', async () => {
    expect((await dev.delete(`/api/meetings/${meeting.id}`)).status).toBe(403);
    const lead = await login(t, 'lead');
    expect((await lead.delete(`/api/meetings/${meeting.id}`)).status).toBe(204);
    // Tickets created from it remain, just without the link.
    expect((await lead.get<TicketDetail>('/api/tickets/ACME-1')).body.sourceMeeting).toBeNull();
  });
});
