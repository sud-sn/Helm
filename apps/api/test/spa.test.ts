import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './harness';

describe('serving the web app', () => {
  let t: TestApp;
  let dist: string;

  beforeAll(async () => {
    dist = mkdtempSync(join(tmpdir(), 'helm-web-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Helm</title>');
    writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
    t = await createTestApp({ WEB_DIST_DIR: dist });
  });
  afterAll(async () => {
    await t.close();
    rmSync(dist, { recursive: true, force: true });
  });

  it('caches fingerprinted assets for a year and revalidates the page', async () => {
    const asset = await t.app.inject({ url: '/assets/index-abc123.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const page = await t.app.inject({ url: '/' });
    expect(page.headers['cache-control']).toBe('no-cache');
  });

  it('answers client-side routes with the page and unknown API routes with JSON', async () => {
    const deepLink = await t.app.inject({ url: '/projects/ACME/board' });
    expect(deepLink.statusCode).toBe(200);
    expect(deepLink.headers['content-type']).toContain('text/html');
    expect(deepLink.headers['cache-control']).toBe('no-cache');

    const api = await t.app.inject({ url: '/api/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
