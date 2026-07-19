// Parser for Ohio Valley Flooring (OVF) banded vendor price lists (issue 025).
//
// OVF ships each vendor as an .xls whose product sheet is a banded grid, not a
// flat table: a collection banner, some construction/coverage prose, a header
// row, a shared price row, then color rows carrying one floor SKU plus a strip
// of trim SKUs. The generic mapped importer (src/pricebook.js parseMapped) reads
// one flat header row + one item per row, so it can't express "price lives in a
// header row" or "one row fans out to a floor + its trims". Like Mannington
// (ADR 0012) this is the sanctioned dedicated-parser exception (ADR 0009 §4).
//
// Each OVF book is banded the same way — banner → prose → header → price row →
// item rows — but the column semantics differ per vendor, so each vendor gets a
// small parse function here that flattens its grid into the SAME canonical
// { name, rows, mapping, warnings } contract parsePdfPages/parseManningtonPages
// emit, feeding the existing mapped-import wizard unchanged.
//
// Hallmark (engineered/solid wood + a laminate & a vinyl collection):
//   • Two header layouts — one with NEW/OLD Item # columns, one with a single
//     Item # + a Touch-Up Kits column — so the trim columns sit at different
//     indices. The header row ("SPECIES / COLOR …") is read per collection to
//     place every column.
//   • The floor $/SF price is printed once on a species row (EUROPEAN WHITE OAK
//     $7.29) and applies to the color rows beneath it; a collection can hold
//     several species/price sub-blocks.
//   • Each color row → one floor item (SKU = current/NEW Item #, priced per SF
//     with its carton coverage so whole-carton ordering works) plus its trims
//     (SKU = the molding code, priced per piece from the species row, flagged
//     `trim`, and stamped "fits {floor SKU}" so a floor search surfaces them —
//     the per-color link is exact here, unlike Mannington's multi-code guess).
//
// Tarkett Home LVT (the one visible "Tarkett LVT" sheet; the file's six other
// product tabs are hidden reference tabs for lines the shop doesn't carry):
//   • Collections are "Tarkett …" banner lines; a collection holds one or more
//     SIZE BLOCKS, each with its own "Plank Size 7" x 60" • 9 PC/CT •
//     26.25 SF/CT …" prose, header (Design | Item # | five moldings), and price
//     row ("$3.97/SF | $104.15/CT | $15.18/EA …"). ProGen prints its size prose
//     in the banner row's far column instead of its own line.
//   • Item #s are bare 6-12 digit numerics (floors and trims alike), so the
//     SKU gate is numeric, not the alnum Hallmark one.
//   • The tail is three small flat accessory tables (underlayment, floor care,
//     adhesives) headed "Product"; their items import as plain per-each/roll
//     accessory lines under their own "Tarkett …" banner group.
//
// Honesty guarantee (as everywhere): a row only becomes a floor when its Item #
// cell looks like a SKU, so a re-organized sheet degrades to visible missing
// counts downstream, never garbage rows.

const str = (c) => (c == null ? "" : String(c).trim());
const num = (c) => { const n = parseFloat(str(c).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };

// A SKU cell carries letters AND digits and no spaces (AV75OBALC, ATC325NATRO-S,
// COADM9O5MM-19). Prices ("$7.29"), species labels ("EUROPEAN WHITE OAK") and
// "N/A" all fail this, so it cleanly tells a color row from a price row.
const looksSku = (s) => { const v = str(s); return v.length >= 3 && v.length <= 24 && /[A-Za-z]/.test(v) && /\d/.test(v) && !/\s/.test(v); };

// A price cell is a bare/`$` number or an explicit "N/A" (a species with no
// current price — the color rows below still carry SKUs, they just cost null).
const looksPrice = (s) => { const v = str(s); return v === "N/A" || v === "NA" || num(v) != null; };

const BRAND = "Hallmark";

// Trim/molding header label → the molding name we store. The size annotation
// (82", 94", 74.75") varies per collection and carries no product meaning.
const TRIM_LABELS = [
  [/STAIR|STAIRNOSE/, "Stair Nose"],
  [/T[-\s]?MOLD/, "T-Mold"],
  [/REDUCER/, "Reducer"],
  [/THRESHOLD/, "Threshold"],
  [/END\s*CAP/, "End Cap"],
];
const trimLabelFor = (label) => { for (const [re, name] of TRIM_LABELS) if (re.test(label)) return name; return null; };

// Collection type from its banner text; the whole "wood" book carries one
// laminate (Crescendo) and one vinyl (Courtier PVP) collection.
const typeOf = (collection) => {
  const c = collection.toLowerCase();
  if (/laminate/.test(c)) return "laminate";
  if (/\bpvp\b|vinyl/.test(c)) return "vinyl";
  return "hardwood";
};

// A "N SF/CT" figure from a prose line; a NEW/OLD line ("NEW: 27 SF/CT … OLD:
// 23.31 SF/CT") yields the first (NEW) value, the current carton.
const coverageIn = (line) => { const m = str(line).match(/(\d+(?:\.\d+)?)\s*SF\s*\/\s*CT/i); return m ? parseFloat(m[1]) : null; };

// A header row starts the color/species grid for a collection.
const isHeaderRow = (row) => /^SPECIES\s*\/\s*COLOR/i.test(str(row[0]));

// Read a header row into column roles. Floor = "NEW ITEM #" (preferred) or
// "ITEM #"; old = "OLD ITEM #" (a search alias); trims by their molding labels.
function parseHeader(row) {
  const h = { floorCol: 1, oldCol: null, touchCol: null, trims: [] };
  for (let c = 1; c < row.length; c++) {
    const label = str(row[c]).toUpperCase();
    if (!label) continue;
    if (/NEW\s*ITEM/.test(label)) h.floorCol = c;
    else if (/OLD\s*ITEM/.test(label)) h.oldCol = c;
    else if (/^ITEM/.test(label)) h.floorCol = c;
    else if (/TOUCH/.test(label)) h.touchCol = c;
    else { const t = trimLabelFor(label); if (t) h.trims.push({ col: c, label: t }); }
  }
  return h;
}

// A single-cell text line that names a new collection (vs. construction/coverage
// prose or a footnote). Content alone can't tell "Organic Solid Collection"
// (banner) from "SOLID —NuOil …" (prose) by keyword — both say "solid" — so the
// caller gates on POSITION (only the first line after a collection's data), and
// this only has to reject the footnote/construction/measurement shapes that can
// sit there: an em-dash, slash or "=" clause, any digit or measurement, or an
// over-long sentence. A hyphen "-" is allowed ("… - Laminate Flooring").
const NOT_TITLE = /[=/—″"]|\d|\bmm\b/;
const looksCollection = (s) => { const v = str(s); return v.length >= 3 && v.length <= 45 && /[A-Za-z]/.test(v) && !NOT_TITLE.test(v); };

// A species label on a price row (EUROPEAN WHITE OAK, "OAK w/NuOil"); drop the
// finish suffix ("w/ Glaze Tek") that would otherwise litter the product name.
const cleanSpecies = (s) => str(s).replace(/\bw\/.*/i, "").replace(/\s+/g, " ").trim();
const cleanName = (s) => str(s).replace(/\*NEW\*/gi, "").replace(/\bdropped\b/gi, "").replace(/\s+/g, " ").trim();
const titleCase = (s) => str(s).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export function parseHallmark(rows, name = "Hallmark price list") {
  const flooring = [];
  const trims = new Map(); // sku -> { sku, label, price, fits:Set, names:Set }
  const warnings = [];

  let collection = "", type = "hardwood", coverage = null;
  let header = null, species = "", floorPrice = null, trimPrices = {};
  let sawData = false; // did the previous meaningful row emit a floor?

  for (let r = 0; r < (rows?.length || 0); r++) {
    const row = rows[r] || [];
    const c0 = str(row[0]);
    if (!c0 && row.every((c) => str(c) === "")) continue;
    if (/^Prepared especially/i.test(c0)) continue; // account header

    if (isHeaderRow(row)) { header = parseHeader(row); species = ""; floorPrice = null; trimPrices = {}; sawData = false; continue; }

    // Color row: leftmost is a color name, floor column holds a SKU.
    if (header && looksSku(row[header.floorCol])) {
      const floorSku = str(row[header.floorCol]);
      const oldSku = header.oldCol != null ? str(row[header.oldCol]) : "";
      const dropped = /\bdropped\b/i.test(c0);
      const color = cleanName(c0);
      const sp = cleanSpecies(species);
      const label = [sp ? titleCase(sp) : "", color].filter(Boolean).join(" ").trim() || color;
      flooring.push({
        sku: floorSku, name: label, collection, color, coverage,
        cost: floorPrice, type, oldSku, dropped,
      });
      for (const t of header.trims) {
        const tsku = str(row[t.col]);
        if (!looksSku(tsku)) continue;
        const rec = trims.get(tsku) || { sku: tsku, label: t.label, price: trimPrices[t.col] ?? null, fits: new Set(), names: new Set() };
        if (rec.price == null && trimPrices[t.col] != null) rec.price = trimPrices[t.col];
        rec.fits.add(floorSku);
        if (label) rec.names.add(label);
        trims.set(tsku, rec);
      }
      sawData = true;
      continue;
    }

    // Price row: floor column holds a price/N-A (not a SKU). Sets the price that
    // the color rows beneath inherit; col0 may name the species.
    if (header && looksPrice(row[header.floorCol]) && !looksSku(row[header.floorCol])) {
      floorPrice = num(row[header.floorCol]);
      trimPrices = {};
      for (const t of header.trims) trimPrices[t.col] = num(row[t.col]);
      if (c0) species = c0;
      sawData = false;
      continue;
    }

    // Otherwise a single-cell prose line: coverage, a new collection banner, or
    // ignorable construction/footnote text.
    const cov = coverageIn(c0);
    if (cov != null) { coverage = cov; continue; }
    if ((!collection || sawData) && looksCollection(c0)) {
      collection = cleanName(c0); type = typeOf(collection);
      header = null; species = ""; floorPrice = null; trimPrices = {}; coverage = null; sawData = false;
    }
  }

  const CANON = ["Item #", "Name", "Collection", "Color", "Size", "SF/Carton", "Cost", "Price U/M", "Type", "Kind", "Brand"];
  const out = [CANON.slice()];
  for (const f of flooring) {
    const note = [f.oldSku && `old #${f.oldSku}`, f.dropped && "dropped"].filter(Boolean).join(" · ");
    out.push([f.sku, f.name, f.collection, f.color, note, f.coverage != null ? String(f.coverage) : "",
      f.cost != null ? String(f.cost) : "", "SF", f.type, "", BRAND]);
  }
  for (const t of trims.values()) {
    const fits = [...t.fits];
    const parent = [...t.names][0] || "";
    const desc = [parent ? `${parent} — ${t.label}` : t.label, fits.length && `· fits ${fits.slice(0, 6).join(" ")}`].filter(Boolean).join(" ");
    out.push([t.sku, desc, "", "", "", "", t.price != null ? String(t.price) : "", "EA", "", "trim", BRAND]);
  }

  if (!flooring.length) warnings.push("No Hallmark product rows were recognized — is this the OVF Hallmark price sheet?");
  return { name, rows: out, mapping: { ...HALLMARK_MAPPING }, warnings, meta: { flooring: flooring.length, trims: trims.size } };
}

// Passthrough mapping: the parser has already resolved every column, so this is
// a straight column→field assignment (like Mannington's CANON_MAPPING). Floor
// and trim codes are alphanumeric with a digit and may carry a hyphen.
export const HALLMARK_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "color", 4: "note", 5: "sfPerUnit", 6: "cost", 7: "priceUnit", 8: "type", 9: "trim", 10: "brand" },
  headerRow: 0,
  skuPattern: "^(?=.*\\d)[A-Za-z0-9-]{3,24}$",
  defaultType: "",
  groupBy: "productLine",
};

// The sheet that looks like the OVF Hallmark list — the "Prepared especially
// for KEIM" account line plus the "SPECIES / COLOR" banded header. Takes the
// app's parsed-sheet list ([{ name, rows }]); null when no sheet qualifies.
export function findHallmarkSheet(sheets) {
  for (const s of sheets || []) {
    let keim = false, species = false;
    for (const row of (s?.rows || []).slice(0, 40)) {
      if (/^Prepared especially/i.test(str(row?.[0]))) keim = true;
      if (isHeaderRow(row || [])) species = true;
    }
    if (keim && species) return s;
  }
  return null;
}
export const isHallmarkWood = (sheets) => !!findHallmarkSheet(sheets);

// --- Tarkett Home LVT ---------------------------------------------------------

const TK_BRAND = "Tarkett";

// Tarkett item codes are bare digit runs (270311021), floors and trims alike.
const looksNumSku = (s) => /^\d{6,12}$/.test(str(s));

// A Tarkett header row starts the design grid ("Design" / "Design/Color").
const isTkHeader = (row) => /^Design(\s*\/\s*Color)?$/i.test(str(row[0]));

// The floor price cell of a price row: "$3.97/SF".
const isSfPrice = (s) => /\/\s*SF\s*$/i.test(str(s)) && num(s) != null;

// "7\" x 60\"" out of a size/coverage prose cell.
const tkSize = (s) => {
  const m = str(s).match(/(\d+(?:\.\d+)?)\s*["″”]\s*x\s*(\d+(?:\.\d+)?)\s*["″”]/);
  return m ? `${m[1]}" x ${m[2]}"` : "";
};

// A ProGen sub-banner repeats the collection with its size ("Tarkett ProGen
// 5\" x 48\" Planks") — the size half is a block property, not a new collection.
const tkCollection = (s) =>
  str(s).replace(/[™®]/g, "").replace(/\s*\d+(?:\.\d+)?\s*["″”]?\s*x\s*\d+(?:\.\d+)?\s*["″”]?\s*(?:planks?|tiles?)\s*$/i, "").replace(/\s+/g, " ").trim();

// Molding column label → the name we store ("Quarter Round (94\")" → "Quarter
// Round"); the length annotation carries no product meaning.
const tkTrimLabel = (s) => str(s).replace(/\([^)]*\)/g, " ").replace(/["″”]/g, " ").replace(/\s+/g, " ").trim();

export function parseTarkett(rows, name = "Tarkett price list") {
  const flooring = [];
  const accessories = [];
  const trims = new Map(); // sku -> { sku, label, price, fits:Set, names:Set }
  const warnings = [];

  let collection = "", size = "", coverage = null;
  let header = null;            // { itemCol, trims: [{col, label}] } — design grid
  let acc = null;               // { itemCol, priceCol, unit, noteCols } — accessory table
  let floorPrice = null, trimPrices = {};

  for (let r = 0; r < (rows?.length || 0); r++) {
    const row = rows[r] || [];
    const c0 = str(row[0]);
    if (row.every((c) => str(c) === "")) continue;
    if (/^Prepared especially/i.test(c0)) continue;

    // Collection banner. Resets the grid state; a ProGen-style sub-banner keeps
    // the collection name (stripped of its size) and carries the size prose in a
    // far column, picked up by the SF/CT scan below.
    if (/^Tarkett\b/i.test(c0)) {
      collection = tkCollection(c0);
      header = null; acc = null; floorPrice = null; trimPrices = {}; size = ""; coverage = null;
    }

    // Size/coverage prose — its own line, or the far column of a sub-banner.
    const prose = row.find((c) => /SF\s*\/\s*CT/i.test(str(c)));
    if (prose != null) {
      const cov = coverageIn(prose);
      if (cov != null) coverage = cov;
      const sz = tkSize(prose);
      if (sz) size = sz;
      continue;
    }
    if (/^Tarkett\b/i.test(c0)) continue; // banner with no prose cell

    if (isTkHeader(row)) {
      header = { itemCol: 1, trims: [] };
      acc = null; floorPrice = null; trimPrices = {};
      for (let c = 1; c < row.length; c++) {
        const label = str(row[c]);
        if (!label) continue;
        if (/item/i.test(label)) header.itemCol = c;
        else if (c > 1) header.trims.push({ col: c, label: tkTrimLabel(label) });
      }
      continue;
    }

    // Accessory table header ("Product | … | Item # | … | Price/EA"). The last
    // price-labeled column is the sell unit (Price/RL beats Price/SF on the
    // underlayment table — rolls are what's ordered).
    if (/^Product$/i.test(c0)) {
      acc = { itemCol: -1, priceCol: -1, unit: "EA", noteCols: [] };
      header = null;
      for (let c = 1; c < row.length; c++) {
        const label = str(row[c]);
        if (!label) continue;
        if (/item/i.test(label)) acc.itemCol = c;
        else if (/price/i.test(label)) {
          acc.priceCol = c;
          const m = label.match(/\/\s*(EA|RL|CT|SF)/i);
          if (m) acc.unit = m[1].toUpperCase();
        } else acc.noteCols.push(c);
      }
      if (acc.itemCol < 0 || acc.priceCol < 0) acc = null;
      continue;
    }

    // Price row: floor $/SF leads; each molding column carries its per-piece
    // price ("N/A/EA" → null, the FlexGen case).
    if (header && isSfPrice(c0)) {
      floorPrice = num(c0);
      trimPrices = {};
      for (const t of header.trims) trimPrices[t.col] = num(row[t.col]);
      continue;
    }

    // Design row: one floor + its molding fan-out.
    if (header && looksNumSku(row[header.itemCol])) {
      const floorSku = str(row[header.itemCol]);
      flooring.push({ sku: floorSku, name: c0, collection, size, coverage, cost: floorPrice });
      for (const t of header.trims) {
        const tsku = str(row[t.col]);
        if (!looksNumSku(tsku)) continue;
        const rec = trims.get(tsku) || { sku: tsku, label: t.label, price: trimPrices[t.col] ?? null, fits: new Set(), names: new Set() };
        if (rec.price == null && trimPrices[t.col] != null) rec.price = trimPrices[t.col];
        rec.fits.add(floorSku);
        if (c0) rec.names.add(c0);
        trims.set(tsku, rec);
      }
      continue;
    }

    // Accessory row: name + item # + price, with the size/coverage/pack cells
    // folded into the name so nothing the sheet says is lost.
    if (acc && looksNumSku(row[acc.itemCol])) {
      const notes = acc.noteCols.map((c) => str(row[c]).replace(/\s+/g, " ")).filter(Boolean);
      accessories.push({
        sku: str(row[acc.itemCol]),
        name: [c0, ...notes].filter(Boolean).join(" — "),
        collection, cost: num(row[acc.priceCol]), unit: acc.unit,
      });
    }
  }

  const CANON = ["Item #", "Name", "Collection", "Color", "Size", "SF/Carton", "Cost", "Price U/M", "Type", "Kind", "Brand"];
  const out = [CANON.slice()];
  for (const f of flooring) {
    out.push([f.sku, f.name, f.collection, "", f.size, f.coverage != null ? String(f.coverage) : "",
      f.cost != null ? String(f.cost) : "", "SF", "vinyl", "", TK_BRAND]);
  }
  for (const a of accessories) {
    out.push([a.sku, a.name, a.collection, "", "", "", a.cost != null ? String(a.cost) : "", a.unit, "", "", TK_BRAND]);
  }
  for (const t of trims.values()) {
    const fits = [...t.fits];
    const parent = [...t.names][0] || "";
    const desc = [parent ? `${parent} — ${t.label}` : t.label, fits.length && `· fits ${fits.slice(0, 6).join(" ")}`].filter(Boolean).join(" ");
    out.push([t.sku, desc, "", "", "", "", t.price != null ? String(t.price) : "", "EA", "", "trim", TK_BRAND]);
  }

  if (!flooring.length) warnings.push("No Tarkett product rows were recognized — is this the OVF Tarkett LVT price sheet?");
  return { name, rows: out, mapping: { ...TARKETT_MAPPING }, warnings, meta: { flooring: flooring.length, trims: trims.size, accessories: accessories.length } };
}

// Passthrough mapping, same column plan as Hallmark except col 4 is a real size
// ("7\" x 60\"") rather than a note. Item codes are bare digit runs.
export const TARKETT_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "color", 4: "size", 5: "sfPerUnit", 6: "cost", 7: "priceUnit", 8: "type", 9: "trim", 10: "brand" },
  headerRow: 0,
  skuPattern: "^\\d{6,12}$",
  defaultType: "",
  groupBy: "productLine",
};

// The sheet that looks like the OVF Tarkett LVT list — the KEIM account line,
// a "Tarkett …" collection banner, and the Design grid header. The file's six
// hidden reference tabs (Premier, Vista…) carry none of these together.
export function findTarkettSheet(sheets) {
  for (const s of sheets || []) {
    let keim = false, banner = false, design = false;
    for (const row of (s?.rows || []).slice(0, 40)) {
      if (/^Prepared especially/i.test(str(row?.[0]))) keim = true;
      if (/^Tarkett\b/i.test(str(row?.[0]))) banner = true;
      if (isTkHeader(row || [])) design = true;
    }
    if (keim && banner && design) return s;
  }
  return null;
}
export const isTarkettLvt = (sheets) => !!findTarkettSheet(sheets);

// The one entry the import flow calls: recognize an OVF banded workbook among a
// file's parsed sheets and flatten it to the canonical { name, rows, mapping,
// warnings } the wizard consumes (the xlsx twin of the isManningtonCartons ?
// parseManningtonPages : parsePdfPages fork). Null when the file is not an OVF
// banded book, so the caller falls through to the generic mapped path.
export function parseOvf(sheets, name) {
  const hall = findHallmarkSheet(sheets);
  if (hall) return parseHallmark(hall.rows, name || "Hallmark price list");
  const tk = findTarkettSheet(sheets);
  if (tk) return parseTarkett(tk.rows, name || "Tarkett price list");
  return null;
}
