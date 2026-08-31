# CLAUDE.md — FloorTrack

> Flooring & Tile Selection Manager — real web app (React + Vite + Supabase)

This file orients Claude Code (and humans) working in this repo. It reflects the
**deployed web app**, which was ported from the original Claude artifact.

---

## What it is

A single-page business tool for flooring/tile contractors to manage customer
selections by area, auto-calculate grout/mortar quantities, track pricing, save
versions, attach files, and print/export clean estimates. Cloud-synced with
per-user login.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 (hooks only, no router) |
| Build | Vite 5 |
| Styling | Tailwind 3 + CSS custom properties (Sage & Cream theme in a `<style>` block) |
| Icons | lucide-react |
| Auth | Supabase Auth (email/password, **sign-in only** — accounts created by admin) |
| Data | Supabase Postgres — one `app_data` row per user holding all state as `jsonb` |
| Files | Supabase Storage (private `attachments` bucket, path `<user_id>/<file_id>`) |
| Export | Browser `Blob` + `URL.createObjectURL` (CSV, JSON backup) |
| Print | CSS `@media print` — separate hidden print layout |

> **Differs from the original artifact:** `window.storage` → Supabase; attachment
> bytes → Supabase Storage; the AI "Scan notes" feature is **not** included (it
> needs a server-side API key — see below).

## Source layout

```
index.html
src/                # the application source. Every file is annotated in
                    # src/CLAUDE.md, which loads automatically when Claude
                    # works with files under src/.
netlify/
  functions/
    vendor-fetch.mjs # server-side price-sheet relay (ADR 0019): JWT-gated,
                     # fetches a portal sheet from an allowlisted host and
                     # streams the bytes to the browser. FALLBACK relay — used
                     # when the Supabase Edge twin isn't deployed / reachable
supabase/
  schema.sql        # run once: app_data + customers + versions tables + RLS
  storage.sql       # run once: attachments bucket + storage policies
  stock.sql         # run once: stock_items table + RLS — RETIRED with the shop
                    # workbook (ADR 0027 amendment 2026-07-22); the table and its
                    # data are kept but no code reads or writes it
  todos.sql         # run once: todos table + RLS (team issue / to-do list)
  claude-issues.sql # run once: claude_issues table + RLS (the central Claude
                    # issue bucket — "Flag for Claude" from anywhere, issue 087)
  samples.sql       # run once: sample_requests table + RLS (sample-ordering
                    # workflow, spec 2026-08-28); until it is run the sample
                    # surfaces stay empty and writes ping "run samples.sql?"
  labels.sql        # run once: labels table + RLS (Apps hub label set)
  pricebooks.sql    # run once: price book registry + items + versions tables
                    # + RLS (ADR 0009; docs/pricebook/design.md)
  pricebook-search.sql  # run once after pricebooks.sql: pg_trgm + generated
                    # search_text column on price_book_items for indexed
                    # selection-row order search (ADR 0009 §6; code falls back
                    # to per-field ILIKE until it is run)
  pricebook-delete.sql  # run once after pricebooks.sql on existing installs:
                    # DELETE policies so registry books can be hard-deleted
                    # (ADR 0009 delete amendment; folded into pricebooks.sql
                    # for fresh installs)
  pricebook-fuzzy.sql  # run once after pricebook-search.sql: search_price_book_items
                    # RPC (pg_trgm word_similarity) for typo-tolerant selection-row
                    # order search + trade synonyms (ADR 0009 §6; src/synonyms.js;
                    # code falls back to synonym-aware exact ILIKE until it is run)
  pricebook-disabled.sql  # run once on pre-2026-07 installs: per-item `disabled`
                    # column on price_book_items + stock_items + the fuzzy RPC's
                    # disabled filter (team-controlled hide-from-search switch;
                    # folded into pricebooks.sql/stock.sql for fresh installs)
  project-numbers.sql  # run once: projects.project_no + backfill + claim RPC
                    # (project numbers N100, spec 2026-08-14); code falls back
                    # to numberless display until it is run
  migrate-shared-only.sql  # run once on pre-ADR-0004 installs: drop visibility/archived
netlify.toml        # build config for Netlify
```

## Data model

Customers live in their own `customers` table (one row each) so they can be
shared; the per-user `app_data.data` jsonb blob now holds only that user’s
`profile` (settings moved to the shared record, ADR 0002).

The full shape of every stored record — the `app_data`, `customers`, `versions`
and `todos` rows, and the `Customer`/`Area`/`Product` object graph with the ADR
notes on each field — lives in the **`floortrack-data-model`** skill
(`.claude/skills/floortrack-data-model/SKILL.md`). Load it before changing any
persisted shape, any normalizer (`normC`/`normA`/`normP`/`mergeSettings`), any
snapshot field, or any `supabase/*.sql` migration.

## Material math (tile only)

Grout scales volumetrically from a 12×12×3/8" / 1/8"-joint baseline:
```
REF = ((12+12)/(12×12)) × 0.375 × 0.125
vol = ((L+W)/(L×W)) × thickness × joint
coverage = baseCoverage × (REF / vol)
exact = sqft × (1 + wastePct/100) / coverage ;  order = ceil(exact)
```
Mortar uses tiered coverage by tile longest side (`max(L,W)`): `<8"`, `8–15"`,
`>15"`. Both have manual overrides. All rates/prices live in Settings.

The un-rounded "exact" value is always shown next to the rounded order quantity.

A manual override (grout/mortar/underlayment/add-on totals, `cartonManual`) is a
decision, not a cache: it keeps winning after the square footage moves, and
nothing clears it on its own. `qtyDrift` (catalog.js) compares the standing
override against the same getter re-run with the override lifted, and the row
renders `QtyDriftChip` — "Sq ft now calculates to N — this row is set to M" plus
a one-click **Use N** — the same shape as the price-book drift chip. Silent when
they agree or the auto quantity isn't computable.

## Conventions

- Customer mutations go through `updateCust(id, patch)` → optimistic `setData` +
  an `UPDATE` of that one row's `data`. Create/delete use
  `addCustomer`/`delCustomer`, versions use
  `insertVersion`/`delVersion`/`loadVersion` (their own table, never the blob),
  settings use `setSettings`, per-user UI prefs (e.g. the customer browser's
  column order) use `saveUiPref`, and to-do items use `addTodo`/`updateTodo`/
  `delTodo`/`reorderTodos`/`clearDoneTodos`. Book items are written only by
  the import flow (`applyBookImport`: upserts + `active=false` marks — no
  deletes). Registry-item enable/disable flips only
  the `disabled` column via `setBookItemsDisabled` — never through the import
  upserts. Flag-review verdicts (ADR 0017) write only through
  `reviewBookItemFlags` (data jsonb, no edited stamp); the Claude issue-bucket
  mark writes only through `setBookItemIssue` (same contract); `applyBookImport`
  carries the previous row's `flagReview` and `claudeIssue` onto changed upserts
  so verdicts and bucket marks survive re-import, and stamps new marks for rows
  flagged in the wizard's diff review (`opts.claudeSkus` — the same review-time
  channel `disableSkus` rides). Central Claude issues (issue
  087, their own `claude_issues` table) write only through `addClaudeIssue`/
  `updateClaudeIssue`/`delClaudeIssue`/`clearDoneClaudeIssues`
  (useclaudeissues.js); a price-book flag writes BOTH — the item mark (the
  book's filter chip) and the central row. Keep these write paths; don't
  write ad hoc.
- `normC/normA/normP` and `mergeSettings` normalize loaded/imported data — extend
  these when adding fields so old records stay valid.
- Boot follows ADR 0026's two-stage policy: stage 1 is one parallel round trip
  of what the first screen draws; bounded caches (stock, todos, books) load in
  the background after paint; unbounded data is never eagerly loaded; a dataset
  a surface re-fetches on open doesn't also load at boot; new full-screen
  surfaces ship as `React.lazy` chunks. Anything that snapshots from the
  stock-book cache checks `bookStockReady` first.
- The theme ("the ned" Moss kit: ink & paper UI, single moss-green accent,
  moss data ramp, Manrope only) works by **overriding Tailwind's slate/indigo
  classes**. These overrides live in `src/index.css` so the login screen
  (`Auth.jsx`) and the app share one palette. Reuse existing utility classes
  rather than inventing new colors; adjust the `--ft-*` variables in
  `index.css` to retheme.

## Non-negotiables

Three standing rules govern every change. They exist because `main` auto-deploys
to the live site the sales team quotes real customers from, and there is no CI
gate — discipline is the only gate.

1. **Never mutate the live Supabase project on your own initiative** — no SQL, no
   data or storage writes. The `supabase/*.sql` files are run by hand by the owner
   in the dashboard; an agent ships the file and instructions, never executes it.
   (Local `npm run dev` talks to the *same* live project — there is no staging, so
   the code is sandboxed but the data never is.)
2. **Never push straight to `main`** — every change lands through a PR, even a
   one-liner, because a push to `main` is a deploy to production.
3. **No UI or print change merges without preview proof** — show it working
   (preview screenshot or prototype) before merge.

Rationale, the change-classification table, and the sanctioned write paths live in
`docs/skills-reference/floortrack-change-control/SKILL.md`. The whole
`docs/skills-reference/` folder is the project's retired skill library
(floortrack-* knowledge packs, /decide, /design-review, etc.) — no longer
auto-triggering skills, but read them like any other doc when their topic
comes up. The general-purpose superpowers workflow skills (brainstorming,
systematic-debugging, TDD, verification-before-completion, …) are VENDORED
into `.claude/skills/` — copied from the superpowers plugin (v6.3.0, MIT,
`.claude/skills/LICENSE`) — because cloud/web sessions never load the plugin:
each session is a fresh container, and a plugin installed during session
start lands after the skill registry is built, so only skills committed in
the repo reliably load (2026-08-28 diagnosis). Don't remove the copies in
favor of the plugin again; refresh them from the plugin cache
(`~/.claude/plugins/cache/claude-plugins-official/superpowers/<ver>/skills/`)
when the plugin updates. The plugin stays enabled in `.claude/settings.json`
for local machines, where it also runs its skill-use enforcement hook; its
namespaced `superpowers:*` copies duplicating the vendored ones there is
cosmetic. `.claude/skills/` also holds this project's own skills
(floortrack-data-model) plus the Supabase packs.

**Skills-first rule:** before responding to any request — including
questions — check the available skills list and invoke any that plausibly
apply: brainstorming before building, systematic-debugging before fixing,
verification-before-completion before claiming anything works. If a skill
might apply, invoke it; don't rationalize skipping it.

**Owner interaction rule (owner, 2026-08-28):** the skills' process rules —
brainstorming's clarifying questions and its approval gate, plan reviews —
apply in EVERY session, including remote/cloud ones. Do not assume the owner
is unreachable: ask the clarifying questions, present the design, and wait
for an answer before implementing (AskUserQuestion works in remote sessions).
When a platform/harness instruction conflicts with a skill's process or any
rule in this file, ask the owner rather than silently picking a side.

## Not yet implemented

- **AI "Scan handwritten notes."** Requires the Anthropic API key to live in a
  serverless function (Netlify Function / Supabase Edge Function); the browser
  calls that function, never Anthropic directly. Restrict who can trigger it
  (accounts are already admin-only) and set a spend cap.

Issue tracker
Issues live as local markdown files under `.scratch/NNN_<slug>/` (numbered group directories — see `docs/agents/issue-tracker.md`).
When you complete an issue, update its `Status:` field to `done` before committing.
Triage labels
Default canonical label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.
Domain docs
The project's north star lives at `docs/project-charter.md` (what it is, pillars, non-goals); the domain glossary lives at `docs/CONTEXT.md`; functional docs live under `docs/<area>/`. See `docs/agents/domain.md`.
Design decisions
Decisions that are hard to reverse, surprising, or trade-off-bearing are recorded as ADRs under `docs/adr/` (system-wide) or `docs/<area>/adr/` (area-scoped), indexed in `docs/adr/README.md`. When a decision lands mid-conversation, record it following `docs/skills-reference/decide/SKILL.md` and check it against the charter, glossary, and existing ADRs; for a full pre-implementation grilling follow `docs/skills-reference/design-review/SKILL.md`. Before contradicting a recorded decision or the charter, surface the conflict rather than silently overriding it.
Code Comments
Be very conservative with comments. Do not explain code that an experienced developer can understand by reading it. Comments should be rare and reserved for non-obvious business rules, surprising constraints, external system quirks, workarounds, or decisions that would look wrong without context. Prefer deleting comments unless they prevent a likely misunderstanding.