import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";
import { usOf, descOf, adaptRow, adaptBookRows } from "./wediadapter.js";
import { dims } from "./wedi.js";

const live = () => FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));

test("fixture: 152 persisted rows, the whole export including the placeholder", () => {
  assert.equal(FIXTURE_ROWS.length, 152);
  assert.equal(FIXTURE_ROWS.every((r) => r.active === true && r.data), true);
});

test("fixture: normBookItem rehydrates the shape the adapter will see", () => {
  const washer = live().find((r) => r.sku === "47832");
  assert.deepEqual(washer.vendorSkus, ["US5000009"]);
  assert.equal(washer.unit, "BX");
  assert.equal(washer.cost, 93.42);
  assert.equal(washer.price, 154.14);
  assert.equal(washer.bookId, "bk_wedi");
  // vendorSkus is sorted+deduped by normFits — column order does NOT survive
  assert.deepEqual(live().find((r) => r.sku === "29075").vendorSkus, ["075100050", "US9330001"]);
  // the shop's own code can appear in vendorSkus and must be excluded by usOf
  assert.deepEqual(live().find((r) => r.sku === "47815").vendorSkus, ["095225053", "47815"]);
});

test("usOf: a US-shaped code beats a numeric article number, whatever the sort order", () => {
  // 29075 carries an article number and the real US-SKU; normFits sorted them
  const r = live().find((x) => x.sku === "29075");
  assert.equal(usOf(r), "US9330001");
});

test("usOf: the shop's own Product Code is never the vendor's code", () => {
  // 47815 repeats its own sku in a vendor column; the article number must win
  assert.equal(usOf(live().find((x) => x.sku === "47815")), "095225053");
});

test("usOf: the ten-digit Subliner code is preserved, NOT corrected", () => {
  // WEDI_STOCK holds us:"US50000005" and wedi.js:4331 compensates for it.
  // A fixup table here would silently re-key the entry and break item() lookups.
  assert.equal(usOf(live().find((x) => x.sku === "28954")), "US50000005");
});

test("usOf: the custom-item placeholder derives nothing and is dropped", () => {
  const placeholder = live().find((x) => x.sku === "29WEDIT");
  assert.equal(usOf(placeholder), "");
  assert.equal(adaptRow(placeholder), null);
});

test("adaptRow: one live row to the six-field stockRow shape", () => {
  const e = adaptRow(live().find((x) => x.sku === "47832"));
  assert.deepEqual(Object.keys(e).sort(), ["cost", "desc", "erp", "retail", "unit", "us"]);
  assert.equal(e.erp, "47832");
  assert.equal(e.us, "US5000009");
  assert.equal(e.cost, 93.42);
  assert.equal(e.retail, 154.14);
  assert.equal(e.unit, "BX");
});

test("adaptBookRows: 152 in, 151 out — only the placeholder drops", () => {
  const out = adaptBookRows(live());
  assert.equal(out.length, 151);
  assert.equal(out.some((r) => r.erp === "29WEDIT"), false);
  assert.equal(out.every((r) => r.us), true);
});

test("descOf: the dimensions the importer moved to size/thickness come back inline", () => {
  // 47815: table desc is "5\"x82' Wedi Mesh Tape - …"; the importer left
  // "Wedi Mesh Tape - …" with size "5\"x82'"
  assert.match(descOf(live().find((x) => x.sku === "47815")), /5"x82'/);
  // 47700: a panel — width, depth AND thickness all have to survive
  const panel = descOf(live().find((x) => x.sku === "47700"));
  assert.match(panel, /3'/);
  assert.match(panel, /5'/);
  assert.match(panel, /1\/2"/);
});

test("descOf: a row's sfPerUnit coverage comes back in a form makeEntry's sf regex matches", () => {
  // 28954 carries sfPerUnit 322 (the importer split it out of the
  // description); wedi.js:4296-4298 matches /(\d+)\s*(?:sft|sf|ft2)\b/i
  // against desc to derive e.sf, so the figure has to survive the round trip.
  const d = descOf(live().find((x) => x.sku === "28954"));
  assert.match(d, /(\d+)\s*(?:sft|sf|ft2)\b/i);
  assert.equal(d.match(/(\d+)\s*(?:sft|sf|ft2)\b/i)[1], "322");
});

// ---------------------------------------------------------------------------
// descOf's two reconstruction heuristics, as unit contracts.
//
// The 151-row equivalence pin (wediequivalence.test.js) proves these are right
// for TODAY's export. descOf runs on every future one, so the rules are pinned
// directly too — synthetic rows, because these are contracts about the rule,
// not facts about the fixture.
// ---------------------------------------------------------------------------

test("descOf/sizeOf: an all-integer bare size stays bare — dims() owns the feet-or-inches call", () => {
  // The importer renders an unmarked L×W as bare decimals, and dims() reads a
  // wholly unit-less group as FEET when every value is ≤ 12. The 4x8 vapor
  // sheet depends on that: marking it would shrink a 4'x8' panel to 4"x8".
  const d = descOf({ size: "4x8", description: "Wedi Vapor 85 - Vaporproof Building Panel" });
  assert.equal(d, "4x8 Wedi Vapor 85 - Vaporproof Building Panel");
  assert.deepEqual(dims(d), [48, 96]);
  // Bigger integers are unambiguous either way and are still left alone.
  assert.equal(descOf({ size: "24x48", description: "Wedi Pan Extension" }), "24x48 Wedi Pan Extension");
});

test("descOf/sizeOf: a non-integer bare size gets its fraction and inch mark back", () => {
  // dimVal flattens the sheet's fraction to a decimal and drops the marks. A
  // fractional dimension is never feet, so restoring both is unambiguous —
  // and necessary: left bare, dims() sees 0.1875 ≤ 12 and reads FEET.
  assert.deepEqual(dims("0.1875x0.15625 Wedi S-Dry Seal Trowel"), [2.25, 1.875]);
  const d = descOf({ size: "0.1875x0.15625", description: "Wedi S-Dry Seal Trowel" });
  assert.equal(d, '3/16"x5/32" Wedi S-Dry Seal Trowel');
  assert.deepEqual(dims(d), [0.1875, 0.15625]);
  // A mixed number is hyphenated the way both sheets print one.
  assert.equal(descOf({ size: "32x5.75", description: "Wedi Riolito Neo" }), '32"x5-3/4" Wedi Riolito Neo');
});

test("descOf: a lone dangling hyphen takes the lifted fraction back, wherever it sits", () => {
  // splitSizeFromDescription lifts the first inch-marked fraction ANYWHERE, so
  // it is not always the size's third dimension. Trailing site:
  const chan = descOf({ size: "32x5.75", thickness: '1/2"', description: "Wedi Riolito Neo - Drain Channel 27-" });
  assert.equal(chan, '32"x5-3/4" Wedi Riolito Neo - Drain Channel 27-1/2"');
  // …and the channel length must NOT come back as a third dimension.
  assert.deepEqual(dims(chan), [32, 5.75]);
  // Mid-string site — a slope range, not a thickness:
  const ext = descOf({ size: "24x48", thickness: '1/2"', description: 'Wedi Pan Extension - 073783528 1- to 2" slope' });
  assert.equal(ext, '24x48 Wedi Pan Extension - 073783528 1-1/2" to 2" slope');
  assert.deepEqual(dims(ext), [24, 48]);
});

test("descOf: an AMBIGUOUS residue does not reattach — the thickness stays in the lead", () => {
  // Two dangling hyphens and no way to tell which one the fraction came out
  // of. Guessing would move a genuine board thickness into the display string
  // and drop `t` (and sizeText with it) — so the rule bails to the older,
  // known lead-thickness behavior instead.
  const d = descOf({ size: "4'x8'", thickness: '1/2"', description: "Wedi Building Panel - Type 3- and Type 7- runs" });
  assert.equal(d, `4'x8'x1/2" Wedi Building Panel - Type 3- and Type 7- runs`);
  // The thickness survives as a real third dimension, which is the whole point.
  assert.deepEqual(dims(d), [48, 96, 0.5]);
  // And nothing was silently glued to either candidate.
  assert.equal(/3-1\/2|7-1\/2/.test(d), false);
});

test("descOf: the reattached thickness is inserted literally, never as a replacement pattern", () => {
  // `thick` is data off a vendor row. Through String.replace's replacement
  // string a "$" in it would be read as a group reference; the rule uses a
  // replace function so it cannot be.
  assert.equal(descOf({ thickness: "$&", description: "Widget 1-" }), "Widget 1-$&");
  assert.equal(descOf({ thickness: "$1", description: "Widget 1-" }), "Widget 1-$1");
});

test("usOf: with no US-shaped code the fallback is POSITIONAL, and normFits is what makes it stable", () => {
  // The US-shaped preference is order-independent, so a row with one such code
  // is deterministic whatever the array order:
  assert.equal(usOf({ sku: "12345", vendorSkus: ["073736517", "US9330001"] }), "US9330001");
  assert.equal(usOf({ sku: "12345", vendorSkus: ["US9330001", "073736517"] }), "US9330001");

  // But when NEITHER candidate is US-shaped the rule takes codes[0] as given.
  // It is only stable in production because normFits sorted vendorSkus before
  // the row ever got here — the determinism is INHERITED, not intrinsic:
  assert.equal(usOf({ sku: "12345", vendorSkus: ["073736517", "095225053"] }), "073736517");
  assert.equal(usOf({ sku: "12345", vendorSkus: ["095225053", "073736517"] }), "095225053");

  // No row in today's export has two non-US candidates — measured, 0 of 151 —
  // so nothing exercises this path yet. A future export with two article
  // numbers on one row would key on whichever sorts first, silently. Pinned
  // here so that is a decision on the record rather than a discovery.
});

test("descOf: a size inch() cannot represent keeps its own digits", () => {
  // inch() rounds to the nearest 64th, so spelling a value it cannot hold
  // would CHANGE it — 0.3 would come back 19/64 = 0.296875 — in a file whose
  // contract is zero drift. Representable values still spell.
  assert.match(descOf({ size: "0.5x8.5", description: "Widget" }), /1\/2"x8-1\/2"/);
  assert.match(descOf({ size: "0.3x8.5", description: "Widget" }), /0\.3/);
  assert.doesNotMatch(descOf({ size: "0.3x8.5", description: "Widget" }), /19\/64/);
});
