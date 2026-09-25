# Folder structure and conventions

Helm is a TypeScript monorepo (npm workspaces). Code is organised **by business capability**
(tickets, pitches, meetings…) rather than by technical layer, on both the API and the web app, so
a feature's code lives together and the two sides mirror each other.

```text
helm/
├── apps/
│   ├── api/                      Fastify REST API (modular monolith)
│   │   ├── src/
│   │   │   ├── main.ts           Process entry: config, migrations, first admin, listen
│   │   │   ├── app.ts            buildApp(): plugins, error handling, module registration
│   │   │   ├── config/           Environment parsing (zod) → typed Config
│   │   │   ├── db/
│   │   │   │   ├── schema/       Drizzle table definitions, one file per aggregate
│   │   │   │   ├── client.ts     Connection pool + Drizzle instance
│   │   │   │   ├── migrate.ts    Applies SQL migrations from apps/api/drizzle/
│   │   │   │   └── bootstrap.ts  Creates the first administrator on an empty database
│   │   │   ├── core/             Cross-cutting code with no business rules
│   │   │   │   ├── errors.ts     HttpError types and the error → response mapping
│   │   │   │   ├── validation.ts parse(schema, input) helpers
│   │   │   │   ├── security/     Password hashing, random tokens
│   │   │   │   └── …             csv.ts, dates.ts, audit.ts
│   │   │   ├── plugins/          Fastify plugins: session auth, CSRF guard, SPA hosting
│   │   │   └── modules/          One folder per business capability
│   │   │       └── <module>/
│   │   │           ├── <module>.routes.ts    HTTP only: validate input, call service, shape reply
│   │   │           ├── <module>.service.ts   Business rules, authorisation, transactions
│   │   │           ├── <module>.queries.ts   Reusable queries and row → DTO mappers (optional)
│   │   │           └── index.ts              Registers the module's routes
│   │   ├── drizzle/              Generated SQL migrations (committed, never edited by hand)
│   │   └── test/                 Integration tests (real PostgreSQL) + test harness
│   └── web/                      React single-page app
│       ├── public/               Static assets served as-is (favicon, logo)
│       └── src/
│           ├── main.tsx          Entry: mounts <App/>
│           ├── app/              Application shell
│           │   ├── App.tsx       Providers + router
│           │   ├── router.tsx    Route table (screens are lazy-loaded)
│           │   ├── layouts/      Staff shell, client-portal shell, auth layout
│           │   └── routes/       Route screens, grouped by area; thin, they compose features
│           ├── features/         One folder per business capability, mirroring the API modules
│           │   └── <feature>/
│           │       ├── api.ts          TanStack Query hooks (queries + mutations) for the feature
│           │       └── components/     Feature UI (forms, lists, cards)
│           ├── components/       Shared, domain-agnostic UI (EmptyState, PageHeader, Markdown…)
│           ├── icons/            Icon registry: the only place that imports the icon library
│           ├── theme/            Design tokens and the Mantine theme
│           ├── lib/              API client, query client, formatting, permission hooks
│           └── styles/           Global CSS
├── packages/
│   └── shared/                   Code used by both apps: domain vocabulary, RBAC matrix,
│                                 zod request schemas, response types
├── docs/                         Product, architecture, design docs and ADRs
├── .github/workflows/            CI
├── docker-compose.yml            PostgreSQL for development; full stack with --profile app
└── Dockerfile                    Production image (API serving the built web app)
```

## Where does new code go?

| You are adding…                        | Put it in                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| A status, priority, role or permission | `packages/shared/src/constants.ts` or `rbac.ts`, plus a migration if the database checks it |
| A request payload                      | A zod schema in `packages/shared/src/schemas.ts`; the API and the form both use it          |
| A response shape                       | `packages/shared/src/types.ts`                                                              |
| An endpoint                            | `apps/api/src/modules/<module>/<module>.routes.ts`, logic in `<module>.service.ts`          |
| A table or column                      | `apps/api/src/db/schema/`, then `npm run db:generate` and commit the SQL                    |
| A screen                               | `apps/web/src/app/routes/<area>/<Name>Route.tsx`, registered in `router.tsx`                |
| UI for one feature                     | `apps/web/src/features/<feature>/components/`                                               |
| UI used by several features            | `apps/web/src/components/`                                                                  |
| An icon                                | Register it in `apps/web/src/icons/index.ts` first                                          |
| A colour                               | Add a token in `apps/web/src/theme/tokens.ts`; never hard-code hex in components            |

## Rules

- **Dependencies point inwards.** `routes → service → db`. Routes never query the database; services
  never touch `request`/`reply`. The web app's routes compose features; features never import
  routes. Nothing in `packages/shared` imports from `apps/`.
- **Every request is validated** with a zod schema from `@helm/shared` before it reaches a service.
- **Every service call is authorised** inside the service, against the resource's scope — never in
  the route and never only in the UI. The UI hides what you cannot do; the API refuses it.
- **Unreadable is not found.** If a user cannot read a resource, the API answers 404, so the
  existence of other clients' data is never revealed.
- **Icons and colours go through their registries** (`icons/`, `theme/`). ESLint blocks importing
  `@tabler/icons-react` anywhere else.
- **Tests.** Unit tests sit next to the code (`*.test.ts`); API integration tests live in
  `apps/api/test/` and run against a throwaway PostgreSQL database per test file.

## Naming

| Thing                            | Convention                                                  | Example                               |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| React components and their files | PascalCase                                                  | `TicketCard.tsx`                      |
| Route screens                    | `<Name>Route.tsx`                                           | `BoardRoute.tsx`                      |
| Other TypeScript files           | kebab-case, `<module>.<role>.ts` in API modules             | `tickets.service.ts`, `api-client.ts` |
| Database tables and columns      | snake_case, plural tables                                   | `role_assignments.scope_type`         |
| JSON fields                      | camelCase                                                   | `assigneeId`                          |
| API paths                        | plural nouns, kebab-case                                    | `/api/role-assignments`               |
| Permissions                      | `<resource>.<action>`                                       | `ticket.update_own`                   |
| Commits                          | [Conventional Commits](https://www.conventionalcommits.org) | `feat(tickets): add watchers`         |
