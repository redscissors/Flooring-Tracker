---
issue_type: Bug
summary: "The 8/31 job-line flag batch — three Claude issues from Marcus. Two
  code fixes: a measure U/M (SF) can no longer name the bundle a coverage
  counts, so a carton-sold tile stops keying its 13 CARTONS to the desk as
  \"13 SF\"; and the OVF Tarkett/Hallmark parsers keep the molding length their
  column header prints. One verdict back: the CLNL289 \"+\" is already gone at
  the team's 70-character field."
status: done
labels: [ready-for-human]
---

# Job-line flags (Marcus, 8/26–8/31)

Three issues off the central Claude bucket. Preview proof (the real components
over the real math, no Supabase): `preview-order-entry.png` (the real
`OrderEntryPanel` over the real `orderEntryRow`, `order-entry-preview.html`)
and `preview-book-page.png` (the real `BookDetail`, whose Size/Cov. cells
derive through the real pick path, `preview.html`).

## 1. Catch Ivory Glossy — "this is sold as carton of 12.15 sf" — FIXED

The row was right about the carton and wrong about the word. Driven through
the real code, the stored line (140 sq ft, `cartonSf: "12.15"`,
`cartonUnit: "SF"`) produced:

```
13 SF    12.15 SF/SF    $63.18/SF
```

It had rounded up to **13 cartons** and then keyed them to the desk as **13
square feet** — 145 sq ft short of the job, at a per-carton price wearing a
per-sq-ft label. No `CT` tag either, the one mark that exists so the desk
can't misread bundles as pieces.

**Root cause.** `stockPatch` takes the book's sell unit from `orderUnitOf`
(`orderUnit`, else `unit`). This book states one U/M column and it is the
PRICE basis — SF, because the tile is quoted $5.20/sqft — so "SF" landed in
`cartonUnit`, a field that names what a coverage is counted in. Square feet
count nothing; they measure.

**Fix.** `isMeasureUnit` / `bundleUnit` in `src/units.js` — SF/LF/SY/… measure
material, they never bundle it, so they can't be a bundle name. Read through
in two places:

- `stockPatch` (`src/stock.js`) — the pick falls back to the existing default
  (`SH` for sheet goods, else `CT`) instead of borrowing the price basis.
  Every real bundling unit, and any vendor word the table doesn't know, still
  passes through untouched.
- `getCarton` / `getPieceCarton` (`src/catalog.js`) — the READ side, so the
  hundreds of lines already saved with `cartonUnit: "SF"` heal on open with no
  migration and no touch of live data. Nothing about the math moves — same 13,
  same $821.34 — only the word the count is in. The grid/mobile coverage chips
  read through it too (`SF/SF` → `SF/CT`).

The truth table owns the combo now, as ADR 0013 §3 requires: the
`SF single-U/M + SF/CT` row in `src/unitcombos.test.js`.

After (preview, last special-order rows): `CT 3"x12" Catch Ivory Glossy ·
F14CATCIV0312P 12.15 SF/CT · 13 CT · $42.16/CT · $63.18/CT`.

## 2. Tarkett Slim Trim - P29 — "it does not show trim size length" — FIXED

The sheet prints a molding's length once, in its COLUMN HEADER
(`Slim Trim - P29 (94")`), and `tkTrimLabel` stripped the parenthetical as
"no product meaning" — so the trim imported with an empty Size and the quote
never said how long the stick is. The Hallmark parser in the same file had the
identical drop (`STAIR NOSING 82"`). Mannington's trims have carried their
94" since ADR 0012; these two were the outliers.

**Fix.** `trimLength` (`src/ovfbook.js`) reads the length out of the header
and both parsers emit it in the canonical **Size** column, where a pick
snapshots it into the row's `sizeText`. The label itself stays clean — the
length is a size, not part of the molding's name. The inch mark is required
(unlike Mannington's bare-number PDF fallback): these are spreadsheet cells,
so the mark is always there, and a bare 2–3 digit run would read the "29" out
of a part code like `P29`.

End-to-end on the flagged SKU: header `Slim Trim - P29 (94")` → item size
`94"` → picked row `sizeText: '94"'` → order line
`94" Tarkett Milled Oak—Copper — Slim Trim - P29 335015047`.

**Takes effect on re-import.** The Tarkett and Hallmark books need one import
of their current sheet to pick the lengths up. Marcus's existing job line keeps
its blank size until the row is re-picked (snapshot doctrine, ADR 0003) — size
is not a drifting field, so no chip will offer it.

## 3. Glazzio CLNL289 — "why is this still showing a +" — NO CHANGE, ALREADY GONE

Asked again by the owner 9/1: the field is set to 70, shouldn't that make the
plus go away? **Yes, and it already has.** The flag is from 8/26, when the
field was 30; the soft-drop rule (issue 113) and the move to the real
70-character field (`DEFAULT_DESC_LIMIT`) both landed 8/26–8/27.

Driven through the real `orderEntryRow` with the exact stored snapshot at
limit 70:

```
12x12" Glazzio Colonial Long Hex Village Square CLNL289 1.06 SF/SH   66/70
cut: false          ← no "+"
```

Only "Collection" is dropped, and a soft-only drop is not a cut, so no marker.
Visible in `preview-order-entry.png`: the CLNL289 line reads 66/70 unmarked,
and the one line the amber footer note counts is the Uptown Pebbles line
(68/70), whose name genuinely clips.

What the line DOES still show is the paste chip and the amber **Ext** button —
by design (113): the chip appears whenever the pasted text isn't the written-out
description, and the full 77-character text goes in the extended-text field.
If Marcus is looking at the Ext button, that is what it is; if he is seeing a
literal "+" on this line today, the field isn't storing 70 — the panel footer
states the live value, so it would read "Descriptions are fitted to 70
characters".

Nothing to change. The bucket item can be checked off in Issues → Claude.

## Verification

- `npm test` — 1234/1234 passing. New: `isMeasureUnit`/`bundleUnit`
  (units.test.js), the SF-U/M pick (stock.test.js), the SF-U/M row healed on
  read (catalog.test.js), the panel end-to-end — `13 CT` / `12.15 SF/CT` / CT
  tag (print.test.js), the `SF single-U/M + SF/CT` truth-table row
  (unitcombos.test.js), and a molding's header length for both OVF parsers
  (ovfbook.test.js).
- `npx eslint src` — 7 problems, the same 7 already on `main`; nothing from
  these files.
- Preview proof — both PNGs above, mounted from the two dev harnesses, which
  gained the flagged rows (`orderentrypreview.jsx`, `preview.jsx`) so the next
  session sees these cases without rebuilding them.

## Not done

- The grid's own coverage chip (`SF/CT` beside the Cov. cell) has no preview
  harness; it is the same one-word `bundleUnit` read as the book table's Cov.
  column, which is in `preview-book-page.png`.
- Nothing was written to Supabase, and no `supabase/*.sql` was added — neither
  fix needs a migration.
