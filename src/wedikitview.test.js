import { test } from "node:test";
import assert from "node:assert/strict";
import { kitFor, round2 } from "./wedi.js";
import { wediEntryView, wediTierOf } from "./wedikitview.js";

const PAN = "US9100001";
const kitMarker = () => { const b = kitFor(PAN, {}); return { mode: b.mode, cfg: b.cfg }; };
const ctx = { tier: "retail", customPct: "", salePct: 10, bPct: 18, panelFit: true };
const rowKey = (r) => r.wedi.key || r.wedi.part;

test("wediEntryView prices a kit marker at retail = sum of lineItems", () => {
  const v = wediEntryView(kitMarker(), {}, ctx);
  const rows = v.lines();
  assert.equal(v.title, kitFor(PAN, {}).pan.name);
  assert.ok(rows.length > 1);
  assert.equal(v.price, round2(rows.reduce((t, r) => t + +r.priceSqft * +r.qty, 0)));
  assert.equal(v.meta.startsWith(`${rows.length} lines`), true);
});

test("wediEntryView applies a staged qtyOv", () => {
  const marker = kitMarker();
  const base = wediEntryView(marker, {}, ctx).lines();
  const target = base.find((r) => +r.qty > 0 && rowKey(r) !== PAN);
  const key = rowKey(target);
  const over = wediEntryView(marker, { qtyOv: { [key]: +target.qty + 3 } }, ctx);
  assert.equal(+over.lines().find((r) => rowKey(r) === key).qty, +target.qty + 3);
  assert.ok(over.price > wediEntryView(marker, {}, ctx).price);
});

test("wediEntryView staged vs placed Fit fork", () => {
  const marker = kitMarker();
  const staged = wediEntryView(marker, {}, ctx);
  const stagedOff = wediEntryView(marker, { panelFit: false }, ctx);
  const placedOff = wediEntryView(marker, undefined, { ...ctx, panelFit: false });
  const placedOn = wediEntryView(marker, undefined, ctx);
  assert.notEqual(staged.lines().length, placedOff.lines().length);
  assert.equal(stagedOff.lines().length, placedOff.lines().length);
  assert.equal(placedOn.price, staged.price);
});

test("wediEntryView goes faint when the catalog no longer knows the kit", () => {
  const v = wediEntryView({ mode: "kit", cfg: {} }, {}, ctx);
  assert.deepEqual(v, { title: "wedi build", meta: "the catalog no longer knows this kit", price: null, faint: true, lines: null });
});

test("wediTierOf clamps a custom percent and reads builder/sale percents", () => {
  const e = { retail: 200, cost: 100 };
  const of = (o) => wediTierOf({ customPct: "", salePct: 10, bPct: 18, ...o })(e);
  assert.equal(of({ tier: "retail" }), 200);
  assert.equal(of({ tier: "custom", customPct: "250" }), 0);
  assert.equal(of({ tier: "custom", customPct: "25" }), 150);
  assert.equal(of({ tier: "sale" }), 180);
  assert.equal(of({ tier: "employee" }), 106);
});
