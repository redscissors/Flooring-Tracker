// Stock price book — app-side helpers (ADR 0003).
//
// Stock items live in their own shared `stock_items` table, one row per SKU.
// A product row that picks a SKU gets the item's values COPIED in (snapshot) —
// nothing resolves against the stock table at calculation time, so estimates
// keep the price they were quoted at. The row remembers its `sku`, which lets
// the UI flag price drift against the current stock list and offer a refresh.

const str = (v) => (v == null ? "" : String(v).trim());
const numOr = (v, d = null) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const round2 = (n) => Math.round(n * 100) / 100;

export const normStockItem = (row) => ({
  sku: str(row.sku),
  active: row.active !== false,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  sheet: str(row.data?.sheet),
  section: str(row.data?.section),
  brand: str(row.data?.brand),
  description: str(row.data?.description),
  product: str(row.data?.product),
  color: str(row.data?.color),
  style: str(row.data?.style),
  subtype: str(row.data?.subtype),
  unit: str(row.data?.unit),
  size: str(row.data?.size),
  thickness: str(row.data?.thickness),
  type: row.data?.type || null,
  price: numOr(row.data?.price),
  priceSqft: numOr(row.data?.priceSqft),
  sfPerUnit: numOr(row.data?.sfPerUnit),
  coverage: numOr(row.data?.coverage),
  discontinued: !!row.data?.discontinued,
  note: str(row.data?.note),
});

// The jsonb payload written back on import — everything except the column-backed
// fields (sku, active, updated_at).
export const stockData = ({ sku, active, updatedAt, ...data }) => data;

// --- search -------------------------------------------------------------------

const hay = (it) => [it.sku, it.description, it.brand, it.product, it.color, it.section, it.sheet, it.size, it.note].join(" ").toLowerCase();

// The price book labels transition pieces by profile (Reducer, T-Mold, End
// Cap, Stairnose…), so the trade word "transition" would find nothing without
// this synonym.
const TRANSITION_RE = /transition|reducer|t-mold|end cap|stairnos|threshold/;
const wordHit = (h, w) => (/^transitions?$/.test(w) ? TRANSITION_RE.test(h) : h.includes(w));

// SKU prefix or every word somewhere in the item's text. Active items only —
// a discontinued/removed item shouldn't be offered for new selections (rows
// that already hold its SKU keep their snapshot regardless). Returns every
// match; display code slices and says how many more there are.
export function searchStock(items, query) {
  const q = str(query).toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const out = [];
  for (const it of items) {
    if (!it.active || it.discontinued) continue;
    const h = hay(it);
    const ok = /^\d+$/.test(q) ? it.sku.startsWith(q) : words.every((w) => wordHit(h, w));
    if (ok) out.push(it);
  }
  return out;
}

export const findStock = (items, sku) => (str(sku) ? items.find((it) => it.sku === str(sku)) : null) || null;

// --- filling a product row ------------------------------------------------------

// "12x24", '2x8"', "4X12", "2 x 6" → [L, W]; anything else → null.
export const parseTileSize = (size) => {
  const m = str(size).match(/^(\d+(?:\.\d+)?)\s*["']?\s*[x×]\s*(\d+(?:\.\d+)?)\s*["']?$/i);
  return m ? [m[1], m[2]] : null;
};

// '3/8"' → "0.375", "10MM" → "0.3937", "0.75" → "0.75"; unknown → null.
export const parseThickness = (t) => {
  const v = str(t);
  if (!v) return null;
  const mm = v.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return String(Math.round((parseFloat(mm[1]) / 25.4) * 10000) / 10000);
  const frac = v.match(/^(\d+)\s*\/\s*(\d+)\s*"?$/);
  if (frac) return String(parseFloat(frac[1]) / parseFloat(frac[2]));
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 && n < 2 ? String(n) : null;
};

const label = (it) => {
  const bits = [it.brand && !it.description.toLowerCase().includes(it.brand.toLowerCase()) ? it.brand : "", it.description].filter(Boolean);
  return bits.join(" ");
};

// The snapshot patch a picked stock item applies to a product row. Flooring
// items fill their real type; everything else lands as a Miscellaneous line
// (description + flat price), which is how the app already models one-off
// count/accessory charges.
export function stockPatch(item, product) {
  const patch = { sku: item.sku };
  const perSqft = item.type && item.priceSqft != null;
  if (item.type && (perSqft || item.unit === "CT")) {
    patch.type = item.type;
    patch.qtyType = "sqft";
    patch.brandColor = label(item);
    if (item.priceSqft != null) patch.priceSqft = String(round2(item.priceSqft));
    if (item.type === "tile") {
      const lw = parseTileSize(item.size);
      if (lw) { patch.L = lw[0]; patch.W = lw[1]; }
      else if (item.size) patch.brandColor = `${item.size} ${patch.brandColor}`;
      const th = parseThickness(item.thickness);
      if (th) patch.thickness = th;
    } else {
      patch.sizeText = item.size;
    }
  } else {
    patch.type = "misc";
    patch.brandColor = [label(item), item.size].filter(Boolean).join(" — ");
    if (item.price != null) patch.priceSqft = String(item.price);
  }
  return patch;
}

// Current stock price for the field the snapshot filled.
const stockPrice = (item) => (item.type && item.priceSqft != null ? round2(item.priceSqft) : item.price);

// Non-null when the product row's snapshotted price no longer matches the
// stock list: { from, to }. Manual price edits count as drift too — the chip
// just says what the book says now; applying it is always deliberate.
export function stockDrift(item, product) {
  if (!item) return null;
  const cur = parseFloat(product.priceSqft);
  const now = stockPrice(item);
  if (now == null || !Number.isFinite(cur)) return null;
  return Math.abs(cur - now) > 0.005 ? { from: cur, to: now } : null;
}

// --- import diff -----------------------------------------------------------------

const FIELDS = ["description", "brand", "product", "color", "unit", "size", "thickness", "type", "price", "priceSqft", "sfPerUnit", "coverage", "discontinued"];

// Compare freshly parsed items against the current table rows.
//   added:   SKUs not in the table
//   changed: SKUs whose data differs (with per-field before/after for price)
//   missing: active table SKUs absent from this parse — marked inactive on
//            apply, never deleted (rows referencing them keep working)
export function diffStock(existing, parsed) {
  const bySku = new Map(existing.map((it) => [it.sku, it]));
  const seen = new Set();
  const added = [], changed = [], unchanged = [];
  for (const it of parsed) {
    seen.add(it.sku);
    const prev = bySku.get(it.sku);
    if (!prev) { added.push(it); continue; }
    const diffs = FIELDS.filter((f) => (prev[f] ?? null) !== (it[f] ?? null));
    if (diffs.length || !prev.active) changed.push({ item: it, prev, fields: diffs });
    else unchanged.push(it);
  }
  const missing = existing.filter((it) => it.active && !seen.has(it.sku));
  return { added, changed, missing, unchanged };
}

// --- catalog price sync ------------------------------------------------------------

const squash = (s) => str(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// A catalog product matches a stock item when every word of its name appears
// in the item's text (spaces ignored, so "FloorMuffler" finds "Floor Muffler").
const itemMatches = (name, it) => {
  const target = squash([it.description, it.product, it.brand, it.section, it.note].join(" "));
  const words = str(name).toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => target.includes(squash(w)));
};

// Update ADR-0002 catalog prices from the price book, by name — the same link
// jobs use. Deliberately conservative: a product only updates when its matches
// all agree on one price (several colors of one grout are fine; "ProLite"
// matching both ProLite and ProLite Rapid Set is not).
export function syncCatalogPrices(catalog, items) {
  const changes = [];
  const priced = items.filter((it) => it.active !== false && !it.discontinued && it.price != null);
  const companies = (catalog?.companies || []).map((co) => {
    const syncKind = (list) => (list || []).map((p) => {
      const matches = priced.filter((it) => itemMatches(p.name, it));
      const prices = [...new Set(matches.map((it) => it.price))];
      if (prices.length !== 1) return p;
      const to = prices[0];
      const from = parseFloat(p.price) || 0;
      if (Math.abs(from - to) <= 0.005) return p;
      changes.push({ name: p.name, from, to, sku: matches[0].sku });
      return { ...p, price: to };
    });
    return { ...co, grouts: syncKind(co.grouts), mortars: syncKind(co.mortars), underlayments: syncKind(co.underlayments) };
  });
  return { catalog: { companies }, changes };
}
