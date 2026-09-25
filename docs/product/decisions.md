# Product decisions log

Answers to open questions from the PRD review, in the order they were made. Each entry says what
changed in the build. Newer entries win over the [PRD](PRD.md).

| #   | Date       | Topic                 | Decision                                                                                          | Effect on the build                                                                                                                                                                                                        |
| --- | ---------- | --------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-09-25 | AI features           | Deferred. The core platform ships first; MOM extraction and auto-documentation come later.        | No AI code yet. Meetings, action items and Pages are built so AI can fill them later without schema changes.                                                                                                               |
| 2   | 2026-09-25 | Notifications         | Users are notified when they log in rather than by real-time push.                                | Notifications are stored in PostgreSQL and shown as a "while you were away" summary plus an unread badge. No WebSocket/Redis for now ([ADR 0004](../adr/0004-notifications-at-login.md)).                                  |
| 3   | 2026-09-25 | Login                 | Accounts are created by an administrator; no self sign-up and no SSO for now.                     | Username + password, temporary password on creation, forced change at first login, lockout after failed attempts ([ADR 0003](../adr/0003-admin-managed-accounts-and-sessions.md)).                                         |
| 4   | 2026-09-25 | Engineering standards | Follow best practices from the start: folder structure, iconography, colour scheme.               | [Folder structure](../architecture/folder-structure.md) and [design system](../design/design-system.md) documented and enforced by lint rules.                                                                             |
| 5   | 2026-09-25 | Pitches               | A pitch is a proposal made by the team to the client.                                             | Pitch lifecycle: draft → internal review → sent to client → accepted / rejected / changes requested. Success rate = accepted ÷ decided.                                                                                    |
| 6   | 2026-09-25 | Client access         | Clients log in to the portal.                                                                     | New Client role and client user type, isolated to their own company, seeing only content explicitly shared with them ([ADR 0005](../adr/0005-client-portal-and-visibility.md)).                                            |
| 7   | 2026-09-25 | Multi-client staff    | One person, e.g. a Team Lead, can work across several clients.                                    | Roles are granted per scope, any number per person; Team Leads and Developers can also be granted at client level.                                                                                                         |
| 8   | 2026-09-25 | Transcripts           | Transcripts are uploaded by the developers or business analysts who attended the discussion.      | New Business Analyst role. Developers and BAs create meetings and upload transcripts; Team Leads convert action items into tickets.                                                                                        |
| 9   | 2026-09-25 | AI provider           | "Inline LLM" meant an online model: the company's Azure OpenAI resource with a GPT-4o deployment. | AI sits behind a provider interface with Azure OpenAI as the first adapter. AI requests go only to our own Azure resource; every suggestion is reviewed by a person ([ADR 0006](../adr/0006-llm-provider-abstraction.md)). |

## Still open

- Whether some clients must opt out of AI processing (their transcripts would then never be sent
  to Azure OpenAI).
- Which ETL/BI tools to integrate with first (Git, Airflow, ADF, dbt…).
- Client contractual retention/deletion obligations.
- Whether clients should see individual ticket details or only aggregated progress (currently
  aggregated only).
