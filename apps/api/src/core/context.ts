import type { Config } from '../config/env';
import type { Database } from '../db/client';
import type { LlmProvider } from './ai';
import type { Access } from './access/access';
import type { AuthUser } from './auth-user';

/** Everything a service needs about the current request. Built by the auth plugin. */
export interface RequestContext {
  db: Database;
  config: Config;
  user: AuthUser;
  access: Access;
  ip: string | null;
  /** The language model provider, or null when AI features are off. */
  ai: LlmProvider | null;
}
