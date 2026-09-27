import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { FINISH_LABEL, ovKey, rowItemEntry, sessionFromRows, classify, catalogOf, coverageOf, trayCandidates, pickRolls, pickFrom, buildKit, buildFromMarker, linesTotal, tierPrice, lineItems, orderCopyLines, entryOpening, openRuns, boardPlan, boardSheets, expandBoardFaces, normBench, benchTrayRoom, slotOf, resolveDrain, drainOptions, pointGrateLabel,
  resolveMembrane, membraneOptions, resolveBand, bandOptions, bandWidthLabel,
  addedGroup, addedLines, setAddedQty, addParts, addPartOf, addRollOptions, drainAddOptions } from "./schluter.js";
import { isSlot } from "./slots.js";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

test("fixture loads", () => assert.equal(FIXTURE_ITEMS.length >= 55, true));
test("classify exists", () => assert.equal(typeof classify, "function"));

const by = (sku) => classify(FIXTURE_ITEMS.find((i) => i.sku === sku));

test("tray mm-pair grammar", () => {
  assert.deepEqual(
    (({ g, w, d, drain }) => ({ g, w, d, drain }))(by("KST965/1525")),
    { g: "tray", w: 60, d: 38, drain: "point" });
  assert.equal(by("KST965/1525S").drain, "offset");
  assert.equal(by("KST965BF").thin, true);            // TT = curbless play
  // a linear tray's w is its CHANNEL edge — Schluter's first dimension
  assert.deepEqual(
    (({ g, w, d, drain }) => ({ g, w, d, drain }))(by("KSLT965/1930S")),
    { g: "tray", w: 38, d: 76, drain: "linear" });
});

test("linear trays read the drain side from the SKU's first dimension", () => {
  const dims = (sku) => (({ w, d }) => ({ w, d }))(classify({ sku, name: "" }));
  assert.deepEqual(dims("SLRKSLT9651930S"), { w: 38, d: 76 });   // drain 38" side
  assert.deepEqual(dims("SLRKSLT1930965S"), { w: 76, d: 38 });   // drain 76" side
  assert.deepEqual(dims("SLRKSLT9151830S"), { w: 36, d: 72 });
  assert.deepEqual(dims("SLRKSLT9151395S"), { w: 36, d: 55 });
  assert.deepEqual(dims("SLRKSLT1220S"), { w: 48, d: 48 });
});

test("each linear twin lands in the room whose back wall is its drain side", () => {
  const twin = { sku: "SLRKSLT1930965S", name: "KERDI-SHOWER-LTS Tray 76\"×38\"", price: 317.61, cost: 211.74, stock: false };
  const cat = catalogOf([...FIXTURE_ITEMS, twin]);
  const wide = trayCandidates(cfg({ w: 76, d: 38, drain: "linear" }), cat, { source: "all" })[0];
  assert.equal(wide.tray.sku, "SLRKSLT1930965S");
  assert.deepEqual({ kind: wide.kind, tw: wide.tw, td: wide.td, rot: wide.rot }, { kind: "exact", tw: 76, td: 38, rot: false });
  const deep = trayCandidates(cfg({ w: 38, d: 76, drain: "linear" }), cat, { source: "all" })[0];
  assert.equal(deep.tray.sku, "KSLT965/1930S");
  assert.deepEqual({ kind: deep.kind, tw: deep.tw, td: deep.td, rot: deep.rot }, { kind: "exact", tw: 38, td: 76, rot: false });
});
test("drains", () => {
  assert.deepEqual((({ g, drain, part }) => ({ g, drain, part }))(by("KD2FLKPVC")),
    { g: "drain", drain: "point", part: "flange" });
  assert.deepEqual((({ part, len }) => ({ part, len }))(by("KLVRID3EB122")),
    { part: "channel", len: 48 });
});
test("membrane/band/board/curb/set", () => {
  assert.equal(by("KERDI200/10M").sf, 108);
  assert.equal(by("KEBA100/125/10M").lf, 33);
  assert.equal(by("KB1212202440").sf, 32);
  assert.equal(by("KBSC1151501524").len, 60);
  assert.equal(by("SLRSETA50W").g, "set");
  assert.equal(by("SLRKSR3051220").ramp, true);
  assert.equal(by("SLRKSK9651525PVC").g, "kit");
  assert.ok(Math.abs(by("KB506252440").sf - 16.33) < 0.01);
});
test("non-shower items are null", () => {
  assert.equal(classify({ sku: "SLRA100ATGB", name: '3/8" Schluter Jolly' }), null);
});

test("KERDI-BOARD-Z* profiles are null, never wall boards (KBZS fastener boxes stay)", () => {
  // the live EFT's ZFP flat plastic profile — a hardware-attachment stick,
  // not a panel; it used to classify g:"board" with a bogus sf and win the
  // wall pick when no other board carried an sf
  assert.equal(classify({ sku: "KBZFP176E", name: "Kerdi-Board-Zfp Flat Plastic Profile", size: `5/16"x8'2-1/2"` }), null);
  assert.equal(classify({ sku: "SLRKBZFP176E", name: "Kerdi-Board-Zfp Flat Plastic Profile", size: `8'2-1/2"` }), null);
  assert.equal(classify({ sku: "KBZA160AE", name: "Kerdi-Board-Za Angle Profile", size: `8'2-1/2"` }), null);
  assert.equal(classify(FIXTURE_ITEMS.find((i) => i.sku === "KBZS35GT32Z")).fastener, true);
});

test("an EFT-imported board's bare size (thickness split out by the import) still carries sf", () => {
  // pricebook.js THREE_IN_RE writes "1/2IN X 48IN X 96IN" as size "48x96"
  // with the thickness in its own field (ticket 083) — no inch marks
  const b = classify({ sku: "KB1212202440", name: "Kerdi-Board 1/2in Panel", size: "48x96" });
  assert.equal(b.sf, 32);
  assert.equal(b.thickMm, 12);
  assert.ok(!b.thick2);
  const half = classify({ sku: "KB1212202440", name: "Kerdi-Board 1/2in Panel", size: "24.5x96" });
  assert.ok(Math.abs(half.sf - 16.33) < 0.01);
});

test("a garbled import's thickness×width size never prices a panel — the KB code's own dims stand in", () => {
  // the live ERP export's stored shape for KB1212201625 (issue: markless
  // "0.5 X 48 X 64" description read as size "0.5x48" with "X64" left in the
  // name) — the wall pick billed 618 panels off the 0.17-sf fragment
  const b = classify({ sku: "KB1212201625", name: "X64 Kerdi-Board Panel", size: "0.5x48" });
  assert.ok(Math.abs(b.sf - 21.33) < 0.01);
  assert.equal(b.size, '48"x64"x1/2"');
  assert.equal(b.thickMm, 12);
  assert.ok(!b.thick2);
  // same rule on an inch-marked fragment
  assert.ok(Math.abs(classify({ sku: "KB1212201625", name: "Kerdi-Board Panel", size: '0.5"x48"' }).sf - 21.33) < 0.01);
  // the 2" board's code-derived dims agree with its sheet text
  const fat = classify({ sku: "KB506252440", name: "Kerdi-Board 2in Panel", size: "" });
  assert.ok(Math.abs(fat.sf - 16.33) < 0.01);
  assert.ok(fat.thick2);
});

test("the garbled board row prices the wall in whole panels, not fragments (the 618-panel bill)", () => {
  const rows = [
    { sku: "1509748", vendorSkus: ["KB1212201625"], name: "X64 Kerdi-Board Panel", size: "0.5x48", price: 74.38, cost: 49.58, stock: true },
  ];
  // the screenshot room: 72×48, three walls at 84" = 98 sf
  const c = { w: 72, d: 48, curbed: true, drain: "point", wallSys: "board",
    walls: [{ on: true, len: 72, h: 84 }, { on: true, len: 48, h: 84 }, { on: true, len: 48, h: 84 }] };
  const b = buildKit(c, catalogOf(rows), { source: "all" });
  const wall = b.lines.find((l) => l.g === "Walls" && l.item.g === "board" && !l.item.fastener);
  assert.equal(wall.qty, 5); // ceil(98 × 1.05 / 21.33)
});

test("full-catalog wall pick lands the EFT ½\" panel, never a Z-profile", () => {
  const rows = [
    { sku: "KBZFP176E", name: "Kerdi-Board-Zfp Flat Plastic Profile", size: `5/16"x8'2-1/2"`, price: 0, cost: 24.5, stock: false },
    { sku: "KB1212202440", name: "Kerdi-Board 1/2in Panel", size: "48x96", price: 0, cost: 79.01, stock: false },
  ];
  const c = { w: 48, d: 48, curbed: true, drain: "point", wallSys: "board",
    walls: [{ on: true, len: 48, h: 84 }, { on: true, len: 48, h: 84 }, { on: true, len: 48, h: 84 }] };
  const b = buildKit(c, catalogOf(rows), { source: "all" });
  const wall = b.lines.find((l) => l.g === "Walls" && l.item.g === "board" && !l.item.fastener);
  assert.equal(wall.item.sku, "KB1212202440");
  assert.equal(wall.qty, 3); // ceil(84 sf × 1.05 / 32)
});

test("registry-shaped row (shop-code sku, mfg code in vendorSkus) classifies as a tray via vendorSkus", () => {
  const row = { sku: "1509824", vendorSkus: ["KST965BF"], description: '38"x38" Kerdi Shower Tray…', stock: true, price: 101.14, cost: 67.42 };
  const c = classify(row);
  assert.ok(c);
  assert.equal(c.g, "tray");
});

// Own test: every fixture row classifies — this fixture is all shower-system
// rows plus kits, so the expected null set is empty. A row that legitimately
// belongs outside the shower-system grammar would need to be named here.
test("classify covers every fixture row (expected-null set is empty)", () => {
  const EXPECTED_NULL_SKUS = new Set();
  const nulls = FIXTURE_ITEMS
    .filter((item) => classify(item) === null)
    .map((item) => item.sku);
  assert.deepEqual(new Set(nulls), EXPECTED_NULL_SKUS);
});

// --- Solver: catalogOf, trayCandidates, pickRolls (Task 3) ---

const CAT = catalogOf(FIXTURE_ITEMS);
const cfg = (o) => ({ w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane",
  walls: [{ on: true, len: 60, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }], ...o });

test("60x38 point: exact tray first", () => {
  const c = trayCandidates(cfg({}), CAT, { source: "all" });
  assert.equal(c[0].kind, "exact");
  assert.equal(c[0].tray.sku, "KST965/1525");
});
test("48x48 linear stock-only re-ranks to the 55x55 deep cut", () => {
  const c = trayCandidates(cfg({ w: 48, d: 48, drain: "linear" }), CAT, { source: "stock" });
  assert.equal(c[0].tray.sku, "KSLT1395S");
  assert.equal(c[0].deep, true);
});
test("no tray fits -> mortar card", () => {
  const c = trayCandidates(cfg({ w: 30, d: 90 }), CAT, { source: "all" });
  assert.equal(c[0].kind, "mortar");
});
test("curbless prefers thin trays", () => {
  const c = trayCandidates(cfg({ w: 38, d: 38, curbed: false }), CAT, { source: "all" });
  assert.equal(c[0].tray.thin, true);
});
test("roll ladder: 79 sf of wall -> one 108 sf roll", () => {
  const p = pickRolls(79 * 1.1, CAT, { source: "all" });
  assert.deepEqual(p.map((x) => [x.item.sku, x.qty]), [["KERDI200/10M", 1]]);
});

test("curbless thin-priority order pinned in trayCandidates", () => {
  const synCat = [
    { g: "tray", w: 38, d: 36, drain: "point", thin: true, stock: true, price: 100, sku: "SYN-THIN" },
    { g: "tray", w: 36, d: 36, drain: "point", thin: false, stock: true, price: 90, sku: "SYN-EXACT" },
  ];
  // decision 6 pinned: for curbless, thin outranks cut — owner-reviewable
  const curbless = trayCandidates(cfg({ w: 36, d: 36, curbed: false }), synCat, { source: "all" });
  assert.equal(curbless[0].tray.sku, "SYN-THIN");
  const curbed = trayCandidates(cfg({ w: 36, d: 36, curbed: true }), synCat, { source: "all" });
  assert.equal(curbed[0].tray.sku, "SYN-EXACT");
});

// --- buildKit: the shelf-kit recipes (Task 4) ---

const retail = (it) => it.stock ? it.price : it.cost * 1.5;

test("60x38 curbed point membrane — the approved bill", () => {
  // re-pinned 2026-08-24 twice: KERDI-FIX left the standing recipe by owner
  // ask (12 lines / $759.75 → 11 / $734.09), then the standalone corner and
  // seal lines left too — the KD flange kit boxes 4+2 KERECK corners and
  // both KERDI-SEALs, so separate packs double-billed (→ 7 / $671.87)
  const b = buildKit(cfg({}), CAT, { source: "all" });
  assert.equal(b.lines.filter((l) => !l.noteOnly).length, 7);
  assert.equal(b.lines.some((l) => l.item.adhesive), false);
  assert.equal(b.lines.some((l) => l.item.corner || l.item.seal), false);
  assert.equal(Math.round(linesTotal(b.lines, retail) * 100), 67187); // $671.87
  assert.equal(b.lines.filter((l) => l.so).length, 0);
});
test("linear build: Vario kit carries the seals", () => {
  const b = buildKit(cfg({ w: 48, d: 48, drain: "linear" }), CAT, { source: "all" });
  assert.equal(b.lines.some((l) => /KERECK|SEAL/.test(l.item.name)), false);
  assert.equal(b.lines.some((l) => l.item.part === "flange" && l.item.drain === "linear"), true);
});
test("mortar fallback carries the picked mortar", () => {
  const mortarItem = { name: "60 lb deck mud", price: 9.6, cost: 6.4, stock: true, sfPerBagAt15: 8 };
  const b = buildKit(cfg({ w: 30, d: 90, mortarItem }), CAT, { source: "all" });
  const m = b.lines.find((l) => l.item === mortarItem);
  assert.equal(m.qty, Math.ceil((30 * 90 / 144) / 8));
  assert.equal(b.lines.some((l) => l.g === "Base" && l.item.sf), true); // KERDI over the bed
});
test("mortar fallback without mortarItem: no-fit room must not crash", () => {
  const b = buildKit(cfg({ w: 30, d: 90 }), CAT, { source: "all" });
  const noteOnlyBase = b.lines.find((l) => l.g === "Base" && l.noteOnly);
  assert.ok(noteOnlyBase, "noteOnly placeholder Base line present");
  assert.equal(noteOnlyBase.item.name, "Mortar bed — pick a mortar in Settings → Materials");
  assert.equal(b.lines.some((l) => l.g === "Base" && l.item.sf), true); // KERDI over the bed still present
});
test("bench build-up lands 2x 2-inch board", () => {
  const b = buildKit(cfg({ bench: "buildup" }), CAT, { source: "all" });
  const x = b.lines.find((l) => l.g === "Extras");
  assert.equal(x.item.thick2, true); assert.equal(x.qty, 2);
});

test("buildKit never throws on an empty catalog", () => {
  const b = buildKit(cfg({}), [], { source: "all" });
  assert.ok(Array.isArray(b.lines));
});
test("buildKit never throws on a partial catalog (trays only)", () => {
  const traysOnly = CAT.filter((i) => i.g === "tray");
  const b = buildKit(cfg({}), traysOnly, { source: "all" });
  assert.ok(Array.isArray(b.lines));
});

test("mortar fallback with a real Settings-shaped mortar (no sfPerBagAt15) produces no NaN", () => {
  const mortarItem = { tier1: 5.5, tier2: 6.5, tier3: 7.5, unit: "bag", price: 9.6 };
  const b = buildKit(cfg({ w: 30, d: 90, mortarItem }), CAT, { source: "all" });
  assert.ok(b.lines.every((l) => Number.isFinite(l.qty)));
  const noteOnlyBase = b.lines.find((l) => l.g === "Base" && l.noteOnly);
  assert.ok(noteOnlyBase, "placeholder noteOnly line present instead of a priced mortar line");
  assert.equal(b.lines.some((l) => l.item === mortarItem), false);
});

test("mortar fallback names the picked mortar in the placeholder note when it has one", () => {
  const mortarItem = { name: "Custom Blend Mortar", tier1: 5.5, tier2: 6.5, tier3: 7.5, unit: "bag", price: 9.6 };
  const b = buildKit(cfg({ w: 30, d: 90, mortarItem }), CAT, { source: "all" });
  const noteOnlyBase = b.lines.find((l) => l.g === "Base" && l.noteOnly);
  assert.ok(/Custom Blend Mortar needs a coverage rate/.test(noteOnlyBase.note));
});

// --- Pricing lens (Task 5) ---

test("tier lens", () => {
  const tray = CAT.find((e) => e.sku === "KST965/1525");
  assert.equal(tierPrice(tray, "retail", {}), 121.91);
  assert.equal(tierPrice(tray, "cost", {}), 81.27);
  const kit = CAT.find((e) => e.g === "kit");
  assert.equal(tierPrice(kit, "retail", {}), +(kit.cost * 1.5).toFixed(2));
});

test("lineItems preserves sku when stock item has no erp (live registry shape)", () => {
  // live registry rows may have shop number in sku with no erp field
  const trayNoErp = {
    ...FIXTURE_ITEMS.find((i) => i.sku === "KST965/1525"),
    erp: undefined, // simulate live registry row without erp
  };
  const build = {
    lines: [
      { item: trayNoErp, qty: 1, noteOnly: false },
    ],
    cfg: cfg({}),
  };
  const result = lineItems(build, {});
  assert.equal(result.length, 1);
  assert.equal(result[0].sku, "KST965/1525");
});

// --- Phase-3 ride-alongs: classifier facts, kit mode, vendor lead ---

test("classify derives the facts buildKit used to text-match", () => {
  assert.equal(by("KERECK/FI2").corner, "inside");
  assert.equal(by("KERECK/FA2").corner, "outside");
  assert.equal(by("KMS172/12").seal, "pipe");
  assert.equal(by("KMSMV235/114").seal, "valve");
  assert.equal(by("KBZS35GT32Z").fastener, true);
  assert.equal(by("KBZS35GT32Z").ct, 40);
  assert.equal(by("KBZS35GT32Z100").ct, 100);
  assert.equal(by("KERDIFIX/BW").adhesive, true);
  assert.equal(by("KERDI200200/15M").wide, true);
  // the fasteners stay out of the wall-panel pick
  assert.equal(by("KBZS35GT32Z100").sf, undefined);
});

// A live registry row's name is normOrderItem's CLEANED description — often
// title-cased, never the fixture's exact string. The bill must not move when
// every name changes case: buildKit reads classifier facts, not name text.
test("buildKit is name-case-immune (live cleaned descriptions build the same bill)", () => {
  const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const liveCat = catalogOf(FIXTURE_ITEMS.map((i) => ({ ...i, name: titleCase(i.name) })));
  const retail = (e) => tierPrice(e, "retail", {});
  for (const c of [cfg({}), cfg({ wallSys: "board", bench: "buildup" }), cfg({ drain: "linear", w: 48, d: 48 })]) {
    const a = buildKit(c, CAT, { source: "all" });
    const b = buildKit(c, liveCat, { source: "all" });
    assert.equal(b.lines.length, a.lines.length);
    assert.equal(Math.round(linesTotal(b.lines, retail) * 100), Math.round(linesTotal(a.lines, retail) * 100));
  }
});

// --- Final-review fixes: rotation, board thickness, fastener packs ---

test("a room deeper than wide fits a rotated point tray (linear trays never rotate)", () => {
  // 38×60 room: the 60×38 KST tray drops in rotated 90° — exact, not mortar
  const c = cfg({ w: 38, d: 60 });
  const cands = trayCandidates(c, CAT, { source: "all" });
  assert.equal(cands[0].kind, "exact");
  assert.equal(cands[0].tray.sku, "KST965/1525");
  assert.equal(cands[0].rot, true);
  assert.deepEqual({ tw: cands[0].tw, td: cands[0].td }, { tw: 38, td: 60 });
  // a linear tray's channel edge is directional: the 36×55 LTS (drain on the
  // 36" side) drops into a 36-wide room as-is, never by rotation
  const lin = trayCandidates(cfg({ w: 36, d: 55, drain: "linear" }), CAT, { source: "all" });
  assert.ok(lin.every((x) => !x.rot));
  assert.equal(lin[0].tray.sku, "SLRKSLT9151395S");
  assert.equal(lin[0].kind, "exact");
});

test("board thickness rides the KB<mm> SKU prefix; the ½\" panel wins the wall pick over a thicker, bigger board", () => {
  assert.equal(by("KB1212202440").thickMm, 12);
  assert.equal(by("KB506252440").thickMm, 50);
  // grammar alone marks the 2" board even when the size text is unreadable
  assert.equal(classify({ sku: "KB506252440", name: "Kerdi-Board 2in Panel", size: "" }).thick2, true);
  // a synthetic 5/8" 40 sf panel must NOT outrank the stocked ½" 32 sf one
  const fat = classify({ sku: "KB1612203050", name: "KERDI-BOARD 5/8\" panel", size: '48"×120" = 40 sf', price: 150, cost: 100, stock: true });
  assert.equal(fat.thickMm, 16);
  const b = buildKit(cfg({ wallSys: "board" }), CAT.concat([fat]), { source: "all" });
  const wall = b.lines.find((l) => l.g === "Walls" && l.item.g === "board" && !l.item.fastener);
  assert.equal(wall.item.sku, "KB1212202440");
});

test("fastener quantity follows the box count (100-ct assumption scaled by ct)", () => {
  const noBig = CAT.filter((i) => i.sku !== "KBZS35GT32Z100");
  const c = cfg({ wallSys: "board" });
  const sf = c.walls.reduce((s, x) => s + (x.len * x.h) / 144, 0);   // 79.33 sf of wall
  const b = buildKit(c, noBig, { source: "all" });
  const fast = b.lines.find((l) => l.item.fastener);
  assert.equal(fast.item.ct, 40);
  assert.equal(fast.qty, Math.ceil((sf * (100 / 60)) / 40));
  // with the 100-ct box the math reduces to the old ceil(sf/60) — pinned so the recipe doesn't move
  const b2 = buildKit(c, CAT, { source: "all" });
  assert.equal(b2.lines.find((l) => l.item.fastener).qty, Math.ceil(sf / 60));
});

// --- Phase 4: pickFrom — uniform stock-only picks, no role drops silently ---

// Flip named SKUs to special-order (the live registry can hold a role only as
// an EFT row) without touching anything else.
const soFlip = (skus) => catalogOf(FIXTURE_ITEMS.map((i) => (skus.includes(i.sku) ? { ...i, stock: false } : i)));

test("pickFrom prefers a stocked match under stock, falls back to special order, and is plain find under all", () => {
  const isGrate = (i) => i.g === "drain" && i.part === "grate";
  // all three grates stocked: both sources take the first
  assert.equal(pickFrom(CAT, isGrate, { source: "all" }).sku, CAT.find(isGrate).sku);
  assert.equal(pickFrom(CAT, isGrate, { source: "stock" }).sku, CAT.find(isGrate).sku);
  // first grate flipped SO: stock prefers the next stocked one, all keeps order
  const flipped = soFlip(["KD4GRKE"]);
  assert.equal(pickFrom(flipped, isGrate, { source: "all" }).sku, "KD4GRKE");
  assert.equal(pickFrom(flipped, isGrate, { source: "stock" }).sku, "KD4GRKECS");
  // every grate SO: stock still returns one (flagged by the line, never dropped)
  const allSo = soFlip(["KD4GRKE", "KD4GRKECS", "KDIF4GRKEBD5"]);
  assert.equal(pickFrom(allSo, isGrate, { source: "stock" }).sku, "KD4GRKE");
});

test("stock-only never silently drops a role: SO-only grate and channel still land, flagged", () => {
  // point room, every grate SO
  const noGrates = soFlip(["KD4GRKE", "KD4GRKECS", "KDIF4GRKEBD5"]);
  const b1 = buildKit(cfg({}), noGrates, { source: "stock" });
  const grate = b1.lines.find((l) => l.item.part === "grate");
  assert.ok(grate, "grate line must survive stock-only");
  assert.equal(grate.so, true);
  // linear room, every channel SO — today this line vanishes under stock
  const noChans = soFlip(["KLVRID3EB122", "KLVRID3EB244", "KLVRID5EB122"]);
  const b2 = buildKit(cfg({ w: 48, d: 48, drain: "linear" }), noChans, { source: "stock" });
  const chan = b2.lines.find((l) => l.item.part === "channel");
  assert.ok(chan, "channel line must survive stock-only");
  assert.equal(chan.so, true);
});

test("stock-only prefers stocked curb multiples over a special-order covering curb (the P2 example)", () => {
  // 60" curb SO, 48" stocked → a 60" entry takes 2× 48" cut end-to-end
  const flipped = soFlip(["KBSC1151501524"]);
  const b = buildKit(cfg({}), flipped, { source: "stock" });
  const curb = b.lines.find((l) => l.g === "Curb");
  assert.equal(curb.item.sku, "KBSC1151501220");
  assert.equal(curb.qty, 2);
  assert.match(curb.note, /end-to-end/);
  // under full catalog the covering 60" still wins (flagged SO)
  const bAll = buildKit(cfg({}), flipped, { source: "all" });
  assert.equal(bAll.lines.find((l) => l.g === "Curb").item.sku, "KBSC1151501524");
});

test("stock-only band uses stocked multiples to COVER the need, never a short single roll", () => {
  // 72×60 membrane room needs ~41 lf; the 98' band flipped SO leaves the 33'
  // stocked roll — two of them, not one silently short
  const flipped = soFlip(["KEBA100/125"]);
  const c = cfg({ w: 72, d: 60, walls: [
    { on: true, len: 72, h: 84 }, { on: true, len: 60, h: 84 }, { on: true, len: 60, h: 84 }] });
  const band = buildKit(c, flipped, { source: "stock" }).lines.find((l) => l.item.lf);
  assert.equal(band.item.lf, 33);
  assert.equal(band.qty, 2);
  // full catalog keeps the covering 98' roll at qty 1
  const bandAll = buildKit(c, flipped, { source: "all" }).lines.find((l) => l.item.lf);
  assert.equal(bandAll.item.lf, 98);
  assert.equal(bandAll.qty, 1);
});

test("stock-only never drops the membrane role: SO-only rolls still land, flagged", () => {
  const rollSkus = FIXTURE_ITEMS.filter((i) => /^KERDI200/.test(i.sku)).map((i) => i.sku);
  const noRolls = soFlip(rollSkus);
  const b = buildKit(cfg({}), noRolls, { source: "stock" });
  const rolls = b.lines.filter((l) => l.g === "Walls" && l.item.g === "membrane");
  assert.ok(rolls.length > 0, "membrane wall lines must survive stock-only");
  assert.ok(rolls.every((l) => l.so === true));
});

test("bench board picks follow the same stock-only rule as the walls", () => {
  // framed bench: the 32-sf board SO → the stocked 21.3-sf board wraps it
  const flipped = soFlip(["KB1212202440"]);
  const framed = buildKit(cfg({ bench: "framed" }), flipped, { source: "stock" })
    .lines.find((l) => l.g === "Extras");
  assert.equal(framed.item.sku, "KB1212201625");
  // 2" build-up: the only thick board SO → still lands, flagged
  const noThick = soFlip(["KB506252440"]);
  const buildup = buildKit(cfg({ bench: "buildup" }), noThick, { source: "stock" })
    .lines.find((l) => l.g === "Extras");
  assert.equal(buildup.item.thick2, true);
  assert.equal(buildup.so, true);
});

test("stock-only linear channel: a covering SO channel beats a short stocked one, flagged", () => {
  // 72\" room needs a 64\" run; the 8' channel SO, the 4' ones stocked —
  // a channel can't be doubled, so the covering SO one wins, flagged
  const flipped = soFlip(["KLVRID3EB244"]);
  const b = buildKit(cfg({ w: 72, d: 48, drain: "linear" }), flipped, { source: "stock" });
  const ch = b.lines.find((l) => l.item.part === "channel");
  assert.equal(ch.item.len, 96);
  assert.equal(ch.so, true);
});

test("the pinned 60×38 truth-table total is untouched by the pickFrom refactor", () => {
  // re-pinned 2026-08-24: KERDI-FIX removal ($759.75 − 25.66), then the
  // corner/seal removal ($734.09 − 62.22 — they ride the flange kit box)
  const retail = (e) => tierPrice(e, "retail", {});
  const b = buildKit(cfg({}), CAT, { source: "all" });
  assert.equal(Math.round(linesTotal(b.lines, retail) * 100), 67187);
});

test("lineItems: wedi-shaped (build, opts) with build.mode and the vendor lead", () => {
  const c = cfg({});
  const build = { ...buildKit(c, CAT, { source: "all" }), mode: "kit", cfg: c };
  const rows = lineItems(build, {});
  assert.equal(rows[0].schluter.mode, "kit");
  assert.equal(rows[0].schluter.cfg.w, 60);
  assert.ok(rows.slice(1).every((r, i) => r.schluter.part === build.lines.filter((l) => !l.noteOnly)[i + 1].item.sku));
  assert.equal(rows[0].schluter.key, build.lines[0].item.sku);
  // mode defaults to custom when the build doesn't carry one
  assert.equal(lineItems({ lines: build.lines, cfg: c }, {})[0].schluter.mode, "custom");
  // fixture names already lead with a Schluter family word — no doubled lead
  assert.ok(rows.every((r) => !/^Schluter — (Schluter|KERDI|KERECK|KERS)/i.test(r.brandColor)));
  // a classified entry whose name doesn't say the brand gets the lead
  const grate = { ...CAT.find((e) => e.part === "grate"), name: '4" grate kit floral brushed SS' };
  const led = lineItems({ lines: [{ item: grate, qty: 1 }], cfg: c }, {});
  assert.equal(led[0].brandColor, 'Schluter — 4" grate kit floral brushed SS');
  // …but a Settings mortar line (no classifier g) never wears the vendor lead
  const mortar = { name: "60 lb deck mud", price: 12, cost: 12, stock: true, sfPerBagAt15: 8 };
  const mrows = lineItems({ lines: [{ item: mortar, qty: 4 }], cfg: c }, {});
  assert.equal(mrows[0].brandColor, "60 lb deck mud");
});

// --- extra walls (cfg.xwalls) + the entry opening -------------------------

test("an added wall's sf rides the wall pick and the ALL-SET count", () => {
  const base = buildKit(cfg({}), CAT, { source: "all" });
  const walled = buildKit(cfg({ xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84 }] }), CAT, { source: "all" });
  const note = (b) => b.lines.find((l) => l.g === "Walls" && !l.noteOnly).note;
  assert.match(note(base), /^79 sf of wall/);
  assert.match(note(walled), /^93 sf of wall/); // + 24×84/144 = 14 sf
});

test("an entry wall shortens the curb to the opening", () => {
  const b = buildKit(cfg({ xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84 }] }), CAT, { source: "all" });
  const c = b.lines.find((l) => l.g === "Curb");
  // 60 − 24 = 36" opening → the 38" curb covers it, not the 60"
  assert.equal(c.item.len, 38);
  assert.equal(c.qty, 1);
  assert.match(c.note, /cut to the 3' entry opening/);
});

test("a fully walled entry carries no curb line at all", () => {
  const b = buildKit(cfg({ xwalls: [{ edge: "entry", at: "lo", len: 60, h: 84 }] }), CAT, { source: "all" });
  assert.equal(b.lines.some((l) => l.g === "Curb"), false);
  // the ramp is an OPT-IN (round 6 — owner 2026-08-24): a curbless room
  // bills it only when cfg.ramp asks, never automatically
  const bare = buildKit(cfg({ curbed: false }), CAT, { source: "all" });
  assert.equal(bare.lines.some((l) => l.g === "Curb"), false);
  const r = buildKit(cfg({ curbed: false, ramp: true, xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84 }] }), CAT, { source: "all" });
  assert.equal(r.lines.some((l) => l.g === "Curb" && l.item.ramp), true);
});

test("entryOpening clamps walls past the entry width", () => {
  assert.equal(entryOpening({ w: 60, xwalls: [{ edge: "entry", len: 999 }] }), 0);
  assert.equal(entryOpening({ w: 60, xwalls: [{ edge: "left", len: 24 }] }), 60);
});

// --- the pinned drain (cfg.drainX/drainY) ---------------------------------

test("a pinned drain splits the cut to land on the pin", () => {
  // 50×38 room on the 60×38 tray: 10" total off the width. Unpinned the cut
  // comes off the far side (drain stays at the moulded 30"); pinned at 20"
  // from the left the split flips — 10" off the left lands it exactly.
  const un = trayCandidates(cfg({ w: 50 }), CAT, { source: "all" })[0];
  assert.equal(un.dx, 30);
  assert.equal(un.cutL, 0);
  assert.equal(un.pinned, undefined);
  const c = trayCandidates(cfg({ w: 50, drainX: 20 }), CAT, { source: "all" })[0];
  assert.equal(c.tray.sku, "KST965/1525");
  assert.equal(c.dx, 20);
  assert.equal(c.cutL, 10);
  assert.equal(c.miss, 0);
  assert.equal(c.pinned, true);
});

test("a pin past the cut's reach clamps and reports the miss", () => {
  const c = trayCandidates(cfg({ w: 50, drainX: 5 }), CAT, { source: "all" })[0];
  assert.equal(c.dx, 20); // moulded 30 − the full 10" cut
  assert.equal(c.miss, 15);
});

test("pinned rooms rank by miss: a bigger cut that reaches the pin beats an exact tray that can't", () => {
  const room = cfg({ w: 48, d: 48 });
  assert.equal(trayCandidates(room, CAT, { source: "all" })[0].cut, 0);
  // pin 8" off centre: the exact 48×48 trays miss by 8; the 48×72's whole
  // 24" of cut comes off one width side and lands the pin exactly
  const pinned = trayCandidates({ ...room, drainX: 16, drainY: 24 }, CAT, { source: "all" });
  assert.equal(pinned[0].tray.sku, "KST1220/1830");
  assert.equal(pinned[0].miss, 0);
  assert.ok(pinned.every((c, i) => i === 0 || c.miss >= pinned[i - 1].miss));
});

test("a linear room ignores the pin", () => {
  const c = trayCandidates(cfg({ w: 48, d: 48, drain: "linear", drainX: 10 }), CAT, { source: "all" })[0];
  assert.equal(c.pinned, undefined);
  assert.equal(c.miss, 0);
});

// --- drain preference "any" + corner cuts ---------------------------------

test('"any" preference pools every tray and the PICK decides what gets billed', () => {
  const room = cfg({ w: 48, d: 48, drain: "any" });
  const cands = trayCandidates(room, CAT, { source: "all" });
  // cheapest exact 48x48 leads; the linear 48x48 is in the pool too
  assert.equal(cands[0].tray.sku, "KST1220BF");
  const lin = cands.find((c) => c.tray.drain === "linear");
  assert.ok(lin);
  // billed off the picked tray, not the stated preference
  const linBuild = buildKit(room, CAT, { source: "all", pick: lin });
  assert.ok(linBuild.lines.some((l) => l.item.part === "channel"));
  assert.equal(linBuild.lines.some((l) => l.item.corner), false);
  const ptBuild = buildKit(room, CAT, { source: "all", pick: cands[0] });
  assert.ok(ptBuild.lines.some((l) => l.item.part === "grate"));
  assert.match(ptBuild.lines.find((l) => l.item.part === "flange").note, /incl\. 4\+2 corners/);
});

test('a pinned "any" room scores a linear tray against its channel run, never a free zero', () => {
  const cands = trayCandidates(cfg({ w: 48, d: 48, drain: "any", drainX: 24, drainY: 24 }), CAT, { source: "all" });
  assert.equal(cands[0].miss, 0);
  assert.notEqual(cands[0].tray.drain, "linear");
  const lin = cands.find((c) => c.tray.drain === "linear");
  if (lin) assert.equal(lin.miss, 21.25); // pin 24 back vs the channel at 2.75
});

test("a cut FRONT corner adds the curb's diagonal; a back corner never does", () => {
  const base = buildKit(cfg({}), CAT, { source: "all" });
  const fl = buildKit(cfg({ corners: ["fl"] }), CAT, { source: "all" });
  const bl = buildKit(cfg({ corners: ["bl"] }), CAT, { source: "all" });
  const curbOf = (b) => b.lines.find((l) => l.g === "Curb");
  assert.equal(curbOf(base).qty, 1);
  // the run gives up the 12" leg but the diagonal is figured at its longest
  // point (48 + 23.33 = 71.33) — outruns the 60" curb, a second is cut on
  assert.equal(curbOf(fl).qty, 2);
  assert.match(curbOf(fl).note, /turns a cut corner diagonally/);
  assert.equal(curbOf(bl).qty, 1);
});

// --- open edges carry curb + per-wall faces (round 6) ----------------------

test("a wall turned off hands its edge to the curb", () => {
  const noLeft = cfg({});
  noLeft.walls = noLeft.walls.map((w, i) => (i === 1 ? { ...w, on: false } : w));
  const r = openRuns(noLeft);
  assert.deepEqual(r.segs.map((s) => [s.side, s.from, s.len]), [["left", 0, 38], ["entry", 0, 60]]);
  assert.equal(r.need, 98);
  // the bill covers the whole open run, not just the entry
  const b = buildKit(noLeft, CAT, { source: "all" });
  const c = b.lines.find((l) => l.g === "Curb");
  assert.equal(c.qty, 2); // 98" over 60" curbs, cut end-to-end
  assert.match(c.note, /end-to-end/);
});

test("a cut corner between two open edges takes one diagonal and both legs", () => {
  const noLeft = cfg({ corners: ["fl"] });
  noLeft.walls = noLeft.walls.map((w, i) => (i === 1 ? { ...w, on: false } : w));
  const r = openRuns(noLeft);
  // fl touches the left run's hi end and the entry run's lo end — 12" off each
  assert.deepEqual(r.segs.map((s) => [s.side, s.from, s.len]), [["left", 0, 26], ["entry", 12, 48]]);
  assert.equal(r.diags.length, 1);
  assert.equal(r.diags[0].cut, 23.33); // hypot(12+4.5, 12+4.5) — the longest point
});

test("openRuns matches the old entry-only contract on a default room", () => {
  assert.deepEqual(openRuns(cfg({})).segs, [{ side: "entry", from: 0, len: 60, ext0: 0, ext1: 0 }]);
  assert.equal(openRuns(cfg({})).need, 60);
});

test("wall faces feed the area: both doubles, in-end adds the end strip", () => {
  const both = cfg({});
  both.walls = both.walls.map((w, i) => (i === 1 ? { ...w, faces: "both" } : w));
  const b = buildKit(both, CAT, { source: "all" });
  // base 79.3 sf + the left wall's second face (38×84/144 ≈ 22.2 sf) = 101.5
  assert.match(b.lines.find((l) => l.g === "Walls").note, /^10[12] sf of wall/);
  const end = cfg({ xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84, faces: "in-end" }] });
  const be = buildKit(end, CAT, { source: "all" });
  // 79 + 24×84/144 = 93, + the exposed 4" end strip (4×84/144 ≈ 2.3) → 96
  assert.match(be.lines.find((l) => l.g === "Walls").note, /^96 sf of wall/);
});

// --- benches (wedi parity round 3): normBench / benchTrayRoom / cfg.benches -

test("normBench defaults: wall bench spans the run at 14\" deep, corner takes its legs", () => {
  const wb = normBench({ kind: "wall", side: "back", build: "framed" }, { w: 60, d: 38 }, CAT);
  assert.deepEqual(wb, { kind: "wall", side: "back", build: "framed", part: null, len: 60, depth: 14, h: 20, trayFit: "cut" });
  const cb = normBench({ kind: "corner", corner: "br" }, { w: 60, d: 38 }, CAT);
  assert.equal(cb.build, "site");
  assert.equal(cb.size, 24);
});

test("only a framed bench carries trayFit — \"cut\" unless the row says smaller", () => {
  const sm = normBench({ kind: "wall", side: "back", build: "framed", trayFit: "smaller" }, { w: 60, d: 38 }, CAT);
  assert.equal(sm.trayFit, "smaller");
  const site = normBench({ kind: "wall", side: "back", build: "site", trayFit: "smaller" }, { w: 60, d: 38 }, CAT);
  assert.equal(site.trayFit, undefined);
});

test("a premade SB bench's dims come off its SKU code", () => {
  const tri = classify({ sku: "KBSB410TA", name: "Kerdi-Board-Sb Shower Bench" });
  assert.equal(tri.extra, "bench");
  assert.deepEqual(tri.bench, { corner: true, a: 16 });
  const rect = classify({ sku: "KBSB4101220RA", name: "Kerdi-Board-Sb Shower Bench" });
  assert.deepEqual(rect.bench, { d: 16, len: 48 });
  // the 11½" bench must not round to 11"
  const narrow = classify({ sku: "KBSB292965RA", name: "Kerdi-Board-Sb Shower Bench" });
  assert.deepEqual(narrow.bench, { d: 11.5, len: 38 });
  const n = normBench({ kind: "wall", side: "left", part: "KBSB4101220RA" }, { w: 60, d: 60 }, CAT.concat([rect]));
  assert.equal(n.build, "premade");
  assert.equal(n.len, 48);
  assert.equal(n.depth, 16);
});

test("niches and the bench corner kit classify with their subtypes", () => {
  assert.equal(by("KB12SN305508A1").extra, "niche");
  assert.equal(by("KB12SNLT2WW").extra, "niche");
  assert.equal(classify({ sku: "KERSB", name: "Kers-B Bench Corner Kit" }).extra, "benchkit");
});

test("only a framed wall bench shrinks the tray room", () => {
  const dims = { w: 60, d: 38 };
  const framed = normBench({ kind: "wall", side: "back", build: "framed" }, dims, CAT);
  const site = normBench({ kind: "wall", side: "back", build: "site" }, dims, CAT);
  assert.deepEqual(benchTrayRoom([framed], dims), { w: 60, d: 24, x0: 0, y0: 14 });
  assert.deepEqual(benchTrayRoom([site], dims), { w: 60, d: 38, x0: 0, y0: 0 });
  const left = normBench({ kind: "wall", side: "left", build: "framed" }, dims, CAT);
  assert.deepEqual(benchTrayRoom([left], dims), { w: 46, d: 38, x0: 14, y0: 0 });
});

test("a framed bench holds the tray at its face and says so — the tray choice never moves by default", () => {
  // 60×38 with a framed back bench: the ranking stays the FULL room's (the
  // exact 60×38 tray keeps winning, owner 2026-08-24) and the line says the
  // landed 60×24 cut at the bench face
  const bare = trayCandidates(cfg({}), CAT, { source: "all" });
  const held = trayCandidates(cfg({ benches: [{ kind: "wall", side: "back", build: "framed" }] }), CAT, { source: "all" });
  assert.deepEqual(held.map((c) => c.tray.sku), bare.map((c) => c.tray.sku));
  assert.equal(held[0].cut, bare[0].cut);
  assert.equal(held[0].x0, undefined);
  const b = buildKit(cfg({ benches: [{ kind: "wall", side: "back", build: "framed" }] }), CAT, { source: "all" });
  const base = b.lines.find((l) => l.g === "Base");
  assert.match(base.note, /cut down to 5'×2'/);
  assert.match(base.note, /stops at the framed bench face/);
  const wrap = b.lines.find((l) => l.g === "Extras");
  assert.match(wrap.note, /framed bench/);
});

test("trayFit \"smaller\" re-fits the clear space and centres the drain there unless pinned", () => {
  // framed back bench (14") set to Smaller tray on 60×38: the ranking runs in
  // the clear 60×24 and the auto pin is its centre — dy lands 12" into the
  // clear space (26" in room coords)
  const sm = trayCandidates(cfg({ benches: [
    { kind: "wall", side: "back", build: "framed", trayFit: "smaller" }] }), CAT, { source: "all" });
  const c = sm[0];
  assert.ok(c.tray);
  assert.equal(c.y0, 14);
  assert.equal(c.centered, true);
  assert.equal(c.dx, 30);
  assert.equal(c.dy, 26);
  assert.equal(c.miss, 0);
  // typed drain dimensions beat the auto centre
  const pinned = trayCandidates(cfg({ benches: [
    { kind: "wall", side: "back", build: "framed", trayFit: "smaller" }], drainY: 30 }), CAT, { source: "all" });
  assert.equal(pinned[0].centered, undefined);
  assert.equal(pinned[0].dy, 30);
});

test("cfg.benches bills per bench: site 2× 2\" board, premade its own line; legacy cfg.bench still lands", () => {
  const two = buildKit(cfg({ benches: [
    { kind: "wall", side: "back", build: "site" },
    { kind: "corner", corner: "br", part: "KBSB410TA" },
  ] }), CAT.concat([classify({ sku: "KBSB410TA", name: "Kerdi-Board-Sb Shower Bench", price: 153.13, cost: 102.09, stock: true })]), { source: "all" });
  const extras = two.lines.filter((l) => l.g === "Extras");
  assert.equal(extras.length, 2);
  assert.equal(extras[0].item.thick2, true);
  assert.equal(extras[0].qty, 2);
  assert.equal(extras[1].item.sku, "KBSB410TA");
  const legacy = buildKit(cfg({ bench: "buildup" }), CAT, { source: "all" });
  assert.equal(legacy.lines.filter((l) => l.g === "Extras")[0].qty, 2);
});

test("a pinned drain follows a smaller-tray bench's shifted tray room", () => {
  // framed LEFT bench (14" deep, Smaller tray) on a 60×38 room: tray room
  // 46×38 starting at x0=14 — a pin at the room centre (30) reads 16 in tray
  // space and the achieved dx comes back in ROOM coords
  const cands = trayCandidates(cfg({ w: 60, d: 38,
    benches: [{ kind: "wall", side: "left", build: "framed", trayFit: "smaller" }], drainX: 30, drainY: 19 }), CAT, { source: "all" });
  const c = cands[0];
  assert.ok(c.tray);
  assert.equal(c.x0, 14);
  assert.ok(c.dx >= 14, "drain lands inside the tray region");
  assert.equal(round2(c.miss), round2(Math.hypot(c.dx - 30, c.dy - 19)));
});

// --- the KERDI-BOARD panel planner (round 7) --------------------------------

test("classified boards carry their sheet sides (bw/bl) from text or code", () => {
  const by = (sku) => CAT.find((i) => i.sku === sku);
  assert.equal(by("KB1212202440").bw, 48);
  assert.equal(by("KB1212202440").bl, 96);
  assert.equal(by("KB1212201625").bw, 48);
  assert.equal(by("KB1212201625").bl, 64);
  // the code fills dims in when the sheet text carries none
  const bare = classify({ sku: "KB1212202440", name: "KERDI-BOARD 1/2\" panel", size: "", stock: true, price: 1 });
  assert.equal(bare.bw, 48);
  assert.equal(bare.bl, 96);
});

test("boardSheets: the live ladder, one entry per size", () => {
  const sheets = boardSheets(CAT, { source: "all" });
  assert.deepEqual(sheets.map((s) => [s.w, s.len]), [[48, 96], [48, 64]]);
  assert.equal(sheets[0].sku, "KB1212202440");
});

test("boardPlan on the default 60x38x84 room: back in courses, sides stood vertical, zero seams", () => {
  const faces = expandBoardFaces(cfg({ wallSys: "board" }));
  const p = boardPlan(faces, CAT, { source: "all" });
  // back 60x84: two 48" courses, each one 48x64 cut to 60... the 64 wins on waste
  assert.equal(p.detail[0].vertical, false);
  assert.equal(p.detail[0].courses.length, 2);
  assert.deepEqual(p.detail[0].courses[0].lens, [60]);
  assert.equal(p.detail[0].courses[1].y0, 48);
  assert.equal(p.detail[0].courses[1].ch, 36); // clamped to the 84" wall
  // sides 38x84: one 48x96 stood on end each — no seam at all
  assert.equal(p.detail[1].vertical, true);
  assert.deepEqual(p.detail[1].courses, [{ y0: 0, ch: 84, lens: [38], vertical: true }]);
  assert.equal(p.vSeams, 0);
  assert.deepEqual(p.lines, [{ sku: "KB1212201625", qty: 2 }, { sku: "KB1212202440", qty: 2 }]);
});

test("a long wall mixes sheets: 130\" course = one 96 + one 64 cut to 34, one seam per course", () => {
  const c = cfg({ w: 130, d: 38, wallSys: "board" });
  c.walls = [{ on: true, len: 130, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }];
  const p = boardPlan(expandBoardFaces(c), CAT, { source: "all" });
  assert.deepEqual(p.detail[0].courses[0].lens, [96, 34]);
  assert.equal(p.detail[0].courses[0].y0, 0);
  assert.equal(p.vSeams, 2); // one per course on the back wall
});

test("vertical is refused when the horizontal plan is already one sheet", () => {
  const p = boardPlan([{ len: 24, h: 40, side: "back" }], CAT, { source: "all" });
  assert.equal(p.detail[0].vertical, false);
  assert.equal(p.courses, 1);
  assert.equal(p.lines.reduce((t, l) => t + l.qty, 0), 1);
});

test("108\" walls: top strips share ripped sheets, no vertical seams", () => {
  const p = boardPlan([{ len: 72, h: 108, side: "back" }, { len: 48, h: 108, side: "left" }, { len: 48, h: 108, side: "right" }], CAT, { source: "all" });
  assert.equal(p.vSeams, 0);
  assert.deepEqual(p.detail[0].courses.map((c) => c.ch), [48, 48, 12]);
  // was 7 sheets, one per 12" strip; the three strips now come out of one board
  assert.equal(p.lines.reduce((t, l) => t + l.qty, 0), 5);
});

test("expandBoardFaces appends extra faces AFTER the drawn walls, in schluterWalls order", () => {
  const c = cfg({ xwalls: [{ id: 1, edge: "entry", at: "lo", len: 24, h: 84, faces: "in-end" }] });
  c.walls = c.walls.map((w, i) => (i === 1 ? { ...w, faces: "both" } : w));
  const faces = expandBoardFaces(c);
  assert.deepEqual(faces.map((f) => [f.side, f.len, f.face || ""]),
    [["back", 60, ""], ["left", 38, ""], ["right", 38, ""], ["entry", 24, ""],
     ["left", 38, "out"], ["entry", 4, "end"]]);
});

// --- Copy for order entry (round 8) -----------------------------------------

test("orderCopyLines: stocked lines key SKU ⇥ qty, special order by description, noteOnly dropped", () => {
  const lines = [
    { item: { stock: true, erp: "1509704", sku: "KST965/1525", name: "KERDI-SHOWER-T Tray" }, qty: 1 },
    { item: { g: "curb", stock: false, sku: "SLRKSR3051220", name: "Kerdi-Shower-R Curbless Ramp" }, qty: 2 },
    { item: { name: "Cement board / drywall substrate", stock: true }, qty: 1, noteOnly: true },
  ];
  assert.deepEqual(orderCopyLines(lines), [
    "1509704\t1",
    "SLRKSR3051220 — Kerdi-Shower-R Curbless Ramp × 2", // name already leads Kerdi — no brand prepend
  ]);
  // a stocked live row with no separate erp field keys its own sku
  assert.deepEqual(orderCopyLines([{ item: { stock: true, sku: "1509749", name: "x" }, qty: 3 }]), ["1509749\t3"]);
});

// --- cfg.swaps: hand-picked parts win their role (round 9) ------------------

test("cfg.swaps overrides the grate, curb and One-size board picks", () => {
  const base = buildKit(cfg({}), CAT, { source: "all" });
  const grate0 = base.lines.find((l) => l.item.part === "grate").item.sku;
  const alt = CAT.find((i) => i.part === "grate" && i.sku !== grate0);
  const b = buildKit(cfg({ swaps: { grate: alt.sku } }), CAT, { source: "all" });
  assert.equal(b.lines.find((l) => l.item.part === "grate").item.sku, alt.sku);
  // curb: pick the 48" — the 60" entry needs 2 cut end-to-end
  const c = buildKit(cfg({ swaps: { curb: "KBSC1151501220" } }), CAT, { source: "all" });
  const cl = c.lines.find((l) => l.g === "Curb");
  assert.equal(cl.item.len, 48);
  assert.equal(cl.qty, 2);
  // board: the smaller 48×64 sheet re-figures the One-size area count
  const w2 = buildKit(cfg({ wallSys: "board", swaps: { board: "KB1212201625" } }), CAT, { source: "all" });
  const wl = w2.lines.find((l) => l.g === "Walls" && l.item.g === "board" && !l.item.fastener);
  assert.equal(wl.item.sku, "KB1212201625");
  assert.equal(wl.qty, Math.ceil((base.lines ? 79.33 : 0) * 1.05 / 21.3)); // 4
  // a stale sku falls back to the recipe pick, never lands the wrong part
  const stale = buildKit(cfg({ swaps: { grate: "NOPE" } }), CAT, { source: "all" });
  assert.equal(stale.lines.find((l) => l.item.part === "grate").item.sku, grate0);
});

// --- buildFromMarker: basket drawer re-derives a bill from a saved marker (ADR 0035 step 3) ---

test("buildFromMarker: a marker round-trips to the same bill and honors the picked tray (ADR 0035 step 3)", () => {
  const c = cfg({});
  const cands = trayCandidates(c, CAT, { source: "all" });
  assert.ok(cands.length > 1, "the test needs several candidates");
  const pick = cands[1];
  const b1 = buildKit(c, CAT, { source: "all", pick });
  const marker = { mode: "custom", cfg: { ...c, manual: [], source: "all", pick: pick.tray.sku } };
  const b2 = buildFromMarker(marker, CAT);
  assert.ok(b2);
  const bill = (b) => b.lines.filter((l) => !l.noteOnly).map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
  assert.deepEqual(bill(b2), bill(b1));
  assert.equal(b2.pick.tray.sku, pick.tray.sku, "the quoted tray stays picked, not whatever ranks first");
});

test("buildFromMarker: cfg.manual extras land as Extras lines; a stale pick falls back to rank 1", () => {
  const extra = CAT.find((e) => e.g === "membrane" && e.sku);
  const c = { ...cfg({}), manual: [{ sku: extra.sku, qty: 2 }], source: "all", pick: "no-such-sku" };
  const b = buildFromMarker({ mode: "custom", cfg: c }, CAT);
  assert.ok(b);
  const m = b.lines.find((l) => l.manual);
  assert.ok(m, "the manual extra rides the rebuilt bill");
  assert.equal(m.qty, 2);
  assert.ok(b.pick, "an unknown pick falls back to the top candidate");
});

test("buildFromMarker: no room, no catalog, junk — all null, never a throw", () => {
  assert.equal(buildFromMarker(null, CAT), null);
  assert.equal(buildFromMarker({ mode: "kit", cfg: { w: 0, d: 60 } }, CAT), null);
  assert.equal(buildFromMarker({ mode: "kit", cfg: cfg({ walls: [] }) }, []), null);
});


// --- reconfigure reads the placed rows (owner 2026-09-02) --------------------

test("sessionFromRows: a sheet-edited quantity reopens as the override; a missing line steps to 0; a stray row is a manual extra", () => {
  const c = cfg({});
  const build = buildKit(c, CAT, { source: "all" });
  const bill = build.lines.filter((l) => !l.noteOnly);
  const rows = lineItems({ ...build, cfg: c }, {});
  const [first, second, third] = bill;
  assert.equal(rowItemEntry(rows[1], CAT).sku, second.item.sku);
  assert.equal(rowItemEntry({ ...rows[1], schluter: { part: true } }, CAT)?.sku, second.item.stock ? second.item.sku : undefined, "a legacy row resolves by its shop number only when stocked");
  assert.equal(rowItemEntry({ sku: second.item.sku }, CAT), null, "a searched-in row with no marker is not a kit line");
  const edited = rows.map((r) => (r.schluter.part === second.item.sku ? { ...r, qty: String(second.qty + 3) } : r))
    .filter((r) => r.schluter.part !== third.item.sku);
  const strayKey = CAT.find((e) => !bill.some((l) => l.item.sku === e.sku)).sku;
  const s = sessionFromRows(bill, [...edited, { schluter: { part: strayKey }, qty: "2" }], CAT);
  assert.equal(s.qtyOv[ovKey(first)], undefined);
  assert.equal(s.qtyOv[ovKey(second)], second.qty + 3);
  assert.equal(s.qtyOv[ovKey(third)], 0);
  assert.deepEqual(s.manual, [{ sku: strayKey, qty: 2 }]);
  assert.deepEqual(sessionFromRows(bill, [{ schluter: { part: true }, sku: "", qty: "1" }], CAT), { qtyOv: {}, manual: [] });
  assert.deepEqual(sessionFromRows(bill, rows.map((r) => ({ ...r, qty: "" })), CAT), { qtyOv: {}, manual: [] });
});

// --- Fixed KERDI-LINE (ticket 158 P0-2): shapes from the 2025-10-01 EFT ---

test("fixed KERDI-LINE parts classify into their own group, lengths off the cm code", () => {
  const c = (sku) => classify({ sku, name: "" });
  const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
  assert.deepEqual(pick(c("SLRKL1V60E100"), ["g", "part", "len", "offset"]), { g: "line", part: "body", len: 40, offset: false });
  assert.deepEqual(pick(c("SLRKL1VO60E90"), ["g", "part", "len", "offset"]), { g: "line", part: "body", len: 36, offset: true });
  assert.deepEqual(pick(c("SLRKL1V60E50"), ["len"]), { len: 20 });
  assert.deepEqual(pick(c("SLRKL1V60E180"), ["len"]), { len: 72 });
  assert.deepEqual(pick(c("SLRKL1AR19EB100"), ["g", "part", "len", "style", "frame", "finish"]),
    { g: "line", part: "grate", len: 40, style: "solid", frame: '3/4"', finish: "EB" });
  assert.deepEqual(pick(c("SLRKL1B30EB120"), ["style", "frame", "len"]), { style: "perforated", frame: '1-1/8"', len: 48 });
  assert.deepEqual(pick(c("SLRKL1BL19EB60"), ["style", "lock"]), { style: "perforated", lock: true });
  assert.deepEqual(pick(c("SLRKL1B19TSOB140"), ["finish", "len"]), { finish: "TSOB", len: 56 });
  assert.deepEqual(pick(c("SLRKL1IFE23EB100"), ["style", "frame"]), { style: "floral", frame: '29/32"' });
  assert.equal(c("SLRKL1IFF23EB100").style, "curve");
  assert.equal(c("SLRKL1IFG23EB100").style, "pure");
  assert.deepEqual(pick(c("SLRKLTFH12E100"), ["part", "style", "frame", "len"]), { part: "grate", style: "tile", frame: '1/2"', len: 40 });
  assert.deepEqual(pick(c("SLRKL1DRE80"), ["part", "frameless", "offset", "len"]), { part: "grate", frameless: true, offset: false, len: 32 });
  assert.deepEqual(pick(c("SLRKL1DROE100"), ["frameless", "offset"]), { frameless: true, offset: true });
  assert.deepEqual(pick(c("SLRVKLEP35"), ["g", "part"]), { g: "line", part: "cover" });
  assert.deepEqual(pick(c("V/KLTSBG35"), ["g", "part"]), { g: "line", part: "cover" });
  assert.deepEqual(pick(c("SLRKLAM5K"), ["g", "part"]), { g: "line", part: "acc" });
  assert.deepEqual(pick(c("SLRKLVZSF"), ["g", "part"]), { g: "line", part: "acc" });
  assert.deepEqual(pick(c("SLRSPSA50EB120"), ["g", "part"]), { g: "line", part: "profile" });
  assert.deepEqual(pick(c("SLRSPRA23EB100"), ["g", "part"]), { g: "line", part: "profile" });
});

test("Vario accessories are not channels", () => {
  assert.deepEqual((({ g, part }) => ({ g, part }))(classify({ sku: "SLRKLVRGG2", name: "" })), { g: "line", part: "acc" });
  assert.deepEqual((({ g, part }) => ({ g, part }))(classify({ sku: "SLRKLVSTR1", name: "" })), { g: "line", part: "acc" });
  assert.equal(classify({ sku: "SLRKLVRID3EB122", name: "" }).part, "channel");
});

test("fixed KERDI-LINE rows in the catalog leave every bill untouched", () => {
  const extra = ["SLRKL1V60E100", "SLRKL1V60E180", "SLRKL1AR19EB100", "SLRKL1DRE180", "SLRKLVRGG2", "SLRKLVSTR1"]
    .map((sku) => ({ sku, name: sku, price: 1, cost: 1, stock: true }));
  const withLine = catalogOf([...FIXTURE_ITEMS, ...extra]);
  for (const c of [cfg({}), cfg({ w: 48, d: 48, drain: "linear" }), cfg({ w: 72, d: 48, drain: "linear" })]) {
    for (const source of ["all", "stock"]) {
      const skus = (b) => b.lines.map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
      assert.deepEqual(skus(buildKit(c, withLine, { source })), skus(buildKit(c, CAT, { source })));
    }
  }
});

// --- Coverage (ticket 158 P0-3) ---

test("coverageOf: KERDI rolls in sf, bands in lf, boards in sf, everything else none", () => {
  assert.deepEqual(coverageOf(by("KERDI200/10M")), { n: 108, unit: "sf" });
  assert.deepEqual(coverageOf(classify({ sku: "KEBA100/125", name: "" })), { n: 98, unit: "lf" });
  const board = classify({ sku: "KB1212202440", name: "", size: '1/2"x48"x96"' });
  assert.equal(coverageOf(board).unit, "sf");
  assert.equal(coverageOf(board).n, 32);
  assert.equal(coverageOf(by("KST965/1525")), null);
  assert.equal(coverageOf(classify({ sku: "KERECK/FI", name: "" })), null);
});

test('membrane coverage reads the "(54 SF)" spelling too', () => {
  assert.equal(classify({ sku: "KERDI200/5M", name: "KERDI membrane roll 3 FT 3 X 16 FT 5 (54 SF)" }).sf, 54);
  assert.equal(classify({ sku: "KERDI200/7M", name: "KERDI 3 FT 3 X 23 FT (75 SF)" }).sf, 75);
});

test("a point-drain grate swap never takes a KERDI-LINE grate (they share part:grate)", () => {
  const line = { sku: "SLRKL1AR19EB100", name: "Kerdi-Line grate", price: 300, cost: 200, stock: true };
  const cat = catalogOf([...FIXTURE_ITEMS, line]);
  const base = buildKit(cfg({}), cat, { source: "all" });
  const swapped = buildKit(cfg({ swaps: { grate: "SLRKL1AR19EB100" } }), cat, { source: "all" });
  const grate = (b) => b.lines.find((l) => l.g === "Drain" && l.item.part === "grate").item.sku;
  assert.equal(grate(swapped), grate(base));
  assert.notEqual(grate(swapped), "SLRKL1AR19EB100");
});

// --- Vario sizing (owner 2026-09-26): as wide as the pan or wider, cut to it ---

test("Vario channel: the shortest channel at least the pan's width, cut to the pan width", () => {
  const chan = (c) => buildKit(c, CAT, { source: "all" }).lines.find((l) => l.item.part === "channel");
  const wide = chan(cfg({ w: 55, d: 55, drain: "linear" }));
  assert.equal(wide.item.len, 96);
  assert.match(wide.note, /^cut to 55"/);
  const exact = chan(cfg({ w: 48, d: 48, drain: "linear" }));
  assert.equal(exact.item.len, 48);
  assert.match(exact.note, /^full pan width/);
});

// --- shared slot vocabulary (ticket 158 Phase 1a) --------------------------

test("every buildKit line carries a slot from the shared vocabulary", () => {
  for (const c of [cfg({}), cfg({ w: 48, d: 48, drain: "linear" }), cfg({ wallSys: "board", bench: "buildup" })]) {
    const b = buildKit(c, CAT, { source: "all" });
    for (const l of b.lines) assert.ok(isSlot(l.slot), `${l.g} ${l.item.sku || l.item.name} → ${l.slot}`);
  }
  const lin = buildKit(cfg({ w: 48, d: 48, drain: "linear" }), CAT, { source: "all" });
  assert.deepEqual(lin.lines.filter((l) => l.g === "Drain").map((l) => l.slot), ["drainBody", "flange"]);
  const pt = buildKit(cfg({}), CAT, { source: "all" });
  assert.deepEqual(pt.lines.filter((l) => l.g === "Drain").map((l) => l.slot), ["flange", "grate"]);
  assert.equal(slotOf("Setting", { g: "set" }), "setting");
});

// --- resolveDrain: a saved drain choice -> drain lines (ticket 158 Phase 1a) -

const KL = (sku, price, stock = false) => ({ sku, name: sku, price, cost: price / 1.5, stock });
const KL_ROWS = [
  ...[50, 60, 100, 120, 130, 180].map((cm) => KL(`SLRKL1V60E${cm}`, 300 + cm)),
  ...[100, 120].map((cm) => KL(`SLRKL1VO60E${cm}`, 420 + cm)),
  ...[50, 100, 120, 130, 180].map((cm) => KL(`SLRKL1AR19EB${cm}`, 280 + cm)),
  KL("SLRKL1AR19MBW130", 574.77),
  ...[100, 120].map((cm) => KL(`SLRKL1IFE23EB${cm}`, 400 + cm)),
  ...[100, 130].map((cm) => KL(`SLRKL1DRE${cm}`, 200 + cm)),
  KL("SLRKL1DROE120", 202.91),
  KL("SLRKL1BL19EB130", 535.5),
  KL("SLRKL1B19EB130", 496.59),
  KL("SLRKLVRID5EB244", 420.3),
];
const KLCAT = catalogOf([...FIXTURE_ITEMS, ...KL_ROWS]);
const skus = (r) => r.lines.map((l) => l.item.sku);

test("resolveDrain: no choice is today's Vario — shortest covering channel, cut to the pan", () => {
  const r = resolveDrain(null, 55, KLCAT, { source: "all" });
  assert.equal(r.family, "vario");
  assert.equal(r.lines[0].item.len, 96);
  assert.match(r.lines[0].note, /^cut to 55"/);
  assert.deepEqual(r.lines.map((l) => l.slot), ["drainBody", "flange"]);
});

test("resolveDrain: Vario design choice, and a design not made long enough substitutes with a note", () => {
  const r = resolveDrain({ family: "vario", design: "5", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.equal(r.lines[0].item.sku, "SLRKLVRID5EB244");
  const s = resolveDrain({ family: "vario", design: "14", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.ok(s.subst);
  assert.match(s.lines[0].note, /Slant not made/);
});

test("resolveDrain: fixed = body + grate at the longest length <= pan with both", () => {
  const r = resolveDrain({ family: "fixed", style: "solid", frame: '3/4"', finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.deepEqual(skus(r), ["SLRKL1V60E130", "SLRKL1AR19EB130"]);
  assert.deepEqual([r.len, r.gap], [52, 3]);
  assert.deepEqual(r.lines.map((l) => l.slot), ["drainBody", "grate"]);
  assert.match(r.lines[1].note, /fill 3" at the ends/);
  const full = resolveDrain({ family: "fixed", style: "solid", finish: "EB" }, 72, KLCAT, { source: "all" });
  assert.deepEqual([full.len, full.gap], [72, 0]);
});

test("resolveDrain: floral steps down to 48 and says so; lock and perforated stay apart", () => {
  const r = resolveDrain({ family: "fixed", style: "floral", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.deepEqual([r.len, r.gap], [48, 7]);
  assert.match(r.lines[0].note, /stepped down from 52"/);
  assert.equal(resolveDrain({ family: "fixed", style: "lock" }, 55, KLCAT, { source: "all" }).lines[1].item.sku, "SLRKL1BL19EB130");
  assert.equal(resolveDrain({ family: "fixed", style: "perforated" }, 55, KLCAT, { source: "all" }).lines[1].item.sku, "SLRKL1B19EB130");
});

test("resolveDrain: frameless straight and offset; offset takes only the offset frameless grate", () => {
  assert.deepEqual(skus(resolveDrain({ family: "frameless" }, 55, KLCAT, { source: "all" })), ["SLRKL1V60E130", "SLRKL1DRE130"]);
  assert.deepEqual(skus(resolveDrain({ family: "frameless", offset: true }, 55, KLCAT, { source: "all" })), ["SLRKL1VO60E120", "SLRKL1DROE120"]);
  const noFramed = resolveDrain({ family: "fixed", offset: true, style: "solid" }, 55, KLCAT, { source: "all" });
  assert.equal(noFramed.family, "vario");
  assert.ok(noFramed.fallback);
});

test("resolveDrain: an impossible fixed choice falls back to Vario and names why", () => {
  const r = resolveDrain({ family: "fixed", style: "solid" }, 18, KLCAT, { source: "all" });
  assert.equal(r.family, "vario");
  assert.match(r.fallback, /under 20"/);
  assert.match(r.lines[0].note, /Vario used/);
});

test("resolveDrain: stock only prefers a stocked match and flags a special-order one", () => {
  const cat = catalogOf([...FIXTURE_ITEMS, ...KL_ROWS.map((r) => (r.sku === "SLRKL1AR19EB120" ? { ...r, stock: true } : r))]);
  const r = resolveDrain({ family: "fixed", style: "solid", finish: "EB" }, 55, cat, { source: "stock" });
  assert.equal(r.len, 52);
  assert.equal(r.lines[1].item.stock, false);
});

test("drainOptions: availability comes from resolveDrain, never a second rule", () => {
  const o = drainOptions({ family: "fixed", style: "solid", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.equal(o.family, "fixed");
  assert.deepEqual(o.families.map((f) => [f.key, f.ok]), [["vario", true], ["fixed", true], ["frameless", true]]);
  const floral = o.styles.find((s) => s.key === "floral");
  assert.equal(floral.ok, true);
  assert.equal(floral.max, 48);
  assert.equal(o.finishes.find((f) => f.key === "MBW").ok, true);
  assert.equal(o.result.len, 52);
  assert.equal(o.fit, 52);
  const v = drainOptions(null, 55, KLCAT, { source: "all" });
  assert.equal(v.family, "vario");
  assert.ok(v.styles.some((s) => s.key === "5" && s.label === "Floral"));
});

test("drainOptions: the Frameless family chip is ok when only the offset pair fits", () => {
  const cat = catalogOf([...FIXTURE_ITEMS,
    KL("SLRKL1V60E120", 450), // straight body, no straight frameless grate anywhere in this catalog
    KL("SLRKL1VO60E120", 420), // offset body, len 48
    KL("SLRKL1DROE120", 202.91), // offset frameless grate, len 48 — the only working frameless pair
  ]);
  const o = drainOptions({ family: "frameless", offset: true }, 55, cat, { source: "all" });
  assert.equal(o.families.find((f) => f.key === "frameless").ok, true);
});

test("buildKit bills the chosen drain and reports drainFit; no choice bills as before", () => {
  const room = cfg({ w: 55, d: 55, drain: "linear" });
  const plain = buildKit(room, KLCAT, { source: "all" });
  assert.equal(plain.drainFit.family, "vario");
  const fixed = buildKit({ ...room, drainPick: { family: "fixed", style: "solid", finish: "EB" } }, KLCAT, { source: "all" });
  assert.deepEqual(fixed.lines.filter((l) => l.g === "Drain").map((l) => l.item.sku), ["SLRKL1V60E130", "SLRKL1AR19EB130"]);
  assert.deepEqual(fixed.drainFit, { family: "fixed", len: 52, gap: 3 });
  assert.equal(buildKit(cfg({}), KLCAT, { source: "all" }).drainFit, null);
});

test("a drain choice survives the marker: buildFromMarker bills the same drain", () => {
  const room = { ...cfg({ w: 55, d: 55, drain: "linear" }), drainPick: { family: "fixed", style: "solid", finish: "EB" } };
  const live = buildKit(room, KLCAT, { source: "all" });
  const back = buildFromMarker({ mode: "custom", cfg: { ...room, source: "all" } }, KLCAT);
  assert.deepEqual(back.lines.filter((l) => l.g === "Drain").map((l) => l.item.sku), live.lines.filter((l) => l.g === "Drain").map((l) => l.item.sku));
  const old = buildFromMarker({ mode: "custom", cfg: { ...cfg({ w: 55, d: 55, drain: "linear" }), source: "all" } }, KLCAT);
  assert.equal(old.drainFit.family, "vario");
});

// --- 1a carry-overs (ticket 158 Phase 1b §5) ---------------------------------

test("resolveDrain at a 36″ pan: Vario cuts the 48″ channel, fixed steps to 20″, frameless falls back", () => {
  const v = resolveDrain(null, 36, KLCAT, { source: "all" });
  assert.deepEqual([v.family, v.len, skus(v)], ["vario", 48, ["KLVRID5EB122", "KLVR2FLK"]]);
  assert.match(v.lines[0].note, /^cut to 36"/);
  const f = resolveDrain({ family: "fixed", style: "solid" }, 36, KLCAT, { source: "all" });
  assert.deepEqual([f.family, f.len, f.gap, skus(f)], ["fixed", 20, 16, ["SLRKL1V60E50", "SLRKL1AR19EB50"]]);
  assert.equal(f.lines[0].note, 'stepped down from 24" — Solid made to 20"');
  for (const offset of [false, true]) {
    const fl = resolveDrain({ family: "frameless", offset }, 36, KLCAT, { source: "all" });
    assert.equal(fl.family, "vario");
    assert.equal(fl.fallback, "frameless can't be made here: no frameless grate matches a body length that fits");
  }
});

test("resolveDrain: a stocked grate beats a cheaper special-order one at the same length only under stock", () => {
  const cat = catalogOf([...FIXTURE_ITEMS, ...KL_ROWS, { sku: "KL1AR19EB130", name: "stocked twin", price: 500, cost: 333.33, stock: true }]);
  const c = { family: "fixed", style: "solid", finish: "EB" };
  assert.deepEqual(skus(resolveDrain(c, 55, cat, { source: "all" })), ["SLRKL1V60E130", "SLRKL1AR19EB130"]);
  const st = resolveDrain(c, 55, cat, { source: "stock" });
  assert.deepEqual(skus(st), ["SLRKL1V60E130", "KL1AR19EB130"]);
  assert.equal(st.lines[1].item.stock, true);
});

test("drainOptions: fit is 0 when no KERDI-LINE body fits, and no fixed style is ok", () => {
  const o = drainOptions({ family: "fixed" }, 18, KLCAT, { source: "all" });
  assert.equal(o.fit, 0);
  assert.ok(o.styles.length > 0 && o.styles.every((s) => !s.ok));
});

test("a drainPick on a point tray is inert: no drainFit, the bill of no pick", () => {
  const bill = (b) => b.lines.map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
  const plain = buildKit(cfg({}), KLCAT, { source: "all" });
  const inert = buildKit(cfg({ drainPick: { family: "fixed", style: "solid" } }), KLCAT, { source: "all" });
  assert.equal(inert.drainFit, null);
  assert.deepEqual(bill(inert), bill(plain));
});

test("pointGrateLabel reads size, design and finish, not the row's catalog words", () => {
  assert.equal(pointGrateLabel(by("KDIF4GRKEBD5")), "4″ floral, brushed");
  assert.equal(pointGrateLabel(by("KD4GRKE")), "4″ stainless");
  assert.equal(pointGrateLabel(by("KD4GRKECS")), "4″ tileable");
  assert.equal(pointGrateLabel({ name: 'Schluter Kerdi-Drain Grate Kit 4" Floral Brushed Ss' }), "4″ Floral, Brushed");
});

// --- Phase 1b: membrane + band choices (ticket 158) -------------------------

// Test-shaped 7¼″ KERDI-BAND rows (KEBA100/185 — the width code is the mm):
// the fixture carries only the 5″ band.
const BAND_185 = [
  { sku: "KEBA100/185/5M", name: "KERDI-BAND 7-1/4\" seam band", price: 29.5, cost: 19.67, stock: false, size: "16'5\" roll" },
  { sku: "KEBA100/185", name: "KERDI-BAND 7-1/4\" seam band", price: 139.8, cost: 93.2, stock: false, size: "98'5\" roll" },
];
const BCAT = catalogOf([...FIXTURE_ITEMS, ...BAND_185]);
const picks = (r) => r.lines.map((p) => [p.item.sku, p.qty]);

test("KERDI rolls and bands carry their roll code; bands their width code", () => {
  assert.equal(by("KERDI200/10M").roll, "10M");
  assert.equal(by("KERDI200").roll, "30M");
  assert.equal(by("KERDI200200/15M").roll, "15M");
  assert.deepEqual([by("KEBA100/125/5M").width, by("KEBA100/125/5M").roll], ["125", "5M"]);
  assert.deepEqual([by("KEBA100/125").width, by("KEBA100/125").roll], ["125", "30M"]);
  const wide = classify({ sku: "SLRKEBA100/185", name: "" });
  assert.deepEqual([wide.width, wide.lf, wide.roll], ["185", 98, "30M"]);
  assert.equal(bandWidthLabel("125"), '5"');
  assert.equal(bandWidthLabel("185"), '7-1/4"');
});

test("buildKit reports the membrane and band needs the popover resolves against", () => {
  const b = buildKit(cfg({}), CAT, { source: "all" });
  assert.equal(round2(b.need.wallSf), 87.27);   // 79.33 sf of wall + 10% laps
  assert.equal(round2(b.need.bandLf), 29.56);   // 2 × (60 + 38) / 12 + 79.33 / 6
});

test("resolveMembrane: no choice is pickRolls; standard, wide and a pinned roll", () => {
  assert.deepEqual(picks(resolveMembrane(null, 87.27, CAT, { source: "all" })), [["KERDI200/10M", 1]]);
  assert.deepEqual(picks(resolveMembrane({ wide: true }, 87.27, CAT, { source: "all" })), [["KERDI200200/15M", 1]]);
  assert.deepEqual(picks(resolveMembrane({ wide: false, roll: "5M" }, 87.27, CAT, { source: "all" })), [["KERDI200/5M", 2]]);
  assert.deepEqual(picks(resolveMembrane({ wide: true }, 400, CAT, { source: "all" })), [["KERDI200200/15M", 2]]);
});

test("resolveMembrane: Auto re-fits the mix when the wall area grows; a pinned roll only re-counts", () => {
  assert.deepEqual(picks(resolveMembrane({}, 300, CAT, { source: "all" })), [["KERDI200", 1]]);
  assert.deepEqual(picks(resolveMembrane({}, 400, CAT, { source: "all" })), [["KERDI200", 1], ["KERDI200/10M", 1]]);
  assert.deepEqual(picks(resolveMembrane({ roll: "10M" }, 400, CAT, { source: "all" })), [["KERDI200/10M", 4]]);
});

test("resolveMembrane: a width or roll the books don't carry falls back and says so", () => {
  const noWide = resolveMembrane({ wide: true }, 87.27, CAT.filter((i) => !i.wide), { source: "all" });
  assert.deepEqual(picks(noWide), [["KERDI200/10M", 1]]);
  assert.equal(noWide.subst, "no wide roll in the books — standard used");
  const noRoll = resolveMembrane({ roll: "12M" }, 87.27, CAT, { source: "all" });
  assert.deepEqual(picks(noRoll), [["KERDI200/10M", 1]]);
  assert.equal(noRoll.subst, "no 12M roll in the books — best fit used");
});

test("resolveMembrane: stock only prefers stocked rolls and still lands a special-order pin, flagged", () => {
  const so10 = soFlip(["KERDI200/10M"]);
  assert.deepEqual(picks(resolveMembrane({}, 87.27, so10, { source: "stock" })), [["KERDI200/20M", 1]]);
  const pinned = resolveMembrane({ roll: "10M" }, 87.27, so10, { source: "stock" });
  assert.deepEqual(picks(pinned), [["KERDI200/10M", 1]]);
  assert.equal(pinned.lines[0].item.stock, false);
});

test("membraneOptions: Width then Roll, each chip's next the choice it drafts", () => {
  const o = membraneOptions({ wide: false }, 87.27, CAT, { source: "all" });
  assert.deepEqual(o.widths.map((c) => [c.key, c.label, c.ok, c.on]), [["standard", "Standard 1 m", true, true], ["wide", "Wide 2 m", true, false]]);
  assert.deepEqual(o.rolls.map((c) => [c.key, c.label, c.on]), [
    ["auto", "Auto", true], ["5M", "5 m · 54 sf", false], ["7M", "7 m · 75 sf", false],
    ["10M", "10 m · 108 sf", false], ["20M", "20 m · 215 sf", false], ["30M", "30 m · 323 sf", false]]);
  assert.deepEqual(o.rolls[1].next, { wide: false, roll: "5M" });
  assert.deepEqual(membraneOptions({ wide: true }, 87.27, CAT, { source: "all" }).rolls.map((c) => c.key), ["auto", "15M"]);
});

test("resolveBand: no choice is today's rule; each width, a pinned roll, multiples", () => {
  assert.deepEqual(picks(resolveBand(null, 29.56, BCAT, { source: "all" })), [["KEBA100/125/10M", 1]]);
  assert.deepEqual(picks(resolveBand({ width: "185" }, 29.56, BCAT, { source: "all" })), [["KEBA100/185", 1]]);
  assert.deepEqual(picks(resolveBand({ width: "125", roll: "5M" }, 29.56, BCAT, { source: "all" })), [["KEBA100/125/5M", 2]]);
  assert.deepEqual(picks(resolveBand({ width: "185", roll: "5M" }, 29.56, BCAT, { source: "all" })), [["KEBA100/185/5M", 2]]);
  assert.deepEqual(picks(resolveBand({ width: "125" }, 120, BCAT, { source: "all" })), [["KEBA100/125", 2]]);
});

test("resolveBand: a width or roll the books don't carry falls back and says so; stock only lands SO flagged", () => {
  const w = resolveBand({ width: "250" }, 29.56, BCAT, { source: "all" });
  assert.deepEqual(picks(w), [["KEBA100/125/10M", 1]]);
  assert.equal(w.subst, 'no 10" band in the books — another width used');
  const r = resolveBand({ width: "185", roll: "10M" }, 29.56, BCAT, { source: "all" });
  assert.deepEqual(picks(r), [["KEBA100/185", 1]]);
  assert.equal(r.subst, "no 10M roll in the books — best fit used");
  const so = resolveBand({ width: "185" }, 29.56, BCAT, { source: "stock" });
  assert.equal(so.lines[0].item.stock, false);
});

test("bandOptions: widths off the books, the resolved width lit, Auto keeps no choice", () => {
  const o = bandOptions(null, 29.56, BCAT, { source: "all" });
  assert.deepEqual(o.widths.map((c) => [c.key, c.label, c.so, c.on]), [["125", '5"', false, true], ["185", '7-1/4"', true, false]]);
  assert.deepEqual(o.rolls.map((c) => [c.key, c.label, c.on]), [["auto", "Auto", true], ["5M", "5 m · 16 lf", false], ["10M", "10 m · 33 lf", false], ["30M", "30 m · 98 lf", false]]);
  assert.deepEqual(o.rolls[0].next, {});
  assert.deepEqual(o.rolls[1].next, { width: "125", roll: "5M" });
  assert.deepEqual(bandOptions({ width: "185" }, 29.56, BCAT, { source: "all" }).rolls.map((c) => c.key), ["auto", "5M", "30M"]);
});

test("membraneOptions: a stale wide choice with no wide rolls in the books lights the landed standard chip, and offers usable rolls", () => {
  const noWide = CAT.filter((i) => !i.wide);
  const o = membraneOptions({ wide: true }, 87.27, noWide, { source: "all" });
  assert.deepEqual(o.widths.map((c) => [c.key, c.on, c.ok]), [["standard", true, true], ["wide", false, false]]);
  assert.ok(o.rolls.some((r) => r.key !== "auto" && r.ok), "the roll row must offer a usable chip, not just Auto");
  assert.deepEqual(picks(o.result), [["KERDI200/10M", 1]]);
});

test("membraneOptions: a roll the books don't carry falls back to Auto lit, not nothing", () => {
  const o = membraneOptions({ roll: "12M" }, 87.27, CAT, { source: "all" });
  assert.equal(o.rolls.find((r) => r.key === "auto").on, true);
  assert.ok(o.rolls.find((r) => r.key === "10M").ok);
  assert.deepEqual(picks(o.result), [["KERDI200/10M", 1]]);
});

test("bandOptions: a width the books don't carry lights the landed width, not a dead chip", () => {
  const o = bandOptions({ width: "250" }, 29.56, BCAT, { source: "all" });
  assert.deepEqual(o.widths.map((c) => [c.key, c.on]), [["125", true], ["185", false]]);
  assert.ok(o.rolls.some((r) => r.key !== "auto" && r.ok), "the roll row must offer a usable chip, not just Auto");
  assert.deepEqual(picks(o.result), [["KEBA100/125/10M", 1]]);
});

test("buildKit bills the membrane and band choices; the defaults don't move with a second band width in the books", () => {
  const m = buildKit(cfg({ swaps: { membrane: { wide: false, roll: "5M" } } }), CAT, { source: "all" });
  assert.deepEqual(m.lines.filter((l) => l.g === "Walls" && l.item.g === "membrane").map((l) => [l.item.sku, l.qty]), [["KERDI200/5M", 2]]);
  const b = buildKit(cfg({ swaps: { band: { width: "185" } } }), BCAT, { source: "all" });
  assert.deepEqual(b.lines.filter((l) => l.g === "Seams").map((l) => [l.item.sku, l.qty]), [["KEBA100/185", 1]]);
  const plain = buildKit(cfg({}), BCAT, { source: "all" });
  assert.deepEqual(plain.lines.filter((l) => l.g === "Seams").map((l) => [l.item.sku, l.qty]), [["KEBA100/125/10M", 1]]);
  const miss = buildKit(cfg({ swaps: { membrane: { roll: "12M" } } }), CAT, { source: "all" });
  assert.match(miss.lines.find((l) => l.item.g === "membrane").note, /^no 12M roll in the books — best fit used · 79 sf of wall/);
});

// --- Phase 1b: fastener and bench list swaps (ticket 158) --------------------

test("cfg.swaps.fastener picks the pack; its count re-fits; a stale sku falls back", () => {
  const f = (c) => buildKit(c, CAT, { source: "all" }).lines.filter((l) => l.item.fastener).map((l) => [l.item.sku, l.qty]);
  assert.deepEqual(f(cfg({ wallSys: "board" })), [["KBZS35GT32Z100", 2]]);
  assert.deepEqual(f(cfg({ wallSys: "board", swaps: { fastener: "KBZS35GT32Z" } })), [["KBZS35GT32Z", 4]]);
  assert.deepEqual(f(cfg({ wallSys: "board", swaps: { fastener: "NOPE" } })), [["KBZS35GT32Z100", 2]]);
});

test("bench board picks ride each bench row; bench lines carry their bench index", () => {
  const ex = (c) => buildKit(c, CAT, { source: "all" }).lines.filter((l) => l.g === "Extras").map((l) => [l.item.sku, l.qty, l.bench]);
  assert.deepEqual(ex(cfg({ benches: [{ kind: "wall", side: "back", build: "framed" }, { kind: "wall", side: "left", build: "site" }] })),
    [["KB1212202440", 1, 0], ["KB506252440", 2, 1]]);
  assert.deepEqual(ex(cfg({ benches: [{ kind: "wall", side: "back", build: "framed", board: "KB1212201625" }, { kind: "wall", side: "left", build: "site", board: "NOPE" }] })),
    [["KB1212201625", 1, 0], ["KB506252440", 2, 1]]);
  assert.equal(normBench({ kind: "wall", side: "back", build: "framed", board: "KB1212201625" }, { w: 60, d: 38 }, CAT).board, "KB1212201625");
  assert.equal(normBench({ kind: "corner", corner: "bl", board: "KB506252440" }, { w: 60, d: 38 }, CAT).board, "KB506252440");
  assert.equal(normBench({ kind: "wall", side: "back", part: "KBSB4101220RA", board: "KB506252440" }, { w: 60, d: 38 }, CAT).board, undefined);
});

test("every 1b pick survives the marker: buildFromMarker bills the same lines", () => {
  const bill = (b) => b.lines.filter((l) => !l.noteOnly).map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
  for (const [c, cat] of [
    [cfg({ swaps: { membrane: { wide: true } } }), CAT],
    [cfg({ swaps: { band: { width: "185", roll: "5M" } } }), BCAT],
    [cfg({ wallSys: "board", swaps: { fastener: "KBZS35GT32Z" } }), CAT],
    [cfg({ benches: [{ kind: "wall", side: "back", build: "framed", board: "KB1212201625" }] }), CAT],
  ]) {
    const live = buildKit(c, cat, { source: "all" });
    const back = buildFromMarker({ mode: "custom", cfg: { ...c, source: "all" } }, cat);
    assert.deepEqual(bill(back), bill(live), JSON.stringify(c.swaps || c.benches));
  }
});

test("FINISH_LABEL names every KERDI-LINE finish code the way Schluter does", () => {
  assert.deepEqual(FINISH_LABEL, {
    EB: "Brushed stainless", EP: "Chrome", MBW: "Matte white", MGS: "Matte black",
    TSBG: "Greige", TSC: "Cream", TSDA: "Dark anthracite", TSG: "Pewter",
    TSI: "Ivory", TSOB: "Bronze", TSSG: "Stone grey",
  });
});

test("resolveBand with no width choice stays on the narrowest width carried, whatever the row order (owner 2026-09-27)", () => {
  const first185 = catalogOf([...BAND_185, ...FIXTURE_ITEMS]);
  for (const cat of [BCAT, first185]) {
    for (const need of [10, 29.56, 60, 120]) {
      const r = resolveBand(null, need, cat, { source: "all" });
      assert.ok(r.lines.length && r.lines.every((l) => l.item.width === "125"), `need ${need}: ${picks(r)}`);
    }
  }
  assert.deepEqual(picks(resolveBand({ width: "185" }, 120, first185, { source: "all" })), [["KEBA100/185", 2]]);
});

// --- added lines (ticket 158 Phase 1c) ---------------------------------------

const sk = (sku) => CAT.find((i) => i.sku === sku);

test("addedGroup: a row's own g wins; an old row files where the kit bills the part", () => {
  assert.equal(addedGroup({ sku: "KEBA100/125" }, sk("KEBA100/125")), "Seams");
  assert.equal(addedGroup({ sku: "KERECK/FI2" }, sk("KERECK/FI2")), "Seams");
  assert.equal(addedGroup({ sku: "KB1212202440" }, sk("KB1212202440")), "Walls");
  assert.equal(addedGroup({ sku: "KERDI200/10M" }, sk("KERDI200/10M")), "Walls");
  assert.equal(addedGroup({ sku: "KB12SN305508A1" }, sk("KB12SN305508A1")), "Extras");
  assert.equal(addedGroup({ sku: "SLRSETA50W" }, sk("SLRSETA50W")), "Setting");
  assert.equal(addedGroup({ sku: "KERDIFIX/BW" }, sk("KERDIFIX/BW")), "Setting");
  assert.equal(addedGroup({ sku: "KD4GRKECS" }, sk("KD4GRKECS")), "Drain");
  assert.equal(addedGroup({ sku: "KBSC115150970" }, sk("KBSC115150970")), "Curb");
  assert.equal(addedGroup({ sku: "KB1212202440", g: "Extras" }, sk("KB1212202440")), "Extras", "a board added under Extras stays a bench board");
  assert.equal(addedGroup({ sku: "KB1212202440", g: "Nowhere" }, sk("KB1212202440")), "Walls", "an unknown g falls back");
});

test("addedLines: each row is its own manual line with its group's slot", () => {
  const l = addedLines([{ sku: "KB1212202440", qty: 2, g: "Extras" }, { sku: "KB1212202440", qty: 1 }, { sku: "NOPE", qty: 1 }, { sku: "KEBA100/125", qty: 0 }], CAT);
  assert.deepEqual(l.map((x) => [x.g, x.item.sku, x.qty, x.slot, x.manual]),
    [["Extras", "KB1212202440", 2, "bench", true], ["Walls", "KB1212202440", 1, "wallBoard", true]]);
});

test("buildFromMarker: an added line with a kit line's part stays its own line; the kit line is untouched", () => {
  const c = cfg({});
  const kit = buildKit(c, CAT, { source: "all" });
  const band = kit.lines.find((l) => l.g === "Seams" && l.item.lf);
  const b = buildFromMarker({ mode: "custom", cfg: { ...c, manual: [{ sku: band.item.sku, qty: 2, g: "Seams" }] } }, CAT);
  const same = b.lines.filter((l) => l.item.sku === band.item.sku);
  assert.deepEqual(same.map((l) => [l.g, l.qty, !!l.manual]), [["Seams", band.qty, false], ["Seams", 2, true]]);
});

test("setAddedQty: rows key on group + sku; 0 removes; order kept", () => {
  let m = setAddedQty([], "Walls", "KB1212202440", 1, CAT);
  m = setAddedQty(m, "Extras", "KB1212202440", 2, CAT);
  m = setAddedQty(m, "Walls", "KB1212202440", 3, CAT);
  assert.deepEqual(m, [{ sku: "KB1212202440", qty: 3, g: "Walls" }, { sku: "KB1212202440", qty: 2, g: "Extras" }]);
  assert.deepEqual(setAddedQty(m, "Walls", "KB1212202440", 0, CAT), [{ sku: "KB1212202440", qty: 2, g: "Extras" }]);
  assert.deepEqual(setAddedQty([{ sku: "KEBA100/125", qty: 1 }], "Seams", "KEBA100/125", 2, CAT), [{ sku: "KEBA100/125", qty: 2, g: "Seams" }], "an old row with no g is the same row");
});

test("addParts / addPartOf: each group's '+' parts, only those the catalog carries", () => {
  const keys = (g, c = CAT) => addParts(g, c).map((p) => p.key);
  assert.deepEqual(keys("Drain"), ["drain", "grate", "body", "flange"]);
  assert.deepEqual(addParts("Drain", CAT, { linear: false }).map((p) => p.key), ["grate", "body", "flange"], "a point build's Drain + leads with the grate");
  assert.deepEqual(keys("Walls"), ["board", "membrane", "fastener"]);
  assert.deepEqual(keys("Seams"), ["band", "corners"]);
  assert.deepEqual(keys("Extras"), ["niche", "bench", "other"]);
  assert.deepEqual(keys("Setting"), ["setting"]);
  assert.deepEqual(keys("Drain", CAT.filter((i) => i.part !== "channel")), ["grate", "flange"], "no channel or body — no Drain or Body part");
  assert.equal(addPartOf("Walls", sk("KB1212202440")).key, "board");
  assert.equal(addPartOf("Extras", sk("KB1212202440")).key, "bench");
  assert.equal(addPartOf("Seams", sk("KEBA100/125")).key, "band");
  assert.equal(addPartOf("Walls", sk("KERDI200/10M")).key, "membrane");
  assert.equal(addPartOf("Drain", sk("KLVRID3EB244")).key, "body");
});

test("addRollOptions: Width → Roll with no Auto; a width alone lands on its first roll", () => {
  const o = addRollOptions("band", {}, CAT, { source: "all" });
  assert.ok(!o.rolls.some((r) => r.key === "auto"));
  assert.ok(o.choice.roll, "the draft always names a roll");
  assert.equal(o.item.roll, o.choice.roll);
  const pinned = addRollOptions("band", { width: o.item.width, roll: "10M" }, CAT, { source: "all" });
  assert.equal(pinned.item.sku, "KEBA100/125/10M");
  assert.ok(pinned.rolls.find((r) => r.key === "10M").on);
  const mem = addRollOptions("membrane", { wide: true }, CAT, { source: "all" });
  assert.equal(mem.item.wide, true);
  assert.ok(!mem.rolls.some((r) => r.key === "auto"));
});

test("drainAddOptions: a Length row in place of the pan fit; the lines are what one drain adds", () => {
  const v = drainAddOptions({ family: "vario" }, KLCAT, { source: "all" });
  assert.deepEqual(v.lengths.map((l) => l.key), [...new Set(KLCAT.filter((i) => i.g === "drain" && i.part === "channel" && i.len).map((i) => i.len))].sort((a, b) => a - b).map(String));
  assert.equal(v.len, v.lengths[v.lengths.length - 1].key * 1, "unset length = the longest");
  assert.deepEqual(v.lines.map((l) => l.slot), ["drainBody", "flange"]);
  const f = drainAddOptions({ family: "fixed", len: 48 }, KLCAT, { source: "all" });
  assert.equal(f.len, 48);
  assert.deepEqual(f.lines.map((l) => [l.slot, l.item.len]), [["drainBody", 48], ["grate", 48]]);
  assert.ok(f.lengths.find((l) => l.key === "48").on);
  const down = drainAddOptions({ family: "fixed", len: 50 }, KLCAT, { source: "all" });
  assert.equal(down.len, 48, "a length the family isn't made at steps down");
});

test("sessionFromRows: the marker's added lines come off each total — a placed added line is never an override or a second extra", () => {
  const c = cfg({});
  const kit = buildKit(c, CAT, { source: "all" });
  const band = kit.lines.find((l) => l.g === "Seams" && l.item.lf);
  const manual = [{ sku: band.item.sku, qty: 2, g: "Seams" }, { sku: "KB12SN305508A1", qty: 1, g: "Extras" }];
  const b = buildFromMarker({ mode: "custom", cfg: { ...c, manual } }, CAT);
  const bill = b.lines.filter((l) => !l.noteOnly);
  const rows = lineItems({ ...b, cfg: { ...c, manual } }, {});
  assert.deepEqual(sessionFromRows(bill, rows, CAT), { qtyOv: {}, manual: [] });
  // the sheet took one more band on the kit's line: only the kit line overrides
  const bumped = rows.map((r, i) => (i === bill.findIndex((l) => l.item.sku === band.item.sku && !l.manual) ? { ...r, qty: String(band.qty + 1) } : r));
  assert.deepEqual(sessionFromRows(bill, bumped, CAT), { qtyOv: { [ovKey(band)]: band.qty + 1 }, manual: [] });
});
