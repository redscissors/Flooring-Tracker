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

/**
 * Classify a raw item list into a catalog: classified entries only,
 * non-shower rows (classify() -> null) dropped.
 */
export function catalogOf(items) {
  return items.map(classify).filter(Boolean);
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
 */
export function trayCandidates(cfg, cat, { source } = {}) {
  const pool = cat.filter((i) => i.g === "tray" && (source === "all" || i.stock) &&
    (cfg.drain === "linear" ? i.drain === "linear"
     : cfg.drain === "offset" ? i.drain !== "linear"
     : i.drain === "point"));
  const fits = (t) => t.w >= cfg.w && t.d >= cfg.d && (t.w - cfg.w) + (t.d - cfg.d) <= 26;
  const out = pool.filter(fits).map((tray) => {
    const cut = (tray.w - cfg.w) + (tray.d - cfg.d);
    return { tray, cut, deep: tray.w - cfg.w > 6 || tray.d - cfg.d > 6, kind: cut === 0 ? "exact" : "cut" };
  });
  out.sort((a, b) =>
    ((a.tray.drain === cfg.drain ? 0 : 1) - (b.tray.drain === cfg.drain ? 0 : 1)) ||
    (cfg.curbed === false ? (a.tray.thin ? 0 : 1) - (b.tray.thin ? 0 : 1) : 0) ||
    a.cut - b.cut ||
    a.tray.price - b.tray.price);
  if (!out.length) return [{ kind: "mortar", cut: 0, deep: false }];
  return out.slice(0, 4);
}

/**
 * Pick membrane rolls to cover sfNeed: greedy largest roll for whole
 * multiples, then the smallest single roll that covers the remainder
 * (falling back to another largest roll if none is big enough). "Wide"
 * rolls (name contains "wide") are excluded — they're a different-width
 * product, not a drop-in size option on this ladder.
 */
export function pickRolls(sfNeed, cat, { source } = {}) {
  const rolls = cat.filter((i) => i.g === "membrane" && !/wide/i.test(i.name) && (source === "all" || i.stock))
    .sort((a, b) => a.sf - b.sf);
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

// Whole-foot label when a dimension divides evenly, else inches — matches
// how the prototype's plan/cut-list labels a tray or curb length.
function inches(n) {
  return n % 12 === 0 ? n / 12 + "'" : n + '"';
}

function wallArea(cfg) {
  return cfg.walls.filter((w) => w.on).reduce((s, w) => s + (w.len * w.h) / 144, 0);
}

/**
 * Build a Schluter shelf-kit bill of materials for one shower config.
 * Ported from the prototype's buildSchluter (pricelist-notes.md, owner
 * decisions 2026-08-20): factory-kit corner counts on point/offset builds
 * (2× inside packs + 1× outside pack = 4 inside + 2 outside corners); the
 * Vario flange kit is self-contained (a linear build carries no separate
 * corner/seal lines); the Vario channel note enforces the 10" min cut;
 * curb multiples are cut end-to-end and note their own 2+2 corners;
 * membrane walls add 10% for laps plus a by-others backer note line;
 * board walls use 1.05× coverage plus 100-count fasteners per 60 sf;
 * ALL-SET at ceil((wallSf+floorSf)/sfPerBag); KERDI-FIX ×1; a curbless
 * build gets the ramp instead of a curb; benches follow decision 4
 * (framed -> ½" wrap board, buildup -> 2× 2" board); a no-fit room falls
 * back to cfg.mortarItem at its own rate plus KERDI over the cured bed
 * (decision 2 — never a $0 by-installer line).
 */
export function buildKit(cfg, cat, { source, pick } = {}) {
  const L = [];
  const add = (g, item, qty, note) => {
    if (item) L.push({ g, item, qty, note, so: !item.stock });
  };
  const cand = pick || trayCandidates(cfg, cat, { source })[0];

  if (cand.kind === "mortar") {
    const floorSfM = (cfg.w * cfg.d) / 144;
    if (cfg.mortarItem) {
      add("Base", cfg.mortarItem, Math.max(1, Math.ceil(floorSfM / cfg.mortarItem.sfPerBagAt15)),
        "no tray fits" + (source === "stock" ? " from stock" : "") + " — mortar bed, qty at the picked product's rate");
    } else {
      L.push({ g: "Base", item: { name: "Mortar bed — pick a mortar in Settings → Materials", price: 0, cost: 0, stock: true }, qty: 1, note: "no tray fits" + (source === "stock" ? " from stock" : ""), so: false, noteOnly: true });
    }
    for (const p of pickRolls(floorSfM * 1.15, cat, { source }))
      L.push({ g: "Base", item: p.item, qty: p.qty, note: "KERDI over the cured bed", so: !p.item.stock });
  } else {
    add("Base", cand.tray, 1,
      (cand.tray.drain !== cfg.drain && cfg.drain === "offset" ? "centre-drain tray — offset size not made; " : "") +
      (cand.cut ? `cut down to ${inches(cfg.w)}×${inches(cfg.d)}` : "exact fit"));
  }

  if (cfg.drain === "linear") {
    const chans = cat.filter((i) => i.g === "drain" && i.part === "channel" && (source === "all" || i.stock))
      .sort((a, b) => a.len - b.len || a.price - b.price);
    const need = cfg.w - 8;
    const ch = chans.find((c) => c.len >= need) || chans[chans.length - 1];
    add("Drain", ch, 1, (ch && ch.len > need ? `cut to ${need}"` : "at the wall") + ' — min cut 10", IPC 2.5 gpm');
    add("Drain", cat.find((i) => i.g === "drain" && i.part === "flange" && i.drain === "linear"), 1,
      "incl. 4+2 corners, pipe + valve seals, couplings");
  } else {
    add("Drain", cat.find((i) => i.g === "drain" && i.part === "flange" && i.drain === "point"), 1,
      'bonded flange, 2" PVC');
    const grates = cat.filter((i) => i.g === "drain" && i.part === "grate" && (source === "all" || i.stock));
    add("Drain", grates[0], 1, "finish pick — tileable & floral stocked too");
  }

  const sf = wallArea(cfg);
  if (cfg.wallSys === "board") {
    const b = cat.find((i) => i.sf === 32 && i.g === "board");
    add("Walls", b, Math.ceil((sf * 1.05) / b.sf), `${sf.toFixed(0)} sf of wall`);
    add("Walls", cat.find((i) => i.g === "board" && i.size === "100 ct"), Math.max(1, Math.ceil(sf / 60)), "board fasteners");
  } else {
    for (const p of pickRolls(sf * 1.1, cat, { source })) add("Walls", p.item, p.qty, `${sf.toFixed(0)} sf of wall`);
    L.push({
      g: "Walls",
      item: { name: "Cement board / drywall substrate", sku: "— by others", price: 0, cost: 0, stock: true },
      qty: 1, note: "membrane needs a backer", so: false, noteOnly: true,
    });
  }

  const bands = cat.filter((i) => i.g === "seam" && i.lf).sort((a, b) => a.lf - b.lf);
  const lfNeed = (2 * (cfg.w + cfg.d)) / 12 + sf / 6;
  add("Seams", bands.find((b) => b.lf >= lfNeed) || bands[bands.length - 1], 1, "seams + tray perimeter");
  if (cfg.drain !== "linear") {
    add("Seams", cat.find((i) => /inside corner/i.test(i.name)), 2, "4 inside — factory kit recipe");
    add("Seams", cat.find((i) => /outside corner/i.test(i.name)), 1, "2 outside — factory kit recipe");
    add("Seams", cat.find((i) => /pipe seal/i.test(i.name)), 1);
    add("Seams", cat.find((i) => /valve seal/i.test(i.name)), 1);
  }

  if (cfg.curbed) {
    const curbs = cat.filter((i) => i.g === "curb" && i.len).sort((a, b) => a.len - b.len);
    const c = curbs.find((x) => x.len >= cfg.w && (source === "all" || x.stock)) || curbs[curbs.length - 1];
    add("Curb", c, Math.max(1, Math.ceil(cfg.w / c.len)),
      (c.len < cfg.w ? "cut to length end-to-end" : "cut to entry width") + " — incl. 2+2 Kereck corners");
  } else {
    add("Curb", cat.find((i) => i.ramp), 1, '12" run, 1-1/4"→1/4" — ADA slope');
  }

  if (cfg.bench === "framed") {
    add("Extras", cat.find((i) => i.g === "board" && i.sf === 32), 1,
      "framed bench — ½\" KERDI-BOARD wrap, framing by installer");
  } else if (cfg.bench === "buildup") {
    add("Extras", cat.find((i) => i.thick2), 2, '2" KERDI-BOARD build-up on the finished tray — top + face + supports');
  }

  const floorSf = (cfg.w * cfg.d) / 144;
  const allset = cat.find((i) => i.sfPerBag);
  add("Setting", allset, Math.max(1, Math.ceil((sf + floorSf) / allset.sfPerBag)), "sets membrane/board");
  add("Setting", cat.find((i) => /KERDI-FIX/.test(i.name)), 1);

  return { lines: L, cand };
}

/**
 * Sum a build's material cost: priceFn(item) is the per-unit rate for
 * whatever pricing tier the caller wants (retail, cost×multiplier, …) —
 * this module has no pricing-tier opinion of its own.
 */
export function linesTotal(lines, priceFn) {
  return lines.reduce((s, l) => s + priceFn(l.item) * l.qty, 0);
}
