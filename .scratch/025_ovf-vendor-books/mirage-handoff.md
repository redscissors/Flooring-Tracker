# Mirage import — handoff (2026-07-20)

Status: **parsing is clean and the four files join into one book; the router/wizard wiring is what remains before any of it is reachable from the UI.**

## Start here

1. Read ADR 0025 (`docs/adr/0025-import-source-provenance.md`) — accepted, and it
   governs everything below.
2. Branch fresh off `main`. **Branch every PR off `main`.** Stacking cost us
   three re-lands (#174→#176, #179→#180, #181 merged only its first commit →
   #184).
3. `npm test` — 520 passing.

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
- **#185** — the split-baseline width fix, `parseMirage(payloads)` (ADR 0025
  rule 7), and the species join-key fix. Parser-only; nothing calls it yet.

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

## The species trap (found 2026-07-20, fixed in #185)

Worth reading before touching the join, because it was invisible and expensive.

The 2026 chart moved **species** off the band row onto the texture row, printed
as an ALL-CAPS banner beside the texture (`MAPLE` `Smooth | DuraMatt®`). Nothing
failed — 960 of 968 rows simply carried no species, and every count still looked
healthy.

It mattered because **species belongs in the join key**. Admiration Exclusive
sells in Red Oak *and* Maple at the same collection/grade/construction/width,
priced **$9.29 vs $11.49**, and 27 chart rows differ by nothing else. Keyed
without species, both SKUs took whichever sheet row was written last — one of
them quoting ~$2/sq ft wrong, silently, with a 100%-priced join as evidence that
all was well.

Lessons that generalize:

- **"100% priced" is not "correctly priced."** The join reported 765/765 while
  mispricing. Check for price *conflicts* within a key, not just coverage.
- **Chart and sheets spell species identically** (verified across all 16 shared
  collection+grade pairs), so no mapping is needed — unlike construction and
  width, which do need normalizing. Don't invent a species synonym table.
- A count of rows "missing" a field is a weak signal; a count of rows that
  **collide** once that field is dropped is the strong one.

## What is NOT built

With the parsing clean and `parseMirage` landed, **the router/wizard wiring is
what now stands between this and the UI.** `parseMirage(payloads)` exists and is
verified, but nothing calls it: the wizard's `ingest()` still takes ONE payload
and `bundleByBook` still walks a book's files one wizard step at a time. Until
that changes none of this is reachable, so it outranks both items below.

0. **Hand the bundle to `parseMirage`.** `bundleByBook` should collapse a
   recognized multi-file set into ONE step carrying all payloads, and `ingest`
   should accept an array and try `parseMirage` before the single-file path
   (where `parseOvf` sits today). Needs preview proof — it is a UI change.

1. **Value Tower's colour grid.** The chart is the spine, but Lakeside and the
   Escape *Traditional* colours (Blue Ridge, Champlain, Chelan, Madison,
   Moosehead, Yellowstone) exist ONLY in Value Tower's own colour grid (rows 25+).
   The owner flagged Value Tower as load-bearing for exactly these, so shipping
   without it means a Mirage book with no Lakeside.
2. **The trim sheet.** Should emit trim rows carrying `fits` (#173) keyed by
   (collection, colour) — that link is stated outright in the sheet, 23/29 on a
   rough match, the misses being the Traditional line which genuinely has no
   colour-matched trim. `parseMirage` already warns that trim is unparsed — that
   warning is the thing to delete when it lands.

## Facts worth not rediscovering

- **The Hardwood sheet's SKUs are one arbitrary colour's.** `Blanc/Character/5" =
  36180` is specifically White Mist; `Muse/Character/5" = 72697` is Eleanor.
  Never source floor SKUs from it.
- **Document vintages differ.** Chart 2026-02-02, Value Tower 2025-02-03,
  Hardwood 2026-07-13. An older chart lists widths since discontinued, so some
  chart SKUs legitimately have no price and are dropped.
- **Hardwood supersedes Value Tower** where they overlap (owner, 2026-07-19) —
  but that is a fact about *today's editions*, not about the sheets. `parseMirage`
  now sorts them by each sheet's own `Effective:` line and hands them to
  `priceChartRows` oldest-first, so a newly published Value Tower wins on its own.
  Don't reintroduce a fixed call order.
- **Species is part of the join key**, and the chart and sheets spell it the same.
  See "The species trap" above before touching this.
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

- `src/miragebook.js` + `.test.js` — detectors, chart parser, flooring parser,
  the join, and `parseMirage(payloads)` — the multi-file entry point (ADR 0025
  rule 7) that emits the canonical sheet + `MIRAGE_MAPPING`
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
| `bundle-check.mjs` | `parseMirage` on the real four-file set: the canonical sheet, effective dates, order-independence, and that a non-Mirage set falls through |
| `livelymap.mjs` | the LIVELY block's width→construction map + one colour's SKUs, to check a mapping is RIGHT and not merely present |
| `qualrows.mjs` | both editions side by side around every Herringbone/Chevron row — the tool for "how does this edition print a qualified width?" |
| `dump.mjs` / `pdftext.mjs` | raw xls rows / raw PDF text with x,y — what to reach for when a layout question comes up |

They import `miragebook.js` **relative to their own location**, so they always
test the worktree they sit in. They used to hardcode an absolute path to a
worktree that no longer exists — if you copy one of these, keep the relative
import.

The cross-checks are the real acceptance test; the unit tests use synthetic
fixtures so they can live in the repo without the sample files.
