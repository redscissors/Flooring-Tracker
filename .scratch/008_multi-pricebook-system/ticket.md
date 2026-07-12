---
issue_type: Design
summary: Grow the single stock price book into a managed library of 10-30 price
  books — stock books and special-order (vendor cost) books — with per-book
  browse/search/edit, per-book import with saved column mappings, cost + markup
  rules (default + per-product-group) on order books, stock-first priority in
  the SKU search, and up to 3 rollback versions per book.
status: open
labels: [ready-for-human]
---

# Multi price book system: stock space, special-order space, markups, versions

## Problem / Why

Today there is exactly one price book: the shop's stock workbook, parsed by
hard-coded per-sheet adapters into the single `stock_items` table (ADR 0003).
The owner wants to grow this to **10-30 price sheets of different types**:

- **Stock sheets** — the shop's own inventory, priced at retail (what exists
  today).
- **Special-order sheets** — vendor price lists that carry a *cost*, which
  needs one or more **markups** applied (sometimes different markups for
  different product groups on the same sheet) to produce the selling price.

Wanted on top of that:

1. A Settings area that organizes books into a **stock space** and a
   **special-order space**.
2. Click into any imported book and **browse/search its items**, and
   fine-tune (edit) individual items when needed.
3. When searching for a product, the system should **prefer the stock item
   over a special-order item** when the stock book has it.
4. Keep up to **3 old versions of each book** to fall back to.

## Where the full design lives

`design.md` in this directory — data model, markup engine, import pipeline,
UI shape, phasing, and the remaining open questions. Real vendor sheets are
analyzed under `sheets/` (first: the Virginia Tile EFT list, 6,792 items —
`sheets/vtc-eft-2025-07-28.md`; the raw .xls stays out of the repo since it
carries the shop's dealer costs).

## Status

Design groundwork only — no code, no SQL run, no ADR accepted yet. The owner
reviews the proposal, answers the open questions, and the accepted decisions
get recorded via `/decide` (this will supersede parts of nothing — it extends
ADR 0003 rather than replacing it). Implementation is phased; Phase 1 can
start as soon as the first test vendor sheet exists.
