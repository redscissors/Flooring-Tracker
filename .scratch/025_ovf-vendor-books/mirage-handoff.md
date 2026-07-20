# Mirage import — handoff (2026-07-20)

Status: **parsing works except one isolated defect; nothing is wired to the UI yet.**

## Start here

1. Read ADR 0025 (`docs/adr/0025-import-source-provenance.md`) — accepted, and it
   governs everything below.
2. `git checkout claude/mirage-book` (PR #184 open) or branch fresh off `main`.
   **Branch every PR off `main`.** Stacking cost us three re-lands this session
   (#174→#176, #179→#180, #181 merged only its first commit → #184).
3. `npm test` — 507 passing.

## Where the work stands

### Merged to main
| PR | What |
|---|---|
| #173 | floor→trim link is a real `fits` array + `trimsForFloor()`, not prose |
| #176 | a book can be fed by several vendor sheets (`sheetsForBook`) |
| #177 | a book's files import as ONE bundle (`bundleByBook`) — fixed a live retire bug |
| #178 | `book.data.sources` manifest + the completeness gate |
| #180 | "Add a file…" on the book page |
| #181 | Mirage detectors + the 2025 Product Chart parser |

### Open
- **#184** — flooring price parsers, the chart→price join, 2026 chart layout,
  region segmentation. Carries the known defect below.

## The one defect

**119 rows carry no `construction`, all `LIVELY` at `5"`.** One block, page 2 of
the 2026 chart, band row y419 (`TruBalance | TruBalance Lite | Solid` over 9
width columns).

Reading the PDF says it should resolve: 3 bands, 9 widths, every SKU x maps to a
distinct column with no ambiguity. So the cause is NOT visible in the document —
**instrument `parseBlocks` and print the actual `b.bands` / `b.widths` / the
`bandRuns` map for that block** rather than re-reading the PDF. That is the next
concrete task and it has a definite answer.

Everything else in the 2026 chart parses (968 rows, all 10 collections).

## What is NOT built

1. **Value Tower's colour grid.** The chart is the spine, but Lakeside and the
   Escape *Traditional* colours (Blue Ridge, Champlain, Chelan, Madison,
   Moosehead, Yellowstone) exist ONLY in Value Tower's own colour grid (rows 25+).
   The owner flagged Value Tower as load-bearing for exactly these, so shipping
   without it means a Mirage book with no Lakeside.
2. **The trim sheet.** Should emit trim rows carrying `fits` (#173) keyed by
   (collection, colour) — that link is stated outright in the sheet, 23/29 on a
   rough match, the misses being the Traditional line which genuinely has no
   colour-matched trim.
3. **Multi-payload `ingest`** (ADR 0025 rule 7). The wizard's `ingest()` takes ONE
   payload; Mirage needs all files handed to one parser, because the chart and the
   price sheets must be JOINED, not concatenated. **Until this exists none of the
   parsing is reachable from the UI.** #177's bundling accumulates *items* across
   files, which is not the same thing.

## Facts worth not rediscovering

- **The Hardwood sheet's SKUs are one arbitrary colour's.** `Blanc/Character/5" =
  36180` is specifically White Mist; `Muse/Character/5" = 72697` is Eleanor.
  Never source floor SKUs from it.
- **Document vintages differ.** Chart 2026-02-02, Value Tower 2025-02-03,
  Hardwood 2026-07-13. An older chart lists widths since discontinued, so some
  chart SKUs legitimately have no price and are dropped.
- **Hardwood supersedes Value Tower** where they overlap (owner, 2026-07-19).
  `priceChartRows` relies on call order: Value Tower first, Hardwood second.
- **A filename is never an identity.** Vendors re-date files
  (`AOT EFT 26 02 19` → `26 05 20`). Fetched sheets key on `recordKey`, manual
  files on content fingerprint.
- **The 2026 chart differs from 2025 in five ways** — `Solid` replaces `Classic`;
  the pattern qualifier moved to its own row; `Colors` is centred over a
  left-aligned column; a colour name is split into several text items
  (`Bow Valley` `(` `Natural` `)`); and pages carry side-by-side tables.
  Expect the next edition to move again — **worth asking OVF for CSV/Excel
  instead.** That one email could retire this whole class of problem.
- **Side-by-side tables**: the gutter MOVES down the page, so a page-wide column
  split fails. The pages are horizontal sections with aligned bottoms (owner's
  observation) — segment vertically on gaps between SKU rows, then split
  left/right within a section. Cut just past the left table's last column, not at
  the gutter midpoint, or the right table's labels go to the left table.

## Source files

- `src/miragebook.js` + `.test.js` — detectors, chart parser, flooring parser, join
- `src/dropimport.js` — `bundleByBook`, `sourceSlot`/`mergeSources`/`missingSources`,
  Mirage format tags in `fileFormat`
- `src/App.jsx` — `ImportRouter` (bundling + the gate), `GateGap`, `AddFileNotice`,
  `SourceSheetStrip`, `BookImportWizard` (`addMode`, `carryItems`, `bundle`)

## Sample files (NOT in this repo)

- 2026 chart: `.claude/worktrees/mirage-floors-product-chart-23550a/.scratch/025_ovf-vendor-books/samples/mirage-product-chart-us-2026-02-02.pdf`
  — note that's a **different worktree**; another session was working on Mirage too, worth checking for overlap
- `OVF-Mirage-Hardwood.xls`, `OVF-Mirage-Value-Tower.xls`, `OVF-Mirage-Trim.xls` — `~/Downloads`

## Verification scripts

`tools/` beside this file. They take absolute paths to the samples above and are
dev-only (never imported by the app). Run with plain `node`.

| script | what it reports |
|---|---|
| `verify-mirage.mjs` | 2025 chart: row count, detectors, spot checks, and the 39/39 cross-check against the Value Tower colour grid |
| `newchart.mjs` | 2026 chart: rows, collections, constructions, rows missing a grade/construction |
| `join-check.mjs` | the chart→price join, which sheet won each overlap, unpriced rows by collection |
| `dump.mjs` / `pdftext.mjs` | raw xls rows / raw PDF text with x,y — what to reach for when a layout question comes up |

The cross-checks are the real acceptance test; the unit tests use synthetic
fixtures so they can live in the repo without the sample files.
