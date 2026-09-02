---
issue_type: Bug
summary: "The wedi price book showed red ('no markup — sells at cost') because bookNoMarkup only checked for a typed rate; wedi's sheet publishes its own retail, so no markup is ever applied and none is missing. bookPublishesPrice reads the saved mapping's price column and clears the flag; the Markup tab explains instead of asking for a number."
status: done
labels: [ready-for-human]
---

# wedi price book shows red for a missing markup that cannot apply (owner 2026-09-02)

## Root cause

`bookNoMarkup` flags any order book whose config carries no rate. wedi is the
one order book whose rows carry a `price` column (published retail, ADR 0038);
`pricedItem` passes a row with its own price straight through, so a markup on
that book is never read. The owner asked to "fill in" the markup; a typed rate
would only have silenced the warning while changing no price.

## What changed

- `bookPublishesPrice(book)` (orderbook.js): true for an order book whose saved
  mapping maps a `price` column. `bookNoMarkup` returns false for it, which
  clears the red on the book page, the vendor board and the In-house list.
- The Markup tab summary reads "none — vendor publishes retail"; the editor body
  is replaced by a note saying no markup applies and why.
- Preview case added to `src/preview.jsx`; screenshots here.

## Not changed

wedi's per-row retail is not hand-editable on the book page (order books edit
cost only). A wrong retail is corrected by re-importing the pricelist.
