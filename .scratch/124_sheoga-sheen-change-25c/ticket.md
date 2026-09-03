---
issue_type: Bug
summary: "The Sheoga configurator charged a $250 flat 'non-standard sheen' fee that is on no vendor sheet. The real rule (owner, 2026-09-03): 25¢/sf off the color's standard sheen, on every tab; textured standard is the lower of the color's sheen and 20; custom colors exempt; a stocked sheen change is made to order and also owes the small-order fees."
status: done
labels: [ready-for-human]
---

# $250 sheen fee has no source — replace with the vendor's 25¢/sf rule (owner 2026-09-03)

## Root cause

`SHEEN_FEE = 250` was hard-coded in the original prototype with no citation.
The 1/19/26 Distributor Price List has no sheen-change charge and no $250
figure anywhere; the prototype README's transcription list never mentions it.

## Rule (ADR 0039)

- Every prefinished color has a standard sheen — the sheet's footnote (30
  unless `*` 20 or `**` 5), identical on every species (`COLOR_SHEEN`).
- Textured prefinish: the lower of the color's sheen and the sheet's textured 20.
- Any other sheen: +$0.25/sf (`SHEEN_ADD`), a cost row like texture/finishing,
  on the custom/floor tab (solid + engineered), herringbone, and stocked.
  Natural pays it; T-1/2/3 and a typed-in stain have no standard → free.
- Stocked tab: a sheen change is made to order — plus the $300 / $600
  small-order fees (Natural keeps its exemption), pooled once on a multi-width
  bundle. `calcStocked(k, sf)` now takes the job size.

## Proof

`shoot.mjs` through the issue-023 production harness:

- `P1-stocked-sheen-change.png` — White Oak Cattail char 5¼" at 5-sheen, 300 sf:
  $6.20 + $0.25 = $6.45 cost, $9.03 sell, small-order $300 fee line.
- `P2-floor-freshcut-30.png` — floor tab, Fresh Cut (standard 5) at 30-sheen:
  "Sheen change — 30-sheen (standard 5) +$0.25/sf", picker note + warning.
- `P3-floor-freshcut-5-standard.png` — back at 5-sheen: no row, $8.68 sell.
- `P4-floor-custom-color.png` — T-1: "custom color, no sheen charge".

Tests: `npm test` — 1358 pass (new `standardSheen` / calcFloor / calcStocked /
multiWidthBuild sheen cases; the herringbone sawcut-Cattail case now expects
the 25¢ because a textured standard is 20).
