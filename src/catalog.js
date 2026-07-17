// Pure, React-free domain logic for FloorTrack: the grout/mortar material math
// and (incrementally, across issue 002) the shared grout/mortar catalog.
//
// Kept React-free so it can be unit-tested with `node --test` (see
// catalog.test.js). App.jsx imports everything it needs from here. The one
// module dependency is the equally pure vendorfetch.js (no React either).
import { normVendorGroups } from "./vendorfetch.js";

export const GROUTS = ["PermaColor Select", "SpectraLOCK 1", "SpectraLOCK PRO", "CEG-Lite", "Tec Power Grout"];
export const MORTARS = ["ProLite", "AcrylPro", "Schluter All Set"];

// The product a brand-new tile row defaults its grout/mortar chip to. Team-set
// via Settings and stored on `catalog.defaults`; these seed values are only the
// starting point (and the last-resort when a stored default is blank).
export const DEFAULT_GROUT = "PermaColor Select";
export const DEFAULT_MORTAR = "ProLite";

// The flooring types a product row can be. Underlayment products are tagged with
// the subset of these they apply to (an empty tag list = applies to all types).
export const FLOOR_TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet"];

// CEG-Lite coverage (187 sq ft / Part A+B unit) is the manufacturer's published
// number at this app's 12×12×3/8" tile, 1/8" joint baseline. Tec Power Grout and
// Schluter All Set numbers are first-pass estimates the team is expected to
// calibrate against their real-world yields in Settings.
export const DEFAULTS = {
  waste: { tile: 10, floor: 10 },
  mortars: { "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 0 }, "AcrylPro": { tier1: 40, tier2: 15, tier3: 10, unit: "gallons", price: 0 }, "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 0 } },
  grouts: { "PermaColor Select": { coverage: 110, unit: "bags", price: 0 }, "SpectraLOCK 1": { coverage: 85, unit: "units", price: 0 }, "SpectraLOCK PRO": { coverage: 90, unit: "units", price: 0 }, "CEG-Lite": { coverage: 187, unit: "units", price: 0 }, "Tec Power Grout": { coverage: 45, unit: "bags", price: 0 } },
};

// Grout scales volumetrically from a 12×12×3/8" tile with a 1/8" joint.
export const REF = ((12 + 12) / (12 * 12)) * 0.375 * 0.125;

export const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Round away float noise before ceiling: 200 sf at 10% waste over 110 coverage
// is exactly 2 units, not 3 (200 * 1.1 / 110 = 2.0000000000000004). Every
// order quantity ceils through here.
export const ceilQty = (ex) => Math.ceil(Math.round(ex * 1e6) / 1e6);

// Waste is per material family: one rate for tile, one shared by every other
// flooring type (hardwood/vinyl/laminate/carpet). Records written before the
// split stored a single `wastePct` number — migrate it onto both families so
// old data keeps the rate it had. An explicit `waste.tile`/`waste.floor` wins
// over the legacy number, which wins over the 10% default.
export const normWaste = (raw) => {
  const legacy = (raw?.wastePct == null || raw?.wastePct === "") ? null : raw.wastePct;
  const base = legacy ?? 10;
  const w = raw?.waste || {};
  return { tile: w.tile ?? base, floor: w.floor ?? base };
};

// The waste multiplier a product line calcs against: tile lines use the tile
// rate, all other flooring types share the floor rate. Misc lines never reach
// here (their callers exclude them) and carry no waste.
export const wasteFor = (p, s) => 1 + num(p?.type === "tile" ? s?.waste?.tile : s?.waste?.floor) / 100;

// Normalize a loaded/imported Settings object back to the full shape, filling
// gaps from DEFAULTS so older records stay valid. (`s.mortar` is a legacy
// single-mortar field that predates the per-product map.)
export const mergeSettings = (s) => ({
  waste: normWaste(s),
  mortars: MORTARS.reduce((o, k) => ({ ...o, [k]: { ...DEFAULTS.mortars[k], ...((s?.mortars?.[k]) || (k === "ProLite" ? s?.mortar : null) || {}) } }), {}),
  grouts: GROUTS.reduce((o, k) => ({ ...o, [k]: { ...DEFAULTS.grouts[k], ...(s?.grouts?.[k] || {}) } }), {}),
});

export function mortarExact(p, s) {
  if (p.type !== "tile" || p.qtyType !== "sqft") return null;
  const sqft = num(p.qty); if (!sqft) return 0;
  const longest = Math.max(num(p.L), num(p.W)); if (!longest) return null;
  const m = s.mortars[p.mortar.product]; if (!m) return null;
  const cov = longest < 8 ? m.tier1 : longest <= 15 ? m.tier2 : m.tier3;
  return sqft * wasteFor(p, s) / (num(cov) || 1);
}

export function getMortar(p, s) {
  if (p.type !== "tile" || !p.mortar.checked) return null;
  const m = s.mortars[p.mortar.product] || {};
  if (p.mortar.manual !== "" && p.mortar.manual != null) { const v = num(p.mortar.manual); return { exact: v, order: v, unit: m.unit, price: num(m.price), product: p.mortar.product }; }
  const ex = mortarExact(p, s); if (ex == null) return null;
  return { exact: ex, order: ceilQty(ex), unit: m.unit, price: num(m.price), product: p.mortar.product };
}

// A penny round (or any round chip) leaves grout at the four corners its circle
// can't reach — area the L×W square proxy never accounts for — so it needs more
// grout than a square tile of the same size. `roundGroutExtra` is that corner
// fill as a volume-per-area term added onto the square joint volume: each cell
// is (d+J)², the circle covers πd²/4, so the corners are d²(1−π/4) of the cell
// (ADR 0015). Rounds are recognized by the "Penny"/"Round" the size string
// carries (hexes tile flush and are excluded). Off for square tiles.
const ROUND_RE = /\b(penny|round)\b/i;
export const isRoundTile = (p) => p?.type === "tile" && ROUND_RE.test(String(p?.sizeText || ""));
const roundGroutExtra = (d, J, T) => { const cell = d + J; return cell > 0 ? ((d * d * (1 - Math.PI / 4)) / (cell * cell)) * T : 0; };

export function groutExact(p, s) {
  if (p.type !== "tile" || p.qtyType !== "sqft") return null;
  const sqft = num(p.qty), L = num(p.L), W = num(p.W), T = num(p.thickness), J = num(p.grout.joint);
  if (!sqft || !L || !W || !T || !J) return null;
  let vol = ((L + W) / (L * W)) * T * J;
  if (isRoundTile(p)) vol += roundGroutExtra((L + W) / 2, J, T);
  if (!vol) return null;
  const cov = num(s.grouts[p.grout.product]?.coverage) * (REF / vol);
  return sqft * wasteFor(p, s) / (cov || 1);
}

export function getGrout(p, s) {
  if (p.type !== "tile" || !p.grout.checked) return null;
  const g = s.grouts[p.grout.product] || {};
  if (p.grout.manual !== "" && p.grout.manual != null) { const v = num(p.grout.manual); return { exact: v, order: v, unit: g.unit, price: num(g.price), sku: g.sku || "", product: p.grout.product, color: p.grout.color, round: isRoundTile(p) }; }
  const ex = groutExact(p, s); if (ex == null) return null;
  return { exact: ex, order: ceilQty(ex), unit: g.unit, price: num(g.price), sku: g.sku || "", product: p.grout.product, color: p.grout.color, round: isRoundTile(p) };
}

// The base unit a two-part grout drags along (ADR 0006). One base per grout kit,
// divided by `per` (a Commercial unit covers 4), so it rides the grout's own
// ordered kit count — no separate area math. Null when the grout has no base.
// `name`/`sku` are the identity the totals summary consolidates on.
export function getGroutBase(p, s) {
  const G = getGrout(p, s); if (!G) return null;
  const b = (s.grouts[p.grout.product] || {}).base; if (!b) return null;
  const per = num(b.per) > 0 ? num(b.per) : 1;
  const exact = G.order / per;
  return { sku: b.sku || "", name: b.name || "", unit: b.unit, price: num(b.price), per, exact, order: ceilQty(exact) };
}

// Consolidated base units for a whole job's aggregated grout list (ADR 0006).
// Takes entries of { product, order } — the SAME aggregated kit counts the
// totals summary shows — and groups their bases by identity, so two colors of
// one grout (or two grouts sharing a base) order one combined base line:
// order = ceil(total kits / per). Both the on-screen order summary and the
// printed breakdown call this, so they can never disagree.
export function groutBaseList(groutEntries, s) {
  const agg = new Map();
  for (const g of groutEntries || []) {
    if (!g || !(g.order > 0)) continue;
    const b = s.grouts[g.product]?.base; if (!b) continue;
    const key = b.sku || b.name;
    const e = agg.get(key) || { sku: b.sku || "", name: b.name || b.sku, unit: b.unit, price: num(b.price), per: num(b.per) > 0 ? num(b.per) : 1, kits: 0 };
    e.kits += g.order;
    agg.set(key, e);
  }
  return [...agg.values()].map((b) => {
    const exact = b.kits / b.per;
    const order = ceilQty(exact);
    return { ...b, exact, order, cost: order * b.price };
  });
}

// Flooring sold by the carton/sheet: p.cartonSf is the sq ft one carton covers
// (snapshotted from the price book's SF/CT column, or typed). Same shape as
// grout/mortar — exact carries the waste factor, order rounds up to whole
// cartons, a manual total overrides. Never applies to misc lines or
// count-quantity rows.
export function cartonExact(p, s) {
  if (p.type === "misc" || p.qtyType !== "sqft") return null;
  const per = num(p.cartonSf); if (!per) return null;
  const sqft = num(p.qty); if (!sqft) return 0;
  return sqft * wasteFor(p, s) / per;
}

export function getCarton(p, s) {
  if (p.type === "misc" || p.qtyType !== "sqft") return null;
  const per = num(p.cartonSf); if (!per) return null;
  const unit = String(p.cartonUnit || "CT").toLowerCase();
  if (p.cartonManual !== "" && p.cartonManual != null) { const v = num(p.cartonManual); return { exact: v, order: v, sf: per, unit }; }
  const ex = cartonExact(p, s); if (ex == null) return null;
  return { exact: ex, order: ceilQty(ex), sf: per, unit };
}

// A count line sold only by whole cartons (ADR 0013 amendment): p.cartonPc is
// the pieces one carton holds (the book's PC/CT, snapshotted at pick — the
// piece-count twin of cartonSf). The entered qty is pieces NEEDED; the order
// rounds up to full cartons and bills every piece in them, price staying per
// piece. cartonManual (a carton count) overrides, like flooring cartons. No
// waste factor — trim is counted, not measured.
export function getPieceCarton(p) {
  if (p.type !== "misc") return null;
  const per = num(p.cartonPc); if (!per) return null;
  const unit = String(p.cartonUnit || "CT").toLowerCase();
  if (p.cartonManual !== "" && p.cartonManual != null) { const v = num(p.cartonManual); return { need: v * per, cartons: v, pieces: v * per, per, unit }; }
  // Blank qty bills one piece, matching the flat-misc convention (miscQty).
  const need = p.qtyType === "count" && String(p.qty ?? "").trim() !== "" ? num(p.qty) : 1;
  const cartons = Math.ceil(need / per);
  return { need, cartons, pieces: cartons * per, per, unit };
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
  return sqft * wasteFor(p, s) / cov;
}

export function getUnderlay(p, s) {
  // Misc lines are flat-priced extras — no underlayment, even if a checked
  // state survives a type switch.
  if (p.type === "misc" || !p.underlay?.checked) return null;
  const u = s.underlayments?.[p.underlay.product] || {};
  if (p.underlay.manual !== "" && p.underlay.manual != null) { const v = num(p.underlay.manual); return { exact: v, order: v, unit: u.unit, price: num(u.price), product: p.underlay.product }; }
  const ex = underlayExact(p, s); if (ex == null) return null;
  return { exact: ex, order: ceilQty(ex), unit: u.unit, price: num(u.price), product: p.underlay.product };
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
  const waste = wasteFor(p, s);
  const out = [];
  for (const d of defs) {
    if (p.underlay.installSkip?.[d.id]) continue;
    const exact = sqft * waste / num(d.coverage);
    if (d.kind === "mortar") {
      const name = p.underlay.installMortars?.[d.id] || d.product;
      if (!name) continue;
      const m = s.mortars[name];
      out.push({ kind: "mortar", defId: d.id, name, exact, order: ceilQty(exact), unit: m?.unit ?? "units", price: num(m?.price) });
    } else {
      out.push({ kind: "custom", defId: d.id, name: d.name, sku: d.sku || "", exact, order: ceilQty(exact), unit: d.unit, price: num(d.price) });
    }
  }
  return out.length ? out : null;
}

// The row-level "not calculating" warnings (spec 2026-07-14). A checked
// material whose getter yields nothing is silently missing from the estimate;
// this names them so the UI can warn. Suppressed entirely while the row has
// no square footage — every fresh row starts that way, and the SF input's own
// highlight covers it — so a warning always means "SF is entered but this
// material still can't compute" (dims, thickness, or coverage).
export function materialWarnings(p, s) {
  if (p.type === "misc") return [];
  if (p.qtyType === "sqft" && !num(p.qty)) return [];
  const out = [];
  if (p.type === "tile" && p.grout?.checked && !getGrout(p, s)) out.push("grout");
  if (p.type === "tile" && p.mortar?.checked && !getMortar(p, s)) out.push("mortar");
  const U = getUnderlay(p, s);
  if (p.underlay?.checked && (!U || !U.product)) out.push("underlay");
  if (U && U.product && p.underlay?.install) {
    const defs = (s.underlayments?.[p.underlay.product]?.install || []).filter((d) => !p.underlay.installSkip?.[d.id]);
    if (defs.length && !getUnderlayInstall(p, s)) out.push("install");
  }
  // Add-on categories (ADR 0016): a checked chip whose product no longer
  // resolves — or whose coverage can't compute — is warned like the built-ins.
  for (const cat of (s.catalog?.categories || [])) {
    if (p.attached?.[cat.id]?.checked && !getAttached(p, s, cat)) out.push(`attach:${cat.id}`);
  }
  return out;
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

// A grout's "base unit" companion (ADR 0006): the material a two-part grout's
// pigment is mixed into (SpectraLock Full/Comm, PermaColor Sanded/Unsanded),
// carried on the grout product and ordered 1:1 with its kits. `per` is how many
// grout kits one base covers (1 for a Full/Sanded/Unsanded base, 4 for a
// Commercial unit). Needs a name or SKU to have an identity; absent → null.
const baseCompanion = (b) => {
  const name = String(b?.name ?? "").trim(), sku = String(b?.sku ?? "").trim();
  if (!name && !sku) return null;
  return { sku, name, unit: b?.unit ?? "units", price: b?.price ?? 0, per: num(b?.per) > 0 ? num(b.per) : 1 };
};
const skuField = (p) => String(p?.sku ?? "").trim();
// `book` (ADR 0007): the price-book grout family this product offers its
// colors from — the stock items' `product` name. Empty = standard color list.
const groutFields = (g) => ({ coverage: g?.coverage ?? 0, unit: g?.unit ?? "units", price: g?.price ?? 0, sku: skuField(g), book: String(g?.book ?? "").trim(), base: baseCompanion(g?.base) });
const mortarFields = (m) => ({ tier1: m?.tier1 ?? 0, tier2: m?.tier2 ?? 0, tier3: m?.tier3 ?? 0, unit: m?.unit ?? "units", price: m?.price ?? 0, sku: skuField(m) });
// Items stored before the mortar link existed have no `kind` — they normalize
// to "custom" with their fields intact.
const installItem = (m) => m?.kind === "mortar"
  ? ({ id: m?.id || cid(), kind: "mortar", product: String(m?.product ?? "").trim(), coverage: m?.coverage ?? 0 })
  : ({ id: m?.id || cid(), kind: "custom", name: String(m?.name ?? "").trim(), coverage: m?.coverage ?? 0, unit: m?.unit ?? "units", price: m?.price ?? 0, sku: skuField(m) });
const underlayFields = (u) => ({ coverage: u?.coverage ?? 0, unit: u?.unit ?? "rolls", price: u?.price ?? 0, sku: skuField(u), types: (Array.isArray(u?.types) ? u.types : []).filter((t) => FLOOR_TYPES.includes(t)), install: (Array.isArray(u?.install) ? u.install : []).map(installItem) });
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
    attached: [],
  }));
  const extraG = Object.keys(g).filter((n) => !seededG.has(n));
  const extraM = Object.keys(m).filter((n) => !seededM.has(n));
  if (extraG.length || extraM.length) {
    companies.push({
      id: cid(), name: "Unassigned", enabled: true,
      grouts: extraG.map((name) => ({ id: cid(), name, enabled: true, ...groutFields(g[name]) })),
      mortars: extraM.map((name) => ({ id: cid(), name, enabled: true, ...mortarFields(m[name]) })),
      underlayments: [],
      attached: [],
    });
  }
  return { companies, categories: [], defaults: normDefaults() };
}

// The team's chosen chip defaults, one per material kind. Stored names are kept
// verbatim (they may point at a now-hidden product); resolveMaterialDefault
// decides at chip time whether they still apply. Absent → the seed names.
export const normDefaults = (raw) => ({
  grout: String(raw?.grout ?? DEFAULT_GROUT),
  mortar: String(raw?.mortar ?? DEFAULT_MORTAR),
  underlay: String(raw?.underlay ?? ""),
});

// Set the chip default for a kind ("grouts"/"mortars"/"underlayments") to a product name.
export function setCatalogDefault(catalog, kind, name) {
  const key = kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : "underlay";
  return { ...catalog, defaults: { ...normDefaults(catalog?.defaults), [key]: String(name || "") } };
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
    attached: (co?.attached || []).map(normAttachedProduct),
  }));
  return { companies: backfillUnderlayments(companies, removedSeeds), removedSeeds, categories: (Array.isArray(catalog?.categories) ? catalog.categories : []).map(normCategory), defaults: normDefaults(catalog?.defaults) };
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
  const company = { id: cid(), name: String(name || "").trim() || "New Company", enabled: true, grouts: [], mortars: [], underlayments: [], attached: [] };
  return { ...catalog, companies: [...(catalog?.companies || []), company] };
}

// Append a product (defaulting to enabled) under a company. Uniqueness is the
// caller's gate (see isDuplicateName) — this is the pure append.
export function addProduct(catalog, companyId, kind, fields) {
  const base = { id: cid(), name: String(fields?.name || "").trim(), enabled: true };
  const shape = kind === "grouts" ? groutFields(fields) : kind === "mortars" ? mortarFields(fields) : kind === "attached" ? attachedFields(fields) : underlayFields(fields);
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

// Renaming has the same consequence as deleting for saved jobs: they keep the
// old name string, which no longer resolves, so their quantities stop
// calculating (the UI warns). A renamed starter underlayment tombstones its
// seed name so the backfill doesn't re-add the original alongside it.
export function renameProduct(catalog, companyId, kind, productId, name) {
  const next = String(name || "").trim();
  if (!next) return catalog;
  let oldName = null;
  const companies = (catalog?.companies || []).map((co) => {
    if (co.id !== companyId) return co;
    return { ...co, [kind]: (co[kind] || []).map((p) => { if (p.id !== productId) return p; oldName = normName(p.name); return { ...p, name: next }; }) };
  });
  const seedGone = kind === "underlayments" && oldName && oldName !== normName(next) && SEED_UNDERLAYMENTS.some((u) => normName(u.name) === oldName);
  const removedSeeds = seedGone ? [...new Set([...(catalog?.removedSeeds || []), oldName])] : (catalog?.removedSeeds || []);
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
  const grouts = {}, mortars = {}, underlayments = {}, attached = {};
  for (const co of (catalog?.companies || [])) {
    for (const p of (co.grouts || [])) grouts[p.name] = groutFields(p);
    for (const p of (co.mortars || [])) mortars[p.name] = mortarFields(p);
    for (const p of (co.underlayments || [])) underlayments[p.name] = underlayFields(p);
    for (const p of (co.attached || [])) { (attached[p.categoryId] ||= {})[p.name] = attachedFields(p); }
  }
  return { grouts, mortars, underlayments, attached };
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

// The product a fresh row's grout/mortar chip should show, resolved against
// what the catalog currently offers. Order of preference:
//   1. the row's own pick, when it is still offered (a real, valid choice)
//   2. the team's catalog default (`preferred`), when it is still offered
//   3. the first offered product — so the chip never lands on a name that
//      computes nothing (e.g. a renamed/removed seed like ProLite)
// A fresh row carries no pick (product ""), so the catalog default governs it;
// falls through to "" only when the catalog offers nothing.
export const resolveMaterialDefault = (offered, current, preferred) => {
  const list = offered || [];
  if (current && list.includes(current)) return current;
  if (preferred && list.includes(preferred)) return preferred;
  return list[0] || "";
};

// Underlayments are additionally filtered by flooring type: a product is offered
// to a job only when its `types` tag includes that type (an empty tag = all).
export const offeredUnderlayments = (catalog, type) => {
  const names = [];
  for (const co of (catalog?.companies || [])) for (const p of (co.underlayments || [])) if (isOffered(co, p) && (!(p.types || []).length || p.types.includes(type))) names.push(p.name);
  return names;
};

// --- Custom material categories (ADR 0016) -----------------------------------
// The built-ins (grout/mortar/underlayment) stay first-class code; `categories`
// holds only the team's custom add-on categories (Trim, Sealer, …). floorTypes
// empty = offered on all types (underlayment's `types` convention); `math`
// picks the quantity model: "coverage" = flat sq ft/unit like underlayment,
// "manual" = typed per-row quantity. `default` is the chip's pre-selected
// product name (resolveMaterialDefault semantics; "" = first offered).
export const CATEGORY_MATHS = ["coverage", "manual"];
const categoryFields = (c) => ({
  name: String(c?.name ?? "").trim(),
  floorTypes: (Array.isArray(c?.floorTypes) ? c.floorTypes : []).filter((t) => FLOOR_TYPES.includes(t)),
  math: CATEGORY_MATHS.includes(c?.math) ? c.math : "coverage",
  default: String(c?.default ?? ""),
});
const normCategory = (c) => ({ id: c?.id || cid(), enabled: c?.enabled !== false, ...categoryFields(c) });

// Custom names may not collide with each other or shadow a built-in label —
// the Materials & add-ons nav lists both groups side by side.
const BUILTIN_CATEGORY_NAMES = ["grout", "mortar", "underlayment"];
export function isDuplicateCategoryName(catalog, name, exceptId) {
  const target = normName(name);
  if (!target) return false;
  if (BUILTIN_CATEGORY_NAMES.includes(target)) return true;
  return (catalog?.categories || []).some((c) => c.id !== exceptId && normName(c.name) === target);
}

export function addCategory(catalog, fields) {
  return { ...catalog, categories: [...(catalog?.categories || []), normCategory({ ...fields, id: undefined, enabled: true })] };
}

export function updateCategory(catalog, categoryId, patch) {
  return { ...catalog, categories: (catalog?.categories || []).map((c) => c.id === categoryId ? normCategory({ ...c, ...patch, id: c.id }) : c) };
}

const attachedFields = (p) => ({ categoryId: String(p?.categoryId ?? ""), coverage: p?.coverage ?? 0, unit: p?.unit ?? "units", price: p?.price ?? 0, sku: skuField(p) });
const normAttachedProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...attachedFields(p) });

// Attached names are unique within their category (a "RENO-U" trim and a
// "RENO-U" threshold can coexist) — the per-kind convention, category-scoped.
export function isDuplicateAttachedName(catalog, categoryId, name) {
  const target = normName(name);
  if (!target) return false;
  for (const co of (catalog?.companies || [])) for (const p of (co.attached || [])) if (p.categoryId === categoryId && normName(p.name) === target) return true;
  return false;
}

export const offeredAttached = (catalog, categoryId) => {
  const names = [];
  for (const co of (catalog?.companies || [])) for (const p of (co.attached || [])) if (isOffered(co, p) && p.categoryId === categoryId) names.push(p.name);
  return names;
};

// The enabled add-on categories a product row of `type` offers as chips: an
// empty floorTypes list = every type (underlayment's `types` convention).
export const offeredCategories = (catalog, type) =>
  (catalog?.categories || []).filter((c) => c.enabled !== false && (!(c.floorTypes || []).length || (c.floorTypes || []).includes(type)));

// A job's add-on material for one category, resolved by NAME at calc time
// (mortar/underlayment convention — no snapshot). Same
// `{ exact, order, unit, price, product }` shape as getUnderlay. Two quantity
// models: "manual" (the typed per-row quantity IS the amount, no area math) and
// "coverage" (flat sq ft/unit scaled off area × waste, a manual total wins —
// identical to underlayment). Returns null when the product name no longer
// resolves (deleted/renamed) so materialWarnings can flag it. Never on misc.
export function getAttached(p, s, category) {
  if (!category || p.type === "misc") return null;
  const a = p.attached?.[category.id];
  if (!a || !a.checked) return null;
  const prod = (s.attached?.[category.id] || {})[a.product];
  if (!prod) return null;
  const unit = prod.unit || "units", price = num(prod.price), product = a.product;
  if (category.math === "manual") { const v = num(a.manual); return { exact: v, order: v, unit, price, product }; }
  if (a.manual !== "" && a.manual != null) { const v = num(a.manual); return { exact: v, order: v, unit, price, product }; }
  if (p.qtyType !== "sqft") return null;
  const sqft = num(p.qty); if (!sqft) return { exact: 0, order: 0, unit, price, product };
  const cov = num(prod.coverage); if (!cov) return null;
  const exact = sqft * wasteFor(p, s) / cov;
  return { exact, order: ceilQty(exact), unit, price, product };
}

// Whole-job add-on materials, aggregated one line per (category, product):
// exact summed then ceiled once (like the on-screen totals), cost from the
// ceiled order. Shared by the order summary, estimate breakdown, order sheet,
// and grand total so they can never disagree (the groutBaseList precedent).
// `cust.categories` are the job's areas; add-on categories live on s.catalog.
export function attachedList(cust, s) {
  const cats = s.catalog?.categories || [];
  if (!cats.length) return [];
  const byCat = new Map();
  for (const area of (cust?.categories || [])) for (const p of (area.products || [])) for (const cat of cats) {
    const A = getAttached(p, s, cat); if (!A) continue;
    const m = byCat.get(cat.id) || new Map();
    const e = m.get(A.product) || { categoryId: cat.id, category: cat.name, product: A.product, unit: A.unit, price: A.price, exact: 0 };
    e.exact += A.exact; e.unit = A.unit; e.price = A.price;
    m.set(A.product, e); byCat.set(cat.id, m);
  }
  const out = [];
  for (const cat of cats) { const m = byCat.get(cat.id); if (!m) continue; for (const e of m.values()) { const order = ceilQty(e.exact); const sku = s.attached?.[cat.id]?.[e.product]?.sku || ""; out.push({ ...e, sku, order, cost: order * num(e.price) }); } }
  return out;
}

// Deleting a category is permanent and sharper than disabling: its products
// are pruned from every company, and (once jobs wire in, PR 3) saved jobs
// keep the stored name but stop calculating — same consequence as deleting a
// product.
export function removeCategory(catalog, categoryId) {
  return {
    ...catalog,
    categories: (catalog?.categories || []).filter((c) => c.id !== categoryId),
    companies: (catalog?.companies || []).map((co) => (co.attached || []).some((p) => p.categoryId === categoryId) ? { ...co, attached: co.attached.filter((p) => p.categoryId !== categoryId) } : co),
  };
}

// Operational provenance, shared team-wide with the settings record: who last
// ran the price-book import / backup download, and when. Purely informational —
// nothing computes from it.
const normStamp = (v) => {
  if (!v || typeof v !== "object" || !(num(v.at) > 0)) return null;
  const s = { at: num(v.at), by: String(v.by || "") };
  if (v.skus != null && num(v.skus) > 0) s.skus = num(v.skus);
  return s;
};
export const normOps = (raw) => {
  const lastImport = normStamp(raw?.lastImport), lastBackup = normStamp(raw?.lastBackup);
  // Owner override for the price-book staleness chip (orderbook DEFAULT_STALE_DAYS
  // when unset/invalid); a positive whole-day count or nothing.
  const sd = Math.round(num(raw?.staleDays));
  const staleDays = sd > 0 ? sd : null;
  // Vendor sheets remembered by the fetch page, organized into sign-in groups
  // (stable portal params only — a session token must never persist in shared
  // settings). A pre-groups flat `vendorSheets` array migrates to groups here,
  // one-way: it's never written back flat.
  const vendorGroups = normVendorGroups(raw);
  if (!lastImport && !lastBackup && staleDays == null && !vendorGroups.length) return undefined;
  return { ...(lastImport ? { lastImport } : {}), ...(lastBackup ? { lastBackup } : {}), ...(staleDays != null ? { staleDays } : {}), ...(vendorGroups.length ? { vendorGroups } : {}) };
};

// Team-wide tier percentages (spec 2026-07-16): Builder / Sale % off retail,
// edited in Settings → Price book, clamped to a sane discount range.
const pct100 = (v, dflt) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : dflt; };
// Markup can legitimately exceed 100% — its own clamp, not pct100.
const pctMarkup = (v, dflt) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(500, Math.max(0, n)) : dflt; };
export const normPricing = (raw) => ({ builderPct: pct100(raw?.builderPct, 8), salePct: pct100(raw?.salePct, 10), sheogaMarkupPct: pctMarkup(raw?.sheogaMarkupPct, 40) });

// The in-memory settings object carries the catalog plus derived grouts/mortars
// maps the math reads. Only { waste, catalog, pricing, ops } is persisted.
export const withDerived = (s) => ({ ...s, ...resolveCatalog(s.catalog) });
export const serializeSettings = (s) => {
  const ops = normOps(s.ops);
  return { waste: s.waste, catalog: s.catalog, pricing: normPricing(s.pricing), ...(ops ? { ops } : {}) };
};

// Entry point for loaded/imported settings: backfill a pre-catalog record by
// seeding the catalog from its flat numbers (preserving tuned values), or
// normalize an existing catalog. Always attaches the derived maps.
export function normalizeSettings(raw) {
  const waste = normWaste(raw);
  const catalog = (raw?.catalog && Array.isArray(raw.catalog.companies))
    ? normalizeCatalog(raw.catalog)
    : seedCatalog(mergeSettings(raw));
  const ops = normOps(raw?.ops);
  return withDerived({ waste, catalog, pricing: normPricing(raw?.pricing), ...(ops ? { ops } : {}) });
}
