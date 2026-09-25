import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 256-bit random token, URL-safe. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Letters and digits without look-alikes (0/O, 1/l/I). */
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A temporary password such as `k7Qm-Xp3r-Z9tw-Hd4v`, easy to read out and type. */
export function generateTemporaryPassword(): string {
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join(
      '',
    ),
  );
  return groups.join('-');
}
