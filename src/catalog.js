// Pure, React-free domain logic for FloorTrack: the grout/mortar material math
// and (incrementally, across issue 002) the shared grout/mortar catalog.
//
// Kept import-free so it can be unit-tested with `node --test` (see
// catalog.test.js). App.jsx imports everything it needs from here.

export const GROUTS = ["PermaColor Select", "SpectraLOCK 1", "SpectraLOCK PRO", "CEG-Lite", "Tec Power Grout"];
export const MORTARS = ["ProLite", "AcrylPro", "Schluter All Set"];

// The flooring types a product row can be. Underlayment products are tagged with
// the subset of these they apply to (an empty tag list = applies to all types).
export const FLOOR_TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet"];

// CEG-Lite coverage (187 sq ft / Part A+B unit) is the manufacturer's published
// number at this app's 12×12×3/8" tile, 1/8" joint baseline. Tec Power Grout and
// Schluter All Set numbers are first-pass estimates the team is expected to
// calibrate against their real-world yields in Settings.
export const DEFAULTS = {
  wastePct: 10,
  mortars: { "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 0 }, "AcrylPro": { tier1: 40, tier2: 15, tier3: 10, unit: "gallons", price: 0 }, "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 0 } },
  grouts: { "PermaColor Select": { coverage: 110, unit: "bags", price: 0 }, "SpectraLOCK 1": { coverage: 85, unit: "units", price: 0 }, "SpectraLOCK PRO": { coverage: 90, unit: "units", price: 0 }, "CEG-Lite": { coverage: 187, unit: "units", price: 0 }, "Tec Power Grout": { coverage: 45, unit: "bags", price: 0 } },
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

// Underlayment / backer coverage is a flat area rate: one unit (roll, sheet,
// bag) covers `coverage` sq ft, so it scales straight off square footage with
// the waste factor — no tile-size volumetrics like grout. Applies to every
// flooring type, not just tile. A manual override wins, same as grout/mortar.
export function underlayExact(p, s) {
  if (p.qtyType !== "sqft") return null;
  const sqft = num(p.qty); if (!sqft) return 0;
  const u = s.underlayments?.[p.underlay.product]; if (!u) return null;
  const cov = num(u.coverage); if (!cov) return null;
  return sqft * (1 + num(s.wastePct) / 100) / cov;
}

export function getUnderlay(p, s) {
  // Misc lines are flat-priced extras — no underlayment, even if a checked
  // state survives a type switch.
  if (p.type === "misc" || !p.underlay?.checked) return null;
  const u = s.underlayments?.[p.underlay.product] || {};
  if (p.underlay.manual !== "" && p.underlay.manual != null) { const v = num(p.underlay.manual); return { exact: v, order: v, unit: u.unit, price: num(u.price), product: p.underlay.product }; }
  const ex = underlayExact(p, s); if (ex == null) return null;
  return { exact: ex, order: Math.ceil(ex), unit: u.unit, price: num(u.price), product: p.underlay.product };
}

// The extra materials to put the underlayment itself down (mortar bed, screws),
// opted into per job via the second checkbox. Each rides the same flat sq ft
// coverage as the underlayment; real square footage is required — a manual
// underlayment total carries no sq ft to scale from. Items with no coverage set
// (and mortar rows with no product picked) are skipped rather than half-computed,
// as are items the job opted out of via underlay.installSkip[def.id].
//
// A mortar row resolves unit/price from the mortar catalog by name — the job
// may swap which mortar via p.underlay.installMortars[def.id] — and is returned
// with kind "mortar" so the caller merges its quantity into the job's mortar
// totals instead of the underlayment column.
export function getUnderlayInstall(p, s) {
  if (p.type === "misc" || !p.underlay?.checked || !p.underlay?.install) return null;
  if (p.qtyType !== "sqft") return null;
  const sqft = num(p.qty); if (!sqft) return null;
  const defs = (s.underlayments?.[p.underlay.product]?.install || []).filter((m) => num(m.coverage) > 0);
  if (!defs.length) return null;
  const waste = 1 + num(s.wastePct) / 100;
  const out = [];
  for (const d of defs) {
    if (p.underlay.installSkip?.[d.id]) continue;
    const exact = sqft * waste / num(d.coverage);
    if (d.kind === "mortar") {
      const name = p.underlay.installMortars?.[d.id] || d.product;
      if (!name) continue;
      const m = s.mortars[name];
      out.push({ kind: "mortar", defId: d.id, name, exact, order: Math.ceil(exact), unit: m?.unit ?? "units", price: num(m?.price) });
    } else {
      out.push({ kind: "custom", defId: d.id, name: d.name, exact, order: Math.ceil(exact), unit: d.unit, price: num(d.price) });
    }
  }
  return out.length ? out : null;
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
  { name: "Custom Building Products", grouts: ["CEG-Lite"], mortars: ["ProLite", "AcrylPro"] },
  { name: "Tec", grouts: ["Tec Power Grout"], mortars: [] },
  { name: "Schluter", grouts: [], mortars: ["Schluter All Set"] },
  { name: "James Hardie", grouts: [], mortars: [] },
  { name: "Wedi", grouts: [], mortars: [] },
  { name: "Fortifiber", grouts: [], mortars: [] },
  { name: "MP Global", grouts: [], mortars: [] },
  { name: "Sika", grouts: [], mortars: [] },
];

// Starter underlayment/backer products, grouped by company. Coverage numbers are
// first-pass estimates the team is expected to calibrate in Settings (Ditra's
// 1/8" roll is ~54 sq ft). `types` restricts which flooring types offer it — an
// empty list would mean "all types". The rest of each category's underlayments
// are added by the team through the Settings catalog editor.
//
// `install` lists the extra materials it takes to put the underlayment itself
// down. A `kind: "mortar"` row links to a catalog mortar BY NAME (unit and
// price resolve from that mortar; only the flat under-the-board sq ft coverage
// lives here) so its quantity combines with the job's other mortar of the same
// name. A `kind: "custom"` row (screws, tape) is self-contained. Coverage
// numbers are first-pass estimates: ~50 sq ft per mortar bag with a 1/4"
// trowel, a BackerOn tub at ~2.3 screws/sq ft (8" spacing) — calibrate in
// Settings.
const SEED_UNDERLAYMENTS = [
  { company: "Schluter", name: "Ditra Underlayment Uncoupling Membrane", coverage: 54, unit: "rolls", price: 0, types: ["tile"], install: [
    { kind: "mortar", product: "Schluter All Set", coverage: 50 },
  ] },
  { company: "Custom Building Products", name: "RedGard Uncoupling Membrane", coverage: 54, unit: "rolls", price: 0, types: ["tile"] },
  { company: "James Hardie", name: "HardieBacker", coverage: 15, unit: "sheets", price: 0, types: ["tile"], install: [
    { kind: "mortar", product: "ProLite", coverage: 50 },
    { kind: "custom", name: "BackerOn screws", coverage: 75, unit: "tubs", price: 0 },
  ] },
  { company: "Wedi", name: "Wedi S-Dry", coverage: 100, unit: "rolls", price: 0, types: ["tile"] },
  { company: "Fortifiber", name: "Aquabar B", coverage: 500, unit: "rolls", price: 0, types: ["hardwood"] },
  { company: "MP Global", name: "FloorMuffler UltraSeal", coverage: 100, unit: "rolls", price: 0, types: ["hardwood", "laminate"] },
  { company: "Sika", name: "Sika MB Rapid Seal", coverage: 200, unit: "units", price: 0, types: ["hardwood", "vinyl", "laminate"] },
];

const groutFields = (g) => ({ coverage: g?.coverage ?? 0, unit: g?.unit ?? "units", price: g?.price ?? 0 });
const mortarFields = (m) => ({ tier1: m?.tier1 ?? 0, tier2: m?.tier2 ?? 0, tier3: m?.tier3 ?? 0, unit: m?.unit ?? "units", price: m?.price ?? 0 });
// Items stored before the mortar link existed have no `kind` — they normalize
// to "custom" with their fields intact.
const installItem = (m) => m?.kind === "mortar"
  ? ({ id: m?.id || cid(), kind: "mortar", product: String(m?.product ?? "").trim(), coverage: m?.coverage ?? 0 })
  : ({ id: m?.id || cid(), kind: "custom", name: String(m?.name ?? "").trim(), coverage: m?.coverage ?? 0, unit: m?.unit ?? "units", price: m?.price ?? 0 });
const underlayFields = (u) => ({ coverage: u?.coverage ?? 0, unit: u?.unit ?? "rolls", price: u?.price ?? 0, types: (Array.isArray(u?.types) ? u.types : []).filter((t) => FLOOR_TYPES.includes(t)), install: (Array.isArray(u?.install) ? u.install : []).map(installItem) });
const seedInstallFor = (name) => SEED_UNDERLAYMENTS.find((u) => u.install && normName(u.name) === normName(name))?.install;
const seedUnderlay = (u) => ({ id: cid(), name: u.name, enabled: true, ...underlayFields(u) });
const seedUnderlaysFor = (companyName) => SEED_UNDERLAYMENTS.filter((u) => u.company === companyName).map(seedUnderlay);

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
    underlayments: seedUnderlaysFor(co.name),
  }));
  const extraG = Object.keys(g).filter((n) => !seededG.has(n));
  const extraM = Object.keys(m).filter((n) => !seededM.has(n));
  if (extraG.length || extraM.length) {
    companies.push({
      id: cid(), name: "Unassigned", enabled: true,
      grouts: extraG.map((name) => ({ id: cid(), name, enabled: true, ...groutFields(g[name]) })),
      mortars: extraM.map((name) => ({ id: cid(), name, enabled: true, ...mortarFields(m[name]) })),
      underlayments: [],
    });
  }
  return { companies };
}

const normGroutProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...groutFields(p) });
const normMortarProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...mortarFields(p) });
// A stored product with NO `install` key predates the install-materials field:
// backfill the seed defaults by name (one-time — once persisted the key exists,
// so a team that clears the list keeps it cleared).
const normUnderlayProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...underlayFields(p?.install === undefined ? { ...p, install: seedInstallFor(p?.name) } : p) });

// Starter underlayments are merged by NAME: any SEED_UNDERLAYMENTS entry whose
// name is missing from the whole catalog is added under its seed company
// (created if absent). Existing products are never touched, so team-tuned
// coverage/price numbers survive — but renaming a seeded product will make the
// backfill re-add it under the original name. Seeds the team deleted are
// tombstoned in catalog.removedSeeds so they stay deleted across loads.
function backfillUnderlayments(companies, removedSeeds) {
  const have = new Set(companies.flatMap((co) => (co.underlayments || []).map((p) => normName(p.name))));
  const missing = SEED_UNDERLAYMENTS.filter((u) => !have.has(normName(u.name)) && !removedSeeds.includes(normName(u.name)));
  if (!missing.length) return companies;
  const out = companies.map((co) => {
    const seeds = missing.filter((u) => normName(u.company) === normName(co.name)).map(seedUnderlay);
    return seeds.length ? { ...co, underlayments: [...co.underlayments, ...seeds] } : co;
  });
  const haveCompany = new Set(companies.map((co) => normName(co.name)));
  for (const name of [...new Set(missing.map((u) => u.company))]) {
    if (!haveCompany.has(normName(name))) out.push({ id: cid(), name, enabled: true, grouts: [], mortars: [], underlayments: missing.filter((u) => u.company === name).map(seedUnderlay) });
  }
  return out;
}

export function normalizeCatalog(catalog) {
  const removedSeeds = (Array.isArray(catalog?.removedSeeds) ? catalog.removedSeeds : []).map(normName);
  const companies = (catalog?.companies || []).map((co) => ({
    id: co?.id || cid(),
    name: co?.name || "Company",
    enabled: co?.enabled !== false,
    grouts: (co?.grouts || []).map(normGroutProduct),
    mortars: (co?.mortars || []).map(normMortarProduct),
    underlayments: (co?.underlayments || []).map(normUnderlayProduct),
  }));
  return { companies: backfillUnderlayments(companies, removedSeeds), removedSeeds };
}

// True when the stored catalog already contains every starter underlayment
// (including install-material defaults on the ones that seed them) — used by
// the loader to decide whether the merged-in seeds need persisting. Tombstoned
// seeds count as present: there is nothing to merge back in.
export const catalogHasSeedUnderlayments = (catalog) => {
  const removed = (catalog?.removedSeeds || []).map(normName);
  const have = new Map((catalog?.companies || []).flatMap((co) => (co.underlayments || []).map((p) => [normName(p.name), p])));
  return SEED_UNDERLAYMENTS.every((u) => { if (removed.includes(normName(u.name))) return true; const p = have.get(normName(u.name)); return p && (!u.install || p.install !== undefined); });
};

// Names are matched case- and whitespace-insensitively, consistent with how a
// job's stored name keys into the catalog at lookup time. Product names must be
// unique within grout and within mortar (a name may be reused across the two).
const normName = (s) => String(s ?? "").trim().toLowerCase();

export function isDuplicateName(catalog, kind, name) {
  const target = normName(name);
  if (!target) return false;
  for (const co of (catalog?.companies || [])) for (const p of (co[kind] || [])) if (normName(p.name) === target) return true;
  return false;
}

export function addCompany(catalog, name) {
  const company = { id: cid(), name: String(name || "").trim() || "New Company", enabled: true, grouts: [], mortars: [] };
  return { ...catalog, companies: [...(catalog?.companies || []), company] };
}

// Append a product (defaulting to enabled) under a company. Uniqueness is the
// caller's gate (see isDuplicateName) — this is the pure append.
export function addProduct(catalog, companyId, kind, fields) {
  const base = { id: cid(), name: String(fields?.name || "").trim(), enabled: true };
  const shape = kind === "grouts" ? groutFields(fields) : kind === "mortars" ? mortarFields(fields) : underlayFields(fields);
  const product = { ...base, ...shape };
  return { ...catalog, companies: (catalog?.companies || []).map((co) => co.id === companyId ? { ...co, [kind]: [...(co[kind] || []), product] } : co) };
}

// Deleting is permanent and sharper than disabling: saved jobs keep the name
// they stored, but the math can no longer resolve it, so their quantities stop
// calculating. A deleted starter underlayment is tombstoned so the seed
// backfill doesn't resurrect it on the next load.
export function removeProduct(catalog, companyId, kind, productId) {
  let removedName = null;
  const companies = (catalog?.companies || []).map((co) => {
    if (co.id !== companyId) return co;
    const target = (co[kind] || []).find((p) => p.id === productId);
    if (target) removedName = normName(target.name);
    return { ...co, [kind]: (co[kind] || []).filter((p) => p.id !== productId) };
  });
  const seedGone = kind === "underlayments" && removedName && SEED_UNDERLAYMENTS.some((u) => normName(u.name) === removedName);
  const removedSeeds = seedGone ? [...new Set([...(catalog?.removedSeeds || []), removedName])] : (catalog?.removedSeeds || []);
  return { ...catalog, companies, removedSeeds };
}

// UI only offers this for empty companies — delete the products first.
export function removeCompany(catalog, companyId) {
  return { ...catalog, companies: (catalog?.companies || []).filter((co) => co.id !== companyId) };
}

// Flatten the catalog into name→numbers maps for the material math. Resolves
// EVERY product regardless of enabled state, so a saved job that picked a
// since-hidden product still computes. Names are unique per kind, so last write
// on a duplicate would win — but uniqueness is enforced on add.
export function resolveCatalog(catalog) {
  const grouts = {}, mortars = {}, underlayments = {};
  for (const co of (catalog?.companies || [])) {
    for (const p of (co.grouts || [])) grouts[p.name] = groutFields(p);
    for (const p of (co.mortars || [])) mortars[p.name] = mortarFields(p);
    for (const p of (co.underlayments || [])) underlayments[p.name] = underlayFields(p);
  }
  return { grouts, mortars, underlayments };
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

// Underlayments are additionally filtered by flooring type: a product is offered
// to a job only when its `types` tag includes that type (an empty tag = all).
export const offeredUnderlayments = (catalog, type) => {
  const names = [];
  for (const co of (catalog?.companies || [])) for (const p of (co.underlayments || [])) if (isOffered(co, p) && (!(p.types || []).length || p.types.includes(type))) names.push(p.name);
  return names;
};

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
