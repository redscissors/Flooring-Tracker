// Registry→engine adapter (ADR 0032 consequences — phase 3's first
// deliverable): live registry rows are normOrderItem/normBookItem-shaped
// (`description`, book-level stock kind, the ERP export's shop code in `sku`
// with the manufacturer code in `vendorSkus`), while schluter.js was built
// against the prototype-shaped fixture (`name`, per-item `stock`, mfg `sku`).
// Everything the engine reads crosses this file; nothing else in the popup
// touches a raw book row.

import { classify } from "./schluter.js";
import { skuKeys } from "./orderbook.js";

// Deck-mud bed coverage at the prototype's 1-1/2" bed, ≈8 sf per 60 lb bag.
// The Settings mortars shape ({tier1..3} trowel coverages) has no bed-depth
// rate, so the adapter supplies the constant; the popup captions it.
export const MORTAR_BED_SF_PER_BAG = 8;

/**
 * One live registry row → the engine's item shape, or null when no code on
 * the row parses as a Schluter shower part. The engine keys everything off
 * `sku`, so the adapter's job is finding the code classify()'s grammar
 * recognizes: the row's own sku first (an EFT row's sku IS the mfg code),
 * then each vendorSkus entry (the ERP stock export keeps the shop's internal
 * code in sku). `stock` is the caller's book kind — a per-item flag does not
 * exist on live rows.
 */
export function adaptRow(row, { stock } = {}) {
  if (!row) return null;
  const codes = [row.sku, ...(row.vendorSkus || [])].filter(Boolean);
  const base = {
    erp: "",
    name: row.description || row.product || "",
    size: row.size || "",
    unit: row.unit || "",
    price: +row.price || 0,
    cost: +row.cost || 0,
    stock: !!stock,
    lead: row.leadTime || "",
  };
  for (const code of codes) {
    if (classify({ ...base, sku: code })) {
      return { ...base, sku: code, erp: code === row.sku ? "" : row.sku };
    }
  }
  return null;
}

/** Map a book's rows, dropping everything the grammar doesn't recognize. */
export function adaptBookRows(rows, opts) {
  return (rows || []).map((r) => adaptRow(r, opts)).filter(Boolean);
}

/**
 * Drop adapted special-order entries whose code is a stocked entry in another
 * spelling. The vendor's EFT re-letters the mfg code (SLR prefix, separators
 * shed — "SLRKST965810BF" for the stocked "KST965/810BF"), so raw sku
 * equality never collides and the same tray shows twice. Membership is
 * skuKeys() spellings over each stock entry's mfg code AND shop code
 * (sku/erp); stock wins the collision, same as mergeSearch.
 */
export function dropStockTwins(orderEntries, stockEntries) {
  const seen = new Set((stockEntries || []).flatMap((e) => [e.sku, e.erp].flatMap(skuKeys)));
  return (orderEntries || []).filter((e) => !skuKeys(e.sku).some((k) => seen.has(k)));
}

/**
 * The Settings → Materials mortar pick as buildKit's cfg.mortarItem
 * (decision 2 — the mortar-bed fallback lands a real product line). A
 * Settings material carries one number, so cost mirrors price rather than
 * showing $0 on the Cost tier.
 */
export function mortarItemFrom(name, mortars) {
  const m = name && mortars ? mortars[name] : null;
  if (!m) return null;
  const price = +m.price || 0;
  return { name, price, cost: price, stock: true, sfPerBagAt15: MORTAR_BED_SF_PER_BAG };
}
