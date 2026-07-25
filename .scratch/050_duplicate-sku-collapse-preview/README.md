# One row per product when two order books carry it (2026-07-25)

Status: done

Request:

> "with all these price books that we're importing, sometimes some of the
> special order books sometimes can carry the exact same SKU in multiple books,
> doubling the search results for that product. Would we have a solution that
> would only show one of something if it is a copy?"

## The problem

`mergeSearch` (`src/orderbook.js`) already collapsed an exact-SKU collision —
but only between the **stock** tier and the special-order tier: the order twin
was dropped, the surviving stock row tagged `alsoOn`, and `Hit` rendered the
grey "also on {book}" note. Two *order* books never hit that map, so both rows
survived. With several vendor books carrying the same brand — one product
distributed by two suppliers, or a brand's own sheet imported beside a
distributor's — the picker showed one product once per book, eating the 30-row
`SKU_SHOW` cap and leaving the salesperson comparing rows by hand mid-quote.

## The rule (owner's calls, 7/25)

- **Which copy shows:** the cheapest, and the row says so when the spread is
  real (`PRICE_GAP_PCT` = 5% — "also on Virginia Tile — $9.85/sf there", amber).
  A collapse never quietly hides that one supplier is meaningfully dearer.
- **What counts as a copy:** SKU match **plus** description corroboration —
  token overlap against the shorter description ≥ `COPY_OVERLAP` (0.6). Vendor
  SKUs share no namespace, so two books can both list a "1234" for unrelated
  goods; those stay as two rows. No description on either side → no collapse.

Recorded as an amendment to ADR 0009 (decision item 6 / design.md §6.3, which
had deliberately stopped at SKU equality). Display-only, per ADR 0003: the
collapse decides which row is *offered*, never what a pick snapshots.

## Proof

`collapse.png` — the harness (`preview.html` + `preview.jsx`, served by
`npm run dev`) renders the REAL `Hit` row over the REAL `collapseCopies` output,
before vs after, light and dark:

1. same product both books, real price gap → 1 row, amber note
2. same product, cents apart → 1 row, plain grey note
3. same SKU, different products → both rows stay
4. three books, one product → 1 row, both dropped books named

`npm test` 734 pass / 0 fail (7 new in `orderbook.test.js`); `npm run build`
clean.
