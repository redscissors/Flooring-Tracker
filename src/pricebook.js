// Parser for the shop's stock price book workbook (.xlsx) — ADR 0003.
//
// The workbook is the team's hand-maintained document, one sheet per product
// family, each with its own layout. This module turns it into flat stock items
// keyed by SKU. It deliberately takes plain arrays-of-arrays (SheetJS
// `sheet_to_json({ header: 1 })` output), not a SheetJS workbook, so it is
// testable without the xlsx dependency.
//
// Layouts handled:
//  - "table" sheets: repeated sections of [title row] + [header row containing
//    "SKU"] + data rows. Header names map to fields; unknown columns (and the
//    hyperlink "Index" sidebar) are ignored. Covers Accessories, Hardwood,
//    Wood Vents, Vinyl, Tile, Tile-Mortar.
//  - Mann Aduramax: fixed columns, one flooring item per row plus four
//    companion trim SKUs (reducer/t-mold/end cap/stairnose) with no prices.
//  - Grout & Caulk: color × product matrices (price per column, SKU per cell).
//  - Tile Seats, Curbs, Trims: simple [SKU, ...text..., price] rows plus
//    color-coded Schluter matrices.
//
// A row is only ever consumed if its SKU cell looks like a real SKU, so a
// re-arranged sheet degrades to "items went missing" (visible in the import
// diff preview) rather than garbage rows.

import { normOrderItem, unitComboWarnings, importSanityWarnings, classifyTrim } from "./orderbook.js";

const SKU_RE = /^\d{4,8}$/;
const str = (c) => (c == null ? "" : String(c).trim());
const isSku = (c) => SKU_RE.test(str(c));
const numOrNull = (c) => {
  if (c == null || c === "") return null;
  const n = typeof c === "number" ? c : parseFloat(String(c).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const round4 = (n) => (n == null ? null : Math.round(n * 10000) / 10000);

// Header-name → item field. Compared lowercased with spaces/punctuation
// collapsed, so "Retail ", "SF Price" and "Price / SF" all land.
const HEADER_FIELDS = {
  sku: "sku",
  um: "unit",
  size: "size",
  thickness: "thickness",
  width: "size",
  description: "description",
  decription: "description", // the sheet's long-standing typo
  desc: "description",
  color: "color",
  species: "color",
  style: "style",
  brand: "brand",
  type: "subtype",
  retail: "price",
  retailprice: "price", // the Schluter/Wedi shop stock sheets' price header
  price: "price",
  ctprice: "price",
  sfprice: "priceSqft",
  pricesf: "priceSqft",
  sfct: "sfPerUnit",
  sfctn: "sfPerUnit",
  coverage: "coverage",
  qty: "packQty",
  notes: "note",
  part: "part",
};
const headerField = (cell) => {
  const key = str(cell).toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_FIELDS[key] || null;
};
const isHeaderRow = (row) => row.some((c) => str(c).toUpperCase() === "SKU");

// Flooring type each sheet's items fill on a product row; null = accessory /
// material (fills as a Miscellaneous line).
const SHEET_TYPE = { Hardwood: "hardwood", Vinyl: "vinyl", Tile: "tile" };

const DISC_RE = /^disc(ontinued|out)?\.?$/i;
// "DISC" / "Disc" markers often sit in a column with no header, so tables also
// check the whole row; "Being Withdrawn" only ever appears in Notes.
const rowDisc = (row) => row.some((c) => DISC_RE.test(str(c)));

export function parsePriceBook(sheets) {
  const items = [];
  const warnings = [];
  for (const { name, rows } of sheets || []) {
    if (!rows || !rows.length) continue;
    if (name === "Index") continue;
    if (name === "Mann Aduramax") parseAduramax(rows, items);
    else if (name === "Grout & Caulk") parseGroutMatrix(rows, items);
    else if (name === "Tile Seats, Curbs, Trims") parseSeatsCurbsTrims(rows, items);
    else parseTables(name, rows, items, warnings);
  }
  return { items: dedupe(items, warnings), warnings };
}

// The shop workbook is recognized by its hand-built sheet names — the special
// parsers key off these exact names (parsePriceBook above), and no vendor file
// carries them. Two or more distinctive names present ⇒ it's the stock workbook.
// Used by the multi-file drop router (PR C) to route a dropped workbook to the
// stock import instead of a registry book.
export const STOCK_SHEET_NAMES = ["Grout & Caulk", "Mann Aduramax", "Tile Seats, Curbs, Trims", "Hardwood", "Vinyl", "Tile", "Index"];
export function detectStockWorkbook(sheets) {
  const names = new Set((sheets || []).map((s) => s.name));
  return STOCK_SHEET_NAMES.filter((n) => names.has(n)).length >= 2;
}

// --- generic sectioned tables -------------------------------------------------

function parseTables(sheet, rows, items, warnings) {
  let cols = null; // column index → field
  let skuCol = -1;
  let lastCol = -1; // rightmost mapped column — cells beyond it are the sidebar
  let section = "";
  let title = "";
  let carry = {}; // last seen color/style per section (Vinyl trim groups)
  let sawSku = false;

  for (const row of rows) {
    if (isHeaderRow(row)) {
      cols = {};
      skuCol = -1;
      lastCol = -1;
      let ignoreFrom = Infinity; // the "Index" hyperlink sidebar and beyond
      row.forEach((c, i) => {
        if (str(c).toLowerCase() === "index") { ignoreFrom = Math.min(ignoreFrom, i); return; }
        if (i >= ignoreFrom) return;
        const f = headerField(c);
        if (f === "sku") skuCol = i;
        else if (f && !(f in invert(cols))) cols[i] = f;
        if (f) lastCol = Math.max(lastCol, i);
      });
      section = title;
      carry = {};
      continue;
    }
    if (!cols) {
      // Before the first header only titles appear.
      const t = firstText(row, 2);
      if (t) title = t;
      continue;
    }
    const skuish = skuCol >= 0 ? row[skuCol] : null;
    if (isSku(skuish)) {
      sawSku = true;
      const raw = { extra: [] };
      for (let i = 0; i <= lastCol && i < row.length; i++) {
        const v = row[i];
        if (v == null || str(v) === "" || i === skuCol) continue;
        const f = cols[i];
        if (f) { if (raw[f] == null) raw[f] = v; }
        // Text in a headerless column inside the table (e.g. the VinPro finish
        // names) still belongs to the item.
        else if (!isNumericText(str(v)) && !DISC_RE.test(str(v))) raw.extra.push(str(v));
      }
      if (raw.color) carry.color = str(raw.color); else if (carry.color) raw.color = carry.color;
      items.push(tableItem(sheet, section, raw, str(skuish), rowDisc(row)));
    } else {
      const t = firstText(row, 2);
      // A text-only row inside a table is a sub-group label (e.g. a Vinyl trim
      // color) when short, or a new section title awaiting its header row.
      if (t) { title = t; carry = { color: t }; }
    }
  }
  if (!sawSku) warnings.push(`Sheet "${sheet}": no items recognized — was its layout changed?`);
}

const invert = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));

const isNumericText = (v) => /^\$?\d[\d.,]*$/.test(v);
const firstText = (row, maxCol) => {
  for (let i = 0; i < row.length; i++) {
    const v = str(row[i]);
    if (v) return i <= maxCol && !isSku(v) && !isNumericText(v) ? v : null;
  }
  return null;
};

// Typed sheets are sectioned by brand ("Sheoga", "Marazzi Rice"), except these
// grouping headers, which shouldn't masquerade as a brand.
const GENERIC_SECTION = /introduction|wood look|floating floor|trim|moulding|misc/i;

function tableItem(sheet, section, raw, sku, disc) {
  const type = SHEET_TYPE[sheet] || null;
  const descBits = [str(raw.description), str(raw.color), str(raw.style), ...(raw.extra || []), str(raw.part)].filter(Boolean);
  const price = numOrNull(raw.price);
  const noteBits = [str(raw.note)];
  if (raw.price != null && price == null) noteBits.push(str(raw.price)); // "See Catalyst"
  const discontinued = disc || /withdrawn/i.test(str(raw.note));
  return norm({
    sku, sheet, section,
    brand: str(raw.brand) || (type && !GENERIC_SECTION.test(section) ? section : ""),
    description: descBits.join(" — "),
    unit: str(raw.unit),
    size: str(raw.size),
    thickness: str(raw.thickness),
    subtype: str(raw.subtype),
    price,
    priceSqft: numOrNull(raw.priceSqft),
    sfPerUnit: numOrNull(raw.sfPerUnit),
    coverage: numOrNull(raw.coverage),
    type,
    discontinued,
    note: noteBits.filter(Boolean).join(" · "),
  });
}

// --- Mann Aduramax --------------------------------------------------------------

const ADURA_TRIMS = [[7, "Reducer"], [8, "T-Mold"], [9, "End Cap"], [10, "Stairnose"]];

function parseAduramax(rows, items) {
  let size = "";
  let line = "Mannington Aduramax";
  // Trim prices sit in a single unlabeled row at the bottom of each visual
  // group (one price per trim column, shared by every color above it), so the
  // group's trim rows wait here until that row is seen.
  let pending = []; // { item, col }
  const flush = (priceRow) => {
    if (priceRow) for (const { item, col } of pending) { const p = numOrNull(priceRow[col]); if (p != null) item.price = round2(p); }
    pending = [];
  };
  for (const row of rows) {
    const name = str(row[0]);
    const disc = row.some((c) => DISC_RE.test(str(c)));
    if (name && !isSku(row[2]) && !ADURA_TRIMS.some(([i]) => isSku(row[i]))) {
      flush(null);
      const m = name.match(/^(\d+x\d+)\s/i);
      if (m) size = m[1];
      if (/apex/i.test(name)) { line = "Mannington Adura Apex"; size = ""; }
      continue;
    }
    if (!name && !isSku(row[2]) && !ADURA_TRIMS.some(([i]) => isSku(row[i])) && ADURA_TRIMS.some(([i]) => numOrNull(row[i]) != null)) {
      flush(row);
      continue;
    }
    if (!name) continue;
    if (isSku(row[2])) {
      items.push(norm({
        sku: str(row[2]), sheet: "Mann Aduramax", section: line,
        brand: line, description: name, style: str(row[1]),
        unit: "CT", size,
        price: numOrNull(row[5]), priceSqft: numOrNull(row[6]), sfPerUnit: numOrNull(row[3]),
        type: "vinyl", discontinued: disc,
      }));
    }
    for (const [i, label] of ADURA_TRIMS) {
      if (!isSku(row[i])) continue;
      const trim = norm({
        sku: str(row[i]), sheet: "Mann Aduramax", section: `${line} trims`,
        brand: line, description: `${name} — ${label}`,
        unit: "EA", type: null, discontinued: disc,
      });
      items.push(trim);
      pending.push({ item: trim, col: i });
    }
  }
  flush(null);
}

// --- Grout & Caulk color matrices ---------------------------------------------

function parseGroutMatrix(rows, items) {
  let title = "";
  let cols = null; // [{ i, name }]
  let prices = null; // by column index
  let seen = null; // sku → item within the current matrix
  let baseCols = null; // Laticrete "Bulk & Base Units": { size, sku, price } column indices
  for (const row of rows) {
    const c0 = str(row[0]).toUpperCase();
    if (c0 === "COLOR#") {
      cols = [];
      row.forEach((c, i) => { const v = collapse(str(c)); if (i > 0 && v) cols.push({ i, name: v }); });
      prices = null;
      seen = new Map();
      baseCols = null;
      continue;
    }
    // A separately-laid-out sub-table (Laticrete base/bulk units): ITEM | SIZE |
    // SKU | PRICE, one base unit per row (SpectraLock Full/Comm, PermaColor
    // Sanded/Unsanded) — the material a Part C or Color Kit pigment is mixed
    // into, sold on its own SKU.
    if (c0 === "ITEM") {
      baseCols = {};
      row.forEach((c, i) => {
        const k = str(c).toLowerCase();
        if (i === 0) return;
        if (/size/.test(k)) baseCols.size = i;
        else if (k === "sku") baseCols.sku = i;
        else if (/price/.test(k)) baseCols.price = i;
      });
      cols = null; prices = null;
      continue;
    }
    if (baseCols) {
      const sku = str(row[baseCols.sku]);
      if (isSku(sku)) {
        const variant = collapse(str(row[0])); // "SpectraLock Full Unit"
        items.push(norm({
          sku, sheet: "Grout & Caulk", section: title,
          brand: "Laticrete", product: `Laticrete ${variant}`.trim(),
          description: variant, style: variant.replace(/^(spectralock|permacolor)\s*/i, ""),
          size: str(row[baseCols.size]), unit: "EA",
          price: numOrNull(row[baseCols.price]), type: null,
        }));
        continue;
      }
      const t = firstText(row, 1);
      if (t) { title = t; baseCols = null; }
      continue;
    }
    if (!cols) {
      const t = firstText(row, 1);
      if (t) title = t;
      continue;
    }
    if (c0 === "PRICE") {
      if (!prices) { prices = {}; cols.forEach(({ i }) => { prices[i] = numOrNull(row[i]); }); }
      continue;
    }
    const color = str(row[0]).replace(/^\d+\s*/, "");
    if (!color || !cols.some(({ i }) => isSku(row[i]))) {
      const t = firstText(row, 1);
      if (t && !cols.some(({ i }) => isSku(row[i]))) { title = t; cols = null; }
      continue;
    }
    // Laticrete colors are known by their number ("85 Almond"), and the label
    // reads color-first ("85 Almond Spectralock Part C"); the TEC/Custom Epoxy
    // matrices keep their long-standing "Product — Color" form.
    const isLat = /laticrete/i.test(title);
    for (const { i, name } of cols) {
      if (!isSku(row[i])) continue;
      let it;
      if (isLat) {
        const colorFull = titleCase(str(row[0]));
        const variant = titleCase(name);
        it = norm({
          sku: str(row[i]), sheet: "Grout & Caulk", section: title,
          brand: "Laticrete", description: `${colorFull} ${variant}`,
          product: `Laticrete ${variant}`, color: colorFull,
          unit: "EA", price: prices ? prices[i] : null, type: null,
        });
      } else {
        const productName = `${title.replace(/grout & caulk/i, "").trim() || title} ${titleCase(name)}`.trim();
        it = norm({
          sku: str(row[i]), sheet: "Grout & Caulk", section: title,
          brand: title, description: `${productName} — ${titleCase(color)}`,
          product: productName, color: titleCase(color),
          unit: "EA", price: prices ? prices[i] : null,
          type: null,
        });
      }
      // One SKU spanning several color rows (Custom Epoxy Part B) is not a
      // color-specific item — drop the first row's color from it.
      const prev = seen.get(it.sku);
      if (prev) {
        if (prev.color && prev.color !== it.color) { prev.description = prev.product; prev.color = ""; }
        continue;
      }
      seen.set(it.sku, it);
      items.push(it);
    }
  }
}

const collapse = (s) => str(s).replace(/\s+/g, " ").trim();

const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// --- Tile Seats, Curbs, Trims ---------------------------------------------------

function parseSeatsCurbsTrims(rows, items) {
  let section = "";
  let matrix = null; // { labels: {i: sizeLabel}, priceCol }
  let matrixShapes = null; // shelf matrix: column index → shape name
  let matrixColor = "";
  for (const row of rows) {
    const c0 = str(row[0]);
    if (/pricing is color coded/i.test(c0)) {
      matrix = { labels: {}, priceCol: -1 };
      row.forEach((c, i) => {
        const v = str(c);
        if (i > 0 && v && /pricing/i.test(v)) matrix.priceCol = i;
        else if (i > 0 && v) matrix.labels[i] = v;
      });
      continue;
    }
    if (isSku(row[0])) {
      // Plain row: [SKU, ...descriptive text..., price last]
      matrix = null;
      const texts = [];
      let price = null;
      for (let i = 1; i < row.length && i < 9; i++) {
        const v = row[i];
        if (v == null || str(v) === "") continue;
        const n = numOrNull(v);
        if (n != null && str(v) === String(v).trim() && !/["x]/i.test(str(v))) { price = n; break; }
        texts.push(str(v));
      }
      items.push(norm({
        sku: c0, sheet: "Tile Seats, Curbs, Trims", section,
        description: [section, ...texts].filter(Boolean).join(" — "),
        unit: "EA", price, type: null,
      }));
      continue;
    }
    if (matrix && c0) {
      // Color-coded matrix row: [color, '', profile, sku@size..., price]
      const profile = str(row[2]);
      const price = matrix.priceCol >= 0 ? numOrNull(row[matrix.priceCol]) : null;
      let any = false;
      for (const [i, label] of Object.entries(matrix.labels)) {
        if (!isSku(row[Number(i)])) continue;
        any = true;
        items.push(norm({
          sku: str(row[Number(i)]), sheet: "Tile Seats, Curbs, Trims", section,
          description: ["Schluter", profile, label, "—", c0].filter(Boolean).join(" "),
          unit: "EA", price, type: null,
        }));
      }
      if (any) continue;
    }
    // Shelf matrix rows carry SKUs in cols 2+ under shape headers; handled by
    // the generic scan below only when a header row named the shapes.
    if (str(row[1]) && !isSku(row[1]) && row.slice(2).some(isSku) && matrixShapes) {
      const style = str(row[1]);
      row.slice(2).forEach((c, off) => {
        if (!isSku(c)) return;
        const shape = matrixShapes[off + 2] || "";
        items.push(norm({
          sku: str(c), sheet: "Tile Seats, Curbs, Trims", section,
          description: ["Schluter Shelf", shape, style, matrixColor && `— ${matrixColor}`].filter(Boolean).join(" "),
          unit: "EA", price: null, type: null,
        }));
      });
      continue;
    }
    if (row.slice(1).some((c) => str(c)) && !c0 && row.slice(2).every((c) => !isSku(c))) {
      // e.g. ["", "Triangle", "Pentagon", ...] — shelf shape header
      const labels = {};
      row.forEach((c, i) => { if (i >= 2 && str(c) && numOrNull(c) == null) labels[i] = str(c); });
      if (Object.keys(labels).length) matrixShapes = labels;
      continue;
    }
    if (c0 && !matrix && !matrixShapes && row.some(isSku)) {
      // Labeled row with the SKU mid-row (e.g. Renu U Reducer):
      // [color, '', profile, SKU, '', price]
      const texts = [];
      let price = null;
      const skus = [];
      for (const c of row) {
        const v = str(c);
        if (!v) continue;
        if (isSku(v)) { skus.push(v); continue; }
        const n = numOrNull(v);
        if (n != null && !/["x]/i.test(v)) price = n;
        else texts.push(v);
      }
      for (const sku of skus) {
        items.push(norm({
          sku, sheet: "Tile Seats, Curbs, Trims", section,
          description: [section !== texts[0] && section, ...texts].filter(Boolean).join(" — "),
          unit: "EA", price, type: null,
        }));
      }
      continue;
    }
    const t = firstText(row, 1);
    if (t) {
      if (matrixShapes && /\b(EB|TSBG|MBW|TSSG|MGS)\b/i.test(t)) { matrixColor = t.replace(/\s+\S+$/, ""); continue; }
      section = t; matrix = null; matrixShapes = null; matrixColor = "";
    }
  }
}

// --- normalize + dedupe ---------------------------------------------------------

function norm(it) {
  return {
    sku: it.sku,
    sheet: it.sheet || "",
    section: it.section || "",
    brand: it.brand || "",
    description: it.description || "",
    product: it.product || "",
    color: it.color || "",
    style: it.style || "",
    subtype: it.subtype || "",
    unit: it.unit || "",
    size: it.size || "",
    thickness: it.thickness || "",
    type: it.type || null,
    price: round2(it.price ?? null),
    priceSqft: it.priceSqft != null ? Math.round(it.priceSqft * 10000) / 10000 : null,
    sfPerUnit: it.sfPerUnit ?? null,
    coverage: it.coverage ?? null,
    discontinued: !!it.discontinued,
    note: it.note || "",
  };
}

// The same SKU can appear on two sheets (the trowels live under Accessories and
// Tile-Mortar). Keep one row per SKU, preferring the occurrence that has a
// price; disagreeing prices are surfaced as warnings for the team to fix.
function dedupe(items, warnings) {
  const bySku = new Map();
  for (const it of items) {
    const prev = bySku.get(it.sku);
    if (!prev) { bySku.set(it.sku, it); continue; }
    const keep = prev.price == null && it.price != null ? it : prev;
    if (prev.price != null && it.price != null && prev.price !== it.price) {
      warnings.push(`SKU ${it.sku} is listed twice with different prices ($${prev.price} on ${prev.sheet}, $${it.price} on ${it.sheet}) — keeping $${keep.price}.`);
    }
    bySku.set(it.sku, keep);
  }
  return [...bySku.values()];
}

// --- generic mapped import (order books, ADR 0009) ----------------------------
//
// Order books (and future kind='stock' registry books) don't get a hand-built
// per-sheet adapter; the team maps columns once and the mapping is saved on the
// book. This parse takes ONE sheet's rows plus that mapping and produces
// normalized order items (via orderbook's normOrderItem, so the shape can never
// drift from the DB-row loader). The honesty guarantee is unchanged: a row is
// only consumed if its SKU cell matches the book's SKU pattern, so a rearranged
// sheet degrades to visible missing counts in the diff preview, not garbage.
//
// mapping = {
//   columns:     { <colIndex>: <field> } — field ∈ sku, cost, description,
//                unit, priceUnit, orderUnit, size, thickness, mfg, productLine,
//                leadTime, msrp, coverage, sfPerUnit, pcPerUnit, color, style,
//                brand, section, note, type, flag. priceUnit/orderUnit are the
//                two-unit split (ADR 0009 amendment); both fall back to unit.
//                (Headerless columns are labeled by index, so the VTC sheet's
//                description and status columns map fine.)
//   headerRow:   <int>|undefined — rows at and above it are skipped
//   skuPattern:  <string>|undefined — default: 1-20 alphanumerics, ≥1 digit
//   flags:       { <cellValue>: 'discontinued'|'freight'|'madeToOrder'|
//                'transitioning' } — the sheet's status-flag legend
//   defaultType: <'tile'|'hardwood'|'vinyl'|...>|undefined — the flooring type
//                items fill on a product row when no per-item type column exists
// }

// The stock book's /^\d{4,8}$/ would consume zero VTC rows (9-16 alnum codes),
// so each book carries its own pattern; this is the default when none is set.
const DEFAULT_SKU_PATTERN = "^(?=.*\\d)[A-Za-z0-9]{1,20}$";

export function mappedSkuRe(pattern) {
  try { return new RegExp(pattern || DEFAULT_SKU_PATTERN, "i"); }
  catch { return new RegExp(DEFAULT_SKU_PATTERN, "i"); }
}

const colFor = (columns, field) => {
  for (const [i, f] of Object.entries(columns || {})) if (f === field) return Number(i);
  return -1;
};

// --- description → size / thickness / clean name ------------------------------
//
// Vendor tile sheets (Virginia Tile) ship no size column; the LxW and an
// optional thickness live inside the description string
// ("EARTH ASH GRAY 12X24 10MM"). We pull them out at import time so the pick
// fills the tile size cells and the line name reads clean. A description with
// no LxW passes through unchanged — the honest fallback, nothing invented.

// Standard tile/plank thicknesses → the fraction the trade actually calls them,
// which isn't always the nearest 1/16" (20mm is sold as 3/4" though 13/16" is
// arithmetically closer). Anything not listed falls back to nearest 1/16".
const MM_FRACTIONS = { 3: "1/8", 4: "3/16", 5: "3/16", 6: "1/4", 8: "5/16", 9: "3/8", 10: "3/8", 11: "7/16", 12: "1/2", 16: "5/8", 20: "3/4" };

const reduceFrac = (n, d) => { const g = (a, b) => (b ? g(b, a % b) : a); const k = g(n, d) || 1; return `${n / k}/${d / k}`; };

// A millimeter thickness → an inch-fraction string ('10' → '3/8"'). Whole
// inches collapse ('25.4' → '1"'). Empty for anything non-numeric.
export function mmToFraction(mm) {
  const n = typeof mm === "number" ? mm : parseFloat(str(mm));
  if (!Number.isFinite(n) || n <= 0) return "";
  const key = Math.round(n);
  if (MM_FRACTIONS[key]) return `${MM_FRACTIONS[key]}"`;
  const sixteenths = Math.round((n / 25.4) * 16);
  if (sixteenths <= 0) return "";
  return sixteenths % 16 === 0 ? `${sixteenths / 16}"` : `${reduceFrac(sixteenths, 16)}"`;
}

// A dimension can be a mixed fraction — vendor sheets print hex chips as
// "1-1/2X1-1/2" — a bare fraction, or a leading-decimal like ".43" (VTC writes
// pencil/edge trim widths with no leading zero: ".43X12", ".3X4.6"). The
// leading-decimal alt sits before the plain-number alt so a match starting at
// the dot claims the whole ".43" instead of stopping at the "43". Bare fraction
// stays first so an unanchored match can't stop at the "3" of "3/4".
const DIM = "\\d+/\\d+|\\.\\d+|\\d+(?:\\.\\d+)?(?:-\\d+/\\d+)?";
const dimVal = (s) => {
  const f = str(s).match(/^(\d+)\/(\d+)$/);
  if (f) return +f[1] / +f[2];
  const m = str(s).match(/^(\d+(?:\.\d+)?|\.\d+)(?:-(\d+)\/(\d+))?$/);
  return m ? parseFloat(m[1]) + (m[2] ? +m[2] / +m[3] : 0) : NaN;
};
const SIZE_RE = new RegExp(`(${DIM})\\s*["']?\\s*[x×]\\s*(${DIM})\\s*["']?`, "i");
// A genuine single-dimension shape size ('2" Hex') has no L×W cell — matched
// only when SIZE_RE did not, so the vendor spelling lands in the size string
// (the tile row shows it and derives a square L×W for grout/mortar) instead of
// being shoved into the color name. A bare '6"' with no shape word is left in
// the name on purpose — no shape word, no coverage.
const SHAPE_WORDS = "hex|hexagon|penny|round|octagon";
const INCH_MARK = `["']|in(?:ch(?:es)?)?\\b`;
const SHAPE_SIZE_RE = new RegExp(`(${DIM})\\s*(?:${INCH_MARK})?\\s*(${SHAPE_WORDS})\\b`, "i");
// The MLS/ANA EFT sheets write the shape FIRST — 'HEXAGON 2 INCH', 'HEX 3 IN',
// 'HEXAGON MOSAIC 2" MATTE'. Matched only when the number carries an inch mark,
// so a trailing code ("HEXAGON 2022 PROD") can never read as a size. A
// MOS/MOSAIC between shape and size is kept in the name — it says sheet goods.
const SIZE_SHAPE_RE = new RegExp(`\\b(${SHAPE_WORDS})\\b\\s+((?:mos(?:aics?)?\\s+)?)(${DIM})\\s*(?:${INCH_MARK})`, "i");
// "(12X10/SH)"-style packaging tokens (sheet dims + a per-unit) are never the
// item's size — dropped before matching so the chip size wins and the name
// keeps no "( /Sh)" litter.
const PACKAGING_RE = /\(\s*[^)]*\/\s*(sh|sht|ct|ctn|pc|pcs|ea|cs)\s*\)/gi;
// A mosaic's SHEET dimension — "(9X11 SHEET)", "13X13 SHT" — is the size of the
// backing sheet, NOT the chip. It gives the sheet's area (so coverage can be
// derived when the book leaves SF/CT blank) but must never stand in as the tile
// L×W, which grout/mortar would then read as one giant tile. Returned as its
// own `sheetSize` and only used when the description carries no chip size; the
// chip size is entered by hand on the row (ADR 0014).
const SHEET_TOKEN_RE = new RegExp(`\\(?\\s*(${DIM})\\s*["']?\\s*[x×]\\s*(${DIM})\\s*["']?\\s*(?:sheets?|shts?)\\b\\s*\\)?`, "i");
const THICK_MM_RE = /(\d+(?:\.\d+)?)\s*mm\b/i;
const THICK_FRAC_RE = /(\d+)\s*\/\s*(\d+)\s*"/; // fraction thickness must carry the inch mark
// A penny round is one shape however the sheet spells it ("PENNY ROUND",
// "PENNY RND", "PENNY") and is always labeled "Penny" — so "PENNY ROUND" never
// reads as the separate shape word "Round". Its chip size can sit right before
// the word ("3/4\"PENNY"), after it with an inch mark ("PENNY ROUND 3/4 INCH"),
// or be absent (a mesh sheet whose printed size is only the sheet). Triggered by
// "penny" alone; a bare "round" with no penny stays a generic shape (ADR 0015).
const PENNY_RE = /\bpenny\b/i;
const PENNY_STRIP_RE = /\b(penny|round|rnd)\b/gi;
const PENNY_DIM_BEFORE_RE = new RegExp(`(${DIM})\\s*["']?\\s*(?=(?:penny|round|rnd)\\b)`, "i");
const PENNY_DIM_INCH_RE = new RegExp(`(${DIM})\\s*(?:${INCH_MARK})`, "i");

// SHOUTING vendor text → Title Case; already-cased text is left alone (so an
// intentional acronym like "MSI Stone" survives, while "EARTH ASH GRAY" reads).
const smartCase = (s) => { const v = str(s); return v && !/[a-z]/.test(v) ? titleCase(v) : v; };

// True when `text` begins with `prefix` on a word boundary (case-insensitive).
// Lets us see that "Earth Ash Gray" already starts with the product line
// "Earth" (so it isn't doubled), while "Earthen Ridge" does not.
const startsWithWord = (text, prefix) => {
  const t = str(text).toLowerCase(), p = str(prefix).toLowerCase();
  return !!p && (t === p || t.startsWith(p + " "));
};

export function splitSizeFromDescription(desc) {
  let s = str(desc);
  if (!s) return { size: "", thickness: "", name: "", sheetSize: "" };
  let size = "", thickness = "", sheetSize = "";
  s = s.replace(PACKAGING_RE, " ");
  // A SHEET dimension is pulled out before the size regexes so its L×W can't be
  // read as the chip size — it is the mosaic's backing sheet, not the tile.
  const sheetTok = s.match(SHEET_TOKEN_RE);
  if (sheetTok) {
    const a = dimVal(sheetTok[1]), b = dimVal(sheetTok[2]);
    if (a > 0 && b > 0) sheetSize = `${a}x${b}`;
    s = s.replace(sheetTok[0], " ");
  }
  // Thickness first, so "10MM" can't be mistaken for part of a size.
  const mm = s.match(THICK_MM_RE);
  if (mm) { thickness = mmToFraction(mm[1]); s = s.replace(mm[0], " "); }
  if (PENNY_RE.test(s)) {
    // Penny handled on its own so "penny round" is one shape, not a "Round" size.
    let dim = "";
    const before = s.match(PENNY_DIM_BEFORE_RE);
    if (before) { dim = before[1]; s = s.replace(before[0], " "); }
    else { const inch = s.match(PENNY_DIM_INCH_RE); if (inch) { dim = inch[1]; s = s.replace(inch[0], " "); } }
    if (dim) size = `${dim}" Penny`;          // chip size → grout computes from it
    else if (!sheetSize) sheetSize = "Penny";  // no printed chip size → a "Penny sheet"
    s = s.replace(PENNY_STRIP_RE, " ");
  } else {
    const sz = s.match(SIZE_RE);
    // Take the first L×W as the size, then strip EVERY L×W token from the name —
    // some sheets print the size in both the color and the description column
    // ("Ovo 3x12 Glossy" + "3x12 Ceramic Tile"), and leaving the second copy is
    // what put the size back in the product name next to a filled size cell.
    if (sz) {
      const a = dimVal(sz[1]), b = dimVal(sz[2]);
      const shape = s.match(new RegExp(`\\b(${SHAPE_WORDS})\\b`, "i"));
      s = s.replace(new RegExp(SIZE_RE.source, "gi"), " ");
      if (shape && a === b && a <= 6) {
        // Equal dims plus a shape word is a hex/penny chip ("HEX MOS
        // 1-1/2X1-1/2") — read as the vendor-spelled shape size, ticket 009's
        // display model, rather than a 1.5x1.5 rectangle. Capped small: an
        // equal L×W over 6" next to a shape word is a mosaic SHEET size
        // ("HEX MOSAIC 13X13 SHT"), which must stay a rectangle.
        size = `${sz[1]}" ${titleCase(shape[1])}`;
        s = s.replace(shape[0], " ");
      } else {
        size = `${a}x${b}`; // decimal ("8.5x10") so parseTileSize fills the L/W cells
      }
    } else {
      const shp = s.match(SHAPE_SIZE_RE);
      if (shp) { size = `${shp[1]}" ${titleCase(shp[2])}`; s = s.replace(new RegExp(SHAPE_SIZE_RE.source, "gi"), " "); }
      else {
        const rev = s.match(SIZE_SHAPE_RE);
        if (rev) { size = `${rev[3]}" ${titleCase(rev[1])}`; s = s.replace(rev[0], ` ${rev[2]} `); }
      }
    }
  }
  if (!thickness) {
    const fr = s.match(THICK_FRAC_RE);
    if (fr) { thickness = `${reduceFrac(+fr[1], +fr[2])}"`; s = s.replace(fr[0], " "); }
  }
  // A stripped size can hollow out a parenthesized token — "(9X11 SHEET)" →
  // "( SHEET)" — so drop parens left holding nothing but a packaging word.
  s = s.replace(/\(\s*(?:sheets?|shts?|sh|pcs?|nominal|nom)?\s*\)/gi, " ");
  // Drop only leftover standalone "x" tokens (from a stripped size), never an
  // "x" inside a word like "Max".
  const name = smartCase(s.split(/\s+/).filter((w) => w && !/^[x×]$/i.test(w)).join(" "));
  return { size, thickness, name, sheetSize };
}

// `review` (sku → flagReview, from the book's existing items) mutes the
// warnings for problems a human already confirmed or ignored — a reviewed row
// must not re-nag on every re-import of the same file.
export function parseMapped(rows, mapping, review) {
  const items = [];
  const warnings = [];
  const m = mapping || {};
  const columns = m.columns || {};
  const skuCol = colFor(columns, "sku");
  if (skuCol < 0) { warnings.push("No SKU column is mapped."); return { items, warnings }; }
  if (colFor(columns, "cost") < 0) warnings.push("No cost column is mapped — items will import without a cost.");
  const flagCol = colFor(columns, "flag");
  const skuRe = mappedSkuRe(m.skuPattern);
  const flags = m.flags || {};
  const start = Number.isInteger(m.headerRow) ? m.headerRow + 1 : 0;

  let consumed = 0;
  for (let r = start; r < (rows?.length || 0); r++) {
    const row = rows[r] || [];
    const sku = str(row[skuCol]);
    if (!skuRe.test(sku)) continue; // honesty guarantee — see module header
    consumed++;
    const raw = {};
    for (const [ci, field] of Object.entries(columns)) {
      if (field === "sku" || field === "flag") continue;
      const v = row[Number(ci)];
      if (v == null || str(v) === "") continue;
      if (raw[field] == null) raw[field] = v;
    }
    const sem = flagSemantics(flagCol >= 0 ? str(row[flagCol]) : "", flags);
    items.push(mappedItem(m, raw, sku, sem));
  }
  if (!consumed) warnings.push(`No rows matched the SKU pattern /${skuRe.source}/ — check the SKU column and pattern.`);
  const deduped = dedupeMapped(items, warnings);
  // Unit sanity before anything applies: rows whose U/M combination the
  // pricing code has never been taught get named here, not silently mispriced
  // (the VTC bullnose lesson — see unitComboWarnings).
  warnings.push(...unitComboWarnings(deduped, review));
  // Parse-quality advisories (mis-split sizes, name litter, trim-as-area, price
  // outliers) — non-blocking FYI lines so a silent bad parse gets surfaced.
  warnings.push(...importSanityWarnings(deduped, review));
  return { items: deduped, warnings };
}

// A flag cell can carry several markers ("xx *"); each maps through the legend.
function flagSemantics(cell, flags) {
  const out = {};
  const parts = str(cell).split(/\s+/).filter(Boolean);
  for (const key of Object.keys(flags || {})) {
    if (cell === key || parts.includes(key)) out[flags[key]] = true;
  }
  return out;
}

function mappedItem(mapping, raw, sku, sem) {
  const type = str(raw.type) || mapping.defaultType || null;
  const cost = numOrNull(raw.cost);
  const noteBits = [str(raw.note)];
  if (raw.cost != null && cost == null) noteBits.push(str(raw.cost)); // "N/A" / "See vendor"
  if (sem.madeToOrder) noteBits.push("Made to order");
  if (sem.transitioning) noteBits.push("Transitioning");
  const mfg = str(raw.mfg);
  // Vendor tile sheets embed the size (and thickness) in the description and
  // carry no size column. When size isn't separately mapped, pull them out so
  // the pick fills the tile size cells and the name reads clean.
  let size = str(raw.size), thickness = str(raw.thickness), descText = str(raw.description);
  // An explicitly-mapped Sheet Size column (the Glazzio PDF path, ADR 0014
  // amendment) is the backing sheet, never the chip — carried as sheetSize, with
  // the tile L×W left to the chip size below.
  let sheetSize = str(raw.sheetSize) || "", sfPerUnit = numOrNull(raw.sfPerUnit);
  const coverage = numOrNull(raw.coverage);
  if (!size && descText) {
    const split = splitSizeFromDescription(descText);
    if (split.size) size = split.size;
    if (split.thickness && !thickness) thickness = split.thickness;
    // A sheet dimension only stands in when the description gave no chip size —
    // a real chip size (e.g. "2\" Hexagon") always wins for the tile L×W.
    if (split.sheetSize && !size && !sheetSize) sheetSize = split.sheetSize;
    if (split.size || split.thickness || split.sheetSize) descText = split.name;
  }
  // Mosaic sold by the sheet with SF/CT left blank (Milestone marble hexes): the
  // sheet's own L×W gives its area, so coverage-per-carton = sheet SF × pieces-
  // per-carton. This makes it a real square-foot tile (priced $/sqft, ordered in
  // whole sheets) instead of a bare count line, WITHOUT reading the sheet dims as
  // the tile size — the chip size for grout/mortar is added on the row (ADR 0014).
  if (sheetSize && sfPerUnit == null && coverage == null) {
    const [sw, sh] = sheetSize.split("x").map(Number);
    const pcpu = numOrNull(raw.pcPerUnit) || 1;
    if (sw > 0 && sh > 0) sfPerUnit = round4(((sw * sh) / 144) * pcpu);
  }
  // The label is the product line fronting the cleaned description
  // ("Presley Earth Ash Gray") — the settled VTC spec (ADR 0009, §3). Color and
  // Pattern stay their own fields and never join the label: on the real sheet
  // they are internal codes (EAAS / 312), not words, so gluing them on reads as
  // noise. When a book carries no description column, color+style is the
  // fallback name. The product line is dropped when it already leads the
  // description, so VTC's "EARTH" line doesn't read "Earth Earth Ash Gray".
  const pl = smartCase(str(raw.productLine));
  const label = descText || [smartCase(str(raw.color)), smartCase(str(raw.style))].filter(Boolean).join(" ");
  const name = pl && !startsWithWord(label, pl) ? [pl, label].filter(Boolean).join(" ") : label;
  const it = normOrderItem({
    sku,
    mfg,
    productLine: str(raw.productLine),
    section: str(raw.section) || mfg,
    // brand fronts the on-row label (stock.js `label`); the mfg is a bare code
    // (ADX) that must never show on the product line (ADR 0009, §2 — "MFG kept
    // but hidden"), so it does NOT back-fill brand. It still rides `section`
    // for the search subtitle and stays the default markup group.
    brand: str(raw.brand),
    description: name,
    color: str(raw.color),
    style: str(raw.style),
    unit: str(raw.unit),
    priceUnit: str(raw.priceUnit),
    orderUnit: str(raw.orderUnit),
    size,
    sheetSize,
    thickness,
    type,
    // A mapped "trim" column (Mannington's "Kind", ADR 0012) flags molding lines
    // so the book can price them at a separate markup. Only that parser emits it;
    // every other sheet leaves it blank, so trim stays false.
    trim: /^(trim|y|yes|true|1)$/i.test(str(raw.trim)),
    cost,
    sfPerUnit,
    pcPerUnit: numOrNull(raw.pcPerUnit),
    coverage: numOrNull(raw.coverage),
    leadTime: str(raw.leadTime),
    msrp: numOrNull(raw.msrp),
    freightFlag: !!sem.freight,
    discontinued: !!sem.discontinued,
    note: noteBits.filter(Boolean).join(" · "),
  });
  // A piece-priced trim quotes per piece, not per square foot (ADR 0013
  // amendment): drop it to the count-line path and keep which signal said so.
  const signal = classifyTrim(it);
  if (signal) { it.trim = true; it.type = null; it.trimSignal = signal; }
  return it;
}

// Within one mapped sheet a SKU should be unique; if it repeats, keep the
// priced occurrence and warn (mirrors the stock dedupe rule).
function dedupeMapped(items, warnings) {
  const bySku = new Map();
  for (const it of items) {
    const prev = bySku.get(it.sku);
    if (!prev) { bySku.set(it.sku, it); continue; }
    const keep = prev.cost == null && it.cost != null ? it : prev;
    if (prev.cost != null && it.cost != null && prev.cost !== it.cost) {
      warnings.push(`SKU ${it.sku} appears twice with different costs ($${prev.cost}, $${it.cost}) — keeping $${keep.cost}.`);
    }
    bySku.set(it.sku, keep);
  }
  return [...bySku.values()];
}

// --- mapped-import guessers + vendor template recognizers ---------------------
//
// The wizard proposes a mapping by reading a sheet's own header labels. That
// guess logic lives here (not in App.jsx) so it is covered by node --test; the
// UI keeps only the dropdown option lists.

// A header-cell label → the order-item field it most likely names, or "" when
// nothing fits. Consumer/MSRP is tested BEFORE dealer/cost: the VTC template's
// consumer column reads "CONSUMER LEVEL PRICE (Dealer to Consumer)", so the
// word "Dealer" inside it must not claim the cost slot from the real
// "DEALER PRICE" column (which would drop the true cost and leave MSRP unmapped).
export const guessBookField = (header) => {
  const h = String(header || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!h) return "";
  if (/(itemcode|productcode|^sku$|vtcitem)/.test(h)) return "sku";
  if (/(consumer|msrp|list|suggested)/.test(h)) return "msrp";
  if (/(dealer|^cost|netcost|yourcost)/.test(h)) return "cost";
  if (/(leadtime|lead|availab)/.test(h)) return "leadTime";
  if (/(productline|series|collection)/.test(h)) return "productLine";
  if (/(mfg|manufacturer|vendor|brandcode)/.test(h)) return "mfg";
  if (/(desc|decription|name)/.test(h)) return "description";
  // Two-unit split: match the specific U/M columns before the generic "unit".
  if (/(priceum|priceuom|pricebasis)/.test(h)) return "priceUnit";
  if (/(nobroken|broken|orderunit|smallestunit)/.test(h)) return "orderUnit";
  if (/(um|unit|uom)/.test(h)) return "unit";
  if (/(sfct|sfperct|sfcarton|sqftct)/.test(h)) return "sfPerUnit";
  if (/(pcct|pcperct|piecesct|pcperunit)/.test(h)) return "pcPerUnit";
  if (/coverage/.test(h)) return "coverage";
  if (/thick/.test(h)) return "thickness";
  if (/size|dimension/.test(h)) return "size";
  if (/color|colour/.test(h)) return "color";
  if (/pattern|style/.test(h)) return "style";
  if (/note|comment/.test(h)) return "note";
  if (/brand/.test(h)) return "brand";
  return "";
};

// The best header-row candidate in a sheet: the row that maps the most known
// fields and includes a SKU column (VTC's header sits 14-15 rows down under a
// title/legend block). { row: -1, score: 0 } when none qualifies.
function scanHeader(rows) {
  let row = -1, best = 1;
  for (let r = 0; r < Math.min(rows?.length || 0, 40); r++) {
    const cells = rows[r] || [];
    let hasSku = false, score = 0;
    for (const c of cells) { const f = guessBookField(c); if (f) score++; if (f === "sku") hasSku = true; }
    if (hasSku && score >= 3 && score > best) { row = r; best = score; }
  }
  return { row, score: row >= 0 ? best : 0 };
}

export const guessHeaderRow = (rows) => scanHeader(rows).row;

// Pick the data sheet out of a workbook by header quality, NOT row count. The
// VTC-family workbooks ship a "Helper Sheet"/"Index" that is LARGER than the
// real "MFG Data"/"VTC Data", so a largest-sheet pick lands on junk with no
// header (0 items). The sheet whose best header row scores highest wins; row
// count only breaks ties. sheets = [{ name, rows }].
export function bestDataSheet(sheets) {
  let best = null, bestScore = -1, bestLen = -1;
  for (const s of sheets || []) {
    const score = scanHeader(s.rows).score;
    const len = s.rows?.length || 0;
    if (score > bestScore || (score === bestScore && len > bestLen)) { best = s; bestScore = score; bestLen = len; }
  }
  return best;
}

// Build the column map for a header row: each labeled column guessed to a
// field, plus the two headerless columns the VTC template relies on — the
// status-flag column just left of "VTC MFG" is added by the caller; the
// description column some sheets put immediately right of the item code is
// added here (older VTC exports leave "VTC Description" blank).
export function columnsFromHeader(header) {
  const columns = {};
  (header || []).forEach((c, i) => { const f = guessBookField(c); if (f && !Object.values(columns).includes(f)) columns[i] = f; });
  const skuCol = Object.entries(columns).find(([, f]) => f === "sku")?.[0];
  if (skuCol != null && !Object.values(columns).includes("description")) {
    const right = Number(skuCol) + 1;
    if (columns[right] == null && !String((header || [])[right] ?? "").trim()) columns[right] = "description";
  }
  return columns;
}

// The Virginia Tile "EFT" distributor template: one fixed 15-column MFG-Data
// sheet reused for every manufacturer VTC carries (VTC, Anatolia, WOW,
// Milestone, Home Collection, Decortile…). When its signature header is present,
// the whole mapping is known — data sheet, header row, columns, the digit-free
// item-code pattern, the status-flag legend, MFG markup grouping, tile default —
// so the wizard applies it in one step. This sidesteps the two ways per-column
// guessing loses on these files: the oversized helper sheet (defeats the sheet
// pick) and the consumer/dealer column-name clash (defeats the cost guess).
// Returns a mapping object, or null when no sheet carries the signature.
export function detectVtcEft(sheets) {
  for (const s of sheets || []) {
    const rows = s.rows || [];
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const cells = (rows[r] || []).map((c) => String(c ?? "").toLowerCase());
      const has = (re) => cells.some((c) => re.test(c));
      // "dealer price" (not just "dealer") so the consumer column, which reads
      // "…(Dealer to Consumer)", can't trip the signature on its own.
      if (!(has(/item code/) && has(/vtc mfg/) && has(/dealer price/))) continue;
      const header = rows[r] || [];
      const columns = columnsFromHeader(header);
      const mfgCol = Object.entries(columns).find(([, f]) => f === "mfg")?.[0];
      if (mfgCol != null) {
        const flagCol = Number(mfgCol) - 1; // headerless status flag, left of MFG
        if (flagCol >= 0 && columns[flagCol] == null && !String(header[flagCol] ?? "").trim()) columns[flagCol] = "flag";
      }
      return {
        sheet: s.name,
        headerRow: r,
        columns,
        // VTC item codes are 6-20 chars and often carry no digit
        // (WOWALPLRNDEDGE) — the digit-requiring default would drop them.
        skuPattern: "^[A-Z0-9]{6,20}$",
        flags: { xx: "discontinued", "*": "freight", "†": "freight", "•": "madeToOrder", "◪": "transitioning" },
        groupBy: "mfg",
        defaultType: "tile",
      };
    }
  }
  return null;
}
