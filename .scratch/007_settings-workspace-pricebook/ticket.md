---
issue_type: Task
summary: Rebuild Settings as a PC-first workspace (left-nav sections, master-detail catalog) and drive grout colors + per-color SKUs from the imported price book — color pick snapshots the color's SKU onto the selection so grout/caulk/install lines print with SKUs; every SKU-bearing field is book-search-first with manual fallback.
status: done
labels: [ready-for-agent]
---

# Settings workspace + price-book-driven grout colors

## Problem / Why

Owner request (2026-07-08, prototype session): the Settings modal (max-w-xl,
one scrolling column) is cramped for what it now manages, and grout colors are
a hand-kept code list (`GROUT_COLORS` in App.jsx) — no SKUs per color, no way
for a user to see or manage a grout's palette. The estimate prints black &
white, so the SKU column, not a color chip, is what identifies the material.

ADR 0006 (merged the same day, PR #35) already gave catalog products a
display-only `sku`, grout products a `base` companion, and put SKUs on the
totals/print lines. What's missing is the **color story**: one SKU per catalog
product can't represent PermaColor Select's 40 colors — the book's Grout &
Caulk matrix has one SKU per product × color (`parseGroutMatrix`).

## Decided design (see prototype handoff + ADR 0007)

- Catalog grout gains **`book`** — the price-book family (stock `product`
  name) whose colors it offers. The job's color dropdown lists that family's
  colors; **picking a color snapshots that color's SKU onto the selection**
  (`p.grout.sku`, display-only, never a link key). Unlinked grouts keep the
  standard color list and print without a per-color SKU (catalog `sku`
  fallback).
- Install materials (custom kind) gain **`sku`**, filled book-search-first in
  Settings; flows to summary/print Install lines.
- Settings becomes a near-fullscreen **workspace**: left nav (General ·
  Price book · Grout & colors · Mortar & underlayment · Backup), master-detail
  catalog panes, aligned spec-field rows, per-grout color/SKU grid from the
  linked family. All existing capabilities preserved (enable/disable,
  add/delete product + company, base editor, typeChips, book pre-fill).

Prototype: `.scratch/handoffs/prototype-settings-pricebook-2026-07-08.md`
(Variant A picked).

## Acceptance

- Old records (no `book`, no `grout.sku`) load and calculate identically.
- Picking a linked grout color puts its SKU on the on-screen order summary,
  the printed materials breakdown, and the order sheet; re-imports never
  change it (snapshot, ADR 0003).
- npm test green (count up), npm run build clean, preview proof of workspace +
  print.
