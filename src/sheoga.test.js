import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WIDTHS, WIDTH_LABEL, CARTON_SF, UNFINISHED, LIVE_SAWN, LIVE_SAWN_SP, SPECIES,
  TEXTURES, FINISHES, STOCKED, STOCKED_WIDTHS, stockedItem, HERRINGBONE,
  VENT_GROUP, VENT_STD, VENT_FRAMED, VENT_CAR, VENT_3D, VENT_CATS, DAMPERS,
  MODES, defaultConfig, floorWidths, floorBase, gradeName, finishName,
  calcFloor, calcStocked, calcHerringbone, calcVent, calcDamper, calcConfig,
  DEFAULT_MARKUP, DEFAULT_VENT_MARKUP, sellOf, cartonize, lineItems,
  parseQuery, queryHit, querySummary, seedFromQuery, frameLineal,
} from "./sheoga.js";

const floor = (over = {}) => ({ ...defaultConfig("floor"), ...over });

// --- tables -------------------------------------------------------------------

test("unfinished grid: 9 species, arrays index the 7-width run", () => {
  assert.equal(SPECIES.length, 9);
  assert.equal(SPECIES[SPECIES.length - 1], LIVE_SAWN_SP);
  for (const sp of Object.keys(UNFINISHED))
    for (const k of ["clear", "char", "eClear", "eChar"])
      assert.equal(UNFINISHED[sp][k].length, WIDTHS.length, `${sp}.${k}`);
  assert.equal(LIVE_SAWN.solid.length, LIVE_SAWN.ws.length);
  assert.equal(LIVE_SAWN.eng.length, LIVE_SAWN.ws.length);
});

test("engineered has no 2¼\" column; stocked widths per grade", () => {
  for (const sp of Object.keys(UNFINISHED)) {
    assert.equal(UNFINISHED[sp].eClear[0], null, sp);
    assert.equal(UNFINISHED[sp].eChar[0], null, sp);
  }
  for (const it of STOCKED) {
    if (it.clear) assert.equal(it.clear.length, STOCKED_WIDTHS.clear.length, `${it.sp} ${it.color} clear`);
    if (it.char) assert.equal(it.char.length, STOCKED_WIDTHS.char.length, `${it.sp} ${it.color} char`);
  }
});

test("herringbone tables: 4 bands, price rows match the width run", () => {
  for (const cons of ["solid", "eng"])
    for (const [sp, t] of Object.entries(HERRINGBONE[cons])) {
      assert.equal(t.p.length, 4, `${cons} ${sp}`);
      for (const row of t.p) assert.equal(row.length, t.ws.length, `${cons} ${sp}`);
    }
});

test("vent tables: five columns std/CAR, three framed/3D, groups cover 8 species", () => {
  for (const r of [...VENT_STD, ...VENT_CAR]) assert.equal(r.length, 5, r[0]);
  for (const r of [...VENT_FRAMED, ...VENT_3D]) assert.equal(r.length, 3, r[0]);
  assert.equal(Object.keys(VENT_GROUP).length, 8);
  assert.equal(VENT_CATS.length, 6);
});

test("cartons cover the 7 standard widths only", () => {
  for (const w of WIDTHS) assert.ok(CARTON_SF[w] > 0, WIDTH_LABEL[w]);
  assert.equal(CARTON_SF[9.25], undefined);
  assert.equal(CARTON_SF[11.25], undefined);
});

// --- floorBase ----------------------------------------------------------------

test("floorBase reads the grid by species/grade/construction/width", () => {
  assert.equal(floorBase(floor()), 4.35); // White Oak char solid 5¼
  assert.equal(floorBase(floor({ grade: "clear" })), 6.65);
  assert.equal(floorBase(floor({ cons: "eng" })), 5.70);
  assert.equal(floorBase(floor({ cons: "eng", grade: "clear" })), 6.85);
  assert.equal(floorBase(floor({ cons: "eng", w: 2.25 })), null);
  assert.equal(floorBase(floor({ sp: "Beech", w: 6.25 })), null);
  assert.equal(floorBase(floor({ sp: "Nope" })), null);
  assert.equal(floorBase(floor({ w: 9.25 })), null); // 9¼ is Live Sawn only
});

test("floorBase: Live Sawn has its own width run, one grade", () => {
  assert.equal(floorBase(floor({ sp: LIVE_SAWN_SP, w: 11.25 })), 6.50);
  assert.equal(floorBase(floor({ sp: LIVE_SAWN_SP, w: 11.25, cons: "eng" })), null);
  assert.equal(floorBase(floor({ sp: LIVE_SAWN_SP, w: 5.25, cons: "eng" })), 5.25);
  assert.equal(floorBase(floor({ sp: LIVE_SAWN_SP, w: 2.25 })), null);
  assert.deepEqual(floorWidths(floor({ sp: LIVE_SAWN_SP })), LIVE_SAWN.ws);
  assert.deepEqual(floorWidths(floor()), WIDTHS);
});

// --- calcFloor ----------------------------------------------------------------

test("calcFloor: standard-spec cost is the bare base", () => {
  const c = calcFloor(floor(), 1000);
  assert.equal(c.cost, 4.35);
  assert.equal(c.per, "sf");
  assert.equal(c.cartonSf, 20.5);
  assert.equal(c.size, '5¼"');
  // Plain spaces; standard texture/edge/length and the "Unfinished" label are
  // all defaults and omitted — the size lives in c.size, not the description.
  assert.equal(c.desc, '5¼" White Oak Character Solid');
  assert.equal(c.name, 'Sheoga 5¼" White Oak');
  assert.deepEqual(c.fees, []);
  assert.deepEqual(c.warn, ["Made to order · 5–10% overrun · non-returnable"]);
  assert.equal(c.rows.length, 1);
});

test("calcFloor: length % applies to base incl. no-sap, before flat adders", () => {
  const c = calcFloor(floor({ sp: "Walnut", noSap: true, len: "2-8", tex: "oldmill", edge: "pillow" }), 1000);
  // base 5.95 + sap 2.00 → +15% = 1.1925, + 2.50 old mill + 1.00 pillowed
  assert.ok(Math.abs(c.cost - (5.95 + 2 + 7.95 * 0.15 + 2.5 + 1)) < 1e-9);
  assert.ok(c.desc.includes("No sap"));
  assert.ok(c.rows.some(([l]) => l === "No-sap upcharge"));
  assert.ok(c.rows.some(([l]) => l.includes("+15% of base")));
});

test("calcFloor: no-sap only exists for Cherry/Walnut", () => {
  const c = calcFloor(floor({ noSap: true }), 1000); // White Oak
  assert.equal(c.cost, 4.35);
  assert.ok(!c.desc.includes("No sap"));
  assert.equal(calcFloor(floor({ sp: "Cherry", noSap: true }), 1000).cost, 4.05 + 1.0);
});

test("calcFloor: established stain picks its rate from the texture depth", () => {
  const smooth = calcFloor(floor({ finish: "est", stain: "Toasted Acorn" }), 1000);
  assert.equal(smooth.cost, 4.35 + 1.95);
  assert.ok(smooth.desc.includes("Prefinished Toasted Acorn stain"));
  const deep = calcFloor(floor({ finish: "est", tex: "sawcut" }), 1000);
  assert.equal(deep.cost, 4.35 + 1.5 + 2.85);
  assert.ok(deep.desc.includes("(pick stain)"));
});

test("calcFloor: small-order fees are flat fee lines, never in the $/sf", () => {
  const base = 4.35 + 1.65;
  const big = calcFloor(floor({ finish: "nat" }), 600);
  assert.equal(big.cost, base);
  assert.deepEqual(big.fees, []);
  const mid = calcFloor(floor({ finish: "nat" }), 400);
  assert.equal(mid.cost, base);
  assert.deepEqual(mid.fees, [{ label: "Small-order fee — prefinished job under 500 sf", amt: 300 }]);
  const small = calcFloor(floor({ finish: "nat" }), 200);
  assert.deepEqual(small.fees, [{ label: "Small-order fee — prefinished job under 250 sf", amt: 600 }]);
  const unf = calcFloor(floor(), 200); // unfinished never owes the fee
  assert.deepEqual(unf.fees, []);
});

test("calcFloor: custom color wants the $750 sample or warns", () => {
  const warned = calcFloor(floor({ finish: "t2" }), 1000);
  assert.equal(warned.cost, 4.35 + 3.65);
  assert.ok(warned.warn.some((w) => w.includes("$750 color-match sample")));
  assert.deepEqual(warned.fees, []);
  const sampled = calcFloor(floor({ finish: "t2", sample: true, stain: "ClubHouse Brown" }), 1000);
  assert.ok(!sampled.warn.some((w) => w.includes("color-match")));
  assert.deepEqual(sampled.fees, [{ label: "Custom color-match sample — approval bundle shipped", amt: 750 }]);
  assert.ok(sampled.desc.includes("Custom color T-2 “ClubHouse Brown”"));
});

test("calcFloor: Live Sawn 9¼/11¼ carry no carton figure", () => {
  const c = calcFloor(floor({ sp: LIVE_SAWN_SP, w: 11.25 }), 1000);
  assert.equal(c.cartonSf, null);
  assert.ok(c.desc.startsWith('11¼" Live Sawn White Oak Live Sawn'));
  assert.equal(calcFloor(floor({ sp: "Beech", w: 6.25 }), 1000), null);
});

test("calcFloor: length shows only when non-standard; sheen rides prefinished", () => {
  assert.ok(!calcFloor(floor(), 1000).desc.includes("lengths")); // standard 1'–8' omitted
  assert.ok(calcFloor(floor({ len: "2-8" }), 1000).desc.includes("2'–8' lengths"));
  // default sheen 30 on a prefinished finish, and it changes with the config
  assert.ok(calcFloor(floor({ finish: "nat" }), 1000).desc.endsWith("Prefinished Natural 30 sheen"));
  assert.ok(calcFloor(floor({ finish: "nat", sheen: "5" }), 1000).desc.endsWith("Natural 5 sheen"));
  assert.deepEqual(calcFloor(floor({ finish: "nat", sheen: "5" }), 1000).fees, []); // floor sheen is free
});

// --- calcStocked --------------------------------------------------------------

test("calcStocked looks up by species + color, not table position", () => {
  const c = calcStocked({ sp: "White Oak", color: "Natural", grade: "char", w: 5.25 });
  assert.equal(c.cost, 6.00);
  assert.equal(c.cartonSf, 20.5);
  assert.equal(c.desc, '5¼" White Oak Natural Character Stocked prefinished 30 sheen');
  assert.deepEqual(c.warn, ["Stocked item — ships from Sheoga stock"]);
  assert.equal(stockedItem({ sp: "White Oak", color: "Natural" }).sheen, 30);
});

test("calcStocked: off-standard sheen adds a flat $250 fee line, stays at cost", () => {
  const base = { sp: "White Oak", color: "Natural", grade: "char", w: 5.25 }; // standard 30
  assert.deepEqual(calcStocked({ ...base, sheen: "30" }).fees, []);
  const off = calcStocked({ ...base, sheen: "5" });
  assert.equal(off.cost, 6.00); // fee never folds into $/sf
  assert.deepEqual(off.fees, [{ label: "Non-standard sheen — 5-sheen (standard 30)", amt: 250 }]);
  assert.ok(off.desc.endsWith("Stocked prefinished 5 sheen"));
  assert.ok(off.warn[0].includes("made to order"));
  // a product whose standard is 20 (White Oak Caramel) doesn't charge at 20
  assert.deepEqual(calcStocked({ sp: "White Oak", color: "Caramel", grade: "char", w: 5.25, sheen: "20" }).fees, []);
});

test("calcStocked: missing grade/width/color combos are null", () => {
  assert.equal(calcStocked({ sp: "Maple", color: "Frost", grade: "clear", w: 3.25 }), null); // char-only color
  assert.equal(calcStocked({ sp: "Red Oak", color: "Natural", grade: "char", w: 6.25 }), null); // N cell
  assert.equal(calcStocked({ sp: "White Oak", color: "Natural", grade: "clear", w: 2.25 }), null); // N cell
  assert.equal(calcStocked({ sp: "White Oak", color: "Nope", grade: "char", w: 5.25 }), null);
  assert.equal(calcStocked({ sp: "White Oak", color: "Natural", grade: "char", w: 7.25 }), null); // beyond char run
});

// --- calcHerringbone ----------------------------------------------------------

test("calcHerringbone: band × width, chevron +$3.00", () => {
  const h = { sp: "White Oak", cons: "solid", w: 4.25, band: 1, chevron: false };
  const c = calcHerringbone(h);
  assert.equal(c.cost, 8.40);
  assert.equal(c.cartonSf, undefined); // made to order — no carton rounding
  assert.equal(c.desc, '4¼" White Oak · Solid Herringbone · 18¼"–28" slats');
  const ch = calcHerringbone({ ...h, chevron: true });
  assert.equal(ch.cost, 11.40);
  assert.ok(ch.desc.includes("Chevron"));
  assert.ok(ch.name.includes("Chevron"));
});

test("calcHerringbone: width runs differ by construction/species", () => {
  assert.equal(calcHerringbone({ sp: "Beech", cons: "solid", w: 7.25, band: 0, chevron: false }), null);
  assert.equal(calcHerringbone({ sp: "Beech", cons: "eng", w: 2.25, band: 0, chevron: false }), null);
  assert.equal(calcHerringbone({ sp: "Beech", cons: "eng", w: 3.25, band: 3, chevron: false }).cost, 8.30);
});

// --- calcVent / calcDamper ----------------------------------------------------

test("calcVent prices by category column and species group", () => {
  const v = { ...defaultConfig("vent"), sp: "Cherry", cat: "std-sr", size: "6×12", qty: 4 };
  const a = calcVent(v);
  assert.equal(a.cost, 23.75); // group A self-rim
  assert.equal(a.per, "ea");
  assert.equal(a.qty, 4);
  const b = calcVent({ ...v, sp: "White Oak" });
  assert.equal(b.cost, 27.31); // group B self-rim
  assert.equal(calcVent({ ...v, cat: "std-fl" }).cost, 20.00); // A flush
  assert.equal(calcVent({ ...v, size: "99×99" }), null);
});

test("calcVent options: cubed/prefin/tex/damper/frame stack onto the base", () => {
  const v = { ...defaultConfig("vent"), sp: "White Oak", cat: "std-fl", size: "4×12", qty: 1 };
  assert.equal(calcVent(v).cost, 20.85);
  assert.equal(calcVent({ ...v, cubed: true }).cost, 30.85);
  assert.equal(calcVent({ ...v, prefin: true }).cost, 20.85 + 28.25);
  assert.equal(calcVent({ ...v, tex: true }).cost, 28.85);
  // damper 4×12 stocking 21.88 + $5 attach
  assert.ok(Math.abs(calcVent({ ...v, damper: true }).cost - (20.85 + 26.88)) < 1e-9);
  // frame: L + 2W lineal = 12 + 2×4 = 20" × $0.40
  assert.equal(frameLineal("4×12"), 20);
  assert.ok(Math.abs(calcVent({ ...v, frame: true }).cost - (20.85 + 8)) < 1e-9);
  const full = calcVent({ ...v, cubed: true, prefin: true, tex: true, damper: true, frame: true });
  assert.equal(full.desc, '4×12" Flush vent · White Oak · Cubed · Prefinished · Textured · w/ damper · w/ frame');
});

test("calcVent: cubed/frame only where the category offers them; damper only on stocked sizes", () => {
  const framed = { ...defaultConfig("vent"), sp: "Cherry", cat: "framed", size: "4×12", cubed: true, frame: true };
  const c = calcVent(framed);
  assert.equal(c.cost, 25.63); // framed cat: no cubed toggle, frame built in
  assert.ok(c.warn[0].includes("2¾"));
  assert.equal(frameLineal("2¼×10"), 14.5);
  const noDamper = calcVent({ ...defaultConfig("vent"), sp: "Cherry", cat: "std-sr", size: "6×16", damper: true });
  assert.equal(noDamper.cost, 36.25); // 6×16 has no stocked damper
});

test("calcDamper: loose dampers at stocking cost", () => {
  const c = calcDamper({ size: "6×14", qty: 8 });
  assert.equal(c.cost, 28.13);
  assert.equal(c.qty, 8);
  assert.equal(c.desc, '6×14" vent damper (loose)');
  assert.ok(c.rows[1][0].includes("builder $32.63 · retail $36.00"));
  assert.equal(calcDamper({ size: "9×9", qty: 1 }), null);
});

// --- calcConfig / defaults ----------------------------------------------------

test("calcConfig dispatches on mode; defaults are priceable", () => {
  assert.equal(MODES.length, 5);
  for (const { id } of MODES) {
    const c = calcConfig({ mode: id, cfg: defaultConfig(id) }, 1000);
    assert.ok(c && c.cost > 0, id);
  }
  assert.equal(calcConfig(null, 1000), null);
  assert.equal(calcConfig({ mode: "nope", cfg: {} }, 1000), null);
});

// --- sell / cartons -----------------------------------------------------------

test("sellOf applies the markup, rounded to cents; default 40%", () => {
  assert.equal(DEFAULT_MARKUP, 40);
  assert.equal(DEFAULT_VENT_MARKUP, 50); // vents & dampers mark up more than flooring
  assert.equal(sellOf(4.35, 40), 6.09);
  assert.equal(sellOf(4.35), 6.09);
  assert.equal(sellOf(10, 0), 10);
  assert.equal(sellOf(23.75, 40), 33.25);
});

test("cartonize rounds up to whole cartons, exact preserved", () => {
  assert.deepEqual(cartonize(1000, 20.5), { sf: 20.5, exact: 1000 / 20.5, cartons: 49, billedSf: 1004.5 });
  assert.equal(cartonize(1000, null), null);
  assert.equal(cartonize(0, 20.5), null);
});

// --- lineItems ----------------------------------------------------------------

test("lineItems: sq-ft build → one hardwood row, size-first, carton-aware", () => {
  const [main, ...rest] = lineItems({ mode: "floor", cfg: floor() }, { sf: 600 });
  assert.equal(rest.length, 0);
  assert.equal(main.type, "hardwood");
  assert.equal(main.qtyType, "sqft");
  assert.equal(main.qty, "600");
  assert.equal(main.sizeText, '5¼"');
  assert.ok(main.brandColor.startsWith("Sheoga — White Oak Character Solid"));
  assert.ok(!main.brandColor.includes('5¼"')); // size lives in sizeText, not the name
  assert.equal(main.priceSqft, "6.09");
  assert.equal(main.costSqft, "4.35");
  assert.equal(main.markupPct, "40");
  assert.equal(main.cartonSf, "20.5");
  assert.equal(main.sku, "");
  assert.deepEqual(main.sheoga, { mode: "floor", cfg: floor() });
});

test("lineItems: fees land as their own misc lines at cost", () => {
  const cfg = floor({ finish: "t1", sample: true });
  const lines = lineItems({ mode: "floor", cfg }, { sf: 200, markupPct: 50 });
  assert.equal(lines.length, 3); // main + small-order fee + sample
  const [main, fee, sample] = lines;
  assert.equal(main.priceSqft, String(Math.round((4.35 + 3.05) * 1.5 * 100) / 100));
  for (const f of [fee, sample]) {
    assert.equal(f.type, "misc");
    assert.equal(f.qty, "1");
    assert.equal(f.markupPct, "0");
    assert.equal(f.priceSqft, f.costSqft); // passed through at cost, no markup
    assert.equal(f.sheoga, undefined);
  }
  assert.equal(fee.brandColor, "Sheoga — Small-order fee — prefinished job under 250 sf");
  assert.equal(sample.priceSqft, "750");
});

test("lineItems: vents are count lines; config snapshot is a deep copy", () => {
  const cfg = { ...defaultConfig("vent"), sp: "Walnut", size: "4×12", qty: 6 };
  const [main] = lineItems({ mode: "vent", cfg }, { sf: 0 });
  assert.equal(main.qtyType, "count");
  assert.equal(main.qty, "6");
  assert.equal(main.cartonSf, undefined);
  assert.ok(main.brandColor.includes('4×12" Flush vent · Walnut'));
  assert.equal(main.costSqft, "20.85");
  cfg.qty = 99;
  assert.equal(main.sheoga.cfg.qty, 6);
  assert.deepEqual(lineItems({ mode: "floor", cfg: floor({ w: 9.25 }) }, { sf: 100 }), []);
});

// --- SKU-search entry ---------------------------------------------------------

test("parseQuery pulls species/grade/construction/width/texture from free text", () => {
  assert.deepEqual(parseQuery("white oak char 5 1/4 engineered"), { sp: "White Oak", grade: "char", cons: "eng", w: 5.25 });
  assert.deepEqual(parseQuery('hickory clear 3¼" solid'), { sp: "Hickory", grade: "clear", cons: "solid", w: 3.25 });
  assert.equal(parseQuery("live sawn 11.25").sp, LIVE_SAWN_SP);
  assert.equal(parseQuery("live sawn 11.25").w, 11.25);
  assert.equal(parseQuery("quarter sawn oak").sp, "Q/R White Oak");
  assert.equal(parseQuery("oak sawcut").tex, "sawcut");
  assert.equal(parseQuery("oak sawcut").sp, "White Oak"); // bare "oak" defaults to White Oak
  assert.equal(parseQuery("maple 5.25").w, 5.25);
  assert.equal(parseQuery("maple 12.25").w, undefined); // not a Sheoga width
});

test("parseQuery routes vents / dampers / herringbone to their modes", () => {
  assert.equal(parseQuery("walnut vent 4x12").mode, "vent");
  assert.equal(parseQuery("damper").mode, "damper");
  assert.equal(parseQuery("vent damper").mode, "vent"); // attached damper rides the vent tab
  const hb = parseQuery("chevron red oak");
  assert.equal(hb.mode, "hb");
  assert.equal(hb.chevron, true);
  assert.equal(parseQuery("herringbone").chevron, false);
});

test("queryHit: any ≥3-letter prefix of 'sheoga' or a trade word pins the row", () => {
  assert.ok(queryHit("she"));
  assert.ok(queryHit("sheog"));
  assert.ok(queryHit("SHEOGA hardwood"));
  assert.ok(queryHit("red oak"));
  assert.ok(queryHit("vent"));
  assert.ok(!queryHit("sh")); // two letters is too eager
  assert.ok(!queryHit("porcelain 12x24"));
  assert.ok(!queryHit(""));
});

test("querySummary narrates what the row will open", () => {
  assert.equal(querySummary(parseQuery("")), "no SKUs — priced by description · opens the configurator");
  assert.equal(querySummary(parseQuery("white oak char 5 1/4 engineered")), 'opens pre-filled: White Oak · Character · Engineered · 5¼"');
  assert.equal(querySummary(parseQuery("char eng")), "opens pre-filled: …species · Character · Engineered");
  assert.equal(querySummary(parseQuery("cherry vent")), "opens on Wood vents · Cherry");
  assert.equal(querySummary(parseQuery("chevron walnut 4 1/4")), 'opens on Herringbone (chevron) · Walnut · 4¼"');
});

test("seedFromQuery builds the popup's opening { mode, cfg }", () => {
  const f = seedFromQuery("white oak clear 6 1/4 eng");
  assert.equal(f.mode, "floor");
  assert.deepEqual(f.cfg, floor({ grade: "clear", cons: "eng", w: 6.25 }));
  const v = seedFromQuery("cherry vent");
  assert.equal(v.mode, "vent");
  assert.equal(v.cfg.sp, "Cherry");
  const vm = seedFromQuery("maple vent"); // 'Maple' isn't a vent species — keep the default
  assert.equal(vm.cfg.sp, "White Oak");
  const hb = seedFromQuery("herringbone beech eng");
  assert.equal(hb.cfg.sp, "Beech");
  assert.ok(HERRINGBONE.eng.Beech.ws.includes(hb.cfg.w)); // width snapped into Beech's run
});

test("seedFromQuery snaps an unavailable width to the first offered one", () => {
  const s = seedFromQuery("beech 8 1/4"); // Beech stops at 5¼
  assert.equal(s.cfg.sp, "Beech");
  assert.equal(s.cfg.w, 2.25);
  const e = seedFromQuery("eng red oak 2 1/4"); // engineered starts at 3¼
  assert.equal(e.cfg.w, 3.25);
  assert.ok(floorBase(seedFromQuery("live sawn").cfg) != null);
});

// --- name/label helpers -------------------------------------------------------

test("gradeName / finishName", () => {
  assert.equal(gradeName(floor()), "Character");
  assert.equal(gradeName(floor({ grade: "clear" })), "Clear");
  assert.equal(gradeName(floor({ sp: LIVE_SAWN_SP })), "Live Sawn");
  assert.equal(finishName(floor()), "Unfinished");
  assert.equal(finishName(floor({ finish: "nat" })), "Prefinished Natural");
  assert.equal(finishName(floor({ finish: "est", stain: "Nutmeg" })), "Prefinished Nutmeg stain");
  assert.equal(finishName(floor({ finish: "t3" })), "Custom color T-3");
});

test("established-stain FINISHES entry keys off texture depth", () => {
  const est = FINISHES.find((x) => x.id === "est");
  assert.equal(est.add({ tex: "smooth" }), 1.95);
  assert.equal(est.add({ tex: "oldmill" }), 1.95);
  assert.equal(est.add({ tex: "bandsawn" }), 2.85);
  assert.equal(TEXTURES.find((t) => t.id === "aged").deep, true);
});
