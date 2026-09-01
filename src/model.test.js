import test from "node:test";
import assert from "node:assert/strict";
import { normP, normA, normC, rowBlank, newProduct, newArea, newProject, areaLabel, money, catSig, quickAutoName, isQuickAutoName, isRealProjectName, QUICK_DEFAULT_NAME, stampKit, landKitLines, removeKitLines, placedKits, normKitBasketEntry, appendKitLines, moveKitEntries } from "./model.js";

test("normP fills every field a grid row reads from a bare object", () => {
  const p = normP({ id: "x" });
  assert.equal(p.type, "tile");
  assert.equal(p.thickness, "0.375");
  assert.equal(p.qtyType, "sqft");
  assert.equal(p.grout.joint, 0.125);
  assert.equal(p.grout.checked, false);
  assert.deepEqual(p.attached, {});
  assert.equal(p.underlay.install, false);
});

test("normP keeps a saved row's snapshot values untouched", () => {
  const saved = { id: "r1", type: "vinyl", sku: "ABC-1", priceSqft: "4.25", cartonSf: "23.5", bookId: "b1", costSqft: "2.10" };
  const p = normP(saved);
  assert.equal(p.sku, "ABC-1");
  assert.equal(p.priceSqft, "4.25");
  assert.equal(p.cartonSf, "23.5");
  assert.equal(p.bookId, "b1");
  assert.equal(p.costSqft, "2.10");
});

test("normP passes the configurator markers through and defaults them to null", () => {
  const bare = normP({ id: "x" });
  assert.equal(bare.sheoga, null);
  assert.equal(bare.wedi, null);
  assert.equal(newProduct().wedi, undefined, "newProduct leaves it to normP, like sheoga");
  const wedi = { mode: "kit", cfg: { pan: "US2000032", walls: 3 } };
  assert.deepEqual(normP({ id: "x", wedi }).wedi, wedi, "a kit anchor keeps its configuration to reopen");
  assert.deepEqual(normP({ id: "x", wedi: { part: true } }).wedi, { part: true }, "a companion line keeps its marker");
});

test("normP passes the schluter marker through", () => {
  const p = normP({ name: "x", schluter: { mode: "custom", cfg: { w: 60 } } });
  assert.deepEqual(p.schluter, { mode: "custom", cfg: { w: 60 } });
});

test("normP defaults schluter to null so old records are unaffected", () => {
  assert.equal(normP({ name: "x" }).schluter, null);
});

test("normP round-trips a schluter companion marker", () => {
  assert.deepEqual(normP({ name: "x", schluter: { part: true } }).schluter, { part: true });
});

test("normP maps the legacy brand/color pair into brandColor", () => {
  assert.equal(normP({ brand: "Daltile", color: "Ash" }).brandColor, "Daltile / Ash");
});

test("normC normalizes areas, versions, tier and waste", () => {
  const c = normC({ id: "c1", categories: [{ products: [{}] }] });
  assert.equal(c.priceTier, "retail");
  assert.equal(c.printPricing, "full");
  assert.equal(c.categories[0].products[0].type, "tile");
  assert.deepEqual(c.versions, []);
  assert.equal(c.waste, null);
});

test("rowBlank: a fresh row is blank, a priced row is not", () => {
  assert.equal(rowBlank(newProduct()), true);
  assert.equal(rowBlank({ ...newProduct(), priceSqft: "3" }), false);
});

test("catSig ignores blank adder rows so autosave doesn't fire on no-ops", () => {
  const area = { id: "a", name: "", note: "", products: [newProduct()] };
  const area2 = { ...area, products: [...area.products, newProduct()] };
  assert.equal(catSig([area]), catSig([area2]));
});

test("newProject seeds the ADR 0018 pricing fields and quick-flag", () => {
  const pr = newProject(null, "Job", { quick: true, seedArea: true });
  assert.equal(pr.priceTier, "retail");
  assert.equal(pr.quick, true);
  assert.equal(pr.categories.length, 1);
});

test("quickAutoName: Q-<first line item>-<M/D> from the first non-blank row", () => {
  const createdAt = new Date(2026, 6, 22).getTime();
  const proj = { createdAt, categories: [{ products: [newProduct(), { ...newProduct(), brandColor: "Daltile / Arctic White", priceSqft: "4" }] }] };
  assert.equal(quickAutoName(proj), "Q-Daltile / Arctic White-7/22");
  // no brand/color → the SKU, then the type label
  assert.equal(quickAutoName({ createdAt, categories: [{ products: [{ ...newProduct(), sku: "TL-100", priceSqft: "2" }] }] }), "Q-TL-100-7/22");
  assert.equal(quickAutoName({ createdAt, categories: [{ products: [{ ...newProduct(), type: "vinyl", priceSqft: "2" }] }] }), "Q-Vinyl-7/22");
  // still all blank → the default name
  assert.equal(quickAutoName({ createdAt, categories: [{ products: [newProduct()] }] }), QUICK_DEFAULT_NAME);
});

test("isQuickAutoName: default/auto/blank regenerate, hand-typed names never", () => {
  assert.equal(isQuickAutoName(QUICK_DEFAULT_NAME), true);
  assert.equal(isQuickAutoName(""), true);
  assert.equal(isQuickAutoName("Q-Daltile / Arctic White-7/22"), true);
  assert.equal(isQuickAutoName("Smith backsplash"), false);
  assert.equal(isQuickAutoName("Q-Special"), false);
});

test("areaLabel falls back to a 1-based index", () => {
  assert.equal(areaLabel({ name: " " }, 0), "Area 1");
  assert.equal(areaLabel({ name: "Kitchen" }, 3), "Kitchen");
});

test("money formats to two decimals", () => {
  assert.equal(money(1234.5), "$1,234.50");
  assert.equal(money(), "$0.00");
});

test("normA: option keeps valid slots, drops junk, defaults shared; note is gone", () => {
  assert.equal(normA({ option: "B" }).option, "B");
  assert.equal(normA({ option: "F" }).option, "F");
  assert.equal(normA({ option: "L" }).option, "L");
  assert.equal(normA({ option: "Z" }).option, "");
  assert.equal(normA({}).option, "");
  const a = normA({ note: "old note", name: "Bath" });
  assert.equal("note" in a, false);
  assert.equal("note" in newArea(), false);
});

test("normC: optionNames normalize to trimmed strings on valid slots", () => {
  const c = normC({ id: "c1", categories: [], optionNames: { A: " Porcelain ", B: "", X: "no", E: "Carpet" } });
  assert.deepEqual(c.optionNames, { A: "Porcelain", E: "Carpet" });
  assert.deepEqual(normC({ id: "c2", categories: [] }).optionNames, {});
});

// --- kit instance id (ADR 0035) -------------------------------------------

const wediAnchor = (over = {}) => ({ ...newProduct(), brandColor: "wedi — pan", priceSqft: "500", qtyType: "count", qty: "1", wedi: { mode: "kit", cfg: { panKey: "US2000032" } }, ...over });
const wediPart = (over = {}) => ({ ...newProduct(), brandColor: "wedi — screws", priceSqft: "20", qtyType: "count", qty: "1", wedi: { part: true }, ...over });
const wediLines = () => [
  { brandColor: "wedi — pan B", priceSqft: "600", qtyType: "count", qty: "1", wedi: { mode: "kit", cfg: { panKey: "US2000009" } } },
  { brandColor: "wedi — sealant", priceSqft: "30", qtyType: "count", qty: "2", wedi: { part: true } },
];

test("stampKit stamps one shared kitId across an emission's lines", () => {
  const lines = wediLines();
  const out = stampKit(lines);
  assert.ok(out[0].kitId, "anchor line carries a kitId");
  assert.equal(out[0].kitId, out[1].kitId, "companions share the anchor's kitId");
  assert.equal(lines[0].kitId, undefined, "input lines are not mutated");
});

test("stampKit leaves already-stamped lines untouched", () => {
  const stamped = [{ ...wediLines()[0], kitId: "k1" }, { ...wediLines()[1], kitId: "k2" }];
  const out = stampKit(stamped);
  assert.equal(out[0].kitId, "k1");
  assert.equal(out[1].kitId, "k2");
});

test("normP passes kitId through and defaults it empty", () => {
  assert.equal(normP({ id: "x" }).kitId, "");
  assert.equal(normP({ id: "x", kitId: "k1" }).kitId, "k1");
});

test("landKitLines: a fresh add fills the anchor row and appends stamped companions", () => {
  const anchor = newProduct();
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const cats = [{ ...newArea(), products: [anchor, other] }];
  const next = landKitLines(cats, cats[0].id, anchor.id, wediLines());
  const ps = next[0].products;
  assert.equal(ps.length, 3);
  assert.equal(ps[0].id, anchor.id, "the anchor row keeps its identity");
  assert.equal(ps[0].brandColor, "wedi — pan B");
  assert.ok(ps[0].kitId, "the landed kit is stamped");
  assert.equal(ps[1].kitId, ps[0].kitId, "companion shares the kitId");
  assert.equal(ps[2].id, other.id, "unrelated rows stand");
});

test("landKitLines: reconfigure replaces the old kit's companion rows", () => {
  const anchor = wediAnchor({ kitId: "K" });
  const p1 = wediPart({ kitId: "K" }), p2 = wediPart({ kitId: "K" });
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const cats = [{ ...newArea(), products: [anchor, p1, p2, other] }];
  const next = landKitLines(cats, cats[0].id, anchor.id, wediLines());
  const ps = next[0].products;
  assert.deepEqual(ps.map((p) => p.brandColor), ["wedi — pan B", "wedi — sealant", "Tile"], "old companions are gone, the new kit and unrelated rows stand");
  assert.equal(ps[0].id, anchor.id);
  assert.notEqual(ps[0].kitId, "K", "the re-landed kit gets a fresh id");
});

test("landKitLines: group replacement reaches a companion moved to another area", () => {
  const anchor = wediAnchor({ kitId: "K" });
  const stray = wediPart({ kitId: "K" });
  const a1 = { ...newArea(), products: [anchor] };
  const a2 = { ...newArea(), products: [stray, newProduct()] };
  const next = landKitLines([a1, a2], a1.id, anchor.id, wediLines());
  assert.equal(next[1].products.length, 1, "the moved companion is replaced with the kit");
  assert.equal(next[0].products.length, 2, "anchor + new companion land in the anchor's area");
});

test("landKitLines: a second cfg-bearing row in the group blocks group removal", () => {
  const w1 = { ...newProduct(), brandColor: "Sheoga — 3 1/4", kitId: "K", sheoga: { mode: "floor", cfg: { w: 3.25 } } };
  const fee = { ...newProduct(), brandColor: "Sheoga — fee", kitId: "K", sheoga: { fee: true } };
  const w2 = { ...newProduct(), brandColor: "Sheoga — 4 1/4", kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 } } };
  const cats = [{ ...newArea(), products: [w1, fee, w2] }];
  const lines = [{ brandColor: "Sheoga — 5in", sheoga: { mode: "floor", cfg: { w: 5 } } }];
  const next = landKitLines(cats, cats[0].id, w1.id, lines);
  const ps = next[0].products;
  assert.deepEqual(ps.map((p) => p.brandColor), ["Sheoga — 5in", "Sheoga — fee", "Sheoga — 4 1/4"], "a bundle sibling and its fee are never deleted by editing a neighbor width");
});

test("landKitLines: a legacy anchor consumes the contiguous companion run below it", () => {
  const anchor = wediAnchor();
  const p1 = wediPart(), p2 = wediPart();
  const stampedPart = wediPart({ kitId: "other" });
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const cats = [{ ...newArea(), products: [anchor, p1, p2, stampedPart, other] }];
  const next = landKitLines(cats, cats[0].id, anchor.id, wediLines());
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["wedi — pan B", "wedi — sealant", "wedi — screws", "Tile"], "kitId-less parts are consumed; a part stamped by another kit stops the run");
});

test("landKitLines: a legacy Sheoga single consumes its fee line", () => {
  const anchor = { ...newProduct(), brandColor: "Sheoga — White Oak", sheoga: { mode: "floor", cfg: { sp: "White Oak" } } };
  const fee = { ...newProduct(), brandColor: "Sheoga — Small order fee", sheoga: { fee: true } };
  const cats = [{ ...newArea(), products: [anchor, fee] }];
  const lines = [{ brandColor: "Sheoga — Hickory", sheoga: { mode: "floor", cfg: { sp: "Hickory" } } }, { brandColor: "Sheoga — fee", sheoga: { fee: true } }];
  const next = landKitLines(cats, cats[0].id, anchor.id, lines);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["Sheoga — Hickory", "Sheoga — fee"]);
});

test("landKitLines: a fresh add on a marker-less row never consumes a stray companion", () => {
  const anchor = newProduct();
  const stray = wediPart();
  const cats = [{ ...newArea(), products: [anchor, stray] }];
  const next = landKitLines(cats, cats[0].id, anchor.id, wediLines());
  assert.equal(next[0].products.length, 3, "the stray part below a blank row is not this kit's to delete");
});

test("landKitLines: missing anchor or empty lines returns null", () => {
  const cats = [{ ...newArea(), products: [newProduct()] }];
  assert.equal(landKitLines(cats, cats[0].id, "nope", wediLines()), null);
  assert.equal(landKitLines(cats, "nope", cats[0].products[0].id, wediLines()), null);
  assert.equal(landKitLines(cats, cats[0].id, cats[0].products[0].id, []), null);
});

const bundleMarker = () => ({ mode: "floor", cfg: { w: 3.25 }, multiWidth: true, bundle: { base: { mode: "floor", cfg: { sp: "Hickory" } }, widths: [{ w: 3.25, share: 50 }, { w: 4.25, share: 50 }], sf: 200, markupPct: 40 } });

test("landKitLines: a bundle's own anchor replaces the whole group, siblings included", () => {
  const w1 = { ...newProduct(), brandColor: "Sheoga — 3 1/4", kitId: "K", sheoga: bundleMarker() };
  const w2 = { ...newProduct(), brandColor: "Sheoga — 4 1/4", kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
  const fee = { ...newProduct(), brandColor: "Sheoga — fee", kitId: "K", sheoga: { fee: true } };
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const cats = [{ ...newArea(), products: [w1, w2, fee, other] }];
  const next = landKitLines(cats, cats[0].id, w1.id, [{ brandColor: "Sheoga — 5in", sheoga: { mode: "floor", cfg: { w: 5 } } }]);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["Sheoga — 5in", "Tile"], "re-emitting the bundle replaces every width and the pooled fee");
});

test("removeKitLines: removes the anchor and its companions, across areas", () => {
  const anchor = wediAnchor({ kitId: "K" });
  const p1 = wediPart({ kitId: "K" });
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const stray = wediPart({ kitId: "K" });
  const cats = [{ ...newArea(), products: [anchor, p1, other] }, { ...newArea(), products: [stray] }];
  const next = removeKitLines(cats, cats[0].id, anchor.id);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["Tile"]);
  assert.equal(next[1].products.length, 0);
});

test("removeKitLines: a bundle anchor takes the whole bundle; a sibling width takes only itself", () => {
  const mk = () => {
    const w1 = { ...newProduct(), brandColor: "w1", kitId: "K", sheoga: bundleMarker() };
    const w2 = { ...newProduct(), brandColor: "w2", kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
    const fee = { ...newProduct(), brandColor: "fee", kitId: "K", sheoga: { fee: true } };
    return [{ ...newArea(), products: [w1, w2, fee] }];
  };
  let cats = mk();
  assert.deepEqual(removeKitLines(cats, cats[0].id, cats[0].products[1].id)[0].products.map((p) => p.brandColor), ["w1", "fee"], "a sibling width never takes its neighbors");
  cats = mk();
  assert.deepEqual(removeKitLines(cats, cats[0].id, cats[0].products[0].id)[0].products, [], "the bundle anchor owns the group");
});

test("removeKitLines: legacy anchor takes its contiguous companion run; missing anchor is null", () => {
  const anchor = wediAnchor();
  const p1 = wediPart(), p2 = wediPart();
  const stamped = wediPart({ kitId: "other" });
  const cats = [{ ...newArea(), products: [anchor, p1, p2, stamped] }];
  const next = removeKitLines(cats, cats[0].id, anchor.id);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["wedi — screws"], "the run stops at a part stamped by another kit");
  assert.equal(removeKitLines(cats, cats[0].id, "nope"), null);
});

test("placedKits: anchors only — companions, fees and stamped bundle siblings fold away", () => {
  const single = { ...newProduct(), qty: "120", markupPct: "40", kitId: "K1", sheoga: { mode: "floor", cfg: { sp: "Hickory" } } };
  const fee1 = { ...newProduct(), kitId: "K1", sheoga: { fee: true } };
  const bw1 = { ...newProduct(), kitId: "K2", sheoga: bundleMarker() };
  const bw2 = { ...newProduct(), kitId: "K2", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
  const wediRow = wediAnchor();
  const plain = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const a = { ...newArea(), name: "Kitchen", products: [single, fee1, bw1, bw2, wediRow, plain] };
  const ks = placedKits([a], "sheoga");
  assert.deepEqual(ks.map((k) => k.rowId), [single.id, bw1.id]);
  assert.equal(ks[0].areaName, "Kitchen");
  assert.equal(ks[0].qty, "120");
  assert.equal(ks[0].markupPct, "40");
  assert.equal(ks[1].marker.bundle.widths.length, 2);
  assert.deepEqual(placedKits([a], "wedi").map((k) => k.rowId), [wediRow.id]);
});

test("placedKits: legacy bundle widths (no bundle snap in the group) each list as their own kit", () => {
  const bw1 = { ...newProduct(), kitId: "K", sheoga: { mode: "floor", cfg: { w: 3.25 }, multiWidth: true } };
  const bw2 = { ...newProduct(), kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
  assert.equal(placedKits([{ ...newArea(), products: [bw1, bw2] }], "sheoga").length, 2);
});

test("placedKits: area name falls back to the 1-based index", () => {
  const anchor = { ...newProduct(), sheoga: { mode: "floor", cfg: { sp: "Oak" } } };
  const ks = placedKits([{ ...newArea(), products: [] }, { ...newArea(), products: [anchor] }], "sheoga");
  assert.equal(ks[0].areaName, "Area 2");
});

test("isRealProjectName: only a hand-typed name counts (spec 2026-08-14 claim rule)", () => {
  for (const bad of ["", "  ", null, undefined, "New Project", " New Project ", "Quick price", "Q-Marazzi Rice-8/14"])
    assert.equal(isRealProjectName(bad), false, JSON.stringify(bad));
  for (const good of ["Marsh — whole first floor", "N house", "Quick pricers club", "Q-shaped room"])
    assert.equal(isRealProjectName(good), true, good);
});

test("normKitBasketEntry: fills defaults, rejects junk (ADR 0035 step 3)", () => {
  const e = normKitBasketEntry({ snap: { mode: "custom", cfg: { panKey: "X" } } });
  assert.ok(e.id);
  assert.ok(e.addedAt > 0);
  assert.equal(e.kind, "kit");
  assert.deepEqual(e.snap, { mode: "custom", cfg: { panKey: "X" } });
  const kept = normKitBasketEntry({ id: "bk1", addedAt: 5, snap: { mode: "kit", cfg: {} } });
  assert.equal(kept.id, "bk1");
  assert.equal(kept.addedAt, 5);
  for (const junk of [null, 7, "x", {}, { snap: null }, { snap: {} }, { snap: { cfg: "nope" } }])
    assert.equal(normKitBasketEntry(junk), null, JSON.stringify(junk));
});

test("normKitBasketEntry: carries session overrides, drops junk (owner decision 2026-08-31)", () => {
  const e = normKitBasketEntry({ snap: { mode: "custom", cfg: { panKey: "X" } },
    session: { qtyOv: { a: 3, b: 0, bad: NaN, neg: -2 }, manual: [{ key: "K", qty: 2 }, { key: "", qty: 1 }, { key: "Z", qty: 0 }], panelFit: false } });
  assert.deepEqual(e.session.qtyOv, { a: 3, b: 0 }, "finite >= 0 kept, NaN and negatives dropped");
  assert.deepEqual(e.session.manual, [{ key: "K", qty: 2 }], "blank ids and qty<=0 dropped");
  assert.equal(e.session.panelFit, false);
  // a Schluter extra is keyed by sku
  assert.deepEqual(normKitBasketEntry({ snap: { mode: "custom", cfg: {} }, session: { manual: [{ sku: "S1", qty: 1 }] } }).session.manual, [{ sku: "S1", qty: 1 }]);
});

test("normKitBasketEntry: an entry with nothing overridden carries no session key", () => {
  const plain = normKitBasketEntry({ snap: { mode: "kit", cfg: { panKey: "X" } } });
  assert.ok(!("session" in plain), "no session field when there is nothing to carry");
  for (const junk of [null, 7, "x", { qtyOv: "no" }, { manual: {} }, { qtyOv: {}, manual: [] }])
    assert.ok(!("session" in normKitBasketEntry({ snap: { mode: "kit", cfg: {} }, session: junk })), JSON.stringify(junk));
  assert.equal(normKitBasketEntry({ snap: { mode: "kit", cfg: {} }, session: { panelFit: true } }).session, undefined,
    "panelFit true is the default — nothing to store");
});

test("normC: wediBasket/schluterBasket normalize, drop junk, default empty (ADR 0035 step 3)", () => {
  const c = normC({ id: "c1", name: "X", wediBasket: [{ snap: { mode: "kit", cfg: { panKey: "P" } } }, { bad: true }], schluterBasket: "junk" });
  assert.equal(c.wediBasket.length, 1);
  assert.equal(c.wediBasket[0].snap.cfg.panKey, "P");
  assert.deepEqual(c.schluterBasket, []);
  assert.deepEqual(normC({ id: "c2", name: "Y" }).wediBasket, []);
  const p = newProject();
  assert.deepEqual(p.wediBasket, []);
  assert.deepEqual(p.schluterBasket, []);
});

test("normKitBasketEntry: an entry staged from a reconfigure carries its target", () => {
  const e = normKitBasketEntry({ snap: { mode: "kit", cfg: { panKey: "X" } },
    target: { areaId: "a1", rowId: "r1", kitId: "K" } });
  assert.deepEqual(e.target, { areaId: "a1", rowId: "r1", kitId: "K" });
  // kitId is optional — a legacy anchor has none
  assert.deepEqual(normKitBasketEntry({ snap: { mode: "kit", cfg: {} }, target: { areaId: "a1", rowId: "r1" } }).target,
    { areaId: "a1", rowId: "r1", kitId: "" });
  // junk targets are dropped, never half-stored: without both ids there is
  // nothing to land on
  for (const junk of [null, 7, "x", {}, { areaId: "a1" }, { rowId: "r1" }, { areaId: "", rowId: "r1" }])
    assert.ok(!("target" in normKitBasketEntry({ snap: { mode: "kit", cfg: {} }, target: junk })), JSON.stringify(junk));
});

test("moveKitEntries: a targeted entry replaces its kit, an untargeted one appends", () => {
  const anchor = wediAnchor({ kitId: "K" });
  const comp = { ...newProduct(), kitId: "K", wedi: { part: true } };
  const cats = [{ ...newArea(), products: [anchor, comp] }];
  const { categories, stranded } = moveKitEntries(cats, cats[0].id, [
    { lines: wediLines(), target: { areaId: cats[0].id, rowId: anchor.id, kitId: "K" } },
    { lines: wediLines() },
  ]);
  const ps = categories[0].products;
  assert.equal(stranded, 0);
  assert.equal(ps[0].id, anchor.id, "the targeted kit is updated in place");
  assert.equal(ps[0].brandColor, "wedi — pan B");
  assert.equal(ps.length, 4, "2 replaced rows + 2 appended, the old companion gone");
  assert.equal(ps[2].kitId, ps[3].kitId, "the appended entry is its own kit");
  assert.notEqual(ps[2].kitId, ps[0].kitId);
});

test("moveKitEntries: a stale target appends instead of clobbering, and says so", () => {
  const cats = [{ ...newArea(), products: [newProduct()] }];
  // the row was deleted since staging
  const gone = moveKitEntries(cats, cats[0].id, [{ lines: wediLines(), target: { areaId: cats[0].id, rowId: "ghost" } }]);
  assert.equal(gone.stranded, 1);
  assert.equal(gone.categories[0].products.length, 3, "the lines still land, appended");
  // the row is still there but now belongs to a DIFFERENT kit — never clobber it
  const anchor = wediAnchor({ kitId: "K2" });
  const cats2 = [{ ...newArea(), products: [anchor] }];
  const moved = moveKitEntries(cats2, cats2[0].id, [
    { lines: wediLines(), target: { areaId: cats2[0].id, rowId: anchor.id, kitId: "K" } }]);
  assert.equal(moved.stranded, 1);
  assert.equal(moved.categories[0].products[0].kitId, "K2", "the standing kit is untouched");
  assert.equal(moved.categories[0].products.length, 3);
});

test("moveKitEntries: entries land in one pass over the accumulating categories", () => {
  const a1 = wediAnchor({ kitId: "K1" });
  const a2 = wediAnchor({ kitId: "K2" });
  const cats = [{ ...newArea(), products: [a1, a2] }];
  const { categories, stranded } = moveKitEntries(cats, cats[0].id, [
    { lines: wediLines(), target: { areaId: cats[0].id, rowId: a1.id, kitId: "K1" } },
    { lines: wediLines(), target: { areaId: cats[0].id, rowId: a2.id, kitId: "K2" } },
  ]);
  assert.equal(stranded, 0);
  const ps = categories[0].products;
  assert.equal(ps.filter((x) => x.brandColor === "wedi — pan B").length, 2, "both kits updated");
  assert.equal(ps.length, 4, "two anchors + one companion each");
});

test("appendKitLines: stamps each call as its own kit and leaves other areas alone", () => {
  const a1 = { ...newArea(), products: [newProduct()] };
  const a2 = { ...newArea(), products: [] };
  const next = appendKitLines([a1, a2], a2.id, wediLines());
  assert.equal(next[0].products.length, 1, "the untouched area stands");
  assert.equal(next[1].products.length, 2);
  assert.ok(next[1].products[0].kitId);
  assert.equal(next[1].products[1].kitId, next[1].products[0].kitId);
});
