// Schluter shower-system engine — table-free, registry-fed.
// Tasks 2 and 5 classify items and build the solver.
//
// classify() is a grammar over Schluter's SKU codes, not a per-item lookup:
// every field it derives comes from parsing the sku (and, for quantities the
// sku doesn't encode, the sheet's "size" text) against the patterns Schluter
// itself uses to build part numbers. The mm→inch table below is the one
// constant every tray/curb/board/kit SKU is built from.
//
// Task 6 (the wedi.js precedent): the row search's pinned configurator entry
// imports schluterquery.js instead of this file — a few hundred bytes of
// word lists, never the registry-fed catalog — so this module re-exports its
// four recognizer functions for a caller that already pays for the rest.

import { queryHit, parseQuery, querySummary, seedFromQuery } from "./schluterquery.js";
import { BENCH_DEPTH, WALL_THICK } from "./showerdraw.js";
import { planPanels } from "./panelplan.js";
import { groupOf } from "./slots.js";

export { queryHit, parseQuery, querySummary, seedFromQuery };

// Marketing-rounded metric pair Schluter encodes into tray/board/kit SKUs.
// 625/1625/2440 are KERDI-BOARD panel sides (the KB<thick><w><l> dims run);
// no tray/kit code contains them, so the greedy scan stays unambiguous.
const MM_IN = {
  810: 32, 915: 36, 965: 38, 1000: 39, 1220: 48,
  1395: 55, 1525: 60, 1830: 72, 1930: 76,
  625: 24.5, 1625: 64, 2440: 96,
};

// KB thickness code (mm) → the inch fraction the sheets print.
const THICK_IN = { 3: '1/8"', 5: '3/16"', 9: '3/8"', 12: '1/2"', 19: '3/4"', 25: '1"', 38: '1-1/2"', 50: '2"' };

// Roll-size fallback table (used only when the sheet's "= N sf" text is
// missing) — 5M/7M/10M/12M/20M rolls, "plain" = the unsuffixed full roll.
const ROLL_SF = { 5: 54, 7: 75, 10: 108, 12: 128, 15: 323, 20: 215 };
const PLAIN_SF = 323;

// KERDI-BAND seam-band roll lengths by /<n>M suffix; no suffix = full roll.
const BAND_LF = { 5: 16, 10: 33 };
const BAND_LF_PLAIN = 98;

// Scan a digit string left-to-right, greedily matching the longest MM_IN key
// (4 digits, then 3) at each position. This is how a fused, separator-free
// run like "9151395" (from SLRKSLT9151395S) resolves to [915, 1395] rather
// than any other split — the table itself has no 3-vs-4-digit ambiguity once
// matching prefers the longer key first.
function mmExactTokens(digits) {
  const tokens = [];
  let i = 0;
  while (i < digits.length) {
    const four = digits.slice(i, i + 4);
    const three = digits.slice(i, i + 3);
    if (MM_IN[four] !== undefined) { tokens.push(MM_IN[four]); i += 4; }
    else if (MM_IN[three] !== undefined) { tokens.push(MM_IN[three]); i += 3; }
    else { i += 1; }
  }
  return tokens;
}

// Tray/kit width×depth: every digit in the code that isn't part of the
// mm-pair is a letter (prefix, suffix flags), so stripping non-digits and
// running the same greedy scan works whether the SKU separates the pair
// with "/" or not. w = the longer dimension, d = the shorter (KST965/1525 ->
// w:60,d:38). Linear LTS trays don't use this — see classifyCode.
function trayDims(code) {
  const vals = mmExactTokens(code.replace(/\D/g, ""));
  if (!vals.length) return {};
  return { w: Math.max(...vals), d: Math.min(...vals) };
}

// Curb length codes are NOT the marketing-rounded mm table — they're the
// nearer-to-precise mm figure (e.g. 1524mm for a 60" curb, 970mm for a 38"
// curb, vs. 1525/965 on trays of the same nominal size). Nearest MM_IN key
// within 10mm covers every curb in the catalog; further out we just do the
// literal mm/25.4 conversion.
function nearestMmIn(mm) {
  if (MM_IN[mm] !== undefined) return MM_IN[mm];
  let best = null, bestDiff = Infinity;
  for (const [k, v] of Object.entries(MM_IN)) {
    const diff = Math.abs(Number(k) - mm);
    if (diff < bestDiff) { bestDiff = diff; best = v; }
  }
  return bestDiff <= 10 ? best : Math.round(mm / 25.4);
}

// KBSC<height mm><depth mm><length mm> — height/depth are a fixed 3+3 digit
// pair (always "115150" = 4½"×6" in this catalog), everything after that is
// the curb length in mm.
function curbLen(code) {
  const m = /^KBSC\d{6}(\d+)$/.exec(code);
  return m ? nearestMmIn(Number(m[1])) : undefined;
}

// Prefer the sheet's own "= N sf" annotation; fall back to the roll-size
// table by /<n>M suffix (or the plain/unsuffixed full roll) when it's absent.
function membraneSf(item, code) {
  const text = item.size || item.name || item.description || "";
  const explicit = /=\s*([\d.]+)\s*sf/i.exec(text) || /\(\s*([\d.]+)\s*sf\s*\)/i.exec(text);
  if (explicit) return parseFloat(explicit[1]);
  const suffix = /^(?:SLR)?KERDI200(?:200)?\/?(\d+)M$/.exec(code);
  if (suffix && ROLL_SF[suffix[1]] !== undefined) return ROLL_SF[suffix[1]];
  return PLAIN_SF;
}

// A roll's length code off its SKU ("10M"); an unsuffixed roll is the full
// 30 m one. KERDI membrane and KERDI-BAND share the /<n>M grammar.
const rollCode = (code) => { const m = /^(?:SLR)?(?:KERDI200(?:200)?|KEBA\d+\/\d+)\/?(\d+)M$/.exec(code); return m ? m[1] + "M" : "30M"; };

function bandLf(code) {
  const suffix = /\/(\d+)M$/.exec(code);
  if (suffix && BAND_LF[suffix[1]] !== undefined) return BAND_LF[suffix[1]];
  return BAND_LF_PLAIN;
}

// Board sf: prefer the sheet's "= N sf" text; otherwise compute from the
// dimension numbers in "size" (WxH, or thickness×W×H when three numbers are
// present — a leading 2 there means the 2"-thick board, thick2). The mapped
// import writes a three-dim board's size BARE ("48x96", "24.5x96") with the
// thickness pulled into its own field (pricebook.js THREE_IN_RE), so a bare
// L×W with no inch marks is a panel too — without it every EFT board carries
// no sf and drops out of the wall pick.
function boardDims(item) {
  const text = item.size || "";
  const out = {};
  // the sheet's sides ride along as bw (short) × bl (long) wherever a real
  // pair shows — the course planner (round 7) needs dimensions, not just area
  const pair = (a, b2) => { out.bw = Math.min(a, b2); out.bl = Math.max(a, b2); };
  const explicit = /=\s*([\d.]+)\s*sf/i.exec(text) || /\(\s*([\d.]+)\s*sf\s*\)/i.exec(text);
  if (explicit) out.sf = parseFloat(explicit[1]);
  const nums = [...text.matchAll(/([\d.]+)\s*"/g)].map((m) => parseFloat(m[1]));
  if (nums.length === 3) {
    if (nums[0] === 2) out.thick2 = true;
    pair(nums[1], nums[2]);
    // dims-derived sf (no sheet annotation on the 2" board); informational — bench build-up counts pieces, never area
    if (out.sf === undefined) out.sf = (nums[1] * nums[2]) / 144;
  } else if (nums.length === 2) {
    if (Math.min(...nums) >= 1.5) {
      pair(nums[0], nums[1]);
      if (out.sf === undefined) out.sf = (nums[0] * nums[1]) / 144;
    }
  } else if (!nums.length) {
    const bare = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(text);
    // A pair with a sub-1.5" side is a thickness×width fragment (the live ERP
    // export's "0.5 X 48 X 64" board once landed as size "0.5x48" and the
    // wall pick billed 618 panels), never a panel — leaving sf empty lets the
    // KB code's own dims fill it in classify.
    if (bare && Math.min(parseFloat(bare[1]), parseFloat(bare[2])) >= 1.5) {
      pair(parseFloat(bare[1]), parseFloat(bare[2]));
      if (out.sf === undefined) out.sf = (parseFloat(bare[1]) * parseFloat(bare[2])) / 144;
    }
  }
  return out;
}

/**
 * What one unit of a classified item covers — { n, unit: "sf" | "lf" } for
 * membrane rolls, seam bands and boards, null for everything else. The
 * popups print it beside the unit price (ticket 158 P0-3).
 */
export function coverageOf(i) {
  if (!i) return null;
  if (i.g === "membrane" && i.sf > 0) return { n: i.sf, unit: "sf" };
  if (i.g === "seam" && i.lf > 0) return { n: i.lf, unit: "lf" };
  if (i.g === "board" && i.sf > 0) return { n: round2(i.sf), unit: "sf" };
  return null;
}

/**
 * Classify a Schluter stock-book/EFT row into its shower-system role.
 * Returns the item spread plus { g, w?, d?, drain?, part?, sf?, lf?, len?,
 * sfPerBag?, ramp?, thin? }, or null for non-shower Schluter items (profiles,
 * Ditra, shelves…), which the configurator ignores.
 */
export function classify(item) {
  if (!item) return null;
  // A live registry row's own sku can be the shop's internal/ERP code, not
  // the Schluter grammar (ADR 0032 correction) — when that code matches
  // nothing, retry against vendorSkus[0], the manufacturer code the ERP
  // stock export carries separately (cheap floor; the phase-3 adapter does
  // this properly).
  return classifyCode(item, item.sku) ||
    (item.vendorSkus && item.vendorSkus[0] ? classifyCode(item, item.vendorSkus[0]) : null);
}

// Fixed-length KERDI-LINE (ticket 158 P0-2) — channel bodies, their
// grates, FC grate connectors, shower profiles and loose accessories. Its own
// group, "line", so no g:"drain" pick in buildKit can reach it: the linear
// recipe stays on Vario until the slot swap lands. Length codes are
// centimetres (50…180 → 20″…72″ in 4″ steps, Schluter's own rounding).
const LINE_FRAME = { 6: '1/4"', 12: '1/2"', 19: '3/4"', 22: '7/8"', 23: '29/32"', 30: '1-1/8"' };
const LINE_STYLE = { AR: "solid", B: "perforated", BL: "perforated", IFE: "floral", IFF: "curve", IFG: "pure" };
const cmIn = (cm) => Math.round(Number(cm) * 0.4);

function kerdiLine(item, code) {
  let m = /^KL1V(O?)60E(\d{2,3})$/.exec(code);
  if (m) return { ...item, g: "line", part: "body", len: cmIn(m[2]), offset: !!m[1] };
  m = /^KL1DR(O?)E(\d{2,3})$/.exec(code);
  if (m) return { ...item, g: "line", part: "grate", len: cmIn(m[2]), offset: !!m[1], frameless: true, style: "tileable" };
  m = /^KL1(AR|BL|B|IF[EFG])(19|23|30)([A-Z]+?)(\d{2,3})$/.exec(code);
  if (m) {
    const entry = { ...item, g: "line", part: "grate", len: cmIn(m[4]), style: LINE_STYLE[m[1]], frame: LINE_FRAME[m[2]], finish: m[3] };
    if (m[1] === "BL") entry.lock = true;
    return entry;
  }
  m = /^KLTFH(6|12|22)E(\d{2,3})$/.exec(code);
  if (m) return { ...item, g: "line", part: "grate", len: cmIn(m[2]), style: "tile", frame: LINE_FRAME[m[1]] };
  if (/^V\/?KL[A-Z]+35$/.test(code)) return { ...item, g: "line", part: "cover" };
  if (/^SP[RS][AB]\d+[A-Z]+\d+$/.test(code)) return { ...item, g: "line", part: "profile" };
  if (/^KLAM5K|^KLVZSF|^KLVRGG|^KLVSTR/.test(code)) return { ...item, g: "line", part: "acc" };
  return null;
}

function classifyCode(item, rawSku) {
  const raw = rawSku || "";
  // Distributor rows carry an "SLR" reseller prefix the mfg code doesn't have.
  const code = raw.trim().replace(/^SLR/, "");

  // KERDI-SHOWER-LTS: linear-drain tray. The trailing S here is part of the
  // "LTS" line name, not the offset-drain flag KST-line SKUs use. Unlike
  // every other tray, w is the CHANNEL edge, not the longer side: Schluter's
  // first dimension is the drain side (KSLT965/1930S is 38″×76″ drained on
  // the 38″ edge, KSLT1930/965S its 76″-edge twin), and the channel sits at
  // the room's back wall (w).
  if (/^KSLT.*S$/.test(code)) {
    const vals = mmExactTokens(code.replace(/^KSLT/, "").replace(/S$/, "").replace(/\D/g, ""));
    if (!vals.length) return { ...item, g: "tray", drain: "linear" };
    return { ...item, g: "tray", w: vals[0], d: vals.length > 1 ? vals[1] : vals[0], drain: "linear" };
  }

  // KERDI-SHOWER-T(T)(S): KST<a>[/<b>][S][BF] — S = offset drain, BF = the
  // curbless "TT" tray (thin: true). No S = point drain.
  if (/^KST/.test(code)) {
    const body = code.replace(/^KST/, "");
    const m = /^([\d/]+)(S)?(BF)?$/.exec(body);
    const dims = trayDims(m ? m[1] : body);
    const entry = { ...item, g: "tray", ...dims, drain: m && m[2] ? "offset" : "point" };
    if (m && m[3]) entry.thin = true;
    return entry;
  }

  const line = kerdiLine(item, code);
  if (line) return line;

  // KERDI-LINE-VARIO linear-drain channel/flange.
  if (/^KLVR2FLK/.test(code)) {
    return { ...item, g: "drain", drain: "linear", part: "flange" };
  }
  if (/^KLVR/.test(code)) {
    const entry = { ...item, g: "drain", drain: "linear", part: "channel" };
    if (/122$/.test(code)) entry.len = 48;
    else if (/244$/.test(code)) entry.len = 96;
    const m = /^KLVRID(\d+)([A-Z]+?)(122|244)$/.exec(code);
    if (m) { entry.design = m[1]; entry.finish = m[2]; }
    return entry;
  }

  // KERDI-DRAIN: round point drain — flange kit or grate.
  if (/^KD/.test(code)) {
    const entry = { ...item, g: "drain", drain: "point" };
    if (/FLK/.test(code)) entry.part = "flange";
    else if (/GRK/.test(code)) entry.part = "grate";
    const pipe = /^KD[A-Z]*?(\d)/.exec(code);
    if (pipe) entry.pipe = Number(pipe[1]);
    entry.material = /PVC/.test(code) ? "PVC" : /ABS/.test(code) ? "ABS"
      : /(?:FLK|GRK)EB/.test(code) ? "Brushed Stainless" : /(?:FLK|GRK)E/.test(code) ? "Stainless" : "";
    return entry;
  }

  // KERDI membrane rolls; KERDI200200 is the wide roll — a different-width
  // product, flagged out of the pickRolls ladder.
  if (/^KERDI200/.test(code)) {
    const entry = { ...item, g: "membrane", sf: membraneSf(item, code) };
    if (/^KERDI200200/.test(code)) entry.wide = true;
    entry.roll = rollCode(code);
    return entry;
  }

  // KEBA<thickness>/<width mm>[/<n>M] — the width code is what a band swap names.
  if (/^KEBA/.test(code)) {
    const m = /^KEBA\d+\/(\d+)/.exec(code);
    return { ...item, g: "seam", lf: bandLf(code), roll: rollCode(code), ...(m ? { width: m[1] } : {}) };
  }
  // KERECK corners (FI = inside, FA = outside), KERDI-SEAL pipe (KMS172) /
  // mixing-valve (KMSMV) seals. buildKit keys on these facts, never the row's
  // name — a live registry name is normOrderItem's cleaned (title-cased)
  // description, so name text is not a stable key.
  if (/^KERECK/.test(code)) {
    const entry = { ...item, g: "seam" };
    if (/\/FI/.test(code)) entry.corner = "inside";
    else if (/\/FA/.test(code)) entry.corner = "outside";
    const ct = /\/F[IA](\d+)/.exec(code);
    if (ct) entry.ct = Number(ct[1]);
    return entry;
  }
  if (/^KMS/.test(code)) {
    return { ...item, g: "seam", seal: /^KMSMV/.test(code) ? "valve" : "pipe" };
  }

  // KERDI-BOARD-SC curb (len via the mm table).
  if (/^KBSC/.test(code)) {
    const entry = { ...item, g: "curb" };
    const len = curbLen(code);
    if (len !== undefined) entry.len = len;
    return entry;
  }
  // KERDI-SHOWER-R curbless ramp — same family as the curb, ramp: true.
  if (/^KSR/.test(code)) {
    return { ...item, g: "curb", ramp: true };
  }
  // KERDI-BOARD-SN niche, -SB bench, KERS-B bench corner kit — all "extra",
  // subtyped so the popup can group its add-on chips and the bench menu can
  // place a premade. An SB code carries the bench's own dims: KBSB<depth mm>
  // [<length mm>]<TA|RA> — TA is the triangular corner seat (one leg figure),
  // RA the rectangular wall bench. Half-inch rounding because the 11½" bench
  // (292mm) must not read as 11".
  if (/^KB12SN/.test(code)) {
    const entry = { ...item, g: "extra", extra: "niche" };
    // niche openings use their own mm sizes (12″ × 20″ / 28″), not the tray table
    const NICHE_MM = { 305: 12, 508: 20, 711: 28 };
    const mm = /^(\d{3})(\d{3})/.exec(code.replace(/^KB12SN/, ""));
    const dims = mm ? [NICHE_MM[mm[1]], NICHE_MM[mm[2]]].filter((n) => n !== undefined) : [];
    if (dims.length === 2) {
      entry.w = Math.min(...dims); entry.d = Math.max(...dims);
      entry.size = `${entry.w}"x${entry.d}"`;
    }
    return entry;
  }
  if (/^KBSB/.test(code)) {
    const entry = { ...item, g: "extra", extra: "bench" };
    const m = /^KBSB(\d+)([A-Z]*)/.exec(code);
    if (m) {
      const inH = (s) => Math.round((+s / 25.4) * 2) / 2;
      if (/^T/.test(m[2] || "")) entry.bench = { corner: true, a: inH(m[1]) };
      else entry.bench = m[1].length > 3
        ? { d: inH(m[1].slice(0, 3)), len: inH(m[1].slice(3)) }
        : { d: inH(m[1]) };
    }
    return entry;
  }
  if (/^KERSB/.test(code)) {
    return { ...item, g: "extra", extra: "benchkit" };
  }
  // KBZS screws + washers: board fasteners, counted by the "N ct" in the
  // size text — never part of the wall-panel sf pick.
  if (/^KBZS/.test(code)) {
    const m = /(\d+)\s*ct/i.exec(item.size || item.name || item.description || "");
    return { ...item, g: "board", fastener: true, ct: m ? Number(m[1]) : 0 };
  }
  // Every other KERDI-BOARD-Z* accessory (ZA/ZC/ZFP hardware-attachment and
  // edge profiles, ZT washers) is not a shower part — without this guard the
  // KB catch-all below made the ZFP flat plastic profile a wall "board" and
  // the wall pick landed hundreds of profile sticks instead of panels.
  if (/^KBZ/.test(code)) return null;
  // Every other KERDI-BOARD panel/accessory. The two digits after KB are the
  // board thickness in mm (KB12 = ½", KB50 = 2") — the grammar marks the 2"
  // board even when the row's size text is unreadable, and the wall pick
  // keys ½" panels off thickMm rather than trusting the sheet's text.
  if (/^KB/.test(code)) {
    const entry = { ...item, g: "board", ...boardDims(item) };
    const m = /^KB(\d{2})(\d*)/.exec(code);
    if (m) {
      entry.thickMm = Number(m[1]);
      if (entry.thickMm >= 40) entry.thick2 = true;
      // The code's own dims run (KB<thick><w><l>, the same mm table trays
      // parse) stands in when the sheet text failed — a garbled import must
      // never leave a panel sf-less (it drops out of the wall pick) or
      // fractional (618-panel bills), and the course planner (round 7)
      // needs bw/bl even when the text carried only "= N sf".
      const dims = mmExactTokens(m[2]);
      if (dims.length === 2) {
        if (entry.bw === undefined) { entry.bw = Math.min(...dims); entry.bl = Math.max(...dims); }
        if (entry.sf === undefined) {
          entry.sf = (dims[0] * dims[1]) / 144;
          entry.size = `${Math.min(...dims)}"x${Math.max(...dims)}"${THICK_IN[entry.thickMm] ? "x" + THICK_IN[entry.thickMm] : ""}`;
        }
      }
    }
    return entry;
  }

  // ALL-SET thin-set (sfPerBag: 55) and KERDI-FIX sealing adhesive — the two
  // mortar/adhesive SKUs in the shower-system line. KERDI-FIX isn't named in
  // the SKU grammar (it doesn't share the SETA token); it's a small, labeled
  // irregular kept in the same "set" bucket as ALL-SET rather than a
  // per-SKU table, since it's exactly one extra prefix check.
  if (/SETA/.test(code)) {
    return { ...item, g: "set", sfPerBag: 55 };
  }
  if (/^KERDIFIX/.test(code)) {
    return { ...item, g: "set", adhesive: true };
  }

  // KERDI-SHOWER-KIT factory kits (tray + curbs + membrane + band + flange +
  // corners + seals bundled under one SKU). SP = offset drain, else point.
  if (/^KSK/.test(code)) {
    return { ...item, g: "kit", ...trayDims(code), drain: code.includes("SP") ? "offset" : "point" };
  }

  return null;
}

/**
 * Classify a raw item list into a catalog: classified entries only,
 * non-shower rows (classify() -> null) dropped.
 */
export function catalogOf(items) {
  return items.map(classify).filter(Boolean).map((e) => {
    const t = partText(e);
    return { ...e, desc: e.name || "", name: t.name, size: t.size };
  });
}

// --- the Size field and the Product text of one classified entry ----------
// (ADR 0054) Derived from the part code wherever the grammar reads it, so the
// same tray reads the same from the stock export and the EFT sheet; the book's
// own words fill only what the code does not carry. No brand word: KERDI and
// ALL-SET say whose they are (owner 2026-10-01).

// mixed numbers hyphenated, to the nearest 1/16 — "4-1/2", "24-1/2"
function inchText(n) {
  const whole = Math.floor(n + 1e-9);
  let num = Math.round((n - whole) * 16), den = 16;
  if (num === 16) return String(whole + 1);
  if (num === 0) return String(whole);
  while (num % 2 === 0) { num /= 2; den /= 2; }
  return (whole ? whole + "-" : "") + num + "/" + den;
}
const ftIn = (n) => {
  const ft = Math.floor(n / 12 + 1e-9), r = n - ft * 12;
  return ft + "'" + (r > 1e-6 ? inchText(r) + '"' : "");
};
// roll lengths as the sheet prints them (10 m reads 33', not 32'10")
const ROLL_LEN = { 5: "16'5\"", 7: "23'", 10: "33'", 12: "39'5\"", 15: "49'3\"", 20: "65'7\"", 30: "98'5\"" };
const ROLL_W_IN = { narrow: 39, wide: 79 };
const words = (s) => String(s || "").replace(/\b([a-z])/g, (m) => m.toUpperCase());
function cleanBookName(e) {
  const codes = [e.sku, e.erp].filter(Boolean).map((c) => String(c).toUpperCase().replace(/^SLR/, ""));
  return String(e.name || "").split(/\s+/)
    .filter((w) => w && !codes.includes(w.toUpperCase().replace(/^SLR/, "")))
    .join(" ")
    .replace(/\bschluter\b\s*®?\s*/gi, " ").replace(/[®™]/g, "")
    .replace(/\s+[—–-]\s+/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s—–,-]+|[\s—–,-]+$/g, "");
}

export function partText(e) {
  const g = e.g;
  let size = "", name = "", qual = "";
  if (g === "tray") {
    size = e.w && e.d ? `${inchText(Math.min(e.w, e.d))}"x${inchText(Math.max(e.w, e.d))}"` : "";
    if (e.drain === "linear") { name = "KERDI-SHOWER-LTS Tray"; if (e.w) qual = `Linear Drain on ${inchText(e.w)}" Side`; }
    else if (e.thin) { name = "KERDI-SHOWER-TT Tray"; qual = "Curbless"; }
    else if (e.drain === "offset") { name = "KERDI-SHOWER-TS Tray"; qual = "Offset Drain"; }
    else name = "KERDI-SHOWER-T Tray";
  } else if (g === "drain" && e.drain === "point") {
    size = e.pipe ? `${e.pipe}"` : "";
    name = "KERDI-DRAIN " + (e.part === "grate" ? "Grate" : "Flange Kit");
    // a grate's style rides the code: …CS tileable, …D<n> a Vario design
    const code = String(e.sku || "").replace(/^SLR/, "");
    const style = e.part === "grate" ? (/CS$/.test(code) ? "Tileable" : VARIO_DESIGN[(/D(\d+)$/.exec(code) || [])[1]] || "") : "";
    qual = [style, e.material].filter(Boolean).join(", ");
  } else if (g === "drain") {
    if (e.part === "flange") { size = '2"'; name = "KERDI-LINE-VARIO Flange Kit"; }
    else {
      size = e.len ? ftIn(e.len) : "";
      name = "KERDI-LINE-VARIO Channel";
      qual = [VARIO_DESIGN[e.design], e.finish && words(FINISH_LABEL[e.finish] || "")].filter(Boolean).join(", ");
    }
  } else if (g === "line") {
    size = e.len ? `${e.len}"` : "";
    name = e.part === "body" ? "KERDI-LINE Channel" : e.part === "grate" ? "KERDI-LINE Grate" : cleanBookName(e);
    if (e.part === "grate") qual = [STYLE_WORD[e.style], e.frameless ? "Frameless" : e.frame ? e.frame + " Frame" : "", words(FINISH_LABEL[e.finish] || "")].filter(Boolean).join(", ");
  } else if (g === "membrane") {
    const len = ROLL_LEN[String(e.roll || "").replace("M", "")] || ROLL_LEN[30];
    size = `${ftIn(ROLL_W_IN[e.wide ? "wide" : "narrow"])}x${len}`;
    name = "KERDI Membrane";
    if (e.sf) qual = `${e.sf} sf`;
  } else if (g === "seam" && e.corner) {
    size = e.ct ? `${e.ct} ct` : "";
    name = "KERDI-KERECK-F " + (e.corner === "inside" ? "Inside" : "Outside") + " Corner";
  } else if (g === "seam" && e.seal) {
    name = e.seal === "valve" ? "KERDI-SEAL-MV Valve Seal" : "KERDI-SEAL-PS Pipe Seal";
  } else if (g === "seam") {
    const w = e.width ? Math.round((Number(e.width) / 25.4) * 4) / 4 : 0;
    size = [w ? inchText(w) + '"' : "", e.lf ? ftIn(e.lf * 12) : ""].filter(Boolean).join("x");
    name = "KERDI-BAND";
  } else if (g === "curb") {
    if (e.ramp) {
      const mm = mmExactTokens(String(e.sku || "").replace(/^SLR?KSR/, "").replace(/\D.*$/, ""));
      size = mm.length === 2 ? `${inchText(Math.min(...mm))}"x${inchText(Math.max(...mm))}"` : String(e.size || "");
      name = "KERDI-SHOWER-R Ramp";
    } else {
      const m = /^KBSC(\d{3})(\d{3})/.exec(String(e.sku || "").replace(/^SLR/, ""));
      const halfIn = (mm) => Math.round((Number(mm) / 25.4) * 2) / 2;
      const prof = m ? `x${inchText(halfIn(m[2]))}"x${inchText(halfIn(m[1]))}"` : "";
      size = e.len ? `${inchText(e.len)}"${prof}` : "";
      name = "KERDI-BOARD-SC Curb";
    }
  } else if (g === "board" && e.fastener) {
    size = e.ct ? `${e.ct} ct` : "";
    name = "KERDI-BOARD Screws & Washers";
  } else if (g === "board") {
    const th = THICK_IN[e.thickMm] || "";
    size = e.bw && e.bl ? `${inchText(e.bw)}"x${inchText(e.bl)}"${th ? "x" + th : ""}` : String(e.size || "");
    name = "KERDI-BOARD Panel";
  } else if (g === "extra" && e.extra === "niche") {
    const lit = /^(?:SLR)?KB12SNLT/.test(String(e.sku || ""));
    size = !lit && /\d/.test(String(e.size || "")) ? e.size : "";
    name = lit ? "KERDI-BOARD-SN-LT Lighted Niche" : "KERDI-BOARD-SN Niche";
  } else if (g === "extra" && e.extra === "bench" && e.bench) {
    const b = e.bench;
    size = b.corner ? `${inchText(b.a)}"x${inchText(b.a)}"x${BENCH_H}"` : b.len ? `${inchText(b.d)}"x${inchText(b.len)}"x${BENCH_H}"` : "";
    name = "KERDI-BOARD-SB Bench"; qual = b.corner ? "Triangular" : "Rectangular";
  } else if (g === "set") {
    const lb = /(\d+)\s*lb/i.exec(String(e.size || "") + " " + String(e.name || ""));
    size = lb ? `${lb[1]} lb` : "";
    name = e.adhesive ? "KERDI-FIX Adhesive" : "ALL-SET Thin-set";
  } else {
    size = String(e.size || ""); name = cleanBookName(e);
  }
  return { size, name: qual ? `${name}, ${qual}` : name };
}

// ============================================================================
// benches (wedi parity round 3) — the drawing's bench zones and decision 4's
// three forms: premade SB piece, 2" build-up ("site"), installer-framed with
// the ½" wrap. The bench shape mirrors wedi's normBench so showerdraw's zone
// hover/menu machinery drives both configurators unchanged.
// ============================================================================

export const BENCH_H = 20;   // SB premades are 20" high (pricelist p.121); site builds match

/**
 * Normalize one bench row ({kind, side|corner, build, part?, len/depth/h/size})
 * against the room and the live catalog. A premade's own dims come off its
 * classified SB code (entry.bench); a wall bench defaults to the full run at
 * the shared 14" seat depth. A framed bench carries the wedi panFit fork as
 * `trayFit` (owner 2026-08-24): "cut" (default) keeps the tray choice as the
 * full room ranks it — the tray just cuts at the bench face — while "smaller"
 * re-runs trayCandidates for the clear space (benchTrayRoom).
 */
export function normBench(b, dims, cat) {
  b = b || {};
  const part = b.part && cat ? cat.find((i) => i.sku === b.part) : null;
  const pb = (part && part.bench) || null;
  if (b.kind === "corner") {
    return {
      kind: "corner",
      corner: ["bl", "br", "fl", "fr"].includes(b.corner) ? b.corner : "bl",
      build: part ? "premade" : "site", part: part ? part.sku : null,
      size: round2(+b.size || (pb && pb.a) || 24),
      h: round2(+b.h || BENCH_H),
      ...(!part && b.board ? { board: b.board } : {}),
    };
  }
  const side = ["left", "right", "back"].includes(b.side) ? b.side : "back";
  const run = dims ? (side === "back" ? +dims.w || 0 : +dims.d || 0) : 0;
  const build = part ? "premade" : b.build === "framed" ? "framed" : "site";
  const len = +b.len || (pb && pb.len) || run || 48;
  return {
    kind: "wall", side, build, part: part ? part.sku : null,
    len: round2(run ? Math.min(len, run) : len),
    depth: round2(+b.depth || (pb && pb.d) || BENCH_DEPTH),
    h: round2(+b.h || BENCH_H),
    ...(build === "framed" ? { trayFit: b.trayFit === "smaller" ? "smaller" : "cut" } : {}),
    ...(build !== "premade" && b.board ? { board: b.board } : {}),
  };
}

/**
 * The room a framed bench leaves for the tray (the wedi benchPanRoom rule:
 * only framed interrupts the envelope — build-ups and premades sit ON the
 * finished tray). x0/y0 is where that reduced room starts in room coords, so
 * the drawing and a pinned drain can shift with it.
 */
export function benchTrayRoom(benches, dims) {
  let w = +dims.w || 0, d = +dims.d || 0, x0 = 0, y0 = 0;
  (benches || []).forEach((b) => {
    if (b.kind !== "wall" || b.build !== "framed") return;
    if (b.side === "back") { d -= b.depth; y0 += b.depth; }
    else { w -= b.depth; if (b.side === "left") x0 += b.depth; }
  });
  return { w: round2(Math.max(0, w)), d: round2(Math.max(0, d)), x0: round2(x0), y0: round2(y0) };
}

/**
 * The cfg's benches, normalized — cfg.benches when present, else the legacy
 * cfg.bench flag ("framed"/"buildup", a saved pre-round-3 marker) as one
 * back-wall bench, so old rows reopen unchanged.
 */
export function cfgBenches(cfg, cat) {
  const list = Array.isArray(cfg.benches) ? cfg.benches
    : cfg.bench === "framed" ? [{ kind: "wall", side: "back", build: "framed" }]
      : cfg.bench === "buildup" ? [{ kind: "wall", side: "back", build: "site" }]
        : [];
  return list.map((b) => normBench(b, cfg, cat));
}

/**
 * Rank tray candidates for a shower config against the catalog.
 *
 * Pool: g==="tray", filtered to the source ("all" vs "stock"), and to trays
 * that make sense for cfg.drain — linear rooms take only linear trays;
 * point/offset rooms take only non-linear trays, further narrowed to
 * exact-point trays when cfg.drain is "point" (an offset tray is not
 * standard stock in that configuration; the fallback branch below encodes
 * that). Fit window: tray covers w,d and total cut <= 26". "deep" flags a
 * cut of more than 6" off any single side.
 *
 * Ranking (in order): drain match beats mismatch; then, for a curbless
 * config (cfg.curbed === false), a thin ("TT" curbless-line) tray beats a
 * non-thin one — a tray with a curb lip doesn't belong on a curbless
 * install even if a non-thin tray would cut less (decision 6); then
 * smaller total cut; then lower price. No fit -> a single mortar-bed card.
 *
 * A point/offset tray also tries the ROTATED orientation (a square drain
 * doesn't care which way the tray lies), so a room deeper than wide still
 * finds its tray; the candidate carries the effective dims as tw/td with
 * rot marking the turn. A linear tray never rotates — its channel edge is
 * directional and belongs at the back wall.
 *
 * A pinned drain (cfg.drainX from the left wall, cfg.drainY from the back —
 * either alone works) splits the cut between the tray's sides instead of
 * taking it all off the far edges: the moulded drain can land anywhere the
 * total cut reaches, so each candidate carries the achieved position (dx/dy),
 * the split (cutL/cutB — the rest comes off the right/front), and `miss`,
 * how far the drain still lands off the pin. Pinned rooms rank by miss
 * before cut size. The drain is moulded — a pin never re-pitches the tray,
 * it only picks which sides the saw takes (the wedi waste-line doctrine).
 */
export function trayCandidates(cfg, cat, { source } = {}) {
  // Only a framed bench set to "Smaller tray" shrinks the room the ranking
  // fits (benchTrayRoom) — the default "cut" leaves the choice exactly as the
  // full room ranks it, and the bench face cut is a site cut buildKit notes
  // (owner 2026-08-24, the wedi panFit fork). x0/y0 shift positions back into
  // room coords for the pin/drawing.
  const troom = benchTrayRoom(cfgBenches(cfg, cat).filter((b) => b.trayFit === "smaller"), cfg);
  const rw = troom.w, rd = troom.d, x0 = troom.x0, y0 = troom.y0;
  let pinX = Number.isFinite(+cfg.drainX) && +cfg.drainX > 0 ? round2(+cfg.drainX - x0) : null;
  let pinY = Number.isFinite(+cfg.drainY) && +cfg.drainY > 0 ? round2(+cfg.drainY - y0) : null;
  let pinned = cfg.drain !== "linear" && (pinX != null || pinY != null);
  // a smaller-tray re-fit with no typed pin chases the CLEAR space's centre,
  // so the drain lands centred on the reduced area (owner rule 2026-08-24);
  // typed drain dimensions always win
  let centered = false;
  if (!pinned && cfg.drain !== "linear" && (rw < (+cfg.w || 0) || rd < (+cfg.d || 0))) {
    pinX = round2(rw / 2); pinY = round2(rd / 2); pinned = true; centered = true;
  }
  // moulded position → room position: target the pin (or the moulded spot),
  // clamped to what the total cut can reach and 2" clear of the room edge
  const place = (m, cutTotal, room, pin) => {
    const lo = Math.max(2, m - cutTotal), hi = Math.min(room - 2, m);
    return Math.min(Math.max(pin != null ? pin : m, Math.min(lo, hi)), hi);
  };
  const pool = cat.filter((i) => i.g === "tray" && (source === "all" || i.stock) &&
    (cfg.drain === "any" ? true
     : cfg.drain === "linear" ? i.drain === "linear"
     : cfg.drain === "offset" ? i.drain !== "linear"
     : i.drain === "point"));
  const out = [];
  pool.forEach((tray) => {
    const orients = tray.drain === "linear" || tray.w === tray.d
      ? [[tray.w, tray.d, false]]
      : [[tray.w, tray.d, false], [tray.d, tray.w, true]];
    let best = null;
    orients.forEach(([tw, td, rot]) => {
      if (!(tw >= rw && td >= rd && (tw - rw) + (td - rd) <= 26)) return;
      // round2: a max-mode room's fractional depth otherwise floats the cut
      // into 10.869999… everywhere it prints
      const cut = round2((tw - rw) + (td - rd));
      const cand = { tray, tw, td, rot, cut, deep: tw - rw > 6 || td - rd > 6, kind: cut === 0 ? "exact" : "cut", miss: 0 };
      if (x0 || y0) { cand.x0 = x0; cand.y0 = y0; }
      if (tray.drain !== "linear") {
        const mx = tw / 2, my = tray.drain === "offset" ? td * 0.27 : td / 2;
        // placed in the tray's reduced room, carried in ROOM coords (+x0/y0)
        cand.dx = round2(place(mx, tw - rw, rw, pinX) + x0);
        cand.dy = round2(place(my, td - rd, rd, pinY) + y0);
        cand.cutL = round2(Math.min(Math.max(mx - (cand.dx - x0), 0), tw - rw));
        cand.cutB = round2(Math.min(Math.max(my - (cand.dy - y0), 0), td - rd));
        if (pinned) {
          cand.pinned = true;
          if (centered) cand.centered = true;
          cand.miss = round2(Math.hypot(pinX != null ? (cand.dx - x0) - pinX : 0, pinY != null ? (cand.dy - y0) - pinY : 0));
        }
      } else if (pinned) {
        // an "any"-preference pin can meet a linear tray: its channel is a
        // fixed run at the back wall, so the miss is the pin's distance to
        // the nearest point on that run — never a free 0 that would let a
        // linear tray outrank a point tray actually chasing the pin
        cand.pinned = true;
        if (centered) cand.centered = true;
        cand.miss = round2(Math.hypot(
          pinX != null ? Math.min(Math.max(pinX, 4), rw - 4) - pinX : 0,
          pinY != null ? 2.75 - pinY : 0));
      }
      if (!best || (pinned ? cand.miss - best.miss || cand.cut - best.cut : cand.cut - best.cut) < 0) best = cand;
    });
    if (best) out.push(best);
  });
  out.sort((a, b) =>
    ((a.tray.drain === cfg.drain ? 0 : 1) - (b.tray.drain === cfg.drain ? 0 : 1)) ||
    (cfg.curbed === false ? (a.tray.thin ? 0 : 1) - (b.tray.thin ? 0 : 1) : 0) ||
    (pinned ? a.miss - b.miss : 0) ||
    a.cut - b.cut ||
    a.tray.price - b.tray.price);
  if (!out.length) return [{ kind: "mortar", cut: 0, deep: false }];
  return out.slice(0, 4);
}

// The membrane roll ladder: greedy largest roll for whole multiples, then the
// smallest single roll that covers the remainder (another largest when none
// is big enough). `rolls` arrive sorted by sf, already stock-narrowed.
function rollLadder(rolls, sfNeed) {
  if (!rolls.length) return [];
  const picks = [];
  const big = rolls[rolls.length - 1];
  let need = sfNeed;
  const nBig = Math.floor(need / big.sf);
  if (nBig > 0) { picks.push({ item: big, qty: nBig }); need -= nBig * big.sf; }
  if (need > 0) {
    const top = rolls.find((r) => r.sf >= need) || big;
    const existing = picks.find((p) => p.item === top);
    if (existing) existing.qty++; else picks.push({ item: top, qty: 1 });
  }
  return picks;
}

/**
 * Pick membrane rolls to cover sfNeed through the ladder above. "Wide"
 * rolls are excluded — they're a different-width product, reached only by a
 * membrane swap (resolveMembrane).
 */
export function pickRolls(sfNeed, cat, { source } = {}) {
  // stockPool, not a hard filter: with every roll special-order the membrane
  // role must still land (flagged), never vanish from the bill
  return rollLadder(stockPool(cat.filter((i) => i.g === "membrane" && !i.wide).sort((a, b) => a.sf - b.sf), source), sfNeed);
}

/**
 * The one stock-only pick rule (phase 4): under source "stock" a stocked
 * match wins, and when no stocked match exists the special-order match still
 * lands — the line's `so` flag says so, the build is never silently wrong.
 * Under "all" this is plain cat.find(pred), so defaults cannot move.
 */
/** A drain flange kit's pipe material and size, off its code (KD2FLKABS) or name. */
export function flangePipe(i) {
  const text = String((i && i.sku) || "") + " " + String((i && i.name) || "");
  const pipe = /ABS/i.test(text) ? "ABS" : /PVC/i.test(text) ? "PVC" : "";
  const size = +((/KD(\d)FLK/i.exec(text) || /(\d)\s*(?:"|in\b|″)/i.exec(i && i.name || "") || [])[1]) || 0;
  return { pipe, size };
}

export function pickFrom(cat, pred, { source } = {}) {
  if (source === "stock") {
    const stocked = cat.find((i) => pred(i) && i.stock);
    if (stocked) return stocked;
  }
  return cat.find(pred);
}

// Same rule for the ordered pools (channels, bands, curbs, panels,
// fasteners): stock-only narrows to the stocked rows when any exist,
// otherwise the whole pool stays so the pick can land flagged.
const stockPool = (list, source) =>
  source === "stock" && list.some((i) => i.stock) ? list.filter((i) => i.stock) : list;

// Whole-foot label when a dimension divides evenly, else inches — matches
// how the prototype's plan/cut-list labels a tray or curb length.
function inches(n) {
  return n % 12 === 0 ? n / 12 + "'" : n + '"';
}

// The 45° corner-cut leg, the wedi CORNER_CUT default. Deliberately
// duplicated in schluterdraw.js (the round2/inch precedent) — one number,
// not worth a cross-module reach.
const CORNER_CUT = 12;

// KERDI-BOARD-SC curb profile width on the plan — billing reads it too now
// (a corner diagonal is figured at its longest point, leg + width each way),
// so the number lives engine-side and schluterdraw imports it.
export const CURB_W = 4.5;

// Base walls plus any added runs (cfg.xwalls — entry returns, jogs): a wall
// is wall sf to the material bill whichever edge it sits on. `faces` is the
// wedi rule (round 6): "both" panels/membranes both sides of the run, and
// "in-end" adds the exposed end's strip a wall's own thickness wide.
export function wallArea(cfg) {
  const faceSf = (len, h, faces) =>
    (len * h * (faces === "both" ? 2 : 1) + (faces === "in-end" ? WALL_THICK * h : 0)) / 144;
  return cfg.walls.filter((w) => w.on).reduce((s, w) => s + faceSf(+w.len || 0, +w.h || 84, w.faces), 0)
    + (cfg.xwalls || []).reduce((s, x) => s + faceSf(+x.len || 0, +x.h || 84, x.faces), 0);
}

// What the entry walls leave open — the run the curb actually spans. Walls
// past the entry width can't narrow it below zero.
export function entryOpening(cfg) {
  const w = +cfg.w || 0;
  const walled = (cfg.xwalls || []).filter((x) => x.edge === "entry")
    .reduce((s, x) => s + Math.min(+x.len || 0, w), 0);
  return Math.max(0, w - walled);
}

// ---------------------------------------------------------------------------
// Open edges — where the curb actually runs (round 6, the wedi curbRuns
// rule): every span of the room's perimeter no wall covers carries curb, not
// just the entry. Base walls anchor at their low end (back at the left,
// sides at the back); xwalls at whichever end their `at` says. A cut corner
// adjacent to open runs re-routes the curb as ONE diagonal: each touching
// run gives up the 12" leg and the diagonal piece is figured at its longest
// point (leg + curb width each way). Billing and the drawings both read this
// so they can't drift.
const EDGE_DEFS = [["back", "w"], ["left", "d"], ["right", "d"], ["entry", "w"]];

function edgeSpans(cfg) {
  const w = +cfg.w || 0, d = +cfg.d || 0;
  const spans = { back: [], left: [], right: [], entry: [] };
  const put = (edge, at, len, max) => {
    const l = Math.min(+len || 0, max);
    if (l > 0.01) spans[edge].push(at === "hi" ? [round2(max - l), max] : [0, round2(l)]);
  };
  const SIDE = ["back", "left", "right"];
  (cfg.walls || []).forEach((bw, i) => {
    if (bw && bw.on) put(SIDE[i], "lo", bw.len, i === 0 ? w : d);
  });
  (cfg.xwalls || []).forEach((x) => {
    const edge = ["back", "left", "right", "entry"].includes(x.edge) ? x.edge : "entry";
    put(edge, x.at === "hi" ? "hi" : "lo", x.len, edge === "back" || edge === "entry" ? w : d);
  });
  Object.keys(spans).forEach((k) => {
    const merged = [];
    spans[k].sort((a, b) => a[0] - b[0]).forEach(([a, b]) => {
      const last = merged[merged.length - 1];
      if (last && a <= last[1] + 0.01) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    });
    spans[k] = merged;
  });
  return spans;
}

export function openRuns(cfg) {
  const w = +cfg.w || 0, d = +cfg.d || 0;
  const spans = edgeSpans(cfg);
  const edges = [];
  EDGE_DEFS.forEach(([side, dim]) => {
    const max = dim === "w" ? w : d;
    if (!(max > 0)) return;
    let at = 0;
    const runs = [];
    spans[side].forEach(([a, b]) => { if (a - at > 0.5) runs.push([at, a]); at = Math.max(at, b); });
    if (max - at > 0.5) runs.push([at, max]);
    runs.forEach(([a, b]) => edges.push({ side, from: round2(a), len: round2(b - a) }));
  });
  // which end of which edges each corner sits on, and whether a wall claims it
  const atLo = (side) => !!(spans[side][0] && spans[side][0][0] <= 0.5);
  const atHi = (side, max) => spans[side].some((sp) => sp[1] >= max - 0.5);
  const CORNERS = {
    bl: { h: ["back", "lo"], v: ["left", "lo"], walled: () => atLo("back") && atLo("left") },
    br: { h: ["back", "hi"], v: ["right", "lo"], walled: () => atHi("back", w) && atLo("right") },
    fl: { h: ["entry", "lo"], v: ["left", "hi"], walled: () => atLo("entry") && atHi("left", d) },
    fr: { h: ["entry", "hi"], v: ["right", "hi"], walled: () => atHi("entry", w) && atHi("right", d) },
  };
  const runAt = (side, end) => {
    const max = side === "left" || side === "right" ? d : w;
    return edges.find((e) => e.side === side && (end === "lo" ? e.from <= 0.5 : e.from + e.len >= max - 0.5)) || null;
  };
  // which end of its edge each corner sits on — trims come off that end
  const LO_CORNER = { back: "bl", left: "bl", right: "br", entry: "fl" };
  const diags = [];
  (cfg.corners || []).filter((k) => CORNERS[k] && !CORNERS[k].walled()).sort().forEach((k) => {
    const c = CORNERS[k];
    const rh = runAt(...c.h), rv = runAt(...c.v);
    if (!rh && !rv) return;
    const h = Math.min(CORNER_CUT, w), v = Math.min(CORNER_CUT, d);
    diags.push({ corner: k, h: round2(h), v: round2(v), len: round2(Math.hypot(h, v)), cut: round2(Math.hypot(h + CURB_W, v + CURB_W)) });
    // each touching run gives up the leg so nothing is stranded behind the cut
    [[rh, h], [rv, v]].forEach(([r, leg]) => {
      if (!r) return;
      const t = Math.min(leg, r.len);
      r._trim = r._trim || [0, 0];
      if (LO_CORNER[r.side] === k) r._trim[0] = Math.max(r._trim[0], t);
      else r._trim[1] = Math.max(r._trim[1], t);
    });
  });
  const segs = edges
    .map((e) => {
      const [t0, t1] = e._trim || [0, 0];
      return { side: e.side, from: round2(e.from + t0), len: round2(e.len - t0 - t1), ext0: 0, ext1: 0 };
    })
    .filter((e) => e.len > 0.5);
  const need = round2(segs.reduce((s, e) => s + e.len, 0) + diags.reduce((s, x) => s + x.cut, 0));
  return { segs, diags, need };
}

// ---------------------------------------------------------------------------
// KERDI-BOARD wall panel planner (round 7) — the shared course planner
// (panelplan.js, the wedi doctrine) over the LIVE registry board range
// (ADR 0032: no transcribed sheet table).

// The one wall-panel pool Fit and One-size both pick from: ½" boards only
// (thickMm keys it so a fatter live board can't sneak in), never the
// fastener boxes or the 2" bench stock.
export const halfBoardPool = (cat, source) =>
  stockPool(cat.filter((i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf
    && (i.thickMm == null || i.thickMm <= 13)), source);

// The sheet ladder the planner works from — one entry per distinct size,
// stocked-then-cheapest winning a size carried twice. w is the course height
// (the side that stacks), len the run length.
export function boardSheets(cat, { source } = {}) {
  const seen = {};
  return halfBoardPool(cat, source)
    .filter((i) => i.bw > 0 && i.bl > 0)
    .slice().sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || (+a.price || 0) - (+b.price || 0))
    .filter((i) => { const k = i.bw + "x" + i.bl; if (seen[k]) return false; seen[k] = true; return true; })
    .map((i) => ({ sku: i.sku, w: i.bw, len: i.bl, price: +i.price || 0 }))
    .sort((a, b) => b.w - a.w || b.len - a.len);
}

// The planner sees each covered FACE as its own wall (the wedi
// expandWallFaces rule): base walls then xwalls in schluterWalls' own order —
// the extra faces append AFTER, so a caller indexing detail[i] by drawn wall
// still lines up — "both" adds the outside plane, "in-end" the WALL_THICK
// end strip.
export function expandBoardFaces(cfg) {
  const SIDE = ["back", "left", "right"];
  const faces = [];
  (cfg.walls || []).forEach((w, i) => {
    if (w && w.on) faces.push({ len: +w.len || 0, h: +w.h || 84, side: SIDE[i], faces: w.faces });
  });
  (cfg.xwalls || []).forEach((x) => {
    if (+x.len > 0) faces.push({ len: +x.len, h: +x.h || 84, side: x.edge, faces: x.faces });
  });
  const n = faces.length;
  for (let i = 0; i < n; i++) {
    const w = faces[i];
    if (w.faces === "both") faces.push({ len: w.len, h: w.h, side: w.side, face: "out" });
    else if (w.faces === "in-end") faces.push({ len: WALL_THICK, h: w.h, side: w.side, face: "end" });
  }
  return faces;
}

/**
 * The Fit plan: expanded wall faces in, { lines: [{sku, qty}], vSeams,
 * courses, detail } out — detail index-aligned with the input.
 */
export function boardPlan(faces, cat, { source } = {}) {
  const sheets = boardSheets(cat, { source }).map((s) => ({ ...s, key: s.sku, price: s.price || s.w * s.len / 144 }));
  const p = planPanels(faces, sheets);
  return { ...p, lines: p.lines.map((l) => ({ sku: l.key, qty: l.qty })) };
}

/**
 * Build a Schluter shelf-kit bill of materials for one shower config.
 * Ported from the prototype's buildSchluter (pricelist-notes.md, owner
 * decisions 2026-08-20): both drain flange kits are self-contained — the KD
 * point/offset flange kit boxes the same 4 inside + 2 outside KERECK
 * corners and pipe/valve seals the Vario kit does (verified against the
 * retail listings 2026-08-24; the prototype's separate corner/seal lines
 * double-billed them) — so no build carries standalone corner/seal lines;
 * the Vario channel note enforces the 10" min cut;
 * curb multiples are cut end-to-end and note their own 2+2 corners;
 * membrane walls add 10% for laps plus a by-others backer note line;
 * board walls use 1.05× coverage plus 100-count fasteners per 60 sf;
 * ALL-SET at ceil((wallSf+floorSf)/sfPerBag); KERDI-FIX ×1; a curbless
 * build gets the ramp instead of a curb; benches follow decision 4
 * (framed -> ½" wrap board, buildup -> 2× 2" board); a no-fit room falls
 * back to cfg.mortarItem at its own rate plus KERDI over the cured bed
 * (decision 2 — never a $0 by-installer line).
 */
const G_SLOT = { Base: "tray", Drain: "drainBody", Walls: "wallBoard", Seams: "seam", Curb: "curb", Setting: "setting", Extras: "extra" };

/** The shared slot (slots.js) a buildKit line fills: its catalog facts first, the bill group as the fallback. */
export function slotOf(g, i) {
  if (!i) return G_SLOT[g] || "extra";
  if (i.part === "flange") return "flange";
  if (i.part === "grate" || i.part === "cover") return "grate";
  if (i.part === "channel" || i.part === "body") return "drainBody";
  if (i.g === "membrane") return g === "Base" ? "tray" : "wallMembrane";
  if (i.g === "board") return g === "Extras" ? "bench" : "wallBoard";
  if (i.g === "seam") return i.corner || i.seal ? "corners" : "seam";
  if (i.g === "tray") return "tray";
  if (i.g === "curb") return "curb";
  if (i.g === "set") return "setting";
  if (i.extra === "niche") return "niche";
  if (i.extra === "bench" || i.extra === "benchkit") return "bench";
  return G_SLOT[g] || "extra";
}

// ---------------------------------------------------------------------------
// Added lines (ticket 158 Phase 1c): cfg.manual rows { sku, qty, g? } are
// parts with a hand-set qty — never a choice, so they don't re-fit the room.
// A row draws under its own bill group; an old row with no `g` files where
// the kit would bill that part.

export const BILL_GROUPS = ["Base", "Drain", "Walls", "Seams", "Curb", "Setting", "Extras"];
const SLOT_G = {
  tray: "Base", drainBody: "Drain", grate: "Drain", flange: "Drain", wallBoard: "Walls", wallMembrane: "Walls",
  seam: "Seams", corners: "Seams", curb: "Curb", setting: "Setting", niche: "Extras", bench: "Extras", extra: "Extras",
};

/** The bill group an added row draws under: its own `g`, else where the kit files the part. */
export const addedGroup = (row, item) => (BILL_GROUPS.includes(row && row.g) ? row.g : SLOT_G[slotOf(undefined, item)] || "Extras");

/** cfg.manual → bill lines, each flagged `manual` (the popup's "added" tag). */
export function addedLines(manual, cat) {
  const out = [];
  for (const m of manual || []) {
    const e = m && cat.find((i) => i.sku === m.sku);
    if (!e || !(m.qty > 0)) continue;
    const g = addedGroup(m, e);
    out.push({ g, item: e, qty: m.qty, so: !e.stock, manual: true, slot: slotOf(g, e) });
  }
  return out;
}

/** The qty of the added row for `sku` under group `g` (0 when there is none). */
export function addedQty(manual, g, sku, cat) {
  const e = cat.find((i) => i.sku === sku);
  const m = (manual || []).find((r) => r.sku === sku && addedGroup(r, e) === g);
  return m ? m.qty : 0;
}

/** An added row's qty set to `n` (0 removes it); rows are keyed by group + sku. */
export function setAddedQty(manual, g, sku, n, cat) {
  const e = cat.find((i) => i.sku === sku);
  const same = (m) => m.sku === sku && addedGroup(m, e) === g;
  const rest = (manual || []).filter((m) => !same(m));
  const at = (manual || []).findIndex(same);
  if (!(n > 0)) return rest;
  const row = { sku, qty: n, g };
  if (at < 0) return [...rest, row];
  return [...rest.slice(0, at), row, ...rest.slice(at)];
}

// What a "+" on each shared bill group (slots.js GROUPS) can add. Each part
// names the engine group `g` its rows store — the key the recipe, the added
// rows and the qty overrides already speak — and only offers parts whose slot,
// read under that `g`, lands back in the group that offered it. A stepped part
// opens the swap popover's rows without Auto; the rest are one-click lists.
const benchBoard = (i) => i.g === "board" && !i.fastener;
const plusPart = (grp, g, key, label, hit, stepped) => ({
  key, label, g, ...(stepped ? { stepped } : {}),
  ...(hit ? { hit: (i) => hit(i) && groupOf(slotOf(g, i)) === grp } : {}),
});
export const ADD_PARTS = {
  base: [plusPart("base", "Base", "tray", "Tray", (i) => i.g === "tray"), plusPart("base", "Base", "membrane", "Membrane", (i) => i.g === "membrane")],
  drain: [
    plusPart("drain", "Drain", "drain", "Drain", null, "drain"),
    plusPart("drain", "Drain", "grate", "Grate", (i) => i.part === "grate" || i.part === "cover"),
    plusPart("drain", "Drain", "body", "Body", (i) => i.part === "channel" || i.part === "body"),
    plusPart("drain", "Drain", "flange", "Flange", (i) => i.part === "flange"),
  ],
  curb: [plusPart("curb", "Curb", "curb", "Curb", (i) => i.g === "curb")],
  walls: [
    plusPart("walls", "Walls", "board", "Board", benchBoard),
    plusPart("walls", "Walls", "membrane", "Membrane", (i) => i.g === "membrane", "membrane"),
    plusPart("walls", "Walls", "fastener", "Fasteners", (i) => !!i.fastener),
  ],
  seams: [
    plusPart("seams", "Seams", "band", "Band", (i) => i.g === "seam" && !!i.lf, "band"),
    plusPart("seams", "Seams", "corners", "Corners & seals", (i) => i.g === "seam" && !i.lf),
  ],
  niches: [plusPart("niches", "Extras", "niche", "Niche", (i) => i.extra === "niche")],
  bench: [plusPart("bench", "Extras", "bench", "Bench", (i) => i.extra === "bench" || i.extra === "benchkit" || benchBoard(i))],
  setting: [plusPart("setting", "Setting", "setting", "Setting", (i) => i.g === "set")],
  extras: [plusPart("extras", "Extras", "other", "Other", (i) => i.g === "extra" || i.g === "kit")],
};

const DRAIN_ADD = (i) => (i.g === "drain" && i.part === "channel" && i.len) || (i.g === "line" && i.part === "body");

/**
 * The "+" parts a shared group (`grp`, slots.js) offers with this catalog — a
 * part with nothing to add never shows. A whole drain is a linear build's add
 * (`linear`); a point build's Drain "+" leads with the grate.
 */
export function addParts(grp, cat, { linear = true } = {}) {
  return (ADD_PARTS[grp] || []).filter((p) => (p.stepped === "drain" ? linear && cat.some(DRAIN_ADD) : cat.some(p.hit)));
}

/** The part an added line's ⇄ swaps within: the first of its shared group's parts whose rule matches it. */
export const addPartOf = (grp, item) => (ADD_PARTS[grp] || []).find((p) => p.hit && p.hit(item)) || null;

export const VARIO_DESIGN = { 3: "Square", 5: "Floral", 13: "Herringbone", 14: "Slant" };
const cheapestFirst = (list) => list.slice().sort((a, b) => a.len - b.len || a.price - b.price);

// Vario is cut to the pan's installed width (owner 2026-09-26), never an
// allowance off the wall; a channel can't be doubled like a curb, so a
// covering channel wins and a shorter one lands only when nothing covers,
// saying it runs short.
function resolveVario(c, panW, cat, source) {
  const all = cheapestFirst(cat.filter((i) => i.g === "drain" && i.part === "channel" && i.len));
  const want = all.filter((i) => (!c.design || i.design === c.design) && (!c.finish || i.finish === c.finish));
  const covering = (list) => stockPool(list.filter((i) => i.len >= panW), source)[0] || null;
  let ch = covering(want), subst = "";
  if (!ch && (c.design || c.finish)) {
    ch = covering(all);
    if (ch) subst = `${VARIO_DESIGN[c.design] || "that design"} not made at ${panW}" — ${VARIO_DESIGN[ch.design] || "another design"} used`;
  }
  if (!ch) ch = stockPool(all, source).slice(-1)[0] || null;
  const cut = ch && ch.len > panW ? `cut to ${panW}"`
    : ch && ch.len < panW ? `${panW}" run — the ${ch.len}" channel is the longest available, runs short`
      : "full pan width";
  const lines = [];
  if (ch) lines.push({ slot: "drainBody", item: ch, qty: 1, note: (subst ? subst + " · " : "") + cut + ' — min cut 10", IPC 2.5 gpm' });
  const fl = pickFrom(cat, (i) => i.g === "drain" && i.part === "flange" && i.drain === "linear", { source });
  if (fl) lines.push({ slot: "flange", item: fl, qty: 1, note: "incl. 4+2 corners, pipe + valve seals, couplings" });
  return { family: "vario", len: ch ? ch.len : 0, cut: panW, gap: 0, lines, ...(subst ? { subst } : {}) };
}

const STYLE_WORD = { solid: "Solid", perforated: "Perforated", lock: "Perforated with lock", floral: "Floral", curve: "Curve", pure: "Pure", tile: "Tile" };

// The candidate KERDI-LINE bodies (and their usable lengths) for one offset
// leg at a pan width — shared by resolveFixed and drainOptions' `fit` so the
// popover's "to N″" hint can never disagree with what actually bills.
function fixedBodies(offset, panW, cat) {
  const bodies = cat.filter((i) => i.g === "line" && i.part === "body" && !!i.offset === offset);
  const lens = [...new Set(bodies.map((b) => b.len))].filter((l) => l <= panW).sort((a, b) => b - a);
  return { bodies, lens };
}

function resolveFixed(c, panW, cat, source) {
  const offset = !!c.offset;
  const frameless = c.family === "frameless";
  const { bodies, lens } = fixedBodies(offset, panW, cat);
  const styleOk = (g) => (c.style === "lock" ? !!g.lock : !c.style || (g.style === c.style && !g.lock));
  const grates = cat.filter((g) => g.g === "line" && g.part === "grate" && (frameless
    ? g.frameless && !!g.offset === offset
    : !g.frameless && !offset && styleOk(g) && (!c.frame || g.frame === c.frame) && (!c.finish || (g.finish || "") === c.finish)));
  const pick = (list) => stockPool(list.slice().sort((a, b) => a.price - b.price), source)[0] || null;
  for (const L of lens) {
    const b = pick(bodies.filter((x) => x.len === L));
    const g = pick(grates.filter((x) => x.len === L));
    if (!b || !g) continue;
    const gap = panW - L;
    const why = L === lens[0] ? `longest that fits the ${panW}" pan`
      : `stepped down from ${lens[0]}" — ${frameless ? "frameless" : STYLE_WORD[c.style] || "this grate"} made to ${L}"`;
    return {
      family: c.family, len: L, gap, cut: 0,
      lines: [
        { slot: "drainBody", item: b, qty: 1, note: why },
        { slot: "grate", item: g, qty: 1, note: gap > 0 ? `fill ${gap}" at the ends` : "full pan width" },
      ],
    };
  }
  if (panW < 20) return { reason: `pan under 20"` };
  if (!bodies.length) return { reason: "no KERDI-LINE bodies in the books" };
  return { reason: `no ${frameless ? "frameless" : STYLE_WORD[c.style] || ""} grate matches a body length that fits` };
}

/**
 * A drain choice (the saved `cfg.drainPick`) → the drain lines for a pan of
 * width `panW`. No choice is Vario, today's default. A fixed or frameless
 * choice that can't be built falls back to Vario with the reason in `fallback`
 * and on the first line — never silently dropped.
 */
export function resolveDrain(choice, panW, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : { family: "vario" };
  if (c.family === "fixed" || c.family === "frameless") {
    const r = resolveFixed(c, panW, cat, source);
    if (r.lines) return r;
    const v = resolveVario({}, panW, cat, source);
    const fallback = `${c.family === "frameless" ? "frameless" : "fixed KERDI-LINE"} can't be made here: ${r.reason}`;
    if (v.lines[0]) v.lines[0] = { ...v.lines[0], note: `${fallback} — Vario used · ${v.lines[0].note}` };
    return { ...v, fallback };
  }
  return resolveVario(c, panW, cat, source);
}

// Schluter's own names (grate listings, TRENDLINE sheets); MBW is matte white, MGS matte black.
export const FINISH_LABEL = {
  EB: "Brushed stainless", EP: "Chrome", MBW: "Matte white", MGS: "Matte black",
  TSBG: "Greige", TSC: "Cream", TSDA: "Dark anthracite", TSG: "Pewter",
  TSI: "Ivory", TSOB: "Bronze", TSSG: "Stone grey",
};

/**
 * The drain popover's rows for a pan of width `panW`: every chip's `ok`
 * comes from resolving it through resolveDrain, so the popover can never
 * offer something the engine would then refuse. `fit` (ticket 158 R3) is the
 * longest KERDI-LINE body that fits the pan at the choice's offset leg — the
 * popup shows "to N″" on a style chip only when that style's own max is
 * shorter than it.
 */
export function drainOptions(choice, panW, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : { family: "vario" };
  const family = c.family === "fixed" || c.family === "frameless" ? c.family : "vario";
  const works = (ch) => { const r = resolveDrain(ch, panW, cat, { source }); return !r.fallback && !r.subst; };
  const families = [["vario", "Vario"], ["fixed", "Fixed"], ["frameless", "Frameless"]]
    .map(([key, label]) => ({
      key, label,
      // frameless can fit only through the offset body pair — the straight
      // body alone tells the chip nothing about that
      ok: key === "frameless" ? works({ family: key }) || works({ family: key, offset: true }) : works({ family: key }),
    }));
  let styles = [], frames = [], finishes = [];
  if (family === "vario") {
    const chans = cat.filter((i) => i.g === "drain" && i.part === "channel" && i.design);
    styles = [...new Set(chans.map((i) => i.design))].map((d) => ({ key: d, label: VARIO_DESIGN[d] || d, ok: works({ family, design: d }) }));
    finishes = [...new Set(chans.filter((i) => !c.design || i.design === c.design).map((i) => i.finish))]
      .map((f) => ({ key: f, label: FINISH_LABEL[f] || f, ok: works({ ...c, family, finish: f }) }));
  } else if (family === "fixed") {
    const grates = cat.filter((g) => g.g === "line" && g.part === "grate" && !g.frameless);
    const styleOf = (g) => (g.lock ? "lock" : g.style);
    styles = [...new Set(grates.map(styleOf))].map((s) => ({
      key: s, label: STYLE_WORD[s] || s, ok: works({ family, style: s }),
      max: Math.max(...grates.filter((g) => styleOf(g) === s).map((g) => g.len)),
    }));
    const inStyle = grates.filter((g) => !c.style || styleOf(g) === c.style);
    frames = [...new Set(inStyle.map((g) => g.frame).filter(Boolean))].map((f) => ({ key: f, ok: works({ ...c, family, frame: f }) }));
    finishes = [...new Set(inStyle.filter((g) => !c.frame || g.frame === c.frame).map((g) => g.finish).filter(Boolean))]
      .map((f) => ({ key: f, label: FINISH_LABEL[f] || f, ok: works({ ...c, family, finish: f }) }));
  } else {
    styles = [{ key: "straight", label: "Straight", ok: works({ family, offset: false }) },
      { key: "offset", label: "Offset", ok: works({ family, offset: true }) }];
  }
  const fit = fixedBodies(!!c.offset, panW, cat).lens[0] || 0;
  return { family, families, styles, frames, finishes, fit, result: resolveDrain(c, panW, cat, { source }) };
}

// ---------------------------------------------------------------------------
// Membrane and band choices (ticket 158 Phase 1b, ADR 0049): cfg.swaps.membrane
// = { wide, roll? } and cfg.swaps.band = { width, roll? } name a width and
// optionally a roll length — never a part — so the count re-fits the walls.

export const MEMBRANE_WIDTH = { standard: "Standard 1 m", wide: "Wide 2 m" };
// Schluter's own marketing rounding of the KERDI-BAND widths (mm → inch).
const BAND_W_IN = { 125: '5"', 185: '7-1/4"', 250: '10"' };
export const bandWidthLabel = (code) => BAND_W_IN[code] || `${Math.round((+code / 25.4) * 4) / 4}"`;

/**
 * A membrane choice → the wall rolls for `sfNeed`. No roll is the best-fit
 * mix within the width (the pickRolls ladder); a roll pins that length at
 * ⌈need ÷ roll sf⌉. A width or roll the books don't carry falls back and says
 * so in `subst` — never silently dropped.
 */
export function resolveMembrane(choice, sfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const inWidth = (wide) => cat.filter((i) => i.g === "membrane" && !!i.wide === wide).sort((a, b) => a.sf - b.sf);
  let rolls = inWidth(!!c.wide), subst = "";
  if (!rolls.length && c.wide) { rolls = inWidth(false); subst = "no wide roll in the books — standard used"; }
  if (c.roll && !subst) {
    const pinned = stockPool(rolls.filter((i) => i.roll === c.roll), source)[0];
    if (pinned) {
      const qty = Math.ceil(sfNeed / pinned.sf);
      return { lines: qty > 0 ? [{ item: pinned, qty }] : [] };
    }
    subst = `no ${c.roll} roll in the books — best fit used`;
  }
  const lines = rollLadder(stockPool(rolls, source), sfNeed);
  return subst ? { lines, subst } : { lines };
}

// A chip is special order when none of the rows it stands for is stocked.
const allSo = (list) => list.length > 0 && !list.some((i) => i.stock);
const rollWord = (code) => parseInt(code, 10) + " m";

/** The membrane popover's rows (Width → Roll), each chip's `next` the choice it drafts. */
export function membraneOptions(choice, sfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const result = resolveMembrane(c, sfNeed, cat, { source });
  const works = (ch) => { const r = resolveMembrane(ch, sfNeed, cat, { source }); return r.lines.length > 0 && !r.subst; };
  const mem = cat.filter((i) => i.g === "membrane");
  // what actually billed — a substituted width/roll falls back silently in
  // resolveMembrane, so the lit chip and the roll row follow the LANDED part,
  // never a stale choice the books don't carry (a subst always means the
  // roll itself reverted to auto — see resolveMembrane's roll-pin branch)
  const wide = result.lines[0] ? !!result.lines[0].item.wide : !!c.wide;
  const roll = result.subst ? null : c.roll || null;
  const widths = [false, true].map((w) => {
    const list = mem.filter((i) => !!i.wide === w);
    return { key: w ? "wide" : "standard", label: MEMBRANE_WIDTH[w ? "wide" : "standard"], ok: works({ wide: w }), so: allSo(list), on: w === wide, next: { wide: w } };
  });
  const inW = mem.filter((i) => !!i.wide === wide).sort((a, b) => a.sf - b.sf);
  const rolls = [
    { key: "auto", label: "Auto", ok: inW.length > 0, so: false, on: !roll, next: { wide } },
    ...[...new Set(inW.map((i) => i.roll))].map((r) => {
      const list = inW.filter((i) => i.roll === r);
      return { key: r, label: `${rollWord(r)} · ${list[0].sf} sf`, ok: works({ wide, roll: r }), so: allSo(list), on: roll === r, next: { wide, roll: r } };
    }),
  ];
  return { widths, rolls, result };
}

/**
 * A band choice → the KERDI-BAND line for `lfNeed`. No roll is today's rule
 * within the width — the shortest roll that covers, else multiples of the
 * longest; a roll pins that length at ⌈need ÷ roll lf⌉. No choice at all is
 * today's rule over every band.
 */
export function resolveBand(choice, lfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const all = cat.filter((i) => i.g === "seam" && i.lf).sort((a, b) => a.lf - b.lf);
  // no width chosen = the narrowest width carried (5″, Schluter's standard —
  // the KERDI-SHOWER-KIT band; owner 2026-09-27), never whatever row sorts first
  const narrowest = all.map((i) => i.width).filter(Boolean).sort((a, b) => a - b)[0];
  let pool = c.width ? all.filter((i) => i.width === c.width)
    : narrowest ? all.filter((i) => i.width === narrowest) : all, subst = "";
  if (!pool.length && c.width) { pool = all; subst = `no ${bandWidthLabel(c.width)} band in the books — another width used`; }
  if (c.roll && !subst) {
    const pinned = stockPool(pool.filter((i) => i.roll === c.roll), source)[0];
    if (pinned) return { lines: [{ item: pinned, qty: Math.max(1, Math.ceil(lfNeed / pinned.lf)) }] };
    subst = `no ${c.roll} roll in the books — best fit used`;
  }
  // when no single roll in the pool covers, multiples cover the need — a
  // stock-narrowed pool must never quietly land one short roll
  const bands = stockPool(pool, source);
  const band = bands.find((b) => b.lf >= lfNeed) || bands[bands.length - 1];
  const lines = band ? [{ item: band, qty: Math.max(1, Math.ceil(lfNeed / band.lf)) }] : [];
  return subst ? { lines, subst } : { lines };
}

/** The band popover's rows (Width → Roll), each chip's `next` the choice it drafts. */
export function bandOptions(choice, lfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const all = cat.filter((i) => i.g === "seam" && i.lf);
  const result = resolveBand(c, lfNeed, cat, { source });
  const works = (ch) => { const r = resolveBand(ch, lfNeed, cat, { source }); return r.lines.length > 0 && !r.subst; };
  const widthCodes = [...new Set(all.map((i) => i.width).filter(Boolean))].sort((a, b) => a - b);
  // what actually billed — a width the books don't carry falls back silently
  // in resolveBand, so the lit chip and the roll row follow the LANDED part,
  // never the stale choice
  const width = (result.lines[0] && result.lines[0].item.width) || null;
  const roll = result.subst ? null : c.roll || null;
  const widths = widthCodes.map((w) => ({
    key: w, label: bandWidthLabel(w), ok: works({ width: w }), so: allSo(all.filter((i) => i.width === w)), on: w === width, next: { width: w },
  }));
  const inW = all.filter((i) => !width || i.width === width).sort((a, b) => a.lf - b.lf);
  // Auto keeps "no choice" until a width is picked; a roll chip names the width it shows
  const validChoiceWidth = widthCodes.includes(c.width) ? c.width : null;
  const rolls = [
    { key: "auto", label: "Auto", ok: inW.length > 0, so: false, on: !roll, next: validChoiceWidth ? { width: validChoiceWidth } : {} },
    ...[...new Set(inW.map((i) => i.roll))].map((r) => {
      const list = inW.filter((i) => i.roll === r);
      return { key: r, label: `${rollWord(r)} · ${list[0].lf} lf`, ok: works({ width, roll: r }), so: allSo(list), on: roll === r, next: { ...(width ? { width } : {}), roll: r } };
    }),
  ];
  return { widths, rolls, result };
}

/**
 * A "+" on a membrane or band (Phase 1c): the swap popover's Width → Roll rows
 * without Auto — an added line is a real roll, not a re-fitting choice. A
 * draft with no roll (a width chip's `next`) lands on that width's first roll
 * that resolves; `item` is the roll it adds.
 */
export function addRollOptions(kind, choice, cat, { source } = {}) {
  const opts = kind === "membrane" ? membraneOptions : bandOptions;
  let c = choice && typeof choice === "object" ? choice : {};
  let o = opts(c, 1, cat, { source });
  if (!c.roll || o.result.subst) {
    const first = o.rolls.find((r) => r.key !== "auto" && r.ok) || o.rolls.find((r) => r.key !== "auto");
    if (first) { c = first.next; o = opts(c, 1, cat, { source }); }
  }
  return { widths: o.widths, rolls: o.rolls.filter((r) => r.key !== "auto"), choice: c, item: o.result.lines[0] ? o.result.lines[0].item : null };
}

/**
 * A "+" on the Drain group of a linear build (Phase 1c): the drain popover's
 * rows plus a Length row of the lengths the family comes in, in place of
 * fitting the pan. `choice.len` picks the length (the longest when unset; the
 * longest at or under it when not made, else the shortest); `len` is the
 * length that actually lands — a fixed body steps down to a length its grate
 * is made at. `lines` are the parts it adds, each qty 1 per drain.
 */
export function drainAddOptions(choice, cat, { source } = {}) {
  const c = { family: "vario", ...(choice && typeof choice === "object" ? choice : {}) };
  const lensOf = (ch) => (ch.family === "fixed" || ch.family === "frameless"
    ? cat.filter((i) => i.g === "line" && i.part === "body" && !!i.offset === !!ch.offset).map((i) => i.len)
    : cat.filter((i) => i.g === "drain" && i.part === "channel" && i.len).map((i) => i.len));
  const lens = [...new Set(lensOf(c))].sort((a, b) => a - b);
  const req = lens.includes(c.len) ? c.len
    : !(c.len > 0) ? lens[lens.length - 1] || 0
      : lens.filter((L) => L <= c.len).slice(-1)[0] || lens[0] || 0;
  const resolveAt = (L) => resolveDrain({ ...c, len: L }, L, cat, { source });
  const r = resolveAt(req);
  const len = !r.fallback && r.len ? r.len : req;
  const at = { ...c, len };
  const o = drainOptions(at, len, cat, { source });
  const lands = (L) => { const x = resolveAt(L); return !x.fallback && !x.subst && x.len === L; };
  const lengths = lens.map((L) => ({ key: String(L), label: L + '"', ok: lands(L), on: L === len, next: { ...at, len: L } }));
  return { ...o, lengths, len, choice: at, lines: o.result.lines };
}

/** A point grate's chip label — size, design and finish ("4″ floral, brushed"), not the row's "kit 4" floral brushed SS". */
export function pointGrateLabel(e) {
  const s = String((e && (e.desc || e.name)) || "").replace(/^schluter\s+(?:—\s*)?/i, "").replace(/^kerdi-drain\s+/i, "")
    .replace(/\b(grate|kit)\b/gi, "").replace(/\s+(brushed|polished)\s+(ss|stainless(\s+steel)?)\b/i, ", $1")
    .replace(/"/g, "″").replace(/\s{2,}/g, " ").trim();
  return s || (e && e.sku) || "";
}

// The framed-bench wrap pool — the ½" boards the wall pick draws from.
const wrapBoard = (i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf;

export function buildKit(cfg, cat, { source, pick } = {}) {
  const L = [];
  const add = (g, item, qty, note) => {
    if (item) L.push({ g, item, qty, note, so: !item.stock });
  };
  // cfg.swaps (round 9, the wedi swap-popover rule): a hand-picked part wins
  // its role over the recipe's own pick — grate finish, curb, the One-size
  // wall board — looked up by sku within the role so a stale sku falls back
  // to the recipe rather than landing the wrong kind of part.
  const swaps = cfg.swaps || {};
  const swapped = (sku, pred) => (sku ? cat.find((i) => i.sku === sku && pred(i)) : null);
  const benches = cfgBenches(cfg, cat);
  const cand = pick || trayCandidates(cfg, cat, { source })[0];

  if (cand.kind === "mortar") {
    const floorSfM = (cfg.w * cfg.d) / 144;
    // cfg.mortarItem is adapter-shaped ({name, price, cost, stock, sfPerBagAt15}) — the phase-3 adapter maps the Settings mortar into it
    const rate = cfg.mortarItem && Number(cfg.mortarItem.sfPerBagAt15);
    if (cfg.mortarItem && Number.isFinite(rate) && rate > 0) {
      add("Base", cfg.mortarItem, Math.max(1, Math.ceil(floorSfM / rate)),
        "no tray fits" + (source === "stock" ? " from stock" : "") + " — mortar bed, qty at the picked product's rate");
    } else {
      const note = "no tray fits" + (source === "stock" ? " from stock" : "") +
        (cfg.mortarItem && cfg.mortarItem.name
          ? ` — ${cfg.mortarItem.name} needs a coverage rate (sfPerBagAt15) from the adapter`
          : "");
      L.push({ g: "Base", item: { name: "Mortar bed — pick a mortar in Settings → Materials", price: 0, cost: 0, stock: true }, qty: 1, note, so: false, noteOnly: true });
    }
    for (const p of pickRolls(floorSfM * 1.15, cat, { source }))
      L.push({ g: "Base", item: p.item, qty: p.qty, note: "KERDI over the cured bed", so: !p.item.stock });
  } else {
    // a framed bench holds the tray short of the room whatever its trayFit —
    // the cut note says the TRAY's landed size, not the full room, and an
    // exact full-room fit still cuts at the bench face
    const troom = benchTrayRoom(benches, cfg);
    const held = troom.w < cfg.w || troom.d < cfg.d;
    add("Base", cand.tray, 1,
      (cand.tray.drain !== cfg.drain && cfg.drain === "offset" ? "centre-drain tray — offset size not made; " : "") +
      (cand.cut || held ? `cut down to ${inches(troom.w)}×${inches(troom.d)}` : "exact fit") +
      (held ? " — stops at the framed bench face" : ""));
  }

  // under an "any" preference the PICKED tray decides what drain gets
  // billed; a mortar-bed fallback has no tray, so the stated preference
  // stands (point when the preference itself is "any")
  const drain = cand.kind === "mortar"
    ? (cfg.drain === "any" ? "point" : cfg.drain)
    : cand.tray.drain;
  let drainFit = null;
  if (drain === "linear") {
    const r = resolveDrain(cfg.drainPick, benchTrayRoom(benches, cfg).w, cat, { source });
    for (const l of r.lines) add("Drain", l.item, l.qty, l.note);
    drainFit = { family: r.family, len: r.len, gap: r.gap };
  } else {
    // PVC is the house flange (owner 2026-09-30) — the book also stocks ABS,
    // cheaper, which the old first-match pick could land under a PVC note
    const isPoint = (i) => i.g === "drain" && i.part === "flange" && i.drain === "point";
    const fl = swapped(swaps.flange, isPoint)
      || pickFrom(cat, (i) => isPoint(i) && flangePipe(i).pipe === "PVC", { source })
      || pickFrom(cat, isPoint, { source });
    const fp = fl ? flangePipe(fl) : {};
    add("Drain", fl, 1, `bonded flange, ${fp.size || 2}" ${fp.pipe || "PVC"} — incl. 4+2 corners, pipe + valve seals`);
    add("Drain", swapped(swaps.grate, (i) => i.g === "drain" && i.part === "grate")
      || pickFrom(cat, (i) => i.g === "drain" && i.part === "grate", { source }), 1,
      "finish pick — tileable & floral stocked too");
  }

  const sf = wallArea(cfg);
  if (cfg.wallSys === "board") {
    // largest ½" panel wins the "One size" wall pick — same pool the Fit
    // planner draws from (halfBoardPool), so the two modes can't diverge
    const b = swapped(swaps.board, (i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf)
      || halfBoardPool(cat, source).slice().sort((x, y) => y.sf - x.sf)[0];
    add("Walls", b, b ? Math.ceil((sf * 1.05) / b.sf) : 0, `${sf.toFixed(0)} sf of wall`);
    // recipe density: one 100-ct box per 60 sf — scaled to the box actually
    // in the catalog so a 40-ct pack doesn't silently under-order
    const fast = swapped(swaps.fastener, (i) => i.fastener)
      || stockPool(cat.filter((i) => i.fastener).sort((x, y) => (y.ct || 0) - (x.ct || 0)), source)[0];
    const screws = (sf * 100) / 60;
    add("Walls", fast, fast ? Math.max(1, Math.ceil(fast.ct > 0 ? screws / fast.ct : sf / 60)) : 0, "board fasteners");
  } else {
    const mem = resolveMembrane(swaps.membrane, sf * 1.1, cat, { source });
    mem.lines.forEach((p, i) => add("Walls", p.item, p.qty, (i === 0 && mem.subst ? mem.subst + " · " : "") + `${sf.toFixed(0)} sf of wall`));
    L.push({
      g: "Walls",
      item: { name: "Cement board / drywall substrate", sku: "— by others", price: 0, cost: 0, stock: true },
      qty: 1, note: "membrane needs a backer", so: false, noteOnly: true,
    });
  }

  const lfNeed = (2 * (cfg.w + cfg.d)) / 12 + sf / 6;
  const band = resolveBand(swaps.band, lfNeed, cat, { source });
  for (const p of band.lines) add("Seams", p.item, p.qty, (band.subst ? band.subst + " · " : "") + "seams + tray perimeter");
  // KERECK corners + pipe/valve seals never land as their own lines: both
  // drain flange kits box them (KD point/offset like the Vario — their notes
  // say so), so separate packs would double-bill the shower

  // the curb runs every open edge, not just the entry (round 6, the wedi
  // rule): a wall turned off hands its edge to the curb, and a cut corner
  // adjacent to curb turns it diagonally at the piece's longest point
  const runs = openRuns(cfg);
  const opening = entryOpening(cfg);
  const cuts = runs.diags.length;
  if (cfg.curbed && runs.need > 0) {
    // stock-only prefers stocked multiples cut end-to-end over a covering
    // special-order curb (the P2 example: a SO 60" loses to 2× stocked 48")
    const curbs = stockPool(cat.filter((i) => i.g === "curb" && i.len).sort((a, b) => a.len - b.len), source);
    const c = swapped(swaps.curb, (i) => i.g === "curb" && i.len)
      || curbs.find((x) => x.len >= runs.need) || curbs[curbs.length - 1];
    const sideOpen = runs.segs.some((s) => s.side !== "entry");
    add("Curb", c, c ? Math.max(1, Math.ceil(runs.need / c.len)) : 0,
      c ? (c.len < runs.need ? "cut to length end-to-end"
        : sideOpen ? `runs the ${inches(runs.need)} of open edges`
          : opening < cfg.w ? `cut to the ${inches(opening)} entry opening` : "cut to entry width")
        + (cuts ? ` — turns ${cuts === 1 ? "a cut corner" : cuts + " cut corners"} diagonally` : "")
        + " — incl. 2+2 Kereck corners" : undefined);
  } else if (!cfg.curbed && cfg.ramp) {
    // opt-in (round 6): the ramp is an add-on chip's pick, never auto-billed —
    // recessing the subfloor needs no part
    add("Curb", pickFrom(cat, (i) => i.ramp, { source }), 1, '12" run, 1-1/4"→1/4" — ADA slope');
  }

  // decision 4's three bench forms, one line set per bench (cfg.benches; the
  // legacy cfg.bench flag arrives here as one back-wall bench via cfgBenches)
  benches.forEach((b, bi) => {
    const first = L.length;
    if (b.build === "premade") {
      add("Extras", cat.find((i) => i.sku === b.part), 1,
        b.kind === "corner" ? "premade corner bench on the finished tray" : "premade bench on the finished tray");
    } else if (b.build === "framed") {
      add("Extras", swapped(b.board, wrapBoard) || stockPool(cat.filter(wrapBoard).sort((x, y) => y.sf - x.sf), source)[0], 1,
        "framed bench — ½\" KERDI-BOARD wrap, framing by installer");
    } else {
      add("Extras", swapped(b.board, (i) => i.thick2) || pickFrom(cat, (i) => i.thick2, { source }), 2,
        '2" KERDI-BOARD build-up on the finished tray — top + face + supports');
    }
    // the popup's ⇄ writes a bench line's pick back onto cfg.benches[bi]
    for (let k = first; k < L.length; k++) L[k].bench = bi;
  });

  const floorSf = (cfg.w * cfg.d) / 144;
  const allset = pickFrom(cat, (i) => i.sfPerBag, { source });
  add("Setting", allset, allset ? Math.max(1, Math.ceil((sf + floorSf) / allset.sfPerBag)) : 0, "sets membrane/board");
  // KERDI-FIX left the standing recipe (owner 2026-08-24): it rides the tub
  // kit, not every shower — the popup offers it as an add-on chip instead

  for (const l of L) l.slot = slotOf(l.g, l.item);
  return { lines: L, cand, drainFit, need: { wallSf: sf * 1.1, bandLf: lfNeed } };
}

// Re-derive the billed kit from a saved marker / staged basket entry
// ({ mode, cfg } — cfg is the popup's markCfg, so it carries manual/source/
// pick too). The basket drawer prices staged and placed kits through this;
// the caller owns the board Fit plan and the tier lens. cfg.pick keeps the
// QUOTED tray picked (the markCfg doctrine — never whatever ranks first
// today); a pick the catalog no longer knows falls back to rank 1. Null when
// there's no room, no rows, or nothing fits.
export function buildFromMarker(marker, cat) {
  const cfg = marker && marker.cfg;
  if (!cfg || !(cfg.w > 0 && cfg.d > 0) || !(cat || []).length) return null;
  const source = cfg.source === "stock" ? "stock" : "all";
  const cands = trayCandidates(cfg, cat, { source });
  const pick = (cfg.pick && cands.find((c) => c.tray && c.tray.sku === cfg.pick)) || cands[0] || null;
  if (!pick) return null;
  const b = buildKit(cfg, cat, { source, pick });
  b.lines.push(...addedLines(cfg.manual, cat));
  return { ...b, pick };
}

/**
 * Sum a build's material cost: priceFn(item) is the per-unit rate for
 * whatever pricing tier the caller wants (retail, cost×multiplier, …) —
 * this module has no pricing-tier opinion of its own.
 */
export function linesTotal(lines, priceFn) {
  return lines.reduce((s, l) => s + priceFn(l.item) * l.qty, 0);
}

// ============================================================================
// pricing lens
// ============================================================================

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Tier lens over a classified catalog entry (owner-decided pricing, task 5):
 * retail is the stocked row's own `price`, or `cost × 1.5` for a special-order
 * row (a factory kit has no shelf price of its own); builder is retail less
 * `builderPct` (Settings' `pricing.schluterBuilderPct`, default 8); cost is
 * the raw `cost` field. Mirrors wedi.js's own tierPrice shape.
 */
export function tierPrice(entry, tier, { builderPct } = {}) {
  if (!entry) return 0;
  const cost = +entry.cost || 0;
  const retail = entry.stock ? +entry.price || 0 : round2(cost * 1.5);
  switch (tier) {
    case "cost": return round2(cost);
    case "builder": return round2(retail * (1 - (builderPct == null ? 8 : builderPct) / 100));
    default: return round2(retail);
  }
}

// ============================================================================
// product-row payloads
// ============================================================================

// The wedi lead idiom: a classified entry whose name doesn't already say a
// Schluter family word gets the vendor in front. A non-classified item (the
// Settings mortar pick) is not necessarily Schluter goods, so it never leads.

/**
 * "Copy for order entry" (round 8, the wedi rule): stocked lines key as the
 * shop's SKU ⇥ qty — the ERP's fastest entry — and special-order lines go by
 * description, since they have no shop code to key. noteOnly lines (by-others
 * placeholders) never reach the clipboard.
 */
export function orderCopyLines(lines) {
  return (lines || []).filter((l) => !l.noteOnly).map((l) =>
    l.item.stock
      ? (l.item.erp || l.item.sku || "") + "\t" + l.qty
      : (l.item.sku ? l.item.sku + " — " : "") + [l.item.size, l.item.name].filter(Boolean).join(" ") + " × " + l.qty);
}

/**
 * Turn a build into product-row payloads ready for the job sheet, the
 * wedi-shaped signature (wedi.js lineItems, requirement 12): the popup
 * composes { ...buildKit(...), mode, cfg } and passes it whole. noteOnly
 * lines (informational, $0 by-others placeholders) are dropped, and every
 * surviving line lands RETAIL — the job sheet's own tier lens reprices it
 * (ADR 0018) — with a builder-tier `tierPrice` snapshot riding along, like
 * wedi's own Builder stamp. `build.cfg` is the room configuration buildKit()
 * was given; it lands untouched on the anchor row so "Schluter — reconfigure"
 * can re-run buildKit(cfg, …) and replace the kit's lines; `build.mode`
 * ("kit" for an untouched Kits-tab pick, else "custom") rides beside it.
 * Every companion line carries { part: true } instead.
 */
export function lineItems(build, opts) {
  if (!build || !build.lines) return [];
  opts = opts || {};
  const mark = { mode: build.mode === "kit" ? "kit" : "custom", cfg: JSON.parse(JSON.stringify(build.cfg || {})) };
  return build.lines.filter((l) => !l.noteOnly).map((l, i) => {
    const e = l.item;
    return {
      type: "misc",
      // live registry rows are not fixture-shaped — a stock row may carry its shop number in sku with no erp field
      sku: e.stock ? e.erp || e.sku || "" : "",
      sizeText: e.size || "",
      brandColor: e.name || "",
      qtyType: "count",
      qty: String(l.qty),
      priceSqft: String(tierPrice(e, "retail", {})),
      costSqft: String(tierPrice(e, "cost", {})),
      markupPct: "",
      tierPrice: String(tierPrice(e, "builder", opts)),
      schluter: i === 0 ? { ...mark, key: e.sku } : { part: e.sku },
    };
  });
}

// A stepped line's override key — the group and the sku, because one part
// can sit in two groups of a build (a board in Walls and in Extras).
export const ovKey = (l) => l.g + "|" + (l.item.sku || l.item.name);

// Swap a build's by-area panel line for the board plan's per-sheet lines, in
// place (the fastener line stays — its count is pure area either way). The
// first plan line carries the wedi note: sf, seam count, stood-vertical
// count; the rest read "panel plan".
export function applyBoardPlan(lines, cfg, plan, cat) {
  if (!plan || !plan.lines.length) return lines;
  const vWalls = plan.detail.filter((d2) => d2.vertical).length;
  const sf = wallArea(cfg);
  const planLines = plan.lines.map((pl, i) => {
    const e = cat.find((x) => x.sku === pl.sku);
    return e && {
      g: "Walls", item: e, qty: pl.qty, so: !e.stock, slot: "wallBoard",
      note: i === 0
        ? sf.toFixed(0) + " sf — " + plan.vSeams + " vertical seam" + (plan.vSeams === 1 ? "" : "s")
          + (vWalls ? " · " + vWalls + " wall" + (vWalls === 1 ? "" : "s") + " stood vertical" : "")
        : "panel plan",
    };
  }).filter(Boolean);
  if (!planLines.length) return lines;
  // an added board is a hand-set part, not the kit's panel line — it stays
  const kitBoard = (l) => l.g === "Walls" && l.item.g === "board" && !l.item.fastener && !l.manual;
  const idx = lines.findIndex(kitBoard);
  const out = lines.filter((l) => !kitBoard(l));
  out.splice(idx >= 0 ? idx : out.length, 0, ...planLines);
  return out;
}

// A stepped quantity keeps winning over the recipe's figure while the line
// survives; stepped to 0 the line leaves the bill (the wedi rule).
export const applyQtyOv = (lines, ov) => lines.map((l) => {
  const q = l.noteOnly || l.manual ? null : ov[ovKey(l)];
  return q == null ? l : { ...l, autoQty: l.qty, qty: q, ov: true };
}).filter((l) => l.noteOnly || l.qty > 0);

// Which catalog entry a placed project row is: the sku its marker carries
// (lineItems stamps every line since 2026-09-02), else the shop number a
// stocked line lands as its sku (a legacy `part: true` row). Null for a row
// that is not a Schluter kit line at all.
export function rowItemEntry(row, cat) {
  const m = row && row.schluter;
  if (!m || !(cat || []).length) return null;
  const direct = typeof m.part === "string" ? m.part : typeof m.key === "string" ? m.key : "";
  return (direct && cat.find((e) => e.sku === direct))
    || (row.sku && cat.find((e) => e.sku === row.sku || e.erp === row.sku)) || null;
}

// The session a placed kit's rows imply, so Reconfigure reopens on what the
// sheet says rather than the recipe's figures (owner 2026-09-02; wedi.js's
// sessionFromRows, in this engine's shapes): `lines` is the kit rebuilt from
// its marker with the board plan applied. A line whose rows total differently
// takes that total as its override (ovKey), a line with no row left steps to
// 0, and a row the build doesn't produce is a manual extra { sku, qty }. A
// blank qty is "not said". When no row resolves the session stays empty
// rather than zeroing the kit. The marker's own added lines (`manual`) are
// taken off each total first, so only a kit line's hand-set qty becomes an
// override and a placed added line never bills twice (Phase 1c).
export function sessionFromRows(lines, rows, cat) {
  const qtyOv = {}, manual = [];
  const totals = new Map(), present = new Set();
  for (const r of rows || []) {
    const e = rowItemEntry(r, cat);
    if (!e) continue;
    present.add(e.sku);
    if (String(r.qty ?? "").trim() === "") continue;
    totals.set(e.sku, (totals.get(e.sku) || 0) + (Number(r.qty) || 0));
  }
  if (!present.size) return { qtyOv, manual };
  const want = new Map(), added = new Map();
  for (const l of lines || []) {
    if (l.noteOnly || !l.item) continue;
    const sku = l.item.sku;
    if (l.manual) { added.set(sku, (added.get(sku) || 0) + l.qty); continue; }
    if (!want.has(sku)) want.set(sku, { qty: 0, line: l });
    want.get(sku).qty += l.qty;
  }
  for (const [sku, w] of want) {
    const raw = totals.has(sku) ? totals.get(sku) : present.has(sku) ? null : 0;
    const have = raw == null ? null : Math.max(0, raw - (added.get(sku) || 0));
    if (have == null || have === w.qty) continue;
    qtyOv[ovKey(w.line)] = have;
  }
  for (const [sku, q] of added) if (!want.has(sku) && totals.has(sku)) totals.set(sku, Math.max(0, totals.get(sku) - q));
  for (const [sku, q] of totals) if (!want.has(sku) && q > 0) manual.push({ sku, qty: q });
  return { qtyOv, manual };
}
