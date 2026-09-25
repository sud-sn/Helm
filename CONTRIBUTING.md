# Contributing

## Workflow

1. Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
2. Keep changes focused; follow the [folder structure](docs/architecture/folder-structure.md).
3. Before pushing, run the same checks as CI:

   ```bash
   npm run lint
   npm run format:check
   npm run typecheck
   npm test            # needs PostgreSQL: docker compose up -d db
   ```

4. Commit with [Conventional Commits](https://www.conventionalcommits.org):
   `feat(pitches): let clients request changes`, `fix(auth): …`, `docs: …`, `chore: …`.
5. Open a pull request; CI must be green.

## Changing the data model

1. Edit the tables in `apps/api/src/db/schema/`.
2. `npm run db:generate` — writes a SQL migration to `apps/api/drizzle/`. Review the SQL.
3. Commit the schema change and the migration together. Never edit an applied migration.

## Changing roles or permissions

1. Edit `packages/shared/src/rbac.ts`.
2. `npm run docs:rbac` to regenerate the matrix in `docs/architecture/rbac.md` (a test fails if
   you forget).
3. Add or update API tests that prove the new rule.

## UI rules

- Icons come from `apps/web/src/icons` (ESLint blocks direct imports from the icon library).
- Colours come from theme tokens and tones; states are shown as icon + label.
- See the [design system](docs/design/design-system.md).
