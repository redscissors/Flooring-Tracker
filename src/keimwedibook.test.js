import { test } from "node:test";
import assert from "node:assert/strict";
import { isKeimWediSheet, parseKeimWedi, ceilCents } from "./keimwedibook.js";
import { parseMapped } from "./pricebook.js";

// The Keim wedi sheet as readXlsxSheets hands it over (defval null): a blank
// first column, the account line, a title, the header, section rows, product
// rows; the same shape on the S-Dry tab; Contractor tabs beside them.
const head = (title) => [
  ["V3926", "Keim Lumber 4465 State Rte. 557  Charm, OH  44617    330.893.2251"],
  [],
  [null, title],
  [null, "SKU", "Description", "Mfg SKU", "U/M", "Retail Price", "Notes"],
];
const SHEETS = [
  { name: "Retail", rows: [
    ...head("WEDI SHOWER SYSTEM- RETAIL PRICING***"),
    [null, "Shower Pans square Drain", null, null, null, null, "Do not use mastic on Wedi "],
    [null, 1504153, "3'x3' Wedi Fundo Shower Pan", "US9100001", "EA", 378.1802178],
    [null, 1503638, '11-7/8"x3.5" Niche Glass Shelf', "US3000050", "EA", 127.82358001874998],
    [null, "Joint Sealant"],
    [null, 28866, "10oz Wedi Joint Sealant 620 ", "US5000088", "EA", 29.738137275, "DISC"],
  ] },
  { name: "Contractor", rows: [
    ...head("WEDI SHOWER SYSTEM-*** Contractor Pricing***"),
    [null, 1504153, "3'x3' Wedi Fundo Shower Pan", "US9100001", "EA", 310.10777859599995],
  ] },
  { name: "Wedi S-Dry Retail", rows: [
    ...head("WEDI S-Dry"),
    [null, "Accessories"],
    [null, 1518099, '3/16"x5/32" Wedi S-Dry Seal Trowel US5076010', "US5076010", null, 4],
    [null, 1518092, "Wedi S-Dry 135° Inside Corner 2 per/bg US5076001", "US5076001", "EA", 17],
    [null, 1518092, "Wedi S-Dry 135° Inside Corner 2 per/bg US5076001", "US5076001", "EA", 17],
  ] },
  { name: "Wedi S-Dry Contractor", rows: [...head("WEDI S-Dry")] },
];

test("detects the Keim wedi sheet by its account line and wedi title", () => {
  assert.equal(isKeimWediSheet(SHEETS), true);
  assert.equal(isKeimWediSheet([{ name: "Retail", rows: [["Some other vendor"], [null, "SKU", "Description"]] }]), false);
  assert.equal(isKeimWediSheet([{ name: "wedi Fundo", rows: [["wedi Distribution Pricelist 2026"]] }]), false);
  assert.equal(isKeimWediSheet(null), false);
});

test("the shop rounds retail UP to the cent", () => {
  assert.equal(ceilCents(378.1802178), 378.19);
  assert.equal(ceilCents(504.52104779999996), 504.53);
  assert.equal(ceilCents(22), 22);
  assert.equal(ceilCents(54.66), 54.66);
});

test("parses the two Retail tabs only, keyed by shop SKU, sections carried", () => {
  const p = parseKeimWedi(SHEETS, "Keim wedi");
  assert.equal(p.priceUpdate, true);
  const { items } = parseMapped(p.rows, p.mapping);
  assert.deepEqual(items.map((it) => it.sku), ["1504153", "1503638", "28866", "1518099", "1518092"]);
  const pan = items[0];
  assert.equal(pan.price, 378.19);
  assert.deepEqual(pan.vendorSkus, ["US9100001"]);
  assert.equal(pan.section, "Shower Pans square Drain");
  assert.equal(items[2].section, "Joint Sealant");
  assert.equal(items.find((it) => it.sku === "1518099").price, 4);
  assert.ok(p.warnings.some((w) => /Contractor/.test(w) && /skipped/i.test(w)));
  assert.ok(!p.warnings.some((w) => /1518092/.test(w)), "an identical repeat is silent");
});

test("a SKU listed twice at two prices keeps the first and says so", () => {
  const two = SHEETS.map((sh) => sh.name !== "Wedi S-Dry Retail" ? sh
    : { ...sh, rows: [...sh.rows, [null, 1518099, "Trowel again", "US5076010", "EA", 5]] });
  const p = parseKeimWedi(two);
  assert.ok(p.warnings.some((w) => /1518099/.test(w) && /\$4/.test(w) && /\$5/.test(w)));
  const { items } = parseMapped(p.rows, p.mapping);
  assert.equal(items.find((it) => it.sku === "1518099").price, 4);
});

test("not the Keim sheet → null (the wizard falls through)", () => {
  assert.equal(parseKeimWedi([{ name: "Sheet1", rows: [["a", "b"]] }]), null);
});

test("today's Keim sheet onto the 2026-09-01 wedi stock snapshot: one price moves, one SKU adds, nothing retires, costs stay", async () => {
  const { KEIM_SHEETS } = await import("./keimwedifixture.js");
  const { FIXTURE_ROWS } = await import("./wedifixture.js");
  const { normBookItem, priceUpdateBundle, diffBookItems } = await import("./orderbook.js");
  const existing = FIXTURE_ROWS.map((r) => normBookItem(r, "bk"));
  const p = parseKeimWedi(KEIM_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  const { items: bundle, retired } = priceUpdateBundle(existing, items);
  const d = diffBookItems(existing, bundle);
  assert.deepEqual(retired, []);
  // the glass shelf typo (the sheet carries the 4x5x2" panel's price) — the
  // owner fixes the sheet; the import just shows it
  assert.deepEqual(d.changed.map((c) => [c.item.sku, c.fields, c.prev.price, c.item.price]), [["1503638", ["price"], 37.06, 127.83]]);
  assert.equal(d.changed[0].item.cost, d.changed[0].prev.cost);
  assert.deepEqual(d.added.map((it) => it.sku), ["28866"]);
  assert.equal(d.missing.length, 0);
});
