// Schluter build → the shared shower-drawing shape (ADR 0033): pure builders
// the popup feeds to showerdraw.jsx's TopDown/Iso. Nothing here imports
// wedi.js; the drawing components take these shapes exactly as the wedi popup
// hands them its own.

// KERDI-BOARD-SC curb profile: 4½" wide on the plan, 6" tall in the
// isometric — the prototype's massing, from the "6\"×4½\"×len" size text.
export const SCHLUTER_CURB_W = 4.5;
export const SCHLUTER_CURB_H = 6;

// KERDI-BOARD panels hang in 48"-wide sheets; a board wall's butt joints tick
// every 48" along the run (course ticks only on board walls — membrane walls
// have no panel seams to show).
const PANEL_W = 48;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const courseLens = (len) => {
  const lens = [];
  let left = len;
  while (left > PANEL_W) { lens.push(PANEL_W); left = round2(left - PANEL_W); }
  lens.push(left);
  return lens;
};

const SIDE = ["back", "left", "right"];
const EDGES = ["back", "left", "right", "entry"];

/**
 * The on walls as showerdraw dWalls. Schluter's three fixed walls map to the
 * wedi side names; each is anchored at its low end and panels its inside face.
 * Added runs (cfg.xwalls — entry returns, jogs) follow behind them, anchored
 * at whichever end their `at` says, exactly the wedi extra-wall shape.
 */
export function schluterWalls(cfg) {
  const wall = (side, len, h, at, wid, extra) => ({
    side, len, h, at, faces: "in", wid, extra,
    // one floor-to-top course: the plan ticks the 48" butt joints off lens,
    // the isometric draws the same joints y0→y0+ch up the face
    courses: cfg.wallSys === "board" ? [{ lens: courseLens(len), y0: 0, ch: h }] : [],
  });
  const out = (cfg.walls || []).map((w, i) => ({ w, side: SIDE[i] })).filter(({ w }) => w.on)
    .map(({ w, side }) => wall(side, +w.len || 0, +w.h || 84, "lo", side, false));
  (cfg.xwalls || []).forEach((x, i) => {
    const len = +x.len || 0;
    if (len > 0) out.push(wall(EDGES.includes(x.edge) ? x.edge : "entry", len, +x.h || 84,
      x.at === "hi" ? "hi" : "lo", "x" + i, true));
  });
  return out;
}

/** TopDown's thumbnail on/off map, keyed the wedi way (side names). */
export function schluterWallOn(cfg) {
  const on = {};
  (cfg.walls || []).forEach((w, i) => { on[SIDE[i]] = !!w.on; });
  return on;
}

// The 45° corner-cut leg — the wedi CORNER_CUT default, deliberately
// duplicated from schluter.js (the round2/inch precedent).
const SCH_CORNER_CUT = 12;

// Does any wall claim this end of this edge? Base walls anchor at their low
// end (back at the left, sides at the back); xwalls at whichever end their
// `at` says. A wall spanning the whole edge covers both ends.
function covers(cfg, edge, end) {
  const max = edge === "back" || edge === "entry" ? +cfg.w || 0 : +cfg.d || 0;
  const hits = [];
  const bi = { back: 0, left: 1, right: 2 }[edge];
  if (bi != null) {
    const bw = (cfg.walls || [])[bi];
    if (bw && bw.on && (+bw.len || 0) > 0.5) hits.push({ at: "lo", len: +bw.len });
  }
  (cfg.xwalls || []).forEach((x) => {
    if (x.edge === edge && (+x.len || 0) > 0.5) hits.push({ at: x.at === "hi" ? "hi" : "lo", len: +x.len });
  });
  return hits.some((h) => (h.at === end ? true : h.len >= max - 0.5));
}

/**
 * Which corners can take a 45° cut — the wedi openCorners rule: a corner
 * boxed in by two walls can't be cut, the walls are standing on it. The curb
 * never boxes a corner (it takes the diagonal instead).
 */
export function schluterOpenCorners(cfg) {
  return {
    bl: !(covers(cfg, "back", "lo") && covers(cfg, "left", "lo")),
    br: !(covers(cfg, "back", "hi") && covers(cfg, "right", "lo")),
    fl: !(covers(cfg, "entry", "lo") && covers(cfg, "left", "hi")),
    fr: !(covers(cfg, "entry", "hi") && covers(cfg, "right", "hi")),
  };
}

/**
 * The cut corners as TopDown's `cuts` shape ({corner, h, v} legs) — only
 * corners that are actually open; a stale cut behind a re-walled corner
 * silently drops rather than drawing through the wall.
 */
export function schluterCuts(cfg) {
  const open = schluterOpenCorners(cfg);
  const h = Math.min(SCH_CORNER_CUT, +cfg.w || 0), v = Math.min(SCH_CORNER_CUT, +cfg.d || 0);
  return (cfg.corners || []).filter((k) => open[k]).sort()
    .map((k) => ({ corner: k, h: round2(h), v: round2(v) }));
}

/**
 * Curb geometry: one run across the entry OPENING — the KBSC profile, butting
 * any entry walls (cfg.xwalls) instead of running under them. A cut FRONT
 * corner the run reaches turns the curb diagonally across it (the wedi diag
 * shape); the run gives up the leg. Curbless builds carry no curb band —
 * the ramp/recess is a build line, not plan geometry.
 */
export function schluterCurb(cfg) {
  if (!cfg.curbed) return { segs: [], diags: [], h: 0, w: SCHLUTER_CURB_W };
  const w = +cfg.w || 0;
  let lo = 0, hi = 0;
  (cfg.xwalls || []).filter((x) => x.edge === "entry").forEach((x) => {
    const len = Math.min(+x.len || 0, w);
    if (x.at === "hi") hi = Math.max(hi, len); else lo = Math.max(lo, len);
  });
  let from = lo, len = Math.max(0, w - lo - hi);
  if (len <= 0) return { segs: [], diags: [], h: 0, w: SCHLUTER_CURB_W };
  const cutSet = schluterCuts(cfg);
  const diags = [];
  const diagOf = (c) => ({
    corner: c.corner, h: c.h, v: c.v, len: round2(Math.hypot(c.h, c.v)),
    cut: round2(Math.hypot(c.h + SCHLUTER_CURB_W, c.v + SCHLUTER_CURB_W)),
  });
  const fl = cutSet.find((c) => c.corner === "fl"), fr = cutSet.find((c) => c.corner === "fr");
  if (fl && from <= 0.5) { const t = Math.min(fl.h, len); from += t; len -= t; diags.push(diagOf(fl)); }
  if (fr && from + len >= w - 0.5) { len -= Math.min(fr.h, len); diags.push(diagOf(fr)); }
  return {
    segs: len > 0.5 ? [{ side: "entry", from: round2(from), len: round2(len), ext0: 0, ext1: 0 }] : [],
    diags, h: SCHLUTER_CURB_H, w: SCHLUTER_CURB_W,
  };
}

/**
 * The diagram: one room-sized tray piece (cut edges dash when the tray is
 * bigger than the room — the wedi cut-down shape), the drain at the UNCUT
 * tray's moulded position (a cut never re-centres it, so past 1" off the room
 * centre a warning says how far), a linear room's Vario channel along the
 * back wall at cfg.w − 8. A mortar-bed candidate draws the bare room.
 */
export function schluterDiag(cfg, cand) {
  const w = +cfg.w || 0, d = +cfg.d || 0;
  const tray = cand && cand.tray;
  // the candidate's EFFECTIVE orientation (tw/td, rot) — a point tray may lie
  // rotated (trayCandidates), and the ghost/cut/drain all follow the turn
  const tw = tray ? (cand.tw ?? tray.w) : w;
  const td = tray ? (cand.td ?? tray.d) : d;
  const cut = tray && (tw > w || td > d);
  const warnings = [];
  let drain;
  // under an "any" preference the picked tray decides what gets drawn — the
  // same rule buildKit bills by; a mortar card falls back to the preference
  const dk = tray ? tray.drain : (cfg.drain === "any" ? "point" : cfg.drain);
  if (dk === "linear") {
    drain = { type: "linear", x: w / 2, y: 2.75, len: Math.max(10, w - 8), axis: "w", note: "" };
  } else {
    // the candidate's achieved position (trayCandidates splits the cut to
    // chase a pinned drain); the old anchored-at-0,0 formula stays as the
    // fallback for a mortar card or a candidate without the fields
    const dx = tray ? (cand.dx ?? Math.min(tw / 2, w - 2)) : w / 2;
    const dy = tray ? (cand.dy ?? Math.min(tray.drain === "offset" ? td * 0.27 : td / 2, d - 2)) : d / 2;
    drain = { type: "point", x: round2(dx), y: round2(dy), len: 0, axis: null, note: "" };
    const off = Math.max(Math.abs(dx - w / 2), tray && tray.drain === "offset" ? 0 : Math.abs(dy - d / 2));
    // a pinned drain is off-centre on purpose — only a pin the cut can't
    // reach warns; the room-centre warning stays for unpinned cuts
    if (cand && cand.pinned) {
      if (cand.miss > 0.5) warnings.push(`the moulded drain lands ${Math.round(cand.miss)}" off the pinned point — the cut can't reach further`);
    } else if (cut && off > 1) warnings.push(`the moulded drain lands ${Math.round(off)}" off the room centre after the cut`);
  }
  return {
    pieces: [{
      kind: "pan",
      item: tray ? { name: tray.name, us: tray.sku } : { name: "Mortar bed + KERDI", us: "" },
      x: 0, y: 0, w, d,
      cut: cut ? { w: tw, d: td } : null,
    }],
    drain, room: { w, d }, warnings,
    title: tray ? tray.name : "Mortar bed + KERDI",
  };
}
