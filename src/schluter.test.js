import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify, catalogOf, trayCandidates, pickRolls, pickFrom, buildKit, linesTotal, tierPrice, lineItems } from "./schluter.js";

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
