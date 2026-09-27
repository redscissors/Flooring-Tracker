# ⇄ on Every Line (Phase 1b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every bill line with a real alternative gets a ⇄ in both shower
configurators. The saved choice is always a choice, never the resolved part:
- **Schluter:** KERDI membrane and KERDI-BAND (stepped popovers), board
  fasteners and bench boards (list popovers).
- **wedi:** curb and wall panel (stepped popovers), fastener kit (list popover).

wedi also stops writing the resolved `curbKey` / default `panelKey` into its
marker, so a saved default curb re-fits when the opening grows.

**Architecture:**
- **One engine rule per stepped line.** The popover asks the engine instead of
  duplicating rules (1a's `resolveDrain` / `drainOptions` pattern).
  - Schluter: `resolveMembrane` / `membraneOptions`, `resolveBand` /
    `bandOptions`.
  - wedi: `resolveCurb` / `curbOptions`, `panelOptions`.
  - `buildKit` / `kitFor` call the resolvers.
- **One popover component.** 1a's `DrainSwapPop` becomes the generic `SwapPop`
  in `src/swappop.jsx`, which also owns the Δ formatter.
- **Old wedi markers translate on read** (`legacyCurbPick`, `curbPickOf`), and
  a golden captured from the pre-1b code proves no old bill moves.

**Tech Stack:** React 18 (hooks), Vite 5, Tailwind, plain `node --test`
(`npm test` = `node --test src/*.test.js`), ESLint (`npm run lint`), Playwright
for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-26-swap-every-line-design.md`. Read it
first. It builds on 1a
(`docs/superpowers/specs/2026-09-26-drain-slot-design.md`, including its
Amendments section, and ADR 0049,
`docs/adr/0049-configurator-swaps-remember-the-choice.md`). The ticket is
`.scratch/158_shower-config-roadmap/ticket.md` (Phase 1).

## Global Constraints

- **Unchanged defaults.** No new pick means the exact bill of today, both
  brands. Every existing pinned bill and test passes untouched. Run the whole
  suite (`npm test`) after every task; it must end `# fail 0`.
- **Choice, not part (ADR 0049).** A choice is written only when someone swaps.
  Wherever the room can change the answer, it records the choice, never the
  resolved part:
  - Schluter: `cfg.swaps.membrane = { wide, roll? }`,
    `cfg.swaps.band = { width, roll? }`, `cfg.swaps.fastener = "<sku>"`,
    `cfg.benches[i].board = "<sku>"`, `cfg.benches[i].part = "<sku>"`.
  - wedi: `cfg.curbPick = { sub, len?, profile? } | { none: true }`;
    `cfg.panelKey` and `cfg.fastenerKey` are written only when picked;
    `cfg.curbKey` is no longer written.
- **Nothing silently dropped.**
  - A choice the books can't honour falls back and says why, in `subst` or on
    the line's note.
  - An old marker's saved part reopens to the same bill (the Task 1 golden).
- **Stock only.** The `stockPool` / `pickFrom` rule: a stocked match wins, and
  otherwise the special-order match lands flagged `so`. In the popovers:
  - stocked chips come first;
  - a special-order chip carries the SO dot;
  - a popover is never empty.
- **⇄ shows only when the line has more than one valid part.**
- **Stepped popovers** hold a draft. Chips edit the draft; the summary shows
  what lands, why, the Δ against the committed line at the tier price, and the
  new total; **Use this** commits; Esc or an outside click discards. **List
  popovers** stay one click and apply at once.
- **Comments:** be conservative (root `CLAUDE.md` "Code Comments"). Explain only
  non-obvious business rules.
- **Branch and deploy rules.**
  - Never push to `main`.
  - Never touch the live Supabase project (no SQL, no data writes).
  - UI changes need preview screenshots, taken with the Playwright scripts under
    `.scratch/158_shower-config-roadmap/p1b/`.
- **Build locally** with placeholder env:
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
- **Commit trailer:** end every commit message with the session's attribution
  lines. The harness supplies them.
- **Preview server** for every shoot step: start it with
  `npx vite --port 5199 --strictPort` (in the background, from the repo root)
  and stop it afterwards. The scripts drive the harnesses:
  - `http://localhost:5199/schluter-preview.html`
  - `http://localhost:5199/wedi-preview.html`
  - They use Playwright via
    `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`,
    `executablePath: "/opt/pw-browsers/chromium"`.
  - The **Stock only** toggle is `[data-source-toggle]`. The harness opens on
    Stock only; one click switches to Full catalog.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs` | create (T1) | One-shot capture of what every old wedi marker shape bills on the pre-1b code |
| `src/wedimarkergolden.js` | create (T1, generated) | The golden: base bills, curb lines, panel bills |
| `src/wedimarkergolden.test.js` | create (T1) | Every old marker reopens through `buildFromMarker` to its golden bill |
| `src/swappop.jsx` | create (T2), grows (T3, T8) | `SwapPop`, `fmDelta`, `inchGlyph`, SO dot, stock-first order |
| `src/drainswap.jsx` | delete (T2) | Replaced by `swappop.jsx` |
| `src/schluter.js` | modify (T3, T4, T5) | `pointGrateLabel`; roll/width codes; membrane/band resolvers and options; fastener and bench picks; `need` on the build |
| `src/wedi.js` | modify (T3, T6, T7) | `coverPickApplies`; curb choice (`resolveCurb`, `legacyCurbPick`, `curbOptions`, `curbPickOf`, `markerCurbKey`); `panelOptions`, `panelSheets`, `fastenerKits`, `fastenerKey` |
| `src/showersf.js` | modify (T6) | Tile sf reads the curb a marker bills through `markerCurbKey` |
| `src/SchluterConfigurator.jsx` | modify (T2, T3, T8) | `SwapPop`; chip labels, inert `drainPick`; membrane/band popover, fastener/bench list swaps, ⇄ gating |
| `src/WediConfigurator.jsx` | modify (T2, T3, T9) | `SwapPop`; inert cover pick; curb/panel popovers, fastener list swap, ⇄ gating, `curbPick` plumbing |
| `src/schluterpreview.jsx` | modify (T8) | A 7¼″ KERDI-BAND row so the band popover has a Width row |
| `src/schluter.test.js`, `src/wedi.test.js`, `src/showersf.test.js` | modify | Engine tests |
| `.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs`, `shoot-wedi.mjs` | create (T8, T9) | Preview proof |
| `docs/adr/0049-…md`, `docs/superpowers/specs/2026-09-26-swap-every-line-design.md`, `src/CLAUDE.md`, `.scratch/158_shower-config-roadmap/ticket.md` | modify (T10) | Records |

Task order matters in two places:
- **Task 1 must run before any `wedi.js` change.** Its golden is the pre-1b
  behaviour.
- **Tasks 4–7 (engines) come before Tasks 8–9 (popups).** The popups call the
  engines.

---

### Task 1: Golden of every old wedi marker, captured from the pre-1b code

**Files:**
- Create: `.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`
- Create (generated): `src/wedimarkergolden.js`
- Create: `src/wedimarkergolden.test.js`

**Interfaces:**
- Consumes: `group`, `kitFor`, `buildFromMarker`, `panRoomDims`, `SKU`
  (existing, `wedi.js`).
- Produces: `src/wedimarkergolden.js` exporting `BASE`, `CURBS`, `PANELS`:
  - `BASE`: `{ "<pan>|<widen>": "<key>x<qty> …" }`, the non-curb lines.
  - `CURBS`: `[pan, widen, arg, savedCurbKey, curbLines][]`. There are 840
    rows: 42 pans and modules × 10 curb args × 2 openings. The curb args are
    the recipe default ("default", nothing passed), `null`, and the 8 curb keys.
  - `PANELS`: `[panelKey, savedPanelKey, wholeBill][]`, 17 rows.

  Tasks 6 and 7 must keep `src/wedimarkergolden.test.js` green untouched.

**This task changes no behaviour.** It is a characterization test: it passes the
moment it is written. Run it **before** touching `src/wedi.js`. The spec
("Old wedi markers, exhaustively") requires every bill to match what the pre-1b
code gives.

- [ ] **Step 1: Write the generator**

`.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`:
```js
// Captures what every OLD wedi marker shape bills today (ticket 158 Phase 1b):
// every pan and module × every curb key (plus none and the recipe default) ×
// the pan's own room and one widened 24" along the open edge, and every panel
// key on the 36×60 pan. Run ONCE against the pre-1b wedi.js; the output is the
// golden src/wedimarkergolden.test.js compares 1b's buildFromMarker against.
//   node .scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs
import { writeFileSync } from "node:fs";
import { group, kitFor, buildFromMarker, panRoomDims } from "../../../src/wedi.js";

const bill = (b, keep) => b.lines.filter(keep).map((l) => l.item.key + "x" + l.qty).join(" ");
const isCurb = (l) => l.item.group === "curb";
const pans = [...group("pan"), ...group("module")].map((p) => p.key);
const curbArgs = [undefined, null, ...group("curb").map((c) => c.key)];
const base = {}, curbs = [];
for (const pan of pans) {
  const own = panRoomDims(group("pan").concat(group("module")).find((p) => p.key === pan));
  for (const widen of [0, 24]) {
    const room = { w: own.w + widen, d: own.d };
    for (const arg of curbArgs) {
      const old = kitFor(pan, { room, ...(arg === undefined ? {} : { curbKey: arg }) });
      const back = buildFromMarker({ mode: "kit", cfg: old.cfg });
      const rest = bill(back, (l) => !isCurb(l));
      const k = pan + "|" + widen;
      if (base[k] === undefined) base[k] = rest;
      else if (base[k] !== rest) throw new Error("non-curb lines moved with the curb: " + k + " " + arg);
      curbs.push([pan, widen, arg === undefined ? "default" : arg, old.cfg.curbKey, bill(back, isCurb)]);
    }
  }
}
const panels = group("panel").map((p) => {
  const old = kitFor("US9100004", { room: { w: 60, d: 36 }, panelKey: p.key });
  return [p.key, old.cfg.panelKey, bill(buildFromMarker({ mode: "kit", cfg: old.cfg }), () => true)];
});
const out = `// GENERATED by .scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs
// from the pre-1b wedi.js (ticket 158 Phase 1b) — what each old wedi marker
// shape billed before curbPick/panelKey changed how markers are written.
// Never hand-edit; a bill that moves is a test failure, not a re-pin.
// base: "<pan>|<widen>" → the non-curb lines, "<key>x<qty>" space-joined.
// curbs: [pan, widen, curb arg ("default" = none passed), saved cfg.curbKey, curb lines].
// panels: [panel key, saved cfg.panelKey, whole bill] on US9100004 in its own 60×36 room.
export const BASE = ${JSON.stringify(base, null, 0).replace(/","/g, '",\n  "')};
export const CURBS = [
${curbs.map((c) => "  " + JSON.stringify(c)).join(",\n")},
];
export const PANELS = [
${panels.map((c) => "  " + JSON.stringify(c)).join(",\n")},
];
`;
writeFileSync(new URL("../../../src/wedimarkergolden.js", import.meta.url), out);
console.log("cases:", curbs.length, "panels:", panels.length, "bytes:", out.length);
```

- [ ] **Step 2: Run it against the untouched code**

Run: `git diff --quiet src/wedi.js && node .scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`

Expected: `cases: 840 panels: 17 bytes: …` (about 60 KB). Spot-check two
rows in `src/wedimarkergolden.js`:
- `["US9100004",24,"US3000038","US3000038","US3000038x2"]`: a 60″ lean curb
  pinned on an 84″ opening doubles.
- The first `PANELS` row:
  `["US8000017","US8000017","US9100004x1 US8000017x5 US3000038x1 US1000057x1 US5000070x1 US5000010x5 US5000000x1 US5000033x1 US5000044x1 US5076012x1"]`.

- [ ] **Step 3: Write the golden test**

`src/wedimarkergolden.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { group, kitFor, buildFromMarker, panRoomDims, SKU } from "./wedi.js";
import { BASE, CURBS, PANELS } from "./wedimarkergolden.js";

// Every old wedi marker shape — resolved curbKey and panelKey always written —
// must reopen to the bill the pre-1b code gave it (ticket 158 Phase 1b spec,
// "Old wedi markers, exhaustively"). The golden was captured from that code;
// the marker is rebuilt here as it was saved: today's cfg for the same room
// plus the two resolved keys the old kitFor always wrote.
const bill = (b, keep) => b.lines.filter(keep).map((l) => l.item.key + "x" + l.qty).join(" ");
const isCurb = (l) => l.item.group === "curb";
const roomOf = (pan, widen) => {
  const own = panRoomDims([...group("pan"), ...group("module")].find((p) => p.key === pan));
  return { w: own.w + widen, d: own.d };
};

test("every old curb marker (each pan × curb key, none, the recipe default × own and widened opening) reopens to its pre-1b bill", () => {
  assert.equal(CURBS.length, 840);
  for (const [pan, widen, arg, saved, curbLines] of CURBS) {
    const cfg = { ...kitFor(pan, { room: roomOf(pan, widen) }).cfg, curbKey: saved, panelKey: SKU.panelDefault };
    const back = buildFromMarker({ mode: "kit", cfg });
    const at = `${pan} +${widen}" ${arg}`;
    assert.equal(bill(back, isCurb), curbLines, at);
    assert.equal(bill(back, (l) => !isCurb(l)), BASE[pan + "|" + widen], at);
  }
});

test("every old panel marker reopens to its pre-1b bill", () => {
  assert.equal(PANELS.length, group("panel").length);
  for (const [, saved, whole] of PANELS) {
    const cfg = { ...kitFor("US9100004", { room: { w: 60, d: 36 } }).cfg, curbKey: SKU.curbLean60, panelKey: saved };
    assert.equal(bill(buildFromMarker({ mode: "kit", cfg }), () => true), whole, saved);
  }
});
```

- [ ] **Step 4: Run the test and the suite**

Run: `node --test src/wedimarkergolden.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 2`, `# fail 0`.

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/wedimarkergolden.js src/wedimarkergolden.test.js
git add .scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs src/wedimarkergolden.js src/wedimarkergolden.test.js
git commit -m "Golden of every old wedi marker's bill, captured before 1b changes the marker (ticket 158 Phase 1b)"
```

---

### Task 2: `DrainSwapPop` → `SwapPop` in `swappop.jsx`, with the shared Δ formatter

**Files:**
- Create: `src/swappop.jsx`
- Delete: `src/drainswap.jsx`
- Modify: `src/SchluterConfigurator.jsx`:
  - the `./drainswap.jsx` import
  - `summaryOf` inside `drainPanel`
  - both `<DrainSwapPop` mounts
- Modify: `src/WediConfigurator.jsx`:
  - the `./drainswap.jsx` import
  - `coverPanel`'s summary `delta`
  - its `<DrainSwapPop` mount

**Interfaces:**
- Produces:
  - `SwapPop(props)`: same props as `DrainSwapPop`
    (`{ at, className, title, rows, summary, onUse, onClose }`).
  - `fmDelta(d: number) → string`: `"+$12.30"`, `"−$4.00"`, or `"±0"`.
- **Decision:** the DOM keeps its 1a attributes (`data-drain-swap`,
  `data-drain-chip="<Row>:<key>"`, `data-drain-use`), so the p1a proof scripts
  keep passing unchanged. The p1b scripts use the same selectors.

**Pure refactor. No behaviour change.**

- [ ] **Step 1: Create `src/swappop.jsx`**

```jsx
// The stepped swap popover (ticket 158 Phase 1, mockup layout A): rows of
// chips and a summary strip. Both shower popups mount it for the drain and
// every stepped line; each owns what a chip means and what Use this commits.
import { PopMenu } from "./widgets.jsx";

const money = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The summary strip's change against the committed line: "+$12.30", "−$4.00", "±0". */
export const fmDelta = (d) => (d > 0 ? "+" : d < 0 ? "−" : "±") + (d ? money(Math.abs(d)) : "0");

export function SwapPop({ at, className = "", title, rows, summary, onUse, onClose }) {
  return (
    <PopMenu at={at} width={460} pad={10} z={90} onClose={onClose}>
      <div className={className + " text-[12px] px-2.5 py-2"} onClick={(e) => e.stopPropagation()} data-drain-swap>
        <div className="font-extrabold text-[13px] mb-2">{title}</div>
        {rows.filter((r) => r.chips.length).map((r) => (
          <div key={r.label} className="flex items-center gap-2 my-1.5 flex-wrap">
            <span className="w-[64px] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{r.label}</span>
            {r.chips.map((c) => (
              <button key={c.key} type="button" title={c.title || ""} disabled={!c.ok}
                onClick={() => c.ok && c.onPick()}
                className={"rounded-full px-2.5 py-0.5 font-bold border "
                  + (c.on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white"
                    : c.ok ? "border-slate-400 bg-white" : "border-dashed border-slate-300 text-slate-400 cursor-not-allowed")}
                data-drain-chip={r.label + ":" + c.key}>
                {c.label}
              </button>
            ))}
          </div>
        ))}
        <div className="mt-2 rounded-lg border border-slate-200 bg-[color:var(--ft-tint)] px-2.5 py-2 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <b>{summary.what}</b>
            <span className="block text-[11px] text-slate-500 font-semibold">{summary.why}</span>
          </div>
          <span className={"font-extrabold tabular-nums " + (summary.up ? "text-[color:var(--s-rust,#B4552D)]" : "")}>{summary.delta} · {summary.total}</span>
          <button type="button" onClick={onUse} className="rounded-md bg-[color:var(--ft-brand)] text-white font-extrabold px-3 py-1" data-drain-use>Use this</button>
        </div>
      </div>
    </PopMenu>
  );
}
```
Then `git rm src/drainswap.jsx`.

- [ ] **Step 2: Point both popups at it**

In `src/SchluterConfigurator.jsx`:
- Replace `import { DrainSwapPop } from "./drainswap.jsx";` with
  `import { SwapPop, fmDelta } from "./swappop.jsx";`.
- In `drainPanel`'s `summaryOf`, replace
  `      return { what, why, delta: (d > 0 ? "+" : d < 0 ? "−" : "±") + (d ? fm(Math.abs(d)) : "0"), total: fm(next), up: d > 0 };`
  with
  `      return { what, why, delta: fmDelta(d), total: fm(next), up: d > 0 };`.
- Replace both `<DrainSwapPop ` with `<SwapPop `.

In `src/WediConfigurator.jsx`:
- Replace `import { DrainSwapPop } from "./drainswap.jsx";` with
  `import { SwapPop, fmDelta } from "./swappop.jsx";`.
- In `coverPanel`'s summary, replace
  `          delta: (d > 0 ? "+" : d < 0 ? "−" : "±") + (d ? fm(Math.abs(d)) : "0"), total: fm(tierOf(draft)), up: d > 0,`
  with
  `          delta: fmDelta(d), total: fm(tierOf(draft)), up: d > 0,`.
- Replace the one `<DrainSwapPop ` with `<SwapPop `.

Check nothing still names the old module:
`grep -rn "drainswap\|DrainSwapPop" src --include=*.js --include=*.jsx`
Expected: no output. `src/CLAUDE.md` still mentions it; Task 10 updates that.

- [ ] **Step 3: Lint, suite, build**

```bash
npx eslint src/swappop.jsx src/SchluterConfigurator.jsx src/WediConfigurator.jsx
npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build 2>&1 | grep -E "built in|rror"
```
Expected:
- lint is clean;
- the suite ends `# fail 0`;
- the build prints `✓ built in`. The pre-existing `css-syntax-error` warning is
  not an error.

- [ ] **Step 4: The 1a preview proof still passes**

```bash
npx vite --port 5199 --strictPort &
node .scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs; echo "exit $?"
node .scratch/158_shower-config-roadmap/p1a/shoot-wedi.mjs; echo "exit $?"
```
Expected:
- Both scripts print `exit 0` with no `PAGEERROR`.
- The logs read as before, e.g. `fixed: … +$496.71 · $1,003.31 | Use this`.
- Read `s2-fixed-52.png` and `w2-perforated-draft.png` to confirm the popover
  renders.

Then restore 1a's committed shots, so this refactor adds no image churn:
`git checkout -- .scratch/158_shower-config-roadmap/p1a/`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/swappop.jsx src/SchluterConfigurator.jsx src/WediConfigurator.jsx
git commit -m "SwapPop: the shared stepped popover (was DrainSwapPop) owns the Δ formatter (ticket 158 Phase 1b)"
```
`git rm` already staged the deletion.

---

### Task 3: 1a carry-overs — chip labels, SO dot, inert picks, missing engine tests (spec §5)

**Files:**
- Modify: `src/swappop.jsx` (`inchGlyph`, SO dot)
- Modify: `src/schluter.js` (`pointGrateLabel`, above `export function buildKit`)
- Modify: `src/SchluterConfigurator.jsx`:
  - imports
  - `mode`
  - `kitDirty`
  - point-grate chips
  - frame chips
  - the fixed drain's `what` text
- Modify: `src/wedi.js` (`coverPickApplies`, after `coverStyles`)
- Modify: `src/WediConfigurator.jsx` (imports, `kitDirty`)
- Test: `src/schluter.test.js`, `src/wedi.test.js`

**Interfaces:**
- Produces:
  - `inchGlyph(s: string) → string` (`swappop.jsx`): `'3/4"'` → `"¾″"`,
    `'1-1/8"'` → `"1⅛″"`, `'29/32"'` → `"29/32″"`.
  - A chip with `so: true` renders an SO dot (`data-so-dot`), and its title
    defaults to `"special order"`.
  - `pointGrateLabel(item) → string` (`schluter.js`).
  - `coverPickApplies(pick, panKey | pan) → boolean` (`wedi.js`).

- [ ] **Step 1: Write the failing tests**

Add `pointGrateLabel` to `src/schluter.test.js`'s import from `./schluter.js`.
The import line ends
`… normBench, benchTrayRoom, slotOf, resolveDrain, drainOptions } from "./schluter.js";`;
make it end `… resolveDrain, drainOptions, pointGrateLabel } from "./schluter.js";`.

Append to `src/schluter.test.js`:
```js

// --- 1a carry-overs (ticket 158 Phase 1b §5) ---------------------------------

test("resolveDrain at a 36″ pan: Vario cuts the 48″ channel, fixed steps to 20″, frameless falls back", () => {
  const v = resolveDrain(null, 36, KLCAT, { source: "all" });
  assert.deepEqual([v.family, v.len, skus(v)], ["vario", 48, ["KLVRID5EB122", "KLVR2FLK"]]);
  assert.match(v.lines[0].note, /^cut to 36"/);
  const f = resolveDrain({ family: "fixed", style: "solid" }, 36, KLCAT, { source: "all" });
  assert.deepEqual([f.family, f.len, f.gap, skus(f)], ["fixed", 20, 16, ["SLRKL1V60E50", "SLRKL1AR19EB50"]]);
  assert.equal(f.lines[0].note, 'stepped down from 24" — Solid made to 20"');
  for (const offset of [false, true]) {
    const fl = resolveDrain({ family: "frameless", offset }, 36, KLCAT, { source: "all" });
    assert.equal(fl.family, "vario");
    assert.equal(fl.fallback, "frameless can't be made here: no frameless grate matches a body length that fits");
  }
});

test("resolveDrain: a stocked grate beats a cheaper special-order one at the same length only under stock", () => {
  const cat = catalogOf([...FIXTURE_ITEMS, ...KL_ROWS, { sku: "KL1AR19EB130", name: "stocked twin", price: 500, cost: 333.33, stock: true }]);
  const c = { family: "fixed", style: "solid", finish: "EB" };
  assert.deepEqual(skus(resolveDrain(c, 55, cat, { source: "all" })), ["SLRKL1V60E130", "SLRKL1AR19EB130"]);
  const st = resolveDrain(c, 55, cat, { source: "stock" });
  assert.deepEqual(skus(st), ["SLRKL1V60E130", "KL1AR19EB130"]);
  assert.equal(st.lines[1].item.stock, true);
});

test("drainOptions: fit is 0 when no KERDI-LINE body fits, and no fixed style is ok", () => {
  const o = drainOptions({ family: "fixed" }, 18, KLCAT, { source: "all" });
  assert.equal(o.fit, 0);
  assert.ok(o.styles.length > 0 && o.styles.every((s) => !s.ok));
});

test("a drainPick on a point tray is inert: no drainFit, the bill of no pick", () => {
  const bill = (b) => b.lines.map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
  const plain = buildKit(cfg({}), KLCAT, { source: "all" });
  const inert = buildKit(cfg({ drainPick: { family: "fixed", style: "solid" } }), KLCAT, { source: "all" });
  assert.equal(inert.drainFit, null);
  assert.deepEqual(bill(inert), bill(plain));
});

test("pointGrateLabel reads size, design and finish, not the row's catalog words", () => {
  assert.equal(pointGrateLabel(by("KDIF4GRKEBD5")), "4″ floral, brushed");
  assert.equal(pointGrateLabel(by("KD4GRKE")), "4″ stainless");
  assert.equal(pointGrateLabel(by("KD4GRKECS")), "4″ tileable");
  assert.equal(pointGrateLabel({ name: 'Schluter Kerdi-Drain Grate Kit 4" Floral Brushed Ss' }), "4″ Floral, Brushed");
});
```
Every 1a test and fixture name used here already exists in the file:
`KLCAT`, `KL_ROWS`, `skus`, `cfg`, `by`, `catalogOf`, `FIXTURE_ITEMS`.

In `src/wedi.test.js`, add `coverPickApplies,` to the import. The import block
ends:
```js
  wediSlotOf,
} from "./wedi.js";
```
Make it end:
```js
  wediSlotOf, coverPickApplies,
} from "./wedi.js";
```

Tighten 1a's round trip to assert the SKU. In the test "an old marker's coverKey
reopens through buildFromMarker as the same cover", replace
```js
  assert.equal(back.lines.find((l) => l.item.group === "cover").item.finish, "MB");
```
with
```js
  assert.equal(back.lines.find((l) => l.item.group === "cover").item.key, "US1000083");
```

Append to `src/wedi.test.js`:
```js

// --- 1a carry-overs (ticket 158 Phase 1b §5) ---------------------------------

test("a point { key } cover pick lands through kitFor and rides the marker", () => {
  const k = kitFor("US9100004", { coverPick: { key: "US1000058" } });
  assert.equal(k.lines.find((l) => l.item.group === "cover").item.key, "US1000058");
  assert.deepEqual(k.cfg.coverPick, { key: "US1000058" });
});

test("the cover frame re-sizes with the cover: the same MB choice on a 43″ and a 27″ channel", () => {
  const drain = (pan) => kitFor(pan, { coverPick: { finish: "MB" }, coverFrame: "MB" }).lines
    .filter((l) => l.item.group === "cover" || l.item.group === "coverFrame").map((l) => [l.item.key, l.item.len]);
  assert.deepEqual(drain("US9310001"), [["US1000083", 43], ["US1000089", 43]]);
  assert.deepEqual(drain("US9310002"), [["US1000082", 27], ["US1000088", 27]]);
});

test("coverPickApplies: a point pick on a linear pan, or a finish on a point pan, is inert", () => {
  assert.equal(coverPickApplies({ finish: "MB" }, "US9310001"), true);
  assert.equal(coverPickApplies({ key: "US1000058" }, "US9310001"), false);
  assert.equal(coverPickApplies({ key: "US1000058" }, "US9100004"), true);
  assert.equal(coverPickApplies({ finish: "MB" }, "US9100004"), false);
  assert.equal(coverPickApplies({ finish: "MB" }, "US9320002"), true);
  assert.equal(coverPickApplies(undefined, "US9100004"), false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/schluter.test.js src/wedi.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`

Expected: FAIL. `pointGrateLabel` and `coverPickApplies` are not exported, so
both files fail to load.

The four drain tests pin today's behaviour and would pass on their own. They
are the "missing engine tests" the spec asks for, not new behaviour.

- [ ] **Step 3: Implement the engines**

`src/schluter.js`: add immediately above `export function buildKit(`:
```js
/** A point grate's chip label — size, design and finish ("4″ floral, brushed"), not the row's "kit 4" floral brushed SS". */
export function pointGrateLabel(e) {
  const s = String((e && e.name) || "").replace(/^schluter\s+(?:—\s*)?/i, "").replace(/^kerdi-drain\s+/i, "")
    .replace(/\b(grate|kit)\b/gi, "").replace(/\s+(brushed|polished)\s+(ss|stainless(\s+steel)?)\b/i, ", $1")
    .replace(/"/g, "″").replace(/\s{2,}/g, " ").trim();
  return s || (e && e.sku) || "";
}

```

`src/wedi.js`: add immediately after the `coverStyles` function (it ends
`  return out;\n}` just before the `// wedi's channel frame is a trim ring`
comment):
```js

/** Whether a saved coverPick bills on this pan — a point `{ key }` on a linear pan, or a `{ finish }` on a point pan, is kept but inert. */
export function coverPickApplies(pick, panKey) {
  const pan = typeof panKey === "string" ? item(panKey) : panKey;
  if (!pick || !pan) return false;
  return familyOf(pan) === "linear" ? !!pick.finish : !!pick.key;
}
```

- [ ] **Step 4: Run the engine tests**

Run: `node --test src/schluter.test.js src/wedi.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: `SwapPop` — `inchGlyph` and the SO dot**

In `src/swappop.jsx`, add after the `fmDelta` export:
```js

const GLYPH = { "1/8": "⅛", "1/4": "¼", "3/8": "⅜", "1/2": "½", "5/8": "⅝", "3/4": "¾", "7/8": "⅞" };
/** Inch text for a chip: '3/4"' → "¾″", '1-1/8"' → "1⅛″"; other fractions keep their digits. */
export const inchGlyph = (s) => String(s || "")
  .replace(/(?:(\d+)[-\s])?(\d+\/\d+)/g, (m, whole, f) => (GLYPH[f] ? (whole || "") + GLYPH[f] : m))
  .replace(/"/g, "″");
```
Replace the chip button's
`              <button key={c.key} type="button" title={c.title || ""} disabled={!c.ok}`
with
`              <button key={c.key} type="button" title={c.title || (c.so ? "special order" : "")} disabled={!c.ok}`.

Replace `                {c.label}` (inside that button) with:
```jsx
                {c.so && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle bg-[color:var(--s-rust,#B4552D)]" data-so-dot />}
                {c.label}
```

- [ ] **Step 6: Schluter popup — labels and the inert `drainPick`**

In `src/SchluterConfigurator.jsx`:
- **Imports.** In the `./schluter.js` import, replace
  `  resolveDrain, FINISH_LABEL, VARIO_DESIGN,` with
  `  resolveDrain, FINISH_LABEL, VARIO_DESIGN, pointGrateLabel,`. Replace
  `import { SwapPop, fmDelta } from "./swappop.jsx";` with
  `import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";`.
- **`mode`.** Replace
  `    && !(cfg.corners || []).length && !cfg.maxIn && !cfg.ramp && !cfg.swaps && !cfg.drainPick ? "kit" : "custom";`
  with
  `    && !(cfg.corners || []).length && !cfg.maxIn && !cfg.ramp && !cfg.swaps && !(cfg.drainPick && build?.drainFit) ? "kit" : "custom";`.
  `build` is the memo declared above `mode`.
- **`kitDirty`.** Replace
  `    || Object.keys(qtyOv).length > 0 || Object.keys(swaps).length > 0 || !!drainPick`
  with
  `    || Object.keys(qtyOv).length > 0 || Object.keys(swaps).length > 0 || (!!drainPick && !!build?.drainFit)`.

  The pick stays in `cfg`, so it still rides the marker and revives when the
  room goes linear again.
- **Point-grate chips (in `drainPanel`).** Replace
  ```js
          key: e.sku, label: shown(e.name).replace(/^kerdi-drain\s+grate\s*/i, "") || shown(e.name),
          ok: true, on: e.sku === swap.draft, onPick: () => setDraft(e.sku),
  ```
  with
  ```js
          key: e.sku, label: pointGrateLabel(e), so: !e.stock,
          ok: true, on: e.sku === swap.draft, onPick: () => setDraft(e.sku),
  ```
- **Frame chips.** Replace
  `      { label: "Frame", chips: o.frames.map((f) => ({ key: f.key, label: f.key.replace(/"/g, "″"), ok: f.ok,`
  with
  `      { label: "Frame", chips: o.frames.map((f) => ({ key: f.key, label: inchGlyph(f.key), ok: f.ok,`.
- **Fixed drain `what`.** Replace
  `          + (g.frame ? `, ${g.frame.replace(/"/g, "″")} frame` : "") + (g.finish ? ", " + low(FINISH_LABEL[g.finish] || g.finish) : "");`
  with
  `          + (g.frame ? `, ${inchGlyph(g.frame)} frame` : "") + (g.finish ? ", " + low(FINISH_LABEL[g.finish] || g.finish) : "");`.

- [ ] **Step 7: wedi popup — the inert cover pick**

In `src/WediConfigurator.jsx`:
- In the `./wedi.js` import, replace
  `  BENCH_CORNER_LBL, buildFromMarker, sessionFromRows, wediSlotOf, coverStyles, legacyCoverPick,`
  with
  `  BENCH_CORNER_LBL, buildFromMarker, sessionFromRows, wediSlotOf, coverStyles, legacyCoverPick, coverPickApplies,`.
- In `kitDirty`, replace
  `    || opts.panelKey !== undefined || opts.curbKey !== undefined || opts.coverPick !== undefined`
  with
  ```js
      || opts.panelKey !== undefined || opts.curbKey !== undefined
      || coverPickApplies(opts.coverPick, panKey)
  ```

- [ ] **Step 8: Suite, lint, preview**

```bash
npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"
npx eslint src/swappop.jsx src/schluter.js src/wedi.js src/SchluterConfigurator.jsx src/WediConfigurator.jsx
npx vite --port 5199 --strictPort &
node .scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs 2>&1 | grep -E "^(fixed|point):|exit|PAGEERROR"
```
Expected:
- The suite ends `# fail 0`, and lint is clean.
- The `fixed:` log reads `… | FRAME | ¾″ | 29/32″ | …`.
- The `point:` log reads `… | GRATE | 4″ stainless | 4″ tileable | 4″ floral, brushed | …`.

Keep two shots as the carry-over proof, then restore 1a's shots and stop the
server:
```bash
mkdir -p .scratch/158_shower-config-roadmap/p1b
cp .scratch/158_shower-config-roadmap/p1a/s2-fixed-52.png .scratch/158_shower-config-roadmap/p1b/c1-frame-glyph.png
cp .scratch/158_shower-config-roadmap/p1a/s6-point-grate-popover.png .scratch/158_shower-config-roadmap/p1b/c2-point-grate-labels.png
git checkout -- .scratch/158_shower-config-roadmap/p1a/
```
Read both PNGs. The Frame chip must read `¾″` and the grate chips must read
`4″ floral, brushed`.

- [ ] **Step 9: Commit**

```bash
git add src/swappop.jsx src/schluter.js src/wedi.js src/SchluterConfigurator.jsx src/WediConfigurator.jsx src/schluter.test.js src/wedi.test.js .scratch/158_shower-config-roadmap/p1b/c1-frame-glyph.png .scratch/158_shower-config-roadmap/p1b/c2-point-grate-labels.png
git commit -m "1a carry-overs: chip labels (¾″, 4″ floral, brushed), SO dot, inert drain/cover picks, missing engine tests (ticket 158 Phase 1b)"
```

---

### Task 4: Schluter membrane and band choices — `resolveMembrane` / `resolveBand` and their options

**Files:**
- Modify: `src/schluter.js`:
  - `rollCode` (above `function bandLf`)
  - the `KERDI200` and `KEBA` branches of `classifyCode`
  - `pickRolls` split into `rollLadder` + `pickRolls`
  - the membrane/band block above `pointGrateLabel`
  - `buildKit`: the membrane wall line, the band line, the return
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: `stockPool` (module-private), `catalogOf`, `buildKit` (existing).
- Produces:
  - **Classified rows:**
    - membrane rows gain `roll: "5M" | "7M" | "10M" | "20M" | "30M" | "15M"` (an
      unsuffixed roll is `"30M"`);
    - KEBA rows gain `roll` and `width` (the mm code: `"125"`, `"185"`).
  - `MEMBRANE_WIDTH`: `{ standard: "Standard 1 m", wide: "Wide 2 m" }`.
  - `bandWidthLabel(code) → '5"' | '7-1/4"' | '10"' | …`.
  - `resolveMembrane(choice, sfNeed, cat, { source }) → { lines: [{ item, qty }], subst? }`
  - `membraneOptions(choice, sfNeed, cat, { source }) → { widths, rolls, result }`.
    Each chip is `{ key, label, ok, so, on, next }`, where `next` is the choice
    that chip drafts.
  - `resolveBand(choice, lfNeed, cat, { source }) → { lines: [{ item, qty }], subst? }`
  - `bandOptions(choice, lfNeed, cat, { source }) → { widths, rolls, result }`,
    with the same chip shape.
  - `buildKit(...)` reads `cfg.swaps.membrane` and `cfg.swaps.band`, and returns
    `need: { wallSf, bandLf }` alongside `lines`, `cand`, `drainFit`. `wallSf`
    already includes the 10% laps.

- [ ] **Step 1: Write the failing tests**

Extend the `src/schluter.test.js` import so it ends
`… resolveDrain, drainOptions, pointGrateLabel,\n  resolveMembrane, membraneOptions, resolveBand, bandOptions, bandWidthLabel } from "./schluter.js";`.

Append:
```js

// --- Phase 1b: membrane + band choices (ticket 158) -------------------------

// Test-shaped 7¼″ KERDI-BAND rows (KEBA100/185 — the width code is the mm):
// the fixture carries only the 5″ band.
const BAND_185 = [
  { sku: "KEBA100/185/5M", name: "KERDI-BAND 7-1/4\" seam band", price: 29.5, cost: 19.67, stock: false, size: "16'5\" roll" },
  { sku: "KEBA100/185", name: "KERDI-BAND 7-1/4\" seam band", price: 139.8, cost: 93.2, stock: false, size: "98'5\" roll" },
];
const BCAT = catalogOf([...FIXTURE_ITEMS, ...BAND_185]);
const picks = (r) => r.lines.map((p) => [p.item.sku, p.qty]);

test("KERDI rolls and bands carry their roll code; bands their width code", () => {
  assert.equal(by("KERDI200/10M").roll, "10M");
  assert.equal(by("KERDI200").roll, "30M");
  assert.equal(by("KERDI200200/15M").roll, "15M");
  assert.deepEqual([by("KEBA100/125/5M").width, by("KEBA100/125/5M").roll], ["125", "5M"]);
  assert.deepEqual([by("KEBA100/125").width, by("KEBA100/125").roll], ["125", "30M"]);
  const wide = classify({ sku: "SLRKEBA100/185", name: "" });
  assert.deepEqual([wide.width, wide.lf, wide.roll], ["185", 98, "30M"]);
  assert.equal(bandWidthLabel("125"), '5"');
  assert.equal(bandWidthLabel("185"), '7-1/4"');
});

test("buildKit reports the membrane and band needs the popover resolves against", () => {
  const b = buildKit(cfg({}), CAT, { source: "all" });
  assert.equal(round2(b.need.wallSf), 87.27);   // 79.33 sf of wall + 10% laps
  assert.equal(round2(b.need.bandLf), 29.56);   // 2 × (60 + 38) / 12 + 79.33 / 6
});

test("resolveMembrane: no choice is pickRolls; standard, wide and a pinned roll", () => {
  assert.deepEqual(picks(resolveMembrane(null, 87.27, CAT, { source: "all" })), [["KERDI200/10M", 1]]);
  assert.deepEqual(picks(resolveMembrane({ wide: true }, 87.27, CAT, { source: "all" })), [["KERDI200200/15M", 1]]);
  assert.deepEqual(picks(resolveMembrane({ wide: false, roll: "5M" }, 87.27, CAT, { source: "all" })), [["KERDI200/5M", 2]]);
  assert.deepEqual(picks(resolveMembrane({ wide: true }, 400, CAT, { source: "all" })), [["KERDI200200/15M", 2]]);
});

test("resolveMembrane: Auto re-fits the mix when the wall area grows; a pinned roll only re-counts", () => {
  assert.deepEqual(picks(resolveMembrane({}, 300, CAT, { source: "all" })), [["KERDI200", 1]]);
  assert.deepEqual(picks(resolveMembrane({}, 400, CAT, { source: "all" })), [["KERDI200", 1], ["KERDI200/10M", 1]]);
  assert.deepEqual(picks(resolveMembrane({ roll: "10M" }, 400, CAT, { source: "all" })), [["KERDI200/10M", 4]]);
});

test("resolveMembrane: a width or roll the books don't carry falls back and says so", () => {
  const noWide = resolveMembrane({ wide: true }, 87.27, CAT.filter((i) => !i.wide), { source: "all" });
  assert.deepEqual(picks(noWide), [["KERDI200/10M", 1]]);
  assert.equal(noWide.subst, "no wide roll in the books — standard used");
  const noRoll = resolveMembrane({ roll: "12M" }, 87.27, CAT, { source: "all" });
  assert.deepEqual(picks(noRoll), [["KERDI200/10M", 1]]);
  assert.equal(noRoll.subst, "no 12M roll in the books — best fit used");
});

test("resolveMembrane: stock only prefers stocked rolls and still lands a special-order pin, flagged", () => {
  const so10 = soFlip(["KERDI200/10M"]);
  assert.deepEqual(picks(resolveMembrane({}, 87.27, so10, { source: "stock" })), [["KERDI200/20M", 1]]);
  const pinned = resolveMembrane({ roll: "10M" }, 87.27, so10, { source: "stock" });
  assert.deepEqual(picks(pinned), [["KERDI200/10M", 1]]);
  assert.equal(pinned.lines[0].item.stock, false);
});

test("membraneOptions: Width then Roll, each chip's next the choice it drafts", () => {
  const o = membraneOptions({ wide: false }, 87.27, CAT, { source: "all" });
  assert.deepEqual(o.widths.map((c) => [c.key, c.label, c.ok, c.on]), [["standard", "Standard 1 m", true, true], ["wide", "Wide 2 m", true, false]]);
  assert.deepEqual(o.rolls.map((c) => [c.key, c.label, c.on]), [
    ["auto", "Auto", true], ["5M", "5 m · 54 sf", false], ["7M", "7 m · 75 sf", false],
    ["10M", "10 m · 108 sf", false], ["20M", "20 m · 215 sf", false], ["30M", "30 m · 323 sf", false]]);
  assert.deepEqual(o.rolls[1].next, { wide: false, roll: "5M" });
  assert.deepEqual(membraneOptions({ wide: true }, 87.27, CAT, { source: "all" }).rolls.map((c) => c.key), ["auto", "15M"]);
});

test("resolveBand: no choice is today's rule; each width, a pinned roll, multiples", () => {
  assert.deepEqual(picks(resolveBand(null, 29.56, BCAT, { source: "all" })), [["KEBA100/125/10M", 1]]);
  assert.deepEqual(picks(resolveBand({ width: "185" }, 29.56, BCAT, { source: "all" })), [["KEBA100/185", 1]]);
  assert.deepEqual(picks(resolveBand({ width: "125", roll: "5M" }, 29.56, BCAT, { source: "all" })), [["KEBA100/125/5M", 2]]);
  assert.deepEqual(picks(resolveBand({ width: "185", roll: "5M" }, 29.56, BCAT, { source: "all" })), [["KEBA100/185/5M", 2]]);
  assert.deepEqual(picks(resolveBand({ width: "125" }, 120, BCAT, { source: "all" })), [["KEBA100/125", 2]]);
});

test("resolveBand: a width or roll the books don't carry falls back and says so; stock only lands SO flagged", () => {
  const w = resolveBand({ width: "250" }, 29.56, BCAT, { source: "all" });
  assert.deepEqual(picks(w), [["KEBA100/125/10M", 1]]);
  assert.equal(w.subst, 'no 10" band in the books — another width used');
  const r = resolveBand({ width: "185", roll: "10M" }, 29.56, BCAT, { source: "all" });
  assert.deepEqual(picks(r), [["KEBA100/185", 1]]);
  assert.equal(r.subst, "no 10M roll in the books — best fit used");
  const so = resolveBand({ width: "185" }, 29.56, BCAT, { source: "stock" });
  assert.equal(so.lines[0].item.stock, false);
});

test("bandOptions: widths off the books, the resolved width lit, Auto keeps no choice", () => {
  const o = bandOptions(null, 29.56, BCAT, { source: "all" });
  assert.deepEqual(o.widths.map((c) => [c.key, c.label, c.so, c.on]), [["125", '5"', false, true], ["185", '7-1/4"', true, false]]);
  assert.deepEqual(o.rolls.map((c) => [c.key, c.label, c.on]), [["auto", "Auto", true], ["5M", "5 m · 16 lf", false], ["10M", "10 m · 33 lf", false], ["30M", "30 m · 98 lf", false]]);
  assert.deepEqual(o.rolls[0].next, {});
  assert.deepEqual(o.rolls[1].next, { width: "125", roll: "5M" });
  assert.deepEqual(bandOptions({ width: "185" }, 29.56, BCAT, { source: "all" }).rolls.map((c) => c.key), ["auto", "5M", "30M"]);
});

test("buildKit bills the membrane and band choices; the defaults don't move with a second band width in the books", () => {
  const m = buildKit(cfg({ swaps: { membrane: { wide: false, roll: "5M" } } }), CAT, { source: "all" });
  assert.deepEqual(m.lines.filter((l) => l.g === "Walls" && l.item.g === "membrane").map((l) => [l.item.sku, l.qty]), [["KERDI200/5M", 2]]);
  const b = buildKit(cfg({ swaps: { band: { width: "185" } } }), BCAT, { source: "all" });
  assert.deepEqual(b.lines.filter((l) => l.g === "Seams").map((l) => [l.item.sku, l.qty]), [["KEBA100/185", 1]]);
  const plain = buildKit(cfg({}), BCAT, { source: "all" });
  assert.deepEqual(plain.lines.filter((l) => l.g === "Seams").map((l) => [l.item.sku, l.qty]), [["KEBA100/125/10M", 1]]);
  const miss = buildKit(cfg({ swaps: { membrane: { roll: "12M" } } }), CAT, { source: "all" });
  assert.match(miss.lines.find((l) => l.item.g === "membrane").note, /^no 12M roll in the books — best fit used · 79 sf of wall/);
});
```
`round2`, `cfg`, `CAT`, `by`, `soFlip`, `classify`, `catalogOf` and
`FIXTURE_ITEMS` already exist in the file.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/schluter.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL. `resolveMembrane` is not exported.

- [ ] **Step 3: Classify the roll and width codes**

In `src/schluter.js`, add immediately above `function bandLf(code) {`:
```js
// A roll's length code off its SKU ("10M"); an unsuffixed roll is the full
// 30 m one. KERDI membrane and KERDI-BAND share the /<n>M grammar.
const rollCode = (code) => { const m = /\/(\d+)M$/.exec(code); return m ? m[1] + "M" : "30M"; };

```
In `classifyCode`, replace
```js
    if (/^KERDI200200/.test(code)) entry.wide = true;
    return entry;
```
with
```js
    if (/^KERDI200200/.test(code)) entry.wide = true;
    entry.roll = rollCode(code);
    return entry;
```
Replace
```js
  if (/^KEBA/.test(code)) {
    return { ...item, g: "seam", lf: bandLf(code) };
  }
```
with
```js
  // KEBA<thickness>/<width mm>[/<n>M] — the width code is what a band swap names.
  if (/^KEBA/.test(code)) {
    const m = /^KEBA\d+\/(\d+)/.exec(code);
    return { ...item, g: "seam", lf: bandLf(code), roll: rollCode(code), ...(m ? { width: m[1] } : {}) };
  }
```

- [ ] **Step 4: Split `pickRolls` into its ladder**

Replace the whole `pickRolls` block, from
`/**\n * Pick membrane rolls to cover sfNeed: greedy largest roll for whole` down to
the `return picks;\n}` that closes it (just above
`/**\n * The one stock-only pick rule`), with:
```js
// The membrane roll ladder: greedy largest roll for whole multiples, then the
// smallest single roll that covers the remainder (another largest when none
// is big enough). `rolls` arrive sorted by sf, already stock-narrowed.
function rollLadder(rolls, sfNeed) {
  if (!rolls.length) return [];
  const picks = [];
  const big = rolls[rolls.length - 1];
  let need = sfNeed;
  const nBig = Math.floor(need / big.sf);
  if (nBig > 0) { picks.push({ item: big, qty: nBig }); need -= nBig * big.sf; }
  if (need > 0) {
    const top = rolls.find((r) => r.sf >= need) || big;
    const existing = picks.find((p) => p.item === top);
    if (existing) existing.qty++; else picks.push({ item: top, qty: 1 });
  }
  return picks;
}

/**
 * Pick membrane rolls to cover sfNeed through the ladder above. "Wide"
 * rolls are excluded — they're a different-width product, reached only by a
 * membrane swap (resolveMembrane).
 */
export function pickRolls(sfNeed, cat, { source } = {}) {
  // stockPool, not a hard filter: with every roll special-order the membrane
  // role must still land (flagged), never vanish from the bill
  return rollLadder(stockPool(cat.filter((i) => i.g === "membrane" && !i.wide).sort((a, b) => a.sf - b.sf), source), sfNeed);
}

```

- [ ] **Step 5: The resolvers and options**

In `src/schluter.js`, add immediately above
`/** A point grate's chip label` (from Task 3):
```js
// ---------------------------------------------------------------------------
// Membrane and band choices (ticket 158 Phase 1b, ADR 0049): cfg.swaps.membrane
// = { wide, roll? } and cfg.swaps.band = { width, roll? } name a width and
// optionally a roll length — never a part — so the count re-fits the walls.

export const MEMBRANE_WIDTH = { standard: "Standard 1 m", wide: "Wide 2 m" };
// Schluter's own marketing rounding of the KERDI-BAND widths (mm → inch).
const BAND_W_IN = { 125: '5"', 185: '7-1/4"', 250: '10"' };
export const bandWidthLabel = (code) => BAND_W_IN[code] || `${Math.round((+code / 25.4) * 4) / 4}"`;

/**
 * A membrane choice → the wall rolls for `sfNeed`. No roll is the best-fit
 * mix within the width (the pickRolls ladder); a roll pins that length at
 * ⌈need ÷ roll sf⌉. A width or roll the books don't carry falls back and says
 * so in `subst` — never silently dropped.
 */
export function resolveMembrane(choice, sfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const inWidth = (wide) => cat.filter((i) => i.g === "membrane" && !!i.wide === wide).sort((a, b) => a.sf - b.sf);
  let rolls = inWidth(!!c.wide), subst = "";
  if (!rolls.length && c.wide) { rolls = inWidth(false); subst = "no wide roll in the books — standard used"; }
  if (c.roll && !subst) {
    const pinned = stockPool(rolls.filter((i) => i.roll === c.roll), source)[0];
    if (pinned) {
      const qty = Math.ceil(sfNeed / pinned.sf);
      return { lines: qty > 0 ? [{ item: pinned, qty }] : [] };
    }
    subst = `no ${c.roll} roll in the books — best fit used`;
  }
  const lines = rollLadder(stockPool(rolls, source), sfNeed);
  return subst ? { lines, subst } : { lines };
}

// A chip is special order when none of the rows it stands for is stocked.
const allSo = (list) => list.length > 0 && !list.some((i) => i.stock);
const rollWord = (code) => parseInt(code, 10) + " m";

/** The membrane popover's rows (Width → Roll), each chip's `next` the choice it drafts. */
export function membraneOptions(choice, sfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const wide = !!c.wide;
  const mem = cat.filter((i) => i.g === "membrane");
  const widths = [false, true].map((w) => {
    const list = mem.filter((i) => !!i.wide === w);
    return { key: w ? "wide" : "standard", label: MEMBRANE_WIDTH[w ? "wide" : "standard"], ok: list.length > 0, so: allSo(list), on: w === wide, next: { wide: w } };
  });
  const inW = mem.filter((i) => !!i.wide === wide).sort((a, b) => a.sf - b.sf);
  const rolls = [
    { key: "auto", label: "Auto", ok: inW.length > 0, so: false, on: !c.roll, next: { wide } },
    ...[...new Set(inW.map((i) => i.roll))].map((r) => {
      const list = inW.filter((i) => i.roll === r);
      return { key: r, label: `${rollWord(r)} · ${list[0].sf} sf`, ok: true, so: allSo(list), on: c.roll === r, next: { wide, roll: r } };
    }),
  ];
  return { widths, rolls, result: resolveMembrane(c, sfNeed, cat, { source }) };
}

/**
 * A band choice → the KERDI-BAND line for `lfNeed`. No roll is today's rule
 * within the width — the shortest roll that covers, else multiples of the
 * longest; a roll pins that length at ⌈need ÷ roll lf⌉. No choice at all is
 * today's rule over every band.
 */
export function resolveBand(choice, lfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const all = cat.filter((i) => i.g === "seam" && i.lf).sort((a, b) => a.lf - b.lf);
  let pool = c.width ? all.filter((i) => i.width === c.width) : all, subst = "";
  if (!pool.length && c.width) { pool = all; subst = `no ${bandWidthLabel(c.width)} band in the books — another width used`; }
  if (c.roll && !subst) {
    const pinned = stockPool(pool.filter((i) => i.roll === c.roll), source)[0];
    if (pinned) return { lines: [{ item: pinned, qty: Math.max(1, Math.ceil(lfNeed / pinned.lf)) }] };
    subst = `no ${c.roll} roll in the books — best fit used`;
  }
  // when no single roll in the pool covers, multiples cover the need — a
  // stock-narrowed pool must never quietly land one short roll
  const bands = stockPool(pool, source);
  const band = bands.find((b) => b.lf >= lfNeed) || bands[bands.length - 1];
  const lines = band ? [{ item: band, qty: Math.max(1, Math.ceil(lfNeed / band.lf)) }] : [];
  return subst ? { lines, subst } : { lines };
}

/** The band popover's rows (Width → Roll), each chip's `next` the choice it drafts. */
export function bandOptions(choice, lfNeed, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : {};
  const all = cat.filter((i) => i.g === "seam" && i.lf);
  const result = resolveBand(c, lfNeed, cat, { source });
  const width = c.width || (result.lines[0] && result.lines[0].item.width) || null;
  const widths = [...new Set(all.map((i) => i.width).filter(Boolean))].sort((a, b) => a - b).map((w) => ({
    key: w, label: bandWidthLabel(w), ok: true, so: allSo(all.filter((i) => i.width === w)), on: w === width, next: { width: w },
  }));
  const inW = all.filter((i) => !width || i.width === width).sort((a, b) => a.lf - b.lf);
  // Auto keeps "no choice" until a width is picked; a roll chip names the width it shows
  const rolls = [
    { key: "auto", label: "Auto", ok: inW.length > 0, so: false, on: !c.roll, next: c.width ? { width: c.width } : {} },
    ...[...new Set(inW.map((i) => i.roll))].map((r) => {
      const list = inW.filter((i) => i.roll === r);
      return { key: r, label: `${rollWord(r)} · ${list[0].lf} lf`, ok: true, so: allSo(list), on: c.roll === r, next: { ...(width ? { width } : {}), roll: r } };
    }),
  ];
  return { widths, rolls, result };
}

```

- [ ] **Step 6: `buildKit` calls them**

In `buildKit`, replace
```js
    for (const p of pickRolls(sf * 1.1, cat, { source })) add("Walls", p.item, p.qty, `${sf.toFixed(0)} sf of wall`);
```
with
```js
    const mem = resolveMembrane(swaps.membrane, sf * 1.1, cat, { source });
    mem.lines.forEach((p, i) => add("Walls", p.item, p.qty, (i === 0 && mem.subst ? mem.subst + " · " : "") + `${sf.toFixed(0)} sf of wall`));
```
Replace
```js
  const bands = stockPool(cat.filter((i) => i.g === "seam" && i.lf).sort((a, b) => a.lf - b.lf), source);
  const lfNeed = (2 * (cfg.w + cfg.d)) / 12 + sf / 6;
  // when no single roll in the pool covers, multiples cover the need — a
  // stock-narrowed pool must never quietly land one short roll
  const band = bands.find((b) => b.lf >= lfNeed) || bands[bands.length - 1];
  add("Seams", band, band ? Math.max(1, Math.ceil(lfNeed / band.lf)) : 0, "seams + tray perimeter");
```
with
```js
  const lfNeed = (2 * (cfg.w + cfg.d)) / 12 + sf / 6;
  const band = resolveBand(swaps.band, lfNeed, cat, { source });
  for (const p of band.lines) add("Seams", p.item, p.qty, (band.subst ? band.subst + " · " : "") + "seams + tray perimeter");
```
Replace the final
```js
  for (const l of L) l.slot = slotOf(l.g, l.item);
  return { lines: L, cand, drainFit };
```
with
```js
  for (const l of L) l.slot = slotOf(l.g, l.item);
  return { lines: L, cand, drainFit, need: { wallSf: sf * 1.1, bandLf: lfNeed } };
```
The mortar-bed floor KERDI keeps calling `pickRolls`. The membrane choice is
the wall membrane's; see the spec amendment in Task 10.

- [ ] **Step 7: Run the suite**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`. The 1a pins still hold:
- `67187` for the 60×38 total;
- "stock-only band uses stocked multiples…";
- "roll ladder: 79 sf…".

- [ ] **Step 8: Lint and commit**

```bash
npx eslint src/schluter.js src/schluter.test.js
git add src/schluter.js src/schluter.test.js
git commit -m "Schluter: membrane and KERDI-BAND choices resolve per build — resolveMembrane/resolveBand + their popover options (ticket 158 Phase 1b)"
```

---

### Task 5: Schluter fastener and bench-board picks

**Files:**
- Modify: `src/schluter.js`:
  - `normBench` (corner return object and wall return object)
  - `wrapBoard` (above `export function buildKit`)
  - `buildKit`'s fastener pick and its bench loop
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: `swapped` (inside `buildKit`), `stockPool`, `pickFrom`.
- Produces:
  - `cfg.swaps.fastener` (a KBZS sku) wins the fastener line. Its qty re-fits by
    that pack's `ct`.
  - `cfg.benches[i].board` wins a framed wrap board (½″) or a build-up board
    (2″).
  - `normBench` carries `board` for site and framed benches, but not for
    premade.
  - Every bench line carries `bench: i`, the index into `cfg.benches`. The popup
    writes a pick back to that row.
  - A stale sku falls back to the recipe (the existing `swapped` rule).

- [ ] **Step 1: Write the failing tests**

Append to `src/schluter.test.js`:
```js

// --- Phase 1b: fastener and bench list swaps (ticket 158) --------------------

test("cfg.swaps.fastener picks the pack; its count re-fits; a stale sku falls back", () => {
  const f = (c) => buildKit(c, CAT, { source: "all" }).lines.filter((l) => l.item.fastener).map((l) => [l.item.sku, l.qty]);
  assert.deepEqual(f(cfg({ wallSys: "board" })), [["KBZS35GT32Z100", 2]]);
  assert.deepEqual(f(cfg({ wallSys: "board", swaps: { fastener: "KBZS35GT32Z" } })), [["KBZS35GT32Z", 4]]);
  assert.deepEqual(f(cfg({ wallSys: "board", swaps: { fastener: "NOPE" } })), [["KBZS35GT32Z100", 2]]);
});

test("bench board picks ride each bench row; bench lines carry their bench index", () => {
  const ex = (c) => buildKit(c, CAT, { source: "all" }).lines.filter((l) => l.g === "Extras").map((l) => [l.item.sku, l.qty, l.bench]);
  assert.deepEqual(ex(cfg({ benches: [{ kind: "wall", side: "back", build: "framed" }, { kind: "wall", side: "left", build: "site" }] })),
    [["KB1212202440", 1, 0], ["KB506252440", 2, 1]]);
  assert.deepEqual(ex(cfg({ benches: [{ kind: "wall", side: "back", build: "framed", board: "KB1212201625" }, { kind: "wall", side: "left", build: "site", board: "NOPE" }] })),
    [["KB1212201625", 1, 0], ["KB506252440", 2, 1]]);
  assert.equal(normBench({ kind: "wall", side: "back", build: "framed", board: "KB1212201625" }, { w: 60, d: 38 }, CAT).board, "KB1212201625");
  assert.equal(normBench({ kind: "corner", corner: "bl", board: "KB506252440" }, { w: 60, d: 38 }, CAT).board, "KB506252440");
  assert.equal(normBench({ kind: "wall", side: "back", part: "KBSB4101220RA", board: "KB506252440" }, { w: 60, d: 38 }, CAT).board, undefined);
});

test("every 1b pick survives the marker: buildFromMarker bills the same lines", () => {
  const bill = (b) => b.lines.filter((l) => !l.noteOnly).map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
  for (const [c, cat] of [
    [cfg({ swaps: { membrane: { wide: true } } }), CAT],
    [cfg({ swaps: { band: { width: "185", roll: "5M" } } }), BCAT],
    [cfg({ wallSys: "board", swaps: { fastener: "KBZS35GT32Z" } }), CAT],
    [cfg({ benches: [{ kind: "wall", side: "back", build: "framed", board: "KB1212201625" }] }), CAT],
  ]) {
    const live = buildKit(c, cat, { source: "all" });
    const back = buildFromMarker({ mode: "custom", cfg: { ...c, source: "all" } }, cat);
    assert.deepEqual(bill(back), bill(live), JSON.stringify(c.swaps || c.benches));
  }
});
```
`BCAT` comes from Task 4's block, higher in the file.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/schluter.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`

Expected: the first two new tests FAIL:
- the fastener stays `KBZS35GT32Z100`;
- `.bench` and `.board` are `undefined`.

The round trip passes already for membrane, band and fastener. It fails for the
bench board.

- [ ] **Step 3: Implement**

In `normBench`'s corner return object, replace
```js
      size: round2(+b.size || (pb && pb.a) || 24),
      h: round2(+b.h || BENCH_H),
    };
```
with
```js
      size: round2(+b.size || (pb && pb.a) || 24),
      h: round2(+b.h || BENCH_H),
      ...(!part && b.board ? { board: b.board } : {}),
    };
```
In its wall return object, replace
```js
    ...(build === "framed" ? { trayFit: b.trayFit === "smaller" ? "smaller" : "cut" } : {}),
  };
```
with
```js
    ...(build === "framed" ? { trayFit: b.trayFit === "smaller" ? "smaller" : "cut" } : {}),
    ...(build !== "premade" && b.board ? { board: b.board } : {}),
  };
```
Add immediately above `export function buildKit(`:
```js
// The framed-bench wrap pool — the ½" boards the wall pick draws from.
const wrapBoard = (i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf;

```
In `buildKit`, replace
```js
    const fast = stockPool(cat.filter((i) => i.fastener).sort((x, y) => (y.ct || 0) - (x.ct || 0)), source)[0];
```
with
```js
    const fast = swapped(swaps.fastener, (i) => i.fastener)
      || stockPool(cat.filter((i) => i.fastener).sort((x, y) => (y.ct || 0) - (x.ct || 0)), source)[0];
```
Replace the bench loop
```js
  benches.forEach((b) => {
    if (b.build === "premade") {
```
with
```js
  benches.forEach((b, bi) => {
    const first = L.length;
    if (b.build === "premade") {
```
and replace its framed/site arms
```js
      add("Extras", stockPool(cat.filter((i) => i.g === "board" && !i.thick2 && !i.fastener && i.sf)
        .sort((x, y) => y.sf - x.sf), source)[0], 1,
        "framed bench — ½\" KERDI-BOARD wrap, framing by installer");
    } else {
      add("Extras", pickFrom(cat, (i) => i.thick2, { source }), 2, '2" KERDI-BOARD build-up on the finished tray — top + face + supports');
    }
  });
```
with
```js
      add("Extras", swapped(b.board, wrapBoard) || stockPool(cat.filter(wrapBoard).sort((x, y) => y.sf - x.sf), source)[0], 1,
        "framed bench — ½\" KERDI-BOARD wrap, framing by installer");
    } else {
      add("Extras", swapped(b.board, (i) => i.thick2) || pickFrom(cat, (i) => i.thick2, { source }), 2,
        '2" KERDI-BOARD build-up on the finished tray — top + face + supports');
    }
    // the popup's ⇄ writes a bench line's pick back onto cfg.benches[bi]
    for (let k = first; k < L.length; k++) L[k].bench = bi;
  });
```

- [ ] **Step 4: Run the suite**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`

Expected: `# fail 0`. These tests must still pass:
- the 1a/earlier `normBench` deepEqual pin
  (`{ kind: "wall", side: "back", build: "framed", part: null, len: 60, depth: 14, h: 20, trayFit: "cut" }`),
  because `board` appears only when set;
- "bench board picks follow the same stock-only rule as the walls".

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/schluter.js src/schluter.test.js
git add src/schluter.js src/schluter.test.js
git commit -m "Schluter: fastener pack and per-bench board picks; bench lines carry their bench index (ticket 158 Phase 1b)"
```

---

### Task 6: wedi curb choice — `resolveCurb`, old `curbKey`s translate, `curbKey` no longer written

**Files:**
- Modify: `src/wedi.js`:
  - the curb block, inserted above the `/**\n * What one unit covers` doc
    comment of `coverageOf`
  - `kitFor`: the `// --- curb` section, the `cfg` object, the return
  - `buildFromMarker`
- Modify: `src/showersf.js` (`wediPieces`)
- Test: `src/wedi.test.js`, `src/showersf.test.js`, and the Task 1 golden
  (unchanged, must stay green)

**Interfaces:**
- Consumes: `group`, `item`, `curbRuns`, `normBench`, `defaultWalls`,
  `familyOf`, `panRoomDims`, `byStockThenPrice`, `round2` (existing, `wedi.js`).
- Produces:
  - `curbPick`: `{ sub: "full"|"lean"|"at"|"cap", len?: 60|96, profile?: "full"|"lean" } | { none: true }`.
    `profile` matters only for `"at"`: wedi makes a full-foam AT (`US3000048`)
    and a lean AT (`US3000049`), both 60″.
  - `curbProfile(entry) → "full" | "lean"`.
  - `resolveCurb(pick, openLen, fam) → { item: entry|null, qty, note, len }`.
  - `legacyCurbPick(curbKey, fam, openLen) → curbPick | undefined`.
  - `curbOptions(pick, openLen, fam) → { styles, profiles, lengths, result, recipe }`.
    - Chips are `{ key, label, ok, so, on, next }`. `next` is a `curbPick` or
      `null` (`null` only for none).
    - Style keys: `full | lean | at | cap | none`.
    - Length keys: `"auto" | "60" | "96"`.
    - `recipe` is true when the draft bills exactly what no pick would, so
      **Use this** stores nothing.
  - `curbPickOf(markerCfg) → curbPick | undefined`: for the popup's `seedState`.
  - `markerCurbKey(markerCfg) → key | null`: for `showersf.js`.
  - `kitFor(pan, opts)`:
    - reads `opts.curbPick`, else `legacyCurbPick(opts.curbKey, …)`;
    - writes `cfg.curbPick` only when set, and never `cfg.curbKey`;
    - returns `curbFit: { openLen, fam }`.
  - `buildFromMarker` passes `curbPick` and the legacy `curbKey`.
- **Between this task and Task 9** the wedi popup still passes `curbKey`.
  `kitFor`'s legacy read translates it every build, so the popup keeps billing
  what it shows. Task 9 moves the popup onto `curbPick`.

- [ ] **Step 1: Write the failing tests**

Extend the `src/wedi.test.js` import so it ends:
```js
  wediSlotOf, coverPickApplies,
  resolveCurb, legacyCurbPick, curbOptions, curbPickOf, markerCurbKey,
} from "./wedi.js";
```
Append:
```js

// --- Phase 1b: the curb choice (ticket 158) ----------------------------------

const curbAt = (r) => [r.item ? r.item.key : null, r.qty];

test("resolveCurb: each style × Auto across the 60″ boundary, fundo and linear", () => {
  const got = {};
  for (const fam of ["fundo", "linear"]) for (const sub of ["full", "lean", "at", "cap"])
    got[fam + ":" + sub] = [curbAt(resolveCurb({ sub }, 60, fam)), curbAt(resolveCurb({ sub }, 72, fam))];
  assert.deepEqual(got, {
    "fundo:full": [["US3000039", 1], ["US3000041", 1]],
    "fundo:lean": [["US3000038", 1], ["US3000040", 1]],
    "fundo:at": [["US3000049", 1], ["US3000049", 2]],
    "fundo:cap": [["US3000008", 1], ["US3000010", 1]],
    "linear:full": [["US3000039", 1], ["US3000039", 2]],
    "linear:lean": [["US3000038", 1], ["US3000038", 2]],
    "linear:at": [["US3000049", 1], ["US3000049", 2]],
    "linear:cap": [["US3000008", 1], ["US3000008", 2]],
  });
});

test("resolveCurb: no pick is the recipe; a pinned length, none, AT profiles, and a style not made at the rule length", () => {
  assert.deepEqual(curbAt(resolveCurb(undefined, 60, "fundo")), ["US3000038", 1]);
  assert.deepEqual(curbAt(resolveCurb(undefined, 72, "fundo")), ["US3000040", 1]);
  assert.deepEqual(curbAt(resolveCurb(undefined, 72, "linear")), ["US3000038", 2]);
  assert.deepEqual(curbAt(resolveCurb(undefined, 72, "curbless")), [null, 0]);
  assert.deepEqual(curbAt(resolveCurb({ sub: "lean" }, 72, "curbless")), ["US3000040", 1]);
  assert.deepEqual(curbAt(resolveCurb({ sub: "full", len: 60 }, 72, "fundo")), ["US3000039", 2]);
  assert.deepEqual(curbAt(resolveCurb({ none: true }, 60, "fundo")), [null, 0]);
  assert.deepEqual(curbAt(resolveCurb({ sub: "at", profile: "full" }, 60, "fundo")), ["US3000048", 1]);
  const at = resolveCurb({ sub: "at" }, 72, "fundo");
  assert.deepEqual(curbAt(at), ["US3000049", 2]);
  assert.equal(at.note, 'AT not made at 96" — 60" used · 72" of open edge — cut to fit');
  assert.equal(resolveCurb({ sub: "full" }, 72, "fundo").note, 'cut to 72"');
});

test("legacyCurbPick: the recipe's own curb reads as no pick; null is none; any other curb keeps its length", () => {
  assert.equal(legacyCurbPick(undefined, "fundo", 60), undefined);
  assert.equal(legacyCurbPick("US3000038", "fundo", 60), undefined);
  assert.deepEqual(legacyCurbPick("US3000038", "fundo", 72), { sub: "lean", len: 60 });
  assert.equal(legacyCurbPick("US3000040", "fundo", 72), undefined);
  assert.equal(legacyCurbPick("US3000038", "linear", 72), undefined);
  assert.deepEqual(legacyCurbPick(null, "fundo", 60), { none: true });
  assert.equal(legacyCurbPick(null, "curbless", 60), undefined);
  assert.deepEqual(legacyCurbPick("US3000049", "fundo", 60), { sub: "at", len: 60, profile: "lean" });
  assert.equal(legacyCurbPick("NOPE", "fundo", 60), undefined);
});

test("curbOptions: Style → Profile (AT only) → Length; Auto first, a length not made is not ok", () => {
  const o = curbOptions(undefined, 60, "fundo");
  assert.deepEqual(o.styles.map((c) => [c.key, c.on]), [["full", false], ["lean", true], ["at", false], ["cap", false], ["none", false]]);
  assert.deepEqual(o.profiles, []);
  assert.deepEqual(o.lengths.map((c) => [c.key, c.ok, c.on]), [["auto", true, true], ["60", true, false], ["96", true, false]]);
  assert.equal(o.recipe, true);
  const at = curbOptions({ sub: "at" }, 72, "fundo");
  assert.deepEqual(at.profiles.map((c) => [c.key, c.on]), [["full", false], ["lean", true]]);
  assert.deepEqual(at.profiles[0].next, { sub: "at", profile: "full" });
  assert.deepEqual(at.lengths.map((c) => [c.key, c.ok]), [["auto", true], ["60", true], ["96", false]]);
  assert.equal(at.recipe, false);
  const cap = curbOptions({ sub: "cap", len: 96 }, 72, "fundo");
  assert.deepEqual(cap.lengths.map((c) => [c.key, c.so, c.on]), [["auto", false, false], ["60", false, false], ["96", true, true]]);
  assert.equal(curbOptions({ none: true }, 60, "curbless").recipe, true);
  assert.equal(curbOptions({ none: true }, 60, "fundo").recipe, false);
});

test("kitFor: curbPick is written only when picked, never curbKey; a style re-fits when the opening grows", () => {
  const plain = kitFor("US9100004", { room: { w: 60, d: 36 } });
  assert.equal("curbKey" in plain.cfg, false);
  assert.equal("curbPick" in plain.cfg, false);
  assert.deepEqual(plain.curbFit, { openLen: 60, fam: "fundo" });
  const curbLines = (k) => k.lines.filter((l) => l.item.group === "curb").map((l) => [l.item.key, l.qty]);
  const at60 = kitFor("US9100004", { room: { w: 60, d: 36 }, curbPick: { sub: "full" } });
  assert.deepEqual(curbLines(at60), [["US3000039", 1]]);
  assert.deepEqual(at60.cfg.curbPick, { sub: "full" });
  assert.deepEqual(curbLines(kitFor("US9100004", { room: { w: 84, d: 36 }, curbPick: { sub: "full" } })), [["US3000041", 1]]);
});

test("an old marker saved with the default 60″ curb re-fits to 96″ once the opening grows (the 1b bug)", () => {
  const old = { ...kitFor("US9100004", { room: { w: 60, d: 36 } }).cfg, curbKey: "US3000038", panelKey: "US8000017" };
  const pick = curbPickOf(old);
  assert.equal(pick, undefined);
  const grown = kitFor("US9100004", { room: { w: 72, d: 36 }, curbPick: pick });
  assert.deepEqual(grown.lines.filter((l) => l.item.group === "curb").map((l) => [l.item.key, l.qty]), [["US3000040", 1]]);
  assert.deepEqual(curbPickOf({ ...old, curbKey: "US3000039" }), { sub: "full", len: 60 });
});

test("markerCurbKey: the curb a marker bills — legacy key as saved, else the choice resolved at its opening", () => {
  const k = kitFor("US9100004", { room: { w: 60, d: 36 } });
  assert.equal(markerCurbKey(k.cfg), "US3000038");
  assert.equal(markerCurbKey({ ...k.cfg, curbPick: { sub: "full" } }), "US3000039");
  assert.equal(markerCurbKey(kitFor("US9100004", { room: { w: 84, d: 36 }, curbPick: { sub: "full" } }).cfg), "US3000041");
  assert.equal(markerCurbKey({ ...k.cfg, curbPick: { none: true } }), null);
  assert.equal(markerCurbKey({ ...k.cfg, curbKey: "US3000008" }), "US3000008");
  assert.equal(markerCurbKey(kitFor("US9200003").cfg), null);
  assert.equal(markerCurbKey(kitFor("US9100006").cfg), "US3000040");
});
```
Append to `src/showersf.test.js`. Its `base` is
`{ panKey: "US9100002", room: { w: 60, d: 36 }, walls: W3 }`, with no `curbKey`:
the shape of a 1b default marker.
```js

test("wedi: a 1b marker (a curb choice, no curbKey) tiles the curb that choice bills", () => {
  assert.deepEqual(sf(wediPieces(base)), { walls: 88, floor: 15, curb: 3.8 });
  assert.equal(wediPieces(base).curbed, true);
  assert.deepEqual(sf(wediPieces({ ...base, curbPick: { sub: "cap" } })), { walls: 88, floor: 15, curb: 6.1 });
  assert.equal(wediPieces({ ...base, curbPick: { none: true } }).curbed, false);
  assert.equal(sf(wediPieces({ ...base, curbPick: { sub: "cap" }, maxIn: true, tileT: 0.375 })).floor, 13.2);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/wedi.test.js src/showersf.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`

Expected: FAIL.
- `wedi.test.js` fails to load: `resolveCurb` is not exported.
- The showersf test fails: with no `curbKey`, today's `wediPieces` bills no
  curb.

- [ ] **Step 3: The curb block**

In `src/wedi.js`, insert immediately above the doc comment that opens
`/**\n * What one unit covers — { n, unit: "sf" | "lf" } for rolls, membranes and`:
```js
// ---------------------------------------------------------------------------
// Curb choice (ticket 158 Phase 1b, ADR 0049): `cfg.curbPick` names a style
// and optionally a length — never a part — so the recipe's length rule re-runs
// every build and a grown opening re-fits. The AT style comes as a full-foam
// and a lean piece at one length, so an AT choice may also name its `profile`.

const CURB_STYLES = [["full", "Full"], ["lean", "Lean"], ["at", "AT"], ["cap", "Cap"]];
const CURB_WORD = Object.fromEntries(CURB_STYLES);
export const curbProfile = (c) => (/lean/i.test(c.name) ? "lean" : "full");

// The length Auto takes: a linear pan 60", multiplied to cover; a fundo pan
// (and any other family a curb is picked onto) 60" up to a 60" opening, else 96".
const curbRuleLen = (fam, openLen) => (fam === "linear" ? 60 : openLen > 60 ? 96 : 60);

const openLenOf = (dims, walls, corners, benches) =>
  curbRuns(dims, walls, corners, benches).openLen || (benches.length ? 0 : dims.w);

/**
 * A curb choice → the curb line for `openLen` of open edge on a pan of family
 * `fam`. No choice is the recipe: the lean curb on fundo and linear pans, no
 * curb on the rest. `{ none: true }` bills none. A style not made at the
 * wanted length takes its longest made length, multiplied, and says so; a
 * style the books don't carry falls back to lean with a note.
 */
export function resolveCurb(pick, openLen, fam) {
  const none = { item: null, qty: 0, note: "", len: 0 };
  if (pick && pick.none) return none;
  if (!pick && fam !== "fundo" && fam !== "linear") return none;
  const all = group("curb").filter((c) => c.len);
  let sub = (pick && pick.sub) || "lean", missing = "";
  let inStyle = all.filter((c) => c.sub === sub && (!pick || !pick.profile || curbProfile(c) === pick.profile));
  if (!inStyle.length && sub !== "lean") {
    missing = (CURB_WORD[sub] || sub) + " curb not in the books — lean used";
    sub = "lean";
    inStyle = all.filter((c) => c.sub === "lean");
  }
  if (!inStyle.length) return none;
  const want = (pick && pick.len) || curbRuleLen(fam, openLen);
  const lens = [...new Set(inStyle.map((c) => c.len))].sort((a, b) => a - b);
  const len = lens.includes(want) ? want : lens[lens.length - 1];
  const it = inStyle.filter((c) => c.len === len).sort(byStockThenPrice)[0];
  const qty = openLen > 0 ? Math.max(1, Math.ceil((openLen - 0.01) / len)) : 0;
  const fit = qty > 1 ? round2(openLen) + '" of open edge — cut to fit' : len > openLen ? "cut to " + round2(openLen) + '"' : "";
  const why = missing || (len !== want ? (CURB_WORD[sub] || sub) + ' not made at ' + want + '" — ' + len + '" used' : "");
  return { item: it, qty, note: [why, fit].filter(Boolean).join(" · "), len };
}

/** An old marker's resolved curbKey → the choice it stands for at this pan and opening; the recipe's own curb reads as no choice. */
export function legacyCurbPick(key, fam, openLen) {
  if (key === undefined) return undefined;
  const def = resolveCurb(undefined, openLen, fam).item;
  if (key === null) return def ? { none: true } : undefined;
  if (def && key === def.key) return undefined;
  const c = item(key);
  if (!c || c.group !== "curb" || !c.len) return undefined;
  return { sub: c.sub, len: c.len, ...(c.sub === "at" ? { profile: curbProfile(c) } : {}) };
}

// A choice that bills exactly what no choice would, so Use this stores none.
const curbIsRecipe = (pick, fam) => (fam === "fundo" || fam === "linear"
  ? !pick || (pick.sub === "lean" && !pick.len && !pick.profile)
  : !pick || !!pick.none);

/**
 * The curb popover's rows — Style (plus No curb) → Profile (AT only) →
 * Length (Auto first) — each chip's `next` the choice it drafts and its `ok`
 * whether the style is made at that length. `recipe` says the draft bills
 * what no choice would.
 */
export function curbOptions(pick, openLen, fam) {
  const all = group("curb").filter((c) => c.len);
  const result = resolveCurb(pick, openLen, fam);
  const cur = result.item;
  const sub = cur ? cur.sub : null;
  const soAll = (list) => list.length > 0 && !list.some((c) => c.stock);
  const styles = [
    ...CURB_STYLES.filter(([k]) => all.some((c) => c.sub === k)).map(([key, label]) => ({
      key, label, ok: true, so: soAll(all.filter((c) => c.sub === key)), on: key === sub, next: { sub: key },
    })),
    { key: "none", label: "No curb", ok: true, so: false, on: !cur, next: { none: true } },
  ];
  const inStyle = sub ? all.filter((c) => c.sub === sub) : [];
  const profs = [...new Set(inStyle.map(curbProfile))];
  const prof = cur && profs.length > 1 ? curbProfile(cur) : null;
  const profiles = prof ? profs.map((p) => ({
    key: p, label: p === "lean" ? "Lean" : "Full foam", ok: true, so: soAll(inStyle.filter((c) => curbProfile(c) === p)),
    on: p === prof, next: { ...pick, sub, profile: p },
  })) : [];
  const inProf = prof ? inStyle.filter((c) => curbProfile(c) === prof) : inStyle;
  const base = sub ? { sub, ...(prof && pick && pick.profile ? { profile: prof } : {}) } : null;
  const lengths = sub ? [
    { key: "auto", label: "Auto", ok: true, so: false, on: !(pick && pick.len), next: base },
    ...[...new Set(all.map((c) => c.len))].sort((a, b) => a - b).map((L) => {
      const at = inProf.filter((c) => c.len === L);
      return { key: String(L), label: L + '"', ok: at.length > 0, so: soAll(at), on: !!(pick && pick.len === L), next: { ...base, len: L } };
    }),
  ] : [];
  return { styles, profiles, lengths, result, recipe: curbIsRecipe(pick, fam) };
}

/** The curb a saved marker bills (tile sf reads it): a legacy curbKey as saved, else the choice resolved at the marker's own opening. */
export function markerCurbKey(cfg) {
  const pan = cfg && cfg.panKey ? item(cfg.panKey) : null;
  if (!pan) return null;
  if (!cfg.curbPick && cfg.curbKey !== undefined) return cfg.curbKey;
  const room = cfg.room ? { w: +cfg.room.w || 0, d: +cfg.room.d || 0 } : panRoomDims(pan);
  const walls = cfg.walls && cfg.walls.length ? cfg.walls : defaultWalls(pan, cfg.room || null);
  const benches = (cfg.benches || []).map((b) => normBench(b, room));
  const r = resolveCurb(cfg.curbPick, openLenOf(room, walls, cfg.corners, benches), familyOf(pan));
  return r.item ? r.item.key : null;
}

/** A marker's curb choice for the popup: its curbPick, else an old curbKey translated at the marker's own opening. */
export function curbPickOf(cfg) {
  if (!cfg || cfg.curbPick) return cfg ? cfg.curbPick : undefined;
  const pan = cfg.panKey ? item(cfg.panKey) : null;
  if (!pan || cfg.curbKey === undefined) return undefined;
  const room = cfg.room ? { w: +cfg.room.w || 0, d: +cfg.room.d || 0 } : panRoomDims(pan);
  const walls = cfg.walls && cfg.walls.length ? cfg.walls : defaultWalls(pan, cfg.room || null);
  const benches = (cfg.benches || []).map((b) => normBench(b, room));
  return legacyCurbPick(cfg.curbKey, familyOf(pan), openLenOf(room, walls, cfg.corners, benches));
}

```
`panRoomDims` is declared later in the module, as an `export const`. Every use
above runs at call time, after module init, so the reference is safe.

- [ ] **Step 4: `kitFor` and `buildFromMarker` use it**

In `kitFor`'s `// --- curb` section, replace
```js
  const openLen = curbRuns(roomDims, walls, opts.corners, benches).openLen
    || (benches.length ? 0 : roomDims.w);
  let curbKey = opts.curbKey;
  if (curbKey === undefined && fam === "fundo") curbKey = openLen > 60 ? SKU.curbLean96 : SKU.curbLean60;
  if (curbKey === undefined && fam === "linear") curbKey = SKU.curbLean60;
  if (curbKey && openLen > 0) {
    const curb = item(curbKey);
    const per = curb && curb.len ? curb.len : 0;
    const n = per ? Math.max(1, Math.ceil((openLen - 0.01) / per)) : 1;
    push(lines, curb, n, "floor",
      n > 1 ? round2(openLen) + '" of open edge — cut to fit'
        : per > openLen ? "cut to " + round2(openLen) + '"' : "", true);
  }
```
with
```js
  const openLen = openLenOf(roomDims, walls, opts.corners, benches);
  // an old marker's resolved curbKey reads as the choice it stood for (ADR 0049)
  const curbPick = opts.curbPick !== undefined ? opts.curbPick : legacyCurbPick(opts.curbKey, fam, openLen);
  const curb = resolveCurb(curbPick, openLen, fam);
  if (curb.item && curb.qty > 0) push(lines, curb.item, curb.qty, "floor", curb.note, true);
```
In the `cfg` object, replace `    curbKey: curbKey || null,` with
`    ...(curbPick ? { curbPick } : {}),`.

In the returned object, replace
`    mode: opts.mode || (option ? "custom" : "kit"), cfg: cfg,` with
`    mode: opts.mode || (option ? "custom" : "kit"), cfg: cfg, curbFit: { openLen, fam },`.

In `buildFromMarker`, replace `    curbKey: cfg.curbKey,` with
`    curbPick: cfg.curbPick, curbKey: cfg.curbKey,`.

- [ ] **Step 5: `showersf.js` reads the curb the marker bills**

In `src/showersf.js`:
- Replace the wedi import
  `import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims } from "./wedi.js";`
  with
  `import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims, markerCurbKey } from "./wedi.js";`.
- In `wediPieces`, replace
  ```js
    const inset = cfg.maxIn && cfg.curbKey ? curbInsets(room, walls, cfg.curbKey, cfg.tileT) : null;
  ```
  with
  ```js
    // a 1b marker names a curb choice, not a part (ADR 0049) — resolve it as the engine does
    const curbKey = markerCurbKey(cfg);
    const inset = cfg.maxIn && curbKey ? curbInsets(room, walls, curbKey, cfg.tileT) : null;
  ```
- Replace
  ```js
    const c = cfg.curbKey ? item(cfg.curbKey) : null;
    const curb = !cfg.curbKey ? 0
  ```
  with
  ```js
    const c = curbKey ? item(curbKey) : null;
    const curb = !curbKey ? 0
  ```
- Replace `    w: room.w, d: room.d, curbed: !!cfg.curbKey,` with
  `    w: room.w, d: room.d, curbed: !!curbKey,`.

- [ ] **Step 6: Run the suite, golden included**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`

Expected: `# fail 0`. The Task 1 golden must pass untouched, all 840 curb rows.
If a golden row fails, the translation is wrong: fix the code, never the golden.

Also still green:
- the older `showersf` tests, which pass `curbKey` explicitly and take the
  legacy path;
- the 1a wedi round-trip tests.

- [ ] **Step 7: Lint and commit**

```bash
npx eslint src/wedi.js src/showersf.js src/wedi.test.js src/showersf.test.js
git add src/wedi.js src/showersf.js src/wedi.test.js src/showersf.test.js
git commit -m "wedi: the curb choice rides the marker as curbPick and re-fits the opening; old curbKeys translate; tile sf follows (ticket 158 Phase 1b)"
```

---

### Task 7: wedi wall panel and fastener kit — `panelOptions`, `fastenerKits`, keys written only when picked

**Files:**
- Modify: `src/wedi.js`:
  - the panel/fastener block, inserted above the
    `/**\n * What one unit covers` doc comment, after Task 6's block
  - `figureConsumables`
  - `kitFor` (`sheets`, `con`, `cfg`)
  - `buildFromMarker`
- Test: `src/wedi.test.js`, and the Task 1 golden's panel rows

**Interfaces:**
- Consumes: `group`, `item`, `SKU`, `inch`, `ftLbl`, `byStockThenPrice`,
  `CONSUMABLES` (existing).
- Produces:
  - `panelOptions(key) → { cur, types, thicknesses, sizes }`.
    - Chips are `{ key, label, ok, so, on, next }`, and `next` is a panel key.
      Each chip lands on its best panel: stocked first, then the cheapest.
    - Type keys are `board | vapor | kit`. Size keys are `"<w>x<d>"`.
      Thickness keys are `String(t)`; labels are `inch(t) + '"'`.
  - `panelSheets(sf, panel) → number`, which `kitFor` uses for the wall line.
  - `fastenerKits() → [entry]`: the boxed kits, `US5000070` and `US5000086`.
  - `figureConsumables(panelSf, form, fastenerKey?)`: a picked kit counts by its
    own `N ct`, and the house kit keeps `CONSUMABLES.fastenerKitCt`.
  - `kitFor`:
    - `cfg.panelKey` is written only when the panel isn't `SKU.panelDefault`;
    - `opts.fastenerKey` is read, and `cfg.fastenerKey` is written only when
      not the house kit.

- [ ] **Step 1: Write the failing tests**

Extend the `src/wedi.test.js` import so it ends:
```js
  wediSlotOf, coverPickApplies,
  resolveCurb, legacyCurbPick, curbOptions, curbPickOf, markerCurbKey,
  panelOptions, panelSheets, fastenerKits,
} from "./wedi.js";
```
Append:
```js

// --- Phase 1b: wall panel and fastener kit choices (ticket 158) -------------

test("panelOptions: Type → Thickness → Size, each chip landing on a stocked panel first", () => {
  const o = panelOptions(undefined);
  assert.equal(o.cur.key, "US8000017");
  assert.deepEqual(o.types.map((c) => [c.key, c.label, c.next, c.so, c.on]), [
    ["board", "Standard", "US8000017", false, true], ["vapor", "Vapor 85", "US8000026", false, false], ["kit", "Panel kit", "US4000001", true, false]]);
  assert.deepEqual(o.thicknesses.map((c) => [c.label, c.next, c.so]), [
    ['1/8"', "US8000006", false], ['1/4"', "US8000013", false], ['1/2"', "US8000017", false], ['5/8"', "US8000011", true],
    ['3/4"', "US8000018", true], ['1"', "US8000022", false], ['1 1/2"', "US8000019", true], ['2"', "US8000020", false]]);
  assert.deepEqual(o.sizes.map((c) => [c.key, c.label, c.next, c.so, c.on]), [
    ["36x60", "3'×5'", "US8000017", false, true], ["48x96", "4'×8'", "US8000015", false, false],
    ["48x60", "4'×5'", "US8000014", false, false], ["32x48", "2'8\"×4'", "US8000032", true, false]]);
  // the special-order 4×8 twin never becomes a chip — its size chip lands the stocked sheet
  assert.deepEqual(panelOptions("US8000010").sizes.find((c) => c.key === "48x96"), { key: "48x96", label: "4'×8'", ok: true, so: false, on: true, next: "US8000015" });
});

test("kitFor: panelKey is written only when picked; the sheet count re-fits", () => {
  assert.equal("panelKey" in kitFor("US9100004").cfg, false);
  assert.equal("panelKey" in kitFor("US9100004", { panelKey: SKU.panelDefault }).cfg, false);
  const k = kitFor("US9100004", { room: { w: 60, d: 36 }, panelKey: "US8000015" });
  assert.equal(k.cfg.panelKey, "US8000015");
  assert.deepEqual(k.lines.filter((l) => l.item.group === "panel").map((l) => [l.item.key, l.qty]), [["US8000015", 3]]);
  assert.equal(panelSheets(96, item("US8000015")), 3);
});

test("fastener kits: the two boxed kits; a pick bills by its own count and rides the marker", () => {
  assert.deepEqual(fastenerKits().map((f) => f.key), ["US5000070", "US5000086"]);
  const f = (k) => k.lines.filter((l) => l.item.group === "fastener").map((l) => [l.item.key, l.qty]);
  const k = kitFor("US9100004", { fastenerKey: "US5000086" });
  assert.deepEqual(f(k), [["US5000086", 1]]);
  assert.equal(k.cfg.fastenerKey, "US5000086");
  assert.equal("fastenerKey" in kitFor("US9100004").cfg, false);
  assert.deepEqual(f(kitFor("US9100004", { fastenerKey: "NOPE" })), [["US5000070", 1]]);
  const walls = [{ len: 72, h: 96, side: "back" }, { len: 72, h: 96, side: "left" }, { len: 72, h: 96, side: "right" }];
  assert.deepEqual(f(kitFor("US9100016", { walls, fastenerKey: "US5000086" })), [["US5000086", 2]]);
});

test("every 1b wedi pick survives the marker: lineItems → buildFromMarker bills the same, cfg stable", () => {
  for (const opts of [{ curbPick: { sub: "cap", len: 96 } }, { curbPick: { none: true } }, { curbPick: { sub: "at", profile: "full" } },
    { panelKey: "US8000026" }, { fastenerKey: "US5000086" }]) {
    const k = kitFor("US9100004", { room: { w: 60, d: 36 }, ...opts });
    const rows = lineItems(k, {});
    const back = buildFromMarker({ mode: rows[0].wedi.mode, cfg: rows[0].wedi.cfg });
    assert.deepEqual(back.lines.map((l) => l.item.key + "×" + l.qty), k.lines.map((l) => l.item.key + "×" + l.qty), JSON.stringify(opts));
    assert.deepEqual(back.cfg, k.cfg, JSON.stringify(opts));
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/wedi.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL. `panelOptions` is not exported.

- [ ] **Step 3: The panel/fastener block**

In `src/wedi.js`, insert immediately above the doc comment
`/**\n * What one unit covers — { n, unit: "sf" | "lf" } for rolls, membranes and`.
That puts it after Task 6's `curbPickOf`:
```js
// Wall panels by Type → Thickness → Size (ticket 158 Phase 1b). The part is
// the choice (the sheet count re-fits), so each chip names the panel it lands
// on: stocked first, then the cheapest — a special-order twin of a stocked
// sheet is never a chip.
const PANEL_TYPE = { board: "Standard", vapor: "Vapor 85", kit: "Panel kit" };
const panelSize = (p) => p.w + "x" + p.d;
export const panelSheets = (sf, panel) => (panel && panel.sf ? Math.ceil(sf / panel.sf) : 0);

/** The wall-panel popover's rows for the drafted panel `key` (the house panel when none). */
export function panelOptions(key) {
  const all = group("panel").filter((p) => p.sf > 0);
  const cur = (key && all.find((p) => p.key === key)) || item(SKU.panelDefault);
  if (!cur) return { cur: null, types: [], thicknesses: [], sizes: [] };
  const best = (list) => list.slice().sort(byStockThenPrice)[0] || null;
  const chip = (key2, label, p, on) => ({ key: key2, label, ok: !!p, so: !!p && !p.stock, on, next: p ? p.key : null });
  const types = [...new Set(all.map((p) => p.sub))].map((s) => {
    const l = all.filter((p) => p.sub === s);
    const p = best(l.filter((x) => x.t === cur.t && panelSize(x) === panelSize(cur))) || best(l.filter((x) => x.t === cur.t)) || best(l);
    return chip(s, PANEL_TYPE[s] || s, p, s === cur.sub);
  });
  const inType = all.filter((p) => p.sub === cur.sub);
  const thicknesses = [...new Set(inType.map((p) => p.t))].sort((a, b) => a - b).map((t) => {
    const l = inType.filter((p) => p.t === t);
    return chip(String(t), inch(t) + '"', best(l.filter((x) => panelSize(x) === panelSize(cur))) || best(l), t === cur.t);
  });
  const inThick = inType.filter((p) => p.t === cur.t);
  const sizes = [...new Set(inThick.map(panelSize))].map((s) => {
    const p = best(inThick.filter((x) => panelSize(x) === s));
    return chip(s, ftLbl(p.w) + "×" + ftLbl(p.d), p, s === panelSize(cur));
  });
  return { cur, types, thicknesses, sizes };
}

/** The fastener kits a build can take in place of the house kit — screws and washers boxed together. */
export function fastenerKits() {
  return group("fastener").filter((f) => /kit/i.test(f.name) && f.sub !== "vapor");
}

```

- [ ] **Step 4: `figureConsumables`, `kitFor`, `buildFromMarker`**

**`figureConsumables`.** Replace `export function figureConsumables(panelSf, form) {` with
`export function figureConsumables(panelSf, form, fastenerKey) {`. Then replace
```js
    const fastenerKit = item(SKU.fastenerKit);
    const sealant = sealantItem(form, false);
    if (fastenerKit) lines.push({
      item: fastenerKit, qty: Math.ceil(fastenerCount / CONSUMABLES.fastenerKitCt),
```
with
```js
    // a swapped kit (Phase 1b) counts by its own "N ct"; the house kit keeps the recipe's 100
    const picked = fastenerKey ? item(fastenerKey) : null;
    const fastenerKit = picked && picked.group === "fastener" ? picked : item(SKU.fastenerKit);
    const ctM = picked && picked === fastenerKit ? /(\d+)\s*ct/i.exec(fastenerKit.sizeText || "") : null;
    const sealant = sealantItem(form, false);
    if (fastenerKit) lines.push({
      item: fastenerKit, qty: Math.ceil(fastenerCount / (ctM ? +ctM[1] : CONSUMABLES.fastenerKitCt)),
```

**`kitFor`:**
- Replace `  const sheets = panel && panel.sf ? Math.ceil(panelSf / panel.sf) : 0;` with
  `  const sheets = panelSheets(panelSf, panel);`.
- Replace `  const con = figureConsumables(panelSf + bl.surfSf, form);` with:
  ```js
    const con = figureConsumables(panelSf + bl.surfSf, form, opts.fastenerKey);
    const fastener = con.lines.find((l) => l.item.group === "fastener");
  ```
- In the `cfg` object, replace
  ```js
      panKey: pan.key, walls: cfgWalls, panelKey: panel ? panel.key : null,
      ...(curbPick ? { curbPick } : {}),
  ```
  with
  ```js
      panKey: pan.key, walls: cfgWalls,
      ...(panel && panel.key !== SKU.panelDefault ? { panelKey: panel.key } : {}),
      ...(curbPick ? { curbPick } : {}),
      ...(fastener && fastener.item.key !== SKU.fastenerKit ? { fastenerKey: fastener.item.key } : {}),
  ```

**`buildFromMarker`.** Replace `    curbPick: cfg.curbPick, curbKey: cfg.curbKey,` with
`    curbPick: cfg.curbPick, curbKey: cfg.curbKey, fastenerKey: cfg.fastenerKey,`.

- [ ] **Step 5: Run the suite, golden included**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`

Expected: `# fail 0`.
- The golden's 17 panel rows pass: an old default `panelKey` reads as the
  default, and any other key bills that panel.
- 1a's "cfg round-trips: reconfigure rebuilds the same lines" passes, since
  `panelKey` is now `undefined` for a default kit.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint src/wedi.js src/wedi.test.js
git add src/wedi.js src/wedi.test.js
git commit -m "wedi: wall-panel options by type/thickness/size, fastener-kit choice; panelKey/fastenerKey written only when picked (ticket 158 Phase 1b)"
```

---

### Task 8: Schluter popup — ⇄ on membrane, band, fasteners and bench boards

**Files:**
- Modify: `src/swappop.jsx` (`stockFirst`)
- Modify: `src/SchluterConfigurator.jsx`:
  - imports
  - `swapChoices` and the new `canSwap` / `steppedKind`
  - `openSwap`
  - the build-line ⇄ condition
  - the new `steppedPanel`
  - `swapPanel`
- Modify: `src/schluterpreview.jsx` (a 7¼″ band row)
- Create: `.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs`

**Interfaces:**
- Consumes:
  - `membraneOptions`, `bandOptions`, `bandWidthLabel` (Task 4);
  - `build.need` (Task 4);
  - `l.bench` and `swaps.fastener` (Task 5);
  - `SwapPop`, `fmDelta`, `inchGlyph` (Tasks 2–3).
- Produces:
  - popup `swap` state gains `{ stepped: "membrane" | "band", draft }`;
  - `SwapPop` gains `stockFirst` (default `false`): under Stock only, a row lists
    its stocked chips first. The sort is stable, so Auto stays first.

- [ ] **Step 1: `SwapPop` orders stocked chips first**

In `src/swappop.jsx`, replace
`export function SwapPop({ at, className = "", title, rows, summary, onUse, onClose }) {`
with
```jsx
// Under Stock only a row lists its stocked chips first (a stable sort, so
// Auto keeps its place ahead of them).
const stockOrder = (chips) => [...chips].sort((a, b) => (a.so ? 1 : 0) - (b.so ? 1 : 0));

export function SwapPop({ at, className = "", title, rows, summary, onUse, onClose, stockFirst = false }) {
```
and replace `            {r.chips.map((c) => (` with
`            {(stockFirst ? stockOrder(r.chips) : r.chips).map((c) => (`.

- [ ] **Step 2: Imports and the list swaps**

In `src/SchluterConfigurator.jsx`:
- In the `./schluter.js` import, replace
  `  resolveDrain, FINISH_LABEL, VARIO_DESIGN, pointGrateLabel,` with
  `  resolveDrain, FINISH_LABEL, VARIO_DESIGN, pointGrateLabel, membraneOptions, bandOptions, bandWidthLabel,`.
- Replace the whole `swapChoices` arrow: it starts
  `  const swapChoices = (l) => {` and ends at its closing `  };` just above the
  `// Every drain line's ⇄ opens the stepped drain popover` comment. The
  replacement:
```js
  const setBenchPick = (bi, patch) => setBenches((xs) => xs.map((b, j) => (j === bi ? { ...b, ...patch } : b)));
  const swapChoices = (l) => {
    const e = l.item;
    if (l.noteOnly) return null;
    if (l.g === "Curb" && e.g === "curb" && e.len) return {
      title: "Curb",
      list: pool(cat.filter((i) => i.g === "curb" && i.len)).slice().sort((a, b2) => a.len - b2.len),
      set: (sku) => setSwaps((o) => ({ ...o, curb: sku })),
    };
    if (l.g === "Walls" && e.g === "board" && !e.fastener && !panelFit) return {
      title: "Wall board — one size",
      list: pool(halfBoardPool(cat, "all")).sort(byShelf),
      set: (sku) => setSwaps((o) => ({ ...o, board: sku })),
    };
    if (l.g === "Walls" && e.fastener) return {
      title: "Board fasteners",
      list: pool(cat.filter((i) => i.fastener)).sort(byShelf),
      set: (sku) => setSwaps((o) => ({ ...o, fastener: sku })),
    };
    // bench lines carry their bench's index (buildKit): the pick rides that bench row
    if (l.bench != null && e.g === "board") return {
      title: e.thick2 ? "Bench build-up board" : "Bench wrap board",
      list: pool(cat.filter((i) => i.g === "board" && !i.fastener && i.sf && !!i.thick2 === !!e.thick2)).sort(byShelf),
      set: (sku) => setBenchPick(l.bench, { board: sku }),
    };
    if (l.bench != null && e.extra === "bench") return {
      title: "Premade bench",
      list: pool(cat.filter((i) => i.extra === "bench" && !!(i.bench && i.bench.corner) === !!(e.bench && e.bench.corner))).sort(byShelf),
      set: (sku) => setBenchPick(l.bench, { part: sku }),
    };
    return null;
  };
  // ⇄ shows only where the catalog offers a real alternative
  const canSwap = (l) => { const ch = swapChoices(l); return !!ch && ch.list.length > 1; };

  // KERDI membrane and KERDI-BAND lines open the stepped popover (Phase 1b):
  // Width → Roll, the choice riding cfg.swaps.membrane / cfg.swaps.band.
  const steppedKind = (l) => {
    if (l.noteOnly || !build) return null;
    if (l.g === "Walls" && l.item.g === "membrane") return cat.filter((i) => i.g === "membrane").length > 1 ? "membrane" : null;
    if (l.g === "Seams" && l.item.g === "seam" && l.item.lf) return cat.filter((i) => i.g === "seam" && i.lf).length > 1 ? "band" : null;
    return null;
  };
```
`setBenches` is the existing bench-row state setter. Its rows are
`cfg.benches` in the same order, so `l.bench` indexes them.

- [ ] **Step 3: `openSwap` and the ⇄ condition**

Replace `openSwap`:
```js
  const openSwap = (l, ev) => {
    const kind = drainKind(l);
    const grate = kind === "point" && build.lines.find((x) => x.g === "Drain" && x.item.part === "grate");
    setSwap({
      key: l.item.sku || l.item.name, rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(".bline"),
      ...(kind === "linear" ? { drain: kind, draft: { ...(drainPick || { family: "vario" }) } }
        : kind === "point" ? { drain: kind, draft: grate ? grate.item.sku : pointGrates()[0].sku } : {}),
    });
  };
```
with
```js
  const openSwap = (l, ev) => {
    const kind = drainKind(l);
    const stepped = !kind && steppedKind(l);
    const grate = kind === "point" && build.lines.find((x) => x.g === "Drain" && x.item.part === "grate");
    setSwap({
      key: l.item.sku || l.item.name, rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(".bline"),
      ...(kind === "linear" ? { drain: kind, draft: { ...(drainPick || { family: "vario" }) } }
        : kind === "point" ? { drain: kind, draft: grate ? grate.item.sku : pointGrates()[0].sku }
          : stepped ? { stepped, draft: { ...(swaps[stepped] || {}) } } : {}),
    });
  };
```
In the build column's line render, replace
`                      {(drainKind(l) || swapChoices(l)) && (` with
`                      {(drainKind(l) || steppedKind(l) || canSwap(l)) && (`.

- [ ] **Step 4: The stepped panel**

Replace
```js
  const swapPanel = (() => {
    if (!swap || !build) return null;
    if (swap.drain) return drainPanel();
```
with
```js
  // The membrane / band popover — the drain popover's draft model: chips edit
  // `swap.draft`, the Δ reads it against the lines the bill carries now, and
  // Use this commits it (a draft that bills the default stores no pick).
  const steppedPanel = () => {
    const mem = swap.stepped === "membrane";
    const draft = swap.draft || {};
    const setDraft = (next) => setSwap((sw) => (sw ? { ...sw, draft: next } : sw));
    const o = mem ? membraneOptions(draft, build.need.wallSf, cat, { source }) : bandOptions(draft, build.need.bandLf, cat, { source });
    const g = mem ? "Walls" : "Seams";
    const cur = build.lines.filter((l) => l.g === g && (mem ? l.item.g === "membrane" : l.item.lf));
    const total = (lines) => round2(lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
    const curTotal = total(cur), next = total(o.result.lines);
    const d = round2(next - curTotal);
    const chip = (c) => ({ ...c, onPick: () => setDraft(c.next) });
    const rows = [
      { label: "Width", chips: o.widths.map((c) => ({ ...chip(c), label: mem ? c.label : inchGlyph(c.label) })) },
      { label: "Roll", chips: o.rolls.map(chip) },
    ];
    const lineWord = (p) => mem
      ? `${p.qty} × ${p.item.wide ? "wide " : ""}${parseInt(p.item.roll, 10)} m roll · ${p.item.sf} sf`
      : `${p.qty} × ${inchGlyph(bandWidthLabel(p.item.width))} band, ${parseInt(p.item.roll, 10)} m · ${p.item.lf} lf`;
    const what = o.result.lines.map(lineWord).join(" + ") || "Nothing in the books";
    const why = o.result.subst || (mem ? `${Math.round(build.need.wallSf)} sf of wall with laps` : `${Math.round(build.need.bandLf)} lf of seams + tray perimeter`);
    const commit = mem ? (draft.wide || draft.roll ? draft : null) : (draft.width || draft.roll ? draft : null);
    const r = swap.rect;
    return (
      <SwapPop at={{ anchor: swap.anchor, x: r.right - 470, y: r.bottom + 6 }} className="sch-swappanel"
        title={mem ? "Swap the KERDI membrane" : "Swap the KERDI-BAND"} rows={rows} stockFirst={source === "stock"}
        summary={{ what, why, delta: fmDelta(d), total: fm(next), up: d > 0 }}
        onUse={() => {
          setSwaps((sw) => { const n = { ...sw }; if (commit) n[swap.stepped] = commit; else delete n[swap.stepped]; return n; });
          const keys = new Set([...cur, ...o.result.lines.map((p) => ({ g, item: p.item }))].map(ovKey));
          setQtyOv((q) => Object.fromEntries(Object.entries(q).filter(([k]) => !keys.has(k))));
          setSwap(null);
        }}
        onClose={() => setSwap(null)} />
    );
  };

  const swapPanel = (() => {
    if (!swap || !build) return null;
    if (swap.drain) return drainPanel();
    if (swap.stepped) return steppedPanel();
```
`round2`, `ovKey`, `fm`, `tierOf`, `source`, `setSwaps` and `setQtyOv` are
already in scope. The list popover below keeps its one-click markup unchanged.
Esc and outside clicks already clear `swap`, so they discard the draft.

- [ ] **Step 5: A second band width in the preview harness**

In `src/schluterpreview.jsx`, immediately after the KERDI-LINE slice's
`].forEach(([sku, description, size, cost]) => eftRows.push(normOrderItem({ … })));`
statement, add:
```js

// A second KERDI-BAND width (ticket 158 Phase 1b) so the band ⇄ shows a Width
// row: the 7-1/4" full roll, special order. Illustrative cost, not an EFT figure.
eftRows.push(normOrderItem({
  sku: "SLRKEBA100/185", bookId: "bk_eft", unit: "RL", cost: 93.2, size: "98'5\" roll",
  description: lead('Kerdi-Band 7-1/4" Seam Band'), leadTime: "READY SHIP",
}));
```

- [ ] **Step 6: Suite, lint, build**

```bash
npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"
npx eslint src/swappop.jsx src/SchluterConfigurator.jsx src/schluterpreview.jsx
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build 2>&1 | grep -E "built in|rror"
```
Expected: `# fail 0`, lint clean, and `✓ built in`.

- [ ] **Step 7: Preview proof**

Create `.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs`:
```js
// Proof: ⇄ on every Schluter line (ticket 158 Phase 1b) — the membrane and
// band stepped popovers with a draft and Δ, the fastener list swap, a bench
// wrap swap, and a one-part line (the 2″ build-up board) with no ⇄.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1b";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const popText = async () => flat(await pg.locator("[data-drain-swap]").innerText());
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name) }) });
const grpText = async (name) => flat(await grp(name).innerText());
const openIn = async (name, nth = 0) => { await grp(name).locator("[data-schluter-swapb]").nth(nth).click(); await pg.waitForTimeout(300); };

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);

// membrane: Width → Roll, a draft with its Δ; the bill holds until Use this
const wallsBefore = await grpText("Walls");
await openIn("Walls");
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
console.log("membrane:", await popText());
await shot("s1-membrane-popover");
await pg.locator('[data-drain-chip="Width:wide"]').click(); await pg.waitForTimeout(300);
const wideText = await popText();
console.log("wide draft:", wideText);
if (!/wide 15 m roll/.test(wideText) || /±0/.test(wideText)) fail("wide draft lacks its roll or Δ");
if ((await grpText("Walls")) !== wallsBefore) fail("the bill moved under a membrane draft");
await shot("s2-membrane-wide-draft");
await pg.locator('[data-drain-chip="Width:standard"]').click();
await pg.locator('[data-drain-chip="Roll:5M"]').click(); await pg.waitForTimeout(300);
console.log("5 m draft:", await popText());
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const wallsAfter = await grpText("Walls");
console.log("walls after Use this:", wallsAfter);
if (!/KERDI200\/5M/.test(wallsAfter)) fail("Use this did not land the 5 m roll");

// band: the 7-1/4" width is special order — its chip carries the SO dot
await openIn("Seams");
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
if (!(await pg.locator('[data-drain-chip="Width:185"] [data-so-dot]').count())) fail("the special-order band width has no SO dot");
await pg.locator('[data-drain-chip="Width:185"]').click(); await pg.waitForTimeout(300);
const bandText = await popText();
console.log("band 7¼ draft:", bandText);
if (!/7¼″ band/.test(bandText)) fail("band draft does not name the 7¼″ width");
await shot("s3-band-185-draft");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const seams = await grpText("Seams");
console.log("seams after Use this:", seams);
if (!/KEBA100\/185/.test(seams)) fail("Use this did not land the 7¼″ band");

// fasteners: a list swap on KERDI-BOARD walls (one click, applies at once)
await pg.locator("[data-schluter-kits-board]").click(); await pg.waitForTimeout(400);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(600);
if (await pg.locator("[data-kit-confirm]").count()) { await pg.locator("[data-kit-overwrite]").click(); await pg.waitForTimeout(600); }
const fast = grp("Walls").locator(".bline", { hasText: /screws/i });
await fast.locator("[data-schluter-swapb]").click(); await pg.waitForTimeout(300);
await shot("s4-fastener-list");
await pg.locator(".sch-swappanel [data-schluter-swaprow]", { hasText: "40 ct" }).click(); await pg.waitForTimeout(500);
const fastText = flat(await fast.innerText());
console.log("fastener after pick:", fastText);
if (!/KBZS35GT32Z ·/.test(fastText)) fail("the 40-ct box did not land");

// benches: the framed wrap swaps (two ½″ boards); the 2″ build-up has one part — no ⇄
await pg.locator("[data-schluter-benchchip]").click(); await pg.waitForTimeout(300);
await pg.locator("[data-schluter-benchpick-framed]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-schluter-benchchip]").click(); await pg.waitForTimeout(300);
await pg.locator("[data-schluter-benchpick-site]").click(); await pg.waitForTimeout(600);
const wrap = grp("Extras").locator(".bline", { hasText: /1\/2/ }).first();
const buildup = grp("Extras").locator(".bline", { hasText: /2"|2″/ }).last();
console.log("extras:", await grpText("Extras"));
if (!(await wrap.locator("[data-schluter-swapb]").count())) fail("the framed wrap board has no ⇄");
if (await buildup.locator("[data-schluter-swapb]").count()) fail("the one-part 2″ build-up board shows a ⇄");
await grp("Extras").evaluate((el) => el.scrollIntoView({ block: "center" }));
await shot("s5-bench-lines");

await b.close();
if (err) process.exit(1);
```
Run:
```bash
npx vite --port 5199 --strictPort &
node .scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs; echo "exit $?"
```
Expected: `exit 0`, no `FAIL:` or `PAGEERROR`. The logs include:
- `wide draft: … | 1 × wide 15 m roll · 323 sf | 87 sf of wall with laps | +$351.83 · $559.48 | Use this`
- `band 7¼ draft: … | WIDTH | 5″ | 7¼″ | ROLL | Auto | 30 m · 98 lf | 1 × 7¼″ band, 30 m · 98 lf | …`

Read `s1`–`s5`. Check that:
- the Width/Roll rows and the summary strip render;
- the 7¼″ chip shows the SO dot;
- the build-up board line has no ⇄.

Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/swappop.jsx src/SchluterConfigurator.jsx src/schluterpreview.jsx .scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs .scratch/158_shower-config-roadmap/p1b/s*.png
git commit -m "Schluter popup: ⇄ on membrane and band (stepped), fasteners and bench boards (list); ⇄ only with a real alternative (ticket 158 Phase 1b)"
```

---

### Task 9: wedi popup — ⇄ on curb and wall panel (stepped), fastener kit (list)

**Files:**
- Modify: `src/WediConfigurator.jsx`:
  - imports
  - `DEF_OPTS`
  - `seedState`
  - `kitDirty`
  - the `build` memo's `kitFor` options
  - `resetBuild`
  - `insetFor`
  - `insetSigOf`
  - `swapChoices`
  - the build-line ⇄
  - the new `curbPanel` / `panelPanel`
  - `swapPanel`
  - the wall menu's "Turn into a curb"
- Create: `.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs`

**Interfaces:**
- Consumes:
  - `resolveCurb`, `curbOptions`, `curbPickOf`, `build.curbFit` (Task 6);
  - `panelOptions`, `panelSheets`, `fastenerKits` (Task 7);
  - `coverPickApplies` (Task 3);
  - `SwapPop` with `stockFirst`, `fmDelta`, `inchGlyph`.
- Produces: popup `opts` holds `curbPick` and `fastenerKey`; `curbKey` is gone.
  - `kitFor` gets `curbPick`, `fastenerKey`, `panelKey`, `coverPick`.
  - A re-solved room (`resetBuild(true)`) keeps `coverPick` **and** `curbPick`:
    both name a choice, so they re-fit.

- [ ] **Step 1: Imports, options, seed, dirty, build**

In `src/WediConfigurator.jsx`:

**Imports.**
- Remove `curbs, ` from the first line of the `./wedi.js` import, which becomes
  `  item, group, pans, kitFor, solve, figureConsumables, panelPlan,`. The new
  curb popover replaces its only use.
- Replace
  `  BENCH_CORNER_LBL, buildFromMarker, sessionFromRows, wediSlotOf, coverStyles, legacyCoverPick, coverPickApplies,\n} from "./wedi.js";`
  with:
  ```js
    BENCH_CORNER_LBL, buildFromMarker, sessionFromRows, wediSlotOf, coverStyles, legacyCoverPick, coverPickApplies,
    resolveCurb, curbOptions, curbPickOf, panelOptions, panelSheets, fastenerKits,
  } from "./wedi.js";
  ```
- Replace `import { SwapPop, fmDelta } from "./swappop.jsx";` with
  `import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";`.

**`DEF_OPTS`.** Replace it with:
```js
const DEF_OPTS = { panelKey: undefined, curbPick: undefined, fastenerKey: undefined, coverPick: undefined, coverFrame: undefined, sealantForm: "tube", recess: undefined };
```

**`seedState`'s `s.opts`.** Replace
```js
      panelKey: cfg.panelKey || undefined,
      curbKey: cfg.curbKey === undefined ? undefined : cfg.curbKey,
      coverPick: cfg.coverPick || legacyCoverPick(cfg.coverKey),
```
with
```js
      // old markers wrote the resolved panel and curb; the recipe's own reads as no pick (ADR 0049)
      panelKey: cfg.panelKey && cfg.panelKey !== SKU.panelDefault ? cfg.panelKey : undefined,
      curbPick: curbPickOf(cfg),
      fastenerKey: cfg.fastenerKey || undefined,
      coverPick: cfg.coverPick || legacyCoverPick(cfg.coverKey),
```

**`kitDirty`.** Replace
`    || opts.panelKey !== undefined || opts.curbKey !== undefined` with
`    || opts.panelKey !== undefined || opts.curbPick !== undefined || opts.fastenerKey !== undefined`.

**`build` memo.** In its `kitFor(panKey, { … })` options, replace
`        panelKey: opts.panelKey, curbKey: opts.curbKey, coverPick: opts.coverPick,` with
`        panelKey: opts.panelKey, curbPick: opts.curbPick, fastenerKey: opts.fastenerKey, coverPick: opts.coverPick,`.

**`resetBuild`.** Replace the block
```js
  // A re-solved room keeps the cover choice: it names a finish, not a part,
  // so it re-fits the new channel (ticket 158 Phase 1a).
  const resetBuild = (keepCover) => {
    setQtyOv({}); setAddons([]); setBenches([]); setBenchMenu(null); setManual([]);
    setOpts((o) => ({ ...DEF_OPTS, coverPick: keepCover ? o.coverPick : undefined }));
  };
```
with
```js
  // A re-solved room keeps the cover and curb choices: they name a finish or
  // a style, not a part, so they re-fit the new room (ADR 0049).
  const resetBuild = (keepChoices) => {
    setQtyOv({}); setAddons([]); setBenches([]); setBenchMenu(null); setManual([]);
    setOpts((o) => ({ ...DEF_OPTS, coverPick: keepChoices ? o.coverPick : undefined, curbPick: keepChoices ? o.curbPick : undefined }));
  };
```

**`insetFor`.**
- Replace
  `    if (!maxOn || i.curb === "curbless" || opts.curbKey === null) return null;` with
  `    if (!maxOn || i.curb === "curbless" || (opts.curbPick && opts.curbPick.none)) return null;`.
- Replace
  `    return curbInsets({ w: +i.w || 0, d: +i.d || 0 }, wl, opts.curbKey || SKU.curbLean60, tileIn);`
  with:
  ```js
      // the inset only needs the style's width, the same at every length
      const picked = opts.curbPick ? resolveCurb(opts.curbPick, 60, "fundo").item : null;
      return curbInsets({ w: +i.w || 0, d: +i.d || 0 }, wl, picked ? picked.key : SKU.curbLean60, tileIn);
  ```

**`insetSigOf`.** Replace `    opts.curbKey === undefined ? "" : opts.curbKey, tileIn]) : "");` with
`    opts.curbPick || "", tileIn]) : "");`.

**Wall menu "Turn into a curb".** Replace
`                setOpts((o) => ({ ...o, curbKey: pan && pan.sub === "curbless" ? SKU.curbLean60 : undefined }));`
with
`                setOpts((o) => ({ ...o, curbPick: pan && pan.sub === "curbless" ? { sub: "lean" } : undefined }));`.

- [ ] **Step 2: `swapChoices` and the ⇄**

In `swapChoices`:
- Replace
  `    if (g === "panel") return { title: "Wall panel", list: bySource(group("panel").filter((p) => p.sf)), set: (k) => setOpts((o) => ({ ...o, panelKey: k || undefined })) };`
  with:
  ```js
      // the walls' panel only — a bench's own sheet is not the wall pick
      if (g === "panel") return line.group === "walls" ? { stepped: "panel" } : null;
  ```
- Replace
  `    if (g === "curb") return { title: "Curb", list: bySource(curbs()), none: "No curb", set: (k) => setOpts((o) => ({ ...o, curbKey: k || null })) };`
  with:
  ```js
      if (g === "curb") return { stepped: "curb" };
      if (g === "fastener" && fastenerKits().some((f) => f.key === line.item.key)) {
        return { title: "Fastener kit", list: bySource(fastenerKits()), set: (k) => setOpts((o) => ({ ...o, fastenerKey: k && k !== SKU.fastenerKit ? k : undefined })) };
      }
  ```

In the build column's line render:
- Replace
  `                  const can = e.group === "panel" && panelFit ? null : swapChoices(l);`
  with:
  ```js
                    const ch = e.group === "panel" && panelFit ? null : swapChoices(l);
                    // ⇄ shows only where the catalog offers a real alternative
                    const can = ch && (ch.drain || ch.stepped || ch.list.length + (ch.none ? 1 : 0) > 1);
  ```
- Replace the ⇄ button line
  `                      {can && <button className="swapb" title="swap" onClick={(ev) => setSwap({ key: e.key, rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(".bline"), ...(e.group === "cover" ? { draft: e.key } : {}) })}>⇄</button>}`
  with:
  ```jsx
                        {can && <button className="swapb" title="swap" data-wedi-swapb={e.key} onClick={(ev) => setSwap({ key: e.key, rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(".bline"),
                          ...(e.group === "cover" || e.group === "panel" ? { draft: e.key } : e.group === "curb" ? { draft: opts.curbPick || null } : {}) })}>⇄</button>}
  ```

- [ ] **Step 3: The curb and panel popovers**

Replace
```js
  const swapPanel = (() => {
    if (!swap || !build) return null;
```
with
```js
  // The curb popover (Phase 1b): Style → Profile (AT) → Length, the draft a
  // curbPick held on `swap`; the length rule lives in resolveCurb, so Auto
  // re-fits when the opening changes.
  const curbPanel = (r) => {
    const { openLen, fam } = build.curbFit;
    const draft = swap.draft || undefined;
    const setDraft = (next) => setSwap((sw) => (sw ? { ...sw, draft: next } : sw));
    const o = curbOptions(draft, openLen, fam);
    const res = o.result;
    const cur = build.lines.filter((l) => l.item.group === "curb");
    const curTotal = round2(cur.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
    const next = res.item ? round2(tierOf(res.item) * res.qty) : 0;
    const chip = (c) => ({ ...c, label: inchGlyph(c.label), title: c.ok ? "" : "not made at this length", onPick: () => setDraft(c.next) });
    const rows = [
      { label: "Style", chips: o.styles.map(chip) },
      { label: "Profile", chips: o.profiles.map(chip) },
      { label: "Length", chips: o.lengths.map(chip) },
    ];
    return (
      <SwapPop at={{ anchor: swap.anchor, x: r.right - 470, y: r.bottom + 6 }} className="wedi-swap wedi-grown"
        title={`Curb — ${round2(openLen)}″ of open edge`} rows={rows} stockFirst={source === "stock"}
        summary={{
          what: res.item ? `${res.qty} × ${unwedi(res.item.name)}${res.item.stock ? "" : " · special order"}` : "No curb",
          why: res.note || (res.item ? "Auto re-fits if the opening changes" : ""),
          delta: fmDelta(round2(next - curTotal)), total: fm(next), up: next > curTotal,
        }}
        onUse={() => {
          setOpts((op) => ({ ...op, curbPick: o.recipe ? undefined : draft }));
          setQtyOv((q) => { const n = { ...q }; cur.forEach((l) => { delete n[l.item.key]; }); if (res.item) delete n[res.item.key]; return n; });
          setSwap(null);
        }}
        onClose={() => setSwap(null)} />
    );
  };

  // The wall-panel popover (Phase 1b): Type → Thickness → Size, the draft a
  // panel key; the sheet count re-fits the wall area (panelSheets).
  const panelPanel = (line, r) => {
    const o = panelOptions(swap.draft);
    const draft = o.cur;
    if (!draft) return null;
    const setDraft = (k) => setSwap((sw) => (sw ? { ...sw, draft: k } : sw));
    const chip = (c) => ({ ...c, label: inchGlyph(c.label), onPick: () => setDraft(c.next) });
    const rows = [
      { label: "Type", chips: o.types.map(chip) },
      { label: "Thickness", chips: o.thicknesses.map(chip) },
      { label: "Size", chips: o.sizes.map(chip) },
    ];
    const sheets = panelSheets(build.panelSf, draft);
    const next = round2(tierOf(draft) * sheets), curTotal = round2(tierOf(line.item) * line.qty);
    return (
      <SwapPop at={{ anchor: swap.anchor, x: r.right - 470, y: r.bottom + 6 }} className="wedi-swap wedi-grown"
        title={`Wall panel — ${round2(build.panelSf)} sf of wall`} rows={rows} stockFirst={source === "stock"}
        summary={{
          what: `${sheets} × ${unwedi(draft.name)}${draft.stock ? "" : " · special order"}`,
          why: `${draft.sf} sf/sheet — the count follows the wall area`,
          delta: fmDelta(round2(next - curTotal)), total: fm(next), up: next > curTotal,
        }}
        onUse={() => {
          setOpts((op) => ({ ...op, panelKey: draft.key === SKU.panelDefault ? undefined : draft.key }));
          setQtyOv((q) => { const n = { ...q }; delete n[line.item.key]; delete n[draft.key]; return n; });
          setSwap(null);
        }}
        onClose={() => setSwap(null)} />
    );
  };

  const swapPanel = (() => {
    if (!swap || !build) return null;
```
Inside `swapPanel`, replace
```js
    const r = swap.rect;
    if (ch.drain) return coverPanel(line, r);
```
with
```js
    const r = swap.rect;
    if (ch.drain) return coverPanel(line, r);
    if (ch.stepped === "curb") return curbPanel(r);
    if (ch.stepped === "panel") return panelPanel(line, r);
```
The popover's outer class is `wedi-swap`, the class the existing outside-click
listener (`.closest?.(".wedi-swap")`) keeps open. Esc already clears `swap`, so
both discard the draft.

- [ ] **Step 4: Suite, lint, build**

```bash
grep -n "curbKey" src/WediConfigurator.jsx
npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"
npx eslint src/WediConfigurator.jsx
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build 2>&1 | grep -E "built in|rror"
```
Expected:
- `grep` prints nothing;
- the suite ends `# fail 0`;
- lint is clean;
- the build prints `✓ built in`.

- [ ] **Step 5: Preview proof**

Create `.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs`:
```js
// Proof: ⇄ on every wedi line (ticket 158 Phase 1b) — the stepped curb
// popover with a draft and Δ, the curb choice re-fitting after a room change,
// the stepped wall-panel popover, the fastener-kit list swap, and a one-part
// line (PRO-SET) with no ⇄.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1b";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const popText = async () => flat(await pg.locator("[data-drain-swap]").innerText());
const line = (re) => pg.locator(".bline", { hasText: re }).first();
const lineText = async (re) => flat(await line(re).innerText());
const open = async (re) => { await line(re).locator(".swapb").click(); await pg.waitForTimeout(300); };

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800); // 36×60, 60" opening

// curb: Style → Length, a draft with its Δ; the bill holds until Use this
const curbBefore = await lineText(/Curb/);
console.log("bill curb:", curbBefore);
await open(/Curb/);
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
console.log("curb popover:", await popText());
await shot("w1-curb-popover");
await pg.locator('[data-drain-chip="Style:full"]').click(); await pg.waitForTimeout(300);
const fullText = await popText();
console.log("full draft:", fullText);
if (!/60" Full Foam Curb/.test(fullText) || /±0/.test(fullText)) fail("the Full draft lacks its curb or Δ");
if ((await lineText(/Curb/)) !== curbBefore) fail("the bill moved under a curb draft");
await pg.locator('[data-drain-chip="Style:at"]').click(); await pg.waitForTimeout(300);
if (!(await pg.locator('[data-drain-chip^="Profile:"]').count())) fail("AT shows no Profile row");
if (await pg.locator('[data-drain-chip="Length:96"]').isEnabled()) fail("AT's 96″ chip is not dashed");
await shot("w2-curb-at-draft");
await pg.locator('[data-drain-chip="Style:full"]').click();
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const used = await lineText(/Curb/);
console.log("after Use this:", used);
if (!/60" Full Foam Curb/.test(used)) fail("Use this did not land the full-foam curb");

// the room grows past 60″: the Full choice re-fits to 96″ rather than doubling the 60″
await pg.locator(".modetab", { hasText: "Custom shower" }).click(); await pg.waitForTimeout(500);
const wIn = pg.locator(".roomform .rinp").first();
await wIn.fill("72"); await wIn.press("Enter"); await pg.waitForTimeout(900);
const refit = await lineText(/Curb/);
console.log("after 72\" room:", refit);
if (!/96" Full Foam Curb/.test(refit)) fail("the Full curb did not re-fit to 96″");
await shot("w3-curb-refit-72");

// wall panel: One size shows its ⇄ — Type → Thickness → Size
await pg.locator(".pfseg button", { hasText: "One size" }).click(); await pg.waitForTimeout(400);
await open(/Building Panel/);
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
await pg.locator('[data-drain-chip="Type:vapor"]').click(); await pg.waitForTimeout(300);
const vap = await popText();
console.log("vapor draft:", vap);
if (!/Vapor 85/.test(vap)) fail("the Vapor 85 draft is not summarised");
await shot("w4-panel-vapor-draft");
await pg.locator('[data-drain-chip="Type:board"]').click();
await pg.locator('[data-drain-chip="Size:48x96"]').click(); await pg.waitForTimeout(300);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const panel = await lineText(/Building Panel/);
console.log("panel after Use this:", panel);
if (!/4'x8'x1\/2" Building Panel/.test(panel)) fail("Use this did not land the 4×8 panel");

// fastener kit: a list swap, one click; PRO-SET has one part — no ⇄
await open(/Fastener Kit/);
await shot("w5-fastener-list");
await pg.locator(".wedi-swap .srow", { hasText: "Tabless" }).click(); await pg.waitForTimeout(500);
console.log("fastener after pick:", await lineText(/Fastener Kit/));
if (!/Tabless/.test(await lineText(/Fastener Kit/))) fail("the tabless kit did not land");
if (await line(/PRO-SET/).locator(".swapb").count()) fail("the one-part PRO-SET line shows a ⇄");
await line(/PRO-SET/).evaluate((el) => el.scrollIntoView({ block: "center" }));
await shot("w6-install-lines");

await b.close();
if (err) process.exit(1);
```
Run:
```bash
npx vite --port 5199 --strictPort &
node .scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs; echo "exit $?"
```
Expected: `exit 0`, no `FAIL:` or `PAGEERROR`. The logs include:
- `full draft: … | 1 × 60" Full Foam Curb | Auto re-fits if the opening changes | +$48.35 · $102.34 | Use this`
- `after 72" room: 96" Full Foam Curb | … · cut to 72" | …`
- `vapor draft: … | TYPE | Standard | Vapor 85 | Panel kit | THICKNESS | ½″ | SIZE | 4'×8' | 3 × 4'x8'x1/2" Vapor 85 Building Panel | …`

Read `w1`–`w6`. Check that:
- the Style/Profile/Length rows render;
- AT's 96″ chip is dashed;
- the curb re-fits at 72″;
- PRO-SET has no ⇄.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/WediConfigurator.jsx .scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs .scratch/158_shower-config-roadmap/p1b/w*.png
git commit -m "wedi popup: ⇄ on curb and wall panel (stepped), fastener kit (list); curbPick seeds from old markers and survives a re-solve (ticket 158 Phase 1b)"
```

---

### Task 10: Records and full verification

**Files:**
- Modify: `docs/adr/0049-configurator-swaps-remember-the-choice.md` (amendment)
- Modify: `docs/superpowers/specs/2026-09-26-swap-every-line-design.md`
  (amendments during planning and build)
- Modify: `src/CLAUDE.md` (entries)
- Modify: `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1)

- [ ] **Step 1: ADR 0049 amendment**

Append an amendment section in the house style of
`docs/adr/0009-price-book-library.md`'s `## Amendment (…)` sections. Title it
`## Amendment (2026-09-27): every line swaps (Phase 1b)`. It says:

1. **Lines.**
   - Schluter: `cfg.swaps` gains `membrane` `{ wide, roll? }`, `band`
     `{ width, roll? }` and `fastener` (a sku, whose count re-fits). Bench rows
     gain `board`; `part` already existed.
   - wedi: `curbPick` `{ sub, len?, profile? } | { none: true }`, plus
     `panelKey` and `fastenerKey`.
   - Engines: `resolveMembrane`, `resolveBand` and `resolveCurb`, each with an
     options function the popover reads.
2. **Write-only-when-picked.**
   - wedi no longer writes the resolved `curbKey`, and writes `panelKey` and
     `fastenerKey` only when they differ from the house part.
   - Old markers translate on read: `legacyCurbPick` / `curbPickOf` / an old
     default `panelKey` = no pick.
   - `src/wedimarkergolden.test.js` pins that every old marker shape reopens to
     its pre-1b bill.
   - `markerCurbKey` lets the tile-sf reader (`showersf.js`) resolve a choice
     the same way.
3. **Inert picks.** A saved pick the pan type can't use stays in the marker but
   doesn't mark the build Custom or dirty: a Schluter `drainPick` on a point
   tray, or a wedi `coverPick` of the wrong shape (`coverPickApplies`).
4. **Consequence.** 1c ("+" per group) and 1d (Compare alignment) build on these
   choice records and the `SwapPop` component (`src/swappop.jsx`, which replaced
   `drainswap.jsx`).

Also update the ADR's **Scope** bullet, replacing `src/drainswap.jsx` with
`src/swappop.jsx` and noting `src/showersf.js`. Leave the index row in
`docs/adr/README.md` unchanged: it is still ADR 0049.

- [ ] **Step 2: Spec amendments**

At the end of the spec's Design section (after §5), add
`### Amendments during planning (2026-09-27)`, one bullet each:
- **AT curbs.** wedi's AT style is two parts at 60″ (full-foam `US3000048`, lean
  `US3000049`), so `curbPick` gains optional `profile: "full" | "lean"`, and the
  popover shows a Profile row for AT only. With no profile, the cheaper
  stocked piece (lean AT) lands. An old AT `curbKey` translates with its
  profile, so the bill is identical.
- **Stale curb keys.** A stale `curbKey` the catalog no longer knows reads as no
  pick. The recipe curb lands instead of the old code's silent no-curb, per the
  Schluter `swaps` precedent: a stale sku falls back to the recipe.
- **Tile sf.** `showersf.js` read `cfg.curbKey` for the tile-sf pieces; it now
  resolves through `markerCurbKey`.
- **Membrane scope.** The membrane choice applies to the wall membrane. The
  mortar-bed floor KERDI keeps the recipe's `pickRolls`.
- **Roll and width codes.**
  - An unsuffixed KERDI or KEBA roll's code is `"30M"`, the full roll.
  - Band width labels use Schluter's rounding: 125 → 5″, 185 → 7¼″, 250 → 10″.
    Any other width is the mm figure rounded to ¼″.
- **Panel types.** The wedi panel Type row carries a third chip, "Panel kit"
  (`US4000001`/`US4000002`), because today's flat list offered them.
- **Panel ⇄ scope.** The panel ⇄ is on the walls' panel line only. The bench's
  own sheet line used to open a list that silently rewrote the walls' panel.
- **Fastener kits.** They are the boxed screw-and-washer kits (Fastener Kit,
  Tabless Fastener Kit). Master packs, the Vapor 85 patch kit and loose
  self-tapping screws are not offered.
- **Re-solves.** A room re-solve keeps `curbPick`, as it keeps `coverPick`.
  "Turn into a curb" on a curbless pan now drafts `{ sub: "lean" }` (Auto),
  where it used to pin the 60″ lean.
- **Popover plumbing.**
  - `buildKit` returns `need: { wallSf, bandLf }`, and bench lines carry their
    `bench` index.
  - `kitFor` returns `curbFit: { openLen, fam }`.
  - The popovers read these instead of re-deriving the rule.
- **Selectors.** `SwapPop` keeps 1a's `data-drain-*` selectors so the 1a proof
  scripts still run.

- [ ] **Step 3: `src/CLAUDE.md` and the ticket**

In `src/CLAUDE.md`:
- Replace the `drainswap.jsx` entry with a `swappop.jsx` entry:
  - `SwapPop`: the shared stepped popover for the drain and every stepped line.
    It renders a draft only, and each popup owns what a chip means.
  - `fmDelta`, the Δ formatter both popups share.
  - `inchGlyph`, chip inch text.
  - `stockFirst`, the Stock only ordering, and the `so` chip dot.
  - The `data-drain-*` selectors are kept for the proof scripts.
- Append one clause each, in the existing style:
  - **`schluter.js`:** `rollCode`/`roll`/`width` on classified rows;
    `resolveMembrane`/`membraneOptions`, `resolveBand`/`bandOptions`;
    `cfg.swaps.membrane/band/fastener`; bench `board`; `buildKit`'s `need` and
    lines' `bench`; `pointGrateLabel`.
  - **`wedi.js`:** `resolveCurb`/`legacyCurbPick`/`curbOptions`/`curbPickOf`/`markerCurbKey`;
    `curbPick` replaces `curbKey`; `panelOptions`/`panelSheets`;
    `fastenerKits`/`fastenerKey`; `coverPickApplies`; `kitFor`'s `curbFit`.
  - **`SchluterConfigurator.jsx`:** membrane/band stepped popovers,
    fastener/bench list swaps, ⇄ only with an alternative, inert `drainPick`.
  - **`WediConfigurator.jsx`:** curb/panel stepped popovers, fastener list swap,
    `curbPick` seeded via `curbPickOf` and kept across a re-solve, inert cover
    pick.
  - **`showersf.js`:** the curb via `markerCurbKey`.
- Add a `wedimarkergolden.js` entry: GENERATED from pre-1b `wedi.js` by
  `.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`; never
  hand-edited.

In `.scratch/158_shower-config-roadmap/ticket.md`, Phase 1 section:
- Add a **1b DONE (2026-09-27)** block listing:
  - Spec: `docs/superpowers/specs/2026-09-26-swap-every-line-design.md`
  - Plan: `docs/superpowers/plans/2026-09-27-swap-every-line.md`
  - ADR: `docs/adr/0049-configurator-swaps-remember-the-choice.md` (amended)
  - Proof: `.scratch/158_shower-config-roadmap/p1b/`
  - PR: added by the controller once it exists.
- Trim **Carry into 1b** to what's left, retitled **Carry into 1c+**:
  - the Schluter kit-card thumbnails under a fixed drain pick;
  - wedi finish chips repeating the style;
  - the Wording bullet.

- [ ] **Step 4: Full verification**

```bash
npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"
npm run lint
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build 2>&1 | grep -E "built in|rror"
npx vite --port 5199 --strictPort &
node .scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs; echo "schluter exit $?"
node .scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs; echo "wedi exit $?"
node .scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs; echo "p1a schluter exit $?"
node .scratch/158_shower-config-roadmap/p1a/shoot-wedi.mjs; echo "p1a wedi exit $?"
git checkout -- .scratch/158_shower-config-roadmap/p1a/
```
Expected:
- the suite ends `# fail 0`;
- lint is clean;
- the build prints `✓ built in`;
- all four scripts print `exit 0` with no `FAIL:` or `PAGEERROR`.

Stop the server. Read every p1b PNG before claiming anything.

- [ ] **Step 5: Commit, then stop**

```bash
git add docs/adr/0049-configurator-swaps-remember-the-choice.md docs/superpowers/specs/2026-09-26-swap-every-line-design.md src/CLAUDE.md .scratch/158_shower-config-roadmap/ticket.md .scratch/158_shower-config-roadmap/p1b
git commit -m "ADR 0049 amendment + records for ⇄ on every line (ticket 158 Phase 1b)"
```
**Stop here.** Do not push or open the PR; the controller does both.

---

## Self-review (done while writing)

- **Spec coverage:**
  - §1 lines/popovers: T4, T5 and T8 (Schluter); T6, T7 and T9 (wedi).
  - §1 "⇄ only when >1 part": `canSwap` / `steppedKind` (T8) and `can` (T9),
    proven by s5 and w6.
  - §1 Stock only: `stockPool`, the `so` flag, the SO dot and `stockFirst`
    (T3, T8, T9).
  - §2 storage: T4, T5, T6 and T7.
  - §2 old markers: T1's golden plus T6/T7 translation, and `seedState` in T9.
  - §2 "any saved pick counts as a customization": Schluter's existing
    `!cfg.swaps` in `mode`, the bench rows, and wedi `kitDirty` (T9).
  - §3 engines + one popover: T2, T4, T6 and T7.
  - §4 reach: `buildFromMarker` round trips (T5, T7); the basket, Compare and
    print already go through the engines.
  - §5 carry-overs: T3.
  - Testing section: T3–T7 engine cases, T1 exhaustive old markers, T5/T7
    round trips, and T8/T9 preview proof.
  - Records: T10.
- **Types:** these names are used identically across tasks:
  - `need.wallSf` / `need.bandLf`
  - `curbFit.openLen` / `curbFit.fam`
  - chip `{ key, label, ok, so, on, next }`
  - `curbPick` `{ sub, len?, profile? } | { none: true }`
  - `swap.stepped`, `swap.draft`
- **Out of scope** (spec): "+"/add another (1c); Compare alignment (1d); setting
  material; thumbnails; wording items.
