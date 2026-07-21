// Pure order-entry logic — the rules that decide what a line IS, split out from
// the panel that draws it (orderentry.jsx) so they can be unit-tested under
// `node --test`, which has no JSX loader. Same split as sheoga.js /
// SheogaConfigurator.jsx. Import the panel from orderentry.jsx and these from
// orderentry.js; every import in this codebase names its extension, so the twin
// filenames never resolve ambiguously.

import { fitDescription, textParts } from "./descfit.js";
import { descParts } from "./sheoga.js";

// Which section a product row belongs to. Two things make a line a special
// order: it came from a price-book "order" book (bookId), or it came from the
// Sheoga configurator (sheoga — the floor line and its at-cost fee lines, which
// carry the marker without a cfg). Neither is a stock SKU the shop holds.
export const isSpecialOrder = (p) => !!p.bookId || !!p.sheoga;

// The vendor prefix the configurator writes into the row name. It's worth ~9 of
// a 30-character field and the PO already says who it's going to, so it stays on
// screen but out of the fitted description.
const VENDOR_PREFIX = /^Sheoga\s*—\s*/;

// A special line → what belongs in the ERP's description field, via the fit
// ladder. A Sheoga row abbreviates losslessly because its description is built
// from known enums (descParts); everything else is arbitrary vendor text with no
// short form, so it either fits or splits.
//
// The SKU trails when the row has one, at rank 1 — handy in the same paste when
// there's room, first to go when there isn't, because a SKU is an item code
// rather than part of the description. Trailing keeps every paste reading
// description-first whether or not the SKU made the cut.
export function orderDescription(r, limit) {
  const body = String(r.name || "").replace(VENDOR_PREFIX, "").trim();
  const spec = [r.sizePlain, body].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  // Structured parts win over the row's name text: they're the same description
  // (descfit.test.js asserts the join matches across every configuration) but
  // carry the per-category short forms that make the abbreviated rung possible.
  const parts = (r.sheoga && descParts(r.sheoga)) || textParts(spec);
  return fitDescription(r.sku ? [...parts, { full: String(r.sku), rank: 1 }] : parts, limit);
}

// What a special line's copy button puts on the clipboard: the description
// field's contents and nothing else. Quantity, cost and sell are separate ERP
// fields and have their own columns in the panel — pasting them into a
// description is what overran the field in the first place.
export const orderCopyText = (r) => (r.desc ? r.desc.main : "");
