import { and, asc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import type {
  AdminUser,
  CreateUserInput,
  ResetPasswordInput,
  TemporaryPasswordResponse,
  UpdateUserInput,
  UserSummary,
  UserType,
} from '@helm/shared';
import type { Executor } from '../../db/client';
import { clients, roleAssignments, users } from '../../db/schema';
import { recordAudit } from '../../core/audit';
import type { RequestContext } from '../../core/context';
import { badRequest, conflict, notFound } from '../../core/errors';
import { iso } from '../../core/dto';
import { hashPassword } from '../../core/security/password';
import { generateTemporaryPassword } from '../../core/security/tokens';
import { deleteUserSessions } from '../../core/sessions';

const adminUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  email: users.email,
  userType: users.userType,
  clientId: users.clientId,
  clientName: clients.name,
  isAdmin: users.isAdmin,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  lockedUntil: users.lockedUntil,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

type AdminUserRow = {
  [K in keyof typeof adminUserColumns]: (typeof adminUserColumns)[K]['_']['data'] | null;
};

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id!,
    username: row.username!,
    displayName: row.displayName!,
    email: row.email ?? null,
    userType: row.userType!,
    clientId: row.clientId ?? null,
    clientName: row.clientName ?? null,
    isAdmin: row.isAdmin!,
    isActive: row.isActive!,
    mustChangePassword: row.mustChangePassword!,
    lockedUntil:
      row.lockedUntil && row.lockedUntil.getTime() > Date.now() ? iso(row.lockedUntil) : null,
    lastLoginAt: iso(row.lastLoginAt),
    createdAt: row.createdAt!.toISOString(),
  };
}

async function findAdminUser(db: Executor, userId: string): Promise<AdminUser | null> {
  const [row] = await db
    .select(adminUserColumns)
    .from(users)
    .leftJoin(clients, eq(clients.id, users.clientId))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toAdminUser(row) : null;
}

export async function listUsers(
  ctx: RequestContext,
  query: { q?: string; userType?: UserType; includeInactive?: boolean },
): Promise<AdminUser[]> {
  ctx.access.requireAdmin();
  const filters = [];
  if (!query.includeInactive) filters.push(eq(users.isActive, true));
  if (query.userType) filters.push(eq(users.userType, query.userType));
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_\\]/g, '\\$&')}%`;
    filters.push(
      or(
        ilike(users.username, pattern),
        ilike(users.displayName, pattern),
        ilike(users.email, pattern),
      ),
    );
  }
  const rows = await ctx.db
    .select(adminUserColumns)
    .from(users)
    .leftJoin(clients, eq(clients.id, users.clientId))
    .where(and(...filters))
    .orderBy(asc(users.displayName));
  return rows.map(toAdminUser);
}

export async function getUser(ctx: RequestContext, userId: string): Promise<AdminUser> {
  ctx.access.requireAdmin();
  const user = await findAdminUser(ctx.db, userId);
  if (!user) throw notFound('User');
  return user;
}

async function assertUnique(
  db: Executor,
  field: 'username' | 'email',
  value: string,
  exceptId?: string,
) {
  const column = field === 'username' ? users.username : users.email;
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(exceptId ? and(eq(column, value), ne(users.id, exceptId)) : eq(column, value))
    .limit(1);
  if (existing) {
    throw conflict(
      field === 'username'
        ? 'That username is already taken.'
        : 'That email address is already in use.',
      field === 'username' ? 'USERNAME_TAKEN' : 'EMAIL_TAKEN',
    );
  }
}

export async function createUser(
  ctx: RequestContext,
  input: CreateUserInput & { userType: UserType; isAdmin: boolean },
): Promise<TemporaryPasswordResponse> {
  ctx.access.requireAdmin();
  const { db, config } = ctx;
  await assertUnique(db, 'username', input.username);
  if (input.email) await assertUnique(db, 'email', input.email);

  if (input.userType === 'client') {
    const [company] = await db
      .select({ id: clients.id, archivedAt: clients.archivedAt })
      .from(clients)
      .where(eq(clients.id, input.clientId!))
      .limit(1);
    if (!company) throw badRequest('That client company does not exist.');
    if (company.archivedAt) throw badRequest('That client company is archived.');
  }

  const temporaryPassword = input.password ? null : generateTemporaryPassword();
  const passwordHash = await hashPassword(
    input.password ?? temporaryPassword!,
    config.passwordHashCost,
  );

  const userId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        username: input.username,
        displayName: input.displayName,
        email: input.email ?? null,
        userType: input.userType,
        clientId: input.userType === 'client' ? input.clientId! : null,
        isAdmin: input.isAdmin,
        passwordHash,
        mustChangePassword: true,
        createdById: ctx.user.id,
      })
      .returning({ id: users.id });
    if (!created) throw new Error('Insert failed');

    // A client user starts with access to everything shared with their company.
    if (input.userType === 'client') {
      await tx.insert(roleAssignments).values({
        userId: created.id,
        role: 'CLIENT',
        scopeType: 'client',
        clientId: input.clientId!,
        grantedById: ctx.user.id,
      });
    }

    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'user.created',
      entityType: 'user',
      entityId: created.id,
      data: { username: input.username, userType: input.userType, isAdmin: input.isAdmin },
      ip: ctx.ip,
    });
    return created.id;
  });

  return { user: (await findAdminUser(db, userId))!, temporaryPassword };
}

async function countOtherActiveAdmins(db: Executor, exceptUserId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isAdmin, true), eq(users.isActive, true), ne(users.id, exceptUserId)));
  return row?.value ?? 0;
}

export async function updateUser(
  ctx: RequestContext,
  userId: string,
  input: UpdateUserInput,
): Promise<AdminUser> {
  ctx.access.requireAdmin();
  const { db } = ctx;
  const existing = await findAdminUser(db, userId);
  if (!existing) throw notFound('User');

  const removingAdmin = input.isAdmin === false && existing.isAdmin;
  const deactivating = input.isActive === false && existing.isActive;
  if (userId === ctx.user.id && (removingAdmin || deactivating)) {
    throw badRequest('You cannot remove your own administrator access or deactivate yourself.');
  }
  if (
    (removingAdmin || (deactivating && existing.isAdmin)) &&
    (await countOtherActiveAdmins(db, userId)) === 0
  ) {
    throw badRequest('At least one active administrator is required.');
  }
  if (input.isAdmin && existing.userType === 'client') {
    throw badRequest('Client users cannot be administrators.');
  }
  if (input.email) await assertUnique(db, 'email', input.email, userId);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        displayName: input.displayName,
        email: input.email === undefined ? undefined : input.email,
        isAdmin: input.isAdmin,
        isActive: input.isActive,
      })
      .where(eq(users.id, userId));
    if (deactivating) await deleteUserSessions(tx, userId);
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'user.updated',
      entityType: 'user',
      entityId: userId,
      data: { changes: input },
      ip: ctx.ip,
    });
  });
  return (await findAdminUser(db, userId))!;
}

export async function resetPassword(
  ctx: RequestContext,
  userId: string,
  input: ResetPasswordInput,
): Promise<TemporaryPasswordResponse> {
  ctx.access.requireAdmin();
  const { db, config } = ctx;
  const existing = await findAdminUser(db, userId);
  if (!existing) throw notFound('User');

  const temporaryPassword = input.password ? null : generateTemporaryPassword();
  const passwordHash = await hashPassword(
    input.password ?? temporaryPassword!,
    config.passwordHashCost,
  );
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, userId));
    await deleteUserSessions(tx, userId);
    await recordAudit(tx, {
      actorId: ctx.user.id,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: userId,
      ip: ctx.ip,
    });
  });
  return { user: (await findAdminUser(db, userId))!, temporaryPassword };
}

/**
 * People a staff member can pick (assignees, members to add, mentions). Client users only appear
 * when filtering by their company, and client users themselves cannot browse the directory.
 */
export async function userDirectory(
  ctx: RequestContext,
  query: { q?: string; userType?: UserType; clientId?: string },
): Promise<(UserSummary & { userType: UserType })[]> {
  ctx.access.requireStaff();
  const filters = [eq(users.isActive, true)];
  if (query.userType === 'client' || query.clientId) {
    filters.push(eq(users.userType, 'client'));
    if (query.clientId) filters.push(eq(users.clientId, query.clientId));
  } else {
    filters.push(eq(users.userType, 'staff'));
  }
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_\\]/g, '\\$&')}%`;
    filters.push(or(ilike(users.username, pattern), ilike(users.displayName, pattern))!);
  }
  return ctx.db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      userType: users.userType,
    })
    .from(users)
    .where(and(...filters))
    .orderBy(asc(users.displayName))
    .limit(200);
}
