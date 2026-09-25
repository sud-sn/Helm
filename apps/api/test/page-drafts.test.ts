import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DraftPageResult, Meeting, Page, PageVersion, Ticket } from '@helm/shared';
import { AiProviderError, type LlmProvider } from '../src/core/ai';
import type { GenerateJsonRequest } from '../src/core/ai/provider';
import { aiRuns, auditLog, pages } from '../src/db/schema';
import { DOCX_MIME } from '../src/modules/pages/docx';
import { DRAFT_PROMPT_VERSION, finishDraft } from '../src/modules/pages/drafts.service';
import { DOC_TEMPLATES } from '../src/modules/pages/templates';
import { Client, createCycle, createTestApp, login, seedOrg, type TestApp } from './harness';

type Respond = (request: GenerateJsonRequest) => unknown;

/** Stands in for Azure OpenAI: answers from `respond` (or throws it) and records every request. */
function fakeProvider() {
  const requests: GenerateJsonRequest[] = [];
  let respond: Respond = () => ({ title: '', markdown: '', openQuestions: [] });
  const provider: LlmProvider = {
    name: 'azure-openai',
    description: {
      endpointHost: 'helm-test.openai.azure.com',
      deployment: 'gpt-4o',
      apiVersion: '2024-10-21',
    },
    async generateJson(request) {
      requests.push(request);
      return {
        output: respond(request),
        model: 'gpt-4o-2024-11-20',
        usage: { inputTokens: 3100, outputTokens: 2400 },
        durationMs: 41_000,
        responseFormat: 'json_schema',
      };
    },
  };
  return {
    provider,
    requests,
    answer(next: Respond) {
      respond = next;
    },
  };
}

const BRIEF =
  'Nightly Talend job loads POS sales from Postgres into the Snowflake SALES_FACT table, ' +
  'one row per order line, incremental on updated_at. Rejects go to a REJECTS table and the ' +
  'team channel is alerted. Qlik Sales app reloads after the load.';

const SPEC = [
  '# Sales mart load',
  '',
  '## 1. Overview',
  '',
  'Loads POS sales nightly into Snowflake.',
  '',
  '## Source systems',
  '',
  '| Source | Type | What is read | Frequency or volume | Access |',
  '| --- | --- | --- | --- | --- |',
  '| POS | Postgres | Order lines | Nightly | To confirm: service account |',
  '',
  '## Target and data model:',
  '',
  'SALES_FACT, one row per order line.',
].join('\n');

let t: TestApp;
let ai: ReturnType<typeof fakeProvider>;
let org: Awaited<ReturnType<typeof seedOrg>>;
let lead: Client;
let dev: Client;
let ticket: Ticket;
let rulesPage: Page;
let meeting: Meeting;
let drafted: DraftPageResult;

beforeAll(async () => {
  ai = fakeProvider();
  t = await createTestApp({}, { ai: ai.provider });
  org = await seedOrg(t);
  lead = await login(t, 'lead');
  dev = await login(t, 'dev');
  ticket = (
    await lead.post<Ticket>('/api/projects/ACME/tickets', {
      title: 'Build the sales fact load',
      type: 'pipeline',
      priority: 'high',
      cycleId: org.cycle.id,
      assigneeId: org.users.dev.id,
      description: 'Incremental on updated_at.\n\nSCD2 on product.',
    })
  ).body;
  rulesPage = (
    await lead.post<Page>('/api/projects/ACME/pages', {
      title: 'Revenue rules',
      body: 'Net sales exclude returns.',
    })
  ).body;
  meeting = (
    await dev.post<Meeting>('/api/meetings', {
      clientId: org.client.id,
      projectId: org.project.id,
      title: 'Design review',
      meetingDate: '2026-09-24',
      transcript: 'Dev: the load must finish before 06:00 UTC.',
    })
  ).body;
});
afterAll(() => t.close());

const draft = (client: Client, body: Record<string, unknown>, key = 'ACME') =>
  client.post<DraftPageResult>(`/api/projects/${key}/pages/draft`, {
    docType: 'technical_spec',
    brief: BRIEF,
    ...body,
  });

describe('AI document drafts', () => {
  it('write a technical specification from the notes, as an internal page to review', async () => {
    ai.answer(() => ({
      title: 'Sales mart load: technical specification',
      markdown: SPEC,
      openQuestions: ['Which warehouse runs the load?', 'Which warehouse runs the load?  '],
    }));
    const response = await draft(dev, {
      cycleId: org.cycle.id,
      pageIds: [rulesPage.id],
      meetingIds: [meeting.id],
    });
    expect(response.status).toBe(201);
    drafted = response.body;
    expect(drafted.page).toMatchObject({
      title: 'Sales mart load: technical specification',
      visibility: 'internal',
      version: 1,
      docType: 'technical_spec',
      aiDrafted: true,
      clientName: 'Acme Corp',
      projectKey: 'ACME',
    });
    expect(drafted.openQuestions).toEqual(['Which warehouse runs the load?']);

    const body = drafted.page.body;
    expect(body.startsWith('## 1. Overview')).toBe(true);
    expect(body).not.toContain('# Sales mart load\n');
    // Sections the model left out are added, so every draft has the full template.
    expect(body).toContain('## Testing\n\nTo confirm: nothing was written for this section yet.');
    expect(body.match(/^## Source systems$/gm)).toHaveLength(1);
    expect(body.match(/^## Target and data model/gm)).toHaveLength(1);
    expect(body).toMatch(/## Open questions\n\n- \[ \] Which warehouse runs the load\?\n$/);

    const request = ai.requests.at(-1)!;
    expect(request).toMatchObject({
      schemaName: 'page_draft',
      maxOutputTokens: 12_000,
      timeoutMs: 180_000,
    });
    expect(request.system).toContain('Never invent');
    for (const section of DOC_TEMPLATES.technical_spec) {
      expect(request.user).toContain(`## ${section.heading}`);
    }
    expect(request.user).toContain(BRIEF);
    expect(request.user).toContain('Cycle "Sprint 1"');
    expect(request.user).toContain(`${ticket.key} (Pipeline, To Do, `);
    expect(request.user).toContain('SCD2 on product.');
    expect(request.user).toContain('Page "Revenue rules":\nNet sales exclude returns.');
    expect(request.user).toContain('the load must finish before 06:00 UTC');
    expect(request.user).toContain('Client: Acme Corp · Project: Project ACME (ACME)');

    const [row] = await t.db.select().from(pages).where(eq(pages.id, drafted.page.id));
    const [run] = await t.db.select().from(aiRuns).where(eq(aiRuns.id, row!.aiRunId!));
    expect(run).toMatchObject({
      task: 'page_draft',
      status: 'succeeded',
      promptVersion: DRAFT_PROMPT_VERSION,
      model: 'gpt-4o-2024-11-20',
      inputTokens: 3100,
      outputTokens: 2400,
      requestedById: org.users.dev.id,
    });
    expect(run!.output).toMatchObject({
      docType: 'technical_spec',
      context: { cycle: true, tickets: 1, pages: 1, meetings: 1 },
    });
    expect(JSON.stringify(run!.output)).not.toContain('Loads POS sales nightly');

    const versions = await dev.get<PageVersion[]>(`/api/pages/${drafted.page.id}/versions`);
    expect(versions.body).toHaveLength(1);
    const [audit] = await t.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'page.drafted_with_ai'));
    expect(audit).toMatchObject({ entityId: drafted.page.id, actorId: org.users.dev.id });
    expect(audit!.data).toMatchObject({ docType: 'technical_spec', projectKey: 'ACME' });
  });

  it('keep the given title and use the delivery document sections', async () => {
    ai.answer(() => ({
      title: 'Something else',
      markdown: '## Summary\n\nSprint 1 delivered the sales fact load.',
      openQuestions: [],
    }));
    const response = await draft(lead, {
      docType: 'delivery_document',
      title: 'Sprint 1 delivery',
      ticketKeys: [ticket.key.toLowerCase()],
    });
    expect(response.status).toBe(201);
    expect(response.body.page).toMatchObject({
      title: 'Sprint 1 delivery',
      docType: 'delivery_document',
    });
    expect(response.body.page.body).not.toContain('## Open questions');
    expect(response.body.page.body).toContain('## Sign-off');
    const request = ai.requests.at(-1)!;
    expect(request.user).toContain('Document: Delivery document');
    expect(request.user).toContain('Title: Sprint 1 delivery');
    expect(request.user).toContain(`Selected tickets:\n- ${ticket.key}`);
    for (const section of DOC_TEMPLATES.delivery_document) {
      expect(request.user).toContain(`## ${section.heading}`);
    }
  });

  it('never include context the author cannot see', async () => {
    const dm = await login(t, 'dm');
    const glxTicket = (await dm.post<Ticket>('/api/projects/GLX/tickets', { title: 'Fleet feed' }))
      .body;
    expect(glxTicket.key).toBe('GLX-1');
    const glxCycle = await createCycle(t, org.otherProject.id, 'GLX sprint');
    const glxPage = (await dm.post<Page>('/api/projects/GLX/pages', { title: 'Fleet notes' })).body;
    const before = ai.requests.length;

    expect((await draft(dev, { ticketKeys: [glxTicket.key] })).status).toBe(404);
    expect((await draft(dev, { cycleId: glxCycle.id })).status).toBe(404);
    expect((await draft(dev, { pageIds: [glxPage.id] })).status).toBe(404);
    // Someone who can see both projects still cannot mix them.
    const mixed = await draft(dm, { pageIds: [glxPage.id] });
    expect(mixed.status).toBe(400);
    expect(mixed.body).toMatchObject({ error: { message: 'That page is not in this project.' } });
    expect(ai.requests.length).toBe(before);
  });

  it('are for people who can write pages in the project', async () => {
    for (const username of ['viewer', 'cycledev']) {
      const client = await login(t, username);
      expect((await draft(client, {})).status).toBe(403);
    }
    const acmeClient = await login(t, 'acme.client');
    expect([403, 404]).toContain((await draft(acmeClient, {})).status);
    const outsider = await login(t, 'outsider');
    expect((await draft(outsider, {})).status).toBe(404);
  });

  it('need a description of a few sentences', async () => {
    const response = await draft(dev, { brief: 'Sales load.' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { details: [{ path: 'brief' }] } });
  });

  it('record a failed run and save nothing when the model fails', async () => {
    const count = async () => (await t.db.select({ id: pages.id }).from(pages)).length;
    const pagesBefore = await count();

    ai.answer(() => {
      throw new AiProviderError('timeout', 'Azure OpenAI did not answer in time.');
    });
    const timedOut = await draft(dev, {});
    expect(timedOut.status).toBe(504);
    expect(timedOut.body).toMatchObject({ error: { code: 'AI_TIMEOUT' } });

    ai.answer(() => ({ title: 'Empty', markdown: '   ', openQuestions: [] }));
    const empty = await draft(dev, {});
    expect(empty.status).toBe(502);
    expect(empty.body).toMatchObject({ error: { code: 'AI_BAD_OUTPUT' } });

    expect(await count()).toBe(pagesBefore);
    const failed = await t.db.select().from(aiRuns).where(eq(aiRuns.status, 'failed'));
    expect(failed.map((run) => run.errorKind).sort()).toEqual(['invalid_output', 'timeout']);
    expect(failed.every((run) => run.task === 'page_draft')).toBe(true);
  });
});

describe('Word export', () => {
  const download = async (client: Client, pageId: string) =>
    t.app.inject({
      method: 'GET',
      url: `/api/pages/${pageId}/export.docx`,
      headers: client.cookie ? { cookie: client.cookie } : {},
    });

  it('downloads a page as a Word document named after it', async () => {
    const response = await download(dev, drafted.page.id);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(DOCX_MIME);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="Sales mart load- technical specification.docx"; ' +
        "filename*=UTF-8''Sales%20mart%20load-%20technical%20specification.docx",
    );
    const zip = await JSZip.loadAsync(response.rawPayload);
    const document = await zip.file('word/document.xml')!.async('string');
    expect(document).toContain('Sales mart load: technical specification');
    expect(document).toContain(
      'Technical specification · Acme Corp · Project ACME (ACME) · Version 1',
    );
    expect(document).toContain('Which warehouse runs the load?');
  });

  it('follows the page’s access: clients only get pages shared with them', async () => {
    const acmeClient = await login(t, 'acme.client');
    const outsider = await login(t, 'outsider');
    expect((await download(acmeClient, drafted.page.id)).statusCode).toBe(404);
    expect((await download(outsider, drafted.page.id)).statusCode).toBe(404);
    expect((await download(new Client(t.app), drafted.page.id)).statusCode).toBe(401);

    await lead.request('PUT', `/api/pages/${drafted.page.id}/visibility`, { visibility: 'client' });
    expect((await download(acmeClient, drafted.page.id)).statusCode).toBe(200);
  });
});

describe('finishDraft', () => {
  const sections = DOC_TEMPLATES.delivery_document;

  it('adds every missing section in template order and the questions at the end', () => {
    const { body, missingSections } = finishDraft('## Summary\n\nDone.', sections, ['Who signs?']);
    expect(missingSections).toEqual(sections.slice(1).map((section) => section.heading));
    const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual([...sections.map((section) => section.heading), 'Open questions']);
  });

  it('does not add a second open questions section', () => {
    const { body } = finishDraft('## Summary\n\n## Open questions\n\n- Who?', sections, ['Who?']);
    expect(body.match(/## Open questions/g)).toHaveLength(1);
  });
});
