# A price book with no markup turns red (2026-07-27)

Status: done

Request (Marcus, 7/27): "If a price book has no markup it should turn red as a
warning."

An order book carries the vendor's **cost**; the selling price is
`cost × (1 + markup)` and the markup lives on the book (ADR 0009). A book
nobody has given a markup therefore sells at cost — every pick from it quotes
the job at zero margin, quietly, on the customer's estimate. Until now the only
sign was a `0` in the markup editor, which is also what a never-opened book
looks like.

## What changed

**`bookNoMarkup(book)`** (`orderbook.js`) — true when an **order** book's config
carries no rate at all: the default, the trim rate, and every per-group override
are absent or zero. Metadata-only by design, because the library board's rows
never load a book's items. Any one nonzero rate clears it — a book that marks up
only its trims has made a decision, and the warning would be wrong. Stock books
price off their own sheet and are never flagged.

**Where the red shows** (all four surfaces name the same helper):

- the board's **vendor book rows** — red row tint (outranking the amber stale
  tint), red book icon and name, and a sub-line that leads with
  "no markup — sells at cost";
- the **In-house column** rows — same tint, a red warning triangle beside the
  amber stale one, and "· no markup" on the kind line;
- the **book page header** — a red `No markup` chip beside the `Stale` chip;
- the **markup editor** — red border, red heading, and a line saying every item
  in the book sells at the vendor's cost. It reads off the editor's *draft*, so
  typing a rate clears the warning on commit and re-raises it if the last rate
  goes back to 0.

The editor's border and ink go red but its surface does not: the panel's own
controls and notes are slate-inked, and the dark theme leaves a `red-50` surface
light while remapping those inks to near-white (the same trap the amber notices
document). The row tints, which restate their ink, do fill.

Tests: `bookNoMarkup` in `orderbook.test.js` — absent/zeroed configs, any single
rate clearing it, stock books and null never flagged.

## Preview proof

`src/preview.jsx` renders the real `VendorBookRow`, `InHouseColumn` and
`MarkupEditor` against fixture books (one marked up, one never given a markup,
one zeroed *and* stale, one stock).

- `preview-1-light.png` — the board and both book pages, light theme
- `preview-2-after-setting-markup.png` — typing 45 into Default % clears the
  panel warning and the header chip live
- `preview-3-dark.png` — dark theme: the red tint stays readable
