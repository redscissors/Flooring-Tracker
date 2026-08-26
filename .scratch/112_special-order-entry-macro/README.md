# Setting up the entry macro at the order desk

One-time setup on each PC that keys orders into ERP One (K8):

1. Install **AutoHotkey v2** from <https://www.autohotkey.com> (free; pick v2
   if it asks).
2. Copy `floortrack-entry-macro.ahk` somewhere permanent (e.g. Documents) and
   double-click it. A green **H** appears in the system tray — the macro is
   armed.
3. To arm it automatically at sign-in: press `Win+R`, run `shell:startup`, and
   put a shortcut to the `.ahk` file in that folder.

## Using it

1. In FloorTrack's **Copy for order entry** panel, click the clipboard-list
   button on a special-order line — it copies
   `SKU ⇥ description ⇥ qty ⇥ cost ⇥ sell` with real tabs between fields.
2. In the ERP, click into the **first field** of an empty entry line.
3. Press **Ctrl+Shift+V**. The macro types each field and presses Tab between
   them — an empty field (a by-description line's SKU) is just a Tab, so the
   cursor still lands on the right columns.

If the ERP drops or scrambles characters, open the `.ahk` file in Notepad and
raise the three numbers at the top (`KEY_DELAY`, `FIELD_PAUSE`, `LINE_PAUSE`),
then double-click the file again to reload it.

## Field order

The macro types whatever FloorTrack copied, so the field order lives in ONE
place: `orderEntryLine` in `src/orderentry.js`
(SKU ⇥ description ⇥ qty ⇥ cost ⇥ sell today). If the ERP's entry screen keys
in a different order, or has fields to skip, that array is the only thing to
change.

## Why per-line, not the whole order

The macro is deliberately used one line at a time: the ERP raises prompts
mid-entry (non-stock confirmation, price checks), and a blind multi-line typer
would keep sending Tabs into whatever dialog popped up. One line per press
keeps the salesperson in control between lines. (Multi-line clipboards still
work — each new line is typed after an Enter — but that's for a desk that has
proven their screen never prompts.)

## Why not the ERP's own Paste Special

Ruled out 2026-08-26 off the K8 help page: Paste Special takes exactly two
columns (`product ⇥ quantity`), validates the code against the product file
(unknown codes grey out as "Not found in product file"), and "stub specials"
are explicitly blocked from it. It can't carry a description, cost, or sell —
it stays the right tool for the STOCK list, whose "Copy all" `SKU ⇥ qty`
format matches it exactly.
