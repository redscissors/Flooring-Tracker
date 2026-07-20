// Pure order-entry logic — the rules that decide what a line IS, split out from
// the panel that draws it (orderentry.jsx) so they can be unit-tested under
// `node --test`, which has no JSX loader. Same split as sheoga.js /
// SheogaConfigurator.jsx. Import the panel from orderentry.jsx and these from
// orderentry.js; every import in this codebase names its extension, so the twin
// filenames never resolve ambiguously.

// Which section a product row belongs to. Two things make a line a special
// order: it came from a price-book "order" book (bookId), or it came from the
// Sheoga configurator (sheoga — the floor line and its at-cost fee lines, which
// carry the marker without a cfg). Neither is a stock SKU the shop holds.
export const isSpecialOrder = (p) => !!p.bookId || !!p.sheoga;

// The text a special line copies. Same reading order as the row itself: unit
// tag, size, name, SKU, then coverage. A by-description line (Sheoga, no SKU)
// slots the ordered qty in where the SKU would be — with nothing for the desk
// to key, the copied text has to carry the whole order.
export const orderCopyText = (r) =>
  [r.tag, r.sizePlain, r.name, r.sku, r.byDesc && r.qty > 0 ? r.qtyText : "", r.coverage]
    .map((x) => String(x || "").trim()).filter(Boolean).join(" ");
