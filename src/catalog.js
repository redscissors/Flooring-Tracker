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

// --- Catalog (Company → Product) — ADR 0002 ----------------------------------
// The catalog is the source of truth for which grout/mortar products exist and
// their numbers. Jobs link to a product by NAME only; the math resolves a name
// against the flattened catalog regardless of enabled state, so a job using a
// now-hidden product still calculates. Names are unique within grout and within
// mortar (enforced when adding — slice 05).

const cid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

// How the built-in products are grouped under companies when first seeded. The
// team extends/toggles from here; there is no "move product" action, so this is
// the starting grouping.
const SEED_COMPANIES = [
  { name: "Laticrete", grouts: ["PermaColor Select", "SpectraLOCK 1", "SpectraLOCK PRO"], mortars: [] },
  { name: "Custom Building Products", grouts: [], mortars: ["ProLite", "AcrylPro"] },
];

const groutFields = (g) => ({ coverage: g?.coverage ?? 0, unit: g?.unit ?? "units", price: g?.price ?? 0 });
const mortarFields = (m) => ({ tier1: m?.tier1 ?? 0, tier2: m?.tier2 ?? 0, tier3: m?.tier3 ?? 0, unit: m?.unit ?? "units", price: m?.price ?? 0 });

// Build a fresh catalog from a flat Settings object (waste-free), grouping the
// built-in names under SEED_COMPANIES and carrying each product's numbers
// through unchanged. Any flat name not covered by a seed company lands under an
// "Unassigned" company so nothing is dropped.
export function seedCatalog(flat) {
  const g = (flat && flat.grouts) || DEFAULTS.grouts;
  const m = (flat && flat.mortars) || DEFAULTS.mortars;
  const seededG = new Set(SEED_COMPANIES.flatMap((c) => c.grouts));
  const seededM = new Set(SEED_COMPANIES.flatMap((c) => c.mortars));
  const companies = SEED_COMPANIES.map((co) => ({
    id: cid(), name: co.name, enabled: true,
    grouts: co.grouts.map((name) => ({ id: cid(), name, enabled: true, ...groutFields(g[name]) })),
    mortars: co.mortars.map((name) => ({ id: cid(), name, enabled: true, ...mortarFields(m[name]) })),
  }));
  const extraG = Object.keys(g).filter((n) => !seededG.has(n));
  const extraM = Object.keys(m).filter((n) => !seededM.has(n));
  if (extraG.length || extraM.length) {
    companies.push({
      id: cid(), name: "Unassigned", enabled: true,
      grouts: extraG.map((name) => ({ id: cid(), name, enabled: true, ...groutFields(g[name]) })),
      mortars: extraM.map((name) => ({ id: cid(), name, enabled: true, ...mortarFields(m[name]) })),
    });
  }
  return { companies };
}

const normGroutProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...groutFields(p) });
const normMortarProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...mortarFields(p) });

export function normalizeCatalog(catalog) {
  return {
    companies: (catalog?.companies || []).map((co) => ({
      id: co?.id || cid(),
      name: co?.name || "Company",
      enabled: co?.enabled !== false,
      grouts: (co?.grouts || []).map(normGroutProduct),
      mortars: (co?.mortars || []).map(normMortarProduct),
    })),
  };
}

// Flatten the catalog into name→numbers maps for the material math. Resolves
// EVERY product regardless of enabled state, so a saved job that picked a
// since-hidden product still computes. Names are unique per kind, so last write
// on a duplicate would win — but uniqueness is enforced on add.
export function resolveCatalog(catalog) {
  const grouts = {}, mortars = {};
  for (const co of (catalog?.companies || [])) {
    for (const p of (co.grouts || [])) grouts[p.name] = groutFields(p);
    for (const p of (co.mortars || [])) mortars[p.name] = mortarFields(p);
  }
  return { grouts, mortars };
}

// A product is offered in a job dropdown only when BOTH its company and itself
// are enabled. (resolveCatalog above deliberately ignores enabled — offering is
// a forward-looking control, resolving is for already-saved jobs.)
export const isOffered = (company, product) => !!(company?.enabled && product?.enabled);

const offeredNames = (catalog, kind) => {
  const names = [];
  for (const co of (catalog?.companies || [])) for (const p of (co[kind] || [])) if (isOffered(co, p)) names.push(p.name);
  return names;
};
export const offeredGrouts = (catalog) => offeredNames(catalog, "grouts");
export const offeredMortars = (catalog) => offeredNames(catalog, "mortars");

// The in-memory settings object carries the catalog plus derived grouts/mortars
// maps the math reads. Only { wastePct, catalog } is persisted.
export const withDerived = (s) => ({ ...s, ...resolveCatalog(s.catalog) });
export const serializeSettings = (s) => ({ wastePct: s.wastePct, catalog: s.catalog });

// Entry point for loaded/imported settings: backfill a pre-catalog record by
// seeding the catalog from its flat numbers (preserving tuned values), or
// normalize an existing catalog. Always attaches the derived maps.
export function normalizeSettings(raw) {
  const wastePct = raw?.wastePct ?? 10;
  const catalog = (raw?.catalog && Array.isArray(raw.catalog.companies))
    ? normalizeCatalog(raw.catalog)
    : seedCatalog(mergeSettings(raw));
  return withDerived({ wastePct, catalog });
}
