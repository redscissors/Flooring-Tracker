import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
import { item, kitFor, SKU, panelFitLines } from "./wedi.js";
import {
  roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
  wediCompareRows, schluterCompareRows, compareTotals,
  hostAddedLines, mirrorParts, mirrorCandidates, mirrorPlan, mirrorRow, pruneMirror, compareLayout,
  wediSdryNoFit, wediOptionOf, benchesFor, wediKeptBuild, schluterKeptBuild, keptDropped, syncKept,
} from "./comparekit.js";
import { GROUPS, SLOTS } from "./slots.js";
import { lineItems as wediLineItems, buildFromMarker as wediFromMarker } from "./wedi.js";
import { lineItems as schluterLineItems, buildFromMarker as schluterFromMarker } from "./schluter.js";

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
    benches: [],
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
    benches: [],
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
    { w: 60, d: 38, curbed: true, drain: "point", walls: [{ side: "back", on: true, len: 60, h: 84 }], benches: [] });
});

// --- (b) the wedi side ------------------------------------------------------

test("wediBuildFor returns a kit build whose cfg carries the solved pan", () => {
  const b = wediBuildFor(room60x38());
  assert.equal(b.mode, "kit");
  assert.equal(typeof b.cfg.panKey, "string");
  assert.equal(b.cfg.panKey, b.pan.key);
  assert.deepEqual(b.cfg.room, { w: 60, d: 38 });
});

test("wedi rows file by shared group and slot, with a Walls panel line", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  const keys = GROUPS.map((g) => g.key);
  rows.forEach((r) => assert.ok(keys.includes(r.group) && SLOTS.includes(r.slot), r.name + " → " + r.group + "/" + r.slot));
  const walls = rows.filter((r) => r.group === "walls" && /building panel/i.test(r.name));
  assert.equal(walls.length, 1);
  assert.equal(walls[0].slot, "wallBoard");
  assert.equal(rows.find((r) => /fastener kit/i.test(r.name)).group, "walls", "fasteners sit with the panels");
  assert.equal(rows.find((r) => /valve seal/i.test(r.name)).slot, "corners");
  assert.ok(rows.every((r) => r.added === false), "a house kit has no added lines");
  assert.ok(walls[0].retail > 0);
  assert.ok(rows.every((r) => typeof r.est === "boolean"));
});

test("wedi rows carry the part number and the engine note as the sub line", () => {
  const b = wediBuildFor(room60x38());
  const rows = wediCompareRows(b);
  const base = rows.find((r) => r.group === "base");
  assert.equal(base.sub, b.pan.us);
  const sealant = rows.find((r) => /sealant/i.test(r.name));
  const line = b.lines.find((l) => l.item.group === "sealant");
  assert.equal(sealant.sub, line.item.us + " · " + line.note);
});

// unit price through the engine's lens, then extended — the order both
// configurators' own totals use ($54.66 × 0.82 = $44.82 a sheet, six sheets)
test("wedi rows price through the engine's own tier lens, extended by qty", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  const panel = rows.find((r) => r.slot === "wallBoard" && /building panel/i.test(r.name));
  assert.equal(panel.qty, 6);
  assert.deepEqual([panel.retail, panel.builder, panel.cost], [327.96, 268.92, 198.78]);
});

test("wedi's PRO-SET bag files under Setting — no by-others thin-set note", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  const ps = rows.filter((r) => /PRO-SET/.test(r.name));
  assert.equal(ps.length, 1);
  assert.deepEqual([ps[0].group, ps[0].qty, ps[0].noteOnly], ["setting", 1, false]);
  assert.equal(rows.some((r) => r.noteOnly), false);
});

test("wediCompareRows(null) is empty", () => {
  assert.deepEqual(wediCompareRows(null), []);
});

test("an engine note quoting an allowance marks the row est", () => {
  const rows = wediCompareRows({ lines: [{ item: item(SKU.sealantSausage), qty: 2, note: "field seal — allowance", slot: "seam" }] });
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
  assert.deepEqual(cfg.benches, []);
  assert.deepEqual(cfg.walls.map((w) => [w.name, w.on, w.len]),
    [["Back", true, 60], ["Left", true, 38], ["Right", true, 38]]);
  assert.equal(build.cand.tray.sku, "KST965/1525");
});

test("a room missing a side leaves that schluter wall off", () => {
  const room = room60x38();
  const { cfg } = schluterBuildFor({ ...room, walls: room.walls.filter((w) => w.side !== "right") }, CAT);
  assert.deepEqual(cfg.walls.map((w) => w.on), [true, true, false]);
});

test("schluter rows file by shared group and keep the noteOnly backer at $0", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  const rows = schluterCompareRows(build);
  const keys = GROUPS.map((g) => g.key);
  rows.forEach((r) => assert.ok(keys.includes(r.group) && SLOTS.includes(r.slot), r.name + " → " + r.group + "/" + r.slot));
  assert.equal(rows.find((r) => /flange kit/i.test(r.name)).slot, "flange");
  assert.equal(rows.find((r) => /grate/i.test(r.name)).slot, "grate");
  const notes = rows.filter((r) => r.noteOnly);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].group, "walls");
  assert.deepEqual([notes[0].retail, notes[0].builder, notes[0].cost], [0, 0, 0]);
});

test("schluter rows price through the engine's own tier lens, extended by qty", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  const rows = schluterCompareRows(build, { builderPct: 8 });
  const set = rows.find((r) => r.sub && r.sub.startsWith("SLRSETA50W"));
  assert.equal(set.qty, 2);
  assert.deepEqual([set.retail, set.builder, set.cost], [78.42, 72.14, 52.28]);
  const flange = rows.find((r) => r.sub && r.sub.startsWith("KD2FLKPVC"));
  assert.deepEqual([flange.retail, flange.builder, flange.cost], [84.62, 77.85, 56.41]);
  assert.match(flange.sub, /incl\. 4\+2 corners, pipe \+ valve seals/);
  // corners + seals ride the flange kit box — never their own compare rows
  assert.equal(rows.some((r) => r.sub && /KERECK|KERDI-SEAL/.test(r.sub + r.name)), false);
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
  assert.equal(rows.some((r) => r.group === "curb"), false);
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

// --- shared slot vocabulary (ticket 158 Phase 1a) --------------------------

test("compare rows carry each line's shared slot", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  assert.ok(rows.length && rows.every((r) => typeof r.slot === "string"));
});

// --- (f) the mirror (ticket 158 Phase 1d) -----------------------------------

const schHost = (manual) => schluterBuildFor(room60x38(), CAT, { manual }).build;
const wediHost = (manual) => kitFor("US9100004", { room: { w: 60, d: 36 }, mode: "kit", manual });

test("schluterBuildFor bills added rows on top of the recipe, and its cfg carries them", () => {
  const { build, cfg } = schluterBuildFor(room60x38(), CAT, { manual: [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }] });
  const added = build.lines.filter((l) => l.manual);
  assert.deepEqual(added.map((l) => [l.item.sku, l.qty, l.slot]), [["KB12SN305508A1", 2, "niche"]]);
  assert.deepEqual(cfg.manual, [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]);
  assert.equal(schluterBuildFor(room60x38(), CAT).cfg.manual, undefined);
});

test("wediBuildFor bills added rows as added lines", () => {
  const b = wediBuildFor(room60x38(), { manual: [{ key: "US3000005", qty: 1, group: "addon" }] });
  assert.deepEqual(b.lines.filter((l) => l.added).map((l) => [l.item.key, l.slot]), [["US3000005", "niche"]]);
  assert.deepEqual(b.cfg.manual, [{ key: "US3000005", qty: 1, group: "addon" }]);
});

test("host added lines: key is engine group + part; kit lines and a Browse-only wedi build give none", () => {
  const h = hostAddedLines(schHost([{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]), "schluter");
  assert.deepEqual(h.map((x) => [x.key, x.qty, x.part.slot]), [["Extras|KB12SN305508A1", 2, "niche"]]);
  assert.deepEqual(hostAddedLines(schluterBuildFor(room60x38(), CAT).build, "schluter"), []);
  const browse = { pan: null, lines: [{ item: item("US3000005"), qty: 1, group: "addon", added: true, slot: "niche" }] };
  assert.deepEqual(hostAddedLines(browse, "wedi"), []);
  assert.deepEqual(hostAddedLines(null, "wedi"), []);
});

test("mirror parts are the brand's own '+' parts for the group, pooled by source", () => {
  assert.deepEqual(mirrorParts("wedi", "niches").map((p) => [p.key, p.g]), [["niche", "addon"], ["shelf", "addon"]]);
  assert.deepEqual(mirrorParts("schluter", "niches", { cat: CAT }).map((p) => [p.key, p.g]), [["niche", "Extras"]]);
  const all = mirrorParts("schluter", "base", { cat: CAT }).flatMap((p) => p.parts);
  const stock = mirrorParts("schluter", "base", { cat: CAT, source: "stock" }).flatMap((p) => p.parts);
  assert.ok(stock.length < all.length && stock.every((c) => c.item.stock));
});

test("Stock only pools a part the way the popups do: a part with nothing stocked still offers all of it", () => {
  const all = mirrorParts("schluter", "extras", { cat: CAT, source: "all" });
  const stock = mirrorParts("schluter", "extras", { cat: CAT, source: "stock" });
  assert.ok(all.length && all.every((p) => p.parts.every((c) => !c.item.stock)), "the fixture's Extras 'other' parts are all special order");
  assert.deepEqual(stock.map((p) => [p.key, p.parts.length]), all.map((p) => [p.key, p.parts.length]));
  const tray = mirrorParts("schluter", "base", { cat: CAT, source: "stock" }).find((p) => p.key === "tray");
  assert.ok(tray.parts.length && tray.parts.every((c) => c.item.stock), "a part with stocked items still pools to them");
});

test("a Schluter niche mirrors to the nearest wedi interior; the picker's list agrees with the match", () => {
  const plan = mirrorPlan(schHost([{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]), "schluter", {}, { cat: CAT });
  assert.equal(plan.brand, "wedi");
  const [e] = plan.entries;
  assert.deepEqual([e.kind, e.match.id, e.qty, e.grp], ["matched", "US3000007", 2, "niches"]);
  const part = mirrorParts("wedi", "niches").find((p) => p.key === "niche");
  assert.equal(mirrorCandidates(e.host, part)[0].id, e.match.id);
  assert.deepEqual(plan.manual, [{ key: "US3000007", qty: 2, group: "addon" }]);
});

test("coverage parts mirror by coverage: a 98 lf band is two 82 lf tapes", () => {
  const plan = mirrorPlan(schHost([{ sku: "KEBA100/125", qty: 1, g: "Seams" }]), "schluter", {}, { cat: CAT });
  assert.deepEqual([plan.entries[0].match.id, plan.entries[0].qty], ["095225053", 2]);
});

test("wedi → Schluter: a seat mirrors to the nearest bench, a panel to KERDI-BOARD by sf", () => {
  const plan = mirrorPlan(wediHost([{ key: "US3000002", qty: 1, group: "addon" }, { key: "US8000017", qty: 6, group: "walls" }]), "wedi", {}, { cat: CAT });
  const by = Object.fromEntries(plan.entries.map((e) => [e.slot, e]));
  assert.equal(by.bench.match.id, "KBSB410TA");
  assert.deepEqual([by.wallBoard.match.id, by.wallBoard.qty], ["KB1212201625", 5], "a 15 sf sheet is nearest the 21.3 sf board; 6 × 15 = 90 sf → five");
  assert.deepEqual(plan.manual.map((r) => r.g), ["Extras", "Walls"]);
});

test("unsized slots, and sizes that don't read, give no match", () => {
  const plan = mirrorPlan(schHost([{ sku: "KD4GRKE", qty: 1, g: "Drain" }, { sku: "KB12SNLT2WW", qty: 1, g: "Extras" }]), "schluter", {}, { cat: CAT });
  assert.deepEqual(plan.entries.map((e) => e.kind), ["none", "none"]);
  assert.deepEqual(plan.manual, []);
});

test("Stock only pools the auto-match; a hand pick stands", () => {
  const host = schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }]);
  const so = mirrorParts("wedi", "niches").flatMap((p) => p.parts).find((c) => !c.item.stock && c.slot === "niche");
  assert.ok(so, "the fixture carries a special-order niche");
  const auto = mirrorPlan(host, "schluter", {}, { cat: CAT, source: "stock" });
  assert.ok(auto.entries[0].match.item.stock);
  const bench = schHost([{ sku: "KBSB410TA", qty: 1, g: "Extras" }]);
  const [full] = mirrorPlan(bench, "schluter", {}, { cat: CAT }).entries;
  const [pooled] = mirrorPlan(bench, "schluter", {}, { cat: CAT, source: "stock" }).entries;
  assert.ok(!full.match.item.stock && pooled.match.item.stock && pooled.match.id !== full.match.id, "Stock only moves the bench match onto a stocked seat");
  const picked = mirrorPlan(host, "schluter", { "Extras|KB12SN305508A1": { pick: { g: "addon", id: so.id, qty: 3 } } }, { cat: CAT, source: "stock" });
  assert.deepEqual([picked.entries[0].kind, picked.entries[0].match.id, picked.entries[0].qty], ["picked", so.id, 3]);
});

test("a drop shows the '+', a pick whose part left the book shows the '+', and an orphan entry is ignored", () => {
  const host = schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }]);
  const k = "Extras|KB12SN305508A1";
  assert.equal(mirrorPlan(host, "schluter", { [k]: { dropped: true } }, { cat: CAT }).entries[0].kind, "dropped");
  assert.equal(mirrorPlan(host, "schluter", { [k]: { pick: { g: "addon", id: "GONE", qty: 1 } } }, { cat: CAT }).entries[0].kind, "none");
  const orphan = mirrorPlan(host, "schluter", { "Walls|NOPE": { dropped: true } }, { cat: CAT });
  assert.equal(orphan.entries[0].kind, "matched");
  assert.deepEqual(pruneMirror({ [k]: { dropped: true }, "Walls|NOPE": { dropped: true } }, [k]), { [k]: { dropped: true } });
});

test("a pick is keyed by engine group + part: the same part in another group isn't hijacked", () => {
  const host = schHost([{ sku: "KB1212202440", qty: 1, g: "Walls" }, { sku: "KB1212202440", qty: 1, g: "Extras" }]);
  const plan = mirrorPlan(host, "schluter", { "Extras|KB1212202440": { dropped: true } }, { cat: CAT });
  const by = Object.fromEntries(plan.entries.map((e) => [e.hostKey, e.kind]));
  assert.deepEqual(by, { "Walls|KB1212202440": "matched", "Extras|KB1212202440": "dropped" });
});

test("two host lines landing on one part sum into one engine row", () => {
  const plan = mirrorPlan(wediHost([{ key: "US3000005", qty: 1, group: "addon" }, { key: "US3000004", qty: 1, group: "addon" }]), "wedi", {}, { cat: CAT });
  assert.deepEqual(plan.entries.map((e) => e.match.id), ["KB12SN305508A1", "KB12SN305508A1"]);
  assert.deepEqual(plan.manual, [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]);
});

test("a mirror row is priced by the other engine and names the host line", () => {
  const plan = mirrorPlan(schHost([{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]), "schluter", {}, { cat: CAT });
  const r = mirrorRow(plan.entries[0], "wedi", { builderPct: 18 });
  assert.deepEqual([r.group, r.slot, r.added, r.mirror, r.qty], ["niches", "niche", true, "matched", 2]);
  assert.match(r.sub, /^for 2× .*niche/i);
  assert.equal(r.retail, Math.round(item("US3000007").retail * 2 * 100) / 100);
});

test("the mirrored build's totals equal its rows: the other engine bills what Compare shows", () => {
  const host = schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }, { sku: "KEBA100/125", qty: 1, g: "Seams" }]);
  const plan = mirrorPlan(host, "schluter", {}, { cat: CAT });
  const other = wediBuildFor(room60x38(), { manual: plan.manual });
  const rows = [...wediCompareRows(other).filter((r) => !r.added), ...plan.entries.map((e) => mirrorRow(e, "wedi"))];
  assert.equal(compareTotals(rows).retail, compareTotals(wediCompareRows(other)).retail);
});

test("option B lands the mirrored rows in its marker, and reopens them as added lines", () => {
  const plan = mirrorPlan(wediHost([{ key: "US3000005", qty: 1, group: "addon" }]), "wedi", {}, { cat: CAT });
  const { build, cfg } = schluterBuildFor(room60x38(), CAT, { manual: plan.manual });
  const rows = schluterLineItems({ ...build, mode: "custom", cfg }, {});
  const mark = rows[0].schluter || rows[0].kit || Object.values(rows[0]).find((v) => v && v.cfg);
  assert.deepEqual(mark.cfg.manual, plan.manual);
  const back = schluterFromMarker(mark, CAT);
  assert.deepEqual(back.lines.filter((l) => l.manual).map((l) => [l.item.sku, l.qty]), [["KB12SN305508A1", 1]]);

  const p2 = mirrorPlan(schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }]), "schluter", {}, { cat: CAT });
  const w = wediBuildFor(room60x38(), { manual: p2.manual });
  const wrows = wediLineItems(w, {});
  const wmark = wrows[0].wedi || Object.values(wrows[0]).find((v) => v && v.cfg);
  assert.deepEqual(wmark.cfg.manual, p2.manual);
  assert.deepEqual(wediFromMarker(wmark).lines.filter((l) => l.added).map((l) => l.item.key), ["US3000007"]);
});

test("compareLayout: group bands in order, a slot per row, one-sided slots kept, empties dropped", () => {
  const w = wediCompareRows(wediBuildFor(room60x38()));
  const { build } = schluterBuildFor(room60x38(), CAT);
  const s = schluterCompareRows(build);
  const plus = { wedi: [{ slot: "flange", hostKey: "x" }] };
  const L = compareLayout({ wedi: w, schluter: s }, plus);
  const order = GROUPS.map((g) => g.key);
  assert.deepEqual(L.map((g) => g.key), order.filter((k) => L.some((g) => g.key === k)));
  const drain = L.find((g) => g.key === "drain");
  const flange = drain.slots.find((r) => r.slot === "flange");
  assert.equal(flange.wedi.length, 0);
  assert.equal(flange.schluter.length, 1);
  assert.equal(flange.wediPlus.length, 1);
  assert.ok(!L.some((g) => g.key === "niches"), "no niche on either side");
  for (const g of L) for (const r of g.slots) assert.ok(r.wedi.length + r.schluter.length + r.wediPlus.length + r.schluterPlus.length > 0);
});

test("compareLayout puts added lines after the kit's in a cell", () => {
  const rows = [{ slot: "seam", added: true, name: "a" }, { slot: "seam", added: false, name: "k" }];
  const cell = compareLayout({ wedi: rows, schluter: [] }).find((g) => g.key === "seams").slots[0].wedi;
  assert.deepEqual(cell.map((r) => r.name), ["k", "a"]);
});

// --- Phase 3: the grid's engine-facing helpers -------------------------------

const linearRoom = () => roomFromSchluter(schCfg({ drain: "linear" }));

test("wediSdryNoFit says why no S-DRY base fits, and nothing when one does", () => {
  assert.equal(wediSdryNoFit(room60x38()), "");
  assert.equal(wediSdryNoFit(linearRoom()), "S-DRY has no linear-drain base");
});

test("wediBuildFor sdryBase 'nearest' puts a no-fit Membrane room on the nearest S-DRY base", () => {
  const pan = wediBuildFor(linearRoom(), { wallSys: "membrane" });
  assert.equal(pan.cfg.sdryBase, "wedi");
  assert.notEqual(pan.pan.sub, "sdry");
  const near = wediBuildFor(linearRoom(), { wallSys: "membrane", sdryBase: "nearest" });
  assert.equal(near.pan.sub, "sdry");
  assert.equal(near.cfg.solve.id, "sdry-nearest");
  assert.equal(near.cfg.sdryBase, undefined);
});

test("wediOptionOf re-finds the solver option a build came from; a Kits pick has none", () => {
  const b = wediBuildFor(room60x38());
  const o = wediOptionOf(b);
  assert.equal(o.id, b.cfg.solve.id);
  assert.equal(o.pan.key, b.pan.key);
  assert.ok(Array.isArray(o.warnings));
  const near = wediBuildFor(linearRoom(), { wallSys: "membrane", sdryBase: "nearest" });
  assert.deepEqual(wediOptionOf(near).warnings, ["S-DRY has no linear base — a point-drain base is used"]);
  assert.equal(wediOptionOf(kitFor("US9100007", { mode: "kit" })), null);
  assert.equal(wediOptionOf(null), null);
});

test("compareLayout takes any two column names", () => {
  const rows = [{ slot: "tray", added: false, key: "a" }];
  const plus = [{ slot: "niche", hostKey: "h" }];
  const g = compareLayout({ L: rows, R: [] }, { R: plus });
  assert.deepEqual(g.map((x) => x.key), ["base", "niches"]);
  assert.deepEqual(g[0].slots[0].L.map((r) => r.key), ["a"]);
  assert.deepEqual(g[0].slots[0].R, []);
  assert.deepEqual(g[1].slots[0].RPlus.map((e) => e.hostKey), ["h"]);
});

// --- (h) the Compare set: benches, kept builds, Sync (ticket 158 Phase 4) --

const benchRoom = () => ({ ...room60x38(), benches: [{ kind: "corner", corner: "bl", build: "premade", part: "KBSB410TA" }] });

test("benchesFor: a brand SKU crosses only within its own brand", () => {
  assert.deepEqual(benchesFor("wedi", benchRoom(), "schluter"), [{ kind: "corner", corner: "bl", build: "premade" }]);
  assert.equal(benchesFor("schluter", benchRoom(), "schluter")[0].part, "KBSB410TA");
  assert.deepEqual(benchesFor("wedi", { w: 1 }, "wedi"), []);
});

test("house kits now carry the room's benches, both brands", () => {
  const plain = wediBuildFor(room60x38());
  const withB = wediBuildFor(room60x38(), { benches: benchesFor("wedi", benchRoom(), "schluter") });
  assert.equal(plain.cfg.benches.length, 0);
  assert.equal(withB.cfg.benches.length, 1);
  const s0 = schluterBuildFor(room60x38(), CAT).build;
  const s1 = schluterBuildFor(benchRoom(), CAT).build;
  assert.ok(s1.lines.some((l) => l.item.sku === "KBSB410TA"), "the Schluter premade bills");
  assert.ok(!s0.lines.some((l) => l.item.sku === "KBSB410TA"));
});

test("wediKeptBuild prices a marker with the default Fit plan — the popup's build column", () => {
  const house = wediBuildFor(room60x38());
  const kept = wediKeptBuild({ mode: "custom", cfg: { ...house.cfg, source: "all" } });
  assert.equal(kept.pan.key, house.pan.key);
  assert.equal(kept.cfg.source, "all");
  assert.deepEqual(kept.lines.map((l) => l.item.key), panelFitLines(house.lines, house.cfg.walls, house.panelSf).map((l) => l.item.key));
  assert.equal(wediKeptBuild({ mode: "kit", cfg: { panKey: "NOPE" } }), null);
});

test("schluterKeptBuild re-derives the marker and stamps its tray pick", () => {
  const { cfg } = schluterBuildFor(room60x38(), CAT, { wallSys: "board" });
  const kept = schluterKeptBuild({ mode: "custom", cfg }, CAT);
  assert.equal(kept.cfg.pick, "KST965/1525");
  assert.ok(kept.build.lines.length > 3);
  assert.equal(schluterKeptBuild({ mode: "custom", cfg: { w: 0, d: 0 } }, CAT), null);
});

test("keptDropped names a Schluter swap the build doesn't carry", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  const grate = build.lines.find((l) => l.item.part === "grate").item.sku;
  assert.deepEqual(keptDropped("schluter", { swaps: { grate } }, build), []);
  assert.deepEqual(keptDropped("schluter", { swaps: { grate: "NOPE" } }, build), ["grate"]);
  assert.deepEqual(keptDropped("wedi", { panelKey: "NOPE" }, { lines: [] }), ["panel"]);
});

test("syncKept (Schluter): the room and anchor lines come over, the column's picks and lines stay", () => {
  const small = { ...room60x38(), w: 48, d: 36, walls: room60x38().walls.map((w) => ({ ...w, len: w.side === "back" ? 48 : 36 })) };
  const { cfg } = schluterBuildFor(small, CAT);
  const grate = schluterBuildFor(small, CAT).build.lines.find((l) => l.item.part === "grate").item.sku;
  const entry = { snap: { mode: "custom", cfg: { ...cfg, swaps: { grate }, xwalls: [{ edge: "entry", len: 12, h: 84 }], manual: [{ sku: "KBSB410TA", qty: 1 }] } } };
  const out = syncKept("schluter", entry, { room: room60x38(), hostBuild: null, hostBrand: "wedi", cat: CAT });
  assert.equal(out.snap.cfg.w, 60);
  assert.equal(out.snap.cfg.d, 38);
  assert.deepEqual(out.snap.cfg.swaps, { grate });
  assert.deepEqual(out.snap.cfg.xwalls, []);
  assert.deepEqual(out.snap.cfg.manual, [{ sku: "KBSB410TA", qty: 1 }]);
  assert.equal(out.snap.cfg.pick, "KST965/1525");
  assert.deepEqual(out.dropped, []);
});

test("syncKept (wedi): re-solves for the anchor room, keeps the choices", () => {
  const small = { ...room60x38(), w: 48, d: 36 };
  const house = wediBuildFor(small);
  const entry = { snap: { mode: "custom", cfg: { ...house.cfg, sealantForm: "sausage", source: "all" } } };
  const out = syncKept("wedi", entry, { room: room60x38(), hostBuild: null, hostBrand: "schluter", cat: CAT });
  assert.deepEqual(out.snap.cfg.room, { w: 60, d: 38 });
  assert.equal(out.snap.cfg.sealantForm, "sausage");
  assert.equal(out.snap.cfg.source, "all");
});

// --- review fixes (Phase 4 final review) ------------------------------------

test("keptDropped: Schluter membrane/band picks are choices, never flagged as missing SKUs", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  assert.deepEqual(keptDropped("schluter", { swaps: { membrane: { wide: true }, band: { width: 125 } } }, build), []);
});

test("keptDropped: board/fastener picks only count on a KERDI-BOARD build, checked before the Fit plan", () => {
  const { build } = schluterBuildFor(room60x38(), CAT);
  assert.deepEqual(keptDropped("schluter", { wallSys: "membrane", swaps: { board: "NOPE", fastener: "NOPE" } }, build), []);
  const { cfg } = schluterBuildFor(room60x38(), CAT, { wallSys: "board" });
  const raw = schluterFromMarker({ mode: "custom", cfg }, CAT);
  const board = raw.lines.find((l) => l.item.g === "board" && l.item.sf).item.sku;
  const out = syncKept("schluter", { snap: { mode: "custom", cfg: { ...cfg, swaps: { board } } } }, { room: room60x38(), hostBuild: null, hostBrand: "wedi", cat: CAT });
  assert.deepEqual(out.dropped, []);
});

test("syncKept (wedi): a Membrane build's panelKey is never flagged; the kept sdryBase choice stands", () => {
  const house = wediBuildFor(room60x38(), { wallSys: "membrane", sdryBase: "wedi" });
  assert.equal(house.cfg.sdryBase, "wedi");
  const entry = { snap: { mode: "custom", cfg: { ...house.cfg, panelKey: "US8000017", source: "all" } } };
  const out = syncKept("wedi", entry, { room: room60x38(), hostBuild: null, hostBrand: "schluter", cat: CAT });
  assert.equal(out.snap.cfg.sdryBase, "wedi", "the wedi-pan answer survives Sync even where S-DRY fits");
  assert.ok(!out.dropped.includes("panel"));
});
