# Shower tile sq ft from placed showers — design

**Date:** 2026-09-23 · **Status:** implemented

## Problem

When a wedi or Schluter shower is added to a job, the configurator already
knows the pan size, every wall's length and height, the curb, niches and
benches — it stores them on the kit's anchor row (`product.wedi.cfg` /
the Schluter equivalent, one `kitId` per shower, ADR 0035). But nothing turns
that geometry into tile square footage. The salesperson re-measures by hand
for the wall tile and the floor tile, and when the shower is reconfigured
(60" → 72") the tile rows silently go stale.

Owner's ask: pick the shower's wall or floor sq ft right from a tile row's sq
ft field, cope with more than one shower on a job, allow one tile to cover
several shower surfaces (whole shower in one tile, or floor + curb in one and
walls in another), and let extra non-shower space (hall, mudroom) be added to
the same row.

## Decision

A tile row can carry a **sq ft breakdown** (`p.sfParts`): an ordered list of
shower pieces and named extra spaces whose sum sets the row's `qty`. The list
is edited from a menu on the sq ft field; the row keeps the link, and when a
shower's geometry changes the row shows a drift chip rather than updating
itself.

Chosen from three options presented (A: pick from the sq ft field; B: one
named area per shower; C: keep the row linked with a drift chip): **A + C**.
B (auto-creating an area per shower) is out of scope.

## Shower pieces

Computed from the shower's stored config — never re-entered. All values are
**raw** sq ft (÷ 144 from inches), rounded to 0.1; the row's waste % applies
on top as for every tile row.

| Piece id | Label | Math |
|---|---|---|
| `walls` | Walls (incl. bench faces) | Σ over walls that are on: `len × h` (both faces / exposed end when the wall is set that way); plus Σ over benches: `len × h` (corner bench: diagonal × h; suspended: slab thickness). Niche openings are **not** deducted. |
| `floor` | Floor | the shower's floor as configured — the room `w × d` (the pan in kit mode), less the curb when "max — curb inside" is on, less the benches: a framed bench takes its whole strip (the clear space the configurator's cut or smaller pan/tray fills), a build-up or premade bench on the pan takes its footprint (corner: `size² / 2`), and a suspended bench takes nothing (amended 2026-09-23). |
| `curb` | Curb top + faces | curb run (every open edge the curb runs, as the configurator figures it — not the bought part's length) × (top width + 2 × height). wedi: the engine's `curbWidth` / `curbHeight` (4½" × 5⅛" standard, 2" × 3½" lean). Schluter: 4½" × 6" (schluterdraw). |
| `niche` | Niche back | Σ over niches: interior `W × H` — wedi from the part's "interior" size (4" flange rule fallback), Schluter from the KERDI-BOARD-SN code's mm figures. |
| `benchTop` | Bench top | Σ over benches: `len × depth` (corner: `size² / 2`). |

Worked example — 60×36 curbed, 96" walls on back + both sides, one 12×12
niche, wedi curb cap: walls (60 + 36 + 36) × 96 / 144 = 88.0 · floor 15.0 ·
curb 60 × (4.5 + 2 × 5.125) / 144 = 6.1 · niche 1.0.

- A piece a shower doesn't have (no niche, no bench, curbless) is omitted
  from the menu.
- Each curb profile (wedi full / lean / cap / AT, Schluter curbs) and each
  bench form reads its real dimensions from its part or config. Where a
  dimension can't be derived reliably the piece shows **"enter manually"**
  instead of a number — never a guess.
- One module (`src/showersf.js`) owns the math for both vendors
  (`wediPieces(cfg)`, `schluterPieces(cfg)`, `jobShowers(categories)`),
  reusing the engines' own geometry (curb runs, bench normalizing) so the
  numbers agree with the configurator drawings. It imports the engines, so
  it is lazy-loaded (ADR 0026) — only when a job has a placed shower or a
  row with a breakdown.

## Stored shape

`p.sfParts` — optional array on a product row, absent on every existing row:

```
{ kind: "shower", kitId, piece, where, sf }   // sf = last known value
{ kind: "extra",  label, sf }                  // "Hall", 45
```

- `where` on a shower entry snapshots the area name ("Master Bath") so print
  and the removed-shower chip read without the kit. `kitId` is the kit's
  `kitId`, or `"row:<rowId>"` for a legacy anchor saved without one.
- `normP` normalizes it (drop malformed entries, coerce `sf` to a number,
  empty list → field removed). Load `floortrack-data-model` before
  implementing; document the field there.
- No SQL, no new table — it rides the customer `data` jsonb.

## Sq ft field behavior

- **Opening the menu:** right-click the sq ft input on desktop; on mobile a
  small shower icon beside the field. The icon (and the right-click
  override) appear only when the job has at least one placed wedi/Schluter
  shower (`placedKits`) or the row already has `sfParts`. Otherwise the
  browser's native context menu is untouched.
- **Menu contents:** every placed shower on the job, labelled by area name +
  size + curbed/curbless, each with its pieces as checkboxes and their sq ft;
  then an **Extra space** list (name + sq ft, removable, "+ add"); then the
  row total. Pieces from several showers may be ticked on one row.
- **Ticking / adding** writes `sfParts` and sets `qty` to the sum in one
  `updateCust` patch.
- **Typing in the field** on a row with `sfParts` is an override: the typed
  `qty` stands, and the row shows the drift chip "Pieces add to N — this row
  is set to M · **Use N**" (the existing `qtyDrift` / `QtyDriftChip` shape).
- A small "from shower" tag beside the number marks a row whose sq ft comes
  from a breakdown.

## Drift and removed showers

- On render each shower entry's piece is recomputed from its kit. If the
  recomputed total differs from `qty`, the drift chip shows the new total
  with **Use N**, which refreshes every entry's `sf` and sets `qty`. Nothing
  changes on its own (the override-is-a-decision rule).
- A shower entry whose `kitId` no longer resolves keeps its last `sf` and
  shows "Master Bath shower was removed — 86 sf still counted ·
  **Remove**", which drops those entries and lowers `qty`.
- The link is by `kitId`, so moving a kit between areas keeps it. Duplicating
  a row copies `sfParts` as-is.

## Print

- Estimate print: under the tile line, one muted line listing the entries —
  *Master Bath: walls 72 · niche 1 · Hall 45 · Mudroom 60*.
- CSV was approved too, but the app no longer has a CSV export (only the JSON
  backup, which carries `sfParts` as-is), so there is no CSV column to add.

## Out of scope

- Non-wedi/Schluter or hand-entered showers.
- Auto-creating an area per shower (option B).
- Any change to grout / mortar / add-on math — they already follow `qty`.

## Testing

- Unit tests for `wediPieces` / `schluterPieces` using the worked example, each
  curb profile, benches, multiple niches, curbless, and the "enter
  manually" fallback.
- Unit tests for the breakdown total, the typed-override drift, reconfigure
  drift, and the removed-shower case; `normP` round-trip for old rows.
- Preview proof (screenshots) of the menu, the chip, mobile icon, and the
  print line before merge (non-negotiable 3).
