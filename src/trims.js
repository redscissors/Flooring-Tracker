// Floor trims as lines (2026-07-22 spec): the materials drawer's Trims popup
// lists a book floor's `fits` relations (trimsForFloor) and lands the picks as
// product rows directly below the floor. This module is the pure apply logic —
// the popup mirrors the floor's existing trim lines, so reopening it adjusts
// quantities instead of appending duplicates.

import { num } from "./catalog.js";

// The ERP's product codes are the shop's own; the manufacturer's code rides in
// the ERP description, generally at the very end ("… NOBLE OAK ACORN REDUCER
// 384421"). Candidates are the last few code-shaped tokens — a wrong guess is
// harmless because every use is an exact-membership test against codes the
// vendor books actually state (`fits` / SKU), never a fuzzy match.
export function vendorCodeCandidates(description) {
  const toks = String(description || "").trim().split(/\s+/).slice(-3);
  const out = [];
  for (const t of toks) {
    const s = t.replace(/[.,;:)]+$/, "").replace(/^[.,;:(]+/, "");
    if (!/\d/.test(s)) continue;                          // a code carries a digit
    if (s.length < 3 || s.length > 16) continue;
    if (/^\d+(\.\d+)?["']?[x×]\d/i.test(s)) continue;     // a size, not a code
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(s)) continue;
    out.push(s);
  }
  return [...new Set(out)];
}

// The floor's existing trim lines in its area, keyed by the trim's canonical
// SKU: the first row (other than the floor itself) whose SKU matches a trim's
// own SKU or its special-order twin's (`orderSku`, set by preferStockTrims).
// SKU alone, not bookId+sku — the same product across the stock and
// special-order spaces is one line (the mergeSearch doctrine), so a line added
// as one space's item still seeds when the popup lists the other's. First
// match wins so a hand-duplicated line never gets double-adjusted.
export function existingTrimRows(products, floorId, trims) {
  const want = new Map();
  for (const it of trims || []) {
    want.set(it.sku, it.sku);
    if (it.orderSku) want.set(it.orderSku, it.sku);
  }
  const rows = new Map();
  for (const p of products || []) {
    if (p.id === floorId || !p.sku || !p.bookId) continue;
    const sku = want.get(p.sku);
    if (sku && !rows.has(sku)) rows.set(sku, p);
  }
  return rows;
}

// Prefer the shop's shelf over the vendor: a trim that a stock-kind book
// carries live swaps to that stock item (its own retail, `stockKind` badge),
// keeping the special-order item only when the shop doesn't stock it. A stock
// item matches on its own SKU or on a manufacturer code extracted from its
// ERP description (vendorCodeCandidates) — exact equality either way. A
// swapped item keeps the vendor code as `orderSku` so seeding still finds
// lines added under either code.
export function preferStockTrims(trims, stockItems) {
  if (!trims?.length || !stockItems?.length) return trims || [];
  const byKey = new Map();
  for (const it of stockItems) {
    if (it.active === false || it.disabled || it.discontinued || !it.sku) continue;
    for (const k of [it.sku, ...vendorCodeCandidates(it.description)])
      if (!byKey.has(k)) byKey.set(k, it);
  }
  return trims.map((t) => {
    const twin = byKey.get(t.sku);
    if (!twin) return t;
    return { ...twin, trim: true, fits: t.fits, ...(twin.sku !== t.sku ? { orderSku: t.sku } : {}) };
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
