// Wall-board course planner shared by the wedi and Schluter configurators.
//
// Sheets laid HORIZONTAL, stacked in level courses, so the joints run level
// and vertical seams stay rare (owner rule 2026-07-29). Full courses are the
// tallest sheet width; anything shorter is a strip ripped from a sheet, and
// strips from every wall share sheets — one 4×8 ripped in half can top off
// two walls. A wall goes vertical only when one column of sheet covers it.
//
// The plan with the fewest vertical seams wins unless it costs more than
// SEAM_PREMIUM over the cheapest plan (owner 2026-09-22: "zero seams wins
// unless it's way more"); among those, fewer pieces on the wall, then fewer
// ripped pieces, win unless they cost PIECE_PREMIUM more — two 48" courses
// and a top strip beat three 36" rips.

const SEAM_PREMIUM = 0.25;
const PIECE_PREMIUM = 0.2;
const PLAN_COMBOS = 4000;
const MAX_COURSES = 6;

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Fewest pieces, then least linear waste; the longest sheets lead and the
// last piece is the cut-down one, so the butt joints are the running sums.
function fullCourse(L, row) {
  const opts = row.slice().sort((a, b) => b.len - a.len);
  const maxPieces = Math.ceil(L / opts[opts.length - 1].len) + 1;
  let best = null;
  const search = (idx, picks, run) => {
    if (run >= L - 0.01 && picks.length) {
      const waste = r2(run - L);
      if (!best || picks.length < best.picks.length || (picks.length === best.picks.length && waste < best.waste)) {
        best = { picks: picks.slice(), waste };
      }
      return;
    }
    if (picks.length >= maxPieces || (best && picks.length >= best.picks.length)) return;
    for (let i = idx; i < opts.length; i++) {
      picks.push(opts[i]);
      search(i, picks, run + opts[i].len);
      picks.pop();
    }
  };
  search(0, [], 0);
  const lens = [];
  let left = L;
  best.picks.forEach((p) => { const t = Math.min(p.len, left); lens.push(r2(t)); left = r2(left - t); });
  return { sheets: best.picks, lens };
}

function stripLens(L, maxLen) {
  const lens = [];
  let left = L;
  while (left > 0.01) { const t = Math.min(maxLen, left); lens.push(r2(t)); left = r2(left - t); }
  return lens;
}

// Rips strip pieces {h, l} out of sheets: lanes across a sheet's width,
// pieces end to end along a lane. Greedy per sheet size (pieces that don't
// fit it fall back to the biggest sheet), then each sheet drops to the
// cheapest size that still holds its lanes; the cheapest outcome wins.
function packStrips(pieces, sheets) {
  if (!pieces.length) return { sheets: [], cost: 0 };
  const big = sheets[0];
  let best = null;
  sheets.forEach((prim) => {
    const fits = (s, p) => p.h <= s.w + 0.01 && p.l <= s.len + 0.01;
    const bins = [];
    pieces.slice().sort((a, b) => b.h - a.h || b.l - a.l).forEach((p) => {
      const s = fits(prim, p) ? prim : big;
      let lane = null;
      bins.forEach((b) => {
        if (b.s !== s) return;
        b.lanes.forEach((ln) => {
          if (ln.h >= p.h - 0.01 && s.len - ln.used >= p.l - 0.01 && (!lane || ln.h < lane.h)) lane = ln;
        });
      });
      if (!lane) {
        let bin = bins.find((b) => b.s === s && s.w - b.usedW >= p.h - 0.01);
        if (!bin) { bin = { s, usedW: 0, lanes: [] }; bins.push(bin); }
        lane = { h: p.h, used: 0 };
        bin.lanes.push(lane);
        bin.usedW = r2(bin.usedW + p.h);
      }
      lane.used = r2(lane.used + p.l);
    });
    const used = bins.map((b) => {
      const len = Math.max(...b.lanes.map((ln) => ln.used));
      return sheets.filter((s) => s.w >= b.usedW - 0.01 && s.len >= len - 0.01)
        .sort((x, y) => x.price - y.price)[0];
    });
    const cost = r2(used.reduce((t, s) => t + s.price, 0));
    if (!best || cost < best.cost || (cost === best.cost && used.length < best.sheets.length)) best = { sheets: used, cost };
  });
  return best;
}

// Every way to cover one wall: a stack of full-height courses (the tallest
// sheet width laid whole; shorter widths as strips) with a top strip for
// what's left, or one sheet stood on end with a top strip if the wall is
// taller than the sheet.
function wallOptions(L, H, sheets) {
  const topW = sheets[0].w, maxLen = Math.max(...sheets.map((s) => s.len));
  const heights = [...new Set(sheets.map((s) => s.w))].sort((a, b) => b - a);
  const fullRow = sheets.filter((s) => s.w === topW);
  // a strip a whole sheet covers as-is — a 3×5 laid in a 36" course
  const whole = (h, l) => sheets.some((s) => Math.abs(s.w - h) < 0.01 && s.len >= l - 0.01);
  const out = [];
  const stacks = [];
  const grow = (idx, stack, tot) => {
    const t = r2(H - tot);
    if (t <= topW + 0.01) stacks.push(t > 0.01 ? stack.concat([t]) : stack.slice());
    if (stack.length >= MAX_COURSES - 1) return;
    for (let i = idx; i < heights.length; i++) {
      if (tot + heights[i] > H + 0.01) continue;
      stack.push(heights[i]);
      grow(i, stack, tot + heights[i]);
      stack.pop();
    }
  };
  grow(0, [], 0);
  stacks.forEach((hs) => {
    if (!hs.length) return;
    const o = { courses: [], whole: [], strips: [], seams: 0, rips: 0, vertical: false };
    let y0 = 0;
    hs.forEach((ch) => {
      const full = Math.abs(ch - topW) < 0.01;
      const c = full ? fullCourse(L, fullRow) : { sheets: [], lens: stripLens(L, maxLen) };
      o.courses.push({ y0, ch, lens: c.lens });
      o.whole.push(...c.sheets);
      if (!full) c.lens.forEach((l) => { o.strips.push({ h: ch, l }); if (!whole(ch, l)) o.rips++; });
      o.seams += c.lens.length - 1;
      y0 = r2(y0 + ch);
    });
    out.push(o);
  });
  sheets.forEach((s) => {
    if (s.w < L - 0.01) return;
    const t = r2(H - s.len);
    if (t > topW + 0.01) return;
    const o = {
      courses: [{ y0: 0, ch: Math.min(H, s.len), lens: [L], vertical: true }],
      whole: [s], strips: [], seams: 0, rips: L < s.w - 0.01 ? 1 : 0, vertical: true,
    };
    if (t > 0.01) { o.courses.push({ y0: s.len, ch: t, lens: [L] }); o.strips.push({ h: t, l: L }); o.rips++; }
    out.push(o);
  });
  out.forEach((o) => {
    o.pieces = o.courses.reduce((n, c) => n + c.lens.length, 0);
    o.alone = r2(o.whole.reduce((t, s) => t + s.price, 0) + packStrips(o.strips, sheets).cost);
  });
  return out;
}

// A wall's shortlist: the cheapest few, the fewest-seam few, and the
// fewest-seam-then-fewest-pieces few.
function shortlist(opts, k) {
  const orders = [
    (x, y) => x.alone - y.alone || x.seams - y.seams,
    (x, y) => x.seams - y.seams || x.alone - y.alone,
    (x, y) => x.seams - y.seams || x.pieces - y.pieces || x.rips - y.rips || x.alone - y.alone,
  ].map((f) => opts.slice().sort(f));
  const keep = [];
  for (let i = 0; i < k; i++) orders.forEach((l) => { if (l[i] && keep.indexOf(l[i]) < 0) keep.push(l[i]); });
  return keep;
}

/**
 * walls: [{len, h, side}]; sheets: [{key, w, len, price}] with w the course
 * height (the side that stacks). Returns { lines: [{key, qty}], vSeams,
 * courses, detail } — detail index-aligned with walls, each carrying the
 * drawing-ready courses ({y0, ch, lens}; a stood-up sheet's course has
 * vertical: true).
 */
export function planPanels(walls, sheetList) {
  const sheets = (sheetList || []).filter((s) => s.w > 0 && s.len > 0)
    .slice().sort((a, b) => b.w - a.w || b.len - a.len);
  const detail = [], live = [];
  (walls || []).forEach((wall) => {
    const L = +wall.len || 0, H = +wall.h || 0;
    const d = { len: L, h: H, side: wall.side || "", courses: [], vertical: false };
    detail.push(d);
    if (L > 0 && H > 0 && sheets.length) live.push({ d, opts: wallOptions(L, H, sheets) });
  });
  let k = 3, lists;
  for (;;) {
    lists = live.map((w) => shortlist(w.opts, k));
    if (k === 1 || lists.reduce((p, l) => p * l.length, 1) <= PLAN_COMBOS) break;
    k--;
  }
  const combos = [];
  const walk = (i, pick) => {
    if (i === lists.length) {
      const strips = [], whole = [];
      pick.forEach((o) => { strips.push(...o.strips); whole.push(...o.whole); });
      const pk = packStrips(strips, sheets);
      const used = whole.concat(pk.sheets);
      combos.push({
        pick, sheets: used, cost: r2(used.reduce((t, s) => t + s.price, 0)),
        seams: pick.reduce((s, o) => s + o.seams, 0),
        pieces: pick.reduce((s, o) => s + o.pieces, 0),
        rips: pick.reduce((s, o) => s + o.rips, 0),
        verticals: pick.filter((o) => o.vertical).length,
      });
      return;
    }
    lists[i].forEach((o) => walk(i + 1, pick.concat([o])));
  };
  if (live.length) walk(0, []);
  const cheapest = (list) => (list.length ? Math.min(...list.map((c) => c.cost)) : 0);
  const ok = combos.filter((c) => c.cost <= cheapest(combos) * (1 + SEAM_PREMIUM) + 0.01);
  const fewest = ok.length ? Math.min(...ok.map((c) => c.seams)) : 0;
  const seamless = ok.filter((c) => c.seams === fewest);
  const floor = cheapest(seamless);
  const best = seamless.filter((c) => c.cost <= floor * (1 + PIECE_PREMIUM) + 0.01)
    .sort((x, y) => x.pieces - y.pieces || x.rips - y.rips || x.cost - y.cost
      || x.sheets.length - y.sheets.length || x.verticals - y.verticals)[0];

  const qty = new Map();
  let courses = 0;
  if (best) {
    best.pick.forEach((o, i) => {
      const d = live[i].d;
      d.vertical = o.vertical;
      d.courses = o.courses.map((c) => ({ ...c }));
      courses += o.courses.length;
    });
    best.sheets.forEach((s) => qty.set(s.key, (qty.get(s.key) || 0) + 1));
  }
  return {
    lines: [...qty].map(([key, n]) => ({ key, qty: n })),
    vSeams: best ? best.seams : 0, courses, detail,
  };
}
