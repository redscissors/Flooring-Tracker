import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";
import { adaptBookRows } from "./wediadapter.js";
import { catalog, setStockSource, clearStockSource, kitFor, solve, figureConsumables, SKU } from "./wedi.js";

// The zero-drift baseline (spec, "Verification"). Every cost and every retail
// in the export matches the transcribed table to the cent, so any difference
// here is a bug in the adapter, not a repricing — there is no judgement call.
//
// `desc` is compared structurally, not literally: the mapped importer always
// splits the dimensions out of the description (pricebook.js:532), so the
// adapter reconstructs them and the reconstruction is not byte-identical to
// the hand-transcribed string. What must be identical is everything DERIVED
// from it — w/d/t/sf/len, the group, the display name, the size line.
const DERIVED = ["key", "us", "erp", "stock", "name", "group", "sub", "w", "d", "t",
  "sf", "len", "finish", "drain", "channel", "cost", "retail", "unit", "sizeText"];

const pick = (e) => Object.fromEntries(DERIVED.map((k) => [k, e[k]]));
const stockHalf = () => catalog().filter((e) => e.stock).slice().sort((a, b) => (a.key < b.key ? -1 : 1));

test("book-fed catalog is identical to the transcribed catalog, entry for entry", () => {
  clearStockSource();
  const fromTable = stockHalf().map(pick);

  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  setStockSource(adaptBookRows(live));
  const fromBook = stockHalf().map(pick);
  clearStockSource();

  assert.equal(fromBook.length, 151, "151 stock entries from the book");
  assert.equal(fromTable.length, 151, "151 stock entries from the table");
  // deep-equal the whole half at once so a diff names the offending entry
  assert.deepEqual(fromBook, fromTable);
});

test("every stock entry still classifies — nothing falls into misc", () => {
  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  setStockSource(adaptBookRows(live));
  const misc = catalog().filter((e) => e.stock && e.group === "misc").map((e) => e.us + " " + e.name);
  clearStockSource();
  // A NEW wedi part number that classify()'s grammar doesn't know lands here.
  // The book gives price drift for free; it does NOT extend the catalog — a new
  // product line still needs its code added to wedi.js by hand. This test is
  // how you find out, loudly, rather than shipping an unbuildable item.
  assert.deepEqual(misc, []);
});

test("the pinned engine totals do not move when the book feeds the catalog", () => {
  // Key and input copied verbatim from the pinned tests (wedi.test.js:498):
  // US9100004 is the 36×60 pan that solve() returns as the exact match.
  // kitFor takes a PAN key — passing a curb key returns nothing and the
  // deep-equal would pass vacuously, proving nothing.
  const INPUT = { w: 36, d: 60, curb: "curbed", drain: "any" };

  // These trees carry whole catalog entries, so they carry `desc` — the one
  // field DERIVED omits, for the same reason: the importer's size split is not
  // byte-reversible. Two rows cannot round-trip and both are understood:
  // US5000033's lifted `1/2"` lost its mid-string position to the importer's
  // whitespace collapse, and 073783528's `24"x 48"` was canonicalised to
  // `24x48`, losing the marks and the space. Strip `desc` and compare
  // EVERYTHING else deeply — every price, quantity, key and geometry value in
  // the tree. Measured: stripped, the trees are identical; unstripped, exactly
  // 3 leaves differ, all `desc`, on those 2 entries. This is the plan's own
  // exclusion applied consistently, not a weakened assertion.
  const stripDesc = (v) => {
    if (Array.isArray(v)) return v.map(stripDesc);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).filter(([k]) => k !== "desc").map(([k, x]) => [k, stripDesc(x)]));
    }
    return v;
  };

  clearStockSource();
  const before = kitFor("US9100004");
  const beforeSolve = solve(INPUT);
  assert.ok(before && before.lines && before.lines.length, "guard: kitFor really built a kit");
  assert.ok(beforeSolve.length && beforeSolve[0].pieces[0].item.key === "US9100004",
    "guard: solve really returned the exact pan");
  const beforeKit = stripDesc(before), beforeSol = stripDesc(beforeSolve);

  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  setStockSource(adaptBookRows(live));
  const afterKit = stripDesc(kitFor("US9100004"));
  const afterSol = stripDesc(solve(INPUT));
  clearStockSource();

  assert.deepEqual(afterKit, beforeKit, "kitFor is unchanged");
  assert.deepEqual(afterSol, beforeSol, "solve is unchanged");
});

// A live book can SUBTRACT rows the transcribed table always had: a re-import
// that no longer lists a SKU marks it active:false (usebooks.js) and the hook
// filters it out. kitFor splices figureConsumables' lines straight in and then
// dereferences l.item.key/.group/.stock, so an unresolvable line would be a
// TypeError that takes out the popup rather than a dropped row.
//
// Measured, because the shape of the code overstates the exposure: 22 of the
// 24 SKU.* constants also appear in WEDI_SO, so item() still resolves them —
// as a special-order entry — when the book drops them. Only SKU.sdrySeal and
// SKU.sdrySealTrowel are stock-only, and both already go through the guarded
// push(). So this cannot crash TODAY. It becomes reachable when 8b retires
// WEDI_SO and the pricelist stops backstopping the other 22, which is why the
// guard goes in now rather than then.
test("a book that drops hardcoded SKUs never yields a line with no item", () => {
  clearStockSource();
  assert.equal(figureConsumables(100, "sausage").lines.length, 2,
    "guard: both consumable lines resolve on the transcribed table");

  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  const gone = new Set([SKU.fastenerKit, SKU.sealantSausage, SKU.sealantTube,
    SKU.sdrySeal, SKU.sdrySealTrowel]);
  const thinned = adaptBookRows(live).filter((r) => !gone.has(r.us));
  assert.ok(thinned.length < 151, "guard: the book really lost rows");

  setStockSource(thinned);
  // The three consumable codes fall through to their pricelist twins, so the
  // lines survive — as special-order rows. That is correct, and it is the
  // reason this is not a live crash.
  const thin = figureConsumables(100, "sausage");
  assert.equal(thin.lines.every((l) => l.item), true, "no consumable line carries a null item");
  assert.equal(thin.lines.every((l) => l.item.stock === false), true,
    "and they resolved through WEDI_SO, not the book");

  assert.doesNotThrow(() => kitFor("US9100004"), "the kit still builds");
  assert.equal(kitFor("US9100004").lines.every((l) => l.item), true,
    "no kit line carries a null item");
  clearStockSource();
});
