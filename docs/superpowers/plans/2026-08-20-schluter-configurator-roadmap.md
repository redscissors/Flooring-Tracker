# Schluter Configurator — Roadmap (umbrella plan)

> **For agentic workers:** this is the UMBRELLA. Execute the phase plans, not
> this file. Phases 1 and 2 have their own plan docs (linked below) and can
> run in parallel; phases 3–6 get plan docs written when their inputs exist.

**Goal:** A production Schluter shower-system configurator at wedi layout
parity, plus the shared machinery both configurators use (drawing module,
source switch), landing as six reviewable PRs.

**Spec:** `.scratch/097_schluter-configurator/` — `prototype.html` (the
approved working prototype), `README.md` (owner decisions 1–8, findings,
production path), `pricelist-notes.md` (factory kit recipes, Vario rules,
tray specs). The prototype IS the requirements document; where this roadmap
and the prototype disagree, the prototype wins.

## Owner decisions (2026-08-20) — binding on every phase

1. wedi gets the wall-system fork too (S-Dry = membrane-over-backer) — phase 6.
2. Mortar-bed fallback lands a real mortar line via `cfg.mortarItem`
   (Settings → Materials pick); never a $0 by-installer line.
3. Two-part drains (flange + grate) and cut-to-length Vario — as prototyped.
4. Benches follow the wedi doctrine: premade SB on the tray · installer-framed
   + ½" board wrap (interrupts the envelope) · 2" board build-up on the tray.
5. Factory boxed kits appear ONLY in Browse (Factory kits filter); the Kits
   tab is shelf trays alone.
6. Curbless = TT thin trays preferred by the solver + ramp/recess (no
   dedicated curbless tray family; FRS lands Fall 2026).
7. Registry-driven pricing: cost/retail/stock flags read live from the
   Schluter registry books; the engine carries knowledge, never prices.
8. The wedi geometry convention ("Sizes are Pan | Max — curb inside" +
   tile-thickness insets) applies to Schluter verbatim.

## Phases

| # | PR | Plan doc | Depends on | Gate |
|---|---|---|---|---|
| 1 | Shared drawing module out of WediConfigurator | `2026-08-20-shower-drawing-extraction.md` | — | wedi screenshots byte-identical before/after |
| 2 | `schluter.js` engine + `schluterquery.js` + tests | `2026-08-20-schluter-engine.md` | — | `node --test` green; totals pinned to prototype numbers |
| 3 | `SchluterConfigurator.jsx` (Kits/Custom/Browse over shared drawings) + search entry + Apps hub + registry pricing | write after 1+2 land | 1, 2 | preview screenshots vs prototype |
| 4 | Stock only / Full catalog switch in the shared shell (wedi inherits) | write after 3 | 3 | both configurators shown |
| 5 | Compare tab + quote-options A/B flow | write after 3 | 3 | preview |
| 6 | wedi S-Dry wall fork (decision 1) | write after 4 | 4 | preview |

Phases 1 and 2 are disjoint files → parallel agents. Phase 3 is one
coherent context (engine + drawings + shell meet there). Phases 4/5/6 are
mutually independent once 3 lands.

## ADRs to record (docs/adr/, via docs/skills-reference/decide/SKILL.md)

- **Shared shower-drawing module** (phase 1): the TopDown/Iso/railSplit
  drawings move from WediConfigurator.jsx into `src/showerdraw.js`/`.jsx`,
  fed by a brand-neutral geometry shape; drawing consumers import the new
  module directly, and wedi.js imports + bare-re-exports the six geometry
  identifiers its own retained code and tests still use (the audited
  exception ADR 0033 records — an earlier draft of this bullet said "wedi
  re-exports nothing", which the extraction audit overturned). Rationale:
  two configurators must not drift on hard-won drawing rules (corner
  fills, curb-flush walls, moulded drains).
- **Registry-driven configurator pricing** (phase 2/3): unlike wedi's
  transcribed tables, Schluter prices come from the registry books at
  popup-open time; the engine is a pure knowledge layer. A sheet upload in
  the Price book library updates configurator pricing with no code change.
  This deliberately diverges from wedi.js's pattern — the ADR says why.

## Standing constraints (all phases)

- Never push to `main`; every phase is its own PR off its own
  `claude/…` branch; preview proof before merge (repo non-negotiables).
- No Supabase writes, ever; registry reads go through the existing
  `useBooks`/`useBookStock` paths.
- `schluter.js` / `showerdraw.jsx` never load at boot (ADR 0026): lazy
  chunks only; `schluterquery.js` is the only boot-side piece and never
  imports the engine.
- Persisted-shape changes (`product.schluter` marker, `normP`) load the
  `floortrack-data-model` skill first and mirror the `product.wedi`
  precedent exactly.
- Comments conservative; match surrounding idiom; update `src/CLAUDE.md`
  for every new/changed src file.
