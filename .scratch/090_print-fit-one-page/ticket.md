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
The fixture's content is **1861px = 1.96 pages**, yet it prints on **3**. Every
area block carries `break-inside-avoid` (EstimatePrint.jsx:280), so an area that
doesn't fit the remaining space jumps whole to the next page and leaves the tail
of the page blank. Relaxing it — or scoping it to small areas only — is
**3 pages → 2, with no visual change whatsoever** (`measure-nobreak.txt`).

**2. The right rail sets row height; the material chips are free.**
Hiding every grout/mortar chip on every row saves **~27px total** on the whole
compact sheet. The chips sit beside a right rail that is already 3 lines tall
(SF ordered · cartons / unit price / line total), so they cost nothing. Any
future win on the product row has to come from the RAIL — aligned qty · price ·
total columns, one line per product — which is a redesign, not a tweak.

**3. A density pass is worth ~29% and stays legible.**
`compact.css` takes the fixture 1861 → **1324px** with body type at ~8pt.
One-page capacity goes from ~3 areas / 5 lines to ~4–5 areas / 9 lines:

| job size | today | compact |
|---|---|---|
| 3 areas (7 lines) | 1 page (913px) | 1 page (732px) |
| 4 areas (8 lines) | **2 pages** (1169px) | **1 page** (891px) |
| 5 areas (10 lines) | 2 pages (1346px) | 2 pages (999px) — 49px over |
| 8 areas (20 lines) | 3 pages (1861px) | 2 pages (1324px) |

**4. Fit-to-page zoom reaches one page, but at unreadable type.**
compact + `zoom:0.70` = **925px = 1 page** for the full 20-line job
(`measure-compact-z0.70.txt`; 0.72 measures 952px — two points over, second
page). That puts body copy at ~6pt — fine as an explicit
"squeeze it onto one page" opt-in, not as a default on a customer-facing sheet.
Zoom alone (no density pass) never gets there: 0.65 still leaves ~1.3 pages.

**5. Two-column area flow: measured, not worth it.**
Flowing the area blocks down 2 newspaper columns saves only 1861 → **1617px** —
at 355px wide the product cards wrap far more, giving most of the halving back.

**6. The `classic` table layout is not a shortcut.**
Flipping `ESTIMATE_PRINT_LAYOUT` to `"classic"` measures **taller** — 1959px —
because it repeats a column header row inside every area.

**7. The header is ~9% of the sheet.**
Masthead 89px + customer/salesperson/project band 71px = **160px**, about 17% of
a single page. A genuine merge reaches 81–89px — the prototypes below. Real, but
not where the three pages come from.

## Header prototypes (owner ask, 2026-08-15)

`header-proto.html` / `header-proto.jsx` render the CURRENT masthead — the real
`EstimatePaper`, so the reference can't drift — beside three merged variants, all
at 710px through the real print tokens. `header-shot.mjs` shoots both media.

The saving in every variant comes from the same two moves: the **badge's
disclaimer drops out of the badge** onto a 8px line of its own (it is what forces
the badge two lines tall and pushes the title stack down), and the **three-column
customer grid collapses to labelled runs on one wrapping line** (each column is
today a bold 12.5px name over two 11px detail lines — three lines tall for what
reads fine inline). A third saving is content, not layout: on a job whose
project is named after the customer, today's sheet prints that name **three
times** — masthead-adjacent Customer, and Project. The variants print the
Project run only when it differs.

| | height | vs today |
|---|---|---|
| today (masthead 89 + grid 71) | **160px** | — |
| A · one bar (24px mark, one masthead row) | **84px** | −76px |
| B · masthead kept, columns merged (32px mark, two-line title) | **89px** | −71px |
| C · ink band (masthead becomes the sheet's own black band) | **81px** | −79px |
| D · owner sketch 2026-08-16 (B reworked, see below) | **87px** | −73px |

Roughly two product lines (~0.8in). Real, worth taking, and not
where the three pages come from — see finding 1.

**Variant D — the owner's own sketch (2026-08-16), based on B:** waste leaves
the header entirely (the sheet's bottom line already prints "Includes material
waste (tile 10%…)", so nothing is lost); the PROJECT name moves up into the
masthead's right block, left of its N-number; and the line below the rule drops
the CUSTOMER/SALESPERSON eyebrow labels for two tight stacks — customer name
over phone with the address to its right, salesperson name over phone · email
right-aligned. Customer name/phone come from EstimatePaper's existing `people`
lookup — the prototype fakes the record inline.

Owner follow-up (2026-08-16): the badge stays CENTERED — no moving pieces
around to dodge a long name; shrink text if needed, and CAP THE PROJECT NAME at
entry to whatever fits. The prototype centers the badge on a `1fr auto 1fr`
grid (true page center regardless of what flanks it) and narrows it by letting
the disclaimer wrap to two 8px lines, which hands both side columns ~55px.
`header-shot.mjs` then measures the name's budget with real Manrope metrics:

    right column 238px − N-number+date 101px = 137px for the name
    ≈ 16 chars mixed-case (8.18px/ch) · 15 chars ALL-CAPS (8.82px/ch)

**Recommended entry cap: `maxLength={15}`** on the project-name input (covers
the all-caps case; typical one-or-two-word names — "Whole house", "Kitchen",
"Master bath" — fit with room). Pre-existing longer names: render at 10.5px
(~18 chars) before ellipsizing, so old jobs stay printable without edits.

Open question for the owner: C reuses the solid black band the area headers
already wear, which makes the top of the sheet read like the rest of it, but the
Keim mark has to invert to sit on ink (the prototype does it with a CSS
`filter:invert(1)` — a proper knockout asset would be better).

## Artifacts

- `shot-baseline.png` / `shot-compact.png` — the same job, today vs the density
  stand-in (print media)
- `shot-base-a4.png` / `shot-cmp-a4.png` — the 4-area job that crosses from 2
  pages to 1
- `shot-compact-z0.70.png` — the whole 20-line job on one page, at the type size
  that costs
- `shot-classic.png` — the classic table layout for comparison
- `header-today-print.png` and `header-v-{a,b,c}-print.png` — the masthead
  variants (also `-screen` copies, where the sheet keeps its color)
- `measure-*.txt` — per-block height reports behind every number above
