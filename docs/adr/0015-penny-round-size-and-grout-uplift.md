# ADR 0015 — Penny rounds: one "Penny" shape, with a corner-fill grout uplift

- **Status:** Accepted
- **Date:** 2026-07-15
- **Scope:** system-wide (mapped import, tile size cell, grout math)
- **Related:** extends the ticket-009/010 shape-size work and
  [ADR 0014](0014-mosaic-sheet-size-derived-coverage.md) (labeled sheet sizes);
  the grout uplift builds on the volumetric grout model in `catalog.js`.

## Context

Anatolia's penny-round mosaics (`ANASOCCPENNY34`, the `SOHO`/`ELEMENT` families)
import two ways:

- **With a chip size:** `SOHO CEMENT CHIC PENNY ROUND MOSAIC 3/4 INCH GLOSSY`,
  `SOHO CANVAS WHITE 3/4"PENNY RND` — the 3/4" is present, before or after the
  shape word.
- **Without one:** `ELEMENT CLOUD PENNY ROUND MOSAIC` — no printed size at all.

Two problems:

1. **"Penny round" split into the wrong shape word.** The generic shape reader
   saw both "penny" and "round" and, because the number sat next to "round"
   (`ROUND MOSAIC 3/4 INCH`), labeled the size `3/4" Round` instead of
   `3/4" Penny`. A penny is one shape, not a penny plus a round.
2. **Penny rounds were under-grouted.** Grout computes from a square L×W proxy
   (a 3/4" penny → 0.75×0.75). But a circle only covers π/4 ≈ 79% of its
   bounding square, so a real penny sheet leaves grout at the four corners the
   proxy never accounts for — the estimate ordered too little grout.

## Decision

1. **"Penny" is one shape, always labeled `Penny`.** The parser handles a
   description containing "penny" on its own (`PENNY_RE`), before the generic
   size/shape regexes, so "penny round"/"penny rnd"/"penny" never yields the
   standalone shape word "Round". The chip size is read whether it sits right
   before the word (`3/4"Penny`), after it with an inch mark (`Penny Round
   3/4 INCH`), or — for a bare number before the word — as `1 Penny` (ticket
   009). A bare "round" with no "penny" still flows through the generic shape
   path unchanged.
2. **No printed chip size → a "Penny sheet."** When the description names the
   shape but no size, the size reads `Penny sheet` (via `sheetSize = "Penny"`,
   rendered by `stockPatch` like ADR 0014's mosaic sheets) with a blank L×W, so
   the row's existing "＋ add size for grout" box prompts for the penny diameter.
3. **Round chips get a corner-fill grout uplift.** `groutExact` adds a
   `roundGroutExtra` term — `(d²(1−π/4) / (d+J)²) · T`, the corner area a circle
   of diameter *d* leaves in each `(d+J)²` cell, at grout depth *T* — onto the
   square joint volume, for any tile whose size string carries "Penny" or
   "Round" (`isRoundTile`; hexes tile flush and are excluded). For a 3/4" penny
   at a 1/8" joint this is ≈1.47× the square-proxy grout. `getGrout` returns
   `round: true` so the estimate line notes "penny round" next to the quantity.

## Consequences

- The uplift is geometric and self-scaling with chip size and joint, not a flat
  multiplier — and the per-row manual grout override (ADR 0006) still wins when
  a setter wants a specific count. It is a **default that explains itself**, not
  a hidden fudge.
- Grout is computed live (never snapshotted — ADR 0003 covers price, not
  material math), so existing estimates with penny rounds will show the
  corrected, higher grout on reopen. That is the intended fix, not a
  regression: they were under-grouted before.
- Only tiles whose size string says Penny/Round are affected — squares, planks,
  and hexes are untouched. The 26 ANA penny rows land with a `Penny` size and
  the uplift; a book that spells the size differently still flows through the
  same description reader.
- If the team prefers a different penny allowance (e.g. a flat 2×), it is a
  one-line change to `roundGroutExtra` or a future Settings knob; the shape
  detection and plumbing stay as-is.
