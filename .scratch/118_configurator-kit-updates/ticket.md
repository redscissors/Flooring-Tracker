---
issue_type: Bug
summary: "Updating a placed configurator kit meant building a new one and
  hand-deleting the old, because the basket lane could only append. Plus two
  order-entry faults found alongside: every stocked wedi line filed as SPECIAL
  ORDER, and every special-order Schluter line filed as STOCK."
status: done
labels: [ready-for-human]
---

# Configurator kit updates + the stock/special split (owner 2026-09-01)

Three pieces of work from one owner conversation.

## 1. Order entry: the configurator's verdict decides stock vs special

`isSpecialOrder` was an OR chain in which the weakest rule could win.

A configurator row carries no `bookId`, so the hand-entered-row clause
re-checked its code against the ERP stock cache — and the shop has no wedi
stock book, so **every stocked wedi line flipped to special the moment the
cache came up**. That was the reported symptom. Proven at the module:

```
stocked wedi line (sku 47832) -> special? true    // cache up
same, cache not up             -> special? false  // clause short-circuits
```

The mirror fault turned up in the same pass: there was **no Schluter clause at
all**, so a special-order Schluter line matched nothing and fell through to
"stock". That is the dangerous direction — the desk then keys a stock SKU the
ERP's stock side does not hold, on a promise of stock lead time. Nobody had
reported it.

Both engines emit a shop code only for an item the shop stocks
(`sku: e.stock ? e.erp : ""`), so the SKU on the row already IS the verdict —
on rows saved months ago as much as on new ones. The rule is now three tiers,
most authoritative first: book provenance, the configurator's verdict, then
the hand-entered stock-cache gap.

Considered and rejected: a `stockLine` field stamped onto the product row
(durable, survives the vendor table going stale, allows a per-row override).
It needs a `normP` change and only fixes rows landed after it ships. The SKU
proxy costs one clause and fixes saved quotes too. Revisit at 8a, when stocked
wedi rows gain a `bookId` and move to tier 1 anyway.

## 2. Updating a placed kit

"Add to product lines" already replaced in place (`landKitLines`) — but after
a Reconfigure the button still read "Add to product lines", so nobody trusted
it, and the basket lane genuinely could not update: `addToBasket` stamped a
fresh entry with no memory of where it came from, and Move always appended.

- **Editing mode** is derived in App.jsx from the live row (never a flag to
  keep in sync). Primary button reads "Update this kit"; the payload modal is
  retitled and grows an "Add as a new kit" escape hatch.
- **A staged entry carries an optional `target` `{areaId, rowId, kitId}`**,
  shown in the drawer as an UPDATE chip. `moveKitEntries` (model.js) routes
  targeted entries through `landKitLines` and the rest through
  `appendKitLines`, in one pass so the caller still writes a single patch.
- A **stale target** (row gone, or now another kit's) appends and reports
  rather than clobbering whatever took the row's place.
- Staging a **second edit of the same kit** replaces the first pending entry.

`appendKitLines` moved out of App.jsx into model.js, which owns the landing
rules. `onMoveEntries` now takes entry groups instead of flat lines; the Apps
hub, whose entries never carry a target, flattens them.

Deferred by owner choice: the price-delta confirm before a reconfigure-Add
clobbers hand-edited companion rows (still open from the step-2 review).

## 3. Spec for 8a — wedi's stock side from a price book

`docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`. Design only.
Settles both gating questions against the owner's real workbooks: the existing
`detectVendorSkuAnalysis` recognizer takes `WEDI_1.xlsx` with no new code, and
the wedi US-SKU is recoverable from the Supplier/Mfg columns for all 151
entries. Zero price drift against the transcribed table, so the acceptance
test is exact equality.

## Preview shots

Real popups over the real engines (`wedi-preview.html`, `schluter-preview.html`),
driven end to end:

| shot | what it proves |
|---|---|
| `wedi-1-fresh-add.png` | a fresh build still reads "Add to product lines" |
| `wedi-2-update-button.png` | after Reconfigure the primary reads "Update this kit" |
| `wedi-3-staged-update-chip.png` | the staged entry wears the UPDATE chip |
| `wedi-4-payload-update.png` | payload modal retitled, "Add as a new kit" beside "Update 9 rows" |
| `wedi-5-after-move-one-kit.png` | after moving the update: ONE placed kit, not two |
| `schluter-1..3` | the same three, Schluter side |
| `hub-move-destination.png` | the Apps hub's Move still commits one kit (9 lines) through the flattened groups — the hub has no row context, so its entries never carry a target |

Measured, not eyeballed: the primary button box is 128×44 in both modes, so
the label change shifts no layout. "Placed kits after moving the update: 1"
(2 would mean it had duplicated).

## Verification

- 1211 tests pass, 0 fail (1204 before this work + 7 new)
- build exit 0; lint unchanged at the 7 pre-existing errors on `dd94a23`
- red-green confirmed both ways: reverting the order-entry fix fails exactly
  the 2 new order-entry tests; disabling target routing fails exactly the 2
  that cover it
