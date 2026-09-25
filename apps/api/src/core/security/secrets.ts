import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Encryption for secrets Helm must store and later use itself, such as the Azure OpenAI key an
 * administrator enters. AES-256-GCM (confidentiality and tamper detection) with a random nonce per
 * value. The key comes from the server secret, which never lives in the database, so a copy of
 * the database alone does not reveal stored secrets.
 */

const FORMAT = 'v1';

export function deriveEncryptionKey(serverSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', serverSecret, 'helm', 'helm:stored-secrets:v1', 32));
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [FORMAT, nonce, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
    .join('.');
}

/** Throws if the value was changed or was encrypted with a different server secret. */
export function decryptSecret(stored: string, key: Buffer): string {
  const [format, nonce, tag, ciphertext] = stored.split('.');
  if (format !== FORMAT || !nonce || !tag || ciphertext === undefined) {
    throw new Error('Unrecognised encrypted value.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * The server secret: HELM_SECRET_KEY when it is set, otherwise a random one created on first use
 * in `<dataDir>/secret.key`, readable only by the user the server runs as. Losing it means stored
 * secrets have to be entered again, so back it up with the database.
 */
export function loadServerSecret({
  secret,
  dataDir,
}: {
  secret: string | undefined;
  dataDir: string;
}): string {
  if (secret) return secret;
  const file = join(dataDir, 'secret.key');
  try {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    // 'wx' never overwrites: if another server instance created the file first, use theirs.
    writeFileSync(file, `${randomBytes(32).toString('base64')}\n`, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw new Error(
        `Cannot create the server secret at ${file}. Set HELM_SECRET_KEY, or HELM_DATA_DIR to a ` +
          'folder the server can write to.',
        { cause: error },
      );
    }
  }
  return readFileSync(file, 'utf8').trim();
}
