# Helm design system

One visual language for the staff app and the client portal. Tokens live in
[`apps/web/src/theme/`](../../apps/web/src/theme/) and icons in
[`apps/web/src/icons/`](../../apps/web/src/icons/); components never hard-code colours or import
icons directly (ESLint enforces the icon rule).

## Brand

**Helm** — the wheel that steers a ship. The identity is nautical and calm: deep navy for the
application frame, a sea-blue primary for action, and brass for anything the client can see. The
mark is a ship's wheel ([`apps/web/public/helm-mark.svg`](../../apps/web/public/helm-mark.svg)):
brass hub, sea-blue rim and spokes (white on navy).

Voice in the UI: short, plain, specific. Name the action on buttons ("Send to client", not
"Submit"), say what happened in toasts ("ACME-12 moved to Done"), and say what to do next in empty
states.

## Colour

### Brand ramps

All three are generated in OKLCH with even lightness steps, so the same shade index has the same
perceived lightness across hues. Shade 6 is the light-mode "filled" colour, shade 8 the dark-mode
one (Mantine's `primaryShade: { light: 6, dark: 8 }`).

| Token                          | 0         | 1         | 2         | 3         | 4         | 5             | 6             | 7         | 8         | 9             |
| ------------------------------ | --------- | --------- | --------- | --------- | --------- | ------------- | ------------- | --------- | --------- | ------------- |
| `helm` (primary, sea blue)     | `#eef9fd` | `#d4effa` | `#aedff3` | `#80cae7` | `#50b2d6` | `#0099c1`     | **`#007d9f`** | `#006884` | `#00536a` | `#003e51`     |
| `navy` (app frame)             | `#f1f5fc` | `#dde5f2` | `#bdcce2` | `#9bafce` | `#7991b4` | `#58739b`     | `#3a567f`     | `#274064` | `#182e4e` | **`#0e1f39`** |
| `brass` (client-facing accent) | `#fcf6ee` | `#f6e7d4` | `#ecd1ae` | `#dcb783` | `#c99b5a` | **`#b37f2d`** | `#986600`     | `#7e5400` | `#654200` | `#4d3100`     |

Checked contrast (WCAG 2.2):

| Pair                            | Ratio    | Use                                 |
| ------------------------------- | -------- | ----------------------------------- |
| white on `helm.6`               | 4.74 : 1 | Primary buttons (light mode) — AA   |
| `helm.6` on white               | 4.74 : 1 | Links, active nav text — AA         |
| `helm.4` on dark body `#242424` | 6.42 : 1 | Links and accents in dark mode — AA |
| white on `navy.9`               | 16.5 : 1 | Header text                         |
| `navy.2` on `navy.9`            | 10.1 : 1 | Secondary header text               |
| `brass.6` on white              | 4.96 : 1 | "Shared with client" text — AA      |

### Semantic tones

Components express meaning through a small set of **tones**, never raw colours. Each tone has a
light-mode and dark-mode step, chosen so icons and borders clear 3 : 1 against the surface
(WCAG 1.4.11); labels stay in the normal text colour, so text contrast never depends on the tone.

| Tone      | Meaning                                      | Light                | Dark       |
| --------- | -------------------------------------------- | -------------------- | ---------- |
| `neutral` | Not started, inactive, withdrawn             | `gray.7` (8.2 : 1)   | `gray.4`   |
| `brand`   | Active, primary                              | `helm.7` (6.3 : 1)   | `helm.4`   |
| `info`    | In progress, informational                   | `blue.8` (5.0 : 1)   | `blue.4`   |
| `review`  | Waiting for review                           | `violet.7` (5.6 : 1) | `violet.4` |
| `uat`     | With the client for acceptance               | `cyan.9` (5.6 : 1)   | `cyan.4`   |
| `success` | Done, accepted                               | `green.9` (4.4 : 1)  | `green.4`  |
| `warning` | Needs attention, changes requested           | `orange.9` (4.3 : 1) | `orange.4` |
| `danger`  | Blocked, overdue, rejected, destructive      | `red.8` (4.5 : 1)    | `red.4`    |
| `client`  | Visible to the client                        | `brass.6` (5.0 : 1)  | `brass.4`  |
| `special` | Data modelling and other distinct categories | `grape.7` (4.9 : 1)  | `grape.4`  |

Yellow is not used for meaning: no yellow step reaches 3 : 1 on white.

**Applying a light/dark pair.** In CSS modules, set the light value and override it under
`:global([data-mantine-color-scheme='dark'])`; for inline styles use `schemeClass` and
`schemeVars()` from `apps/web/src/theme/scheme.ts`. Do not use the CSS `light-dark()` function:
the production minifier rewrites it into a fallback that only works when the same stylesheet
declares `color-scheme`, which removed every tone colour from production builds. A test in
`apps/web/test/` fails if it appears in the source.

### Domain mappings

Every state is shown as **icon + label** (the `Tag` component). Colour is never the only signal.

**Ticket status**

| Status      | Tone    | Icon               |
| ----------- | ------- | ------------------ |
| To Do       | neutral | `IconCircleDashed` |
| In Progress | info    | `IconProgress`     |
| Blocked     | danger  | `IconHandStop`     |
| In Review   | review  | `IconEye`          |
| UAT         | uat     | `IconUserCheck`    |
| Done        | success | `IconCircleCheck`  |
| Cancelled   | neutral | `IconCircleX`      |

**Priority** — shown as an icon beside the title; the label appears in tooltips and forms.

| Priority | Tone    | Icon              |
| -------- | ------- | ----------------- |
| Urgent   | danger  | `IconChevronsUp`  |
| High     | warning | `IconChevronUp`   |
| Medium   | info    | `IconEqual`       |
| Low      | neutral | `IconChevronDown` |

**Ticket type**

| Type               | Tone    | Icon              |
| ------------------ | ------- | ----------------- |
| Task               | info    | `IconSquareCheck` |
| Bug                | danger  | `IconBug`         |
| Pipeline           | brand   | `IconTransform`   |
| Report / Dashboard | uat     | `IconChartBar`    |
| Data Model         | special | `IconSchema`      |
| Data Quality       | warning | `IconShieldCheck` |
| Investigation      | review  | `IconSearch`      |

**Pitch status**

| Status            | Tone    | Icon              |
| ----------------- | ------- | ----------------- |
| Draft             | neutral | `IconPencil`      |
| In Review         | review  | `IconEye`         |
| Sent to Client    | client  | `IconSend`        |
| Changes Requested | warning | `IconArrowBackUp` |
| Accepted          | success | `IconThumbUp`     |
| Rejected          | danger  | `IconThumbDown`   |
| Withdrawn         | neutral | `IconArchive`     |

**Action items** — `Suggested` (from AI, waiting for review): review, `IconSparkles`. `Open`:
neutral, `IconCircleDashed`. `Converted`: success, `IconCircleCheck`. `Dismissed`: neutral,
`IconCircleX`. Anything AI proposed keeps the sparkles icon and shows the quote it came from.

**Visibility** — `Internal`: neutral, `IconLock`. `Shared with client`: client (brass),
`IconWorldShare`. Anything a client can see carries the brass tag, so staff always know what
leaves the building.

**Roles** — a coloured dot + role name: Delivery Manager `grape`, Project Manager `indigo`,
Team Lead `helm`, Business Analyst `cyan`, Developer `blue`, Viewer `gray`, Client `brass`.

### Charts

Dashboards follow the data-visualisation method (form first, colour last, validated palettes):

- Single-series bars and progress meters use `helm.6` (light) / `helm.4` (dark): 4.7 : 1 and
  6.4 : 1 against their surfaces.
- Charts that encode state (overdue, blocked) use the reserved status scale — good `#0ca30c`,
  warning `#fab219`, serious `#ec835a`, critical `#d03b3b` — always with an icon and label.
- Multi-series charts use the validated 8-slot categorical order (blue `#2a78d6`, orange
  `#eb6834`, aqua `#1baf7a`, yellow `#eda100`, magenta `#e87ba4`, green `#008300`, violet
  `#4a3aa7`, red `#e34948`), assigned in order and never cycled. Changing a slot means re-running
  the palette validator.
- Numbers are always visible as text next to the mark (tiles, labelled bars, tables); a chart is
  never the only way to read a value.

## Typography

| Role                   | Face                                  | Size / weight                             |
| ---------------------- | ------------------------------------- | ----------------------------------------- |
| UI text                | Inter Variable (self-hosted)          | 14 px body (`sm`), 400; labels 500        |
| Headings               | Inter Variable                        | h1 26 / h2 21 / h3 18 / h4 16, weight 650 |
| Code, ticket keys, SQL | JetBrains Mono Variable (self-hosted) | 13 px                                     |

Fonts are bundled with the app (no CDN), so the portal works on a closed network and sends no
requests to third parties. Tables and numeric columns use `tabular-nums`.

## Spacing, shape, elevation

- Spacing follows Mantine's scale (`xs` 10 → `xl` 32); page gutters `md`, card padding `lg`.
- Radius `md` (8 px) for cards and inputs, `sm` (4 px) for tags and badges, round for avatars.
- Borders over shadows: cards are bordered with a small shadow only when they float (menus,
  modals, dragged board cards).

## Iconography

- **One set:** [Tabler Icons](https://tabler.io/icons), outline style, 24 px grid.
- **Stroke 1.75**, sizes `xs` 14 · `sm` 16 (inline with text) · `md` 18 (buttons, nav) ·
  `lg` 20 · `xl` 24 (empty states use 32+).
- **Registry:** `apps/web/src/icons/index.ts` maps concepts to icons (`Icons.ticket`,
  `StatusIcon[status]`, `NavIcon.board`…). Features ask for a concept, not a glyph, so a concept
  looks the same everywhere and can be changed in one place.
- **Icons never stand alone.** An icon-only button has a tooltip and an `aria-label`; state icons
  sit next to their label.

| Concept       | Icon                     | Concept         | Icon                                |
| ------------- | ------------------------ | --------------- | ----------------------------------- |
| Dashboard     | `IconLayoutDashboard`    | Board           | `IconLayoutKanban`                  |
| My work       | `IconChecklist`          | Backlog         | `IconInbox`                         |
| Clients       | `IconBuildingSkyscraper` | Cycles          | `IconRefresh`                       |
| Projects      | `IconFolders`            | Tickets (list)  | `IconListDetails`                   |
| Pages         | `IconFileText`           | Meetings        | `IconMessages`                      |
| Pitches       | `IconPresentation`       | Members         | `IconUsers`                         |
| Notifications | `IconBell`               | Administration  | `IconShieldLock`                    |
| Audit log     | `IconHistory`            | Import / Export | `IconFileImport` / `IconFileExport` |
| Transcript    | `IconMicrophone`         | Action item     | `IconCheckupList`                   |
| AI suggestion | `IconSparkles`           |                 |                                     |

## Accessibility checklist

- Text contrast ≥ 4.5 : 1, icons/borders ≥ 3 : 1, in both colour schemes.
- State = icon + label, never colour alone; focus rings are visible (Mantine default, primary
  colour).
- Every form field has a visible label; errors are announced next to the field.
- Board drag-and-drop has a keyboard alternative (the status menu on each card).
- Light and dark schemes are designed, not inverted: each tone has its own dark step.
