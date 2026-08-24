import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify, catalogOf, trayCandidates, pickRolls, pickFrom, buildKit, linesTotal, tierPrice, lineItems, entryOpening, normBench, benchTrayRoom } from "./schluter.js";

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
  assert.deepEqual(
    (({ g, w, d, drain }) => ({ g, w, d, drain }))(by("KSLT965/1930S")),
    { g: "tray", w: 76, d: 38, drain: "linear" });
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
  const b = buildKit(cfg({}), CAT, { source: "all" });
  assert.equal(b.lines.filter((l) => !l.noteOnly).length, 12);
  assert.equal(Math.round(linesTotal(b.lines, retail) * 100), 75975); // $759.75
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
  // a linear tray's channel edge is directional — a 36×55 room must not
  // reach the 55×36 LTS by rotation
  const lin = trayCandidates(cfg({ w: 36, d: 55, drain: "linear" }), CAT, { source: "all" });
  assert.ok(lin.every((x) => !x.rot));
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
  const retail = (e) => tierPrice(e, "retail", {});
  const b = buildKit(cfg({}), CAT, { source: "all" });
  assert.equal(Math.round(linesTotal(b.lines, retail) * 100), 75975);
});

test("lineItems: wedi-shaped (build, opts) with build.mode and the vendor lead", () => {
  const c = cfg({});
  const build = { ...buildKit(c, CAT, { source: "all" }), mode: "kit", cfg: c };
  const rows = lineItems(build, {});
  assert.equal(rows[0].schluter.mode, "kit");
  assert.equal(rows[0].schluter.cfg.w, 60);
  assert.ok(rows.slice(1).every((r) => r.schluter.part));
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
  // and a curbless room still takes the ramp, walls or not
  const r = buildKit(cfg({ curbed: false, xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84 }] }), CAT, { source: "all" });
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
  assert.ok(ptBuild.lines.some((l) => l.item.corner === "inside"));
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
  // 60 + ~4.97 diagonal extra outruns the 60" curb — a second is cut on
  assert.equal(curbOf(fl).qty, 2);
  assert.match(curbOf(fl).note, /turns a cut corner diagonally/);
  assert.equal(curbOf(bl).qty, 1);
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
