import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSX from "xlsx";
import {
  TRIM_PROFILES, TRIM_SPECIES, isSheogaAccessorySheet, parseAccessorySheet, diffAccessorySheets,
} from "./sheogatrim.js";

const load = () => {
  const wb = XLSX.read(fs.readFileSync(new URL("./testdata/sheoga-accessory-20261001.xlsx", import.meta.url)));
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) }));
};
const cell = (sheets, text, nth = 0) => {
  let n = 0;
  for (const s of sheets) for (const row of s.rows) for (let c = 0; c < row.length; c++)
    if (typeof row[c] === "string" && row[c].trim() === text && n++ === nth) return [row, c];
  throw new Error(`no cell ${text}`);
};

test("profiles: fixed ids, order and fixed lengths", () => {
  assert.deepEqual(TRIM_PROFILES.map((p) => p.id), ["nose35", "nose55", "shoe", "reducer", "tmold"]);
  assert.deepEqual(TRIM_PROFILES.filter((p) => p.fixedLen).map((p) => p.id), ["reducer", "tmold"]);
  assert.equal(TRIM_PROFILES.find((p) => p.id === "shoe").size, '½" × ¾"');
});

test("parse: reads the 10/01/26 sheet", () => {
  const { sheet, problems } = parseAccessorySheet(load());
  assert.deepEqual(problems, []);
  assert.equal(sheet.sheetDate, "2026-10-01");
  assert.equal(sheet.species["White Oak"].tmold, 2.16);
  assert.equal(sheet.species["Q/R White Oak"].nose55, 12.31);
  assert.equal(sheet.species["Maple"].shoe, 1.07);
  assert.equal(sheet.species["Red Oak"].nose35, 3.61);
  assert.deepEqual(sheet.prefin, { nose35: 2.4, nose55: 3.75, shoe: 1.85, reducer: 1.85, tmold: 1.85 });
  assert.deepEqual(sheet.slip, { perLf: 0.4, bundleLf: 50 });
  assert.deepEqual(Object.keys(sheet.species), TRIM_SPECIES);
  assert.equal("plugs" in sheet, false);
});

test("parse: a blanked price is a named problem", () => {
  const sheets = load();
  const [row] = cell(sheets, "Walnut");
  row[10] = null;
  const { sheet, problems } = parseAccessorySheet(sheets);
  assert.equal(sheet, null);
  assert.ok(problems.includes("Walnut — T-mold price missing"));
});

test("parse: a renamed block header is a named problem", () => {
  const sheets = load();
  const [row, c] = cell(sheets, "T-Mold");
  row[c] = "T Molding";
  const { sheet, problems } = parseAccessorySheet(sheets);
  assert.equal(sheet, null);
  assert.ok(problems.includes("T-mold block not found"));
});

test("parse: not the accessory sheet", () => {
  const other = [{ name: "x", rows: [["SKU", "Price"], ["A", 1]] }];
  assert.deepEqual(parseAccessorySheet(other), { sheet: null, problems: ["Not Sheoga's accessory pricing sheet"] });
  assert.equal(isSheogaAccessorySheet(other), false);
  assert.equal(isSheogaAccessorySheet(load()), true);
});

test("parse: a text UPDATED date reads the same", () => {
  const sheets = load();
  sheets[0].rows[1][0] = "10/01/2026";
  assert.equal(parseAccessorySheet(sheets).sheet.sheetDate, "2026-10-01");
});

test("diff: names changed prices", () => {
  const prev = parseAccessorySheet(load()).sheet;
  const next = structuredClone(prev);
  next.species["White Oak"].tmold = 2.3;
  next.prefin.shoe = 1.95;
  assert.deepEqual(diffAccessorySheets(prev, next), [
    { label: "White Oak — T-mold", from: 2.16, to: 2.3 },
    { label: "Prefinished — Shoe mold", from: 1.85, to: 1.95 },
  ]);
  assert.deepEqual(diffAccessorySheets(null, next), []);
});
