import test from "node:test";
import assert from "node:assert/strict";
import { initialRail, railReducer, layerOf, stateFromLayer, APP_IDS, SETTINGS_IDS, CONFIGURATOR_IDS } from "./railnav.js";

const run = (...actions) => actions.reduce(railReducer, initialRail);
const pick = (kind, id, inProgress = false) => ({ type: "pick", kind, id, inProgress });
const toggle = (which) => ({ type: "toggleDrawer", which });

test("ids match the spec's order", () => {
  assert.deepEqual(APP_IDS, ["labels", "schluter", "wedi", "sheoga"]);
  assert.deepEqual(SETTINGS_IDS, ["profile", "general", "book", "materials", "backup"]);
  assert.deepEqual(CONFIGURATOR_IDS, ["sheoga", "wedi", "schluter"]);
});

test("drawers are exclusive and toggle", () => {
  assert.equal(run(toggle("apps")).drawer, "apps");
  assert.equal(run(toggle("apps"), toggle("settings")).drawer, "settings");
  assert.equal(run(toggle("settings"), toggle("apps")).drawer, "apps");
  assert.equal(run(toggle("apps"), toggle("apps")).drawer, null);
  assert.equal(run(toggle("bogus")), initialRail);
});

test("opening a drawer loads nothing", () => {
  const s = run(toggle("apps"));
  assert.equal(s.pane, null);
  assert.equal(s.lastApp, null);
});

test("picking fills the pane, opens the matching drawer, remembers the last app", () => {
  const s = run(pick("app", "wedi"));
  assert.deepEqual(s.pane, { kind: "app", id: "wedi", resume: false });
  assert.equal(s.drawer, "apps");
  assert.equal(s.lastApp, "wedi");
  const t = railReducer(s, pick("settings", "book"));
  assert.deepEqual(t.pane, { kind: "settings", id: "book", resume: false });
  assert.equal(t.drawer, "settings");
  assert.equal(t.lastApp, "wedi");
});

test("unknown ids are ignored", () => {
  assert.equal(run(pick("app", "nope")), initialRail);
  assert.equal(run(pick("settings", "nope")), initialRail);
  assert.equal(run(pick("other", "wedi")), initialRail);
});

test("closePane keeps the drawer; projectChanged closes the pane too", () => {
  const s = run(pick("app", "sheoga"), { type: "closePane" });
  assert.equal(s.pane, null);
  assert.equal(s.drawer, "apps");
  const t = run(pick("app", "sheoga"), { type: "projectChanged" });
  assert.equal(t.pane, null);
  assert.equal(t.drawer, "apps");
});

test("hopping between apps with the tray open never asks", () => {
  const s = run(pick("app", "wedi", true), pick("app", "sheoga", true), pick("app", "wedi", true));
  assert.equal(s.pane.resume, false);
});

test("closing the pane and reopening from the open tray never asks", () => {
  const s = run(pick("app", "wedi", true), { type: "closePane" }, pick("app", "wedi", true));
  assert.equal(s.pane.resume, false);
});

test("tray closed by its button, then back → asks", () => {
  const s = run(pick("app", "wedi", true), pick("app", "sheoga", true), toggle("apps"), toggle("apps"), pick("app", "wedi", true));
  assert.deepEqual(s.pane, { kind: "app", id: "wedi", resume: true });
});

test("the app on screen when the tray closes was never left → no ask", () => {
  const s = run(pick("app", "wedi", true), toggle("apps"), toggle("apps"), pick("app", "sheoga", true), pick("app", "wedi", true));
  assert.equal(s.pane.resume, false);
});

test("the app on screen when the tray closes asks once it is left with the tray shut", () => {
  const viaSettings = run(pick("app", "wedi", true), toggle("settings"), pick("settings", "book"), pick("app", "wedi", true));
  assert.equal(viaSettings.pane.resume, true);
  const viaClose = run(pick("app", "wedi", true), toggle("apps"), { type: "closePane" }, pick("app", "wedi", true));
  assert.equal(viaClose.pane.resume, true);
  const viaShortcut = run(pick("app", "wedi", true), toggle("apps"), pick("app", "sheoga", true), pick("app", "wedi", true));
  assert.equal(viaShortcut.pane.resume, true);
});

test("Settings opened, then back → asks (by toggle or by pick)", () => {
  const a = run(pick("app", "wedi", true), pick("app", "sheoga", true), toggle("settings"), pick("app", "wedi", true));
  assert.equal(a.pane.resume, true);
  const still = run(pick("app", "wedi", true), toggle("settings"), pick("app", "wedi", true));
  assert.equal(still.pane.resume, false, "an app still on screen was never left");
  const b = run(pick("app", "wedi", true), pick("settings", "general"), pick("app", "wedi", true));
  assert.equal(b.pane.resume, true);
});

test("project changed, then back → asks", () => {
  const s = run(pick("app", "schluter", true), { type: "projectChanged" }, pick("app", "schluter", true));
  assert.equal(s.pane.resume, true);
});

test("not in progress → no question, and the flag is spent", () => {
  const s = run(pick("app", "wedi"), { type: "projectChanged" }, pick("app", "wedi", false));
  assert.equal(s.pane.resume, false);
  assert.equal(s.broke.wedi, false);
  const t = railReducer(railReducer(s, pick("app", "sheoga")), pick("app", "wedi", true));
  assert.equal(t.pane.resume, false, "a later hop must not ask off a stale flag");
});

test("Label Generator and Settings never ask", () => {
  const s = run(pick("app", "labels", true), { type: "projectChanged" }, pick("app", "labels", true));
  assert.equal(s.pane.resume, false);
  const t = run(pick("settings", "book", true), { type: "projectChanged" }, pick("settings", "book", true));
  assert.equal(t.pane.resume, false);
});

test("resolveResume clears the question and leaves the pane", () => {
  const s = run(pick("app", "wedi", true), { type: "projectChanged" }, pick("app", "wedi", true), { type: "resolveResume" });
  assert.deepEqual(s.pane, { kind: "app", id: "wedi", resume: false });
  assert.equal(railReducer(initialRail, { type: "resolveResume" }), initialRail);
});

test("re-picking the pane already showing reopens its drawer and never asks", () => {
  const s = run(pick("app", "wedi", true), toggle("apps"), pick("app", "wedi", true));
  assert.equal(s.drawer, "apps");
  assert.equal(s.pane.resume, false);
  assert.equal(s.broke.wedi, false);
});

test("layerOf names the pane, else the open drawer, else null", () => {
  assert.deepEqual(layerOf(run(pick("app", "sheoga"))), { kind: "apps", app: "sheoga" });
  assert.deepEqual(layerOf(run(pick("settings", "book"))), { kind: "settings", section: "book" });
  assert.deepEqual(layerOf(run(toggle("apps"))), { kind: "apps" });
  assert.deepEqual(layerOf(run(toggle("settings"))), { kind: "settings" });
  assert.equal(layerOf(initialRail), null);
});

test("stateFromLayer round-trips and reads old shapes", () => {
  for (const s of [run(pick("app", "sheoga")), run(pick("settings", "book")), run(toggle("apps")), run(toggle("settings"))]) {
    const back = stateFromLayer(layerOf(s));
    assert.equal(back.drawer, s.drawer);
    assert.deepEqual(back.pane, s.pane);
  }
  // Pre-2026-09-24 entries: the hub never named an app; Settings always named a section.
  assert.deepEqual(stateFromLayer({ kind: "apps" }), { ...initialRail, drawer: "apps" });
  assert.deepEqual(stateFromLayer({ kind: "settings", section: "materials" }).pane, { kind: "settings", id: "materials", resume: false });
  assert.deepEqual(stateFromLayer({ kind: "settings", section: "gone" }), { ...initialRail, drawer: "settings" });
  assert.equal(stateFromLayer({ kind: "apps", app: "labels" }).lastApp, "labels");
  assert.deepEqual(stateFromLayer({ kind: "apps", app: "nope" }), { ...initialRail, drawer: "apps" });
  for (const junk of [null, undefined, "apps", 3, {}, { kind: "sheoga", aid: "a" }]) assert.equal(stateFromLayer(junk), null);
});

test("restore action applies a stored layer, ignores other kinds", () => {
  assert.deepEqual(railReducer(initialRail, { type: "restore", layer: { kind: "apps", app: "wedi" } }).pane, { kind: "app", id: "wedi", resume: false });
  assert.equal(railReducer(initialRail, { type: "restore", layer: { kind: "todos" } }), initialRail);
});

const customers = { type: "openCustomers" };

test("Customers fills the pane and leaves the drawers alone", () => {
  assert.deepEqual(run(customers).pane, { kind: "customers" });
  assert.equal(run(customers).drawer, null);
  const s = run(toggle("apps"), pick("app", "labels"), customers);
  assert.deepEqual(s.pane, { kind: "customers" });
  assert.equal(s.drawer, "apps");
  assert.equal(s.lastApp, "labels", "the Apps workspace stays mounted behind it");
});

test("an app or setting replaces Customers, and Customers replaces them", () => {
  assert.deepEqual(run(customers, pick("app", "wedi")).pane, { kind: "app", id: "wedi", resume: false });
  assert.deepEqual(run(customers, pick("settings", "book")).pane, { kind: "settings", id: "book", resume: false });
  assert.deepEqual(run(pick("settings", "book"), customers).pane, { kind: "customers" });
});

test("Customers over a configurator is leaving it: with the tray shut it asks on return", () => {
  const shut = run(pick("app", "wedi", true), toggle("apps"), customers, pick("app", "wedi", true));
  assert.equal(shut.pane.resume, true);
  const open = run(pick("app", "wedi", true), customers, pick("app", "wedi", true));
  assert.equal(open.pane.resume, false, "the tray stayed open — no break");
});

test("closePane and projectChanged close Customers", () => {
  assert.equal(run(customers, { type: "closePane" }).pane, null);
  assert.equal(run(customers, { type: "projectChanged" }).pane, null);
});

test("Customers persists as the browser layer and restores", () => {
  assert.deepEqual(layerOf(run(customers)), { kind: "browser" });
  assert.deepEqual(stateFromLayer({ kind: "browser" }), { ...initialRail, pane: { kind: "customers" } });
  assert.deepEqual(railReducer(initialRail, { type: "restore", layer: { kind: "browser" } }).pane, { kind: "customers" });
});
