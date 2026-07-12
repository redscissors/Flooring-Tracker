# Prototype outcome — area box background tones

**Date:** 2026-07-12
**Branch:** feat/area-box-tones

## Question
What should the area card's interior surfaces be? Started as "all area-box
backgrounds one shade lighter" and evolved, over ten variants, into a full tone
recipe for the band, column header, product rows, chiplet line, money columns,
and adder row — per theme.

## Variants tried (throwaway `proto-area-bg.html`, root, served by dev server)
- A — current (tan `--ft-prod` interior, ink washes)
- B / C — everything lifted one / two shades toward white
- D — product rows on paper (`--ft-card`), Total slightly darker
- E — product rows match the page background (`--ft-cream`)
- F — column header takes the band color (hairline-separated) + E rows + paper adder
- G — F, with the Price *and* Total cells in the band color
- H — G in light; dark rows lifted one tone above the band
- I — G in light; dark band/header drop to page ink, rows take the old band tan
- J — I, but dark rows are ink at 95% (5% white) — **winner**

## Answer: **J**
Light mode (identical to G):
- Band, column-header line, and the Price + Total cells share the band tan
  `#E7E3D6`; band and header separated by a `--ft-border` hairline.
- Product rows + their materials/chiplet line match the page `#F6F3EC`.
- The blank search/adder row is paper `#FFFFFF`.

Dark mode:
- Band, column header, Price + Total cells = page ink `#1C1A17` (the card
  header dissolves into the page; the hairline card border frames it).
- Product rows + materials line = ink at 95% — `color-mix(in oklab, #1C1A17
  95%, white)` ≈ `#272522`, a whisper above the page and almost exactly the
  card surface, so rows and the adder read as one quiet raised surface.

## Implementation notes
- Two new tokens in `src/index.css` (all four theme blocks: root, `.ned-dark`,
  `prefers-color-scheme`, `.ft-light`): `--ft-area-head` (band + header +
  money wash) and `--ft-area-row` (rows + materials box).
- `--ft-band` itself is untouched — it's shared by other header surfaces
  (App.jsx customer header ~1919, summary header ~2444) that weren't reviewed.
- `App.jsx`: `ROW_WASH` → `var(--ft-area-row)`, `TOTAL_WASH` →
  `var(--ft-area-head)`; area band + column header → `var(--ft-area-head)`
  (header gains a top hairline); Price cell wrapper gains `background:
  totalTint`; row shell, handle cell, and confirm-delete strip →
  `var(--ft-area-row)`; blank search/adder row → `var(--ft-card)`.
- Estimate paper is safe: `.ft-light` re-asserts the light values.
- Proof: variants verified with computed-style measurements in the served
  prototype (light J ≡ G exact; dark relationships checked numerically) plus
  screenshots in both themes. Owner should flip light/dark in the running app
  before merge.
- `proto-area-bg.html` deleted after fold-in (this note is the record).
