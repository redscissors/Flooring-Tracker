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

const SKU_RE = /^\d{4,8}$/;
const str = (c) => (c == null ? "" : String(c).trim());
const isSku = (c) => SKU_RE.test(str(c));
const numOrNull = (c) => {
  if (c == null || c === "") return null;
  const n = typeof c === "number" ? c : parseFloat(String(c).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

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
  for (const row of rows) {
    const name = str(row[0]);
    const disc = row.some((c) => DISC_RE.test(str(c)));
    if (name && !isSku(row[2]) && !ADURA_TRIMS.some(([i]) => isSku(row[i]))) {
      const m = name.match(/^(\d+x\d+)\s/i);
      if (m) size = m[1];
      if (/apex/i.test(name)) { line = "Mannington Adura Apex"; size = ""; }
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
      items.push(norm({
        sku: str(row[i]), sheet: "Mann Aduramax", section: `${line} trims`,
        brand: line, description: `${name} — ${label}`,
        unit: "EA", type: null, discontinued: disc,
      }));
    }
  }
}

// --- Grout & Caulk color matrices ---------------------------------------------

function parseGroutMatrix(rows, items) {
  let title = "";
  let cols = null; // [{ i, name }]
  let prices = null; // by column index
  for (const row of rows) {
    const c0 = str(row[0]).toUpperCase();
    if (c0 === "COLOR#") {
      cols = [];
      row.forEach((c, i) => { const v = str(c); if (i > 0 && v) cols.push({ i, name: v }); });
      prices = null;
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
    for (const { i, name } of cols) {
      if (!isSku(row[i])) continue;
      const productName = `${title.replace(/grout & caulk/i, "").trim() || title} ${titleCase(name)}`.trim();
      items.push(norm({
        sku: str(row[i]), sheet: "Grout & Caulk", section: title,
        brand: title, description: `${productName} — ${titleCase(color)}`,
        product: productName, color: titleCase(color),
        unit: "EA", price: prices ? prices[i] : null,
        type: null,
      }));
    }
  }
}

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
