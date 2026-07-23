// Floor trims as lines (2026-07-22 spec): the materials drawer's Trims popup
// lists a book floor's `fits` relations (trimsForFloor) and lands the picks as
// product rows directly below the floor. This module is the pure apply logic —
// the popup mirrors the floor's existing trim lines, so reopening it adjusts
// quantities instead of appending duplicates.

import { num } from "./catalog.js";

// The floor's existing trim lines in its area, keyed by SKU: the first row
// (other than the floor itself) whose SKU matches a trim's. SKU alone, not
// bookId+sku — the same vendor SKU in the stock and special-order spaces is
// the same product (the mergeSearch doctrine), and a line added as one can be
// seeded when the popup now lists the other. First match wins so a
// hand-duplicated line never gets double-adjusted.
export function existingTrimRows(products, floorId, trims) {
  const want = new Set((trims || []).map((it) => it.sku));
  const rows = new Map();
  for (const p of products || []) {
    if (p.id === floorId || !p.sku || !p.bookId) continue;
    if (want.has(p.sku) && !rows.has(p.sku)) rows.set(p.sku, p);
  }
  return rows;
}

// Prefer the shop's shelf over the vendor: a trim whose exact SKU is live in a
// stock-kind book swaps to that stock item (its own retail, `stockKind` badge),
// keeping the special-order row only when the shop doesn't stock it. Exact SKU
// equality only — the same no-fuzzy-guessing rule as mergeSearch.
export function preferStockTrims(trims, stockItems) {
  if (!trims?.length || !stockItems?.length) return trims || [];
  const bySku = new Map();
  for (const it of stockItems) {
    if (it.active === false || it.disabled || it.discontinued || !it.sku) continue;
    if (!bySku.has(it.sku)) bySku.set(it.sku, it);
  }
  return trims.map((t) => {
    const twin = bySku.get(t.sku);
    return twin ? { ...twin, trim: true, fits: t.fits } : t;
  });
}

// Per trim: the on-job row (id + quantity) or a fresh qty-0 entry — the
// popup's initial state.
export function seedTrimPlan(products, floor, trims) {
  const rows = existingTrimRows(products, floor?.id, trims);
  return (trims || []).map((it) => {
    const r = rows.get(it.sku);
    return { sku: it.sku, rowId: r ? r.id : null, qty: r ? num(r.qty) : 0 };
  });
}

// Apply the popup's quantities in one pass. entries: [{ rowId|null, qty, row|null }]
// where `row` is the fully built product row for a new pick (qty already set).
//  - seeded row, qty > 0  → update qty only (hand-edited price/note survive)
//  - seeded row, qty <= 0 → the line comes off
//  - new pick             → inserted directly below the floor, after any of its
//                           existing trim rows so the block stays grouped
export function applyTrimPlan(products, floorId, entries) {
  const list = products || [];
  if (!list.some((p) => p.id === floorId)) return list;
  const byRow = new Map((entries || []).filter((e) => e.rowId).map((e) => [e.rowId, e]));
  const inserts = (entries || []).filter((e) => !e.rowId && e.qty > 0 && e.row).map((e) => e.row);
  const out = [];
  for (const p of list) {
    const e = byRow.get(p.id);
    if (!e) { out.push(p); continue; }
    if (e.qty > 0) out.push(num(p.qty) === e.qty ? p : { ...p, qty: String(e.qty) });
  }
  let at = out.findIndex((p) => p.id === floorId) + 1;
  while (at < out.length && byRow.has(out[at].id)) at++;
  out.splice(at, 0, ...inserts);
  return out;
}
