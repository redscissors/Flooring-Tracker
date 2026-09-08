Status: prototype — awaiting owner pick

Print sheet as a SELECTION SHEET, not a quote (owner, 2026-09-08): "it needs
to feel more like a selection sheet and less like a quote or an order —
primarily the header — but what about a watermark in the body?" Answers to
the clarifying questions: a couple of options to pick from; the body stays
as-is (header and framing carry the change); the watermark is a "SELECTIONS"
wordmark.

## The harness

`proto.html` / `proto.jsx` render the REAL `EstimatePaper`
(src/EstimatePrint.jsx) over the 090 fixture job (8 areas, 20 lines, built
through the real math), inside App.jsx's `.ft-light … p-2` print wrapper at
the true 710px printable width. The real sheet's two header rows are hidden
by CSS and a prototype masthead sits in their place, so the body under each
variant is the production body and can't drift. Manrope is served from
`fonts/` (Google Fonts doesn't load in the container). No Supabase. No `src/`
changes — throwaway.

```
npx vite --port 5199
node shot.mjs          # PW=<path to playwright-core> if not the global one
```

`?v=today|A|B` picks the masthead, `?wm=none|outline|fill` the watermark.

## Variants

**A — title-led.** The document's NAME is the hero: "SELECTION SHEET" at 28px
across the top with a "Keim · Flooring & Tile" eyebrow; the Keim mark steps
back to the right over N-number + date. The tan Rough Estimate badge is
gone — its disclaimer is one quiet line under the title ("Selections and
planning quantities for this project · not an order · pricing subject to
change on final order"). The people row reads like a letter: PREPARED FOR /
PROJECT (with "8 areas selected") / SELECTIONS BY.

**B — letterhead + stamp.** Keim logo stays the anchor at the left (38px,
"Flooring & Tile" under it); project name set large at the right like a
cover page under a "Selection sheet" eyebrow, N-number + date beneath. The
badge becomes a tilted double-ruled rubber-stamp "SELECTIONS / NOT AN ORDER"
(`.ft-pbadge`, so it inks black in print). People row is a two-column FOR /
BY block; the pricing disclaimer is a faint one-liner under it.

**Watermark (both).** "SELECTIONS" at 86px, rotated −30°, centered in each
page box — `position:fixed` in print media (Chromium repeats it on every
page), absolutely-positioned per 950px stripe in the screen preview. Two
renderings: `outline` (1.1px stroke at 32% ink, no fill) and `fill` (solid
6% ink). It sits at z-index −1 inside the paper's stacking context, so the
black area bands and the Extras box paint over it as they would on paper.

## Measurements (print media, Letter, @page 1.4cm)

| variant | masthead height | pages (8-area fixture) |
|---|---|---|
| today | 108px | 2 |
| A | 146px (+38) | 2 |
| B | 131px (+23) | 2 |

The watermark never changes the page count (fixed positioning takes no
flow space). Both mastheads are taller than today's 090 compact header —
A by about 1.5 product rows, B by about one — a real cost on jobs sitting
just under a page boundary. Either can be tightened when built in.

## Shots

- `today-none-{screen,print-p1,print-p2}.png` — the untouched real sheet.
- `{A,B}-{none,outline,fill}-screen.png` — on-screen Print preview (color).
- `{A,B}-{none,outline,fill}-print-p{1,2}.png` — print media (mono-ink
  remap), pages 1 and 2 as the printer sees them.

## Mono-laser caveat

Both watermark renderings are gray in print media: a mono laser halftones the
outline stroke into a dotted hairline and the 6% fill into sparse speckle
(the same issue 085 fixed for the sheet's labels). If a watermark wins, the
build-in should try a solid-black 0.5px outline stroke (crisp on any printer)
against the gray versions before committing.
