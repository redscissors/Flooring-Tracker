# Handoff: configurator baskets — continue with step 3 (wedi/Schluter)

**State.** Branch `claude/configurator-basket-persistence-ccspby`, 7 commits ahead
of main, all pushed, **no PR opened yet** (owner asks when ready; preview proof
for the PR is already committed). `npm test` 1184/1184. `npm run lint` (8 errors)
and `npm run build` (`vite:build-html: URI malformed` on index.html) fail on
main too — pre-existing, not this branch's.

**Shipped (ADR 0035 steps 1–2).** Read `docs/adr/0035-configurator-kit-instance-id.md`
first — it is the binding spec. Every configurator emission lands stamped with a
shared `kitId`; reconfigure replaces the kit group (`landKitLines`), delete goes
through `removeKitLines`, the placed-kit list derives from anchor markers
(`placedKits` — vendor-generic already). A Sheoga multi-width bundle's first line
carries the whole reopenable snap (`sheoga.bundle`) and that anchor OWNS its
group; `duplicateInto` remaps kitIds per copy. The Sheoga drawer has the derived
"In this project" section (Reconfigure + two-click Remove). Preview shots +
ticket: `.scratch/116_basket-derived-kits/`. Plan (also the SDD template used):
`docs/superpowers/plans/2026-08-29-basket-derived-kits.md`.

**Step 3 — the ask.** Give wedi and Schluter the same basket panel: a staged
basket ("add to basket" without landing — the owner's original ask was e.g. two
wedi shower kits held per job) plus the derived "In this project" section.
Design notes settled in conversation:
- Derived section is nearly free: `placedKits(categories, "wedi"|"schluter")`
  already works; wedi/Schluter kits are single-anchor (no bundle machinery).
  `basketEntryView`-style pricing goes through each vendor's OWN engine.
- Staged entries need new persisted arrays (`wediBasket`, `schluterBasket` on
  the project jsonb) + per-vendor `normBasketEntry` twins wired into `normC` —
  **load the floortrack-data-model skill before touching that**, and keep the
  shared entry contract `{ id, kind, addedAt, snap: {mode, cfg}, ... }`.
- Schluter wrinkle: its catalog is LIVE registry rows (ADR 0032), so staged
  entries can only price once `catReady`; render a faint loading state, never a
  crash. wedi prices from its transcribed tables like Sheoga.
- Delete-on-move stays (staged → placed is a state change, ADR 0035).
- Both popups already have `useEscClose` ladders — the basket drawer takes a
  rung like Sheoga's.

**Deferred papercuts** (final-review triage, chat-only until now — candidates to
fold into step 3 or a follow-up ticket):
1. Reconfigure on the kit the popup is CURRENTLY targeting is a silent no-op —
   `key={sheogaPop.pid}` doesn't change so the fresh seed is discarded. Fix: a
   nonce beside pid in the pop state/key.
2. Refresh mid-bundle-reconfigure reopens single-width — `onConfigChange` /
   ft-open-layer carries only `{mode, cfg}`, not the bundle/multi state.
3. Drawer prices are LIVE re-derivations; after a Sheoga sheet re-transcription
   they can disagree with the rows' landed snapshots with no explanation.
   Sanctioned design (display-only), but consider a drift footnote.
4. An ea-mode placed single (vent/damper) prices off the marker cfg's qty, not
   the row's live qty (the sf-follows-row rule only holds for sqft rows).
5. ADR-listed follow-up UI: a confirm showing the price delta before a
   reconfigure-Add clobbers a kit's lines.

**Coordination.** A sibling session's branch `claude/sample-ordering-workflow-fvsdzp`
(sample ordering) is unmerged and overlaps on the one-line `normP` in
`src/model.js` (it inserts `sample:`, we inserted `kitId:` at the same spot),
the App.jsx model-import line, `src/model.test.js`, both CLAUDE.mds, and the
data-model skill — all additive; whichever PR merges second folds `main` in
(merge, never rebase) and keeps both sides. Check `git log origin/main` at
session start.

**Process the owner wants:** superpowers skills + subagent-driven development
with agents (brainstorming → plan → SDD implementer/reviewer loop → final
whole-branch review → fix wave). Preview proof is non-negotiable before merge:
the harness pattern is `sheoga-preview.html` + `src/sheogapreview.jsx` (copy for
wedi/Schluter — those two already have their own preview harnesses to extend);
screenshots via `npm i --no-save playwright` (never commit package.json),
Chromium under `/opt/pw-browsers`, dev server `PORT=5199 npm run dev`, PNGs
verified by eye and committed under a new `.scratch/117_*/` ticket.
