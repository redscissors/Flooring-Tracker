---
issue_type: Feature
summary: Grout color dropdowns list only the linked stock book's colors (9
  SpectraLOCK 1 colors). Add a second, order-kind book source per family so a
  vendor price list's unstocked colors are offered as special order.
status: done
labels: [ready-for-human]
---

# Special-order grout colors from a vendor price list

Owner, 2026-09-12: "Right now, the extras only pull from stock books. We only
have 9 colors of the spectralock one grout in stock but would like to add
special order color options as well." Source of the special-order colors: a
Laticrete price list the team can import (owner, 2026-09-13).

## Decisions (owner, 2026-09-13)

- A family gains an optional `order: { bookId, prefix, suffix }` source over an
  order-kind book, the same shape its caulk source takes. Stock colors first;
  the order rule adds only what the stock rule didn't; a stocked color always
  wins over its price-list twin.
- Special-order colors price at the **family's catalog price**, like stocked
  ones — no per-color repricing. The price-list row's cost is reference only.
- The pick stamps `grout.bookId`; the order summary, order sheet and order-entry
  panel file the line as special order.

## What shipped

- `booklink.js`: `normBookFamily` carries `order`; `resolveFamily` appends the
  order book's colors tagged `special` + `bookId` (dedupe by number / name);
  `projectFamilies` carries both; `familyWarnings` watches the stock rule only.
- `stock.js`: `groutFamilies` colors carry `special`; `groutSnapshotPatch`
  stamps `bookId`; `groutColorOptions` groups a dropdown.
- `model.js`: `grout.bookId`. `jobtotals.js`: `gList` carries `bookId` +
  `unitCost`. `orderentry.js`: `isSpecialMat`. `print.js`: `matOrderRow`.
- `usebookstock.js`: family-referenced order books load into `orderBookStock`
  (never `bookStock`); `familyItems` feeds the projection; `loadFamilyBook`.
- `App.jsx` / `mobile.jsx`: grouped color dropdown (`GroutColorOptions`,
  widgets.jsx), "special order" row chip, summary + order-sheet badges,
  order-entry routing; an order-source book re-import refreshes its colors.
- `SettingsWorkspace.jsx`: SO badges in the colors grid; "Add special-order
  colors from a vendor price list…" → `OrderSourceConfirm` (book pick → seed
  row → rule → preview) with Change… / Remove.
- ADR 0027 amendment; data-model skill; src/CLAUDE.md.

## Setup for the live app

1. Settings → Price book → import the Laticrete price list as a special-order
   (order-kind) book.
2. Settings → Materials & add-ons → Grout → SpectraLOCK 1 → "Add special-order
   colors from a vendor price list…" → pick the book, pick any one SpectraLOCK 1
   row, check the preview, Add colors.

## Proof

`1-job-rows.png` — a stocked color and a special-order color on two rows, the
row chip and the summary badge (the console logs the dropdown's "In stock" /
"Special order" groups). `2-order-entry.png` — the special-order color filed
with the special orders. `3-settings-colors.png` — the colors grid with SO
badges and the source line. `4-source-dialog.png` — the source dialog's
preview (25 rows match — 16 special-order, 9 already stocked). Harness:
`npx vite --config .scratch/134_grout-special-order-colors/vite.config.mjs`
then `node .scratch/134_grout-special-order-colors/shot.mjs`.
