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
free so the boot path stays clean); snap = the reconfigure marker, and beside
it a `session` sibling carries the build column's own overrides (wedi:
qtyOv/manual/Fit; Schluter: qtyOv/Fit, its markCfg already holding
manual/pick/source), so a move re-lands exactly what "Add to product lines"
would have landed. Placed kits
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
  The same drive against pre-fix code staged at $1,536. Retaken after the
  Basket-button move, which the pop-head shows: Basket now leads the
  right-hand group (Basket · Clear design · Stock only/Full catalog · tier).
- `wedi-remove-confirm.png` — Remove… armed ("Remove this kit's lines?" +
  Remove/Keep); reshot for the same button move, so its staged 3'x4' entry
  now reads $1,234 against the build column's $1,233.53 (the session carry —
  the pre-Task-7 shot read $1,208).
- `wedi-reconfigured.png` — popup remounted on the placed kit; build column
  filled with its lines, Kits tab row highlighted, drawings redrawn. Also
  reshot; its whole right-hand head group is in frame.
- `schluter-drawer.png` — Schluter's session-carry proof (2026-08-31, the
  half that had none): the 5'x5' KST1525 shelf kit picked off the Kits tab
  (listed there at $1,072.41), the KERDI-DRAIN grate stepped 1 → 3 (rust),
  build column reading LINES 7 / RETAIL $1,178.21, and the staged entry
  reading 7 lines · 60×60" · $1,178 — the stepped total, not the recipe's
  $1,072. Priced through the live-registry catalog (catReady true, no faint
  rows). The drive that produced it also asserted the match.

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
- That live derivation can also DRIFT from the rows it names. On Schluter the
  drawer re-prices a placed kit off the current registry books, so a
  price-book re-import moves the figure while the landed rows keep the price
  they were quoted at; and the wedi placed card re-runs the panel plan under
  the popup's LIVE Fit toggle even though the kit's rows are frozen. The rows
  are the truth in both cases — the drawer number is a recipe price, not a
  total of the lines.
