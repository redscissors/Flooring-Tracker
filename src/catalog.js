// Pure, React-free domain logic for FloorTrack: the grout/mortar material math
// and (incrementally, across issue 002) the shared grout/mortar catalog.
//
// Kept import-free so it can be unit-tested with `node --test` (see
// catalog.test.js). App.jsx imports everything it needs from here.

export const GROUTS = ["PermaColor Select", "SpectraLOCK 1", "SpectraLOCK PRO"];
export const MORTARS = ["ProLite", "AcrylPro"];

export const DEFAULTS = {
  wastePct: 10,
  mortars: { "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 0 }, "AcrylPro": { tier1: 40, tier2: 15, tier3: 10, unit: "gallons", price: 0 } },
  grouts: { "PermaColor Select": { coverage: 110, unit: "bags", price: 0 }, "SpectraLOCK 1": { coverage: 85, unit: "units", price: 0 }, "SpectraLOCK PRO": { coverage: 90, unit: "units", price: 0 } },
};

// Grout scales volumetrically from a 12×12×3/8" tile with a 1/8" joint.
export const REF = ((12 + 12) / (12 * 12)) * 0.375 * 0.125;

export const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Normalize a loaded/imported Settings object back to the full shape, filling
// gaps from DEFAULTS so older records stay valid. (`s.mortar` is a legacy
// single-mortar field that predates the per-product map.)
export const mergeSettings = (s) => ({
  wastePct: s?.wastePct ?? 10,
  mortars: MORTARS.reduce((o, k) => ({ ...o, [k]: { ...DEFAULTS.mortars[k], ...((s?.mortars?.[k]) || (k === "ProLite" ? s?.mortar : null) || {}) } }), {}),
  grouts: GROUTS.reduce((o, k) => ({ ...o, [k]: { ...DEFAULTS.grouts[k], ...(s?.grouts?.[k] || {}) } }), {}),
});

export function mortarExact(p, s) {
  if (p.type !== "tile" || p.qtyType !== "sqft") return null;
  const sqft = num(p.qty); if (!sqft) return 0;
  const longest = Math.max(num(p.L), num(p.W)); if (!longest) return null;
  const m = s.mortars[p.mortar.product]; if (!m) return null;
  const cov = longest < 8 ? m.tier1 : longest <= 15 ? m.tier2 : m.tier3;
  return sqft * (1 + num(s.wastePct) / 100) / (num(cov) || 1);
}

export function getMortar(p, s) {
  if (p.type !== "tile" || !p.mortar.checked) return null;
  const m = s.mortars[p.mortar.product] || {};
  if (p.mortar.manual !== "" && p.mortar.manual != null) { const v = num(p.mortar.manual); return { exact: v, order: v, unit: m.unit, price: num(m.price), product: p.mortar.product }; }
  const ex = mortarExact(p, s); if (ex == null) return null;
  return { exact: ex, order: Math.ceil(ex), unit: m.unit, price: num(m.price), product: p.mortar.product };
}

export function groutExact(p, s) {
  if (p.type !== "tile" || p.qtyType !== "sqft") return null;
  const sqft = num(p.qty), L = num(p.L), W = num(p.W), T = num(p.thickness), J = num(p.grout.joint);
  if (!sqft || !L || !W || !T || !J) return null;
  const vol = ((L + W) / (L * W)) * T * J; if (!vol) return null;
  const cov = num(s.grouts[p.grout.product]?.coverage) * (REF / vol);
  return sqft * (1 + num(s.wastePct) / 100) / (cov || 1);
}

export function getGrout(p, s) {
  if (p.type !== "tile" || !p.grout.checked) return null;
  const g = s.grouts[p.grout.product] || {};
  if (p.grout.manual !== "" && p.grout.manual != null) { const v = num(p.grout.manual); return { exact: v, order: v, unit: g.unit, price: num(g.price), product: p.grout.product, color: p.grout.color }; }
  const ex = groutExact(p, s); if (ex == null) return null;
  return { exact: ex, order: Math.ceil(ex), unit: g.unit, price: num(g.price), product: p.grout.product, color: p.grout.color };
}
