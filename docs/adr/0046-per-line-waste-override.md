# ADR 0046 — A product line can carry its own waste rate; it wins over the job's, even when the job's family is off

- **Status:** Accepted
- **Date:** 2026-09-23
- **Scope:** job math (`src/catalog.js` `wasteFor`/`lineWastePct`/`ownWaste`/`wasteVaries`), the product row (`src/linewaste.jsx`), the estimate's waste wording (`src/model.js` `wasteNote`/`wasteMeta`)
- **Related:** the per-job waste toggles (spec 2026-07-19, `projWaste`); ADR 0043 (underlayment takes no waste); mockup `.scratch/mockups/line-waste-2026-09-23.html`, preview proof `.scratch/mockups/line-waste-proof/`.

## Context

Waste was per job and per family (tile / other flooring): one rate for every
tile line. A job often wants a different overage on one line — a herringbone
or a diagonal lay, a small accent tile, a remnant that needs none — and there
was no way to say so, nor any way to see on a line whether waste was in its
carton count at all.

## Decision

1. **`Product.waste`** — a string, `""` (the default and every existing row)
   follows the job; any number is this line's rate. `"0"` is a deliberate
   *no waste*, not "follow the job".
2. **A line's own rate wins even when the job's family is switched off.** It
   is a decision like a manual carton count, not a cache of the job's rate.
   Underlayment rows still never take waste (ADR 0043), line rate or not;
   misc lines are untouched.
3. **Shown as a second line under the carton count** in the grid's Order
   cell — grey `+10%` when following the job, moss `+15%` when the line has
   its own rate (the color alone tells them apart — the owner dropped a
   "line" suffix the same day), nothing at all when the line orders no waste. An inline
   tag beside the count was rejected: at laptop widths it clipped a 3-digit
   count to its last digits (the mockup's stress test). The tag, and the
   line menu's **Waste…**, open a Job rate / None / Custom popover; the phone
   row sheet carries the same control.
4. **The estimate says when lines differ** — "10% material waste on tile
   (some lines differ)", or "material waste on some lines" when the job has
   none — rather than print a rate per line.

5. **Taking a line to 0% drops a hand-set carton count** (owner, same day):
   None, a Custom 0, or a job rate that is off clears `cartonManual` in the
   same patch (`wastePatch`) so the cartons fall back to the measured
   footage. Adding waste leaves a hand-set count standing behind its
   `qtyDrift` "Use N" chip — the override rule in the root CLAUDE.md is
   otherwise unchanged, and the job header's Tile/Flr toggles never touch
   hand-set counts.

## Consequences

- No SQL: the field lives in the project's jsonb and `normP` defaults it.
- The tag only appears on carton rows, the only rows whose order waste
  changes; a plain sq ft row bills measured footage, and its line rate only
  moves its grout, mortar and add-ons (the popover says so).
