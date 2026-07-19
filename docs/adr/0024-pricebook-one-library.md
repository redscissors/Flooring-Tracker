# ADR 0024 — One price-book library + review-when-ready

- **Status:** Accepted
- **Date:** 2026-07-19
- **Scope:** `PriceBookLibrary` / `VendorFetchPage` / `BookDetail` / `ImportRouter`
  in `src/App.jsx`, plus new pure helpers in `src/vendorfetch.js`. No settings-shape
  change and no new write path — `settings.ops.vendorGroups` (ADR 0020) and the
  registry import writes (`applyBookImport`/`importStockFile`, ADR 0009) are
  unchanged; this only changes when and how the user is walked into them.
- **Related:** ADR 0020 (sign-in groups), ADR 0021 (board layout, batch
  selection, always-live downloads) — amends both; **supersedes ADR 0021's
  sheet-row board presentation** (a linked sheet renders as its book, not as a
  filename). ADR 0021's sign-in/board concept and always-live (never
  pre-locked) downloads stand unchanged. ADR 0019 (fetch relay) — the sesid
  mechanic is untouched.

## Context

Vendor sheets and price books grew as two disconnected surfaces: a "Vendor
sheets" tab held sign-in groups and filenames, while the Settings sidebar held
a separate flat list of registry books. A book fed by a portal sheet only
showed that link as a tooltip and a bookId buried in the sheet's ⋯ menu —
finding "what feeds this book" or "what book does this sheet become" meant
jumping between two places. With more vendor books coming online, the sidebar
list doesn't scale (it's a flat, ever-growing list with no grouping), and the
two-surface split makes the sheet-first framing the primary one even though
the user's actual mental model is "my price books," not "my downloaded files."

Fetching was also coupled to reviewing: `run()`'s success path handed fetched
files straight to `ImportRouter`, which opened a `BookImportWizard` per file in
sequence. A batch download of five sheets ambushed the user with five
back-to-back review wizards they had to sit through immediately, whether or
not it was a good time to reconcile pricing changes. There was no way to just
grab the day's downloads and review them later, one book at a time.

## Decision

**(1) One library page.** The Settings "Price book" section's landing view
*is* the sign-in board — the separate "Vendor sheets" tab and the sidebar book
list both retire into a single page. A sheet linked to a book is *absorbed
into its book*: the board renders book-first rows (name, item count, last-
fetched, stale flag) with the filename demoted into the row's ⋯ menu, and
`BookDetail` gains a source-sheet strip so a book knows and can refresh its
own feed. Books with no portal sheet — the shop workbook and any hand-kept or
portal-less registry book — sit in a new In-house column alongside the
sign-in columns, so every book has exactly one home regardless of how it's
fed. *Ships in PR 2 (book-first rows) and PR 3 (the sidebar/tab retirement,
the In-house column, and the `useVendorFetch` hook that lets `BookDetail`
drive its own refresh) — implemented across PRs 1-3 (this stack).*

**(2) Review-when-ready.** Fetching only downloads. A successful fetch parks
its `File` in a session-only pending pool keyed by `recordKey(sheet)` — a
re-fetch of the same sheet replaces its parked entry rather than stacking a
second one. Each parked sheet/book shows an indigo "Review" pill in place of
its usual done/stale mark, and a floating bar ("N downloaded — ready to
review") offers "Review all," which chains every parked file through
`ImportRouter` sequentially, same as today's batch import flow. Only an
**applied** import removes its entry from the pool — closing a wizard with
"✕" (deciding to deal with it later) leaves the file parked, pill and all.
*Ships in PR 1, together with this ADR.*

**(3) Refresh-on-a-book is one intent, two paced steps.** "Refresh this book's
sheet" reads as a single action to the user but is implemented as fetch *then*
review: the click only downloads (step 2's pooling), and the resulting Review
pill is the invitation to walk through the diff whenever convenient — not a
forced modal in the same click. With PR 3's source-sheet strip in place, this
is how a book's own page re-pulls its feed without detouring through the
vendor board at all.

## Consequences

- The pending pool is **session-state only** — a `File`'s bytes can't go in
  `jsonb`, so a page reload silently clears it. Accepted: refetching is cheap
  (seconds against a live portal session), and nothing was ever committed, so
  there's no data to lose, only a re-click.
- `ImportRouter` gained two capabilities to support both directions of this
  decision: forced per-file `targets` (a `File` → bookId map, same precedence
  tier as the existing `preferTarget`) so a pooled review always lands on the
  book it was fetched for, and an `onFileDone(file, applied)` outcome callback
  so the pool can tell "reviewed and applied" apart from "wizard dismissed" —
  the distinction this whole ADR depends on.
- The fetch machinery that lived inside `VendorFetchPage` (groups, sesid
  resolution, progress, run/createBookFromSheet) moved into a
  `useVendorFetch` hook in PR 3, so `BookDetail` calls `run([sheet])` for
  its own source sheet without the page component being in the render tree.
  With PR 3 landed, refreshing a book's feed happens from the book page
  itself, via its source-sheet strip, and no longer requires detouring
  through the vendor board.
- The sesid/authorization mechanics (ADR 0019: a sheet fetches only with a
  live session matching its own `{host, user}`; `portal` stays nominal, ADR
  0020/0021) are entirely unchanged — this ADR only changes what happens
  *after* a successful fetch, never what's required to trigger one.
- Batch selection and always-live (never pre-locked) download buttons from
  ADR 0021 carry forward as-is; only the sheet row's *presentation* (filename-
  first vs. book-first) and its post-fetch behavior (immediate wizard vs.
  parked pill) change.
