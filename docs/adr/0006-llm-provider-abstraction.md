# ADR 0006 — LLM access behind a provider interface

**Status:** Accepted · 2026-09-25 — the provider is the organisation's Azure OpenAI resource
(GPT-4o deployment).

## Context

The PRD required a local model (Ollama) so that client ETL logic never leaves the network. The
product owner then chose an online model instead: the company's Azure OpenAI resource with a
GPT-4o deployment (decisions log #9).

## Decision

- All AI calls go through one internal interface,
  `LlmProvider.generateJson({ schemaName, schema, system, user }) → { output, model, usage,
durationMs, responseFormat }` in `apps/api/src/core/ai/`. Features never call Azure directly.
- The first adapter calls Azure OpenAI chat completions
  (`/openai/deployments/{deployment}/chat/completions?api-version=…`) with an API key from the
  server environment. It asks for structured outputs (a JSON Schema the model must follow); GPT-4o
  versions older than 2024-08-06 fall back to JSON mode. Rate limits are retried as Azure's
  `retry-after` headers ask, within a deadline per call.
- AI is off unless `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT`
  are all set. The key is never logged, stored in the database or sent to a browser.
- Every call is recorded in `ai_runs`: task, model, prompt version, tokens, duration, outcome and
  who asked. Inputs are not copied there.
- AI output is a suggestion. It is validated against a schema, checked against its source (each
  suggested action item's quote must appear in the transcript), stored as `suggested`, and
  accepted or dismissed by a person before it can become a ticket or reach a client.

## Consequences

- Meeting transcripts and related text are sent to the company's own Azure OpenAI resource. The
  PRD's "no data leaves the internal network" becomes "AI requests go only to our own Azure
  resource". For client work: choose the Azure region deliberately, consider a private endpoint,
  and be ready to explain Azure's abuse-monitoring retention (prompts may be kept for up to 30
  days unless the subscription is approved for an exemption).
- The deployment name is configuration, so moving to a newer model version is a settings change.
  Check the retirement date of the deployed GPT-4o version in Azure AI Foundry.
- A local adapter (Ollama or similar) can still be added behind the same interface, for example
  for a client whose contract forbids any external processing.
- First feature: action items suggested from meeting transcripts. Next: draft documentation pages
  from ticket notes.
