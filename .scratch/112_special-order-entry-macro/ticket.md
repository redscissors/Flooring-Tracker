Status: in-progress

# Special-order entry macro — paste one line, fill the ERP's fields

The ask (owner, 2026-08-26): paste an entire special-order entry line and have
it land as SKU ⇥ description ⇥ qty ⇥ … across the ERP's fields, instead of
copying field by field out of the order-entry panel.

A web app can only put text on the clipboard — whether one paste jumps across
fields is decided by the ERP's entry screen. `paste-test.html` (this dir, also
published as a private Claude artifact) settled it at the desk: **result B** —
ERP One (K8) pastes the whole clipboard into one field.

## K8 Paste Special ruled out (2026-08-26)

Before building the macro, the owner pulled K8's own help for **Lines → Paste
Special** (the feature the desk already uses for stock). It takes exactly two
columns — `product ⇥ quantity` (or reversed) — validated against the product
file: unknown codes grey out "Not found in product file", price-file-only
items land as non-stock, and **"Stub special not allowed"** blocks stub
specials from the path entirely. No description, cost, or sell columns, so a
special order can't ride it. It remains exactly right for the STOCK list,
whose `SKU ⇥ qty` "Copy all" matches its expected format — don't touch that.

## What landed

- **`orderEntryLine`** (orderentry.js): the whole entry line as
  `SKU ⇥ description ⇥ qty ⇥ cost ⇥ sell` — real tabs, bare 2-decimal money,
  an empty SKU slot for by-description lines (Sheoga / SO wedi) so the macro
  tabs straight into the description field. The array in that function IS the
  field order — the one place to change if the desk's screen keys differently.
- **Panel button** (orderentry.jsx): each special row now carries a
  clipboard-list button ahead of the description copy; both latch green
  independently. Footer says what each copies.
- **`floortrack-entry-macro.ahk`** (this dir) + `README.md` setup: AutoHotkey
  v2, Ctrl+Shift+V types the clipboard with real Tab keypresses between
  fields (Enter between lines); three tunable delays at the top. Used one
  line at a time on purpose — ERP prompts mid-entry would eat a blind
  multi-line typer's keystrokes.

Preview proof: `preview-order-entry.png` (+ clipboard contents echoed in
`shoot.mjs` output) off the real harness `order-entry-preview.html`.

## Next

- Owner tests the button + macro at the desk on a throwaway order; field
  order confirmed or adjusted in `orderEntryLine`.
- If the desk wants the macro files somewhere less buried than `.scratch/`,
  promote the `.ahk` + README to `docs/order-desk/`.
