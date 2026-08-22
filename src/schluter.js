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

export { queryHit, parseQuery, querySummary, seedFromQuery };

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
  const text = item.size || item.name || item.description || "";
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
// present — a leading 2 there means the 2"-thick board, thick2). The mapped
// import writes a three-dim board's size BARE ("48x96", "24.5x96") with the
// thickness pulled into its own field (pricebook.js THREE_IN_RE), so a bare
// L×W with no inch marks is a panel too — without it every EFT board carries
// no sf and drops out of the wall pick.
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
  } else if (!nums.length && out.sf === undefined) {
    const bare = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(text);
    if (bare) out.sf = (parseFloat(bare[1]) * parseFloat(bare[2])) / 144;
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
  // A live registry row's own sku can be the shop's internal/ERP code, not
  // the Schluter grammar (ADR 0032 correction) — when that code matches
  // nothing, retry against vendorSkus[0], the manufacturer code the ERP
  // stock export carries separately (cheap floor; the phase-3 adapter does
  // this properly).
  return classifyCode(item, item.sku) ||
    (item.vendorSkus && item.vendorSkus[0] ? classifyCode(item, item.vendorSkus[0]) : null);
}

function classifyCode(item, rawSku) {
  const raw = rawSku || "";
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

  // KERDI membrane rolls; KERDI200200 is the wide roll — a different-width
  // product, flagged out of the pickRolls ladder.
  if (/^KERDI200/.test(code)) {
    const entry = { ...item, g: "membrane", sf: membraneSf(item, code) };
    if (/^KERDI200200/.test(code)) entry.wide = true;
    return entry;
  }

  // KERDI-BAND seam band.
  if (/^KEBA/.test(code)) {
    return { ...item, g: "seam", lf: bandLf(code) };
  }
  // KERECK corners (FI = inside, FA = outside), KERDI-SEAL pipe (KMS172) /
  // mixing-valve (KMSMV) seals. buildKit keys on these facts, never the row's
  // name — a live registry name is normOrderItem's cleaned (title-cased)
  // description, so name text is not a stable key.
  if (/^KERECK/.test(code)) {
    const entry = { ...item, g: "seam" };
    if (/\/FI/.test(code)) entry.corner = "inside";
    else if (/\/FA/.test(code)) entry.corner = "outside";
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
  // KERDI-BOARD-SN niche, -SB bench, KERS-B bench corner kit.
  if (/^KB12SN/.test(code) || /^KBSB/.test(code) || /^KERSB/.test(code)) {
    return { ...item, g: "extra" };
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
    const m = /^KB(\d{2})/.exec(code);
    if (m) {
      entry.thickMm = Number(m[1]);
      if (entry.thickMm >= 40) entry.thick2 = true;
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
  const pinX = Number.isFinite(+cfg.drainX) && +cfg.drainX > 0 ? +cfg.drainX : null;
  const pinY = Number.isFinite(+cfg.drainY) && +cfg.drainY > 0 ? +cfg.drainY : null;
  const pinned = cfg.drain !== "linear" && (pinX != null || pinY != null);
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
      if (!(tw >= cfg.w && td >= cfg.d && (tw - cfg.w) + (td - cfg.d) <= 26)) return;
      // round2: a max-mode room's fractional depth otherwise floats the cut
      // into 10.869999… everywhere it prints
      const cut = round2((tw - cfg.w) + (td - cfg.d));
      const cand = { tray, tw, td, rot, cut, deep: tw - cfg.w > 6 || td - cfg.d > 6, kind: cut === 0 ? "exact" : "cut", miss: 0 };
      if (tray.drain !== "linear") {
        const mx = tw / 2, my = tray.drain === "offset" ? td * 0.27 : td / 2;
        cand.dx = round2(place(mx, tw - cfg.w, cfg.w, pinX));
        cand.dy = round2(place(my, td - cfg.d, cfg.d, pinY));
        cand.cutL = round2(Math.min(Math.max(mx - cand.dx, 0), tw - cfg.w));
        cand.cutB = round2(Math.min(Math.max(my - cand.dy, 0), td - cfg.d));
        if (pinned) {
          cand.pinned = true;
          cand.miss = round2(Math.hypot(pinX != null ? cand.dx - pinX : 0, pinY != null ? cand.dy - pinY : 0));
        }
      } else if (pinned) {
        // an "any"-preference pin can meet a linear tray: its channel is a
        // fixed run at the back wall, so the miss is the pin's distance to
        // the nearest point on that run — never a free 0 that would let a
        // linear tray outrank a point tray actually chasing the pin
        cand.pinned = true;
        cand.miss = round2(Math.hypot(
          pinX != null ? Math.min(Math.max(pinX, 4), cfg.w - 4) - pinX : 0,
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

/**
 * Pick membrane rolls to cover sfNeed: greedy largest roll for whole
 * multiples, then the smallest single roll that covers the remainder
 * (falling back to another largest roll if none is big enough). "Wide"
 * rolls (name contains "wide") are excluded — they're a different-width
 * product, not a drop-in size option on this ladder.
 */
export function pickRolls(sfNeed, cat, { source } = {}) {
  // stockPool, not a hard filter: with every roll special-order the membrane
  // role must still land (flagged), never vanish from the bill
  const rolls = stockPool(cat.filter((i) => i.g === "membrane" && !i.wide).sort((a, b) => a.sf - b.sf), source);
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
 * The one stock-only pick rule (phase 4): under source "stock" a stocked
 * match wins, and when no stocked match exists the special-order match still
 * lands — the line's `so` flag says so, the build is never silently wrong.
 * Under "all" this is plain cat.find(pred), so defaults cannot move.
 */
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

// Base walls plus any added runs (cfg.xwalls — entry returns, jogs): a wall
// is wall sf to the material bill whichever edge it sits on.
function wallArea(cfg) {
  return cfg.walls.filter((w) => w.on).reduce((s, w) => s + (w.len * w.h) / 144, 0)
    + (cfg.xwalls || []).reduce((s, x) => s + ((+x.len || 0) * (+x.h || 84)) / 144, 0);
}

// What the entry walls leave open — the run the curb actually spans. Walls
// past the entry width can't narrow it below zero.
export function entryOpening(cfg) {
  const w = +cfg.w || 0;
  const walled = (cfg.xwalls || []).filter((x) => x.edge === "entry")
    .reduce((s, x) => s + Math.min(+x.len || 0, w), 0);
  return Math.max(0, w - walled);
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
    add("Base", cand.tray, 1,
      (cand.tray.drain !== cfg.drain && cfg.drain === "offset" ? "centre-drain tray — offset size not made; " : "") +
      (cand.cut ? `cut down to ${inches(cfg.w)}×${inches(cfg.d)}` : "exact fit"));
  }

  // under an "any" preference the PICKED tray decides what drain gets
  // billed; a mortar-bed fallback has no tray, so the stated preference
  // stands (point when the preference itself is "any")
  const drain = cand.kind === "mortar"
    ? (cfg.drain === "any" ? "point" : cfg.drain)
    : cand.tray.drain;
  if (drain === "linear") {
    // a channel can't be doubled like a curb: a stocked covering channel
    // wins, then a covering SO one (flagged), and only when nothing made
    // covers the run does a shorter channel land — saying it runs short
    const chansAll = cat.filter((i) => i.g === "drain" && i.part === "channel")
      .sort((a, b) => a.len - b.len || a.price - b.price);
    const chansStocked = stockPool(chansAll, source);
    const need = cfg.w - 8;
    const ch = chansStocked.find((c) => c.len >= need) || chansAll.find((c) => c.len >= need)
      || chansStocked[chansStocked.length - 1] || chansAll[chansAll.length - 1];
    add("Drain", ch, 1, (ch && ch.len > need ? `cut to ${need}"`
      : ch && ch.len < need ? `${need}" run — the ${ch.len}" channel is the longest available, runs short`
        : "at the wall") + ' — min cut 10", IPC 2.5 gpm');
    add("Drain", pickFrom(cat, (i) => i.g === "drain" && i.part === "flange" && i.drain === "linear", { source }), 1,
      "incl. 4+2 corners, pipe + valve seals, couplings");
  } else {
    add("Drain", pickFrom(cat, (i) => i.g === "drain" && i.part === "flange" && i.drain === "point", { source }), 1,
      'bonded flange, 2" PVC');
    add("Drain", pickFrom(cat, (i) => i.g === "drain" && i.part === "grate", { source }), 1,
      "finish pick — tileable & floral stocked too");
  }

  const sf = wallArea(cfg);
  if (cfg.wallSys === "board") {
    // largest ½" panel wins the wall pick (48×96 = 32 sf in today's range)
    // largest ½" panel wins — thickMm keys the thickness so a fatter live
    // board with more sf can't take the wall pick
    const b = stockPool(cat.filter((i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf
      && (i.thickMm == null || i.thickMm <= 13))
      .sort((x, y) => y.sf - x.sf), source)[0];
    add("Walls", b, b ? Math.ceil((sf * 1.05) / b.sf) : 0, `${sf.toFixed(0)} sf of wall`);
    // recipe density: one 100-ct box per 60 sf — scaled to the box actually
    // in the catalog so a 40-ct pack doesn't silently under-order
    const fast = stockPool(cat.filter((i) => i.fastener).sort((x, y) => (y.ct || 0) - (x.ct || 0)), source)[0];
    const screws = (sf * 100) / 60;
    add("Walls", fast, fast ? Math.max(1, Math.ceil(fast.ct > 0 ? screws / fast.ct : sf / 60)) : 0, "board fasteners");
  } else {
    for (const p of pickRolls(sf * 1.1, cat, { source })) add("Walls", p.item, p.qty, `${sf.toFixed(0)} sf of wall`);
    L.push({
      g: "Walls",
      item: { name: "Cement board / drywall substrate", sku: "— by others", price: 0, cost: 0, stock: true },
      qty: 1, note: "membrane needs a backer", so: false, noteOnly: true,
    });
  }

  const bands = stockPool(cat.filter((i) => i.g === "seam" && i.lf).sort((a, b) => a.lf - b.lf), source);
  const lfNeed = (2 * (cfg.w + cfg.d)) / 12 + sf / 6;
  // when no single roll in the pool covers, multiples cover the need — a
  // stock-narrowed pool must never quietly land one short roll
  const band = bands.find((b) => b.lf >= lfNeed) || bands[bands.length - 1];
  add("Seams", band, band ? Math.max(1, Math.ceil(lfNeed / band.lf)) : 0, "seams + tray perimeter");
  if (drain !== "linear") {
    add("Seams", pickFrom(cat, (i) => i.corner === "inside", { source }), 2, "4 inside — factory kit recipe");
    add("Seams", pickFrom(cat, (i) => i.corner === "outside", { source }), 1, "2 outside — factory kit recipe");
    add("Seams", pickFrom(cat, (i) => i.seal === "pipe", { source }), 1);
    add("Seams", pickFrom(cat, (i) => i.seal === "valve", { source }), 1);
  }

  const opening = entryOpening(cfg);
  // a cut FRONT corner turns the curb diagonally across it: the run gives up
  // the 12" leg but the diagonal piece is longer, ~5" extra per cut corner
  const frontCuts = (cfg.corners || []).filter((k) => k === "fl" || k === "fr").length;
  const curbNeed = round2(opening + frontCuts * (Math.hypot(CORNER_CUT, CORNER_CUT) - CORNER_CUT));
  if (cfg.curbed && opening > 0) {
    // stock-only prefers stocked multiples cut end-to-end over a covering
    // special-order curb (the P2 example: a SO 60" loses to 2× stocked 48")
    const curbs = stockPool(cat.filter((i) => i.g === "curb" && i.len).sort((a, b) => a.len - b.len), source);
    const c = curbs.find((x) => x.len >= curbNeed) || curbs[curbs.length - 1];
    add("Curb", c, c ? Math.max(1, Math.ceil(curbNeed / c.len)) : 0,
      c ? (c.len < curbNeed ? "cut to length end-to-end"
        : opening < cfg.w ? `cut to the ${inches(opening)} entry opening` : "cut to entry width")
        + (frontCuts ? ` — turns ${frontCuts === 1 ? "a cut corner" : "2 cut corners"} diagonally` : "")
        + " — incl. 2+2 Kereck corners" : undefined);
  } else if (!cfg.curbed) {
    add("Curb", pickFrom(cat, (i) => i.ramp, { source }), 1, '12" run, 1-1/4"→1/4" — ADA slope');
  }

  if (cfg.bench === "framed") {
    add("Extras", stockPool(cat.filter((i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf)
      .sort((x, y) => y.sf - x.sf), source)[0], 1,
      "framed bench — ½\" KERDI-BOARD wrap, framing by installer");
  } else if (cfg.bench === "buildup") {
    add("Extras", pickFrom(cat, (i) => i.thick2, { source }), 2, '2" KERDI-BOARD build-up on the finished tray — top + face + supports');
  }

  const floorSf = (cfg.w * cfg.d) / 144;
  const allset = pickFrom(cat, (i) => i.sfPerBag, { source });
  add("Setting", allset, allset ? Math.max(1, Math.ceil((sf + floorSf) / allset.sfPerBag)) : 0, "sets membrane/board");
  add("Setting", pickFrom(cat, (i) => i.adhesive, { source }), 1);

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
const SCHLUTER_LEAD = /^\s*(schluter|kerdi|kereck|kers|all.?set)/i;
const brandName = (e) => (e.g && !SCHLUTER_LEAD.test(e.name || "") ? "Schluter — " : "") + (e.name || "");

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
      brandColor: brandName(e),
      qtyType: "count",
      qty: String(l.qty),
      priceSqft: String(tierPrice(e, "retail", {})),
      costSqft: String(tierPrice(e, "cost", {})),
      markupPct: "",
      tierPrice: String(tierPrice(e, "builder", opts)),
      schluter: i === 0 ? mark : { part: true },
    };
  });
}
