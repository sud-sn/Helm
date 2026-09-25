# ADR 0006 — LLM access behind a provider interface

**Status:** Proposed · 2026-09-25 — waiting for the product owner to confirm the provider.

## Context

The PRD required a local model (Ollama) so that client ETL logic never leaves the network. The
product owner later said "we can use the inline LLM" (decisions log #9). That most likely means a
hosted (online) LLM API; it may instead mean a model embedded in the application.

## Decision (proposed)

All AI calls go through one internal interface —
`generate({ task, input, schema }) → { output, model, promptVersion, usage }` — with adapters for
a hosted API and for a local server (Ollama or similar). The provider is configuration. Every
output is stored with its model and prompt version and reviewed by a person before it becomes a
ticket or a page.

## Consequences

- If a hosted provider is chosen, client material (transcripts, SQL, schemas) leaves the network:
  the provider's data-retention terms must be acceptable to clients, and the PRD's privacy promise
  must be updated. A per-client setting could force the local adapter for sensitive accounts.
- Switching providers later does not touch features.
