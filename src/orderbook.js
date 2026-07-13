// Price book library — special-order ("order") book helpers (ADR 0009).
//
// Order books are vendor price lists that carry a dealer COST, not a selling
// price. The selling price is cost × (1 + markup), where the markup lives on
// the book (a default plus optional per-group overrides) — never on the item.
// Sell is computed at display and pick time, never stored on the item, so a
// markup edit changes future picks only and never rewrites a saved estimate
// (the ADR 0003 snapshot doctrine extended to markups).
//
// An order item is shaped like a stock item (so search and the pick-snapshot
// reuse stock.js untouched) plus the fields a vendor sheet proved necessary:
// cost, mfg/productLine (markup group axes), leadTime, msrp, freightFlag, and
// tierPrices (book-defined contractor pricing). Picking one produces the same
// patch stockPatch builds, then adds bookId/cost/markupPct and the flags.

import { stockPatch, stockPriceSqft } from "./stock.js";

const str = (v) => (v == null ? "" : String(v).trim());
const numOr = (v, d = null) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") { const n = parseFloat(v.replace(/[$,]/g, "")); if (Number.isFinite(n)) return n; }
  return d;
};
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const round4 = (n) => (n == null ? null : Math.round(n * 10000) / 10000);

// --- the canonical order-item shape ------------------------------------------

// One place both the mapped parser (pricebook.js parseMapped) and the DB-row
// loader (normBookItem) build the in-memory item, so the two can never drift.
// Column-backed fields (sku/active/updatedAt/bookId) get legacy-safe defaults
// here too; bookItemData strips them back out before a write.
export function normOrderItem(f = {}) {
  return {
    sku: str(f.sku),
    bookId: str(f.bookId),
    active: f.active !== false,
    updatedAt: f.updatedAt ?? null,
    sheet: str(f.sheet),
    section: str(f.section),
    brand: str(f.brand),
    description: str(f.description),
    product: str(f.product),
    color: str(f.color),
    style: str(f.style),
    subtype: str(f.subtype),
    unit: str(f.unit),
    size: str(f.size),
    thickness: str(f.thickness),
    type: f.type || null,
    // Order items store COST, never a selling price — price/priceSqft are
    // derived at display via the book's markup (pricedItem), never persisted.
    price: null,
    priceSqft: null,
    sfPerUnit: numOr(f.sfPerUnit),
    coverage: numOr(f.coverage),
    discontinued: !!f.discontinued,
    note: str(f.note),
    // order-book extras
    cost: round2(numOr(f.cost)),
    mfg: str(f.mfg),
    productLine: str(f.productLine),
    leadTime: str(f.leadTime),
    msrp: round2(numOr(f.msrp)),
    freightFlag: !!f.freightFlag,
    // { contractor: number, ... } book-defined selling tiers, or null
    tierPrices: f.tierPrices && typeof f.tierPrices === "object" ? { ...f.tierPrices } : null,
  };
}

// A price_book_items DB row → memory. bookId comes from the book_id column.
export function normBookItem(row, bookId = "") {
  const it = normOrderItem({ sku: row.sku, bookId: bookId || row.book_id, ...(row.data || {}) });
  it.active = row.active !== false;
  it.updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
  return it;
}

// The jsonb payload written back on import — everything except the
// column-backed fields (book_id, sku, active, updated_at).
export const bookItemData = ({ sku, bookId, active, updatedAt, ...data }) => data;

// --- cost, markup, sell ------------------------------------------------------

// Per-sq-ft cost, mirroring stockPriceSqft: the cost as-is when the item is
// priced by the square foot, else derived from a carton/sheet cost and its
// SF/CT coverage. Count/flat items (EA, PC with no coverage) have none.
export function costSqft(item) {
  if (!item || item.cost == null) return null;
  if (/^(sf|sft|sqft)$/i.test(item.unit)) return item.cost;
  if (item.sfPerUnit > 0) return round4(item.cost / item.sfPerUnit);
  return null;
}

// The markup percent for an item under a book's markups config. A per-group
// override (byGroup keyed on the mapping-chosen groupBy field) outranks the
// book default; an unmapped/absent group quietly uses the default.
export function resolveMarkup(markups, item) {
  const m = markups || {};
  const def = numOr(m.default, 0);
  const key = m.groupBy ? str(item?.[m.groupBy]) : "";
  if (key && m.byGroup && m.byGroup[key] != null) {
    const g = numOr(m.byGroup[key]);
    if (g != null) return g;
  }
  return def;
}

// cost × (1 + pct/100), rounded like every other price.
export const sellPrice = (cost, pct) => (cost == null ? null : round2(cost * (1 + (pct || 0) / 100)));

// A stock-shaped item with price/priceSqft filled from cost × markup, so
// search results and the pick-snapshot can treat it exactly like a stock item.
// Also carries the resolved markupPct for display and the pick snapshot. A
// stock-kind registry item (no cost) passes through with its own price.
export function pricedItem(item, markups) {
  const pct = resolveMarkup(markups, item);
  if (!item || item.cost == null) return { ...item, markupPct: pct };
  const csf = costSqft(item);
  return {
    ...item,
    markupPct: pct,
    price: sellPrice(item.cost, pct),
    priceSqft: csf != null ? round4(csf * (1 + pct / 100)) : null,
  };
}

// --- pick snapshot -----------------------------------------------------------

// The snapshot patch a picked order-book item applies to a product row: the
// same fields stockPatch fills (type, $/sqft, carton, brand/size), plus the
// order-book provenance the drift chip and (later) contractor pricing need.
// bookId/cost/markupPct/tierPrice are stored as strings, matching how the row
// keeps its other numeric fields.
export function orderPatch(item, book, product) {
  const priced = pricedItem(item, book?.data?.markups);
  const patch = stockPatch(priced, product);
  patch.bookId = str(item.bookId || book?.id);
  patch.cost = item.cost != null ? String(item.cost) : "";
  patch.markupPct = priced.markupPct != null ? String(priced.markupPct) : "";
  patch.freightFlag = !!item.freightFlag;
  const tier = item.tierPrices?.contractor;
  patch.tierPrice = tier != null ? String(tier) : "";
  return patch;
}

// --- drift -------------------------------------------------------------------

// Non-null when the row's snapshotted selling price no longer matches what the
// book would produce today ({ from, to }, plus cost/markup movement detail for
// the chip: "cost now $2.10, markup now 40% → $2.94"). Generalizes stockDrift:
// the sell can move because the vendor's cost moved, the book's markup moved,
// or both.
export function orderDrift(item, book, product) {
  if (!item) return null;
  const priced = pricedItem(item, book?.data?.markups);
  const now = priced.type ? stockPriceSqft(priced) : priced.price;
  const cur = parseFloat(product.priceSqft);
  if (now == null || !Number.isFinite(cur)) return null;
  const to = round2(now);
  if (Math.abs(cur - to) <= 0.005) return null;
  const drift = { from: cur, to };
  const costFrom = parseFloat(product.cost);
  if (Number.isFinite(costFrom) && item.cost != null && Math.abs(costFrom - item.cost) > 0.005) drift.cost = { from: costFrom, to: item.cost };
  const markFrom = parseFloat(product.markupPct);
  if (Number.isFinite(markFrom) && priced.markupPct != null && Math.abs(markFrom - priced.markupPct) > 0.005) drift.markup = { from: markFrom, to: priced.markupPct };
  return drift;
}

// --- search collision (stock outranks order, by SKU) -------------------------

// Stock matches always render first; order matches follow. When the same SKU
// string exists in both spaces the order twin is dropped (the stock item wins)
// and the surviving stock match is tagged with the book it is also on, so the
// UI can show an "also on {book}" note instead of a second, differently-priced
// row. Honest and simple: only exact-SKU equality collides — no fuzzy
// cross-vendor product guessing (a wrong guess prices a job off the wrong list).
export function mergeSearch(stockMatches, orderMatches) {
  const bySku = new Map((stockMatches || []).map((it) => [it.sku, it]));
  const order = [];
  for (const it of orderMatches || []) {
    const twin = bySku.get(it.sku);
    if (twin) { (twin.alsoOn = twin.alsoOn || []).push(it.bookId); continue; }
    order.push(it);
  }
  return { stock: stockMatches || [], order };
}

// --- markup group summary ----------------------------------------------------

// The distinct values of the markup group column present in a book's items,
// each with its current override (or the book default), for the markup editor.
// Only the groups the sheet actually has are priceable — no free-form matcher.
export function markupGroups(items, markups) {
  const m = markups || {};
  const field = m.groupBy;
  if (!field) return [];
  const seen = new Map();
  for (const it of items || []) {
    const key = str(it[field]);
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()]
    .map(([key, count]) => ({ key, count, pct: (m.byGroup && m.byGroup[key] != null ? numOr(m.byGroup[key], numOr(m.default, 0)) : numOr(m.default, 0)), overridden: !!(m.byGroup && m.byGroup[key] != null) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
