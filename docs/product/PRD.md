# Master Product Requirements Document: Intelligent BI/ETL Project Management Portal

> Original PRD as written by the product owner. Later clarifications and changes are recorded in
> [decisions.md](decisions.md); where the two disagree, the decisions log wins.

## Product Vision & Overview

This platform is a centralized, secure internal project tracking and documentation hub designed
exclusively for data engineering and BI teams. It replaces fragmented Excel trackers by unifying
task management, pipeline pitching, AI-assisted auto-documentation, and automated Minutes of
Meeting (MOM) extraction.

Because the system processes highly sensitive client ETL logic and database schemas, it relies on
a purely local AI architecture (Ollama) to ensure zero data leaves the internal network.
Furthermore, it features a robust real-time notification engine and a multi-tier organizational
hierarchy, allowing global delivery managers to oversee the entire agency portfolio while
developers stay focused on their specific tasks.

## 1. Multi-Tier Organizational Hierarchy (Hierarchical RBAC)

To support a large agency managing multiple clients, the system uses a Hierarchical Role-Based
Access Control (RBAC) model. This ensures that permissions are inherited upward and access is
strictly segregated.

- **Tier 1: Delivery Manager (Global Admin)**
  - Scope: the entire Workspace (company level).
  - Capabilities: global visibility across all client portfolios. Can view overarching analytics,
    resource utilization, and agency-wide pitch success rates. Can assign Project Managers to
    specific client accounts.
- **Tier 2: Project Manager (Account Level)**
  - Scope: specific assigned Projects (client accounts).
  - Capabilities: oversees the health of a specific client's pipeline. Can approve Pitch Cycles,
    generate client-facing reports, and assign Team Leads to specific development sprints or
    Cycles.
- **Tier 3: Team Lead (Cycle Level)**
  - Scope: specific assigned Cycles (sprints/phases).
  - Capabilities: manages the day-to-day agile workflow. Uploads MOM transcripts for AI
    extraction, converts extracted items into active Tickets, and assigns Tickets to Developers.
- **Tier 4: Developer (Task Level)**
  - Scope: specific assigned Tickets.
  - Capabilities: updates ticket statuses, adds comments, and triggers the local AI to generate
    technical documentation (Pages) upon completing an ETL job.

## 2. Real-Time Notification Engine

To ensure seamless collaboration, the platform includes a real-time notification system. Instead
of relying on manual page refreshes, the system pushes updates instantly to the user's browser.

Trigger events:

- Assignments: "You have been assigned to Ticket #104 by [Team Lead]."
- Mentions: "@[Developer] please clarify the Snowflake schema in the comments."
- Status changes: "Ticket #104 has been moved to 'Done'."
- AI completions: "Auto-documentation for Ticket #104 is ready for your review."

Notification architecture: WebSockets backed by a Redis Pub/Sub layer.

- When a Team Lead comments on a ticket and tags a Developer, the backend Node.js server publishes
  a message to a Redis channel (e.g. `channel:user_id:notifications`).
- The Redis Pub/Sub mechanism instantly broadcasts this message to the specific WebSocket server
  handling that Developer's connection.
- The Developer's React UI receives the WebSocket payload and instantly renders a notification
  badge or toast popup.

## 3. Key Modules & AI Workflows (Human-in-the-Loop)

- **MOM Extraction to Tickets:** Team Leads paste raw meeting transcripts into the portal. A
  background worker routes this to the local Ollama LLM. The LLM extracts action items and
  proposed pitches, returning a JSON checklist. The Team Lead checks the valid items, converting
  them into active Tickets or adding them to a Pitch Cycle.
- **Auto-Documentation to Pages:** Developers input 3–4 raw bullet points regarding a completed
  job into the Ticket. The LLM expands these into a comprehensive functional document. Once
  approved, the text is published as a permanent Page linked to the Ticket.
- **Manager Analytics Dashboard:** A visual command center aggregating data based on the user's
  role. Delivery Managers see agency-wide metrics; Project Managers see metrics isolated to their
  assigned clients.

## 4. Full Technical Architecture Blueprint

The platform uses an asynchronous, API-first architecture designed to support real-time features
and prevent long-running AI tasks from freezing the application.

- **Layer 1: Presentation (React.js / Vue.js)** — renders Kanban boards, hierarchical dashboards
  (via Chart.js), and dynamic user-assignment forms. Maintains a persistent WebSocket connection
  to receive real-time notifications.
- **Layer 2: API & Security (Node.js/Express or Python/FastAPI)** — manages RESTful CRUD
  operations. Enforces the hierarchical RBAC middleware (validating whether a user's token has the
  authority to view a specific client's data).
- **Layer 3: Real-Time & Background Processing (Redis)**
  - Message queue (BullMQ/Celery): consumes heavy AI jobs from the API, manages the HTTP request
    to the local Ollama server, and waits for the text generation to finish.
  - Pub/Sub engine: routes in-app notification events from the API to the correct WebSocket
    clients.
- **Layer 4: AI Processing (Local Ollama)** — air-gapped AI execution running lightweight models
  (e.g. Qwen3-Coder or Llama 3.1 8B). Processes transcripts and developer notes into structured
  JSON or Markdown.
- **Layer 5: Data (PostgreSQL)** — relational database storing the hierarchical mappings: Users,
  Roles, Workspaces, Projects, Cycles, Tickets, and Pages.
