import { eq } from 'drizzle-orm';
import type { AiConfig } from '../../config/env';
import type { Database } from '../../db/client';
import { aiSettings } from '../../db/schema';
import {
  decryptSecret,
  deriveEncryptionKey,
  encryptSecret,
  loadServerSecret,
} from '../security/secrets';
import type { LlmProvider } from './provider';

export type AiSource = 'environment' | 'admin';

export interface AiState {
  provider: LlmProvider | null;
  source: AiSource | null;
  /** Why saved settings cannot be used right now; shown to administrators. */
  problem: string | null;
}

export type ProviderFactory = (config: AiConfig) => LlmProvider;

export interface AiConnectionOptions {
  db: Database;
  /**
   * A provider fixed at start-up: from environment variables, or a fake in tests (null = AI
   * off). Leave undefined to use the settings an administrator saves on the AI assistant page.
   */
  fixed: LlmProvider | null | undefined;
  createProvider: ProviderFactory;
  secretKey: string | undefined;
  dataDir: string | undefined;
  timeoutMs: number;
  /** How long saved settings are trusted before being read again (other instances may change them). */
  cacheMs?: number;
}

/**
 * The AI connection in use. Environment variables win, and make the settings read-only;
 * otherwise the administrator's saved settings apply, re-read at most every 30 seconds, so a
 * change reaches every server instance without a restart.
 */
export class AiConnection {
  private cached: AiState | null = null;
  private cachedAt = 0;
  private encryptionKey: Buffer | null = null;

  constructor(private readonly options: AiConnectionOptions) {}

  /** False when the connection is fixed by environment variables (or a test). */
  get editable(): boolean {
    return this.options.fixed === undefined;
  }

  async state(): Promise<AiState> {
    const { fixed } = this.options;
    if (fixed !== undefined) {
      return { provider: fixed, source: fixed ? 'environment' : null, problem: null };
    }
    if (this.cached && Date.now() - this.cachedAt < (this.options.cacheMs ?? 30_000)) {
      return this.cached;
    }
    this.cached = await this.load();
    this.cachedAt = Date.now();
    return this.cached;
  }

  async provider(): Promise<LlmProvider | null> {
    return (await this.state()).provider;
  }

  /** A provider for settings that are not saved yet, so they can be tested first. */
  candidate(settings: Omit<AiConfig, 'provider' | 'timeoutMs'>): LlmProvider {
    return this.options.createProvider({
      provider: 'azure-openai',
      ...settings,
      timeoutMs: this.options.timeoutMs,
    });
  }

  encrypt(secret: string): string {
    return encryptSecret(secret, this.key());
  }

  decrypt(stored: string): string {
    return decryptSecret(stored, this.key());
  }

  /** Forget the cached settings after they were saved or removed on this instance. */
  invalidate(): void {
    this.cached = null;
  }

  private key(): Buffer {
    if (!this.encryptionKey) {
      const { secretKey, dataDir } = this.options;
      if (!secretKey && !dataDir) {
        throw new Error('Set HELM_SECRET_KEY or HELM_DATA_DIR so Helm can protect stored keys.');
      }
      this.encryptionKey = deriveEncryptionKey(
        loadServerSecret({ secret: secretKey, dataDir: dataDir ?? '' }),
      );
    }
    return this.encryptionKey;
  }

  private async load(): Promise<AiState> {
    const [saved] = await this.options.db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.id, 1))
      .limit(1);
    if (!saved) return { provider: null, source: null, problem: null };
    let key: Buffer;
    try {
      key = this.key();
    } catch (error) {
      return { provider: null, source: 'admin', problem: (error as Error).message };
    }
    let apiKey: string;
    try {
      apiKey = decryptSecret(saved.apiKeyEncrypted, key);
    } catch {
      return {
        provider: null,
        source: 'admin',
        problem:
          'The saved API key cannot be read because the server secret changed. Enter the key again.',
      };
    }
    return {
      provider: this.candidate({
        endpoint: saved.endpoint,
        deployment: saved.deployment,
        apiVersion: saved.apiVersion,
        apiKey,
      }),
      source: 'admin',
      problem: null,
    };
  }
}
