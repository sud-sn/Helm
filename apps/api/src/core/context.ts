import type { Config } from '../config/env';
import type { Database } from '../db/client';
import type { AiConnection } from './ai';
import type { Access } from './access/access';
import type { AuthUser } from './auth-user';

/** Everything a service needs about the current request. Built by the auth plugin. */
export interface RequestContext {
  db: Database;
  config: Config;
  user: AuthUser;
  access: Access;
  ip: string | null;
  /** The AI connection; `await ai.provider()` is null while AI is off. */
  ai: AiConnection;
}
