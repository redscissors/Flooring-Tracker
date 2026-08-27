// Pure order-entry logic — the rules that decide what a line IS, split out from
// the panel that draws it (orderentry.jsx) so they can be unit-tested under
// `node --test`, which has no JSX loader. Same split as sheoga.js /
// SheogaConfigurator.jsx. Import the panel from orderentry.jsx and these from
// orderentry.js; every import in this codebase names its extension, so the twin
// filenames never resolve ambiguously.

import { fitDescription, textParts } from "./descfit.js";
import { descParts } from "./sheoga.js";
import { skuKeys } from "./orderbook.js";

// Which section a product row belongs to. Four things make a line a special
// order: it came from a price-book "order" book (bookId); it came from the
// Sheoga configurator (sheoga — the floor line and its at-cost fee lines, which
// carry the marker without a cfg); it came from the wedi configurator
// (wedi) WITHOUT a SKU; or it is a bookless row whose SKU the stock cache
// doesn't know (below). None of those is a stock SKU the shop holds.
// `stockBookIds` (a Set of stock-kind book ids) carves out the ERP stock
// books' rows — they carry a bookId for provenance/drift but their SKUs are
// the shop's own, so they file as stock lines (SKU ⇥ qty).
//
// wedi is the split case, because one configurator emits both kinds: the shop
// stocks 151 wedi items and special-orders the rest off wedi's pricelist. A
// stocked wedi line carries the shop's ERP sku and keys as stock like any
// other; a special-order one has no shop code, so it goes by description —
// which already leads with wedi's US-SKU (issue 066).
//
// `stockSkus` (every stock-cache SKU in every skuKeys spelling, null until the
// cache is up) closes the hand-entered gap (Marcus 2026-08-21): a row typed
// straight onto the sheet has no bookId, but if its SKU isn't one the shop
// stocks, pasting it as a stock SKU ⇥ qty line keys a code the ERP's stock
// side doesn't hold — it's a special order that never went through a book.
// Matching runs over skuKeys spellings both ways so a hand-typed manufacturer
// form of a stocked code ("KST965/810BF" vs the shop's re-lettered twin) still
// files as stock. Without the set (cache not ready) behavior is unchanged.
export const isSpecialOrder = (p, stockBookIds, stockSkus) =>
  (!!p.bookId && !stockBookIds?.has(p.bookId)) || !!p.sheoga || (!!p.wedi && !p.sku)
  || (!p.bookId && !!p.sku && !!stockSkus && !skuKeys(p.sku).some((k) => stockSkus.has(k)));

// What an order line with no quantity is keyed as. A zero is unusable at the
// desk twice over: the ERP won't take a zero-quantity line at all, and the
// panel's per-unit cost/sell are the extended totals ÷ qty, so a zero also
// blanks the pricing the salesperson came here to read. A quantity is the one
// field they always confirm against the order anyway, so a quantity-less line
// is priced and keyed as ONE of its sell unit — and says so (amber row), since
// a silently invented quantity is worse than a zero.
export const ORDER_MIN_QTY = 1;
export const orderQty = (qty) => (Number(qty) > 0 ? { qty: Number(qty), qtyAssumed: false } : { qty: ORDER_MIN_QTY, qtyAssumed: true });

// A dimension is one token to whoever reads the order — `2"x18"`, not
// `2" × 18"`. The spaces cost three characters of a 30-character field that the
// product text needs more, and the multiplication sign is not something every
// ERP field takes cleanly. Only collapsed between digits, so a "Hex Tile" keeps
// its space.
export const tightSize = (s) => String(s || "").trim().replace(/(\d["”']?)\s*[x×]\s*(?=\d)/gi, "$1x");

// A mosaic's landed sheet size ("12.375x12.375 sheet", stockPatch's ADR 0014
// shape) reads NOMINAL at order entry — 12x12" — the name the trade orders it
// by (Marcus 2026-08-26); the exact dims stay on the row and show on hover
// (orderEntryRow's sizeTrue). Every book's sheet rows, not a vendor special.
// Only the exact landed shape converts — anything hand-edited passes through.
const SHEET_SIZE_RE = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?) sheet$/i;
export function sheetNominal(sizeText) {
  const m = String(sizeText || "").trim().match(SHEET_SIZE_RE);
  if (!m) return "";
  const L = Math.round(Number(m[1])), W = Math.round(Number(m[2]));
  return L > 0 && W > 0 ? `${L}x${W}"` : "";
}

// A plank floor's stated size is thickness × width × length, and order entry
// doesn't weigh the three equally (owner 2026-08-27, the Hallmark NO6EMEO-19
// case): the WIDTH is how the desk reads a plank, so it stays in the
// description as long as anything fits — the thickness goes first and the
// length next when the field runs tight. Both are soft: a width-only size is
// the spec the desk needs, not a cut one, so losing them alone never wears the
// "+" marker, and the extended text still carries the full dimensions. Each
// dimension takes its own "x" with it when it goes, so what remains still
// reads as a size: `7/16"x 6" xRL-74"` → `6" xRL-74"` → `6"`. Thickness drops
// with the "Collection" tier (rank 4, ahead of the brand); length holds out
// past the brand (rank 2). Hardwood and vinyl rows only — a tile's 12"x24" is
// one identity token, and every other type is unchanged.
const DIM_WORDS = /\bRL\b|mm\b/gi; // no \b before mm — a digit-mm join ("5.5mm") has no boundary
const dimish = (t) => /\d/.test(t) && !/[a-z]/i.test(t.replace(DIM_WORDS, ""));
const inchesOf = (t) => {
  const s = String(t).trim().replace(/["”]$/, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\s*\/\s*(\d+))?$/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
  const f = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  return f ? Number(f[1]) / Number(f[2]) : null;
};
// mm is always a thickness on these sheets, and no plank is under 2" wide or
// 2" thick, so the inch boundary is unambiguous.
const isThick = (t) => {
  if (/mm$/i.test(String(t).trim())) return true;
  const v = inchesOf(t);
  return v != null && v < 2;
};
export function plankSizeParts(sizeText) {
  const s = tightSize(sizeText);
  if (!s) return [];
  const toks = s.split(/\s*[x×]\s*/i).map((t) => t.trim()).filter(Boolean);
  if (toks.length < 2 || toks.length > 3 || !toks.every(dimish)) return textParts(s);
  const [t, w, l] = toks.length === 3 ? toks : isThick(toks[0]) ? [toks[0], toks[1], ""] : ["", toks[0], toks[1]];
  return [
    ...(t ? [{ full: `${t}x`, rank: 4, soft: true }] : []),
    { full: w, rank: 0 },
    ...(l ? [{ full: `x${l}`, rank: 2, soft: true }] : []),
  ];
}
const PLANK_TYPES = new Set(["hardwood", "vinyl"]);
const sizeParts = (r) => (PLANK_TYPES.has(r.type) ? plankSizeParts(r.sizePlain) : textParts(tightSize(r.sizePlain)));

// A special line → what belongs in the ERP's description field, via the fit
// ladder. A Sheoga row abbreviates losslessly because its description is built
// from known enums (descParts); everything else is arbitrary vendor text with no
// short form, so it either fits or splits.
//
// Sheoga is the one vendor whose name stays IN the description and never drops
// (Marcus 2026-08-21) — a Sheoga order is keyed by description, no SKU, so the
// brand is part of the identity, unlike a book brand (rank 3 below). The
// structured path prepends it at rank 0; the fallback path (vents, dampers,
// fees) keeps the "Sheoga — " lead the configurator wrote into the row name.
//
// A line always flows unit · size · product/color · SKU · coverage. The SKU and
// coverage trail as PINNED parts (Marcus 2026-08-26, reversing the earlier
// drop-order): they never leave an order-entry description, however tight the
// field — the body is what abbreviates or splits around them, and the "+"
// marker sits between the cut body and the surviving tail.
//
// The buy/sell unit leads and never drops (rank 0, two characters): the ERP
// keys every line as "each", so a carton line that doesn't say CT in its own
// text is an order for 12 tiles instead of 12 cartons. It's the same tag the
// panel shows in front of the item, so what pastes is what's on screen.
//
// `r.brand` is the row's book brand label (book.data.brandLabel, the Glazzio
// ask 2026-08-18). When the name leads with it, the brand splits into its own
// part at rank 3 — first to go when the field runs tight, because unlike every
// other category it doesn't identify the product to the vendor being ordered
// from (the Sheoga VENDOR_PREFIX reasoning, softened: kept while there's room,
// dropped before anything else). It stays in place — between the size and the
// product text, exactly where the panel shows it — so the paste still matches
// the screen. A name that doesn't lead with the brand (the salesperson deleted
// it, or it never landed) passes through untouched.
//
// "Collection" inside a product name is series typography, not identity
// (Marcus 2026-08-26): every vendor's series can carry it, so it identifies
// nothing at the order desk. It splits into its own part at rank 4 — the very
// first thing dropped when the field runs tight, ahead of even the brand —
// and stays in place while there's room. Both it and the brand are SOFT
// (owner 2026-08-26): a description whose only losses are these words is not
// a partial spec, so it pastes without the "+" marker (descfit.js).
const nameParts = (text) => {
  const s = String(text || "").trim();
  if (!s) return [];
  return s.split(/\b(Collection)\b/i)
    .map((tok, i) => (i % 2 ? { full: tok, rank: 4, soft: true } : textParts(tok)))
    .flat();
};
export function orderDescription(r, limit) {
  const named = String(r.name || "").trim();
  const brand = !r.sheoga ? String(r.brand || "").trim() : "";
  const branded = brand && (named.toLowerCase() + " ").startsWith(brand.toLowerCase() + " ");
  const body = branded ? named.slice(brand.length).trim() : named;
  // Structured parts win over the row's name text: they're the same description
  // (descfit.test.js asserts the join matches across every configuration) but
  // carry the per-category short forms that make the abbreviated rung possible.
  const sheogaParts = r.sheoga && descParts(r.sheoga);
  const parts = [
    ...(r.tag ? [{ full: String(r.tag), rank: 0 }] : []),
    ...((sheogaParts && [{ full: "Sheoga", rank: 0 }, ...sheogaParts])
      || [...sizeParts(r), ...(branded ? [{ full: brand, rank: 3, soft: true }] : []), ...nameParts(body)]),
  ];
  const tail = [];
  if (r.sku) tail.push({ full: String(r.sku), pin: true });
  if (r.coverage) tail.push({ full: String(r.coverage), pin: true });
  return fitDescription([...parts, ...tail], limit);
}

// What a special line's copy button puts on the clipboard: the description
// field's contents and nothing else. Quantity, cost and sell are separate ERP
// fields and have their own columns in the panel — pasting them into a
// description is what overran the field in the first place. The unit tag is not
// one of those: the ERP has no field for it, so it lives inside the description
// (orderDescription) and copies with it.
export const orderCopyText = (r) => (r.desc ? r.desc.main : "");

// How many characters of the product/color text still let the WHOLE flow —
// size · product · SKU · coverage — land in the ERP field on the clean "full"
// rung (no "+", no extended text). The grid paints anything past this budget
// red so a salesperson can trim to a guaranteed one-field paste. Counting only
// the product text against the raw limit would lie: a 68-char name with a
// 7-char size already splits a 70-char field.
export function nameBudget(r, limit) {
  if (!(Number(limit) > 0)) return Infinity;
  const size = sizeParts(r).map((p) => p.full).join(" ");
  const others = [r.tag, size, r.sku, r.coverage].map((x) => String(x || "").trim()).filter(Boolean);
  return Math.max(0, Number(limit) - others.reduce((n, s) => n + s.length + 1, 0));
}
