import { test } from "node:test";
import assert from "node:assert/strict";
import { fileFormat, computeFingerprint, mappingMatchesFile, routeFile } from "./dropimport.js";

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
