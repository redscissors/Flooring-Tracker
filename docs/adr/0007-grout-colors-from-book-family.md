# ADR 0007 — Grout colors and per-color SKUs come from a linked price-book family

- **Status:** Accepted
- **Date:** 2026-07-08
- **Scope:** system-wide (catalog data model + Selection shape + summary/print)
- **Related:** extends ADR 0006 (catalog SKU link); applies ADR 0003's snapshot
  doctrine to grout colors; ADR 0002 (link by name) unchanged. Prototype:
  `.scratch/handoffs/prototype-settings-pricebook-2026-07-08.md`.

## Context

Grout colors are a hand-kept code list (`GROUT_COLORS` in App.jsx) keyed per
grout name — no SKUs, and no way for a user to see or change a grout's palette.
But the price book already carries the whole story: `parseGroutMatrix` yields
one stock item per grout family × color, each with its own SKU and the family's
price. ADR 0006 gave a catalog product **one** `sku`; that cannot represent
PermaColor Select's ~40 per-color SKUs, so grout lines print with a generic SKU
(or none) while the shop orders a color-specific one. The estimate prints black
& white — the SKU column, not a color chip, identifies the material.

## Decision

1. **Catalog grout gains an optional `book` field** — the price-book family it
   offers, stored as the stock items' `product` name (e.g. "Permacolor Select
   Grout"). Linked in Settings by searching the imported book; empty = today's
   behavior (standard color list, catalog-level `sku` only).
2. **The job's color dropdown lists the linked family's colors**, read from the
   in-memory stock list at edit time (same read moment as the SKU search box —
   never at calc time).
3. **Picking a color snapshots that color's SKU onto the Selection** as
   `p.grout.sku` (default `""` in `normP`). It is **display-only**: the grout
   still resolves by name (ADR 0002), the SKU is never a link key (ADR 0006's
   rule holds), and re-imports never change it (ADR 0003). On summary, print,
   and the order sheet, the selection's per-color SKU wins over the catalog
   product's `sku`; the catalog `sku` remains the fallback.
4. **Custom install materials gain a display-only `sku`** too, filled
   book-search-first in Settings, shown on their Install lines.

## Why

- **The book is the source of truth for colors** — hand-maintaining 40-color
  lists in code is exactly the drudgery the import exists to remove, and a
  color list that drifts from the book produces unorderable estimates.
- **Snapshot, not live-resolve, for the picked SKU:** resolving
  family+color→SKU at print time would re-read stock at calc time and let a
  re-import silently change what a saved estimate shows — ADR 0003's forbidden
  failure. A snapshot at pick time is the same mechanism flooring rows already
  use.
- **Fallback keeps old records valid:** selections saved before this change
  have no `grout.sku`; they normalize to `""` and print exactly as they do
  today (catalog SKU or none).

## Consequences

- `groutFields` carries `book`; `normP` carries `grout.sku`; both default to
  empty so pre-0007 records load and calculate identically.
- Changing a linked grout's color re-snapshots the SKU; changing the *grout*
  clears it unless the new grout resolves the same color. A color typed on an
  old record before linking keeps working — it just has no SKU until re-picked.
- The color dropdown's contents can change when the book is re-imported (new
  colors appear, retired ones drop from *new* picks) — deliberate, since only
  the pick, not the saved row, reads the book.
- `GROUT_COLORS` in code becomes the fallback for unlinked grouts only.
