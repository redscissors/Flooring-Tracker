# 073 — Order entry: freight as one line, tighter sizes, the unit tag back in the paste

Status: done
Opened: 2026-08-01 (owner)
Area: order-entry panel (ADR 0030 freight, descfit)

## The ask (owner)

> Freight when in order entry should show as 1 quanity and a combined total

> also the size can be tighter in order entry as well. when pasted it reads
> 2" x 18" when it could drop the spacing 2"x18"

> Also at one point I thought the CT also Pasted in front of the desription but
> now it does not seem too. Could you check into that

## What shipped

### 1. Freight keys as one line per vendor, 1 EA at the combined total

`freightOrderRows` (one row per freight *part*) became **`freightOrderRow`** —
one row per book. The parts still break out everywhere the customer reads the
number (the estimate's freight group, the row chip, the materials drawer);
the ERP is the other way round. The desk keys shipping as one charge, and a
book billing two or three tables was producing three lines whose quantities —
pallets, feet, pieces — all meant different things and none of which was what
the vendor invoices.

So the parts collapse into the total and the line is **1 EA at the book's whole
charge**. Still combined per BOOK, not across books: two vendors with freight
are two orders on two POs, and one merged line couldn't be keyed against either.

Glazzio example: was 3 lines (`2 PLT @ $79`, `84 SF @ $0.99`, `24 PC @ $0.33`),
now 1 line — `Freight — Glazzio · 1 EA · $256.01`.

The line is **the vendor and nothing else** (owner, 2026-08-01) — no
destination, no pallet/footage readout. Those justify the price to a customer
on the estimate; on a PO that already names the vendor and ships to one
address, they're characters the desk reads past. It also means the description
sits on the clean "full" rung: no chip, no `+`, no Ext.

### 2. The size is one token

`tightSize` (orderentry.js) — `12" × 24"` → `12"x24"`, `2 x 10 x 5/8` →
`2x10x5/8`. Only collapsed **between digits**, so a "Hex Tile" keeps its
spaces. Applied at the source (`orderEntryRow`'s `sizePlain`), so the panel
shows exactly what pastes, and `nameBudget` counts the shorter string.

Worth three characters of a 30-character field, and it drops the `×` for an
ASCII `x` on the way — not every ERP field takes the multiplication sign.

### 3. The CT tag is back in front of the description

The owner's memory was right. Two comments still claimed the copy carried the
tag (`print.js` "also in the copied text", `orderentry.jsx` "tag included"),
but `orderCopyText` returns `desc.main` and `orderDescription` never put the
tag in it — it was lost when the copy became "the description field's contents
and nothing else". The tag isn't one of the fields that rule was about: the
ERP has no unit field, it keys every line as *each*, so a carton line whose own
text doesn't say **CT** is an order for 44 tiles instead of 44 cartons.

The tag now leads the description as a **rank-0 part** — never dropped, two
characters — so the flow is `unit · size · product · SKU · coverage`, and what
pastes is what the panel shows in front of the item. Stale comments fixed.

## Proof

`preview-order-entry.png` — the real panel over the real freight math
(`preview.html#order`, the ADR 0030 harness). Shows the one 1-EA freight line
at $256.01, the tightened sizes, and the CT-led description chip.

887 tests pass (`npm test`), including new coverage in `orderentry.test.js`
(tag never drops at any limit; `tightSize` cases) and `freight.test.js`
(three tables → one line at `freightTotal`).
