import { count } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config/env';
import { hashPassword } from '../core/security/password';
import { generateTemporaryPassword } from '../core/security/tokens';
import type { Database } from './client';
import { roleAssignments, users } from './schema';

/**
 * On an empty database, creates the first administrator (also a Delivery Manager, so the
 * workspace can be set up). The password comes from HELM_ADMIN_PASSWORD or is generated and
 * logged once; either way it must be changed at first login.
 */
export async function ensureFirstAdmin(
  db: Database,
  config: Config,
  log: FastifyBaseLogger,
): Promise<void> {
  const [existing] = await db.select({ value: count() }).from(users);
  if ((existing?.value ?? 0) > 0) return;

  const { username, displayName } = config.bootstrapAdmin;
  const password = config.bootstrapAdmin.password ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(password, config.passwordHashCost);

  await db.transaction(async (tx) => {
    const [admin] = await tx
      .insert(users)
      .values({ username, displayName, passwordHash, isAdmin: true, mustChangePassword: true })
      .returning({ id: users.id });
    if (!admin) throw new Error('Could not create the first administrator');
    await tx.insert(roleAssignments).values({
      userId: admin.id,
      role: 'DELIVERY_MANAGER',
      scopeType: 'workspace',
    });
  });

  if (config.bootstrapAdmin.password) {
    log.info({ username }, 'Created the first administrator from HELM_ADMIN_PASSWORD');
  } else {
    log.warn(
      { username, temporaryPassword: password },
      'Created the first administrator with a generated password. Sign in and change it now; it is not shown again.',
    );
  }
}
