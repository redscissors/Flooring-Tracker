// Schluter build → the shared shower-drawing shape (ADR 0033): pure builders
// the popup feeds to showerdraw.jsx's TopDown/Iso. Nothing here imports
// wedi.js; the drawing components take these shapes exactly as the wedi popup
// hands them its own.

import { benchFootprint } from "./showerdraw.js";
import { benchTrayRoom, openRuns, CURB_W } from "./schluter.js";

// KERDI-BOARD-SC curb profile: 4½" wide on the plan (CURB_W lives engine-side
// now — billing figures diagonals off it too), 6" tall in the isometric —
// the prototype's massing, from the "6\"×4½\"×len" size text.
export const SCHLUTER_CURB_W = CURB_W;
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
export function schluterWalls(cfg, plan) {
  // With a Fit plan (round 7 — the engine's boardPlan over the same
  // on-walls-then-xwalls order), each drawn wall takes its plan detail's
  // courses — real stacked courses, mixed sheet lengths, vertical walls
  // seamless. Without one, the one-course 48" tick pattern stands in.
  let wi = -1;
  const wall = (side, len, h, at, wid, extra, faces) => {
    wi += 1;
    const det = plan && plan.detail && plan.detail[wi];
    return {
      side, len, h, at, faces: faces === "both" || faces === "in-end" ? faces : "in", wid, extra,
      // the plan ticks butt joints off lens; the isometric draws the same
      // joints y0→y0+ch up the face
      courses: cfg.wallSys !== "board" ? []
        : det ? det.courses
          : [{ lens: courseLens(len), y0: 0, ch: h }],
    };
  };
  const out = (cfg.walls || []).map((w, i) => ({ w, side: SIDE[i] })).filter(({ w }) => w.on)
    .map(({ w, side }) => wall(side, +w.len || 0, +w.h || 84, "lo", side, false, w.faces));
  (cfg.xwalls || []).forEach((x, i) => {
    const len = +x.len || 0;
    // wid off the row's own id when it has one (the popup's wall menu keys on
    // it); the index stays the fallback for id-less cfgs
    if (len > 0) out.push(wall(EDGES.includes(x.edge) ? x.edge : "entry", len, +x.h || 84,
      x.at === "hi" ? "hi" : "lo", "x" + (x.id != null ? x.id : i), true, x.faces));
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
 * Curb geometry: the engine's openRuns — every open edge carries curb (round
 * 6, the wedi rule), butting walls instead of running under them, cut corners
 * turned diagonally at the piece's longest point. Billing reads the SAME
 * openRuns, so the plan and the bill can't drift. Curbless builds carry no
 * curb band — the ramp/recess is a build line, not plan geometry.
 */
export function schluterCurb(cfg, benches) {
  if (!cfg.curbed) return { segs: [], diags: [], h: 0, w: SCHLUTER_CURB_W };
  const w = +cfg.w || 0, d = +cfg.d || 0;
  const runs = openRuns(cfg);
  if (!runs.segs.length && !runs.diags.length) return { segs: [], diags: [], h: 0, w: SCHLUTER_CURB_W };
  // a FRAMED bench whose footprint reaches an open edge claims its span —
  // the curb butts the bench face instead of running under it (the wedi rule:
  // only framed interrupts the envelope; build-ups and premades sit on the
  // finished tray with the curb running beneath)
  const claims = { back: [], left: [], right: [], entry: [] };
  (benches || []).forEach((b) => {
    if (b.kind !== "wall" || b.build !== "framed") return;
    const f = benchFootprint(b, { w, d });
    if (f.kind !== "rect") return;
    if (f.y <= 0.5) claims.back.push([f.x, f.x + f.w]);
    if (f.y + f.d >= d - 0.5) claims.entry.push([f.x, f.x + f.w]);
    if (f.x <= 0.5) claims.left.push([f.y, f.y + f.d]);
    if (f.x + f.w >= w - 0.5) claims.right.push([f.y, f.y + f.d]);
  });
  const segs = [];
  runs.segs.forEach((s) => {
    let parts = [[s.from, s.from + s.len]];
    claims[s.side].forEach(([a, z]) => {
      parts = parts.flatMap(([p, q]) => {
        if (z <= p + 0.5 || a >= q - 0.5) return [[p, q]];
        const keep = [];
        if (a > p + 0.5) keep.push([p, a]);
        if (z < q - 0.5) keep.push([z, q]);
        return keep;
      });
    });
    parts.filter(([p, q]) => q - p > 0.5)
      .forEach(([p, q]) => segs.push({ side: s.side, from: round2(p), len: round2(q - p), ext0: 0, ext1: 0 }));
  });
  return { segs, diags: runs.diags, h: SCHLUTER_CURB_H, w: SCHLUTER_CURB_W };
}

/**
 * The diagram: one room-sized tray piece (cut edges dash when the tray is
 * bigger than the room — the wedi cut-down shape), the drain at the UNCUT
 * tray's moulded position (a cut never re-centres it, so past 1" off the room
 * centre a warning says how far), a linear room's Vario channel along the
 * back wall at cfg.w − 8. A mortar-bed candidate draws the bare room.
 */
export function schluterDiag(cfg, cand, benches) {
  const w = +cfg.w || 0, d = +cfg.d || 0;
  // a framed bench shrinks the room the tray fills (benchTrayRoom, the same
  // reduction trayCandidates fit against) — the piece draws offset at x0/y0
  // and the bench band butts its edge
  const troom = benchTrayRoom(benches || [], { w, d });
  const rw = troom.w, rd = troom.d;
  const tray = cand && cand.tray;
  // the candidate's EFFECTIVE orientation (tw/td, rot) — a point tray may lie
  // rotated (trayCandidates), and the ghost/cut/drain all follow the turn
  const tw = tray ? (cand.tw ?? tray.w) : rw;
  const td = tray ? (cand.td ?? tray.d) : rd;
  const cut = tray && (tw > rw || td > rd);
  const warnings = [];
  let drain;
  // under an "any" preference the picked tray decides what gets drawn — the
  // same rule buildKit bills by; a mortar card falls back to the preference
  const dk = tray ? tray.drain : (cfg.drain === "any" ? "point" : cfg.drain);
  // the tray region's own centre — with a framed bench it is NOT the room's
  const cx = troom.x0 + rw / 2, cy = troom.y0 + rd / 2;
  if (dk === "linear") {
    drain = { type: "linear", x: round2(cx), y: round2(troom.y0 + 2.75), len: Math.max(10, rw - 8), axis: "w", note: "" };
  } else {
    // the candidate's achieved position (trayCandidates splits the cut to
    // chase a pinned drain, already in room coords); the old anchored formula
    // stays as the fallback for a mortar card or a candidate without the fields
    const dx = tray ? (cand.dx ?? Math.min(troom.x0 + tw / 2, troom.x0 + rw - 2)) : cx;
    const dy = tray ? (cand.dy ?? Math.min(troom.y0 + (tray.drain === "offset" ? td * 0.27 : td / 2), troom.y0 + rd - 2)) : cy;
    drain = { type: "point", x: round2(dx), y: round2(dy), len: 0, axis: null, note: "" };
    const off = Math.max(Math.abs(dx - cx), tray && tray.drain === "offset" ? 0 : Math.abs(dy - cy));
    // a pinned drain is off-centre on purpose — only a pin the cut can't
    // reach warns; the room-centre warning stays for unpinned cuts. A
    // smaller-tray re-fit's auto pin is the clear space's centre, so its
    // miss reads against that, not a typed point
    if (cand && cand.pinned) {
      if (cand.miss > 0.5) warnings.push(cand.centered
        ? `the moulded drain lands ${Math.round(cand.miss)}" off the clear space's centre — the cut can't reach further`
        : `the moulded drain lands ${Math.round(cand.miss)}" off the pinned point — the cut can't reach further`);
    } else if (cut && off > 1) warnings.push(`the moulded drain lands ${Math.round(off)}" off the room centre after the cut`);
    // a kept tray's drain can end up behind a framed bench face ("Cut it
    // down" keeps the full-room placement) — that hole is under the seat
    if (dx < troom.x0 || dx > troom.x0 + rw || dy < troom.y0 || dy > troom.y0 + rd) {
      warnings.push('the drain lands under the framed bench — set the bench to "Smaller tray" or pin the drain clear of it');
    }
  }
  return {
    pieces: [{
      kind: "pan",
      item: tray ? { name: tray.name, us: tray.sku } : { name: "Mortar bed + KERDI", us: "" },
      x: troom.x0, y: troom.y0, w: rw, d: rd,
      cut: cut ? { w: tw, d: td } : null,
    }],
    drain, room: { w, d }, warnings,
    title: tray ? tray.name : "Mortar bed + KERDI",
  };
}
