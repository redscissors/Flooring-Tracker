// Vendor-kind registry books (spec 2026-09-05): a price_books row with no
// items and no import, for a vendor a configurator prices by description
// (Sheoga). It exists so the vendor has the same contacts, markup, freight
// and brand slots an order book has. `data.engine` names the configurator;
// one vendor book per engine.

import { normPricing } from "./pricing.js";
import { DEFAULT_MARKUP, DEFAULT_VENT_MARKUP } from "./sheoga.js";
import { DEFAULT_TRIM_MARKUP, TRIM_PROFILES } from "./sheogatrim.js";

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
    data: { engine, brandLabel: e.brandLabel, markups: { flooring: pr.sheogaMarkupPct, vents: pr.sheogaVentMarkupPct, trim: DEFAULT_TRIM_MARKUP } },
  };
};

// The configurator's default markups: the Sheoga vendor book's when one
// exists, else Settings (the pre-book home, still the fallback).
export const sheogaMarkups = (books, settings) => {
  const pr = normPricing(settings?.pricing);
  const book = vendorBookFor(books, "sheoga");
  if (!book) return { markupPct: pr.sheogaMarkupPct, ventMarkupPct: pr.sheogaVentMarkupPct, trimMarkupPct: DEFAULT_TRIM_MARKUP, book: null };
  const m = book.data?.markups || {};
  return { markupPct: pct(m.flooring, DEFAULT_MARKUP), ventMarkupPct: pct(m.vents, DEFAULT_VENT_MARKUP), trimMarkupPct: pct(m.trim, DEFAULT_TRIM_MARKUP), book };
};

export const normVendorMarkups = (raw) => ({
  flooring: pct(raw?.flooring, DEFAULT_MARKUP),
  vents: pct(raw?.vents, DEFAULT_VENT_MARKUP),
  trim: pct(raw?.trim, DEFAULT_TRIM_MARKUP),
});

// 0 is a real price: Sheoga may texture a profile at no charge.
export const normTrimTexture = (raw) => {
  const out = {};
  for (const { id } of TRIM_PROFILES) {
    const v = raw?.[id];
    const n = Number(v);
    out[id] = v === "" || v == null || !Number.isFinite(n) || n < 0 ? null : n;
  }
  return out;
};

export const trimBookOf = (books) => {
  const data = vendorBookFor(books, "sheoga")?.data;
  const sheet = data?.sheets?.accessories;
  return sheet ? { sheet, tex: normTrimTexture(data.trimTexture) } : null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isoParts = (iso) => /^\d{2}(\d{2})-(\d{2})-(\d{2})$/.exec(typeof iso === "string" ? iso : "");
export const sheetMonth = (iso) => { const m = isoParts(iso); return m ? `${MONTHS[m[2] - 1]} ’${m[1]}` : ""; };
export const sheetDateMDY = (iso) => { const m = isoParts(iso); return m ? `${+m[2]}/${+m[3]}/${m[1]}` : ""; };
