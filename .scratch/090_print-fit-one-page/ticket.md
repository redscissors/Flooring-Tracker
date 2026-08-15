Status: open

Fit a large job's printed estimate on fewer pages (owner, 2026-08-15: "printing
a larger order like N167 ... very wasteful with space, I'd like it to try to fit
on one page vs the three it does now" — plus "the header also takes up so so
much space").

This ticket is the MEASUREMENT pass: what the sheet actually spends its inches
on, and what each candidate fix is worth. No app code changed yet.

## The harness

`preview.html` / `preview.jsx` render the REAL `EstimatePaper`
(src/EstimatePrint.jsx) over a fixture job built through the REAL math
(`jobTotals`), inside App.jsx's exact print wrapper (`.ft-light … p-2`).
`measure.mjs` drives it in Chromium under **print media** at the true printable
box — Letter 816×1056px at 96dpi minus `@page{margin:1.4cm}` = **710 × 950px** —
reports every top-level block's height, then PDFs the page for a real page
count. No Supabase.

The fixture is an N167-scale stand-in — **8 areas, 20 product lines**, most tile
rows carrying grout + mortar chips, two with notes — because this session had no
database access to read N167 itself. Re-point the fixture if the real job's
shape differs materially.

```
npx vite --port 5199
node measure.mjs baseline
node measure.mjs compact --css="$(cat compact.css) @media print{ .break-inside-avoid{break-inside:auto !important} }"
```

`compact.css` is a CSS-only stand-in for a "compact" print density (every rule
maps to an inline style in the cards layout, hence the `!important`) — it exists
to PRICE the idea before anyone writes it into EstimatePrint.jsx.

## Findings

**1. A whole page is lost to page-break orphaning, not to design.**
The fixture's content is **1839px = 1.94 pages**, yet it prints on **3**. Every
area block carries `break-inside-avoid` (EstimatePrint.jsx:280), so an area that
doesn't fit the remaining space jumps whole to the next page and leaves the tail
of the page blank. Relaxing it — or scoping it to small areas only — is
**3 pages → 2, with no visual change whatsoever** (`measure-nobreak.txt`).

**2. The right rail sets row height; the material chips are free.**
Hiding every grout/mortar chip on every row saves **27px total** (1302 → 1275
compact). The chips sit beside a right rail that is already 3 lines tall
(SF ordered · cartons / unit price / line total), so they cost nothing. Any
future win on the product row has to come from the RAIL — aligned qty · price ·
total columns, one line per product — which is a redesign, not a tweak.

**3. A density pass is worth ~29% and stays legible.**
`compact.css` takes the fixture 1839 → **1302px** with body type at ~8pt.
One-page capacity goes from ~3 areas / 5 lines to ~4–5 areas / 9 lines:

| job size | today | compact |
|---|---|---|
| 3 areas (7 lines) | 1 page (891px) | 1 page (709px) |
| 4 areas (8 lines) | **2 pages** (1147px) | **1 page** (869px) |
| 5 areas (10 lines) | 2 pages (1324px) | 2 pages (977px) — 27px over |
| 8 areas (20 lines) | 3 pages (1839px) | 2 pages (1302px) |

**4. Fit-to-page zoom reaches one page, but at unreadable type.**
compact + `zoom:0.72` = **936px = exactly 1 page** for the full 20-line job
(`measure-compact-z0.72.txt`). That puts body copy at ~6pt — fine as an explicit
"squeeze it onto one page" opt-in, not as a default on a customer-facing sheet.
Zoom alone (no density pass) never gets there: 0.65 still leaves 1.26 pages.

**5. Two-column area flow: measured, not worth it.**
Flowing the area blocks down 2 newspaper columns saves only 1839 → **1595px** —
at 355px wide the product cards wrap far more, giving most of the halving back.

**6. The `classic` table layout is not a shortcut.**
Flipping `ESTIMATE_PRINT_LAYOUT` to `"classic"` measures **taller** — 1959px —
because it repeats a column header row inside every area.

**7. The header is ~7.5% of the sheet.**
Masthead 66px + customer/salesperson/project band 71px = **137px**, about 14% of
a single page. `compact.css` only trims it to 124px; a genuine merge (logo +
Rough Estimate badge + N-number + date on one line, and the three-column grid
collapsed to a single line of runs instead of a bold 12.5px name over two 11px
detail lines) should reach ~60–70px. Real, but not where the three pages come
from.

## Artifacts

- `shot-baseline.png` / `shot-compact.png` — the same job, today vs the density
  stand-in (print media)
- `shot-base-a4.png` / `shot-cmp-a4.png` — the 4-area job that crosses from 2
  pages to 1
- `shot-compact-z0.72.png` — the whole 20-line job on one page, at the type size
  that costs
- `shot-classic.png` — the classic table layout for comparison
- `measure-*.txt` — per-block height reports behind every number above
