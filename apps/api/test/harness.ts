import { randomUUID } from 'node:crypto';
import type { FastifyInstance, InjectOptions } from 'fastify';
import pg from 'pg';
import type { Role, ScopeType, UserType } from '@helm/shared';
import { buildApp } from '../src/app';
import { loadConfig, type Config } from '../src/config/env';
import { createDatabase, type Database } from '../src/db/client';
import { clients, cycles, projects, roleAssignments, users } from '../src/db/schema';
import { hashPassword } from '../src/core/security/password';
import {
  MAINTENANCE_URL,
  TEMPLATE_DATABASE,
  TEST_DATABASE_PREFIX,
  TEST_DATABASE_URL,
  withDatabase,
} from './db-urls';

export const TEST_PASSWORD = 'correct horse battery';

async function maintenanceQuery(sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: MAINTENANCE_URL });
  await client.connect();
  try {
    // CREATE DATABASE ... TEMPLATE fails if another clone runs at the same moment; serialise them.
    await client.query('select pg_advisory_lock(7270002)');
    await client.query(sql);
  } finally {
    await client.query('select pg_advisory_unlock(7270002)').catch(() => {});
    await client.end();
  }
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string | string[] | number | undefined>;
}

export interface TestApp {
  app: FastifyInstance;
  db: Database;
  config: Config;
  close: () => Promise<void>;
}

/** A fresh app on a private copy of the migrated template database. */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const database = `${TEST_DATABASE_PREFIX}${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await maintenanceQuery(`create database "${database}" template "${TEMPLATE_DATABASE}"`);
  const url = withDatabase(TEST_DATABASE_URL, database);
  const handle = createDatabase(url, { max: 5 });
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: url,
    PASSWORD_HASH_COST: '10',
    LOGIN_RATE_LIMIT_PER_MINUTE: '10000',
    ...env,
  });
  const app = await buildApp({ db: handle.db, config });
  await app.ready();
  return {
    app,
    db: handle.db,
    config,
    close: async () => {
      await app.close();
      await handle.close();
      await maintenanceQuery(`drop database if exists "${database}" with (force)`);
    },
  };
}

// ------------------------------------------------------------------ requests

export class Client {
  constructor(
    private readonly app: FastifyInstance,
    public cookie: string | null = null,
  ) {}

  async request<T = unknown>(
    method: InjectOptions['method'],
    url: string,
    body?: unknown,
    options: { csrf?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    if (options.csrf !== false) headers['x-requested-with'] = 'helm';
    if (this.cookie) headers.cookie = this.cookie;
    const response = await this.app.inject({
      method,
      url,
      headers,
      ...(body !== undefined ? { payload: body as InjectOptions['payload'] } : {}),
    });
    const setCookie = response.cookies.find((c) => c.name === 'helm_session');
    if (setCookie) this.cookie = setCookie.value ? `helm_session=${setCookie.value}` : null;
    const text = response.body;
    return {
      status: response.statusCode,
      body: (text ? JSON.parse(text) : undefined) as T,
      headers: response.headers,
    };
  }

  get<T = unknown>(url: string) {
    return this.request<T>('GET', url);
  }
  post<T = unknown>(url: string, body?: unknown) {
    return this.request<T>('POST', url, body ?? {});
  }
  patch<T = unknown>(url: string, body: unknown) {
    return this.request<T>('PATCH', url, body);
  }
  delete<T = unknown>(url: string) {
    return this.request<T>('DELETE', url);
  }
}

export async function login(
  t: TestApp,
  username: string,
  password = TEST_PASSWORD,
): Promise<Client> {
  const client = new Client(t.app);
  const response = await client.post('/api/auth/login', { login: username, password });
  if (response.status !== 200) {
    throw new Error(
      `Login as ${username} failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return client;
}

// ------------------------------------------------------------------ factories

let sequence = 0;
const next = () => ++sequence;

export async function createUser(
  t: TestApp,
  options: {
    username?: string;
    displayName?: string;
    userType?: UserType;
    clientId?: string | null;
    isAdmin?: boolean;
    password?: string;
    mustChangePassword?: boolean;
  } = {},
) {
  const username = options.username ?? `user${next()}`;
  const [user] = await t.db
    .insert(users)
    .values({
      username,
      displayName: options.displayName ?? username,
      userType: options.userType ?? 'staff',
      clientId: options.clientId ?? null,
      isAdmin: options.isAdmin ?? false,
      passwordHash: await hashPassword(
        options.password ?? TEST_PASSWORD,
        t.config.passwordHashCost,
      ),
      mustChangePassword: options.mustChangePassword ?? false,
    })
    .returning();
  return user!;
}

export async function grant(
  t: TestApp,
  userId: string,
  role: Role,
  scopeType: ScopeType,
  scopeId: string | null = null,
) {
  await t.db.insert(roleAssignments).values({
    userId,
    role,
    scopeType,
    clientId: scopeType === 'client' ? scopeId : null,
    projectId: scopeType === 'project' ? scopeId : null,
    cycleId: scopeType === 'cycle' ? scopeId : null,
  });
}

export async function createClientCompany(t: TestApp, name = `Client ${next()}`) {
  const [row] = await t.db.insert(clients).values({ name }).returning();
  return row!;
}

export async function createProject(t: TestApp, clientId: string, key = `P${next()}`) {
  const [row] = await t.db
    .insert(projects)
    .values({ clientId, key, name: `Project ${key}` })
    .returning();
  return row!;
}

export async function createCycle(t: TestApp, projectId: string, name = `Cycle ${next()}`) {
  const [row] = await t.db.insert(cycles).values({ projectId, name, status: 'active' }).returning();
  return row!;
}

/**
 * A small agency: one client with a project and a cycle, and a person for each role.
 * All staff can log in with TEST_PASSWORD.
 */
export async function seedOrg(t: TestApp) {
  const client = await createClientCompany(t, 'Acme Corp');
  const project = await createProject(t, client.id, 'ACME');
  const cycle = await createCycle(t, project.id, 'Sprint 1');
  const otherClient = await createClientCompany(t, 'Globex');
  const otherProject = await createProject(t, otherClient.id, 'GLX');

  const admin = await createUser(t, { username: 'admin', isAdmin: true });
  const dm = await createUser(t, { username: 'dm' });
  const pm = await createUser(t, { username: 'pm' });
  const lead = await createUser(t, { username: 'lead' });
  const ba = await createUser(t, { username: 'ba' });
  const dev = await createUser(t, { username: 'dev' });
  const cycleDev = await createUser(t, { username: 'cycledev' });
  const viewer = await createUser(t, { username: 'viewer' });
  const outsider = await createUser(t, { username: 'outsider' });
  const clientUser = await createUser(t, {
    username: 'acme.client',
    userType: 'client',
    clientId: client.id,
  });

  await grant(t, dm.id, 'DELIVERY_MANAGER', 'workspace');
  await grant(t, pm.id, 'PROJECT_MANAGER', 'client', client.id);
  await grant(t, lead.id, 'TEAM_LEAD', 'project', project.id);
  await grant(t, ba.id, 'BUSINESS_ANALYST', 'project', project.id);
  await grant(t, dev.id, 'DEVELOPER', 'project', project.id);
  await grant(t, cycleDev.id, 'DEVELOPER', 'cycle', cycle.id);
  await grant(t, viewer.id, 'VIEWER', 'project', project.id);
  await grant(t, outsider.id, 'DEVELOPER', 'project', otherProject.id);
  await grant(t, clientUser.id, 'CLIENT', 'client', client.id);

  return {
    client,
    project,
    cycle,
    otherClient,
    otherProject,
    users: { admin, dm, pm, lead, ba, dev, cycleDev, viewer, outsider, clientUser },
  };
}
