/**
 * The one way features talk to a language model (ADR 0006). Features describe the task, the input
 * and the JSON shape they need; the provider (Azure OpenAI today) is configuration.
 */

/** A JSON Schema, as accepted by structured-output mode. */
export type JsonSchema = Record<string, unknown>;

export interface GenerateJsonRequest {
  /** Names the output shape for the provider: letters, digits, _ and - only. */
  schemaName: string;
  schema: JsonSchema;
  /** Instructions. Untrusted text (a transcript) belongs in `user`, never here. */
  system: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GenerateJsonResult {
  /** Parsed JSON. Not validated: callers check it against their own schema. */
  output: unknown;
  /** The model that answered, as the provider reports it (e.g. gpt-4o-2024-11-20). */
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  /** json_schema when the model supports structured outputs, otherwise plain JSON mode. */
  responseFormat: 'json_schema' | 'json_object';
}

export interface LlmProvider {
  readonly name: 'azure-openai';
  /** What an administrator may see about the connection; never includes the key. */
  readonly description: { endpointHost: string; deployment: string; apiVersion: string };
  generateJson(request: GenerateJsonRequest): Promise<GenerateJsonResult>;
}

export type AiErrorKind =
  'auth' | 'not_found' | 'rate_limited' | 'unavailable' | 'timeout' | 'rejected' | 'invalid_output';

/** A provider failure, with a message that is safe to show an administrator. */
export class AiProviderError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
