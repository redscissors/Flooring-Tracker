import { test } from "node:test";
import assert from "node:assert/strict";
import { isMirageChart, isMirageTrim, isMirageFlooring, mirageFileKind, bandRuns, parseMirageChart } from "./miragebook.js";

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

test("an unrecognized PDF yields no rows and says so, never plausible garbage", () => {
  const { rows, warnings } = parseMirageChart([[it("Some other price list", 20, 20)]]);
  assert.equal(rows.length, 0);
  assert.match(warnings[0], /Mirage product-chart/i);
});
