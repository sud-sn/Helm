import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

/**
 * Hashes a password with scrypt. The stored format carries its parameters
 * (`scrypt$N$r$p$salt$hash`), so the cost can be raised later without breaking old hashes.
 */
export async function hashPassword(password: string, costLog2: number): Promise<string> {
  const N = 2 ** costLog2;
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: 256 * N * BLOCK_SIZE,
  });
  return [
    'scrypt',
    N,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const N = Number(n);
  const blockSize = Number(r);
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(
    password.normalize('NFKC'),
    Buffer.from(saltB64, 'base64'),
    expected.length,
    {
      N,
      r: blockSize,
      p: Number(p),
      maxmem: 256 * N * blockSize,
    },
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Verified against when a login name does not exist, so response time does not reveal it. */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(costLog2: number): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'), costLog2);
  return dummyHash;
}
