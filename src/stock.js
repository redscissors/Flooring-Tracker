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

// The per-sq-ft price a stock item carries: the book's SF price when present,
// else derived from the carton/sheet price and its coverage — mosaic sheets
// (U/M "SH") often list only a sheet price.
export const stockPriceSqft = (item) =>
  item.priceSqft != null ? item.priceSqft
    : item.price != null && item.sfPerUnit > 0 ? Math.round((item.price / item.sfPerUnit) * 10000) / 10000
      : null;

// The snapshot patch a picked stock item applies to a product row. Flooring
// items fill their real type; everything else lands as a Miscellaneous line
// (description + flat price), which is how the app already models one-off
// count/accessory charges.
export function stockPatch(item, product) {
  const patch = { sku: item.sku };
  const psf = item.type ? stockPriceSqft(item) : null;
  if (item.type && (psf != null || item.unit === "CT" || item.unit === "SH")) {
    patch.type = item.type;
    patch.qtyType = "sqft";
    patch.brandColor = label(item);
    if (psf != null) patch.priceSqft = String(round2(psf));
    if (item.sfPerUnit > 0) { patch.cartonSf = String(item.sfPerUnit); patch.cartonUnit = item.unit || "CT"; }
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
const stockPrice = (item) => {
  const psf = item.type ? stockPriceSqft(item) : null;
  return psf != null ? round2(psf) : item.price;
};

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

// --- Laticrete base-unit companions ---------------------------------------------

// A Spectralock Part C or Permacolor Color Kit item is only the pigment — it is
// mixed into a base unit sold on its own SKU. Both live in the price book's
// "Bulk & Base Units" section, so the pairing stays data-driven (no hardcoded
// SKUs): the pigment auto-adds the default base, which the row can toggle to the
// alternate variant.
const isBaseUnit = (it) => /bulk & base|base unit/i.test(it.section || "");
const baseFamily = (it) => {
  const t = `${it.product || ""} ${it.description || ""}`;
  return /spectralock/i.test(t) ? "spectralock" : /permacolor/i.test(t) ? "permacolor" : null;
};
const familyBases = (stock, family) =>
  stock.filter((it) => it.active && !it.discontinued && isBaseUnit(it) && baseFamily(it) === family);

// The base unit to auto-add when a pigment is picked, or null for anything that
// needs none (Latasil caulk, the base units themselves, ordinary flooring).
// Default variant: Full for Spectralock, Sanded for PermaColor.
export function stockCompanionBase(item, stock) {
  if (!item || isBaseUnit(item)) return null;
  const t = `${item.product || ""} ${item.description || ""}`.toLowerCase();
  let family, isDefault;
  if (/spectralock/.test(t) && /part\s*c/.test(t)) { family = "spectralock"; isDefault = (b) => /full/i.test(b.description); }
  else if (/permacolor/.test(t) && /color\s*kit/.test(t)) { family = "permacolor"; isDefault = (b) => /(^|[^n])sanded/i.test(b.description); }
  else return null;
  const fam = familyBases(stock, family);
  return fam.find(isDefault) || fam[0] || null;
}

// The sibling base variant a base-unit row can switch to (Full ↔ Comm, Sanded ↔
// Unsanded), or null. Each family ships exactly two variants.
export function stockBaseVariant(item, stock) {
  if (!item || !isBaseUnit(item)) return null;
  const family = baseFamily(item);
  if (!family) return null;
  return familyBases(stock, family).find((b) => b.sku !== item.sku) || null;
}

// The catalog `base` companion (ADR 0006) to attach to a grout product when it
// is added/refreshed from a picked price-book pigment: its default base at the
// 1:1 ratio. Returns null when the picked item needs no base. The Settings base
// editor can later swap to the Commercial variant (per 4) via stockBaseVariant.
export function stockBaseCompanion(item, stock) {
  const base = stockCompanionBase(item, stock);
  if (!base) return null;
  return { sku: base.sku, name: base.description || base.product, unit: base.unit || "units", price: base.price ?? 0, per: 1 };
}

// --- Grout color families (ADR 0007) ----------------------------------------------

// The Grout & Caulk sheet parses to one item per family × color, each with its
// own SKU (`parseGroutMatrix`). A catalog grout links to a family by the items'
// `product` name; the job's color dropdown lists that family's colors and the
// pick snapshots the color's SKU onto the selection. Live items only — a color
// retired by a re-import stops being offered for NEW picks, while rows that
// already hold its SKU keep their snapshot (same rule as searchStock).
const isGroutColorItem = (it) => it.sheet === "Grout & Caulk" && !!it.product && !!it.color;

export function groutFamilies(stock) {
  const fams = new Map();
  for (const it of stock) {
    if (!it.active || it.discontinued || !isGroutColorItem(it)) continue;
    const f = fams.get(it.product) || { product: it.product, brand: it.brand || "", price: null, colors: [] };
    f.colors.push({ color: it.color, sku: it.sku });
    if (f.price == null && it.price != null) f.price = it.price;
    fams.set(it.product, f);
  }
  return [...fams.values()].sort((a, b) => a.product.localeCompare(b.product));
}

// The stock item behind one color of a family (for the SKU snapshot at pick
// time). Case-insensitive on both keys — colors are title-cased at parse but
// hand-linked family names may differ in case.
export function groutColorItem(stock, family, color) {
  const f = str(family).toLowerCase(), c = str(color).toLowerCase();
  if (!f || !c) return null;
  return stock.find((it) => isGroutColorItem(it) && it.product.toLowerCase() === f && it.color.toLowerCase() === c) || null;
}

// The color-matched caulk for a family color: the same matrix section's caulk
// column in that color (Latasil Caulk, TEC Caulk…). Snapshot source for
// grout.caulkSku at color-pick time; null when the section carries no caulk
// column or doesn't offer it in that color. Live items only, like the color
// dropdown itself.
export function groutCaulkItem(stock, family, color) {
  const g = groutColorItem(stock, family, color);
  if (!g || !g.section) return null;
  if (/caulk/i.test(g.product)) return g;
  return stock.find((it) => it.active && !it.discontinued && isGroutColorItem(it) && /caulk/i.test(it.product) && it.section === g.section && it.color.toLowerCase() === g.color.toLowerCase()) || null;
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
  const bySku = new Map(priced.map((it) => [it.sku, it]));
  const companies = (catalog?.companies || []).map((co) => {
    const syncKind = (list) => (list || []).map((p) => {
      // A product that carries a SKU (ADR 0006) refreshes from that exact item;
      // otherwise fall back to the conservative unique-name match.
      let to, sku;
      const linked = str(p.sku) ? bySku.get(str(p.sku)) : null;
      if (linked) { to = linked.price; sku = linked.sku; }
      else {
        const matches = priced.filter((it) => itemMatches(p.name, it));
        const prices = [...new Set(matches.map((it) => it.price))];
        if (prices.length !== 1) return p;
        to = prices[0]; sku = matches[0].sku;
      }
      const from = parseFloat(p.price) || 0;
      if (Math.abs(from - to) <= 0.005) return p;
      changes.push({ name: p.name, from, to, sku });
      return { ...p, price: to };
    });
    return { ...co, grouts: syncKind(co.grouts), mortars: syncKind(co.mortars), underlayments: syncKind(co.underlayments) };
  });
  return { catalog: { ...catalog, companies }, changes };
}
