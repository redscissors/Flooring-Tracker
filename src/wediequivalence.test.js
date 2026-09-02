import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem, bookItemData } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";
import { adaptBookRows, adaptSoRows } from "./wediadapter.js";
import { catalog, setStockSource, clearStockSource, kitFor, solve, figureConsumables, SKU,
  setSoSource, clearSoSource, missingRequiredParts, item } from "./wedi.js";
import { parseMapped } from "./pricebook.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";

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

// ---- the pricelist half (spec 2026-09-02, 8b) --------------------------------

const liveSo = () => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
};
const liveStock = () => FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const clearBoth = () => { clearStockSource(); clearSoSource(); };
const byKey = (list) => Object.fromEntries(list.map((e) => [e.key, e]));

// The stock half compares DERIVED (desc excluded, see above). The pricelist
// half adds the four fields that come straight off a soRow and ARE
// byte-reproducible — the measurement walk found zero drift on them.
const SO_DERIVED = [...DERIVED, "section", "size", "soRetail", "soNet"];
const pickSo = (e) => Object.fromEntries(SO_DERIVED.map((k) => [k, e[k]]));

// Spec decision 9: where the parser deliberately differs from the
// transcription, measured row by row. `details` on ten rows — eight where
// the sheet's captioned "Additional Details" column carries text the
// transcription's fixed column 4 never saw, two where the transcription
// hand-edited the sheet's wording. One of the eight moves a derived field:
// unitOf() reads "per box", so the sausage gun becomes BX. Anything not in
// this table that differs is a parser bug.
const PINNED_DETAILS = {
  US5000085: "1 Kit",
  US5000013: "12 per case, full cases only",
  US5000088: "12 per case, full cases only",
  US5000010: "20 per case, full cases only",
  US5000083: "20 per case, full cases only",
  US5000019: "1 per box",
  US5000020: "sold in increments of 10 pcs.",
  US5000044: "25 pcs/case, full cases only",
  US3000001: "Suspended Seat",
  US3000002: "Suspended Seat",
};
const PINNED_UNIT = { US5000019: "BX" };

// The S-Dry parts the engine never priced from a pricelist. 32 of the 36 are
// stocked (they twin a WEDI_STOCK entry — see the twinning test below); these
// four are the only new special-order entries.
const NEW_SO_ONLY = ["US8076001", "US9476013", "US9476014", "US9476015"];

test("pricelist half: the book-fed special-order entries equal the transcribed ones, entry for entry", () => {
  clearBoth();
  const fromTable = catalog().filter((e) => !e.stock);
  assert.equal(fromTable.length, 118, "118 special-order-only entries from the table");

  setSoSource(adaptSoRows(liveSo()));
  const fromBook = byKey(catalog().filter((e) => !e.stock));
  clearBoth();

  assert.deepEqual(Object.keys(fromBook).filter((k) => !fromTable.some((e) => e.key === k)).sort(), NEW_SO_ONLY.slice().sort(),
    "the only additions are the four S-Dry parts the shop does not stock");

  const expected = fromTable.map((e) => {
    const x = pickSo(e);
    if (PINNED_UNIT[e.key]) x.unit = PINNED_UNIT[e.key];
    return x;
  });
  const actual = fromTable.map((e) => pickSo(fromBook[e.key]));
  assert.deepEqual(actual, expected);

  // details, separately, against the allow-list
  for (const e of fromTable) {
    const want = e.key in PINNED_DETAILS ? PINNED_DETAILS[e.key] : e.details;
    assert.equal(fromBook[e.key].details, want, `details on ${e.key}`);
  }
});

test("pricelist half: every entry classifies with both books installed — nothing falls into misc", () => {
  clearBoth();
  setStockSource(adaptBookRows(liveStock()));
  setSoSource(adaptSoRows(liveSo()));
  const all = catalog();
  assert.equal(all.length, 273, "151 stock + 122 special order");
  assert.deepEqual(all.filter((e) => e.group === "misc").map((e) => e.us + " " + e.name), []);
  // The S-Dry line files under its own section by classify's existing rule.
  const sdry = all.filter((e) => /^US\d\d76\d{3}$/.test(e.us));
  assert.ok(sdry.length >= 36, "guard: the S-Dry codes are in the catalog");
  assert.equal(sdry.every((e) => e.group === "sdry" || (e.group === "pan" && e.sub === "sdry")), true);
  clearBoth();
});

// Spec decision 8, measured: 34 stock entries — the two SS27/SS43 linear
// cover frames and 32 S-Dry parts the shop stocks — gain a pricelist twin
// they never had, and makeEntry names a twinned entry from the pricelist.
// Every OTHER stock entry is identical to the table on every derived field.
// The twinned 34 may differ ONLY in the fields a soRow feeds. A difference in
// any other field (w, d, t, drain, channel, cost, retail…) is a finding to
// report to the owner, never a key to add to this list.
const NEW_TWINS = ["676800061", "676800064",
  "US5076009", "US5076008", "US9176001", "US9176002", "US9176003", "US9176004",
  "US2076001", "US2076002", "US3076003", "US3076001", "US3076002",
  "US1076002", "US1076006", "US1076001", "US1076003", "US1076005", "US1076007", "US1076004", "US1076008",
  "US9476016", "US9476011", "US9476012", "US9476006",
  "US5076011", "US5076010", "US5076007", "US5076002", "US5076001", "US5076005", "US5076004", "US5076003", "US5076006"];
const TWIN_MAY_DIFFER = new Set(["name", "section", "size", "details", "soRetail", "soNet", "sizeText"]);

// Spec decision 9, measured (fix round 1): 9 of PINNED_DETAILS' keys are ALSO
// existing stock+SO twins from BEFORE 8b (via the WEDI_SO fallback table),
// not new under decision 8 — swapping that fallback for the live book surfaces
// the same transcription difference on their `details` (and, where the entry
// carries no dimensions of its own, `sizeText`, which derives from details).
const PINNED_DETAILS_STOCK_KEYS = ["US3000001", "US3000002", "US5000010", "US5000013",
  "US5000019", "US5000020", "US5000044", "US5000083", "US5000085"];

// The closed key set: NEW_TWINS (decision 8) plus PINNED_DETAILS_STOCK_KEYS
// (decision 9) — the only stock entries a soRow is allowed to change at all.
const ALL_CHANGED_KEYS = [...NEW_TWINS, ...PINNED_DETAILS_STOCK_KEYS];

// Spec decision 8, measured (fix round 1): 13 of the 34 NEW_TWINS keys had NO
// dimensions at all before their pricelist twin arrived — the stock table
// alone gives makeEntry nothing to parse w/d/t out of — and gain them here,
// null -> the exact value below (copied verbatim from the measurement, not
// rounded). Two parse sources, left as measured, never "fixed": US5076011's
// size cell reads "...Powder - 2 x 16 oz. bags..." -> w:2, d:16; the S-Dry
// drain covers' size cells carry wedi's own typo `3/3/4"` -> d:1.
const GEOMETRY_GAINS = {
  "676800061": { w: 28, d: 2.5625, t: 0.25 },
  "676800064": { w: 43.78125, d: 2.5625, t: 0.25 },
  US3076001: { w: 4.5, d: 72, t: 3.5 },
  US3076002: { w: 3.5, d: 72, t: 2 },
  US1076001: { w: 3.75, d: 1 },
  US1076002: { w: 3.75, d: 1 },
  US1076003: { w: 3.75, d: 1 },
  US1076004: { w: 3.75, d: 1 },
  US1076005: { w: 3.75, d: 1 },
  US1076006: { w: 3.75, d: 1 },
  US1076007: { w: 3.75, d: 1 },
  US1076008: { w: 3.75, d: 1 },
  US5076011: { w: 2, d: 16 },
};
const GEO_FIELDS = ["w", "d", "t", "len", "sf", "channel"];

// Spec decision 8, measured (fix round 2): US3076003 is the one exception —
// makeEntry's "extension" branch normalizes orientation for every S-Dry
// extension ("the two sheets print these both ways round…, so normalize: w
// is the run, d the depth it adds" — wedi.js's own comment on that branch),
// and the entry classifies "sdry", so the solver never reads its w/d. The
// swap is a display convention, not a measurement moving — kept OUT of
// GEOMETRY_GAINS on purpose; any OTHER non-null geometry change still fails.
const GEOMETRY_TRANSPOSED = {
  US3076003: { before: { w: 24, d: 48 }, after: { w: 48, d: 24 } },
};

test("stock half: with both books installed, only the 34 newly twinned entries change, and only where a soRow feeds them", () => {
  clearBoth();
  setStockSource(adaptBookRows(liveStock()));
  const stockOnly = byKey(catalog().filter((e) => e.stock));
  setSoSource(adaptSoRows(liveSo()));
  const both = byKey(catalog().filter((e) => e.stock));
  clearBoth();

  assert.deepEqual(Object.keys(both).sort(), Object.keys(stockOnly).sort(), "the stock half has the same keys");
  const FIELDS = [...SO_DERIVED, "details"];
  const changed = [];
  for (const k of Object.keys(stockOnly)) {
    const diff = FIELDS.filter((f) => JSON.stringify(stockOnly[k][f]) !== JSON.stringify(both[k][f]));
    if (diff.length) changed.push([k, diff]);
  }
  assert.deepEqual(changed.map(([k]) => k).sort(), ALL_CHANGED_KEYS.slice().sort(),
    "exactly the pinned keys changed: 34 new twins (decision 8) + 9 pre-existing stock twins whose details text differs (decision 9)");

  for (const [k, diff] of changed) {
    if (PINNED_DETAILS_STOCK_KEYS.includes(k)) {
      const allowed = new Set(["details"]);
      if (both[k].w == null && both[k].d == null) allowed.add("sizeText");
      const outside = diff.filter((f) => !allowed.has(f));
      assert.deepEqual(outside, [], `${k} changed outside details/sizeText: ${outside.join(", ")} — report this, do not allow-list it`);
      assert.equal(both[k].details, PINNED_DETAILS[k], `details on ${k}`);
      continue;
    }

    // k is a NEW_TWINS key: TWIN_MAY_DIFFER as before, plus geometry fields —
    // but only where a field genuinely GAINED a value (null -> non-null).
    const outside = diff.filter((f) => !TWIN_MAY_DIFFER.has(f) && !GEO_FIELDS.includes(f));
    assert.deepEqual(outside, [], `${k} changed outside the soRow-fed fields: ${outside.join(", ")} — report this, do not allow-list it`);

    const geoDiff = diff.filter((f) => GEO_FIELDS.includes(f));
    if (!geoDiff.length) continue;

    if (GEOMETRY_TRANSPOSED[k]) {
      const { before, after } = GEOMETRY_TRANSPOSED[k];
      const outsideTransposed = geoDiff.filter((f) => !(f in before));
      assert.deepEqual(outsideTransposed, [], `${k} changed geometry (${outsideTransposed.join(", ")}) outside the pinned GEOMETRY_TRANSPOSED fields — report this, do not allow-list it`);
      for (const f of Object.keys(before)) {
        assert.equal(stockOnly[k][f], before[f], `${k}.${f} before-value does not match the pinned GEOMETRY_TRANSPOSED measurement`);
        assert.equal(both[k][f], after[f], `${k}.${f} after-value does not match the pinned GEOMETRY_TRANSPOSED measurement`);
      }
      const sortedBefore = Object.keys(before).map((f) => before[f]).sort((a, b) => a - b);
      const sortedAfter = Object.keys(before).map((f) => after[f]).sort((a, b) => a - b);
      assert.deepEqual(sortedAfter, sortedBefore, `${k}'s transposed fields are not the same two numbers swapped — report this`);
      continue;
    }

    const gains = GEOMETRY_GAINS[k];
    assert.ok(gains, `${k} changed geometry (${geoDiff.join(", ")}) but is not in GEOMETRY_GAINS — report this, do not allow-list it`);
    for (const f of geoDiff) {
      assert.equal(stockOnly[k][f], null, `${k}.${f} was not null before the twin arrived — a non-null value changed to a different value, report this`);
      assert.equal(both[k][f], gains[f], `${k}.${f}'s after-value does not match the pinned GEOMETRY_GAINS measurement`);
    }
  }
});

test("the pinned engine totals do not move with BOTH books feeding the catalog", () => {
  const INPUT = { w: 36, d: 60, curb: "curbed", drain: "any" };
  // `details` is decision 9's pinned text on two consumable items in this
  // kit (US5000010 sausage, US5000044 trowel) — not a price or a quantity.
  // `sizeText` derives from `details` on the trowel (it has no dimensions of
  // its own), so it's decision 9's text too. Strip both beside `desc`; every
  // price, quantity, key and w/d/t in the trees is still deep-compared.
  const stripVolatile = (v) => {
    if (Array.isArray(v)) return v.map(stripVolatile);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "desc" && k !== "details" && k !== "sizeText").map(([k, x]) => [k, stripVolatile(x)]));
    }
    return v;
  };
  clearBoth();
  const beforeKit = stripVolatile(kitFor("US9100004")), beforeSol = stripVolatile(solve(INPUT));
  assert.ok(beforeKit && beforeKit.lines.length, "guard: a kit was built");
  setStockSource(adaptBookRows(liveStock()));
  setSoSource(adaptSoRows(liveSo()));
  const afterKit = stripVolatile(kitFor("US9100004")), afterSol = stripVolatile(solve(INPUT));
  clearBoth();
  assert.deepEqual(afterKit, beforeKit, "kitFor is unchanged");
  assert.deepEqual(afterSol, beforeSol, "solve is unchanged");
});
