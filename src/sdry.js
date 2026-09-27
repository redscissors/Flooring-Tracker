// sdry — wedi's S-DRY system, the wedi "Membrane" wall choice (ticket 158
// Phase 2, ADR 0051): how S-DRY bases and extensions fit a room, and what an
// S-DRY membrane wall bills. Pure: the caller (wedi.js) hands in its catalog,
// so this module never imports the engine and the engine imports it freely.
//
// Rates are wedi's published ones (spec 2026-09-28, "Sourced rates"):
//   PRO-SET, 1/8" × 1/8" notch = 100 sf of membrane per 25 lb bag;
//   S-DRY SEAL, one unit (32 oz liquid + 2 × 16 oz powder) = ~45 lf of seams.

export const SDRY = {
  ext: "US3076003", curbFull: "US3076001", curbLean: "US3076002",
  drain: "US9476006", coverSS: "US1076002",
  roll: "US5076009", rollXL: "US5076008", tape: "US5076007",
  inCorner: "US5076002", outCorner: "US5076005",
  collarValve: "US5076003", collarPipe: "US5076006",
  seal: "US5076011", sealTrowel: "US5076010", proSet: "US5076012",
};

export const PROSET_SF = 100;
export const SEAL_LF = 45;
export const TAPE_LF = 32;
export const CURB_LEN = 72;
export const LAP = 1.1;
// wedi's published roll coverage — the stock export names it ("104sf"), the
// distribution pricelist doesn't, so the name is read first and this backs it
const ROLL_SF = { US5076009: 104, US5076008: 106 };
const EXT_W = 48, EXT_D = 24;

const COVERS = new Set(["US1076001", "US1076002", "US1076003", "US1076004", "US1076005", "US1076006", "US1076007", "US1076008"]);
const ROLE = {
  [SDRY.ext]: "ext", [SDRY.curbFull]: "curb", [SDRY.curbLean]: "curb",
  [SDRY.drain]: "drain", US9476016: "drain", US9476011: "drain", US9476012: "drain",
  [SDRY.roll]: "membrane", [SDRY.rollXL]: "membrane", [SDRY.tape]: "tape",
  [SDRY.inCorner]: "corner", US5076001: "corner", [SDRY.outCorner]: "corner", US5076004: "corner",
  [SDRY.collarValve]: "collar", [SDRY.collarPipe]: "collar",
  [SDRY.seal]: "seal", [SDRY.sealTrowel]: "seal", [SDRY.proSet]: "setting",
  US2076001: "kit", US2076002: "kit",
};

/** An S-DRY part's role, read off its SKU; null for anything else. */
export function sdryRole(e) {
  if (!e) return null;
  if (e.group === "pan" && e.sub === "sdry") return "base";
  if (COVERS.has(e.key)) return "cover";
  return ROLE[e.key] || (e.group === "sdry" ? "other" : null);
}

const SLOT_OF_ROLE = {
  base: "tray", ext: "tray", kit: "tray", curb: "curb", drain: "drainBody", cover: "grate",
  membrane: "wallMembrane", tape: "seam", corner: "corners", collar: "corners",
  seal: "setting", setting: "setting", other: "extra",
};
/** The shared slot (slots.js) an S-DRY part fills; null for anything else. */
export const sdrySlot = (e) => SLOT_OF_ROLE[sdryRole(e)] || null;

const r2 = (n) => Math.round(n * 100) / 100;
const inch = (n) => String(r2(n));

// --- the fit -----------------------------------------------------------------

function footprints(base, ext) {
  const out = [];
  const orients = [{ w: base.w, d: base.d, rot: false }];
  if (base.w !== base.d) orients.push({ w: base.d, d: base.w, rot: true });
  for (const o of orients) {
    out.push({ tier: 1, o, w: o.w, d: o.d, exts: [] });
    if (!ext) continue;
    // an extension lies 24" deep along a base edge, cut along its 48" side to
    // that edge; past 48" two lie side by side, seamed (owner 2026-09-28)
    for (const along of ["w", "d"]) {
      const edge = o[along];
      const n = edge <= EXT_W ? 1 : edge <= 2 * EXT_W ? 2 : 0;
      if (!n) continue;
      out.push({ tier: n === 1 ? 2 : 3, o, along, n,
        w: along === "w" ? o.w : o.w + EXT_D, d: along === "w" ? o.d + EXT_D : o.d });
    }
  }
  return out;
}

// Base + extension pieces in room coordinates (x from the left wall, y from
// the back wall); an extension sits on the back (depth) or the left (width)
// side, and the footprint is cut evenly back to the room.
function layout(base, ext, fp, W, D) {
  const cx = r2((fp.w - W) / 2), cy = r2((fp.d - D) / 2);
  const bx = fp.along === "d" ? EXT_D : 0, by = fp.along === "w" ? EXT_D : 0;
  const clip = (x, y, w, d) => {
    const x0 = Math.max(x - cx, 0), y0 = Math.max(y - cy, 0);
    const x1 = Math.min(x + w - cx, W), y1 = Math.min(y + d - cy, D);
    return { x: r2(x0), y: r2(y0), w: r2(x1 - x0), d: r2(y1 - y0) };
  };
  const bp = clip(bx, by, fp.o.w, fp.o.d);
  const pieces = [{ kind: "pan", item: base, ...bp,
    cut: bp.w < fp.o.w - 0.01 || bp.d < fp.o.d - 0.01 ? { w: fp.o.w, d: fp.o.d } : null }];
  const seams = [];
  if (fp.along) {
    const edge = fp.o[fp.along];
    for (let i = 0; i < fp.n; i++) {
      const span = Math.min(EXT_W, edge - i * EXT_W);
      const ep = fp.along === "w" ? clip(i * EXT_W, 0, span, EXT_D) : clip(0, i * EXT_W, EXT_D, span);
      const full = { w: fp.along === "w" ? EXT_W : EXT_D, d: fp.along === "w" ? EXT_D : EXT_W };
      if (ep.w > 0 && ep.d > 0) pieces.push({ kind: "ext", item: ext, ...ep, cut: ep.w < full.w - 0.01 || ep.d < full.d - 0.01 ? full : null });
    }
    seams.push(r2(fp.along === "w" ? bp.w : bp.d));
    if (fp.n === 2) seams.push(EXT_D);
  }
  return { pieces, seams, cx, cy };
}

const DRAIN_OK = { any: ["center", "offset"], center: ["center"], offset: ["offset"] };

/**
 * S-DRY options for a room, best first, in the wedi solver's option shape —
 * { id, kind, title, badges, pieces, drain, warnings, floorLines, floorPrice,
 *   waste, seams, room, pan, input }. Tiers: one base cut down; + one 24×48
 * extension along an edge of 48" or less; + two side by side (seamed) along a
 * longer edge. Within a tier: least cut-away, stock first, cheaper.
 * `{ options, reason }` — reason names why nothing fits when options is empty.
 */
export function sdryFit(input, cat) {
  const W = +input.w || 0, D = +input.d || 0;
  if (!(W > 0 && D > 0)) return { options: [], reason: "no room size" };
  if (input.drain === "linear") return { options: [], reason: "S-DRY has no linear-drain base" };
  const stockOnly = input.source === "stock";
  let bases = cat.filter((e) => e.group === "pan" && e.sub === "sdry" && e.drain && (!stockOnly || e.stock));
  if (!bases.length) return { options: [], reason: "no S-DRY bases in the price book" };
  const want = DRAIN_OK[input.drain] || DRAIN_OK.any;
  const typed = bases.filter((b) => want.includes(b.drain.type));
  const ext = cat.find((e) => e.key === SDRY.ext && (!stockOnly || e.stock)) || cat.find((e) => e.key === SDRY.ext) || null;
  const cands = [];
  for (const pool of [typed.length ? typed : bases]) {
    for (const base of pool) {
      for (const fp of footprints(base, ext)) {
        if (fp.w < W - 0.01 || fp.d < D - 0.01) continue;
        const pieceCost = base.retail + (fp.n || 0) * (ext ? ext.retail : 0);
        cands.push({ base, fp, cut: fp.w * fp.d - W * D, cost: pieceCost });
      }
    }
  }
  if (!cands.length) return { options: [], reason: "the room is larger than an S-DRY base with extensions covers" };
  cands.sort((a, b) => a.fp.tier - b.fp.tier || a.cut - b.cut
    || (b.base.stock ? 1 : 0) - (a.base.stock ? 1 : 0) || a.cost - b.cost);
  // the best per tier, and within tier 1 the best per base size
  const seen = new Set(), picked = [];
  for (const c of cands) {
    const k = c.fp.tier + ":" + (c.fp.tier === 1 ? c.base.w + "x" + c.base.d : "");
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(c);
  }
  const options = picked.slice(0, 3).map((c, i) => optionOf(c, ext, W, D, input, i));
  if (options.length) options[0].badges = ["Best fit"].concat(options[0].badges);
  return { options, reason: "" };
}

function optionOf(c, ext, W, D, input, rank) {
  const { base, fp } = c;
  const { pieces, seams, cx, cy } = layout(base, ext, fp, W, D);
  const dr = base.drain;
  const bx = fp.along === "d" ? EXT_D : 0, by = fp.along === "w" ? EXT_D : 0;
  const drx = fp.o.rot ? dr.y : dr.x, dry = fp.o.rot ? dr.x : dr.y;
  const drain = { type: dr.type, x: r2(bx + drx - cx), y: r2(by + dry - cy), len: 0, axis: null, note: "" };
  const floorLines = [{ item: base, qty: 1 }];
  if (fp.n) floorLines.push({ item: ext, qty: fp.n });
  const cutW = r2(fp.w - W), cutD = r2(fp.d - D);
  const cutTxt = [cutW > 0.01 ? `cut ${inch(cutW / 2)}″ off each side` : "", cutD > 0.01 ? `cut ${inch(cutD / 2)}″ off each end` : ""].filter(Boolean).join(", ");
  const baseTxt = `S-DRY ${inch(fp.o.w)}×${inch(fp.o.d)}`;
  const title = fp.tier === 1 ? baseTxt : fp.tier === 2 ? baseTxt + " + extension" : baseTxt + " + 2 extensions (seamed)";
  const warnings = [];
  if (fp.tier === 3) warnings.push("two extensions side by side — S-DRY tape seals the seam between them");
  return {
    id: "sdry-" + fp.tier + "-" + rank, kind: "sdry", title,
    badges: [fp.tier === 1 ? "One piece" : fp.tier === 2 ? "Base + extension" : "Base + 2 extensions"].concat(cutTxt ? [cutTxt] : ["No cutting"]),
    pieces, drain, warnings, seams,
    floorLines, floorPrice: r2(floorLines.reduce((t, l) => t + l.item.retail * l.qty, 0)),
    waste: r2(c.cut / 144), input: { ...input, system: "sdry" },
    room: { w: W, d: D }, pan: base,
  };
}

/**
 * The fallback "use the nearest S-DRY base anyway": the footprint that leaves
 * the least floor uncovered, cut where it overhangs, with a warning naming the
 * shortfall. Null only when the book has no S-DRY base at all.
 */
export function sdryNearest(input, cat) {
  const W = +input.w || 0, D = +input.d || 0;
  const bases = cat.filter((e) => e.group === "pan" && e.sub === "sdry" && e.drain);
  if (!bases.length || !(W > 0 && D > 0)) return null;
  const ext = cat.find((e) => e.key === SDRY.ext) || null;
  let best = null;
  for (const base of bases.filter((b) => b.drain.type === "center").concat(bases)) {
    for (const fp of footprints(base, ext)) {
      const short = Math.max(0, W - fp.w) + Math.max(0, D - fp.d);
      const over = Math.max(0, fp.w - W) + Math.max(0, fp.d - D);
      if (!best || short < best.short || (short === best.short && (fp.tier < best.fp.tier || (fp.tier === best.fp.tier && over < best.over))))
        best = { base, fp, short, over };
    }
  }
  const fw = Math.min(best.fp.w, W), fd = Math.min(best.fp.d, D);
  const o = optionOf({ base: best.base, fp: best.fp, cut: best.fp.w * best.fp.d - fw * fd, cost: 0 }, ext, fw, fd, input, 0);
  const miss = [W > fw + 0.01 ? `${inch(W - fw)}″ wider` : "", D > fd + 0.01 ? `${inch(D - fd)}″ deeper` : ""].filter(Boolean).join(" and ");
  o.id = "sdry-nearest";
  o.title = "Nearest S-DRY — " + o.title;
  o.room = { w: W, d: D };
  o.input = { ...input, system: "sdry", nearest: true };
  if (miss) o.warnings.unshift(`room is ${miss} than the S-DRY floor — the extra floor is by others`);
  if (input.drain === "linear") o.warnings.unshift("S-DRY has no linear base — a point-drain base is used");
  return o;
}

/** The S-DRY curb for an open edge: full by default, lean on pick; ⌈open ÷ 72⌉. */
export function sdryCurb(openLen, pick, cat) {
  if (!(openLen > 0) || (pick && pick.none)) return { item: null, qty: 0, note: "", len: 0 };
  const key = pick && pick.sub === "lean" ? SDRY.curbLean : SDRY.curbFull;
  const it = cat.find((e) => e.key === key) || null;
  if (!it) return { item: null, qty: 0, note: "", len: 0 };
  const qty = Math.max(1, Math.ceil((openLen - 0.01) / CURB_LEN));
  return { item: it, qty, note: qty > 1 ? r2(openLen) + '" of open edge — cut to fit' : "cut to " + r2(openLen) + '"', len: CURB_LEN };
}

// --- the walls ---------------------------------------------------------------

/**
 * What an S-DRY membrane wall bills, as { key, qty, note } rows the engine
 * pushes. `wallSf` is the membrane's wall area (all faces), `walls` the
 * standing walls ({ side, len, h }), `curbed` / `openLen` the entry, `seams`
 * the floor's extension seams (lf, in inches).
 */
export function sdryWalls({ wallSf, walls, curbed, openLen, seams }, cat) {
  const byKey = (k) => cat.find((e) => e.key === k) || null;
  const rows = [];
  const need = r2((wallSf || 0) * LAP);
  if (need > 0) {
    const rolls = [SDRY.roll, SDRY.rollXL].map(byKey).filter(Boolean).map((e) => {
      const sf = +(/(\d+(?:\.\d+)?)\s*sf\b/i.exec(e.name || "") || [])[1] || ROLL_SF[e.key] || 0;
      return sf > 0 ? { e, sf, n: Math.ceil(need / sf) } : null;
    }).filter(Boolean).sort((a, b) => a.n * a.e.retail - b.n * b.e.retail || (b.e.stock ? 1 : 0) - (a.e.stock ? 1 : 0));
    if (rolls[0]) rows.push({ key: rolls[0].e.key, qty: rolls[0].n, note: `${need} sf of wall + laps — ${rolls[0].sf} sf/roll` });
  }
  const sides = new Set((walls || []).map((w) => w.side));
  const vCorners = sides.has("back") ? ["left", "right"].filter((s) => sides.has(s)).length : 0;
  const hOf = (w) => +w.h || 0;
  const back = (walls || []).find((w) => w.side === "back");
  const lfIn = vCorners * (back ? hOf(back) : 0)
    + (walls || []).reduce((t, w) => t + (+w.len || 0), 0)
    + (curbed && openLen > 0 ? openLen + 12 : 0)
    + (seams || []).reduce((t, s) => t + s, 0);
  const lf = r2(lfIn / 12);
  if (lf > 0) rows.push({ key: SDRY.tape, qty: Math.ceil(lf / TAPE_LF), note: `${lf} lf — corners, wall base${curbed ? ", curb" : ""}${(seams || []).length ? ", extension seams" : ""}` });
  const inside = vCorners + (curbed && openLen > 0 ? 2 : 0);
  if (inside > 0) rows.push({ key: SDRY.inCorner, qty: Math.ceil(inside / 2), note: `${inside} inside corners — 2 per bag` });
  if (curbed && openLen > 0) rows.push({ key: SDRY.outCorner, qty: 1, note: "2 outside corners at the curb ends" });
  rows.push({ key: SDRY.collarValve, qty: 1, note: "mixing valve" });
  rows.push({ key: SDRY.collarPipe, qty: 1, note: "shower arm / pipe" });
  if (lf > 0) rows.push({ key: SDRY.seal, qty: Math.ceil(lf / SEAL_LF), note: `${lf} lf of seams — ~${SEAL_LF} lf per unit` });
  rows.push({ key: SDRY.sealTrowel, qty: 1, note: '3/16" x 5/32" notch' });
  return { rows, membraneSf: need, tapeLf: lf };
}

/** PRO-SET bags on a Membrane build: one sets the base, then 100 sf of membrane per bag. */
export const sdryProSet = (membraneSf) => 1 + Math.ceil(Math.max(0, membraneSf || 0) / PROSET_SF);
