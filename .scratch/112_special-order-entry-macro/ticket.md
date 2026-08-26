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

## Desk spec (owner, 2026-08-26) — SAVED, not yet built

Two corrections to the first-cut entry line, parked here on the owner's
"just save this for now":

1. **The first slot is the shop's ORDER CODE, not the manufacturer SKU.**
   The desk keys specials under the shop's own special product codes that say
   WHERE to order from — e.g. `29sheogaw` for Sheoga — not the vendor's SKU.
   Owner's idea: a **"Code" box on each price book** (and something equivalent
   for the configurator vendors, which have no book row — Sheoga's code is the
   `29sheogaw` example) so `orderEntryLine` can lead with it. The manufacturer
   SKU presumably still belongs in the description (it already rides there via
   the descfit flow).

2. **The real keying sequence**, as dictated:
   `code ⇥ description ⇥ qty ⇥ cost ⇥⇥⇥⇥⇥ sell ⇥ Discounts(Builder, Sale,
   Etc) ⇥⇥⇥⇥ Enter ⇥` — then the cursor sits on a new row. So: 5 tabs from
   cost to sell (4 skipped fields), 1 tab from sell to the Discounts field,
   4 tabs after Discounts, and the row transition is **Enter then Tab**, not
   a bare Enter.

3. **Timing** (owner, same day): after keying **qty**, wait about half a
   second — the ERP takes a moment to open its **price box**, and the price
   fields (cost onward) won't accept keystrokes until it's up. A flat
   per-field delay doesn't cover it; the macro needs a longer pause at that
   one spot.

Implementation notes for when this gets built:
- Skipped fields encode as EMPTY slots in the copied line — the macro already
  sends a bare Tab for an empty field, so `orderEntryLine` just grows empty
  entries; the `.ahk` needs one change: the line separator becomes
  `{Enter}{Tab}` instead of `{Enter}`.
- The `.ahk` grows a per-position pause: after field 3 (qty), Sleep ~600ms
  (tunable `PRICE_BOX_PAUSE`) before tabbing on into the price box — the
  owner's half-second plus margin, since typing into a not-yet-open dialog
  silently drops the keystrokes.
- The Discounts field takes the **% off** as a number (owner 2026-08-26) —
  not a tier word. FloorTrack can derive it from the project's price tier:
  the line's percent off retail ((retail − tierSell) / retail × 100), blank
  (an empty slot, just a Tab) on the Retail tier. Confirm at build time
  whether the desk keys it bare ("18") or with a sign ("18%"), and whole
  numbers vs decimals.
- The "Code" box is a stored-shape change (book `data`, maybe settings for
  Sheoga/wedi/Schluter) — load the `floortrack-data-model` skill before
  building it.

## Next

- Confirm the Discounts-field vocabulary and where each vendor's order code
  lives (per-book Code box + per-configurator settings entry).
- Rework `orderEntryLine` to the desk spec above (code lead, skip slots),
  update the `.ahk` row transition to Enter+Tab, re-shoot preview proof.
- If the desk wants the macro files somewhere less buried than `.scratch/`,
  promote the `.ahk` + README to `docs/order-desk/`.
