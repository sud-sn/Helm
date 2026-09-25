# ADR 0007 — AI document drafts, and Word and PDF downloads

**Status:** Accepted · 2026-09-25

## Context

Developers and business analysts write the same two documents again and again: a technical
specification of what they built, and a delivery document of what a cycle or release shipped.
They asked to describe the work in their own words and have Helm write the full document. Those
documents are also sent to clients, so they must leave Helm as a Word file or a PDF.

## Decision

- **Two fixed document types**, technical specification and delivery document, each with a fixed
  list of sections and guidance per section in `apps/api/src/modules/pages/templates.ts`. The
  product owner chose fixed templates over templates administrators edit: every draft has the same
  structure, and changing a section is a code change that also bumps the prompt version.
- **One request per draft** through the existing `LlmProvider` ([ADR 0006](0006-llm-provider-abstraction.md)),
  with structured output `{ title, markdown, openQuestions }`. The model receives the developer's
  notes and the context they chose: a cycle and its tickets, single tickets, meetings (minutes and
  transcript) and pages of the same project. Context is read through the normal access checks, so
  nothing the author cannot see is sent, and is capped at about 60,000 characters. A draft may take
  up to three minutes and 12,000 output tokens; the Azure adapter lowers the limit for model
  versions that allow fewer tokens.
- **Guardrails in the prompt and after it:** use only facts from the notes and context; mark every
  missing fact as a "To confirm:" line and an open question; never write credentials. Helm removes
  a stray title, adds any template section the model left out (with a "To confirm" line), and
  appends the open questions as a checklist.
- **A draft is a page, not a publication.** It is saved as an internal page (version 1), linked to
  its `ai_runs` row (`pages.ai_run_id`, `pages.doc_type`), labelled "AI draft", with a review
  notice until it is edited. Sharing it with the client is a separate, audited step by a person.
  `page.drafted_with_ai` is audited; `ai_runs.output` keeps what shaped the draft, not its text.
- **Word** is generated on the server from the page's Markdown (`docx` with the `mdast` parser),
  with headings, tables, lists, checklists, code and a page-numbered footer. It follows the page's
  read access, so client users can download pages shared with them.
- **PDF** is the browser's own "Save as PDF" from a print view (`/print/pages/:id`), always in
  light colours. The browser keeps every character, table and code block exactly as Helm shows
  them, and the server needs no PDF engine.

## Consequences

- The notes and the chosen context go to the company's Azure OpenAI resource, as transcripts
  already do for action items.
- A draft takes one to two minutes and costs tokens; drafting is limited to 10 requests a minute
  per person, and every request is listed on the AI assistant page.
- Documents are only as good as the notes: gaps show up as "To confirm" lines and open questions
  rather than invented detail, and the review notice makes the reviewer responsible for them.
- Getting a PDF takes one step in the print window (choosing "Save as PDF").

## Alternatives considered

- **Templates edited by administrators:** more flexible, but documents drift apart and a bad
  template silently degrades every draft. Can be added later behind the same `DOC_TEMPLATES` shape.
- **Streaming the draft into the editor:** a nicer wait, but more moving parts (server-sent events
  through the reverse proxy). The single request is enough for documents of this size.
- **Server-side PDF** with a headless browser (adds about 200 MB to the image and memory per
  render) or a PDF library (limited fonts and characters, a second layout to maintain).
