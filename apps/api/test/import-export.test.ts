import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ImportResult, Ticket } from '@helm/shared';
import { auditLog } from '../src/db/schema';
import { createTestApp, login, seedOrg, type Client, type TestApp } from './harness';

let t: TestApp;
let lead: Client;

beforeAll(async () => {
  t = await createTestApp();
  await seedOrg(t);
  lead = await login(t, 'lead');
});
afterAll(() => t.close());

const trackerCsv = [
  'Summary,State,Owner,Due,Sprint,Tags,Priority,Type,Estimate',
  'Load SAP orders,In Progress,dev,31/10/2026,Sprint 1,"sap, orders",P1,ETL,8',
  'Revenue dashboard,Open,,2026-11-15,,powerbi,Normal,Dashboard,',
  '"Fix ""null"" customer ids",Closed,DEV,,,,,defect,2.5',
].join('\n');

describe('CSV import', () => {
  it('reports every problem without writing anything', async () => {
    const csv = [
      'title,status,assignee,due_date,priority',
      ',todo,,,',
      'Bad status,finished,,,',
      'Bad date,todo,,31/02/2026,',
      'Unknown person,todo,ghost,,',
      'Outsider,todo,outsider,,',
    ].join('\n');
    const result = await lead.post<ImportResult>('/api/projects/ACME/tickets/import', {
      csv,
      dryRun: false,
    });
    expect(result.status).toBe(200);
    expect(result.body.valid).toBe(false);
    expect(result.body.created).toBe(0);
    expect(result.body.rows.map((row) => [row.row, row.errors.length > 0])).toEqual([
      [2, true],
      [3, true],
      [4, true],
      [5, true],
      [6, true],
    ]);
    expect(result.body.rows[4]!.errors[0]).toContain('cannot be assigned');
    expect((await lead.get<Ticket[]>('/api/projects/ACME/tickets')).body).toHaveLength(0);
  });

  it('understands common tracker headers and values, then imports all rows at once', async () => {
    const dryRun = await lead.post<ImportResult>('/api/projects/ACME/tickets/import', {
      csv: trackerCsv,
    });
    expect(dryRun.body).toMatchObject({ dryRun: true, valid: true, totalRows: 3, created: 0 });

    const result = await lead.post<ImportResult>('/api/projects/ACME/tickets/import', {
      csv: trackerCsv,
      dryRun: false,
    });
    expect(result.body.created).toBe(3);
    const tickets = (await lead.get<Ticket[]>('/api/projects/ACME/tickets')).body.reverse();
    expect(
      tickets.map((ticket) => [
        ticket.key,
        ticket.status,
        ticket.priority,
        ticket.type,
        ticket.assignee?.username ?? null,
      ]),
    ).toEqual([
      ['ACME-1', 'in_progress', 'urgent', 'pipeline', 'dev'],
      ['ACME-2', 'todo', 'medium', 'report', null],
      ['ACME-3', 'done', 'medium', 'bug', 'dev'],
    ]);
    expect(tickets[0]).toMatchObject({
      dueDate: '2026-10-31',
      cycleName: 'Sprint 1',
      labels: ['sap', 'orders'],
      estimateHours: 8,
    });
    expect(tickets[2]!.title).toBe('Fix "null" customer ids');
    const [audit] = await t.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'tickets.imported'));
    expect(audit?.data).toMatchObject({ count: 3 });
  });

  it('is limited to people who can create tickets', async () => {
    const dev = await login(t, 'dev');
    expect((await dev.post('/api/projects/ACME/tickets/import', { csv: trackerCsv })).status).toBe(
      403,
    );
  });
});

describe('CSV export', () => {
  it('produces an Excel-friendly file that neutralises formulas and imports back', async () => {
    await lead.post('/api/projects/ACME/tickets', {
      title: '=HYPERLINK("http://evil")',
      description: '- bullet',
    });
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/projects/ACME/tickets/export',
      headers: { cookie: lead.cookie! },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toMatch(/ACME-tickets-\d{4}-\d{2}-\d{2}\.csv/);
    expect(response.body.startsWith('\uFEFFkey,title,description')).toBe(true);
    expect(response.body).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(response.body).toContain("'- bullet");

    const reimport = await lead.post<ImportResult>('/api/projects/ACME/tickets/import', {
      csv: response.body,
    });
    expect(reimport.body.valid).toBe(true);
  });
});
