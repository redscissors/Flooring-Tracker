// The shared shower drawings (JSX half) — TopDown (plan) and Iso (isometric),
// extracted from WediConfigurator.jsx (issue 097 phase 1); both configurators
// feed the same geometry shape; must never import the wedi data/engine
// module. Geometry and constants live in ./showerdraw.js; this file adds only
// the two components and re-exports the whole module so a single import line
// covers both.
import { useId, useState } from "react";
import {
  PIECE_FILL, PIECE_SIDE, INK, MUTED, FAINT, MOSS, MOSS_DEEP, RUST, PAPER, FONT,
  CURB_H_LEAN, PAN_T_MIN, CURB_W_LEAN, panCap, slopeMarks, curbBands, framedStandIns,
  curbCornerOut, bandPoly, topGeom, WALL_THICK, CURB_LAP, panThick, benchFootprint,
  BENCH_DEPTH, round2, inch,
} from "./showerdraw.js";
export * from "./showerdraw.js";

// A fall arrow between two projected points. On the pan the shaft stops short
// of the drain so the head sits in open field, not on the cover; across an
// extension it runs nearly the full depth, its head at the pan joint. `cap`
// clamps the drawn length and head in screen px — a pan plane's run is many
// times an extension's, so only a px cap keeps the two marks the same size.
function fallArrow(a, b, key, col, wpx, span, cap) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const [f0, f1] = span || [0.12, 0.5];
  const run = Math.min(L * (f1 - f0), cap ? cap.max : Infinity);
  const s = [a[0] + ux * L * f0, a[1] + uy * L * f0];
  const e = [s[0] + ux * run, s[1] + uy * run];
  const hd = Math.min(cap ? cap.head : 5, run * 0.36), hw = hd * 0.48;
  return (
    <g key={key} pointerEvents="none">
      <line x1={round2(s[0])} y1={round2(s[1])} x2={round2(e[0] - ux * hd * 0.6)} y2={round2(e[1] - uy * hd * 0.6)} stroke={col} strokeWidth={wpx} />
      <polygon fill={col} points={[
        [e[0], e[1]], [e[0] - ux * hd + uy * hw, e[1] - uy * hd - ux * hw],
        [e[0] - ux * hd - uy * hw, e[1] - uy * hd + ux * hw],
      ].map((p) => round2(p[0]) + "," + round2(p[1])).join(" ")} />
    </g>
  );
}

// To-scale plan: wall bands at their TRUE lengths with the panel butt joints
// ticked on them, the pieces with their cut edges dashed, curb runs on the
// open edges, the drain (with the plumber's two measurements when it was
// pinned), 45° corner cuts chamfered off the pan, and dimensions.
export function TopDown({ o, w, h, mini, wallOn, dWalls, benches, framedFit, cuts, curbs, curbDiags, curbW, placing, onCorner, onEdge, onWallMenu, onBenchMenu, itemFn, normBenchFn }) {
  const g = topGeom(o, w, h, mini);
  // the build's curb profile and what it adds outside the pan line
  const CW = curbW || CURB_W_LEAN, CADD = round2(CW - CURB_LAP);
  const { ox, oy, sc, rw, rd } = g;
  // The pan divides into bench zones (owner spec, issue 069): a band along
  // each walled side and a box at each corner. Hover previews the footprint,
  // click or right-click opens the bench menu for that spot.
  const [benchZone, setBenchZone] = useState(null);
  // The rail and the print sheet both mount a plan at once, so the clip ids
  // have to be per-instance. useId's colons are legal in an id but not in every
  // url() parser, so they come out.
  const uid = useId().replace(/:/g, "");
  const X = (x) => round2(ox + x * sc), Y = (y) => round2(oy + y * sc);
  // An SVG stroke sits CENTRED on its path, so half of it paints OUTSIDE the
  // shape. On a part that is drawn butting another — the curb against the wall
  // it meets, a bench against the curb it rides out to — that half-stroke is
  // what reads as the part sticking past its neighbour, even with the geometry
  // dead flush (owner 2026-08-03). Clipping a shape to itself keeps every drop
  // of paint inside the part. Clipping halves what a stroke shows, so each user
  // sets its own width back: the curb goes 1 → 1.6 (0.8 showing, a shade
  // lighter than it was — the owner called it thick), the bench 1.2 → 2.4 (1.2
  // showing, unchanged). The bench needs every bit of it: its fill is two
  // points off the pan's, so the outline is the only thing that says bench.
  let clipN = 0;
  const clipSelf = (pts) => {
    const id = `${uid}cl${clipN++}`;
    push(<clipPath key={id} id={id}><polygon points={pts} /></clipPath>);
    return `url(#${id})`;
  };
  const boxPts = (x, y, w2, h2) => `${x},${y} ${x + w2},${y} ${x + w2},${y + h2} ${x},${y + h2}`;
  // Walls draw at their true 4" framing depth (owner sketch 2026-07-30);
  // the thumbnails keep a hairline band.
  const wallW = mini ? 2.5 : round2(4 * sc);
  const on = wallOn || {};
  const els = [];
  const push = (el) => els.push(el);

  // The room outline itself chamfers at a curbed cut corner — the off-cut is
  // outside the shower, so nothing (not even the floor outline) draws there.
  const diagOfC = {};
  if (!mini) (curbDiags || []).forEach((d) => { diagOfC[d.corner] = d; });
  if (Object.keys(diagOfC).length) {
    const fp = [];
    const cornerPts = (k, px, py, pre, post) => {
      const d = diagOfC[k];
      if (d) { fp.push(pre(d)); fp.push(post(d)); } else fp.push([px, py]);
    };
    cornerPts("bl", 0, 0, (d) => [0, d.v], (d) => [d.h, 0]);
    cornerPts("br", rw, 0, (d) => [rw - d.h, 0], (d) => [rw, d.v]);
    cornerPts("fr", rw, rd, (d) => [rw, rd - d.v], (d) => [rw - d.h, rd]);
    cornerPts("fl", 0, rd, (d) => [d.h, rd], (d) => [0, rd - d.v]);
    push(<polygon key="floor" points={fp.map((p) => X(p[0]) + "," + Y(p[1])).join(" ")} fill={PAPER} stroke={FAINT} strokeWidth="1" />);
  } else {
    push(<rect key="floor" x={X(0)} y={Y(0)} width={round2(rw * sc)} height={round2(rd * sc)} fill={PAPER} stroke={FAINT} strokeWidth="1" />);
  }
  // The wall bands. With dWalls (the full drawing) every wall draws at its own
  // length so a shortened or added wall reads back; the thumbnails keep the
  // simple on/off full-span bands.
  const dw = !mini && dWalls && dWalls.length ? dWalls : null;
  // Right-click a wall band for its menu (size + which faces get wedi).
  const bandProps = (wl) => (onWallMenu ? {
    className: "wband",
    onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); onWallMenu({ wid: wl.wid, extra: !!wl.extra }, ev.clientX, ev.clientY); },
  } : {});
  const bandTitle = onWallMenu ? <title>right-click — wall size &amp; wedi faces</title> : null;
  // Corner ownership — the rule the ISOMETRIC already draws to, brought over to
  // the plan (owner 2026-08-03, "the added wall goes all the way to the end vs
  // just against the side wall"). The back and entry runs carry THROUGH their
  // corners and the side walls butt into their faces; a run only reaches into a
  // corner some perpendicular wall actually fills. Every band used to overhang
  // its origin corner by the wall thickness unconditionally, and the far one
  // too once it reached full length — so a run hung 4" out over open air where
  // no wall met it, and an added wall (drawn MOSS) painted over the grey side
  // wall it returns from.
  // A wall's run along its own edge. `at: "hi"` anchors it at the far end — the
  // half wall returning from the RIGHT side wall rather than the left.
  const runOf = (wl) => {
    const max = wl.side === "left" || wl.side === "right" ? rd : rw;
    const len = Math.min(wl.len, max);
    const from = wl.at === "hi" ? round2(max - len) : 0;
    return { max, len, from, lo: from <= 0.5, hi: from + len >= max - 0.5 };
  };
  // Corner ownership. At the BACK the back wall runs through and the side walls
  // butt into it. At the FRONT it is the other way round (owner 2026-08-03):
  // the SIDE wall carries all the way to the front and the front wall butts
  // against it — that is how the walls actually get framed, the side wall being
  // the continuous one. Either way exactly one slab claims each corner square,
  // and only where something is actually standing in it.
  const reach = (want) => (dw || []).reduce((m, x) => {
    if (!want.includes(x.side)) return m;
    const r = runOf(x);
    if (!(r.len > 0.5)) return m;
    const k = x.side === "left" ? ["bl", "fl"] : x.side === "right" ? ["br", "fr"]
      : x.side === "back" ? ["bl", "br"] : ["fl", "fr"];
    if (r.lo) m[k[0]] = true;
    if (r.hi) m[k[1]] = true;
    return m;
  }, { bl: false, br: false, fl: false, fr: false });
  const sideAt = reach(["left", "right"]);    // where a side wall stands
  const frontAt = reach(["entry"]);           // where a front wall stands
  const backAt = reach(["back"]);             // where the back wall stands
  // A band that stopped on the pan line read short by the curb's own overhang,
  // with the curb running past it into open air. Every wall now finishes flush
  // with the curb it meets (curbCornerOut).
  const planBands = mini ? [] : curbBands(curbs, rw, rd, o.inset, CW);
  const curbOut = mini ? null
    : curbCornerOut(planBands.concat(framedStandIns(benches, o.room, curbs, o.inset, CW)), rw, rd);
  const outAt = (k) => (curbOut ? round2(curbOut[k] * sc) : 0);
  if (dw) {
    dw.forEach((wl, wi) => {
      const horiz = wl.side === "back" || wl.side === "entry";
      const r = runOf(wl);
      if (!(r.len > 0)) return;
      const fill = wl.extra ? MOSS : MUTED;
      if (horiz) {
        // The back run carries through to a side wall; the front run butts one.
        const back = wl.side === "back";
        const k = back ? ["bl", "br"] : ["fl", "fr"];
        // The back run claims its corners; the front run yields them to the
        // side wall — but with no side wall standing there, either still has to
        // meet the curb turning the corner.
        const ext = (reaches, ki) => (!reaches ? 0
          : back ? Math.max(sideAt[ki] ? wallW : 0, outAt(ki))
            : sideAt[ki] ? 0 : outAt(ki));
        const lo = ext(r.lo, k[0]), hi = ext(r.hi, k[1]);
        push(<rect key={`w${wi}`} {...bandProps(wl)} x={round2(X(r.from) - lo)} y={back ? Y(0) - wallW : Y(rd)} width={round2(r.len * sc + lo + hi)} height={wallW} fill={fill}>{bandTitle}</rect>);
      } else {
        // A side wall carries into the front corner whenever a front wall is
        // standing there to butt it; with nothing there it stops on the line —
        // or on the curb's outer face where a curb runs into it.
        const left = wl.side === "left";
        const kLo = left ? "bl" : "br", kHi = left ? "fl" : "fr";
        const lo = r.lo && !backAt[kLo] ? outAt(kLo) : 0;
        const hi = r.hi ? Math.max(frontAt[kHi] ? wallW : 0, outAt(kHi)) : 0;
        push(<rect key={`w${wi}`} {...bandProps(wl)} x={left ? X(0) - wallW : X(rw)} y={round2(Y(r.from) - lo)} width={wallW} height={round2(r.len * sc + lo + hi)} fill={fill}>{bandTitle}</rect>);
      }
    });
    // Extra wedi faces read as moss edges: the outside face when a wall
    // panels both sides, the end of the run when its exposed end is covered.
    dw.forEach((wl, wi) => {
      const f = wl.faces || "in";
      if (f === "in") return;
      const horiz = wl.side === "back" || wl.side === "entry";
      const r = runOf(wl);
      if (!(r.len > 0)) return;
      // The exposed END is whichever end of the run is NOT against a corner.
      const end = r.from + r.len, endU = wl.at === "hi" ? r.from : end;
      if (f === "both") {
        if (wl.side === "back") push(<line key={`fo${wi}`} x1={X(r.from)} y1={Y(0) - wallW} x2={X(end)} y2={Y(0) - wallW} stroke={MOSS} strokeWidth="2.4" />);
        else if (wl.side === "entry") push(<line key={`fo${wi}`} x1={X(r.from)} y1={Y(rd) + wallW} x2={X(end)} y2={Y(rd) + wallW} stroke={MOSS} strokeWidth="2.4" />);
        else {
          const fx = wl.side === "left" ? X(0) - wallW : X(rw) + wallW;
          push(<line key={`fo${wi}`} x1={fx} y1={Y(r.from)} x2={fx} y2={Y(end)} stroke={MOSS} strokeWidth="2.4" />);
        }
      } else if (f === "in-end") {
        if (horiz) {
          const ey = wl.side === "back" ? Y(0) - wallW : Y(rd);
          push(<line key={`fe${wi}`} x1={X(endU)} y1={ey} x2={X(endU)} y2={ey + wallW} stroke={MOSS} strokeWidth="2.4" />);
        } else {
          const ex = wl.side === "left" ? X(0) - wallW : X(rw);
          push(<line key={`fe${wi}`} x1={ex} y1={Y(endU)} x2={ex + wallW} y2={Y(endU)} stroke={MOSS} strokeWidth="2.4" />);
        }
      }
    });
    dw.forEach((wl, wi) => {
      const horiz = wl.side === "back" || wl.side === "entry";
      const r = runOf(wl);
      const joints = {};
      // Courses are measured from the wall's OWN start, which is `r.from` once
      // the run can be anchored at the far end.
      (wl.courses || []).forEach((c) => {
        let u = 0;
        c.lens.slice(0, -1).forEach((len) => { u = round2(u + len); if (u < r.len - 0.5) joints[round2(r.from + u)] = 1; });
      });
      Object.keys(joints).forEach((uk) => {
        const u = +uk;
        if (horiz) {
          const by = wl.side === "back" ? Y(0) - wallW - 1 : Y(rd) - 1;
          push(<line key={`j${wi}-${uk}`} x1={X(u)} y1={by} x2={X(u)} y2={by + wallW + 2} stroke="#F6F3EC" strokeWidth="1.3" strokeDasharray="2 2" />);
        } else {
          const bx = wl.side === "left" ? X(0) - wallW - 1 : X(rw) - 1;
          push(<line key={`j${wi}-${uk}`} x1={bx} y1={Y(u)} x2={bx + wallW + 2} y2={Y(u)} stroke="#F6F3EC" strokeWidth="1.3" strokeDasharray="2 2" />);
        }
      });
    });
  } else {
    const lo = on.left ? wallW : 0, hi = on.right ? wallW : 0;   // back carries through
    if (on.back) push(<rect key="wb" x={round2(X(0) - lo)} y={Y(0) - wallW} width={round2(rw * sc + lo + hi)} height={wallW} fill={MUTED} />);
    if (on.left) push(<rect key="wl" x={X(0) - wallW} y={Y(0)} width={wallW} height={round2(rd * sc)} fill={MUTED} />);
    if (on.right) push(<rect key="wr" x={X(rw)} y={Y(0)} width={wallW} height={round2(rd * sc)} fill={MUTED} />);
  }

  o.pieces.forEach((p, i) => {
    push(<rect key={`p${i}`} x={X(p.x)} y={Y(p.y)} width={round2(p.w * sc)} height={round2(p.d * sc)} fill={PIECE_FILL[p.kind] || "#EFF3E6"} stroke={INK} strokeWidth="1.1" />);
    if (p.cut) {
      const cxe = o.mirrored ? X(p.x) : X(p.x + p.w);
      if (p.w < p.cut.w - 0.01) push(<line key={`cw${i}`} x1={cxe} y1={Y(p.y)} x2={cxe} y2={Y(p.y + p.d)} stroke={RUST} strokeWidth="2" strokeDasharray="5 3" />);
      if (p.d < p.cut.d - 0.01) push(<line key={`cd${i}`} x1={X(p.x)} y1={Y(p.y + p.d)} x2={X(p.x + p.w)} y2={Y(p.y + p.d)} stroke={RUST} strokeWidth="2" strokeDasharray="5 3" />);
    }
    if (!mini && p.d * sc >= 26 && p.w * sc >= 46) {
      const cx = X(p.x + p.w / 2), cy = Y(p.y + p.d / 2);
      const lbl = p.kind === "pan" || p.kind === "module" ? (p.item.erp || p.item.us) : p.item.us || p.item.erp;
      const sz = inch(p.w) + "×" + inch(p.d) + (p.cut ? " cut" : "");
      // The drain paints after the pieces, so wherever it lands under a piece's
      // label it buries it — which a centre drain always does. Slide the pair to
      // whichever side of the drain and its callout has room for it; leave it
      // centred when the two don't actually collide.
      const drn = o.drain;
      let base = cy - 9;
      if (drn && drn.x >= p.x - 0.01 && drn.x <= p.x + p.w + 0.01 && drn.y >= p.y - 0.01 && drn.y <= p.y + p.d + 0.01) {
        const lin = drn.type === "linear" && drn.len, ds = Math.max(10, 4 * sc);
        const halfW = lin ? (drn.axis === "w" ? drn.len / 2 : 1.4) * sc : ds / 2;
        const halfH = lin ? (drn.axis === "w" ? 1.4 : drn.len / 2) * sc : ds / 2;
        const top = Y(drn.y) - halfH, bot = Y(drn.y) + (lin ? halfH + 14 : 21);
        const textHalf = Math.max(lbl.length * 2.8, sz.length * 2.5) + 3;
        if (Math.abs(X(drn.x) - cx) < halfW + textHalf && base + 3 > top && base - 19 < bot) {
          if (top - 25 >= Y(p.y)) base = top - 6;
          else if (bot + 26 <= Y(p.y + p.d)) base = bot + 23;
        }
      }
      push(<text key={`l${i}`} x={cx} y={round2(base - 11)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={MOSS_DEEP} fontFamily={FONT}>{lbl}</text>);
      push(<text key={`s${i}`} x={cx} y={round2(base)} textAnchor="middle" fontSize="8.5" fill={MUTED} fontFamily={FONT}>{sz}</text>);
    }
  });
  if (!mini && o.pieces.length > 1) {
    o.pieces.slice(1).forEach((p, i) => {
      push(<rect key={`sm${i}`} x={X(p.x)} y={Y(p.y)} width={round2(p.w * sc)} height={round2(p.d * sc)} fill="none" stroke={MOSS} strokeWidth="1" strokeDasharray="2 2" />);
    });
  }
  // The fall to the drain — hips corner→drain, one arrow per slope plane.
  const slope = mini ? null : slopeMarks(o);
  if (slope) {
    slope.hips.forEach((s, i) => push(<line key={`sh${i}`} x1={X(s[0][0])} y1={Y(s[0][1])} x2={X(s[1][0])} y2={Y(s[1][1])}
      stroke="rgba(28,26,23,.22)" strokeWidth="1" pointerEvents="none" />));
    slope.arrows.forEach((s, i) => push(fallArrow([X(s.a[0]), Y(s.a[1])], [X(s.b[0]), Y(s.b[1])], `sa${i}`, "rgba(28,26,23,.42)", 1.2, s.f, s.pan ? panCap(sc) : null)));
  }

  const BENCH_CORNER_TRI = {
    bl: (a) => [[0, 0], [a, 0], [0, a]], br: (a) => [[rw, 0], [rw - a, 0], [rw, a]],
    fl: (a) => [[0, rd], [a, rd], [0, rd - a]], fr: (a) => [[rw, rd], [rw - a, rd], [rw, rd - a]],
  };
  const benchTag = (b) => (b.build === "premade" ? (itemFn(b.part) || {}).us || "premade"
    : b.build === "framed" ? "framed · ½\" wrap" : '2" wedi');
  // Benches draw over the pan AND over the curb band: a bench reaching the
  // entry runs on out over the curb line, riding a run that now carries on
  // beneath it (only a framed bench displaces the curb, and it marks the pan
  // cut along its face in the same rust dash a cut-down pan wears).
  const benchBand = (b, bi) => {
    const f = benchFootprint(b, o.room);
    if (f.kind === "corner") {
      const pts = BENCH_CORNER_TRI[f.corner](f.a);
      const s = pts.map((p) => X(p[0]) + "," + Y(p[1])).join(" ");
      push(<polygon key={`bn${bi}`} points={s}
        fill="#DCE0C8" stroke={MOSS_DEEP} strokeWidth="2.4" clipPath={clipSelf(s)} />);
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      push(<text key={`bnt${bi}`} x={X(cx)} y={Y(cy) + 3} textAnchor="middle" fontSize="7.5" fontWeight="800" fill={MOSS_DEEP} fontFamily={FONT}>{inch(f.a) + '"'}</text>);
      return;
    }
    const out = !b.suspended && curbs && curbs.length && !(o.inset && o.inset.entry > 0) && f.y + f.d >= rd - 0.5 ? CADD : 0;
    const bw = round2(f.w * sc), bh = round2(f.d * sc + out * sc);
    push(<rect key={`bn${bi}`} x={X(f.x)} y={Y(f.y)} width={bw} height={bh}
      fill="#DCE0C8" stroke={MOSS_DEEP} strokeWidth="2.4" clipPath={clipSelf(boxPts(X(f.x), Y(f.y), bw, bh))} />);
    // Where the bench crosses the curb it STEPS UP onto it (owner 2026-08-03) —
    // the isometric shows that as a notch in its underside, and this view had no
    // sign of it at all: the bench simply covered the run and the one line that
    // reads straight across the entry died under it. The curb's own edges now
    // carry on over the bench in its colour, so the raised stretch reads as
    // raised and the run still reads as one line.
    const eb = !b.suspended && planBands.find((x) => x.side === "entry");
    if (eb && f.y + f.d >= rd - 0.5) {
      const lx = X(f.x), rx = X(f.x + f.w);
      [eb.c0, eb.c1].forEach((cy2, i) => {
        if (cy2 <= f.y + 0.01 || cy2 * sc > (f.y + f.d + out) * sc + 0.01) return;
        push(<line key={`bnc${bi}s${i}`} x1={lx} y1={Y(cy2)} x2={rx} y2={Y(cy2)}
          stroke={MOSS_DEEP} strokeWidth="1.2" strokeDasharray={i ? undefined : "4 3"} />);
      });
    }
    if (b.build === "framed" && !framedFit) {
      // wall to wall along the PAN — short of the line when the curb is inside it
      const yPan = rd - (o.inset && o.inset.entry > 0 ? o.inset.entry : 0);
      const fx = b.side === "left" ? f.x + f.w : b.side === "right" ? f.x : null;
      if (fx != null) push(<line key={`bnc${bi}`} x1={X(fx)} y1={Y(0)} x2={X(fx)} y2={Y(yPan)} stroke={RUST} strokeWidth="2" strokeDasharray="5 3" />);
      else push(<line key={`bnc${bi}`} x1={X(f.x)} y1={Y(f.d)} x2={X(f.x + f.w)} y2={Y(f.d)} stroke={RUST} strokeWidth="2" strokeDasharray="5 3" />);
    }
    const horiz = b.side === "back";
    const cx = X(f.x + f.w / 2), cy = Y(f.y + (f.d + out) / 2);
    const lbl = "BENCH " + (horiz ? inch(f.w) : inch(f.d)) + "×" + (horiz ? inch(f.d) : inch(f.w)) + '"';
    if ((horiz ? f.w : f.d) * sc >= 40) {
      push(horiz
        ? <text key={`bnt${bi}`} x={cx} y={cy - 2} textAnchor="middle" fontSize="7.5" fontWeight="800" fill={MOSS_DEEP} fontFamily={FONT} letterSpacing=".5">{lbl}</text>
        : <text key={`bnt${bi}`} x={cx} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="800" fill={MOSS_DEEP} fontFamily={FONT} letterSpacing=".5" transform={`rotate(-90 ${cx} ${cy})`}>{lbl}</text>);
      push(horiz
        ? <text key={`bns${bi}`} x={cx} y={cy + 8} textAnchor="middle" fontSize="6.5" fontWeight="600" fill={MUTED} fontFamily={FONT}>{benchTag(b)}</text>
        : <text key={`bns${bi}`} x={cx + 9} y={cy} textAnchor="middle" fontSize="6.5" fontWeight="600" fill={MUTED} fontFamily={FONT} transform={`rotate(-90 ${cx + 9} ${cy})`}>{benchTag(b)}</text>);
    }
  };

  if (!mini) {
    const CGEOM = { bl: [0, 0, 1, 1], br: [rw, 0, -1, 1], fl: [0, rd, 1, -1], fr: [rw, rd, -1, -1] };
    // Corner cuts: the pan keeps its full size and the rust dashed line marks
    // the cut. With a curb riding the cut, the off-cut triangle is OUTSIDE
    // the shower — cut and hidden (owner rule 2026-07-30); with no curb
    // (curbless) it stays ghosted to the extension tint. The legs come
    // from curbRuns — a wall ending near the corner pulls the line straight
    // to its end (owner rule: wall to wall, no dogleg).
    (cuts || []).forEach((d) => {
      const g2 = CGEOM[d.corner];
      if (!g2) return;
      const [cx, cy, dx, dy] = g2;
      const curbed = (curbDiags || []).some((x) => x.corner === d.corner);
      // curbed: ERASE the off-cut — the paper stroke widens the wipe past the
      // pan's own outline so no hairline of it survives; the rust cut line
      // and the curb redraw the boundary. Curbless keeps the ghost.
      push(<polygon key={`cf${d.corner}`} points={`${X(cx)},${Y(cy)} ${X(cx + dx * d.h)},${Y(cy)} ${X(cx)},${Y(cy + dy * d.v)}`}
        fill={curbed ? PAPER : "#EFF3E6"} stroke={curbed ? PAPER : FAINT} strokeWidth={curbed ? 3 : 1} strokeLinejoin="round" />);
      push(<line key={`c${d.corner}`} x1={X(cx + dx * d.h)} y1={Y(cy)} x2={X(cx)} y2={Y(cy + dy * d.v)} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />);
      if (d.h === d.v) push(<text key={`ct${d.corner}`} x={X(cx + dx * d.h * 0.42)} y={Y(cy + dy * d.v * 0.42) + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={RUST} fontFamily={FONT}>45°</text>);
    });
    // Curb runs sit IN the wall band, butted between the wall sections
    // (owner sketch) — same ring the walls draw in, slightly thinner. The
    // engine's ext0/ext1 fill the open ring corners, drawn as a MITER so two
    // runs meeting there share one 45° line, and a cut corner's curb takes the
    // one straight line across.
    planBands.forEach((b) => {
      const pts = bandPoly(b).map((p) => X(p[0]) + "," + Y(p[1])).join(" ");
      push(<polygon key={`cb${b.ci}`} points={pts}
        fill="#E9E3D3" stroke={MUTED} strokeWidth="1.6" strokeLinejoin="round" clipPath={clipSelf(pts)} />);
      if (!(b.len * sc > 34)) return;
      const mid = (b.lo + b.hi) / 2, cross = (b.c0 + b.c1) / 2;
      if (b.horiz) {
        push(<text key={`cbt${b.ci}`} x={X(mid)} y={Y(cross) + 2.5} textAnchor="middle" fontSize="7" fontWeight="700" fill={MUTED} fontFamily={FONT} letterSpacing="1.5">CURB</text>);
      } else {
        const tx = X(cross), ty = Y(mid) + 2.5;
        push(<text key={`cbt${b.ci}`} x={tx} y={ty} textAnchor="middle" fontSize="7" fontWeight="700" fill={MUTED} fontFamily={FONT} letterSpacing="1.5" transform={`rotate(-90 ${tx} ${ty})`}>CURB</text>);
      }
    });
    (curbDiags || []).forEach((d, i) => {
      const g2 = CGEOM[d.corner];
      if (!g2) return;
      const [cx, cy, dx, dy] = g2;
      // the band rides the OUTSIDE of the cut edge (owner markup) — its notch
      // laps the pan by ½" past the cut line, ends squared to the edges so it
      // butts the walls/runs flush; the outer edge is the piece's longest point
      const ax = cx + dx * d.h, ay = cy, bx = cx, by = cy + dy * d.v;
      const a1x = ax, a1y = ay + dy * CURB_LAP, b1x = bx + dx * CURB_LAP, b1y = by;
      const a2x = ax, a2y = ay - dy * CADD, b2x = bx - dx * CADD, b2y = by;
      push(<polygon key={`cdg${i}`} points={`${X(a1x)},${Y(a1y)} ${X(b1x)},${Y(b1y)} ${X(b2x)},${Y(b2y)} ${X(a2x)},${Y(a2y)}`}
        fill="#E9E3D3" stroke={MUTED} strokeWidth="1" />);
      // the lap buries the pan's cut mark — restate it over the band, since
      // where to cut is the whole point of the line
      push(<line key={`cdc${i}`} x1={X(ax)} y1={Y(ay)} x2={X(bx)} y2={Y(by)} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />);
    });
    (benches || []).forEach(benchBand);
  }

  const dr = o.drain;
  if (dr) {
    if (dr.type === "linear" && dr.len) {
      const half = dr.len / 2;
      const hx = dr.axis === "w" ? half : 1.4, hy = dr.axis === "w" ? 1.4 : half;
      push(<rect key="dr" x={X(dr.x - hx)} y={Y(dr.y - hy)} width={round2(hx * 2 * sc)} height={round2(hy * 2 * sc)} rx="2.5" fill={INK} />);
      if (!mini) {
        const lx = dr.axis === "w" ? X(dr.x) : X(dr.x + hx) + 11, ly = dr.axis === "w" ? Y(dr.y + hy) + 11 : Y(dr.y);
        push(<text key="drt" x={lx} y={ly} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={INK} fontFamily={FONT}
          transform={dr.axis === "w" ? undefined : `rotate(-90 ${lx} ${ly})`}>{inch(dr.len) + '" channel'}</text>);
      }
    } else {
      // Point drains draw square — the 4×4 cover is what the installer sees.
      const ds = mini ? 6 : Math.max(10, round2(4 * sc));
      push(<rect key="dr" x={round2(X(dr.x) - ds / 2)} y={round2(Y(dr.y) - ds / 2)} width={ds} height={ds} fill={PAPER} stroke={INK} strokeWidth="1.4" />);
      push(<rect key="dr2" x={round2(X(dr.x) - ds / 6)} y={round2(Y(dr.y) - ds / 6)} width={round2(ds / 3)} height={round2(ds / 3)} fill={INK} />);
    }
    if (!mini && dr.type !== "linear") {
      push(<text key="drl" x={X(dr.x)} y={Y(dr.y) + 18} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={INK} fontFamily={FONT}>
        {dr.type + " drain @ " + inch(dr.x) + '", ' + inch(dr.y) + '"'}</text>);
    }
    // The plumber's two measurements. A channel takes them too: its 2" waste
    // sits under the middle of the channel, which is the point drawn.
    // A run too short to carry its own figure is left off — a channel 2 7/8"
    // off the wall would draw a dimension shorter than the text on it.
    if (!mini && (o.kind === "drainat" || (dr.type === "linear" && dr.len))) {
      if (dr.x * sc > 26) {
        push(<line key="mx" x1={X(0)} y1={Y(dr.y)} x2={X(dr.x) - 9} y2={Y(dr.y)} stroke={RUST} strokeWidth="1" strokeDasharray="3 3" />);
        push(<text key="mxt" x={X(dr.x / 2)} y={Y(dr.y) - (dr.type === "linear" ? 9 : 4)} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={RUST} fontFamily={FONT}>{inch(dr.x) + '"'}</text>);
      }
      if (dr.y * sc > 26) {
        push(<line key="my" x1={X(dr.x)} y1={Y(0)} x2={X(dr.x)} y2={Y(dr.y) - 9} stroke={RUST} strokeWidth="1" strokeDasharray="3 3" />);
        push(<text key="myt" x={X(dr.x) + 4} y={Y(dr.y / 2)} fontSize="8.5" fontWeight="800" fill={RUST} fontFamily={FONT}>{inch(dr.y) + '"'}</text>);
      }
    }
  }

  if (!mini) {
    const dy = Y(rd) + wallW + 12, dx = X(0) - wallW - 10;
    push(<line key="dw" x1={X(0)} y1={dy} x2={X(rw)} y2={dy} stroke={FAINT} strokeWidth="1" />);
    push(<text key="dwt" x={X(rw / 2)} y={dy - 3} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={MUTED} fontFamily={FONT}>{inch(rw) + '"'}</text>);
    push(<line key="dd" x1={dx} y1={Y(0)} x2={dx} y2={Y(rd)} stroke={FAINT} strokeWidth="1" />);
    push(<text key="ddt" x={dx - 4} y={Y(rd / 2)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={MUTED} fontFamily={FONT}
      transform={`rotate(-90 ${dx - 4} ${Y(rd / 2)})`}>{inch(rd) + '"'}</text>);
    push(<text key="ent" x={X(rw / 2)} y={Y(rd - (o.inset && o.inset.entry > 0 ? o.inset.entry : 0)) - 6} textAnchor="middle" fontSize="8.5" fill={FAINT} fontFamily={FONT}>↓ entry</text>);
  }

  // Bench zones. The tight 10" corner radius keeps the corner-CUT toggle;
  // past it — but still on the pan — the corner boxes and the side bands are
  // bench territory, previewed on hover.
  const zoneKey = (z) => (z ? z.kind + ":" + (z.side || z.corner) : "");
  const zoneAt = (x, y) => {
    if (!onBenchMenu || x < -1 || y < -1 || x > rw + 1 || y > rd + 1) return null;
    // the tight radius right at a corner stays the corner-CUT toggle
    if (Math.hypot(x, y) < 10 || Math.hypot(x - rw, y) < 10 || Math.hypot(x, y - rd) < 10 || Math.hypot(x - rw, y - rd) < 10) return null;
    const cz = 15;
    if (x < cz && y < cz) return { kind: "corner", corner: "bl" };
    if (x > rw - cz && y < cz) return { kind: "corner", corner: "br" };
    if (x < cz && y > rd - cz) return { kind: "corner", corner: "fl" };
    if (x > rw - cz && y > rd - cz) return { kind: "corner", corner: "fr" };
    const cand = [["back", y], ["left", x], ["right", rw - x]].filter((c) => c[1] <= BENCH_DEPTH);
    if (!cand.length) return null;
    cand.sort((a, c) => a[1] - c[1]);
    return { kind: "wall", side: cand[0][0] };
  };
  if (!mini && benchZone && !placing && !(benches || []).some((b) => zoneKey(b) === zoneKey(benchZone))) {
    const f = benchFootprint(normBenchFn(benchZone, o.room), o.room);
    const zf = "rgba(87,112,58,.15)";
    if (f.kind === "corner") {
      const pts = BENCH_CORNER_TRI[f.corner](f.a);
      push(<polygon key="bz" points={pts.map((p) => X(p[0]) + "," + Y(p[1])).join(" ")} fill={zf} stroke={MOSS} strokeWidth="1.2" strokeDasharray="4 3" />);
      push(<text key="bzt" x={X((pts[0][0] + pts[1][0] + pts[2][0]) / 3)} y={Y((pts[0][1] + pts[1][1] + pts[2][1]) / 3) + 3}
        textAnchor="middle" fontSize="7.5" fontWeight="800" fill={MOSS} fontFamily={FONT}>+ bench</text>);
    } else {
      push(<rect key="bz" x={X(f.x)} y={Y(f.y)} width={round2(f.w * sc)} height={round2(f.d * sc)} fill={zf} stroke={MOSS} strokeWidth="1.2" strokeDasharray="4 3" />);
      push(<text key="bzt" x={X(f.x + f.w / 2)} y={Y(f.y + f.d / 2) + 3} textAnchor="middle" fontSize="7.5" fontWeight="800" fill={MOSS} fontFamily={FONT}>+ bench</text>);
    }
  }

  const clickable = !mini && (onCorner || onEdge || onBenchMenu);
  const ptIn = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) * (w / r.width) - ox) / sc,
      y: ((ev.clientY - r.top) * (h / r.height) - oy) / sc,
    };
  };
  const click = (ev) => {
    const { x, y } = ptIn(ev);
    const near = 10;
    const corner = Math.hypot(x, y) < near ? "bl" : Math.hypot(x - rw, y) < near ? "br"
      : Math.hypot(x, y - rd) < near ? "fl" : Math.hypot(x - rw, y - rd) < near ? "fr" : null;
    if (corner) { onCorner?.(corner); return; }
    if (placing) {
      const dists = [["back", Math.abs(y)], ["entry", Math.abs(y - rd)], ["left", Math.abs(x)], ["right", Math.abs(x - rw)]];
      dists.sort((a, b) => a[1] - b[1]);
      // Which HALF of the edge you clicked picks the end the wall returns from,
      // so a right-hand half wall is one click, not a click and a toggle.
      const side = dists[0][0];
      const horiz = side === "back" || side === "entry";
      onEdge?.(side, { rw, rd, at: (horiz ? x > rw / 2 : y > rd / 2) ? "hi" : "lo" });
      return;
    }
    const z = zoneAt(x, y);
    if (z) onBenchMenu(z, ev.clientX, ev.clientY);
  };
  const ctx = (ev) => {
    const { x, y } = ptIn(ev);
    const z = zoneAt(x, y);
    if (!z) return;
    ev.preventDefault();
    onBenchMenu(z, ev.clientX, ev.clientY);
  };
  const move = (ev) => {
    const { x, y } = ptIn(ev);
    const z = zoneAt(x, y);
    setBenchZone((cur) => (zoneKey(cur) === zoneKey(z) ? cur : z));
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} onClick={clickable ? click : undefined}
      onContextMenu={!mini && onBenchMenu ? ctx : undefined}
      onMouseMove={!mini && onBenchMenu ? move : undefined}
      onMouseLeave={!mini && onBenchMenu ? () => setBenchZone(null) : undefined}
      style={clickable ? { cursor: placing ? "crosshair" : "pointer" } : undefined}>{els}</svg>
  );
}

// The isometric: walls as true 4"-thick slabs at their own heights, the Fit
// plan's level courses and butt joints dotted on the inner faces, the pieces
// as thick slabs. Walls in FRONT of the shower (entry + right side) draw
// clear — dashed edges, no body — so they never hide the pan.
export function Iso({ o, w, h, dWalls, panelFit, benches, framedFit, cuts, curbs, curbDiags, curbH, curbW, onWallMenu }) {
  const rw = o.room.w, rd = o.room.d;
  const dw = dWalls || [];
  const T = WALL_THICK;
  const hmax = Math.min(dw.reduce((m, x) => Math.max(m, x.h), 0) || 80, 96);
  const P = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
  const pts = [
    P(-T - 3, -T - 3, 0), P(rw + T + 3, -T - 3, 0), P(-T - 3, rd + T + 3, 0), P(rw + T + 3, rd + T + 3, 0),
    P(-T, -T, hmax), P(rw + T, -T, hmax), P(-T, rd + T, hmax), P(rw + T, rd + T, hmax),
  ];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  const pad = 14;
  const sc = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  // The projected diamond is far narrower than it is tall, so the axis that
  // didn't set the scale has real slack — split it instead of leaving it all on
  // one side, which parked the shower against the left edge.
  const offX = (w - (maxX - minX) * sc) / 2, offY = (h - (maxY - minY) * sc) / 2;
  const M = (x, y, z) => { const p = P(x, y, z); return [round2(offX + (p[0] - minX) * sc), round2(offY + (p[1] - minY) * sc)]; };
  const str = (arr) => arr.map((p) => p[0] + "," + p[1]).join(" ");
  const els = [];
  const wallLine = "rgba(28,26,23,.45)", seamCol = "rgba(28,26,23,.5)";
  // The plan's stroke rule, brought over here (owner 2026-08-03, pointing at
  // this view): a centred stroke paints half its width outside its face, so
  // where the bench rides onto the curb their silhouettes each overhung the
  // other and the shared edge read as one heavy doubled line. Clipping a face
  // to itself only trims the SILHOUETTE — two faces of the same solid still
  // contribute half each along the edge they share, so an interior fold keeps
  // its weight while the outline stops bleeding onto its neighbour.
  const uid = useId().replace(/:/g, "");
  let clipN = 0;
  const clipPoly = (key, pts, props) => {
    const id = `${uid}cl${clipN++}`;
    els.push(<clipPath key={`${id}c`} id={id}><polygon points={pts} /></clipPath>);
    els.push(<polygon key={key} points={pts} {...props} clipPath={`url(#${id})`} />);
  };

  els.push(<polygon key="ground" points={str([M(-T - 3, -T - 3, 0), M(rw + T + 3, -T - 3, 0), M(rw + T + 3, rd + T + 3, 0), M(-T - 3, rd + T + 3, 0)])} fill="rgba(28,26,23,.06)" />);

  // The curb geometry is figured before the walls, not after: a wall runs out
  // flush with the curb it meets, so the slabs need the bands to know where
  // they end. Pan and curb still DRAW at their real heights further down.
  const CBH = curbH || CURB_H_LEAN, CW = curbW || CURB_W_LEAN, CADD = round2(CW - CURB_LAP);
  const insI = o.inset || null;
  const bands = curbBands(curbs, rw, rd, insI, CW);
  const curbOut = curbCornerOut(bands.concat(framedStandIns(benches, o.room, curbs, insI, CW)), rw, rd);

  // Where a wall's run sits on its edge. `at: "hi"` anchors it at the far end —
  // a half wall returning from the right side wall instead of the left.
  const runOf = (wl) => {
    const max = wl.side === "left" || wl.side === "right" ? rd : rw;
    const span = Math.min(wl.len, max);
    const from = wl.at === "hi" ? round2(max - span) : 0;
    return { max, span, from, to: round2(from + span), lo: from <= 0.5, hi: from + span >= max - 0.5 };
  };
  // Each ring corner cube belongs to exactly ONE slab. At the BACK that is the
  // back wall, with the side walls butting into it. At the FRONT it is the
  // SIDE wall — it carries all the way forward and the front wall butts
  // against it (owner 2026-08-03; the side wall is the continuous one on a
  // real frame). Two slabs claiming the same cube is what crossed the strokes
  // at the apex, and a run only claims a corner it actually reaches.
  const reach = (want) => dw.reduce((m, x) => {
    if (!want.includes(x.side)) return m;
    const r = runOf(x);
    if (!(r.span > 0.5)) return m;
    const k = x.side === "left" ? ["bl", "fl"] : x.side === "right" ? ["br", "fr"]
      : x.side === "back" ? ["bl", "br"] : ["fl", "fr"];
    if (r.lo) m[k[0]] = true;
    if (r.hi) m[k[1]] = true;
    return m;
  }, { bl: false, br: false, fl: false, fr: false });
  const backAt = reach(["back"]), sideAt = reach(["left", "right"]), frontAt = reach(["entry"]);
  // A run reaches into a corner square where a perpendicular WALL fills it, and
  // out to the curb's finished face where a curb runs into it instead — the
  // longer of the two, so a wall meeting both still draws one slab (owner
  // 2026-08-03, "the walls should always be flush with the curb"). With neither
  // there it stops on the line rather than hanging over open air — the rule the
  // plan already draws to, which this view had never picked up.
  const geomOf = (wl) => {
    const r = runOf(wl);
    const span = r.span;
    if (!(span > 0)) return null;
    const zh = Math.min(wl.h, 96);
    const ext = (reaches, owns, k) => (!reaches ? 0 : Math.max(owns ? T : 0, curbOut[k]));
    if (wl.side === "back") {
      return { span, zh, y0: -T, y1: 0,
        x0: r.from - ext(r.lo, sideAt.bl, "bl"), x1: r.to + ext(r.hi, sideAt.br, "br") };
    }
    // The front wall butts the side walls, so it never reaches into a corner —
    // but with no side wall standing there it still meets the curb.
    if (wl.side === "entry") {
      return { span, zh, y0: rd, y1: rd + T,
        x0: r.from - ext(r.lo && !sideAt.fl, false, "fl"), x1: r.to + ext(r.hi && !sideAt.fr, false, "fr") };
    }
    const left = wl.side === "left";
    const kLo = left ? "bl" : "br", kHi = left ? "fl" : "fr";
    return {
      span, zh, butt: false,
      x0: left ? -T : rw, x1: left ? 0 : rw + T,
      y0: r.from - ext(r.lo && !backAt[kLo], false, kLo),
      y1: r.to + ext(r.hi, frontAt[kHi], kHi),
    };
  };
  // The face this camera reads as "the wall": the inner plane on the solid
  // back/left, the outer plane on the clear front walls so the wedi green and
  // the joint dots land on the same drawn surface.
  const faceAt = (wl) => (wl.side === "back" ? (u, z) => M(u, 0, z)
    : wl.side === "entry" ? (u, z) => M(u, rd + T, z)
      : wl.side === "left" ? (u, z) => M(0, u, z)
        : (u, z) => M(rw + T, u, z));
  const jointsOf = (wl, g, isFront, tag) => {
    const pt = faceAt(wl);
    const colr = seamCol;
    (wl.courses || []).forEach((c, ci) => {
      const top = Math.min(c.y0 + c.ch, g.zh);
      if (c.y0 > 0 && c.y0 < g.zh) {
        const a = pt(0, c.y0), b = pt(g.span, c.y0);
        els.push(<line key={`cl${tag}-${ci}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colr} strokeWidth="1" strokeDasharray="2 3" />);
      }
      let u = 0;
      c.lens.slice(0, -1).forEach((len, li) => {
        u = round2(u + len);
        if (u >= g.span - 0.5) return;
        const a = pt(u, c.y0), b = pt(u, top);
        els.push(<line key={`bj${tag}-${ci}-${li}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colr} strokeWidth="1" strokeDasharray="2 3" />);
      });
    });
  };
  // Which part of a wall's big face actually carries wedi (owner ask
  // 2026-07-30): the whole face, minus the framing shadow of an
  // installer-framed bench on that side — the panel stops at the bench top
  // and the bench's own ½" wrap takes over. A 2" build-up or premade bench
  // leaves the wall fully paneled behind it, so it casts no shadow.
  const framedShadow = (side) => {
    let L = 0, H = 0;
    (benches || []).forEach((b) => {
      if (b.kind !== "wall" || b.build !== "framed" || b.side !== side) return;
      L = Math.max(L, b.len); H = Math.max(H, b.h);
    });
    return L > 0 && H > 0 ? { L, H } : null;
  };
  const WEDI_FILL = PIECE_FILL.pan, WEDI_FILL_CLEAR = "rgba(220,229,205,.4)";
  // A wall as a slab: the three faces this camera sees (+x, +y, top). Front
  // walls draw the same three faces clear with dashed edges. The face the
  // viewer reads as "the wall" then paints its wedi-covered region in the
  // pan green + a fine 45° hatch — bare framing stays dark (solid walls)
  // or clear (front walls), which is exactly the framed-bench shadow.
  const wallEls = (wl, wi, phase) => {
    const g = geomOf(wl);
    if (!g) return;
    const isFront = wl.side === "entry" || wl.side === "right";
    const { x0, x1, y0, y1, zh } = g;
    const faceE = str([M(x1, y0, zh), M(x1, y1, zh), M(x1, y1, 0), M(x1, y0, 0)]);
    // a side wall running into the entry wall has no exposed far end
    const faceS = g.butt ? null : str([M(x0, y1, zh), M(x1, y1, zh), M(x1, y1, 0), M(x0, y1, 0)]);
    const faceT = str([M(x0, y0, zh), M(x1, y0, zh), M(x1, y1, zh), M(x0, y1, zh)]);
    const mp = onWallMenu ? {
      className: "wband",
      onContextMenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); onWallMenu({ wid: wl.wid, extra: !!wl.extra }, ev.clientX, ev.clientY); },
    } : {};
    const title = onWallMenu ? <title>right-click — wall size &amp; wedi faces</title> : null;
    const facePt = faceAt(wl);
    // the panelled run is this slab's own extent — now that a ring corner
    // belongs to one wall, its return is this wall's face too
    const horiz = wl.side === "back" || wl.side === "entry";
    const u0 = horiz ? x0 : y0, u1 = horiz ? x1 : y1;
    const sh = framedShadow(wl.side);
    // One outline for the covered region — the framed bench's shadow notches it
    // into an L. Two abutting rectangles would stroke a seam where the panel
    // is continuous.
    const L = sh ? Math.max(u0, Math.min(sh.L, u1)) : u0;
    const uz = !sh || sh.H >= zh - 0.5 ? [[L, 0], [u1, 0], [u1, zh], [L, zh]]
      : L >= u1 - 0.5 ? [[u0, sh.H], [u1, sh.H], [u1, zh], [u0, zh]]
        : [[L, 0], [u1, 0], [u1, zh], [u0, zh], [u0, sh.H], [L, sh.H]];
    const face = str(uz.map((p) => facePt(p[0], p[1])));
    const cover = (
      <g key="cv" pointerEvents="none">
        <polygon points={face} fill={isFront ? WEDI_FILL_CLEAR : WEDI_FILL} stroke={isFront ? "none" : wallLine} strokeWidth=".5" />
        <polygon points={face} fill="url(#wedi-hatch)" />
      </g>
    );
    if (isFront) {
      // A clear wall draws in two passes around the shower: its tinted body
      // BEFORE the pan and curb, its dashed outline after. Painted whole at the
      // end, the wash landed across the curb — and because a wall's clear faces
      // draw on its OUTER plane while the curb butts the INNER one, that wash
      // edge cut a curb end in half and read as a step with a pale gap beyond
      // it. Now the floor assembly keeps its own tone and the dashes still
      // cross it, which is what says "wall in front".
      // pointer-events on the stroke only: a clear wall's body must not
      // swallow right-clicks meant for the solid walls and pan behind it.
      const dash = phase === "line"
        ? { fill: "none", stroke: wallLine, strokeWidth: 1, strokeDasharray: "3 3", pointerEvents: "stroke" }
        : { fill: "rgba(87,112,58,.05)", stroke: "none" };
      els.push(
        <g key={`w${wi}${phase}`} {...(phase === "line" ? mp : {})}>
          {phase === "line" ? title : null}
          <polygon points={faceE} {...dash} />
          {faceS ? <polygon points={faceS} {...dash} /> : null}
          <polygon points={faceT} {...dash} />
          {phase === "line" ? null : cover}
        </g>);
      if (phase === "line") jointsOf(wl, g, isFront, wi);
      return;
    }
    const tones = wl.extra ? ["#46592F", "#57703A", "#68804A"] : ["#454239", "#57534C", "#6B665D"];
    els.push(
      <g key={`w${wi}`} {...mp}>
        {title}
        <polygon points={faceE} fill={wl.side === "left" ? tones[1] : tones[0]} stroke={wallLine} strokeWidth=".7" />
        {faceS ? <polygon points={faceS} fill={wl.side === "back" ? tones[1] : tones[0]} stroke={wallLine} strokeWidth=".7" /> : null}
        <polygon points={faceT} fill={tones[2]} stroke={wallLine} strokeWidth=".8" />
        {cover}
      </g>);
    jointsOf(wl, g, isFront, wi);
  };
  // Back/entry first inside each pass: they own the ring corners, so the side
  // wall's inner face has to land on top of the corner return behind it.
  const solidW = [], clearW = [];
  dw.forEach((wl, wi) => { (wl.side === "entry" || wl.side === "right" ? clearW : solidW).push([wl, wi]); });
  const wallRank = (p) => (p[0].side === "back" || p[0].side === "entry" ? 0 : 1);
  solidW.sort((a, b) => wallRank(a) - wallRank(b)).forEach((p) => wallEls(p[0], p[1], "solid"));
  clearW.sort((a, b) => wallRank(a) - wallRank(b)).forEach((p) => wallEls(p[0], p[1], "fill"));

  // Pan and curb draw at their REAL heights (owner, 2026-07-31): the pan is a
  // thin slab — 1 37/64" (2" on the deep ones) — and every curb stands proud of
  // it, the lean 3½" and the standard/AT 5⅛". Drawing the pan 4" thick under a
  // 4½" curb read as one flat step.
  const panPc = o.pieces.find((p) => p.kind === "pan" || p.kind === "module");
  const t = Math.max(panThick(panPc) || 0, PAN_T_MIN);
  // Curb runs as raised slabs in the wall ring, butted between the wall
  // sections — the engine's ext0/ext1 fill the open ring corners so runs meet
  // square. The camera looks down (1,1,1): a back/left run is BEHIND the pan
  // and has to be painted before it, or its body floats over the pan surface.
  // This camera only ever sees a band's +x face, its +y face and its top. On a
  // horizontal run that makes the +x face the run's END; on a vertical run it
  // is the long face and the +y face is the end. A mitered end has no square
  // face to draw — the neighbouring run's own faces close the corner — and the
  // long face stops at the joint, so nothing buried inside the miter is drawn.
  const curbEls = (b) => {
    const { horiz, c0, c1, hi, mHi, ci } = b;
    const [z0, z1] = b.eC1;
    const face = { fill: "#D8D0BC", stroke: INK, strokeWidth: 1 };
    const side = { fill: "#CFC7B2", stroke: INK, strokeWidth: 1 };
    if (horiz) {
      if (!mHi) clipPoly(`cbe${ci}`, str([M(hi, c0, CBH), M(hi, c1, CBH), M(hi, c1, 0), M(hi, c0, 0)]), face);
      clipPoly(`cbs${ci}`, str([M(z0, c1, CBH), M(z1, c1, CBH), M(z1, c1, 0), M(z0, c1, 0)]), side);
    } else {
      clipPoly(`cbe${ci}`, str([M(c1, z0, CBH), M(c1, z1, CBH), M(c1, z1, 0), M(c1, z0, 0)]), face);
      if (!mHi) clipPoly(`cbs${ci}`, str([M(c0, hi, CBH), M(c1, hi, CBH), M(c1, hi, 0), M(c0, hi, 0)]), side);
    }
    clipPoly(`cbt${ci}`, str(bandPoly(b).map((p) => M(p[0], p[1], CBH))),
      { fill: "#E4DDCB", stroke: INK, strokeWidth: 1.2, strokeLinejoin: "round" });
  };
  const behind = (cs) => cs.side === "back" || cs.side === "left";
  bands.forEach((b) => { if (behind(b)) curbEls(b); });

  o.pieces.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach((p, i) => {
    const f = PIECE_FILL[p.kind] || "#EFF3E6", side = PIECE_SIDE[p.kind] || "#D8DFC4";
    els.push(<polygon key={`e${i}`} points={str([M(p.x + p.w, p.y, t), M(p.x + p.w, p.y + p.d, t), M(p.x + p.w, p.y + p.d, 0), M(p.x + p.w, p.y, 0)])} fill={side} stroke={INK} strokeWidth=".8" />);
    els.push(<polygon key={`f${i}`} points={str([M(p.x, p.y + p.d, t), M(p.x + p.w, p.y + p.d, t), M(p.x + p.w, p.y + p.d, 0), M(p.x, p.y + p.d, 0)])} fill={side} stroke={INK} strokeWidth=".8" />);
    els.push(<polygon key={`t${i}`} points={str([M(p.x, p.y, t), M(p.x + p.w, p.y, t), M(p.x + p.w, p.y + p.d, t), M(p.x, p.y + p.d, t)])} fill={f} stroke={INK} strokeWidth=".9" />);
    if (p.cut) {
      const cxe = o.mirrored ? p.x : p.x + p.w;
      if (p.w < p.cut.w - 0.01) { const a = M(cxe, p.y, t), b = M(cxe, p.y + p.d, t); els.push(<line key={`cw${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />); }
      if (p.d < p.cut.d - 0.01) { const a = M(p.x, p.y + p.d, t), b = M(p.x + p.w, p.y + p.d, t); els.push(<line key={`cd${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />); }
    }
  });

  // Corner cuts: the pan stays full size and the cut line dashes rust. With
  // a curb riding the cut the off-cut triangle is outside the shower — cut
  // and hidden (paper); with no curb it ghosts to the extension tint. Legs
  // come from curbRuns (a nearby wall end pulls the line to it).
  const CGEOM = { bl: [0, 0, 1, 1], br: [rw, 0, -1, 1], fl: [0, rd, 1, -1], fr: [rw, rd, -1, -1] };
  (cuts || []).forEach((d) => {
    const g2 = CGEOM[d.corner];
    if (!g2) return;
    const [cx, cy, dx, dy] = g2;
    const curbed = (curbDiags || []).some((x) => x.corner === d.corner);
    const ax = cx + dx * d.h, ay = cy, bx = cx, by = cy + dy * d.v;
    if (curbed) {
      // Erase the whole off-cut WEDGE — top face and the protruding side
      // faces — to the ground tint (it's outside the shower), then draw the
      // pan's new cut face so it reads as a solid slab cut on the line.
      els.push(<polygon key={`cw${d.corner}`}
        points={str([M(ax, ay, t), M(cx, cy, t), M(bx, by, t), M(bx, by, 0), M(cx, cy, 0), M(ax, ay, 0)])}
        fill="#EEEDE8" stroke="#EEEDE8" strokeWidth="3" strokeLinejoin="round" />);
      if (!(dx > 0 && dy > 0)) els.push(<polygon key={`cff${d.corner}`}
        points={str([M(ax, ay, t), M(bx, by, t), M(bx, by, 0), M(ax, ay, 0)])} fill={PIECE_SIDE.pan} stroke={INK} strokeWidth=".8" />);
    } else {
      els.push(<polygon key={`cf${d.corner}`} points={str([M(cx, cy, t), M(ax, ay, t), M(bx, by, t)])} fill="#EFF3E6" stroke="rgba(28,26,23,.25)" strokeWidth=".7" />);
    }
    const a = M(ax, ay, t), b = M(bx, by, t);
    els.push(<line key={`cfl${d.corner}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={RUST} strokeWidth="1.6" strokeDasharray="5 3" />);
  });

  // The fall, projected on the floor field: the hips a four-plane pan really
  // breaks on, one arrow per plane, and each extension's own fall to the pan.
  const slope = slopeMarks(o);
  if (slope) {
    slope.hips.forEach((s, i) => {
      const a = M(s[0][0], s[0][1], t + 0.05), b2 = M(s[1][0], s[1][1], t + 0.05);
      els.push(<line key={`sh${i}`} x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke="rgba(28,26,23,.2)" strokeWidth="1" />);
    });
    slope.arrows.forEach((s, i) => els.push(
      fallArrow(M(s.a[0], s.a[1], t + 0.05), M(s.b[0], s.b[1], t + 0.05), `sa${i}`, "rgba(28,26,23,.38)", 1.1, s.f, s.pan ? panCap(sc) : null)));
  }

  const dr = o.drain;
  if (dr) {
    if (dr.type === "linear" && dr.len) {
      const half = dr.len / 2;
      const hx = dr.axis === "w" ? half : 1.6, hy = dr.axis === "w" ? 1.6 : half;
      els.push(<polygon key="dr" points={str([M(dr.x - hx, dr.y - hy, t + 0.1), M(dr.x + hx, dr.y - hy, t + 0.1), M(dr.x + hx, dr.y + hy, t + 0.1), M(dr.x - hx, dr.y + hy, t + 0.1)])} fill={INK} />);
    } else {
      // square drain — the 4×4 cover, projected flat on the pan
      const dq = 2;
      els.push(<polygon key="dr" points={str([M(dr.x - dq, dr.y - dq, t + 0.1), M(dr.x + dq, dr.y - dq, t + 0.1), M(dr.x + dq, dr.y + dq, t + 0.1), M(dr.x - dq, dr.y + dq, t + 0.1)])} fill={PAPER} stroke={INK} strokeWidth="1.2" />);
      els.push(<polygon key="dr2" points={str([M(dr.x - 0.7, dr.y - 0.7, t + 0.1), M(dr.x + 0.7, dr.y - 0.7, t + 0.1), M(dr.x + 0.7, dr.y + 0.7, t + 0.1), M(dr.x - 0.7, dr.y + 0.7, t + 0.1)])} fill={INK} />);
    }
  }
  // Benches as slabs to their real top height (issue 069 follow-up). Every
  // bench body starts at the PAN SURFACE: a framed bench's frame does carry
  // on down to the subfloor, but the cut pan butts its face and buries that
  // last 4" — drawing it from the floor is what dragged the pan's surface,
  // and with it the rust cut mark, 4" out of place. Corner benches are
  // triangular prisms.
  const BTOP = "#DCE0C8", BSIDE = "#C2CBA4", BSIDE2 = "#B6BF96";
  const benchQuad = (a, b2, z0, z1, fill, key) =>
    clipPoly(key, str([M(a[0], a[1], z1), M(b2[0], b2[1], z1), M(b2[0], b2[1], z0), M(a[0], a[1], z0)]),
      { fill, stroke: MOSS_DEEP, strokeWidth: 1 });
  // A wall bench reaching the entry meets the curb whichever side of the room
  // line the curb sits on: in the usual ring it oversails CADD past the line;
  // in "overall max" the curb is inside the line, so the bench stops AT the
  // line but still rides the curb's top (or, framed, replaces it) from the
  // curb's own inner edge.
  const insetEntry = !!(o.inset && o.inset.entry > 0);
  const meetsEntry = (b, f) => !!(curbs && curbs.length && !b.suspended
    && f.kind === "rect" && f.y + f.d >= rd - 0.5);
  const benchOut = (b, f) => (meetsEntry(b, f) && !insetEntry ? CADD : 0);
  const benchDraw = (b, bi) => {
    const f = benchFootprint(b, o.room);
    const zh = b.h || 18;
    // A suspended premade hangs on the walls: only its slab draws — bottom at
    // top-minus-thickness, the floor (and any curb) clear beneath it.
    const z0 = b.suspended ? Math.max(t, zh - (b.thick || 4)) : t;
    if (f.kind === "corner") {
      const tri = ({
        bl: [[0, 0], [f.a, 0], [0, f.a]], br: [[rw, 0], [rw - f.a, 0], [rw, f.a]],
        fl: [[0, rd], [f.a, rd], [0, rd - f.a]], fr: [[rw, rd], [rw - f.a, rd], [rw, rd - f.a]],
      })[f.corner];
      // Only the faces turned toward the camera: the two legs sitting against
      // the walls would otherwise repaint the wall they're buried in, and a
      // hypotenuse square to the view collapses to a stroke.
      const cen = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
      const faces = [[tri[0], tri[1], BSIDE], [tri[0], tri[2], BSIDE], [tri[1], tri[2], BSIDE2]]
        .filter((s) => (s[0][0] + s[1][0]) / 2 - cen[0] + (s[0][1] + s[1][1]) / 2 - cen[1] > 0.01);
      faces.sort((p, q) => (p[0][0] + p[0][1] + p[1][0] + p[1][1]) - (q[0][0] + q[0][1] + q[1][0] + q[1][1]))
        .forEach((s, si) => benchQuad(s[0], s[1], z0, zh, s[2], `bn${bi}s${si}`));
      clipPoly(`bn${bi}t`, str(tri.map((p) => M(p[0], p[1], zh))), { fill: BTOP, stroke: MOSS_DEEP, strokeWidth: 1.2 });
      return;
    }
    const out = benchOut(b, f);
    const x0 = f.x, x1 = f.x + f.w, y0 = f.y, yc = f.y + f.d, y1 = yc + out;
    // Past the pan line the oversail rides the curb's top — except a framed
    // bench, which took the curb's place and carries on to the subfloor.
    const zOut = b.build === "framed" ? 0 : CBH;
    const step = meetsEntry(b, f) && Math.abs(zOut - z0) > 0.01;
    // The bench's bottom breaks where the curb's top begins — ½" inside the
    // pan line in the ring (the notch laps the pan), the curb's inner edge
    // when "overall max" pulls it inside the line. Both are CW back from the
    // bench's outer plane; a framed bench instead drops at the PAN's edge
    // (flush with its face in the ring, the inset pan edge in max).
    const yStep = round2(y1 - CW + (b.build === "framed" ? CURB_LAP : 0));
    clipPoly(`bn${bi}e`, str(step
      ? [M(x1, y0, zh), M(x1, y1, zh), M(x1, y1, zOut), M(x1, yStep, zOut), M(x1, yStep, z0), M(x1, y0, z0)]
      : [M(x1, y0, zh), M(x1, y1, zh), M(x1, y1, z0), M(x1, y0, z0)]), { fill: BSIDE, stroke: MOSS_DEEP, strokeWidth: 1 });
    benchQuad([x0, y1], [x1, y1], step ? zOut : z0, zh, BSIDE2, `bn${bi}f`);
    clipPoly(`bn${bi}t`, str([M(x0, y0, zh), M(x1, y0, zh), M(x1, y1, zh), M(x0, y1, zh)]), { fill: BTOP, stroke: MOSS_DEEP, strokeWidth: 1.2 });
    // The pan is cut wall to wall along the bench's face, but only the stretch
    // the box doesn't stand in front of reads from this camera — a right-hand
    // bench hides its own cut, so the mark starts where the seat ends.
    if (b.build === "framed" && !framedFit) {
      // the cut runs wall to wall along the PAN — which stops short of the
      // line when "overall max" pulls the curb inside it
      const yPan = insetEntry ? round2(rd - o.inset.entry) : rd;
      const seg = b.side === "left" ? [[x1, 0], [x1, yPan]]
        : b.side === "back" ? [[0, yc], [rw, yc]]
          : yc < rd - 0.5 ? [[x0, yc], [x0, yPan]] : null;
      if (seg) {
        const a = M(seg[0][0], seg[0][1], t), b2 = M(seg[1][0], seg[1][1], t);
        els.push(<line key={`bn${bi}c`} x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />);
      }
    }
  };
  // A framed bench displaced the curb, so its run butts the bench face and
  // stands in front of it (owner markup 2026-07-31); a bench built on the
  // finished shower rides over a curb that runs on beneath it, so that one
  // draws after its run — on either side of the line (inset curbs too).
  const onCurb = (b) => b.build !== "framed" && meetsEntry(b, benchFootprint(b, o.room));
  // A framed bench displaced the curb, so the run butts its face — but WHICH of
  // the two is in front depends on the side it stands on, and the rule only ever
  // had the far case. On the LEFT the run carries on at greater x, so it is
  // nearer and covers the bench (owner markup 2026-07-31). On the RIGHT — the
  // near wall — the bench is the greater x, so the bench is nearer and the run's
  // squared END face belongs behind it. It was painting over it: at the AT curb
  // that end face at (46, 38, 3) and the bench's front at (48, 40, 5) land on
  // the same screen point, depth 87 against 93 (owner 2026-08-04).
  const nearFramed = (b) => {
    if (b.build !== "framed" || b.suspended) return false;
    const f = benchFootprint(b, o.room);
    if (f.kind === "corner") return f.corner === "fr" || f.corner === "br";
    return f.x + f.w >= rw - 0.5;
  };
  const late = (b) => onCurb(b) || nearFramed(b);
  (benches || []).forEach((b, bi) => { if (!late(b)) benchDraw(b, bi); });
  bands.forEach((b) => { if (!behind(b)) curbEls(b); });
  (benches || []).forEach((b, bi) => { if (late(b)) benchDraw(b, bi); });
  // The bench rides the curb, so it paints after its run — but the run does not
  // STOP at the bench. The stretch carrying on past the bench's end stands
  // NEARER this camera than that end does (depth is x+y+z, and it is further
  // along x), so it covers the bench's corner and the notch its underside cuts
  // round the curb: curb forward, bench behind (owner markup 2026-08-03). Same
  // run, redrawn from the bench's end out, on top. Only the near half is
  // trimmed — behind the bench the curb is genuinely buried, which is what the
  // first pass already drew.
  const riders = (benches || []).filter(onCurb).map((b) => benchFootprint(b, o.room))
    .filter((f) => f && f.kind === "rect").map((f) => round2(f.x + f.w));
  if (riders.length) {
    const s = Math.max(...riders);
    // Its TOP is the face that does the covering, and it is the only one
    // redrawn: the outer face below it never met the bench, so repainting that
    // would only lay a seam down it where the trim starts.
    bands.filter((b) => b.side === "entry" && b.horiz && b.eC1[1] > s + 0.01).forEach((b) => {
      const trim = { ...b, eC0: [Math.max(b.eC0[0], s), b.eC0[1]], eC1: [Math.max(b.eC1[0], s), b.eC1[1]] };
      clipPoly(`cbt${b.ci}f`, str(bandPoly(trim).map((p) => M(p[0], p[1], CBH))),
        { fill: "#E4DDCB", stroke: INK, strokeWidth: 1.2, strokeLinejoin: "round" });
    });
  }
  // A cut corner's curb takes the one straight line across.
  (curbDiags || []).forEach((d, i) => {
    const g2 = CGEOM[d.corner];
    if (!g2) return;
    const [cx, cy, dx, dy] = g2;
    // ends squared to the edges (owner sketch): the band butts the walls and
    // straight runs flush, its outer edge the piece's longest point; the inner
    // face sits ½" past the cut line, where the notch laps the pan
    const ax = cx + dx * d.h, ay = cy, bx = cx, by = cy + dy * d.v;
    const a1x = ax, a1y = ay + dy * CURB_LAP, b1x = bx + dx * CURB_LAP, b1y = by;
    const a2x = ax, a2y = ay - dy * CADD, b2x = bx - dx * CADD, b2y = by;
    // Only the long face this camera can see: the band's two ENDS are butted
    // into the straight runs or the walls, and one of its long faces is always
    // turned away — drawing them repaints the pan and the run beside it.
    const cen = [(a1x + b1x + a2x + b2x) / 4, (a1y + b1y + a2y + b2y) / 4];
    const shows = (p, q) => (p[0] + q[0]) / 2 - cen[0] + ((p[1] + q[1]) / 2 - cen[1]) > 0.01;
    if (shows([a1x, a1y], [b1x, b1y])) els.push(<polygon key={`cdi${i}`} points={str([M(a1x, a1y, CBH), M(b1x, b1y, CBH), M(b1x, b1y, 0), M(a1x, a1y, 0)])} fill="#CFC7B2" stroke={INK} strokeWidth=".7" />);
    if (shows([a2x, a2y], [b2x, b2y])) els.push(<polygon key={`cdo${i}`} points={str([M(a2x, a2y, CBH), M(b2x, b2y, CBH), M(b2x, b2y, 0), M(a2x, a2y, 0)])} fill="#D8D0BC" stroke={INK} strokeWidth=".7" />);
    els.push(<polygon key={`cdt${i}`} points={str([M(a1x, a1y, CBH), M(b1x, b1y, CBH), M(b2x, b2y, CBH), M(a2x, a2y, CBH)])} fill="#E4DDCB" stroke={INK} strokeWidth=".8" />);
  });

  // Front walls close last — only their dashed outline and joint dots, over the
  // shower they stand in front of; the tint went down before the pan.
  clearW.forEach((p) => wallEls(p[0], p[1], "line"));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <defs>
        <pattern id="wedi-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={MOSS_DEEP} strokeWidth="1" opacity=".26" />
        </pattern>
      </defs>
      {els}
    </svg>
  );
}
