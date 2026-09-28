# Handoff — shower configurators, ticket 158: after Phase 4 (2026-09-28)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`. The earlier handoffs are
history now.

## Where things stand

| Piece | State | Where |
|---|---|---|
| Phases 0–3 | merged | see `shower-config-phase4-2026-09-28.md` |
| **Phase 4** the Compare set | PR open from `claude/hopeful-curie-1dwb3u` | spec `docs/superpowers/specs/2026-09-28-compare-set-design.md`, ADR 0052 |

Read these before touching any of this:
- **ADR 0052** (`docs/adr/0052-compare-set.md`);
- the ADR 0034 Phase 4 amendment;
- the spec's "Amendments during planning and build" (rulings 1–11);
- the `src/CLAUDE.md` entries for `compareset.js`, `resumeprompt.jsx`,
  `comparekit.js`, `comparegrid.js`, `CompareTab.jsx`, both popups and
  `App.jsx`;
- the data-model skill's `compareSets`.

## What Phase 4 left in place

- **Four fixed columns.** `CELLS` runs wedi Board, wedi Membrane, Schluter
  Board, Schluter Membrane, and quote-option letters follow it. The host
  column is ringed with `.cur` inset shadows and a CURRENT tab.
- **`project.compareSets[areaId][cellKey]`** holds kept builds: a marker,
  the room it was built for, savedAt/savedBy, and the target kit.
  - The popups write it as they unmount, skipping no-op writes.
  - App's `writeCompareSet` merges onto `dataRef`'s latest record.
- **Open** goes through App's `openCompareCell`/`kitPop`. It reattaches to
  a live `target` row, or starts **detached** when the popup's row already
  holds a kit.
- **Sync** is `comparekit.syncKept`: the anchor's neutral room + benches +
  added lines, over the kept choices and own lines.
  - Brand-only geometry resets.
  - `keptDropped` names picks that fell back.
- **The resume prompt** shows on a fresh (non-marker) seed when the set
  keeps a build of that brand.
- **Benches** are on the neutral room and billed by house kits.

## Carry forward

- **Stepped quantities** (`qtyOv`) don't ride a kept build. That's the
  marker rule. If the owner wants them kept, the entry needs the basket's
  `session` sibling, plus a popup seed path that applies it (today only
  Reconfigure's `editRows` seeds qtyOv).
- **A cross-brand premade bench** becomes the other engine's default build
  for that kind. For example, a Schluter premade corner is a wedi
  site-built corner seat. Mapping premade ⇄ premade is its own ask.
- **The "your pick" tag** in the mockup (marking a kept column's swapped
  line) was not built. Kept builds show their parts but don't tag which
  were picks.
- **Kept builds have no in-column editing.** Open is the way in (spec, out
  of scope).
- **Still open from Phase 3:**
  - the Schluter drain/short chip strings are pinned only by hand-made
    rows;
  - ADR 0034's "no feedback after sending options";
  - the S-DRY curb drawing dimensions;
  - stacked extensions;
  - the drain height kit;
  - the wedi `extensionSf` over-count.

## Proof

- `npx vite --port 5199 --strictPort`, then
  `node .scratch/158_shower-config-roadmap/p4/shoot-set.mjs` → "all checks
  passed".
- Harness: `compare-set-preview.html?host=wedi|schluter&kept=1`.
- New DOM hooks:
  - `data-cmp-col`, `data-cmp-status`, `data-cmp-current`;
  - `data-cmp-open`, `data-cmp-sync`, `data-cmp-clear`;
  - `data-cmp-view-lines`, `data-cmp-view-sum`, `data-cmp-sub`;
  - `data-cmp-msg`;
  - `data-resume`, `data-resume-pick`, `data-resume-new`.
- `p3/shoot-grid.mjs`, `p1d/shoot-compare.mjs` and `p2/shoot-compare.mjs`
  drove the retired grid and detail, and are superseded.
- The other earlier scripts re-ran clean, and their PNGs were restored.
- Everything else from the Phase 4 handoff's environment notes still
  applies: the build env vars, the boot-chunk grep, Playwright paths.
