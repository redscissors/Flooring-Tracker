// Schluter shower-system engine — table-free, registry-fed.
// Tasks 2 and 5 classify items and build the solver.
//
// classify() is a grammar over Schluter's SKU codes, not a per-item lookup:
// every field it derives comes from parsing the sku (and, for quantities the
// sku doesn't encode, the sheet's "size" text) against the patterns Schluter
// itself uses to build part numbers. The mm→inch table below is the one
// constant every tray/curb/board/kit SKU is built from.

// Marketing-rounded metric pair Schluter encodes into tray/board/kit SKUs.
const MM_IN = {
  810: 32, 915: 36, 965: 38, 1000: 39, 1220: 48,
  1395: 55, 1525: 60, 1830: 72, 1930: 76,
};

// Roll-size fallback table (used only when the sheet's "= N sf" text is
// missing) — 5M/7M/10M/12M/20M rolls, "plain" = the unsuffixed full roll.
const ROLL_SF = { 5: 54, 7: 75, 10: 108, 12: 128, 20: 215 };
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
// with "/" or not. w = the longer dimension, d = the shorter (matches the
// reference tagging: KST965/1525 -> w:60,d:38; KSLT965/1930S -> w:76,d:38).
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
  const text = item.size || item.name || "";
  const explicit = /=\s*([\d.]+)\s*sf/i.exec(text);
  if (explicit) return parseFloat(explicit[1]);
  const suffix = /\/(\d+)M/.exec(code);
  if (suffix && ROLL_SF[suffix[1]] !== undefined) return ROLL_SF[suffix[1]];
  return PLAIN_SF;
}

function bandLf(code) {
  const suffix = /\/(\d+)M$/.exec(code);
  if (suffix && BAND_LF[suffix[1]] !== undefined) return BAND_LF[suffix[1]];
  return BAND_LF_PLAIN;
}

// Board sf: prefer the sheet's "= N sf" text; otherwise compute from the
// dimension numbers in "size" (WxH, or thickness×W×H when three numbers are
// present — a leading 2 there means the 2"-thick board, thick2).
function boardDims(item) {
  const text = item.size || "";
  const out = {};
  const explicit = /=\s*([\d.]+)\s*sf/i.exec(text);
  if (explicit) out.sf = parseFloat(explicit[1]);
  const nums = [...text.matchAll(/([\d.]+)\s*"/g)].map((m) => parseFloat(m[1]));
  if (nums.length === 3) {
    if (nums[0] === 2) out.thick2 = true;
    // dims-derived sf (no sheet annotation on the 2" board); informational — bench build-up counts pieces, never area
    if (out.sf === undefined) out.sf = (nums[1] * nums[2]) / 144;
  } else if (nums.length === 2 && out.sf === undefined) {
    out.sf = (nums[0] * nums[1]) / 144;
  }
  return out;
}

/**
 * Classify a Schluter stock-book/EFT row into its shower-system role.
 * Returns the item spread plus { g, w?, d?, drain?, part?, sf?, lf?, len?,
 * sfPerBag?, ramp?, thin? }, or null for non-shower Schluter items (profiles,
 * Ditra, shelves…), which the configurator ignores.
 */
export function classify(item) {
  if (!item) return null;
  const raw = item.sku || item.name || "";
  // Distributor rows carry an "SLR" reseller prefix the mfg code doesn't have.
  const code = raw.trim().replace(/^SLR/, "");

  // KERDI-SHOWER-LTS: linear-drain tray. The trailing S here is part of the
  // "LTS" line name, not the offset-drain flag KST-line SKUs use.
  if (/^KSLT.*S$/.test(code)) {
    return { ...item, g: "tray", ...trayDims(code.replace(/^KSLT/, "").replace(/S$/, "")), drain: "linear" };
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

  // KERDI-LINE-VARIO linear-drain channel/flange.
  if (/^KLVR2FLK/.test(code)) {
    return { ...item, g: "drain", drain: "linear", part: "flange" };
  }
  if (/^KLVR/.test(code)) {
    const entry = { ...item, g: "drain", drain: "linear", part: "channel" };
    if (/122$/.test(code)) entry.len = 48;
    else if (/244$/.test(code)) entry.len = 96;
    return entry;
  }

  // KERDI-DRAIN: round point drain — flange kit or grate.
  if (/^KD/.test(code)) {
    const entry = { ...item, g: "drain", drain: "point" };
    if (/FLK/.test(code)) entry.part = "flange";
    else if (/GRK/.test(code)) entry.part = "grate";
    return entry;
  }

  // KERDI membrane rolls (incl. the KERDI200200 wide roll).
  if (/^KERDI200/.test(code)) {
    return { ...item, g: "membrane", sf: membraneSf(item, code) };
  }

  // KERDI-BAND seam band.
  if (/^KEBA/.test(code)) {
    return { ...item, g: "seam", lf: bandLf(code) };
  }
  // KERECK corners, KERDI-SEAL pipe/mixing-valve seals.
  if (/^KERECK/.test(code) || /^KMS/.test(code)) {
    return { ...item, g: "seam" };
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
  // KERDI-BOARD-SN niche, -SB bench, KERS-B bench corner kit.
  if (/^KB12SN/.test(code) || /^KBSB/.test(code) || /^KERSB/.test(code)) {
    return { ...item, g: "extra" };
  }
  // Every other KERDI-BOARD panel/accessory (KB12…, KB50…, screws, …).
  if (/^KB/.test(code)) {
    return { ...item, g: "board", ...boardDims(item) };
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
    return { ...item, g: "set" };
  }

  // KERDI-SHOWER-KIT factory kits (tray + curbs + membrane + band + flange +
  // corners + seals bundled under one SKU). SP = offset drain, else point.
  if (/^KSK/.test(code)) {
    return { ...item, g: "kit", ...trayDims(code), drain: code.includes("SP") ? "offset" : "point" };
  }

  return null;
}
