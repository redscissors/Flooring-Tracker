Status: done

Glazzio: lead descriptions with the brand (owner, 2026-08-18): "it would be
nice if Glazzio tile inclued Glazzio in the descritions ... at the start of the
descriptions. Sometimes I want to have the brand included, sometime not. ...
Maybe a box in the price books that we can fill with what we want added. I also
think if space is cramped on a line this gets dropped in the order entry."

Glazzio's sheet carries no brand column, so its picks land bare descriptions.
Items that DO carry a brand (Anatolia via VTC) already lead with it — stock.js
`label()` prepends `item.brand` unless the description says it. This feature is
that same mechanism given a book-level default.

## Design

- **The box** (`book.data.brandLabel`, order books only): a "Brand" folder tab
  on the book page beside Markup/Freight, live summary = the label or "none".
  Saved through `updateBook` dataPatch — plain jsonb, no migration.
- **Pick time** (`withBookBrand` in orderbook.js): `orderPatch` fills
  `item.brand` from the book label when the item has none of its own, then the
  existing `label()` dedupe applies — never doubled when the description
  already names the brand, and a mapped brand column still outranks the box.
  Applied at pick/preview time, never written to items: clearing the box stops
  future picks without a re-import (ADR 0003 snapshot doctrine — saved rows
  never change; re-pick a line to give it the brand).
- **"Sometimes not"**: the row's product text stays an ordinary editable field
  — delete the leading word on any one line. `orderDescription` only treats a
  name that still LEADS with the label as branded.
- **Order entry** (the cramped-line ask): `orderEntryRow` carries
  `brand` (bookId → label map from App.jsx) and `orderDescription` splits a
  leading brand into its own descfit part at rank 3 — the FIRST thing dropped
  when the ERP field runs tight, before coverage and the SKU (the Sheoga
  VENDOR_PREFIX reasoning softened: the PO already names the vendor, so the
  brand identifies nothing — but it's kept while there's room). It sits
  between the size and the product text, exactly where the panel shows it, so
  the paste still matches the screen; the full text with the brand always
  survives into the extended-text copy.
- `bookRowPreview` takes the label too, so the book table's Product/Color
  column shows the landed name (it claims "what a pick LANDS").

## Proof

Harness: `header-preview.html` — LibraryDemo grew a mock Glazzio order book
(3 items, no brand column) and a stateful `updateBook` so the config drawers
save-and-rerender. Screenshots here:

- `02-brand-tab-empty.png` — Brand tab summary "none", box empty, table names
  bare.
- `03-brand-set.png` — "Glazzio" typed: tab summary, worked example off the
  book's own first row ("a pick lands “Glazzio Crystal Series Ice Blue”"),
  every table row's name leading with Glazzio.

The order-entry drop ladder is pinned by unit tests (orderentry.test.js,
print.test.js, orderbook.test.js — 955/955 pass): full rung keeps the brand in
place; one character short and the brand goes first while SKU + coverage
survive; the ext copy keeps everything; a hand-edited name that no longer
leads with the brand passes through untouched.
