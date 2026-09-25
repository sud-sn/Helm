import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pitch, PitchComment } from '@helm/shared';
import { notifications } from '../src/db/schema';
import {
  createTestApp,
  createUser,
  grant,
  login,
  seedOrg,
  type Client,
  type TestApp,
} from './harness';

let t: TestApp;
let org: Awaited<ReturnType<typeof seedOrg>>;
let ba: Client;
let pm: Client;
let clientUser: Client;
let pitch: Pitch;

beforeAll(async () => {
  t = await createTestApp();
  org = await seedOrg(t);
  ba = await login(t, 'ba');
  pm = await login(t, 'pm');
  clientUser = await login(t, 'acme.client');
});
afterAll(() => t.close());

async function notificationTypes(userId: string) {
  const rows = await t.db.select().from(notifications).where(eq(notifications.userId, userId));
  return rows.map((row) => row.type);
}

describe('pitch lifecycle', () => {
  it('starts as an internal draft written by the team', async () => {
    const created = await ba.post<Pitch>('/api/pitches', {
      clientId: org.client.id,
      projectId: org.project.id,
      title: 'Real-time inventory pipeline',
      summary: 'Stores see stock levels a day late.',
      proposal: 'Stream POS events into Snowflake with Snowpipe.',
      estimateHours: 120,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'draft',
      projectKey: 'ACME',
      clientName: 'Acme Corp',
    });
    pitch = created.body;

    const dev = await login(t, 'dev');
    expect(
      (await dev.post('/api/pitches', { clientId: org.client.id, title: 'Dev idea' })).status,
    ).toBe(403);
    expect((await clientUser.get(`/api/pitches/${pitch.id}`)).status).toBe(404);
    expect((await clientUser.get<Pitch[]>('/api/pitches')).body).toEqual([]);
  });

  it('goes to a Project Manager for review', async () => {
    const edited = await ba.patch<Pitch>(`/api/pitches/${pitch.id}`, { estimateHours: 140 });
    expect(edited.body.estimateHours).toBe(140);
    const submitted = await ba.post<Pitch>(`/api/pitches/${pitch.id}/submit`);
    expect(submitted.body.status).toBe('in_review');
    expect(await notificationTypes(org.users.pm.id)).toContain('pitch_submitted');
    expect((await ba.patch(`/api/pitches/${pitch.id}`, { title: 'Sneaky edit' })).status).toBe(409);

    const lead = await login(t, 'lead');
    expect((await lead.post(`/api/pitches/${pitch.id}/review`, { decision: 'send' })).status).toBe(
      403,
    );

    const returned = await pm.post<Pitch>(`/api/pitches/${pitch.id}/review`, {
      decision: 'return',
      note: 'Add the licence cost.',
    });
    expect(returned.body.status).toBe('draft');
    const comments = await ba.get<PitchComment[]>(`/api/pitches/${pitch.id}/comments`);
    expect(comments.body).toMatchObject([
      { body: 'Add the licence cost.', visibility: 'internal' },
    ]);
  });

  it('keeps comments internal until the pitch has been sent', async () => {
    const early = await ba.post(`/api/pitches/${pitch.id}/comments`, {
      body: 'Hello client',
      visibility: 'client',
    });
    expect(early.status).toBe(400);
  });

  it('is sent to the client, who is notified and sees only client-visible comments', async () => {
    await ba.post(`/api/pitches/${pitch.id}/submit`);
    const sent = await pm.post<Pitch>(`/api/pitches/${pitch.id}/review`, { decision: 'send' });
    expect(sent.body).toMatchObject({ status: 'sent', sentBy: { username: 'pm' } });
    expect(await notificationTypes(org.users.clientUser.id)).toContain('pitch_sent');

    const seen = await clientUser.get<Pitch>(`/api/pitches/${pitch.id}`);
    expect(seen.body.status).toBe('sent');
    expect(seen.body.sourceMeeting).toBeNull();

    await ba.post(`/api/pitches/${pitch.id}/comments`, {
      body: 'Happy to walk you through it.',
      visibility: 'client',
    });
    const asked = await clientUser.post<PitchComment>(`/api/pitches/${pitch.id}/comments`, {
      body: 'Does this include store onboarding?',
      visibility: 'internal',
    });
    expect(asked.body.visibility).toBe('client');
    expect(await notificationTypes(org.users.ba.id)).toContain('pitch_commented');

    const clientView = await clientUser.get<PitchComment[]>(`/api/pitches/${pitch.id}/comments`);
    expect(clientView.body.map((c) => c.body)).toEqual([
      'Happy to walk you through it.',
      'Does this include store onboarding?',
    ]);
  });

  it('lets the client ask for changes, then accept', async () => {
    const changes = await clientUser.post<Pitch>(`/api/pitches/${pitch.id}/respond`, {
      response: 'changes_requested',
      note: 'Phase the rollout by region.',
    });
    expect(changes.body).toMatchObject({ status: 'changes_requested', respondedOnBehalf: false });
    expect(await notificationTypes(org.users.ba.id)).toContain('pitch_responded');

    await ba.patch(`/api/pitches/${pitch.id}`, { proposal: 'Phase 1: North region…' });
    await ba.post(`/api/pitches/${pitch.id}/submit`);
    // While the team revises, the client sees it as "changes requested", never the internal state.
    expect((await clientUser.get<Pitch>(`/api/pitches/${pitch.id}`)).body.status).toBe(
      'changes_requested',
    );
    await pm.post(`/api/pitches/${pitch.id}/review`, { decision: 'send' });

    const accepted = await clientUser.post<Pitch>(`/api/pitches/${pitch.id}/respond`, {
      response: 'accepted',
    });
    expect(accepted.body.status).toBe('accepted');
    expect(
      (await clientUser.post(`/api/pitches/${pitch.id}/respond`, { response: 'rejected' })).status,
    ).toBe(409);
    expect((await pm.post(`/api/pitches/${pitch.id}/withdraw`)).status).toBe(409);
  });

  it('lets a Project Manager record an answer given outside the portal', async () => {
    const second = await pm.post<Pitch>('/api/pitches', {
      clientId: org.client.id,
      title: 'Data quality alerts',
    });
    await pm.post(`/api/pitches/${second.body.id}/submit`);
    await pm.post(`/api/pitches/${second.body.id}/review`, { decision: 'send' });
    const recorded = await pm.post<Pitch>(`/api/pitches/${second.body.id}/respond`, {
      response: 'rejected',
      note: 'Budget freeze (phone call)',
    });
    expect(recorded.body).toMatchObject({ status: 'rejected', respondedOnBehalf: true });
    const [note] = await t.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, org.users.clientUser.id),
          eq(notifications.type, 'pitch_responded'),
        ),
      );
    expect(note).toBeUndefined();
  });

  it('never shows one client another client’s pitches', async () => {
    const globexUser = await createUser(t, {
      username: 'globex.client',
      userType: 'client',
      clientId: org.otherClient.id,
    });
    await grant(t, globexUser.id, 'CLIENT', 'client', org.otherClient.id);
    const globex = await login(t, 'globex.client');
    expect((await globex.get<Pitch[]>('/api/pitches')).body).toEqual([]);
    expect((await globex.get(`/api/pitches/${pitch.id}`)).status).toBe(404);
    expect((await globex.post(`/api/pitches/${pitch.id}/comments`, { body: 'hi' })).status).toBe(
      404,
    );
  });
});
