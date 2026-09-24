import { test } from "node:test";
import assert from "node:assert/strict";
import { isSomersetPriceList, parseSomersetPages } from "./somersetbook.js";
import { parseMapped } from "./pricebook.js";
import { fileFormat } from "./dropimport.js";
import { SOMERSET_PAGES } from "./somersetfixture.js";

const parsed = parseSomersetPages(SOMERSET_PAGES);
const { items } = parseMapped(parsed.rows, parsed.mapping);
const bySku = new Map(items.map((i) => [i.sku, i]));
const item = (sku) => {
  const it = bySku.get(sku);
  assert.ok(it, `${sku} imported`);
  return it;
};
const floors = items.filter((i) => !i.trim);
const trims = items.filter((i) => i.trim);
const fitsOf = (sku) => item(sku).fits;

test("recognizes the Somerset R35 sheet and routes it to its own format tag", () => {
  assert.equal(isSomersetPriceList(SOMERSET_PAGES), true);
  assert.equal(isSomersetPriceList([[{ str: "Item #", x: 20, y: 40, w: 30 }, { str: "Color", x: 90, y: 40, w: 30 }]]), false);
  assert.equal(fileFormat({ pages: SOMERSET_PAGES, isPdf: true }), "somerset");
});

test("a floor carries its $/SF cost, the table's carton coverage, width and construction", () => {
  const solid = item("CP314DWBLG");
  assert.equal(solid.cost, 5.34);
  assert.equal(solid.priceUnit, "SF");
  assert.equal(solid.sfPerUnit, 25);
  assert.equal(solid.size, '3 1/4"');
  assert.equal(solid.type, "hardwood");
  assert.equal(solid.brand, "Somerset");
  assert.equal(solid.productLine, "Character");
  assert.equal(solid.description, "Character Hickory Driftwood Solid");

  const eng = item("EP512LNELG");
  assert.equal(eng.cost, 6.49);
  assert.equal(eng.sfPerUnit, 40);
  assert.equal(eng.size, '5"');
  assert.equal(eng.description, "Character Hickory Linen Engineered");
});

test("a merged price cell prices exactly the run of rows it is centered on", () => {
  // Color Strip: $4.35 spans six colors, $4.78 only Natural White Oak
  for (const sku of ["PS2103", "PS2104", "PS2116", "PS2106", "PS2118", "PS2101"]) assert.equal(item(sku).cost, 4.35, sku);
  assert.equal(item("PS2117").cost, 4.78);
  assert.equal(item("PS31401").cost, 4.9);
  assert.equal(item("PS31417").cost, 5.27);
  // TruOak: $3.80 spans all four solid 2 1/4" rows; 3 1/4" splits three + one
  for (const sku of ["TO8203", "TO8204", "TO8201", "TO8206"]) assert.equal(item(sku).cost, 3.8, sku);
  for (const sku of ["TO8303", "TO8304", "TO8301"]) assert.equal(item(sku).cost, 3.92, sku);
  assert.equal(item("TO8306").cost, 4.04);
  assert.equal(item("EPTO8706E").cost, 5.76);
  assert.equal(item("EPTO8701E").cost, 5.52);
  // Classic Character prints its prices on a line of their own between rows
  assert.equal(item("CL51WHB").cost, 5.47);
  assert.equal(item("EPCR314DFE").cost, 5.85);
  assert.equal(item("EPCR51WOE").cost, 5.98);
});

test("grey not-offered cells leave the other rows' merged prices intact", () => {
  assert.equal(item("EPHCAB6E").cost, 8.78);
  assert.equal(item("EPHCWW6E").cost, 8.78);
  assert.equal(item("EPHCRB7E").cost, 7.77);
  assert.equal(item("EPHCVO7E").cost, 7.77);
  assert.equal(item("EPHCABRLE").cost, 7.89);
  assert.equal(item("EPHCVORLE").cost, 7.13);
  assert.equal(item("EPWWON7E").cost, 7);
  assert.equal(item("EPWHSA6E").cost, 6.87);
  assert.equal(item("EPWHTO6E").cost, 6.87);
});

test("carton coverage follows however the table keys it — width, species, or construction", () => {
  assert.equal(item("EPHCAB6E").sfPerUnit, 40); // 6" / 7"
  assert.equal(item("EPHCRA7E").sfPerUnit, 40);
  assert.equal(item("EPHCABRLE").sfPerUnit, 38); // Random Width
  assert.equal(item("EPHCABRLE").size, 'Random 3 1/4", 4", 5"');
  assert.equal(item("PS2603HG").sfPerUnit, 25); // Red Oak / White Oak rows
  assert.equal(item("TO8203").sfPerUnit, 25); // Solid RO / Solid WO, species "Oak"
  assert.equal(item("EPTO8503E").sfPerUnit, 40);
  assert.equal(item("EP8LCNAE").sfPerUnit, 30);
});

test("Euro Wide Plank rows keep their grade and printed thickness", () => {
  const light = item("EP8LCSNE");
  assert.equal(light.cost, 6.87);
  assert.match(light.note, /Light Character/);
  assert.equal(light.thickness, '9/16"');
  assert.equal(light.description, "Euro Wide Plank White Oak Snow Engineered");
  const heavy = item("EP8HCWNE");
  assert.equal(heavy.cost, 6.24);
  assert.match(heavy.note, /Heavy Character/);
});

test("a species printed once for a merged block fills every row, and a color naming its species skips the repeat", () => {
  assert.equal(item("CL2109").description, "Classic Oak Butterscotch Solid");
  assert.equal(item("CL2101").description, "Classic Natural Red Oak Solid");
  assert.equal(item("CP314HCBLG").description, "Character Natural Hickory Solid");
});

test("the note carries finish, edge and warranty — TruOak's 15-year warranty included", () => {
  assert.match(item("CL2109").note, /Wirebrushed/);
  assert.match(item("CL2109").note, /Medium Gloss/);
  assert.match(item("CL2109").note, /Square End/);
  assert.match(item("EP314CLBUE").note, /Eased Edge and End/);
  assert.match(item("CP314DWBLG").note, /50 Year/);
  assert.match(item("TO8203").note, /15 Year/);
});

test("every floor is priced and cartoned, and EP codes are exactly the engineered ones", () => {
  assert.equal(floors.length, 177);
  for (const f of floors) {
    assert.ok(f.cost > 0, `${f.sku} priced`);
    assert.ok(f.sfPerUnit > 0, `${f.sku} cartoned`);
    assert.equal(/^EP/.test(f.sku), /Engineered$/.test(f.description), `${f.sku} construction`);
  }
});

test("a floor SKU printed on two rows stays with the row whose sibling codes match it, and warns", () => {
  assert.equal(item("EP512HSELG").description, "Character Hickory Saddle Engineered");
  assert.ok(!bySku.has("EP512HEELG"), "no invented code");
  assert.ok(parsed.warnings.some((w) => /EP512HSELG/.test(w) && /Ember/.test(w) && /Saddle/.test(w)));
});

test("moldings import per piece, flagged trim, fitted to their color's floors of the same construction", () => {
  const sn = item("MSN3484LG");
  assert.equal(sn.trim, true);
  assert.equal(sn.cost, 57.8);
  assert.equal(sn.priceUnit, "EA");
  assert.equal(sn.brand, "Somerset");
  assert.match(sn.description, /Stair Nose/);
  assert.deepEqual(fitsOf("MSN3484LG").sort(), ["CP314DWBLG", "CP41DWBLG", "CP51DWBLG"]);
  assert.deepEqual(fitsOf("MSN1284LG").sort(), ["EP314DWELG", "EP512DWELG"]);
  // one code printed under both Solid and Engineered threshold fits both
  assert.deepEqual(fitsOf("MTH3484LG").sort(), ["CP314DWBLG", "CP41DWBLG", "CP51DWBLG", "EP314DWELG", "EP512DWELG"]);
  assert.equal(item("ATU25").cost, 35.7);
  assert.equal(fitsOf("ATU25").length, 5);
});

test("trim codes are uppercased and the sheet's collection misspellings still link", () => {
  assert.ok(bySku.has("MTM34904") && !bySku.has("MtM34904"));
  assert.deepEqual(fitsOf("MRDH3433").sort(), ["PS2703B", "PS3703B"]); // "Homestlye"
  assert.deepEqual(fitsOf("MTH1203").sort(), ["EPTO8303E", "EPTO8503E", "EPTO8703E"]); // "Tru Oak"
});

test("a molding printed at two prices takes the higher and warns", () => {
  const expect = { MQR06: 34, MTM3406: 45.9, MRD3406: 45.9, MSN81207CP: 57.8, MTH81207CP: 45.9 };
  for (const [sku, cost] of Object.entries(expect)) {
    assert.equal(item(sku).cost, cost, sku);
    assert.ok(parsed.warnings.some((w) => w.includes(sku)), `${sku} warned`);
  }
  assert.ok(fitsOf("MQR06").includes("EPWWON7E") && fitsOf("MQR06").includes("TO8206") && fitsOf("MQR06").includes("PS2117"));
});

test("every molding is priced and fits at least one floor", () => {
  assert.equal(trims.length, 297);
  for (const t of trims) {
    assert.ok(t.cost > 0, `${t.sku} priced`);
    assert.ok(fitsOf(t.sku).length > 0, `${t.sku} fits a floor`);
  }
});

test("the parse is honest end to end: every emitted row survives the mapped import", () => {
  assert.equal(items.length, parsed.rows.length - 1);
  assert.equal(parsed.warnings.length, 6); // the Ember typo + five two-price moldings
});
