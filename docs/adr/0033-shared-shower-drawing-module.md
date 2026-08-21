# 0033 — Shared shower drawing module, extracted with a pixel-parity gate

Date: 2026-08-21 · Status: accepted

## Decision

The shower plan/isometric drawings — `TopDown`, `Iso`, `railSplit`, and their
pure-geometry helpers (`curbCornerOut`, `bandPoly`, `curbBands`,
`framedStandIns`, `slopeMarks`, `topGeom`, `panThick`, `benchFootprint`, …) —
move out of `WediConfigurator.jsx` into a standalone pair of files (issue 097
phase 1):

- **`src/showerdraw.js`** — pure geometry and constants, no JSX, so plain
  `node --test` can parse it. `wedi.js` reaches it only by importing it.
- **`src/showerdraw.jsx`** — the React components (`TopDown`, `Iso`) plus
  `export * from "./showerdraw.js"`, so a caller gets both halves off one
  import line.

**`showerdraw.js`/`showerdraw.jsx` must never import `wedi.js`, in either
direction.** This is chunk hygiene, not style: `wedi.js` carries ~2,000 rows
of catalog tables behind the lazy `WediConfigurator` chunk (ADR 0026), and the
whole point of the extraction is that a second configurator can draw the same
shower shape without paying for those tables. Schluter (phase 3) is that
second consumer — it imports `showerdraw.jsx` directly and never touches
`wedi.js`.

The dependency the other way stays: `wedi.js` still needs six geometry
identifiers that used to live inline — `WALL_THICK`, `CURB_LAP`, `panThick`,
`benchFootprint`, `BENCH_DEPTH`, and the private `curbWidthOf` (wrapped behind
`wedi.js`'s own exported `curbWidth(key)`, which resolves a string key through
the catalog before calling it). Rather than make every `wedi.js` caller reach
into two modules, `wedi.js` imports these from `showerdraw.js` and bare
re-exports the five public ones, so its own callers and its test file keep a
single `import { ... } from "./wedi.js"`.

## The parity gate

An extraction that reshuffles ~1,300 lines of drawing math with no behavior
change has exactly one property worth proving: that nothing moved. The
standard set here, expected of any future drawing refactor of this shape:

1. Screenshot every drawing state the code paths can reach, on the
   pre-extraction commit, into a committed baseline (`.scratch/.../before/`).
2. Add a settle guard to the capture rig so it can't mistake a blank or
   half-rendered frame for done — a screenshot taken before layout settles is
   worse than no screenshot, because it passes.
3. Re-run the identical rig against the post-extraction commit
   (`.scratch/.../after/`).
4. Diff by **sha256, not by eye** — the manifests for `before/` and `after/`
   must match byte-for-byte. Pixel-similar is not the bar; byte-identical is.

Tasks 1–4 of this extraction (commits `376e095`..`e1482a5`) are that proof
chain; this ADR is the record. `.scratch/098_shower-drawing-extraction/`
carries the rig (`shoot-parity.mjs`), both PNG sets, and the matching
manifests.

## Rejected

- **Leave the drawings inline and duplicate them into a Schluter copy.**
  Rejected outright — duplicated geometry drifts the first time either
  configurator's math changes, which is exactly what `curbCornerOut` and
  `slopeMarks` exist to prevent even within one configurator.
- **One file instead of a `.js`/`.jsx` split.** A single `.jsx` file would
  need a JSX-aware loader wherever it's imported, which `node --test` (run
  through `wedi.test.js`'s plain `node` invocation) doesn't have. Splitting
  the pure geometry out keeps the existing test command working unchanged.

## Consequences

- `wedi.js`'s import line grows by one module but shrinks in spirit: the six
  identifiers it re-exports are geometry `wedi.js` no longer owns, only
  borrows for its own non-drawing callers (`expandWallFaces`, `curbInsets`,
  `normBench`, `benchEdgeSpans`) and its test coverage.
- `round2`/`inch` are duplicated (not shared) between `showerdraw.js` and
  `wedi.js` — deleting `wedi.js`'s originals would ripple outside this
  extraction's scope for two one-line formatters. One comparison point,
  effectively zero drift risk.
- Any future change to the drawings' geometry is now a one-file change that
  both configurators pick up; a change that's supposed to be
  configurator-specific instead now needs an explicit branch inside
  `showerdraw.js`/`.jsx`, which is the correct failure mode to surface early.
