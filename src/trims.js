// Floor trims as lines (2026-07-22 spec): the materials drawer's Trims popup
// lists a book floor's `fits` relations (trimsForFloor) and lands the picks as
// product rows directly below the floor. This module is the pure apply logic —
// the popup mirrors the floor's existing trim lines, so reopening it adjusts
// quantities instead of appending duplicates.

import { num } from "./catalog.js";

// A suffixed code and its manufacturer base, so matching tries both spellings:
// the team suffixes a single letter onto a numeric vendor code to mark an
// internal variant ("589571E" ↔ "589571"), and the ERP exports append a
// "VN"/"VN1" vinyl marker to a Mannington color code ("MPB770VN1" ↔ "MPB770" —
// the vendor book's `fits` state the bare code). Anything else passes
// unchanged; a wrong extra candidate is harmless because every use is an
// exact-membership test against codes the books actually state.
const codeVariants = (code) => {
  const m = /^(\d{3,})[A-Za-z]$/.exec(code || "");
  if (m) return [code, m[1]];
  const vn = /^([A-Za-z]+\d+)VN\d?$/.exec(code || "");
  return vn ? [code, vn[1]] : [code];
};

// The exact keys an item is known by across the spaces: its own SKU plus the
// manufacturer codes its sheet stated as columns (`vendorSkus` — the ERP
// exports' Supplier/Mfg Product Code, the authoritative source), falling back
// to description-tail extraction only for items imported before those columns
// were captured. The description is NOT trusted when columns exist: a real
// MANMI floor's description carried a sibling color's code while the column
// had the right one.
export function vendorKeys(item) {
  if (!item) return [];
  const codes = item.vendorSkus?.length ? item.vendorSkus : vendorCodeCandidates(item.description);
  return [...new Set([item.sku, ...codes].filter(Boolean).flatMap(codeVariants))].slice(0, 6);
}

// A code-shaped token: carries a digit, isn't a size, 3–16 chars.
const codeToken = (t) => {
  const s = String(t || "").replace(/[.,;:)]+$/, "").replace(/^[.,;:(]+/, "");
  if (!/\d/.test(s)) return "";                           // a code carries a digit
  if (s.length < 3 || s.length > 16) return "";
  if (/^\d+(\.\d+)?["']?[x×]\d/i.test(s)) return "";      // a size, not a code
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(s)) return "";
  return s;
};

// The ERP's product codes are the shop's own; the manufacturer's code rides in
// the ERP description, generally at the very end ("… NOBLE OAK ACORN REDUCER
// 384421"). Candidates are the last few code-shaped tokens — a wrong guess is
// harmless because every use is an exact-membership test against codes the
// vendor books actually state (`fits` / SKU), never a fuzzy match.
export function vendorCodeCandidates(description) {
  const toks = String(description || "").trim().split(/\s+/).slice(-3);
  return [...new Set(toks.map(codeToken).filter(Boolean))];
}

// Trim-profile words a stock book's untyped trim rows lead with. "OneNose" is
// Mannington's flush stairnose system (one word, so \bnose\b alone would miss
// it).
const STOCK_TRIM_RE = /\b(end ?cap|t-?mold(?:ing)?|(?:multi-?)?reducer|stair ?nose|nosing|one ?nose|quarter ?round|threshold|transition|overlap)\b/i;
const ONENOSE_RE = /one[-\s]?nose/i;
const MDF_FILL_RE = /mdf\s*fill/i;

// The color phrase a stock trim names after its " - " separator, code tokens
// shed from either end — the sheet writes them both ways ("Endcap - Noble Oak
// Bark EDM823", "Reducer - 531996 Preservation Fossil"). null when there is no
// separator or fewer than two words survive — a one-word "color" is too weak
// to match on.
const trimColorPhrase = (desc) => {
  const m = /-\s*([^-]*)$/.exec(String(desc || ""));
  if (!m) return null;
  const words = m[1].trim().split(/\s+/).filter(Boolean);
  while (words.length && codeToken(words[words.length - 1])) words.pop();
  while (words.length && codeToken(words[0])) words.shift();
  return words.length >= 2 ? words.join(" ").toLowerCase() : null;
};

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const livable = (it) => it.active !== false && !it.disabled && !it.discontinued;

// The floor's own stock book read by COLOR NAME: untyped trim-worded rows
// whose " - " color phrase appears whole in the floor item's description
// ("OneNose - Noble Oak Bark" → the Bark floor). This is the tier that shows
// the shop's shelf even when the vendor book's `fits` lacks the piece —
// OneNose is the newer colors' stairnose and must surface (2026-07-23).
// Name-resolution over one vendor's own book, the mortar convention.
export function stockTrimOptions(floorItem, stockItems) {
  if (!floorItem?.description) return [];
  const floorDesc = String(floorItem.description);
  const out = [];
  for (const it of stockItems || []) {
    if (it.bookId !== floorItem.bookId || it.sku === floorItem.sku) continue;
    if (!livable(it) || it.type) continue;
    const desc = String(it.description || "");
    if (!STOCK_TRIM_RE.test(desc)) continue;
    const phrase = trimColorPhrase(desc);
    if (!phrase) continue;
    if (!new RegExp(`(^|[^a-z0-9])${reEscape(phrase)}([^a-z0-9]|$)`, "i").test(floorDesc)) continue;
    out.push({ ...it, trim: true });
  }
  return out;
}

// The popup's one list: the `fits`-derived trims with stock twins swapped in
// (preferStockTrims), then the stock color-name tier's additions, then — when
// a OneNose is on the list — the shelf's OneNose MDF fill (the flush-nose
// filler board OneNose installs need), matched by name, never by a hardcoded
// SKU. Deduped on every item's exact keys.
export function mergeTrimOptions(fitsTrims, floorItem, stockItems) {
  const list = preferStockTrims(fitsTrims || [], stockItems);
  const seen = new Set(list.flatMap((t) => [...vendorKeys(t), t.orderSku].filter(Boolean)));
  for (const it of stockTrimOptions(floorItem, stockItems)) {
    if (vendorKeys(it).some((k) => seen.has(k))) continue;
    for (const k of vendorKeys(it)) seen.add(k);
    list.push(it);
  }
  if (list.some((t) => ONENOSE_RE.test(t.description || ""))) {
    for (const it of stockItems || []) {
      if (!livable(it) || it.type || !MDF_FILL_RE.test(it.description || "")) continue;
      if (vendorKeys(it).some((k) => seen.has(k))) continue;
      for (const k of vendorKeys(it)) seen.add(k);
      list.push({ ...it, trim: true, pairNote: "installs with OneNose" });
    }
  }
  return list;
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
// item matches on any of its exact keys (vendorKeys: its SKU, its sheet's
// manufacturer-code columns, the description-tail fallback), and a
// shop-suffixed code matches its base ("589571E" ↔ "589571") — exact equality
// throughout, never fuzzy. A swapped item keeps the vendor code as `orderSku`
// so seeding still finds lines added under either code.
export function preferStockTrims(trims, stockItems) {
  if (!trims?.length || !stockItems?.length) return trims || [];
  const byKey = new Map();
  for (const it of stockItems) {
    if (it.active === false || it.disabled || it.discontinued || !it.sku) continue;
    for (const k of vendorKeys(it)) if (!byKey.has(k)) byKey.set(k, it);
  }
  return trims.map((t) => {
    const twin = codeVariants(t.sku).map((k) => byKey.get(k)).find(Boolean);
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
