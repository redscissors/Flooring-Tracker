---
issue_type: Feature
summary: "ADR 0035 step 3: wedi + Schluter get the Sheoga basket panel —
  persisted staged entries (wediBasket/schluterBasket) + the derived
  'In this project' section, both priced live through each engine's own
  buildFromMarker. Reconfigure-current-kit nonce fixed for all three."
status: done
labels: [ready-for-human]
---

# wedi + Schluter basket panels (ADR 0035 step 3)

Staged entries persist per project (normKitBasketEntry, model.js — engine-
free so the boot path stays clean); snap = the reconfigure marker, so a move
re-lands exactly what Reconfigure restores (wedi drops session steppers, the
standing rule; Schluter's markCfg keeps manual/pick/source). Placed kits
derive from anchor markers (placedKits); Remove goes through removeKitLines;
prices are display-only live derivations (step-2 doctrine). The Schluter
drawer waits faint on catReady (ADR 0032). Drawer shell shared in
widgets.jsx (KitBasketPanel). Preview shots in this directory.

Still deferred (from the step-2 final review): refresh mid-bundle-
reconfigure reopens single-width; a drift footnote for re-transcribed
tables; ea-mode placed singles price off the marker qty; the price-delta
confirm before a reconfigure-Add clobbers lines.

## Preview shots

- `wedi-drawer.png` — the session carry (2026-08-31 reshoot): a 3'x6' Offset
  Drain kit with the Building Panel line stepped 4 → 6 (rust) under the Fit
  plan, build column reading LINES 9 / RETAIL $1,859.67, and the staged entry
  beside it reading 9 lines · $1,860 (the drawer rounds to whole dollars).
  The same drive against pre-fix code staged at $1,536.
- `wedi-remove-confirm.png` — Remove… armed ("Remove this kit's lines?" +
  Remove/Keep).
- `wedi-reconfigured.png` — popup remounted on the placed kit; build column
  filled with its lines, Kits tab row highlighted, drawings redrawn.
- `schluter-drawer.png` — staged entry (KERDI-SHOWER-T Tray 48"x60", $826) +
  placed kit (KERDI-SHOWER-T Tray 38"x60", $672 · in Master bath), both
  priced through the live-registry catalog (catReady true, no faint rows).

## Session overrides on a staged entry (owner decision 2026-08-31)

A staged entry now carries a `session` sibling beside its marker —
`{ qtyOv?, manual?, panelFit? }` (Schluter: qtyOv/panelFit only, its markCfg
already holding manual/source/pick) — so the drawer prices the build that was
staged, and Basket → Move lands exactly what "Add to product lines" would
have. Both popups run the build column's own tail over the rebuilt bill
(wedi `applySession`, Schluter `applyQtyOv`), one helper per popup shared by
the build memo and the drawer so the two can't drift.

## Known nits

- A PLACED kit's drawer price is still a marker-only derivation: a kit whose
  rows were landed with stepped quantities or hand-added extras displays its
  RECIPE price in "In this project", not the landed total. Correct by design
  — once landed the ROWS are the truth, and Reconfigure has always dropped
  session state — so it is recorded here rather than fixed.
- The pop-head Basket button renders immediately right of the title
  cluster, not grouped with the right-hand controls (Stock only/Full
  catalog, tier bar, close) — because "Clear design" carries
  `margin-left:auto` and Basket sits before it in DOM order. Visible in
  every drawer shot above. Not fixed here per the task brief — left for the
  owner to judge.
