# ADR 0005 — Client users, company isolation and content visibility

**Status:** Accepted · 2026-09-25

## Context

Pitches are made by the team to the client, and clients log in to respond (decisions log #5, #6).
The portal holds sensitive work for many clients, so a client user must never see another
client's data or the team's internal material.

## Decision

- Users have a type: `staff` or `client`. Client users belong to exactly one client company
  (`users.client_id`, enforced by a CHECK) and can only hold the `CLIENT` role inside it.
- The `CLIENT` role has its own permissions: aggregated progress, `shared.read`, `pitch.respond`,
  `pitch.comment`. It has none of the internal read permissions (tickets, pages, meetings…).
- Pages, meeting minutes and pitch comments carry `visibility`: `internal` (default) or `client`.
  Sharing requires `content.share` and is audited. Transcripts are never shared. Pitches become
  visible to the client when a Project Manager sends them.

## Consequences

- Sharing is explicit, so internal content cannot leak by default.
- Clients see ticket counts per status, not individual tickets; showing selected tickets would add
  a visibility flag to tickets later.
