import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "./catalog.js";
import { newProduct, normP, normC, newProject } from "./model.js";
import { normFreight, hasFreightProgram, rowFreightOn, rowSqin, freightBasis, freightTally, freightParts, freightList, freightTotal, freightSummary, freightOrderRows, FREIGHT_SEED, freightIsBlank, freightIsSeed, freightSeedFor, isSeedBook } from "./freight.js";

const s = normalizeSettings();

// The real program this was built from: Glazzio's 2026 shipping sheet, read down
// the Ohio column. Both of its pallet tables (Large Format, and Harmonic 12x24 /
// Arvora LVT) charge $79 in Ohio, so one large-format rate covers the state.
// Glazzio's large format is what is LARGER than a 12x24 — 288 in² — so a 12x24
// itself ships by the foot.
const GLAZZIO = {
  mode: "program", destination: "Ohio", effective: "2026", palletSf: 496,
  perSqft: 0.99, minCharge: 14.85, palletAt: 149, palletRate: 149,
  largeRate: 79, largeOverSqin: 288, largeSeries: "Harmonic, Arvora",
  perPiece: 0.33, pieceMin: 14.85,
};
const book = (freight = GLAZZIO, id = "glz", name = "Glazzio") => ({ id, name, kind: "order", data: { freight } });
const tile = (over) => ({ ...newProduct(), bookId: "glz", qtyType: "sqft", ...over });
const proj = (products) => ({ ...newProject(null, "Job"), categories: [{ id: "a1", name: "Kitchen", products }] });

test("normFreight: an unconfigured book has no program, and 0 rates switch rules off", () => {
  assert.equal(normFreight(undefined).mode, "none");
  assert.equal(normFreight({ mode: "perSqft" }).mode, "none");   // the ADR 0009 reserved names are not programs
  assert.equal(hasFreightProgram({ data: {} }), false);
  assert.equal(hasFreightProgram(book()), true);
  const bare = normFreight({ mode: "program" });
  assert.equal(bare.perSqft, 0);
  assert.equal(bare.largeOverSqin, 288);                         // the default line is a SIZE, not 0
  // The 15"-side rule this replaced is not read back in — a stored program
  // carrying it gets the area rule, which is the point of the change.
  assert.equal(normFreight({ mode: "program", largeFormatIn: 15 }).largeOverSqin, 288);
  assert.equal(normFreight({ mode: "program", perSqft: "-3", palletSf: "abc" }).perSqft, 0);
});

test("the seed prefills the Glazzio book only — every other vendor opens empty", () => {
  assert.deepEqual(normFreight(FREIGHT_SEED), normFreight(GLAZZIO));
  assert.equal(isSeedBook({ name: "Glazzio Tiles" }), true);
  assert.equal(isSeedBook({ name: "glazzio" }), true);
  assert.equal(isSeedBook({ name: "Virginia Tile — Core" }), false);
  assert.equal(isSeedBook(undefined), false);
  assert.deepEqual(freightSeedFor({ name: "Glazzio Tiles" }), { ...FREIGHT_SEED });
  // Another vendor gets a program with no rates at all, not Glazzio's.
  const other = normFreight(freightSeedFor({ name: "Anatolia Tile" }));
  assert.equal(other.mode, "program");
  assert.equal(freightIsBlank(other), true);
  assert.equal(other.destination, "");
  // Blank = nothing chargeable typed yet, which is what earns the prefill.
  assert.equal(freightIsBlank({ mode: "program" }), true);
  assert.equal(freightIsBlank(undefined), true);
  assert.equal(freightIsBlank(FREIGHT_SEED), false);
  assert.equal(freightIsBlank({ mode: "program", perPiece: 0.5 }), false);   // one rate is enough
  // The card's "these are Glazzio's numbers" note stops the moment one moves.
  assert.equal(freightIsSeed(FREIGHT_SEED), true);
  assert.equal(freightIsSeed({ ...FREIGHT_SEED, largeRate: 99 }), false);
  assert.equal(freightIsSeed({ ...FREIGHT_SEED, largeOverSqin: 144 }), false);  // the size rule is the sheet's too
  assert.equal(freightIsSeed({ ...FREIGHT_SEED, largeSeries: "" }), false);
  assert.equal(freightIsSeed({ ...FREIGHT_SEED, destination: "Indiana" }), true);  // a label, not a rate
  assert.equal(freightIsSeed({ mode: "program" }), false);
});

test("rowFreightOn: a row rides the shipment unless it was explicitly switched off", () => {
  assert.equal(rowFreightOn(normP({})), true);                   // a row saved before the program existed
  assert.equal(rowFreightOn({ freight: "" }), true);
  assert.equal(rowFreightOn({ freight: "off" }), false);
  assert.equal(normP({ freight: "off" }).freight, "off");
  assert.equal(normP({ freight: "nonsense" }).freight, "");
});

test("rowSqin / freightBasis: L×W first, then the size text, then small", () => {
  const f = normFreight(GLAZZIO);
  assert.equal(rowSqin(tile({ L: "24", W: "12" })), 288);              // however it was typed
  assert.equal(rowSqin(tile({ sizeText: '12" × 24"' })), 288);
  assert.equal(rowSqin(tile({ sizeText: "12x12 sheet" })), 144);
  assert.equal(rowSqin(tile({ sizeText: '2" Hex' })), 0);              // one dimension is no area
  assert.equal(rowSqin(tile({ L: "12" })), 0);
  assert.equal(freightBasis(tile({ sizeText: '2" Hex' }), f), "small"); // unknown size never invents a pallet
  assert.equal(freightBasis({ ...newProduct(), type: "misc", qtyType: "count" }, f), "piece");
});

// Glazzio's line is "larger than a 12x24" — 288 in² — not the trade's 15" side.
// A 12x24 rides the per-foot table with the mosaics, and "larger" is read as the
// vendor writes it: face area, so a 16x16 (256 in²) is a smaller piece than a
// 12x24 even though it is wider.
test("freightBasis: large format is what outgrows a 12x24 by area", () => {
  const f = normFreight(GLAZZIO);
  assert.equal(freightBasis(tile({ L: "12", W: "24" }), f), "small");   // 288 — at the line, not over it
  assert.equal(freightBasis(tile({ L: "24", W: "12" }), f), "small");   // the same tile, typed the other way
  assert.equal(freightBasis(tile({ L: "12", W: "12" }), f), "small");   // 144
  assert.equal(freightBasis(tile({ L: "16", W: "16" }), f), "small");   // 256 — wider, but a smaller piece
  assert.equal(freightBasis(tile({ L: "36", W: "12" }), f), "large");   // 432
  assert.equal(freightBasis(tile({ L: "24", W: "24" }), f), "large");   // 576
  assert.equal(freightBasis(tile({ sizeText: '18" × 18"' }), f), "large"); // 324
  // A 6x48 LVT plank is exactly a 12x24's area — which is why Glazzio names
  // Arvora on the pallet table instead of leaving it to the size rule.
  assert.equal(freightBasis(tile({ L: "48", W: "6" }), f), "small");
  // 0 = size never sends anything to the pallet table.
  const flat = normFreight({ ...GLAZZIO, largeOverSqin: 0, largeSeries: "" });
  assert.equal(freightBasis(tile({ L: "24", W: "24" }), flat), "small");
});

// The sheet names two series that ship by the pallet at a size that is otherwise
// small format ("Harmonic 12x24 & Arvora LVT"), so the exception is by name.
test("freightBasis: a named series ships large format whatever its size", () => {
  const f = normFreight(GLAZZIO);
  assert.equal(freightBasis(tile({ L: "12", W: "24", brandColor: "Harmonic — Pearl" }), f), "large");
  assert.equal(freightBasis(tile({ L: "48", W: "6", brandColor: "Arvora LVT — Dune" }), f), "large");
  assert.equal(freightBasis(tile({ L: "12", W: "24", brandColor: "Sunset Glass — Alabaster" }), f), "small");
  assert.equal(freightBasis(tile({ L: "12", W: "12", note: "Arvora LVT plank" }), f), "large");
  // A trim stays a trim: the piece table doesn't care what series it is.
  assert.equal(freightBasis({ ...newProduct(), type: "misc", qtyType: "count", brandColor: "Harmonic chair rail" }, f), "piece");
  assert.equal(freightBasis(tile({ L: "12", W: "24", brandColor: "Harmonic — Pearl" }), normFreight({ ...GLAZZIO, largeSeries: "" })), "small");
});

test("small format: $0.99/sf, floored at the order minimum", () => {
  const t = { f: normFreight(GLAZZIO), smallSf: 100, largeSf: 0, pieces: 0 };
  const [part] = freightParts(t);
  assert.equal(part.basis, "small");
  assert.equal(part.cost, 99);
  assert.equal(part.atMin, false);
  // 10 sf of mosaic is $9.90 by the foot — the sheet's minimum is $14.85/order.
  const min = freightParts({ ...t, smallSf: 10 })[0];
  assert.equal(min.cost, 14.85);
  assert.equal(min.atMin, true);
});

test("small format: past $149 the whole lot ships flat-rate pallets", () => {
  const f = normFreight(GLAZZIO);
  // 150 sf → $148.50, still under the threshold.
  assert.deepEqual(freightParts({ f, smallSf: 150, largeSf: 0, pieces: 0 })[0].basis, "small");
  // 151 sf → $149.49, over: one 496 sf pallet at $149.
  const over = freightParts({ f, smallSf: 151, largeSf: 0, pieces: 0 })[0];
  assert.equal(over.basis, "pallet");
  assert.equal(over.qty, 1);
  assert.equal(over.cost, 149);
  // 1000 sf is three pallets of 496 — the pallet count is the whole rule.
  assert.equal(freightParts({ f, smallSf: 1000, largeSf: 0, pieces: 0 })[0].qty, 3);
  assert.equal(freightParts({ f, smallSf: 1000, largeSf: 0, pieces: 0 })[0].cost, 447);
});

test("large format: always by the pallet, never below one", () => {
  const f = normFreight(GLAZZIO);
  const small = freightParts({ f, smallSf: 0, largeSf: 40, pieces: 0 })[0];
  assert.equal(small.qty, 1);
  assert.equal(small.cost, 79);          // 40 sf still ships a pallet
  assert.equal(freightParts({ f, smallSf: 0, largeSf: 496, pieces: 0 })[0].qty, 1);
  assert.equal(freightParts({ f, smallSf: 0, largeSf: 497, pieces: 0 })[0].qty, 2);
  assert.equal(freightParts({ f, smallSf: 0, largeSf: 992, pieces: 0 })[0].cost, 158);
});

test("large format with no large rate falls onto the per-foot table", () => {
  const f = normFreight({ ...GLAZZIO, largeRate: 0 });
  const parts = freightParts({ f, smallSf: 50, largeSf: 50, pieces: 0 });
  assert.equal(parts.length, 1);
  assert.equal(parts[0].basis, "small");
  assert.equal(parts[0].cost, 99);       // both lots priced together at $0.99
});

test("trims: $0.33 a piece with their own minimum", () => {
  const f = normFreight(GLAZZIO);
  const many = freightParts({ f, smallSf: 0, largeSf: 0, pieces: 100 })[0];
  assert.equal(many.basis, "piece");
  assert.equal(many.cost, 33);
  assert.equal(freightParts({ f, smallSf: 0, largeSf: 0, pieces: 10 })[0].cost, 14.85);
});

test("the three tables bill side by side on one order", () => {
  const f = normFreight(GLAZZIO);
  const parts = freightParts({ f, smallSf: 100, largeSf: 600, pieces: 60 });
  assert.deepEqual(parts.map((x) => x.basis), ["large", "small", "piece"]);
  assert.deepEqual(parts.map((x) => x.cost), [158, 99, 19.8]);
});

test("freightTally: ordered footage, per book, only for opted-in rows", () => {
  const books = [book(), book(GLAZZIO, "vtc", "Virginia Tile")];
  const p = proj([
    tile({ L: "24", W: "24", qty: "200" }),                       // large
    tile({ L: "12", W: "24", qty: "100" }),                       // small — Glazzio's line is ABOVE 12x24
    tile({ L: "12", W: "12", qty: "500", freight: "off" }),       // waived
    { ...newProduct(), type: "misc", qtyType: "count", qty: "8", bookId: "glz" },
    tile({ L: "12", W: "12", qty: "300", bookId: "vtc" }),        // a second vendor's truck
    tile({ L: "12", W: "12", qty: "400", bookId: "" }),           // hand-entered, no book
  ]);
  const t = freightTally(p, s, books);
  assert.equal(t.length, 2);
  const g = t.find((x) => x.book.id === "glz");
  assert.equal(g.largeSf, 200);
  assert.equal(g.smallSf, 100);
  assert.equal(g.pieces, 8);
  assert.equal(t.find((x) => x.book.id === "vtc").smallSf, 300);
});

test("freightTally: a carton-sold row ships the whole cartons the estimate bills", () => {
  // 100 sf over 22.5 sf/carton = 4.44 → 5 cartons = 112.5 sf on the truck.
  const p = proj([tile({ L: "12", W: "12", qty: "100", cartonSf: "22.5" })]);
  assert.equal(freightTally(p, s, [book()])[0].smallSf, 112.5);
});

test("a book with no program never charges freight", () => {
  const p = proj([tile({ L: "12", W: "12", qty: "100" })]);
  assert.deepEqual(freightList(p, s, [book({ mode: "none" })]), []);
  assert.deepEqual(freightList(p, s, []), []);
});

test("freightList: one line per book, and the master switch is the whole answer", () => {
  const p = proj([tile({ L: "24", W: "24", qty: "600" }), tile({ L: "12", W: "12", qty: "50" })]);
  const [line] = freightList(p, s, [book()]);
  assert.equal(line.book, "Glazzio");
  assert.equal(line.destination, "Ohio");
  assert.equal(line.cost, 207.5);                                // 2 pallets ($158) + 50 sf ($49.50)
  assert.equal(freightSummary(line), "2 pallets · 50 sf");
  assert.equal(freightTotal(freightList(p, s, [book()])), 207.5);
  assert.deepEqual(freightList({ ...p, freight: false }, s, [book()]), []);
  assert.equal(normC({ ...p, freight: false }).freight, false);
  assert.equal(normC(p).freight, true);                          // absent field = on
});

// The bug this rule fixed: 620 sf of plain 12x24 was quoting two $79 large-format
// pallets ($158) when Glazzio bills it by the foot — $613.80, past the $149
// threshold, so two pallets of the flat-rate program.
test("a 12x24 job prices on the per-foot table, not the large-format pallet", () => {
  const [line] = freightList(proj([tile({ L: "12", W: "24", qty: "620" })]), s, [book()]);
  assert.deepEqual(line.parts.map((x) => x.basis), ["pallet"]);
  assert.equal(line.cost, 298);
  // The same footage in Harmonic is the sheet's named exception: $79 pallets.
  const harmonic = freightList(proj([tile({ L: "12", W: "24", qty: "620", brandColor: "Harmonic — Pearl" })]), s, [book()])[0];
  assert.deepEqual(harmonic.parts.map((x) => x.basis), ["large"]);
  assert.equal(harmonic.cost, 158);
});

test("freightOrderRows: special-order lines, by description, never marked up", () => {
  const p = proj([tile({ L: "24", W: "24", qty: "600" })]);
  const [line] = freightList(p, s, [book()]);
  const [row] = freightOrderRows(line, 30);
  assert.equal(row.special, true);
  assert.equal(row.byDesc, true);                                // no SKU for the desk to key
  assert.equal(row.name, "Freight — Glazzio large format");   // every part names its own table
  assert.equal(row.qty, 2);
  assert.equal(row.unitCode, "PLT");
  assert.equal(row.perCost, 79);
  assert.equal(row.perSell, row.perCost);                        // charged at cost
  assert.ok(row.desc.main.length > 0);
});
