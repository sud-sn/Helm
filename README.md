# Helm

Project management and documentation portal for BI/ETL delivery teams: clients, projects, cycles
and tickets under a hierarchical access model, meeting minutes that turn into tickets, versioned
documentation pages, and pitches that the team sends to clients for approval through a client
portal.

> **Status:** Phase 1 (core platform) is built: admin-managed accounts, scoped roles, clients,
> projects, cycles, tickets and board, meetings, pages, pitches, the client portal, dashboards and
> CSV import/export. AI features (Phase 3) are not started. See the [roadmap](docs/product/roadmap.md).

## Repository layout

| Path              | What it is                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `apps/api`        | Fastify REST API (TypeScript, PostgreSQL via Drizzle)                                      |
| `apps/web`        | React single-page app (Vite, Mantine) for staff and client users                           |
| `packages/shared` | Roles, permission matrix, statuses, request schemas and response types shared by both apps |
| `docs/`           | Product decisions, architecture, access control, design system, ADRs                       |

Details: [folder structure and conventions](docs/architecture/folder-structure.md).

## Documentation

- [Product decisions log](docs/product/decisions.md) — how the PRD has been clarified
- [Architecture overview](docs/architecture/overview.md) · [Data model](docs/architecture/data-model.md)
- [Access control (RBAC)](docs/architecture/rbac.md) — roles, scopes and the permission matrix
- [Design system](docs/design/design-system.md) — colour, typography, iconography
- [Roadmap](docs/product/roadmap.md) · [ADRs](docs/adr/)

## Quick start (development)

Needs Node.js 22.12+ and PostgreSQL 16 (Docker can run it for you).

```bash
npm install
cp .env.example .env          # set HELM_ADMIN_PASSWORD to choose the first admin's password
docker compose up -d db       # or point DATABASE_URL at your own PostgreSQL
npm run dev                   # API on :3000 (migrates on start), web app on http://localhost:5173
```

Sign in as `admin` with `HELM_ADMIN_PASSWORD` (left empty, a random password is printed once in the
API log); you are asked to choose a new password. Then create client companies, projects and user
accounts under **Administration → Users**. There is no self sign-up: every account, staff or client,
is created by an administrator.

| Command                                   | What it does                                          |
| ----------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                             | API (watch mode) and web app with hot reload          |
| `npm test`                                | Unit and integration tests (integration needs the DB) |
| `npm run lint` · `npm run typecheck`      | ESLint and TypeScript across all workspaces           |
| `npm run format` · `npm run format:check` | Prettier                                              |
| `npm run build` · `npm start`             | Production build; the API then serves the web app too |
| `npm run db:generate`                     | New SQL migration from schema changes                 |

## Running in production

One container serves the API and the web app on port 3000; it applies database migrations on start
and needs only PostgreSQL:

```bash
docker build -t helm .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:password@db-host:5432/helm \
  -e HELM_ADMIN_PASSWORD='choose-a-strong-one' \
  -e COOKIE_SECURE=true \
  helm
```

Or `docker compose --profile app up --build` for the app and a database together. Put it behind
HTTPS and set `COOKIE_SECURE=true` (and `TRUST_PROXY=true` behind a reverse proxy). Everything,
fonts included, is served from the container: the portal makes no requests to third parties.
Other settings are listed in [`.env.example`](.env.example).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
