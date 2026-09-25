# Architecture overview

## Shape

```text
 Browser (staff app / client portal)          one React SPA, role-aware
        │  HTTPS, session cookie
        ▼
 Fastify API (Node.js 22, TypeScript)          modular monolith, stateless
   plugins: security headers · CSRF guard · session auth · rate limit · error mapping
   modules: auth · users · access · clients · projects · cycles · tickets · notifications
            meetings · pages · pitches · dashboard · audit
        │  SQL (Drizzle ORM, pooled connections)
        ▼
 PostgreSQL 16                                 the only stateful component
```

The PRD's Redis/WebSocket layer and AI worker are **not built yet** (see the
[decisions log](../product/decisions.md)); the design leaves room for them:

- Notifications are rows in `notifications`. Real-time push later means publishing the same rows
  after commit — nothing about how they are created changes.
- Meetings already hold transcripts and action items. AI extraction later fills
  `meeting_action_items` (with `source = 'ai'`), and people review them in the same list.
- AI calls will go through a provider interface ([ADR 0006](../adr/0006-llm-provider-abstraction.md)).

## Stack

| Concern  | Choice                                                | Why                                                                                                            |
| -------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Language | TypeScript everywhere                                 | One language across the API, the web app and the shared rules ([ADR 0001](../adr/0001-typescript-monorepo.md)) |
| API      | Fastify 5 + zod                                       | Small, fast, explicit; validation shared with the UI ([ADR 0002](../adr/0002-fastify-drizzle.md))              |
| Database | PostgreSQL 16 + Drizzle ORM                           | Relational hierarchy, CHECK constraints, SQL-first migrations                                                  |
| Web      | React 19, Vite, Mantine, TanStack Query, React Router | Accessible component kit, server-state caching, code-split routes                                              |
| Auth     | Admin-managed accounts, server-side sessions          | Revocable, no token handling in the browser ([ADR 0003](../adr/0003-admin-managed-accounts-and-sessions.md))   |
| Tests    | Vitest; API tests against real PostgreSQL             | Tests the SQL and constraints we actually ship                                                                 |

## Request lifecycle

1. **Security headers** (`@fastify/helmet`) and, for state-changing requests, a **CSRF guard** that
   requires the `X-Requested-With: helm` header (cross-site forms cannot set it).
2. **Session auth** reads the `helm_session` cookie, looks up the SHA-256 of the token, checks
   expiry and that the user is active, and slides the expiry forward. Users who must change their
   password can only reach the change-password, current-user and logout endpoints.
3. **Validation**: the route parses params, query and body with a schema from `@helm/shared`.
4. **Authorisation**: the service loads the user's grants once per request, resolves the target
   resource's scope (client → project → cycle) and checks the permission. Unreadable → 404.
5. **Work** happens in a transaction when it touches more than one row (e.g. creating a ticket
   allocates the next project number, writes the history event, adds watchers and notifications).
6. **Errors** are mapped to `{ error: { code, message, details? } }` with the right status.

## Security baseline

- Passwords: scrypt (N = 2^15, r = 8, p = 1) with a per-user salt; minimum 10 characters.
- Lockout after 5 failed logins for 15 minutes; login rate-limited per IP; failed logins audited.
- Session tokens: 256-bit random, stored hashed, `HttpOnly`, `SameSite=Lax`, `Secure` behind HTTPS,
  revoked on password change, reset and deactivation.
- Client isolation: see [RBAC](rbac.md). Client users are pinned to one company in the database.
- CSV export neutralises spreadsheet formulas (`=`, `+`, `-`, `@` prefixes) to prevent CSV
  injection.
- Markdown is rendered without raw HTML.
- Audit log for logins, account changes, role grants, sharing with clients, deletions and imports.

## Deployment

One container runs the API and serves the built web app; PostgreSQL runs alongside (see
`docker-compose.yml`). Migrations run on start (`MIGRATE_ON_START=true`). The first start with an
empty database creates the administrator from `HELM_ADMIN_USERNAME` / `HELM_ADMIN_PASSWORD` (or
prints a generated password once).
