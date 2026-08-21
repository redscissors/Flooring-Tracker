# HANDOFF — Phase 6: the wedi S-Dry wall fork (written 2026-08-21, after phase 5 merged)

For the next session picking up the Schluter-configurator roadmap. Read this,
the roadmap (`docs/superpowers/plans/2026-08-20-schluter-configurator-roadmap.md`),
and ADR 0034; that is the whole state. (The previous edition of this file was
the phase-3 handoff — superseded; phases 3–5 are on main.)

## Where things stand

| Piece | State |
|---|---|
| Phase 1 — shared drawing module | MERGED — PR #320. ADR 0033. |
| Phase 2 — schluter engine | MERGED — PR #321. ADR 0032. |
| Phase 3 — SchluterConfigurator UI | MERGED — PR #322. |
| Phase 4 — shared Stock only / Full catalog switch | MERGED — PR #323. |
| Phase 5 — Compare tab + quote-options A/B | MERGED — PR #324 (2026-08-21). ADR 0034. Proof under `phase5-proof/`. |
| **Phase 6 — wedi S-Dry wall fork** | **Not started. The last roadmap phase.** No plan doc yet — write it when the design is settled. |

Spec files (prototype.html, README.md with owner decisions 1–8,
pricelist-notes.md) are all on main in this directory now.

## What phase 6 is

Owner decision 1 (2026-08-20, binding): *"wedi gets the wall fork too:
S-Dry is wedi's membrane-over-backer analog — design the same 'wall system'
choice INTO the wedi configurator."* The model is the Schluter popup's
`wallSys: "membrane" | "board"` fork (phase 3): one choice that swaps the
wall recipe, the drawing's panel ticks, and the walls cost story.

**Unlike phases 3–5, the wedi fork was never prototyped** — the approved
prototype's P1 fork is Schluter-side only. Expect a design/brainstorm pass
(owner sign-off on the recipe) before a plan doc; the repo's
prototype-before-production convention (repo rule 3) applies.

## Where S-Dry already lives in wedi.js (grep-verified 2026-08-21)

- S-Dry is a **pan family**, not a wall system, today: pan rows carry
  `sub: "sdry"` (`wedi.js:4217`), are **excluded from `pans()` unless
  `opts.sdry`** (`:4353`), rank last in the family order (`:4358`), and have
  their own drains/covers/curbs (full + lean 72″)/corners/height kit under
  `group: "sdry"` (catalog rows ~`:900-1070`; classifier `US..76…` →
  `:4044`).
- `kitFor` already lands `SKU.sdrySeal` + `sdrySealTrowel` ("field seal —
  Subliner laps & perimeter") for sdry pans (`:5126-5127`).
- Browse has an "S-DRY system" section (`:3869`) and a Kits family chip
  (`:3846`); `benchPanRoom` treats sdry as a non-resolvable family
  (`:4927`).
- So the fork's open design question: is "wall system: S-Dry" a wall-recipe
  toggle independent of pan choice (membrane + backer-by-others walls
  instead of wedi building panels), or coupled to the sdry pan family? What
  are the wall lines and their coverage/pricing? Does `solve()` rank sdry
  pans differently under the S-Dry wall system? These are owner questions —
  take them to the owner before writing the plan.

## Couplings / ride-alongs to fold into phase 6

- **ADR 0034 open item (a):** the Compare tab's derived Schluter side is
  always `wallSys:"membrane"` — no like-for-like walls toggle. Once wedi
  has its own wall fork, the natural move is a wallSys mapping across both
  engines in `comparekit.js` (`roomFromWedi`/`schluterBuildFor`) + a
  compare-surface toggle. Decide with the owner whether it rides phase 6 or
  stays open.
- **ADR 0034 open item (b):** landing quote Options A/B gives no
  toast/auto-close in the popup — separate small UX call, tracker-worthy.
- If the fork adds a field to the persisted wedi `cfg` (it will —
  `seedState`/`markCfg` roundtrip): load the `floortrack-data-model` skill
  first; `product.wedi` marker precedent governs; wedi.test.js pinned
  totals must not move for the default wall system.

## Process notes (what worked in phase 5)

- Subagent-driven development off a written plan (writing-plans →
  subagent-driven-development, one fresh implementer + reviewer per task,
  final whole-branch review). The review loops caught four real bugs before
  the PR; keep them.
- Progress ledger at `.superpowers/sdd/progress.md` (gitignored) survives
  context compaction — recreate it per session.
- Preview rigs all exist: `wedi-preview.html` / `schluter-preview.html`
  both feed fixture-backed registry rows and a no-op `onQuoteOptions`;
  shot rigs committed under `phase5-proof/` (`shoot-compare.mjs`,
  `final-review/shoot-final-review.mjs`); chromium at
  `/opt/pw-browsers/chromium`; `npm run build` needs a local gitignored
  `.env` (`%VITE_SUPABASE_URL%` interpolation).
- Baseline at merge: `npm test` 1060/1060; ADR index through 0034.

## Data + environment notes (unchanged)

- Real sheets (EFT, ERP Vendor SKU Analysis) are NOT committed (shop
  pricing); `src/schluterfixture.js` is the frozen test snapshot; wedi.js
  carries its own tables. `assets.schluter.com` (and wedi's site) are
  egress-blocked — owner uploads documents when needed.
- Repo non-negotiables: no Supabase writes, no pushes to main (PR always),
  preview proof before merge.
