# Mirage import — handoff (2026-07-20)

Status: **parsing is clean on both chart editions; nothing is wired to the UI yet.**

## Start here

1. Read ADR 0025 (`docs/adr/0025-import-source-provenance.md`) — accepted, and it
   governs everything below.
2. Branch fresh off `main`. **Branch every PR off `main`.** Stacking cost us
   three re-lands (#174→#176, #179→#180, #181 merged only its first commit →
   #184).
3. `npm test` — 514 passing.

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

| #184 | flooring price parsers, the chart→price join, 2026 chart layout, region segmentation |

### Open
- nothing.

## The one defect — FIXED

**119 LIVELY rows carried no `construction`.** The document was never the
problem, and the instrumentation gave the answer in one run: that block offered
**2 widths against 3 bands**, so `bandRuns` correctly refused to map them.

The widths are not always ONE printed row. Where a band's columns carry a
pattern qualifier, their widths sit on a lower baseline than the plain ones —
439.72 vs 443.16, a 3.44 gap that just clears `pageRows`' `<= 3` row tolerance.
Reading only `rows[i-1]` therefore saw the two Herringbone 5" columns and
nothing else. The parser now gathers every row between the header and the
thickness/band row above it.

Two things fell out of that and are worth remembering:

- **The editions print a qualified width differently.** 2025 puts it inside one
  text item (`"Herringbone 5"`); 2026 floats the qualifier on its own row. A
  width filter tight enough to reject the gathered non-width text has to accept
  both, or 2025 silently loses `herr 5` / `chevron 5` — it did, mid-session, and
  the join fell 765 → 729.
- **`cur.widths` must be sorted by centre.** Gathering across rows interleaves
  the baselines, and `bandRuns` partitions widths into *contiguous* runs — an
  out-of-order list maps columns to the wrong construction while still looking
  fully populated, which is worse than the blank it replaced.

Both editions now parse clean: 2025 868 rows / 39-of-39 cross-check / 765-of-765
priced, 2026 968 rows / all 10 collections / 0 missing a grade or construction.
The LIVELY block's width→construction map was checked column by column against
the raw PDF x-positions (`livelymap.mjs`).

## What is NOT built

With the parsing clean, **#3 (multi-payload `ingest`) is the one that unblocks
everything** — until it exists none of this is reachable from the UI, so the
other two ship into a book nobody can import. Do it first unless the owner wants
Lakeside visible sooner.

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
| `livelymap.mjs` | the LIVELY block's width→construction map + one colour's SKUs, to check a mapping is RIGHT and not merely present |
| `qualrows.mjs` | both editions side by side around every Herringbone/Chevron row — the tool for "how does this edition print a qualified width?" |
| `dump.mjs` / `pdftext.mjs` | raw xls rows / raw PDF text with x,y — what to reach for when a layout question comes up |

They import `miragebook.js` **relative to their own location**, so they always
test the worktree they sit in. They used to hardcode an absolute path to a
worktree that no longer exists — if you copy one of these, keep the relative
import.

The cross-checks are the real acceptance test; the unit tests use synthetic
fixtures so they can live in the repo without the sample files.
