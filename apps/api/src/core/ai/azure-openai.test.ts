import { describe, expect, it } from 'vitest';
import type { AiConfig } from '../../config/env';
import { createAzureOpenAiProvider } from './azure-openai';
import { AiProviderError } from './provider';

const config: AiConfig = {
  provider: 'azure-openai',
  endpoint: 'https://helm-test.openai.azure.com',
  apiKey: 'test-key',
  deployment: 'gpt-4o',
  apiVersion: '2024-10-21',
  timeoutMs: 5_000,
};

const request = {
  schemaName: 'test_output',
  schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  system: 'Answer in JSON.',
  user: 'Hello',
};

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function completion(content: string, extra: Record<string, unknown> = {}) {
  return json(200, {
    model: 'gpt-4o-2024-11-20',
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 120, completion_tokens: 30 },
    ...extra,
  });
}

/** A fetch that answers from a script and records what it was sent. */
function fakeFetch(...responses: (Response | (() => Promise<Response>))[]) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return typeof next === 'function' ? next() : next;
  }) as typeof fetch;
  return { impl, calls };
}

async function failureOf(promise: Promise<unknown>): Promise<AiProviderError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AiProviderError);
  return error as AiProviderError;
}

describe('Azure OpenAI provider', () => {
  it('asks the deployment for structured output and parses the answer', async () => {
    const fetch = fakeFetch(completion('{"ok":true}'));
    const provider = createAzureOpenAiProvider(config, fetch.impl);

    const result = await provider.generateJson(request);

    expect(result).toMatchObject({
      output: { ok: true },
      model: 'gpt-4o-2024-11-20',
      usage: { inputTokens: 120, outputTokens: 30 },
      responseFormat: 'json_schema',
    });
    const [call] = fetch.calls;
    expect(call!.url).toBe(
      'https://helm-test.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21',
    );
    expect(call!.headers['api-key']).toBe('test-key');
    expect(call!.body).toMatchObject({
      messages: [
        { role: 'system', content: 'Answer in JSON.' },
        { role: 'user', content: 'Hello' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'test_output', strict: true, schema: request.schema },
      },
    });
    expect(provider.description).toEqual({
      endpointHost: 'helm-test.openai.azure.com',
      deployment: 'gpt-4o',
      apiVersion: '2024-10-21',
    });
  });

  it('falls back to JSON mode for model versions without structured outputs', async () => {
    const fetch = fakeFetch(
      json(400, {
        error: {
          code: 'BadRequest',
          message:
            "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model.",
        },
      }),
      completion('{"ok":true}'),
    );
    const result = await createAzureOpenAiProvider(config, fetch.impl).generateJson(request);

    expect(result.responseFormat).toBe('json_object');
    expect(fetch.calls[1]!.body.response_format).toEqual({ type: 'json_object' });
    const system = (fetch.calls[1]!.body.messages as { content: string }[])[0]!.content;
    expect(system).toContain('JSON Schema');
  });

  it('waits and retries when Azure is rate limiting', async () => {
    const fetch = fakeFetch(
      json(429, { error: { code: '429', message: 'Rate limit' } }, { 'retry-after-ms': '5' }),
      completion('{"ok":true}'),
    );
    const result = await createAzureOpenAiProvider(config, fetch.impl).generateJson(request);
    expect(result.output).toEqual({ ok: true });
    expect(fetch.calls).toHaveLength(2);
  });

  it('gives up on rate limiting after three attempts', async () => {
    const limited = () => json(429, {}, { 'retry-after-ms': '1' });
    const fetch = fakeFetch(limited(), limited(), limited());
    const error = await failureOf(
      createAzureOpenAiProvider(config, fetch.impl).generateJson(request),
    );
    expect(error.kind).toBe('rate_limited');
    expect(fetch.calls).toHaveLength(3);
  });

  it.each([
    [401, {}, 'auth'],
    [404, { error: { code: 'DeploymentNotFound', message: 'No deployment' } }, 'not_found'],
    [
      400,
      {
        error: {
          code: 'content_filter',
          message: 'Filtered',
          innererror: { code: 'ResponsibleAIPolicyViolation' },
        },
      },
      'rejected',
    ],
    [503, {}, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, body, kind) => {
    const replies =
      status === 503
        ? [1, 2, 3].map(() => json(503, body, { 'retry-after-ms': '1' }))
        : [json(status, body)];
    const fetch = fakeFetch(...replies);
    const error = await failureOf(
      createAzureOpenAiProvider(config, fetch.impl).generateJson(request),
    );
    expect(error.kind).toBe(kind);
    expect(error.message).not.toContain('test-key');
  });

  it('rejects answers that were cut off, filtered or are not JSON', async () => {
    const cutOff = fakeFetch(
      completion('{"ok":', {
        choices: [{ message: { content: '{"ok":' }, finish_reason: 'length' }],
      }),
    );
    expect(
      (await failureOf(createAzureOpenAiProvider(config, cutOff.impl).generateJson(request))).kind,
    ).toBe('invalid_output');
    const filtered = fakeFetch(
      completion('', {
        choices: [{ message: { content: null }, finish_reason: 'content_filter' }],
      }),
    );
    expect(
      (await failureOf(createAzureOpenAiProvider(config, filtered.impl).generateJson(request)))
        .kind,
    ).toBe('rejected');
    const prose = fakeFetch(completion('Sure! Here you go.'));
    expect(
      (await failureOf(createAzureOpenAiProvider(config, prose.impl).generateJson(request))).kind,
    ).toBe('invalid_output');
  });

  it('times out instead of waiting forever', async () => {
    const hanging = (async (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      })) as typeof fetch;
    const provider = createAzureOpenAiProvider({ ...config, timeoutMs: 50 }, hanging);
    expect((await failureOf(provider.generateJson(request))).kind).toBe('timeout');
  });

  it('reports an unreachable endpoint without leaking the key', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const error = await failureOf(createAzureOpenAiProvider(config, offline).generateJson(request));
    expect(error.kind).toBe('unavailable');
    expect(error.message).toContain('helm-test.openai.azure.com');
  });
});
