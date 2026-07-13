// Parser for vendor price lists shipped as a text PDF (product-import PDF phase).
//
// Vendor "digital price list" PDFs (e.g. Glazzio) are one self-describing table
// per page: every page prints its own column header — Item #, Collection, Color
// Name, and then whichever of Variation / Pieces per Box / SQF per Box / $ per
// SQF / $ per Box / Size / Description that page happens to carry. Across a book
// the same header appears in a dozen slightly different combinations, so there
// is no single fixed grid the way a vendor .xlsx has one.
//
// This module reads EACH page's own header to place that page's columns, then
// aligns every page onto ONE canonical schema. Its output is the same
// arrays-of-arrays shape the .xlsx import produces ({ name, rows }) plus a
// suggested column mapping, so it feeds the existing mapped-import wizard
// (ADR 0009) unchanged — same header-row/column controls, same diff preview,
// same honesty guarantee (parseMapped only ever consumes a row whose SKU cell
// matches the pattern, so an unrecognized page degrades to visible "missing"
// counts, never garbage rows).
//
// It deliberately takes already-extracted text items — [{ str, x, y, w }] per
// page, exactly what pdf.js page.getTextContent() yields once flattened — not a
// PDF blob, so it is covered by node --test without the pdfjs-dist dependency
// (which is lazy-loaded in the browser, like xlsx).

const str = (c) => (c == null ? "" : String(c).trim());

// Header-label → canonical field. Compared lowercased with non-letters removed,
// so "Item #", "$ per SQF", "SQF per Box", "Color Name" all land. Substring +
// priority (not exact match) so a column whose x-band caught a stray neighbor
// header word ("Color Name Variation") still resolves to its dominant field.
// Priority order is deliberate: the more specific keyword wins, and the two
// price columns ($ per SQF vs $ per Box) are told apart by "sqf" vs "box".
function headerFieldFor(label) {
  const h = str(label).toLowerCase().replace(/[^a-z]/g, "");
  if (!h) return "";
  // Must START with item/sku so prose that merely contains the word "items"
  // (a tariff/surcharge notice) is not mistaken for the item-code column.
  if (/^item/.test(h) || h === "sku" || /^itemcode/.test(h)) return "sku";
  if (h.includes("collection") || h.includes("series")) return "collection";
  if (h.includes("color") || h.includes("colour")) return "name";
  if (h.includes("variation") || h.includes("shade")) return "variation";
  if (h.includes("description") || h.includes("decription")) return "desc";
  if (h.includes("piece") || h.includes("pcs") || h.includes("rows")) return "pcPerUnit"; // Pieces/Pcs/Rows per Box/Sheet (count)
  if ((h.includes("sqf") || h.startsWith("sf")) && (h.includes("box") || h.includes("sheet"))) return "sfPerUnit"; // SQF per Box/Sheet = coverage
  if (h.includes("sqf") || h.includes("persf")) return "priceSf"; // $ per SQF
  if (h.includes("perbox") || h.includes("boxprice") || h.includes("persheet") || h.includes("percarton")) return "priceBox"; // $ per Box/Sheet/Carton
  if (h.includes("size") || h.includes("dimension")) return "size";
  if (h === "price") return "price"; // bare price column, basis inferred per row
  if (h === "um" || h === "uom" || h.includes("unit")) return "unit";
  return "";
}

// The canonical output schema: fixed column order every page is aligned to, its
// synthetic header row, and the suggested wizard mapping (index → order-item
// field). $ per SQF and $ per Box collapse into one cost + its Price U/M so the
// order model's single-cost item works whether a page prices by box or by foot.
const CANON = ["Item #", "Name", "Collection", "Variation", "Size", "Pieces/Box", "SQF/Box", "Cost", "Price U/M"];
const CANON_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "style", 4: "size", 5: "pcPerUnit", 6: "sfPerUnit", 7: "cost", 8: "priceUnit" },
  headerRow: 0,
  // Glazzio item codes: L11LASA, BSP5203, 18-digit numbers, and dotted ones
  // (L11ST.IM). The stock/default patterns drop the dotted and long-numeric
  // codes, so the PDF path widens to alphanumerics plus . and - with a digit.
  skuPattern: "^(?=.*\\d)[A-Za-z0-9.\\-]{3,25}$",
  defaultType: "tile",
};

const num = (c) => {
  const n = parseFloat(str(c).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// A token that looks like a product code: alphanumerics (plus . and -) with a
// digit, and not a tile size ("24x48"). Used to pick the table's product rows
// out of the surrounding marketing/legend text BEFORE columns are known — the
// real SKU gate is still parseMapped's pattern downstream.
const isSkuish = (s) => /^(?=.*\d)[A-Za-z0-9.\-]{3,25}$/.test(str(s)) && !/\dx\d/i.test(str(s));

// A row that is nothing but product codes (two or more cells, every one a SKU)
// is an image-caption grid — the strip of SKU labels Glazzio prints under each
// page's tile photos — not a data row. Its codes are spread across the full
// page width, so letting it through both fills every column gutter (collapsing
// detectColumns onto too few bands) and emits junk rows; a real product row
// always carries a non-code cell (a color name, a price). Recognized
// structurally and dropped before columns are detected.
const isLegendRow = (rowItems) => {
  const toks = rowItems.map((it) => str(it.str)).filter(Boolean);
  return toks.length >= 2 && toks.every(isSkuish);
};

// Order-note / disclaimer boilerplate printed around the tables. A collection
// title is the plain heading line above a header that is NOT one of these.
const TITLE_SKIP = /square foot|full box|place order|quantity only|sold by|reference only|^effective|tariff|digital price|encourage customers|guarantee pricing|actual tile|variation|dry layout|coverage|sheet size|pallet|shipping program/i;

// Cluster text items into visual rows by baseline y. A single product row is
// often typeset across two baselines a pixel apart (the SKU/name on one, the
// collection/price on another), so items within `yTol` of a row's running mean
// join it; genuine rows sit ~9px apart, well outside the tolerance.
export function clusterRows(items, yTol = 4) {
  const buckets = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let b = buckets.find((bk) => Math.abs(bk.y - it.y) <= yTol);
    if (!b) { b = { y: it.y, items: [] }; buckets.push(b); }
    b.items.push(it);
    b.y = (b.y * (b.items.length - 1) + it.y) / b.items.length;
  }
  return buckets.sort((a, b) => a.y - b.y);
}

// Group a row's items into labels by x-gaps: a gap wider than `gap` between one
// item's right edge and the next item's left edge starts a new label. Returns
// [{ text, x }] left-to-right, x = the label's left edge.
function groupByGaps(rowItems, gap = 8) {
  const sorted = [...rowItems].sort((a, b) => a.x - b.x);
  const out = [];
  let cur = null;
  for (const it of sorted) {
    if (cur && it.x - (cur.x + cur.w) <= gap) {
      cur.text += " " + it.str; cur.w = it.x + (it.w || 0) - cur.x;
    } else {
      cur = { text: it.str, x: it.x, w: it.w || 0 }; out.push(cur);
    }
  }
  return out.map((g) => ({ text: g.text.trim(), x: g.x }));
}

// Every header band on a page, top-to-bottom. A header is a clustered row whose
// leftmost label is the item-code column and which carries at least two
// recognizable fields (so a prose line containing "items" cannot pass); each is
// merged with an adjacent wrapped header line (labels like "Pieces per / Box"
// stack on two baselines). A page routinely stacks several tables — a square
// and a hex layout of one collection, a tile and its mosaic — each with its own
// header, so all are returned and the caller resolves columns, rows, and the
// collection title per section rather than lumping the page under one header.
function findAllHeaders(rows) {
  const heads = [];
  for (let i = 0; i < rows.length; i++) {
    const first = groupByGaps(rows[i].items)[0];
    if (!first || headerFieldFor(first.text) !== "sku") continue;
    let merged = [...rows[i].items];
    for (const j of [i - 1, i + 1]) {
      if (rows[j] && Math.abs(rows[j].y - rows[i].y) <= 12) merged = merged.concat(rows[j].items);
    }
    const anchors = headerAnchors(merged);
    // `top` is the highest baseline of the merged band; a header's column labels
    // can wrap onto a line ABOVE the "Item #" baseline ("Rows per / Sheet"), and
    // the title scan must start above that wrapped line, not between it and the
    // real heading.
    if (anchors.length >= 2 && anchors[0].field === "sku") heads.push({ items: merged, y: rows[i].y, top: Math.min(...merged.map((it) => it.y)) });
  }
  return heads;
}

// The collection/series title for a header's table. Glazzio prints it as a
// section heading above the header row, never as a column, so it is the nearest
// plain text line above the header — skipping the order-note boilerplate — and
// the scan stops at the previous table's header/rows so a repeated sub-layout
// (a mosaic block under the main tile) inherits the collection above it instead
// of mislabeling itself. `floorY` is the previous section's header y (or
// -Infinity for the first), bounding the scan to this section's band.
function collectionTitleFor(rows, header, floorY) {
  const above = rows.filter((r) => r.y < (header.top ?? header.y) - 2 && r.y > floorY).sort((a, b) => b.y - a.y);
  for (const r of above) {
    if (header.y - r.y > 60) break;
    const first = groupByGaps(r.items)[0];
    if (first && headerFieldFor(first.text) === "sku") break;
    if (isLegendRow(r.items)) break;
    const left = r.items.reduce((a, b) => (b.x < a.x ? b : a));
    if (isSkuish(left.str)) break;
    const text = [...r.items].sort((a, b) => a.x - b.x).map((it) => it.str).join(" ").trim();
    if (!text || TITLE_SKIP.test(text)) continue;
    return text;
  }
  return "";
}

// Header items → ordered field anchors [{ field, x }]. Words are grouped into
// whole labels by small x-gaps so "Pieces per Box" stays one anchor (grouping
// by individual word would scatter "Pieces" and "Box" onto different columns).
// Each "$" starts its own price anchor — the two price columns ($ per SQF, $ per
// Box) can sit a single pixel apart, too close to separate by gap — typed by the
// unit word to its right. x is the anchor's center, used to match data columns.
function headerAnchors(headerItems) {
  const items = [...headerItems].sort((a, b) => a.x - b.x);
  const anchors = [];
  let g = null;
  const flush = () => {
    if (!g) return;
    const dollars = g.items.filter((it) => /\$/.test(it.str));
    if (dollars.length) {
      for (const d of dollars) {
        const unit = g.items.find((it) => it.x > d.x && /box|sqf|sf|sheet|carton|ct/i.test(it.str));
        anchors.push({ field: /box|sheet|carton|ct/i.test(unit?.str || "") ? "priceBox" : "priceSf", x: d.x });
      }
    } else {
      const field = headerFieldFor(g.items.map((it) => it.str).join(" "));
      if (field) anchors.push({ field, x: (g.items[0].x + g.items[g.items.length - 1].x) / 2 });
    }
    g = null;
  };
  for (const it of items) {
    if (g && it.x - (g.right) <= 4) { g.items.push(it); g.right = it.x + (it.w || 0); }
    else { flush(); g = { items: [it], right: it.x + (it.w || 0) }; }
  }
  flush();
  return anchors;
}

// Build the page's columns as [{ field, lo, hi }] x-bands. Boundaries come from
// the DATA's vertical gutters (runs of x with no ink across the product rows),
// which reliably separate even adjacent numeric columns. Each data column is
// then labeled by the nearest header anchor — headers are laid out a variable
// few px off their values, so proximity of whole-label anchors beats any
// strict "header word inside the band" test.
function detectColumns(dataItems, headerItems, gutter = 3) {
  if (!dataItems.length) return [];
  const maxX = Math.ceil(Math.max(...dataItems.map((i) => i.x + (i.w || 0)))) + 2;
  const ink = new Uint8Array(maxX + 1);
  for (const it of dataItems) {
    const a = Math.max(0, Math.floor(it.x)), b = Math.min(maxX, Math.ceil(it.x + (it.w || 0)));
    for (let k = a; k <= b; k++) ink[k] = 1;
  }
  const edges = [-Infinity];
  let run = 0;
  for (let k = 0; k <= maxX; k++) {
    if (!ink[k]) run++;
    else { if (run >= gutter) edges.push(k - run / 2); run = 0; }
  }
  edges.push(Infinity);
  const cols = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const inBand = dataItems.filter((it) => it.x >= edges[i] && it.x < edges[i + 1]);
    if (!inBand.length) continue;
    const center = inBand.reduce((s, it) => s + it.x + (it.w || 0) / 2, 0) / inBand.length;
    cols.push({ lo: edges[i], hi: edges[i + 1], center });
  }
  const anchors = headerAnchors(headerItems);
  if (!cols.length || !anchors.length) return [];
  // Order-preserving assignment: both anchors and columns run left-to-right, so
  // walk them monotonically — each anchor claims the nearest not-yet-passed
  // column, then advances. A data column with no anchor (an unlabeled "PEI" or
  // "Tile Size" column) is simply skipped instead of shifting every field after
  // it, which was the source of costs landing in the wrong column.
  const labeled = cols.map((c) => ({ ...c, field: null }));
  let j = 0;
  for (const a of anchors) {
    while (j + 1 < labeled.length && Math.abs(labeled[j + 1].center - a.x) < Math.abs(labeled[j].center - a.x)) j++;
    if (j < labeled.length) { labeled[j].field = a.field; j++; }
  }
  return labeled.filter((c) => c.field).map((c) => ({ field: c.field, lo: c.lo, hi: c.hi }));
}

function assignRow(rowItems, columns) {
  const raw = {};
  for (const it of [...rowItems].sort((a, b) => a.x - b.x)) {
    const col = columns.find((c) => it.x >= c.lo && it.x < c.hi);
    if (!col) continue;
    raw[col.field] = raw[col.field] ? raw[col.field] + " " + it.str : it.str;
  }
  return raw;
}

// One aligned canonical row from a page's raw field record, or null when there
// is nothing SKU-ish to anchor it (kept minimal — parseMapped is the real gate).
function canonRow(raw) {
  const sku = str(raw.sku);
  if (!sku) return null;
  const name = [str(raw.name), str(raw.desc)].filter(Boolean).join(" ");
  // $ per Box is the sellable-unit cost when present (order by box); otherwise
  // $ per SQF prices by the foot; a bare "Price" column follows whichever unit
  // the page implies (box when it lists a box coverage, else by the foot).
  let box = num(raw.priceBox), sf = num(raw.priceSf);
  const generic = num(raw.price), sfBox = num(raw.sfPerUnit);
  // Self-consistency guard: when the book prints a box price, a $/sqft, AND the
  // SF/box, then box ÷ SF-box must reconcile with the printed $/sqft. If it does
  // not, this row's columns were misread (e.g. a pallet-priced layout with extra
  // columns) — distrust both prices and emit NO cost. On a quote a missing cost
  // is safe (it shows in the diff preview); a wrong one is not.
  if (box != null && sf != null && sfBox && Math.abs(box / sfBox - sf) / sf > 0.05) { box = null; sf = null; }
  // Order by the box only when its SF/box coverage is known (so $/sqft derives
  // and whole-box ordering works); otherwise the per-SQF price is the honest
  // unit cost. A bare "Price" column follows the box only when a coverage is set.
  let cost = null, unit = "";
  if (box != null && sfBox != null) { cost = box; unit = "BX"; }
  else if (sf != null) { cost = sf; unit = "SF"; }
  else if (box != null) { cost = box; unit = "BX"; }
  else if (generic != null) { cost = generic; unit = sfBox != null ? "BX" : "SF"; }
  // Plausibility ceiling: no flooring costs $200+/sqft, so a per-sqft cost above
  // it means a non-price column (a pallet SF count, a pallet price) was misread
  // into the price slot on an unusual layout. Drop the cost — missing beats wrong.
  const perSf = unit === "SF" ? cost : (cost != null && sfBox ? cost / sfBox : null);
  if (perSf != null && perSf > 200) { cost = null; unit = ""; }
  return [sku, name, str(raw.collection), str(raw.variation), str(raw.size),
    raw.pcPerUnit != null ? str(raw.pcPerUnit) : "", sfBox != null ? String(sfBox) : "",
    cost != null ? String(cost) : "", unit];
}

// Text-PDF pages → { name, rows, mapping, warnings }. `pages` is an array (one
// per PDF page) of text-item arrays [{ str, x, y, w }]. Non-table pages (a
// cover with no "Item …" header) contribute nothing.
export function parsePdfPages(pages, name = "Price list") {
  const rows = [CANON.slice()];
  const warnings = [];
  let tablePages = 0;
  for (let p = 0; p < (pages?.length || 0); p++) {
    const items = (pages[p] || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    const clustered = clusterRows(items);
    const headers = findAllHeaders(clustered);
    if (!headers.length) continue;
    let pageHadTable = false;
    let lastTitle = "";
    for (let hi = 0; hi < headers.length; hi++) {
      const header = headers[hi];
      const nextY = hi + 1 < headers.length ? headers[hi + 1].y : Infinity;
      const floorY = hi > 0 ? headers[hi - 1].y : -Infinity;
      // The collection heading above this table; a sub-layout with no heading of
      // its own inherits the one above (carried in lastTitle).
      const title = collectionTitleFor(clustered, header, floorY) || lastTitle;
      lastTitle = title;
      // Product rows: between this header and the next, leftmost cell a
      // SKU-shaped code near the Item# column, and not an image-caption grid.
      // Restricting to these keeps the full-width marketing/legend rows from
      // filling every column gutter (which would collapse the grid).
      const skuX = Math.min(...header.items.filter((h) => /item|sku/i.test(h.str)).map((h) => h.x), Infinity);
      const productRows = clustered.filter((row) => {
        if (row.y <= header.y + 2 || row.y >= nextY) return false;
        if (isLegendRow(row.items)) return false;
        const left = row.items.reduce((a, b) => (b.x < a.x ? b : a));
        return isSkuish(left.str) && (!Number.isFinite(skuX) || left.x <= skuX + 20);
      });
      const columns = detectColumns(productRows.flatMap((row) => row.items), header.items);
      if (!columns.some((c) => c.field === "sku")) continue;
      pageHadTable = true;
      for (const row of productRows) {
        const raw = assignRow(row.items, columns);
        // The book has no Collection column, so stamp the section heading; a
        // page that ever does carry one keeps its own value.
        if (title && !str(raw.collection)) raw.collection = title;
        const canon = canonRow(raw);
        if (canon) rows.push(canon);
      }
    }
    if (pageHadTable) tablePages++;
  }
  if (!tablePages) warnings.push("No page carried a recognizable “Item #” table header — is this a text PDF?");
  return { name, rows, mapping: { ...CANON_MAPPING }, warnings };
}

