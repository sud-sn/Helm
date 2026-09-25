# ADR 0004 — Notifications delivered at login, stored in PostgreSQL

**Status:** Accepted · 2026-09-25

## Context

The PRD specified WebSockets over Redis Pub/Sub. The product owner prefers users to be notified
when they log in (decisions log #2). Redis Pub/Sub alone also loses messages for offline users.

## Decision

Every notification is a row in `notifications`, written in the same transaction as the change that
caused it. The login response carries the unread count; the app shows a "while you were away"
summary and an unread badge, refreshed when the user navigates or returns to the tab.

## Consequences

- No Redis or WebSocket infrastructure for now; nothing is lost when users are offline.
- Real-time push can be added later by publishing the committed rows; the schema and the
  triggers stay the same.
