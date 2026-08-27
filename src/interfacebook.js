// Parser for the Interface dealer price list ("Interface Price List — Keim").
//
// Interface quotes carpet tile the trade way — dollars per SQUARE YARD — and
// the sheet states no carton sizes, no colors, and no per-color SKUs: one row
// per STYLE (the orderable unit is style + colorway, colors picked off the
// sample deck). The app prices everything per square foot, so costs convert at
// import ($/sy ÷ 9) and carton coverage comes from the rep's stated packs
// (Jeff Krejci, 2026-07-03): most styles 5.98 sy/carton = 53.82 sf, 20 tiles;
// higher face weight 4.78 sy = 43.02 sf, 16 tiles. The sheet doesn't say which
// styles are the heavy packs, so the standard pack is assumed and the wizard
// warns — coverage only rounds the order, the $/sf cost is right either way.
//
// The one size column is a coded format letter, decoded off the sheet's own
// rotated legend: SP = 25cm × 1m skinny plank, 50 = 50cm × 50cm square,
// M = 1m × 1m, P = 50cm × 1m. The two large formats (M/P) get no assumed
// carton — their packs aren't the rep's 20-tile figure — so they order by
// exact square feet until the rep states one.
//
// A trailing LVT section (its own "Product Name … Thickness Price" header)
// prices per square foot as printed and imports as vinyl with its stated
// metric size and thickness.
//
// Emits the same { name, rows, mapping, warnings, meta } contract the other
// vendor parsers produce (manningtonbook.js), feeding the mapped-import wizard
// unchanged. The collection ("Open Air", "Past Forward") deliberately rides the
// canonical MFG column, not Product Line: mappedItem fronts a product line onto
// every name, and Interface style names overlap their collection names ("Open
// Air 401 Stria" in "Open Air Stria") in ways that double the words. MFG is
// searchable (search_text), diff-tracked, shows as the search subtitle, and is
// the markup groupBy — everything a collection needs — while the description
// stays exactly the style name this module cases by hand (codes like WW860
// keep their capitals, which the generic smartCase would fold to "Ww860").

import { clusterRows } from "./pdfbook.js";

const str = (c) => (c == null ? "" : String(c).trim());
const num = (c) => { const n = parseFloat(str(c).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
const round4 = (n) => Math.round(n * 10000) / 10000;

// Column bands (PDF units). The name leads far left; the format code / LVT size
// sits at ~247; the collection at ~328; the i2 flag at ~461; the price at ~515.
const FORMAT_X = 240, COLLECTION_X = 320, FLAG_X = 455, PRICE_X = 500;
// LVT pages move the thickness into the flag band's space.
const LVT_COLLECTION_X = 320, LVT_THICK_X = 430;

const SY_TO_SF = 9;
// The rep's standard pack: 5.98 sy/carton (53.82 sf), 20 tiles — skinny planks
// and 50cm squares. Heavier face weights pack 4.78 sy (43.02 sf, 16 tiles).
const CARTON_SF = 53.82, CARTON_PC = 20;

const FORMATS = {
  SP: { size: "25cm x 1m plank", carton: true },
  50: { size: "50cm x 50cm", carton: true },
  M: { size: "1m x 1m", carton: false },
  P: { size: "50cm x 1m plank", carton: false },
};

const cellIn = (items, lo, hi) => items.filter((i) => i.x >= lo && i.x < hi).sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ").trim();

// Style-name casing this module owns (the generic smartCase would fold WW860 to
// "Ww860"): tokens carrying a digit and roman numerals keep the sheet's caps,
// ALL-CAPS words title-case, anything already mixed or lowercase ("mm" in the
// LVT names) is the sheet's own casing and stays. The trailing footnote
// asterisk is dropped everywhere.
const caseWord = (w) =>
  /\d/.test(w) || /^[IVX]+$/.test(w) || /[a-z]/.test(w)
    ? w
    : w.toLowerCase().replace(/(^|['’-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
const styleName = (s) => str(s).replace(/\s*\*+$/, "").split(/\s+/).filter(Boolean).map(caseWord).join(" ");

// True when the pages look like the Interface list: the carpet header line
// ("Style Name … Collection i2 Price") on an early page. The i2 word is the
// tell — no other vendor prints that column.
export function isInterfacePriceList(pages) {
  for (const page of (pages || []).slice(0, 4)) {
    const items = (page || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    for (const row of clusterRows(items)) {
      const line = [...row.items].sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");
      if (/Style\s*Name/.test(line) && /\bCollection\b/.test(line) && /\bi2\b/.test(line) && /\bPrice\b/.test(line)) return true;
    }
  }
  return false;
}

// Canonical schema + passthrough mapping (the parser resolves every row, so the
// mapping is a straight column→field assignment like manningtonbook's).
const CANON = ["Style", "Name", "Collection", "Size", "Thickness", "SF/Ctn", "Pc/Ctn", "Cost", "Price U/M", "Order U/M", "Type", "Brand", "Note"];
const CANON_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "mfg", 3: "size", 4: "thickness", 5: "sfPerUnit", 6: "pcPerUnit", 7: "cost", 8: "priceUnit", 9: "orderUnit", 10: "type", 11: "brand", 12: "note" },
  headerRow: 0,
  // The SKU is the style name as printed — words, digits, &, ', periods and (on
  // colliding names) a trailing format code.
  skuPattern: "^[A-Za-z0-9][A-Za-z0-9 .&'+/-]{2,45}$",
  defaultType: "",
  groupBy: "mfg",
};

const BRAND = "Interface";

export function parseInterfacePages(pages, name = "Interface price list") {
  const carpet = []; // { sku, name, collection, format, i2, sy }
  const lvt = [];    // { sku, name, collection, size, thickness, sf }
  const warnings = [];
  let mode = "carpet"; // flips to "lvt" at the second header and stays
  let pendingCollection = ""; // a wrapped collection prints its first line(s) on their own baseline ABOVE the data row

  for (const page of pages || []) {
    const items = (page || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    for (const row of clusterRows(items)) {
      const sorted = [...row.items].sort((a, b) => a.x - b.x);
      const line = sorted.map((i) => str(i.str)).join(" ");
      if (/Product\s*Name/.test(line) && /Thickness/.test(line) && /\bPrice\b/.test(line)) { mode = "lvt"; pendingCollection = ""; continue; }
      if (/Style\s*Name/.test(line) || /^\d{4}$/.test(line)) continue; // the carpet header / the corner year stamp

      const price = num(cellIn(row.items, PRICE_X, 9999));
      const nm = cellIn(row.items, 0, FORMAT_X);
      if (price == null || !nm) {
        // A priceless row with text only in the collection band is a wrapped
        // collection name — it belongs to the NEXT data row.
        const coll = cellIn(row.items, COLLECTION_X, FLAG_X);
        if (price == null && !nm && coll && row.items.every((i) => i.x >= COLLECTION_X && i.x < FLAG_X)) {
          pendingCollection = [pendingCollection, coll].filter(Boolean).join(" ");
        }
        continue;
      }

      if (mode === "lvt") {
        lvt.push({
          sku: str(nm).replace(/\s*\*+$/, ""),
          name: styleName(nm),
          collection: cellIn(row.items, LVT_COLLECTION_X, LVT_THICK_X),
          size: cellIn(row.items, FORMAT_X, LVT_COLLECTION_X),
          thickness: cellIn(row.items, LVT_THICK_X, PRICE_X),
          sf: price,
        });
        continue;
      }

      const format = cellIn(row.items, FORMAT_X, COLLECTION_X);
      if (!FORMATS[format]) { pendingCollection = ""; continue; } // boilerplate/footnote lines
      const flag = cellIn(row.items, FLAG_X, PRICE_X);
      carpet.push({
        sku: str(nm).replace(/\s*\*+$/, ""),
        name: styleName(nm),
        collection: [pendingCollection, cellIn(row.items, COLLECTION_X, FLAG_X)].filter(Boolean).join(" "),
        format,
        i2: /^(i2|Y)$/i.test(flag),
        sy: price,
      });
      pendingCollection = "";
    }
  }

  // Two styles can share a name across formats (VIVA COLORES ships as both a
  // square and a skinny plank) — the format code joins the SKU to keep the
  // (book, sku) identity honest.
  const dupes = new Set();
  { const seen = new Set(); for (const c of carpet) { if (seen.has(c.sku)) dupes.add(c.sku); seen.add(c.sku); } }

  const rows = [CANON.slice()];
  for (const c of carpet) {
    const f = FORMATS[c.format];
    // A pure-code style name (WW860, AE310) means nothing alone — the
    // collection fronts it. Worded names stand on their own; the collection
    // still rides the MFG column for search and markup grouping.
    const coded = c.name.split(/\s+/).every((w) => /\d/.test(w));
    const desc = coded && c.collection ? `${c.collection} ${c.name}` : c.name;
    rows.push([
      dupes.has(c.sku) ? `${c.sku} ${c.format}` : c.sku,
      desc, c.collection, f.size, "",
      f.carton ? String(CARTON_SF) : "", f.carton ? String(CARTON_PC) : "",
      String(round4(c.sy / SY_TO_SF)), "SF", f.carton ? "CT" : "",
      "carpet", BRAND, c.i2 ? "i2 — non-directional install" : "",
    ]);
  }
  for (const v of lvt) {
    rows.push([v.sku, v.name, v.collection, v.size, v.thickness, "", "", String(v.sf), "SF", "", "vinyl", BRAND, ""]);
  }

  if (carpet.length) {
    warnings.push(`Interface quotes carpet tile per square yard — costs imported as $/sy ÷ 9 per sq ft. Carton coverage assumed ${CARTON_SF} sf (5.98 sy, ${CARTON_PC} tiles); higher face weight styles pack 43.02 sf (4.78 sy, 16 tiles) — confirm with the rep before ordering those.`);
    const large = carpet.filter((c) => !FORMATS[c.format].carton).length;
    if (large) warnings.push(`${large} large-format style${large === 1 ? "" : "s"} (1m x 1m / 50cm x 1m) carry no stated carton — they order by exact square feet.`);
  }
  if (!carpet.length && !lvt.length) warnings.push("No Interface product rows were recognized — is this the Interface dealer price list?");

  return { name, rows, mapping: { ...CANON_MAPPING }, warnings, meta: { carpet: carpet.length, lvt: lvt.length } };
}
