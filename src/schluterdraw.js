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

/**
 * The on walls as showerdraw dWalls. Schluter's three fixed walls map to the
 * wedi side names; each is anchored at its low end and panels its inside face.
 */
export function schluterWalls(cfg) {
  return (cfg.walls || []).map((w, i) => ({ w, side: SIDE[i] })).filter(({ w }) => w.on)
    .map(({ w, side }) => ({
      side, len: +w.len || 0, h: +w.h || 84, at: "lo", faces: "in", wid: side, extra: false,
      courses: cfg.wallSys === "board" ? [{ lens: courseLens(+w.len || 0) }] : [],
    }));
}

/** TopDown's thumbnail on/off map, keyed the wedi way (side names). */
export function schluterWallOn(cfg) {
  const on = {};
  (cfg.walls || []).forEach((w, i) => { on[SIDE[i]] = !!w.on; });
  return on;
}

/**
 * Curb geometry: one run across the entry, the KBSC profile. Curbless builds
 * carry no curb band — the ramp/recess is a build line, not plan geometry.
 */
export function schluterCurb(cfg) {
  if (!cfg.curbed) return { segs: [], diags: [], h: 0, w: SCHLUTER_CURB_W };
  return {
    segs: [{ side: "entry", from: 0, len: +cfg.w || 0, ext0: 0, ext1: 0 }],
    diags: [], h: SCHLUTER_CURB_H, w: SCHLUTER_CURB_W,
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
  const cut = tray && (tray.w > w || tray.d > d);
  const warnings = [];
  let drain;
  if (cfg.drain === "linear") {
    drain = { type: "linear", x: w / 2, y: 2.75, len: Math.max(10, w - 8), axis: "w", note: "" };
  } else {
    const dx = tray ? Math.min(tray.w / 2, w - 2) : w / 2;
    const dy = tray ? Math.min(cfg.drain === "offset" ? tray.d * 0.27 : tray.d / 2, d - 2) : d / 2;
    drain = { type: "point", x: round2(dx), y: round2(dy), len: 0, axis: null, note: "" };
    const off = Math.max(Math.abs(dx - w / 2), cfg.drain === "offset" ? 0 : Math.abs(dy - d / 2));
    if (cut && off > 1) warnings.push(`the moulded drain lands ${Math.round(off)}" off the room centre after the cut`);
  }
  return {
    pieces: [{
      kind: "pan",
      item: tray ? { name: tray.name, us: tray.sku } : { name: "Mortar bed + KERDI", us: "" },
      x: 0, y: 0, w, d,
      cut: cut ? { w: tray.w, d: tray.d } : null,
    }],
    drain, room: { w, d }, warnings,
    title: tray ? tray.name : "Mortar bed + KERDI",
  };
}
