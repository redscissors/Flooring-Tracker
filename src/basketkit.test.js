import { test } from "node:test";
import assert from "node:assert/strict";
import { kitFor } from "./wedi.js";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf, trayCandidates } from "./schluter.js";
import { wediEntryView } from "./wedikitview.js";
import { schluterEntryView } from "./schluterkitview.js";
import { OPTION_SLOTS } from "./model.js";
import { entryView, placedView, optionName, optionsFromEntries, moveable } from "./basketkit.js";
import { cleanKitName } from "./kitlabel.js";

const CAT = catalogOf(FIXTURE_ITEMS);
const scfg = (o) => ({ w: 60, d: 38, curbed: true, drain: "point",
  walls: [{ on: true, len: 60, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }], ...o });
const tray = trayCandidates(scfg({ wallSys: "membrane" }), CAT, { source: "all" })[0];
const sMarker = { mode: "custom", cfg: { ...scfg({ wallSys: "membrane" }), manual: [], source: "all", pick: tray.tray.sku } };
const wBuild = kitFor("US9100001", {});
const wMarker = { mode: wBuild.mode, cfg: wBuild.cfg };
const level = { tier: "retail", customPct: "", salePct: 10, bPct: 18, panelFit: true };
const ctx = { wedi: level, schluter: { ...level, bPct: 8, cat: CAT, catReady: true } };
const wedi = (cfg, o) => ({ id: "w1", kind: "kit", brand: "wedi", addedAt: 1, snap: { mode: "kit", cfg: cfg || {} }, ...o });
const schluter = (cfg, o) => ({ id: "s1", kind: "kit", brand: "schluter", addedAt: 2, snap: { mode: "custom", cfg: cfg || {} }, ...o });

test("optionName per wallSys", () => {
  assert.equal(optionName(wedi({})), "wedi Building Panel");
  assert.equal(optionName(wedi({ wallSys: "membrane" })), "wedi S-DRY membrane");
  assert.equal(optionName(schluter({ wallSys: "board" })), "Schluter KERDI-BOARD");
  assert.equal(optionName(schluter({})), "Schluter KERDI membrane");
});

test("entryView dispatches by brand", () => {
  const w = entryView(wedi(wMarker.cfg, { snap: wMarker, target: { areaId: "a", rowId: "r", kitId: "k" } }), ctx);
  const wantW = wediEntryView(wMarker, {}, ctx.wedi);
  assert.equal(w.title, wantW.title);
  assert.equal(w.price, wantW.price);
  assert.equal(w.brand, "wedi");
  assert.equal(w.id, "w1");
  assert.deepEqual(w.target, { areaId: "a", rowId: "r", kitId: "k" });
  const s = entryView(schluter(null, { snap: sMarker }), ctx);
  assert.equal(s.title, cleanKitName(schluterEntryView(sMarker, {}, ctx.schluter).title));
  assert.equal(s.brand, "schluter");
  assert.equal(typeof s.lines, "function");
});

test("entryView reads the entry's own session (staged fork)", () => {
  const staged = entryView(wedi(null, { snap: wMarker, session: { panelFit: false } }), ctx);
  const bare = entryView(wedi(null, { snap: wMarker }), ctx);
  assert.equal(staged.lines().length, wediEntryView(wMarker, { panelFit: false }, ctx.wedi).lines().length);
  assert.equal(bare.price, wediEntryView(wMarker, {}, ctx.wedi).price);
});

test("a Schluter title drops the brand its badge already shows", () => {
  const cat = CAT.map((e) => (e.sku === tray.tray.sku ? { ...e, name: "Schluter " + e.name } : e));
  const sctx = { ...ctx, schluter: { ...ctx.schluter, cat } };
  assert.match(schluterEntryView(sMarker, {}, sctx.schluter).title, /\bSchluter /);
  const staged = entryView(schluter(null, { snap: sMarker }), sctx);
  const placed = placedView({ rowId: "r", marker: sMarker, brand: "schluter" }, sctx);
  for (const v of [staged, placed]) assert.doesNotMatch(v.title, /Schluter|KERDI/);
});

test("placedView passes no session and keeps the kit's fields", () => {
  const kit = { rowId: "r", kitId: "k", areaId: "a", areaName: "Shower", marker: wMarker, qty: 1, markupPct: 0, brand: "wedi" };
  const off = { ...ctx, wedi: { ...level, panelFit: false } };
  const v = placedView(kit, off);
  assert.equal(v.rowId, "r");
  assert.equal(v.brand, "wedi");
  assert.equal(v.price, wediEntryView(wMarker, undefined, off.wedi).price);
  assert.equal(v.lines().length, wediEntryView(wMarker, undefined, off.wedi).lines().length);
  assert.notEqual(v.lines().length, placedView(kit, ctx).lines().length);
});

test("optionsFromEntries suffixes repeat names", () => {
  const entries = [wedi(wMarker.cfg, { id: "a", snap: wMarker }), wedi(wMarker.cfg, { id: "b", snap: wMarker })];
  const views = entries.map((e) => entryView(e, ctx));
  const out = optionsFromEntries(views, entries, []);
  assert.deepEqual(out.options.map((o) => o.name), ["wedi Building Panel", "wedi Building Panel 2"]);
  assert.ok(out.options.every((o, i) => o.lines.length === views[i].lines().length));
});

test("optionsFromEntries returns short when letters run out", () => {
  const cats = OPTION_SLOTS.slice(0, 11).map((option) => ({ option }));
  const entries = [wedi({}), wedi({})];
  const views = entries.map(() => ({ lines: () => [{}] }));
  assert.deepEqual(optionsFromEntries(views, entries, cats), { short: 1 });
});

test("moveable skips faint entries", () => {
  const views = [{ faint: false, id: 1 }, { faint: true, id: 2 }];
  const m = moveable(views);
  assert.equal(m.ready.length, 1);
  assert.equal(m.waiting, 1);
});
