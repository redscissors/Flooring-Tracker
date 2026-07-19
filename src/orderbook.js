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

import { stockPatch, stockPriceSqft, priceUnitOf, orderUnitOf, perCartonFactor, fillsFlooring, isPieceUnit, isCartonUnit, parseTileSize } from "./stock.js";

const str = (v) => (v == null ? "" : String(v).trim());
const numOr = (v, d = null) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") { const n = parseFloat(v.replace(/[$,]/g, "")); if (Number.isFinite(n)) return n; }
  return d;
};
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const round4 = (n) => (n == null ? null : Math.round(n * 10000) / 10000);

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
    description: str(f.description),
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
    // Order items store COST, never a selling price — price/priceSqft are
    // derived at display via the book's markup (pricedItem), never persisted.
    price: null,
    priceSqft: null,
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
  // Count lines cost per PIECE, matching the per-piece sell the patch
  // snapshots (ADR 0013 amendment) — carton rounding lives on the row's
  // cartonPc, never in the price.
  return csf != null ? csf : item.cost;
};

// A stock-shaped item with price/priceSqft filled from cost × markup, so
// search results and the pick-snapshot can treat it exactly like a stock item.
// Also carries the resolved markupPct for display and the pick snapshot. A
// stock-kind registry item (no cost) passes through with its own price.
export function pricedItem(item, markups) {
  const pct = resolveMarkup(markups, item);
  if (!item || item.cost == null) return { ...item, markupPct: pct };
  const csf = costSqft(item);
  return {
    ...item,
    markupPct: pct,
    price: sellPrice(item.cost, pct),
    priceSqft: csf != null ? round4(csf * (1 + pct / 100)) : null,
  };
}

// --- pick snapshot -----------------------------------------------------------

// The snapshot patch a picked order-book item applies to a product row: the
// same fields stockPatch fills (type, $/sqft, carton, brand/size), plus the
// order-book provenance the drift chip and (later) contractor pricing need.
// bookId/cost/markupPct/tierPrice are stored as strings, matching how the row
// keeps its other numeric fields.
export function orderPatch(item, book, product) {
  const priced = pricedItem(item, book?.data?.markups);
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
  // per-piece price.
  const now = itemArea ? stockPriceSqft(priced)
    : priced.price != null ? round2(priced.price) : null;
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

// Stock matches always render first; order matches follow. When the same SKU
// string exists in both spaces the order twin is dropped (the stock item wins)
// and the surviving stock match is tagged with the book it is also on, so the
// UI can show an "also on {book}" note instead of a second, differently-priced
// row. Honest and simple: only exact-SKU equality collides — no fuzzy
// cross-vendor product guessing (a wrong guess prices a job off the wrong list).
export function mergeSearch(stockMatches, orderMatches) {
  const bySku = new Map((stockMatches || []).map((it) => [it.sku, it]));
  const order = [];
  for (const it of orderMatches || []) {
    const twin = bySku.get(it.sku);
    if (twin) { (twin.alsoOn = twin.alsoOn || []).push(it.bookId); continue; }
    order.push(it);
  }
  return { stock: stockMatches || [], order };
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
// track cost (not sell) plus the vendor attributes a re-issue can move.
const BOOK_FIELDS = ["description", "brand", "mfg", "productLine", "color", "unit", "priceUnit", "orderUnit", "size", "thickness", "type", "trim", "fits", "cost", "sfPerUnit", "pcPerUnit", "coverage", "leadTime", "msrp", "freightFlag", "discontinued"];

// Field equality for the diff. `fits` is an array, so identity comparison would
// mark every trim changed on every re-import; compare by value instead.
const sameField = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) return (a || []).join(" ") === (b || []).join(" ");
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
  const sheetUnit = SHEET_UNIT_RE.test(priceUnitOf(it)) || SHEET_UNIT_RE.test(orderUnitOf(it));
  // Geometry-confirmed coverage (a 24x48 deco panel honestly covering 8 sqft)
  // is a real area product priced per piece — under water only in the
  // unit-blind read, so it doesn't warn.
  if (psf != null && psf < it.cost && isPieceUnit(priceUnitOf(it)) && !sheetUnit && !AREA_PIECE_RE.test(`${name} ${str(it.size)}`) && !coverageConfirmed(it)) out.push({ code: "area-below-piece-cost", msg: `priced $${it.cost}/${priceUnitOf(it).toUpperCase()} but its derived cost is only $${psf}/sqft — a piece that covers over a square foot being sold by the foot, so it prices below cost; likely a trim (check its SF/CT)` });
  if (psf != null && (psf > 150 || psf < 0.25)) out.push({ code: "psf-outlier", msg: `an unusual per-sq-ft cost (about $${psf}) — double-check the unit and coverage (premium goods can legitimately run high)` });
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
  "pc-sf-mismatch": "unit mix", "unfamiliar-unit": "odd unit",
  "name-litter": "name?", "name-size": "name?", "name-empty": "name?",
  "trim-as-area": "trim as sqft", "area-below-piece-cost": "under water", "psf-outlier": "$/sqft?",
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
