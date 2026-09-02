import test from "node:test";
import assert from "node:assert/strict";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { isWediPricelist, parseWediSheet, parseWediPricelist, WEDI_PRICELIST_MAPPING, WEDI_PRICELIST_SHEETS } from "./wedibook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";

test("fixture: the five-sheet snapshot, blank rows dropped, nothing interpreted", () => {
  assert.deepEqual(PRICELIST_SHEETS.map((s) => s.name),
    ["wedi Fundo", "wedi S-Dry", "wedi Builder Choice", "Wellness and Spa", "New Product Data"]);
  assert.deepEqual(PRICELIST_SHEETS.map((s) => s.rows.length), [301, 79, 48, 99, 75]);
  // A raw grid: the title line is still there, uninterpreted.
  assert.match(String(PRICELIST_SHEETS[0].rows[0][1]), /^wedi Distribution Pricelist 2026/);
  // Numbers stayed numbers (the parser reads prices by type, not by parsing text).
  assert.equal(typeof PRICELIST_SHEETS[0].rows[5][6], "number");
});

const sheet = (name) => PRICELIST_SHEETS.find((s) => s.name === name);

test("isWediPricelist: the workbook is recognised by its Fundo title line, and nothing else is", () => {
  assert.equal(isWediPricelist(PRICELIST_SHEETS), true);
  // The 8a stock export (a Vendor SKU Analysis sheet) is NOT a pricelist.
  assert.equal(isWediPricelist([{ name: "Vendor SKU Analysis", rows: [["Product Code", "Full Description"], ["47832", "Wedi Washer"]] }]), false);
  // A renamed Fundo sheet is not recognised either — by design (spec decision 1: a re-format fails loudly).
  assert.equal(isWediPricelist(PRICELIST_SHEETS.map((s) => ({ ...s, name: s.name === "wedi Fundo" ? "Fundo" : s.name }))), false);
  assert.equal(isWediPricelist([]), false);
  assert.equal(isWediPricelist(null), false);
});

test("parseWediSheet: Fundo yields 225 sectioned, priced rows; S-Dry 37", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  assert.equal(f.items.length, 225);
  assert.deepEqual(f.warnings, []);
  assert.equal(f.items.filter((r) => !r.section).length, 0, "every row carries a section");
  assert.equal(f.items.filter((r) => !(r.retail > 0) || !(r.net > 0)).length, 0, "every row is priced");
  const s = parseWediSheet(sheet("wedi S-Dry").rows, "wedi S-Dry");
  assert.equal(s.items.length, 37);
  assert.equal(s.items.filter((r) => !r.section).length, 0);
});

test("parseWediSheet: one row, field by field, against the transcribed contract", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  const panel = f.items.find((r) => r.us === "US8000006");
  assert.deepEqual(panel, {
    us: "US8000006",
    name: 'wedi® Building Panel 24"x48"x1/8"',
    size: "Waterproof Tile Backer Board",
    details: "10 sheets/box",
    retail: 35.0069383125,          // raw sheet number — parseMapped rounds to 2 dp downstream
    net: 21.21632625,
    section: "WEDI BUILDING PANELS",
    discount: 50,                   // the caption's "(less 50%)" — NOT round(1 - net/retail) = 39
    erp: "29952",                   // Fundo's "Stock SkUS" column
  });
});

test("parseWediSheet: the footnote asterisk is stripped from a part number", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  assert.ok(f.items.some((r) => r.us === "US3000042"), "US3000042* parses as US3000042");
  assert.ok(f.items.some((r) => r.us === "US3000043"));
  assert.equal(f.items.filter((r) => /\*/.test(r.us)).length, 0);
});

test("parseWediSheet: size and details follow the section's captions, with the measured fallbacks", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  const by = Object.fromEntries(f.items.map((r) => [r.us, r]));
  // "Product Information" is the size column in the accessories block.
  assert.match(by.US1000057.size, /^Drain cover and frame made from stainless steel/);
  // No size caption at all (Pro-Systems): the cell two right of the part number.
  assert.equal(by.US5076012.size, "25 lbs. Bag - 100 bags per pallet - Full Pallets Only");
  // The captioned "Additional Details" column wins when it has text…
  assert.equal(by.US5000085.details, "1 Kit");
  // …and the cell right of the size column stands in when it is empty (joint sealant block).
  assert.equal(by.US5000070.details, "*count determined by weight, actual count may vary");
  // The one doubled unit in the sheet is collapsed.
  assert.equal(by.US3000000.size, "47 1/4 in. x 15 in. x 3 1/8 in.");
});

test("parseWediSheet: kit-note and terms rows are skipped, section titles are not rows", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  assert.equal(f.items.filter((r) => /^\*Contains/.test(r.name)).length, 0);
  assert.equal(f.items.filter((r) => /Payment terms|Minimum Advertised/.test(r.name)).length, 0);
  assert.equal(new Set(f.items.map((r) => r.section)).size, 29, "29 distinct Fundo sections, as WEDI_SO has");
});

test("parseWediPricelist: the canonical sheet — 261 rows, Fundo wins the one cross-sheet duplicate", () => {
  const out = parseWediPricelist(PRICELIST_SHEETS, "wedi pricelist");
  assert.ok(out, "recognised");
  assert.equal(out.name, "wedi pricelist");
  assert.deepEqual(out.mapping, WEDI_PRICELIST_MAPPING);
  assert.equal(out.meta.items, 261);
  assert.equal(out.rows.length, 262, "header + 261");
  assert.deepEqual(out.rows[0], ["Part Number", "Product", "Size", "Details", "Retail", "Distributor net", "Section", "Stock SKU", "Discount %"]);
  const skus = out.rows.slice(1).map((r) => r[0]);
  assert.equal(new Set(skus).size, 261, "no duplicate part numbers");
  assert.equal(skus.filter((k) => k === "US5076012").length, 1);
  const adhesive = out.rows.find((r) => r[0] === "US5076012");
  assert.equal(adhesive[4], 21.054, "Fundo's retail, not S-Dry's 22");
  assert.ok(out.warnings.some((w) => /US5076012 is priced on both/.test(w)), "the disagreement is named");
  assert.ok(out.warnings.some((w) => /Skipped sheets not in scope: wedi Builder Choice, Wellness and Spa, New Product Data/.test(w)));
});

test("parseWediPricelist: a workbook that is not a wedi pricelist returns null; a renamed in-scope sheet yields a warning, not garbage", () => {
  assert.equal(parseWediPricelist([{ name: "Vendor SKU Analysis", rows: [["Product Code"], ["47832"]] }]), null);
  const renamed = PRICELIST_SHEETS.map((s) => (s.name === "wedi S-Dry" ? { ...s, name: "S-Dry 2026" } : s));
  const out = parseWediPricelist(renamed);
  assert.equal(out.meta.items, 225, "Fundo only");
  assert.ok(out.warnings.some((w) => /Sheet "wedi S-Dry" not found/.test(w)));
});

test("WEDI_PRICELIST_SHEETS names exactly the two in-scope sheets", () => {
  assert.deepEqual(WEDI_PRICELIST_SHEETS, ["wedi Fundo", "wedi S-Dry"]);
});

test("the 8a stock fixture is not mistaken for a pricelist row source", () => {
  // Guard against a future detector loosening: 8a's rows are price_book_items, not sheets.
  assert.equal(isWediPricelist(FIXTURE_ROWS), false);
});
