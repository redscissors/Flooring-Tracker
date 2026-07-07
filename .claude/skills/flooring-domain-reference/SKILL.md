---
name: flooring-domain-reference
description: The flooring-trade knowledge pack for FloorTrack — what grout, mortar/thinset, underlayment, waste factor, cartons, and trim/transition profiles ARE and exactly how this app models each of them. Load it when reading or changing anything in src/catalog.js, src/stock.js, or src/pricebook.js and a domain term is unclear; when asked "what is grout/thinset/stairnose/a reducer", "why does joint width change grout quantity", "why did it order 3 bags", "what does CT/SH/EA mean", "what's the difference between measured and ordered sqft", or "which flooring types get an underlayment"; or before writing any estimate/print/material-math code so the numbers mean what a flooring salesperson expects.
---

# Flooring domain reference

The vocabulary and physical reasoning behind FloorTrack's material math, anchored to
where each rule lives in the code. Everything here is verified against the repo as of
2026-07-06 unless explicitly labeled **general trade knowledge, not encoded in the repo**.

Use the glossary's exact terms (`docs/CONTEXT.md`): the per-job line a user adds to an
Area is a **Selection** (never "product" — that word is reserved for catalog
grout/mortar/underlayment entries); a job is a **Customer**; a room is an **Area**.

## 1. How a flooring salesperson works (as the app models it)

1. **Measure** each room → create an **Area** per room ("Master Bath"), type its square
   footage into a Selection's `qty` (with `qtyType: "sqft"`).
2. **Build Selections** per Area: pick a flooring type, size, price — by hand or by
   typing a **SKU** that snapshots a price-book item onto the row (`stockPatch`, `src/stock.js`).
3. **Material add-ons auto-calculate**: on tile Selections, check grout and mortar; on
   any non-misc Selection, optionally an underlayment/backer. Quantities include the
   waste factor and round **up** to whole bags/units/cartons.
4. **Print** one of two layouts (App.jsx `printMode`): the **estimate** (default, also
   Ctrl+P — customer-facing, salesperson header, prices, per-area subtotals, materials
   breakdown) or the **order sheet** (`printMode === "order"` — a checkbox list of
   Item / SKU / Area / Order quantity for the shop, materials aggregated "all areas").

**Measured vs ordered sqft** (App.jsx ~line 941–942): *measured* (`totalSqft`) is the
sum of what was typed into sqft-mode Selections — what the floor actually is. *Ordered*
(`orderedSqft`) is what gets bought: for a carton line it is `ordered cartons × cartonSf`
(always ≥ measured, since cartons round up after waste); for a non-carton line it equals
the typed sqft. **Line totals bill the ordered quantity**, not the measured one
(`printProduct`, App.jsx ~line 216). The un-rounded "exact" value is always displayed
next to the rounded order quantity so the rounding is visible.

## 2. Flooring types as modeled

Selection `type` is one of `["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"]`
(App.jsx line 9, `TYPES`). `FLOOR_TYPES` in `src/catalog.js` is the same list **minus
misc** — it tags which types an underlayment applies to.

| Type | Size fields | Add-ons available | Notes |
|---|---|---|---|
| tile | `L`, `W` in inches; `thickness` decimal inches (default `"0.375"` = 3/8"); grout `joint` decimal inches (default `0.125` = 1/8") | grout, caulk, mortar, backer, carton | The ONLY type with grout/mortar math ("Material math (tile only)", CLAUDE.md) |
| hardwood | `sizeText` free text — the UI labels it **"Width"** (plank width, in) | underlayment, carton | |
| vinyl / laminate / carpet | `sizeText` free text, labeled "Size" | underlayment, carton | |
| misc | none — description in `brandColor` | none | Flat-priced accessory line: total = `priceSqft` (here a flat price) × count; no waste, no carton, no underlayment (`getCarton`/`getUnderlay` return null for misc) |

`qtyType` is `"sqft"` or `"count"`; all material math (grout/mortar/underlay/carton)
runs only in sqft mode. A misc line honors a typed quantity **only** in count mode
(`miscQty`, App.jsx ~line 207) so a stale sqft number can't silently multiply the total.
UI dropdowns: thickness offers 1/8"–3/4" (`THICK`), joint offers 1/16", 1/8", 3/16"
(`JOINTS`) — both stored as decimal-inch strings/numbers.

## 3. Grout — derive it, don't memorize it

**What it is** (general trade knowledge, not encoded in the repo): grout is the
cement- or epoxy-based paste that fills the joints *between* tiles after they're set.
More joint volume per square foot of floor → more grout.

**The derivation** (all in `groutExact`, `src/catalog.js`):

- In a field of L×W-inch tiles, each tile "owns" half of the joint along its perimeter.
  Half-perimeter = `(L+W)` inches of joint line per tile; tile area = `L×W` sq in. So
  **linear inches of joint per square inch of floor** = `(L+W)/(L×W)`.
- Each inch of joint line is a channel with cross-section `thickness × joint` (tile
  thickness deep, joint width wide). So joint volume per sq in of floor:

  ```
  vol = ((L+W)/(L×W)) × thickness × joint
  ```

- Manufacturers publish coverage at a reference tile. The app's baseline is a
  **12×12×3/8" tile with a 1/8" joint**:

  ```
  REF = ((12+12)/(12×12)) × 0.375 × 0.125 = (1/6) × 0.046875 = 0.0078125
  ```

- A grout product's catalog `coverage` (sq ft per bag/unit) is its yield **at that
  baseline**; a different tile scales it inversely with joint volume:

  ```
  coverage_actual = coverage_base × (REF / vol)
  exact = sqft × (1 + tileWaste/100) / coverage_actual
  order = ceil(exact)
  ```

**Worked example** — 300 sq ft of 24×12" plank tile, 3/8" thick, 1/8" joint,
PermaColor Select (seed coverage 110 sq ft/bag at baseline), 10% tile waste:

```
vol      = ((24+12)/(24×12)) × 0.375 × 0.125 = (36/288) × 0.046875 = 0.005859375
REF/vol  = 0.0078125 / 0.005859375 = 4/3 ≈ 1.3333      ← bigger tile, less joint per sqft
coverage = 110 × 4/3 = 146.67 sq ft/bag
exact    = 300 × 1.10 / 146.67 = 2.25 bags
order    = ceil(2.25) = 3 bags                          ← estimate shows "3 bags (2.25)"
```

Guardrails in the code: `groutExact` returns `null` (renders as pending/"—") unless
sqft, L, W, thickness, and joint are ALL non-zero. A `grout.manual` value overrides the
whole calculation (`exact = order = manual`). **Coverage is looked up live by product
name at calc time** — editing a grout's coverage in Settings re-flows every job using it
(ticket 002). **Grout color is the opposite: a frozen label** stored on the Selection;
color palettes are code constants keyed by grout name (`GROUT_COLORS` +
`DEFAULT_COLORS` fallback, App.jsx lines 25–30 — ADR 0002, amended 2026-06-23).

Chemistry context: the seeds name **PermaColor Select** (a cementitious grout) and
**SpectraLOCK** (an epoxy grout) — that cementitious/epoxy distinction is **general
trade knowledge, not encoded in the repo**. What the repo does encode: epoxy-style
products are counted in `"units"` (multi-part kits — the CEG-Lite comment in
`src/catalog.js` says its 187 sq ft is per "Part A+B unit") while cement grouts count in
`"bags"`.

**Matching caulk** rides on the grout row: `grout.caulk` is a hand-typed tube count
(no formula), printed as "<grout> matching caulk" in the grout's color.

## 4. Mortar / thinset

**What it is** (general trade knowledge, not encoded in the repo): mortar ("thinset")
is the adhesive bed troweled onto the substrate that the tile is set into — distinct
from grout, which comes after. Larger tiles need a larger trowel notch (a thicker bed)
to support them, so each bag covers fewer square feet.

**As modeled** (`mortarExact`, `src/catalog.js`): tile-only, sqft-mode-only. Coverage
is tiered by the tile's **longest side** `max(L, W)`:

| Longest side | Tier | ProLite seed | AcrylPro seed | Schluter All Set seed |
|---|---|---|---|---|
| under 8" | `tier1` | 90 | 40 | 95 |
| 8" up to and including 15" | `tier2` | 63 | 15 | 70 |
| over 15" | `tier3` | 45 | 10 | 45 |

(Exact boundaries in code: `longest < 8` → tier1, `longest <= 15` → tier2, else tier3.
Units: bags for ProLite/Schluter All Set, **gallons** for AcrylPro. Seed numbers other
than ProLite are first-pass estimates the team calibrates in Settings — per the comment
in `src/catalog.js`.)

`exact = sqft × (1 + tileWaste/100) / tierCoverage`; `order = ceil`. `mortar.manual`
overrides, same shape as grout. The 24×12 example above: longest side 24 > 15 → tier3;
ProLite: `330 / 45 = 7.33 → 8 bags`.

## 5. Underlayment / backer

**What it is** (general trade knowledge, not encoded in the repo): a layer between
subfloor and flooring — cement backer board or uncoupling membrane under tile; foam,
felt, or moisture barriers under wood/laminate/vinyl.

**As modeled** (`underlayExact`/`getUnderlay`, `src/catalog.js`): a flat area rate —
one unit (roll/sheet/bag) covers `coverage` sq ft, no tile-size volumetrics. Applies to
**every flooring type except misc**; each catalog underlayment carries a `types` array
restricting which types offer it (empty array = all types; `offeredUnderlayments`).
Seed examples: Ditra & HardieBacker → `["tile"]`; Aquabar B → `["hardwood"]`;
FloorMuffler → `["hardwood","laminate"]`. The UI labels the row **"Tile Backer"** on
tile Selections and **"Underlayment"** on everything else (`UNDERLAY_LABEL`, App.jsx).

**Install materials** (`getUnderlayInstall`): a second checkbox (`underlay.install`)
also orders what it takes to put the underlayment itself down, defined per catalog
underlayment in its `install` list:

- `kind: "mortar"` rows link to a catalog **mortar by name** (e.g. Ditra installs with
  Schluter All Set at a flat 50 sq ft/bag under-the-board rate); their quantity merges
  into the job's mortar totals. The job may swap which mortar
  (`underlay.installMortars[defId]`).
- `kind: "custom"` rows are self-contained (e.g. BackerOn screws, 75 sq ft/tub).
- Rows can be opted out per job (`underlay.installSkip[defId]`); items with no coverage
  are skipped; a **manual underlayment total disables install math** entirely (no real
  sqft to scale from — the function requires `qtyType === "sqft"` with a non-zero qty).

## 6. Waste factor

**Why overage exists** (general trade knowledge, not encoded in the repo): cuts at
walls and around fixtures, breakage, defects, and keeping spare pieces from the same
dye lot for future repairs. ~10% is a common default.

**As modeled** (`normWaste`/`wasteFor`, `src/catalog.js`; glossary "Waste factor"):
two rates stored as `waste: { tile, floor }`, both defaulting to 10.

- `wasteFor(p, s)`: a Selection with `type === "tile"` uses the **tile** rate; every
  other flooring type uses the **floor** rate.
- Grout and mortar always bill at the **tile** rate — not by separate rule, but because
  they only ever compute on tile Selections.
- A carton or underlayment line uses **whichever rate matches its own Selection's
  type** (the same `wasteFor` call).
- Misc lines carry **no waste** (their callers exclude them).
- Legacy single `wastePct` records migrate onto both rates.

The printed disclaimer spells the rates out (`wasteNote`, App.jsx): one number when the
rates match, both when they differ.

## 7. Cartons and sheets

Flooring is often sold only in whole cartons (boxes) or sheets — you cannot buy 9.3
cartons. As modeled (`cartonExact`/`getCarton`, `src/catalog.js`):

- `cartonSf` = sq ft one carton/sheet covers, snapshotted from the price book's SF/CT
  column or typed. Applies to any type except misc, sqft mode only.
- `exact = sqft × (1 + waste/100) / cartonSf`; `order = ceil(exact)` — but the code
  rounds away float noise first (`Math.ceil(Math.round(ex * 1e6) / 1e6)`) so 200 sf at
  22 sf/ct with 10% waste is exactly 10 cartons, not 11 (`200 × 1.1 = 220.00000000000003`).
- **Line total = ordered cartons × cartonSf × priceSqft** — you pay for the whole
  carton, not the measured floor.
- `cartonManual` overrides the ordered count, like grout's manual.
- `cartonUnit` defaults `"CT"` (carton); mosaic sheets use `"SH"`.

**Deriving $/sqft from a per-carton price** (`stockPriceSqft`, `src/stock.js`): the
book's SF price wins when present; otherwise `price ÷ sfPerUnit` rounded to 4 decimals —
mosaic sheets (U/M "SH") often list only a sheet price, e.g. $27.99/sheet ÷ 2 sf/sheet
= $13.995/sf.

## 8. Trim / transition vocabulary

The price book never uses the trade word "transition" — it labels transition pieces by
profile. `searchStock` (`src/stock.js`) therefore treats a query word
`transition`/`transitions` as matching this regex (issue 005):

```
/transition|reducer|t-mold|end cap|stairnos|threshold/
```

Profile definitions — **general trade knowledge, not encoded in the repo** (the repo
only carries the labels):

| Profile | In synonym list? | What it is |
|---|---|---|
| Reducer | yes | Ramps from a taller floor down to a lower one (e.g. tile → vinyl) |
| T-Mold(ing) | yes (`t-mold`) | T-shaped strip bridging two floors of equal height at a doorway |
| End cap (square nose) | yes | Finishes a floor edge that stops against something (sliding door, carpet) |
| Stairnose / stairnosing | yes (`stairnos` catches both) | Rounded front edge of a stair tread |
| Threshold | yes | Flat transition sill at a doorway |
| Quarter round | **no** — not in the regex, not in the repo | Convex quarter-circle base molding covering the expansion gap at walls |

The Mann Aduramax sheet carries four companion trim SKUs per flooring row —
Reducer / T-Mold / End Cap / Stairnose (`ADURA_TRIMS`, `src/pricebook.js`) — priced
`EA` with no type (they land as Miscellaneous lines when picked).

## 9. The price book

The shop's hand-maintained `.xlsx` (~700 SKUs — 697 parsed from the real workbook, per
tickets 004/005) imported browser-side in Settings with a mandatory diff preview
(ADR 0003). One sheet per product family, each with its own layout (`src/pricebook.js`):

| Sheet(s) | Layout | Fills type |
|---|---|---|
| Accessories, Hardwood, Wood Vents, Vinyl, Tile, Tile-Mortar | Sectioned tables: title row + header row containing "SKU" + data rows | Hardwood→`hardwood`, Vinyl→`vinyl`, Tile→`tile` (`SHEET_TYPE`); others → misc |
| Mann Aduramax | Fixed columns: one vinyl item + 4 trim SKUs per row | `vinyl` (trims: misc) |
| Grout & Caulk | Color × product matrices — price per column, SKU per cell | misc |
| Tile Seats, Curbs, Trims | Plain `[SKU, …text…, price]` rows + color-coded Schluter matrices | misc |
| Index | skipped | — |

A SKU is 4–8 digits (`SKU_RE = /^\d{4,8}$/`); rows without a SKU-looking cell are never
consumed, so a restructured sheet degrades to visible "missing" counts, not garbage.
Duplicate SKUs across sheets keep the priced occurrence and warn on price disagreement.

**U/M (unit-of-measure) codes the code actually checks** (`stockPatch`, `src/stock.js`):
`"CT"` (carton) and `"SH"` (sheet) — either marks an item as carton goods, snapshotting
`cartonSf`/`cartonUnit` onto the row even when only a per-carton price exists. The
parser itself assigns `"CT"` (Aduramax flooring) and `"EA"` (each — trims, accessories,
grout matrix, Schluter items); other codes pass through from the sheet's `U/M` column
untouched. `EA` items with no flooring type land as **Miscellaneous** lines
(description + flat price).

Picking a SKU **snapshots** the item onto the Selection (type, price, size via
`parseTileSize` "12x24"→L/W, thickness via `parseThickness` '3/8"'→0.375 /
"10MM"→0.3937, carton coverage); nothing reads the stock table at calc time, so
re-imports never change saved estimates — drift shows as a chip ("price book now $X"),
applying it is deliberate (ADR 0003).

## 10. Units glossary

| Unit | Where | Meaning |
|---|---|---|
| sqft / sf | Selection `qty` (sqft mode), all coverage math | square feet |
| `bags` | grout (PermaColor Select, Tec Power Grout), mortar (ProLite, Schluter All Set) | coverage = sq ft per bag (grout: at the 12×12×3/8"/1/8" baseline) |
| `units` | grout (SpectraLOCK 1/PRO, CEG-Lite), generic fallback | sq ft per kit/unit (CEG-Lite: per Part A+B unit) |
| `gallons` | mortar (AcrylPro) | sq ft per gallon per tier |
| `rolls` / `sheets` / `tubs` | underlayments (Ditra rolls, HardieBacker sheets, BackerOn screw tubs) | sq ft per roll/sheet/tub |
| `tubes` | caulk | hand-typed tube count |
| `CT` / `SH` / `EA` | price book U/M | carton / sheet / each |
| inches (decimal) | tile `L`, `W`, `thickness`, grout `joint` | 3/8" stored as `"0.375"`, 1/8" joint as `0.125` |
| % | `waste.tile`, `waste.floor` | percent added to measured sqft before ordering |

All grout/mortar/underlayment coverage numbers and prices are team-editable in
Settings; seed values other than PermaColor Select's grout coverage and CEG-Lite's 187
are first-pass estimates (comments in `src/catalog.js`).

## Provenance and maintenance

Verified 2026-07-06 against branch `claude/compact-product-fields`. Sources: glossary
`docs/CONTEXT.md`; math and seeds `src/catalog.js`; SKU fill/search/drift `src/stock.js`;
workbook layouts `src/pricebook.js`; type list, colors, print layouts `src/App.jsx`
(lines 9–30, 195–265, 941–949, 1479–1521); ADR `docs/adr/0002-shared-grout-mortar-catalog.md`
(color amendment) and 0003; tickets `.scratch/002…/`, `.scratch/004…/`, `.scratch/005…/ticket.md`
(697-item counts, transition synonym rationale). Trade knowledge beyond the repo is
labeled inline.

Re-verify volatile facts:

```
npm test                                              # math still passes (node --test src/*.test.js)
grep -n "REF =" src/catalog.js                        # grout baseline
grep -n "tier1\|longest" src/catalog.js               # mortar tiers + boundaries
grep -n "TRANSITION_RE" src/stock.js                  # transition synonym list
grep -n "cartonUnit" src/stock.js                     # carton U/M snapshot (CT/SH → cartonSf/cartonUnit)
grep -n "const TYPES" src/App.jsx                     # flooring type list
grep -n "GROUT_COLORS" src/App.jsx                    # per-grout color palettes
```

App.jsx line numbers drift as it changes — re-grep the identifier rather than trusting
a stale number.

## When NOT to use this skill

| You actually need | Go to |
|---|---|
| To verify a computed number step-by-step, or prove a formula change is safe | **floortrack-proof-and-analysis-toolkit** |
| Storage, tables, write paths, snapshot-vs-live-link doctrine, RLS | **floortrack-architecture-contract** |
| Editing the catalog/settings themselves (seeds vs live data trap) | **floortrack-config-and-catalog** |
| Making any change at all (PR rules, preview proof) | **floortrack-change-control** |
