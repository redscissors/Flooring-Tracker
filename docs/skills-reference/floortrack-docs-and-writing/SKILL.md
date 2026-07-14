---
name: floortrack-docs-and-writing
description: The docs-of-record map for FloorTrack and the house writing style — which document owns which facts (CLAUDE.md, README.md, PROJECT_STATUS.md, docs/CONTEXT.md, docs/adr/, .scratch tickets and handoffs), exactly when each must be updated, the real templates extracted from the repo's ADRs / issue tickets / prototype handoffs, glossary vocabulary rules, and how this skill library itself is maintained. Load this when writing or updating ANY documentation in this repo — "update the docs", "write the ADR", "close this issue", "record the prototype outcome", "which doc does this go in", "does CLAUDE.md need updating for this change", when a PR checklist asks for a docs update, or when authoring/renaming a skill under .claude/skills/. Not for deciding WHETHER a decision needs an ADR (floortrack-change-control or /decide) and not for writing code comments (the policy lives in CLAUDE.md; this skill only records it).
---

# FloorTrack docs and writing

How this repo's documents of record are organized, when each must change, and
the templates and voice they follow. Everything below was extracted from the
actual files in the repo (verified 2026-07-06) — none of it is aspirational.

Audience assumption for every doc here: a **zero-context reader** (a fresh
agent session or a mid-level engineer who has never seen the project). If a
sentence only makes sense with the current conversation in your head, rewrite
it.

## Docs-of-record map

| Doc | Owns | Update when |
|---|---|---|
| `CLAUDE.md` (root) | Architecture, tech stack, source layout, the **data model** (Customer/Area/Product/Settings shapes), material-math summary, code conventions (write paths, normalizers, theme, comment policy) | A convention, write path, table, or data-model field changes — **in the same PR as the code change**. Precedent: the "Prepared by" → "Your salesperson" print change updated CLAUDE.md in the same pass (see `.scratch/handoffs/prototype-prepared-by-print-2026-07-05.md`). |
| `README.md` | Outsider setup: quick start, one-time Supabase provisioning steps, deploy recipe, scripts table | Setup or deploy steps change: env vars, SQL files / run order, npm scripts, hosting. Not for architecture detail — that's CLAUDE.md. |
| `PROJECT_STATUS.md` | Handoff/status: where everything lives (GitHub repo, live URL, Netlify, Supabase project id), deploy mechanics, repo-rename warning, pending-setup checklist, done/not-done inventory | An account-level fact changes (URL, repo name, hosting, Supabase project) or a major milestone lands/unblocks a checklist item. |
| `docs/CONTEXT.md` | The domain glossary: terms, avoid-lists, relationships, flagged ambiguities | A domain term is coined, sharpened, or found ambiguous — **via the `/doc-context` skill** (it requires user confirmation of wording; never edit the glossary unilaterally). |
| `docs/adr/NNNN-*.md` + the index table in `docs/adr/README.md` | Design decisions that are hard to reverse, surprising, or trade-off-bearing | A real decision lands — **via the `/decide` skill**. The index row is part of the same change, always. Format below. |
| `.scratch/NNN_<slug>/ticket.md` (+ optional slice files) | The issue tracker: problem, goals, requirements, resolved design decisions, status | Opening an issue; resolving design questions; **on completion set the status field to `done` before committing** (CLAUDE.md rule). Format below. |
| `.scratch/handoffs/*.md` | Prototype outcomes and session handoffs | A prototype concludes (`/prototype` ends with `/handoff`) or a session is compacted for the next agent (`/handoff`). Format below. |
| `docs/<area>/` | Functional docs per area (what the system does, for domain readers) | Via the `/document` skill. **As of 2026-07-06 no `docs/<area>/` directory exists yet** — `docs/` holds only `CONTEXT.md` and `adr/`. Create lazily, only through `/document`. |

Rule of thumb for "which doc": *how it's built* → CLAUDE.md; *how to set it
up* → README.md; *where things live right now* → PROJECT_STATUS.md; *what a
word means* → CONTEXT.md; *why we chose this* → an ADR; *what we're going to
do* → a ticket; *what we tried and learned* → a handoff.

## House style

### Vocabulary — use the glossary, including the avoid-lists

`docs/CONTEXT.md` is binding for all prose (docs, tickets, ADRs, PR bodies,
commit messages). The load-bearing terms:

| Say | Never say | Why |
|---|---|---|
| **Selection** (a product line on an Area) | "Product", "line item" | "Product" is flagged overloaded in CONTEXT.md — it also means a catalog grout/mortar entry. Per-job thing = Selection; catalog thing = "Grout product" / "Mortar product". |
| **Area** | "Category", "room" | — |
| **Customer** (a.k.a. Job) | "Client", "account" | — |
| **Shared Settings** | "Preferences", "my settings" | Settings are shop-wide since ADR 0002, not per-person. |
| **Waste factor** | "the 10%" | It's two rates now (`waste: { tile, floor }`), not one number. |
| **Company** (catalog grouping) | "Brand", "vendor", "supplier" | — |
| **Enabled** (catalog show/hide) | "Active", "archived" | "Active" is the stock_items column; "archived" is a retired Customer concept (ADR 0004). |

Code identifiers are exempt: the jsonb fields are legacily named `categories`
(= Areas) and `products` (= Selections) and stay that way in code. Prose about
them still uses the glossary words.

### Comment policy (recorded here, owned by CLAUDE.md)

Quoted from CLAUDE.md, verbatim:

> Be very conservative with comments. Do not explain code that an experienced
> developer can understand by reading it. Comments should be rare and reserved
> for non-obvious business rules, surprising constraints, external system
> quirks, workarounds, or decisions that would look wrong without context.
> Prefer deleting comments unless they prevent a likely misunderstanding.

This skill does not adjudicate individual comments — the policy above is the
whole rule.

### Other style rules (observed across the repo's docs)

- **Date-stamp volatile claims**: counts, line numbers, "does not exist yet",
  test totals — write "as of YYYY-MM-DD". Undated volatile claims rot silently.
- **Imperative, concrete, scannable**: tables and checklists over paragraphs;
  bold the load-bearing phrase; repo-relative paths in backticks.
- **Decisions carry their why**: every ADR and every resolved ticket question
  in this repo states the rejected alternative or the reasoning, not just the
  outcome. Match that.
- **Link, don't duplicate**: tickets link their ADR
  (`../../docs/adr/0002-...md`); ADRs link their ticket in the `Related:`
  header. One home per fact.

## ADR house format

Extracted from the four real ADRs (`docs/adr/0001`–`0004`). Note: the generic
template in `.claude/skills/design-review/ADR-FORMAT.md` allows a one-paragraph
minimum; the **practiced** house format is richer:

```md
# ADR NNNN — <one-line decision statement, not a topic>

- **Status:** Accepted            (or: Accepted (supersedes [ADR NNNN](file.md))
                                   or: Superseded by [ADR NNNN](file.md) — <one-line what changed>)
- **Date:** YYYY-MM-DD
- **Scope:** system-wide (<what it touches>)     (area-scoped ADRs would live in docs/<area>/adr/)
- **Related:** `.scratch/NNN_<slug>/ticket.md`, ADR NNNN     (omit if nothing to link — 0004 does)

## Context
## Decision          (numbered points, one per sub-decision — 0001/0002/0003; short prose ok — 0004)
## Why               (the reasoning per decision; 0004 folds it into Decision/Consequences)
## Consequences      (always present — including the accepted downsides, stated plainly)
## Alternatives considered   (0001/0002 have it; each entry: option + "Rejected:"/"Deferred:" + reason)
```

- **Title is the decision, stated as a claim**: "Stock price book: shared
  `stock_items` table, SKU fills by snapshot, re-imports never rewrite
  estimates" — a reader learns the decision from the index alone.
- **Numbering**: four digits, sequential, global across all `adr/` directories
  (next free number as of 2026-07-06: 0005). Filename `NNNN-slug.md`.
- **The "surprising part" gets flagged as such** — 0001 literally writes
  "Outside the guard (the surprising part)". Do that.
- Amendments that don't change the decision get an inline dated note, not a new
  ADR (0002's color-list shape carries "*(Amended 2026-06-23: …)*").

### Supersession — the 0001 ↔ 0004 worked example

Decisions are reversed by a **new ADR plus a status edit on the old one**,
never by rewriting or deleting the old ADR. All three edits land in one change:

1. Write the new ADR with `- **Status:** Accepted (supersedes [ADR 0001](0001-archived-as-ungated-column.md))`.
2. Edit only the old ADR's Status line:
   `- **Status:** Superseded by [ADR 0004](0004-all-customers-team-shared.md) — archive and visibility removed entirely`.
   The rest of 0001 — its context, its reasoning — stays intact as history.
3. Update **both rows** in the `docs/adr/README.md` index table
   (columns: `# | Title | Status | Date`): the old row's Status becomes
   "Superseded by 0004", the new row is appended.

The index table must be updated **in the same change** as any ADR add or status
edit — an out-of-sync index is a bug.

## Issue ticket format

Extracted from the six real issues (`.scratch/001_*` … `006_*`).

- **Directory**: `.scratch/NNN_<slug>/` — three-digit sequential number,
  kebab-case slug (`004_stock-price-book`). Next free number as of 2026-07-06:
  007. The main file is always `ticket.md`.
- **YAML frontmatter** (all six use exactly these four keys):

```yaml
---
issue_type: Task            # only "Task" observed so far
summary: One long sentence a reader can triage from without opening the body.
status: done                # lifecycle field; see the done rule below
labels: [ready-for-human]   # canonical labels only, see below
---
```

- **Canonical triage labels** (from CLAUDE.md — don't invent others):
  `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
  `wontfix`.
- **Body sections.** Pre-work tickets (001–003) use the full interview shape:
  `# Title` → `## Problem / Why` → `## Goals` (numbered) → `## Non-goals` →
  `## Who uses this & how` → `## Requirements` (lettered `### A.`, `### B.` …)
  → `## Scope edges & rules` → `## Open business questions` →
  `## Out of scope / future` → `## Notes for engineering` or
  `## Design decisions` (each item tagged `**[Resolved]**` /
  `**[Resolved in design review]**`, linking the ADR). Tickets written at or
  after implementation (004–006) use the short shape: `## Problem / Why` →
  `## Decision (ADR NNNN)` or `## What changed` (→ optional `## Slices`,
  `## Follow-up round`, `## Out of scope / later ideas`). Rejected options are
  recorded in the ticket ("Per-person lists were **rejected**…") — keep doing
  that.
- **Multi-slice issues** (worked example: issue 002): the ticket gets a
  `## Slices` pointer and sibling files `NN-<slug>.md` (`01-shared-settings-store.md`
  …). A slice file is **not** YAML-fenced; it opens with plain lines
  `Status: done` and `Type: HITL` (needs a human decision) or `Type: AFK`
  (agent can run it alone), then `## What to build` and
  `## Acceptance criteria` (checkbox list).
- **The done rule** (CLAUDE.md, verbatim): "When you complete an issue, update
  its `Status:` field to `done` before committing." In practice that is the
  ticket's frontmatter `status:` key and each slice's `Status:` line. Observed
  lapse as of 2026-07-06: issue 002 shipped (all six slices `Status: done`)
  but its ticket frontmatter still says `status: needs-triage` — fixing that
  is a legitimate one-line docs PR.

## Prototype-handoff format

Extracted from the two real handoffs in `.scratch/handoffs/`
(`prototype-print-layouts-2026-07-03.md`,
`prototype-prepared-by-print-2026-07-05.md`).

- **Filename**: `prototype-<slug>-YYYY-MM-DD.md` (the `/prototype` skill
  routes the write through `/handoff`, which uses `<slug>-YYYY-MM-DD.md` for
  non-prototype session handoffs; suffix `-2`, `-3` on collision).
- **Sections** (bold-label paragraphs, not `##` headings):
  - `**Question:**` — the single design question the prototype existed to
    answer.
  - `**Method:**` / `**Explored:**` — what variants were built and how they
    were compared (e.g. "5 variants behind `?pv=` with real customer data").
    **Listing the rejected variants, with why they lost, is mandatory** — one
    handoff carries an explicit `**Rejected:**` line ("flat spec tables
    without boxes (A) … — pieces of each survived in the blend"). This is the
    raw material `floortrack-failure-archaeology` mines; a handoff that
    records only the winner has thrown away half its value.
  - `**Answer:**` — the picked design, described concretely enough to rebuild.
  - **What was folded in and where** ("Folded into the estimate print header
    in `src/App.jsx` (search "Your salesperson")") and **confirmation the
    prototype code was deleted** ("Prototype code … deleted the same day").
    A handoff without the deletion note means throwaway code may still be in
    the tree — check before writing that line.

## The known gap — missing referenced docs

Verified 2026-07-06 (`docs/` contains only `CONTEXT.md` and `adr/`): CLAUDE.md
references four files that **do not exist in the repo**:

- `docs/project-charter.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`
- `docs/agents/domain.md`

(The `/doc-context` skill also links `docs/agents/domain.md`.) Rules:

1. **Never cite them as sources** — everything they'd say must be verified
   against files that exist (CLAUDE.md itself, the ADRs, CONTEXT.md, tickets).
2. **Don't create them unilaterally.** The charter in particular is owner
   content (project pillars, non-goals) — it needs a `/decide` or `/document`
   session with the owner, not an agent's guess.
3. When a change already touches CLAUDE.md, **fixing or fulfilling these
   dangling references is a legitimate candidate improvement to propose** —
   propose, not silently do.

Re-verify the gap before repeating it:
`git ls-files docs/project-charter.md docs/agents` (empty output = still
missing).

## Observed doc drift (candidate fixes, verified 2026-07-06)

Stale-but-live claims worth a docs-only PR when touching the file anyway:

- `README.md` still describes the pre-ADR-0002/0004 world: "All app state …
  stored as a single JSON document in one `app_data` row per user" and
  "Backup / Restore (sidebar)" — customers/settings/versions have their own
  shared tables now, and backup/restore moved into Settings (issue 006). Its
  Supabase setup section also lists only `schema.sql` + `storage.sql`;
  `stock.sql` and `todos.sql` are missing from the run order.
- `PROJECT_STATUS.md` "What's done" repeats "one `app_data` row per user".
- `CLAUDE.md`'s data-model sketch is stale against the code: the `Product`
  type union omits `misc` (present in `TYPES`, App.jsx line 9) and the sketch
  omits the fields `grout.caulk`, `underlay.installMortars`, and
  `underlay.installSkip` (all carried by `normP`, App.jsx line 264). The
  `floortrack-*` skills document these from code; CLAUDE.md should catch up.
- Issue 002's frontmatter status (see the done rule above).

## This skill library itself

- Skills live at `.claude/skills/<name>/SKILL.md`; the frontmatter `name:`
  must equal the directory name. Optional reference files sit beside SKILL.md
  (existing examples: `design-review/ADR-FORMAT.md`,
  `doc-context/CONTEXT-FORMAT.md`).
- The `description:` is the trigger: third person, states concretely *when* to
  load the skill (quote the phrases a user would say), and points away to the
  right sibling for near-miss requests.
- **Knowledge skills** (the `floortrack-*` family) end with a
  **"Provenance and maintenance"** section: every volatile fact, its source,
  and a one-line re-verification command. When you load one and its facts are
  dated, run its re-verification commands before relying on them — and update
  the skill (a docs-only PR) if reality moved.
- **Renaming a skill**: skills cross-reference each other by exact name.
  Before renaming, find every reference:
  `grep -rn "<old-name>" .claude/skills/` — update all hits in the same
  change.

## When NOT to use this skill

- **Deciding whether something needs an ADR at all**, or what gates a change
  must pass — `floortrack-change-control` (the classification table) and the
  `/decide` skill (its three-bar test). This skill only gives you the format
  once the answer is yes.
- **Writing or judging code comments** — the policy is CLAUDE.md's, quoted
  above in full; there is nothing more here.
- **Defining a domain term** — `/doc-context` (interactive, user-confirmed).
  This skill only tells you the glossary exists and is binding.
- **Writing functional docs for an area** — `/document`.
- **Recording a decision mid-conversation** — `/decide`.
- **What counts as proof a change works** — `floortrack-validation-and-qa`.

## Provenance and maintenance

Volatile facts, sources, and one-line re-verification (run from repo root;
commands work in PowerShell and bash unless noted):

| Fact | Source | Re-verify |
|---|---|---|
| Docs map targets exist (CONTEXT.md, adr/, tickets, handoffs) | direct listing 2026-07-06 | `git ls-files docs .scratch` |
| No `docs/<area>/` functional docs yet | `docs/` holds only CONTEXT.md + adr/ | `ls docs/` |
| 4 ADRs; 0001 superseded by 0004; index columns/status | `docs/adr/*.md`, `docs/adr/README.md` | `ls docs/adr/; git grep -n "Superseded" docs/adr/` |
| ADR header/section shapes | read all four ADRs in full | `head -8 docs/adr/000*.md` |
| 6 issues, frontmatter keys, body shapes, slice format | read all six `ticket.md` + `002/*.md` headers | `grep -n "^##* \|^status:\|^labels:" .scratch/*/ticket.md` (bash) |
| Issue 002 status drift (`needs-triage` despite done slices) | ticket vs slice files, 2026-07-06 | `head -6 .scratch/002_manage-grout-mortar-options/ticket.md; head -1 .scratch/002_manage-grout-mortar-options/0*.md` |
| Canonical labels; Status→done rule; comment policy (quoted verbatim) | CLAUDE.md ("Triage labels", "Issue tracker", "Code Comments") | `git grep -n "needs-triage\|Status:.*done\|conservative with comments" CLAUDE.md` |
| Handoff formats and filenames | both files in `.scratch/handoffs/`; `/prototype` + `/handoff` skill texts | `ls .scratch/handoffs/; git grep -n "scratch/handoffs" .claude/skills/prototype/SKILL.md .claude/skills/handoff/SKILL.md` |
| Glossary terms + avoid-lists | `docs/CONTEXT.md` read in full | `git grep -n "_Avoid_" docs/CONTEXT.md` |
| Missing charter/agents docs | CLAUDE.md references vs repo | `git ls-files docs/project-charter.md docs/agents` (empty = still missing) |
| README/PROJECT_STATUS drift claims | both files read in full 2026-07-06 | `git grep -n "app_data row per user" README.md PROJECT_STATUS.md` |
| Process skills referenced (/decide, /doc-context, /document, /handoff, /prototype, /design-review) exist; format reference files | `.claude/skills/` listing | `ls .claude/skills/decide .claude/skills/doc-context .claude/skills/design-review` |
| Next free ADR number 0005; next issue number 007 (as of 2026-07-06) | directory listings | `ls docs/adr/ .scratch/` |
