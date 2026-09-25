# Access control (hierarchical RBAC)

Source of truth: [`packages/shared/src/rbac.ts`](../../packages/shared/src/rbac.ts). The API enforces
it; the web app uses the same functions only to hide actions a user cannot take.

## Model

- **Scopes form a tree:** Workspace (the agency) → Client → Project → Cycle. Tickets, pages,
  meetings and pitches live inside that tree.
- **A grant is a role bound to one scope.** People hold any number of grants, so one person can be
  a Team Lead for two clients and a Developer on a third project.
- **Access flows down.** A grant on a client covers that client's projects, cycles and tickets. A
  grant on a cycle covers only that cycle's tickets — not the project backlog or other cycles.
- **Capabilities flow up.** Senior roles include the permissions of junior ones:
  Delivery Manager ⊇ Project Manager ⊇ Team Lead ⊇ (Business Analyst, Developer) ⊇ Viewer.
- **Administrators** (`is_admin`) manage accounts, grant any role and read the audit log. Being an
  admin does not by itself show client data; the first admin is also given the Delivery Manager
  role so the workspace can be set up.

## User types and client isolation

| | Staff | Client user |
|---|---|---|
| Who | Agency employees | People at a client company |
| Created by | An administrator | An administrator, attached to exactly one client company |
| Roles | Any role except Client | Only the Client role |
| Scope | Any client | Their own company (the whole client or some of its projects) |
| Sees | Everything their grants cover | Aggregated progress, pitches sent to them, pages and minutes explicitly shared with the client |
| Never sees | — | Tickets, internal comments, transcripts, internal pages, drafts, other clients |

Content that can reach a client carries a visibility of `internal` (default) or `client`. Only
roles with `content.share` (Business Analyst and above) can change it, and every change is audited.

## Rules the API applies

1. **Unreadable means not found.** A resource outside your grants returns 404, never 403, so the
   existence of other clients' data is not revealed. 403 means "you can see it but not do this".
2. **Developers change their own tickets' status.** `ticket.update_own` lets the assignee move a
   ticket between statuses; editing anything else needs `ticket.update` (Team Lead and above).
3. **Moving a ticket needs rights at both ends:** its current scope and its target cycle.
4. **Assignees must be able to see the ticket.** You cannot assign a ticket to someone outside its
   scope, and @mentions only notify people who can read the ticket.
5. **Delegation is explicit.** You can grant a role only if one of your grants covers the target
   scope and your role appears in "Can grant" below. Nobody (except an admin) changes their own
   grants. Client users can receive only the Client role, inside their own company.

## Permission matrix

Generated from code — run `npm run docs:rbac` after changing roles; a test fails if this table is
stale.

<!-- rbac-matrix:start -->
| Permission | DM | PM | TL | BA | Dev | Viewer | Client |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `client.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `client.create` | ✓ |  |  |  |  |  |  |
| `client.update` | ✓ | ✓ |  |  |  |  |  |
| `project.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.create` | ✓ | ✓ |  |  |  |  |  |
| `project.update` | ✓ | ✓ |  |  |  |  |  |
| `cycle.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `cycle.create` | ✓ | ✓ |  |  |  |  |  |
| `cycle.update` | ✓ | ✓ | ✓ |  |  |  |  |
| `cycle.delete` | ✓ | ✓ |  |  |  |  |  |
| `ticket.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `ticket.create` | ✓ | ✓ | ✓ |  |  |  |  |
| `ticket.update` | ✓ | ✓ | ✓ |  |  |  |  |
| `ticket.update_own` | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| `ticket.delete` | ✓ | ✓ | ✓ |  |  |  |  |
| `comment.create` | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| `comment.moderate` | ✓ | ✓ | ✓ |  |  |  |  |
| `page.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `page.write` | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| `page.delete` | ✓ | ✓ | ✓ |  |  |  |  |
| `meeting.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `meeting.write` | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| `meeting.delete` | ✓ | ✓ | ✓ |  |  |  |  |
| `content.share` | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `pitch.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `pitch.write` | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `pitch.approve` | ✓ | ✓ |  |  |  |  |  |
| `pitch.respond` |  |  |  |  |  |  | ✓ |
| `pitch.comment` |  |  |  |  |  |  | ✓ |
| `shared.read` |  |  |  |  |  |  | ✓ |
| `progress.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `member.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |

| Role | Can be granted at | Can grant |
|---|---|---|
| Delivery Manager | workspace | Project Manager, Team Lead, Business Analyst, Developer, Viewer, Client |
| Project Manager | client, project | Team Lead, Business Analyst, Developer, Viewer, Client |
| Team Lead | client, project, cycle | Business Analyst, Developer, Viewer |
| Business Analyst | client, project | — |
| Developer | client, project, cycle | — |
| Viewer | workspace, client, project, cycle | — |
| Client | client, project | — |
<!-- rbac-matrix:end -->

## Mapping to the PRD tiers

| PRD tier | Helm role | Typical grant |
|----------|-----------|---------------|
| Tier 1 — Delivery Manager (global) | Delivery Manager | Workspace |
| Tier 2 — Project Manager (account) | Project Manager | Client or project |
| Tier 3 — Team Lead (cycle) | Team Lead | Client, project or cycle |
| Tier 4 — Developer (task) | Developer | Client, project or cycle; edits only assigned tickets |
| — (added) | Business Analyst | Client or project: meetings, minutes, pitches, sharing |
| — (added) | Viewer | Any scope, read-only (auditors, stakeholders inside the agency) |
| — (added) | Client | Client or project, client users only |
