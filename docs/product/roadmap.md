# Roadmap

Guiding rule: build standard project-management features to "good enough" and spend the effort on
what makes Helm different — the client-facing pitch flow, meeting-to-ticket workflow, BI/ETL
documentation and, later, AI assistance.

## Phase 1 — Core platform (current)

- Admin-managed accounts: login, forced password change, lockout, sessions, audit log.
- Hierarchy: Workspace → Client → Project → Cycle → Ticket, with scoped role grants for Delivery
  Manager, Project Manager, Team Lead, Business Analyst, Developer, Viewer and Client.
- Tickets: per-project keys (`ACME-104`), Kanban board, backlog, table view with filters, comments
  with @mentions, watchers, full change history.
- Notifications stored and shown at login (assignments, mentions, status changes, comments, role
  grants, pitch events, shared content).
- Meetings: transcripts (internal), minutes (shareable), action items → tickets or pitches.
- Pages: Markdown documentation with version history, linkable to tickets, shareable with the
  client.
- Pitches: team drafts → Project Manager approves and sends → client accepts, rejects or asks for
  changes, with a comment thread.
- Client portal: project progress, pitches to review, shared pages and minutes.
- Role-scoped dashboard; CSV import from existing Excel trackers and CSV export.

## Phase 2 — Depth and rollout

- Pitch analytics (success rate by client, time to decision); convert an accepted pitch into a
  project/cycle with tickets.
- Estimates vs. capacity and time logging (or a timesheet integration) for utilization.
- Client status reports (PDF), page templates, project wiki tree, full-text search.
- Notification preferences and email digests; optional real-time push (the data model already
  supports it).
- SSO (OIDC) alongside admin-managed accounts; Git integration (link commits/PRs to tickets).

## Phase 3 — AI assistance

AI sits behind a provider interface ([ADR 0006](../adr/0006-llm-provider-abstraction.md)).

- MOM extraction: fill a meeting's action items from its transcript, each with a source quote; the
  Team Lead reviews them in the existing action-item list.
- Auto-documentation: draft a Page from a developer's notes plus the ticket's context; the author
  edits and publishes.
- Knowledge search over pages, tickets and minutes, filtered by what the user can see.
- Client status-report drafts, duplicate detection, follow-ups across meetings.

## Phase 4 — BI/ETL domain

- Data asset registry (pipelines, sources, targets, reports) linked to tickets and pages.
- dbt manifest / SQL parsing for lineage and impact analysis.
- Orchestrator integrations (Airflow, ADF, dbt): failed runs open incident tickets.
- UAT and reconciliation checklists with client sign-off; environment promotion tracking.
