// Price-book import parsers (ADR 0009): the generic mapped import shared by
// every registry book (order- and stock-kind), plus the vendor template
// recognizers that pre-fill a mapping. Takes plain arrays-of-arrays (SheetJS
// `sheet_to_json({ header: 1 })` output), not a SheetJS workbook, so it is
// testable without the xlsx dependency.
//
// A row is only ever consumed if its SKU cell matches the book's SKU pattern,
// so a re-arranged sheet degrades to "items went missing" (visible in the
// import diff preview) rather than garbage rows.
//
// Adding or changing a sheet import? Read
// docs/skills-reference/floortrack-sheet-imports/SKILL.md first — the
// checklist (truth-table new unit combos, real-row goldens, the old-vs-new
// diff gate) that keeps the lessons encoded below from repeating.
//
// The hand-built adapters for the retired shop workbook (ADR 0003) lived here
// until 2026-07-22; the ERP "Vendor SKU Analysis" stock exports replaced that
// document (ADR 0027) and its parsers went with it.

import { normOrderItem, unitComboWarnings, importSanityWarnings, classifyTrim } from "./orderbook.js";

const str = (c) => (c == null ? "" : String(c).trim());
const numOrNull = (c) => {
  if (c == null || c === "") return null;
  const n = typeof c === "number" ? c : parseFloat(String(c).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const round4 = (n) => (n == null ? null : Math.round(n * 10000) / 10000);

const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

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
//   sfFromDescription: true|undefined — coverage rides in the description text
//                ("… 23.76 sf/ct"), per sell unit (see SF_DESC_RE)
//   leadWidthSize: true|undefined — a description leading with a bare width
//                ('6" Mann AduraMax Plank') puts that width in the size field
//   typeFromDescription: true|undefined — a carton/bundle-sold item with real
//                coverage gets its flooring type read from the description's
//                wording (see floorTypeFromDescription)
// }

// A single fixed pattern can't serve every vendor (VTC codes run 9-16 alnum
// chars), so each book carries its own; this is the default when none is set.
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
// The ERP stock exports lead a description with the bare width — '6" Mann
// AduraMax Plank', '2-1/4" Sheoga Clear RO Flr', '94" … T-Mold' — where the
// vendor sheets leave a bare 6" in the name (see the SHAPE_SIZE_RE note), so
// only mappings that say so (leadWidthSize) pull it into the size field. The
// lookahead leaves a leading L×W ('1/4"x1/2" Slip Tongue', '3/16" x 1/4" x…')
// to SIZE_RE. Consuming the whole mixed fraction here also stops
// THICK_FRAC_RE from reading the 1/4" of a leading 2-1/4" width as a
// thickness, which left "2-" litter in the name.
const LEAD_WIDTH_RE = new RegExp(`^\\s*(${DIM})\\s*["'](?!\\s*[x×])\\s*`);

// SHOUTING vendor text → Title Case; already-cased text is left alone (so an
// intentional acronym like "MSI Stone" survives, while "EARTH ASH GRAY" reads).
const smartCase = (s) => { const v = str(s); return v && !/[a-z]/.test(v) ? titleCase(v) : v; };

// How many leading words of `label` are the product line `pl`, spelled out or
// abbreviated: word i must equal pl's word i, or be a prefix of it — so
// "Earth Ash Gray" leads with "EARTH", "Moroccan Conc Charcoal" leads with
// "MOROCCAN CONCRETE" (Marazzi abbreviates the series in its descriptions),
// but "Earthen Ridge" does not lead with "EARTH". The first word's prefix must
// be ≥3 letters; later words allow ≥2 ("Middleton Sq" → "MIDDLETON SQUARE")
// because the exact lead word already anchors the match. 0 when it doesn't lead.
const seriesLeadWords = (label, pl) => {
  const lw = str(label).toLowerCase().split(/\s+/).filter(Boolean);
  const pw = str(pl).toLowerCase().split(/\s+/).filter(Boolean);
  if (!pw.length || lw.length < pw.length) return 0;
  for (let i = 0; i < pw.length; i++) {
    if (lw[i] !== pw[i] && !(lw[i].length >= (i ? 2 : 3) && pw[i].startsWith(lw[i]))) return 0;
  }
  return pw.length;
};

export function splitSizeFromDescription(desc, opts) {
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
  } else if (opts?.leadWidth && LEAD_WIDTH_RE.test(s)) {
    const lead = s.match(LEAD_WIDTH_RE);
    size = `${lead[1]}"`;
    s = s.slice(lead[0].length);
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
  // A carton-sold row whose description carries no "sf/ct" can't do sqft math —
  // it stays a count line quoting the carton price each. Named so the team can
  // fix the ERP description rather than wonder why one color sells by the pc.
  if (m.sfFromDescription) {
    const bare = deduped.filter((i) => COVERAGE_SOLD_RE.test(str(i.unit)) && !(i.sfPerUnit > 0) && !i.trim);
    if (bare.length) {
      const skus = bare.slice(0, 3).map((i) => i.sku);
      warnings.push(`${bare.length} carton-sold row${bare.length === 1 ? "" : "s"} carry no sf/ct in the description — they'll quote the carton price per piece (${skus.join(", ")}${bare.length > skus.length ? ", …" : ""}).`);
    }
  }
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

// The ERP stock exports carry no SF/CT column — coverage rides at the end of
// the description ("… 23.76 sf", "…10.64sf/c", "….969sf/sh"), per SELL unit
// (carton, bundle, roll, sheet), which is exactly what sfPerUnit means. A
// mosaic's sub-square-foot coverage prints with no leading zero (".969") —
// the leading-decimal alt claims it from the dot (the DIM convention) so the
// bare "969" can't read as the coverage with a stray "." left in the name.
// Only mappings that say so (sfFromDescription) pull it out; a description
// without one stays uncovered rather than invented.
const SF_DESC_RE = /(\d+(?:\.\d+)?|\.\d+)\s*s\.?f\.?(?:\s*\/\s*(?:c(?:t|tn)?|sh(?:t|eet)?s?))?\b/i;

// Units of Stock that bundle coverage — the item is sold in whole cartons/
// bundles/sheets of so-many square feet, never loose pieces. This is the sell
// basis the ERP's U/M column names; EA/RL/GL accessories stay count lines.
// Sheet-sold mosaics ride the same path (orderbook's SHEET_UNIT_RE forms).
const COVERAGE_SOLD_RE = /^(ct|ctn|carton|bx|box|cs|case|bl|bdl|bundle|sh|sht|sheet)s?$/i;

// The ERP stock exports carry no type column, but a carton/bundle-sold item
// with real sf-per-carton coverage IS flooring — the description's wording
// says which kind. Vinyl is tested first because LVP names carry wood species
// ("AduraMax Noble Oak Bark"). When no word decides, the size does: an L×W is
// tile-shaped unless it is plank-long, and a bare width is how these sheets
// spell wood (Mirage, Sheoga, Riverwalk). Callers gate on COVERAGE_SOLD_RE +
// coverage, so accessories and EA trim sticks are never typed by this.
const TYPE_VINYL_RE = /\b(lvp|lvt|vinyl|spc|wpc)\b|adura|realta/i;
// Shape words are tile: a sheet-sold hexagon chip leads with its bare width
// ('2" Anatolia Soho Hexagon'), which the wood fallback would otherwise claim.
const TYPE_TILE_RE = /\b(tile|porcelain|ceramic|mosaic|hex(?:agon)?|penny|octagon)\b/i;
const TYPE_WOOD_RE = /\b(hardwood|oak|hickory|maple|walnut|cherry|birch|acacia|ash|pine|ro|wo|flr|floor(?:ing|s)?|unfinished|prefinished|pf)\b/i;
export function floorTypeFromDescription(text, size) {
  const t = str(text);
  // A sheet-sold membrane (Ditra Heat) has real sf coverage but is no floor.
  if (/\bmembranes?\b/i.test(t)) return null;
  if (TYPE_VINYL_RE.test(t)) return "vinyl";
  if (/\blaminate\b/i.test(t)) return "laminate";
  if (/\bcarpet\b/i.test(t)) return "carpet";
  if (TYPE_TILE_RE.test(t)) return "tile";
  if (TYPE_WOOD_RE.test(t)) return "hardwood";
  const lw = str(size).match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (lw) return Math.max(+lw[1], +lw[2]) >= 36 ? "vinyl" : "tile";
  return str(size) ? "hardwood" : null;
}

function mappedItem(mapping, raw, sku, sem) {
  let type = str(raw.type) || mapping.defaultType || null;
  const cost = numOrNull(raw.cost);
  const price = numOrNull(raw.price);
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
  if (mapping.sfFromDescription && sfPerUnit == null && descText) {
    const sf = descText.match(SF_DESC_RE);
    if (sf) { sfPerUnit = numOrNull(sf[1]); descText = str(descText.replace(sf[0], " ")); }
  }
  if (!size && descText) {
    const split = splitSizeFromDescription(descText, { leadWidth: !!mapping.leadWidthSize });
    if (split.size) size = split.size;
    if (split.thickness && !thickness) thickness = split.thickness;
    // A sheet dimension only stands in when the description gave no chip size —
    // a real chip size (e.g. "2\" Hexagon") always wins for the tile L×W.
    if (split.sheetSize && !size && !sheetSize) sheetSize = split.sheetSize;
    if (split.size || split.thickness || split.sheetSize) descText = split.name;
  }
  if (!type && mapping.typeFromDescription && sfPerUnit > 0 && COVERAGE_SOLD_RE.test(str(raw.unit))) {
    type = floorTypeFromDescription(descText, size);
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
  // fallback name. A description already leading with the product line —
  // spelled out or abbreviated — has that lead replaced by the full spelling,
  // so VTC's "EARTH" line doesn't read "Earth Earth Ash Gray" and Marazzi's
  // "MOROCCAN CONC …" doesn't read "Moroccan Concrete Moroccan Conc …".
  const pl = smartCase(str(raw.productLine));
  const label = descText || [smartCase(str(raw.color)), smartCase(str(raw.style))].filter(Boolean).join(" ");
  const lead = seriesLeadWords(label, pl);
  const name = lead
    ? [pl, smartCase(label.split(/\s+/).slice(lead).join(" "))].filter(Boolean).join(" ")
    : [pl, label].filter(Boolean).join(" ");
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
    // A mapped "Fits" column: the floor SKUs this trim belongs to, space
    // separated (ADR 0012 amendment). Only the trim-aware parsers emit it.
    fits: str(raw.fits),
    // Manufacturer code column(s) — the ERP exports carry two that usually
    // agree (Supplier Prod Code / Mfg Product Code); both are kept, the rare
    // disagreement being a vendor reissue where either code may be the one a
    // vendor book states.
    vendorSkus: [str(raw.vendorSku), str(raw.vendorSku2)].filter(Boolean).join(" "),
    cost,
    // The shop's own selling price, when the sheet carries one (the ERP stock
    // exports do). Explicit retail outranks cost × markup downstream
    // (pricedItem); $/sqft derives the same way the stock workbook's does.
    price,
    priceSqft: price != null && sfPerUnit > 0 ? round4(price / sfPerUnit) : null,
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
  // Before the sku rule ("Mfg Product Code" contains "productcode") and the
  // mfg rule: a supplier/manufacturer code column is a vendor code, not the
  // shop SKU or the markup-group axis (the ERP stock exports, 2026-07-23).
  if (/(supplierprod|mfgproduct|vendorsku|vendorprod)/.test(h)) return "vendorSku";
  if (/(itemcode|productcode|^sku$|vtcitem)/.test(h)) return "sku";
  if (/(consumer|msrp|list|suggested)/.test(h)) return "msrp";
  if (/(dealer|^cost|netcost|yourcost|baseprice)/.test(h)) return "cost";
  // Tested after cost so "Base Price (Cost)" claims cost, and anchored so
  // "Price U/M" below keeps its unit slot. "Retail Price" is the ERP stock
  // exports' selling price — a real item field, unlike the vendors' MSRP.
  if (/(retail|^price$)/.test(h)) return "price";
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

// The ERP's "Vendor SKU Analysis" stock export: one flat sheet per supplier
// (DOIT, SHEOG, MANMI…), header on the first row — shop Product Code (the SKU
// the team sells off of), Full Description, Base Price (Cost), Retail Price,
// Unit of Stock. Supplier/manufacturer codes already ride inside the
// description, and the free/total stock counts are point-in-time — none of
// them map. There is no SF/CT column: coverage rides in the description text,
// which is what sfFromDescription tells parseMapped. Returns a mapping, or
// null when no sheet carries the signature.
export function detectVendorSkuAnalysis(sheets) {
  for (const s of sheets || []) {
    const rows = s.rows || [];
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const labels = (rows[r] || []).map((c) => str(c).toLowerCase().replace(/[^a-z]/g, ""));
      const at = (name) => labels.findIndex((l) => l.startsWith(name));
      const sku = at("productcode"), desc = at("fulldescription"), unit = at("unitofstock");
      if (sku < 0 || desc < 0 || unit < 0) continue;
      const columns = { [sku]: "sku", [desc]: "description", [unit]: "unit" };
      const cost = at("baseprice"), price = at("retailprice");
      if (cost >= 0) columns[cost] = "cost";
      if (price >= 0) columns[price] = "price";
      // The manufacturer's own codes (2026-07-23): the exact floor↔trim
      // bridge to the vendor order books — the description is NOT a safe
      // source (a MANMI floor's description carried a sibling color's code
      // while the column had the right one).
      const sup = at("supplierprod"), mfgCode = at("mfgproduct");
      if (sup >= 0) columns[sup] = "vendorSku";
      if (mfgCode >= 0) columns[mfgCode] = "vendorSku2";
      return {
        sheet: s.name,
        headerRow: r,
        columns,
        // Shop product codes lead with a digit — usually all digits, leading
        // zeros included (05153), but a few carry a tail: unit-suffixed codes
        // (29500-LF) and category placeholders (29SHEOGAW).
        skuPattern: "^\\d[A-Z0-9-]{2,15}$",
        sfFromDescription: true,
        // The export leads flooring descriptions with the bare plank width
        // ('6" Mann AduraMax Plank') and names no flooring type anywhere, so
        // both come out of the description text (the U/M column gates the type:
        // only carton/bundle-sold rows with coverage are flooring).
        leadWidthSize: true,
        typeFromDescription: true,
      };
    }
  }
  return null;
}
