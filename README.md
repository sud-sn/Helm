# Helm

Project management and documentation portal for BI/ETL delivery teams: clients, projects, cycles
and tickets under a hierarchical access model, meeting minutes that turn into tickets, versioned
documentation pages, and pitches that the team sends to clients for approval through a client
portal.

> **Status:** foundation in progress — domain model, access rules, design system and docs are in
> place; the API and web app are being built on top of them.

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

## Requirements

Node.js 22.12+ and PostgreSQL 16 (or Docker to run it: `docker compose up -d db`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
