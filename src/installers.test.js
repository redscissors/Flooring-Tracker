import test from "node:test";
import assert from "node:assert/strict";
import {
  INSTALL_TRADES, TRADE_LABEL, tradeOfType, normInstaller, normInstallers, jobTrades, rankInstallers,
  installerEntry, normProjInstallers, toggleProjInstaller, entryTradesOnJob, uncoveredTrades,
} from "./installers.js";
import { rowBlank } from "./model.js";

const inst = (over = {}) => normInstaller({ id: "i1", company: "Hartline Tile", contact: "Mike", phone: "(574) 555-0162", email: "mike@x.test", trades: ["tile"], priority: 9, ...over });
const line = (type, over = {}) => ({ id: "p" + Math.random(), type, sku: "X", brandColor: "Thing", qty: "10", ...over });
const blankLine = (type = "tile") => ({ id: "pb", type, sku: "", brandColor: "", L: "", W: "", sizeText: "", priceSqft: "", qty: "" });

test("trades: three installer trades; hardwood/vinyl/laminate roll up to Hard Surface", () => {
  assert.deepEqual(INSTALL_TRADES, ["tile", "hard", "carpet"]);
  assert.equal(TRADE_LABEL.hard, "Hard Surface");
  assert.equal(tradeOfType("tile"), "tile");
  for (const t of ["hardwood", "vinyl", "laminate"]) assert.equal(tradeOfType(t), "hard");
  assert.equal(tradeOfType("carpet"), "carpet");
  assert.equal(tradeOfType("underlayment"), null);
  assert.equal(tradeOfType("misc"), null);
});

test("normInstaller: fills the shape, clamps priority, keeps only known trades in order", () => {
  const i = normInstaller({ id: "a", company: "  Keystone  ", trades: ["carpet", "bogus", "tile", "tile"], priority: 42 });
  assert.equal(i.company, "Keystone");
  assert.deepEqual(i.trades, ["tile", "carpet"]);
  assert.equal(i.priority, 10);
  assert.equal(normInstaller({ id: "b", company: "X", priority: -3 }).priority, 1);
  assert.equal(normInstaller({ id: "c", company: "X" }).priority, 5);
  assert.equal(normInstaller({ id: "d", company: "X", priority: "7" }).priority, 7);
  assert.equal(normInstaller({ company: "no id" }), null);
  assert.equal(normInstaller(null), null);
});

test("normInstallers: drops junk and duplicate ids; non-array is empty", () => {
  assert.deepEqual(normInstallers(undefined), []);
  const list = normInstallers([{ id: "a", company: "A" }, null, { id: "a", company: "dup" }, { id: "b", company: "B" }]);
  assert.deepEqual(list.map((i) => i.id), ["a", "b"]);
});

test("jobTrades: reads the job's real lines, skipping blank adders, underlayment and misc", () => {
  const cats = [
    { id: "k", products: [line("vinyl"), blankLine()] },
    { id: "b", products: [line("tile"), line("misc"), line("underlayment")] },
    { id: "r", products: [line("hardwood"), line("carpet")] },
  ];
  assert.deepEqual(jobTrades(cats, rowBlank), ["tile", "hard", "carpet"]);
  assert.deepEqual(jobTrades([{ id: "x", products: [blankLine("carpet")] }], rowBlank), []);
  assert.deepEqual(jobTrades(undefined, rowBlank), []);
});

test("rankInstallers: whole-job first by priority, then part by coverage then priority, then none", () => {
  const list = [
    inst({ id: "full6", company: "Full Six", trades: ["tile", "hard"], priority: 6 }),
    inst({ id: "full8", company: "Full Eight", trades: ["tile", "hard", "carpet"], priority: 8 }),
    inst({ id: "tile9", company: "Tile Nine", trades: ["tile"], priority: 9 }),
    inst({ id: "hard7", company: "Hard Seven", trades: ["hard"], priority: 7 }),
    inst({ id: "carpet10", company: "Carpet Ten", trades: ["carpet"], priority: 10 }),
  ];
  const r = rankInstallers(list, ["tile", "hard"]);
  assert.deepEqual(r.full.map((x) => x.id), ["full8", "full6"]);
  assert.deepEqual(r.part.map((x) => x.id), ["tile9", "hard7"]);
  assert.deepEqual(r.none.map((x) => x.id), ["carpet10"]);
  const two = rankInstallers([inst({ id: "a", trades: ["tile"], priority: 5 }), inst({ id: "b", trades: ["tile", "hard"], priority: 2 })], ["tile", "hard", "carpet"]);
  assert.deepEqual(two.part.map((x) => x.id), ["b", "a"], "covering more of the job outranks priority");
});

test("rankInstallers: a job with no trade lines lists everyone by priority", () => {
  const r = rankInstallers([inst({ id: "a", priority: 3 }), inst({ id: "b", priority: 8 })], []);
  assert.deepEqual(r.full, []);
  assert.deepEqual(r.part, []);
  assert.deepEqual(r.none.map((x) => x.id), ["b", "a"]);
});

test("installerEntry/toggleProjInstaller: snapshots contact info; a second toggle removes it", () => {
  const i = inst();
  const on = toggleProjInstaller([], i, "Sam", 1000);
  assert.deepEqual(on, [{ id: "i1", company: "Hartline Tile", contact: "Mike", phone: "(574) 555-0162", email: "mike@x.test", trades: ["tile"], addedAt: 1000, addedBy: "Sam" }]);
  assert.deepEqual(installerEntry(i, "Sam", 1000), on[0]);
  assert.deepEqual(toggleProjInstaller(on, i, "Sam", 2000), []);
});

test("normProjInstallers: keeps snapshot entries, drops junk", () => {
  assert.deepEqual(normProjInstallers(undefined), []);
  const out = normProjInstallers([{ id: "x", company: "X", trades: ["hard", "nope"] }, { company: "no id" }, 7]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].trades, ["hard"]);
  assert.equal(out[0].contact, "");
});

test("entryTradesOnJob: the job's trades they cover, or all of theirs when none overlap", () => {
  const e = installerEntry(inst({ trades: ["tile", "hard", "carpet"] }), "", 0);
  assert.deepEqual(entryTradesOnJob(e, ["hard", "tile"]), ["tile", "hard"]);
  assert.deepEqual(entryTradesOnJob(installerEntry(inst({ trades: ["carpet"] }), "", 0), ["tile"]), ["carpet"]);
});

test("uncoveredTrades: job trades no added installer covers", () => {
  const entries = [installerEntry(inst({ trades: ["tile"] }), "", 0)];
  assert.deepEqual(uncoveredTrades(entries, ["tile", "hard", "carpet"]), ["hard", "carpet"]);
  assert.deepEqual(uncoveredTrades([], ["tile"]), ["tile"]);
});

test("settings and projects carry installers through their normalizers", async () => {
  const { normalizeSettings, serializeSettings } = await import("./catalog.js");
  const { normC } = await import("./model.js");
  const s = normalizeSettings({ installers: [{ id: "a", company: "A", trades: ["tile"], priority: 8 }, { company: "junk" }] });
  assert.deepEqual(s.installers.map((i) => i.id), ["a"]);
  assert.deepEqual(serializeSettings(s).installers.map((i) => i.id), ["a"]);
  assert.equal("installers" in serializeSettings(normalizeSettings({})), false, "an empty directory isn't written");
  assert.deepEqual(normC({ id: "p", categories: [] }).installers, []);
  assert.equal(normC({ id: "p", categories: [], installers: [{ id: "a", company: "A", trades: ["hard"] }] }).installers[0].company, "A");
});
