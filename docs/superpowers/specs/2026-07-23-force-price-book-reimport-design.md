# Force full re-import of a price book sheet — design

**Date:** 2026-07-23
**Status:** approved
**Area:** price book import (ADR 0009 / ADR 0025 / ADR 0027)

## Problem

When a vendor/ERP price sheet is re-dropped and it is byte-for-byte the same as
what the book already holds, the import wizard's diff puts every row in the
`unchanged` bucket, so `importCount === 0`. Two things then make the re-import a
dead end:

1. The Apply button is **disabled** when `importCount + disableSkus.length === 0`
   (`pricebooklib.jsx`).
2. Even if it were clicked, `applyBookImport` **early-returns** on
   `!upserts.length` (`usebooks.js`) — no row writes, no `lastImport` re-stamp,
   no `importFingerprint` re-stamp, no version snapshot.

Because the ADR-0027 linked-catalog / family / link sync (`applyBookImportSynced`
in `App.jsx`) only runs *after* a successful apply, an identical sheet can never
re-fire it. The user needs to force a sheet through — "run it through the phaser
and update everything even if it looks the same" — so the whole downstream
pipeline (row rewrites, staleness date, fingerprint, version snapshot, and the
catalog/family/link sync) re-runs on demand.

This is most acute for **bundles / phasing groups** (ADR 0025): several sheets
that feed one book, reviewed together, where only the last sheet writes. If the
accumulated set matches the book, the whole bundle currently cannot be applied at
all — the user wants it imported "properly and not just partially."

## Approach

Add a **"Force full re-import"** toggle to the import wizard. Off = today's
behavior, unchanged. On = Apply rewrites the entire parsed/accumulated set —
added + changed **and every `unchanged` row** — re-stamps the import date and
fingerprint, writes a version snapshot, and (for stock books) re-runs the
ADR-0027 sync, even when nothing differs. Rows genuinely absent from the sheet(s)
still retire; the ADR-0025 completeness gate still guards against dropping one
sheet of a multi-sheet book.

The mechanism is a single pure diff transform, so the entire existing apply
pipeline runs untouched.

### 1. `forceDiff(diff, existingItems)` — pure helper in `src/orderbook.js`

Placed beside `diffBookItems`; covered in `src/orderbook.test.js`.

```
forceDiff(diff, existingItems):
  bySku = Map(existingItems by sku)
  return {
    added:   diff.added,
    changed: [...diff.changed,
              ...diff.unchanged.map(it => ({ item: it, prev: bySku.get(it.sku), fields: [] }))],
    missing: diff.missing,
    unchanged: [],
  }
```

Recasting `unchanged` → `changed` means `applyBookImport` upserts every row via
its existing `changed` path — which already preserves each row's `disabled` and
`flagReview` from `prev` — then stamps `lastImport` / `importFingerprint` and
snapshots a version (`appliedFromDiff` still yields the complete active set,
since `changed.map(c => c.item)` now carries the forced rows and `unchanged` is
empty). `applyBookImportSynced` then re-fires the sync. **No change is needed to
`applyBookImport`'s core logic or the sync wrapper.**

`prev` is always defined for an `unchanged` item (an item is only `unchanged`
because it matched an existing row), so the preserved-state path is never hit
with an undefined `prev`.

### 2. The toggle — `BookImportWizard` in `src/pricebooklib.jsx`

- New state: `const [force, setForce] = useState(false)`.
- A checkbox — **"Force full re-import — rewrite every row & re-sync"** —
  rendered in the summary row, **only on the writing step** (`lastOfBundle`).
  Earlier bundle steps keep their "Next file…" button and only bank rows, so a
  toggle there would not do anything and must not appear.
- Apply enablement becomes:
  ```
  disabled = lastOfBundle && importCount + disableSkus.length === 0
             && !(force && items.length > 0)
  ```
  A no-op becomes appliable once forced, but only when the sheet actually parsed
  rows (`items.length > 0`) — an empty/mis-parsed sheet can never force a
  mass-retire.
- On Apply:
  ```
  onApply(force ? forceDiff(diff, existingItems) : diff,
          { disableSkus, superseded: appliedSupersede, fingerprint, slot: addSlot, forced: force },
          bundleItems)
  ```
- Apply label when forced: `Force re-import — N rows` where
  `N = added + changed + unchanged`, plus the retiring count when `missing` is
  non-empty.

### 3. Audit stamp — `applyBookImport` in `src/usebooks.js`

When `opts.forced`, set `li.forced = true` on the `lastImport` record so the
book's import history distinguishes a forced pass from an ordinary import. One
line; no other behavior change.

### 4. Docs

Short amendment note to ADR 0025 recording the forced-write escape hatch and its
interaction with the completeness gate.

## Coverage

- **Standalone book import** (book page re-import): `lastOfBundle` is always
  true, so the toggle is always available.
- **Routed multi-file drop**: each book is reviewed on its own; the toggle
  applies per book.
- **Bundle / phasing group** (ADR 0025): the toggle appears on the final sheet
  and forces the whole accumulated set through, not just that sheet's delta.

## Out of scope (YAGNI)

- No per-sheet force on a bundle's earlier (banking) steps — only the last step
  writes.
- No force for the stock-workbook path (`importStockFile` / the App stock
  preview), which is a separate modal. Can be added later if wanted.

## Testing

- `src/orderbook.test.js`: `forceDiff` moves every `unchanged` item into
  `changed` as `{ item, prev, fields: [] }` with `prev` resolved from
  `existingItems`; leaves `added` and `missing` untouched; empties `unchanged`;
  handles an all-unchanged diff and a mixed diff.
- Manual/preview: the toggle renders on a no-op re-import, enables Apply, and the
  label reads "Force re-import — N rows".

## Files touched

| File | Change |
|---|---|
| `src/orderbook.js` | add `forceDiff` |
| `src/orderbook.test.js` | tests for `forceDiff` |
| `src/pricebooklib.jsx` | force state, checkbox, apply enable/label, onApply |
| `src/usebooks.js` | stamp `li.forced` |
| `docs/adr/0025-import-source-provenance.md` | amendment note |
