import { test } from "node:test";
import assert from "node:assert/strict";
import { fileFormat, computeFingerprint, mappingMatchesFile, routeFile, bundleByBook, sourceSlot, mergeSources, missingSources } from "./dropimport.js";

const stockSheets = [{ name: "Grout & Caulk", rows: [] }, { name: "Tile", rows: [] }, { name: "Index", rows: [] }];
const vtcSheets = [{ name: "EFT", rows: [
  ["Item Code", "VTC Mfg", "Description", "Dealer Price"],
  ["ABC123", "Marazzi", "Oak 12X24", 3.29],
] }];
const vtcMapping = { sheet: "EFT", headerRow: 0, columns: { 0: "sku", 1: "mfg", 2: "description", 3: "cost" }, skuPattern: "^[A-Z0-9]{6,20}$" };

test("fileFormat: stock signature, VTC EFT, generic xlsx, generic pdf", () => {
  assert.equal(fileFormat({ sheets: stockSheets }), "stock");
  assert.equal(fileFormat({ sheets: vtcSheets }), "vtc-eft");
  assert.equal(fileFormat({ sheets: [{ name: "S", rows: [["Name", "Price"], ["Oak", 5]] }] }), "generic");
  assert.equal(fileFormat({ pages: [], isPdf: true }), "generic");
});

// The OVF banded books (issue 025): each is told apart by its grid signature —
// KEIM account line + SPECIES/COLOR header (Hallmark) or Tarkett banner +
// Design header (Tarkett). A flat OVF sheet (Sika/Stauf) stays generic.
const hallmarkSheets = [{ name: "Hallmark", rows: [
  ["Prepared especially for KEIM LUMBER CO"],
  ["Alta Vista Collection"],
  ["SPECIES / COLOR", "NEW ITEM #", "", "OLD ITEM #", "STAIR NOSING 82\"", "T-MOLD 82\""],
  ["EUROPEAN WHITE OAK", "$7.29", "", "$7.29", "$111.49", "$73.59"],
  ["Balboa", "AV75OBALC", "", "AV75OBAL", "AV75OBALSN", "AV75OBALTM"],
] }];
const tarkettSheets = [{ name: "Tarkett LVT", rows: [
  ["Prepared especially for KEIM LUMBER CO"],
  ["Tarkett EverGen™"],
  ["Plank Size 7\" x 60\"  •  9 PC/CT  •  26.25 SF/CT"],
  ["Design", "Item #", "Quarter Round (94\")"],
  ["$3.97/SF", "$104.15/CT", "$15.18/EA"],
  ["Endless Maple Bourbon", "270311021", "335013221"],
] }];

const sundriesSheets = [{ name: "DriTac", rows: [
  ["Prepared especially for KEIM LUMBER CO"],
  [" RESILIENT FLOORING ADHESIVE", "Size", "SF Coverage", "Weight", "Item #", "Price"],
  ["Sika 5900", "1 GA", "1,000 per pail", "10 LB", "SIK831394", " $30.89 / EA "],
] }];

test("fileFormat: each OVF layout gets its own tag", () => {
  assert.equal(fileFormat({ sheets: hallmarkSheets }), "ovf-hallmark");
  assert.equal(fileFormat({ sheets: tarkettSheets }), "ovf-tarkett");
  assert.equal(fileFormat({ sheets: sundriesSheets }), "ovf-sundries");
  // A sheet with the OVF account line but no section header is still generic.
  assert.equal(fileFormat({ sheets: [{ name: "X", rows: [
    ["Prepared especially for KEIM LUMBER CO"],
    ["Adhesive", "Size", "Coverage", "Weight", "Code", "Cost"],
  ] }] }), "generic");
});

test("routeFile: an OVF sundries book routes by its stamped format tag", () => {
  const sun = { id: "sun", name: "OVF Sika", data: { importFingerprint: { format: "ovf-sundries" } } };
  const hall = { id: "hall", name: "Hallmark Wood", data: { importFingerprint: { format: "ovf-hallmark" } } };
  assert.equal(routeFile({ format: "ovf-sundries", headerSig: "", sheets: sundriesSheets }, [sun, hall]).target, "sun");
});

test("routeFile: an OVF book routes by its stamped format tag", () => {
  const hall = { id: "hall", name: "Hallmark Wood", data: { importFingerprint: { format: "ovf-hallmark" } } };
  const tark = { id: "tark", name: "Tarkett LVT", data: { importFingerprint: { format: "ovf-tarkett" } } };
  const r = routeFile({ format: "ovf-hallmark", headerSig: "", sheets: hallmarkSheets }, [hall, tark]);
  assert.equal(r.target, "hall");
  assert.match(r.reason, /OVF Hallmark wood/);
  assert.equal(routeFile({ format: "ovf-tarkett", headerSig: "", sheets: tarkettSheets }, [hall, tark]).target, "tark");
  // No matching book yet ⇒ ask, naming the recognized format.
  const ask = routeFile({ format: "ovf-tarkett", headerSig: "", sheets: tarkettSheets }, [hall]);
  assert.equal(ask.target, null);
  assert.match(ask.reason, /OVF Tarkett LVT/);
});

test("computeFingerprint: format tag + order-independent header signature", () => {
  const fp = computeFingerprint({ sheets: vtcSheets });
  assert.equal(fp.format, "vtc-eft");
  assert.equal(fp.headerSig, ["dealerprice", "description", "itemcode", "vtcmfg"].sort().join("|"));
  assert.equal(computeFingerprint({ pages: [], isPdf: true }).headerSig, ""); // pdf has no header sig
});

test("mappingMatchesFile: a saved VTC mapping parses the VTC file; a wrong sheet doesn't", () => {
  assert.equal(mappingMatchesFile(vtcMapping, vtcSheets), true);
  assert.equal(mappingMatchesFile({ ...vtcMapping, sheet: "Nope" }, vtcSheets), false);
  assert.equal(mappingMatchesFile(null, vtcSheets), false);
});

test("routeFile: stock is deterministic and needs no book", () => {
  assert.equal(routeFile({ format: "stock", headerSig: "", sheets: stockSheets }, []).target, "stock");
});

test("routeFile: one VTC book by fingerprint ⇒ confident; two ⇒ ask", () => {
  const b1 = { id: "b1", name: "VTC Core", data: { importFingerprint: { format: "vtc-eft" } } };
  const b2 = { id: "b2", name: "VTC SO", data: { importFingerprint: { format: "vtc-eft" } } };
  assert.equal(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b1]).target, "b1");
  assert.equal(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b1, b2]).target, null);
  assert.deepEqual(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b1, b2]).candidates.sort(), ["b1", "b2"]);
});

// Virginia Tile's EFT template is identical across the brands it distributes;
// only the title line above the header names the price list.
const eftSheets = (title) => [{ name: "MFG Data", rows: [
  ["Account Name:  KEIM LUMBER CO"],
  [],
  [title],
  [],
  ["Item Code", "VTC Mfg", "Description", "Dealer Price"],
  ["ABC123", "ANA", "Oak 12X24", 3.29],
] }];

test("computeFingerprint: EFT brand title above the header becomes the title signature", () => {
  const fp = computeFingerprint({ sheets: eftSheets("Anatolia  Tile") });
  assert.equal(fp.format, "vtc-eft");
  assert.equal(fp.title, "Anatolia  Tile");
  assert.equal(fp.titleSig, "anatolia tile");
  assert.equal(computeFingerprint({ sheets: vtcSheets }).titleSig, ""); // nothing above the header
});

test("routeFile: sibling EFT files route by brand title, not just the shared format", () => {
  const core = { id: "core", name: "VTC Core", data: { importFingerprint: { format: "vtc-eft", titleSig: "virginia tile core" }, mapping: { ...vtcMapping, sheet: "MFG Data", headerRow: 4 } } };
  const ana = { id: "ana", name: "Anatolia", data: { importFingerprint: { format: "vtc-eft", titleSig: "anatolia tile" } } };
  const file = { format: "vtc-eft", headerSig: "", titleSig: "anatolia tile", sheets: eftSheets("Anatolia Tile") };
  // Core's saved mapping parses the Anatolia file (same template) — the title
  // mismatch still keeps it out.
  assert.equal(routeFile(file, [core, ana]).target, "ana");
  // No book carries this brand ⇒ every titled EFT book is excluded, ask.
  const hc = { ...file, titleSig: "vtc home collection", sheets: eftSheets("VTC Home Collection") };
  assert.equal(routeFile(hc, [core, ana]).target, null);
  assert.deepEqual(routeFile(hc, [core, ana]).candidates, []);
});

test("routeFile: a title match outranks a pre-title EFT book's format-only match", () => {
  const old = { id: "old", name: "VTC (pre-title)", data: { importFingerprint: { format: "vtc-eft" } } };
  const ana = { id: "ana", name: "Anatolia", data: { importFingerprint: { format: "vtc-eft", titleSig: "anatolia tile" } } };
  const file = { format: "vtc-eft", headerSig: "", titleSig: "anatolia tile", sheets: eftSheets("Anatolia Tile") };
  assert.equal(routeFile(file, [old, ana]).target, "ana");
});

test("routeFile: a pre-fingerprint book is matched by its saved mapping", () => {
  const b = { id: "b1", name: "VTC Core", data: { mapping: vtcMapping } };
  assert.equal(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b]).target, "b1");
});

test("routeFile: nothing matches ⇒ null target, empty candidates", () => {
  const r = routeFile({ format: "generic", headerSig: "x", sheets: [{ name: "S", rows: [["Name"], ["Oak"]] }] }, []);
  assert.equal(r.target, null);
  assert.deepEqual(r.candidates, []);
});

// --- bundling a drop by book (ADR 0025) --------------------------------------

const dropRow = (name, target, format = "generic") => ({ file: { name }, target, format });

// A vendor that merely SPLITS its list across files (a batch download of a
// book's sheets): each file maps itself, the items accumulate, and only the last
// step applies.
test("bundleByBook walks a book's files back to back and marks the last one", () => {
  const steps = bundleByBook([
    dropRow("east.xls", "bkSplit"),
    dropRow("hallmark.xls", "bkHallmark"),
    dropRow("west.xls", "bkSplit"),
    dropRow("north.xls", "bkSplit"),
  ]);
  // The split book's three files are adjacent even though the drop interleaved them.
  assert.deepEqual(steps.map((s) => s.row.file.name), [
    "east.xls", "west.xls", "north.xls", "hallmark.xls",
  ]);
  assert.deepEqual(steps.map((s) => `${s.bundle.index + 1}/${s.bundle.total}`), ["1/3", "2/3", "3/3", "1/1"]);
  // Every step of a bundle knows the whole set, so the last can report them all.
  assert.deepEqual(steps[0].files.map((f) => f.name), ["east.xls", "west.xls", "north.xls"]);
  assert.deepEqual(steps.map((s) => s.joined), [null, null, null, null]);
});

// A vendor whose files must be JOINED is different in kind: accumulating items
// across separate steps cannot join them, because by then each file has been
// reduced to rows of its own. So the whole set becomes ONE step (ADR 0025 rule 7).
test("a joined vendor's files collapse into a single step holding all of them", () => {
  const steps = bundleByBook([
    dropRow("mirage-hardwood.xls", "bkMirage", "mirage-flooring"),
    dropRow("hallmark.xls", "bkHallmark", "ovf-hallmark"),
    dropRow("chart.pdf", "bkMirage", "mirage-chart"),
    dropRow("trim.xls", "bkMirage", "mirage-trim"),
  ]);
  assert.equal(steps.length, 2);
  const mirage = steps.find((s) => s.joined);
  assert.equal(mirage.joined, "mirage");
  assert.deepEqual(mirage.bundle, { index: 0, total: 1 }); // one pass, so it applies immediately
  assert.deepEqual(mirage.rows.map((r) => r.file.name), ["mirage-hardwood.xls", "chart.pdf", "trim.xls"]);
  assert.deepEqual(mirage.files.map((f) => f.name), ["mirage-hardwood.xls", "chart.pdf", "trim.xls"]);
  // The unrelated book is untouched by any of this.
  assert.equal(steps.find((s) => s.row.file.name === "hallmark.xls").joined, null);
});

// One file of a joined vendor is still that vendor: the parser wants the set,
// and the completeness gate is what says the rest are missing.
test("a lone file from a joined vendor still takes the joined path", () => {
  const [step] = bundleByBook([dropRow("chart.pdf", "bkMirage", "mirage-chart")]);
  assert.equal(step.joined, "mirage");
  assert.deepEqual(step.bundle, { index: 0, total: 1 });
});

test("bundleByBook leaves the single-file case exactly as it was", () => {
  const steps = bundleByBook([dropRow("a.xls", "bkA"), dropRow("b.xls", "bkB")]);
  assert.deepEqual(steps.map((s) => s.row.file.name), ["a.xls", "b.xls"]);
  assert.deepEqual(steps.map((s) => s.bundle), [{ index: 0, total: 1 }, { index: 0, total: 1 }]);
  assert.deepEqual(bundleByBook([]), []);
  assert.deepEqual(bundleByBook(null), []);
});

// Stock files share the reserved "stock" target, so they group like any book.
// NOTE: grouping is all they get — the stock path (importStockFile) applies each
// file on its own, so two shop workbooks in one drop still retire each other.
// Out of scope for ADR 0025, which covers price books; recorded so the grouping
// here isn't mistaken for a fix.
test("bundleByBook groups stock files too, though the stock path still applies per file", () => {
  const steps = bundleByBook([dropRow("shop.xlsx", "stock"), dropRow("x.xls", "bkA"), dropRow("shop2.xlsx", "stock")]);
  assert.deepEqual(steps.map((s) => s.row.target), ["stock", "stock", "bkA"]);
  assert.deepEqual(steps.map((s) => s.bundle.total), [2, 2, 1]);
});

// --- the book's source manifest (ADR 0025) -----------------------------------

const fp = (format, headerSig = "", titleSig = "") => ({ format, headerSig, titleSig });

test("a fetched sheet's slot survives the vendor re-dating its filename", () => {
  const feb = sourceSlot({ recordKey: "dancik:vt.com:1044:C000001", name: "AOT EFT 26 02 19" });
  const may = sourceSlot({ recordKey: "dancik:vt.com:1044:C000001", name: "AOT EFT 26 05 20" });
  assert.equal(feb.id, may.id);            // same slot across releases
  assert.equal(feb.kind, "fetch");
  // The manifest keeps one slot and takes the newer filename as its label.
  const manifest = mergeSources(mergeSources([], [feb], 1), [may], 2);
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].label, "AOT EFT 26 05 20");
  assert.equal(manifest[0].lastSeen, 2);
  assert.deepEqual(missingSources(manifest, [may]), []);
});

test("a hand-supplied file matches on content, not on its dated name", () => {
  const q1 = sourceSlot({ fingerprint: fp("mirage-chart"), name: "Mirage_Product_Chart_2026-02.pdf" });
  const q2 = sourceSlot({ fingerprint: fp("mirage-chart"), name: "Mirage_Product_Chart_2026-07.pdf" });
  assert.equal(q1.id, q2.id);
  assert.equal(q1.kind, "manual");
  // A different file kind is a different slot, even from the same vendor.
  const trim = sourceSlot({ fingerprint: fp("ovf-hallmark", "sku|price") });
  assert.notEqual(q1.id, trim.id);
});

test("missingSources names what a partial import is short of", () => {
  const hardwood = sourceSlot({ recordKey: "d:h:1:U", name: "OVF-Mirage-Hardwood.xls" });
  const trim = sourceSlot({ recordKey: "d:h:2:U", name: "OVF-Mirage-Trim.xls" });
  const chart = sourceSlot({ fingerprint: fp("mirage-chart"), name: "Mirage_Product_Chart.pdf" });
  const manifest = mergeSources([], [hardwood, trim, chart], 1);
  const missing = missingSources(manifest, [hardwood, trim]);
  assert.deepEqual(missing.map((s) => s.label), ["Mirage_Product_Chart.pdf"]);
  assert.equal(missing[0].kind, "manual"); // the gate can say "added by hand"
});

test("a one-file book never has anything missing, and a new file just joins", () => {
  const only = sourceSlot({ recordKey: "d:h:9:U", name: "hallmark.xls" });
  const manifest = mergeSources([], [only], 1);
  assert.deepEqual(missingSources(manifest, [only]), []);
  // A book that gains a second file keeps both from then on.
  const extra = sourceSlot({ fingerprint: fp("generic", "a|b"), name: "addendum.xlsx" });
  const grown = mergeSources(manifest, [extra], 2);
  assert.deepEqual(grown.map((s) => s.label), ["hallmark.xls", "addendum.xlsx"]);
  assert.deepEqual(missingSources(grown, [only]).map((s) => s.label), ["addendum.xlsx"]);
});

test("mergeSources never forgets a slot that this import lacked", () => {
  const a = sourceSlot({ recordKey: "d:h:1:U", name: "a.xls" });
  const b = sourceSlot({ recordKey: "d:h:2:U", name: "b.xls" });
  const manifest = mergeSources([], [a, b], 1);
  const afterPartial = mergeSources(manifest, [a], 2);
  assert.deepEqual(afterPartial.map((s) => s.label), ["a.xls", "b.xls"]); // b survives
  assert.equal(afterPartial.find((s) => s.label === "b.xls").lastSeen, 1); // and keeps its age
});

test("each Mirage file gets its own tag, so the chart PDF is not just 'generic'", () => {
  const chartPages = [[{ str: "PRODUCT CHART", x: 282, y: 20, w: 60 }, { str: "TruBalance", x: 329, y: 60, w: 44 }]];
  assert.equal(fileFormat({ pages: chartPages, isPdf: true }), "mirage-chart");
  assert.equal(fileFormat({ sheets: [{ name: "MIR trim", rows: [
    ["USA DISTRIBUTORS - MOLDINGS & STAIR COMPONENTS PRICE LIST"], ['3/4" (TruBalance, Classic)'],
  ] }] }), "mirage-trim");
  assert.equal(fileFormat({ sheets: [{ name: "Mirage", rows: [
    ["USA DISTRIBUTORS - FLOORING PRICE LIST ($/sq. ft.)"], ["Specie", "Grades", 'TruBalance 3/4"'],
  ] }] }), "mirage-flooring");
  // The tags stay distinct so the parser can route each file by kind and a
  // manual source slot can tell the chart from any other PDF — but they all
  // belong to ONE book. ADR 0025 rejected splitting Mirage across books (the
  // chart and the price sheets describe the same products and must be joined),
  // so the tags must not route to separate books.
  const mirage = [{ id: "bk", data: { importFingerprint: { format: "mirage-chart" } } }];
  for (const format of ["mirage-chart", "mirage-trim", "mirage-flooring"]) {
    assert.equal(routeFile({ format, headerSig: "" }, mirage).target, "bk");
  }
  // Two Mirage books is an ambiguity to ask about, never a guess.
  const two = [...mirage, { id: "bk2", data: { importFingerprint: { format: "mirage-trim" } } }];
  assert.equal(routeFile({ format: "mirage-chart", headerSig: "" }, two).target, null);
});

// A book stores ONE import fingerprint, but a joined vendor's files each carry
// their own tag. Matching on the exact tag would route whichever file was
// stamped last and leave its siblings asking which book they belong to.
test("every file of a joined vendor routes to the one book that owns the family", () => {
  const books = [{ id: "bkMirage", name: "Mirage", data: { importFingerprint: { format: "mirage-chart" } } }];
  for (const format of ["mirage-chart", "mirage-flooring", "mirage-trim"]) {
    const r = routeFile({ format, headerSig: "", titleSig: "", sheets: [] }, books);
    assert.equal(r.target, "bkMirage", `${format} should route to the Mirage book`);
  }
  // A different vendor's file is not swept in by the family rule.
  assert.equal(routeFile({ format: "ovf-hallmark", headerSig: "", titleSig: "", sheets: [] }, books).target, null);
});
