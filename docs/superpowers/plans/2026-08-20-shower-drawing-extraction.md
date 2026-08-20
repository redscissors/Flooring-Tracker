# Shower Drawing Extraction Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the drawing engine (TopDown, Iso, railSplit and their
helpers) out of `src/WediConfigurator.jsx` into a new shared module
`src/showerdraw.jsx`, changing wedi's rendered output by exactly zero
pixels, so the Schluter configurator (phase 3) can draw with the same code.

**Architecture:** Pure mechanical extraction. The drawing components are
already props-driven (they take a geometry object `o` plus walls, curbs,
benches, cuts and callbacks); nothing about their logic changes. Constants
and pure-geometry helpers they use move with them; `showerdraw.jsx` must not
import `wedi.js` (the ~2,000-row tables must never ride into a future
Schluter chunk). The gate is byte-identical screenshots.

**Tech Stack:** React 18, Vite 5, Playwright (pre-installed Chromium at
`/opt/pw-browsers/chromium`), `node --test`.

## Global Constraints

- Branch: `claude/shower-drawing-extraction-<suffix>` off latest `main`;
  lands as its own PR; never push to `main`.
- Zero behavior change: every screenshot in the parity set must match
  byte-for-byte (sha256) before vs after. If a hash differs, the extraction
  has a bug — fix the extraction, never re-bless the hash.
- `src/showerdraw.jsx` must not import `./wedi.js` (chunk hygiene, ADR 0026).
- No new comments beyond moved ones + the module header; update
  `src/CLAUDE.md`.
- `npm run build` and `node --test src/*.test.js` green at every commit.

---

### Task 1: Parity rig — baseline screenshots before touching anything

**Files:**
- Create: `.scratch/098_shower-drawing-extraction/shoot-parity.mjs`
- Create (generated): `.scratch/098_shower-drawing-extraction/before/*.png`,
  `.scratch/098_shower-drawing-extraction/before.sha256`

**Interfaces:**
- Consumes: the committed harness `wedi-preview.html` → `src/wedipreview.jsx`
  (real WediConfigurator, no Supabase), served by `npx vite --port 5199`.
- Produces: `shoot-parity.mjs <label>` writing `<label>/*.png` +
  `<label>.sha256` — Task 4 reruns it with label `after`.

- [ ] **Step 1: Write the shoot script.** Model it on
  `.scratch/071_wedi-pr282-preview/shoot.mjs` (same locators: `.modetab`,
  `.rf` inputs, `[data-wedi-pop]`). Scenarios to capture, one PNG each,
  clipping the drawings rail (`.diagcol`) only — the rail is what moves:

  1. `kit-48x60` — Kits tab, click the 4'×5' pan row.
  2. `custom-58x33-cut` — Custom shower, size 58 × 33 (deep-cut cards).
  3. `benches-mix` — 48 × 60 with a site bench left + corner bench br
     (drive via the same field/`click` steps `.scratch/071/inspect-bench.mjs`
     uses).
  4. `corner-cut` — 48 × 60, toggle one corner cut on the plan.
  5. `linear-module` — Custom shower 36 × 72, linear drain preference.
  6. `curbless` — 42 × 42 curbless.

  ```js
  // shoot-parity.mjs <label>   — writes .scratch/098_.../<label>/*.png + <label>.sha256
  import { chromium } from "playwright";
  import { createHash } from "node:crypto";
  import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
  const label = process.argv[2];
  const OUT = `.scratch/098_shower-drawing-extraction/${label}`;
  mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
  pg.on("pageerror", (e) => { console.error("pageerror", e); process.exitCode = 1; });
  await pg.goto("http://localhost:5199/wedi-preview.html", { waitUntil: "load" });
  await pg.waitForTimeout(1400);
  const shot = (name) => pg.locator(".diagcol").screenshot({ path: `${OUT}/${name}.png` });
  // …the six scenarios, each ending in `await shot("<name>")`…
  await b.close();
  const files = ["kit-48x60","custom-58x33-cut","benches-mix","corner-cut","linear-module","curbless"];
  writeFileSync(`.scratch/098_shower-drawing-extraction/${label}.sha256`,
    files.map((f) => createHash("sha256").update(readFileSync(`${OUT}/${f}.png`)).digest("hex") + "  " + f).join("\n") + "\n");
  ```

  (The `.diagcol` class name is the drawings rail column — verify with
  `grep -n diagcol src/WediConfigurator.jsx` and adjust if it differs.)

- [ ] **Step 2: Run the baseline.**

  Run: `npx vite --port 5199 &` then
  `node .scratch/098_shower-drawing-extraction/shoot-parity.mjs before`
  Expected: six PNGs + `before.sha256`, exit code 0, no pageerror lines.

- [ ] **Step 3: Commit** the script and the baseline hashes (PNGs too — they
  are the review evidence).

```bash
git add .scratch/098_shower-drawing-extraction/
git commit -m "Parity rig: baseline wedi drawing screenshots before extraction"
```

---

### Task 2: Audit — the definitive move list

**Files:**
- Create: `.scratch/098_shower-drawing-extraction/move-list.md`

**Interfaces:**
- Produces: the audited list of every identifier the drawing cluster
  (`src/WediConfigurator.jsx` lines ~530–1772) references, split into
  MOVE / PASS-AS-PROP / STAYS. Task 3 executes exactly this list.

- [ ] **Step 1: Enumerate the cluster's external references.**

  Run, from repo root:
  ```bash
  sed -n '530,1772p' src/WediConfigurator.jsx > /tmp/cluster.jsx
  # identifiers imported from wedi.js (line 20 of WediConfigurator.jsx):
  for id in expandWallFaces WALL_THICK CURB_LAP curbWidth panThick curbInsets applyCurbInset openCorners curbRuns CORNER_CUT; do
    printf "%-16s %s\n" "$id" "$(grep -c "\\b$id\\b" /tmp/cluster.jsx)"
  done
  # locals defined above 530 that the cluster uses:
  for id in railSplit parseIn ftIn fm PAN_ARROW PAN_HEAD panCap curbHeight CURB_W_LEAN CURB_H_LEAN CURB_H_STD; do
    printf "%-16s %s\n" "$id" "$(grep -c "\\b$id\\b" /tmp/cluster.jsx)"
  done
  ```

- [ ] **Step 2: Classify each hit** in `move-list.md`:
  - **MOVE** into `showerdraw.jsx`: everything with hits that is pure
    geometry/formatting — expected: `railSplit`, `slopeMarks`, `fallArrow`,
    `curbBands`, `framedStandIns`, `curbCornerOut`, `bandPoly`, `topGeom`,
    `TopDown`, `Iso`, `panCap`, `curbHeight`, the Z-height constants block
    (~line 530), `PAN_ARROW`, `PAN_HEAD`, and any of the wedi.js geometry
    exports (`WALL_THICK`, `curbWidth`, `panThick`, `curbInsets`,
    `CORNER_CUT`, `CURB_LAP`, `curbRuns`, `openCorners`,
    `applyCurbInset`, `expandWallFaces`, `CURB_W_LEAN`, `CURB_H_LEAN`,
    `CURB_H_STD`) that the cluster actually references. Moved wedi.js
    exports are DELETED from wedi.js and re-imported there from
    `./showerdraw.jsx` (wedi.js re-exports them so its existing callers and
    tests keep one import — the `wediquery` precedent, in reverse).
  - **PASS-AS-PROP**: anything reading wedi catalog rows or build state.
    Expected: none — the components already take those as props; if the
    audit finds one, it becomes a prop, and `move-list.md` names it.
  - **STAYS**: UI helpers (`fm`, `NumIn`, `unwedi`…) the cluster does not
    reference.

- [ ] **Step 3: Commit** `move-list.md`.

```bash
git add .scratch/098_shower-drawing-extraction/move-list.md
git commit -m "Extraction audit: definitive move list for the drawing cluster"
```

---

### Task 3: Extract `src/showerdraw.jsx`

**Files:**
- Create: `src/showerdraw.jsx`
- Modify: `src/WediConfigurator.jsx` (delete moved code, import from
  `./showerdraw.jsx`)
- Modify: `src/wedi.js` (moved geometry exports become re-exports:
  `export { WALL_THICK, curbWidth, /* …per move-list */ } from "./showerdraw.jsx"`
  — NOTE: wedi.js is imported by `node --test`; if re-exporting from a .jsx
  file breaks `node --test wedi.test.js`, put the moved pure-geometry
  functions in `src/showerdraw.js` (no JSX) and the React components in
  `src/showerdraw.jsx`, with the .jsx importing the .js. Decide by running
  the test, not by guessing.)

**Interfaces:**
- Produces (consumed by WediConfigurator now, SchluterConfigurator in
  phase 3):
  `railSplit(box, hinted)`,
  `TopDown({ o, w, h, mini, wallOn, dWalls, benches, framedFit, cuts, curbs, curbDiags, curbW, placing, onCorner, onEdge, onWallMenu, onBenchMenu })`,
  `Iso({ o, w, h, dWalls, panelFit, benches, framedFit, cuts, curbs, curbDiags, curbH, curbW, onWallMenu })`
  — signatures verbatim, unchanged.

- [ ] **Step 1: Move the code.** Cut the MOVE list verbatim (comments
  included, order preserved) into `src/showerdraw.jsx` with a short module
  header ("the shared shower drawings — extracted from WediConfigurator.jsx
  (issue 097 phase 1); both configurators feed the same geometry shape; must
  never import wedi.js"). Add the exports; add the import line in
  WediConfigurator; convert moved wedi.js exports per the Files note above.

- [ ] **Step 2: Build + unit tests.**

  Run: `npm run build && node --test src/wedi.test.js src/model.test.js`
  Expected: build succeeds; all tests pass (wedi.test.js exercises the
  re-exported geometry through wedi.js).

- [ ] **Step 3: Chunk hygiene check.**

  Run: `grep -n "wedi.js" src/showerdraw.jsx src/showerdraw.js 2>/dev/null`
  Expected: no output. Then confirm the built wedi chunk still contains the
  drawings and the boot chunk does not:
  `grep -l "curbCornerOut" dist/assets/*.js` → exactly the lazy wedi chunk.

- [ ] **Step 4: Commit.**

```bash
git add src/showerdraw.jsx src/WediConfigurator.jsx src/wedi.js
git commit -m "Extract the shared shower drawing module from WediConfigurator"
```

---

### Task 4: Pixel parity gate

**Files:**
- Create (generated): `.scratch/098_shower-drawing-extraction/after/*.png`,
  `after.sha256`

- [ ] **Step 1: Re-shoot.**

  Run: `npx vite --port 5199 &` then
  `node .scratch/098_shower-drawing-extraction/shoot-parity.mjs after`

- [ ] **Step 2: Compare.**

  Run: `diff .scratch/098_shower-drawing-extraction/before.sha256 .scratch/098_shower-drawing-extraction/after.sha256`
  Expected: no output (identical). Any diff = extraction bug; return to
  Task 3, never re-bless. (If a hash differs only because of font
  rasterization non-determinism, prove it by re-running `before` twice —
  if two `before` runs differ on the same file, switch that scenario's
  comparison to pixelmatch with 0 threshold and note it in move-list.md.)

- [ ] **Step 3: Commit** the after set.

```bash
git add .scratch/098_shower-drawing-extraction/
git commit -m "Pixel parity proof: wedi drawings byte-identical after extraction"
```

---

### Task 5: Docs + ADR + PR

**Files:**
- Modify: `src/CLAUDE.md` (add `showerdraw.jsx` entry beside the
  WediConfigurator entry; trim the WediConfigurator entry's drawing prose to
  point at it)
- Create: `docs/adr/00XX-shared-shower-drawing-module.md` (next free number
  in `docs/adr/README.md`, indexed there; follow
  `docs/skills-reference/decide/SKILL.md`)

- [ ] **Step 1:** Write the ADR — decision, the no-wedi.js-import rule, the
  parity-gate methodology, and that Schluter (phase 3) is the second
  consumer.
- [ ] **Step 2:** Update `src/CLAUDE.md` and `docs/adr/README.md`.
- [ ] **Step 3: Commit, push, open the PR** with before/after PNGs embedded
  and the sha256 diff shown. Do not merge — owner reviews (repo
  non-negotiable 3).

```bash
git add src/CLAUDE.md docs/adr/
git commit -m "ADR + file map for the shared shower drawing module"
git push -u origin claude/shower-drawing-extraction-<suffix>
```

## Self-review notes

- Spec coverage: the phase's only requirement is "same drawings, new
  module, provably unchanged" — Tasks 1–4 are the proof chain; Task 5 the
  record. No UI or engine work belongs here; if a step seems to need wedi
  behavior changes, stop — that's a phase-3 concern or a bug in the audit.
- The one undecidable-in-advance point (jsx vs js split for node --test) is
  resolved by running the test, and both outcomes are specified.
