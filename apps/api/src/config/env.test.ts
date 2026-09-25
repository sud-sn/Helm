import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';

const azure = {
  AZURE_OPENAI_ENDPOINT: 'https://helm-test.openai.azure.com',
  AZURE_OPENAI_API_KEY: 'test-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
};

describe('AI configuration', () => {
  it('is off when nothing is set', () => {
    expect(loadConfig({}).ai).toBeNull();
  });

  it('needs endpoint, key and deployment together', () => {
    expect(() => loadConfig({ AZURE_OPENAI_ENDPOINT: azure.AZURE_OPENAI_ENDPOINT })).toThrow(
      /together/,
    );
  });

  it('keeps only the resource endpoint from a full target URI', () => {
    const config = loadConfig({
      ...azure,
      AZURE_OPENAI_ENDPOINT:
        'https://helm-test.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview',
    });
    expect(config.ai).toEqual({
      provider: 'azure-openai',
      endpoint: 'https://helm-test.openai.azure.com',
      apiKey: 'test-key',
      deployment: 'gpt-4o',
      apiVersion: '2024-10-21',
      timeoutMs: 60_000,
    });
  });

  it('requires https except for a local test server', () => {
    expect(() => loadConfig({ ...azure, AZURE_OPENAI_ENDPOINT: 'http://example.com' })).toThrow(
      /https/,
    );
    expect(
      loadConfig({ ...azure, AZURE_OPENAI_ENDPOINT: 'http://localhost:4010' }).ai?.endpoint,
    ).toBe('http://localhost:4010');
  });
});
