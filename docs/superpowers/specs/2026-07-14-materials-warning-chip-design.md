# Materials-not-calculating warning chip — design

**Date:** 2026-07-14 · **Status:** approved by owner (this conversation)

## Problem

A product row's checked materials can silently fail to compute. Today:

- Grout checked but uncomputable still shows in the collapsed materials strip,
  but with no quantity — easy to miss (`printProduct` pushes it with
  `order: 0`, App.jsx ~340).
- Mortar and underlayment checked but uncomputable **vanish** from the strip
  entirely (`printProduct` only pushes them when computed, App.jsx ~344–345).
- The explanatory amber hints ("Enter Sq Ft + tile L/W/thickness to
  calculate…") exist only *inside* the expanded materials drawer.

So a mosaic with no chip dims, or a tile missing L/W/thickness, quietly drops
its grout/mortar off the estimate unless the salesperson opens the drawer.

## Decision (owner)

- **Trigger:** any checked material that can't compute — grout, mortar,
  underlayment (each: checked, no manual total typed, getter returns nothing),
  plus install materials when included but uncomputable.
- **Suppression:** no chips while the row's Sq Ft is empty (`qtyType "sqft"`
  and no qty). Every fresh row starts that way and the SF cell's existing
  amber ring already owns that case. The chip therefore always means "you have
  SF, but this material still can't calculate" (dims / thickness / coverage).
- **Placement:** inside the collapsed materials strip (the click-to-edit
  summary under the row). Each failing material renders as its own orange
  segment: `⚠ Mortar — not calculating`. When *nothing* on the row computes
  (today the strip may not render at all), the strip renders with just the
  warnings.
- **Click:** whole strip opens the materials drawer (existing behavior), where
  the per-material amber hints explain what to enter. The chip adds no click
  handler of its own.
- **Color: orange, deliberately distinct** from the amber used by price-drift
  / freight / stale-book notices. Amber = "worth a look"; orange = "this row's
  estimate is missing materials."
- **Screen-only:** no print, CSV, or estimate-total changes (`ft-noprint`).
  The print keeps its existing behavior (grout prints unquantified; mortar /
  underlay absent).

## Implementation shape

1. **`materialWarnings(p, settings)` in src/catalog.js** — pure helper next to
   `getGrout`/`getMortar`/`getUnderlay`/`getUnderlayInstall`. Returns an array
   of labels (e.g. `["Grout", "Mortar"]`), empty when the row is fine or SF is
   missing. Logic per material, all requiring "no manual override typed":
   - Grout: `p.type === "tile" && p.grout.checked && !getGrout(p, s)`.
   - Mortar: `p.type === "tile" && p.mortar.checked && (!M || M.order <= 0)`
     (`getMortar` returns `order 0`, not null, in some uncomputable cases).
   - Underlayment: `p.underlay.checked && (!U || !U.product || U.order <= 0)`;
     label via `underlayLabel(p.type)`.
   - Install materials: underlay computed + `p.underlay.install` + the catalog
     defines install items for it, but `getUnderlayInstall` yields none
     (mirrors the existing drawer hint, App.jsx ~2849).
   - Misc rows never warn (no materials).
2. **App.jsx collapsed strip** (~2868): render one orange segment per warning
   inside the existing strip button; render the strip when
   `pInline.length === 0` but warnings exist. Orange styling consistent in
   light and `.ned-dark` (check both at preview time).
3. **Tests** — `materialWarnings` unit tests in src/catalog.test.js (TDD):
   computes → `[]`; mosaic no-dims → `["Grout", "Mortar"]`; manual override
   silences; SF-missing suppresses; underlay coverage missing; install-items
   case; misc → `[]`.
4. **Proof** — preview screenshots (computing / one failing / all failing,
   light + dark) before merge, per change-control.

## Out of scope

- Print/CSV/order-summary changes.
- Flagging the missing-SF state itself (owned by the SF cell's amber ring).
- Any change to how materials compute.
