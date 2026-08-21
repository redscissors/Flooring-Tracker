# wedi ⇄ Schluter Compare + Quote-Options A/B Implementation Plan (Phase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The prototype's P3 surface in production — a **Compare** tab in
whichever configurator popup is open that prices the same room in BOTH
systems, lined up by category with per-tier totals and stock coverage, plus
the owner-approved "C" delivery: one click lands the wedi build in Option A
and the Schluter build in Option B of the job (ADR 0031 machinery, zero new
print work).

**Architecture:** Three layers. (1) `src/comparekit.js` — a pure, React-free
module (the first module allowed to import BOTH engines) that maps either
popup's config into a neutral room shape, runs the *other* engine's house
kit on it, and normalizes both builds into seven aligned categories
(`Base/Drain/Walls/Seams/Curb/Setting/Extras`) with retail/builder/cost
extended amounts. (2) `compareOptionsPatch` in boot-side `src/options.js`
(model-only imports — never the engines) builds the single `updateProject`
patch that appends two option-tagged sibling areas. (3) `src/CompareTab.jsx`
— its own `React.lazy` chunk both popups mount as a fourth tab, fed by a new
shared `useSchluterCatalog` hook so the wedi popup can price the Schluter
side from the live registry.

**Reference:** `.scratch/097_schluter-configurator/prototype.html`, surface
P3 (committed on this branch) — the approved spec. Where this plan and the
prototype disagree, the prototype wins, except: production uses the **live
configured room** (not preset chips), and the HOST popup's column shows its
**current build** (with add-ons) while the other column shows that engine's
default house kit for the same room.

**Tech Stack:** plain ES modules + `node --test` for comparekit/options;
React 18 + the repo Tailwind-override theme for CompareTab; the two preview
harnesses for proof.

## Global Constraints

- One PR off this session's designated branch (`claude/phase-5-agent-driven-lmczv6`);
  never push to `main`; no Supabase writes; registry reads only through the
  existing `useBooks`/`useBookStock` paths, gated on `bookStockReady`.
- ADR 0026: `comparekit.js`, `CompareTab.jsx`, `useschlutercatalog.js` never
  load at boot. `CompareTab.jsx` is `React.lazy` inside each popup chunk.
  App.jsx / options.js / model.js must NOT import `comparekit.js` (it pulls
  both engine table sets). `schluterquery.js`/`wediquery.js` stay untouched.
- ADR 0033: nothing new imports `wedi.js` except `comparekit.js` and
  `CompareTab.jsx`; `showerdraw.*` never imports either engine.
- Engine behavior is untouched: **no edits to `wedi.js` or `schluter.js`** —
  pinned totals in `wedi.test.js` / `schluter.test.js` must not move.
- Owner decisions 1–8 (`.scratch/097_schluter-configurator/README.md`) bind;
  compare delivery is the recorded **A + C** recommendation. wedi's S-Dry
  wall fork is phase 6 — the wedi compare column is always the standard
  panel walls in this phase.
- Every commit: `npm test` green (full `node --test` list). Final commit:
  `npm run build` green.
- Preview proof before merge (repo rule 3): screenshots from BOTH harnesses
  ride the PR under `.scratch/097_schluter-configurator/phase5-proof/`.
- Comments conservative; match surrounding idiom; `src/CLAUDE.md` entry for
  every new/changed src file.

## File Structure

- `src/comparekit.js` (create) — neutral room mapping + cross-engine builds
  + category rows + totals. Pure; imports `wedi.js`, `schluter.js` only.
- `src/comparekit.test.js` (create) — node --test.
- `src/options.js` (modify) — `compareOptionsPatch` (+ `src/options.test.js`
  create).
- `src/useschlutercatalog.js` (create) — the registry→catalog assembly hook
  extracted from `SchluterConfigurator.jsx:335-354`.
- `src/CompareTab.jsx` (create) — the tab UI, lazy chunk.
- `src/SchluterConfigurator.jsx` (modify) — 4th tab + hook adoption +
  `wediBuilderPct`/`onQuoteOptions` props.
- `src/WediConfigurator.jsx` (modify) — 4th tab + registry-bag props.
- `src/App.jsx` (modify) — prop plumbing, `addCompareOptions`, the
  `ft-open-layer` schluter-restore fix.
- `src/AppsWorkspace.jsx` (modify) — extend the `wedi={}`/`schluter={}`
  prop bags.
- `src/showerdraw.jsx` (modify) — scoped hatch id (ADR 0033 ride-along).
- `src/schluterpreview.jsx`, `src/wedipreview.jsx` (modify) — harness
  support for the compare tab + quote-options modal.
- `docs/adr/0034-cross-vendor-compare.md` (create) + `docs/adr/README.md`
  (modify).

---

### Task 1: comparekit — rooms, cross-engine builds, category rows, totals

**Files:**
- Create: `src/comparekit.js`, `src/comparekit.test.js`

**Interfaces (Produces):**
```js
export const COMPARE_CATS = ["Base","Drain","Walls","Seams","Curb","Setting","Extras"];
// neutral room: { w, d, curbed, drain:"point"|"offset"|"linear",
//                 walls:[{ side:"back"|"left"|"right", on, len, h }] }
export function roomFromSchluter(cfg)      // schluter markCfg → room
export function roomFromWedi(cfg)          // wedi kitFor build.cfg → room
export function wediBuildFor(room, { source, tier, builderPct } = {})
  // → kitFor build (mode:"kit", cfg carries panKey) or null when solve() is empty
export function schluterBuildFor(room, cat, { source, mortarItem } = {})
  // → { build, cfg } — cfg is the composed schluter cfg (cfg.w set ⇒ reconfigure chip works)
export function wediCompareRows(build, { builderPct } = {})
export function schluterCompareRows(build, { builderPct } = {})
  // rows: { cat, name, sub, qty, stock, noteOnly, est, retail, builder, cost }  (extended amounts, round2)
export function compareTotals(rows)
  // → { retail, builder, cost, lines, stocked, soCount }  (noteOnly rows excluded)
```

Category maps — Schluter lines already carry the tokens (`l.g`; anything
outside COMPARE_CATS → `"Extras"`; `noteOnly` rows are KEPT as $0 rows —
the "substrate by others" line is the walls-difference story). wedi lines
map from `item.group`:

```js
const WEDI_CAT = { pan:"Base", module:"Base", modExt:"Base", extension:"Base",
  cornerExt:"Base", kit:"Base", curb:"Curb", ramp:"Curb", panel:"Walls",
  cover:"Drain", coverFrame:"Drain", drainKit:"Drain", collar:"Drain",
  sealant:"Seams", fastener:"Seams", subliner:"Seams", sdry:"Seams",
  tool:"Setting" };            // everything else (recess, niche, bench, …) → "Extras"
```
`wediCompareRows` appends the prototype's $0 `Setting` note row
(`name:"Thin-set for pan bed", sub:"by others / shop stock", noteOnly:true`)
— wedi has no thinset line and the cell must say why. wedi `sub` =
`[e.us, l.note]` joined " · "; mark `est:true` on lines whose engine note
says allowance (mirror the popup's treatment). Prices come from each
engine's own `tierPrice` — wedi `tierPrice(e, tier, pct)` (×0.82 builder
rule lives inside), schluter `tierPrice(e, tier, {builderPct})` (−8%
default inside). **Do not re-derive price math in comparekit.**

Cross-engine mapping rules:
- schluter → wedi solve input: `drain "point"→"center"`, `"offset"→"offset"`,
  `"linear"→"linear"`; `curb: curbed?"curbed":"curbless"`; `tolerance:0.51`,
  `drainX:0, drainY:0, anchor:"left"`; thread `source` through. Take
  `solve(input)[0]`; **read `WediConfigurator.jsx` (~line 841 and
  `solveRoom` ~980) first and mirror exactly how the popup turns an option
  into `kitFor(panKey/option.pan, {...})` args** — walls map
  `{name→side lowercased, on, len, h}` for on-walls only, `mode:"kit"`.
- wedi → schluter cfg: `w/d` from `cfg.room`, `curbed` from
  `cfg.solve.input.curb !== "curbless"`, drain `"center"/"any"→"point"`,
  `wallSys:"membrane"`, `bench:null`, three walls Back/Left/Right rebuilt
  from the room's on-walls (defaults `on:false` when a side is absent),
  spread `mortarItem` only when provided. Pick `trayCandidates(cfg, cat,
  {source})[0]` and pass as `pick` to `buildKit`.

**Steps:**

- [ ] **Step 1:** Write `src/comparekit.test.js` failing tests using the
  frozen `src/schluterfixture.js` catalog (`catalogOf(adaptRow…)` — copy the
  fixture-loading pattern from `schluter.test.js`) and wedi's own built-in
  catalog. Cover at least: (a) `roomFromSchluter`/`roomFromWedi` round-trip
  a 60×38 curbed point-drain room; (b) `wediBuildFor` on that room returns a
  build whose cfg has `panKey` and whose rows bucket into COMPARE_CATS with
  a `Walls` panel line and the $0 Setting note; (c) `schluterBuildFor`
  returns cfg with `cfg.w === 60` and rows whose cats ⊆ COMPARE_CATS with
  noteOnly rows kept at 0; (d) `compareTotals` excludes noteOnly, counts
  soCount, and `builder < retail`; (e) `source:"stock"` threads: a room
  whose schluter exact tray is SO re-ranks (mirror the 48×48 → 55×55 pin
  from `schluter.test.js`); (f) an impossible wedi room (`w:0`) →
  `wediBuildFor` returns null.
- [ ] **Step 2:** Run `node --test src/comparekit.test.js` — expect FAIL
  (module missing).
- [ ] **Step 3:** Implement `src/comparekit.js` per the interfaces above.
- [ ] **Step 4:** `node --test src/comparekit.test.js` PASS, then full
  `npm test` — the pinned wedi/schluter totals must be untouched.
- [ ] **Step 5:** Commit `feat: comparekit — cross-engine room mapping + aligned category rows`.

### Task 2: `compareOptionsPatch` in options.js

**Files:**
- Modify: `src/options.js` · Create: `src/options.test.js`

**Interfaces (Produces):**
```js
export function compareOptionsPatch(project, hostAreaId, { wediLines, schluterLines, label })
// → { categories, optionNames } | null
```
Rules (from ADR 0031 + usedirectory's non-functional setter): returns ONE
patch — never two calls. Two fresh areas via `{ ...newArea(), … }`:
`"<base> — wedi"` tagged `option:"A"` and `"<base> — Schluter"` tagged
`option:"B"` (base = `label` or the host area's name or `"Shower"`),
products = `lines.map(p => ({ ...newProduct(), ...p }))` **plus a trailing
`newProduct()` adder row**, inserted immediately after the host area (append
when the id is gone). `optionNames` folds `{A:"wedi", B:"Schluter"}` only
into empty slots — never overwrite a custom name. Null when either lines
array is empty. No `duplicateInto` — these are fresh sibling areas, so the
shared-source retag rule does not apply (record that in the ADR, Task 7).

**Steps:**

- [ ] **Step 1:** Failing tests in `src/options.test.js`: patch shape,
  insertion index after host, trailing blank rows, optionNames fill-only,
  null on empty input, anchor rows keep their `wedi`/`schluter` markers.
- [ ] **Step 2:** `node --test src/options.test.js` — FAIL.
- [ ] **Step 3:** Implement in `src/options.js` (imports from `./model.js`
  only — this file is boot-side).
- [ ] **Step 4:** `node --test src/options.test.js` + `npm test` PASS.
- [ ] **Step 5:** Commit `feat: compareOptionsPatch — one-patch A/B option areas`.

### Task 3: `useSchluterCatalog` extraction

**Files:**
- Create: `src/useschlutercatalog.js` · Modify: `src/SchluterConfigurator.jsx`

**Interfaces (Produces):**
```js
export function useSchluterCatalog({ stockRows, bookStockReady, books, loadBookItems })
// → { cat, soReady }   — exactly the values the popup computes today
```
Move the assembly at `SchluterConfigurator.jsx:335-354` (stock rows adapted
`{stock:true}` gated on `bookStockReady`; every active `kind:"order"` book
matching `/schluter/i` on `name`/`data.brandLabel` fetched via
`loadBookItems` and adapted `{stock:false}`; `active !== false &&
!disabled` filter; stock wins SKU collisions; `catalogOf` at the end) into
the hook VERBATIM — behavior-preserving cut-and-paste, popup adopts the
hook. File is lazy-chunk-only (it imports `schluteradapter.js`) — say so in
its header comment and in `src/CLAUDE.md`.

**Steps:**

- [ ] **Step 1:** Create the hook file; refactor the popup to consume it.
- [ ] **Step 2:** `npm test` green; `npm run build` green (chunk graph
  unchanged — verify `dist/assets` has no new boot-side chunk pulling the
  adapter).
- [ ] **Step 3:** Commit `refactor: useSchluterCatalog — shared registry→catalog assembly`.

### Task 4: CompareTab.jsx + Schluter popup mount

**Files:**
- Create: `src/CompareTab.jsx` · Modify: `src/SchluterConfigurator.jsx`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces (component contract both popups use):
```js
export default function CompareTab({ host /* "wedi"|"schluter" */, room,
  hostBuild /* host popup's live {build-like} */, hostCfg, source,
  tier /* current tier id */, wediBuilderPct, schluterBuilderPct,
  cat /* schluter catalog when host==="schluter" */,
  stockRows, bookStockReady, books, loadBookItems, /* when host==="wedi" */
  mortars, mortarDefault, areaName, onQuoteOptions /* optional */ })
```

Layout mirrors prototype P3 (`#p3` renderer, prototype.html:782-817), themed
with the popup's existing utility classes: header row ("Compare — one room,
both systems", the live room label e.g. `60″ × 38″ · curbed · point drain`,
and a Retail/Builder seg — builder sublabels `wedi ×0.82 · Schluter −8%`);
the seven-row category grid (wedi column | Schluter column, `—` for empty
cells, SO rows tinted with the existing rust/so styling, noteOnly rows
faint); totals row (each side: tier total + `N of M lines stocked`); the
delta line (`<system> is $X less on material for this room at this tier` +
the walls-not-apples-to-apples caveat verbatim from the prototype); the
three diffnotes cards (Walls / Fit strategy / Pricing model — copy the
prototype text, updating the Builder sentence to name the two Settings
knobs). Host column = `hostBuild` rows; other column = comparekit-derived
house kit. When the other engine can't build the room (null build / no
catalog yet), the column shows one faint explanatory cell — never a crash.
Thread `source` into the derived build. When `host==="wedi"`, assemble the
Schluter side with `useSchluterCatalog` + `mortarItemFrom(mortarDefault ||
first, mortars)`.

**Quote-options footer** (rendered only when `onQuoteOptions` given): button
`Quote options: wedi → A · Schluter → B`; clicking opens a small confirm
modal (reuse the popup's payload-modal idiom) listing each side's line count
+ retail total; Confirm calls
`onQuoteOptions({ wediLines, schluterLines, label: areaName })` where each
`lines` comes from that engine's own `lineItems` (wedi:
`lineItems(wediBuild, { tier, builderPct: wediBuilderPct })` — the kitFor
build already carries mode/cfg; schluter:
`lineItems({ ...build, mode:"custom", cfg }, { builderPct:
schluterBuilderPct })` with the Task-1 composed cfg) so anchor markers and
reconfigure chips work in the landed areas.

**Steps:**

- [ ] **Step 1:** Write `src/CompareTab.jsx`.
- [ ] **Step 2:** Mount in `SchluterConfigurator.jsx`: `const CompareTab =
  lazy(() => import("./CompareTab.jsx"))`; add `{ id:"compare", label:
  "Compare", sub:"wedi ⇄ Schluter" }` to `TAB_DEFS`; when `tab==="compare"`
  render `<Suspense fallback={null}><CompareTab …/></Suspense>` spanning the
  full body (main + buildcol + rail hidden); add popup props
  `wediBuilderPct` and `onQuoteOptions`, passed through.
- [ ] **Step 3:** `npm test` + `npm run build` green; hand-check via
  `schluter-preview.html` (`npx vite` dev) that the tab renders.
- [ ] **Step 4:** Commit `feat: CompareTab — P3 compare surface in the Schluter popup`.

### Task 5: wedi popup mount + App.jsx wiring + restore fix

**Files:**
- Modify: `src/WediConfigurator.jsx`, `src/App.jsx`, `src/AppsWorkspace.jsx`

**Steps:**

- [ ] **Step 1:** `WediConfigurator.jsx`: same lazy import + 4th tab
  (labels from `TAB_DEFS`-equivalent at line ~2326); new props
  `schluterBuilderPct, stockRows, bookStockReady, books, loadBookItems,
  mortars, mortarDefault, onQuoteOptions`; `room = roomFromWedi(build.cfg)`
  — import ONLY `roomFromWedi` via `CompareTab`'s props? No — comparekit is
  already in the wedi chunk's dependency set once CompareTab mounts; compute
  `room` inside CompareTab from `hostCfg` instead, so the popups pass raw
  `hostCfg` and never import comparekit themselves. (Same rule for the
  Schluter popup — Task 4 must follow it too.)
- [ ] **Step 2:** `App.jsx`: pass the registry bag + `schluterBuilderPct`
  to `WediConfigurator`, `wediBuilderPct` to `SchluterConfigurator`; add
  ```js
  const addCompareOptions = (aid, payload) => {
    const patch = compareOptionsPatch(sel, aid, payload);
    if (patch) updateProject(sel.id, patch);
  };
  ```
  (`compareOptionsPatch` from `./options.js` — boot-safe) and pass
  `onQuoteOptions={(p) => { addCompareOptions(aid, p); }}` in both popup
  mounts (job-context only — the Apps-hub embedded copies get no
  `onQuoteOptions`).
- [ ] **Step 3:** Fix the restore bug at App.jsx:586: the condition
  `if (L.kind === "sheoga" || L.kind === "wedi")` omits `"schluter"`, so a
  stored schluter layer is dropped on refresh even though the ternary below
  handles it — add `|| L.kind === "schluter"`.
- [ ] **Step 4:** `AppsWorkspace.jsx`: extend the `wedi={}` bag with the
  registry props so the hub's embedded wedi popup can show the compare tab
  (no quote-options there).
- [ ] **Step 5:** `npm test` + `npm run build` green; dev-server hand check
  of both popups' compare tabs.
- [ ] **Step 6:** Commit `feat: compare tab in both popups + quote-options A/B landing`.

### Task 6: ADR 0033 ride-along — scoped hatch id

**Files:**
- Modify: `src/showerdraw.jsx`

**Steps:**

- [ ] **Step 1:** In `Iso`, replace the document-global
  `<pattern id="wedi-hatch">` (line ~997) and `fill="url(#wedi-hatch)"`
  (line ~709) with a per-instance id from `React.useId()`.
- [ ] **Step 2:** `npm test` green; pixel parity per ADR 0033 — run the
  committed-baseline byte-compare using the
  `.scratch/098_shower-drawing-extraction/shoot-parity.mjs` rig; never
  re-bless a differing hash.
- [ ] **Step 3:** Commit `fix: scope the shower-hatch pattern id (ADR 0033 ride-along)`.

### Task 7: preview proof + ADR + docs

**Files:**
- Modify: `src/schluterpreview.jsx`, `src/wedipreview.jsx`, `src/CLAUDE.md`,
  `docs/adr/README.md`
- Create: `docs/adr/0034-cross-vendor-compare.md`,
  `.scratch/097_schluter-configurator/phase5-proof/` (shots + README.md)

**Steps:**

- [ ] **Step 1:** Harnesses: the schluter harness already feeds `stockRows`;
  give the wedi harness the same fixture-backed registry bag so its compare
  tab prices for real; wire a visible no-op `onQuoteOptions` so the confirm
  modal renders.
- [ ] **Step 2:** Playwright shots (repo chromium, `shoot.mjs` pattern from
  phase 3/4): `c1` compare in the Schluter popup (60×38 curbed, Retail);
  `c2` same at Builder (both knobs visible); `c3` compare in the wedi popup;
  `c4` compare under Stock only (the SO re-rank story); `c5` the
  quote-options confirm modal. README table mapping each shot to what it
  proves, side-by-side with prototype P3 in the PR body.
- [ ] **Step 3:** `docs/adr/0034-cross-vendor-compare.md` (follow
  `docs/skills-reference/decide/SKILL.md`): the compare chunk is the first
  dual-engine module and stays out of every boot path; categories align by
  semantic map, not string join; host column = live build, other column =
  derived house kit; A/C delivery — fresh sibling option areas via one
  patch, deliberately NOT `duplicateInto` (no shared-source retag);
  prices always computed at open time from the same sources as the popups.
  Index it in `docs/adr/README.md`.
- [ ] **Step 4:** `src/CLAUDE.md` entries: comparekit.js, comparekit.test.js,
  options.js (updated), options.test.js, useschlutercatalog.js,
  CompareTab.jsx, and the changed popup/App/preview lines.
- [ ] **Step 5:** Full `npm test` + `npm run build` green. Commit
  `docs+proof: phase-5 preview shots, ADR 0034, CLAUDE.md entries`.

## Self-Review

- Spec coverage: P3 grid/totals/delta/diffnotes — Tasks 1, 4; live-room
  compare in *both* popups — Tasks 4, 5; tier seg with both builder rules —
  Tasks 1, 4; stock coverage line — Task 1 (`compareTotals`), Task 4; source
  switch respected — Tasks 1, 4; delivery C (Option A/B areas, one patch,
  print for free) — Tasks 2, 5; delivery A — Tasks 4, 5; delivery B
  (cross-price chip) — deliberately out of scope (owner: "falls out of A
  later"); roadmap gate "preview" — Task 7.
- Placeholder scan: none — every step names exact files, code, or the
  verbatim-move rule.
- Type consistency: `room` shape identical across Tasks 1/4/5; row shape
  `{cat,name,sub,qty,stock,noteOnly,est,retail,builder,cost}` shared by both
  `*CompareRows` and `compareTotals`; `onQuoteOptions` payload
  `{wediLines, schluterLines, label}` matches `compareOptionsPatch` input.
- Known risks called out to implementers: wedi `kitFor` arg composition must
  be mirrored from the popup, not invented (Task 1 Step 3 instruction);
  popups never import comparekit directly (Task 5 Step 1 rule); engines are
  read-only this phase.
