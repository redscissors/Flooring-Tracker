import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalog, item, group, pans, kitFor, solve, figureConsumables, panelPlan,
  openEdges, openCorners, curbRuns, expandWallFaces, WALL_THICK, panThick, BROWSE_SECTIONS, sectionHit,
  tierPrice, lineItems, factoryKit, linearCoverFor, dims, round2, inch,
  TIERS, SKU, BUILDER_MULT, SO_MIN_NET, CONSUMABLES, FINISHES, GROUP_LABEL, MODULE_CHANNEL,
  queryHit, parseQuery, querySummary, seedFromQuery,
  normBench, benchFootprint, benchLines, benchPanRoom, benchPanPlan, smallerPanFor, benchPremades,
  BENCH_H, BENCH_DEPTH, BENCH_CORNER_LEG,
  curbWidth, curbInsets, applyCurbInset, CURB_LAP, benchWallShadowSf,
} from "./wedi.js";

// Ported whole from the prototype's self-test
// (.scratch/066_wedi-configurator/proto-engine.js) — 135 assertions, section
// for section. The numbers are the two vendor sheets: change one and a sheet
// has been re-transcribed, not a bug fixed.

const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 0.01 : e);
const lineFor = (b, key) => b.lines.filter((l) => l.item.key === key)[0];

// --- parsing ------------------------------------------------------------------

test("wedi parsing: fractions, inch() and every dimension the two sheets print", () => {
  // frac() is internal; dims() is the only caller and reads it verbatim.
  assert.equal(dims('1 37/64" x 2"')[0], 1.578125, "frac 1 37/64 = 1.578125");
  assert.equal(dims('27-1/2" x 2"')[0], 27.5, "frac 27-1/2 = 27.5");
  assert.ok(inch(1.578125) === "1 37/64" && inch(0.5) === "1/2" && inch(5.75) === "5 3/4" && inch(36) === "36",
    "inch() prints the sheets' fractions");
  assert.equal(item("US9100004").sizeText, '36" x 60" x 1 37/64"', "pan sizeText matches the pricelist");
  assert.deepEqual(dims("36 in. x 60 in. x 1 37/64 in."), [36, 60, 1.578125], "dims '36 in. x 60 in. x 1 37/64 in.'");
  assert.deepEqual(dims('wedi® Building Panel 48"x60"x1/2"'), [48, 60, 0.5], 'dims \'48"x60"x1/2"\'');
  assert.deepEqual(dims("16 1/2 in. x 16 1/2 in."), [16.5, 16.5], "dims '16 1/2 in. x 16 1/2 in.'");
  assert.deepEqual(dims("3'x5' Wedi Fundo Pan - US9100004 CS Center Drain"), [36, 60], "dims ERP \"3'x5' Wedi Fundo Pan\"");
  assert.deepEqual(dims('4\'x8\'x1/2" Wedi Building Panel'), [48, 96, 0.5], 'dims ERP "4\'x8\'x1/2\\" panel"');
  assert.deepEqual(dims("38x64 Wedi S-DRY Shower Base"), [38, 64], "dims ERP '38x64' reads inches");
  assert.deepEqual(dims("4x8 Wedi Vapor 85"), [48, 96], "dims ERP '4x8' reads feet");
  assert.deepEqual(dims('32"x5-3/4" Wedi Riolito Neo'), [32, 5.75], 'dims ERP \'32"x5-3/4"\'');
});

// --- catalog ------------------------------------------------------------------

test("wedi catalog: 151 stock + 118 special-order-only entries, nothing in misc", () => {
  const cat = catalog();
  const stockEntries = cat.filter((e) => e.stock);
  assert.equal(stockEntries.length, 151, "151 stock rows classified");
  assert.deepEqual(stockEntries.filter((e) => e.group === "misc").map((e) => e.us + " " + e.name), [],
    "0 stock rows in misc");
  assert.deepEqual(cat.filter((e) => !e.stock && e.group === "misc").map((e) => e.us + " " + e.name), [],
    "0 special-order rows in misc");
  assert.equal(cat.length, 269, "269 catalog entries (151 stock + 118 SO-only; 105 pricelist rows merge)");
  const keys = {}, dupes = [];
  cat.forEach((e) => { if (keys[e.key]) dupes.push(e.key); keys[e.key] = 1; });
  assert.deepEqual(dupes, [], "catalog keys unique");
  assert.ok(cat.every((e) => e.retail > 0 || /sample/i.test(e.name)), "every entry priced");
});

test("wedi catalog: non-dimensional items keep their contents as sizeText", () => {
  // The pricelist's size column mixes the contents into prose; a Fastener Kit
  // row that doesn't say 100 ct reads as one screw at the order desk.
  assert.equal(item(SKU.fastenerKit).sizeText, '100 ct 1 5/8" Screws & 100 ct. Washers with Tabs', "fastener kit shows its counts");
  assert.equal(item("US5000086").sizeText, "100 ct Tabless washers and screws", "tabless kit count");
  assert.equal(item("US5000009").sizeText, "1000 ct washers with tabs", "washer master pack count");
  assert.equal(item("US5000012").sizeText, "1000 ct Screws", "screw master pack count");
  assert.equal(item(SKU.sealantSausage).sizeText, "20 oz foil sausage", "sausage volume, prose cut");
  assert.equal(item(SKU.sealantTube).sizeText, "10.5 oz cartridge", "tube volume");
  assert.equal(item(SKU.sealant620Tube).sizeText, "10.5 oz cartridge", "620 cartridge volume");
  assert.equal(item("US9400001").sizeText, "20 units", "lube kit unit count");
  assert.equal(item("US5076012").sizeText, "25 lbs. Bag", "Pro-Set bag weight, pallet prose cut");
  assert.equal(item(SKU.subliner53).sizeText, "53 sft roll", "Subliner roll coverage from the parenthetical");
  assert.equal(item(SKU.subCornerIn).sizeText, "2 per bag", "corner bag count from details");
  assert.equal(item("095225053").sizeText, "5 in. x 82'", "mesh tape keeps its real size text");
  assert.equal(item(SKU.trowel).sizeText, "", "pure prose stays out of the size slot");
});

// --- pans ---------------------------------------------------------------------

test("wedi pans: families, sizes, drains and the ERP/pricelist price pair", () => {
  const allPans = pans({ sdry: true });
  assert.ok(allPans.every((p) => p.w > 0 && p.d > 0 && p.drain && p.drain.type),
    "every pan has w, d and a drain: " + JSON.stringify(allPans.filter((p) => !(p.w > 0 && p.d > 0 && p.drain)).map((p) => p.us)));
  const byFam = (f) => allPans.filter((p) => p.sub === f).length;
  assert.equal(byFam("fundo"), 17, "17 stocked Fundo pans");
  assert.equal(byFam("curbless"), 10, "10 curbless pans");
  assert.equal(byFam("linear"), 3, "3 linear bases");
  assert.ok(byFam("sdry") === 4 && pans().length === allPans.length - 4,
    "4 S-DRY bases (excluded from pans() by default)");
  assert.ok((() => {
    const p = item("US9100004");
    return p.w === 36 && p.d === 60 && p.drain.type === "center" && p.drain.x === 18 && p.drain.y === 30;
  })(), "US9100004 is 36×60, centre drain at (18,30)");
  assert.ok((() => {
    const p = item("US9100004");
    return p.cost === 343.04 && p.retail === 566.01 && p.soNet === 343.03;
  })(), "US9100004 prices: ERP 343.04 cost / 566.01 retail (pricelist net 343.03 rides along)");
  assert.ok((() => {
    const p = item("US9100005");
    return p.drain.type === "offset" && p.drain.x === 18 && p.drain.y === 18 && /spec sheet/.test(p.drain.note);
  })(), "US9100005 (36×72) is the offset fundo, drain at (18,18) + spec-sheet note");
  assert.ok(item("US9200007").drain.type === "offset" && item("US9200007").sub === "curbless",
    "US9200007 (36×60 curbless) is offset");
  assert.equal(item("US9100013").drain.type, "offset", "US9100013 Primo (60×72 corner/offset) reads offset");
  assert.ok(near(item("US9310001").channel, 43.3) && near(item("US9310002").channel, 27.59) && near(item("US9310003").channel, 43.3),
    "linear base channels 43.30 / 27.59 / 43.30");
});

// --- other groups -------------------------------------------------------------

test("wedi groups: panels, extensions, curbs, modules, covers and the legacy keys", () => {
  assert.ok((() => {
    const p = item("US8000017");
    return p.w === 36 && p.d === 60 && p.t === 0.5 && p.sf === 15;
  })(), "panel US8000017 = 36×60×½, 15 sf");
  assert.ok(item("US8000014").sf === 20 && item("US8000015").sf === 32, "panel sf: 4×5 = 20, 4×8 = 32");
  assert.ok(item("US8000026").sub === "vapor" && item("US8000026").sf === 32, "Vapor 85 US8000026 sub 'vapor'");
  assert.ok((() => {
    const a = item("073783528"), b = item("US3000036"), c = item("US3000035");
    return a.w === 48 && a.d === 24 && b.w === 72 && b.d === 12 && c.w === 60 && c.d === 12 && c.sub === "curbless";
  })(), "extensions normalized run×depth: 48×24, 72×12, 60×12");
  assert.ok(item("US3000053").w === 16.5 && item("US3000052").d === 16.5, "corner extensions are 16.5 sq");
  assert.ok(item("US3000038").len === 60 && item("US3000040").len === 96, "curb lengths from the name: 60 / 96");
  assert.ok(item("US9320001").channel === 27.59 && item("US9320002").channel === 43.31,
    "modules carry the pricelist channel (32→27.59, 48→43.31)");
  assert.ok(item("US9330001").d === 66.75 && item("US9330002").len === 48, "module extensions are 66¾ deep");
  assert.ok(item("075100052").group === "module" && item("075100052").sub === "legacy",
    "legacy 075100052 classifies as a module (pre-Click&Seal 32\")");
  assert.ok(item("US9330001").retail === 407.32 && item("US9330001").soRetail === 529.79,
    "US9330001 keeps both prices (ERP 407.32 retail vs pricelist 529.79)");
  assert.ok(item("US1000057").finish === "SS" && item("US1000047").finish === "T38" &&
    item("US1000124").finish === "CHA" && item("US1000053").finish === "CSL",
    "point cover finishes parse (SS, T38, CHA, CSL)");
  assert.ok(item("US1000085").finish === "SS" && item("US1000085").len === 43 && item("US1000085").sub === "linear",
    "linear cover SS43 = US1000085, nominal 43");
  assert.ok((() => {
    const c = item("676797048");
    return c.group === "cover" && c.sub === "linear" && c.finish === "SS" && c.len === 27;
  })(), "legacy 676797048 is the stocked SS27 linear cover");
  assert.ok((() => {
    const f = group("coverFrame").filter((c) => c.finish === "SS").map((c) => c.len).sort();
    return item("676800061").len === 27 && item("676800064").len === 43 && f.length === 4;
  })(), "legacy 676800061/64 are the only SS cover frames");
  assert.ok((() => {
    const a = item("US50000005"), b = item("US5000005");
    return a && a === b && a.group === "subliner" && a.stock && a.sf === 323;
  })(), "the ERP's mis-keyed US50000005 resolves to the US5000005 subliner roll");
  assert.ok(item("US7000058").group === "tool" && item("US5000020").group === "tool",
    "the bucket and gun tips are tools, not misc");
  assert.ok(item("US5000089").group === "fastener" && item("US5000089").sub === "vapor",
    "Vapor 85 patch kit files with fasteners");
  assert.ok((() => {
    const s = group("sdry");
    return s.length >= 25 && s.every((e) => /^US\d\d76/.test(e.us)) && item("US9176001").group === "pan";
  })(), "S-DRY line is its own group (US9176 bases stay pans)");
});

// --- tiers --------------------------------------------------------------------

test("wedi tiers: Builder is retail × 0.82, not the flat 8% off", () => {
  assert.equal(tierPrice({ retail: 378.18, cost: 229.2 }, "builder"), 310.11, "builder on $378.18 retail → 310.11");
  assert.equal(tierPrice({ retail: 566.01, cost: 343.04 }, "employee"), 363.62, "employee = cost × 1.06 (343.04 → 363.62)");
  assert.equal(tierPrice({ retail: 566.01 }, "sale"), 509.41, "sale defaults to 10% off retail");
  assert.equal(tierPrice({ retail: 566.01 }, "custom", 15), 481.11, "custom 15% off retail");
  assert.equal(TIERS.join(), "retail,builder,employee,sale,custom", "TIERS list");
});

// The one functional change from the prototype: the Builder stamp is tunable
// from Settings (a percent OFF retail, default 18 → the 0.82 rule).
test("wedi Builder pct is tunable: 18 is the default, another pct restamps", () => {
  assert.equal(BUILDER_MULT, 0.82);
  assert.equal(tierPrice({ retail: 566.01 }, "builder"), tierPrice({ retail: 566.01 }, "builder", 18));
  assert.equal(tierPrice({ retail: 100 }, "builder", 25), 75);
  const kit = kitFor("US9100004");
  assert.equal(lineItems(kit)[0].tierPrice, "464.13");
  assert.equal(lineItems(kit, { builderPct: 18 })[0].tierPrice, "464.13");
  assert.equal(lineItems(kit, { builderPct: 25 })[0].tierPrice, "424.51");
  assert.equal(SO_MIN_NET, 500);
  assert.equal(CONSUMABLES.sealantOzPerSf, 1.2);
  assert.equal(FINISHES.SS, "Stainless, brushed natural");
  assert.equal(GROUP_LABEL.pan, "Pans");
  assert.equal(MODULE_CHANNEL[48], 43.31);
  assert.equal(round2(1.005), 1.01);
});

// --- consumables --------------------------------------------------------------

test("wedi consumables: 1.2 oz of sealant and 1 fastener per ft² of panel", () => {
  const con = figureConsumables(100, "sausage");
  assert.ok(con.sealantOz === 120 && con.lines[1].qty === 6 && con.lines[0].qty === 1,
    "100 sf → 120 oz → 6 sausages, 1 fastener kit: " + JSON.stringify([con.sealantOz, con.lines[1].qty, con.lines[0].qty]));
  const conT = figureConsumables(100, "tube");
  assert.equal(conT.lines[1].qty, 12, "100 sf in tubes → ceil(120/10.5) = 12");
});

// --- kit builder --------------------------------------------------------------

test("wedi kit builder: the house kit mirrors wedi's own boxed recipe", () => {
  const kit = kitFor("US9100004");
  // 3 walls at 80" over a 36×60 pan: 80 × (60+36+36) / 144 = 73.33 sf.
  assert.ok(near(kit.panelSf, 73.33), "36×60 default walls → 73.33 sf of panel: " + kit.panelSf);
  assert.ok(lineFor(kit, "US9100004") && lineFor(kit, "US9100004").qty === 1, "kit contains the pan");
  assert.equal(lineFor(kit, "US8000017").qty, 5, "5 sheets of 3×5×½ (73.33 / 15 = 4.89)");
  assert.equal(lineFor(kit, "US5000070").qty, 1, "1 fastener kit (73 fasteners ≤ 100)");
  assert.equal(lineFor(kit, "US5000010").qty, 5, "5 sausages (1.2 × 73.33 = 88 oz / 20)");
  assert.ok(!!lineFor(kit, "US3000038"), "curb lean 60 US3000038");
  assert.ok(!!lineFor(kit, "US1000057"), "SS 4×4 cover US1000057");
  assert.ok(lineFor(kit, "US5000000").qty === 1 && lineFor(kit, "US5000033").qty === 1, "both collars, one each");
  assert.ok(!!lineFor(kit, "US5000044"), "corner putty trowel");
  assert.ok(kit.factory && kit.factory.kit.key === "US2000003" && kit.factory.nojs.key === "US2100004",
    "factory compare = US2000003 / US2100004");
  assert.ok(kit.hints.indexOf("sausage-gun") >= 0, "sausage in the build with no gun → hints ['sausage-gun']");
  // The recipe mirrors wedi's own boxed contents, so the stock build should
  // land within a few percent of the factory NOJS kit.
  const kitTotal = kit.lines.reduce((s, l) => s + l.item.retail * l.qty, 0);
  const noJsTotal = kit.lines.reduce((s, l) => s + (l.item.group === "sealant" ? 0 : l.item.retail * l.qty), 0);
  assert.ok(Math.abs(noJsTotal - 998.48) / 998.48 < 0.05,
    "stock build (no sealant) within 5% of the US2100004 boxed kit: " + round2(noJsTotal) + " vs 998.48");
  assert.ok(Math.abs(kitTotal - 1152.21) / 1152.21 < 0.05,
    "stock build with sealant within 5% of the US2000003 boxed kit: " + round2(kitTotal) + " vs 1152.21");
  const kit72 = kitFor("US9100006");   // 36×72 — entry side over 60"
  assert.ok(!!lineFor(kit72, "US3000040") && !lineFor(kit72, "US3000038"), "36×72 entry takes the 96\" lean curb");
  const kitC = kitFor("US9200003");
  assert.ok(!lineFor(kitC, "US3000038") && !!lineFor(kitC, "US5000001") && !!lineFor(kitC, "US5000007") &&
    !!lineFor(kitC, "US5076011"),
    "curbless kit: no curb, + subliner, corners and S-Dry Seal");
  // The bracket kit / ramp is an add-on pick, not part of the house kit
  // (owner ask 2026-07-30) — opts.recess lands it when chosen.
  assert.ok(!lineFor(kitC, SKU.recessKit) && !lineFor(kitC, SKU.ramp),
    "curbless kit carries no recess kit or ramp by default");
  assert.ok(!!lineFor(kitFor("US9200003", { recess: "kit" }), SKU.recessKit), "recess:'kit' adds the bracket kit");
  assert.ok(!!lineFor(kitFor("US9200003", { recess: "ramp" }), SKU.ramp), "recess:'ramp' adds the ramp");
  assert.ok(lineFor(kitC, "US5076011").qty === 1 && !!lineFor(kitC, "US5076010") &&
    !lineFor(kitC, "US5000083") && !lineFor(kitC, "US5000088"),
    "field seal is S-Dry Seal + its trowel, not 620 (owner rule)");
  assert.ok((() => {
    const kt = kitFor("US9200003", { sealantForm: "tube" });
    return !!kt.lines.filter((x) => x.item.key === "US5076011")[0] &&
      !!kt.lines.filter((x) => x.item.key === SKU.sealantTube)[0];
  })(), "tube-form curbless keeps the S-Dry Seal field seal + tube joint sealant");
  const kitL = kitFor("US9310001");
  assert.ok(!!lineFor(kitL, "US1000085"), "linear base takes the matching 43\" SS linear cover: " +
    JSON.stringify(kitL.lines.filter((l) => l.item.group === "cover").map((l) => l.item.key)));
  const kitAdd = kitFor("US9100004", { addons: ["US3000005", SKU.gun], sealantForm: "tube" });
  assert.ok((() => {
    const n = lineFor(kitAdd, "US3000005");
    return n && n.group === "addon" && n.auto === false;
  })(), "addons land un-auto in the addon group");
  assert.ok(lineFor(kitAdd, "US5000013").qty === 9 && kitAdd.hints.indexOf("sausage-gun") < 0,
    "tube form → 9 tubes (88 oz / 10.5), gun addon clears the hint: " + lineFor(kitAdd, "US5000013").qty);
});

// --- open edges, corners and the curb run -------------------------------------

test("wedi open edges: curbs follow the open perimeter, corners only cut open", () => {
  const dims = { w: 60, d: 36 };
  const threeWalls = [{ len: 60, h: 96, side: "back" }, { len: 36, h: 96, side: "left" }, { len: 36, h: 96, side: "right" }];
  const o1 = openEdges(dims, threeWalls);
  assert.deepEqual(o1.edges, [{ side: "entry", from: 0, len: 60 }], "3 full walls → only the entry open");
  assert.equal(o1.openLen, 60, "openLen = the entry width");
  const o2 = openEdges(dims, [threeWalls[0], threeWalls[1], { len: 20, h: 96, side: "right" }]);
  assert.deepEqual(o2.edges, [{ side: "right", from: 20, len: 16 }, { side: "entry", from: 0, len: 60 }],
    "a shortened right wall opens its far run");
  assert.equal(o2.openLen, 76, "openLen adds the exposed right run");
  const o3 = openEdges(dims, [threeWalls[0]]);
  assert.equal(o3.openLen, round2(36 + 36 + 60), "back wall only → both sides + entry open");
  const entryWall = { len: 24, h: 96, side: "entry", extra: true };
  assert.equal(openEdges(dims, threeWalls.concat([entryWall])).openLen, 36,
    "a 24\" entry wall shrinks the entry run to 36\"");

  const c1 = openCorners(dims, threeWalls);
  assert.deepEqual(c1, { bl: false, br: false, fl: true, fr: true },
    "3 walls: back corners boxed in, entry corners cuttable");
  const c2 = openCorners(dims, [threeWalls[0], threeWalls[1], { len: 20, h: 96, side: "right" }, entryWall]);
  assert.ok(!c2.bl && !c2.br && !c2.fl && c2.fr,
    "short right wall keeps fr open; the 24\" entry wall reaches fl and closes it: " + JSON.stringify(c2));

  // Curb quantity follows the open perimeter — walls off means more curb.
  const kit = kitFor("US9100004");
  assert.ok(lineFor(kit, "US3000038").qty === 1 && lineFor(kit, "US3000038").note === "",
    "36×60 house kit: one 60\" curb, uncut (60\" entry)");
  const oneWall = kitFor("US9100004", { walls: [{ len: 60, h: 96, side: "back" }] });
  const curb = oneWall.lines.filter((l) => l.item.group === "curb")[0];
  assert.ok(curb && curb.item.key === "US3000040" && curb.qty === 2 && /139.*open edge/.test(curb.note),
    "back wall only → 139\" at the longest points takes 2 × 96\" lean curbs: " + JSON.stringify(curb && { key: curb.item.key, qty: curb.qty, note: curb.note }));
  const kit72 = kitFor("US9100006");
  assert.equal(lineFor(kit72, "US3000040").note, 'cut to 72"', "36×72: one 96\" curb cut to the 72\" entry");

  // Wall faces (owner, round 6): "both" plans the outside face as its own
  // full-length wall, "in-end" adds a 4"-wide end strip; the extras append
  // AFTER the base list so plan-detail indexing by wall stays aligned.
  const fw = [{ len: 60, h: 96, side: "back" }, { len: 36, h: 96, side: "right", faces: "both" }];
  const fx = expandWallFaces(fw);
  assert.equal(fx.length, 3, "one 'both' wall expands to one extra face");
  assert.ok(fx[2].face === "out" && fx[2].len === 36 && fx[2].side === "right", "outside face at full length, appended last");
  const ex = expandWallFaces([{ len: 36, h: 96, side: "right", faces: "in-end" }]);
  assert.ok(ex[1].face === "end" && ex[1].len === WALL_THICK, "in-end adds a WALL_THICK-wide strip");
  assert.equal(expandWallFaces(fw.slice(0, 1)).length, 1, "default faces expand to nothing");

  const plain = kitFor("US9100004", { walls: [{ len: 60, h: 96, side: "back" }] });
  const both = kitFor("US9100004", { walls: [{ len: 60, h: 96, side: "back", faces: "both" }] });
  assert.ok(near(both.panelSf, plain.panelSf * 2), "both-sides wall doubles the panel sf: " + both.panelSf);
  const withEnd = kitFor("US9100004", { walls: [{ len: 60, h: 96, side: "back", faces: "in-end" }] });
  assert.ok(near(withEnd.panelSf, plain.panelSf + WALL_THICK * 96 / 144),
    "in-end adds the 4\"×h strip: " + withEnd.panelSf);
  assert.equal(both.cfg.walls[0].faces, "both", "cfg carries a non-default faces");
  assert.ok(!("faces" in plain.cfg.walls[0]), "default faces stays off the cfg");
  const rebuilt = kitFor("US9100004", { walls: both.cfg.walls });
  assert.equal(rebuilt.panelSf, both.panelSf, "cfg.walls round-trips the faces into the same sf");

  // cfg round-trips the corner cuts for Reconfigure.
  const kitCut = kitFor("US9100004", { corners: ["fl", "fr"] });
  assert.deepEqual(kitCut.cfg.corners, ["fl", "fr"], "cfg.corners carries the cut corners");
  assert.deepEqual(kitFor("US9100004").cfg.corners, [], "no cuts → cfg.corners []");

  // A corner cut re-routes the curb as ONE straight line (owner sketch):
  // when the adjacent edge HAS a wall, the leg spans the whole open run so
  // the line lands on the wall's end — however far — and only a wall-less
  // edge (or one walled to the corner) takes the standard 12" leg.
  const r1 = curbRuns(dims, threeWalls, []);
  assert.deepEqual(r1.segs, [{ side: "entry", from: 0, len: 60, ext0: 0, ext1: 0 }],
    "no cuts → curb = the open runs, butted between the full walls (no ring fills)");
  assert.equal(r1.openLen, 60, "no cuts → openLen unchanged");
  const r2 = curbRuns(dims, threeWalls, ["fr"]);
  assert.deepEqual(r2.segs, [{ side: "entry", from: 0, len: 48, ext0: 0, ext1: 0 }], "fr cut trims the entry run 12\"");
  assert.deepEqual(r2.diags, [{ corner: "fr", h: 12, v: 12, len: 16.97, cut: round2(Math.hypot(15.5, 15.5)) }],
    "full walls → the standard 12 × 12 (45°) cut against the wall face; the piece figures at the squared outer edge");
  assert.ok(near(r2.openLen, 48 + 21.92), "openLen = 48 + the diagonal's longest point: " + r2.openLen);
  const r3 = curbRuns(dims, [threeWalls[0], threeWalls[1], { len: 20, h: 96, side: "right" }], ["fr"]);
  assert.deepEqual(r3.diags, [{ corner: "fr", h: 12, v: 16, len: 20, cut: round2(Math.hypot(15.5, 19.5)) }],
    "right wall ends 16\" from the corner → the cut line lands on the wall end (12 × 16)");
  assert.deepEqual(r3.segs, [{ side: "entry", from: 0, len: 48, ext0: 0, ext1: 0 }],
    "the 16\" right sliver is absorbed into the diagonal — no dogleg");
  assert.ok(near(r3.openLen, 48 + 24.91), "openLen = entry run + the wall-to-wall line at its longest: " + r3.openLen);
  // The owner's 42×42 screenshot: an entry wall 14" in from the left and a
  // right wall 28" down — the curb is ONE straight line between the two wall
  // ends, whatever the distance, with no straight runs left over.
  const d42 = { w: 42, d: 42 };
  const w42 = [
    { len: 42, h: 96, side: "back" }, { len: 42, h: 96, side: "left" },
    { len: 28, h: 96, side: "right" }, { len: 14, h: 96, side: "entry", extra: true },
  ];
  const r4 = curbRuns(d42, w42, ["fr"]);
  assert.deepEqual(r4.diags, [{
    corner: "fr", h: 28, v: 14,
    len: round2(Math.sqrt(28 * 28 + 14 * 14)), cut: round2(Math.hypot(31.5, 17.5)),
  }], "42×42: the cut spans entry-wall end to right-wall end (28 × 14): " + JSON.stringify(r4.diags));
  assert.deepEqual(r4.segs, [], "wall-to-wall line leaves no straight curb runs");
  assert.ok(near(r4.openLen, 36.03, 0.05), "openLen = the one line at its longest (outer) edge: " + r4.openLen);
  // Open ring corners: with only the back wall standing, the entry run picks
  // up a CURB_W fill at each end so it butts the side runs with no gap — and
  // the openLen (what the sticks are cut from) counts those longest points.
  const r5 = curbRuns(dims, [threeWalls[0]], []);
  const entry5 = r5.segs.filter((s) => s.side === "entry")[0];
  assert.ok(entry5.ext0 === 3.5 && entry5.ext1 === 3.5, "open corners → the entry run extends into both ring corners");
  assert.ok(r5.segs.filter((s) => s.side !== "entry").every((s) => !s.ext0 && !s.ext1),
    "vertical runs never extend — they butt the fill");
  assert.equal(r5.openLen, round2(36 + 36 + 60 + 7), "back wall only → 139\" figured at the longest points");
  // Cutting both entry corners of the 36×60 kit pushes the curb past 60",
  // so the default pick moves up to the 96" lean curb.
  const kitCut2 = kitFor("US9100004", { corners: ["fl", "fr"] });
  const curb2 = kitCut2.lines.filter((l) => l.item.group === "curb")[0];
  assert.ok(curb2.item.key === "US3000040" && curb2.qty === 1,
    "36×60 with both entry corners cut → 79.84\" of curb → one 96\" lean: " + JSON.stringify({ key: curb2.item.key, qty: curb2.qty }));
});

// --- browse taxonomy ----------------------------------------------------------

test("wedi browse sections: every catalog entry has a home", () => {
  const cat = catalog();
  const orphans = cat.filter((e) => !BROWSE_SECTIONS.some((s) => sectionHit(s, e)));
  assert.deepEqual(orphans.map((e) => e.group + " " + (e.us || e.erp)), [], "no orphaned entries");
  const pansSec = BROWSE_SECTIONS[0];
  assert.equal(cat.filter((e) => sectionHit(pansSec, e)).length,
    cat.filter((e) => e.group === "pan" || e.group === "module").length,
    "Pans = every pan + the linear modules");
  const sdrySec = BROWSE_SECTIONS.filter((s) => s.key === "sdry")[0];
  assert.ok(cat.filter((e) => sectionHit(sdrySec, e)).length === 35,
    "S-Dry quick filter = 31 system pieces + 4 S-DRY bases");
});

// --- solver -------------------------------------------------------------------

test("wedi solver: exact · extend · cut down · linear, ranked", () => {
  const s1 = solve({ w: 36, d: 60, curb: "curbed", drain: "any" });
  assert.ok(s1[0].kind === "exact" && s1[0].pieces[0].item.key === "US9100004", "36×60 curbed → exact US9100004");
  assert.ok(s1[0].warnings.length === 0 && s1[0].badges.indexOf("Cheapest") >= 0,
    "36×60 exact has no warnings and is badged Cheapest");
  assert.ok(s1[0].drain.x === 18 && s1[0].drain.y === 30, "36×60 exact drain lands at room centre (18,30)");

  const s2 = solve({ w: 48, d: 66, curb: "curbed", drain: "any" });
  const ex = s2.filter((o) => o.kind === "extend")[0];
  const cd = s2.filter((o) => o.kind === "cutdown")[0];
  assert.ok((() => {
    if (!ex) return false;
    const e = ex.pieces[1];
    return ex.pieces[0].item.key === "US9100003" && e.item.key === "073783528" && e.d === 18 && e.cut && e.cut.d === 24;
  })(), "48×66 extend = 48×48 base + 073783528 cut to 18\" deep");
  assert.ok(ex && ex.pieces[1].x === 0 && ex.pieces[1].y === 48, "48×66 extension sits against the far wall at y = 48");
  assert.ok(cd && cd.pieces[0].item.key === "US9100010" && cd.pieces[0].cut.d === 72, "48×66 cutdown uses the 48×72 US9100010");
  assert.ok(cd && /channel/.test(cd.warnings[0]), "48×66 cutdown warns about re-creating the ½\" channel");
  assert.ok(cd && cd.waste === 2, "48×66 cutdown waste = 2 sf");
  assert.ok(ex && ex.badges.indexOf("Cheapest") >= 0,
    "48×66 extend is the cheapest option: " + JSON.stringify(s2.map((o) => o.kind + " $" + o.floorPrice)));

  const s3 = solve({ w: 36, d: 60, curb: "curbless", drain: "offset" });
  assert.ok(s3[0] && s3[0].pieces[0].item.key === "US9200007", "36×60 curbless offset → US9200007");

  const s4 = solve({ w: 32, d: 72, curb: "curbed", drain: "linear" });
  assert.ok((() => {
    if (!s4[0] || s4[0].kind !== "linear") return false;
    return s4[0].pieces[0].item.key === "US9320001" && s4[0].pieces[1].item.key === "US9330001";
  })(), "32×72 linear → module US9320001 + extension US9330001");
  assert.ok(s4[0] && s4[0].pieces[1].d === 66.25 && !!s4[0].pieces[1].cut,
    "32×72 module extension cut to 66.25\" deep (72 − 5.75)");
  assert.ok(s4[0] && s4[0].drain.type === "linear" && s4[0].drain.y === 2.88 && s4[0].drain.len === 27.59,
    "32×72 drain sits at the module wall, 27.59\" channel");
  assert.ok((() => {
    const k = kitFor(s4[0].pan.key, { option: s4[0] });
    return k.factory && k.factory.kit.key === "US2000062" && k.factory.nojs.key === "US2100015";
  })(), "32×72 matches the US2000062 factory linear kit");
  assert.ok(s4.length === 1 && s4.every((o) => o.kind === "linear"), "linear-only solve returns just the linear option");
  assert.ok((() => {
    const lin = s1.filter((o) => o.kind === "linear")[0];
    return lin && lin.pieces[0].item.key === "US9310001" && lin.badges.indexOf("Drain at wall") >= 0;
  })(), "36×60 curbed also offers the US9310001 linear base");
  assert.ok((() => {
    const e = solve({ w: 48, d: 78, curb: "curbed", drain: "any" }).filter((o) => o.kind === "extend")[0];
    return e && e.pieces.length === 2 && e.pieces[0].item.key === "US9100009" && e.pieces[1].d === 18;
  })(), "48×78 extend prefers the 2-piece 48×60 + a 24 cut to 18 over stacking");
  // Curbless has only the 12" straight, so a 24" gap is the stacking case.
  const ex5 = solve({ w: 60, d: 96, curb: "curbless", drain: "any" }).filter((o) => o.kind === "extend")[0];
  assert.ok((() => {
    if (!ex5) return false;
    const ext = ex5.pieces.slice(1);
    return ex5.pieces[0].item.key === "US9200009" && ext.length === 2 &&
      ext.every((p) => p.item.key === "US3000035" && p.d === 12 && !p.cut) &&
      ext[0].y === 72 && ext[1].y === 84;
  })(), "60×96 curbless stacks 12 + 12 for the 24\" gap");
  // 72×108 forces the fundo ceiling: a 36" gap = 24 + 12 stacked, and the 48"
  // long 24-deep piece takes two runs across a 72" side.
  const ex6 = solve({ w: 72, d: 108, curb: "curbed", drain: "any" }).filter((o) => o.kind === "extend")[0];
  assert.ok((() => {
    if (!ex6) return false;
    const ext = ex6.pieces.slice(1);
    return ex6.pieces[0].item.key === "US9100016" && ext.length === 3 &&
      ext.every((p) => p.item.key === "US3000036" && p.w === 72 && p.d === 12 && !p.cut) &&
      ext[0].y === 72 && ext[1].y === 84 && ext[2].y === 96;
  })(), "72×108 fundo stacks three full-width 12\" extensions — seams horizontal, none vertical (owner rule)");
  const s6 = solve({ w: 48, d: 72, curb: "curbless", drain: "any" });
  assert.ok(s6[0].kind === "exact" && s6[0].pieces[0].item.key === "US9200008", "48×72 curbless → exact US9200008");
  const s7 = solve({ w: 54, d: 66, curb: "curbless", drain: "any" });
  const ex7 = s7.filter((o) => o.kind === "extend")[0];
  assert.ok((() => {
    if (!ex7) return false;
    return ex7.pieces.some((p) => p.kind === "cornerExt" && p.item.key === "US3000052") &&
      ex7.pieces.every((p) => p.kind === "pan" || /US3000035|US3000052/.test(p.item.key));
  })(), "54×66 curbless extends on two sides with the curbless corner US3000052");
  assert.ok(solve({ w: 48, d: 78, curb: "curbed", drain: "any" }).every((o) =>
    o.pieces.every((p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= o.room.w + 0.01 && p.y + p.d <= o.room.d + 0.01)),
    "every solved piece stays inside the room");
  assert.ok(solve({ w: 48, d: 66, curb: "curbed", drain: "any" }).every((o, i, a) =>
    i === 0 || a[i - 1].warnings.length < o.warnings.length ||
    (a[i - 1].warnings.length === o.warnings.length && a[i - 1].floorPrice <= o.floorPrice)),
    "options sort by warnings then price");
});

// --- trim-to-fit (owner rule: up to 6" off a pan side) ------------------------

test("wedi trim-to-fit: a pan side may be cut up to 6\" when it saves pieces", () => {
  const s8 = solve({ w: 54, d: 66, curb: "curbless", drain: "any" });
  const tf = s8.filter((o) => o.kind === "trimfit")[0];
  assert.ok((() => {
    if (!tf) return false;
    return tf.pan.key === "US9200005" && tf.pieces.length === 2 && tf.pieces[0].cut &&
      tf.pieces[1].item.key === "US3000035" &&
      tf.warnings.some((w) => /re-formed|trimmed/.test(w));
  })(), "54×66 curbless: trim-to-fit finds 60×60 cut 6\" + one strip — 2 pieces");
  assert.ok((() => {
    const ex = s8.filter((o) => o.kind === "extend")[0];
    return ex && ex.pieces.some((p) => p.kind === "cornerExt");
  })(), "54×66 curbless still offers the untrimmed corner-extension option");
  assert.ok(solve({ w: 48, d: 66, curb: "curbed", drain: "any" }).every((o) => o.kind !== "trimfit"),
    "48×66 shows no trim card (trimming saves nothing there)");
  assert.ok(s8.every((o) =>
    o.pieces.every((p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= o.room.w + 0.01 && p.y + p.d <= o.room.d + 0.01)),
    "trim-to-fit pieces stay inside the room");
});

// --- drain placed off two walls -----------------------------------------------

test("wedi drain placement: the pan floats so the drain lands where the plumbing is", () => {
  const s9 = solve({ w: 60, d: 60, curb: "curbed", drain: "any", drainX: 24, drainY: 30 });
  assert.ok((() => {
    if (!s9[0] || s9[0].kind !== "drainat") return false;
    const o = s9[0];
    return o.pan.key === "US9100009" && o.drain.x === 24 && o.drain.y === 30 &&
      o.pieces.length === 2 && o.trims === 0;
  })(), "60×60 with the drain 24\" / 30\" → 48×60 pan, drain exactly there, 1 gap");
  assert.ok(s9.every((o) => o.drain.x === 24 && o.drain.y === 30), "drain-at options honor the target on every card");
  const s10 = solve({ w: 48, d: 60, curb: "curbed", drain: "any", drainX: 20, drainY: 30 });
  assert.ok(s10.length > 0 && s10.some((o) => o.trims > 0) && s10.every((o) => o.drain.x === 20),
    "48×60 with the drain at 20\" leans on the 6\" trim allowance: " + JSON.stringify(s10.map((o) => o.pan.key + " trims " + o.trims)));
  assert.ok(s9.concat(s10).every((o) =>
    o.pieces.every((p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= o.room.w + 0.01 && p.y + p.d <= o.room.d + 0.01)),
    "drain-at pieces stay inside the room");

  // Corners are never left blank (owner rule 2026-07-30): up to 12×12 the
  // L-shaped corner extension wraps them; past that the straight bands run
  // THROUGH the corner and mitre at 45° — pieces cover every room corner.
  const s11 = solve({ w: 60, d: 110, curb: "curbed", drain: "center" });
  const covers = (o, x, y) => o.pieces.some((p) =>
    x >= p.x - 0.01 && x <= p.x + p.w + 0.01 && y >= p.y - 0.01 && y <= p.y + p.d + 0.01);
  assert.ok(s11.length > 0 && s11.every((o) =>
    covers(o, 0, 0) && covers(o, 60, 0) && covers(o, 0, 110) && covers(o, 60, 110)),
    "60×110 center: every option covers all four room corners — no blanks");
  assert.ok(s11.some((o) => /60" x 84"/.test(o.pan.sizeText)),
    "the 60×84 big pan earns a card: " + s11.map((o) => o.pan.sizeText).join(" | "));
  // Seams run horizontal (owner rule 2026-07-30): the top pick is the 60×72
  // with two full-width 12" extensions per side — the far one cut to 7" —
  // never a deeper piece butted mid-run with a vertical seam.
  assert.ok((() => {
    const o = s11[0];
    const ext = o.pieces.slice(1);
    return /60" x 72"/.test(o.pan.sizeText) && ext.length === 4 &&
      ext.every((p) => p.item.key === "US3000036" && p.w === 60) &&
      ext.filter((p) => p.d === 7).length === 2;
  })(), "60×110 centre: 60×72 + four full-width 12\" extensions, the far pair cut to 7\": "
    + JSON.stringify(s11[0].pieces.map((p) => p.item.key + " " + p.w + "x" + p.d)));
  // The 2"-deep 60×84 pairs with 1 37/64" extensions: the option warns about
  // the build-up and the kit carries the ½" sheet ripped into strips.
  assert.equal(panThick({ sizeText: '60" x 84" x 2"' }), 2);
  assert.equal(panThick({ sizeText: '36" x 60" x 1 37/64"' }), round2(1 + 37 / 64));
  const big84 = s11.filter((o) => /60" x 84"/.test(o.pan.sizeText))[0];
  assert.ok(big84.warnings.some((w) => /build the extensions up flush/.test(w)),
    "2\" pan + extensions warns about the build-up: " + JSON.stringify(big84.warnings));
  const kit84 = kitFor(big84.pan.key, { option: big84 });
  const shim = kit84.lines.filter((l) => l.group === "floor" && /build-up strips/.test(l.note))[0];
  assert.ok(shim && shim.item.key === "US8000015" && shim.qty >= 1,
    "the kit adds ½\" sheet(s) for the build-up strips: " + JSON.stringify(shim && { key: shim.item.key, qty: shim.qty, note: shim.note }));
});

// --- center click + anchor ----------------------------------------------------

test("wedi anchor: centre-click solves to the room centre, right anchor mirrors", () => {
  const sc1 = solve({ w: 48, d: 66, curb: "curbed", drain: "center" });
  assert.ok(sc1.length > 0 && sc1.every((o) => o.kind === "drainat" && o.drain.x === 24 && o.drain.y === 33) &&
    sc1[0].pieces[0].cut != null,
    "48x66 center-click puts the drain at the room centre, pan cut to fit");
  const sa = solve({ w: 60, d: 60, curb: "curbed", drain: "any", anchor: "right" });
  const sl = solve({ w: 60, d: 60, curb: "curbed", drain: "any", anchor: "left" });
  assert.ok((() => {
    const er = sa.filter((o) => o.kind === "extend")[0];
    const el = sl.filter((o) => o.kind === "extend")[0];
    if (!er || !el || !er.mirrored || el.mirrored) return false;
    return round2(er.pieces[0].x + er.pieces[0].w) === 60 && el.pieces[0].x === 0;
  })(), "anchor right mirrors the layout (pan against the right wall)");
  assert.ok(sa.every((o) => o.pieces.every((p) => p.x >= 0 && p.x + p.w <= o.room.w + 0.01)),
    "anchor-right pieces stay inside the room");
  assert.ok((() => {
    const st = solve({ w: 60, d: 60, curb: "curbed", drain: "any", drainX: 24, drainY: 30, anchor: "right" });
    return st.length > 0 && st.every((o) => !o.mirrored && o.drain.x === 24);
  })(), "a hand-entered drain position wins over the anchor");
});

// --- wall panel planner -------------------------------------------------------

test("wedi panel planner: level courses, mixed sizes, vertical only when seamless", () => {
  const pp = panelPlan([{ len: 60, h: 80 }, { len: 36, h: 80 }, { len: 36, h: 80 }]);
  assert.ok(pp.vSeams === 0 && pp.courses === 4 && pp.detail[1].vertical && pp.detail[2].vertical && !pp.detail[0].vertical,
    "36x60 walls: back in courses, sides one vertical 4x8 each, 0 seams: " + JSON.stringify(pp.detail));
  assert.ok((() => {
    const by = {};
    pp.lines.forEach((l) => { by[l.key] = l.qty; });
    return by.US8000014 === 1 && by.US8000017 === 1 && by.US8000015 === 2;
  })(), "plan mixes: back 4x5 + 3x5, sides a vertical 4x8 apiece: " + JSON.stringify(pp.lines));
  assert.ok((() => {
    const p2 = panelPlan([{ len: 84, h: 96, side: "back" }, { len: 48, h: 96, side: "left" }, { len: 48, h: 96, side: "right" }]);
    const by = {};
    p2.lines.forEach((l) => { by[l.key] = l.qty; });
    return by.US8000015 === 4 && p2.lines.length === 1 && p2.vSeams === 0 &&
      !p2.detail[0].vertical && p2.detail[0].courses.length === 2 &&
      p2.detail[1].vertical && p2.detail[2].vertical;
  })(), "48x84 kit at 96: four 4x8s — back two horizontal, sides one vertical each");
  assert.ok((() => {
    const p = panelPlan([{ len: 96, h: 96 }]);
    return p.vSeams === 0 && p.lines.length === 1 && p.lines[0].key === "US8000015" && p.lines[0].qty === 2;
  })(), "96\" wall at 96\" high: two 4×8 courses, no vertical seams");
  assert.ok((() => {
    const p = panelPlan([{ len: 72, h: 48 }]);
    return p.vSeams === 0 && p.lines[0].key === "US8000015" && p.lines[0].qty === 1;
  })(), "72\" course prefers one cut-down 4×8 over two butted 4×5s");
  assert.ok((() => {
    const p = panelPlan([{ len: 24, h: 40 }]);
    return p.courses === 1 && p.lines.reduce((s, l) => s + l.qty, 0) === 1;
  })(), "half wall: one course covers a 24×40 pony wall");
  assert.ok((() => {
    const p = panelPlan([{ len: 130, h: 80, side: "back" }]);
    const d = p.detail[0];
    if (!d || d.side !== "back" || d.courses.length !== 2) return false;
    const c = d.courses[0];
    // 130" course: one 96 + one 60 cut to 34 — the butt joint sits at 96
    return c.y0 === 0 && JSON.stringify(c.lens) === "[96,34]" &&
      p.detail[0].courses[1].y0 === 48 && p.detail[0].courses[1].ch === 32;
  })(), "plan detail carries per-wall courses with laid lengths (for the wall drawing)");
});

// --- line payloads ------------------------------------------------------------

test("wedi line payloads: the pan anchors the kit, cfg round-trips (requirement 12)", () => {
  const kit = kitFor("US9100004");
  const rows = lineItems(kit, { tier: "builder" });
  assert.equal(rows.length, kit.lines.length, "lineItems: one row per build line");
  assert.ok(rows[0].wedi && rows[0].wedi.cfg && rows[0].wedi.cfg.panKey === "US9100004" && rows[0].wedi.mode === "kit",
    "pan row is the anchor and carries wedi.cfg");
  assert.ok(rows.slice(1).every((r) => r.wedi && r.wedi.part === true), "companion rows carry wedi.part");
  assert.ok(rows[0].tierPrice === "464.13" && rows[0].priceSqft === "566.01",
    "pan row carries the 0.82 builder stamp (566.01 → 464.13)");
  assert.ok((() => {
    const so = rows.filter((r) => r.sku === "");
    return rows[0].sku === "1504156" && so.every((r) => /^wedi US/.test(r.brandColor));
  })(), "stocked rows key the ERP sku, special-order rows lead with the US sku");
  assert.ok(rows.every((r) =>
    typeof r.qty === "string" && typeof r.priceSqft === "string" && typeof r.costSqft === "string" && r.qtyType === "count"),
    "payload strings only (qty/price)");
  const round = kitFor(rows[0].wedi.cfg.panKey, {
    walls: rows[0].wedi.cfg.walls, panelKey: rows[0].wedi.cfg.panelKey,
    curbKey: rows[0].wedi.cfg.curbKey, coverKey: rows[0].wedi.cfg.coverKey,
    sealantForm: rows[0].wedi.cfg.sealantForm, recess: rows[0].wedi.cfg.recess,
    addons: rows[0].wedi.cfg.addons,
  });
  assert.deepEqual(round.lines.map((l) => l.item.key + "×" + l.qty), kit.lines.map((l) => l.item.key + "×" + l.qty),
    "cfg round-trips: reconfigure rebuilds the same lines");
});

// --- search entry -------------------------------------------------------------
// Re-exported from wediquery.js (the boot chunk's copy) — wediquery.test.js
// exercises the same assertions against that module directly.

test("wedi search entry: what pins the configurator and where it lands", () => {
  assert.ok(queryHit("wedi") && queryHit("wed"), "queryHit 'wedi' / 'wed'");
  assert.ok(queryHit("shower pan") && queryHit("niche") && queryHit("curbless"),
    "queryHit 'shower pan', 'niche', 'curbless'");
  assert.ok(queryHit("36x60 pan"), "queryHit '36x60 pan' (weak word + size)");
  assert.ok(!queryHit("porcelain 12x24") && !queryHit("schluter reducer") && !queryHit("grout"),
    "queryHit ignores unrelated trade text");
  assert.ok((() => {
    const p = parseQuery("wedi 36x60 curbless");
    return p.w === 36 && p.d === 60 && p.curb === "curbless" && p.tab === "custom";
  })(), "parseQuery 'wedi 36x60 curbless' → 36×60 curbless custom");
  assert.ok((() => {
    const p = parseQuery("wedi 3'x5' pan");
    return p.w === 36 && p.d === 60;
  })(), "parseQuery reads feet: \"wedi 3'x5'\" → 36×60");
  assert.equal(parseQuery("wedi 3x5 shower").w, 36, "parseQuery bare 3x5 reads as feet");
  assert.equal(parseQuery("wedi linear 32x72").drain, "linear", "parseQuery 'linear' → linear drain");
  assert.equal(parseQuery("wedi niche").tab, "browse", "parseQuery 'wedi niche' → browse tab");
  assert.equal(parseQuery("wedi").tab, "kits", "parseQuery bare 'wedi' → kits tab");
  assert.ok((() => {
    const s = seedFromQuery("wedi 48x66 curbed");
    return s.tab === "custom" && s.input.w === 48 && s.input.d === 66 && s.input.curb === "curbed";
  })(), "seedFromQuery gives a solver input");
  assert.ok(/48×66/.test(querySummary(parseQuery("wedi 48x66 curbed"))), "querySummary reads as one line");
});

// --- catalog helpers the UI leans on ------------------------------------------

test("wedi helpers: factoryKit, linearCoverFor and the group index", () => {
  assert.equal(factoryKit(36, 60, "fundo", "center").kit.key, "US2000003");
  assert.equal(factoryKit(60, 36, "fundo", "center").kit.key, "US2000003", "either orientation finds the box");
  assert.equal(factoryKit(37, 61, "fundo", "center"), null);
  assert.equal(linearCoverFor(43.31, "SS").key, "US1000085");
  assert.equal(linearCoverFor(0, "SS"), null);
  assert.ok(group("pan").length > 0 && group("nope").length === 0);
  assert.equal(item("nope"), null);
  assert.deepEqual(lineItems(null), []);
  assert.deepEqual(solve({ w: 0, d: 60 }), []);
});

// --- benches (issue 069) ------------------------------------------------------

const threeWallsB = [
  { len: 60, h: 96, side: "back" }, { len: 36, h: 96, side: "left" }, { len: 36, h: 96, side: "right" },
];
const roomB = { w: 60, d: 36 };

test("wedi benches: defaults and footprints follow the owner's measuring rules", () => {
  const b = normBench({ kind: "wall", side: "left" }, roomB);
  assert.equal(b.len, 36, "wall bench defaults to the full run");
  assert.ok(b.depth === BENCH_DEPTH && b.h === BENCH_H && b.build === "site", '18" deep, 18" to the top, site-built');
  const f = benchFootprint(b, roomB);
  assert.deepEqual([f.x, f.y, f.w, f.d], [0, 0, 14, 36], "left bench: a 14\" strip the full depth");
  const r = benchFootprint(normBench({ kind: "wall", side: "right", len: 24 }, roomB), roomB);
  assert.deepEqual([r.x, r.y, r.w, r.d], [46, 0, 14, 24], "right bench anchors at the back");
  const c = normBench({ kind: "corner", corner: "bl" }, roomB);
  assert.ok(c.size === BENCH_CORNER_LEG && c.h === BENCH_H && !c.panFit, '24" legs, 18" top, never framed');
  const cf = benchFootprint(c, roomB);
  assert.ok(cf.kind === "corner" && cf.a === 24, "corner bench: legs out along each wall");
  const pre = normBench({ kind: "corner", corner: "br", part: "US3000055" }, roomB);
  assert.ok(pre.build === "premade" && pre.size === 24 && pre.h === BENCH_H,
    'premade corner kit measures by its 24" legs — 18" to the top, the owner\'s floating-bench rule');
});

test("wedi benches: the shower completes first — only a framed bench interrupts the curb", () => {
  const base = curbRuns(roomB, threeWallsB, []);
  assert.equal(base.openLen, 60, "baseline: entry curb runs the full 60");
  const site = [normBench({ kind: "wall", side: "left" }, roomB)];
  assert.equal(curbRuns(roomB, threeWallsB, [], site).openLen, 60,
    'a 2" build-up sits ON the finished shower — the curb runs across beneath it');
  const fl = [normBench({ kind: "corner", corner: "fl" }, roomB)];
  assert.equal(curbRuns(roomB, threeWallsB, [], fl).openLen, 60,
    "an entry-corner build-up leaves the curb whole too");
  const framed = [normBench({ kind: "wall", side: "left", build: "framed" }, roomB)];
  const r1 = curbRuns(roomB, threeWallsB, [], framed);
  assert.equal(r1.segs.length, 1);
  assert.ok(r1.segs[0].from === 14 && r1.segs[0].len === 46, "a framed bench takes 14\" off the entry run");
  assert.equal(r1.openLen, 46);
  const short = [normBench({ kind: "wall", side: "left", build: "framed", len: 30 }, roomB)];
  assert.equal(curbRuns(roomB, threeWallsB, [], short).openLen, 60,
    "a framed bench that stops short of the entry leaves the curb alone");
  const back = [normBench({ kind: "wall", side: "back", build: "framed" }, roomB)];
  assert.equal(curbRuns(roomB, threeWallsB, [], back).openLen, 60, "a back bench never touches the entry curb");
});

test("wedi benches: site-built 2\" math — top, face, and a support about every foot", () => {
  const wall = [normBench({ kind: "wall", side: "left" }, roomB)];   // 36×14×18
  const bw = benchLines(wall, roomB, item(SKU.panelDefault));
  // top 36×14 + face 36×18 + 4 supports (both ends + every foot) 12×16 = 1920 in²
  assert.equal(bw.sf2, round2(1920 / 144), "13.33 sf of 2\" material");
  assert.equal(bw.surfSf, 8, "top + face feed the sealant figuring");
  assert.equal(bw.lines.length, 1);
  assert.ok(bw.lines[0].item.key === "US8000020" && bw.lines[0].qty === 1,
    "fits one 4×5×2\" sheet — no 4×8 needed");
  const corner = [normBench({ kind: "corner", corner: "bl" }, roomB)];   // 24" legs
  const bc = benchLines(corner, roomB, item(SKU.panelDefault));
  // top 24²/2 + face 33.94×18 + 3 supports 10×16
  assert.ok(near(bc.sf2, (288 + 24 * Math.SQRT2 * 18 + 3 * 160) / 144), "corner: triangle top, diagonal face");
  const big = [normBench({ kind: "wall", side: "back", len: 60, depth: 24, h: 20 }, roomB)];
  const bb = benchLines(big, roomB, item(SKU.panelDefault));
  // top 1440 + face 1200 + 6 supports 22×18 = 5016 in² = 34.83 sf → one 4×8 + one 4×5
  assert.equal(bb.lines.length, 2);
  assert.ok(bb.lines[0].item.key === "US8000016" && bb.lines[0].qty === 1 && bb.lines[1].item.key === "US8000020",
    "over one sheet: 4×8s first, a 4×5 finishes the remainder");
});

test("wedi benches: premades are one line; included sealant doesn't double", () => {
  const pres = benchPremades("corner");
  assert.ok(pres.length >= 2 && pres.every((e) => e.group === "seat" || /corner/i.test(e.name)),
    "corner premades are the corner kits plus the suspended corner seats");
  assert.ok(benchPremades("wall").some((e) => e.key === "US3000056"), "the 48\" bench kit files under wall");
  const kit = [normBench({ kind: "corner", corner: "bl", part: "US3000055" }, roomB)];
  const bk = benchLines(kit, roomB, item(SKU.panelDefault));
  assert.ok(bk.lines.length === 1 && bk.lines[0].item.key === "US3000055" && bk.lines[0].qty === 1);
  assert.equal(bk.surfSf, 0, "the kit includes wedi Joint Sealant — nothing extra to figure");
  const san = [normBench({ kind: "wall", side: "back", part: "US3000043" }, roomB)];
  assert.ok(benchLines(san, roomB, null).surfSf > 0, "a Sanoasa bench still takes sealant to set");
});

test("wedi benches: suspended premades hang at seat height — the slab is the thickness, not the height", () => {
  // "(wall sides)" is prose inside the seats' size — it must not hide the 4".
  assert.deepEqual(dims("19 in. x 19 in. (wall sides) x 4 in."), [19, 19, 4],
    "a digit-free parenthetical drops before the dims read");
  const seatM = item("US3000001"), seatL = item("US3000002"), san4 = item("US3000000");
  assert.ok(seatM.t === 4 && seatL.t === 4, 'the corner seats are 4" thick');
  assert.equal(seatM.details, "Suspended Corner Seat", "the seats say what they are");
  assert.equal(san4.details, "Suspended Bench");
  assert.equal(san4.sizeText, '47 1/4" x 15" x 3 1/8"', "Sanoasa 4 sizes clean — no doubled unit");
  const corner = benchPremades("corner");
  assert.ok(corner.some((e) => e.key === "US3000001") && corner.some((e) => e.key === "US3000002"),
    "the suspended corner seats place from the corner bench menu");
  const seat = normBench({ kind: "corner", corner: "bl", part: "US3000001" }, roomB);
  assert.ok(seat.suspended && seat.thick === 4 && seat.h === BENCH_H && seat.size === 19,
    'seat M: 19" legs, 4" slab, top still at 18"');
  const bench = normBench({ kind: "wall", side: "back", part: "US3000000" }, roomB);
  assert.ok(bench.suspended && bench.thick === 3.125 && bench.h === BENCH_H
    && bench.len === 47.25 && bench.depth === 15,
    'Sanoasa 4: 47 1/4×15" slab 3 1/8" thick, top at 18"');
  const floor = normBench({ kind: "wall", side: "back", part: "US3000043" }, roomB);
  assert.ok(!floor.suspended && floor.h === 15, "Sanoasa 1 L stays floor-mounted at its own 15\" height");
  // A suspended piece hangs above the curb line — the curb runs beneath it.
  const flSeat = [normBench({ kind: "corner", corner: "fl", part: "US3000002" }, roomB)];
  assert.equal(curbRuns(roomB, threeWallsB, [], flSeat).openLen, 60,
    "an entry-corner suspended seat leaves the curb whole");
});

test("wedi benches: framed — ½\" wrap, and the pan is cut down or swapped smaller", () => {
  const framed = [normBench({ kind: "wall", side: "left", build: "framed" }, roomB)];
  assert.equal(framed[0].panFit, "cut", "framed defaults to cutting the current pan");
  assert.deepEqual(benchPanRoom(framed, roomB), { w: 46, d: 36 }, "a 14\" framed bench leaves 46×36 clear");
  const bf = benchLines(framed, roomB, item(SKU.panelDefault));
  // wrap: top 504 + face 648 + open end 252 = 9.75 sf → one 3×5×½ sheet
  assert.ok(near(bf.wrapSf, 9.75) && bf.lines.length === 1 && bf.lines[0].item.key === SKU.panelDefault,
    "the wrap figures in the build's own ½\" panel");
  const kCut = kitFor("US9100004", { walls: threeWallsB, benches: [{ kind: "wall", side: "left", build: "framed" }] });
  assert.ok(kCut.lines[0].item.key === "US9100004" && /cut to 46×36/.test(kCut.lines[0].note),
    "panFit 'cut' keeps the pan and notes the cut");
  const sw = smallerPanFor(item("US9100004"), 46, 36);
  assert.ok(sw && sw.sub === "fundo" && Math.max(sw.w, sw.d) <= 46.01 && Math.min(sw.w, sw.d) <= 36.01,
    "smallerPanFor (the no-solve fallback) still names the largest fitting same-family pan");
});

test("wedi benches: a framed bench's framing shadow leaves the wall figure", () => {
  // No wedi runs behind an installer-framed bench — the panel stops at the
  // bench top (the default bench runs the full 36" left wall × 18" high =
  // 4.5 sf) and the ½" wrap files under the bench group instead. Site-built
  // benches shadow nothing: the wall stays fully paneled behind them.
  const plain = kitFor("US9100004", { walls: threeWallsB });
  const framed = kitFor("US9100004", { walls: threeWallsB, benches: [{ kind: "wall", side: "left", build: "framed" }] });
  const site = kitFor("US9100004", { walls: threeWallsB, benches: [{ kind: "wall", side: "left" }] });
  assert.ok(near(plain.panelSf - framed.panelSf, 4.5), "framed: 36×18 shadow leaves the wall sf");
  assert.equal(site.panelSf, plain.panelSf, "site-built: wall fully paneled behind the bench");
});

// --- curb inside the stated dims ("overall max", owner ask 2026-07-30) -------

test("wedi 'overall max': open-edge curbs pull inside the line and the pan re-fits", () => {
  // Owner's cross-sections (measured 2026-07-31): the lean curb is 2"
  // across the top, notched ½" over the pan — it ADDS 1½". The standard/
  // full-foam is 4½" across — adds 4". So a 36"-deep shower with the lean
  // curb inside runs a 34½" pan, drain centered at 17¼" off the back wall.
  assert.equal(curbWidth(SKU.curbLean60), 2, 'a lean curb is 2" across the top');
  assert.equal(curbWidth("US3000039"), 4.5, 'a full-foam curb is 4½" across');
  const ins = curbInsets(roomB, threeWallsB, SKU.curbLean60);
  assert.deepEqual(ins, { back: 0, left: 0, right: 0, entry: 1.5, cw: 2 },
    "three walls: the entry gives up curb width minus the ½\" pan lap — the lean adds 1½\"");
  assert.equal(curbInsets(roomB, threeWallsB.concat([{ len: 60, h: 96, side: "entry" }]), SKU.curbLean60), null,
    "fully walled: nothing to inset");
  const sub = solve({ w: 60, d: 34.5, curb: "curbed", drain: "center", tolerance: 0.51 });
  assert.ok(sub.length, "the reduced 60×34.5 room still solves");
  assert.ok(near(sub[0].drain.x, 30) && near(sub[0].drain.y, 17.25),
    "drain centered between the back wall and the curb — 17¼\" off the back");
  const o = applyCurbInset(sub[0], ins, roomB);
  assert.deepEqual(o.room, { w: 60, d: 36 }, "the option re-bases into the full stated footprint");
  assert.ok(o.pieces.every((p) => p.y + p.d <= 34.51), "every piece stops at the curb's notch line");
  assert.deepEqual(o.inset, ins, "the inset rides along for the drawings");
  // walls and the curb run keep figuring on the FULL room — and the wedi
  // wall figure never grows past the stated line for the curb's sake
  const k = kitFor(o.pan.key, { option: o, walls: threeWallsB, maxIn: true });
  assert.ok(k.lines.some((l) => l.item.group === "curb"), "the curb still spans the full opening");
  assert.equal(k.cfg.maxIn, true, "cfg carries the mode for Reconfigure");
  const plain = kitFor("US9100004", { walls: threeWallsB });
  assert.equal(k.panelSf, plain.panelSf,
    "wall wedi figures to the stated line (the curb's front face) — never extra for the curb");
});

test("wedi benches: framed 'smaller' re-solves the clear space with the drain centered", () => {
  // 60×36 shower, 14" framed bench on the left → 46×36 clear; the solver
  // places a pan so the drain lands dead center of THAT space (owner ask
  // 2026-07-30), and the layout shifts past the bench in the drawings.
  const framedSm = [normBench({ kind: "wall", side: "left", build: "framed", panFit: "smaller" }, roomB)];
  const plan = benchPanPlan(item("US9100004"), framedSm, roomB);
  assert.ok(plan, "the 46×36 clear space solves");
  assert.deepEqual(plan.clear, { w: 46, d: 36 });
  assert.deepEqual(plan.offset, { x: 14, y: 0 }, "the clear space starts past the 14\" bench");
  assert.ok(near(plan.option.drain.x, 23) && near(plan.option.drain.y, 18), "drain at the clear-space center");
  plan.option.pieces.forEach((p) => {
    assert.ok(p.x >= -0.01 && p.y >= -0.01 && p.x + p.w <= 46.01 && p.y + p.d <= 36.01,
      "every piece stays inside the clear space");
  });
  const kSm = kitFor("US9100004", {
    walls: threeWallsB,
    benches: [{ kind: "wall", side: "left", build: "framed", panFit: "smaller" }],
  });
  assert.ok(kSm.panPlan, "kitFor carries the plan out for the drawings");
  assert.equal(kSm.lines[0].item.key, kSm.panPlan.option.pan.key, "the floor line is the solved pan");
  assert.ok(/drain centered in the 46×36" clear space/.test(kSm.lines[0].note), "…and the note says why");
  // A bench never shrinks the SHOWER: the walls still run the full room —
  // only the framed bench's own 36×18 framing shadow leaves the figure.
  const plain = kitFor("US9100004", { walls: threeWallsB });
  assert.ok(near(plain.panelSf - kSm.panelSf, 4.5), "wall panel = full shower walls minus the framing shadow");
  // 'cut' is untouched by the solver path
  const kCut = kitFor("US9100004", { walls: threeWallsB, benches: [{ kind: "wall", side: "left", build: "framed" }] });
  assert.equal(kCut.panPlan, null, "panFit 'cut' never re-solves");
  // and the whole thing still round-trips through cfg
  const again = kitFor("US9100004", { walls: threeWallsB, benches: kSm.cfg.benches });
  assert.deepEqual(again.lines.map((l) => [l.item.key, l.qty]), kSm.lines.map((l) => [l.item.key, l.qty]),
    "cfg round-trips the framed-smaller build");
});

test("wedi benches: kitFor files the group, keeps the curb across, feeds the sealant, round-trips cfg", () => {
  const plain = kitFor("US9100004", { walls: threeWallsB });
  const k = kitFor("US9100004", { walls: threeWallsB, benches: [{ kind: "wall", side: "left" }] });
  const bench = k.lines.filter((l) => l.group === "bench");
  assert.ok(bench.length === 1 && bench[0].item.key === "US8000020", "site bench lands one 2\" sheet in its own group");
  const curbOf = (b) => b.lines.filter((l) => l.item.group === "curb")[0];
  const curbK = curbOf(k), curbP = curbOf(plain);
  assert.ok(curbK.item.key === curbP.item.key && curbK.qty === curbP.qty && curbK.note === curbP.note,
    "the curb runs across — a build-up bench doesn't shorten it");
  const kF = kitFor("US9100004", { walls: threeWallsB, benches: [{ kind: "wall", side: "left", build: "framed" }] });
  assert.ok(/46/.test(curbOf(kF).note), "a framed bench still butts the curb at the shortened 46\"");
  const seal = (b) => b.lines.filter((l) => l.item.group === "sealant")[0].qty;
  assert.ok(seal(k) >= seal(plain), "bench surface joins the sealant figuring");
  assert.equal(k.cfg.benches.length, 1, "cfg carries the bench for Reconfigure");
  const again = kitFor("US9100004", { walls: threeWallsB, benches: k.cfg.benches });
  assert.deepEqual(
    again.lines.map((l) => [l.item.key, l.qty]), k.lines.map((l) => [l.item.key, l.qty]),
    "cfg.benches round-trips to the identical build");
  assert.equal(kitFor("US9100004", { walls: threeWallsB }).cfg.benches.length, 0, "no benches → cfg says so");
});
