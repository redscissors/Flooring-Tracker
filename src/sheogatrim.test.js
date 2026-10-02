import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSX from "xlsx";
import {
  TRIM_PROFILES, TRIM_SPECIES, isSheogaAccessorySheet, parseAccessorySheet, diffAccessorySheets,
  TRIM_LENGTHS, DEFAULT_TRIM_MARKUP, trimFromFloor, effectiveTrimCfg, calcTrim, trimLineItems,
  trimRates, trimUnitCost, trimSellTotal, trimEntryView,
} from "./sheogatrim.js";
import { defaultConfig, sellOf } from "./sheoga.js";

const load = (file = "sheoga-accessory-20261001.xlsx") => {
  const wb = XLSX.read(fs.readFileSync(new URL("./testdata/" + file, import.meta.url)));
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
  assert.deepEqual(sheet.tex, { nose35: 2, nose55: 2, shoe: null, reducer: null, tmold: null });
  assert.deepEqual(Object.keys(sheet.species), TRIM_SPECIES);
  assert.equal("plugs" in sheet, false);
});

test("parse: a sheet without a Texture row", () => {
  const { sheet, problems } = parseAccessorySheet(load("sheoga-accessory-20261001-notexture.xlsx"));
  assert.deepEqual(problems, []);
  assert.deepEqual(sheet.tex, { nose35: null, nose55: null, shoe: null, reducer: null, tmold: null });
  const { tex, ...rest } = parseAccessorySheet(load()).sheet;
  const { tex: none, ...restOld } = sheet;
  assert.deepEqual(restOld, rest);
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

test("diff: names a slip tongue bundle change", () => {
  const prev = parseAccessorySheet(load()).sheet;
  const next = structuredClone(prev);
  next.slip.bundleLf = 40;
  assert.deepEqual(diffAccessorySheets(prev, next), [{ label: "Slip tongue bundle", from: 50, to: 40 }]);
});

test("detect: the title must sit in a sheet's first 15 rows", () => {
  for (const f of ["sheoga-accessory-20261001.xlsx", "sheoga-accessory-20261001-notexture.xlsx"])
    assert.equal(isSheogaAccessorySheet(load(f)), true, f);
  const sheets = load();
  const rows = sheets[0].rows;
  const at = rows.findIndex((r) => (r || []).some((v) => typeof v === "string" && /sheoga accessory pricing/i.test(v)));
  assert.ok(at >= 0 && at < 15);
  const pushed = [{ ...sheets[0], rows: [...Array.from({ length: 15 }, () => []), ...rows] }];
  assert.equal(isSheogaAccessorySheet(pushed), false);
  assert.deepEqual(parseAccessorySheet(pushed).problems, ["Not Sheoga's accessory pricing sheet"]);
});

test("diff: names texture changes", () => {
  const prev = parseAccessorySheet(load()).sheet;
  const next = structuredClone(prev);
  next.tex.nose35 = 2.5;
  next.tex.shoe = 1;
  assert.deepEqual(diffAccessorySheets(prev, next), [
    { label: 'Textured — Nosing 3½"', from: 2, to: 2.5 },
    { label: "Textured — Shoe mold", from: null, to: 1 },
  ]);
});

// --- pricing engine -----------------------------------------------------------

const book = (file) => ({ sheet: parseAccessorySheet(load(file)).sheet });
const wo = () => ({ ...defaultConfig("trim"), sp: "White Oak", prefin: true, stain: "Toasted Acorn", sheen: "30" });
const run = (n, len) => ({ n, len });

test("trim: constants and default config", () => {
  assert.deepEqual(TRIM_LENGTHS, [3, 4, 5, 6, 7, 8, 9, 10, 12]);
  assert.equal(DEFAULT_TRIM_MARKUP, 100);
  assert.deepEqual(defaultConfig("trim"), {
    match: true, sp: "White Oak", prefin: false, stain: "", stainCustom: false,
    sheen: "30", sheenCustom: false, tex: "smooth",
    runs: { nose35: [{ n: 0, len: 8 }], nose55: [{ n: 0, len: 8 }], shoe: [{ n: 0, len: 8 }] },
    reducer: 0, tmold: 0, slip: 0,
  });
});

test("calcTrim: White Oak prefinished pieces", () => {
  const cfg = { ...wo(), runs: { nose35: [run(2, 6)], nose55: [run(0, 8)], shoe: [run(15, 8), run(30, "rl")] }, tmold: 2, slip: 1 };
  const b = calcTrim(cfg, book());
  assert.deepEqual(b.lines.map((l) => [l.profile, l.unit, l.qty, l.unitCost]), [
    ["nose35", "pc", 2, 49.56],
    ["shoe", "pc", 15, 25.68],
    ["shoe", "lf", 30, 3.21],
    ["tmold", "pc", 2, 32.08],
    ["slip", "bdl", 1, 20],
  ]);
  assert.deepEqual(b.lines.map((l) => sellOf(l.unitCost, 100)), [99.12, 51.36, 6.42, 64.16, 40]);
  assert.equal(b.sp, "White Oak");
  assert.equal(b.finishText, "Prefinished Toasted Acorn · 30 sheen");
  assert.equal("texBlocked" in b, false);
  assert.ok(b.lines.every((l) => l.textured === false));
});

test("calcTrim: unfinished Red Oak reducer", () => {
  const cfg = { ...defaultConfig("trim"), sp: "Red Oak", reducer: 1 };
  const b = calcTrim(cfg, book());
  assert.equal(b.lines.length, 1);
  assert.equal(b.lines[0].unitCost, 13.36);
  assert.equal(b.lines[0].len, 8);
  assert.equal(b.finishText, "Unfinished");
  assert.ok(!b.lines[0].rows.some(([label]) => /prefinished/i.test(label)));
});

test("calcTrim: texture is priced from the sheet; untexturable pieces ship smooth", () => {
  const cfg = {
    ...wo(), tex: "sawcut",
    runs: { nose35: [run(2, 6)], nose55: [], shoe: [run(15, 8)] }, tmold: 2, reducer: 1, slip: 1,
  };
  const b = calcTrim(cfg, book());
  assert.equal("texBlocked" in b, false);
  const [nose, shoe, reducer, tmold, slip] = b.lines;
  assert.equal(nose.lfCost, 10.26);
  assert.equal(nose.unitCost, 61.56);
  assert.equal(nose.textured, true);
  assert.ok(nose.rows.some((r) => r[0] === "Textured — Saw Cut" && r[1] === "+$2.00 /lf"));
  assert.equal(shoe.unitCost, 25.68);
  assert.equal(shoe.textured, false);
  assert.ok(shoe.rows.some((r) => r[0] === "Smooth — can't be textured" && r[1] === ""));
  for (const l of [reducer, tmold]) {
    assert.equal(l.textured, false);
    assert.ok(l.rows.some((r) => r[0] === "Smooth — can't be textured"));
  }
  assert.ok(!slip.rows.some((r) => /textured|smooth/i.test(r[0])));

  const items = trimLineItems(cfg, book(), 100);
  assert.equal(items.length, 5);
  assert.ok(items[0].brandColor.endsWith(" · Saw Cut"));
  assert.ok(!items[1].brandColor.includes("Saw Cut"));
});

test("parse + calcTrim: texture is never free — a 0 or negative Texture cell means can't be textured", () => {
  const sheets = load();
  const [row, c] = cell(sheets, "Texture Charge");
  row[c + 1] = 0;
  row[c + 2] = -1;
  const { sheet, problems } = parseAccessorySheet(sheets);
  assert.deepEqual(problems, []);
  assert.deepEqual(sheet.tex, { nose35: null, nose55: null, shoe: null, reducer: null, tmold: null });
  const cfg = { ...wo(), tex: "sawcut", runs: { nose35: [run(1, 8)], nose55: [run(1, 8)], shoe: [] } };
  for (const l of calcTrim(cfg, { sheet }).lines) {
    assert.equal(l.textured, false);
    assert.ok(l.rows.some((r) => r[0] === "Smooth — can't be textured"));
  }
});

test("calcTrim: with no Texture row on the sheet every piece ships smooth", () => {
  const cfg = { ...wo(), tex: "sawcut", runs: { nose35: [run(1, 8)], nose55: [run(1, 8)], shoe: [run(1, 8)] }, tmold: 1, reducer: 1 };
  const b = calcTrim(cfg, book("sheoga-accessory-20261001-notexture.xlsx"));
  assert.equal(b.lines.length, 5);
  for (const l of b.lines) {
    assert.equal(l.textured, false);
    assert.ok(l.rows.some((r) => r[0] === "Smooth — can't be textured"));
  }
  assert.equal(trimLineItems(cfg, book("sheoga-accessory-20261001-notexture.xlsx"), 100).length, 5);
});

test("calcTrim: junk quantities clamp", () => {
  const cfg = { ...wo(), runs: { nose35: [run(-3, 6), run(2.7, 11), run("", 8)], nose55: [], shoe: [] } };
  const b = calcTrim(cfg, book());
  assert.equal(b.lines.length, 1);
  assert.equal(b.lines[0].qty, 2);
  assert.equal(b.lines[0].len, 8);
  const json = JSON.stringify(b);
  assert.ok(!json.includes("NaN"));
  assert.ok(!json.includes('"unitCost":null'));
});

test("calcTrim: no sheet", () => {
  assert.equal(calcTrim(wo(), null), null);
  assert.equal(calcTrim(wo(), {}), null);
});

test("trimLineItems: rows and markers", () => {
  const cfg = { ...wo(), runs: { nose35: [run(2, 6)], nose55: [], shoe: [run(30, "rl")] }, tmold: 2, slip: 1 };
  const items = trimLineItems(cfg, book(), 100);
  assert.deepEqual(items[0].sheoga, { mode: "trim", cfg: { ...cfg, match: false } });
  assert.deepEqual(items[1].sheoga, { mode: "trim", part: true });
  for (const it of items) {
    assert.equal(it.type, "hardwood");
    assert.equal(it.qtyType, "count");
    assert.equal(it.sku, "");
  }
  assert.equal(items[0].sellUnit, "PC");
  assert.equal(items[0].qty, "2");
  assert.equal(items[0].priceSqft, "99.12");
  assert.equal(items[0].costSqft, "49.56");
  assert.equal(items[0].markupPct, "100");
  assert.equal(items[0].sizeText, '3½"');
  assert.equal(items[0].brandColor, 'Sheoga Rabbeted nosing · 6\' pcs · White Oak · Prefinished Toasted Acorn · 30 sheen');
  assert.equal(items[1].sellUnit, "LF");
  assert.ok(items[1].brandColor.includes("random lengths"));
  assert.equal(items.find((i) => i.sellUnit === "BDL").brandColor, "Sheoga Slip tongue · 50 lf bundle");
  assert.equal(items.find((i) => i.sellUnit === "BDL").sizeText, "");
  assert.ok(items.find((i) => i.sellUnit === "BDL" ).sheoga.part);
  assert.ok(items.find((i) => i.brandColor.includes("T-mold")).brandColor.includes("8' pcs"));
});

test("trimLineItems: every piece's size reads exactly once in size + description", () => {
  const cfg = { ...wo(), runs: { nose35: [run(1, 6)], nose55: [run(1, 8)], shoe: [run(1, 8)] }, reducer: 1, tmold: 1, slip: 1 };
  const items = trimLineItems(cfg, book(), 100);
  const b = calcTrim(cfg, book());
  assert.equal(items.length, 6);
  for (const [i, it] of items.entries()) {
    const p = TRIM_PROFILES.find((x) => x.id === b.lines[i].profile);
    if (!p) continue;
    const text = it.sizeText + " " + it.brandColor;
    assert.equal(text.split(p.size).length - 1, 1, text);
    assert.ok(it.brandColor.startsWith("Sheoga " + p.label + " · "), it.brandColor);
  }
  assert.deepEqual(items.slice(0, 2).map((i) => i.sizeText), ['3½"', '5½"'], "the two nosings differ by size");
  assert.ok(b.lines[0].desc.startsWith('Rabbeted nosing 3½" · '), "the build card keeps the sized name");
});

test("trimFromFloor: floor, stocked, finish and non-matches", () => {
  const floor = { mode: "floor", cfg: { sp: "Live Sawn White Oak", tex: "sawcut", finish: "est", stain: "Cattail", sheen: "20" } };
  assert.deepEqual(trimFromFloor(floor), { sp: "White Oak", prefin: true, stain: "Cattail", stainCustom: false, sheen: "20", sheenCustom: false, tex: "sawcut" });
  const stocked = trimFromFloor({ mode: "stocked", cfg: { sp: "Hickory", color: "Cattail · Saw Cut", sheen: "20" } });
  assert.equal(stocked.sp, "Hickory");
  assert.equal(stocked.prefin, true);
  assert.equal(stocked.stain, "Cattail");
  assert.equal(stocked.tex, "sawcut");
  const unf = trimFromFloor({ mode: "floor", cfg: { sp: "Red Oak", tex: "smooth", finish: "unf", stain: "Cattail", sheen: "30" } });
  assert.equal(unf.prefin, false);
  assert.equal(unf.stain, "");
  assert.equal(trimFromFloor({ mode: "floor", cfg: { sp: "Red Oak", finish: "nat" } }).stain, "Natural");
  const custom = trimFromFloor({ mode: "floor", cfg: { sp: "Red Oak", finish: "t1", stain: "My Gray" } });
  assert.deepEqual([custom.prefin, custom.stain, custom.stainCustom], [true, "My Gray", true]);
  assert.equal("sp" in trimFromFloor({ mode: "floor", cfg: { sp: "Exotic", finish: "unf" } }), false);
  assert.equal(trimFromFloor({ mode: "vent", cfg: { sp: "White Oak" } }), null);
  assert.equal(trimFromFloor(null), null);
  const ownSheen = trimFromFloor({ mode: "floor", cfg: { sp: "Red Oak", finish: "est", stain: "Cattail", sheen: "25", sheenCustom: true } });
  assert.deepEqual([ownSheen.sheen, ownSheen.sheenCustom], ["25", true]);
  assert.equal(trimFromFloor(floor).sheenCustom, false);
  const picked = effectiveTrimCfg({ ...defaultConfig("trim"), match: true }, { mode: "floor", cfg: { sp: "Red Oak", finish: "est", stain: "Cattail", sheen: "25", sheenCustom: true } });
  assert.deepEqual([picked.sheen, picked.sheenCustom], ["25", true], "Pick my own keeps the custom sheen in the picker");
});

test("effectiveTrimCfg: match applies the floor patch", () => {
  const floor = { mode: "floor", cfg: { sp: "Live Sawn White Oak", tex: "sawcut", finish: "est", stain: "Cattail", sheen: "20" } };
  const on = effectiveTrimCfg({ ...defaultConfig("trim"), sp: "Maple", match: true }, floor);
  assert.equal(on.sp, "White Oak");
  assert.equal(on.match, false);
  const off = effectiveTrimCfg({ ...defaultConfig("trim"), sp: "Maple", match: false }, floor);
  assert.equal(off.sp, "Maple");
  assert.equal(off.match, false);
});

test("trimRates: per-lf cost before any quantity, matching calcTrim", () => {
  const cfg = { ...wo(), tex: "sawcut" };
  const r = trimRates(cfg, book());
  assert.equal(r.nose35.lfCost, 10.26);
  assert.deepEqual([r.nose35.textured, r.nose35.smoothOnly], [true, false]);
  assert.deepEqual([r.shoe.textured, r.shoe.smoothOnly], [false, true]);
  assert.equal(r.tmold.lfCost, 4.01);
  assert.deepEqual(r.slip, { lfCost: 0.4, bundleLf: 50, unitCost: 20 });
  const smooth = trimRates(wo(), book());
  assert.equal(smooth.nose35.smoothOnly, false);
  assert.equal(smooth.shoe.smoothOnly, false);
  assert.equal(trimRates(wo(), null), null);
  assert.equal(trimRates({ ...wo(), sp: "Teak" }, book()), null);
});

test("trimUnitCost: a run's piece cost, random lengths per lf, junk length as 8'", () => {
  assert.equal(trimUnitCost(8.26, 6), 49.56);
  assert.equal(trimUnitCost(8.26, "rl"), 8.26);
  assert.equal(trimUnitCost(8.26, 11), 66.08);
});

test("calcTrim: qty math per unit", () => {
  const cfg = { ...wo(), runs: { nose35: [run(1, 6)], nose55: [], shoe: [run(15, 8), run(30, "rl")] }, tmold: 2, slip: 2 };
  assert.deepEqual(calcTrim(cfg, book()).lines.map((l) => l.math), [
    "1 pc × 6' = 6 lf", "15 pcs × 8' = 120 lf", "30 lf · Sheoga picks lengths", "2 pcs × 8' = 16 lf", "2 bundles = 100 lf",
  ]);
});

test("trimSellTotal / trimEntryView: priced through the given sell, lines retail", () => {
  const cfg = { ...wo(), runs: { nose35: [run(2, 6)], nose55: [], shoe: [run(15, 8)] }, tmold: 2, slip: 1 };
  const b = calcTrim(cfg, book());
  assert.equal(trimSellTotal(b, (c) => sellOf(c, 100)), 99.12 * 2 + 51.36 * 15 + 64.16 * 2 + 40);
  const v = trimEntryView(cfg, book(), 100);
  assert.equal(v.title, "Sheoga trim — White Oak");
  assert.equal(v.meta, "4 lines");
  assert.equal(v.price, trimSellTotal(b, (c) => sellOf(c, 100)));
  assert.equal(v.lines().length, 4);
  const half = trimEntryView(cfg, book(), 100, (c) => sellOf(c, 100) / 2);
  assert.equal(half.lines()[0].priceSqft, "99.12");
  assert.ok(half.price < v.price);
  const none = trimEntryView(cfg, null, 100);
  assert.deepEqual([none.title, none.meta, none.price, none.lines().length], ["Sheoga trim — White Oak", "Sheet not uploaded", 0, 0]);
});
