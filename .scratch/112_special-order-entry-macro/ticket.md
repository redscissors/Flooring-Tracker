Status: in-progress

# Special-order entry macro — paste one line, fill the ERP's fields

The ask (owner, 2026-08-26): paste an entire special-order entry line and have
it land as SKU ⇥ description ⇥ qty ⇥ … across the ERP's fields, instead of
copying field by field out of the order-entry panel.

A web app can only put text on the clipboard — whether one paste jumps across
fields is decided by the ERP's entry screen. Two scenarios:

- **A — the entry screen takes tab-delimited paste** (grid-style): FloorTrack
  alone can do it. Add a combined "Copy entry line" per special-order row
  (every field already exists on `orderEntryRow`), same idiom as the stock
  list's `SKU ⇥ qty` bulk copy and the Schluter popup's `orderCopyLines`.
- **B — a paste lands whole in one field**: the tabbing must be real
  keystrokes, so the copy button pairs with a small AutoHotkey script on the
  order-desk PC (hotkey types each clipboard field, presses Tab between).

## This step

`paste-test.html` — a standalone test bench that settles which scenario the
ERP is. One fake special-order line with editable, reorderable fields joined by
real Tab characters, a Copy button, and options for a trailing Enter / a
two-line grid test. Field config persists in localStorage so the desk can tune
it to the entry screen's order. Open the file in any browser (also published
as a private Claude artifact for the owner).

Result A or B — plus the final field order the desk lands on — is the spec for
the real feature.

## Next

- Owner runs the test at the order desk on a throwaway order.
- A: add the combined copy format to the special-order section of
  `orderentry.jsx` (field order per the test).
- B: same app change, plus ship the `.ahk` helper + setup notes.
