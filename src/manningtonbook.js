// Parser for the Mannington "Cartons Detail" account price list (ADR 0012).
//
// Mannington's dealer price PDF is one fixed, wide grid repeated on every page:
// a floor-covering row leads with Pattern · Width · Color · Color Code ·
// Catalog #, then its per-carton and per-sq-ft price, coverage, and a strip of
// trim/molding SKUs (reducer, T-mold, stair-nose…) whose one price each is
// printed in the section header. Because the orderable code (Color Code) is the
// *fourth* column — not the first — the generic header-driven PDF reader
// (pdfbook.js) never recognizes a table here and imports nothing. This module
// reads the known grid by fixed x-bands instead.
//
// It emits the SAME { name, rows, mapping, warnings } contract parsePdfPages
// produces, so it feeds the existing mapped-import wizard (ADR 0009/0010)
// unchanged. Each page yields two kinds of canonical row:
//   • flooring — SKU = Color Code (APX020), type vinyl/laminate, cost = the
//     carton price with its SF/carton coverage so whole-carton ordering works.
//   • trim     — SKU = Catalog # of the molding piece, type blank (a misc /
//     transition line), cost = the header price for that trim column. A trim is
//     color-matched to one or more flooring items; its parent Color Code(s) ride
//     in the description so searching a floor's code surfaces its trims (the
//     flooring row, an exact SKU match, still ranks first — orderFloorFirst).
//
// Like every import path the honesty guarantee holds: a row is only consumed
// when its code cell matches the SKU pattern downstream, so a re-organized sheet
// degrades to visible "missing" counts, never garbage rows.

import { clusterRows } from "./pdfbook.js";

const str = (c) => (c == null ? "" : String(c).trim());
const num = (c) => { const n = parseFloat(str(c).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };

// Column x-bands, read off the (identical) grid on every page. Boundaries sit at
// the midpoints BETWEEN observed data columns, so a value printed a sub-pixel
// off its header still lands in its own band. Everything at/after TRIM_X is the
// trim/molding matrix.
const BANDS = [
  ["pattern", 0, 85], ["size", 85, 120], ["color", 120, 170], ["colorCode", 170, 214],
  ["catalog", 214, 255], ["priceSf", 255, 286], ["priceCarton", 286, 318],
  ["sfCarton", 318, 350], ["sfPallet", 350, 384], ["cartonsPallet", 384, 413],
  ["lbsCarton", 413, 436], ["edge", 436, 485],
];
const TRIM_X = 485;
const bandFor = (x) => { for (const [f, lo, hi] of BANDS) if (x >= lo && x < hi) return f; return x >= TRIM_X ? "trim" : null; };

// A flooring/trim code cell: 4–6 leading digits (SAP catalog) or the alnum Color
// Code (APX020, 28402P, MSPH07CHP1). Only used to spot data rows before columns
// are trusted; the real gate is the SKU pattern downstream.
const isCatalog = (s) => /^\d{4,6}[A-Z]?$/.test(str(s));

// The section product line, e.g. "ADURA APEX (APXHP)" → "ADURA APEX". Printed on
// the same baseline as the Warranty/Thickness notice at the top of each section.
const sectionOf = (line, leftX) => {
  const m = line.match(/^([A-Z][A-Za-z0-9()'&. ]+?)\s*\(([A-Z0-9]+)\)/);
  if (m && (line.includes("Warranty") || line.includes("Thickness")) && leftX < 40) return m[1].trim();
  return null;
};

// Clean a stacked trim-column header ("Quarter Round 94\" (Piece)") down to its
// molding name ("Quarter Round"). The size/piece annotations vary per section
// and carry no product meaning.
function trimLabel(parts) {
  let s = parts.join(" ")
    .replace(/\((?:Piece|PC|2PC)\)/gi, " ")
    .replace(/\b\d{1,3}"?\b/g, " ")
    .replace(/["']/g, " ")
    .replace(/\b(?:Cn|O-?lap|Overlap|Flush|Piece)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (/^Qtr\b/i.test(s)) s = s.replace(/^Qtr/i, "Quarter");
  if (/^SimpleSt/i.test(s)) s = "SimpleStart";
  return s || "Trim";
}

// The trim columns for one section: pair each price in the "Pattern …" header row
// (trim zone) with the stacked label text in the ~55px band above it, by x.
function trimColumns(rows, patternRow) {
  const prices = patternRow.items.filter((i) => i.x >= TRIM_X && /^\$/.test(str(i.str))).map((i) => ({ x: i.x, price: num(i.str) }));
  const labelItems = rows
    .filter((r) => r.y < patternRow.y - 1 && r.y > patternRow.y - 55)
    .flatMap((r) => r.items)
    .filter((i) => i.x >= TRIM_X && /[A-Za-z]/.test(str(i.str)) && !/^\$/.test(str(i.str)));
  return prices.map((p) => {
    const parts = labelItems.filter((l) => Math.abs(l.x - p.x) < 20).sort((a, b) => a.y - b.y).map((l) => str(l.str));
    return { x: p.x, price: p.price, label: trimLabel(parts) };
  });
}

const cellIn = (items, lo, hi) => items.filter((i) => i.x >= lo && i.x < hi).sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ").trim();

// Canonical schema every row is aligned to, and the passthrough wizard mapping.
// The parser has already resolved each row, so the mapping is a straight
// column→field assignment (like pdfbook's CANON_MAPPING). Color Code and Catalog
// # are both alphanumeric with a digit, so the SKU pattern accepts either.
const CANON = ["Item #", "Name", "Collection", "Color", "Size", "SF/Carton", "Cost", "Price U/M", "Type"];
const CANON_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "color", 4: "size", 5: "sfPerUnit", 6: "cost", 7: "priceUnit", 8: "type" },
  headerRow: 0,
  skuPattern: "^(?=.*\\d)[A-Za-z0-9]{3,14}$",
  defaultType: "",
};

const CATEGORY_TYPE = { LVT: "vinyl", Laminate: "laminate", Hardwood: "hardwood" };

// True when the pages look like a Mannington Cartons Detail list: some early page
// carries the grid's signature header (a "Pattern" row that also names
// "Color Code" and "Catalog #").
export function isManningtonCartons(pages) {
  for (const page of (pages || []).slice(0, 4)) {
    const items = (page || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    for (const row of clusterRows(items)) {
      const line = [...row.items].sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");
      if (/\bPattern\b/.test(line) && /\bColor Code\b/.test(line) && /\bCatalog\b/.test(line)) return true;
    }
  }
  return false;
}

export function parseManningtonPages(pages, name = "Mannington price list") {
  const flooring = []; // { colorCode, name, productLine, color, size, sfPerUnit, cost, type }
  const trims = new Map(); // catalog# -> { sku, label, price, type, codes:Set, names:Set }
  const warnings = [];
  let category = "", section = "", trimCols = [];
  let dataRows = 0;

  for (let p = 0; p < (pages?.length || 0); p++) {
    const items = (pages[p] || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    const rows = clusterRows(items);

    // Page category (LVT / Laminate / Hardwood) sits alone at the very top.
    const cat = items.find((i) => (i.y ?? 99) < 30 && /^(LVT|Laminate|Hardwood)$/.test(str(i.str)));
    if (cat) category = str(cat.str);
    const rowType = CATEGORY_TYPE[category] || "";

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const sorted = [...row.items].sort((a, b) => a.x - b.x);
      const line = sorted.map((i) => str(i.str)).join(" ");
      const left = row.items.reduce((a, b) => (b.x < a.x ? b : a));

      const sec = sectionOf(line, left.x);
      if (sec) { section = sec; continue; }
      if (/^Pattern\b/.test(line)) { trimCols = trimColumns(rows, row); continue; }

      // A data row: leftmost cell is the Pattern text (far left) and a catalog #
      // sits in the Catalog band. Skip header/boilerplate lines.
      const catCell = row.items.find((i) => i.x >= 214 && i.x < 255 && isCatalog(i.str));
      if (!catCell || left.x > 40 || /Price|Pattern|Per|Warranty|Thickness|Effective|Issue|Page:/.test(line)) continue;

      const colorCode = cellIn(row.items, 170, 214);
      const catalog = cellIn(row.items, 214, 255);
      const patternName = cellIn(row.items, 0, 85);
      const color = cellIn(row.items, 120, 170);
      const size = cellIn(row.items, 85, 120);
      const carton = num(cellIn(row.items, 286, 318));
      const sf = num(cellIn(row.items, 318, 350));
      const perSf = num(cellIn(row.items, 255, 286));
      if (!colorCode) continue;
      dataRows++;

      // Self-consistency: carton ÷ SF/carton must reconcile with the printed
      // $/SF. If it doesn't, the columns were misread — trust the per-sq-ft price
      // and drop carton ordering rather than quote a wrong carton cost.
      let cost = null, unit = "";
      if (carton != null && sf && perSf != null && Math.abs(carton / sf - perSf) / perSf > 0.03) {
        cost = perSf; unit = "SF";
      } else if (carton != null && sf) { cost = carton; unit = "BX"; }
      else if (perSf != null) { cost = perSf; unit = "SF"; }
      else if (carton != null) { cost = carton; unit = "BX"; }

      flooring.push({
        colorCode, name: [patternName, color].filter(Boolean).join(" "), productLine: section,
        color, size, sfPerUnit: unit === "BX" ? sf : null, cost, unit, type: rowType,
      });

      // Trim/molding pieces on this row, each keyed to its column's type + price.
      for (const it of row.items) {
        if (it.x < TRIM_X) continue;
        const sku = str(it.str);
        if (!/^\d{4,7}[A-Z]?$/.test(sku)) continue;
        const col = trimCols.filter((c) => Math.abs(c.x - it.x) < 20).sort((a, b) => Math.abs(a.x - it.x) - Math.abs(b.x - it.x))[0];
        const t = trims.get(sku) || { sku, label: col?.label || "Trim", price: col?.price ?? null, type: rowType, codes: new Set(), names: new Set() };
        if (t.price == null && col?.price != null) { t.price = col.price; t.label = col.label; }
        t.codes.add(colorCode);
        if (patternName || color) t.names.add([patternName, color].filter(Boolean).join(" "));
        trims.set(sku, t);
      }
    }
  }

  const rows = [CANON.slice()];
  for (const f of flooring) {
    rows.push([f.colorCode, f.name, f.productLine, f.color, f.size,
      f.sfPerUnit != null ? String(f.sfPerUnit) : "", f.cost != null ? String(f.cost) : "", f.unit, f.type]);
  }
  // Trim rows: SKU = catalog #, priced per piece (EA), no flooring type (a misc /
  // transition line). The parent color code(s) ride in the description (searched
  // via search_text) so a floor code search finds the trim; the name reads
  // "<pattern> — <TrimType> · fits <codes>". Collection/color are left blank so
  // the description stays the clean, self-contained line shown on a quote.
  for (const t of trims.values()) {
    const codes = [...t.codes];
    const parent = [...t.names][0] || "";
    const desc = [parent ? `${parent} — ${t.label}` : t.label, codes.length && `· fits ${codes.join(" ")}`]
      .filter(Boolean).join(" ");
    rows.push([t.sku, desc, "", "", "", "", t.price != null ? String(t.price) : "", "EA", ""]);
  }

  if (!dataRows) warnings.push("No Mannington product rows were recognized — is this the Cartons Detail price list?");
  return { name, rows, mapping: { ...CANON_MAPPING }, warnings, meta: { flooring: flooring.length, trims: trims.size } };
}
