// Pure order-entry logic — the rules that decide what a line IS, split out from
// the panel that draws it (orderentry.jsx) so they can be unit-tested under
// `node --test`, which has no JSX loader. Same split as sheoga.js /
// SheogaConfigurator.jsx. Import the panel from orderentry.jsx and these from
// orderentry.js; every import in this codebase names its extension, so the twin
// filenames never resolve ambiguously.

import { fitDescription, textParts } from "./descfit.js";
import { descParts } from "./sheoga.js";

// Which section a product row belongs to. Three things make a line a special
// order: it came from a price-book "order" book (bookId); it came from the
// Sheoga configurator (sheoga — the floor line and its at-cost fee lines, which
// carry the marker without a cfg); or it came from the wedi configurator
// (wedi) WITHOUT a SKU. None of those is a stock SKU the shop holds.
// `stockBookIds` (a Set of stock-kind book ids) carves out the ERP stock
// books' rows — they carry a bookId for provenance/drift but their SKUs are
// the shop's own, so they file as stock lines (SKU ⇥ qty).
//
// wedi is the split case, because one configurator emits both kinds: the shop
// stocks 151 wedi items and special-orders the rest off wedi's pricelist. A
// stocked wedi line carries the shop's ERP sku and keys as stock like any
// other; a special-order one has no shop code, so it goes by description —
// which already leads with wedi's US-SKU (issue 066).
export const isSpecialOrder = (p, stockBookIds) => (!!p.bookId && !stockBookIds?.has(p.bookId)) || !!p.sheoga || (!!p.wedi && !p.sku);

// What an order line with no quantity is keyed as. A zero is unusable at the
// desk twice over: the ERP won't take a zero-quantity line at all, and the
// panel's per-unit cost/sell are the extended totals ÷ qty, so a zero also
// blanks the pricing the salesperson came here to read. A quantity is the one
// field they always confirm against the order anyway, so a quantity-less line
// is priced and keyed as ONE of its sell unit — and says so (amber row), since
// a silently invented quantity is worse than a zero.
export const ORDER_MIN_QTY = 1;
export const orderQty = (qty) => (Number(qty) > 0 ? { qty: Number(qty), qtyAssumed: false } : { qty: ORDER_MIN_QTY, qtyAssumed: true });

// The vendor prefix the configurator writes into the row name. It's worth ~9 of
// a 30-character field and the PO already says who it's going to, so it stays on
// screen but out of the fitted description.
const VENDOR_PREFIX = /^Sheoga\s*—\s*/;

// A special line → what belongs in the ERP's description field, via the fit
// ladder. A Sheoga row abbreviates losslessly because its description is built
// from known enums (descParts); everything else is arbitrary vendor text with no
// short form, so it either fits or splits.
//
// A line always flows size · product/color · SKU · coverage. The SKU and
// coverage trail because neither is part of the description proper — they're
// handy in the same paste when there's room, and when the field is tight the
// least identifying goes first: coverage (rank 2), then the SKU (rank 1). Both
// always survive into the extended text.
export function orderDescription(r, limit) {
  const body = String(r.name || "").replace(VENDOR_PREFIX, "").trim();
  const spec = [r.sizePlain, body].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  // Structured parts win over the row's name text: they're the same description
  // (descfit.test.js asserts the join matches across every configuration) but
  // carry the per-category short forms that make the abbreviated rung possible.
  const parts = (r.sheoga && descParts(r.sheoga)) || textParts(spec);
  const tail = [];
  if (r.sku) tail.push({ full: String(r.sku), rank: 1 });
  if (r.coverage) tail.push({ full: String(r.coverage), rank: 2 });
  return fitDescription([...parts, ...tail], limit);
}

// What a special line's copy button puts on the clipboard: the description
// field's contents and nothing else. Quantity, cost and sell are separate ERP
// fields and have their own columns in the panel — pasting them into a
// description is what overran the field in the first place.
export const orderCopyText = (r) => (r.desc ? r.desc.main : "");

// How many characters of the product/color text still let the WHOLE flow —
// size · product · SKU · coverage — land in the ERP field on the clean "full"
// rung (no "+", no extended text). The grid paints anything past this budget
// red so a salesperson can trim to a guaranteed one-field paste. Counting only
// the product text against the raw limit would lie: a 68-char name with a
// 7-char size already splits a 70-char field.
export function nameBudget(r, limit) {
  if (!(Number(limit) > 0)) return Infinity;
  const others = [r.sizePlain, r.sku, r.coverage].map((x) => String(x || "").trim()).filter(Boolean);
  return Math.max(0, Number(limit) - others.reduce((n, s) => n + s.length + 1, 0));
}
