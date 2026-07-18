# ADR 0022 — Quick Price: a customer-less draft-project lifecycle

- **Status:** Accepted
- **Date:** 2026-07-18
- **Scope:** `src/App.jsx` — one new Project field (`quick`), a landing/sidebar
  entry point, a "Quick Prices" sidebar folder, a go-home deselect, and (later
  PRs) a promote flow + a 30-day sweep. **No SQL migration** — `quick` rides
  inside the existing Project `data` jsonb blob.
- **Related:** ADR 0005 (Builder ▸ Customer ▸ Project — a Project already exists
  with `customer_id = null`), ADR 0008 (salesperson snapshot at creation, which
  quick prices inherit for free).

## Context

The sales team often needs a price *right now* — a customer on the phone, a
walk-in at the counter — before there is a customer record to hang it on.
Today the only way to start an estimate is **New customer → New project**, which
forces naming a person up front. That friction pushes quick lookups out of the
app entirely (onto paper / a calculator), so those numbers never become real
jobs and never carry the shop's real pricing.

The estimate engine (areas, pricing, print, order entry) already lives on a
**Project**, and per ADR 0005 a Project can already exist with
`customer_id = null` (the "Unassigned jobs" bucket proves it). So a fast,
customer-less quote is almost entirely reuse: it is just a Project you can start
without a customer and file under one later.

## Decision

**A Quick Price is a Project with `customer_id = null` and a new `quick: true`
flag.** That single fact means no new estimate engine, print path, or
order-entry code — those already work off `sel.categories` with no linked
person, degrading empty customer fields to a dash.

- **`quick` lives in the `data` jsonb blob, not a new column.** `custData`
  already serializes the whole project object into `data` (spreading `...rest`),
  so `quick` round-trips with no schema change — honoring the non-negotiable
  that agents never mutate the live Supabase project. `LIST_SELECT` projects it
  out server-side (`quick:data->>quick`) so the sidebar's light rows can see it
  without loading full detail; `lightRow` and `normC` parse it back to a real
  boolean.

- **Definition of a draft:** `quick === true && customerId === null`. A plain
  unassigned job (`customerId === null`, `quick` falsy) is deliberately **not** a
  quick price — it keeps its own "Unassigned jobs" section and its normal
  auto-versioning and is never swept.

- **Entry lands in product search.** `startQuickPrice` creates the project with
  one seeded area whose blank adder row *is* the price-book search, and focuses
  that search box instead of the project-name field — the quote opens ready to
  "grab a price".

- **Drafts are throwaway until promoted.** Two consequences follow: (a)
  auto-version snapshots are skipped for `quick` projects, so a draft never
  spawns `versions` rows; (b) an *untouched* draft (all rows still blank) is
  discarded on leaving rather than kept — only a `quick` + fully-blank project is
  ever auto-deleted, via the existing `delProject` path.

- **The ned logo / mobile mark go home.** Previously there was no deselect
  affordance except delete paths. Clicking the sidebar logo (desktop) or the
  top-bar mark (mobile) now deselects to the landing screen; because the project
  is a real, autosaved row, leaving never loses it — it stays in the Quick
  Prices folder.

- **Promotion (later PR) is via `linkProject` + clearing the flag.** Filing a
  quick price under a customer reuses the one existing writer of
  `projects.customer_id` (`linkProject`) plus an `updateProject(id, { quick:
  false })`. The draft becomes an ordinary job and thereafter auto-versions
  normally.

- **The 30-day sweep (later PR) is client-side.** Unpromoted drafts older than
  30 days delete on app load through `delProject`. No cron, no server, no
  agent-initiated Supabase writes — it is app code the owner deploys.

## Consequences

- Fast quoting becomes a first-class, on-mission flow with **zero** new
  database surface and no change to the estimate/print/order-entry code.
- Adding `quick` to `LIST_SELECT`/`lightRow` was required (not optional): the
  sidebar draws from light rows, which otherwise never carry the flag, so the
  Quick Prices folder would have been invisible.
- Quick prices don't accumulate version history, keeping the `versions` table
  free of throwaway drafts; the trade-off is that a draft has no undo until it
  is promoted (acceptable — it is a scratch quote by definition).
- The auto-delete rules are intentionally narrow (`quick` + blank on leave;
  `quick` + unassigned + >30 days on load). A named/assigned or plain
  unassigned job is never at risk.
- New Project lifecycle states exist: **draft (quick)** → **promoted (normal)**,
  or **draft → auto-discarded**. Everything downstream keys off the two-field
  definition above.
