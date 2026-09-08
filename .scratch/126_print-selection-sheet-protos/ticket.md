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
