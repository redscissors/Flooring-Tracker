# Rail Drawers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-window Apps hub and Settings pop-ups with two rail drawers (Apps rises from the bottom bar, Settings drops from under the logo) whose picks fill the work area over a still-mounted project.

**Architecture:** A pure reducer (`src/railnav.js`) owns which drawer is out, what fills the work area, and the Continue/Start-new "break" flags; it is unit-tested with `node --test`. A small component file (`src/raildrawer.jsx`) supplies the one sliding panel, the drawer lists and the pane header. `AppsWorkspace` and `SettingsWorkspace` shed their full-window shells and left menus and render inside a pane layer that `App.jsx` places over `<main>`.

**Tech Stack:** React 18 (hooks, `useReducer`), Vite 5, Tailwind 3 over the Moss `--ft-*` tokens, lucide-react, `node --test`, ESLint, Playwright (global install at `/opt/node22/lib/node_modules/playwright`, Chromium preinstalled) for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-24-rail-drawers-design.md` — read it before starting. Prototype the owner approved: https://claude.ai/artifact/TmLaLgXEmZpntm5CsiR9j4

## Global Constraints

- Never run SQL or write to the live Supabase project; `npm run dev` talks to the LIVE project, so never log in and click around it. Preview proof uses the mock-data harness only.
- Never push to `main`. All work goes on `claude/funny-dijkstra-kg5fdf`; the owner merges the PR after seeing screenshots.
- No persisted data shape changes. The only stored state touched is the device-local `localStorage` key `ft-open-layer`.
- Slide: one `height` animation per panel, `1300` ms, `cubic-bezier(.32,.72,0,1)`; no per-row fades or staggers; `prefers-reduced-motion: reduce` → no transition.
- Tray order top→bottom: Label Generator, Schluter, wedi, Sheoga. Settings order: Your details, General, Price book, Materials & add-ons, Backup & restore. No count hints on Settings rows. No divider above the tray; a `--ft-border-strong` line under the Settings list.
- Theme: reuse existing Tailwind classes (`bg-indigo-600 text-white` is the Moss ink fill) and `--ft-*` variables; no new colors.
- Comments: rare, only for non-obvious business rules (CLAUDE.md "Code Comments").
- Intermediate commits on this branch may leave the app half-wired (Tasks 2–3 change component props before Task 5 rewires `App.jsx`); the branch merges as one PR, so that is acceptable. `npm test`, `npm run lint` and `npm run build` must pass at the end of every task.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/railnav.js` | create | Pure nav state: reducer, ids, `layerOf` / `stateFromLayer` |
| `src/railnav.test.js` | create | `node --test` coverage of the reducer and layer mapping |
| `src/AppsWorkspace.jsx` | modify | Drop shell + app list; controlled `app`; keep configurators mounted; in-progress tracking; resume prompt |
| `src/sheogapreview.jsx` | modify | Its `?hub=1` mode passes the new `app` prop |
| `src/SettingsWorkspace.jsx` | modify | Drop shell + section menu; controlled `section`; "Book imported" note moves to Price book |
| `src/raildrawer.jsx` | create | `RailSlide`, `DrawerList`, `APP_ITEMS`, `SETTINGS_ITEMS`, `PaneHeader` |
| `rail-preview.html`, `src/railpreview.jsx` | create | Dev-only harness: real drawers + real workspaces over mock state |
| `src/uselabels.js` | modify | `showApps`/`openApps` → `refreshLabels` |
| `src/App.jsx` | modify | Reducer state, drawers in the rail, pane layer over `<main>`, Esc, restore, project-change breaks |
| `docs/adr/0047-rail-drawers.md`, `docs/adr/0028-…md`, `docs/adr/README.md`, `src/CLAUDE.md`, spec | modify/create | Decision record + file annotations |
| `.scratch/154_rail-drawers/` | create | Issue file + proof screenshots |

---

### Task 1: `railnav.js` — the navigation reducer

**Files:**
- Create: `src/railnav.js`
- Test: `src/railnav.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (exact names later tasks import):
  - `APP_IDS = ["labels", "schluter", "wedi", "sheoga"]`
  - `CONFIGURATOR_IDS = ["sheoga", "wedi", "schluter"]`
  - `SETTINGS_IDS = ["profile", "general", "book", "materials", "backup"]`
  - `initialRail = { drawer: null, pane: null, lastApp: null, broke: {} }`
  - `railReducer(state, action)`; actions:
    - `{ type: "toggleDrawer", which: "apps" | "settings" }`
    - `{ type: "pick", kind: "app" | "settings", id, inProgress: boolean }`
    - `{ type: "resolveResume" }`
    - `{ type: "closePane" }`
    - `{ type: "projectChanged" }`
    - `{ type: "restore", layer }`
  - Pane shape: `{ kind: "app" | "settings", id: string, resume: boolean }`
  - `layerOf(state) → { kind: "apps", app? } | { kind: "settings", section? } | null`
  - `stateFromLayer(layer) → state | null`

Rules the reducer encodes (from the spec):
- Only one drawer is out. Closing the Apps tray — by its button, or by opening Settings through `toggleDrawer` or a settings `pick` — sets the break flag for every configurator.
- `projectChanged` closes the pane and sets every break flag.
- Picking a configurator consumes (clears) its break flag; the pane asks to resume only if the flag was set AND `inProgress` is true. The Label Generator and Settings never ask.
- Picking the pane already showing only makes sure its drawer is out (and clears that configurator's flag); it never re-asks.

- [ ] **Step 1: Write the failing tests**

Create `src/railnav.test.js`:

```js
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

test("Settings opened, then back → asks (by toggle or by pick)", () => {
  const a = run(pick("app", "wedi", true), toggle("settings"), pick("app", "wedi", true));
  assert.equal(a.pane.resume, true);
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
  for (const junk of [null, undefined, "apps", 3, {}, { kind: "browser" }, { kind: "sheoga", aid: "a" }]) assert.equal(stateFromLayer(junk), null);
});

test("restore action applies a stored layer, ignores other kinds", () => {
  assert.deepEqual(railReducer(initialRail, { type: "restore", layer: { kind: "apps", app: "wedi" } }).pane, { kind: "app", id: "wedi", resume: false });
  assert.equal(railReducer(initialRail, { type: "restore", layer: { kind: "browser" } }), initialRail);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/railnav.test.js`
Expected: FAIL — `Cannot find module '.../src/railnav.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/railnav.js`:

```js
// Rail drawers (spec 2026-09-24): which drawer is out, what fills the work
// area, and when a configurator asks Continue / Start new.
export const APP_IDS = ["labels", "schluter", "wedi", "sheoga"];
export const CONFIGURATOR_IDS = ["sheoga", "wedi", "schluter"];
export const SETTINGS_IDS = ["profile", "general", "book", "materials", "backup"];

export const initialRail = { drawer: null, pane: null, lastApp: null, broke: {} };

// A "break" (owner, 2026-09-24) is the Apps tray closing or the open project
// changing; only a configurator returned to after a break asks to resume.
const breakAll = () => Object.fromEntries(CONFIGURATOR_IDS.map((id) => [id, true]));
const idsFor = (kind) => (kind === "app" ? APP_IDS : kind === "settings" ? SETTINGS_IDS : []);
const drawerFor = (kind) => (kind === "app" ? "apps" : "settings");

export function railReducer(s, a) {
  switch (a.type) {
    case "toggleDrawer": {
      if (a.which !== "apps" && a.which !== "settings") return s;
      const drawer = s.drawer === a.which ? null : a.which;
      return { ...s, drawer, broke: s.drawer === "apps" ? breakAll() : s.broke };
    }
    case "pick": {
      if (!idsFor(a.kind).includes(a.id)) return s;
      const drawer = drawerFor(a.kind);
      let broke = s.drawer === "apps" && drawer !== "apps" ? breakAll() : s.broke;
      const isCfg = a.kind === "app" && CONFIGURATOR_IDS.includes(a.id);
      const same = s.pane && s.pane.kind === a.kind && s.pane.id === a.id;
      const resume = !same && isCfg && !!a.inProgress && !!broke[a.id];
      if (isCfg && broke[a.id]) broke = { ...broke, [a.id]: false };
      if (same) return { ...s, drawer, broke };
      return { ...s, drawer, broke, pane: { kind: a.kind, id: a.id, resume }, lastApp: a.kind === "app" ? a.id : s.lastApp };
    }
    case "resolveResume":
      return s.pane?.resume ? { ...s, pane: { ...s.pane, resume: false } } : s;
    case "closePane":
      return s.pane ? { ...s, pane: null } : s;
    case "projectChanged":
      return { ...s, pane: null, broke: breakAll() };
    case "restore":
      return stateFromLayer(a.layer) || s;
    default:
      return s;
  }
}

// The `ft-open-layer` entry (ADR 0028) for the rail: the pane if one shows,
// else the open drawer. Entries written before 2026-09-24 are
// { kind: "apps" } and { kind: "settings", section } — both still read.
export function layerOf(s) {
  if (s.pane) return s.pane.kind === "app" ? { kind: "apps", app: s.pane.id } : { kind: "settings", section: s.pane.id };
  if (s.drawer) return { kind: s.drawer };
  return null;
}

export function stateFromLayer(L) {
  if (!L || typeof L !== "object") return null;
  if (L.kind === "apps") {
    const id = APP_IDS.includes(L.app) ? L.app : null;
    return { ...initialRail, drawer: "apps", pane: id ? { kind: "app", id, resume: false } : null, lastApp: id };
  }
  if (L.kind === "settings") {
    const id = SETTINGS_IDS.includes(L.section) ? L.section : null;
    return { ...initialRail, drawer: "settings", pane: id ? { kind: "settings", id, resume: false } : null };
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/railnav.test.js`
Expected: every test passes (`# fail 0`).

- [ ] **Step 5: Run the whole suite and lint**

Run: `npm test && npm run lint`
Expected: `# fail 0` for the suite; lint prints no errors.

- [ ] **Step 6: Commit**

```bash
git add src/railnav.js src/railnav.test.js
git commit -m "Add railnav: rail drawer + work-area pane reducer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0159UwJSC63cCsUMcGVerBY2"
```

---

### Task 2: `AppsWorkspace` renders inside the pane

**Files:**
- Modify: `src/AppsWorkspace.jsx` (component signature ~line 119; state ~lines 120–170; shell lines 270–301 and 526–527; configurator blocks lines 474–525)
- Modify: `src/sheogapreview.jsx` (the `Hub` component)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (ids are plain strings).
- Produces — new `AppsWorkspace` props (Task 5 passes these; `initialApp` is removed):
  - `app: "labels" | "schluter" | "wedi" | "sheoga"` — the app to show (controlled).
  - `onClose(): void` — close the pane (the configurators' own embedded `onClose` calls it).
  - `resume: boolean` — show the Continue / Start new prompt for `app`.
  - `onResume(): void` — called after Continue or Start new.
  - `progressRef: { current: (id) => boolean }` — AppsWorkspace keeps `progressRef.current` pointing at its `inProgress(id)` function.
  - All other props (`stock`, `labels`, `presets`, label handlers, `sheoga`, `wedi`, `schluter` bags) are unchanged.

- [ ] **Step 1: Change the signature and remove the hub's own nav state**

Replace the component signature line:

```jsx
export function AppsWorkspace({ onClose, stock, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onDeleteLabel, onSavePreset, sheoga, wedi, schluter, initialApp }) {
```

with:

```jsx
export function AppsWorkspace({ app, onClose, resume = false, onResume, progressRef, stock, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onDeleteLabel, onSavePreset, sheoga, wedi, schluter }) {
```

Delete, from just below the signature, everything from `const [app, setApp] = useState(...)` through `const pickApp = (k) => { setApp(k); setRailOpen(false); };` — the comment block about the rail folding, `hubQuery`, `wideHub`/`setWideHub`, its `useEffect`, `railOpen`/`setRailOpen` and `pickApp`. The Sheoga docked grid no longer needs `hubQuery`: `useDockGrid` in `SheogaConfigurator.jsx` measures its own frame with a `ResizeObserver`, so the rail's 205px width is accounted for automatically.

Remove the now-unused `DOCK_FRAME_W` import (`import { DOCK_FRAME_W } from "./sheoga.js";`).

Replace `const APP_NAME = { labels: "Label Generator", sheoga: "Sheoga configurator", wedi: "wedi configurator", schluter: "Schluter configurator" };` with:

```jsx
const CONFIG_NAME = { sheoga: "Sheoga", wedi: "wedi", schluter: "Schluter" };
```

- [ ] **Step 2: Add in-progress tracking and keep-mounted bookkeeping**

Directly after the line `const setBasketFor = { sheoga: setSheogaBasket, wedi: setWediBasket, schluter: setSchluterBasket };` add:

```jsx
  // In progress = staged basket entries, or any option changed since the
  // configurator mounted (spec 2026-09-24). The first report is its opening
  // state; StrictMode's repeat of it compares equal.
  const firstCfg = useRef({});
  const [touched, setTouched] = useState({});
  const cfgSeen = (k) => (cfg) => {
    const j = JSON.stringify(cfg);
    if (firstCfg.current[k] === undefined) firstCfg.current[k] = j;
    else if (j !== firstCfg.current[k]) setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  };
  const basketOf = { sheoga: sheogaBasket, wedi: wediBasket, schluter: schluterBasket };
  const inProgress = (k) => !!touched[k] || (basketOf[k]?.length || 0) > 0;
  useEffect(() => { if (progressRef) progressRef.current = inProgress; });
  // Configurators stay mounted once opened so a build survives a trip away;
  // Start new remounts just that one by bumping its generation key.
  const [visited, setVisited] = useState(() => new Set([app]));
  const mounted = visited.has(app) ? visited : new Set(visited).add(app);
  useEffect(() => { if (mounted !== visited) setVisited(mounted); });
  const [gen, setGen] = useState({});
  const startNew = (k) => {
    setBasketFor[k]([]);
    firstCfg.current[k] = undefined;
    setTouched((t) => ({ ...t, [k]: false }));
    setGen((g) => ({ ...g, [k]: (g[k] || 0) + 1 }));
    onResume?.();
  };
  const shown = (k) => app === k && !resume;
  const slot = (k) => (shown(k) ? "flex-1 min-h-0 flex flex-col" : "hidden");
```

- [ ] **Step 3: Replace the full-window shell with a pane-sized root**

Replace lines 270–301 (from `return (` through the closing `)}` of the `{!wideHub && (...)}` bar) — i.e. this block:

```jsx
  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="relative bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* nav rail — a fixed column when there's room, a drawer when there isn't */}
        ...the <aside> app list...
        {/* main */}
        <div className="flex-1 flex flex-col min-w-0">
          {!wideHub && (
            ...the ‹ Apps bar...
          )}
```

with:

```jsx
  return (
    <div className="print:hidden relative h-full flex flex-col min-w-0 bg-white">
      <div className="flex-1 min-h-0 flex flex-col">
          {resume && CONFIG_NAME[app] && (
            <div className="flex-1 overflow-y-auto p-6">
              <div data-resume-prompt className="max-w-md mx-auto mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_16px_36px_-20px_var(--ft-shadow)]">
                <h3 className="ft-serif text-xl">Pick up your {CONFIG_NAME[app]} build?</h3>
                <p className="text-sm text-slate-500 mt-1">You left one in progress when you clicked away.</p>
                <div className="mt-3 rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--ft-brand-soft)" }}>
                  {basketOf[app]?.length
                    ? `${basketOf[app].length} build${basketOf[app].length === 1 ? "" : "s"} staged`
                    : "Options changed, nothing staged yet"}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => onResume?.()} className="text-sm font-semibold rounded-md bg-indigo-600 text-white px-3.5 py-1.5">Continue build</button>
                  <button onClick={() => startNew(app)} className="text-sm font-semibold rounded-md border border-slate-200 px-3.5 py-1.5 hover:bg-slate-50">Start new</button>
                </div>
              </div>
            </div>
          )}
```

Replace the two closing lines 526–527:

```jsx
        </div>
      </div>
```

(the `</div>` that closed `{/* main */}` and the `</div>` that closed the white card) with the single closing tag of the new inner wrapper:

```jsx
      </div>
```

The `{pending && (...)}` destination prompt and the component's final `</div>` stay exactly as they are.

- [ ] **Step 4: Keep each configurator mounted and wire in-progress + close**

Replace the Sheoga block (`{app === "sheoga" && sheoga && ( <SheogaConfigurator ... /> )}`) with:

```jsx
          {mounted.has("sheoga") && sheoga && (
            <div key={`sheoga-${gen.sheoga || 0}`} className={slot("sheoga")}>
              <SheogaConfigurator
                embedded
                markupDefault={sheoga.markupDefault}
                ventMarkupDefault={sheoga.ventMarkupDefault}
                basket={sheogaBasket}
                onBasketChange={setSheogaBasket}
                areaName={sheoga.currentName || "a new quick price"}
                onAdd={(lines) => requestCommit("sheoga", sheoga, lines, null)}
                onMove={(lines) => requestCommit("sheoga", sheoga, lines, null)}
                onMoveEntries={(lines, nextBasket) => requestCommit("sheoga", sheoga, lines, nextBasket)}
                onConfigChange={cfgSeen("sheoga")}
                onClose={() => { if (!pendingRef.current) onClose?.(); }}
              />
            </div>
          )}
```

Replace the wedi block with:

```jsx
          {mounted.has("wedi") && wedi && (
            <div key={`wedi-${gen.wedi || 0}`} className={slot("wedi")}>
              <Suspense fallback={null}>
                <WediConfigurator
                  embedded
                  wediBuilderPct={wedi.builderPct}
                  schluterBuilderPct={wedi.schluterBuilderPct}
                  areaName={wedi.currentName || "a new quick price"}
                  projectName={wedi.currentName || ""}
                  stockRows={wedi.stockRows} bookStockReady={wedi.bookStockReady}
                  books={wedi.books} loadBookItems={wedi.loadBookItems}
                  mortars={wedi.mortars} mortarDefault={wedi.mortarDefault}
                  basket={wediBasket}
                  onBasketChange={setWediBasket}
                  onMoveEntries={(groups, nextBasket) => requestCommit("wedi", wedi, groups.flatMap((g) => stampKit(g.lines)), nextBasket)}
                  onAdd={(lines) => requestCommit("wedi", wedi, lines, null)}
                  onConfigChange={cfgSeen("wedi")}
                  onClose={() => { if (!pendingRef.current) onClose?.(); }}
                />
              </Suspense>
            </div>
          )}
```

Replace the Schluter block with:

```jsx
          {mounted.has("schluter") && schluter && (
            <div key={`schluter-${gen.schluter || 0}`} className={slot("schluter")}>
              <Suspense fallback={null}>
                <SchluterConfigurator
                  embedded
                  schluterBuilderPct={schluter.builderPct}
                  wediBuilderPct={schluter.wediBuilderPct}
                  areaName={schluter.currentName || "a new quick price"}
                  projectName={schluter.currentName || ""}
                  stockRows={schluter.stockRows} bookStockReady={schluter.bookStockReady}
                  books={schluter.books} loadBookItems={schluter.loadBookItems}
                  mortars={schluter.mortars} mortarDefault={schluter.mortarDefault}
                  basket={schluterBasket}
                  onBasketChange={setSchluterBasket}
                  onMoveEntries={(groups, nextBasket) => requestCommit("schluter", schluter, groups.flatMap((g) => stampKit(g.lines)), nextBasket)}
                  onAdd={(lines) => requestCommit("schluter", schluter, lines, null)}
                  onConfigChange={cfgSeen("schluter")}
                  onClose={() => { if (!pendingRef.current) onClose?.(); }}
                />
              </Suspense>
            </div>
          )}
```

The Label Generator block keeps its `{app === "labels" && (<> ... </>)}` guard unchanged (its draft state already lives at the top of the component).

- [ ] **Step 5: Update the Sheoga preview harness's hub mode**

In `src/sheogapreview.jsx`, in `function Hub()`, change `<AppsWorkspace initialApp="sheoga" onClose={() => console.log("close")}` to:

```jsx
    <AppsWorkspace app="sheoga" onClose={() => console.log("close")} onResume={() => {}} progressRef={{ current: () => false }}
```

and wrap the returned element so it has a height to fill:

```jsx
function Hub() {
  return (
    <div style={{ height: "100vh" }}>
      <AppsWorkspace app="sheoga" onClose={() => console.log("close")} onResume={() => {}} progressRef={{ current: () => false }}
        stock={[]} labels={[]} presets={[]} onAddLabel={() => {}} onAddLabelsBulk={() => {}} onUpdateLabel={() => {}} onDeleteLabel={() => {}} onSavePreset={() => {}}
        sheoga={{ markupDefault: 40, ventMarkupDefault: 50, currentName: "", addToCurrent: () => {}, addToNew: (l) => console.log("add", l) }} />
    </div>
  );
}
```

Update the `?hub=1` comment above `const HUB` to: `// \`?hub=1\` renders the REAL AppsWorkspace on the Sheoga app, at the width the work-area pane gives it.`

- [ ] **Step 6: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: lint clean — if it reports unused imports in `AppsWorkspace.jsx` (likely `X`, `ChevronLeft`), delete them from the lucide import line and rerun; tests `# fail 0`; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/AppsWorkspace.jsx src/sheogapreview.jsx
git commit -m "AppsWorkspace: render in the work-area pane, keep builds mounted, resume prompt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0159UwJSC63cCsUMcGVerBY2"
```

---

### Task 3: `SettingsWorkspace` renders inside the pane

**Files:**
- Modify: `src/SettingsWorkspace.jsx` (signature line 233; section state lines 236–239; `SECTIONS` ~line 418; shell lines 854–874; book branch ~line 994)

**Interfaces:**
- Produces — `SettingsWorkspace` props: remove `onClose`, `initialSection`, `onSectionChange`; add `section: "profile" | "general" | "book" | "materials" | "backup"` (controlled). Task 5 mounts it with `key={section}`, so per-section view state (selection, add drafts, menus) resets on every section change without extra code.

- [ ] **Step 1: Controlled section**

In the signature, delete `onClose, ` at the start and replace `initialSection, onSectionChange, ping` at the end with `section, ping`.

Delete these lines (and the two-line comment above them about the refresh-restore hooks):

```jsx
  const [section, setSectionState] = useState(initialSection || "materials");
  const setSection = (id) => { setSectionState(id); onSectionChange?.(id); };
```

Delete the `const SECTIONS = [ ... ];` array (~line 418, five entries) — the rail's Settings drawer replaces it.

- [ ] **Step 2: Replace the shell and section menu**

Replace this block (lines 854–874, from the `shellRef` div through `</aside>`):

```jsx
    <div ref={shellRef} className="print:hidden fixed inset-0 z-50 p-2 md:p-5 overflow-auto" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" style={{ zoom, minWidth: zoom <= SETTINGS_ZOOM_FLOOR ? SETTINGS_DESIGN_W : 0 }} onClick={(e) => e.stopPropagation()}>
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          ...Settings title, close X, SECTIONS nav, ops footer...
        </aside>
```

with:

```jsx
    <div ref={shellRef} className="print:hidden h-full overflow-auto">
      <div className="bg-white w-full h-full flex overflow-hidden" style={{ zoom, minWidth: zoom <= SETTINGS_ZOOM_FLOOR ? SETTINGS_DESIGN_W : 0 }}>
```

The shrink-to-fit effect needs no change: it subtracts the shell's padding, which is now 0. Update its comment's first line to `// Shrink-to-fit: measure the pane's width and zoom the card to it.` (drop the "padding steps 8→20px at md" clause).

- [ ] **Step 3: Move the "Book imported" note into Price book**

The Backup & restore section already shows "Last backup downloaded …", so only the import note moves. Replace the book branch

```jsx
        ) : section === "book" ? (
          <PriceBookLibrary books={books} ... />
        ) : (
```

with (keep every `PriceBookLibrary` prop exactly as it is today):

```jsx
        ) : section === "book" ? (
          <div className="flex-1 min-w-0 flex flex-col">
            {settings.ops?.lastImport && <div className="px-6 pt-3 text-[11px] text-slate-400">Book imported {new Date(settings.ops.lastImport.at).toLocaleDateString()}{settings.ops.lastImport.by ? ` by ${settings.ops.lastImport.by}` : ""}</div>}
            <PriceBookLibrary books={books} ... />
          </div>
        ) : (
```

- [ ] **Step 4: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: lint may report now-unused lucide icons (`User`, `Percent`, `BookOpen`, `Database`, maybe `X`) and `useState` only if it became unused (it will not — other state remains). Delete exactly the names lint reports and rerun until clean; tests `# fail 0`; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/SettingsWorkspace.jsx
git commit -m "SettingsWorkspace: render in the work-area pane with a controlled section

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0159UwJSC63cCsUMcGVerBY2"
```

---

### Task 4: `raildrawer.jsx` + the `rail-preview` harness

**Files:**
- Create: `src/raildrawer.jsx`
- Create: `rail-preview.html`, `src/railpreview.jsx`

**Interfaces:**
- Consumes: `railReducer`, `initialRail` (Task 1); `AppsWorkspace` new props (Task 2); `SettingsWorkspace` `section` prop (Task 3).
- Produces (Task 5 imports these):
  - `RAIL_SLIDE_MS = 1300`
  - `RailSlide({ open: boolean, anchor: "top" | "bottom", children })`
  - `DrawerList({ title: string, items: {id,label,icon}[], activeId: string | null, onPick: (id) => void, itemClass: string, className?: string, divider?: boolean })`
  - `APP_ITEMS`, `SETTINGS_ITEMS` — `{ id, label, icon }[]` in the spec's order
  - `PaneHeader({ backLabel: string, group: string, title: string, onBack: () => void, onClose: () => void })`

- [ ] **Step 1: Write `src/raildrawer.jsx`**

```jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tag, Layers, ShowerHead, TreePine, User, Percent, BookOpen, Database, X } from "lucide-react";

export const RAIL_SLIDE_MS = 1300;

export const APP_ITEMS = [
  { id: "labels", label: "Label Generator", icon: Tag },
  { id: "schluter", label: "Schluter", icon: Layers },
  { id: "wedi", label: "wedi", icon: ShowerHead },
  { id: "sheoga", label: "Sheoga", icon: TreePine },
];
export const SETTINGS_ITEMS = [
  { id: "profile", label: "Your details", icon: User },
  { id: "general", label: "General", icon: Percent },
  { id: "book", label: "Price book", icon: BookOpen },
  { id: "materials", label: "Materials & add-ons", icon: Layers },
  { id: "backup", label: "Backup & restore", icon: Database },
];

function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const f = () => setOn(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return on;
}

// One solid panel whose height slides 0 ↔ its content. `anchor` pins the
// content to the panel's top edge (the tray rises out of the bottom bar
// heading-first) or its bottom edge (Settings drops from under the logo
// last-row-first) — the owner rejected per-row fades for this.
export function RailSlide({ open, anchor = "top", children }) {
  const inner = useRef(null);
  const [h, setH] = useState(0);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const on = () => setH(el.offsetHeight);
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div aria-hidden={!open} inert={open ? undefined : ""}
      style={{
        height: open ? h : 0, overflow: "hidden", flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: anchor === "bottom" ? "flex-end" : "flex-start",
        transition: reduce ? "none" : `height ${RAIL_SLIDE_MS}ms cubic-bezier(.32,.72,0,1)`,
      }}>
      <div ref={inner} style={{ flex: "none" }}>{children}</div>
    </div>
  );
}

export function DrawerList({ title, items, activeId, onPick, itemClass, className = "", divider = false }) {
  return (
    <div className={className} style={divider ? { borderBottom: "1px solid var(--ft-border-strong)" } : undefined}>
      <div className="mb-1 px-3.5 ft-eyebrow text-[9px]">{title}</div>
      {items.map(({ id, label, icon: Icon }) => {
        const on = id === activeId;
        return (
          <button key={id} onClick={() => onPick(id)} aria-current={on ? "page" : undefined}
            className={`${itemClass} ${on ? "!bg-indigo-600 !text-white" : ""}`}>
            <Icon size={15} className="w-4 shrink-0" /> <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PaneHeader({ backLabel, group, title, onBack, onClose }) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-slate-200 text-[13px] bg-white">
      <button onClick={onBack} className="rounded-md px-1.5 py-0.5 font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-700 truncate max-w-[40%]">← {backLabel}</button>
      <span className="text-slate-300">›</span>
      <span className="font-semibold text-slate-400">{group}</span>
      <span className="text-slate-300">›</span>
      <span className="font-bold text-slate-800 truncate">{title}</span>
      <button onClick={onClose} aria-label="Close" title="Close" className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"><X size={17} /></button>
    </div>
  );
}
```

- [ ] **Step 2: Write the harness page `rail-preview.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FloorTrack — rail drawers preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="preview"></div>
    <script type="module" src="/src/railpreview.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write `src/railpreview.jsx`**

The rail itself is inline JSX in `App.jsx`, so the harness rebuilds the rail column around the REAL drawer components, reducer, pane header and workspaces. Keep its class names identical to `App.jsx`'s rail (`railItem`, `ft-rail`, widths) so the shots match production.

```jsx
// Dev-only harness (rail-preview.html): the REAL rail drawers, railnav
// reducer, pane header, AppsWorkspace and SettingsWorkspace over mock state,
// no Supabase — preview proof for the 2026-09-24 rail drawers. The rail
// column around them mirrors App.jsx's markup. Not part of the app build.
import { lazy, Suspense, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Settings, LayoutGrid, LogOut, Search, Zap, Folder, Plus, ShowerHead, TreePine, ClipboardList } from "lucide-react";
import "./index.css";
import NedLogo from "./NedLogo.jsx";
import { railReducer, initialRail } from "./railnav.js";
import { RailSlide, DrawerList, APP_ITEMS, SETTINGS_ITEMS, PaneHeader } from "./raildrawer.jsx";
import { AppsWorkspace } from "./AppsWorkspace.jsx";
import { normalizeSettings } from "./catalog.js";
import { TYPES, TLBL } from "./uiconst.js";

const SettingsWorkspace = lazy(() => import("./SettingsWorkspace.jsx"));
const RAIL_W = 205;
const noop = () => {};
const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const railItem = "w-full flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold text-slate-600 hover:bg-slate-50";
const PEOPLE = [{ id: "p1", name: "Hendricks" }, { id: "p2", name: "Okafor" }, { id: "p3", name: "Ruiz Builders" }, { id: "p4", name: "Patel" }];

function Harness() {
  const [nav, dispatch] = useReducer(railReducer, initialRail);
  const [person, setPerson] = useState("p1");
  const progress = useRef(() => false);
  const [settings, setSettingsState] = useState(() => normalizeSettings({}));
  const pick = (kind, id) => dispatch({ type: "pick", kind, id, inProgress: kind === "app" ? progress.current(id) : false });
  const cur = PEOPLE.find((p) => p.id === person);
  const bag = { currentName: cur.name, addToCurrent: (l) => { console.log("current", l); dispatch({ type: "closePane" }); }, addToNew: (l) => { console.log("new", l); dispatch({ type: "closePane" }); } };
  return (
    <div className="ft-vh bg-slate-50 text-slate-800 flex" style={{ fontFamily: "var(--ft-ui)", height: "100vh" }}>
      <aside style={{ width: RAIL_W }} className="ft-rail border-r border-slate-200 flex flex-col shrink-0">
        <div className="relative px-4 py-3.5 border-b border-slate-100">
          <NedLogo height={27} /><div className="ft-eyebrow text-[9.5px] mt-1">Selection Manager</div>
          <div className="absolute top-3 right-3 flex items-center">
            <button data-gear onClick={() => dispatch({ type: "toggleDrawer", which: "settings" })} aria-label="Settings" aria-expanded={nav.drawer === "settings"}
              className={`p-1 rounded-md ${nav.drawer === "settings" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}>
              <Settings size={16} className={`transition-transform duration-500 ${nav.drawer === "settings" ? "rotate-[60deg]" : ""}`} />
            </button>
          </div>
        </div>
        <RailSlide open={nav.drawer === "settings"} anchor="bottom">
          <DrawerList title="Settings" items={SETTINGS_ITEMS} activeId={nav.pane?.kind === "settings" ? nav.pane.id : null}
            onPick={(id) => pick("settings", id)} itemClass={railItem} className="px-2.5 pt-2.5 pb-2.5" divider />
        </RailSlide>
        <div className="p-2.5 pb-8 space-y-2">
          <div className="relative"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input placeholder="Search" className={inp + " pl-8"} /></div>
          <button className="ft-spark-btn w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2"><Zap size={16} className="-ml-1" /> Quick Price</button>
          <div>
            <button className={railItem}><Folder size={15} fill="currentColor" className="w-4 shrink-0 text-indigo-500" /> Customers</button>
            <button className={railItem}><Plus size={15} className="w-4 shrink-0" /> New Customer</button>
            <button onClick={() => pick("app", "wedi")} className={railItem}><ShowerHead size={15} className="w-4 shrink-0" /> wedi</button>
            <button onClick={() => pick("app", "sheoga")} className={railItem}><TreePine size={15} className="w-4 shrink-0" /> Sheoga</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          <div className="mt-1 mb-1 px-3.5 ft-eyebrow text-[9px]">Recent</div>
          {PEOPLE.map((p) => (
            <button key={p.id} data-person={p.id} onClick={() => { if (p.id !== person) { setPerson(p.id); dispatch({ type: "projectChanged" }); } else dispatch({ type: "closePane" }); }}
              className="w-full text-left rounded-md py-2 pl-[13px] text-[12.5px] font-semibold hover:bg-slate-100">{p.name}</button>
          ))}
        </div>
        <RailSlide open={nav.drawer === "apps"} anchor="top">
          <DrawerList title="Apps" items={APP_ITEMS} activeId={nav.pane?.kind === "app" ? nav.pane.id : null}
            onPick={(id) => pick("app", id)} itemClass={railItem} className="px-2.5 pt-1 pb-1.5" />
        </RailSlide>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
          <button className="flex items-center justify-center rounded-md hover:bg-slate-50 p-1.5 text-slate-500"><LogOut size={16} /></button>
          <button data-apps onClick={() => dispatch({ type: "toggleDrawer", which: "apps" })} aria-label="Apps" aria-expanded={nav.drawer === "apps"}
            className={`flex items-center justify-center rounded-md p-1.5 ${nav.drawer === "apps" ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-500"}`}><LayoutGrid size={16} /></button>
          <button className="flex items-center justify-center rounded-md hover:bg-slate-50 p-1.5 text-slate-500"><ClipboardList size={16} /></button>
        </div>
      </aside>
      <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
        <main className="flex-1 overflow-y-auto p-5" style={{ visibility: nav.pane ? "hidden" : undefined }}>
          <div className="bg-white rounded-lg border border-slate-200 p-4"><div className="ft-eyebrow-accent text-[10px]">Customer</div><div className="ft-serif text-3xl">{cur.name}</div></div>
        </main>
        <div className={nav.pane ? "absolute inset-0 z-20 flex flex-col bg-white" : "hidden"}>
          {nav.pane && <PaneHeader backLabel={cur.name} group={nav.pane.kind === "app" ? "Apps" : "Settings"}
            title={(nav.pane.kind === "app" ? APP_ITEMS : SETTINGS_ITEMS).find((x) => x.id === nav.pane.id).label}
            onBack={() => dispatch({ type: "closePane" })} onClose={() => dispatch({ type: "closePane" })} />}
          {nav.pane?.kind === "settings" && (
            <div className="flex-1 min-h-0">
              <Suspense fallback={null}>
                <SettingsWorkspace key={nav.pane.id} section={nav.pane.id} settings={settings} setSettings={(p) => setSettingsState((s) => ({ ...s, ...p }))}
                  gFamilies={[]} ping={noop} exportBackup={noop} importBackup={noop} fileRef={{ current: null }}
                  inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} theme="system" setTheme={noop} headerLayout="bar" setHeaderLayout={noop}
                  profile={{ name: "Dana Whitaker", phone: "(614) 555-0142", email: "dana@example.com" }} saveProfile={noop} user={{ email: "dana@example.com" }}
                  books={[]} addBook={noop} updateBook={noop} confirmBook={noop} delBook={noop} loadBookItems={async () => []} applyBookImport={noop}
                  bookStock={{}} orderBookStock={{}} loadFamilyBook={noop} bookStockReady refreshBookStock={noop}
                  loadBookVersions={async () => []} loadBookVersionSnapshot={async () => null} pinBookVersion={noop} updateBookItem={noop}
                  setBookItemsDisabled={noop} reviewBookItemFlags={noop} setBookItemIssue={noop} addClaudeIssue={noop} />
              </Suspense>
            </div>
          )}
          {nav.lastApp && (
            <div className={nav.pane?.kind === "app" ? "flex-1 min-h-0 flex flex-col" : "hidden"}>
              <AppsWorkspace app={nav.lastApp} onClose={() => dispatch({ type: "closePane" })}
                resume={nav.pane?.kind === "app" && !!nav.pane.resume} onResume={() => dispatch({ type: "resolveResume" })} progressRef={progress}
                stock={[]} labels={[]} presets={[]} onAddLabel={noop} onAddLabelsBulk={noop} onUpdateLabel={noop} onDeleteLabel={noop} onSavePreset={noop}
                sheoga={{ markupDefault: 40, ventMarkupDefault: 50, ...bag }}
                wedi={{ builderPct: 0, schluterBuilderPct: 0, stockRows: [], bookStockReady: true, books: [], loadBookItems: async () => [], mortars: [], mortarDefault: "", ...bag }}
                schluter={{ builderPct: 0, wediBuilderPct: 0, stockRows: [], bookStockReady: true, books: [], loadBookItems: async () => [], mortars: [], mortarDefault: "", ...bag }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
```

If `NedLogo.jsx` exports a named rather than default export, match `App.jsx`'s own import line for it. If `SettingsWorkspace` throws on mount over a missing prop, add that prop as a no-op/empty value here (the harness must not change production code to accommodate itself).

- [ ] **Step 4: Run it and take the proof shots**

Start the dev server in the background and wait for it: `PORT=5199 npx vite --host 127.0.0.1 &` then `until curl -s http://127.0.0.1:5199/rail-preview.html >/dev/null; do sleep 1; done` (use the Monitor tool rather than a foreground sleep if the harness blocks sleep).

Create the proof folder `mkdir -p .scratch/154_rail-drawers/proof` and save this script to the session scratchpad (not the repo) as `shots.cjs`:

```js
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5199/rail-preview.html");
  await p.waitForTimeout(800);
  await p.click("[data-apps]"); await p.waitForTimeout(520);
  await p.screenshot({ path: `${OUT}/01-tray-mid-slide.png`, clip: { x: 0, y: 460, width: 240, height: 400 } });
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `${OUT}/02-tray-open.png` });
  await p.getByRole("button", { name: "Sheoga" }).last().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/03-sheoga-in-work-area.png` });
  await p.locator("[data-sheoga-pop] button", { hasText: /^Hickory/ }).first().click(); await p.waitForTimeout(300);
  await p.click('[data-person="p2"]'); await p.waitForTimeout(300);
  await p.getByRole("button", { name: "Sheoga" }).last().click(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/04-resume-prompt.png` });
  await p.click("[data-gear]"); await p.waitForTimeout(520);
  await p.screenshot({ path: `${OUT}/05-settings-mid-slide.png`, clip: { x: 0, y: 0, width: 240, height: 420 } });
  await p.waitForTimeout(1100);
  await p.getByRole("button", { name: "General" }).click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/06-settings-general.png` });
  await p.setViewportSize({ width: 900, height: 860 }); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/07-narrow.png` });
  console.log("pageerrors:", JSON.stringify(errors));
  await b.close();
})();
```

Run: `node <scratchpad>/shots.cjs .scratch/154_rail-drawers/proof`
Expected: `pageerrors: []` and seven PNGs. Open each with the Read tool and check:
1. `01` — "APPS" and Label Generator visible above the bar, Sheoga still hidden behind it.
2. `02` — the four apps, no divider line above them, and nothing loaded in the work area.
3. `03` — Sheoga fills the work area, the header reads "← Hendricks › Apps › Sheoga", and the tray row is highlighted.
4. `04` — "Pick up your Sheoga build?" with Continue build / Start new, and the header now reads "← Okafor".
5. `05` — the line and the lower Settings rows visible under the logo, with the upper rows still hidden.
6. `06` — the General section in the work area, and the Apps tray closed.
7. `07` — nothing overflows at 900px.

If a shot is wrong, fix the cause in `raildrawer.jsx` / the workspaces (not the harness) and reshoot. Stop the dev server afterwards (`kill %1` or by PID).

- [ ] **Step 5: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all clean. (`vite build` only builds `index.html`; the harness is dev-only like the other `*-preview.html` pages.)

- [ ] **Step 6: Commit**

```bash
git add src/raildrawer.jsx rail-preview.html src/railpreview.jsx .scratch/154_rail-drawers/proof
git commit -m "Add rail drawer components and the rail-preview harness with proof shots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0159UwJSC63cCsUMcGVerBY2"
```

---

### Task 5: Wire it into `App.jsx`

**Files:**
- Modify: `src/uselabels.js`
- Modify: `src/App.jsx` — React import (line 1); state (lines 166–169, 617–623); layer restore/write (lines 634–664); `useDirectory` destructure (line 178); Esc (lines 1162–1163); rail (lines ~1401–1470); `<main>` (lines 1471, 2590); mobile add bar guard (~line 2603); Settings + Apps mounts (lines ~2716–2784)

**Interfaces:**
- Consumes: everything Tasks 1–4 produce.
- Produces: `useLabels` returns `refreshLabels()` in place of `showApps`, `setShowApps`, `openApps`; its `setSidebarOpen` parameter is removed.

- [ ] **Step 1: `useLabels` — load labels on demand, drop hub visibility**

In `src/uselabels.js`: change the signature to `export function useLabels({ user, profile, ping, flashSaved, settings, setSettings })`; delete `const [showApps, setShowApps] = useState(false);`; replace `openApps` with

```js
  const refreshLabels = () => {
    loadLabels(supabase).then((rows) => setLabels((prev) => {
      const have = new Set(rows.map((l) => l.id));
      return [...rows, ...prev.filter((l) => !have.has(l.id))];
    })).catch(() => { });
  };
```

and in the returned object replace `showApps, setShowApps,` and `openApps,` with `refreshLabels,`. Update the top comment's "loaded when the Apps hub opens" to "loaded when the Label Generator opens".

- [ ] **Step 2: Reducer state and wrapped navigation in `App.jsx`**

1. Line 1: add `useReducer` to the React import.
2. Add imports beside the other local imports:
   ```jsx
   import { railReducer, initialRail, layerOf } from "./railnav.js";
   import { RailSlide, DrawerList, APP_ITEMS, SETTINGS_ITEMS, PaneHeader } from "./raildrawer.jsx";
   ```
3. Delete `const [showSettings, setShowSettings] = useState(false);` and the `settingsSection` state with its two-line comment (lines 166–169).
4. Immediately above `const {` that destructures `useDirectory` (line ~176), add:
   ```jsx
   const [railNav, railDispatch] = useReducer(railReducer, initialRail);
   // What an open app would lose on a trip away (AppsWorkspace keeps it current).
   const appsProgress = useRef(() => false);
   ```
5. In that destructure, change `pickProject, goHome,` to `pickProject: pickProjectRaw, goHome: goHomeRaw,` and right after the destructure's closing line (`} = useDirectory({...});`) add:
   ```jsx
   // Picking a record from the rail or browser shows it — even the one already
   // open underneath an app or Settings pane.
   const pickProject = (id) => { railDispatch({ type: "closePane" }); pickProjectRaw(id); };
   const goHome = () => { railDispatch({ type: "closePane" }); goHomeRaw(); };
   const railPick = (kind, id) => { railDispatch({ type: "pick", kind, id, inProgress: kind === "app" ? appsProgress.current(id) : false }); setSidebarOpen(false); };
   ```
6. Replace the `useLabels` destructure (lines 616–619) with
   ```jsx
   const {
     labels, refreshLabels, addLabel, addLabelsBulk, updateLabel, delLabel, saveLabelPreset,
   } = useLabels({ user, profile, ping, flashSaved, settings, setSettings });
   ```
   and delete the `appsStart` state, its comment, and `openAppsTo` (lines 620–623). Then add:
   ```jsx
   useEffect(() => {
     if (railNav.pane?.kind === "app" && railNav.pane.id === "labels") refreshLabels();
     // eslint-disable-next-line react-hooks/exhaustive-deps -- load on each Label Generator open
   }, [railNav.pane?.kind, railNav.pane?.id]);
   // A different project (or customer view, or home) is a "break": the next
   // in-progress configurator asks Continue / Start new (spec 2026-09-24).
   const navKey = `${selId || ""}|${selCustId || ""}`;
   const lastNavKey = useRef(navKey);
   useEffect(() => {
     if (lastNavKey.current === navKey) return;
     lastNavKey.current = navKey;
     railDispatch({ type: "projectChanged" });
   }, [navKey]);
   ```
   This `navKey` effect must sit ABOVE the `ft-open-layer` restore effect, so that in a commit where both run, the restored pane is not closed.

- [ ] **Step 3: Refresh restore through `railnav`**

In the restore effect, replace

```jsx
    if (L.kind === "settings") { setSettingsSection(["profile", "general", "book", "materials", "backup"].includes(L.section) ? L.section : "materials"); setShowSettings(true); }
    else if (L.kind === "apps") setShowApps(true);
    else if (L.kind === "browser") setShowBrowser(true);
```

with

```jsx
    if (L.kind === "settings" || L.kind === "apps") railDispatch({ type: "restore", layer: L });
    else if (L.kind === "browser") setShowBrowser(true);
```

In the write effect replace

```jsx
          : showSettings ? { kind: "settings", section: settingsSection }
            : showApps ? { kind: "apps" }
              : showBrowser ? { kind: "browser" }
```

with

```jsx
          : layerOf(railNav) ? layerOf(railNav)
            : showBrowser ? { kind: "browser" }
```

and in its dependency array replace `showSettings, settingsSection, showApps` with `railNav`. Update the effect's leading comment: "Settings on its last section" → "the rail's open drawer and the app or Settings section in the work area".

- [ ] **Step 4: Esc**

Replace

```jsx
  useEscClose(showSettings, () => setShowSettings(false));
  useEscClose(showApps, () => setShowApps(false));
```

with

```jsx
  useEscClose(!!railNav.pane, () => railDispatch({ type: "closePane" }));
```

- [ ] **Step 5: The rail — gear, Settings drawer, shortcuts, Apps tray, Apps button**

Gear (line ~1406): replace the Settings `<button …><Settings size={16} /></button>` with

```jsx
              <button onClick={() => railDispatch({ type: "toggleDrawer", which: "settings" })} aria-label="Settings" aria-expanded={railNav.drawer === "settings"} title="Settings"
                className={`p-1 rounded-md ${railNav.drawer === "settings" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}>
                <Settings size={16} className={`transition-transform duration-500 ${railNav.drawer === "settings" ? "rotate-[60deg]" : ""}`} />
              </button>
```

Directly after the logo block's closing `</div>` (the `relative px-4 py-3.5 border-b border-slate-100` div) insert:

```jsx
          <RailSlide open={railNav.drawer === "settings"} anchor="bottom">
            <DrawerList title="Settings" items={SETTINGS_ITEMS} activeId={railNav.pane?.kind === "settings" ? railNav.pane.id : null}
              onPick={(id) => railPick("settings", id)} itemClass={railItem} className="px-2.5 pt-2.5 pb-2.5" divider />
          </RailSlide>
```

Shortcuts (lines ~1430–1431): `onClick={() => openAppsTo("wedi")}` → `onClick={() => railPick("app", "wedi")}` and `onClick={() => openAppsTo("sheoga")}` → `onClick={() => railPick("app", "sheoga")}`. Update their comment to: `{/* Configurator shortcuts (owner kept them, 2026-09-24): open the app in the work area and slide the Apps tray up with it highlighted. */}`

Directly before the bottom bar (`<div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">`) insert:

```jsx
          <RailSlide open={railNav.drawer === "apps"} anchor="top">
            <DrawerList title="Apps" items={APP_ITEMS} activeId={railNav.pane?.kind === "app" ? railNav.pane.id : null}
              onPick={(id) => railPick("app", id)} itemClass={railItem} className="px-2.5 pt-1 pb-1.5" />
          </RailSlide>
```

Apps button (line ~1463): replace it with

```jsx
            <button onClick={() => railDispatch({ type: "toggleDrawer", which: "apps" })} aria-label="Apps" aria-expanded={railNav.drawer === "apps"} title="Apps — shop tools"
              className={`flex items-center justify-center rounded-md p-1.5 ${railNav.drawer === "apps" ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-500"}`}><LayoutGrid size={16} /></button>
```

- [ ] **Step 6: The pane layer over `<main>`**

Replace `<main ref={mainRef} style={zoomStyle} className="flex-1 overflow-y-auto">` with

```jsx
        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
        <main ref={mainRef} style={{ ...zoomStyle, visibility: railNav.pane ? "hidden" : undefined }} className="flex-1 overflow-y-auto">
```

Replace the `</main>` at line ~2590 with the pane layer plus the wrapper's close:

```jsx
        </main>
        {/* Apps + Settings open here, over the still-mounted project (spec
            2026-09-24). AppsWorkspace stays mounted after its first pick so a
            configurator build survives a trip away. */}
        <div className={railNav.pane ? "absolute inset-0 z-20 flex flex-col bg-white" : "hidden"} style={zoomStyle}>
          {railNav.pane && (
            <PaneHeader
              backLabel={sel ? (sel.name || "Untitled project") : selCust ? (selCust.name || "Customer") : "Home"}
              group={railNav.pane.kind === "app" ? "Apps" : "Settings"}
              title={(railNav.pane.kind === "app" ? APP_ITEMS : SETTINGS_ITEMS).find((x) => x.id === railNav.pane.id)?.label || ""}
              onBack={() => railDispatch({ type: "closePane" })}
              onClose={() => railDispatch({ type: "closePane" })} />
          )}
          {railNav.pane?.kind === "settings" && (
            <div className="flex-1 min-h-0">
              <LazyBoundary>
              <Suspense fallback={null}>
              <SettingsWorkspace key={railNav.pane.id} section={railNav.pane.id}
                settings={settings} setSettings={setSettings} gFamilies={gFamilies} ping={ping}
                exportBackup={exportBackup} importBackup={importBackup} fileRef={fileRef}
                inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} theme={theme} setTheme={setTheme} headerLayout={headerLayout} setHeaderLayout={setHeaderLayout}
                profile={profile} saveProfile={saveProfile} user={user}
                books={books} addBook={addBook} updateBook={updateBook} confirmBook={confirmBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImportSynced}
                bookStock={bookStock} orderBookStock={orderBookStock} loadFamilyBook={loadFamilyBook} bookStockReady={bookStockReady} refreshBookStock={refreshBookStock}
                loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} reviewBookItemFlags={reviewBookItemFlags} setBookItemIssue={setBookItemIssue} addClaudeIssue={addClaudeIssue} />
              </Suspense>
              </LazyBoundary>
            </div>
          )}
          {railNav.lastApp && (
            <div className={railNav.pane?.kind === "app" ? "flex-1 min-h-0 flex flex-col" : "hidden"}>
              <LazyBoundary>
              <Suspense fallback={null}>
              <AppsWorkspace
                app={railNav.lastApp}
                onClose={() => railDispatch({ type: "closePane" })}
                resume={railNav.pane?.kind === "app" && !!railNav.pane.resume}
                onResume={() => railDispatch({ type: "resolveResume" })}
                progressRef={appsProgress}
                ...every other prop exactly as the old mount passed it (stock, labels, presets, label handlers, the sheoga / wedi / schluter bags)...
              />
              </Suspense>
              </LazyBoundary>
            </div>
          )}
        </div>
        </div>
```

When moving the old `<AppsWorkspace …>` props, drop `onClose={() => setShowApps(false)}` and `initialApp={appsStart}`, and in all six `addToCurrent` / `addToNew` callbacks replace `setShowApps(false);` with `railDispatch({ type: "closePane" });`.

Delete the old overlay mounts: the whole `{showSettings && ( … )}` block (with its "Settings — PC-first workspace" comment) and the whole `{showApps && ( … )}` block (lines ~2716–2784).

Mobile add bar (~line 2603): change `{!isWide && sel && sel._full && (() => {` to `{!isWide && !railNav.pane && sel && sel._full && (() => {`.

- [ ] **Step 7: Sweep for leftovers**

Run: `grep -n "showSettings\|setShowSettings\|settingsSection\|showApps\|setShowApps\|openApps\|appsStart" src/App.jsx src/uselabels.js`
Expected: no output. Fix any hit the same way as above.

- [ ] **Step 8: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all clean. A lint error for an unused import (e.g. an icon only the old gear used) → delete that import and rerun.

- [ ] **Step 9: Reshoot the harness**

Repeat Task 4 Step 4 (dev server, `shots.cjs`, read all seven PNGs) to confirm the workspaces still behave after the App wiring touched shared files. The harness can't exercise `App.jsx`'s own wiring — the live app needs a login and live data, which the Global Constraints forbid — so re-read the Step 2–6 diff adversarially instead: every `pickProject`/`goHome` call in `App.jsx` now closes the pane; `navKey` sits above the restore effect; the pane layer and mobile bar guards are in place.

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx src/uselabels.js .scratch/154_rail-drawers/proof
git commit -m "Wire rail drawers into App: Apps tray, Settings drawer, work-area pane

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0159UwJSC63cCsUMcGVerBY2"
```

---

### Task 6: Records — ADR, ADR 0028 amendment, file notes, issue

**Files:**
- Create: `docs/adr/0047-rail-drawers.md`
- Modify: `docs/adr/0028-open-layer-restore-and-one-press-escape.md`, `docs/adr/README.md`, `src/CLAUDE.md`, `docs/superpowers/specs/2026-09-24-rail-drawers-design.md`
- Create: `.scratch/154_rail-drawers/issue.md`

- [ ] **Step 1: Write ADR 0047**

Create `docs/adr/0047-rail-drawers.md`:

```markdown
# ADR 0047 — Apps and Settings open in the work area from rail drawers

- **Status:** Accepted
- **Date:** 2026-09-24
- **Scope:** system-wide (navigation shell)
- **Related:** amends [ADR 0028](0028-open-layer-restore-and-one-press-escape.md) §3;
  spec `docs/superpowers/specs/2026-09-24-rail-drawers-design.md`

## Context

The Apps hub and Settings were full-window pop-ups with their own left menus.
Apps always mounted the Label Generator first; Settings always landed on
Materials & add-ons; both hid the project, and closing the hub discarded any
staged configurator build.

## Decision

1. The Apps button slides an Apps tray up out of the rail's bottom bar; the
   gear slides a Settings drawer down from under the logo. One drawer at a
   time; one ~1.3 s height slide per panel, content pinned to the panel edge
   it emerges from; no per-row animation.
2. Nothing loads until an item is picked. The pick fills the work area over
   the still-mounted project (X / back link / Esc return to it).
3. Configurators stay mounted after their first pick. Returning to one that is
   in progress after a *break* — the Apps tray closing (its button or opening
   Settings) or the open project changing — asks **Continue build / Start
   new**. Hopping between apps with the tray open never asks.
4. The rail's wedi / Sheoga shortcuts stay and open the tray as well.

Options weighed (prototype, owner 2026-09-24): tray + app fills the work area
(chosen); tray + app as a pop-up over the dimmed project (narrower, squeezes
Sheoga's grid); a start-menu pop-out (switching apps costs two clicks).

## Consequences

- Navigation state lives in `src/railnav.js` (pure, tested); `ft-open-layer`
  stores `{ kind: "apps", app }` / `{ kind: "settings", section }` or the
  bare open drawer, and still reads the older shapes.
- A build is never tied to a project: Add lands it on whichever project is
  open, so starting a build and then opening the right customer is how a build
  changes customer.
- Slide speed is one constant (`RAIL_SLIDE_MS`) to tune after use.
```

- [ ] **Step 2: Amend ADR 0028 and the index**

In ADR 0028 §3, after the sentence ending "Manual opens are unchanged (Settings still opens on its default section); only the refresh path reads the key.", append:

```markdown
   *Amended 2026-09-24 ([ADR 0047](0047-rail-drawers.md)):* Settings and
   Apps now open from rail drawers into the work area; the gear opens the
   section list and waits — there is no default section. The stored layer is
   `{ kind: "apps", app }` / `{ kind: "settings", section }` or the bare open
   drawer; the older `{ kind: "apps" }` still restores (the tray, nothing
   picked).
```

In `docs/adr/README.md` add after the 0046 row:

```markdown
| [0047](0047-rail-drawers.md) | Apps rise from the rail's bottom bar and Settings drops from under the logo; picks fill the work area over the still-mounted project; an in-progress configurator asks Continue / Start new only after the tray closed or the project changed | Accepted | 2026-09-24 |
```

- [ ] **Step 3: `src/CLAUDE.md` file notes**

Replace the `AppsWorkspace.jsx` entry's first line "the Apps hub overlay (SettingsWorkspace-style shell) +" with "the Apps work-area pane (ADR 0047: no shell or app list of its own — the rail's Apps tray picks; configurators stay mounted after first pick, track in-progress, show the Continue / Start new prompt) +", keeping the rest of the entry. Find the `SettingsWorkspace.jsx` entry (`grep -n "SettingsWorkspace.jsx" src/CLAUDE.md`) and add to it: "Renders in the work-area pane with a controlled `section` (ADR 0047) — no overlay shell or section menu; mounted with `key={section}`." Add new entries beside `labels.js` / `AppsWorkspace.jsx`:

```
  railnav.js        # rail drawers + work-area pane state (ADR 0047): pure
                    # reducer (toggleDrawer / pick / resolveResume /
                    # closePane / projectChanged / restore), the "break"
                    # flags behind Continue / Start new, and the
                    # ft-open-layer mapping (layerOf / stateFromLayer,
                    # reads pre-0047 shapes)
  raildrawer.jsx    # RailSlide (the one ~1.3 s height slide, content pinned
                    # top or bottom), DrawerList, APP_ITEMS / SETTINGS_ITEMS,
                    # PaneHeader ("← project › Apps › Sheoga" + X)
  railpreview.jsx   # dev-only harness (rail-preview.html): the REAL drawers,
                    # reducer, pane header and workspaces over mock state —
                    # preview proof for ADR 0047
```

In the `uselabels.js` entry, change "Apps hub label-set state" to "Label Generator label-set state (loaded when the Label Generator opens)".

- [ ] **Step 4: Spec status and the dock-grid line**

In the spec: set `**Status:** implemented`; in "Changed: `src/AppsWorkspace.jsx`" replace the bullet "The Sheoga docked-grid breakpoint (`hubQuery`) is recomputed for the 205px app rail (`RAIL_W`) instead of the hub's 224px list." with "`hubQuery` / `wideHub` are removed: the Sheoga docked grid already measures its own frame (`useDockGrid`'s `ResizeObserver`), so the pane's width is accounted for automatically."

- [ ] **Step 5: Issue file**

Create `.scratch/154_rail-drawers/issue.md`:

```markdown
# 154 — Rail drawers: Apps rise from the bar, Settings drops from the logo

Status: done
Labels: ready-for-agent

Spec: docs/superpowers/specs/2026-09-24-rail-drawers-design.md
Plan: docs/superpowers/plans/2026-09-24-rail-drawers.md
ADR: docs/adr/0047-rail-drawers.md
Proof: proof/*.png (rail-preview.html harness)
```

- [ ] **Step 6: Verify and commit**

Run: `npm run lint && npm test && npm run build`
Expected: clean.

```bash
git add docs/adr/0047-rail-drawers.md docs/adr/0028-open-layer-restore-and-one-press-escape.md docs/adr/README.md src/CLAUDE.md docs/superpowers/specs/2026-09-24-rail-drawers-design.md .scratch/154_rail-drawers/issue.md
git commit -m "Record ADR 0047 (rail drawers), amend ADR 0028, annotate new files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0159UwJSC63cCsUMcGVerBY2"
```

---

### Task 7: Final verification and hand-off

- [ ] **Step 1: Full check from clean**

Run: `npm test && npm run lint && npm run build`
Expected: `# fail 0`, no lint errors, build succeeds. Paste the tail of each into the hand-off.

- [ ] **Step 2: Adversarial diff read**

Run: `git diff origin/main...HEAD --stat` and `git diff origin/main...HEAD -- src/App.jsx`. Check specifically:
- No `supabase/*.sql` or persisted-shape change is in the diff.
- `showApps` / `showSettings` are gone everywhere (`grep -rn "showApps\|showSettings" src/`).
- The row-opened configurator pop-ups (`sheogaPop` / `wediPop` / `schluterPop`) are untouched.
- The Customer browser and Issues overlays are untouched.

- [ ] **Step 3: Push and report**

Push: `git push -u origin claude/funny-dijkstra-kg5fdf` (on a network failure, retry up to four times, backing off 2 s, 4 s, 8 s, 16 s).

Then report to the owner with the seven proof screenshots (send them with SendUserFile). Ask whether to open the PR. Per CLAUDE.md every change lands through a PR, but the session rules say to open one only when the owner asks. Nothing merges until the owner has seen the proof.
