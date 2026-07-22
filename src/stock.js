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
const round4 = (n) => Math.round(n * 10000) / 10000;

export const normStockItem = (row) => ({
  sku: str(row.sku),
  active: row.active !== false,
  disabled: row.disabled === true,
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
  sheetSize: str(row.data?.sheetSize),
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
// fields (sku, active, disabled, updated_at).
export const stockData = ({ sku, active, updatedAt, disabled, ...data }) => data;

// --- search -------------------------------------------------------------------

const hay = (it) => [it.sku, it.description, it.brand, it.product, it.color, it.section, it.sheet, it.size, it.sheetSize, it.note].join(" ").toLowerCase();

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
    if (!it.active || it.discontinued || it.disabled) continue;
    const h = hay(it);
    const ok = /^\d+$/.test(q) ? it.sku.startsWith(q) : words.every((w) => wordHit(h, w));
    if (ok) out.push(it);
  }
  return out;
}

export const findStock = (items, sku) => (str(sku) ? items.find((it) => it.sku === str(sku)) : null) || null;

// --- filling a product row ------------------------------------------------------

// "12x24", '2x8"', "4X12", "2 x 6" → [L, W]; also the L×W inside a size that
// carries a trailing word ('4" x 4" Nominal', '8"x9" Hex') so those fill the
// tile size cells instead of being shoved into the color name; anything with no
// L×W ('6"', "Esagonia", "2\" Hex") → null.
export const parseTileSize = (size) => {
  // Each dim also accepts a leading-decimal with no leading zero (".43x12") —
  // vendors that map their own size column (Mannington/Glazzio PDF) can print
  // pencil/edge widths that way, and the digit-first pattern used to read ".43"
  // as "43". The leading-decimal alt is second so a match starting at the dot
  // claims the whole ".43" instead of stopping at the "43".
  const m = str(size).match(/(\d+(?:\.\d+)?|\.\d+)\s*["']?\s*[x×]\s*(\d+(?:\.\d+)?|\.\d+)/i);
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

// A price-book item can distinguish the unit its COST is quoted in (priceUnit)
// from the smallest unit the vendor will SELL (orderUnit) — the Virginia Tile
// sheet has both. Single-U/M books (the stock workbook, every already-saved
// item) map neither, so both fall back to `unit` and behavior is unchanged
// (ADR 0009 amendment 2026-07-13).
export const priceUnitOf = (item) => str(item?.priceUnit) || str(item?.unit);
export const orderUnitOf = (item) => str(item?.orderUnit) || str(item?.unit);

// Unit classes for the split: piece-ish units are quoted per single
// piece/sheet/each/stick; carton-ish units bundle pcPerUnit of them.
const PIECE_UNIT_RE = /^(pc|pcs|piece|ea|each|sh|sht|sheet|st|stick)s?$/i;
const CARTON_UNIT_RE = /^(ct|ctn|carton|bx|box)s?$/i;
export const isPieceUnit = (u) => PIECE_UNIT_RE.test(str(u));
export const isCartonUnit = (u) => CARTON_UNIT_RE.test(str(u));

// In a book that carries PC/CT, SF/CT coverage is per CARTON while a piece-ish
// price is per single piece — money relative to sfPerUnit must scale by
// pieces-per-carton first. (VTC: a $27.99/pc bullnose in an 8-pc, 5.38-sf
// carton costs $41.62/sqft, not $27.99 ÷ 5.38 = $5.20.) Books without
// pcPerUnit (the stock workbook) quote sfPerUnit per the priced unit itself,
// so they keep factor 1.
export const perCartonFactor = (item) => (isPieceUnit(priceUnitOf(item)) && item.pcPerUnit > 0 ? item.pcPerUnit : 1);


// The per-sq-ft price a stock item carries: the book's SF price when present,
// else derived from the carton/sheet price and its coverage — mosaic sheets
// (U/M "SH") often list only a sheet price.
export const stockPriceSqft = (item) =>
  item.priceSqft != null ? item.priceSqft
    : item.price != null && item.sfPerUnit > 0 ? round4((item.price * perCartonFactor(item)) / item.sfPerUnit)
      : null;

// Whether a picked item fills a real flooring line (sqft math) or a flat count
// line: it needs a type AND either a per-sqft price or coverage to compute one
// from. A typed trim priced per piece with no SF/CT has neither — pretending
// it covers area made it a $0 line before 2026-07.
export const fillsFlooring = (item) => !!item?.type && (stockPriceSqft(item) != null || item.sfPerUnit > 0);

// A non-rectangular tile size (a hex "2\" Hex") has no L×W cell to land in, but
// grout/mortar still need a proxy. deriveSquareDim returns the single dimension
// to square off (background L = W = N) ONLY when the item is unambiguously a
// small area tile — else null, so the size reads as free text with no coverage.
// This is the firewall keeping a 94" trim stick from becoming a fake coverage
// item, and the mosaic carve-out keeps a "Penny Round Mosaic" sheet from
// deriving 12×12 (a mosaic has far more joint per sqft than its sheet size).
const SHAPE_WORD_RE = /\b(hex|hexagon|penny|round|octagon)\b/i;
const TRIMISH_RE = /reducer|t-mold|bullnose|stairnos|threshold|transition|\btrim\b/i;
const MOSAIC_RE = /mosaic/i;
const LINEAR_UNIT_RE = /^(lf|lft|lnft|ln|pc|pcs|piece|ea|each)$/i;

export function deriveSquareDim(item) {
  if (!item || item.type !== "tile") return null;
  const size = str(item.size);
  if (!SHAPE_WORD_RE.test(size)) return null;
  const text = `${size} ${str(item.description)} ${str(item.product)}`;
  if (TRIMISH_RE.test(text)) return null;
  // A piece-sold item with real sq-ft coverage is a mosaic SHEET, not a trim
  // stick — the book prints SF/PC for sheets and N/A for sticks — so only a
  // coverage-less piece unit stays behind the firewall (ticket 010 amendment).
  if (!(item.sfPerUnit > 0) && (LINEAR_UNIT_RE.test(orderUnitOf(item)) || LINEAR_UNIT_RE.test(priceUnitOf(item)))) return null;
  // The chip dimension can be a mixed fraction ('1-1/2" Hex') or a bare one
  // ('3/4" Penny') — bare tries first so the match can't stop at the "3" of "3/4".
  const m = size.match(/(\d+)\/(\d+)|(\d+(?:\.\d+)?)(?:-(\d+)\/(\d+))?/);
  if (!m) return null;
  const n = m[1] ? +m[1] / +m[2] : parseFloat(m[3]) + (m[4] ? +m[4] / +m[5] : 0);
  // A shape size is per-chip by construction (sheet sizes print as L×W), so a
  // "mosaic" item may derive too — but only at chip scale, so a sheet-scale
  // '12" Hex Mosaic' can never fake coverage (ticket 010 amendment to 009).
  if (!(n > 0) || n > (MOSAIC_RE.test(text) ? 6 : 24)) return null;
  return n;
}

// The snapshot patch a picked stock item applies to a product row. Flooring
// items fill their real type; everything else lands as a Miscellaneous line
// (description + flat price), which is how the app already models one-off
// count/accessory charges.
export function stockPatch(item, product) {
  const patch = { sku: item.sku };
  const psf = item.type ? stockPriceSqft(item) : null;
  const orderUnit = orderUnitOf(item);
  // A mosaic backing sheet (ADR 0014) is one sheet per "piece" whatever the book
  // calls the No-Broken unit: VTC lists the same marble hex as SH on the matte
  // row and PC on the polished one. Either way each piece is a sheet with real
  // coverage, so it orders in whole sheets by the sheet's own SF — the PC spelling
  // must match its SH sibling, not fall through to loose exact-area ordering.
  const sheetUnit = /^(sh|sht|sheet)s?$/i.test(orderUnit) || (!!item.sheetSize && isPieceUnit(orderUnit));
  // An explicit "No Broken" unit of PC/EA means the vendor sells loose pieces —
  // order the exact area, never round up to whole cartons. Only a separately
  // mapped orderUnit triggers this, so single-U/M books never change.
  const looseOrder = /^(pc|pcs|piece|ea|each)$/i.test(str(item.orderUnit)) && !sheetUnit;
  if (fillsFlooring(item)) {
    patch.type = item.type;
    patch.qtyType = "sqft";
    patch.brandColor = label(item);
    if (psf != null) patch.priceSqft = String(round2(psf));
    if (item.sfPerUnit > 0 && !looseOrder) {
      // sfPerUnit is SF/CT — coverage per CARTON. When the sell unit is a sheet
      // (a mosaic's "No Broken U/M" = SH, or a PC that is really a backing sheet),
      // one sheet covers SF/CT ÷ pieces-per-carton, not the whole carton; without
      // this the row orders ~PC/CT× too few sheets and rounds to full-carton
      // chunks (VTC EFT books). Stock-book items carry no pcPerUnit, so their
      // per-sheet coverage is left as-is.
      const perSell = sheetUnit && item.pcPerUnit > 0
        ? round4(item.sfPerUnit / item.pcPerUnit)
        : item.sfPerUnit;
      patch.cartonSf = String(perSell);
      patch.cartonUnit = orderUnit || "CT";
    }
    if (item.type === "tile") {
      if (item.sheetSize) {
        // A mosaic sheet: show the sheet size as free text and leave L×W blank so
        // the row prompts for the chip size grout/mortar compute from (ADR 0014).
        patch.sizeText = `${item.sheetSize} sheet`;
      } else {
        const lw = parseTileSize(item.size);
        if (lw) { patch.L = lw[0]; patch.W = lw[1]; }
        else if (item.size) {
          patch.sizeText = item.size;               // display the vendor string, e.g. "2\" Hex"
          const n = deriveSquareDim(item);          // null unless the coverage guard passes
          if (n != null) { patch.L = String(n); patch.W = String(n); }
        }
      }
      const th = parseThickness(item.thickness);
      if (th) patch.thickness = th;
    } else {
      patch.sizeText = item.size;
    }
  } else {
    patch.type = "misc";
    // A count line prices and quotes per PIECE (ADR 0013 amendment) — the
    // salesperson enters how many pieces the job needs. A carton-only sell
    // unit (No Broken = CT) doesn't change the price basis; it rounds the
    // ordered count up to whole cartons of PC/CT via cartonPc, the piece-count
    // twin of cartonSf.
    patch.brandColor = label(item);
    if (item.size) patch.sizeText = str(item.size); // its own Size field, not glued to the name
    if (item.price != null) patch.priceSqft = String(item.price);
    if (isCartonUnit(orderUnitOf(item)) && item.pcPerUnit > 0) {
      patch.cartonPc = String(item.pcPerUnit);
      patch.cartonUnit = orderUnitOf(item) || "CT";
    }
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
  stock.filter((it) => it.active && !it.discontinued && !it.disabled && isBaseUnit(it) && baseFamily(it) === family);

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
    if (!it.active || it.discontinued || it.disabled || !isGroutColorItem(it)) continue;
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
  return stock.find((it) => it.active && !it.discontinued && !it.disabled && isGroutColorItem(it) && /caulk/i.test(it.product) && it.section === g.section && it.color.toLowerCase() === g.color.toLowerCase()) || null;
}

// The full ADR-0007 pick snapshot in one place: the color's own SKU plus the
// color-matched caulk's SKU and price. Every surface that picks a book-linked
// grout color spreads this, so the patch shape can't drift between them.
export function groutSnapshotPatch(stock, family, color) {
  const it = groutColorItem(stock, family, color);
  const ck = groutCaulkItem(stock, family, color);
  return { sku: it ? it.sku : "", caulkSku: ck ? ck.sku : "", caulkPrice: ck && ck.price != null ? String(ck.price) : "" };
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
  const priced = items.filter((it) => it.active !== false && !it.discontinued && !it.disabled && it.price != null);
  const bySku = new Map(priced.map((it) => [it.sku, it]));
  const companies = (catalog?.companies || []).map((co) => {
    const syncKind = (list) => (list || []).map((p) => {
      // ADR 0027: a product carrying an ERP stock-book `link` is superseded by
      // syncLinkedCatalog (booklink.js) — this legacy text-match sync must
      // never clobber it. `link` normalizes to null-or-complete, so a plain
      // truthiness check is enough (no need to import booklink.js here).
      if (p.link) return p;
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
    return { ...co, grouts: syncKind(co.grouts), mortars: syncKind(co.mortars), underlayments: syncKind(co.underlayments), ...(co.attached ? { attached: syncKind(co.attached) } : {}) };
  });
  return { catalog: { ...catalog, companies }, changes };
}
