import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
import { wediBuildFor, schluterBuildFor, wediCompareRows, schluterCompareRows, compareTotals } from "./comparekit.js";
import { CELLS, hostCellKey, opposite, cellLabel, cellFlags, cellBuild } from "./comparegrid.js";

const CAT = catalogOf(FIXTURE_ITEMS);
const room = (w, d, curbed, drain) => ({
  w, d, curbed, drain,
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })),
});
const R60 = room(60, 38, true, "point");
const LINEAR = room(60, 38, true, "linear");

// The ctx CompareTab hands every cell, around a host build.
const ctxFor = (hostBrand, hostBuild, hostCfg, r = R60, o = {}) => ({
  hostBrand, hostKey: hostCellKey(hostBrand, hostBrand === "wedi" ? hostBuild && hostBuild.cfg : hostCfg),
  hostBuild, hostCfg, room: r, roomOk: r.w > 0 && r.d > 0,
  ready: { wedi: true, schluter: true }, cat: CAT, source: "all", tier: "retail", mortarItem: null,
  wPct: 18, sPct: 8, ...o,
});
const schHost = (r = R60, o = {}) => schluterBuildFor(r, CAT, o);
const wediHost = (r = R60, o = {}) => wediBuildFor(r, o);

test("CELLS run in reading order: Board row, then Membrane row, wedi before Schluter", () => {
  assert.deepEqual(CELLS.map((c) => c.key), ["wedi:board", "schluter:board", "wedi:membrane", "schluter:membrane"]);
});

test("hostCellKey reads each brand's wallSys; absent is that brand's default", () => {
  assert.equal(hostCellKey("wedi", {}), "wedi:board");
  assert.equal(hostCellKey("wedi", { wallSys: "membrane" }), "wedi:membrane");
  assert.equal(hostCellKey("wedi", null), "wedi:board");
  assert.equal(hostCellKey("schluter", {}), "schluter:membrane");
  assert.equal(hostCellKey("schluter", { wallSys: "board" }), "schluter:board");
  assert.equal(opposite("wedi:board"), "schluter:board");
  assert.equal(opposite("schluter:membrane"), "wedi:membrane");
});

test("cellLabel names each system, and S-DRY walls on a wedi pan say so", () => {
  assert.equal(cellLabel("wedi:board", null), "Building Panel");
  assert.equal(cellLabel("schluter:board", null), "KERDI-BOARD");
  assert.equal(cellLabel("schluter:membrane", null), "KERDI membrane");
  assert.equal(cellLabel("wedi:membrane", wediBuildFor(R60, { wallSys: "membrane" })), "S-DRY membrane");
  assert.equal(cellLabel("wedi:membrane", wediBuildFor(LINEAR, { wallSys: "membrane" })), "S-DRY membrane on a wedi pan");
});

test("the live cell is the host build as it stands; the other three are house kits", () => {
  const { build, cfg } = schHost();
  const ctx = ctxFor("schluter", build, cfg);
  const cells = CELLS.map((c) => cellBuild(c.key, ctx));
  assert.deepEqual(cells.map((c) => c.live), [false, false, false, true]);
  assert.equal(cells[3].build, build);
  assert.deepEqual(cells[3].rows, schluterCompareRows(build, { builderPct: 8 }));
  assert.equal(cells[0].totals.retail, compareTotals(wediCompareRows(wediBuildFor(R60), { builderPct: 18 })).retail);
  assert.equal(cells[1].totals.retail, compareTotals(schluterCompareRows(schHost(R60, { wallSys: "board" }).build, { builderPct: 8 })).retail);
  assert.equal(cells[2].totals.retail, compareTotals(wediCompareRows(wediBuildFor(R60, { wallSys: "membrane" }), { builderPct: 18 })).retail);
  assert.ok(cells.every((c) => c.rows.length > 0));
  assert.deepEqual(cells.map((c) => c.name), ["wedi · Building Panel", "Schluter · KERDI-BOARD", "wedi · S-DRY membrane", "Schluter · KERDI membrane"]);
});

test("a cell waits on its brand's catalog and the room", () => {
  const { build, cfg } = schHost();
  const notReady = ctxFor("schluter", build, cfg, R60, { ready: { wedi: false, schluter: true } });
  assert.equal(cellBuild("wedi:board", notReady).rows.length, 0);
  assert.equal(cellBuild("schluter:board", notReady).rows.length > 0, true);
  const noRoom = ctxFor("schluter", build, cfg, room(0, 0, true, "point"));
  assert.equal(cellBuild("schluter:board", noRoom).rows.length, 0);
  assert.deepEqual(cellBuild("wedi:board", noRoom).flags, []);
  // the live cell never waits — it is what the popup has on screen
  assert.equal(cellBuild("schluter:membrane", noRoom).build, build);
});

test("same brand, other wall system: the host's added lines carry as they are, no mirror", () => {
  const manual = [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }];
  const { build, cfg } = schHost(R60, { manual });
  const c = cellBuild("schluter:board", ctxFor("schluter", build, cfg));
  assert.equal(c.plan, null);
  assert.deepEqual(c.build.lines.filter((l) => l.manual).map((l) => [l.item.sku, l.qty]), [["KB12SN305508A1", 2]]);
  assert.deepEqual(c.rows.filter((r) => r.added).map((r) => r.key), ["Extras|KB12SN305508A1"]);

  const w = wediHost(R60, { manual: [{ key: "US3000005", qty: 1, group: "addon" }] });
  const wc = cellBuild("wedi:membrane", ctxFor("wedi", w, null));
  assert.deepEqual(wc.build.lines.filter((l) => l.added).map((l) => [l.item.key, l.qty]), [["US3000005", 1]]);
});

test("other brand: each cell mirrors the host's added lines from its own state", () => {
  const { build, cfg } = schHost(R60, { manual: [{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }] });
  const ctx = ctxFor("schluter", build, cfg);
  const auto = cellBuild("wedi:board", ctx);
  assert.deepEqual(auto.plan.entries.map((e) => e.kind), ["matched"]);
  assert.deepEqual(auto.rows.filter((r) => r.mirror).map((r) => r.hostKey), ["Extras|KB12SN305508A1"]);
  const dropped = cellBuild("wedi:membrane", ctx, { mirror: { "Extras|KB12SN305508A1": { dropped: true } } });
  assert.deepEqual(dropped.plan.entries.map((e) => e.kind), ["dropped"]);
  assert.equal(dropped.rows.some((r) => r.mirror), false);
  assert.deepEqual(dropped.flags.map((f) => [f.id, f.rowKey]), [["unmatched", "Extras|KB12SN305508A1"]]);
  // the Board cell's own state is untouched by the Membrane cell's drop
  assert.deepEqual(cellBuild("wedi:board", ctx).flags, []);
});

test("S-DRY no-fit: the wedi Membrane cell prices a wedi pan + S-DRY walls, flagged; 'nearest' moves it", () => {
  const { build, cfg } = schHost(LINEAR);
  const ctx = ctxFor("schluter", build, cfg, LINEAR);
  const pan = cellBuild("wedi:membrane", ctx);
  assert.equal(pan.build.cfg.sdryBase, "wedi");
  assert.equal(pan.label, "S-DRY membrane on a wedi pan");
  assert.deepEqual(pan.flags.map((f) => f.id), ["sdry"]);
  const near = cellBuild("wedi:membrane", ctx, { sdryPick: "nearest" });
  assert.equal(near.build.pan.sub, "sdry");
  assert.equal(near.build.cfg.solve.id, "sdry-nearest");
  // a point base under a linear room is a drain miss as well as a no-fit
  assert.deepEqual(near.flags.map((f) => f.id), ["drain", "sdry"]);
  // the pick only ever moves the wedi Membrane cell
  assert.equal(cellBuild("wedi:board", ctx, { sdryPick: "nearest" }).build.pan.key, cellBuild("wedi:board", ctx).build.pan.key);
});

test("a room no Schluter tray fits flags the mortar bed at its Base row", () => {
  const { build, cfg } = schHost(LINEAR);
  const c = cellBuild("schluter:board", ctxFor("schluter", build, cfg, LINEAR));
  assert.equal(c.flags[0].id, "mortar");
  assert.equal(c.flags[0].label, "No tray fits — mortar bed");
  assert.equal(c.rows.find((r) => r.key === c.flags[0].rowKey).group, "base");
});

// --- cellFlags over hand-made rows: one case per chip ------------------------

const row = (o) => ({ group: "base", slot: "tray", key: "Base|T1", sub: "", noteOnly: false, retail: 100, ...o });

test("Schluter chips: mortar, drain fallback, channel short, deep cut", () => {
  const rows = [
    row({}),
    row({ group: "drain", slot: "drainBody", key: "Drain|D1", sub: "KLV · fixed KERDI-LINE can't be made here: no grate — Vario used" }),
    row({ group: "drain", slot: "drainBody", key: "Drain|D2", sub: 'KLV · 60" run — the 48" channel is the longest available, runs short' }),
  ];
  assert.deepEqual(cellFlags("schluter", { cand: { kind: "mortar" } }, rows, null).map((f) => [f.id, f.rowKey]),
    [["mortar", "Base|T1"], ["drain", "Drain|D1"], ["short", "Drain|D2"]]);
  assert.deepEqual(cellFlags("schluter", { cand: { kind: "cut", deep: true } }, [row({})], null).map((f) => f.id), ["deep"]);
  assert.deepEqual(cellFlags("schluter", { cand: { kind: "exact", deep: false } }, [row({})], null), []);
});

test("wedi chips read the solver option: drain miss, deep cut; S-DRY no-fit reads the cfg", () => {
  const rows = [row({ key: "pan|P1" }), row({ group: "drain", slot: "drainBody", key: "drain|X1" })];
  const miss = { warnings: ["no center-drain base fits this room — this is a offset-drain base floated to the plumbing"] };
  assert.deepEqual(cellFlags("wedi", {}, rows, null, miss).map((f) => [f.id, f.rowKey]), [["drain", "drain|X1"]]);
  assert.deepEqual(cellFlags("wedi", {}, rows, null, { warnings: ['no base reaches 30", 20" — x'] }).map((f) => f.id), ["drain"]);
  assert.deepEqual(cellFlags("wedi", {}, rows, null, { deep: true, warnings: [] }).map((f) => f.id), ["deep"]);
  assert.deepEqual(cellFlags("wedi", {}, rows, null, { warnings: ['deep cut — 8" comes off a side'] }).map((f) => f.id), ["deep"]);
  assert.deepEqual(cellFlags("wedi", { cfg: { wallSys: "membrane", sdryBase: "wedi" } }, rows, null, null).map((f) => [f.id, f.rowKey]), [["sdry", "pan|P1"]]);
  assert.deepEqual(cellFlags("wedi", { cfg: { wallSys: "membrane", solve: { id: "sdry-nearest" } } }, rows, null, null).map((f) => f.id), ["sdry"]);
  // ordinary install notes are not chips
  assert.deepEqual(cellFlags("wedi", {}, rows, null, { warnings: ["0 seams — set every joint in wedi Joint Sealant"] }), []);
});

test("a billed $0 row is 'No price'; a $0 note row is not", () => {
  const rows = [row({}), row({ key: "Seams|S1", group: "seams", retail: 0 }), row({ key: "note|backer", noteOnly: true, retail: 0 })];
  assert.deepEqual(cellFlags("schluter", {}, rows, null).map((f) => [f.id, f.rowKey]), [["price", "Seams|S1"]]);
  assert.deepEqual(cellFlags("schluter", {}, [row({}), row({ key: "note|backer", noteOnly: true, retail: 0 })], null), []);
});

test("chips come most severe first, one per kind", () => {
  const rows = [row({ retail: 0 }), row({ key: "Base|T2", retail: 0 })];
  const plan = { entries: [{ hostKey: "h1", match: null }, { hostKey: "h2", match: null }] };
  const f = cellFlags("schluter", { cand: { kind: "mortar", deep: true } }, rows, plan);
  assert.deepEqual(f.map((x) => x.id), ["mortar", "deep", "price", "unmatched"]);
  assert.equal(f.find((x) => x.id === "unmatched").rowKey, "h1");
});
