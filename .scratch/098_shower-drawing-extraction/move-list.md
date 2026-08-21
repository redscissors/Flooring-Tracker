# Move list — shower drawing extraction (Task 2 audit)

Scope: everything `src/WediConfigurator.jsx`'s drawing cluster references
that is defined outside the cluster, classified MOVE / PASS-AS-PROP / STAYS,
plus the reverse direction (outside call sites into things that move) and the
`wedi.test.js` imports that must keep working.

**Cluster boundary correction.** The brief's "~530–1772" is an approximation.
The real, precise boundaries (this HEAD, commit `690eeab`):

- **Main block:** lines **521–1756** — the `// the drawings —…` section
  header through `Iso`'s closing `}`. Lines 1758–1772 (`// === the popup
  ===` header + `DEF_WALLS`/`DEF_OPTS`/`DEF_INP`) are the *next* section,
  swept in only by the brief's `sed 530,1772p` overrun — **not** part of the
  cluster. (`kitFor` shows up in the brief's raw grep count only because its
  comment at line 1771 fell inside that overrun; it is STAYS, see below.)
- **`railSplit` block:** lines **47–71** — a separate block well above 521,
  containing `railSplit` itself plus the `RAIL_*` constants it shares with
  unrelated code below it. See the split note under MOVE.

Sweep method: `sed -n '521,1756p;47,71p' WediConfigurator.jsx` as the working
cluster text; brief's two grep loops run verbatim first; then a full sweep —
`rg -oP '(?<![.\w$])[A-Za-z_$][A-Za-z0-9_$]*(?=\()'` for every call-expression
identifier, `grep -oE '\b[A-Z][A-Z0-9_]{1,}\b'` for every bare constant-looking
token, `grep -oE '<[A-Z][A-Za-z0-9]*'` for JSX component tags — each hit's
definition site verified by hand (local const/function inside the cluster vs.
import vs. comment-only mention vs. name-collision shadow).

---

## MOVE

### A. Local to WediConfigurator.jsx today — cut and relocate verbatim

| Identifier | Def site | Cluster hits | Notes |
|---|---|---|---|
| `PIECE_FILL`, `PIECE_SIDE` | :525–526 | many | style consts, drawings-only |
| `INK`, `MUTED`, `FAINT`, `MOSS`, `MOSS_DEEP` | :527 | many | ditto |
| `RUST`, `PAPER` | :528 | many | ditto |
| `FONT` | :529 | many | ditto |
| `CURB_H_LEAN`, `CURB_H_STD`, `PAN_T_MIN`, `CURB_W_LEAN` | :534 | several | Z-height consts |
| `curbHeight` | :535 | 1 (own def, via `curbWidth`) | **called from outside the cluster**, see below |
| `EXT_SPAN` | :547 | 1 | |
| `PAN_TRIM`, `PAN_SPAN`, `PAN_ARROW`, `PAN_HEAD` | :553–554 | several | |
| `PLANE_AT` | :555 | 2 | |
| `panCap` | :559 | 2 | |
| `slopeMarks` | :560 (fn) | 2 (called from TopDown, Iso) | |
| `fallArrow` | :658 (fn) | 2 | |
| `curbBands` | :692 (fn) | 2 | |
| `framedStandIns` | :751 (fn) | 2 | |
| `curbCornerOut` | :763 (fn) | 2 | |
| `bandPoly` | :778 (fn) | 3 | |
| `topGeom` | :785 (fn) | 1 | |
| `TopDown` | :796 (fn) | — | called at :2788, :3121, :3507 (unchanged call sites, become import-fed) |
| `Iso` | :1283 (fn) | — | called at :3144, :3510 |

Destination: `src/showerdraw.jsx` (or the pure-JS half, see Task 3 checklist
below — none of this list contains JSX except inside `TopDown`/`Iso`
themselves).

**`railSplit` — separate block, lines 47–71, needs line-splitting, not a
clean cut:**

```
47:  const RAIL_DESIGN_W = 328, RAIL_PLAN_H = 268, RAIL_ISO_H = 306;
```
Whole line moves — `RAIL_PLAN_H`/`RAIL_ISO_H` are railSplit-only; `RAIL_DESIGN_W`
is used inside railSplit *and* outside the cluster at :1885 (`useState({ w:
RAIL_DESIGN_W, h: 0 })`), so it needs re-importing back into
WediConfigurator.jsx (see "call sites outside the cluster" below).

```
55:  const RAIL_PAD_X = 24, RAIL_PAD_Y = 24, RAIL_GAP = 10, RAIL_HINT_H = 34;
```
**Splits.** `RAIL_PAD_X`/`RAIL_PAD_Y` are used only outside `railSplit` (at
:1890–1891) → **STAYS**. `RAIL_GAP`/`RAIL_HINT_H` are used only inside
`railSplit` → **MOVE**. Task 3 must rewrite this one line into two:
`const RAIL_PAD_X = 24, RAIL_PAD_Y = 24;` stays; `const RAIL_GAP = 10,
RAIL_HINT_H = 34;` moves.

```
56:  const RAIL_MIN_W = 240, RAIL_MIN_PLAN = 210, RAIL_MIN_ISO = 240;
```
**Splits** the same way: `RAIL_MIN_W` STAYS (used only at :1890), `RAIL_MIN_PLAN`/
`RAIL_MIN_ISO` MOVE (used only inside `railSplit`).

The rest of the block (comment lines 47–53, comment lines 57–60, function
body 61–71) cuts wholesale.

### B. wedi.js geometry exports the cluster actually references — delete + re-export

Per the brief's rule, only exports the cluster *calls in real code* (not just
mentions in a comment) qualify. Of the ten candidates in the brief's list,
only these five are real cluster call sites:

| Identifier | wedi.js def | Real cluster call sites | wedi.js other callers (must keep working via re-export) |
|---|---|---|---|
| `WALL_THICK` | wedi.js:4439 (`export const … = 4`) | Iso :1286 (`const T = WALL_THICK`) | wedi.test.js:410,417; expandWallFaces :4444 |
| `CURB_LAP` | wedi.js:4530 (`export const … = 0.5`) | TopDown/Iso, 11 call sites, 702–1731 | wedi.js:4552 (`curbInsets`) |
| `panThick` | wedi.js:4944 (`export function`) | Iso :1512 | wedi.test.js:657–658; wedi.js:5092, :5801 |

`CORNER_CUT`, `expandWallFaces`, `curbInsets`, `applyCurbInset`, `openCorners`
had **zero** real hits in the cluster (grep showed 0 in the brief's own loop)
→ **STAYS** in wedi.js untouched, cluster doesn't reference them at all (other
code below the cluster in WediConfigurator.jsx does).

`curbWidth` and `curbRuns` need special handling — see the two callouts right
below this table.

**`curbWidth` — cannot move as-is (hidden catalog dependency).** `curbWidth`
IS referenced by the cluster (via `curbHeight`, :535, `curbWidth(it)`), but
its wedi.js body is *not pure*:
```js
export function curbWidth(key) {
  const it = typeof key === "string" ? item(key) : key;   // ← catalog read
  return it && /lean/i.test(it.name || "") ? 2 : 4.5;
}
```
`item()` reads the wedi catalog index — showerdraw.jsx/.js must never import
that. wedi.test.js calls `curbWidth("US3000039")` with a **string key**
(:1080–1081), and wedi.js's own `curbInsets` (wedi.js:4552,4554) also calls
it with a string `curbKey` — both need the string-resolving behavior kept.
The cluster's own two call sites (`curbHeight`'s `curbWidth(it)` at :535, and
the WediConfigurator.jsx call at :2427, `curbWidth(line.item)`) both always
pass an **already-resolved object** (`it`/`line.item`), never a string — the
`item(key)` branch is dead code on those two paths.
**Resolution:** split it.
- New pure function **`curbWidthOf(itemObj)`** — just the last line's logic
  (`itemObj && /lean/i.test(itemObj.name || "") ? 2 : 4.5`) — MOVES to
  showerdraw.js. `curbHeight` (moving) calls `curbWidthOf`, not `curbWidth`.
- wedi.js's exported `curbWidth(key)` **stays in wedi.js**, rewritten as a
  thin wrapper: `const it = typeof key === "string" ? item(key) : key; return
  curbWidthOf(it);` — importing `curbWidthOf` from `./showerdraw.js`. This
  keeps its public signature and behavior identical for wedi.test.js and
  `curbInsets`.
- WediConfigurator.jsx's outside-cluster call at :2427 (`curbWidth(line.item)`)
  keeps calling wedi.js's `curbWidth` unchanged (already imported from
  `./wedi.js` there for other reasons) — no edit needed at that call site.

**`curbRuns` — comment-only, does NOT move.** The brief's raw grep counted 3
hits in-cluster, but all three (WediConfigurator.jsx:686, :1100, :1555) are
prose inside `//` comments explaining the geometry, not code that calls
`curbRuns`. The only real call (`curbRuns(diag.room, buildWalls, …)`) is at
:2422, outside the cluster. **STAYS** in wedi.js untouched.

### C. wedi.js exports the cluster uses but that are NOT in the brief's
    geometry list — pure, cluster-only, safe to move + re-export the same way

| Identifier | wedi.js def | Real cluster call sites | wedi.test.js imports it too |
|---|---|---|---|
| `benchFootprint` | wedi.js:4751 (`export function`) | :757, :1045, :1218, :1624, :1682, :1693, :1709 (7 sites, TopDown+Iso) | yes (wedi.test.js:9, :908, :910, :914); benchEdgeSpans :4767 |
| `BENCH_DEPTH` | wedi.js:4700 (`export const … = 14`) | :1212 (TopDown, bench-zone hit-test) | yes (wedi.test.js:10, :907); normBench :4741 |

Both bodies are pure (no `item()`/catalog reads) — confirmed by reading their
wedi.js source. Same delete + re-export treatment as `WALL_THICK`/`CURB_LAP`/
`panThick`.

### D. Pure utilities the cluster leans on heavily — duplicate, do NOT delete from wedi.js

| Identifier | wedi.js def | Cluster hits | Outside-cluster hits (same file) |
|---|---|---|---|
| `round2` | wedi.js:3724, one-liner | 38 | ~20 (pricing/etc. elsewhere in WediConfigurator.jsx, and used all over wedi.js itself) |
| `inch` | wedi.js:3945 | 10 | ~18 |

Both are pure (no catalog dependency) but are NOT geometry-specific — they're
generic number formatters used throughout wedi.js's pricing code and the rest
of WediConfigurator.jsx, well beyond this cluster. Deleting them from wedi.js
would ripple far outside this extraction's scope. **Do not move/delete.**
Instead, paste a private copy of each into showerdraw.js (verbatim source
below — trivial, one comparison point, effectively zero drift risk):
```js
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function inch(n) {
  const whole = Math.floor(n + 1e-9), rem = n - whole;
  if (rem < 1e-6) return String(whole);
  let den = 64, num = Math.round(rem * den);
  if (num === den) return String(whole + 1);
  while (num % 2 === 0 && den % 2 === 0) { num /= 2; den /= 2; }
  return (whole ? whole + " " : "") + num + "/" + den;
}
```
wedi.js keeps its own originals unchanged; no re-export.

---

## PASS-AS-PROP

The brief expected none — TopDown/Iso's props were assumed to already cover
everything. The audit found **two real exceptions**, both inside `TopDown`
only (`Iso` never calls either):

| Identifier | wedi.js def | Cluster call site | Why it can't just move |
|---|---|---|---|
| `item` | wedi.js:4338 (`export function`) | TopDown :1038, `benchTag` — `item(b.part)` for a premade bench's label | reads the private catalog index (`CAT`/`INDEX`) — inherently can't live outside wedi.js |
| `normBench` | wedi.js:4715 (`export function`) | TopDown :1218, `benchFootprint(normBench(benchZone, o.room), o.room)` | calls `item()` internally — same reason |

**New props required on `TopDown`** (not in Task 3 brief's "verbatim,
unchanged" signature — that signature must gain these two):
- `itemFn` — pass `item` (already imported into WediConfigurator.jsx from
  `./wedi.js`) at both real call sites (:3121 rail view, :3507 print/preview
  view). The `:2788` mini-thumbnail call (`<TopDown o={o} w={120} h={86} mini
  wallOn={wallOnMap} />`) passes no `benches`, so `benchTag`/`itemFn` is never
  invoked there — no change needed at that call site, `itemFn` will simply be
  `undefined` and unused.
- `normBenchFn` — pass `normBench` (same import) at the same two call sites.
- Inside the moved `TopDown` body, replace `item(b.part)` → `itemFn(b.part)`
  and `normBench(benchZone, o.room)` → `normBenchFn(benchZone, o.room)`.

(`item` at WediConfigurator.jsx:469, `.item.erp`/`.item.us`, is a **property
access** on a piece object — not a call to the imported `item()` function —
false positive, not part of this entry.)

---

## STAYS

Everything below is either genuinely unreferenced by the cluster, or a
name-collision false positive resolved by hand.

**wedi.js imports the cluster doesn't touch** (confirmed 0 real hits):
`expandWallFaces`, `curbInsets`, `applyCurbInset`, `openCorners`, `CORNER_CUT`,
`curbRuns` (comment-only — see MOVE section B callout), `catalog`, `group`,
`pans`, `curbs` (see false-positive note below), `kitFor` (comment-only — see
false-positive note below), `solve`, `figureConsumables`, `panelPlan`,
`BROWSE_SECTIONS`, `sectionHit`, `tierPrice`, `lineItems`, `coverFrames`,
`TIERS`, `SKU`, `MODULE_DEPTH`, `MODEXT_DEPTH`, `FINISHES`, `GROUP_LABEL`,
`BUILDER_MULT`, `SO_MIN_NET`, `benchPremades`, `benchPanRoom`, `benchPanPlan`,
`smallerPanFor`, `BENCH_CORNER_LBL`.

**Other file-local helpers/imports the cluster doesn't reference:** `fm`,
`useEscClose`, `TIER_COLOR`, `createPortal`, `Plus`, `Printer`, `Copy`, `Eye`.

**`RAIL_PAD_X`, `RAIL_PAD_Y`, `RAIL_MIN_W`** — same source lines as moving
`RAIL_*` constants (see MOVE §A split note) but used only outside `railSplit`
(:1890–1891) → stays in WediConfigurator.jsx.

**`DEF_WALLS`, `DEF_OPTS`, `DEF_INP`** (:1762–1769) — swept in only by the
brief's `sed 530,1772p` overrunning the true cluster end (:1756); these belong
to the next section ("the popup" state defaults) and have nothing to do with
drawing. Not part of this move at all.

**Name-collision false positives** (real identifier exists, but the token
inside the cluster resolves to something else entirely):
- **`X`** — the top-of-file `import { X, … } from "lucide-react"` (the close
  icon) is real and used elsewhere (:3455, :3578), but inside `TopDown` the
  cluster defines its **own** local `const X = (x) => round2(ox + x * sc), Y
  = …` (WediConfigurator.jsx:809) that shadows it for the whole function. `Iso` never references
  bare `X` at all. Zero real dependency on the lucide import.
- **`curbs`** (wedi.js catalog export) — inside `TopDown`/`Iso`, `curbs` is a
  **destructured prop name** in each function's own signature
  (`function TopDown({ …, curbs, … })`), not the wedi.js catalog list. Already
  an existing prop per Task 3's interface — no action needed.
- **`kitFor`** — both hits (WediConfigurator.jsx:1242–1243) are prose inside a
  comment sitting just past the true cluster end (part of the sed-1772
  overrun, see `DEF_WALLS` note above), not a real call.
- `rgba(...)`, `url(#...)`, `rotate(-90 …)` — these matched the call-expression
  regex only because they appear *inside SVG attribute string literals*
  (`stroke="rgba(28,26,23,.42)"`, `transform={`rotate(-90 …)`}`, `clipPath=
  {`url(#${id})`}`) — not JS function calls. No such functions exist.
- `pre`, `post` — matched the call-expression sweep at WediConfigurator.jsx:313
  (`fp.push(pre(d)); fp.push(post(d));`) but both are ordinary **parameters**
  of the locally-defined `cornerPts` closure a few lines above — pure cluster
  internals, nothing external.

---

## Completeness sweep

Re-ran the full identifier sweep (call-expression regex + bare-constant
regex + JSX-tag regex) against the cluster text after finishing
classification. Every hit is accounted for above as MOVE, PASS-AS-PROP,
STAYS, or an explained false positive/comment-only mention. **The sweep comes
back with nothing unclassified** — confirmed by manually walking all 66
call-expression identifiers and all bare ALL-CAPS tokens (the latter set is
otherwise entirely English prose in comments or unprefixed hex color digits
like `B6BF96`, `C2CBA4`, which are not identifiers at all).

---

## Task 3 checklist

**Exact line ranges to cut** (this HEAD, `690eeab`):
1. WediConfigurator.jsx **:47–56** — split, not a clean cut (see MOVE §A):
   - :47–54 cut wholesale (comment + `RAIL_DESIGN_W`/`RAIL_PLAN_H`/`RAIL_ISO_H`).
   - :55 rewrite in place to `const RAIL_PAD_X = 24, RAIL_PAD_Y = 24;`; append
     `const RAIL_GAP = 10, RAIL_HINT_H = 34;` to the cut content.
   - :56 rewrite in place to `const RAIL_MIN_W = 240;`; append `const
     RAIL_MIN_PLAN = 210, RAIL_MIN_ISO = 240;` to the cut content.
2. WediConfigurator.jsx **:57–71** — cut wholesale (comment + `railSplit`).
3. WediConfigurator.jsx **:521–1756** — cut wholesale (full "the drawings"
   section: style/Z-height/pan/curb constants, `curbHeight`, `panCap`,
   `slopeMarks`, `fallArrow`, `curbBands`, `framedStandIns`, `curbCornerOut`,
   `bandPoly`, `topGeom`, `TopDown`, `Iso`). Inside the moved `TopDown` body,
   rewrite `item(b.part)` → `itemFn(b.part)` and `normBench(benchZone,
   o.room)` → `normBenchFn(benchZone, o.room)`, and add `itemFn, normBenchFn`
   to `TopDown`'s destructured parameter list.
4. wedi.js — delete the bodies of `WALL_THICK` (:4439), `CURB_LAP` (:4530),
   `curbWidth` (edit line 4533, the return statement, :4531–4534; keep the function but rewrite —
   see below), `panThick` (:4944–4952), `benchFootprint` (:4751–4756),
   `BENCH_DEPTH` (:4700).

**Recommended file split** (resolves Task 3 brief's own "decide by running
the test, not by guessing" — verified here that plain `node --test` has no
JSX loader configured, `package.json`'s test script is bare `node --test
src/*.test.js`, so a `wedi.js` re-export reaching into a file containing real
JSX syntax WILL fail to parse):
- **`src/showerdraw.js`** (no JSX) — everything pure: `railSplit` + its
  `RAIL_*` consts, `curbHeight`, `curbWidthOf`, `panCap` + its consts,
  `slopeMarks`, `fallArrow`, `curbBands`, `framedStandIns`, `curbCornerOut`,
  `bandPoly`, `topGeom`, the style consts (`PIECE_FILL`… `FONT`), the six
  delete-from-wedi.js exports (`WALL_THICK`, `CURB_LAP`, `panThick`,
  `benchFootprint`, `BENCH_DEPTH`, and `curbWidthOf` in place of `curbWidth`),
  the duplicated `round2`/`inch`.
- **`src/showerdraw.jsx`** (JSX) — `TopDown`, `Iso` only, `import * from
  "./showerdraw.js"` (or named) for everything above, plus `export * from
  "./showerdraw.js"` so WediConfigurator.jsx's one import line (`import {
  TopDown, Iso, railSplit, RAIL_DESIGN_W } from "./showerdraw.jsx"`) still
  gets everything from a single module, matching Task 3's brief interface
  note.

**Import line WediConfigurator.jsx needs** (replaces the cut code, and covers
both outside-cluster call sites found — `railSplit` at :1899, `curbHeight` at
:2427 via nothing extra since `curbHeight`'s only outside caller already sits
right next to the `curbWidth` import which is unaffected):
```js
import { TopDown, Iso, railSplit, RAIL_DESIGN_W, curbHeight } from "./showerdraw.jsx";
```
(`curbHeight` needs adding to this import — it's called at :2427, outside the
cut range, and previously required no import since it was a same-file local.)

**Re-export line(s) wedi.js needs** (add near the deleted definitions'
original spots, importing from the `.js` half per the split above):
```js
import { WALL_THICK, CURB_LAP, panThick, benchFootprint, BENCH_DEPTH, curbWidthOf } from "./showerdraw.js";
export { WALL_THICK, CURB_LAP, panThick, benchFootprint, BENCH_DEPTH };
```
(`curbWidthOf` is imported but NOT publicly re-exported — nothing outside wedi.js needs it.)

Plus rewrite wedi.js's own `curbWidth` to a thin wrapper (see MOVE §B
callout):
```js
export function curbWidth(key) {
  const it = typeof key === "string" ? item(key) : key;
  return curbWidthOf(it);
}
```

**Commands to run:**
```bash
npm run build && node --test src/wedi.test.js src/model.test.js
grep -n "wedi.js" src/showerdraw.jsx src/showerdraw.js
grep -l "curbCornerOut" dist/assets/*.js
```

---

## Self-review — would Task 3 compile purely from this list?

**Bug found in audit review:** The checklist initially prescribed `export { ... } from "./showerdraw.js"` for wedi.js (a re-export), but this creates NO local bindings. Since wedi.js's retained code still uses all six moved identifiers internally (verified at call sites listed above), the re-export pattern would fail at runtime. The checklist now uses `import` + bare `export` instead, so wedi.js keeps the bindings it needs while only publicizing the five identifiers external code depends on (not `curbWidthOf`).

Walked the top of both components against the final list:

- **`TopDown`'s** destructured signature (`{ o, w, h, mini, wallOn, dWalls,
  benches, framedFit, cuts, curbs, curbDiags, curbW, placing, onCorner,
  onEdge, onWallMenu, onBenchMenu }`) — every name here is either an existing
  prop (unaffected) or `curbs`, which is a false-positive shadow (STAYS as a
  prop name, not the wedi.js import). Plus the two new props this audit adds
  (`itemFn`, `normBenchFn`). First few lines reference `PIECE_FILL`-family
  consts and `useId` — both accounted for (MOVE / React import respectively).
- **`Iso`'s** signature (`{ o, w, h, dWalls, panelFit, benches, framedFit,
  cuts, curbs, curbDiags, curbH, curbW, onWallMenu }`) — same `curbs` shadow;
  `curbH`/`curbW` are plain props (unaffected); its body's first real external
  reference is `WALL_THICK` (line :1286, `const T = WALL_THICK`) — covered by
  the wedi.js re-export, transparent to Iso either way.

Nothing in either signature or their opening lines calls anything absent from
this list. The two genuinely new things Task 3 must do beyond a mechanical
cut — the `curbWidth`/`curbWidthOf` split and the `itemFn`/`normBenchFn`
props — are both spelled out above with exact call sites and exact
replacement text.
