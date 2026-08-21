// The shared shower drawings — extracted from WediConfigurator.jsx (issue 097
// phase 1); both configurators feed the same geometry shape; must never
// import the wedi data/engine module. This half is pure geometry and
// constants (no JSX) so plain `node --test` can parse it through that
// module's import of the six geometry exports below. The JSX components
// (TopDown, Iso) live in ./showerdraw.jsx, which imports everything here and
// re-exports it alongside them.

// Generic number formatters the wedi module also defines and uses throughout
// its pricing code — duplicated here rather than shared, since deleting the
// wedi module's originals would ripple far outside this extraction's scope.
// One comparison point, effectively zero drift risk.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function inch(n) {
  const whole = Math.floor(n + 1e-9), rem = n - whole;
  if (rem < 1e-6) return String(whole);
  let den = 64, num = Math.round(rem * den);
  if (num === den) return String(whole + 1);
  while (num % 2 === 0 && den % 2 === 0) { num /= 2; den /= 2; }
  return (whole ? whole + " " : "") + num + "/" + den;
}

// Geometry that used to live in the wedi module but is only ever read by the
// drawings — moved here and re-exported (unchanged) from wedi so its other
// callers (expandWallFaces, curbInsets, normBench, benchEdgeSpans, panThick's
// own wedi.test coverage) keep working.
export const WALL_THICK = 4;     // framing depth — the drawings draw it true
export const CURB_LAP = 0.5;
export const BENCH_DEPTH = 14;     // default seat depth along a wall (owner, 2026-07-31)

// A pan's thickness off its size text ('… x 2"' / '… x 1 37/64"'). The deep
// 2" pans pair with 1 37/64" extensions, which the shop shims flush with
// ½" building-panel strips underneath (owner practice 2026-07-30).
export function panThick(p) {
  const m = /x\s*(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)"\s*$/.exec((p && p.sizeText) || "");
  if (!m) return 0;
  let v = 0;
  m[1].trim().split(/\s+/).forEach((s) => {
    const f = s.split("/");
    v += f.length === 2 ? +f[0] / +f[1] : +s;
  });
  return round2(v);
}

// Plan-view footprint in room coords (origin back-left). Wall benches anchor
// at the back (a back bench at the left wall), corners wrap their corner.
export function benchFootprint(b, dims) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  if (b.kind === "corner") return { kind: "corner", corner: b.corner, a: Math.min(b.size, rw || b.size, rd || b.size) };
  if (b.side === "left") return { kind: "rect", x: 0, y: 0, w: Math.min(b.depth, rw), d: Math.min(b.len, rd) };
  if (b.side === "right") return { kind: "rect", x: Math.max(0, rw - b.depth), y: 0, w: Math.min(b.depth, rw), d: Math.min(b.len, rd) };
  return { kind: "rect", x: 0, y: 0, w: Math.min(b.len, rw), d: Math.min(b.depth, rd) };
}

// The pure half of the wedi module's curbWidth(key): its exported curbWidth()
// still resolves a string key through the catalog (item()), then wraps this.
// The cluster's own callers (curbHeight below, and the WediConfigurator.jsx
// call at what was :2427) always pass an already-resolved item object, never
// a string, so this is all they ever needed.
function curbWidthOf(itemObj) {
  return itemObj && /lean/i.test(itemObj.name || "") ? 2 : 4.5;
}

// The drawings rail. The two SVGs were fixed at 328 × 268 and 328 × 306 and
// rendered width:100%, so on a wide monitor they grew taller than the column
// and the isometric fell off the bottom — a scroll to see the drawing you just
// changed. They now fit the rail's measured box: their natural proportions
// while both fit, then the height split 268:306 down to the floors, below
// which the rail scrolls as it always did. RAIL_PAD_* mirror .diagcol's
// padding; RAIL_HINT_H is the add-a-wall chip that pushes them down.
export const RAIL_DESIGN_W = 328, RAIL_PLAN_H = 268, RAIL_ISO_H = 306;
const RAIL_GAP = 10, RAIL_HINT_H = 34;
const RAIL_MIN_PLAN = 210, RAIL_MIN_ISO = 240;
// Only the HEIGHT gives, and it gives in the drawing's own units, not pixels:
// the 328-wide viewBox still stretches to the column, so a callout set at 8.5
// units reads exactly as large as it did before. Handing over measured pixels
// instead would have pinned the type at 8.5px and shrunk every label on the
// widest monitors — the drawings would fit and stop being readable.
export function railSplit(box, hinted) {
  const k = box.w / RAIL_DESIGN_W;
  let plan = RAIL_PLAN_H, iso = RAIL_ISO_H;
  const room = (box.h - RAIL_GAP - (hinted ? RAIL_HINT_H : 0)) / k;
  if (box.h > 0 && plan + iso > room) {
    const share = Math.max(room, RAIL_MIN_PLAN + RAIL_MIN_ISO);
    plan = Math.max(RAIL_MIN_PLAN, Math.round(share * RAIL_PLAN_H / (RAIL_PLAN_H + RAIL_ISO_H)));
    iso = Math.max(RAIL_MIN_ISO, Math.round(share - plan));
  }
  return { w: RAIL_DESIGN_W, plan, iso };
}

// ============================================================================
// the drawings — top-down layout + isometric view
// ============================================================================

export const PIECE_FILL = { pan: "#DCE5CD", module: "#DCE5CD", ext: "#EFF3E6", cornerExt: "#E4EBD6", modExt: "#EFF3E6" };
export const PIECE_SIDE = { pan: "#C2CFA8", module: "#C2CFA8", ext: "#D8DFC4", cornerExt: "#CDD8B4", modExt: "#D8DFC4" };
export const INK = "#1C1A17", MUTED = "#57534C", FAINT = "#8A8378", MOSS = "#57703A", MOSS_DEEP = "#40542A";
export const RUST = "#B4552D", PAPER = "#FBFAF5";
export const FONT = "Manrope,sans-serif";
// Real z-heights the isometric draws to, off the price list (the profiles
// wedi.js curbWidth reads): the lean curb is 3½ × 2, the standard/AT curb
// 5⅛ × 4½ (H×W), and the thinnest pan is 1 37/64" (the deep ones read 2" off
// their size text).
export const CURB_H_LEAN = 3.5, CURB_H_STD = 5.125, PAN_T_MIN = 1.58, CURB_W_LEAN = 2;
export const curbHeight = (it) => (curbWidthOf(it) === CURB_W_LEAN ? CURB_H_LEAN : CURB_H_STD);
// The plan bands draw that same profile ACROSS: the band is the whole width,
// straddling the pan line, since the curb is notched to lap ½" onto the pan and
// adds (width − lap) of floor outside it. Both views take the one number off
// the build's own curb line, so a build reads one width everywhere.

// The whole floor field falls to the drain at ¼ in./ft. The PAN breaks into
// four planes whose hips run corner → drain (a point drain) or one plane across
// to the channel (linear); every EXTENSION is sloped too — the pricelist reads
// "sloped 1/4 in./ft", the corner pieces "sloped … on two sides" — falling
// toward the pan edge it butts. (The 1 37/64"-vs-2" build-up strips are about
// the edge thickness at that joint, not flatness.)
const EXT_SPAN = [0.16, 0.86];
// A pan plane is far deeper than an extension strip, so a fraction of its run
// draws a much longer arrow than the extension mark beside it. The pan's marks
// carry their own cap (owner ask 2026-07-31): two short arrows per plane,
// the extension arrow's size whatever the pan measures — and at a third of
// the length they first shipped at (owner ask 2026-07-31).
const PAN_TRIM = 3;
const PAN_SPAN = [0.12, round2(0.12 + 0.5 / PAN_TRIM)], PAN_ARROW = 9 / PAN_TRIM, PAN_HEAD = 4;
const PLANE_AT = [1 / 3, 2 / 3];
// Both drawings scale an axis-aligned inch to `sc` screen px — the isometric's
// unit vectors are unit length — so the cap can be stated in inches and read
// the same size in the plan and the iso.
export const panCap = (sc) => ({ max: PAN_ARROW * sc, head: PAN_HEAD });
export function slopeMarks(o) {
  const pieces = o.pieces || [];
  const pan = pieces.find((p) => p.kind === "pan" || p.kind === "module");
  const dr = o.drain;
  if (!pan || !dr) return null;
  const x0 = pan.x, y0 = pan.y, x1 = pan.x + pan.w, y1 = pan.y + pan.d;
  if (dr.x < x0 - 1 || dr.x > x1 + 1 || dr.y < y0 - 1 || dr.y > y1 + 1) return null;
  const hips = [], arrows = [];
  const linear = dr.type === "linear" && dr.len;
  if (linear) {
    const along = dr.axis !== "d";      // channel runs across the width
    const half = 1.6;
    const runs = along
      ? [[y0, dr.y - half], [y1, dr.y + half]] : [[x0, dr.x - half], [x1, dr.x + half]];
    runs.forEach(([edge, chan]) => {
      if (Math.abs(chan - edge) < 4) return;
      PLANE_AT.forEach((f) => {
        const u = along ? x0 + (x1 - x0) * f : y0 + (y1 - y0) * f;
        arrows.push({ a: along ? [u, edge] : [edge, u], b: along ? [u, chan] : [chan, u], f: PAN_SPAN, pan: true });
      });
    });
  } else {
    // A square-drain pan folds on hips that run pan corner → COVER corner —
    // the 4×4 grate has four corners of its own, and drawing to the drain's
    // centre point put a kink where the real fold line lands.
    //
    // The corners are the UNCUT pan's (owner 2026-08-03). The fold lines are
    // moulded at the factory and a site cut does not re-aim them: cut a base
    // down and the hips still run toward where its corners were, leaving the
    // cut edge at an angle. Drawing them to the CUT corners re-pitched the
    // planes, which is the one thing cutting a pan cannot do. The line is then
    // clipped back to the material that's actually there — it points off the
    // cut edge, it doesn't hang past it.
    const dq = 2;
    const cutW = (pan.cut && pan.cut.w) || pan.w, cutD = (pan.cut && pan.cut.d) || pan.d;
    const ux0 = o.mirrored ? round2(x1 - cutW) : x0, ux1 = round2(ux0 + cutW);
    const uy0 = y0, uy1 = round2(uy0 + cutD);
    // Walk `a` along a→b until it lands inside the pan. `b` sits at the drain,
    // always inside, so the largest violated-axis step puts `a` on the edge.
    const onPan = (a, b2) => {
      const dx = b2[0] - a[0], dy = b2[1] - a[1];
      let t = 0;
      const lim = (v, d, lo, hi) => {
        if (Math.abs(d) < 1e-9) return;
        if (v < lo) t = Math.max(t, (lo - v) / d);
        if (v > hi) t = Math.max(t, (hi - v) / d);
      };
      lim(a[0], dx, x0, x1);
      lim(a[1], dy, y0, y1);
      return t > 0 ? [round2(a[0] + dx * t), round2(a[1] + dy * t)] : a;
    };
    [[ux0, uy0], [ux1, uy0], [ux1, uy1], [ux0, uy1]].forEach((c) => {
      const e = [dr.x + (c[0] >= dr.x ? dq : -dq), dr.y + (c[1] >= dr.y ? dq : -dq)];
      const s0 = onPan(c, e);
      if (Math.hypot(s0[0] - e[0], s0[1] - e[1]) > 3) hips.push([s0, e]);
    });
    // Two arrows per plane, square to its own edge (that IS the steepest
    // descent) and spaced a third in from each end, so they sit in the wide
    // part of the plane clear of the drain, its dimension lines, the piece
    // label and the hips.
    const w2 = x1 - x0, d2 = y1 - y0;
    PLANE_AT.forEach((f) => {
      const u = x0 + w2 * f, v = y0 + d2 * f;
      [[[u, y0], [u, dr.y]], [[x1, v], [dr.x, v]], [[u, y1], [u, dr.y]], [[x0, v], [dr.x, v]]]
        .forEach(([a, b2]) => { if (Math.hypot(b2[0] - a[0], b2[1] - a[1]) > 8) arrows.push({ a, b: b2, f: PAN_SPAN, pan: true }); });
    });
  }
  // Each extension falls toward the pan edge it butts — a corner piece toward
  // both, with the hip between them running out from the pan's corner.
  pieces.forEach((p) => {
    if (p === pan) return;
    const ex0 = p.x, ey0 = p.y, ex1 = p.x + p.w, ey1 = p.y + p.d;
    const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
    const sides = [];
    if (Math.abs(ex1 - x0) < 0.6 && ov(ey0, ey1, y0, y1) > 3) sides.push(["x", ex0, ex1, Math.max(ey0, y0), Math.min(ey1, y1)]);
    if (Math.abs(ex0 - x1) < 0.6 && ov(ey0, ey1, y0, y1) > 3) sides.push(["x", ex1, ex0, Math.max(ey0, y0), Math.min(ey1, y1)]);
    if (Math.abs(ey1 - y0) < 0.6 && ov(ex0, ex1, x0, x1) > 3) sides.push(["y", ey0, ey1, Math.max(ex0, x0), Math.min(ex1, x1)]);
    if (Math.abs(ey0 - y1) < 0.6 && ov(ex0, ex1, x0, x1) > 3) sides.push(["y", ey1, ey0, Math.max(ex0, x0), Math.min(ex1, x1)]);
    sides.forEach(([axis, from, to, u0, u1]) => {
      const n = u1 - u0 > 34 ? 3 : u1 - u0 > 17 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const u = u0 + (u1 - u0) * ((i + 0.5) / n);
        arrows.push({ a: axis === "x" ? [from, u] : [u, from], b: axis === "x" ? [to, u] : [u, to], f: EXT_SPAN });
      }
    });
    if (sides.length === 2) {
      const cx = Math.abs(ex1 - x0) < 0.6 ? ex1 : ex0, cy = Math.abs(ey1 - y0) < 0.6 ? ey1 : ey0;
      hips.push([[cx === ex1 ? ex0 : ex1, cy === ey1 ? ey0 : ey1], [cx, cy]]);
    }
  });
  return hips.length || arrows.length ? { hips, arrows } : null;
}

// Where each curb run's band sits in plan, with the ring corners MITRED.
// Two runs meeting at an open corner used to be two full boxes, one ending
// inside the other: the buried faces still drew, the shared outer plane came
// out as two polygons split by an ink line, and the tops butted on a seam that
// read as a step. A miter gives each run a right-trapezoid — the OUTER edge
// carries on to the corner point, the INNER edge stops at the joint — so the
// outer plane is one face and the tops share a single 45° line.
//
// The engine hands a horizontal run the corner square as ext0/ext1 (wedi.js
// curbRuns) only where no wall fills the corner — which is also the only place
// a perpendicular run can continue — so it reads as the "miter here" signal for
// both runs reaching that corner. The overhang itself draws off `cw`, this
// build's own curb profile: the two bands overlap in a cw square at the corner,
// so the 45° joint runs from its inner point (the lap, `cw − add` inside each
// pan edge) to its outer one (`add` outside both).
export function curbBands(curbs, rw, rd, inset, cw) {
  const mit = {};
  (curbs || []).forEach((cs) => {
    const k = cs.side === "back" ? ["bl", "br"] : cs.side === "entry" ? ["fl", "fr"] : null;
    if (!k) return;
    if (cs.ext0 > 0) mit[k[0]] = 1;
    if (cs.ext1 > 0) mit[k[1]] = 1;
  });
  const out = [];
  // What the curb adds outside the pan line; the remaining ½" laps over it.
  const add = round2(cw - CURB_LAP);
  (curbs || []).forEach((cs, ci) => {
    const horiz = cs.side === "back" || cs.side === "entry";
    const len = Math.min(cs.len, (horiz ? rw : rd) - cs.from);
    if (!(len > 0)) return;
    // "overall max": the curb sits inside the stated line — the pan gave up
    // `add` plus the tile thickness, so the band starts that tile off the line
    // (the finished face lands ON it) — and no corner miters.
    const inEdge = !!(inset && inset[cs.side] > 0);
    const tin = inEdge ? (inset.tile || 0) : 0;
    const c0 = horiz
      ? (cs.side === "back" ? (inEdge ? tin : -add) : rd - (inEdge ? cw + tin : CURB_LAP))
      : (cs.side === "left" ? (inEdge ? tin : -add) : rw - (inEdge ? cw + tin : CURB_LAP));
    const lo = cs.from, hi = cs.from + len;
    let mLo, mHi;
    if (horiz) { mLo = !inEdge && cs.ext0 > 0; mHi = !inEdge && cs.ext1 > 0; }
    else {
      const left = cs.side === "left";
      mLo = !inEdge && lo <= 0.5 && !!mit[left ? "bl" : "br"];
      mHi = !inEdge && hi >= rd - 0.5 && !!mit[left ? "fl" : "fr"];
    }
    const outer = [lo - (mLo ? add : 0), hi + (mHi ? add : 0)];
    const inner = [lo + (mLo ? CURB_LAP : 0), hi - (mHi ? CURB_LAP : 0)];
    // c1 is the edge this camera sees; on the entry/right runs it is also the
    // one facing out of the room, so it is the edge that carries the overhang.
    const outAtC1 = cs.side === "entry" || cs.side === "right";
    out.push({
      ci, side: cs.side, horiz, c0, c1: c0 + cw, lo, hi, mHi, len,
      eC0: outAtC1 ? inner : outer, eC1: outAtC1 ? outer : inner,
    });
  });
  return out;
}
// How far a curb run reaches PAST the room line at each corner, taken off the
// bands that actually draw. A curb butts into the wall at each end of its run,
// so this is equally how far that wall has to carry to finish FLUSH with it
// (owner 2026-08-03) — both drawings run off this one number, which is why they
// can't drift apart again.
//
// It is the curb's own drawn face, finish and all: in the ring, its width less
// the ½" it laps onto the pan; in "overall max", NOTHING — there the curb and
// the tile on its outer face sit inside the stated line, which is the line the
// wall already stands on, so they are flush without moving.
// A framed bench takes the curb's place along its own footprint — benchEdgeSpans
// subtracts it from the runs — and it carries out to the SAME outer face the
// curb would have. So a wall meeting a framed bench has to finish flush with it
// exactly as it does with a curb. Without these stand-ins the run simply is not
// there at that corner, `curbCornerOut` finds nothing to reach for, and the wall
// reads short by the overhang against its untouched opposite (owner 2026-08-04).
export function framedStandIns(benches, room, curbs, inset, CW) {
  const rd = +room.d || 0;
  if (!curbs || !curbs.length || (inset && inset.entry > 0)) return [];
  const add = round2(CW - CURB_LAP), out = [];
  (benches || []).forEach((b) => {
    if (b.build !== "framed" || b.suspended) return;
    const f = benchFootprint(b, room);
    if (f.kind !== "rect" || f.y + f.d < rd - 0.5) return;
    out.push({ side: "entry", horiz: true, c0: rd - CURB_LAP, c1: rd + add, lo: f.x, hi: f.x + f.w });
  });
  return out;
}
export function curbCornerOut(bands, rw, rd) {
  const out = { bl: 0, br: 0, fl: 0, fr: 0 };
  (bands || []).forEach((b) => {
    const max = b.horiz ? rw : rd;
    const past = b.side === "back" || b.side === "left" ? -b.c0
      : b.c1 - (b.side === "entry" ? rd : rw);
    if (!(past > 0)) return;
    const k = b.side === "left" ? ["bl", "fl"] : b.side === "right" ? ["br", "fr"]
      : b.side === "back" ? ["bl", "br"] : ["fl", "fr"];
    if (b.lo <= 0.5) out[k[0]] = Math.max(out[k[0]], past);
    if (b.hi >= max - 0.5) out[k[1]] = Math.max(out[k[1]], past);
  });
  return out;
}
// The band's plan outline: a rectangle, or a trapezoid where a corner miters.
export function bandPoly(b) {
  const [a0, a1] = b.eC0, [z0, z1] = b.eC1;
  return b.horiz
    ? [[a0, b.c0], [a1, b.c0], [z1, b.c1], [z0, b.c1]]
    : [[b.c0, a0], [b.c0, a1], [b.c1, z1], [b.c1, z0]];
}

export function topGeom(o, W_, H_, mini) {
  const pad = mini ? 6 : 46, padT = mini ? 6 : 30;
  const rw = o.room.w, rd = o.room.d;
  const sc = Math.min((W_ - pad * 2) / rw, (H_ - padT - (mini ? 6 : 42)) / rd);
  return { ox: (W_ - rw * sc) / 2, oy: padT, sc, rw, rd };
}

export { round2, inch, curbWidthOf };
