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

`docs/pricebook/design.md` (moved there at Phase 0; decisions recorded in
ADR 0009) — data model, markup engine, import pipeline, UI shape, phasing,
and Q5, the one question still open. Real sheets are analyzed under `sheets/`
in this directory (raw files stay out of the repo — they carry the shop's
costs/pricing):

- `sheets/vtc-eft-2025-07-28.md` — Virginia Tile EFT special-order list,
  6,792 items, dealer cost + per-item freight flags.
- `sheets/schluter-wedi-stock-2026-07-12.md` — two shop *stock* sheets; the
  current parser already consumes both except one header alias, and the Wedi
  file surfaces the retail-vs-contractor tier question (Q5).

## Status

- **Bridge: shipped** (PR #57, merged 2026-07-12) — `retailprice` header
  alias; the Schluter/Wedi Retail pages can be pasted into the main stock
  workbook and imported today. Do not paste the Wedi Contractor pages.
- **Phase 0: done** — ADR 0009 accepted, `supabase/pricebooks.sql` shipped
  (owner runs it in the dashboard before Phase 1 lands), design moved to
  `docs/pricebook/design.md`.
- **Next: Phase 1** (book registry + mapped import + browse/search +
  hide-costs toggle), gated on the owner running `pricebooks.sql`. Q5
  (contractor tier *use*) stays open and does not block anything.
