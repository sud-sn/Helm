import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptSecret, deriveEncryptionKey, encryptSecret, loadServerSecret } from './secrets';

const key = deriveEncryptionKey('a-server-secret-that-is-long-enough-for-tests');

describe('stored secrets', () => {
  it('round-trip, with a fresh nonce every time', () => {
    const first = encryptSecret('azure-api-key-1234', key);
    const second = encryptSecret('azure-api-key-1234', key);
    expect(first).not.toBe(second);
    expect(first).not.toContain('azure-api-key');
    expect(decryptSecret(first, key)).toBe('azure-api-key-1234');
  });

  it('refuse values that were changed or encrypted with another server secret', () => {
    const stored = encryptSecret('azure-api-key-1234', key);
    const [format, nonce, tag, ciphertext] = stored.split('.');
    const flipped = Buffer.from(ciphertext!, 'base64');
    flipped[0] = flipped[0]! ^ 1;
    expect(() =>
      decryptSecret([format, nonce, tag, flipped.toString('base64')].join('.'), key),
    ).toThrow();
    expect(() => decryptSecret(stored, deriveEncryptionKey('another-secret'))).toThrow();
    expect(() => decryptSecret('plain-text-key', key)).toThrow('Unrecognised');
  });
});

describe('server secret', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  it('prefers HELM_SECRET_KEY', () => {
    expect(loadServerSecret({ secret: 'from-the-environment', dataDir: '/nonexistent' })).toBe(
      'from-the-environment',
    );
  });

  it('is created once in the data folder, private to the server, and reused', () => {
    const dir = mkdtempSync(join(tmpdir(), 'helm-data-'));
    dirs.push(dir);
    const dataDir = join(dir, 'data');
    const first = loadServerSecret({ secret: undefined, dataDir });
    expect(first).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(loadServerSecret({ secret: undefined, dataDir })).toBe(first);
    expect(readFileSync(join(dataDir, 'secret.key'), 'utf8').trim()).toBe(first);
    expect(statSync(join(dataDir, 'secret.key')).mode & 0o777).toBe(0o600);
  });
});
