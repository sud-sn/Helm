import { z } from 'zod';

const flag = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1).default('postgres://helm:helm@localhost:5432/helm'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  MIGRATE_ON_START: flag.default(true),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .positive()
    .max(24 * 30)
    .default(12),
  COOKIE_SECURE: flag.optional(),
  TRUST_PROXY: flag.default(false),
  HELM_ADMIN_USERNAME: z.string().trim().toLowerCase().default('admin'),
  HELM_ADMIN_DISPLAY_NAME: z.string().trim().min(1).default('Administrator'),
  HELM_ADMIN_PASSWORD: optionalText,
  WEB_DIST_DIR: optionalText,
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  LOCKOUT_THRESHOLD: z.coerce.number().int().min(1).default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  /** log2 of the scrypt cost parameter N. 15 in production; tests lower it for speed. */
  PASSWORD_HASH_COST: z.coerce.number().int().min(10).max(20).default(15),
  // AI features (Azure OpenAI). All three of endpoint, key and deployment, or none.
  AZURE_OPENAI_ENDPOINT: optionalText,
  AZURE_OPENAI_API_KEY: optionalText,
  AZURE_OPENAI_DEPLOYMENT: optionalText,
  AZURE_OPENAI_API_VERSION: z.string().trim().min(1).default('2024-10-21'),
  AI_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(300).default(60),
});

type Env = z.output<typeof envSchema>;

/** Azure OpenAI access. The key never leaves the server and is never logged. */
export interface AiConfig {
  provider: 'azure-openai';
  /** The resource endpoint, e.g. https://my-resource.openai.azure.com */
  endpoint: string;
  apiKey: string;
  /** The deployment name chosen in Azure (it names the model, e.g. a GPT-4o deployment). */
  deployment: string;
  apiVersion: string;
  timeoutMs: number;
}

export interface Config {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  databaseUrl: string;
  databasePoolMax: number;
  migrateOnStart: boolean;
  sessionTtlHours: number;
  cookieSecure: boolean;
  trustProxy: boolean;
  bootstrapAdmin: { username: string; displayName: string; password: string | undefined };
  webDistDir: string | undefined;
  loginRateLimitPerMinute: number;
  lockoutThreshold: number;
  lockoutMinutes: number;
  passwordHashCost: number;
  /** null when Azure OpenAI is not configured: AI features are then switched off. */
  ai: AiConfig | null;
}

function invalid(message: string): Error {
  return new Error(`Invalid environment configuration: ${message}`);
}

function aiConfig(e: Env): AiConfig | null {
  const settings = [e.AZURE_OPENAI_ENDPOINT, e.AZURE_OPENAI_API_KEY, e.AZURE_OPENAI_DEPLOYMENT];
  if (settings.every((value) => value === undefined)) return null;
  if (settings.some((value) => value === undefined)) {
    throw invalid(
      'set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT together to turn on AI features, or leave all three empty',
    );
  }
  let url: URL;
  try {
    url = new URL(e.AZURE_OPENAI_ENDPOINT!);
  } catch {
    throw invalid(
      'AZURE_OPENAI_ENDPOINT must be a URL such as https://my-resource.openai.azure.com',
    );
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) throw invalid('AZURE_OPENAI_ENDPOINT must use https');
  return {
    provider: 'azure-openai',
    // Only the resource part counts, so a full "target URI" copied from the Azure portal works too.
    endpoint: url.origin,
    apiKey: e.AZURE_OPENAI_API_KEY!,
    deployment: e.AZURE_OPENAI_DEPLOYMENT!,
    apiVersion: e.AZURE_OPENAI_API_VERSION,
    timeoutMs: e.AI_TIMEOUT_SECONDS * 1000,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw invalid(problems);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    databasePoolMax: e.DATABASE_POOL_MAX,
    migrateOnStart: e.MIGRATE_ON_START,
    sessionTtlHours: e.SESSION_TTL_HOURS,
    cookieSecure: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
    trustProxy: e.TRUST_PROXY,
    bootstrapAdmin: {
      username: e.HELM_ADMIN_USERNAME,
      displayName: e.HELM_ADMIN_DISPLAY_NAME,
      password: e.HELM_ADMIN_PASSWORD,
    },
    webDistDir: e.WEB_DIST_DIR,
    loginRateLimitPerMinute: e.LOGIN_RATE_LIMIT_PER_MINUTE,
    lockoutThreshold: e.LOCKOUT_THRESHOLD,
    lockoutMinutes: e.LOCKOUT_MINUTES,
    passwordHashCost: e.PASSWORD_HASH_COST,
    ai: aiConfig(e),
  };
}
