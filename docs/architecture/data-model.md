# Data model

PostgreSQL, defined in [`apps/api/src/db/schema/`](../../apps/api/src/db/schema/); migrations in
`apps/api/drizzle/`. All ids are UUIDs; enumerations are `text` columns with CHECK constraints.

```text
users ─────────────┬─< sessions
  (staff | client) ├─< role_assignments >── one of: workspace | clients | projects | cycles
                   └─< notifications

clients ──< projects ──< cycles
               │           │
               ├──────< tickets >── (cycle_id, nullable = backlog)
               │           ├─< comments
               │           ├─< ticket_events      (history: status, assignee, cycle, fields)
               │           └─< ticket_watchers
               ├──< pages ──< page_versions        (optional link to a ticket)
clients ──< meetings ──< meeting_action_items ──> tickets | pitches | ai_runs
ai_runs >── meetings, users                         (one row per AI call)
clients ──< pitches ──< pitch_comments             (optional link to a project)

audit_log (append-only)
```

## Notes

- **Tickets** are numbered per project (`projects.ticket_seq`, incremented in the same transaction
  as the insert), so keys like `ACME-104` are stable and gap-free under concurrency.
- **Role assignments** have one nullable foreign key per scope level plus a CHECK that exactly the
  right one is set, so deleting a cycle removes its grants and no grant can point at nothing.
- **Client users** have `user_type = 'client'` and a non-null `client_id`; a CHECK keeps staff
  without a company and prevents client administrators.
- **Visibility** (`internal` | `client`) exists on pages, meeting minutes and pitch comments.
  Transcripts are never shared.
- **History** (`ticket_events`) records every status transition with a timestamp from day one, so
  cycle time and throughput can be computed later without back-filling.
- **AI runs** (`ai_runs`) record every call to the language model: task, model, prompt version,
  tokens, duration, outcome and requester. Action items carry `source` (`manual` | `ai`),
  `source_quote` and `ai_run_id`; AI items start as `suggested` and a person moves them to `open`
  or `dismissed`. Only `open` items can become tickets.
- **Pages** store the current version inline and every version in `page_versions`; saves use
  optimistic concurrency (`expectedVersion`).
