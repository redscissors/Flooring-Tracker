Status: in progress

Print page prototypes (owner, 2026-09-08): "it needs to feel more like a
selection sheet and less like a quote or an order. Primarily the header — but
what about a watermark of some sort in the body of the paper?" Body content
stays as-is (owner: header and framing only); watermark is a SELECTIONS
wordmark.

## Harness

`proto.html` / `proto.jsx` render the REAL `EstimatePaper`
(src/EstimatePrint.jsx) over the 090 fixture job (8 areas, 20 lines) inside
App.jsx's print wrapper. The real sheet's two header rows are hidden by CSS
(`!important` — they're inline grids) and a prototype masthead sits in their
place, so the body can't drift from production. `?v=today|A|B`,
`?wm=none|outline|fill`. Manrope is served locally from `fonts/` (Google Fonts
doesn't load in the container). `shot.mjs` shoots every combo off
`npx vite --port 5199` (needs the global playwright-core; `PW=` overrides the
path) in screen media and in print media — page 1 and 2 as viewport shots at
page offsets so the `position:fixed` watermark lands where it lands on paper —
and PDFs each for the page count.

## Round 1 — A vs B

- **A — title-led.** "SELECTION SHEET" big at the left, Keim mark small at the
  right with N-number + date, one quiet disclaimer line, then a Prepared for /
  Project / Selections by row ("8 areas selected" under the project name).
- **B — letterhead + stamp.** Keim logo anchors the left, project name large at
  the right, a tilted outlined "SELECTIONS · not an order" stamp in the middle
  (`.ft-pbadge` inks it black in print), For / By two-column people row.
- **Watermark.** Diagonal "SELECTIONS" at 86px/-30° so it fits the 710×950 page
  box; one `position:fixed` copy in print media (repeats on every page) and
  absolute copies per 950px stripe on screen. `outline` = transparent fill with
  a 1.1px 32%-black stroke; `fill` = 6% black. Both print on a mono laser as
  halftone gray — a solid hairline outline would be the crisp alternative.

Header height (top of the first area band): today 108px · A 146px · B 131px.
Every combo still prints on 2 pages (the fixture runs 2 today).

Shots: `A-*`, `B-*`, `today-none-*` — `-screen.png` (on-screen preview),
`-print-p1.png` / `-print-p2.png` (print media).

**Owner picked A** (2026-09-08): "nice, clean, professional, very obvious that
that is what this is." Round 2 expands A into three versions.

## Round 2 — three takes on A (`?v=A1|A2|A3`, shot with `wm=none|outline`)

- **A1 — Compact.** A squeezed toward today's budget: title 24px, disclaimer
  on one line under it, people row two lines a column. Header 117px (today
  108, A 146).
- **A2 — Letter.** Title as A with the project name · N-number · area count as
  its subtitle; the people block is two prose lines ("Prepared for …" /
  "Selections by …") plus the disclaimer. Header 143px.
- **A3 — Band.** Logo and N-number/date above, then the title in a full-width
  `.ft-pband` (moss on screen, black with white type in print, like the area
  bands) with the disclaimer knocked out at its right edge; A's people row
  beneath. Header 140px.

All three print on 2 pages; the outline watermark repeats per page as before.
Shots: `A1-*`, `A2-*`, `A3-*`.

## Round 3 — back to A with the fill watermark (owner, 2026-09-08)

Owner: "go all the way back to A fill; drop the Prepared for / Project /
Selections by; drop the Prepared with ned at the bottom — the customer doesn't
need to see that." Two readings of the first drop, both shot (`wm=fill`, footer
hidden in both):

- **A4** — the small-caps run labels go, the names stay: customer stack left,
  project centered, salesperson right-aligned. Header 134px.
- **A5** — the whole people row goes; the sheet is masthead + areas. Header 80px.

Shots: `A4-fill-*`, `A5-fill-*`.

## Round 4 — the tagline under the title (owner, 2026-09-08)

Owner: "change the print under Selection Sheet to say something like rough
pricing and quantities for planning purposes only." `?tag=b` is that wording
verbatim (now the default); `?tag=c` keeps a "· not an order" tail; `?tag=a`
is the round-1 line. `shot-tag.mjs` shoots A4 + fill with b and c —
`A4-tagb-*` / `A4-tagc-*` (masthead crop + print page 1).

## Round 5 — drop the eyebrow (owner, 2026-09-08)

Owner: "drop the small Keim in the top left — we have the nice Keim logo on
the right." `?eyebrow=none` (now the default) removes the run above the title;
`?eyebrow=ft` keeps just "Flooring & Tile" there; `?eyebrow=keim` is the
round-1 run. `node shot-tag.mjs eyebrow` shoots none and ft —
`A4-eyebrow-none-*` / `A4-eyebrow-ft-*`. Without the eyebrow the masthead
loses ~14px (header ~120px).

Owner (2026-09-08): keep the "Flooring & Tile" eyebrow — `?eyebrow=ft` is
now the default. The standing pick is `?v=A4&wm=fill&tag=b&eyebrow=ft`:
`A4-eyebrow-ft-masthead.png` / `A4-eyebrow-ft-print-p1.png`.
