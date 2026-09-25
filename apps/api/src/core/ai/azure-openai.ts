import type { AiConfig } from '../../config/env';
import {
  AiProviderError,
  type GenerateJsonRequest,
  type GenerateJsonResult,
  type LlmProvider,
} from './provider';

interface Reply {
  status: number;
  headers: Headers;
  /** Parsed JSON when the body is JSON, otherwise the raw text. */
  body: unknown;
}

interface ChatCompletion {
  model?: string;
  choices?: {
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface AzureError {
  error?: { code?: string; message?: string; innererror?: { code?: string } };
}

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRY_DELAY_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function azureError(body: unknown): NonNullable<AzureError['error']> {
  return (typeof body === 'object' && body !== null && (body as AzureError).error) || {};
}

/** Azure asks clients to wait via retry-after-ms or retry-after (seconds). */
function retryDelay(headers: Headers, attempt: number): number {
  const ms = Number(headers.get('retry-after-ms'));
  if (Number.isFinite(ms) && ms > 0) return Math.min(ms, MAX_RETRY_DELAY_MS);
  const seconds = Number(headers.get('retry-after'));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  return Math.min(1000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
}

/**
 * Azure OpenAI chat completions, addressed by deployment name and api-version. Requests ask for
 * structured outputs (a JSON Schema the model must follow); GPT-4o versions older than 2024-08-06
 * only have JSON mode, so on that specific refusal the request is repeated in JSON mode with the
 * schema written into the instructions. Callers validate the output either way.
 */
export function createAzureOpenAiProvider(
  config: AiConfig,
  fetchImpl: typeof fetch = fetch,
): LlmProvider {
  const host = new URL(config.endpoint).host;
  const url =
    `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}` +
    `/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;

  async function post(body: Record<string, unknown>, deadline: number): Promise<Reply> {
    for (let attempt = 1; ; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new AiProviderError('timeout', 'Azure OpenAI did not answer in time.');
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'api-key': config.apiKey, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(remaining),
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
          throw new AiProviderError('timeout', 'Azure OpenAI did not answer in time.');
        }
        throw new AiProviderError('unavailable', `Could not reach Azure OpenAI at ${host}.`);
      }
      const reply: Reply = {
        status: response.status,
        headers: response.headers,
        body: await readBody(response),
      };
      if (!RETRYABLE_STATUSES.has(reply.status) || attempt >= MAX_ATTEMPTS) return reply;
      const wait = retryDelay(reply.headers, attempt);
      if (Date.now() + wait >= deadline) return reply;
      await sleep(wait);
    }
  }

  function failure(reply: Reply): AiProviderError {
    const error = azureError(reply.body);
    if (reply.status === 401 || reply.status === 403) {
      return new AiProviderError(
        'auth',
        'Azure OpenAI rejected the API key. Use KEY 1 or KEY 2 of this resource.',
        reply.status,
      );
    }
    if (reply.status === 404) {
      return new AiProviderError(
        'not_found',
        `Azure OpenAI at ${host} has no deployment "${config.deployment}" for API version ` +
          `${config.apiVersion}. Check the deployment name and API version.`,
        404,
      );
    }
    if (reply.status === 429) {
      return new AiProviderError(
        'rate_limited',
        'Azure OpenAI is limiting requests right now. Try again in a minute.',
        429,
      );
    }
    if (
      error.code === 'content_filter' ||
      error.innererror?.code === 'ResponsibleAIPolicyViolation'
    ) {
      return new AiProviderError(
        'rejected',
        'The Azure OpenAI content filter blocked this request.',
        reply.status,
      );
    }
    if (reply.status >= 500) {
      return new AiProviderError(
        'unavailable',
        'Azure OpenAI is unavailable right now. Try again shortly.',
        reply.status,
      );
    }
    const detail = error.message ? `: ${error.message}` : '.';
    return new AiProviderError(
      'rejected',
      `Azure OpenAI rejected the request${detail}`,
      reply.status,
    );
  }

  return {
    name: 'azure-openai',
    description: {
      endpointHost: host,
      deployment: config.deployment,
      apiVersion: config.apiVersion,
    },

    async generateJson(request: GenerateJsonRequest): Promise<GenerateJsonResult> {
      const started = Date.now();
      const deadline = started + config.timeoutMs;
      const settings = {
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxOutputTokens ?? 2000,
      };
      let responseFormat: GenerateJsonResult['responseFormat'] = 'json_schema';
      let reply = await post(
        {
          ...settings,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
        },
        deadline,
      );
      const message = azureError(reply.body).message ?? '';
      if (reply.status === 400 && message.toLowerCase().includes('response_format')) {
        responseFormat = 'json_object';
        reply = await post(
          {
            ...settings,
            messages: [
              {
                role: 'system',
                content:
                  `${request.system}\n\nReply with one JSON object that matches this JSON ` +
                  `Schema:\n${JSON.stringify(request.schema)}`,
              },
              { role: 'user', content: request.user },
            ],
            response_format: { type: 'json_object' },
          },
          deadline,
        );
      }
      if (reply.status !== 200) throw failure(reply);

      const completion = reply.body as ChatCompletion;
      const choice = completion.choices?.[0];
      if (choice?.finish_reason === 'content_filter' || choice?.message?.refusal) {
        throw new AiProviderError('rejected', 'Azure OpenAI declined to answer this request.');
      }
      if (choice?.finish_reason === 'length') {
        throw new AiProviderError(
          'invalid_output',
          'The answer was cut off before it was complete.',
        );
      }
      const content = choice?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new AiProviderError('invalid_output', 'Azure OpenAI returned an empty answer.');
      }
      let output: unknown;
      try {
        output = JSON.parse(content);
      } catch {
        throw new AiProviderError(
          'invalid_output',
          'Azure OpenAI returned an answer that is not JSON.',
        );
      }
      return {
        output,
        model: completion.model || config.deployment,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
        durationMs: Date.now() - started,
        responseFormat,
      };
    },
  };
}
