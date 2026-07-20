import { test } from "node:test";
import assert from "node:assert/strict";
import { isMirageChart, isMirageTrim, isMirageFlooring, mirageFileKind, bandRuns, parseMirageChart, parseMirageFlooring, priceChartRows, normConstruction, normWidth, parseMirage, effectiveDate, parseMirageColorGrid, parseMirageTrimPrices, parseMirageTrimSkus, normTrimType, normTrimGroup } from "./miragebook.js";

// A PDF text item in the shape App.jsx's readPdfPages produces (y top-down).
const it = (str, x, y, w = 10) => ({ str, x, y, w });
const sheet = (name, rows) => [{ name, rows }];

// --- detectors ---------------------------------------------------------------
// Mirage's manual source slot (the product chart) keys on the format tag, because
// computeFingerprint gives PDFs no header signature — so a chart that isn't
// detected would let ANY generic PDF stand in for it.

test("each Mirage file kind is told apart, and non-Mirage files are left alone", () => {
  const chart = [[it("PRODUCT", 282, 20), it("CHART", 425, 20), it("TruBalance", 329, 60)]];
  assert.equal(isMirageChart(chart), true);
  assert.equal(mirageFileKind({ pages: chart, isPdf: true }), "mirage-chart");

  const trim = sheet("MIR trim", [
    ["USA DISTRIBUTORS - MOLDINGS & STAIR COMPONENTS PRICE LIST ($/Unit)"],
    ['3/4" thick (TruBalance, Classic)', "Stair Nosing", "$196.69/EA"],
  ]);
  assert.equal(mirageFileKind({ sheets: trim }), "mirage-trim");

  const flooring = sheet("Mirage", [
    ["USA DISTRIBUTORS - FLOORING PRICE LIST ($/sq. ft.)"],
    ["", "", "Specie", "Grades", 'TruBalance 3/4"'],
  ]);
  assert.equal(mirageFileKind({ sheets: flooring }), "mirage-flooring");

  // The trim sheet also says TruBalance — it must not read as a flooring sheet.
  assert.equal(isMirageFlooring(trim), false);
  assert.equal(isMirageTrim(flooring), false);
  // Another vendor's PDF, and an empty one, are not the chart.
  assert.equal(isMirageChart([[it("Cartons Detail", 20, 20), it("Mannington", 20, 40)]]), false);
  assert.equal(isMirageChart([[]]), false);
  assert.equal(mirageFileKind({ sheets: sheet("EFT", [["Item Code", "Dealer Price"]]) }), null);
});

// --- construction bands ------------------------------------------------------

test("bands take the contiguous run that matches their printed centre", () => {
  // The real failing shape: a 3-column "TruBalance Lite" beside a 1-column
  // "Lock". Splitting at the midpoint between label centres (536.5) throws the
  // third Lite column (cx 537) over to Lock.
  const bands = [{ label: "TruBalance Lite", cx: 484 }, { label: "Lock", cx: 589 }];
  const widths = [{ label: '5"', cx: 431 }, { label: '7"', cx: 484 }, { label: 'Herr. 5"', cx: 537 }, { label: '5"', cx: 590 }];
  const runs = bandRuns(bands, widths);
  assert.deepEqual(widths.map((w) => runs.get(w)), ["TruBalance Lite", "TruBalance Lite", "TruBalance Lite", "Lock"]);
});

test("bandRuns declines rather than guessing when there are fewer columns than bands", () => {
  assert.equal(bandRuns([{ label: "A", cx: 1 }, { label: "B", cx: 2 }], [{ label: "x", cx: 1 }]).size, 0);
  assert.equal(bandRuns([], [{ label: "x", cx: 1 }]).size, 0);
});

// --- the chart ---------------------------------------------------------------

// A grade label is printed vertically centred beside its colours, so it lands on
// an arbitrary row — including one that already carries a colour and its SKUs.
const collisionPage = [
  it("White Oak", 42, 10), it("TruBalance", 200, 10, 40),
  it("5", 205, 20, 4), it('"', 210, 20, 3), it("7", 245, 20, 4), it('"', 250, 20, 3),
  it("Grades", 68, 30), it("Colors", 115, 30),
  it("Blanc", 54, 40), it("Ada", 115, 40), it("11111", 205, 40, 20), it("22222", 245, 40, 20),
  it("Character", 67, 50), it("Bea", 115, 50), it("33333", 205, 50, 20), it("44444", 245, 50, 20),
];

test("a grade sharing its row with a colour is still read", () => {
  const { rows } = parseMirageChart([collisionPage]);
  assert.equal(rows.length, 4);
  assert.deepEqual([...new Set(rows.map((r) => r.grade))], ["Character"]);
  assert.deepEqual([...new Set(rows.map((r) => r.collection))], ["Blanc"]);
  assert.deepEqual([...new Set(rows.map((r) => r.color))], ["Ada", "Bea"]);
  const ada5 = rows.find((r) => r.color === "Ada" && r.width === '5"');
  assert.equal(ada5.sku, "11111");
  assert.equal(ada5.construction, "TruBalance");
  assert.equal(ada5.species, "White Oak"); // the block banner
});

// The cork block inserts a species column, and its colour list repeats per
// SPECIES rather than per grade. A fixed colour window reads x=113 as the colour
// and files rows under a colour called "Red Oak".
const speciesPage = [
  it("TruBalance", 200, 100, 40),
  it("5", 205, 110, 4), it('"', 210, 110, 3),
  it("Grade", 66, 120), it("Species", 115, 120), it("Colors", 161, 120),
  it("Imagine", 54, 130), it("Red Oak", 113, 130), it("Papyrus", 161, 130), it("55555", 205, 130, 20),
  it("Rock Cliff", 161, 140), it("66666", 205, 140, 20),
  it("Maple", 113, 150), it("Papyrus", 161, 150), it("77777", 205, 150, 20),
  it("Rock Cliff", 161, 160), it("88888", 205, 160, 20),
];

test("a block with its own species column keeps colours and species apart", () => {
  const { rows } = parseMirageChart([speciesPage]);
  assert.equal(rows.length, 4);
  assert.deepEqual([...new Set(rows.map((r) => r.color))], ["Papyrus", "Rock Cliff"]);
  // Species is centred beside its group, so it is assigned per colour-repeat
  // group — not filled down, which would leave the first row blank.
  assert.equal(rows.find((r) => r.sku === "55555").species, "Red Oak");
  assert.equal(rows.find((r) => r.sku === "66666").species, "Red Oak");
  assert.equal(rows.find((r) => r.sku === "77777").species, "Maple");
  assert.equal(rows.find((r) => r.sku === "88888").species, "Maple");
  assert.equal(rows.every((r) => r.collection === "Imagine"), true);
});

// The widths are not always one printed row. Where a band's columns carry a
// pattern qualifier, their widths sit on a lower baseline than the plain ones
// (439.7 vs 443.2 on the real 2026 chart) — far enough apart to land in separate
// rows. Reading only the row above found 2 widths under 3 bands, so bandRuns
// rightly refused to map them and the whole block lost its construction.
const splitWidthPage = [
  it("Oak", 42, 10), it("TruBalance", 207, 10, 40), it("TruBalance Lite", 267, 10, 40), it("Solid", 317, 10, 20),
  it("Thickness: 3/4", 205, 16), it('"', 250, 16),
  it("Herringbone", 232, 22, 30),                             // the qualifier floats above its column
  it("5", 205, 28, 4), it('"', 210, 28, 3),                   // plain widths, upper baseline
  it("7", 285, 28, 4), it('"', 290, 28, 3),
  it("4-1/4", 320, 28, 12), it('"', 335, 28, 3),
  it("5", 245, 33, 4), it('"', 250, 33, 3),                   // the qualified width, lower baseline
  it("Grades", 68, 40), it("Colors", 115, 40),
  it("Lively", 54, 50), it("Ada", 115, 50),
  it("11111", 205, 50, 20), it("22222", 245, 50, 20), it("33333", 285, 50, 20), it("44444", 320, 50, 20),
  it("Character", 67, 60), it("Bea", 115, 60),
  it("55555", 205, 60, 20), it("66666", 245, 60, 20), it("77777", 285, 60, 20), it("88888", 320, 60, 20),
];

test("widths split across two baselines are read as one row of columns", () => {
  const { rows } = parseMirageChart([splitWidthPage]);
  assert.equal(rows.length, 8);
  const ada = (sku) => rows.find((r) => r.sku === sku);
  // All four columns resolve, and each takes the construction printed over it —
  // the qualified column belongs to TruBalance, not to its right-hand neighbour.
  assert.deepEqual(
    ["11111", "22222", "33333", "44444"].map((s) => `${ada(s).construction} ${ada(s).width}`),
    ['TruBalance 5"', 'TruBalance Herringbone 5"', 'TruBalance Lite 7"', 'Solid 4-1/4"'],
  );
  assert.equal(rows.every((r) => r.construction), true);
});

// The 2025 chart prints the qualifier INSIDE the width item ("Herringbone 5"),
// where the 2026 one floats it on its own row — both must parse.
test("a width carrying its own qualifier is read as that one column", () => {
  const page = [
    it("Oak", 42, 10), it("TruBalance", 206, 10, 40), it("Classic", 276, 10, 20),
    it("5", 205, 20, 4), it('"', 210, 20, 3),
    it("Herringbone 5", 230, 20, 30), it('"', 262, 20, 3),
    it("4-1/4", 280, 20, 12), it('"', 295, 20, 3),
    it("Grades", 68, 30), it("Colors", 115, 30),
    it("Blanc", 54, 40), it("Ada", 115, 40),
    it("11111", 205, 40, 20), it("22222", 245, 40, 20), it("33333", 285, 40, 20),
    it("Character", 67, 50), it("Bea", 115, 50),
    it("44444", 205, 50, 20), it("55555", 245, 50, 20), it("66666", 285, 50, 20),
  ];
  const { rows } = parseMirageChart([page]);
  const at = (sku) => rows.find((r) => r.sku === sku);
  assert.equal(at("22222").width, 'Herringbone 5"');
  assert.equal(at("22222").construction, "TruBalance");
  assert.equal(at("33333").construction, "Classic");
  assert.equal(rows.every((r) => r.construction), true);
});

test("an unrecognized PDF yields no rows and says so, never plausible garbage", () => {
  const { rows, warnings } = parseMirageChart([[it("Some other price list", 20, 20)]]);
  assert.equal(rows.length, 0);
  assert.match(warnings[0], /Mirage product-chart/i);
});

// --- the flooring price sheets ----------------------------------------------

// The three documents spell the same axis differently. Every mismatch silently
// costs a floor its price, so both sides normalize to one spelling.
test("construction and width normalize to one spelling across the three documents", () => {
  // Hardwood calls Classic "Solid"; all three carry a thickness the chart omits.
  assert.equal(normConstruction('Solid 3/4"'), "classic");
  assert.equal(normConstruction("Classic 3/4''"), "classic");
  assert.equal(normConstruction("Classic"), "classic");
  assert.equal(normConstruction('TruBalance Lite 9/16"'), "trubalance lite");
  assert.equal(normConstruction('TruBalance 3/4"'), "trubalance");
  assert.equal(normConstruction('Lock 7/16"'), "lock");
  // The sheets abbreviate herringbone, footnote a width, and space a fraction.
  assert.equal(normWidth('Herr. 5"'), normWidth('Herringbone 5"'));
  assert.equal(normWidth('9"**'), "9");
  assert.equal(normWidth('7 3/4"'), normWidth('7-3/4"'));
  assert.equal(normWidth('Chevron 5"'), "chevron 5");
});

// Merged header cells put a band label in the first column of its span, so it
// fills right — unlike the PDF, where the same label is centred over its columns.
const flooringSheet = [{ name: "Mirage", rows: [
  ["USA DISTRIBUTORS - FLOORING PRICE LIST ($/sq. ft.)"],
  ["Effective: February 3, 2025"],
  ["", "", "", "", 'TruBalance 3/4"', "", "", 'Classic 3/4"'],
  ["", "", "", "", '5"', '7 3/4"', 'Herr. 5"', '4-1/4"'],
  ["", "", "Specie", "Grades", "Lengths 20 to 82\"", "", "", ""],
  ["Muse", "", "White Oak", "Character", "$10.29/SF", "$12.19/SF", "$12.49/SF", "$8.59/SF"],
  ["", "", "", "Exclusive", "$11.79/SF", "$15.39/SF", "N/A/SF", "$10.29/SF"],
] }];

test("a flooring sheet yields a price per collection/grade/construction/width", () => {
  const { rows } = parseMirageFlooring(flooringSheet);
  const find = (grade, width) => rows.find((r) => r.grade === grade && r.width === width);
  assert.equal(find("Character", '5"').price, 10.29);
  assert.equal(find("Character", '5"').construction, 'TruBalance 3/4"'); // filled right
  assert.equal(find("Character", '4-1/4"').construction, 'Classic 3/4"'); // next span
  assert.equal(find("Character", '5"').collection, "Muse");
  // Collection and species fill down; only the grade changes on the second row.
  assert.equal(find("Exclusive", '5"').collection, "Muse");
  assert.equal(find("Exclusive", '5"').species, "White Oak");
  // "N/A/SF" is not a price, so no row is invented for it.
  assert.equal(find("Exclusive", 'Herr. 5"'), undefined);
});

test("a sheet with no prices says so rather than returning nothing quietly", () => {
  const { rows, warnings } = parseMirageFlooring([{ name: "x", rows: [["Item", "Price"]] }]);
  assert.equal(rows.length, 0);
  assert.match(warnings[0], /Mirage flooring prices/i);
});

// --- the join ----------------------------------------------------------------

test("chart SKUs take their price from the sheets, later sheet winning an overlap", () => {
  const chart = [
    { collection: "Muse", grade: "Character", color: "Eleanor", construction: "TruBalance", width: '5"', sku: "72697" },
    { collection: "Muse", grade: "Character", color: "Ada", construction: "Classic", width: '4-1/4"', sku: "11111" },
  ];
  const tower = [{ collection: "Muse", grade: "Character", construction: 'TruBalance 3/4"', width: '5"', price: 9.99, sheet: "Mirage" }];
  const hardwood = [{ collection: "Muse", grade: "Character", construction: 'TruBalance 3/4"', width: '5"', price: 10.29, sheet: "$ Flooring blank" }];
  // Value Tower first, Hardwood second — Hardwood supersedes where they overlap.
  const { rows, unpriced } = priceChartRows(chart, [...tower, ...hardwood]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sku, "72697");
  assert.equal(rows[0].price, 10.29);
  assert.equal(rows[0].priceSheet, "$ Flooring blank");
  // A chart SKU the sheets don't price is dropped, never carried at zero — an
  // order item's cost drives the quote, so $0 would quote silently wrong.
  assert.deepEqual(unpriced.map((r) => r.sku), ["11111"]);
});

test("the join survives the sheets and the chart spelling an axis differently", () => {
  const chart = [{ collection: "Blanc", grade: "Character", color: "Natural", species: "White Oak", construction: "Classic", width: 'Herringbone 5"', sku: "42014" }];
  const priced = [{ collection: "Blanc", grade: "Character", species: "White Oak", construction: 'Solid 3/4"', width: 'Herr. 5"', price: 8.59, sheet: "hw" }];
  assert.equal(priceChartRows(chart, priced).rows[0].price, 8.59);
});

// Admiration Exclusive sells in both Red Oak and Maple at the same width, and the
// sheets price them $2.20/sq ft apart. Keyed without species, both SKUs take
// whichever sheet row was written last — one of them silently quotes wrong.
test("two species at one width keep their own prices", () => {
  const chart = [
    { collection: "Admiration", grade: "Exclusive", color: "Cape Cod", species: "Red Oak", construction: "TruBalance", width: '5"', sku: "36139" },
    { collection: "Admiration", grade: "Exclusive", color: "Cape Cod", species: "Maple", construction: "TruBalance", width: '5"', sku: "36115" },
  ];
  const priced = [
    { collection: "Admiration", grade: "Exclusive", species: "Red Oak", construction: 'TruBalance 3/4"', width: '5"', price: 9.29, sheet: "hw" },
    { collection: "Admiration", grade: "Exclusive", species: "Maple", construction: 'TruBalance 3/4"', width: '5"', price: 11.49, sheet: "hw" },
  ];
  const { rows } = priceChartRows(chart, priced);
  assert.equal(rows.find((r) => r.sku === "36139").price, 9.29);
  assert.equal(rows.find((r) => r.sku === "36115").price, 11.49);
});

// The 2026 chart moved the species off the band row onto the texture row, as an
// ALL-CAPS banner. Case is what distinguishes it from the texture beside it.
test("a species printed as a banner above the widths is read", () => {
  const page = [
    it("TruBalance", 207, 10, 40),
    it("MAPLE", 96, 22, 30), it("Smooth | DuraMatt®", 124, 22, 60), it("TM", 185, 22, 8),
    it("5", 205, 28, 4), it('"', 210, 28, 3),
    it("Grades", 68, 40), it("Colors", 115, 40),
    it("Autumn", 54, 50), it("Ada", 115, 50), it("11111", 205, 50, 20),
    it("Character", 67, 60), it("Bea", 115, 60), it("22222", 205, 60, 20),
  ];
  const { rows } = parseMirageChart([page]);
  assert.equal(rows.length, 2);
  // The texture and its trademark must not be mistaken for the species.
  assert.deepEqual([...new Set(rows.map((r) => r.species))], ["Maple"]);
  assert.deepEqual([...new Set(rows.map((r) => r.color))], ["Ada", "Bea"]);
});

// --- the whole book (ADR 0025 rule 7) ----------------------------------------

const chartPayload = {
  isPdf: true,
  pages: [[
    it("PRODUCT", 282, 6), it("CHART", 425, 6),
    it("WHITE OAK", 89, 10, 40), it("TruBalance", 207, 10, 40),
    it("5", 205, 20, 4), it('"', 210, 20, 3),
    it("Grades", 68, 30), it("Colors", 115, 30),
    it("Muse", 54, 40), it("Eleanor", 115, 40), it("72697", 205, 40, 20),
    it("Character", 67, 50), it("Ada", 115, 50), it("72698", 205, 50, 20),
  ]],
};
const floorPayload = (effective, price) => ({ sheets: [{ name: "Mirage", rows: [
  ["USA DISTRIBUTORS - FLOORING PRICE LIST ($/sq. ft.)"],
  [`Effective: ${effective}`],
  ["", "", "", "", 'TruBalance 3/4"'],
  ["", "", "", "", '5"'],
  ["", "", "Specie", "Grades", "Lengths 20 to 82\""],
  ["Muse", "", "White Oak", "Character", `$${price}/SF`],
] }] });

test("the four documents collapse into one canonical sheet", () => {
  const res = parseMirage([chartPayload, floorPayload("February 3, 2025", "9.99")]);
  assert.equal(res.rows[0][0], "Item #");           // canonical header
  assert.equal(res.meta.floors, 2);
  const eleanor = res.rows.find((r) => r[0] === "72697");
  assert.equal(eleanor[1], 'White Oak Eleanor — Character, TruBalance 5"');
  assert.equal(eleanor[2], "Muse");                 // collection
  assert.equal(eleanor[6], "9.99");                 // the joined price
  assert.equal(eleanor[8], "hardwood");
  assert.equal(res.mapping.columns[0], "sku");
});

// Which sheet supersedes the other is a question of DATE, not of argument order
// or filename — a newly published Value Tower must win the moment it arrives.
test("the later-dated price sheet wins, whatever order the files arrive in", () => {
  const older = floorPayload("February 3, 2025", "9.99");
  const newer = floorPayload("July 13th, 2026", "10.29");
  assert.equal(effectiveDate(newer.sheets) > effectiveDate(older.sheets), true);
  for (const set of [[chartPayload, older, newer], [newer, chartPayload, older]]) {
    const res = parseMirage(set);
    assert.equal(res.rows.find((r) => r[0] === "72697")[6], "10.29");
  }
});

test("a set with no Mirage file falls through instead of claiming it", () => {
  assert.equal(parseMirage([{ sheets: [{ name: "x", rows: [["Item Code", "Dealer Price"]] }] }]), null);
  assert.equal(parseMirage([]), null);
});

// --- Value Tower's colour grid ----------------------------------------------

const colorGridSheet = [{ name: "Mirage", rows: [
  ["USA DISTRIBUTORS - FLOORING PRICE LIST ($/sq. ft.)"],
  ["Effective: February 3, 2025"],
  ["", "", "", "", 'Classic 3/4"'],
  ["", "", "", "", '3-1/4"'],
  ["", "", "Specie", "Grades", "Lengths 10 to 76\""],
  ["Lakeside", "", "Red Oak", "Traditional", "$4.99/SF"],
  [],
  ["", "", "", "", 'TruBalance 3/4"'],
  ["", "", "", "", '5"'],
  ["", "", "Specie", "Grades", "Lengths 20 to 82\""],
  ["Muse", "", "White Oak", "Character", "$10.29/SF"],
  [],
  ["White Oak Brushed DuraMatt®", "", "", 'TruBalance 3/4"', "", "", 'TruBalance Lite 9/16"'],
  ["", "", "", '5"', '7"', 'Herr. 5"', '5"'],
  ["", "", "Colors", "Lengths 20 to 82\"", "", "", ""],
  ["Muse", "Character", "Ada", "75986", "77929", "76054", "56685"],
  ["", "", "Rachel", "73266", "78025", "76067", "56691"],
  [],
  ["Red Oak                Traditional", "", "", 'Classic 3/4"'],
  ["", "", "", '3-1/4"'],
  ["", "", "Colors", "Lengths 10 to 76\""],
  ["Escape", "Traditional", "Blue Ridge", "75088"],
  ["", "", "Champlain", "78084"],
] }];

test("the colour grid reads a block's species, construction and widths", () => {
  const { rows } = parseMirageColorGrid(colorGridSheet);
  const ada5 = rows.find((r) => r.color === "Ada" && r.width === '5"' && /TruBalance 3/.test(r.construction));
  assert.equal(ada5.sku, "75986");
  assert.equal(ada5.species, "White Oak");        // cut from the banner's texture
  assert.equal(ada5.collection, "Muse");
  assert.equal(ada5.grade, "Character");
  // The band label fills right across its merged span, and the next label starts
  // a new span — so the last column is Lite, not TruBalance.
  assert.match(rows.find((r) => r.color === "Ada" && r.sku === "56685").construction, /Lite/);
});

// The grid files these under "Escape" but the price list sells them as
// "Lakeside" (owner, 2026-07-20). Both halves are useless alone: Lakeside has a
// price and no SKUs, Escape Traditional has SKUs and no price.
test("the Traditional colours take the collection the price list sells them under", () => {
  const { rows } = parseMirageColorGrid(colorGridSheet);
  const trad = rows.filter((r) => r.grade === "Traditional");
  assert.deepEqual(trad.map((r) => r.color), ["Blue Ridge", "Champlain"]);
  assert.deepEqual([...new Set(trad.map((r) => r.collection))], ["Lakeside"]);
  assert.equal(trad[0].species, "Red Oak");
  // Only the Traditional block is renamed — Muse is left alone.
  assert.equal(rows.find((r) => r.color === "Ada").collection, "Muse");
});

test("the colour grid supplies Lakeside, and its price, to the book", () => {
  const res = parseMirage([chartPayload, { sheets: colorGridSheet[0] ? colorGridSheet : [] }]);
  const lake = res.rows.filter((r) => r[2] === "Lakeside");
  assert.equal(lake.length, 2);
  assert.equal(lake[0][6], "4.99");              // joined to the Lakeside price row
  assert.match(lake[0][1], /Red Oak Blue Ridge — Traditional, Classic 3\/4" 3-1\/4"/);
});

// The grid travels with its own sheet's date. A SKU-level merge readmits items a
// newer chart has since dropped — discontinued product, resurrected AND priced.
test("the colour grid adds Lakeside and nothing else", () => {
  const res = parseMirage([chartPayload, { sheets: colorGridSheet }]);
  // The chart's Muse block wins; the grid's older Muse SKUs are not readmitted.
  assert.equal(res.rows.some((r) => r[0] === "75986"), false);
  assert.equal(res.rows.some((r) => r[0] === "72697"), true);   // the chart's Muse SKU
  assert.equal(res.meta.fromGrid, 2);                          // only the Lakeside pair
  // And a collection appears once, not twice under two spellings.
  assert.deepEqual([...new Set(res.rows.slice(1).map((r) => r[2]))].sort(), ["Lakeside", "Muse"]);
});

// --- the trim sheet ----------------------------------------------------------

// The two halves name a trim differently, and the price table groups by
// THICKNESS while the SKU grid names the constructions sharing it.
test("a trim's name and group reduce to what both tables agree on", () => {
  assert.equal(normTrimType("Matchable Square Stair Nosing"), normTrimType('Match. Square Nosing 69"'));
  assert.equal(normTrimType("Treads & Risers Planks**"), normTrimType("Tread & Riser Planks"));
  assert.equal(normTrimType('4X10" Flush Mount Vent*'), normTrimType('4"x10" Flush Mount Vent*'));
  // The parenthetical lists which constructions share a thickness — comparing it
  // costs the 3/4" TruBalance blocks their prices.
  assert.equal(normTrimGroup('3/4" thick (TruBalance, Classic)'), normTrimGroup('3/4"(TruBalance)'));
  assert.equal(normTrimGroup('9/16" thick (TruBalance Lite)'), "9/16");
  assert.equal(normTrimGroup("Multifunctions - all technologies"), "multifunctions");
});

const trimSheet = [{ name: "MIR trim", rows: [
  ["", "", "USA DISTRIBUTORS - MOLDINGS & STAIR COMPONENTS PRICE LIST ($/Unit)"],
  ["", "", "Effective: July 13th, 2026"],
  [],
  ["", "", "", "White Oak", "Red Oak & Oak", "Maple"],
  ['3/4" thick (TruBalance, Classic)', "Stair Nosing", "", "$196.69/EA", "$128.89/EA", "$157.49/EA"],
  ["", "Matchable Square Stair Nosing", "", "$107.49/EA", "$87.89/EA", "$103.99/EA"],
  [],
  ["White Oak Brushed DuraMatt®", "", '3/4"(TruBalance, Classic)'],
  [],
  ["", "", "Stair Nosing", "Matchable Square Nosing"],
  ["", "", "", '48"', '69"'],
  [],
  ["", "Colors", "", "", ""],
  ["Blanc", "Natural", "42014", "73595", "73607"],
] }];

test("a trim takes its price from the species column that covers it", () => {
  const prices = parseMirageTrimPrices(trimSheet);
  // One column can serve two species ("Red Oak & Oak"), so both must key to it.
  assert.equal(prices.get("3/4|nosing|red oak"), 128.89);
  assert.equal(prices.get("3/4|nosing|oak"), 128.89);
  assert.equal(prices.get("3/4|nosing|white oak"), 196.69);
});

test("a size row splits one trim label across two columns", () => {
  const skus = parseMirageTrimSkus(trimSheet);
  assert.deepEqual(skus.map((s) => s.sku), ["42014", "73595", "73607"]);
  // "Matchable Square Nosing" spans two columns; the 48"/69" row is what tells
  // them apart, so the label carries the size.
  assert.deepEqual(skus.map((s) => s.label), ["Stair Nosing", 'Matchable Square Nosing 48"', 'Matchable Square Nosing 69"']);
  assert.deepEqual([...new Set(skus.map((s) => s.species))], ["White Oak"]);
  assert.deepEqual([...new Set(skus.map((s) => s.collection))], ["Blanc"]);
});

test("trims join the book priced and pointing at the floors they fit", () => {
  const res = parseMirage([chartPayload, floorPayload("July 13th, 2026", "10.29"), { sheets: trimSheet }]);
  const trim = res.rows.find((r) => r[0] === "42014");
  assert.equal(trim[9], "trim");
  assert.equal(trim[7], "EA");
  assert.equal(trim[6], "196.69");
  assert.equal(res.meta.trims, 3);
  // The chart's Blanc/Natural floor is what this nosing fits. The chart fixture
  // is Muse/Eleanor, so nothing matches — and an unmatched trim still imports.
  assert.equal(trim[11], "");
  assert.equal(res.meta.trimOrphan, 3);
  assert.match(res.warnings.join(" "), /matched no floor/);
});

test("a bundle with no trim sheet says the book will have no mouldings", () => {
  const res = parseMirage([chartPayload, floorPayload("July 13th, 2026", "10.29")]);
  assert.match(res.warnings.join(" "), /no mouldings or stair parts/i);
});

test("a bundle missing the chart says so rather than importing a colourless book", () => {
  const res = parseMirage([floorPayload("July 13th, 2026", "10.29")]);
  assert.equal(res.meta.floors, 0);
  assert.match(res.warnings.join(" "), /Product Chart is missing/i);
});
