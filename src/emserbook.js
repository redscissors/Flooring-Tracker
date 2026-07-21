// Parser for the Emser Tile "ISPL" dealer price list (issue: vendor price
// sheet setup). Emser generates a per-account workbook — title cell "July 2026
// Item Price List: 1374258 KEIM LUMBER COMPANY" — whose "Item Price List"
// sheet is a flat table under a 7-row title/legend block. The generic mapped
// importer can't take it raw: "Item Number" doesn't guess to SKU (and "Price"
// alone never guesses to cost), so header detection finds nothing, and three
// columns need semantics no column map can express — the Size cell packs a
// mosaic's chip AND backing sheet into one token ("1X1/13X13", ADR 0014's
// split), the UOM switches the coverage columns' meaning (an LF-priced trim's
// SF/CT must NOT become sfPerUnit or the $/LF price derives a bogus $/sqft),
// and the drop status is spread across three columns. Like Mannington
// (ADR 0012) and OVF (issue 025) this is a sanctioned dedicated-parser
// exception (ADR 0009 §4): flattened here to the same canonical
// { name, rows, mapping, warnings } contract, feeding the mapped-import
// wizard unchanged.
//
// The workbook's "Series Price List" sheet is a per-price-class summary of the
// same data (no item numbers) and is deliberately ignored.
//
// Honesty guarantee (as everywhere): a row only becomes an item when its Item
// Number cell looks like an Emser SKU (8-24 uppercase alphanumerics), so a
// re-organized sheet degrades to visible missing counts downstream, never
// garbage rows.

const str = (c) => (c == null ? "" : String(c).trim());
const num = (c) => { const n = parseFloat(str(c).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
const round4 = (n) => Math.round(n * 10000) / 10000;
const titleCase = (s) => str(s).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
// SHOUTING vendor text → Title Case; already-cased text is left alone.
const smartCase = (s) => { const v = str(s); return v && !/[a-z]/.test(v) ? titleCase(v) : v; };

// Header labels → the roles the parser reads. Matched on the normalized label
// (lowercase, alphanumerics only) so "SF/CT or LF/CT" and "Order " compare
// clean. Columns are located by label, never by fixed index, so a re-ordered
// export still parses.
const LABELS = {
  priceclass: "priceClass",
  itemnumber: "sku",
  description: "desc",
  series: "series",
  size: "size",
  materialtype: "material",
  producttype: "ptype",
  pcct: "pcct",
  sfctorlfct: "sfct",
  price: "price",
  uom: "uom",
  dropfrompb: "status",
  abcrating: "abc",
  droppedwilldrop: "dropped",
};
const normLabel = (c) => str(c).toLowerCase().replace(/[^a-z0-9]/g, "");

// Emser item numbers are 8-24 uppercase alphanumerics (F51AFLOCO1313MO1,
// V19DYNA12MMADBI3296M); header text and legend prose all fail this.
const EMSER_SKU = /^[A-Z0-9]{8,24}$/;

// The Item Price List sheet: a header row in the top block carrying at least
// Item Number, Price Class, Price and UOM. The sibling "Series Price List"
// sheet has no Item Number column, so only the item sheet qualifies.
export function findEmserSheet(sheets) {
  for (const s of sheets || []) {
    const rows = s?.rows || [];
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const cols = {};
      (rows[r] || []).forEach((c, i) => {
        const role = LABELS[normLabel(c)];
        if (role && cols[role] == null) cols[role] = i;
      });
      if (["sku", "priceClass", "price", "uom"].every((k) => cols[k] != null)) {
        return { sheet: s, headerRow: r, cols };
      }
    }
  }
  return null;
}
export const isEmserIspl = (sheets) => !!findEmserSheet(sheets);

// --- the Size cell ------------------------------------------------------------
// "13X13" is a plain L×W. "1X1/13X13" is chip-size/backing-sheet — the chip is
// the tile (grout math), the sheet is only sheetSize (ADR 0014). A non-numeric
// chip token ("PEBB/12X12", "HX2/10X11") means the sheet dimension is real but
// the chip isn't an L×W — sheetSize only, with the vendor's own token kept in
// the note so nothing the sheet says is lost. "VERSAILLES SET" and friends have
// no dimensions at all — note only.
const LXW = /^(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/i;
const dims = (t) => { const m = LXW.exec(t); return `${m[1]}x${m[2]}`; };
export function parseSizeCell(cell) {
  const raw = str(cell);
  const v = raw.toUpperCase().replace(/\s+/g, "");
  if (!v) return { size: "", sheetSize: "", odd: "" };
  const [chip, sheet, ...rest] = v.split("/");
  if (sheet == null) return LXW.test(chip) ? { size: dims(chip), sheetSize: "", odd: "" } : { size: "", sheetSize: "", odd: raw };
  if (!rest.length) {
    const c = LXW.test(chip), sh = LXW.test(sheet);
    if (c && sh) return { size: dims(chip), sheetSize: dims(sheet), odd: "" };
    if (sh) return { size: "", sheetSize: dims(sheet), odd: raw };
    if (c) return { size: dims(chip), sheetSize: "", odd: "" }; // sheet half truncated ("0.625X0.625/13X")
  }
  return { size: "", sheetSize: "", odd: raw };
}

// --- the Description cell -----------------------------------------------------
// "AFLOAT COBALT MO 0101/1313" → "Afloat Cobalt Mosaic": the trailing
// "0101/1313" is an internal pattern/size code, an embedded L×W duplicates the
// Size column, and the finish/format abbreviations Emser always uses expand to
// the words the estimate should print. Anything not in the short map is kept
// verbatim — the sheet is the source of truth.
//
// The description is a 30-char ERP field, so a size is often FUSED to the word
// before it ("SBN3X12", "MT39X118", "MO2X2/12X12") — the size strip uses
// digit/dot lookarounds instead of word boundaries so those still clean, and a
// token left holding only slashes ("MO/") sheds them before the word map runs.
const DESC_CODE_RE = /\b\d{3,4}\/\d{3,4}\b/g;
const DESC_SIZE_RE = /(?<![\d.])\d+(?:\.\d+)?X\d+(?:\.\d+)?(?![\d.])/gi;
const DESC_WORDS = { MT: "MATTE", GL: "GLOSSY", PL: "POLISHED", MO: "MOSAIC", SBN: "BULLNOSE", "GLU-D": "GLUE-DOWN" };
export function cleanDescription(desc) {
  const s = str(desc)
    .replace(DESC_CODE_RE, " ")
    .replace(DESC_SIZE_RE, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .map((w) => DESC_WORDS[w] || w)
    .join(" ");
  return smartCase(s);
}

// Material Type → the app's flooring type. The EMCORE LVT/SPC lines are the
// only non-tile flooring Emser carries; everything else (porcelain, ceramic,
// glass, every stone) does tile math. Trims and accessories stay untyped so
// they land as count lines.
const VINYL_RE = /polyvinyl|polymer composite/i;
const typeFor = (material, ptype) => {
  if (/^(trim|accessory)$/i.test(str(ptype))) return "";
  return VINYL_RE.test(str(material)) ? "vinyl" : "tile";
};

const CANON = ["Item #", "Description", "Series", "Section", "Size", "Sheet Size", "SF/CT", "PC/CT", "Cost", "U/M", "Type", "Kind", "Lead Time", "Note", "Flag"];

export function parseEmser(sheets, name) {
  const found = findEmserSheet(sheets);
  if (!found) return null;
  const { sheet, headerRow, cols } = found;
  const rows = sheet.rows || [];
  const cell = (row, role) => (cols[role] != null ? row[cols[role]] : null);

  const out = [CANON.slice()];
  const warnings = [];
  let items = 0, trims = 0, dropped = 0;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const sku = str(cell(row, "sku"));
    if (!EMSER_SKU.test(sku)) continue; // honesty guarantee — see module header
    items++;

    const uom = str(cell(row, "uom")).toUpperCase();
    const ptype = str(cell(row, "ptype"));
    const trim = /^trim$/i.test(ptype);
    if (trim) trims++;
    const { size, sheetSize, odd } = parseSizeCell(cell(row, "size"));
    const status = str(cell(row, "status"));
    const isDropped = /^y$/i.test(str(cell(row, "dropped")));
    if (isDropped) dropped++;

    const note = [
      odd && `size ${odd}`,
      /^new for/i.test(status) && status,
      // "Dropped from price book but still active" (the sheet's own legend) —
      // off the price book but still orderable, unlike a Y-flagged drop.
      /^dropped/i.test(status) && !isDropped && "Dropped from price book, still active",
    ].filter(Boolean).join(" · ");

    // An LF-priced trim's SF/CT is real carton data, but sfPerUnit would derive
    // a $/sqft from the $/LF price and misprice — square-foot semantics only
    // ever attach to SF-priced rows (or PC rows, where perCartonFactor applies).
    const sfct = uom === "LF" ? null : num(cell(row, "sfct"));
    const pcct = num(cell(row, "pcct"));

    out.push([
      sku,
      cleanDescription(cell(row, "desc")),
      str(cell(row, "series")),
      smartCase(cell(row, "material")),
      size,
      sheetSize,
      sfct != null ? String(round4(sfct)) : "",
      pcct != null ? String(pcct) : "",
      num(cell(row, "price")) != null ? String(num(cell(row, "price"))) : "",
      uom,
      typeFor(cell(row, "material"), ptype),
      trim ? "trim" : "",
      /^r$/i.test(str(cell(row, "abc"))) ? "Limited availability" : "",
      note,
      isDropped ? "drop" : "",
    ]);
  }

  if (!items) warnings.push("No Emser item rows were recognized — is this the Emser ISPL price list?");
  return { name: name || "Emser price list", rows: out, mapping: { ...EMSER_MAPPING }, warnings, meta: { items, trims, dropped } };
}

// Passthrough mapping: every column is already resolved. Section (the material
// class — Porcelain, Marble, Glass…) is the markup axis; Series would make 300+
// markup groups. Type is per-row, so no defaultType.
export const EMSER_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "section", 4: "size", 5: "sheetSize", 6: "sfPerUnit", 7: "pcPerUnit", 8: "cost", 9: "unit", 10: "type", 11: "trim", 12: "leadTime", 13: "note", 14: "flag" },
  headerRow: 0,
  skuPattern: EMSER_SKU.source,
  flags: { drop: "discontinued" },
  defaultType: "",
  groupBy: "section",
};
