# 069 — wedi configurator: benches on the top-down layout

Status: done
Shipped: 2026-07-31 — engine (wedi.js benches section + curbRuns/kitFor
integration, wedi.test.js), UI (TopDown zones + drawing, bench menu popover,
"Bench" build group). Follow-up on the same PR: the isometric draws benches
too — wall benches as slabs to their top height (on the pan, or to the floor
when framed, with the pan-cut rust dash across the face), corner benches as
triangular prisms. Still not in v1: premade wall benches don't resize the
zone band drawing to their catalog length until placed.
Opened: 2026-07-31 (owner, spoken spec)
Area: wedi configurator (issue 066)

## The ask (owner, transcribed)

Benches are placed **on the drawing**, not from a parts list. The top-down
layout's pan divides into hover zones: hover along the left wall (on the pan)
and click / right-click to add a bench there; same along the back wall and the
right wall; hover toward a corner (still on the pan) to add a **corner bench**.
Everything — premade vs custom, framed vs built-up, pan handling — lives in
that one menu "so that everything is kinda contained into that space."

### Bench types

1. **Premade wedi benches** — the catalog's bench kits / Sanoasa line for wall
   benches, and the floating triangular corner bench kits (16" / 24") for
   corners.
2. **Site-built (wedi 2" material)** — the pan runs **underneath** the bench.
   Built from 2" building panel: a 2" slab on the top, a 2" slab on the face,
   and 2" supports filling the cavity — one closing each open end and one
   roughly **every foot** along the inside. Joint sealant with all of it.
3. **Framed (builder frames it in)** — the pan butts **against** the bench,
   not under it, and the framing gets **wrapped with ½" panel**. Because the
   pan no longer spans the room, the menu offers the choice: **use a smaller
   pan** or **cut the current pan**.

### Rules

- Default height is **18" to the top** — for the floating corner benches
  always, and for everything else by default (custom dimensions allowed).
- Default seat depth along a wall is **14"** (owner follow-up, 2026-07-31).
- Benches "come all the way out": the bench spans the full pan **and curb**
  depth, so **the curb gets smaller** — it butts the bench's face instead of
  running the full opening.
- **Corner benches are measured from the corner out along each wall** (24"
  means 24" each direction) with a **triangle across the front** — premade and
  custom alike. Corner benches are generally **never framed**.

## Implementation notes

- Engine (`wedi.js`): `normBench`/`benchFootprint`/`benchLines` +
  `benchPremades`; `curbRuns` takes a `benches` arg and subtracts the
  footprints that reach an open edge; `kitFor` takes `opts.benches`, files the
  material under a new "bench" line group, feeds bench surface into the
  sealant/fastener figuring, and carries `cfg.benches` for Reconfigure.
  Framed: `panFit: "cut"` notes the cut on the pan line; `"smaller"` swaps the
  floor line to the best-fitting smaller stock pan when one exists.
- Site-built math (transcription of the spec, tests pin it): top `len×depth`,
  face `len×h`, supports `(depth−2)×(h−2)` each — `floor(len/12)+1` of them
  (ends + every foot); corner: top `a²/2`, face `a√2×h`, supports every foot
  of the face at half-leg representative depth. Sheets fill greedily from the
  stocked 2" panels (4'×8' then 4'×5').
- UI (`WediConfigurator.jsx`): hover zones + right-click menu on the TopDown
  pan, bench drawn in plan (rust dashed pan-cut line when framed), a "Bench"
  group in the build column, kit-dirty arms like add-ons.
