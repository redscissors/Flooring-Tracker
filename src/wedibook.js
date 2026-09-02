// wedi distribution pricelist parser (spec 2026-09-02, 8b; ADR 0038).
//
// The pricelist is a formatted vendor workbook, not a table: section-title
// rows interleaved with product rows, note rows, and column layouts that
// change WITHIN a sheet ("wedi Fundo" prints one header at row 3 and a
// different caption row for every section after it). A column mapping cannot
// read it. This is the sanctioned dedicated-parser exception (ADR 0009 §4),
// the same shape as ovfbook.js's parseSundries: walk the rows, let each
// header/section row re-map the columns, emit product rows, and flatten the
// result to the canonical { name, rows, mapping, warnings } the import wizard
// already consumes — so the book is an ordinary order-kind registry book and
// nothing downstream knows a parser was involved.
//
// Only two sheets are in scope (owner, 2026-09-02): Builder Choice publishes
// no retail, Wellness reuses one part number across sizes, New Product Data
// has no prices. They are skipped BY NAME and named in a warning, so a
// renamed or re-formatted sheet yields zero rows and says so, never
// plausible garbage.

const str = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();

export const WEDI_PRICELIST_SHEETS = ["wedi Fundo", "wedi S-Dry"];

// A wedi part number: a US code, or a nine-digit article number (the linear
// cover frames, the ramp). A trailing asterisk is a footnote marker on the
// sheet (US3000042*), not part of the code.
const PART_RE = /^(US\d{7,9}|\d{9})\*?$/;
const RETAIL_CAP = /^retail (unit )?price/i;
const NET_CAP = /distributor net/i;
const SIZE_CAP = /^(size|dimensions|product information)/i;
const DETAILS_CAP = /^(additional details|drain location)/i;
const PART_CAP = /^part number$/i;
const ERP_CAP = /^stock skus$/i;
// Every caption word a section-title row can carry beside its title. A row
// whose non-title cells are ALL captions is a section row even when it
// captions no price column (the building-panel blocks: "Sheets/Package",
// "ft2", "Sheet" under a "Part Number" header that already mapped the
// columns).
const CAPTION_RE = /^(size|dimensions|drain location|product information|additional details|retail|distributor net|contractor|dealer|sheets\/package|ft2|sheet|product|part number|stock skus|volume|price)/i;

/** The Fundo sheet's title line, on the sheet named "wedi Fundo". */
export function isWediPricelist(sheets) {
  if (!Array.isArray(sheets)) return false;
  const s = sheets.find((x) => str(x?.name) === "wedi Fundo");
  if (!s) return false;
  return (s.rows || []).slice(0, 3).some((r) => (r || []).some((c) => /wedi distribution pricelist/i.test(str(c))));
}

/**
 * One sheet → WEDI_SO-shaped rows. `cols` is the current column map; a
 * header row ("Part Number" …) or any row that captions a price column
 * rewrites it, and the title cell of a non-header caption row becomes the
 * section. Product rows before any header are skipped with a warning.
 */
export function parseWediSheet(rows, sheetName) {
  const items = [], warnings = [];
  let section = "", cols = null;
  for (const raw of rows || []) {
    const row = raw || [];
    const cells = row.map(str);
    const pi = cells.findIndex((c) => PART_RE.test(c));
    if (pi >= 0) {
      if (!cols) { warnings.push(`${sheetName}: ${cells[pi]} appears before any header row and was skipped`); continue; }
      const num = (i) => (i >= 0 && typeof row[i] === "number" ? row[i] : null);
      // Size: the captioned column, else two right of the part number (the
      // Pro-Systems block captions no size column). Details: the captioned
      // column when it has text, else the cell right of the size — the joint
      // sealant block captions "Additional Details" at a column that is empty
      // on rows whose real note sits one cell left. Both rules measured
      // against all 223 transcribed rows (plan, "Measured facts").
      const sizeI = cols.size >= 0 ? cols.size : pi + 2;
      const size = (cells[sizeI] || "").replace(/\bin\.\s+in\.$/, "in.");
      const details = (cols.details >= 0 && cells[cols.details]) || cells[sizeI + 1] || "";
      const pct = /less\s*(\d+)\s*%/i.exec(cols.netCaption);
      items.push({
        us: cells[pi].replace(/\*$/, ""),
        name: cells[pi + 1] || "",
        size, details,
        retail: num(cols.retail),
        net: num(cols.net),
        section,
        discount: pct ? +pct[1] : null,
        erp: cols.erp >= 0 ? cells[cols.erp] : "",
      });
      continue;
    }
    const filled = cells.map((c, i) => [c, i]).filter(([c]) => c);
    if (!filled.length) continue;
    const [first] = filled[0];
    const rest = filled.slice(1);
    const isHeader = cells.some((c) => PART_CAP.test(c));
    const pricesCaptioned = rest.some(([c]) => RETAIL_CAP.test(c) || NET_CAP.test(c));
    if (isHeader || pricesCaptioned) {
      let net = -1, netCaption = "";
      // The RIGHTMOST distributor-net column: S-Dry prints a six-column
      // discount ladder and net is the last of it.
      cells.forEach((c, i) => { if (NET_CAP.test(c)) { net = i; netCaption = c; } });
      const erpI = cells.findIndex((c) => ERP_CAP.test(c));
      cols = {
        retail: cells.findIndex((c) => RETAIL_CAP.test(c)),
        net, netCaption,
        size: cells.findIndex((c) => SIZE_CAP.test(c)),
        details: cells.findIndex((c) => DETAILS_CAP.test(c)),
        // Only the sheet's one true header names the ERP column; it carries
        // forward through every section row after it.
        erp: erpI >= 0 ? erpI : (cols ? cols.erp : -1),
      };
      if (!(PART_CAP.test(first) || ERP_CAP.test(first))) section = first;
      continue;
    }
    if (rest.length && rest.every(([c]) => CAPTION_RE.test(c))) section = first;
    // Anything else — title lines, "Full Pallet/Box Quantities Only", the
    // "*Contains …" kit notes, Terms of Sale — is not a row.
  }
  return { items, warnings };
}

// Passthrough mapping: every column is already what parseMapped wants. `size`
// is mapped, so splitSizeFromDescription never runs on wedi's names (they
// carry their size by design). `price` is wedi's published retail — pricedItem
// passes an item with its own price straight through, so row search shows it
// unchanged. `section` is the markup-group axis, as OVF sundries does.
// "Discount %" (column 8) is deliberately unmapped: nothing in the engine
// reads it (spec decision 2); it is on the canonical sheet only so the
// wizard's preview shows it.
export const WEDI_PRICELIST_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "size", 3: "note", 4: "price", 5: "cost", 6: "section", 7: "vendorSku" },
  headerRow: 0,
  skuPattern: "^(US\\d{7,9}|\\d{9})$",
  defaultType: "",
  groupBy: "section",
};

/**
 * The one entry the import flow calls. Null when the workbook is not a wedi
 * pricelist (the caller falls through to the generic mapped path, exactly as
 * parseOvf's null does). Sheets are walked in WEDI_PRICELIST_SHEETS order and
 * the FIRST sheet to price a part number wins — Fundo over S-Dry — with the
 * disagreement named in a warning so it shows in the wizard.
 */
export function parseWediPricelist(sheets, name = "wedi pricelist") {
  if (!isWediPricelist(sheets)) return null;
  const warnings = [], seen = new Map(), items = [];
  for (const sheetName of WEDI_PRICELIST_SHEETS) {
    const s = sheets.find((x) => str(x?.name) === sheetName);
    if (!s) { warnings.push(`Sheet "${sheetName}" not found — its rows were not imported`); continue; }
    const r = parseWediSheet(s.rows, sheetName);
    warnings.push(...r.warnings);
    if (!r.items.length) warnings.push(`Sheet "${sheetName}" yielded no rows — has its layout changed?`);
    for (const it of r.items) {
      const prev = seen.get(it.us);
      if (prev) {
        if (prev.retail !== it.retail || prev.net !== it.net) {
          warnings.push(`${it.us} is priced on both "${prev.sheet}" ($${prev.retail} / $${prev.net}) and "${sheetName}" ($${it.retail} / $${it.net}) — kept "${prev.sheet}"`);
        }
        continue;
      }
      seen.set(it.us, { ...it, sheet: sheetName });
      items.push(it);
    }
  }
  const skipped = sheets.map((x) => str(x?.name)).filter((n) => n && !WEDI_PRICELIST_SHEETS.includes(n));
  if (skipped.length) warnings.push(`Skipped sheets not in scope: ${skipped.join(", ")}`);
  const CANON = ["Part Number", "Product", "Size", "Details", "Retail", "Distributor net", "Section", "Stock SKU", "Discount %"];
  const rows = [CANON, ...items.map((it) => [it.us, it.name, it.size, it.details, it.retail, it.net, it.section, it.erp, it.discount])];
  return { name, rows, mapping: { ...WEDI_PRICELIST_MAPPING }, warnings, meta: { items: items.length } };
}
