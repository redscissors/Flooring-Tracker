// Price book library — special-order ("order") book helpers (ADR 0009).
//
// Order books are vendor price lists that carry a dealer COST, not a selling
// price. The selling price is cost × (1 + markup), where the markup lives on
// the book (a default plus optional per-group overrides) — never on the item.
// Sell is computed at display and pick time, never stored on the item, so a
// markup edit changes future picks only and never rewrites a saved estimate
// (the ADR 0003 snapshot doctrine extended to markups).
//
// An order item is shaped like a stock item (so search and the pick-snapshot
// reuse stock.js untouched) plus the fields a vendor sheet proved necessary:
// cost, mfg/productLine (markup group axes), leadTime, msrp, freightFlag, and
// tierPrices (book-defined contractor pricing). Picking one produces the same
// patch stockPatch builds, then adds bookId/cost/markupPct and the flags.

import { stockPatch, stockPriceSqft, priceUnitOf, orderUnitOf, perCartonFactor, fillsFlooring, isPieceUnit, isCartonUnit, parseTileSize, hitRank, unitPrice, unitCost, feetArea } from "./stock.js";

const str = (v) => (v == null ? "" : String(v).trim());
const numOr = (v, d = null) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") { const n = parseFloat(v.replace(/[$,]/g, "")); if (Number.isFinite(n)) return n; }
  return d;
};
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const round4 = (n) => (n == null ? null : Math.round(n * 10000) / 10000);

// ERP stock-keeping words that mean nothing on a selection ("NOMINAL" size
// qualifiers, "NEW PACKAGE"/"*NEW PKG*" repack notes, "*2022 PROD" run stamps,
// "++" markers, "RECT"/"RECTIFIED" edge stamps — owner ask 2026-08-10, the
// COEREBE1836R report: the selection names the product, not the edge
// treatment) — dropped from the description here, the one point both the
// import parse and the DB-row load pass through, so already-imported items
// clean up on load without a re-import.
// Parenthesized form first, so "(Nominal)" goes whole — a generic empty-paren
// sweep would also hide the residue the name-litter advisory exists to flag.
// The starred forms take their asterisks with them (VTC glues them on:
// "POL*NEW PKG*"), same reasoning — a stray "*" would read as litter.
const DESC_NOISE = "nominal|new\\s+packag(?:e|ing)s?|new\\s+pkgs?|(?:19|20)\\d{2}\\s+prod(?:uction)?|rect(?:ified)?";
const DESC_NOISE_RE = new RegExp(`\\(\\s*(?:${DESC_NOISE})\\s*\\)|\\*+\\s*(?:${DESC_NOISE})\\s*\\**|\\b(?:${DESC_NOISE})\\b\\s*\\**|\\+{2,}`, "gi");
// A parenthesized letters-and-digits token is the manufacturer's own color/run
// code riding a VTC description ("REVERSO BEIGE MATTE 18X36 RECT (RV492R)",
// same report) — internal bookkeeping, never part of the name. Only a mixed
// token goes: a size-shaped "(12X24)" is the split's to claim, a word
// "(Interior)" is identity, and a bare number stays because an old ERP row's
// trailing code is the trims fallback key (trims.js vendorCodeCandidates).
const PAREN_CODE_RE = /\(\s*([A-Za-z0-9][A-Za-z0-9./-]{1,15})\s*\)/g;
const dropParenCodes = (s) => s.replace(PAREN_CODE_RE, (m, tok) =>
  (/\d/.test(tok) && /[a-z]/i.test(tok) && !/^\d+(?:\.\d+)?[x×]\d+(?:\.\d+)?$/i.test(tok) ? " " : m));
// A name that says its series twice around the word "Collection" ("Rythmique
// Collection Rythmique Fandango" — the Glazzio RYM5532 report, 2026-08-18):
// the section heading fronted the name AND the color name led with the series,
// and the heading's "Collection" kept the lead dedupe from seeing the repeat.
// Collapsed here so already-imported rows clean up on load without a re-import.
// Only the exact doubled shape matches — "Alta Vista Collection Balboa" and
// "Heritage 2022 Collection" keep their names.
const SERIES_DOUBLE_RE = /\b([a-z'’-]+(?:\s+[a-z'’-]+){0,2})\s+collection\s+\1\b/gi;
// SHOUTING vendor text → Title Case, already-cased text left alone (pricebook's
// smartCase, applied here too because the import only cases descriptions the
// size-split touched — accessory rows with nothing to extract kept the vendor's
// ALL CAPS, the LATDSGRACS10OZ / SLRJ100TSSG report).
const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const smartCase = (s) => (s && !/[a-z]/.test(s) ? titleCase(s) : s);
const cleanDescription = (v) => smartCase(dropParenCodes(str(v)).replace(DESC_NOISE_RE, " ").replace(SERIES_DOUBLE_RE, "$1").replace(/\s{2,}/g, " ").trim());

// The Claude issue-bucket mark ({ by, at, note? }) — a SKU parked for a later
// Claude session to dig into. Presence is the whole state; junk shapes drop.
const normClaudeIssue = (v) => {
  if (!v || typeof v !== "object") return null;
  const out = { by: str(v.by), at: v.at ?? null };
  const note = str(v.note);
  if (note) out.note = note;
  return out;
};

// Per-flag-code review verdicts ({ [code]: { state, by, at } }) — only the two
// known states survive normalization, so junk in the jsonb can't invent one.
const normFlagReview = (v) => {
  if (!v || typeof v !== "object") return null;
  const out = {};
  for (const code of Object.keys(v)) {
    const e = v[code];
    const state = e && (e.state === "confirmed" || e.state === "ignored") ? e.state : null;
    if (state) out[code] = { state, by: str(e.by), at: e.at ?? null };
  }
  return Object.keys(out).length ? out : null;
};

// Parent floor SKUs for a trim. Accepts either the array the DB round-trips or
// the space-separated string a parser's "Fits" column emits. Sorted and deduped
// so a re-import of the same sheet never shows a spurious diff.
const normFits = (v) => {
  const list = Array.isArray(v) ? v : str(v).split(/\s+/);
  const out = [...new Set(list.map(str).filter(Boolean))].sort();
  return out.length ? out : [];
};

// --- the canonical order-item shape ------------------------------------------

// One place both the mapped parser (pricebook.js parseMapped) and the DB-row
// loader (normBookItem) build the in-memory item, so the two can never drift.
// Column-backed fields (sku/active/updatedAt/bookId) get legacy-safe defaults
// here too; bookItemData strips them back out before a write.
export function normOrderItem(f = {}) {
  return {
    sku: str(f.sku),
    bookId: str(f.bookId),
    active: f.active !== false,
    disabled: !!f.disabled,
    updatedAt: f.updatedAt ?? null,
    sheet: str(f.sheet),
    section: str(f.section),
    brand: str(f.brand),
    description: cleanDescription(f.description),
    product: str(f.product),
    color: str(f.color),
    style: str(f.style),
    subtype: str(f.subtype),
    unit: str(f.unit),
    // Two units, both falling back to `unit` (ADR 0009 amendment): priceUnit =
    // the cost basis (VTC "Price U/M"), orderUnit = the smallest sellable unit
    // (VTC "No Broken U/M") that drives carton/loose ordering.
    priceUnit: str(f.priceUnit),
    orderUnit: str(f.orderUnit),
    size: str(f.size),
    // The mosaic backing-sheet dimension ("9x11"), set only when the description
    // gave no chip size. Its presence tells the pick to show the size as a
    // labeled sheet and leave the tile L×W blank for a hand-entered chip size
    // (grout/mortar), while coverage was derived from it at import (ADR 0014).
    sheetSize: str(f.sheetSize),
    thickness: str(f.thickness),
    type: f.type || null,
    // A trim/molding line (Mannington's "Kind" column, ADR 0012). Type-blank like
    // any accessory, but flagged so the book can mark trims up at their own rate
    // (resolveMarkup), separate from the floors.
    trim: !!f.trim,
    // Which classifyTrim signal reclassified this row at import (ADR 0013
    // amendment) — "lexicon" / "inversion" / "notional", empty for a
    // vendor-declared trim (Mannington's Kind column) or a non-trim. Provenance
    // for the wizard's review list and the book table's flag chips.
    trimSignal: str(f.trimSignal),
    // The floor SKUs this trim belongs to (ADR 0012 amendment). The vendor sheets
    // state this outright — Hallmark and Tarkett per color, Mannington per row —
    // so it is a real relation, not a guess. Kept structured (and uncapped; it
    // used to be truncated to six parents inside the description) so a floor can
    // enumerate its own trims, which prose in `description` could never support.
    // The description still carries a "· fits …" note for search_text.
    fits: normFits(f.fits),
    // The manufacturer's own code(s) for this item, when the sheet states them
    // as columns (the ERP stock exports' Supplier Prod Code / Mfg Product
    // Code, 2026-07-23). The shop's internal SKU never appears in a vendor
    // book, so these are the exact bridge between the stock and special-order
    // spaces — a stock floor's trims lookup and the trim twin swap key on
    // them. Same normalized shape as fits (deduped, sorted).
    vendorSkus: normFits(f.vendorSkus),
    // Order items store COST — price/priceSqft derive at display via the
    // book's markup (pricedItem) and are never persisted for them. Stock-kind
    // items (the shop's own ERP exports) are the exception: they carry the
    // shop's real retail beside the cost, and that explicit price is persisted
    // and outranks any markup derivation (pricedItem passes it through).
    price: round2(numOr(f.price)),
    priceSqft: numOr(f.priceSqft),
    sfPerUnit: numOr(f.sfPerUnit),
    pcPerUnit: numOr(f.pcPerUnit),
    coverage: numOr(f.coverage),
    discontinued: !!f.discontinued,
    note: str(f.note),
    // order-book extras
    cost: round2(numOr(f.cost)),
    mfg: str(f.mfg),
    productLine: str(f.productLine),
    leadTime: str(f.leadTime),
    msrp: round2(numOr(f.msrp)),
    freightFlag: !!f.freightFlag,
    // { contractor: number, ... } book-defined selling tiers, or null
    tierPrices: f.tierPrices && typeof f.tierPrices === "object" ? { ...f.tierPrices } : null,
    // Stamped when a user hand-edits the item in Settings (Phase 4b). A
    // re-import overwrites the item and drops these — the wizard warns first.
    editedBy: str(f.editedBy),
    editedAt: f.editedAt ?? null,
    // Flag-review verdicts, keyed by hazard/advisory code. "confirmed" = a human
    // verified/corrected the row, "ignored" = the flag is noise here. Either one
    // silences that code's chip and its import warnings — a NEW code still
    // flags. Carried across re-imports by applyBookImport (like the disabled
    // column), so a reviewed row never re-nags for the same problem.
    flagReview: normFlagReview(f.flagReview),
    // The Claude issue bucket: this SKU is parked for a Claude session to dig
    // into (the book table's Claude button). Bookkeeping like flagReview — no
    // edited stamp, no diff churn, carried across re-imports by applyBookImport.
    claudeIssue: normClaudeIssue(f.claudeIssue),
  };
}

// The review verdict on one flag code, or null.
export const flagReviewed = (item, code) => item?.flagReview?.[code]?.state || null;

// The trims that name this floor as a parent — the reverse of item.fits, and the
// direction the picker actually needs ("show me this floor's moldings"). Exact
// SKU containment, so unlike the fuzzy description search it can't drift onto a
// neighbouring floor's trims. Hidden and retired rows stay out.
export const trimsForFloor = (items, floorSku) => {
  const sku = str(floorSku);
  if (!sku) return [];
  return (items || []).filter((it) => it.trim && it.active !== false && !it.disabled && (it.fits || []).includes(sku));
};

// sku → flagReview for the rows that carry one. The wizard builds this from the
// book's existing items and hands it to parseMapped, so a reviewed problem
// doesn't re-warn on the next import of the same file.
export function flagReviewBySku(items) {
  const m = new Map();
  for (const it of items || []) if (it.flagReview) m.set(it.sku, it.flagReview);
  return m;
}

// A price_book_items DB row → memory. bookId comes from the book_id column.
export function normBookItem(row, bookId = "") {
  const it = normOrderItem({ sku: row.sku, bookId: bookId || row.book_id, ...(row.data || {}) });
  it.active = row.active !== false;
  it.disabled = row.disabled === true;
  it.updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
  return it;
}

// The jsonb payload written back on import — everything except the
// column-backed fields (book_id, sku, active, disabled, updated_at).
export const bookItemData = ({ sku, bookId, active, updatedAt, disabled, ...data }) => data;

// --- cost, markup, sell ------------------------------------------------------

// Per-sq-ft cost, mirroring stockPriceSqft: the cost as-is when the item is
// priced by the square foot, else derived from a carton/sheet cost and its
// SF/CT coverage — scaled by PC/CT first when the cost is per piece
// (perCartonFactor). Count/flat items (EA, PC with no coverage) have none.
export function costSqft(item) {
  if (!item || item.cost == null) return null;
  if (/^(sf|sft|sqft)$/i.test(priceUnitOf(item))) return item.cost;
  if (item.sfPerUnit > 0) return round4((item.cost * perCartonFactor(item)) / item.sfPerUnit);
  return null;
}

// The markup percent for an item under a book's markups config. A trim line
// (Mannington, ADR 0012) uses the book's trim markup when one is set — it is the
// most specific rule, so it outranks any per-group override. Otherwise a
// per-group override (byGroup keyed on the mapping-chosen groupBy field) outranks
// the book default; an unmapped/absent group quietly uses the default.
export function resolveMarkup(markups, item) {
  const m = markups || {};
  const def = numOr(m.default, 0);
  if (item?.trim && m.trim != null) {
    const t = numOr(m.trim);
    if (t != null) return t;
  }
  const key = m.groupBy ? str(item?.[m.groupBy]) : "";
  if (key && m.byGroup && m.byGroup[key] != null) {
    const g = numOr(m.byGroup[key]);
    if (g != null) return g;
  }
  return def;
}

// cost × (1 + pct/100), rounded like every other price.
export const sellPrice = (cost, pct) => (cost == null ? null : round2(cost * (1 + (pct || 0) / 100)));

// The per-sell-unit cost to snapshot onto a picked product row, parallel to the
// row's priceSqft: the per-sqft cost for a typed (flooring) line, else the
// per-each cost for a misc/flat line. Anchoring the row to this — instead of
// re-deriving cost from the sale price via the markup — is what keeps a
// hand-edited sale price moving the MARGIN, not the cost.
export const rowCostSqft = (item) => {
  if (!item || item.cost == null) return null;
  const csf = item.type ? costSqft(item) : null;
  // Count lines cost per SELL UNIT, matching the per-piece sell the patch
  // snapshots (ADR 0013 amendment) — carton rounding lives on the row's
  // cartonPc, never in the price. unitCost converts an SF-priced roll's cost
  // to the whole-roll figure, mirroring the sell side.
  return csf != null ? csf : unitCost(item);
};

// A stock-shaped item with price/priceSqft filled from cost × markup, so
// search results and the pick-snapshot can treat it exactly like a stock item.
// Also carries the resolved markupPct for display and the pick snapshot. A
// stock-kind registry item passes through with its own price — whether it has
// no cost at all, or (the ERP stock exports) an explicit retail beside the
// cost, which is the shop's real shelf price, not something to re-derive.
export function pricedItem(item, markups) {
  const pct = resolveMarkup(markups, item);
  if (!item || item.cost == null || item.price != null) return { ...item, markupPct: pct };
  const csf = costSqft(item);
  return {
    ...item,
    markupPct: pct,
    price: sellPrice(item.cost, pct),
    priceSqft: csf != null ? round4(csf * (1 + pct / 100)) : null,
  };
}

// --- pick snapshot -----------------------------------------------------------

// A book-level brand label (book.data.brandLabel — the Glazzio ask, 2026-08-18)
// standing in for the brand column the vendor's sheet never had. Filled only
// when the item carries no brand of its own, so a mapped brand column still
// wins; stockPatch's label() then leads the landed name with it unless the
// description already says it. Applied at pick/preview time, never written to
// the items — clearing the box stops future picks without a re-import, and
// saved rows keep their text (ADR 0003 snapshot doctrine).
export const withBookBrand = (item, brandLabel) => {
  const b = str(brandLabel);
  return b && item && !str(item.brand) ? { ...item, brand: b } : item;
};

// The snapshot patch a picked order-book item applies to a product row: the
// same fields stockPatch fills (type, $/sqft, carton, brand/size), plus the
// order-book provenance the drift chip and (later) contractor pricing need.
// bookId/cost/markupPct/tierPrice are stored as strings, matching how the row
// keeps its other numeric fields.
export function orderPatch(item, book, product) {
  const priced = pricedItem(withBookBrand(item, book?.data?.brandLabel), book?.data?.markups);
  const patch = stockPatch(priced, product);
  patch.bookId = str(item.bookId || book?.id);
  patch.cost = item.cost != null ? String(item.cost) : "";
  // Honest vendor cost per sell unit, carried alongside priceSqft so the margin
  // reads off the real cost even after the sale price is hand-edited (ADR 0011).
  const csf = rowCostSqft(item);
  patch.costSqft = csf != null ? String(round2(csf)) : "";
  patch.markupPct = priced.markupPct != null ? String(priced.markupPct) : "";
  patch.freightFlag = !!item.freightFlag;
  const tier = item.tierPrices?.contractor;
  patch.tierPrice = tier != null ? String(tier) : "";
  return patch;
}

// --- project-line preview (book table) ---------------------------------------

// What picking this item lands on a product row, shaped for the book table's
// project-line columns. Derived through the REAL pick path (pricedItem →
// stockPatch), never re-implemented, so the table can't drift from an actual
// pick — a blank cell here IS a blank cell on the estimate, which is the whole
// troubleshooting value. `sizeParsed` distinguishes a tile size that landed in
// L×W (grout/mortar compute) from one that fell through as free text.
// `brandLabel` is the book's brand box (withBookBrand) — the preview has to
// wear it for the same reason: a pick lands it.
export function bookRowPreview(item, markups, brandLabel) {
  const priced = pricedItem(withBookBrand(item, brandLabel), markups);
  const patch = stockPatch(priced, {});
  const flooring = patch.type !== "misc";
  const sizeParsed = flooring && patch.L != null && patch.W != null;
  return {
    type: patch.type,
    size: sizeParsed ? `${patch.L}×${patch.W}` : str(patch.sizeText),
    sizeParsed,
    thickness: str(patch.thickness),
    name: str(patch.brandColor),
    coverage: patch.cartonSf != null ? { n: numOr(patch.cartonSf), unit: str(patch.cartonUnit) || "CT", kind: "sf" }
      : patch.cartonPc != null ? { n: numOr(patch.cartonPc), unit: str(patch.cartonUnit) || "CT", kind: "pc" }
        : null,
    price: numOr(patch.priceSqft),
    per: flooring ? "sf" : str(patch.sellUnit).toLowerCase() || "ea",
    markupPct: priced.markupPct ?? null,
  };
}

// --- drift -------------------------------------------------------------------

// Non-null when the row's snapshotted selling price no longer matches what the
// book would produce today ({ from, to }, plus cost/markup movement detail for
// the chip: "cost now $2.10, markup now 40% → $2.94"). Generalizes stockDrift:
// the sell can move because the vendor's cost moved, the book's markup moved,
// or both.
export function orderDrift(item, book, product) {
  if (!item) return null;
  const priced = pricedItem(item, book?.data?.markups);
  const itemArea = fillsFlooring(priced);
  // Frame guard (ADR 0013 amendment): a row snapshotted in one quote frame
  // against an item that now sells in the other — a trim reclassified to
  // per-piece, or the rare reverse — must not show a cross-frame price arrow
  // ($/sqft vs $/piece is not drift). The chip says the frame moved instead;
  // re-picking the item is the deliberate act that adopts the new frame.
  const rowArea = !!product.type && product.type !== "misc";
  if (rowArea !== itemArea) return { frame: itemArea ? "sqft" : "piece" };
  // A count row saved before cartonPc existed was snapshotted per CARTON;
  // the item now quotes per piece — same frame test, price basis moved.
  if (!itemArea && !str(product.cartonPc) && isCartonUnit(orderUnitOf(priced)) && priced.pcPerUnit > 0) return { frame: "piece" };
  // Mirror the pick: flooring lines drift on $/sqft, count lines on the
  // per-sell-unit price (unitPrice — an SF-priced roll drifts on the whole
  // roll's figure, same as the pick lands).
  const now = itemArea ? stockPriceSqft(priced)
    : priced.price != null ? round2(unitPrice(priced)) : null;
  const cur = parseFloat(product.priceSqft);
  if (now == null || !Number.isFinite(cur)) return null;
  const to = round2(now);
  if (Math.abs(cur - to) <= 0.005) return null;
  const drift = { from: cur, to };
  const costFrom = parseFloat(product.cost);
  if (Number.isFinite(costFrom) && item.cost != null && Math.abs(costFrom - item.cost) > 0.005) drift.cost = { from: costFrom, to: item.cost };
  const markFrom = parseFloat(product.markupPct);
  if (Number.isFinite(markFrom) && priced.markupPct != null && Math.abs(markFrom - priced.markupPct) > 0.005) drift.markup = { from: markFrom, to: priced.markupPct };
  return drift;
}

// --- search collision (stock outranks order, by SKU) -------------------------

// When the same SKU string exists in both spaces the order twin is dropped (the
// stock item wins) and the surviving stock match is tagged with the book it is
// also on, so the UI can show an "also on {book}" note instead of a second,
// differently-priced row. Honest and simple: only exact-SKU equality collides —
// no fuzzy cross-vendor product guessing (a wrong guess prices a job off the
// wrong list). Which space a surviving hit RENDERS in is rankMerged's call, not
// this one's.
export function mergeSearch(stockMatches, orderMatches) {
  const bySku = new Map((stockMatches || []).map((it) => [it.sku, it]));
  const order = [];
  for (const it of orderMatches || []) {
    const twin = bySku.get(it.sku);
    if (twin) { (twin.alsoOn = twin.alsoOn || []).push(it.bookId); continue; }
    order.push(it);
  }
  return { stock: stockMatches || [], order: collapseCopies(order) };
}

// One relevance-ordered list out of the two search spaces. mergeSearch still
// resolves the collisions; this decides the ORDER.
//
// Stock used to render as a whole block ahead of every order hit, so a loose
// stock match buried an exact special-order one past the display cap — search
// for "hanoi" and 74 stock near-misses filled all 30 rows while the vendor
// book's actual Hanoi sat unreachable behind them. Now the ladder decides and
// the shelf only breaks ties: at equal relevance stock still wins (no lead
// time, no freight), but it can no longer outrank a better match.
//
// Within a rung each space keeps its incoming order — stock's best-similarity
// sort, the order tier's orderFloorFirst — so this only ever re-interleaves.
export function rankMerged(stockMatches, orderMatches, query) {
  const { stock, order } = mergeSearch(stockMatches, orderMatches);
  return [
    ...stock.map((it, i) => ({ it, rank: hitRank(it, query), shelf: 0, i })),
    ...order.map((it, i) => ({ it, rank: hitRank(it, query), shelf: 1, i })),
  ].sort((a, b) => a.rank - b.rank || a.shelf - b.shelf || a.i - b.i).map((r) => r.it);
}

// --- the same product in two order books -------------------------------------

// Two vendor books routinely carry the same product — one brand distributed by
// two suppliers, or a brand's own sheet sitting beside a distributor's — and
// without this the search shows it twice. SKU equality alone can't decide it
// here: unlike the shop's internal numbers, vendor SKUs share no namespace, so
// two unrelated products can both be "1234". The description has to corroborate.

const descTokens = (it) => new Set(str(it?.description || it?.product).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

// Containment, not Jaccard: one book routinely spells the same product longer
// than the other ("CARRARA WHITE 12X24" vs "CARRARA WHITE 12X24 MATTE
// RECTIFIED PORCELAIN"), and Jaccard would score that pair apart on length
// alone. Measuring the overlap against the SHORTER description reads the long
// one as the same product with more words.
export const COPY_OVERLAP = 0.6;

export function sameProduct(a, b) {
  const sku = str(a?.sku);
  if (!sku || sku !== str(b?.sku)) return false;
  const A = descTokens(a);
  const B = descTokens(b);
  // Nothing to corroborate with: leave both rows standing rather than guess
  // which vendor's price the job gets quoted from.
  if (!A.size || !B.size) return false;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size) >= COPY_OVERLAP;
}

// The comparable sell figure: flooring quotes per sq ft, everything else per
// sell unit. Two copies on different bases aren't a price gap — comparing $/sf
// against $/each would invent one — so the basis gates the comparison.
const sellBasis = (it) => (it?.priceSqft != null ? "sqft" : it?.price != null ? "each" : null);
const sellValue = (it) => (it?.priceSqft != null ? it.priceSqft : it?.price);

// How far apart two books' prices for one product must be, in percent of the
// cheaper, before the surviving row says so out loud.
export const PRICE_GAP_PCT = 5;

// Collapse each set of copies to one row: the cheapest, keeping the group's
// place in the search ranking (relevance orders the list, price only decides
// which copy shows). The dropped books land in `alsoOn` — the same tag the
// stock collision uses, so the "also on {book}" note renders unchanged — and a
// spread past PRICE_GAP_PCT sets `priceGap`, so a collapse can never quietly
// hide that one supplier is meaningfully dearer.
export function collapseCopies(items) {
  const leads = [];
  const groups = [];
  for (const it of items || []) {
    // Matched against the group's lead, not every member — an O(n) walk over a
    // page of results, and copies of one product all resemble the first of them.
    const i = leads.findIndex((lead) => sameProduct(lead, it));
    if (i < 0) { leads.push(it); groups.push([it]); continue; }
    groups[i].push(it);
  }
  return leads.map((lead, i) => {
    const members = groups[i];
    if (members.length < 2) return lead;
    const basis = sellBasis(lead);
    const priced = basis ? members.filter((m) => sellBasis(m) === basis) : [];
    const winner = priced.length ? priced.reduce((a, b) => (sellValue(b) < sellValue(a) ? b : a)) : lead;
    const alsoOn = [...new Set(members.filter((m) => m !== winner).map((m) => m.bookId).filter(Boolean))];
    const dearest = priced.length ? priced.reduce((a, b) => (sellValue(b) > sellValue(a) ? b : a)) : null;
    const low = winner === dearest ? null : sellValue(winner);
    const gap = dearest && low > 0 && (sellValue(dearest) - low) / low * 100 >= PRICE_GAP_PCT
      ? { high: sellValue(dearest), bookId: dearest.bookId, basis }
      : null;
    return { ...winner, alsoOn: [...(winner.alsoOn || []), ...alsoOn], ...(gap ? { priceGap: gap } : {}) };
  });
}

// --- result ordering: flooring before its trims (ADR 0012) -------------------

// Re-rank order-search results so a floor covering outranks the trims that match
// it. On a book like Mannington a trim/molding carries its parent floor's code
// in its description, so searching that code returns the floor AND its reducers,
// T-molds, stair-noses. The salesperson wants the floor first. A stable sort on
// three tiers preserves the server's similarity order within each tier:
//   0  the row whose SKU is exactly the query (the floor being looked up)
//   1  any floor covering (has a flooring `type`)
//   2  everything else (trims/accessories — `type` null)
// Non-code queries ("reducer oak") have no exact-SKU hit and usually match only
// trims, so tiers 0/1 are empty and the order is unchanged.
export function orderFloorFirst(results, query) {
  const q = str(query).toLowerCase();
  const tier = (it) => (q && str(it?.sku).toLowerCase() === q ? 0 : it?.type ? 1 : 2);
  return (results || [])
    .map((it, i) => [it, i])
    .sort((a, b) => tier(a[0]) - tier(b[0]) || a[1] - b[1])
    .map(([it]) => it);
}

// --- import diff -------------------------------------------------------------

// The item fields whose change makes a re-import a "changed" row. Order books
// track cost (not sell) plus the vendor attributes a re-issue can move. `price`
// is here for the stock-kind registry books (the ERP exports carry the shop's
// real retail beside the cost) — without it a re-export that moved only the
// shelf price read as unchanged and the row was never upserted.
export const BOOK_FIELDS = ["description", "brand", "mfg", "productLine", "color", "unit", "priceUnit", "orderUnit", "size", "thickness", "type", "trim", "fits", "vendorSkus", "cost", "price", "sfPerUnit", "pcPerUnit", "coverage", "leadTime", "msrp", "freightFlag", "discontinued"];

// Field equality for the diff. `fits` is an array, so identity comparison would
// mark every trim changed on every re-import; compare by value instead.
const sameField = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) return (a || []).join(" ") === (b || []).join(" ");
  return (a ?? null) === (b ?? null);
};

// Compare freshly parsed items against the book's current rows — same contract
// as diffStock: added / changed / missing (marked inactive on apply, never
// deleted, so selections referencing a dropped SKU keep resolving).
export function diffBookItems(existing, parsed) {
  const bySku = new Map((existing || []).map((it) => [it.sku, it]));
  const seen = new Set();
  const added = [], changed = [], unchanged = [];
  for (const it of parsed || []) {
    seen.add(it.sku);
    const prev = bySku.get(it.sku);
    if (!prev) { added.push(it); continue; }
    const fields = BOOK_FIELDS.filter((f) => !sameField(prev[f], it[f]));
    if (fields.length || !prev.active) changed.push({ item: it, prev, fields });
    else unchanged.push(it);
  }
  const missing = (existing || []).filter((it) => it.active && !seen.has(it.sku));
  return { added, changed, missing, unchanged };
}

// Human labels for the tracked fields — the wizard's changed-row detail. One
// entry per BOOK_FIELDS member so a tracked field can't change namelessly.
export const BOOK_FIELD_LABELS = {
  description: "Description", brand: "Brand", mfg: "Mfg", productLine: "Product line",
  color: "Color", unit: "Unit", priceUnit: "Price U/M", orderUnit: "Order U/M",
  size: "Size", thickness: "Thickness", type: "Type", trim: "Trim", fits: "Fits",
  vendorSkus: "Mfg codes", cost: "Cost", price: "Price", sfPerUnit: "SF/CT",
  pcPerUnit: "PC/CT", coverage: "Coverage", leadTime: "Lead time", msrp: "MSRP",
  freightFlag: "Freight", discontinued: "Discontinued",
};

// Money-valued fields, so the wizard can render them as dollars and mask them
// under the hide-costs toggle.
const MONEY_FIELDS = new Set(["cost", "price", "msrp"]);

// One changed row's field movements for the wizard's diff detail: `fields` as
// diffBookItems produced them, each as { field, label, from, to, money }.
// Values render the way the sheet states them — arrays joined, booleans as
// yes/no, blanks as "—" — so "what changed" reads without opening the row.
export function changedFieldBits(prev, item, fields) {
  const fmt = (v) => (Array.isArray(v) ? (v.length ? v.join(" ") : "—")
    : typeof v === "boolean" ? (v ? "yes" : "no")
      : v == null || v === "" ? "—" : String(v));
  return (fields || []).map((f) => ({
    field: f,
    label: BOOK_FIELD_LABELS[f] || f,
    from: fmt(prev?.[f]),
    to: fmt(item?.[f]),
    money: MONEY_FIELDS.has(f),
  }));
}

// Recast a diff so a forced re-import rewrites every row, not just the deltas
// (the wizard's "Force full re-import" toggle). Every `unchanged` row becomes a
// `changed` write — same shape diffBookItems produces, so applyBookImport upserts
// it through the existing changed path (preserving each row's disabled/flagReview
// from `prev`) and the version snapshot's active set stays complete. `added` and
// `missing` pass through untouched: forcing rewrites what's present and still
// retires what's genuinely gone.
export function forceDiff(diff, existing) {
  const bySku = new Map((existing || []).map((it) => [it.sku, it]));
  return {
    added: diff.added,
    changed: [...diff.changed, ...(diff.unchanged || []).map((it) => ({ item: it, prev: bySku.get(it.sku), fields: [] }))],
    missing: diff.missing,
    unchanged: [],
  };
}

// The hand-edited items (editedAt set) a re-import would overwrite: their SKU is
// in the incoming sheet with a differing field, so they land in the diff's
// "changed" bucket and their manual fix is lost. Powers the wizard's "N items
// you edited will be overwritten" warning. Unchanged edited items aren't
// flagged — an identical re-import is a no-op for the values that matter.
export function editedInDiff(existing, parsed) {
  const { changed } = diffBookItems(existing, parsed);
  return changed.filter(({ prev }) => prev && prev.editedAt).map(({ prev }) => prev);
}

// --- import-time unit sanity ---------------------------------------------------

// Per-row pricing/unit hazard classifier. Returns the problem(s) that make a
// row misprice — 0 or 1 today, short-circuiting in priority order. Born of the
// VTC bullnose audit (2026-07): 801 per-piece-priced, carton-sold rows silently
// underpriced 1–20× because no check owned "does this sheet carry a unit
// combination we've never priced?". Every combination the code DOES handle
// returns [] (unitcombos.test.js is the truth table). An untyped "Misc" row is
// NOT a hazard — landing as a count line is by design (ADR 0013).
export function itemProblems(item) {
  const it = item || {};
  const pu = priceUnitOf(it), ou = orderUnitOf(it);
  if (it.cost == null && it.price == null) return [{ code: "no-price", msg: "with no price on the sheet — landing unpriced" }];
  if (it.cost === 0 || it.price === 0) return [{ code: "zero-price", msg: "with a $0 price on the sheet — landing as $0 lines" }];
  if (isPieceUnit(pu) && !(it.pcPerUnit > 0)) {
    // Without PC/CT a per-piece price can't be converted to the carton the
    // vendor actually sells (or to a per-carton SF/CT) — the bullnose hole.
    if (isCartonUnit(ou)) return [{ code: "no-pc-carton", msg: `priced per ${pu.toUpperCase()} but sold by the ${ou.toUpperCase()} with no PC/CT column mapped — the carton price can't be built (may land unpriced or underpriced)` }];
    if (it.sfPerUnit > 0 && ou && ou.toUpperCase() !== pu.toUpperCase()) return [{ code: "pc-sf-mismatch", msg: `priced per ${pu.toUpperCase()} with SF/CT coverage but no PC/CT column mapped — the derived $/sqft may be off by the carton's piece count` }];
  }
  // A roll is a known sell unit (units.js): SF-priced with coverage the pick
  // lands the whole-roll price (unitPrice). SF-priced WITHOUT coverage nothing
  // can build the roll price from — that's the hazard, not the unit.
  if (/^(rl|roll)s?$/i.test(ou)) {
    return /^(sf|sft|sqft)$/i.test(pu) && !(it.sfPerUnit > 0)
      ? [{ code: "roll-no-coverage", msg: "priced per SF but sold by the roll with no coverage found — the roll price can't be built (lands at the bare per-sqft figure)" }]
      : [];
  }
  if (pu && ou && ou.toUpperCase() !== pu.toUpperCase() && !isCartonUnit(ou) && !isPieceUnit(ou) && !/^(sf|sft|sqft)$/i.test(ou)) {
    return [{ code: "unfamiliar-unit", msg: `sold by an unfamiliar unit "${ou}" — check how these rows land before trusting their price` }];
  }
  return [];
}

// Aggregate the per-row hazards for the import wizard's file-level warning list:
// group by message, keep ≤3 sample SKUs each. Rule-based via itemProblems, so
// single-U/M books stay quiet. `review` (sku → flagReview, see flagReviewBySku)
// mutes codes a human already confirmed or ignored on the existing book row.
export function unitComboWarnings(items, review) {
  const groups = new Map();
  for (const it of items || []) {
    const rev = review?.get(it.sku);
    const probs = itemProblems(it).filter((p) => !rev?.[p.code]);
    if (!probs.length) continue;
    const { msg } = probs[0];
    const g = groups.get(msg) || { n: 0, skus: [] };
    g.n++;
    if (g.skus.length < 3 && it.sku) g.skus.push(it.sku);
    groups.set(msg, g);
  }
  return [...groups.entries()].map(([msg, g]) => `${g.n} row${g.n === 1 ? "" : "s"} ${msg} (${g.skus.join(", ")}${g.n > g.skus.length ? ", …" : ""}).`);
}

// --- import parse-quality advisories -------------------------------------------

// Trade words that name a linear/piece accessory rather than a field covering —
// English plus the Italian the tile vendors actually write (gradino = step,
// angolo/angolare = corner, scalino = stair edge, battiscopa = baseboard,
// torello = rounded edge, zoccolo = skirting, fascia/listello = border strips).
const TRIM_WORD_RE = /reducer|t-?mold|bull ?nose|stair ?nos|threshold|transition|pencil|quarter ?round|\bliner\b|\bedge\b|\btrim\b|\bcap\b|\bcove\b|\btread\b|\briser\b|nosing|skirting|\bcorner\b|\bcrn\b|\bstep\b|v-?cap|\bogee\b|molding|moulding|gradino|gradone|scalino|angolo|angolare|\bango\b|battiscopa|torello|zoccolo|fascia|listello/i;
const SHEET_UNIT_RE = /^(sh|sht|sheet)s?$/i;
// The most a real mosaic backing sheet covers (they run ~1 sqft) — anything
// claiming more mis-parsed its coverage.
const SHEET_SF_MAX = 3;
// Stated SF/CT against the footprint the parsed size implies (piece area ×
// pieces per carton): ≈1 says the vendor's coverage is real — the piece is a
// genuine area product however it's priced. null when the size doesn't parse.
const coverageRatio = (it) => {
  const lw = parseTileSize(it.size);
  return lw && it.sfPerUnit > 0 ? it.sfPerUnit / (((+lw[0] * +lw[1]) / 144) * (it.pcPerUnit > 0 ? it.pcPerUnit : 1)) : null;
};
const coverageConfirmed = (it) => { const r = coverageRatio(it); return r != null && r >= 0.85 && r <= 1.15; };
// The vendor's notional metric coverages — 0.5 / 1 / 2 m² in square feet —
// stamped on trim rows that have no real area to cover. A match (±1%) says the
// SF/CT is fabricated, not measured.
const NOTIONAL_M2_SF = [5.38, 10.76, 21.53];
// Words that name genuine square-foot product a vendor sells by the piece/sheet
// (a mosaic sheet covers ~1 sqft), so a marginal cost-inversion on one is NOT a
// mispricing. Used only to exempt these from area-below-piece-cost — the trims
// are the signal there, and un-guarded these are ~1/3 of the false hits.
const AREA_PIECE_RE = /mosaic|\bmos\b|mos\d|hexagon|\bhex\b|esagono|penny|pebble|chevron|herringbone|\b3d\b/i;
// A size-shaped token ("12x24", ".43x12") — includes the leading-decimal form so
// an un-split VTC pencil width is caught, not just whole-number sizes.
const RESIDUAL_SIZE_RE = /(?:\d+(?:\.\d+)?|\.\d+)\s*["']?\s*[x×]\s*(?:\d+(?:\.\d+)?|\.\d+)/i;
// A lone "." / "·" / "x" token, an empty "()", or a name that opens/closes on a
// dot — the residue a mis-split size leaves (".43X12" once dropped the "." and
// left "Crafted White . Rounded Edge"). Hyphens/commas are NOT litter: vendors
// use " - " as a legitimate separator, so flagging them would be noise.
const NAME_LITTER_RE = /(^|\s)[.·x×]($|\s)|\(\s*\)|^\s*\.|\.\s*$/i;

// Per-row advisories: parse-quality and plausibility flags that are worth a
// human glance but are NOT the hard mispricing hazards itemProblems owns. These
// never block an import — they only add FYI lines to the wizard's warning list,
// so the next unhandled parse shape is surfaced instead of shipping silently
// (the ".43X12" → "43x12" lesson). One message per issue, most-telling first.
export function rowAdvisories(item) {
  const it = item || {};
  const name = str(it.description);
  const out = [];
  const clean = name.replace(/[^a-z0-9]/gi, "");
  if (NAME_LITTER_RE.test(name)) out.push({ code: "name-litter", msg: "with leftover punctuation in the name after size parsing — the size may be mis-split" });
  else if (RESIDUAL_SIZE_RE.test(name)) out.push({ code: "name-size", msg: "still showing a size in the product name — the size column may be unmapped or an unrecognized spelling" });
  else if (clean.length <= 1) out.push({ code: "name-empty", msg: "parsing to an empty or one-character name — check the description column" });
  if (fillsFlooring(it) && TRIM_WORD_RE.test(`${name} ${str(it.size)}`)) out.push({ code: "trim-as-area", msg: "a trim/molding line priced by the square foot — confirm it should cover area, not sell per piece" });
  const sheetUnit = SHEET_UNIT_RE.test(priceUnitOf(it)) || SHEET_UNIT_RE.test(orderUnitOf(it));
  // No mosaic backing sheet covers over ~3 sqft (team rule, 2026-07-23) — a
  // bigger claim is a mis-parsed coverage riding the description (the 22974
  // lesson: ".969sf/sh" once read as 969 sf/sheet). A genuine oversized sheet
  // good whose FEET-marked size agrees with the claim (a Ditra-Heat membrane
  // sheet: 3'2"×2'7" ≈ 8.4 sf) is geometry-confirmed and doesn't trip.
  const fa = feetArea(it.size);
  const feetConfirmed = fa != null && it.sfPerUnit > 0 && it.sfPerUnit / fa >= 0.85 && it.sfPerUnit / fa <= 1.15;
  if (sheetUnit && it.sfPerUnit > SHEET_SF_MAX && !feetConfirmed) out.push({ code: "sheet-coverage", msg: `claiming ${it.sfPerUnit} sf per SHEET — over ${SHEET_SF_MAX} sf isn't a real mosaic sheet, so the coverage likely mis-parsed from the description` });
  const psf = it.type ? costSqft(it) : null;
  // Cost-inversion: a piece-priced row being sold by the square foot whose
  // derived $/sqft cost sits BELOW its own per-piece cost — i.e. the piece
  // covers more than a square foot, so square-footing it (usually off a bogus
  // SF/CT) prices it under water. Language-independent, so it catches the trims
  // the TRIM_WORD_RE lexicon misses — VTC's Italian gradino/angolo/fascia step
  // and corner pieces stamped with a notional metric SF/CT (10.76 = 1 m²).
  // Mosaics/sheets are exempt (AREA_PIECE_RE / a sheet unit): a sheet legitimately
  // covers ~1 sqft, so its marginal inversion is real area product, not a trim —
  // un-guarded they are ~1/3 of the hits. The fix for a real hit is reclassifying
  // the row to a per-piece count line; this only flags it.
  // Geometry-confirmed coverage (a 24x48 deco panel honestly covering 8 sqft)
  // is a real area product priced per piece — under water only in the
  // unit-blind read, so it doesn't warn.
  if (psf != null && psf < it.cost && isPieceUnit(priceUnitOf(it)) && !sheetUnit && !AREA_PIECE_RE.test(`${name} ${str(it.size)}`) && !coverageConfirmed(it)) out.push({ code: "area-below-piece-cost", msg: `priced $${it.cost}/${priceUnitOf(it).toUpperCase()} but its derived cost is only $${psf}/sqft — a piece that covers over a square foot being sold by the foot, so it prices below cost; likely a trim (check its SF/CT)` });
  // The outlier check also reads UNTYPED carton/sheet-sold rows: the 22974
  // lesson — a mis-parsed 969 sf/sheet derived $0.02/sqft, but the row was
  // untyped so the typed-only psf skipped it. Trims stay out (their coverage
  // is ignored at pick time), as do roll/EA accessories (a 500 sf roll
  // legitimately derives pennies per sqft).
  const psfAny = psf != null ? psf
    : !it.trim && (sheetUnit || isCartonUnit(priceUnitOf(it)) || isCartonUnit(orderUnitOf(it))) ? costSqft(it) : null;
  if (psfAny != null && (psfAny > 150 || psfAny < 0.25)) out.push({ code: "psf-outlier", msg: `an unusual per-sq-ft cost (about $${psfAny}) — double-check the unit and coverage (premium goods can legitimately run high)` });
  return out;
}

// Aggregate rowAdvisories for the wizard's warning list — same shape and ≤3-SKU
// sampling as unitComboWarnings, but every message can fire per row (a row can
// be both mis-split AND a trim-as-area), so all advisories are counted. Same
// `review` mute as unitComboWarnings.
export function importSanityWarnings(items, review) {
  const groups = new Map();
  for (const it of items || []) {
    const rev = review?.get(it.sku);
    for (const { code, msg } of rowAdvisories(it)) {
      if (rev?.[code]) continue;
      const g = groups.get(msg) || { n: 0, skus: [] };
      g.n++;
      if (g.skus.length < 3 && it.sku) g.skus.push(it.sku);
      groups.set(msg, g);
    }
  }
  return [...groups.entries()].map(([msg, g]) => `${g.n} row${g.n === 1 ? "" : "s"} ${msg} (${g.skus.join(", ")}${g.n > g.skus.length ? ", …" : ""}).`);
}

// --- flag chips (book table) ----------------------------------------------------

// Short chip labels for the hazard/advisory codes; the full message rides the
// chip's tooltip.
const FLAG_LABELS = {
  "no-price": "no price", "zero-price": "$0", "no-pc-carton": "no PC/CT",
  "pc-sf-mismatch": "unit mix", "unfamiliar-unit": "odd unit", "roll-no-coverage": "roll $?",
  "name-litter": "name?", "name-size": "name?", "name-empty": "name?",
  "trim-as-area": "trim as sqft", "area-below-piece-cost": "under water", "psf-outlier": "$/sqft?",
  "sheet-coverage": "sf/sh?",
};
const TRIM_SIGNAL_MSG = {
  lexicon: "Named as a trim (bullnose, gradino, end cap…) — quotes per piece, not by the square foot.",
  inversion: "Its derived $/sqft cost landed below its own per-piece cost — the sheet's coverage isn't real, so it quotes per piece.",
  notional: "Its SF/CT is a bare metric constant that contradicts its size — quotes per piece.",
};

// Why a book row deserves a glance — the derive-at-render source for the book
// table's flag chips. Nothing is stored: hazards and advisories re-derive from
// the item each render (hand-fixing the item clears its chip, old imports get
// chips retroactively), the per-piece chip reads the import-stamped trimSignal,
// and a disabled row explains itself when a reason is derivable — its
// N-successor existing in `skus` (the supersede that disabled it at import).
// A hazard/advisory the team reviewed carries its verdict as `resolved`
// ("confirmed"/"ignored") so the table can quiet or restyle it.
export function itemFlags(item, skus) {
  const it = item || {};
  const flags = [];
  for (const p of itemProblems(it)) flags.push({ code: p.code, tone: "hazard", label: FLAG_LABELS[p.code] || p.code, msg: `This row imports ${p.msg}.`, resolved: flagReviewed(it, p.code) });
  for (const a of rowAdvisories(it)) flags.push({ code: a.code, tone: "advisory", label: FLAG_LABELS[a.code] || a.code, msg: `This row imports ${a.msg}.`, resolved: flagReviewed(it, a.code) });
  if (it.trimSignal) flags.push({ code: "trim-reclassified", tone: "info", label: "per-piece", msg: TRIM_SIGNAL_MSG[it.trimSignal] || it.trimSignal });
  if (it.disabled && skus) {
    const n = [`${it.sku}N`, `${it.sku}n`].find((s) => skus.has(s));
    if (n) flags.push({ code: "superseded", tone: "muted", label: "superseded", msg: `Replaced by ${n} — disabled by the import's supersede step.` });
  }
  return flags;
}

// --- trim classifier (ADR 0013 amendment) --------------------------------------

// Should this piece-priced, coverage-carrying row quote per PIECE instead of per
// square foot? The quote frame follows the product kind, not the units — a
// bullnose and a field tile can carry identical unit signatures, but a
// salesperson counts trim in pieces. Returns the signal that fired ("lexicon" /
// "inversion" / "notional") or null to keep today's behavior. First match wins:
//   sheet    a sheet unit or parsed backing sheet is PHYSICAL evidence of
//            square-foot product — outranks everything, never reclassified
//   lexicon  a trim word (EN + IT) — the only signal that sees the ~280
//            honest-coverage step/tread pieces whose SF/CT is a real
//            footprint. Outranks the mosaic WORD guard: on the real file
//            every trim-word + pattern-word row ("Fascia Spina Herringbone")
//            is a trim — word beats word, physical evidence beats both
//   guard    a mosaic/pattern word is genuine square-foot product (the
//            2026-07 geometry audit: mosaics were 70% of naive high-ratio
//            hits), never reclassified
//   confirm  the parsed size CONFIRMS the stated coverage (ratio ≈ 1) → a
//            genuine area product sold by the piece (large-format loose tile);
//            stays flooring even though its piece cost exceeds its sqft cost
//   inversion  derived $/sqft cost below the piece's own cost — fabricated
//            coverage (a piece "covering" more than it possibly does)
//   notional  SF/CT is a bare metric constant (0.5/1/2 m²) that contradicts
//            the parsed size — fabricated, but not deep enough to invert
// Applied at IMPORT (mappedItem) only, so saved snapshots never move and a
// re-import is what changes a book's picks (ADR 0003 doctrine).
export function classifyTrim(item) {
  const it = item || {};
  if (!it.type || it.cost == null || !(it.sfPerUnit > 0) || !isPieceUnit(priceUnitOf(it))) return null;
  const text = `${str(it.description)} ${str(it.size)}`;
  if (it.sheetSize || SHEET_UNIT_RE.test(priceUnitOf(it)) || SHEET_UNIT_RE.test(orderUnitOf(it))) return null;
  if (TRIM_WORD_RE.test(text)) return "lexicon";
  if (AREA_PIECE_RE.test(text)) return null;
  if (coverageConfirmed(it)) return null;
  const csf = costSqft(it);
  if (csf != null && csf < it.cost) return "inversion";
  if (coverageRatio(it) != null && NOTIONAL_M2_SF.some((v) => Math.abs(it.sfPerUnit - v) <= v * 0.01)) return "notional";
  return null;
}

// N-suffix supersede detection. Vendors reissue a SKU by appending N to mark a
// new version of an older code (VTC convention). For each incoming SKU ending
// in n/N whose base (the SKU minus that trailing letter) exactly matches another
// SKU present in this file OR the book's existing items, emit a pair so the
// import can offer to disable the old code. Only enabled bases are flagged
// (nothing to retire otherwise); the existence guard keeps ordinary N-ending
// SKUs ("PLAN") from producing false pairs. One level, exact base match — a
// wrong pair is visible and untickable in the preview.
export function supersedePairs(existing, parsed) {
  const bySku = new Map();
  for (const it of existing || []) bySku.set(it.sku, it);
  for (const it of parsed || []) bySku.set(it.sku, it); // incoming wins for description
  const pairs = [];
  const seen = new Set();
  for (const it of parsed || []) {
    const m = /^(.+)[nN]$/.exec(it.sku || "");
    if (!m) continue;
    const base = bySku.get(m[1]);
    if (!base || base.sku === it.sku || base.disabled) continue;
    const key = `${base.sku}>${it.sku}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ oldSku: base.sku, newSku: it.sku, oldDesc: base.description || "", newDesc: it.description || "" });
  }
  return pairs;
}

// --- markup group summary ----------------------------------------------------

// The distinct values of the markup group column present in a book's items,
// each with its current override (or the book default), for the markup editor.
// Only the groups the sheet actually has are priceable — no free-form matcher.
export function markupGroups(items, markups) {
  const m = markups || {};
  const field = m.groupBy;
  if (!field) return [];
  const seen = new Map();
  for (const it of items || []) {
    const key = str(it[field]);
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()]
    .map(([key, count]) => ({ key, count, pct: (m.byGroup && m.byGroup[key] != null ? numOr(m.byGroup[key], numOr(m.default, 0)) : numOr(m.default, 0)), overridden: !!(m.byGroup && m.byGroup[key] != null) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// --- a book with no markup ---------------------------------------------------

// An order book whose config carries no rate at all sells the vendor's cost as
// the selling price — every pick from it quotes the job at cost. Read off the
// book's metadata alone (the library board's rows never load items), so any
// rate the config holds counts: the default, the trim rate, and each per-group
// override. Stock books price off their own sheet and are never flagged.
export function bookNoMarkup(book) {
  if (!book || book.kind !== "order") return false;
  const m = book.data?.markups || {};
  const rates = [m.default, m.trim, ...Object.values(m.byGroup || {})];
  return !rates.some((r) => (numOr(r, 0) || 0) !== 0);
}

// --- book staleness (§8.3) ---------------------------------------------------

// Vendors re-issue cost lists roughly quarterly; a months-old book quietly
// misprices jobs, the most likely real-world failure of the whole system. The
// default flags a book whose last import predates this many days; the owner can
// override it (settings.ops.staleDays).
export const DEFAULT_STALE_DAYS = 120;

// Age of a book's last import and whether it is past the staleness threshold.
// `lastImportAt` is an epoch-ms stamp (book.data.lastImport.at or, for the stock
// workbook, settings.ops.lastImport.at); a never-imported book (null/0) has no
// age and is NOT flagged stale — "stale" means old data, not absent data. An
// out-of-range threshold falls back to the default so a bad setting can't flag
// (or un-flag) every book.
export function bookStaleness(lastImportAt, thresholdDays = DEFAULT_STALE_DAYS, now = Date.now()) {
  const at = numOr(lastImportAt);
  const days = at != null && at > 0 ? Math.floor((now - at) / 86400000) : null;
  const t = numOr(thresholdDays);
  const threshold = t != null && t > 0 ? t : DEFAULT_STALE_DAYS;
  return { days, threshold, stale: days != null && days >= threshold };
}

// --- internal materials margin (§8.1) ----------------------------------------

// Internal-only materials margin over special-order lines. A special-order
// product row snapshots cost + markupPct, so its sell was cost×(1 + markupPct/100)
// and margin = sell − cost = sell × markupPct/(100 + markupPct). That is
// unit-agnostic, so a line billed by the foot and one billed by the whole carton
// fold in identically — no need to re-derive cost per unit. Approximate to the
// cent (the snapshotted priceSqft was already rounded). Stock/catalog rows carry
// no cost and are excluded by the caller.
//
// `lines` = [{ sell, cost?, markupPct }] for special-order rows only. When a
// line carries its snapshotted `cost` (the honest vendor cost), the margin is
// sell − cost — so a hand-edited sale price shrinks the margin and never rewrites
// the cost. Rows saved before that snapshot existed have no `cost` and fall back
// to deriving it from the markup (the prior behavior, correct until a price is
// edited). Returns the summed sell, implied cost and margin dollars, and the
// blended margin as a percent OF SELL (gross margin, not markup). ON SCREEN
// ONLY — the estimate print must never show it (ADR 0009 §8.1 / §2.3).
export function specialOrderMargin(lines) {
  let sell = 0, margin = 0, n = 0;
  for (const l of lines || []) {
    const s = numOr(l?.sell, 0) || 0;
    if (s <= 0) continue;
    sell += s;
    const cost = numOr(l?.cost, null);
    if (cost != null) margin += s - cost;
    else { const pct = numOr(l?.markupPct, 0) || 0; margin += pct > 0 ? (s * pct) / (100 + pct) : 0; }
    n++;
  }
  return {
    sell: round2(sell),
    cost: round2(sell - margin),
    margin: round2(margin),
    pct: sell > 0 ? Math.round((margin / sell) * 1000) / 10 : 0,
    lines: n,
  };
}
