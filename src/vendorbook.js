// Vendor-kind registry books (spec 2026-09-05): a price_books row with no
// items and no import, for a vendor a configurator prices by description
// (Sheoga). It exists so the vendor has the same contacts, markup, freight
// and brand slots an order book has. `data.engine` names the configurator;
// one vendor book per engine.

import { normPricing } from "./pricing.js";
import { DEFAULT_MARKUP, DEFAULT_VENT_MARKUP } from "./sheoga.js";

export const VENDOR_ENGINES = { sheoga: { name: "Sheoga Hardwood", brandLabel: "Sheoga Hardwood" } };

export const vendorBookFor = (books, engine) =>
  (books || []).find((b) => b.kind === "vendor" && b.data?.engine === engine) || null;

// The vendor book a product row belongs to when it carries no bookId of its own.
export const vendorBookForRow = (p, books) => (p?.sheoga ? vendorBookFor(books, "sheoga") : null);

const pct = (v, dflt) => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) || n < 0 ? dflt : n; };

// Seeded from the Settings values at creation so nothing reprices on day one.
export const vendorBookSeed = (engine, settings) => {
  const e = VENDOR_ENGINES[engine];
  if (!e) return null;
  const pr = normPricing(settings?.pricing);
  return {
    name: e.name,
    data: { engine, brandLabel: e.brandLabel, markups: { flooring: pr.sheogaMarkupPct, vents: pr.sheogaVentMarkupPct } },
  };
};

// The configurator's default markups: the Sheoga vendor book's when one
// exists, else Settings (the pre-book home, still the fallback).
export const sheogaMarkups = (books, settings) => {
  const pr = normPricing(settings?.pricing);
  const book = vendorBookFor(books, "sheoga");
  if (!book) return { markupPct: pr.sheogaMarkupPct, ventMarkupPct: pr.sheogaVentMarkupPct, book: null };
  const m = book.data?.markups || {};
  return { markupPct: pct(m.flooring, DEFAULT_MARKUP), ventMarkupPct: pct(m.vents, DEFAULT_VENT_MARKUP), book };
};

export const normVendorMarkups = (raw) => ({ flooring: pct(raw?.flooring, DEFAULT_MARKUP), vents: pct(raw?.vents, DEFAULT_VENT_MARKUP) });
