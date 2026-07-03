import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePriceBook } from "./pricebook.js";

const sheet = (name, rows) => ({ name, rows });
const parse = (...sheets) => parsePriceBook(sheets);
const bySku = (items, sku) => items.find((i) => i.sku === sku);

// --- generic sectioned tables --------------------------------------------------

test("table sheet: sections, header mapping, sidebar Index column ignored", () => {
  const { items } = parse(sheet("Hardwood", [
    ["Unfinished Hardwood Flooring"],
    ["Sheoga"],
    ["", "SKU", "Thickness", "Width", "Description", "", "SF/CT", "Retail ", "SF Price", "Notes", "", "", "Index"],
    ["", "05068", 0.75, '2-1/4"', "Clear Red Oak", "", 22, 94.38, 4.29, "", "", "", "Unfinished", "Hardwood!A2"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "Sheoga"],
    ["Mirage-Solid"],
    ["", "SKU", "Thickness", "Width", "Description", "", "SF/CT", "Retail ", "SF Price", "Notes"],
    ["", "29258", '3/4"', '3-1/4"', "Red Oak Natural", "", 20, 139.8, 6.99, "DISC"],
  ]));
  assert.equal(items.length, 2);
  const oak = bySku(items, "05068");
  assert.equal(oak.section, "Sheoga");
  assert.equal(oak.type, "hardwood");
  assert.equal(oak.size, '2-1/4"');
  assert.equal(oak.thickness, "0.75");
  assert.equal(oak.price, 94.38);
  assert.equal(oak.priceSqft, 4.29);
  assert.equal(oak.sfPerUnit, 22);
  assert.equal(oak.discontinued, false);
  assert.equal(oak.description, "Clear Red Oak"); // sidebar text not absorbed
  const mirage = bySku(items, "29258");
  assert.equal(mirage.section, "Mirage-Solid");
  assert.equal(mirage.discontinued, true);
});

test("table sheet: DISC marker in a headerless column, color carry-down, extra text kept", () => {
  const { items } = parse(sheet("Vinyl", [
    ["Floating Floors "],
    ["SKU", "Description", "", "", "", "SF/CT", "Price", "Price / SF"],
    ["1507639", "Metroflor Inception", "", "", "", 21.45, 71.88, 3.351, "Disc"],
    [],
    ['90" Metroflor Trims'],
    ["SKU", "Color", "Part #", "Desc", "Price"],
    ["", "Swing Oak"],
    ["1510297", "", "ARF97", "Reducer", 61.59],
    ["1510300", "Forest Oak", "ARF73", "Stair Nose", 82.59],
    ["1510301", "", "ARF98", "Reducer", 61.59],
    [],
    ["Schluter VinPro Mouldings"],
    ["SKU", "Description", "", "", "", "", "Price"],
    ["1503878", '1" Schluter Vinpro-T', "", "VPTL Brushed Chrome", "", "", 14.96],
  ]));
  const floor = bySku(items, "1507639");
  assert.equal(floor.discontinued, true);
  assert.equal(floor.type, "vinyl");
  assert.equal(floor.priceSqft, 3.351);
  // "90" Metroflor Trims" is a real title even though it starts with a digit.
  assert.equal(bySku(items, "1510297").section, '90" Metroflor Trims');
  // Color group label carries down until the next inline color.
  assert.match(bySku(items, "1510297").description, /Swing Oak/);
  assert.match(bySku(items, "1510301").description, /Forest Oak/);
  // Text in a headerless column inside the table lands in the description.
  assert.match(bySku(items, "1503878").description, /Brushed Chrome/);
});

test("table sheet: non-numeric price becomes a note, not a price", () => {
  const { items } = parse(sheet("Accessories", [
    ["Flooring Nails"],
    ["", "SKU", "U/M", "Size", "Decription", "", "", "Retail ", "", "Notes"],
    ["", "79550", "EA", "1200ct", '1-1/2" Hardwood Floor Nail', "", "", "See Catalyst"],
  ]));
  const nail = bySku(items, "79550");
  assert.equal(nail.price, null);
  assert.match(nail.note, /See Catalyst/);
  assert.equal(nail.type, null);
});

test("a re-arranged sheet with no recognizable items produces a warning", () => {
  const { items, warnings } = parse(sheet("Accessories", [["Something"], ["totally", "different"]]));
  assert.equal(items.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Accessories/);
});

// --- Mann Aduramax ---------------------------------------------------------------

test("Aduramax: flooring item + companion trim SKUs, size from section, Apex line", () => {
  const { items } = parse(sheet("Mann Aduramax", [
    ["Stock Mannington Vinyl Floors", "", "SKU", "SF/CT", "", "CT Price", "SF Price", "Reducer", "T-Mold", "End Cap", "Stairnosing"],
    ["6x48 Plank Visuals"],
    ["Acacia Tiger's Eye", "MAX011", "28920", 27.39, "", 131.1981, 4.79, "13191", "13192", "13194", "13193"],
    ["Kona Beach", "", "Discout", "", "", "", "", "94561", "94560", "94559", "94562", "DISC"],
    ["Apex- Check with Flooring"],
    ["Antiquity Memento", "APX180", "1517402", 23.4, "", 123.79, 5.29, "1518242", "1518241", "1518240", "1518243"],
  ]));
  const main = bySku(items, "28920");
  assert.equal(main.type, "vinyl");
  assert.equal(main.size, "6x48");
  assert.equal(main.price, 131.2);
  assert.equal(main.priceSqft, 4.79);
  const trim = bySku(items, "13191");
  assert.equal(trim.description, "Acacia Tiger's Eye — Reducer");
  assert.equal(trim.type, null);
  assert.equal(trim.price, null);
  // A discontinued floor with no main SKU still yields its (flagged) trims.
  assert.equal(bySku(items, "94561").discontinued, true);
  const apex = bySku(items, "1517402");
  assert.equal(apex.brand, "Mannington Adura Apex");
  assert.equal(apex.size, ""); // 6x48 must not leak into the Apex section
});

// --- Grout & Caulk matrices --------------------------------------------------------

test("grout matrix: product per column, SKU per color cell, first PRICE row wins", () => {
  const { items } = parse(sheet("Grout & Caulk", [
    ["TEC GROUT & CAULK", "", "", "", "", "", "Index"],
    ["COLOR#", "", "UNSANDED", "POWER GROUT", "CAULK", "", "TEC Grout and Caulk"],
    ["", "", "10#", "10#"],
    ["PRICE", "", 24.38, 33.53, 14.79],
    ["903 BIRCH", "", "-", "26742", "47849"],
    ["910 BRIGHT WHITE", "", "47018", "26736", "29439"],
    ["PRICE", "", 24.38, 33.53, 14.48],
    ["Custom Epoxy Grout"],
    ["COLOR#", "", "PART A", "PART B", "CAULK"],
    ["Price", "", 33.29, 97.64, 19.19],
    ["10 Antique White", "", "93776", "28865", "93777"],
    ["145 Light Smoke", "", "93792", "28865", "93793"],
  ]));
  const birch = bySku(items, "26742");
  assert.equal(birch.product, "TEC Power Grout");
  assert.equal(birch.color, "Birch");
  assert.equal(birch.price, 33.53); // first PRICE row, not the stale bottom one
  assert.equal(bySku(items, "47849").product, "TEC Caulk");
  assert.equal(bySku(items, "47018").product, "TEC Unsanded");
  const epoxy = bySku(items, "93776");
  assert.equal(epoxy.product, "Custom Epoxy Grout Part A");
  assert.equal(epoxy.color, "Antique White");
  assert.equal(epoxy.price, 33.29);
  // Part B shared across colors dedupes to one row without warnings.
  assert.equal(items.filter((i) => i.sku === "28865").length, 1);
});

// --- Tile Seats, Curbs, Trims --------------------------------------------------------

test("seats/curbs/trims: plain rows, color-coded matrix, mid-row SKU fallback, shelf matrix", () => {
  const { items } = parse(sheet("Tile Seats, Curbs, Trims", [
    ["Corner Shelves"],
    ["28973", '10" Black Granite', 48],
    ["Trendline"],
    ["Pricing is color coded", "", "", '1/2"', '3/8"', '5/16"', "", "Pricing"],
    ["MGS Matte Black", "", "Jolly", "22980", "23193", "23195", "", 22.07],
    ["Renu U Reducer"],
    ["AT-Satin Nickel", "", "Reno-U Reducer", "45506", "", 18.43],
    ["Schluter Shelves"],
    ["", "", "Triangle", "Pentagon"],
    ["Brushed Stainless EB"],
    ["", "Floral", "1501058", "1501063"],
  ]));
  const shelf = bySku(items, "28973");
  assert.equal(shelf.price, 48);
  assert.match(shelf.description, /Black Granite/);
  // one item per size column, priced from the Pricing column
  const jolly = bySku(items, "22980");
  assert.match(jolly.description, /Jolly 1\/2" — MGS Matte Black/);
  assert.equal(jolly.price, 22.07);
  assert.equal(items.filter((i) => /MGS Matte Black/.test(i.description)).length, 3);
  const renu = bySku(items, "45506");
  assert.equal(renu.price, 18.43);
  assert.match(renu.description, /AT-Satin Nickel/);
  const tri = bySku(items, "1501058");
  assert.match(tri.description, /Triangle Floral — Brushed Stainless/);
});

// --- dedupe ------------------------------------------------------------------------

test("duplicate SKUs collapse to one item, preferring the priced one, warning on conflicts", () => {
  const trowels = (sheetName, price) => sheet(sheetName, [
    ["Trowels"],
    ["", "SKU", "U/M", "Size", "Decription", "", "", "Retail ", "", "Notes"],
    ["", "1507211", "EA", "", "Grout Float", "", "", price],
    ["", "1514674", "EA", "", "Schluter Trowel", "", "", sheetName === "Accessories" ? 28.17 : null],
  ]);
  const { items, warnings } = parse(trowels("Accessories", 22.29), trowels("Tile-Mortar, Membrane, Underlay", 26.99));
  assert.equal(items.filter((i) => i.sku === "1507211").length, 1);
  assert.equal(bySku(items, "1507211").price, 22.29);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /1507211/);
  // unpriced duplicate defers to the priced occurrence, no warning
  assert.equal(bySku(items, "1514674").price, 28.17);
});
