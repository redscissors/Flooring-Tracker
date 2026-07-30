// Price tiers (spec 2026-07-16): Retail is the stored truth — product rows keep
// their snapshotted retail priceSqft, and a tier is a DISPLAY LENS applied at
// render time. tierView maps the raw { project, settings } pair to a
// tier-priced pair the existing math (printProduct, the totals loop,
// attachedList…) consumes unchanged; nothing here writes back to saved data.
//
// Builder / Sale / Custom discount every priced line — flooring, misc, and the
// material maps (grout + base, mortar, underlayment + install, add-ons) plus
// the row-snapshotted caulk price. Employee is cost × 1.06 on rows that carry a
// snapshotted vendor cost (ADR 0011) and leaves everything else at retail —
// employeeNoCost flags those lines so the screen can say why.
//
// One exception, and only on Builder: a row that carries its own `tierPrice`
// uses THAT instead of the flat builderPct. It's a snapshot (ADR 0003) — a
// price the vendor's own contractor program set at pick time, not a percentage
// the shop applies — so a live rate change must not overwrite it. The slot was
// reserved for exactly this (docs/pricebook/design.md Q5: "a book's real tier
// always outranks the flat fallback"); the wedi configurator is the first to
// stamp it, at the owner's retail × 0.82 (issue 066,
// .scratch/066_wedi-configurator/ticket.md "Pricing rules"). Sale and Custom
// stay flat off retail — they're the shop's own discounts, not the vendor's —
// and Employee stays cost × 1.06.

import { num, normPricing } from "./catalog.js";

export { normPricing };

export const TIER_IDS = ["retail", "builder", "employee", "sale", "custom"];
export const PRINT_PRICING_IDS = ["full", "unit", "none"];
export const EMPLOYEE_MARKUP = 1.06;

export const normTier = (v) => (TIER_IDS.includes(v) ? v : "retail");
export const normPrintPricing = (v) => (PRINT_PRICING_IDS.includes(v) ? v : "full");

const round2 = (n) => Math.round(n * 100) / 100;
const clampPct = (v, dflt = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : dflt;
};

// The discount percent the project's tier applies (0 for retail/employee).
export function tierPct(proj, settings) {
  const tier = normTier(proj?.priceTier);
  const pricing = normPricing(settings?.pricing);
  if (tier === "builder") return pricing.builderPct;
  if (tier === "sale") return pricing.salePct;
  if (tier === "custom") return clampPct(proj?.customPct, 0);
  return 0;
}

// A row whose own Builder price outranks the flat percent. Guarded on the retail
// price the same way every other tier is: an unpriced row is invisible in the
// totals, so no lens may invent a price for it.
const hasTierPrice = (p) => num(p?.tierPrice) > 0 && num(p?.priceSqft) > 0;

// The tier unit price for one product row (per-sf, or per-piece on count/misc
// lines — whatever frame priceSqft is in), or null when the tier leaves the row
// unchanged. Employee only reprices rows that are priced AND carry a cost: an
// unpriced row is invisible in the totals, so the lens must not invent a price.
export function tierUnitPrice(p, tier, pct) {
  if (tier === "employee") {
    const cost = num(p?.costSqft);
    return cost > 0 && num(p?.priceSqft) > 0 ? round2(cost * EMPLOYEE_MARKUP) : null;
  }
  if (tier === "builder" && hasTierPrice(p)) return round2(num(p.tierPrice));
  if ((tier === "builder" || tier === "sale" || tier === "custom") && pct > 0) {
    const retail = num(p?.priceSqft);
    return retail > 0 ? round2(retail * (1 - pct / 100)) : null;
  }
  return null;
}

// A priced row the Employee tier can't reprice (stays retail, gets flagged).
export const employeeNoCost = (p) => num(p?.priceSqft) > 0 && !(num(p?.costSqft) > 0);

const mapVals = (obj, fn) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, fn(v)]));
const scaleN = (v, f) => (num(v) > 0 ? round2(num(v) * f) : v);
const mapProducts = (proj, fn) => ({
  ...proj,
  categories: (proj.categories || []).map((a) => ({ ...a, products: (a.products || []).map(fn) })),
});

const anyTierPrice = (proj) => (proj.categories || []).some((a) => (a.products || []).some(hasTierPrice));

// The tier-priced { proj, settings } pair. Identity (same references) for
// retail and for a 0% discount, so the common path costs nothing. A Builder
// project at 0% is the one 0% that can still reprice — its rows may carry their
// own tierPrice — so it pays for a scan before taking the fast path. Retail
// never gets that far.
export function tierView(proj, settings) {
  const tier = normTier(proj?.priceTier);
  const pct = tierPct(proj, settings);
  if (!proj || tier === "retail") return { proj, settings, tier, pct };
  if (tier !== "employee" && !(pct > 0) && !(tier === "builder" && anyTierPrice(proj))) return { proj, settings, tier, pct };
  if (tier === "employee") {
    const mapped = mapProducts(proj, (p) => {
      const up = tierUnitPrice(p, "employee", 0);
      return up == null ? p : { ...p, priceSqft: String(up) };
    });
    return { proj: mapped, settings, tier, pct };
  }
  const f = 1 - pct / 100;
  // Rows go through tierUnitPrice so the grid's per-row price and the mapped
  // project can't disagree about a tierPrice snapshot. The caulk snapshot and
  // the material maps are shop prices, not the vendor's line, so they take the
  // flat percent — and at 0% (the tierPrice-only pass) they aren't touched at
  // all, rather than restringified to the same number.
  const mapped = mapProducts(proj, (p) => {
    const caulk = pct > 0 && num(p.grout?.caulkPrice) > 0;
    if (!(num(p.priceSqft) > 0) && !caulk) return p;
    const up = tierUnitPrice(p, tier, pct);
    return {
      ...p,
      ...(up != null ? { priceSqft: String(up) } : {}),
      ...(caulk ? { grout: { ...p.grout, caulkPrice: String(round2(num(p.grout.caulkPrice) * f)) } } : {}),
    };
  });
  const s = pct > 0 ? {
    ...settings,
    grouts: mapVals(settings.grouts, (g) => ({ ...g, price: scaleN(g.price, f), ...(g.base ? { base: { ...g.base, price: scaleN(g.base.price, f) } } : {}) })),
    mortars: mapVals(settings.mortars, (m) => ({ ...m, price: scaleN(m.price, f) })),
    underlayments: mapVals(settings.underlayments, (u) => ({ ...u, price: scaleN(u.price, f), install: (u.install || []).map((d) => ({ ...d, price: scaleN(d.price, f) })) })),
    attached: mapVals(settings.attached, (m) => mapVals(m, (a) => ({ ...a, price: scaleN(a.price, f) }))),
  } : settings;
  return { proj: mapped, settings: s, tier, pct };
}

// The printed sheet's tier label — two prints with different numbers must say
// why. Retail (and a 0% custom, which prints retail numbers) stays untagged.
export function tierTag(tier, pct) {
  if (tier === "builder") return `Builder pricing — ${pct}% off retail`;
  if (tier === "sale") return `Sale pricing — ${pct}% off retail`;
  if (tier === "custom") return pct > 0 ? `Custom pricing — ${pct}% off retail` : "";
  if (tier === "employee") return "Employee pricing";
  return "";
}
