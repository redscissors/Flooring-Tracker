---
issue_type: Feature
summary: A wedi shower-system configurator — one-click stock kits per pan, a
  custom room solver (walls, pan size, drain placement, extensions), and a fast
  manual builder with sealant/fastener figuring — its own thing beside the
  Sheoga configurator. Prototype first.
status: in progress
labels: [ready-for-agent]
---

# wedi shower-system configurator (prototype)

Requested 2026-07-29 with the shop's wedi stock export (`WEDI_1.xlsx`, the ERP
"Vendor SKU Analysis" for supplier WEDI), wedi's
`USA_wedi_Distribution_Pricelist_JAN_1_2026.xlsx`, and the
`Illustrated_Price_List_2026.pdf`; the wedi Technical Handbook
(wedicorp.com flipbook, Feb 2025) as the install-rules reference:

> "Create a configurator similar to the sheoga configurator, but very much its
> own thing… 1-button clicks to create Kits with our stock wedi for each of the
> pans… a custom configurator that I can put in the wall sizes and pan size and
> drain placement and have it put together a kit using extensions if needed —
> maybe even multiple options… a fast manual option… figure sealant and screws
> and washer… Builder pricing for wedi is .82 versus the normal 8% off… focus
> on the PC version… the custom option had a print option showing the layout,
> maybe even a 3D example — would need to look very good… must not slow down
> the rest of the app… port lines into a project and maybe for those lines to
> be changed in the future… prototype first."

**This folder is the prototype + design record.** Production lands in a later
PR once the shape is approved.

## Why wedi is not Sheoga

Sheoga has no SKUs and no retail sheet — the configurator builds a
*description* and marks up from distributor cost. wedi is the opposite on both
axes: **everything has a part number** (the shop's ERP code for the 151 stocked
items, wedi's US-SKU for the other ~230), and **wedi publishes suggested
retail** (MAP policy) with the shop buying at distributor net — the ERP's
stocked cost matches the 2026 pricelist net to the penny on every linked row
(verified in `data/`). So there is no markup knob here: **sell = book retail**,
cost = ERP/net, and the tiers are lenses over retail like everywhere else —
with one wedi-specific rule, below. What wedi needs instead of a description
builder is a **system solver**: a shower is a pan + extensions + panels + curb
+ drain finish + consumables that all have to agree with each other.

## The three surfaces (one popup, PC-first)

Mobbin pattern references: IKEA kitchen planner (options rail + live canvas +
running total) — mobbin.com/screens/46855235-8a29-4755-bf50-a856787778b0;
Walmart "ingredients you'll need" (recipe → swappable stock lines with qty
steppers + sticky total) — mobbin.com/screens/fd11011b-cfa3-4552-9d6f-caf36a1a2456;
Uber Eats "how it comes" (kit contents as include/customize checkboxes) —
mobbin.com/screens/c86d6d66-cc95-4ec3-9889-a0ceadf1eaeb.

1. **Kits** — every stocked pan (Fundo curbed · curbless · linear · Riolito
   modules) as a card; **one click builds the house kit** from shop stock,
   mirroring wedi's own boxed-kit recipe (base + Click&Seal drain (in the box)
   + drain cover + ½" panels for 3 walls 80" high + curb lean (curbed) /
   Subliner Dry + 620 + corner seals (curbless) + fasteners + sealant + both
   collars + corner putty trowel). Every line swappable/steppable
   (Walmart-style); optional chips for niche, seat/bench, glass shelf, sealant
   gun, recess kit. A compare chip shows wedi's factory-boxed kit price for
   the same size (US2000xxx/US2100xxx NOJS) so the desk can see the stock kit
   beat it.
2. **Custom** — inputs: pan width × depth, curbed/curbless, drain preference
   (center · offset toward entry · linear at wall), which sides are walls,
   wall height (80" default). The solver returns **multiple ranked options**:
   exact pan · nearest pan + extensions (with corner-extension rule and cut
   list) · larger pan cut down (channel re-create note) · linear module +
   extension (drain at wall). Each option carries badges (Cheapest / No
   cutting / Drain at wall / Fewest pieces), a to-scale **top-down layout
   diagram** (pieces, seams, cut lines, drain position) and an **isometric 3-D
   view**, and expands into the same kit panel as tab 1. **Print** produces a
   layout sheet: diagrams + dimensions + the line list with SKUs — good enough
   to hand an installer.
3. **Browse** — the fast manual builder: the whole wedi catalog (stock badged
   and ranked first, special-order behind it) in dense group-chip rows with
   fuzzy search and +/- steppers, plus a **"Figure sealant & fasteners"**
   card that reads the panel square footage already in the build and suggests
   sealant (sausage vs tube) and fastener kits per wedi's own numbers.

Shared right column ("the build"): grouped lines — Floor · Walls · Drain &
finish · Install · Add-ons — with qty steppers, per-line tier price, cost +
margin footer, the tier lens bar, Add to product lines, Print, Copy list.

## The wedi numbers the engine runs on

- **Fasteners:** plan **1 screw + washer per ft² of building panel** (wedi's
  own planning figure, Illustrated PL p.21); spacing rule for the notes:
  one fastener every 12" on wall framing, every 6" on ceilings (Technical
  Handbook). Kits: US5000070 (100 ct tabbed, $32.83/$19.90), US5000086
  (100 ct tabless), master packs US5000009/US5000012 (1000 ct).
- **Sealant:** **1.2 oz per ft² of panel** "covers your needs for shower wall,
  base and curb installation" (Illustrated PL p.19). 10.5 oz tube US5000013,
  20 oz sausage US5000010 (needs the US5000019 gun — chip appears if a sausage
  is in the build with no gun on the job); 620 sausage US5000083 for
  steam/Subliner work, "1.5 linear feet of 2-inch overlap per ounce".
- **Panels:** min **½" on studs 16" o.c.** (2×4 framing); ⅛"/¼" need
  continuous backing (Handbook). Stocked: 3×5×½ (15 sf, $54.66), 4×5×½
  (20 sf, $72.74), 4×8×½ (32 sf, $117.75), plus ¼", 1", 2", Vapor 85.
- **Extensions:** pre-sloped ¼"/ft (2.1%); a straight extension adds 12" or
  24" of sloped depth along one side (24×48 US-073783528, 12×72 US3000036,
  curbless 12×60 US3000035), cuttable in length, stackable in depth; extending
  on **two adjacent sides takes a corner extension** (16½" sq — US3000053
  curbed / US3000052 curbless) or two straights mitred at 45°; bases
  themselves may be cut down with the ½" channel re-created (Illustrated PL
  p.11). Extensions install with wedi Joint Sealant.
- **Curbless:** pan perimeter is ¾" — recess the subfloor, or the bracket
  recess kit US5000085 handles up to 5×5 in ¾" ply, or surface-mount with the
  16×60 ramp 073736517 (ADA slope); curbless kits add Subliner Dry (53 sf roll
  US5000001), 620 sealant, and corner seals US5000007/8 for the field seal.
- **Linear pans:** the 3 stocked 4-sided-slope bases carry a channel (3×5 →
  43", 4×5 → 27½", 4×6 → 43"); Riolito Neo modules 32"/48" stocked (36/42/54
  special order) pair with their extensions for one-way slope to a wall drain.
  Linear covers sold separately, by channel length (27/31/35/43) × finish.
- **Drain covers:** every pan includes the Click & Seal drain assembly; the
  cover is the finish pick — 4×4 in SS $67.30 / tileable ¼ & ⅜ / chrome /
  brass / gold / ORB / matte black / champagne / white (stocked); linear
  covers + frames likewise.

## Pricing rules

- Retail = ERP retail (stock) / wedi suggested retail (special order).
  Cost = ERP cost ≡ distributor net. No markup knob.
- **Builder tier on wedi = retail × 0.82** (owner rule 2026-07-29 — "0.82
  versus the normal 8% off"). Production route: the configurator stamps
  `tierPrice` (= round2(retail × .82)) on every line it emits —
  `product.tierPrice` already exists in `normP` unread, and
  `docs/pricebook/design.md` Q5 reserved it for exactly "Wedi's 0.82 × retail
  with per-item exceptions". `pricing.js` learns to prefer `tierPrice` over
  the flat builderPct at the three hook points (tierView's mapProducts,
  tierUnitPrice, and the popup's own lens); a `wediBuilderPct` knob
  (default 18) lands in `normPricing` beside the Sheoga markups so the stamp
  is tunable. Employee stays cost × 1.06; Sale/custom stay flat off retail.
- Freight: wedi ships F.O.B. Batavia; $500 net minimum order (10% small-order
  handling fee below it) and a $20 flat parcel program for covers/frames/
  shelves — out of scope for v1 (the ADR 0030 freight-program slot fits it
  later); noted in the build footer when the special-order net total runs
  under $500.

## Port-to-project (requirement 12)

Every line lands as a normal product row: stocked lines carry the ERP `sku`
(+ `bookId` once `WEDI_1.xlsx` is dropped into the Price book library as a
stock book — the existing `detectVendorSkuAnalysis` recognizer handles that
file with zero new code, which is also what makes requirement 1 free);
special-order lines go by description with the wedi US-SKU leading it. The
anchor line (the pan) carries `wedi: { mode, cfg }` — exactly the
`product.sheoga` pattern — so a **"wedi — reconfigure"** chip reopens the
popup pre-filled and re-lands the whole kit (later edits to quantities on the
job sheet survive like any snapshot; reconfigure replaces the kit's lines).
Companion lines carry `wedi: { part: true }`.

## Perf (requirement 11)

`WediConfigurator.jsx` is a `React.lazy` chunk (ADR 0026 rule 4) and — unlike
`sheoga.js`, whose tables ride the boot chunk for `queryHit` — the wedi tables
stay **inside the lazy chunk**: the search box imports only a tiny
`wediquery.js` recognizer (hit/parse/summary over ~30 trade words + sizes)
so boot pays a few hundred bytes, not the ~2 000-row catalog. The pinned
"Vendor configurators" row in `GridOmniSearch`/`MobileSearchSheet`
generalizes from the hard-coded Sheoga block to a two-entry descriptor list.

## Files

- `data/wedi-stock.json` — the 151 stocked items (ERP code, desc, cost,
  retail, unit, US-SKU), generated from `WEDI_1.xlsx`.
- `data/wedi-so.json` — 229 pricelist rows + 6 factory-kit content notes
  (US-SKU, name, size, details, retail, distributor net, section, discount
  band, ERP link when stocked), generated from the Jan 1 2026 distribution
  pricelist ("wedi Fundo" sheet).
- `proto-data.js` — the same two tables as consts for the prototype.
- `proto-engine.js` — catalog classification + kit recipes + the room solver
  + consumable figuring + tier lens, pure JS (node-runnable self-test).
- `prototype.html` — the standalone prototype (open in a browser, no build;
  sibling scripts, no CDN beyond the Manrope @import, same as 023).
- `P*.png` — preview screenshots (the change-control preview proof).

## Owner feedback — 2026-07-29, first prototype review

Seven rules from the owner's first pass over the interactive prototype, all
landed in the prototype (engine rules carry self-tests):

1. **Sealant defaults to the 10.5 oz tube**, not the sausage — the sausage
   (and its gun hint) stays one swap away.
2. **Kit walls default to 1 long + 2 short**, editable: each wall has its own
   length and height, a Flip swaps which side is the back.
3. **Half / custom small walls** — per-wall heights cover half walls, and a
   fourth "Half" wall row (off by default) adds a pony wall.
4. **Custom rooms can pin the drain** — two inputs, distance from the left
   and back walls; the solver floats the pan so its drain lands there,
   trimming up to **6" off any pan side** (owner rule) and filling the
   remaining gaps with extensions. The 6" trim allowance also joins the
   ordinary solve as a "Trim to fit" card when it saves pieces.
5. **Panels lay horizontal in level courses, mixed sizes** (`panelPlan`):
   48"-tall courses from 4×8/4×5 sheets, 36"-tall from 3×5, a long course
   prefers one cut-down 4×8 over two butted 4×5s — minimal vertical seams.
   Default "Fit" mode; "One size" keeps the single-SKU area fill.
6. **Drain-cover finishes get color swatches** — the finish codes were too
   hard to tell apart as text.
7. **Stock items read on a light green background**, special order on white.

### Round 2 (same day)

8. **The drawings live on the right side of the window** — a permanent rail
   (top-down over isometric) showing whatever shower is selected, kit cards
   included, with the window widened to fit. The custom tab's inline
   diagrams moved there.
9. **Panel joints draw on the walls** — the Fit plan's level courses and
   butt joints render as dotted lines on the isometric wall planes (each
   wall at its own height) and as ticks on the top-down wall bands.
10. A domain catch from the tube default: the curbless **620 field seal
    stays on the stocked sausage** — the 620 cartridge is special order, and
    stock outranks SO for the same product (mergeSearch doctrine).

### Round 3 (same day)

11. **Default wall height is 96"** (8-ft ceilings), not wedi's 80" boxed-kit
    figure — the factory-kit compare now honestly reads over the box, since
    the box only panels to 80".
12. **The drawings orient like the build**: a kit pan draws with the BACK
    wall as its long side (flip-aware), so the top-down, isometric, wall
    lengths, and panel-course dotted lines all agree. (They previously drew
    the pan portrait while the build called the long side "Back".)
13. **Center-click = drain at the room's centre**: with no drain position
    typed, picking the Center drain preference solves for the drain at
    (w/2, d/2), cutting the pan to fit (the 6" trim allowance) — ranked
    fewest-pieces-first so one cut-down pan beats a patchwork of strips.
14. **Pan against Left / Right** — a new anchor control mirrors the layout
    so extensions can fall on either side; a hand-entered drain position
    wins over the anchor.
15. **The curbless field seal is wedi S-Dry Seal** (US5076011, stocked,
    trowel-applied — its 3/16"×5/32" trowel rides along), replacing the 620
    sealant in the recipe; 620 stays in the catalog for steam work.

### Round 4 (same day)

16. **The prototype is still only a prototype** — confirmed with the owner:
    nothing has landed in `src/`; production is the next PR once the shape
    is approved.
17. **Cover colors spell out** everywhere a cover shows (build line, swap
    list, Browse) beside the swatch — no more guessing codes.
18. **Panels may stand vertical when that kills the seams**: one column,
    one piece only (a 48"-wide wall takes a 4×8 upright, uncut) — so a
    48×84 kit at 96" walls uses exactly four 4×8s: two horizontal on the
    back, one vertical per side (`verticalSheet` in panelPlan).
19. **Walls are free-form**: the fixed Half row became **+ Add wall** —
    click an edge on the top-down drawing to add a wall there (an entry
    wall reads as a return/pony wall), each added wall gets its own
    length × height row and remove button, and it draws in both views and
    joins the panel plan. **Clicking a room corner toggles a 45° corner
    cut**, drawn as a chamfer and noted on the print sheet (drawing/
    annotation only in v1 — the solver still fits rectangles).
20. **Kit cards show our stock kit cost** (the house kit costed at ERP
    cost with the current wall setup) instead of wedi's boxed-kit price;
    the boxed-kit compare chip stays in the build column.

### Round 5 (2026-07-30, on the production build — PR #276)

21. **Wall edits draw true** — a wall's typed length now draws at that length
    in both views (band stops short of the corner, iso plane too) instead of
    the on/off full-span band, so shortening a wall visibly opens its run.
    Both tabs share the same editor; the custom tab verified end to end
    (W3): + Add wall by clicking the drawing, removable rows, live redraw.
22. **Corner cuts are real cuts now**: clicking an open corner (or the new
    "✂ Cut open corners" chip) chamfers the pan in both drawings — cut-off
    triangle cleared, rust dashed diagonal, 45° tag — joins the cut list and
    the print sheet's install notes, and round-trips through `cfg.corners`
    so Reconfigure restores it. A corner boxed in by two walls refuses the
    cut with a toast (`openCorners` in wedi.js); a wall change that boxes a
    cut corner in drops the cut rather than draw through a wall.
23. **Curbs draw where there is no wall** (owner ask): `openEdges` computes
    the open runs of the room's perimeter, the top-down draws a labeled curb
    band and the isometric a raised slab along each, and the curb LINE now
    follows the open length too — one curb cut down when it covers, more
    pieces when walls are toggled off ("132" of open edge — cut to fit").
    Standard 3-wall rooms price exactly as before (open run = entry width).
24. The print sheet unmounts on **afterprint** (2.5 s fallback), not right
    after `window.print()` returns — Safari returns with the dialog still
    up and printed a blank sheet.
25. Preview harness: `wedi-preview.html` + `src/wedipreview.jsx` mount the
    real component with no Supabase (the freight `preview.html` pattern);
    `shoot-walls.mjs` retakes W1–W6.
26. **Browse reorganized to the owner's sketch**: section chips — Pans
    (Standard/Curbless/Linear/S-Dry) · Covers (Square/Linear/Frames) ·
    Add-ons (Curbs/Extensions/Niches/Benches/Building panels) · Misc
    (Sealant/Fasteners/Tapes/Drains/Tools/Collars) — plus Kits and S-Dry as
    quick filters (`BROWSE_SECTIONS` in wedi.js; a test pins that every
    catalog entry has a home). The big "Figure sealant & fasteners" header
    card compacted into a button beside the search box.
27. **Starred items**: a ☆ on every Browse row pins it, the ★ Starred chip
    shows just the pins. Per-device (localStorage `ft-wedi-starred`), like
    the header-layout switch — a personal shortlist, not shared data.
28. **Walls draw at their true 4" depth** in the top-down (owner sketch),
    not a hairline band; thumbnails keep the hairline.
29. **The curb follows a 45° cut** (owner sketch): `curbRuns` trims the
    straight runs 12" short of a cut corner and adds a 12√2 ≈ 17" mitred
    diagonal piece — drawn in both views and counted in the curb line's
    open length, so cutting both entry corners of a 36×60 kit moves the
    default pick up to the 96" lean curb.

## Assumptions to confirm before production

1. Builder ×0.82 applies to **every** wedi line (pans, panels, consumables,
   special order alike) — no per-item exceptions yet.
2. House kits default to 3 walls × 80" high in ½" panel, lean curb, SS 4×4
   cover — matching wedi's boxed recipe — with the S-Dry line kept out of the
   kit/solver tabs for v1 (it's stocked and searchable; own mode later).
3. Extension depth stacking (12" + 24" = 36") is acceptable practice; anything
   past 36" of added depth ranks the cut-down or bigger-pan option first.
4. The Vapor 85 / steam program (620 sealant everywhere, tabless washers,
   patch kit) is a later mode; Browse covers it meanwhile.
5. Wall panel fill is by area with whole sheets (offcuts assumed reusable
   across walls); no seam-layout optimizer in v1 — the layout print shows
   sheet counts per wall, not a cutting diagram.
