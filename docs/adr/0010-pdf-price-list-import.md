# ADR 0010 — Import product data from text-based vendor PDFs, header-driven, feeding the existing mapped-import wizard

- **Status:** Accepted
- **Date:** 2026-07-13
- **Scope:** system-wide (new `src/pdfbook.js` parser + `pdfjs-dist` dependency + one branch in `BookImportWizard.onFile`). No schema change; no new write path.
- **Related:** ADR 0009 (price book library / mapped-import wizard), ADR 0003 (snapshot doctrine), `src/pricebook.js` `parseMapped`

## Context

Vendor price lists don't always arrive as a workbook. Some vendors ship only a
"digital price list" **PDF** (first real example: Glazzio Tiles, 50 pages,
~170 tile products). The mapped-import wizard (ADR 0009) already turns
arrays-of-rows into normalized order items with a diff preview and the
snapshot/honesty guarantees — but it could only ingest `.xlsx`. We want the same
review-before-apply pipeline for a PDF, without a second import UI.

Unlike a workbook, a PDF has no rows or columns — only text at x/y coordinates —
and each Glazzio page prints its **own** header with a different subset of
columns (14 distinct header layouts across 50 pages: Item # / Collection / Color
Name always, then any of Variation / Pieces per Box / SQF per Box / $ per SQF /
$ per Box / Size / Description). A single fixed column map cannot describe the
book.

## Decision

1. **A new pure parser, `src/pdfbook.js`, reshapes a text PDF into one canonical
   sheet.** It takes already-extracted text items (`[{ str, x, y, w }]` per page
   — exactly what `pdf.js` `getTextContent()` yields), never a PDF blob, so it is
   covered by `node --test` with no `pdfjs-dist` dependency (mirrors how
   `pricebook.js` takes SheetJS output). It reads **each page's own header** to
   place that page's columns, then aligns every page onto one fixed schema
   (Item # · Name · Collection · Variation · Size · Pieces/Box · SQF/Box · Cost ·
   Price U/M) with a suggested mapping. Output is the `{ name, rows }` shape the
   wizard already consumes.

2. **Columns come from the data's gutters; the header only labels them.** Row
   boundaries are y-clusters (tolerant of the two-baseline typesetting of one
   product row); column boundaries are vertical whitespace gutters in the
   product rows only (marketing/legend lines are excluded first, or they fill
   every gutter). Each data column is labeled by the nearest whole header-label
   anchor, matched left-to-right (order-preserving), so an unlabeled extra column
   (a "PEI" rating, a "Tile Size") is skipped rather than shifting every field
   after it. `$ per SQF` and `$ per Box` are separated as distinct price anchors.

3. **`$ per SQF` and `$ per Box` collapse into one cost + Price U/M.** Order by
   the box when its SF/box coverage is known (so `$/sqft` derives and whole-box
   ordering works, per the carton model); otherwise the per-SQF price is the
   cost. Nothing new is stored — this is the existing order-item shape.

4. **Missing beats wrong — two guards keep a misread off a quote.** A PDF misread
   is more likely than an xlsx one, and a wrong cost on a printed quote is the
   one unacceptable outcome. So: (a) a **self-consistency** check — when a row
   prints a box price, a $/sqft, and the SF/box, `box ÷ SF-box` must reconcile
   with the printed $/sqft, else both prices are distrusted; and (b) a
   **plausibility ceiling** — a derived per-sqft cost above $200 (no flooring
   costs that) means a non-price column was misread into the price slot. Either
   guard emits **no cost** (visible as "missing" in the diff preview), never a
   wrong number. On the validation set this drops the one genuinely pathological
   layout (ARLVT pallet-priced vinyl — a line the shop does not sell) to missing.

5. **`pdfjs-dist` is lazy-loaded, like xlsx.** `await import("pdfjs-dist")` and
   the worker (`?url` asset) happen only inside the wizard's PDF branch, so they
   build as their own chunks and the main bundle never pays for them.

## Consequences

- **Validated** against the real Glazzio book through the app's own
  `parseMapped` + `costSqft`: 169 products across all 14 layouts, 95% priced,
  and of the 158 rows where the book prints a $/sqft, **143 derive to the exact
  penny and 0 are wrong** (17 safely missing). Independent price scrape used as
  the reference.
- The honesty guarantee is unchanged: `parseMapped`'s SKU pattern is still the
  final gate, so an unrecognized page shows as missing counts, never garbage.
- **Only text PDFs.** A scanned/image PDF has no text layer and is out of scope
  (would need server-side OCR, which this app deliberately has none of — same
  reason the AI note-scan is not built).
- Odd or new layouts that the auto-mapping misses are hand-mapped in the same
  wizard and the mapping saves on the book, exactly as for a workbook.
