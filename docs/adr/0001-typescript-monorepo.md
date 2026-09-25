# ADR 0001 — TypeScript monorepo with a shared package

**Status:** Accepted · 2026-09-25

## Context

The PRD left the stack open (React or Vue; Node or FastAPI; BullMQ or Celery). Roles, permissions,
statuses and validation rules must be identical in the API and the UI, or the UI offers actions
the API refuses.

## Decision

One npm-workspaces repository in TypeScript: `apps/api`, `apps/web`, `packages/shared`. The shared
package holds the domain vocabulary, the RBAC matrix and the zod request schemas; both apps import
it as source.

## Consequences

- One language and toolchain; a rule changes in one place.
- Python-only libraries (e.g. SQL lineage parsing) will run as a separate worker when needed,
  behind a queue — not inside the API.
