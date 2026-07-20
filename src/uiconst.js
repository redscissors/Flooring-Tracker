// Stage-2 messages for actions that need the stock cache (ADR 0026): one
// string per state so the grid and mobile surfaces can't drift apart.
export const STOCK_LOADING_MSG = "Price book still loading — try again in a moment";
export const STOCK_FAILED_MSG = "Price book couldn't load — reload the page and try again";
// One place decides whether the SKU cell is a search field (vs a plain input):
// the desktop grid and the mobile row sheet must never disagree.
export const skuSearchable = (stock, searchOrder, stockReady) => stock.length > 0 || !!searchOrder || !stockReady;

export const TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
export const TLBL = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };
// The underlayment row is labelled per flooring type — a tile job wants "backer"
// language, the soft/plank goods want "underlayment".
export const UNDERLAY_LABEL = { tile: "Tile Backer" };
export const underlayLabel = (type) => UNDERLAY_LABEL[type] || "Underlayment";
// Product-type accents: the small type button, active joint toggle and the
// material check chips carry the flooring type's color (the selection rows
// themselves are paper-washed, not type-colored — see ROW_WASH below). They
// resolve to CSS tokens (src/index.css) sourced from the NED data series, so
// each flips with light/dark and a recolor is a one-line stylesheet change.
export const TYPE_ACCENT = { tile: "var(--ft-type-tile)", hardwood: "var(--ft-type-hardwood)", vinyl: "var(--ft-type-vinyl)", laminate: "var(--ft-type-laminate)", carpet: "var(--ft-type-carpet)", misc: "var(--ft-type-misc)" };

// Selection grid tone recipe (prototype 2026-07-12): rows and the materials
// box sit on the page tone (--ft-area-row) so the card interior reads as the
// surrounding surface; the band, column header and the Price/Total cells share
// one head tone (--ft-area-head — page ink in dark, where the rows lift 5%
// instead). Not the flooring-type color — the type accent is reserved for the
// small type button, joint toggles and the material check chips. Product boxes
// stack flush inside their area card with a thin --ft-grid-line divider; the
// area card's own border is that same line, so a product's left/right edge
// lines up with the card outline as one clean line.
export const ROW_WASH = "var(--ft-area-row)";
export const TOTAL_WASH = "var(--ft-area-head)";
export const JOINTS = [{ label: '1/16"', v: 0.0625 }, { label: '1/8"', v: 0.125 }, { label: '3/16"', v: 0.1875 }];
export const THICK = [{ label: '1/8"', v: "0.125" }, { label: '3/16"', v: "0.1875" }, { label: '1/4"', v: "0.25" }, { label: '5/16"', v: "0.3125" }, { label: '3/8"', v: "0.375" }, { label: '7/16"', v: "0.4375" }, { label: '1/2"', v: "0.5" }, { label: '5/8"', v: "0.625" }, { label: '3/4"', v: "0.75" }];
// Grout colors are code-defined (out of the persisted catalog — see ADR 0002),
// but keyed per grout product so each brand offers its own palette. A grout not
// listed here (e.g. a team-added one) falls back to DEFAULT_COLORS. The job's
// color picker resolves the list by the selected grout's name.
export const DEFAULT_COLORS = ["Mushroom", "Natural Gray", "Bright White", "Dusty Grey", "Desert Khaki", "Latte", "Antique White", "Marble Beige", "Light Pewter", "Parchment", "Raven", "Sterling Silver", "Mocha", "Smoke Grey", "Silver Shadow", "Sand Beige", "Sauterne", "Platinum", "Midnight Black", "Espresso", "Butter Cream", "Silk", "Slate Grey", "Almond", "Toasted Almond", "Hemp", "Hot Cocoa", "Terra Cotta", "Quarry Red", "Chestnut Brown", "Autumn Green", "Twilight Blue", "Sandstone", "Fossil", "Walnut", "Mink", "Steamship", "Iron", "Frosty", "Stormy Grey"];
export const GROUT_COLORS = {
  "Tec Power Grout": ["Antique White", "Birch", "Bright White", "Charcoal", "Coffee", "Dark Walnut", "Dove Grey", "Espresso", "Jet Black", "Light Bronze", "Light Buff", "Light Cool Gray", "Light Pewter", "Light Smoke", "Mist", "Mocha", "Optic White", "Pearl", "Praline", "Raven", "Sable", "Sandstone", "Silhouette", "Silverado", "Slate Grey", "Standard Grey", "Standard White", "Starry Night", "Sterling", "Summer Wheat", "Urban Bronze", "Warm Taupe"],
  "CEG-Lite": ["Bright White", "Snow White", "Antique White", "Alabaster", "Bone", "Linen", "Quartz", "Urban Putty", "Haystack", "Sandstone", "Mushroom", "Light Smoke", "Khaki", "Fawn", "Sahara Tan", "Summer Wheat", "Earth", "Nutmeg", "Walnut", "Chateau", "New Taupe", "Saddle Brown", "Tobacco Brown", "Sable Brown", "Truffle", "Surf Green", "Ice Blue", "Platinum", "Rolling Fog", "Bleached Wood", "Oyster Gray", "Cape Gray", "Delorean Gray", "Driftwood", "Graystone", "Natural Gray", "Winter Gray", "Pewter", "Dove Gray", "Charcoal"],
};
export const colorsFor = (groutName) => GROUT_COLORS[groutName] || DEFAULT_COLORS;

export const ATT_BUCKET = "attachments";

// The on-screen tier badge beside the grand total — a discounted screen must
// never be mistaken for retail.
export const tierBadgeText = (tier, pct) => tier === "retail" ? "" : tier === "employee" ? "Employee" : pct > 0 ? `${tier[0].toUpperCase()}${tier.slice(1)} −${pct}%` : "";
// Each tier owns a color (owner request): the selected segment, the Order
// entry / Print buttons, and every tier-adjusted price wear it, so a glance
// says which pricing the job is on. Retail keeps the default look.
export const TIER_COLOR = {
  builder: { main: "#2563eb", soft: "#dbeafe" },
  employee: { main: "#0d9488", soft: "#ccfbf1" },
  // Sale is pink on purpose — orange/red/yellow read as warnings, not discounts.
  sale: { main: "#db2777", soft: "#fce7f3" },
  custom: { main: "#7c3aed", soft: "#ede9fe" },
};

export const TIER_LONG = { builder: "Builder", employee: "Employee", sale: "Sale", custom: "Custom" };

export const AUTO_KEEP = 5;
// Unpromoted quick-price drafts self-delete this many days after their last
// edit (ADR 0022). Age is measured from updatedAt, not createdAt, so a draft
// someone is still refining is never swept out from under them.
export const QUICK_SWEEP_DAYS = 30;
// Price-book import versions kept per book (pinned rows are never pruned).
export const BOOK_VERSION_KEEP = 3;
// Reserved pricebook_versions.book_id for the shop workbook (its items live in
// stock_items, not price_book_items — ADR 0009 §5).
export const STOCK_BOOK_ID = "stock";
