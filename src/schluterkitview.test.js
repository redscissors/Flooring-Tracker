import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf, trayCandidates } from "./schluter.js";
import { schluterEntryView, schluterTierOf } from "./schluterkitview.js";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const CAT = catalogOf(FIXTURE_ITEMS);
const cfg = (o) => ({ w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane",
  walls: [{ on: true, len: 60, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }], ...o });
const tray = trayCandidates(cfg({}), CAT, { source: "all" })[0];
const marker = { mode: "custom", cfg: { ...cfg({}), manual: [], source: "all", pick: tray.tray.sku } };
const ctx = { cat: CAT, catReady: true, tier: "retail", customPct: "", salePct: 10, bPct: 8, panelFit: true };

test("schluterEntryView faint until catReady", () => {
  const want = { title: "Schluter kit", meta: "waiting on the price books…", price: null, faint: true, lines: null };
  assert.deepEqual(schluterEntryView(marker, {}, { ...ctx, catReady: false }), want);
  assert.deepEqual(schluterEntryView(marker, {}, { ...ctx, cat: [] }), want);
});

test("schluterEntryView prices a tray marker", () => {
  const v = schluterEntryView(marker, {}, ctx);
  const of = schluterTierOf(ctx);
  const rows = v.lines();
  assert.equal(v.title, tray.tray.name);
  assert.ok(rows.length > 1);
  assert.equal(v.price, round2(rows.reduce((t, r) => t + +r.priceSqft * +r.qty, 0)));
  assert.equal(v.meta, `${rows.length} lines · 60×38"`);
  assert.equal(of({ ...tray.tray, cost: 100, price: 150, stock: true }), 150);
});

test("schluterEntryView goes faint when the catalog no longer knows the kit", () => {
  const v = schluterEntryView({ mode: "custom", cfg: { w: 0, d: 60 } }, {}, ctx);
  assert.equal(v.meta, "the catalog no longer knows this kit");
  assert.equal(v.faint, true);
});

test("schluterTierOf employee = cost × 1.06", () => {
  const e = { cost: 100, price: 200, stock: true };
  const of = (o) => schluterTierOf({ customPct: "", salePct: 10, bPct: 8, ...o })(e);
  assert.equal(of({ tier: "employee" }), 106);
  assert.equal(of({ tier: "retail" }), 200);
  assert.equal(of({ tier: "sale" }), 180);
  assert.equal(of({ tier: "custom", customPct: "250" }), 0);
});
