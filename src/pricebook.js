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
// docs/skills-reference/sheetimport/SKILL.md first — the checklist
// (truth-table new unit combos, real-row goldens, the old-vs-new diff gate)
// that keeps the lessons encoded below from repeating.
//
// The hand-built adapters for the retired shop workbook (ADR 0003) lived here
// until 2026-07-22; the ERP "Vendor SKU Analysis" stock exports replaced that
// document (ADR 0027) and its parsers went with it.

import { normOrderItem, unitComboWarnings, importSanityWarnings, classifyTrim } from "./orderbook.js";
import { feetArea } from "./stock.js";

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
// The SPACE-spelled mixed fraction ("2 1/2X1" — the Glazzio long-hex pages;
// reading it mid-fraction made the chip 0.5x1 and left a stray "2" in the name,
// the CLNL289 report 2026-08-26). Joined only where a following fraction can't
// be anything else: the FIRST dim of an L×W, a shape size, a sheet token. The
// second dim keeps hyphen-only DIM — there a trailing " 3/8\"" is the plank's
// THICKNESS ('OAK PLANK 5X48 3/8"'), not part of the length.
const DIMS = "\\d+/\\d+|\\.\\d+|\\d+(?:\\.\\d+)?(?:[-\\s]\\d+/\\d+)?";
const dimVal = (s) => {
  const f = str(s).match(/^(\d+)\/(\d+)$/);
  if (f) {
    const n = +f[1], d = +f[2];
    // "471/4" (Schluter: "471/4IN X 35-7/16IN") is 47-1/4 printed tight — a
    // real size numerator is proper, so peel whole-number digits off the front
    // until the fraction is.
    if (n >= d) {
      for (let k = 1; k < f[1].length; k++) {
        const num = +f[1].slice(k);
        if (num > 0 && num < d) return +f[1].slice(0, k) + num / d;
      }
    }
    return n / d;
  }
  const m = str(s).match(/^(\d+(?:\.\d+)?|\.\d+)(?:[-\s](\d+)\/(\d+))?$/);
  return m ? parseFloat(m[1]) + (m[2] ? +m[2] / +m[3] : 0) : NaN;
};
const SHAPE_WORDS = "hex|hexagon|penny|round|octagon";
const INCH_MARK = `["']|in(?:ch(?:es)?)?\\b`;
// The word-mark subset that can sit INSIDE an L×W without ambiguity — the
// Schluter EFT prints "471/4IN X 35-7/16IN" and "12 IN X 12 IN". A bare foot
// mark stays out of this position (that's ROLL_SIZE_RE's job). The word can't
// end on \b: Schluter also prints dims TIGHT ("82FTX3-1/8INX5/16IN"), where
// IN/FT butt against the × of the next dimension with no boundary between two
// word characters — so the end test is "nothing letter-like follows, or an ×
// leading straight into the next number".
const WORD_END = `(?=$|[^a-z]|[x×]\\s*\\d)`;
const IN_WORD = `"|in(?:ch(?:es)?)?${WORD_END}`;
const SIZE_RE = new RegExp(`(${DIMS})\\s*(?:${IN_WORD}|')?\\s*[x×]\\s*(${DIM})\\s*(?:${IN_WORD}|')?`, "i");
// A dimension in FEET — how the sheets spell roll goods and sheet vinyl
// ("3'x167'", "5\" x 33'", "12' Prestige Sheet Vinyl") and how the ERP and the
// Schluter EFT write a feet-and-inches width: inches after the foot mark,
// sometimes with a dot between them ("3'3\"x98'", "3'.3\"x16'5\"" — 3 ft 3 in,
// not three tenths), sometimes with no inch mark at all ("3'3 X 41'1"),
// sometimes as words ("3 FT 3 IN X 98 FT 5 IN", "82FTX3-1/8IN"). The
// inch-minded regexes must never see these: LEAD_WIDTH_RE once read the 3' of
// a 3'3"-wide Kerdi roll as a 3" width and left ".3\"x98'" in the name, and
// SIZE_RE read 3"x98 out of the middle (issue bucket, 2026-08-07). An L×W with
// a foot mark on either side is roll/linear goods: the whole spelling lands in
// the size field as text — parseTileSize refuses it, so no L×W cell and no
// grout/mortar math ever comes of it.
const FT_MARK = `'|\\s*f(?:oo|ee)?t\\.?${WORD_END}`;
// The inches tail after the foot mark comes three ways: marked ("3' 3\"",
// "3 FT 3 IN"), tight against the mark with no inch mark of its own ("3'3",
// "16 FT5"), or spaced AND bare ("KERDI 3 FT 3 X 98 FT 5 = 323 SF") — that
// last one only counts when the next thing is the ×, the =, or the end, so a
// trailing count ("10 FT 2 PACK") can't read as inches.
const FT_DIM = `\\d+(?:\\.\\d+)?\\s*(?:${FT_MARK})(?:\\s*\\.?\\s*(?:${DIM})\\s*(?:${IN_WORD})|\\d+(?:-\\d+/\\d+)?|\\s+\\d+(?:-\\d+/\\d+)?(?=\\s*(?:[x×=]|$|rolls?\\b)))?`;
const ROLL_SIZE_RE = new RegExp(`(${FT_DIM})\\s*[x×]\\s*(${FT_DIM}|(?:${DIM})\\s*(?:${IN_WORD})?)|((?:${DIM})\\s*(?:${IN_WORD})?)\\s*[x×]\\s*(${FT_DIM})`, "i");
// A third ×-dimension right behind a roll size is the goods' thickness —
// BEKOTEC edge strips print "82FTX3-1/8INX5/16IN". Inch mark required, so a
// trailing code can't read as one.
const ROLL_THICK_RE = new RegExp(`^\\s*[x×]\\s*(\\d+/\\d+|\\d+(?:-\\d+/\\d+)?(?:\\.\\d+)?)\\s*(?:${IN_WORD})`, "i");
// Three inch-marked dimensions are a board: T×W×L or L×W×T by vendor whim
// (KERDI-BOARD "5/8IN X 48IN X 120IN", a trowel's "3/16\" x 1/4\" x 3/8\"
// notch). The sub-inch odd one out is the thickness; the remaining two are
// the panel. Every dim must carry its mark — three bare numbers are a code.
const THREE_IN_RE = new RegExp(`(${DIM})\\s*(?:${IN_WORD})\\s*[x×]\\s*(${DIM})\\s*(?:${IN_WORD})\\s*[x×]\\s*(${DIM})\\s*(?:${IN_WORD})`, "i");
// The ERP stock export also prints boards MARKLESS ("0.5 X 48 X 64
// KERDI-BOARD PANEL"). A bare ×-triple counts as a board only when exactly
// one dim is sub-1.5" (the thickness odd-one-out) — any other bare triple
// stays a code and SIZE_RE's read stands. Without this the first two numbers
// landed as size "0.5x48" and the orphaned "X64" stayed in the name.
const THREE_BARE_RE = new RegExp(`(${DIM})\\s*[x×]\\s*(${DIM})\\s*[x×]\\s*(${DIM})`, "i");
// One roll-size side, normalized for display: word marks to symbols, spaces
// out, the dotted feet-inches spelling read as feet-inches ("3'.3\"" → "3'3\"",
// "3 FT 3 IN" → "3'3\""), a quote-less inches tail closed ("41'1" → "41'1\"").
const rollSide = (t) => str(t)
  .replace(/\s*f(?:oo|ee)?t\.?(?=$|[^a-z])/gi, "'")
  .replace(/\s*in(?:ch(?:es)?)?\.?(?=$|[^a-z])/gi, '"')
  .replace(/\s+/g, "")
  .replace("'.", "'")
  .replace(/'(\d+(?:\.\d+)?(?:-\d+\/\d+)?)$/, `'$1"`);
// A genuine single-dimension shape size ('2" Hex') has no L×W cell — matched
// only when SIZE_RE did not, so the vendor spelling lands in the size string
// (the tile row shows it and derives a square L×W for grout/mortar) instead of
// being shoved into the color name. A bare '6"' with no shape word is left in
// the name on purpose — no shape word, no coverage.
const SHAPE_SIZE_RE = new RegExp(`(${DIMS})\\s*(?:${INCH_MARK})?\\s*(${SHAPE_WORDS})\\b`, "i");
// The MLS/ANA EFT sheets write the shape FIRST — 'HEXAGON 2 INCH', 'HEX 3 IN',
// 'HEXAGON MOSAIC 2" MATTE'. Matched only when the number carries an inch mark,
// so a trailing code ("HEXAGON 2022 PROD") can never read as a size. A
// MOS/MOSAIC between shape and size is kept in the name — it says sheet goods.
const SIZE_SHAPE_RE = new RegExp(`\\b(${SHAPE_WORDS})\\b\\s+((?:mos(?:aics?)?\\s+)?)(${DIMS})\\s*(?:${INCH_MARK})`, "i");
// "(12X10/SH)"-style packaging tokens (sheet dims + a per-unit) are never the
// item's size — dropped before matching so the chip size wins and the name
// keeps no "( /Sh)" litter. A bare count before the slash ("(10/BOX)",
// Schluter's BEKOTEC panels) is the pieces-per-carton — returned as pcHint for
// books whose PC/CT column is empty.
const PACKAGING_RE = /\(\s*([^)]*?)\s*\/\s*(sh|sht|ct|ctn|pc|pcs|ea|cs|bx|box|pk|pkg|bag|rl|roll|st|set|pr|kit)s?\s*\)/gi;
// A mosaic's SHEET dimension — "(9X11 SHEET)", "13X13 SHT" — is the size of the
// backing sheet, NOT the chip. It gives the sheet's area (so coverage can be
// derived when the book leaves SF/CT blank) but must never stand in as the tile
// L×W, which grout/mortar would then read as one giant tile. Returned as its
// own `sheetSize` and only used when the description carries no chip size; the
// chip size is entered by hand on the row (ADR 0014).
const SHEET_TOKEN_RE = new RegExp(`\\(?\\s*(${DIMS})\\s*["']?\\s*[x×]\\s*(${DIMS})\\s*["']?\\s*(?:sheets?|shts?)\\b\\s*\\)?`, "i");
const THICK_MM_RE = /(\d+(?:\.\d+)?)\s*mm\b/i;
// A fraction thickness must carry the inch mark, must not be the tail of a
// mixed number ('1-5/8" SCREWS' is a length), and must not be a width.
const THICK_FRAC_RE = /(?<![\d-])(\d+)\s*\/\s*(\d+)\s*"(?!\s*(?:wide|width|w\b))/i;
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
// The feet twin of LEAD_WIDTH_RE ("12' Prestige Sheet Vinyl") — tried first so
// a foot-marked lead keeps its foot mark instead of reading as an inch width.
const LEAD_FT_RE = new RegExp(`^\\s*(${FT_DIM})(?!\\s*[x×])\\s*`, "i");

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
  let size = "", thickness = "", sheetSize = "", pcHint = null;
  s = s.replace(PACKAGING_RE, (m, inner) => {
    if (pcHint == null && /^\d+$/.test(str(inner))) pcHint = +inner;
    return " ";
  });
  // A SHEET dimension is pulled out before the size regexes so its L×W can't be
  // read as the chip size — it is the mosaic's backing sheet, not the tile.
  const sheetTok = s.match(SHEET_TOKEN_RE);
  if (sheetTok) {
    const a = dimVal(sheetTok[1]), b = dimVal(sheetTok[2]);
    if (a > 0 && b > 0) sheetSize = `${a}x${b}`;
    s = s.replace(sheetTok[0], " ");
  }
  // Thickness first, so "10MM" can't be mistaken for part of a size.
  const mm = opts?.mm === false ? null : s.match(THICK_MM_RE);
  if (mm) { thickness = mmToFraction(mm[1]); s = s.replace(mm[0], " "); }
  const roll = s.match(ROLL_SIZE_RE);
  if (roll) {
    // A foot mark on either side makes the L×W a roll/sheet-goods size — kept
    // whole as the vendor spells it, stripped from the name like SIZE_RE does.
    // A markless first side beside a feet side is inches ("5 X 98 FT 5").
    const first = rollSide(roll[1] || roll[3]);
    size = `${/["']$/.test(first) ? first : `${first}"`}x${rollSide(roll[2] || roll[4])}`;
    let cut = roll[0].length;
    const third = s.slice(roll.index + cut).match(ROLL_THICK_RE);
    if (third) {
      if (!thickness) thickness = /^\d+\/\d+$/.test(third[1]) ? `${reduceFrac(...third[1].split("/").map(Number))}"` : `${third[1]}"`;
      cut += third[0].length;
    }
    s = `${s.slice(0, roll.index)} ${s.slice(roll.index + cut)}`;
  }
  let t3 = !size ? s.match(THREE_IN_RE) : null;
  let t3vals = t3 ? [t3[1], t3[2], t3[3]].map(dimVal) : null;
  // A marked triple's odd one out may be a full 2" (the 2" KERDI-BOARD); a
  // bare triple stays under 1.5" so "12 X 24 X 36" never reads as a board.
  let t3max = 2;
  if (!size && !(t3 && Math.min(...t3vals) <= t3max)) {
    const bare = s.match(THREE_BARE_RE);
    const bv = bare ? [bare[1], bare[2], bare[3]].map(dimVal) : null;
    if (bare && bv.filter((v) => v < 1.5).length === 1) { t3 = bare; t3vals = bv; t3max = 1.5; }
  }
  if (t3 && (t3max === 2 ? Math.min(...t3vals) <= 2 : Math.min(...t3vals) < 1.5)) {
    const ti = t3vals.indexOf(Math.min(...t3vals));
    const spelled = [t3[1], t3[2], t3[3]][ti];
    if (!thickness) thickness = /^\d+\/\d+$/.test(spelled) ? `${reduceFrac(...spelled.split("/").map(Number))}"` : `${spelled}"`;
    const [a, b] = t3vals.filter((_, i) => i !== ti);
    size = `${a}x${b}`;
    s = s.replace(t3[0], " ");
  } else if (size) {
    // roll branch above already landed the size
  } else if (PENNY_RE.test(s)) {
    // Penny handled on its own so "penny round" is one shape, not a "Round" size.
    let dim = "";
    const before = s.match(PENNY_DIM_BEFORE_RE);
    if (before) { dim = before[1]; s = s.replace(before[0], " "); }
    else { const inch = s.match(PENNY_DIM_INCH_RE); if (inch) { dim = inch[1]; s = s.replace(inch[0], " "); } }
    if (dim) size = `${dim}" Penny`;          // chip size → grout computes from it
    else if (!sheetSize) sheetSize = "Penny";  // no printed chip size → a "Penny sheet"
    s = s.replace(PENNY_STRIP_RE, " ");
  } else if (opts?.leadWidth && LEAD_FT_RE.test(s)) {
    const lead = s.match(LEAD_FT_RE);
    size = rollSide(lead[1]);
    s = s.slice(lead[0].length);
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
  if (!size) {
    // A description ENDING on a lone feet dimension is a stick/coil length —
    // Schluter profiles ("JOLLY EDGE TRIM 3/8 ALUM SATIN 10'", "DILEX-FIS
    // INLAY GREY 100'"). Trailing only: a feet token mid-name is identity
    // ("10 M ROLL" never has the mark), and it needs the mark to count.
    const tail = s.match(new RegExp(`(?:^|\\s)(${FT_DIM})\\s*$`, "i"));
    if (tail) { size = rollSide(tail[1]); s = s.slice(0, s.length - tail[0].length); }
  }
  if (!thickness && opts?.fracThickness !== false) {
    const fr = s.match(THICK_FRAC_RE);
    if (fr) { thickness = `${reduceFrac(+fr[1], +fr[2])}"`; s = s.replace(fr[0], " "); }
  }
  // A stripped size can hollow out a parenthesized token — "(9X11 SHEET)" →
  // "( SHEET)" — so drop parens left holding nothing but a packaging word, or
  // nothing but the "=" a stripped "(size = coverage)" pair leaves behind.
  s = s.replace(/\(\s*(?:sheets?|shts?|sh|pcs?|nominal|nom|=)?\s*\)/gi, " ");
  // Drop leftover standalone "x" and "=" tokens (from a stripped size or a
  // stripped "size = coverage" pair), never an "x" inside a word like "Max";
  // then a bare trailing period ("…SAND PEBBLE.") so vendor punctuation
  // doesn't read as a mis-split.
  const name = smartCase(s.split(/\s+/).filter((w) => w && !/^[x×=]$/i.test(w)).join(" ")).replace(/(\S)\.$/, "$1");
  return { size, thickness, name, sheetSize, ...(pcHint != null ? { pcHint } : {}) };
}

// --- Schluter EFT: profile dims + vendor shorthand (owner, 2026-09-14) ---------
//
// Virginia Tile's Schluter EFT prints a profile's thickness as a BARE fraction
// ("RONDEC BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY"), states no length on the
// standard 2.5 m stick, and files every Rondec — straight or corner — under
// the "RONDEC CORNERS" product line. The owner wants those rows to read like
// the ERP stock book's own ("3/8\"x8' Schluter Rondec - …"): thickness × stick
// in the size field, the shorthand spelled out, a Schluter lead, no product
// line prefix. Everything here rides the mapping's `schluter` flag (the EFT
// brand line, detectVtcEft): a tile sheet never sees a markless fraction as a
// thickness, so a "22/40" spec stays a name there.
//
// The implied stick: Schluter's standard profile is 2.5 m = 8'2-1/2", and the
// sheet only states a length on the other sizes (10', 4'11"). A straight
// profile with a thickness and no stated length lands as 8' — the stock
// book's own spelling, shortened at the owner's ask (2026-09-14) because the
// ERP field is 70 characters. This IS invented data, accepted knowingly: a
// family whose real stick differs reads wrong until its sheet says so.
const SCHLUTER_PROFILE_LINES = /^(JOLLY|RONDEC|SCHIENE|QUADEC|DILEX|RENO|TREP|DECO|VINPRO|FINEC|ECK|DESIGNBASE|BARA|INDEC|DESIGNLINE)\b/i;
export const isSchluterProfileLine = (pl) => SCHLUTER_PROFILE_LINES.test(str(pl));

// Vendor shorthand → words. "" drops the token: bare aluminum is Schluter's
// default material and says nothing on a row; PVC, stainless and brass stay.
const SCHLUTER_ABBR = {
  ALUM: "", ALU: "", ALUMINUM: "", "/": "", "W/": "with",
  CRN: "Corner", JNT: "Joint", MVMT: "Movement", EDG: "Edge", RPLCMT: "Replacement", TRANS: "Transition", ADJ: "Adjustable", RAD: "Radius", BALC: "Balcony",
  BRH: "Brushed", BRSH: "Brushed", BRUSH: "Brushed", BR: "Brushed", STN: "Stainless", SS: "Stainless Steel", ANOD: "Anodized", POL: "Polished", POLISH: "Polished", SAT: "Satin", MAT: "Matte", MATT: "Matte",
  CHROM: "Chrome", CPPR: "Copper", BRAS: "Brass", NICKL: "Nickel", ANT: "Antique",
  DK: "Dark", LT: "Light", BRT: "Bright", ANTH: "Anthracite", WHT: "White", BLK: "Black", BRN: "Brown", BRWN: "Brown", BEIG: "Beige",
  UNCPLING: "Uncoupling", WATRPROOF: "Waterproof", SPLASHGAURD: "Splashguard", TRANSP: "Transparent", ADHES: "Adhesive", ADHSTRIP: "Adhesive Strip",
  STAINL: "Stainless", SEALG: "Sealing", BONDG: "Bonding", DRA: "Drain", GSKT: "Gasket", PERF: "Perforated", RESIS: "Resistant",
  AND: "and", FOR: "for", OF: "of", TO: "to",
  GR: "Grey", CL: "Clear", SQ: "Square", AL: "", CRNR: "Corner", GALV: "Galvanized", "W/O": "without",
};
const SCHLUTER_KEEP_UPPER = /^(PVC|LED|LB|OZ|SF|ABS|XL|GFCI|LF|RL|QT|MM)$/;
// A two-letter token that isn't an English word is a code (PS, MV, ZA, EB).
const SCHLUTER_SMALL = /^(IN|NO|ON|OR|BY|UP|AT|AS|AN|IS|IT)$/;
// A hyphen segment after the family word is a model code (RONDEC-CT, DILEX-AHKA,
// TREP-FL) unless it is one of the short real words Schluter hyphenates.
const SCHLUTER_SEG_WORDS = /^(STEP|RAMP|LINE|BASE|BAND|DUO|PLUS|HEAT|FIX|SEAL|TRAY|EDGE|TRIM|FLEX|KIT|THIN)$/;
const schluterWord = (w) => {
  if (SCHLUTER_KEEP_UPPER.test(w) || /\d/.test(w) || (/^[A-Z]{2}$/.test(w) && !SCHLUTER_SMALL.test(w))) return w;
  // "(DRAIN,CORNERS,SEALS)" cases each word and spaces the commas.
  return w.toLowerCase().replace(/,(?=\S)/g, ", ").replace(/(^|[(, +])([a-z])/g, (m, p, c) => p + c.toUpperCase());
};
const schluterCode = (w) => (w.length <= 4 && !SCHLUTER_SEG_WORDS.test(w) ? w : schluterWord(w));
const schluterCase = (t) => t.split("-").map((seg, i) => seg.split("/").map(i ? schluterCode : schluterWord).join("/")).join("-");
const SCHLUTER_TYPE_WORD = /^(Corner|Trim|Edge|Base|Joint)$/;

// The words of a Schluter row: shorthand expanded, "N DEG" → "N°" (a leading
// angle moves behind the type words so the family word leads), the vendor's
// repeats collapsed ("SS STAINLESS STEEL"), and a Schluter lead unless the
// text already says it.
export function schluterWords(text) {
  const toks = str(text).replace(/\s*\.$/, "").toUpperCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const t0 of toks) {
    let t = t0 === "W/" ? t0 : t0.replace(/^\/+|\/+$/g, ""); // "/ALU BASE/" wraps a token in slashes
    if (/^W\/.{2}/.test(t)) { out.push("with"); t = t.slice(2); } // "W/GFCI", "W/FRAME"
    if (!t) continue;
    const wrapped = t.match(/^\((\w+)\)$/); // "(ALUM)" is the same shorthand in parens
    if (wrapped && wrapped[1] in SCHLUTER_ABBR) { if (SCHLUTER_ABBR[wrapped[1]]) out.push(`(${SCHLUTER_ABBR[wrapped[1]]})`); continue; }
    if (/^(DEG|DEGREE)$/.test(t) && /^\d+$/.test(out[out.length - 1] || "")) { out[out.length - 1] += "°"; continue; }
    if (t in SCHLUTER_ABBR) { if (SCHLUTER_ABBR[t]) out.push(SCHLUTER_ABBR[t]); continue; }
    out.push(schluterCase(t));
  }
  if (/^\d+°$/.test(out[0] || "")) {
    const angle = out.shift();
    let at = out.findIndex((w) => SCHLUTER_TYPE_WORD.test(w));
    if (at < 0) at = out.length - 1;
    while (SCHLUTER_TYPE_WORD.test(out[at + 1] || "")) at++; // "Edge Trim" is one run
    out.splice(at + 1, 0, angle);
  }
  if (!/^schluter$/i.test(out[0] || "")) out.unshift("Schluter");
  return out.join(" ").replace(/\b(\w+(?: \w+)?) \1\b/gi, "$1");
}

const SCHLUTER_CORNER_RE = /^(CRN|CORNERS?|CONNECTORS?|CONNECT|CAP|INSERT|SET|LIP)$/i;
// BARA balcony edges, DESIGNBASE bases and ECK angles print a face HEIGHT or
// leg width, never a tile thickness.
const SCHLUTER_HEIGHT_LINES = /^(BARA|DESIGNBASE|ECK)\b/i;
// A profile dimension is an inch fraction: proper, over a power-of-two
// denominator ("22/40" and "40/40" are DILEX-STF joint specs). A whole number
// may lead ("1-3/16") or be printed tight against the fraction ("111/32IN" is
// 1-11/32, the board rows' "471/4IN" idiom). A bare whole inch counts too
// ("1 X 7/16", "1IN"). Returns { text, val } or null.
function schluterInch(t) {
  const m = str(t).match(/^(?:(\d+)-)?(\d+)(?:\/(\d+))?(?:IN|")?$/i);
  if (!m) return null;
  if (!m[3]) return m[1] ? null : { text: `${m[2]}"`, val: +m[2] };
  const d = +m[3];
  if (![2, 4, 8, 16, 32, 64].includes(d)) return null;
  let whole = m[1] ? +m[1] : 0, num = +m[2];
  if (num >= d) {
    if (m[1]) return null;
    for (let k = 1; k < m[2].length && num >= d; k++) { const n = +m[2].slice(k); if (n > 0 && n < d) { whole = +m[2].slice(0, k); num = n; } }
    if (num >= d) return null;
  }
  return { text: `${whole ? `${whole}-` : ""}${num}/${d}"`, val: whole + num / d };
}
const MAX_TILE_THICKNESS = 1.5;

// The non-profile rows (KERDI, KERDI-BOARD, drains, DITRA, kits…) keep the
// generic split, after this pre-pass has made the sheet's spellings the
// generic regexes' own: spaced inch words and space-spelled mixed fractions
// marked ("3 IN", "4 1/2"), the vendor's "ST STEEL" spelled out, a pack count
// out of the name and into pieces-per-unit ("(2 PACK)", "(5)", "10 PK",
// "1EA"), and two dim shapes the generic split would mangle kept whole as
// text — a bare triple with no thickness-sized side (a curb's "60 X 6 X 4
// 1/2", a bench's "16 X 16 X 20") and a trowel notch's fraction pair.
export function schluterAccessory(desc, productLine) {
  let s = str(desc).replace(/(\d)\/\s+(\d)/g, "$1/$2").replace(/\bST STEEL\b/gi, "STAINLESS STEEL");
  s = s.replace(/\b(\d+) (\d+\/\d+)\b/g, "$1-$2");
  s = s.replace(/(\d[\d\-/.]*)\s+IN(?:CH(?:ES)?)?\b(?!\s*(?:CRN|CORNER))/gi, '$1"');
  // A bare inch fraction ("1/2 PIPE SEAL", "1-1/8 FRAME") gets its mark — but
  // never a side of an L×W, which the dim rules below read whole.
  s = s.replace(/(?<![\d\-/"])((?:\d+-)?\d+\/\d+)(?=\s|$)(?!\s*[x×]\s*\d)(?<!\s[x×]\s(?:\d+-)?\d+\/\d+)/gi, (m, f) => (schluterInch(f) ? `${f}"` : f));
  let pc = null;
  s = s.replace(/\(\s*(\d+)\s*(?:PACK|PK|PCS?)?\s*\)|\b(\d+)\s*(?:PACK|PK)\b|\b(\d+)EA\b/gi, (m, a, b, c) => {
    const n = +(a || b || c);
    if (pc == null && n > 0) pc = n;
    return " ";
  }).replace(/-(?=\s|$)/g, "");
  const inch = (t) => schluterInch(t) || (/^\d+\.\d+$/.test(t) ? { text: `${t}"`, val: +t } : null);
  let size = "";
  const D = "(\\d+(?:[-.]\\d+)?(?:/\\d+)?)";
  const triple = s.match(new RegExp(`(?:^|\\s)${D}\\s*[x×]\\s*${D}\\s*[x×]\\s*${D}(?=\\s|$)`, "i"));
  if (triple) {
    const dims = triple.slice(1, 4).map(inch);
    if (dims.every((d) => d && d.val >= 1.5)) { size = dims.map((d) => d.text).join("x"); s = `${s.slice(0, triple.index)} ${s.slice(triple.index + triple[0].length)}`; }
  }
  if (!size) {
    const F = `((?:\\d+-)?\\d+/\\d+(?:IN|")?|\\d+(?:\\.\\d+)?(?:IN|")?)`;
    // Notch-sized only: a panel's "471/4IN X 35-7/16IN" is the generic split's.
    const pair = s.match(new RegExp(`(?:^|\\s)${F}\\s*[x×]\\s*${F}(?=\\s|$)(?!\\s*[x×])`, "i"));
    if (pair && /\//.test(pair[1] + pair[2]) && inch(pair[1]) && inch(pair[2]) && inch(pair[1]).val < 1.5 && inch(pair[2]).val < 1.5) { size = `${inch(pair[1]).text}x${inch(pair[2]).text}`; s = `${s.slice(0, pair.index)} ${s.slice(pair.index + pair[0].length)}`; }
  }
  // Gated on the description, not the product line — Virginia Tile files the
  // LTS shower trays under "KERDI LINE" too.
  if (!size && /^KERDI LINE\b/i.test(str(productLine)) && /^KERDI-LINE/i.test(s)) {
    // A KERDI-LINE's size is its grate length: the last whole-inch token of
    // a foot or more ("FRAME 28\"", "BODY 72\"") or its VARIO length ("4'").
    const lens = [...s.matchAll(/(?:^|\s)(\d+)(?:-\d+\/\d+)?(["'])(?=\s|$)/g)].filter((m) => (m[2] === "'" ? +m[1] >= 1 : +m[1] >= 12));
    const last = lens[lens.length - 1];
    if (last) { size = last[0].trim(); s = `${s.slice(0, last.index)} ${s.slice(last.index + last[0].length)}`; }
  }
  return { text: s.replace(/\s+/g, " ").trim(), size, pc };
}
// The implied 2.5 m stick, however the sheet spells it, reads 8' (ADR 0041).
const schluterStick = (size) => (/^8'2(?:\.5|-1\/2)"$/.test(size) ? "8'" : size);

// A profile-family row's dims. The thickness is the LAST tile-sized fraction
// that isn't a width or a joint (DILEX prints "3/8 MVMT JNT 5/16": joint
// first, tile thickness after; "W/ 7/16 JNT" the other way round; RENO-RAMP
// "2-1/2 REDUCER 3/8" leads with the ramp width) and isn't half of an L×W (a
// DILEX-HKS cove's two legs, "5/16 X 11/32" — kept as vendor text, never a
// decimal tile size). A spaced inch word goes with its number except before a
// corner word, where "IN" means inside. Corners, connectors and end caps have
// no length. Fractions left in the name get their inch mark; the ECK angles'
// W/H-suffixed leg dims spell out.
export function schluterDescription(desc, productLine) {
  let s = str(desc).replace(/\s*\.$/, "").replace(/(\d)\/\s+(\d)/g, "$1/$2");
  if (!isSchluterProfileLine(productLine)) return { size: "", thickness: "", name: schluterWords(s) };
  let len = "";
  const tail = s.match(new RegExp(`(?:^|\\s)(${FT_DIM})\\s*$`, "i"));
  if (tail) { len = rollSide(tail[1]); s = s.slice(0, s.length - tail[0].length); }
  else {
    // ECK prints the length mid-string ("ECK-K 1-9/32W 10 FT STAINLESS STEEL",
    // "… 8 FT 2-1/2 STAINLESS STEEL"): a feet token with optional bare inches.
    const mid = s.match(new RegExp(`(?:^|\\s)(\\d+\\s*(?:${FT_MARK}))(?:\\s+(\\d+(?:-\\d+/\\d+)?))?(?=\\s|$)`, "i"));
    if (mid) { len = rollSide(mid[1]) + (mid[2] ? `${mid[2]}"` : ""); s = `${s.slice(0, mid.index)} ${s.slice(mid.index + mid[0].length)}`; }
  }
  if (len === `8'2-1/2"`) len = "8'";
  const toks = s.split(/\s+/).filter(Boolean);
  const inch = (t) => schluterInch(t);
  const isFrac = (t) => /\//.test(t) && !!inch(t);
  let size = "", thickness = "";
  for (let i = 0; i < toks.length && !size; i++) {
    const tight = toks[i].match(/^([^x×\s]+)[x×]([^x×\s]+)$/i);
    if (tight && isFrac(tight[1]) !== isFrac(tight[2]) ? false : tight && (isFrac(tight[1]) || isFrac(tight[2])) && inch(tight[1]) && inch(tight[2])) { size = `${inch(tight[1]).text}x${inch(tight[2]).text}`; toks.splice(i, 1); }
    else if (/^[x×]$/i.test(toks[i + 1] || "") && (isFrac(toks[i]) || isFrac(toks[i + 2] || "")) && inch(toks[i]) && inch(toks[i + 2] || "")) { size = `${inch(toks[i]).text}x${inch(toks[i + 2]).text}`; toks.splice(i, 3); }
  }
  if (!size && !SCHLUTER_HEIGHT_LINES.test(str(productLine))) {
    let at = -1;
    for (let i = 0; i < toks.length; i++) {
      const f = isFrac(toks[i]) ? inch(toks[i]) : null;
      if (!f || f.val > MAX_TILE_THICKNESS) continue;
      if (/^(W\/|[x×])$/i.test(toks[i - 1] || "") || /^([x×]|MVMT|JNT|JOINT|WIDE)$/i.test(toks[i + 1] || "")) continue;
      at = i;
    }
    if (at >= 0) {
      thickness = inch(toks[at]).text;
      toks.splice(at, 1);
      if (/^(IN|")$/i.test(toks[at] || "") && !SCHLUTER_CORNER_RE.test(toks[at + 1] || "")) toks.splice(at, 1);
    }
  }
  const corner = toks.some((t) => SCHLUTER_CORNER_RE.test(t));
  if (!size) size = thickness ? (corner ? thickness : `${thickness}x${len || "8'"}`) : len;
  const rest = [];
  for (let i = 0; i < toks.length; i++) {
    const m = toks[i].match(/^(.+?)(W|H)?$/i);
    const f = /\d\/\d|IN$/i.test(toks[i]) ? inch(m[1]) : null;
    if (!f) { rest.push(toks[i]); continue; }
    rest.push(`${f.text}${m[2] ? (/w/i.test(m[2]) ? " Wide" : " High") : ""}`);
    if (/^(IN|")$/i.test(toks[i + 1] || "") && !SCHLUTER_CORNER_RE.test(toks[i + 2] || "")) i++;
  }
  return { size, thickness, name: schluterWords(rest.join(" ")) };
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
// the description ("… 23.76 sf", "…10.64sf/c", "….969sf/sh", "…134.5sf/roll"),
// per SELL unit (carton, bundle, roll, sheet), which is exactly what sfPerUnit
// means. A mosaic's sub-square-foot coverage prints with no leading zero
// (".969") — the leading-decimal alt claims it from the dot (the DIM
// convention) so the bare "969" can't read as the coverage with a stray "."
// left in the name. The per-unit suffix is listed out rather than matched
// loosely, so an unlisted spelling leaves visible litter in the name instead of
// eating a real word — which is how "/roll" was found (Schluter imported as
// "Ditra-Heat Uncoupling Membrane - /roll"). Only mappings that say so
// (sfFromDescription) pull it out; a description without one stays uncovered
// rather than invented.
const SF_DESC_RE = /(\d+(?:\.\d+)?|\.\d+)\s*s\.?f\.?(?:\s*\/\s*(?:c(?:t|tn)?|sh(?:t|eet)?s?|r(?:l|oll)s?))?\b/i;

// Units of Stock that bundle coverage — the item is sold in whole cartons/
// bundles/sheets/rolls of so-many square feet, never loose pieces. This is the
// sell basis the ERP's U/M column names; EA/GL accessories stay count lines.
// Sheet-sold mosaics ride the same path (orderbook's SHEET_UNIT_RE forms).
// A roll belongs here for the same reason a carton does — the Schluter export
// sells sheet goods by the RL with the coverage in the description — and, like
// every other unit, it only types a row the description also names a floor in,
// so a roll of membrane stays the count line it should be.
const COVERAGE_SOLD_RE = /^(ct|ctn|carton|bx|box|cs|case|bl|bdl|bundle|sh|sht|sheet|rl|rls|roll)s?$/i;

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
  // A foot-marked size ("3'x167'" roll goods) is never a bare plank width.
  return str(size) && !/'/.test(str(size)) ? "hardwood" : null;
}

function mappedItem(mapping, raw, sku, sem) {
  // A Schluter row is one on Schluter's own EFT (the brand line, mapping
  // flag) OR any Virginia Tile row whose VTC MFG code is SLR — another brand's
  // EFT carries Schluter lines too (the CTNS sheet, owner 2026-09-14). It
  // never takes the sheet's tile default and its coverage rides the text.
  const schluter = !!mapping.schluter || /^SLR$/i.test(str(raw.mfg));
  let type = str(raw.type) || (schluter ? null : mapping.defaultType) || null;
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
  let pcHint = null;
  const coverage = numOrNull(raw.coverage);
  // Does any of the row's units bundle coverage (carton/bundle/sheet/roll)?
  const bundledUnit = [raw.unit, raw.orderUnit, raw.priceUnit].some((u) => COVERAGE_SOLD_RE.test(str(u)));
  if ((mapping.sfFromDescription || schluter) && sfPerUnit == null && descText) {
    const sf = descText.match(SF_DESC_RE);
    // A suffixed coverage ("10.64sf/c", "134.5sf/roll") is per-unit wherever it
    // appears; a BARE "N SF" is only coverage when the sell basis bundles it —
    // on an EA row it is the product's own spec (a DITRA-HEAT cable's kit
    // size, "CABLE 120V 101.9 SF") and stays in the name.
    // A coverage sitting at the very end after a separator ("… Membrane -
    // 134.5sf/roll", "… Roll = 108 SF") leaves the separator dangling once
    // it's pulled; interior ones are the vendor's own punctuation and stay.
    if (sf && (/\//.test(sf[0]) || bundledUnit)) { sfPerUnit = numOrNull(sf[1]); descText = str(descText.replace(sf[0], " ")).replace(/(?:\s*[-–—·,=.])+\s*$/, ""); }
  }
  const schluterProfile = !!schluter && isSchluterProfileLine(raw.productLine);
  if (schluterProfile) {
    const p = schluterDescription(descText, raw.productLine);
    ({ size, thickness } = p);
    descText = p.name;
  } else if (schluter && !size && descText && (() => {
    const acc = schluterAccessory(descText, raw.productLine);
    descText = acc.text;
    if (acc.pc != null) pcHint = acc.pc;
    if (acc.size) size = acc.size;
    return !!acc.size;
  })()) {
    // dims landed whole by the pre-pass — nothing left for the generic split
  } else if (!size && descText) {
    // A Schluter accessory's lone fraction is a pipe size or a frame height,
    // never a tile thickness (only the three-dim board rule reads one there).
    const split = splitSizeFromDescription(descText, { leadWidth: !!mapping.leadWidthSize, mm: !schluter, fracThickness: !schluter });
    if (split.size) size = split.size;
    if (split.thickness && !thickness) thickness = split.thickness;
    // A sheet dimension only stands in when the description gave no chip size —
    // a real chip size (e.g. "2\" Hexagon") always wins for the tile L×W.
    if (split.sheetSize && !size && !sheetSize) sheetSize = split.sheetSize;
    if (split.pcHint != null) pcHint = split.pcHint;
    // A Schluter row always takes the cleaned name: its packaging tokens go
    // even when nothing else extracted (schluterWords recases it anyway).
    if (split.size || split.thickness || split.sheetSize || split.pcHint != null || schluter) descText = split.name;
  }
  // A bare trailing period is vendor punctuation, not information ("…SAND
  // PEBBLE.") — dropped here as well as in the split, so rows where nothing
  // extracts don't keep it and read as a mis-split (NAME_LITTER_RE).
  descText = str(descText).replace(/\s*\.$/, "");
  if (schluter && !schluterProfile) descText = schluterWords(descText);
  if (schluter) {
    size = schluterStick(size);
    // A counted pack with no size of its own reads "N ct" — the stock book's
    // spelling, and what the configurator counts board fasteners from.
    const pc = numOrNull(raw.pcPerUnit) ?? pcHint;
    if (!size && pc > 0) size = `${pc} ct`;
  }
  // An SF-priced roll/sheet with no stated coverage can still price: its
  // feet-marked L×W IS the area one sell unit covers (DITRA-HEAT-DUO-PS
  // "3'3\" X 33'" ≈ 107 sf/roll). Gated on the row NEEDING coverage to price —
  // an RL-priced strip's dims stay dims.
  if (sfPerUnit == null && coverage == null && /^(sf|sft|sqft)$/i.test(str(raw.priceUnit)) && bundledUnit) {
    const a = feetArea(size);
    if (a != null) sfPerUnit = a;
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
  // The Schluter EFT's product line is a grouping label ("RONDEC CORNERS" over
  // every Rondec, straight or corner), not a series — it never fronts the name.
  const pl = schluter ? "" : smartCase(str(raw.productLine));
  // smartCase here as well as in the split: a row where nothing extracted (an
  // accessory with no size in its text) still carries the vendor's raw CAPS,
  // and joining a Title-Cased product line onto it would produce mixed case
  // that normOrderItem's own smartCase then rightly leaves alone.
  const label = smartCase(descText) || [smartCase(str(raw.color)), smartCase(str(raw.style))].filter(Boolean).join(" ");
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
    pcPerUnit: numOrNull(raw.pcPerUnit) ?? pcHint,
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
      // The brand-title line above the header (the same cell computeFingerprint
      // reads): Virginia Tile reuses one template for every brand it
      // distributes, and the brand decides what the rows ARE. A tile brand's
      // untyped row is tile; Schluter's line is membranes, profiles and setting
      // materials — no flooring at all, so nothing defaults to tile, and its
      // coverage rides the description ("= 134.5 SF") instead of SF/CT.
      let title = "";
      for (let t = r - 1; t >= 0; t--) {
        const text = (rows[t] || []).map((c) => str(c)).filter(Boolean).join(" ").trim();
        if (text) { title = text; break; }
      }
      const schluter = /schluter/i.test(title);
      return {
        sheet: s.name,
        headerRow: r,
        title,
        columns,
        // VTC item codes are 6-20 chars and often carry no digit
        // (WOWALPLRNDEDGE) — the digit-requiring default would drop them.
        skuPattern: "^[A-Z0-9]{6,20}$",
        flags: { xx: "discontinued", "*": "freight", "†": "freight", "•": "madeToOrder", "◪": "transitioning" },
        groupBy: "mfg",
        defaultType: schluter ? null : "tile",
        ...(schluter ? { sfFromDescription: true, schluter: true } : {}),
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
