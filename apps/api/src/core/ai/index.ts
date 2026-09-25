import type { AiConfig } from '../../config/env';
import { createAzureOpenAiProvider } from './azure-openai';
import type { LlmProvider } from './provider';

export { AiProviderError, type AiErrorKind, type JsonSchema, type LlmProvider } from './provider';

/** The configured model provider, or null when AI features are switched off. */
export function createLlmProvider(config: AiConfig | null): LlmProvider | null {
  return config ? createAzureOpenAiProvider(config) : null;
}
