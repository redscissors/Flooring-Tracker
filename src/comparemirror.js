// comparemirror — how Compare finds the other brand's part for a line added
// by hand (ticket 158 Phase 1d). Pure: items in, sizes and rankings out. It
// never imports an engine; comparekit hands it each part's brand, slot and
// coverage, so the mirror's engine reads stay in comparekit.
//
// A part is { item, brand: "wedi"|"schluter", slot, cov: {n, unit}|null }.

const quarter = (n) => Math.round(n * 4) / 4;
const half = (n) => Math.round(n * 2) / 2;
const mmIn = (mm) => half(+mm / 25.4);
// "12", "38 1/4", "38-1/4", "3/8" → inches
const inchNum = (s) => {
  const m = /^(?:(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?|(\d+)\/(\d+))$/.exec(String(s || "").trim());
  if (!m) return NaN;
  return m[4] ? +m[4] / +m[5] : +m[1] + (m[2] ? +m[2] / +m[3] : 0);
};
const INCH = String.raw`(\d+(?:\.\d+)?(?:[\s-]+\d+\/\d+)?|\d+\/\d+)`;
const covOf = (p, unit) => (p.cov && p.cov.unit === unit && p.cov.n > 0 ? p.cov.n : null);

// schluter.js's THICK_IN (line 32), re-keyed to numeric inches: schluter.js
// keys ½" panels off thickMm rather than trusting the sheet's text
// (schluter.js:343) — a live name is not a stable key (schluter.js:281-282).
const KB_THICK_IN = { 3: 0.125, 5: 0.1875, 9: 0.375, 12: 0.5, 19: 0.75, 25: 1, 38: 1.5, 50: 2 };

// A board's thickness in inches: for Schluter, thickMm (or, failing that, the
// SKU's millimetre code) through the same table the engine keys panels on;
// only when neither gives a thickness does the name's own fraction count.
function boardThick(p) {
  const it = p.item;
  if (p.brand === "wedi") return it.t > 0 ? it.t : null;
  if (KB_THICK_IN[it.thickMm]) return KB_THICK_IN[it.thickMm];
  const code = /^KB(\d{2})/.exec(it.sku || "");
  if (code && KB_THICK_IN[+code[1]]) return KB_THICK_IN[+code[1]];
  const named = new RegExp(INCH + '"').exec(it.name || "");
  if (named) { const n = inchNum(named[1]); if (n > 0) return n; }
  return null;
}

const SIZE = {
  // the niche's interior opening: wedi prints it in the size text
  // ("interior 12" x 8""), Schluter's SKU codes it in mm (KB12SN305508 = 12″ × 20″)
  niche: (p) => {
    if (p.brand === "wedi") {
      const m = new RegExp("interior\\s+" + INCH + '"?\\s*x\\s*' + INCH, "i").exec(p.item.sizeText || "");
      return m ? { w: inchNum(m[1]), h: inchNum(m[2]) } : null;
    }
    const m = /^KB\d{2}SN(\d{3})(\d{3})/.exec(p.item.sku || "");
    return m ? { w: mmIn(m[1]), h: mmIn(m[2]) } : null;
  },
  // a seat or bench footprint, long side first; a corner seat is its leg both ways
  bench: (p) => {
    const it = p.item;
    if (p.brand === "wedi") return (it.group === "seat" || it.group === "bench") && it.w > 0 && it.d > 0
      ? { w: Math.max(it.w, it.d), d: Math.min(it.w, it.d) } : null;
    const b = it.bench;
    if (!b) return null;
    if (b.corner) return b.a > 0 ? { w: b.a, d: b.a } : null;
    return b.len > 0 && b.d > 0 ? { w: Math.max(b.len, b.d), d: Math.min(b.len, b.d) } : null;
  },
  curb: (p) => (p.item.len > 0 ? { len: p.item.len } : null),
  tray: (p) => {
    const it = p.item;
    const ok = p.brand === "wedi" ? ["pan", "kit"].includes(it.group) : it.g === "tray";
    return ok && it.w > 0 && it.d > 0 ? { w: Math.max(it.w, it.d), d: Math.min(it.w, it.d) } : null;
  },
  wallBoard: (p) => {
    const sf = covOf(p, "sf");
    const t = sf && boardThick(p);
    return sf && t ? { t, sf } : null;
  },
  wallMembrane: (p) => { const sf = covOf(p, "sf"); return sf ? { sf } : null; },
  // a band or tape: its width in inches (Schluter stores mm), then its length
  seam: (p) => {
    const lf = covOf(p, "lf");
    if (!lf) return null;
    const w = p.brand === "wedi" ? p.item.w : +p.item.width ? quarter(+p.item.width / 25.4) : null;
    return w > 0 ? { w, lf } : null;
  },
};

/** A part's comparable size in its slot, or null when the slot has none or it can't be read. */
export const sizeOf = (p) => (SIZE[p.slot] ? SIZE[p.slot](p) : null);

/** How far apart two sizes in one slot are — 0 is the same size. Thickness / width outrank area / length. */
export function sizeDistance(slot, a, b) {
  if (!a || !b) return null;
  switch (slot) {
    case "niche": return Math.abs(a.w - b.w) + Math.abs(a.h - b.h);
    case "bench":
    case "tray": return Math.abs(a.w - b.w) + Math.abs(a.d - b.d);
    case "curb": return Math.abs(a.len - b.len);
    case "wallBoard": return Math.abs(a.t - b.t) * 1000 + Math.abs(a.sf - b.sf);
    case "wallMembrane": return Math.abs(a.sf - b.sf);
    case "seam": return Math.abs(a.w - b.w) * 1000 + Math.abs(a.lf - b.lf);
    default: return null;
  }
}

/**
 * The other brand's parts ranked against the host part: nearest size first
 * (a part with no comparable size sorts last), then stock before special
 * order, then the lower retail price, then the part number. Each comes back
 * with its `dist` (null when unsized).
 */
export function rankParts(host, parts) {
  const hs = sizeOf(host);
  return parts
    .map((p) => ({ ...p, dist: p.slot === host.slot ? sizeDistance(host.slot, hs, sizeOf(p)) : null }))
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity)
      || (b.item.stock ? 1 : 0) - (a.item.stock ? 1 : 0)
      || (+a.retail || 0) - (+b.retail || 0)
      || String(a.id).localeCompare(String(b.id)));
}

/** The auto-match: the nearest sized part in the host's slot, or null. */
export function nearest(host, parts) {
  const top = rankParts(host, parts)[0];
  return top && top.dist != null ? top : null;
}

/** The mirrored qty: coverage for coverage (sf or lf on both), else the same count. */
export function matchQty(host, hostQty, match) {
  const hc = host.cov, mc = match.cov;
  if (hc && mc && hc.unit === mc.unit && hc.n > 0 && mc.n > 0) return Math.max(1, Math.ceil((hostQty * hc.n) / mc.n - 1e-9));
  return hostQty;
}
