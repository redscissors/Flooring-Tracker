# HANDOFF — Schluter configurator build (session of 2026-08-20/21)

For the next session picking this project up. Read this, the roadmap, and the
two PR bodies; that is the whole state.

## Where things stand

| Piece | State |
|---|---|
| Prototype + owner decisions 1–8 | `.scratch/097_schluter-configurator/` on branch `claude/schluter-configurator-catalog-e1v6o8` (prototype.html, README.md with the decisions, pricelist-notes.md with the factory recipes) |
| Plans | `docs/superpowers/plans/2026-08-20-*.md` on the same branch (roadmap + phase 1 + phase 2 task plans) |
| **Phase 1 — drawing extraction** | **MERGED — PR #320** (2026-08-21). Byte-identical pixel proof under `.scratch/098_shower-drawing-extraction/`. ADR 0033. |
| **Phase 2 — schluter engine** | **MERGED — PR #321** (2026-08-21, after a main merge-back resolving the ADR-index/CLAUDE.md overlap). 993 tests. ADR 0032. |
| Phases 3–6 | Not started; phase plans get written when their inputs exist (roadmap has the map). |

Both PRs went through per-task review + a whole-branch final review (fixes
applied and verified) and are on main.

## Standing owner item

The curbless **thin-outranks-cut** semantics merged as pinned (decision 6
reading, owner-reviewable test in `schluter.test.js`). If the owner reads
decision 6 the other way, flip the comparator term + test in a follow-up.

## Phase 3 — how to start (the next session's job)

1. Branch `claude/schluter-configurator-ui-<suffix>` off latest main (both
   prerequisites are merged).
2. **FIRST deliverable, before any JSX: the registry→engine adapter** (ADR
   0032 consequences records this as mandatory). Live `normOrderItem` rows ≠
   the engine's fixture shape: `description`→`name`, `stockKind`→`stock`
   boolean, mfg code out of `vendorSkus`/description→`sku`, shop `sku`→`erp`.
   Test it against a REAL book row shape (orderbook.js `normOrderItem`).
   `classify` already retries `vendorSkus[0]` as a floor.
3. Then `SchluterConfigurator.jsx` per the prototype (the approved spec):
   Kits (shelf trays only) / Custom shower / Browse (filter board, factory
   kits live here) over the shared build column + the `showerdraw` rail
   (`TopDown` needs `itemFn`/`normBenchFn` props when benches render — see
   src/CLAUDE.md). Write the phase-3 plan doc first (writing-plans skill).
4. The mortar Settings pick maps into the adapter-shaped
   `cfg.mortarItem = { name, price, cost, stock, sfPerBagAt15 }`.
5. Premade SB bench = UI add-on pick (decision 4's third option, deferred to
   this phase).

## Ride-along list for phases 3–6 (from the final reviews)

- Promote buildKit's text/number lookups (`/inside corner/i`, `sf === 32`,
  "100 ct"…) into classifier facts — 20-line refactor, cheaper now than later.
- `lineItems` signature + `mode:"custom"` hardcode: introduce the kit mode
  and restore the wedi-shaped signature in one move (phase 3).
- Shared `pickFrom(cat, pred, source)` so stock-only filters every role
  (phase 4, with the Stock/Full switch — wedi inherits the switch).
- `brandColor` carries no vendor lead ("Schluter — …") — decide at UI time.
- Persisted `cfg` embeds `mortarItem` whole; consider storing name/id.
- wedi-branded strings + the global `wedi-hatch` SVG id inside showerdraw —
  scoped rename when the second consumer mounts (ADR 0033 consequences).
- Weak-word + size search queries can hit BOTH configurators' pinned rows —
  phase-3 UI call.
- wedi S-Dry wall fork = phase 6 (decision 1).

## Data + environment notes

- The real sheets (EFT SLR_EFT_25_10_01_2.xls, ERP Vendor SKU Analysis) are
  NOT committed (shop pricing) — the owner uploads current editions when
  needed; `src/schluterfixture.js` is the frozen test snapshot.
- `assets.schluter.com` is egress-blocked in Claude sessions; the shower
  chapter PDF was uploaded and transcribed into pricelist-notes.md already.
- The interactive prototype artifact: https://claude.ai/code/artifact/f942b061-1b5a-4532-b858-5d4cd2139552
- Pixel-parity methodology for any future drawing refactor: ADR 0033 +
  `.scratch/098_shower-drawing-extraction/shoot-parity.mjs` (settle guard,
  committed baselines, byte-compare — never re-bless a differing hash).
