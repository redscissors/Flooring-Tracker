import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
import { item, kitFor, SKU } from "./wedi.js";
import {
  COMPARE_CATS, roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
  wediCompareRows, schluterCompareRows, compareTotals,
} from "./comparekit.js";

const CAT = catalogOf(FIXTURE_ITEMS);

// the SchluterConfigurator cfg shape (its `cfg` useMemo), 60x38 curbed point
const schCfg = (o) => ({
  w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane", bench: null,
  walls: [{ name: "Back", on: true, len: 60, h: 84 },
    { name: "Left", on: true, len: 38, h: 84 },
    { name: "Right", on: true, len: 38, h: 84 }],
  ...o,
});
const room60x38 = () => roomFromSchluter(schCfg({}));

// --- (a) the neutral room, both directions ---------------------------------

test("roomFromSchluter reads a schluter cfg as the neutral room", () => {
  assert.deepEqual(room60x38(), {
    w: 60, d: 38, curbed: true, drain: "point",
    walls: [{ side: "back", on: true, len: 60, h: 84 },
      { side: "left", on: true, len: 38, h: 84 },
      { side: "right", on: true, len: 38, h: 84 }],
  });
});

test("a 60x38 curbed point room round-trips schluter -> wedi -> room", () => {
  const room = room60x38();
  const back = roomFromWedi(wediBuildFor(room).cfg);
  assert.deepEqual(back, room);
});

test("roomFromWedi reads curbless off the solve input", () => {
  const room = { ...room60x38(), curbed: false };
  assert.equal(roomFromWedi(wediBuildFor(room).cfg).curbed, false);
});

// A Kits-tab pick never ran the solver, so cfg.solve is null and the PAN is
// the only record of what was built — reading the defaults there priced a
// linear or curbless pan against a curbed point-drain Schluter kit.
const kitCfg = (key) => {
  const p = item(key);
  return kitFor(key, { room: { w: Math.max(p.w, p.d), d: Math.min(p.w, p.d) }, mode: "kit" }).cfg;
};

test("roomFromWedi reads the drain off the pan when a kit build has no solve input", () => {
  const linear = kitCfg("US9310001");     // 3'x5' Linear Shower Base
  assert.equal(linear.solve, null);
  assert.equal(roomFromWedi(linear).drain, "linear");
  assert.equal(roomFromWedi(linear).curbed, true);
  const offset = kitCfg("US9100005");     // 3'x6' Shower Base — Offset Drain
  assert.equal(roomFromWedi(offset).drain, "offset");
  assert.equal(roomFromWedi(kitCfg("US9100001")).drain, "point");
});

test("roomFromWedi reads curbless off the pan when a kit build has no solve input", () => {
  const cfg = kitCfg("US9200001");        // 3'x4' Curbless Shower Base
  assert.equal(cfg.solve, null);
  assert.deepEqual(roomFromWedi(cfg), {
    w: 48, d: 36, curbed: false, drain: "point",
    walls: [{ side: "back", on: true, len: 48, h: 80 },
      { side: "left", on: true, len: 36, h: 80 },
      { side: "right", on: true, len: 36, h: 80 }],
  });
});

test("a solve input still wins over the pan it picked", () => {
  const cfg = { ...kitCfg("US9100001"), solve: { id: "x", input: { curb: "curbless", drain: "linear" } } };
  const room = roomFromWedi(cfg);
  assert.equal(room.curbed, false);
  assert.equal(room.drain, "linear");
});

test("roomFromWedi still defaults to a curbed point drain with neither solve nor pan", () => {
  assert.deepEqual(roomFromWedi({ room: { w: 60, d: 38 }, walls: [{ side: "back", len: 60, h: 84 }] }),
    { w: 60, d: 38, curbed: true, drain: "point", walls: [{ side: "back", on: true, len: 60, h: 84 }] });
});

// --- (b) the wedi side ------------------------------------------------------

test("wediBuildFor returns a kit build whose cfg carries the solved pan", () => {
  const b = wediBuildFor(room60x38());
  assert.equal(b.mode, "kit");
  assert.equal(typeof b.cfg.panKey, "string");
  assert.equal(b.cfg.panKey, b.pan.key);
  assert.deepEqual(b.cfg.room, { w: 60, d: 38 });
});

test("wedi rows bucket into COMPARE_CATS, with a Walls panel line", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  rows.forEach((r) => assert.ok(COMPARE_CATS.includes(r.cat), r.cat + " is not a compare category"));
  const walls = rows.filter((r) => r.cat === "Walls");
  assert.equal(walls.length, 1);
  assert.ok(/building panel/i.test(walls[0].name));
  assert.ok(walls[0].retail > 0);
  assert.ok(rows.every((r) => typeof r.est === "boolean"));
});

test("wedi rows carry the part number and the engine note as the sub line", () => {
  const b = wediBuildFor(room60x38());
  const rows = wediCompareRows(b);
  const base = rows.find((r) => r.cat === "Base");
  assert.equal(base.sub, b.pan.us);
  const sealant = rows.find((r) => /sealant/i.test(r.name));
  const line = b.lines.find((l) => l.item.group === "sealant");
  assert.equal(sealant.sub, line.item.us + " · " + line.note);
});

// unit price through the engine's lens, then extended — the order both
// configurators' own totals use ($54.66 × 0.82 = $44.82 a sheet, six sheets)
test("wedi rows price through the engine's own tier lens, extended by qty", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  const panel = rows.find((r) => r.cat === "Walls");
  assert.equal(panel.qty, 6);
  assert.deepEqual([panel.retail, panel.builder, panel.cost], [327.96, 268.92, 198.78]);
});

test("wedi rows end with the $0 thin-set note — wedi has no setting line of its own", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  const note = rows[rows.length - 1];
  assert.deepEqual(
    (({ cat, name, sub, noteOnly, retail, builder, cost }) => ({ cat, name, sub, noteOnly, retail, builder, cost }))(note),
    { cat: "Setting", name: "Thin-set for pan bed", sub: "by others / shop stock", noteOnly: true, retail: 0, builder: 0, cost: 0 });
});

test("wediCompareRows(null) is empty — no lone thin-set note on a null build", () => {
  assert.deepEqual(wediCompareRows(null), []);
});

test("an engine note quoting an allowance marks the row est", () => {
  const rows = wediCompareRows({ lines: [{ item: item(SKU.sealantSausage), qty: 2, note: "field seal — allowance" }] });
  assert.equal(rows[0].est, true);
  assert.equal(rows[0].noteOnly, false);
});

test("an impossible room has no wedi build", () => {
  assert.equal(wediBuildFor({ ...room60x38(), w: 0 }), null);
});

// --- (c) the schluter side --------------------------------------------------

test("schluterBuildFor composes the cfg the reconfigure chip reopens on", () => {
  const { build, cfg } = schluterBuildFor(room60x38(), CAT);
  assert.equal(cfg.w, 60);
  assert.equal(cfg.d, 38);
  assert.equal(cfg.wallSys, "membrane");
  assert.equal(cfg.bench, null);
  assert.deepEqual(cfg.walls.map((w) => [w.name, w.on, w.len]),
    [["Back", true, 60], ["Left", true, 38], ["Right", true, 38]]);
  assert.equal(build.cand.tray.sku, "KST965/1525");
});

test("a room missing a side leaves that schluter wall off", () => {
  const room = room60x38();
  const { cfg } = schluterBuildFor({ ...room, walls: room.walls.filter((w) => w.side !== "right") }, CAT);
  assert.deepEqual(cfg.walls.map((w) => w.on), [true, true, false]);
});

test("schluter rows bucket into COMPARE_CATS and keep the noteOnly backer at $0", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  const rows = schluterCompareRows(build);
  rows.forEach((r) => assert.ok(COMPARE_CATS.includes(r.cat), r.cat + " is not a compare category"));
  const notes = rows.filter((r) => r.noteOnly);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].cat, "Walls");
  assert.deepEqual([notes[0].retail, notes[0].builder, notes[0].cost], [0, 0, 0]);
});

test("schluter rows price through the engine's own tier lens, extended by qty", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  const rows = schluterCompareRows(build, { builderPct: 8 });
  const corners = rows.find((r) => r.sub.startsWith("KERECK/FI2"));
  assert.equal(corners.qty, 2);
  assert.deepEqual([corners.retail, corners.builder, corners.cost], [30.64, 28.18, 20.42]);
  assert.equal(corners.sub, "KERECK/FI2 · 4 inside — factory kit recipe");
});

test("a mortar item threads through to the no-fit base line", () => {
  const room = { ...room60x38(), w: 30, d: 90 };
  const mortarItem = { name: "Deck mud", price: 20, cost: 20, stock: true, sfPerBagAt15: 8 };
  const { build, cfg } = schluterBuildFor(room, CAT, { mortarItem });
  assert.equal(cfg.mortarItem, mortarItem);
  assert.equal(build.cand.kind, "mortar");
  assert.equal(schluterCompareRows(build)[0].name, "Deck mud");
});

// --- (d) totals -------------------------------------------------------------

test("compareTotals skips the noteOnly rows and counts the bill", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  const rows = schluterCompareRows(build);
  const t = compareTotals(rows);
  const billed = rows.filter((r) => !r.noteOnly);
  assert.equal(t.lines, billed.length);
  assert.equal(t.retail, Math.round(billed.reduce((s, r) => s + r.retail, 0) * 100) / 100);
  assert.ok(t.builder < t.retail);
  assert.ok(t.cost < t.builder);
  assert.equal(t.stocked, billed.length);
  assert.equal(t.soCount, 0);
});

test("a curbless compare column carries no auto ramp — the entry treatment is a popup pick (round 6)", () => {
  // re-pinned 2026-08-24: the ramp left the standing recipe (owner ask), so
  // the derived house kit matches wedi's own no-entry-part treatment
  const { build } = schluterBuildFor({ ...room60x38(), curbed: false }, CAT);
  const rows = schluterCompareRows(build);
  assert.equal(rows.some((r) => r.cat === "Curb"), false);
  const t = compareTotals(rows);
  assert.equal(t.stocked + t.soCount, t.lines);
});

test("compareTotals on an empty bill is all zeros", () => {
  assert.deepEqual(compareTotals([]), { retail: 0, builder: 0, cost: 0, lines: 0, stocked: 0, soCount: 0 });
});

// --- (e) the shared Stock only switch --------------------------------------

test("source stock re-ranks the schluter tray — the 48x48 linear falls to the 55x55 deep cut", () => {
  const room = { w: 48, d: 48, curbed: true, drain: "linear",
    walls: [{ side: "back", on: true, len: 48, h: 84 },
      { side: "left", on: true, len: 48, h: 84 },
      { side: "right", on: true, len: 48, h: 84 }] };
  assert.equal(schluterBuildFor(room, CAT, { source: "all" }).build.cand.tray.sku, "SLRKSLT1220S");
  const stock = schluterBuildFor(room, CAT, { source: "stock" }).build;
  assert.equal(stock.cand.tray.sku, "KSLT1395S");
  assert.equal(stock.cand.deep, true);
});

test("source stock threads into the wedi solve — every base is stocked", () => {
  const b = wediBuildFor(room60x38(), { source: "stock" });
  assert.equal(b.pan.stock, true);
});
