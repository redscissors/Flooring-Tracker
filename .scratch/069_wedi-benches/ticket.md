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

- Owner follow-up (2026-07-30, spoken): the custom solver's size field is the
  SHOWER size, not the pan ("Shower size — width × depth") — a bench never
  shrinks the room, walls still figure the full space. And framed + "smaller"
  doesn't just grab the largest pan that fits: `benchPanPlan` re-solves the
  clear space (shower minus bench) with the drain pinned at its center; the
  drawings shift the solved layout past the bench and drop the bench-face cut
  dash (the sub-pan's own trim dashes instead). Plain `smallerPanFor` swap
  stays as the no-solve fallback.
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

## Follow-up (2026-07-31, owner): suspended premades

US3000001/US3000002 (the corner seats) and US3000000 (Sanoasa Bench 4) are
SUSPENDED pieces — wall-hung, no body to the floor. Their pricelist details
now read "Suspended Corner Seat" / "Suspended Bench" and the bench menu
surfaces the details' first sentence on every premade row. `dims()` drops
digit-free parentheticals so "(wall sides)" stops hiding the seats' 4"
thickness; the corner seats join `benchPremades("corner")`. `normBench`
marks them `suspended` with `thick` (4" seats, 3 1/8" bench), keeps the
18"-to-the-top default, `benchEdgeSpans` leaves the curb whole under them,
and the isometric draws only the slab — bottom at top-minus-thickness,
floor clear beneath. The corner-kit premades also stopped inheriting the
sheet's 20" third figure as height once it parsed: corner premades always
top at 18" (the owner's floating-bench rule, now explicit in the code).

## Follow-up (2026-07-31, owner): the shower completes first

Revision of the original "the curb gets smaller" rule: **the shower is
always completed and then the bench built on it.** A 2" build-up bench (and
a premade) sits ON the finished pan and curb — the curb runs across beneath
it, full length, and `curbRuns`/`benchEdgeSpans` no longer subtract its
footprint. Only the installer-FRAMED bench interrupts the envelope (that
rendering was confirmed correct): the pan and curb still butt its face and
its footprint still leaves the open-edge runs. Drawings follow: the curb
draws across under a build-up/premade bench, the bench resting on top;
plus iso cleanup of the framed bench's cut-line height and wall junction.

## Follow-up (2026-07-31, owner): framed + smaller pan leaves the kit

A Kits-tab build moves to the **Custom shower** tab when — and only when — a
framed bench's "Smaller pan" choice actually **resolves** to a different pan
than the kit's (the `benchPanPlan` re-solve, or the plain `smallerPanFor`
fallback swap). Once the pan is swapped the build is no longer that kit plus
add-ons, so it moves like a geometry change does: the custom form seeds from
the kit, the option cards land unselected, the build column keeps everything,
the kit cards' overwrite confirm stays armed, and the move is one-way. Every
other bench remains a kit add-on and does NOT move the tab — 2" build-up,
premade, suspended, and framed with "Cut it down" — as does a "Smaller pan"
with nothing smaller to swap to (the menu's "no smaller pan fits" case).
Detected in `WediConfigurator.jsx` off the floor pan the build actually
figured, not off the choice.
