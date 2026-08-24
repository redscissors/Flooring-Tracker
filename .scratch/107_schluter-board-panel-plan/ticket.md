Status: done

# Schluter round 7 — the KERDI-BOARD panel plan (inventory E12/F4)

The owner's original board-orientation complaint ("not even basics like
running the board horizontal instead of vertical on the walls made it over")
and the last big MISSING row on the issue-105 ledger: wedi plans its wall
sheets — level courses, mixed sizes, a wall stood vertical where it kills
the seams — while Schluter billed `largest ½" panel × area × 1.05` and drew
fake 48" ticks.

## What landed

- **Classified boards carry their sheet sides** (`bw`/`bl`): boardDims keeps
  the dimension pair it already parsed (text pairs, 3-num thickness rows,
  bare EFT pairs), and the KB code's own mm-dims run fills them in when the
  sheet text is garbled or carries only "= N sf" — the same `mmExactTokens`
  path that already heals sf.
- **`boardPlan` (schluter.js)** — the wedi panelPlan doctrine, generalized
  off the LIVE registry range instead of a transcribed sheet table (ADR
  0032): `boardSheets` derives the ladder (one entry per distinct size,
  stocked-then-cheapest winning duplicates); course stacks cover-or-overshoot
  with fewest courses then least overshoot, taller courses at the bottom;
  each course fills along the run with fewest pieces then least waste,
  longest sheets leading and the last piece cut; a wall goes VERTICAL only
  when one sheet stood on end covers it whole — zero seams — and the
  horizontal plan would have used more than one sheet (the wedi owner rules
  2026-07-29/30). Output is wedi-shaped: `{lines: [{sku, qty}], vSeams,
  courses, detail}` with detail index-aligned to `expandBoardFaces(cfg)` —
  walls-then-xwalls in schluterWalls' exact order, extra faces (both /
  in-end) appended AFTER so the drawn walls still index it.
- **One pool** — `halfBoardPool` now feeds BOTH the Fit planner and the
  One-size area pick, so the two modes can't diverge on what counts as a
  wall panel.
- **`schluterWalls(cfg, plan)`** — with a plan, each drawn wall takes its
  detail's courses: stacked course lines and butt joints in the isometric,
  deduped joint ticks on the plan bands, stood-vertical walls seamless.
  Without one, the old one-course 48" tick pattern stands in; membrane
  walls never carry courses.
- **Fit | One size** on the build column's Walls header (board walls only —
  the wedi seg, same title text). `panelFit` is session-only, default ON,
  absent from the marker and the kit/custom mode test — the plan is the
  default presentation of a kit, not a customization. `applyBoardPlan`
  swaps the by-area panel line for the per-sheet lines IN PLACE (the
  fastener line stays — its count is pure area either way), the first line
  wearing the wedi note ("79 sf — 0 vertical seams · 2 walls stood
  vertical", the rest "panel plan"), and runs in BOTH the build memo
  (before qtyOv, so steppers work against plan quantities) and kitTotals —
  the Kits-tab row price matches the build column in both modes. Compare
  stays unplanned on both sides (wedi's own compare column never applies
  its Fit either) so the pinned comparekit totals hold.

## Proof

`shoot.mjs` (vite on :5199 + schluter-preview.html):
- `p1-fit-plan-default.png` — board 60×38 kit: Walls carry the PLAN lines
  (2× 48×64 courses on the back + 2× 48×96 stood vertical on the sides,
  "79 sf — 0 vertical seams · 2 walls stood vertical"), the Fit | One size
  seg, kit row $945.74 == build total $945.74
- `p2-one-size-by-area.png` — One size: the single by-area line (3× 48×96,
  "79 sf of wall"), kit row repriced to $908.52 == build total
- `p3-mixed-sheets-130.png` — 130"-wide room: each back course = one 96 +
  one 64 cut to 34 ("120 sf — 2 vertical seams · 2 walls stood vertical"),
  butt joints drawn on the back face in the isometric

Tests: 1119 pass (new: bw/bl from text and code, the fixture ladder,
default-room plan pinned — back courses + vertical sides + zero seams —
mixed-sheet 130" fill, the one-sheet vertical refusal, expandBoardFaces
order). `npm run build` clean.
