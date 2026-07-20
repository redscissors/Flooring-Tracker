# ADR 0026 — Two-stage boot; unbounded data is never eagerly loaded; new surfaces ship as lazy chunks

- **Status:** Accepted
- **Date:** 2026-07-20
- **Scope:** system-wide (boot sequence + dataset loading policy)
- **Related:** ADR 0003, ADR 0009 §6, `docs/superpowers/plans/2026-07-20-boot-and-data-architecture.md` (implementation plan + adversarial review record)

## Context

Load time was growing on two independent axes. Per **release**: one bundle
chunk that every feature made bigger. Per **import**: the boot sequence ran
~7 serial round trips and eagerly downloaded the entire `stock_items` table —
which only ever grows, since imports upsert and never delete (ADR 0003 §3) —
plus `todos`, `labels`, and `price_books`, all before the loading screen
cleared, though the first screen draws none of them. ADR 0009 §6 had already
recognized the principle for vendor books ("eager loading dies around book
three"); the boot sequence predated it.

## Decision

**1. The boot is two-stage.** Stage 1 blocks paint and is **one parallel
round trip** of only what the opening screen draws: the profile blob
(`app_data`), shared settings, the projects light list, people, and builders.
Stage 2 never blocks paint: bounded team caches (`stock_items`, `todos`,
`price_books` metadata) load in parallel in the background, each best-effort.
Everything else stays on demand.

**2. Unbounded data is never eagerly loaded.** It is server-searched
(`price_book_items`), key-fetched (the `orderItems` drift cache, version
snapshots), or fetched by the surface that shows it (project details, book
items, import history, attachments).

**3. A dataset that a surface re-fetches on open does not also load at boot.**
First application: `labels` — the Apps hub re-fetches on every open, so the
boot copy was dead weight and is gone.

**4. New full-screen surfaces ship as lazy chunks** (`React.lazy`). The boot
chunk is for the estimate grid and sidebar. First applications:
`SheogaConfigurator`, `AppsWorkspace` (which chains the Sheoga chunk — its
static import — on first open; both stay out of the boot chunk).

**5. `stockReady` guards the cache-coupled write paths.** During the stage-2
window, anything that *diffs against* or *snapshots from* the in-memory stock
cache refuses loudly instead of proceeding against `[]`: the shop-workbook
import (a diff against nothing lies "all new"), rollback (would silently drop
its retire marks), and book-linked grout picks (would blank ADR-0007 SKU/caulk
snapshots). Pure reads (SKU search, drift chips, grout family dropdowns)
simply fill in when the load lands. `stockReady` flips on load **failure**
too, so no guard holds forever; `stockReady && stock.length === 0` means a
genuinely empty install.

**6. Escape hatches are pre-planned, trigger-based, and not built now.**
- `stock_items` > ~5,000 active rows (Supabase dashboard — the primary
  trigger) *or* last-boot stage 2 > ~3 s on the shop connection (the
  `ft-boot-trace` localStorage entry every boot writes) → move stock SKU
  search server-side reusing the `pricebook-search.sql`/`pricebook-fuzzy.sql`
  machinery (a `search_text` generated column + trigram index on
  `stock_items`), resolve drift per-SKU like `orderItems`, and load grout
  families as a filtered slice; import diffs then fetch the full table at
  import time only.
- `projects` > ~5,000 rows → age the initial list (recent at stage 1, the
  "Older" bucket fetched on expand; server-side search already backfills).

## Why

- **Parallel stage 1 over the serial chain:** the waterfall was pure latency
  tax — none of those five reads depends on another (the shared-settings
  *seed* depends on the blob, so the seed decision waits for both; the read
  doesn't).
- **Background over blocking for the caches:** a user cannot open a job, focus
  a SKU box, and pick within the ~1 s the stock load takes — but every user
  paid that second (growing with the table) on every load. The guards in
  decision 5 close the real hazard, which was never latency: the old blocking
  boot doubled as a correctness gate for cache-coupled writes.
- **Refuse-loudly over write-through for the window:** a diff or snapshot
  against a still-loading cache doesn't error, it fabricates plausible wrong
  data (all-new imports, blanked grout SKUs). Seconds of "try again in a
  moment" beat silent misquotes.
- **Trigger-based escape hatches over building server search now:** at the
  stock book's current scale, in-memory search is simpler and faster, and
  grout families, Laticrete base pairing, and import diffs all lean on the
  cache. Porting them today is speculative complexity; recording the trigger
  and the mechanism makes the future move cheap and deliberate.

## Consequences

- New modules `src/bootload.js` (loaders with an injected client — it must
  never import `./lib/supabase.js`, which reads `import.meta.env` at eval and
  would break the dependency-free `node --test` suite) and `src/boottrace.js`
  (clock-injected timing). Both covered by `node --test`; new test files stay
  **flat in `src/`** (the test glob is `src/*.test.js`).
- Every boot writes `ft-boot-trace` to localStorage (dev builds also
  `console.table` it — twice, under StrictMode) so the decision-6 triggers
  are observable in production.
- `shared_settings` is one row but a **growing blob on the paint-blocking
  path** (catalog, vendor sign-in groups, label presets, ops). No new
  per-item grow-forever list may be parked there "because it's stage 1
  anyway" — that's what shared tables are for.
- Accepted windows: registry files dropped on the library in the first
  seconds route unmatched (`books=[]`) and are reassigned by hand — no wrong
  writes; the Apps hub's first open computes label positions from a
  still-loading list, risking only a sort tie (the pre-existing last-write
  clobber race is unchanged).
- Stage 2 now runs even when stage 1 fails — default settings alongside live
  caches is a new (strictly more useful) partial state; every affordance
  still hides when its own load fails.
- A signed-out-fast user changes nothing: the effect keys on `user.id` and
  re-runs per session as before.
