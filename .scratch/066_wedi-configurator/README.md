# wedi shower-system configurator — prototype

**Status:** prototype · 2026-07-29
**Open:** `prototype.html` in a browser (fully standalone, no build — it loads
its two sibling scripts `proto-data.js` + `proto-engine.js`).
**Design record:** `ticket.md` (domain rules, pricing rules, production path).

A configurator for wedi shower systems, deliberately not a Sheoga clone:
wedi has SKUs and published retail (MAP), so nothing is marked up — sell is
book retail, cost is distributor net (≡ the ERP's stocked cost, verified to
the penny), and the one wedi-specific pricing rule is **Builder = retail ×
0.82** instead of the app's flat 8% off.

## The three surfaces

| Tab | What it does |
|---|---|
| **Kits** | Every stocked pan as a card; one click assembles the house kit from shop stock (pan + drain cover + ½" wall panels + curb/curbless waterproofing + fasteners + sealant + collars + trowel), mirroring wedi's own boxed-kit recipe, with a compare chip against wedi's factory kit price. Every line swappable/steppable, add-on chips for niches/seats/benches/gun/recess. |
| **Custom** | Room inputs (pan W×D, curbed/curbless, drain preference, walls + heights) → the solver returns ranked options: exact pan · pan + extensions (corner-extension rule, cut list) · larger pan cut down · linear module + extension (drain at wall). To-scale top-down layout + isometric 3-D view, printable layout sheet. |
| **Browse** | Fast manual builder over the whole catalog (stock ranked first, special order behind), group chips + search + steppers, and a "Figure sealant & fasteners" card using wedi's own consumption numbers (1 screw+washer / ft² panel · 1.2 oz sealant / ft² panel). |

Shared: the build column (grouped lines, tier lens, totals + margin, factory-kit
compare), **Add to product lines** (payload preview incl. the `wedi:{mode,cfg}`
reconfigure marker), **Print layout**, and the SKU-search entry demo showing
the pinned "Vendor configurators" row carrying Sheoga and wedi side by side.

## Data

- `data/wedi-stock.json` — 151 stocked items from `WEDI_1.xlsx` (ERP Vendor
  SKU Analysis): ERP code, description, cost, retail, unit, wedi US-SKU.
- `data/wedi-so.json` — 229 rows + 6 factory-kit content notes from
  `USA_wedi_Distribution_Pricelist_JAN_1_2026.xlsx` ("wedi Fundo" sheet):
  US-SKU, name, size, details, suggested retail, distributor net, section,
  discount band, ERP link when stocked. Cross-check: every linked row's net
  equals the ERP cost exactly (0 drift).
- `proto-data.js` — the same two tables as script-tag consts (generated; a
  pricelist update is a re-generation, see `ticket.md`).
- Consumption/install rules transcribed from the Illustrated Price List 2026
  (pp. 11, 19, 21) and the wedi Technical Handbook (Feb 2025): fastener and
  sealant planning rates, 12"/6" fastener spacing, ½" min panel on 16" o.c.
  studs, extension slope/stack/corner rules, curbless recess options.

## Production path (proposed — see ticket.md for detail)

- `src/wedi.js` — data tables + engine (dependency-free, `node --test`);
  `src/wediquery.js` — the tiny boot-chunk search recognizer;
  `src/WediConfigurator.jsx` — lazy chunk (ADR 0026).
- `product.wedi = { mode, cfg }` on the anchor line (normP pass-through like
  `sheoga`), companion lines `wedi:{part:true}`; "wedi — reconfigure" chip.
- Builder ×0.82 rides `product.tierPrice` (the pre-cut slot from
  docs/pricebook/design.md Q5) + a `wediBuilderPct` knob in `normPricing`;
  `pricing.js` prefers `tierPrice` at its three hook points.
- `WEDI_1.xlsx` dropped into the Price book library is already recognized by
  `detectVendorSkuAnalysis` as a stock book — that alone makes wedi items
  searchable on every row (requirement 1, zero new code).

## Files

- `prototype.html` + `proto-engine.js` + `proto-data.js` — the prototype
- `P1`–`P10` `.png` — preview proof screenshots (`shoot.mjs` retakes them:
  serve the repo root on :5199, `node shoot.mjs`): P1 the 36×60 house kit
  (wall editor + level-course panel plan) · P2 a curbless kit's
  waterproofing lines · P3 the 48×66 solver with both diagrams · P4
  two-side curbless extensions + corner piece on the Builder lens · P5 the
  linear module + extension · P6 Browse (stock tinted green, consumables
  figurer) · P7 the payload modal · P8 the search-entry row · P9 the
  printed layout sheet · P10 the drain pinned 24"/30" off two walls
- Owner feedback round 2026-07-29 (see ticket.md): tube-first sealant,
  editable walls + half wall, drain-position solving with the 6" pan-trim
  allowance, horizontal mixed-size panel courses, cover-finish swatches,
  stock rows tinted
- Owner feedback round 2, 2026-07-29: a wider window with a permanent
  drawings rail on the right — top-down + isometric for whatever shower is
  selected, kits included — with the panel courses drawn as dotted joints
  on the walls (per-wall heights render too); the curbless 620 field seal
  sticks with the stocked sausage even in tube mode
- Owner feedback round 3, 2026-07-29: 96" default walls, kit drawings
  oriented long-side-back so walls and dotted panel joints line up,
  center-click drain targeting (drain at the room centre, pan cut to fit),
  a Left/Right pan anchor that mirrors the layout, and wedi S-Dry Seal
  (+ trowel) replacing 620 as the curbless field seal
- Owner feedback round 4, 2026-07-29: spelled-out cover colors, vertical
  single-sheet panels when they kill the seams (48×84 = four 4×8s), free-
  form walls — + Add wall by clicking an edge on the drawing, removable
  length×height rows, clickable 45° corner cuts — and kit cards showing
  our stock kit cost instead of the boxed-kit price (P11 shows the flow)
- Production build 2026-07-29 (Opus 5 agents): src/wedi.js + wediquery.js
  (engine + boot-chunk recognizer, all assertions ported to node --test),
  pricing/model/orderentry wiring (Builder prefers the tierPrice stamp),
  the wediBuilderPct knob, and src/WediConfigurator.jsx as a React.lazy
  chunk wired like Sheoga (search row, reconfigure chip, restore layer).
  `R1`-`R10` are the change-control preview proof of the REAL React
  component (house kit to the penny vs P1, Builder lens, wall drawing,
  solver, pinned drain, Browse, payload confirm, print, dark mode, 820px)
- Owner feedback round 5, 2026-07-30 (on the production build): wall-length
  edits draw true in both views, corner cuts actually chamfer the pan (open
  corners only — `openCorners`; "Cut open corners" chip; saved in
  cfg.corners), and curbs draw on the open edges (`openEdges`) with the
  curb line following the open length. Plus the owner's two sketches:
  Browse reorganized into the sketched sections + ★ Starred pins + the
  consumables figurer folded into a button; walls at their true 4" depth;
  and the curb turning up a cut corner's 45° diagonal (`curbRuns`) in both
  drawings and in the curb line's length. `W1`–`W6` shots via
  `wedi-preview.html` + `src/wedipreview.jsx` (no-Supabase harness) and
  `shoot-walls.mjs`
- Owner feedback round 6, 2026-07-30: the custom-shower flow and a drawing
  overhaul. Flow: modifying a kit's geometry moves the build to the renamed
  **Custom shower** tab (form seeded from the kit, option cards unselected,
  the modified build kept); a kit card clicked over a custom shower asks
  "Overwrite the custom shower?" and a yes hard-resets everything to the
  chosen stock kit (replaces round 5c's silent walls-survive merge on kit
  clicks; retuneWalls still governs room/option changes inside the solver).
  Drawings: the isometric draws walls as true 4"-thick slabs (top-down
  already did), walls in FRONT (entry + right) draw clear with dashed edges
  so the pan stays visible (their bodies don't take pointer events — only
  the dashed edges); point drains draw square (the 4×4 cover) in both
  views; a cut corner keeps the FULL-SIZE pan with the cut-off triangle
  ghosted to the extension tint behind the rust dashed line. Right-clicking
  a wall in either view opens its menu: length × height plus which faces
  get wedi — Inside (default) / Both sides / In + end (the exposed 4"
  strip) — stored per wall (`faces`, round-tripped through cfg.walls),
  planned via `expandWallFaces` (extra faces appended after the base list
  so plan-detail indexing holds), and marked as moss edges in the top-down.
  `X1`–`X10` shots via `shoot-round6.mjs`
- Owner feedback round 6b, 2026-07-30 (the corner sketch): walls can turn
  into curbs, and curbs fit the walls with NO GAP, figured at the longest
  point. The wall right-click menu gains "Turn into a curb" (wall off /
  removed; the open edge rides the existing curb logic, with the default
  curb restored if the build had none). `curbRuns` now owns the corner
  geometry: a horizontal run reaching an open ring corner extends `CURB_W`
  (3.5") into it so it butts the perpendicular run square (`ext0`/`ext1`
  on each seg); a cut corner's diagonal band gets its ends SQUARED to the
  edges (the sketch) so it butts wall ends and straight runs flush, its
  outer edge (`cut` = hypot(h+w, v+w)) being the longest point; `openLen`
  — what the curb sticks are counted and cut from — sums those longest
  points. Entry wall bands now fill the ring corners they reach in both
  views (a side curb butts them flush), and the isometric curb width
  unified to the same 3.5". `Y1`–`Y3` shots via `shoot-curb.mjs`.
  Follow-up (same day): when a CUT corner carries the curb, the off-cut
  triangle beyond it is outside the shower — cut and HIDDEN (drawn as
  floor) in both views; only a curbless cut keeps the ghosted triangle.
  Owner clarified the rule applies to cut corners only — straight curbs
  stay in the ring as approved. Second pass on owner's screenshots: the
  first cut only tinted the top face — the pan's outline and its isometric
  side faces still poked past the curb. Now the room outline itself
  chamfers at a curbed cut, the off-cut erases completely (wide paper
  stroke swallows the pan's own outline), and the isometric wipes the
  whole 3-D wedge and draws the pan's new CUT FACE under the rust line.
  `Z1`/`Z2` via `shoot-cutcurb.mjs`
- Owner round 7, 2026-07-30 (the 60×110 room + the corner-extension sheet):
  three solver rules. (1) CORNERS ARE NEVER BLANK: the drain-pinned solver
  used to only WARN "mitre two straights" on a corner cell over 12×12 and
  left it unfilled and unfigured — now the straight extension bands run
  THROUGH an oversized corner and mitre at 45°, each stick bought at its
  full longest-point length (≤12×12 still takes the 16½" L corner
  extension). Side effect: full-width pans that eliminate corner cells now
  naturally rank first. (2) The BIGGEST PAN always earns a card (badge
  "Biggest pan") even when its parts run dearer — the seller decides.
  (3) A 2"-deep pan (60×84) pairing with 1 37/64" extensions warns about
  the height step and the kit carries a ½" 4×8 building panel figured by
  extension area — the shop rips it into build-up strips underneath
  (`panThick`, `BUILDUP_SHEET`). `V1`/`V2` via `shoot-bigpan.mjs`
- Mobbin pattern references: [IKEA kitchen planner](https://mobbin.com/screens/46855235-8a29-4755-bf50-a856787778b0),
  [Walmart ingredients list](https://mobbin.com/screens/fd11011b-cfa3-4552-9d6f-caf36a1a2456),
  [Uber Eats item customize](https://mobbin.com/screens/c86d6d66-cc95-4ec3-9889-a0ceadf1eaeb)
