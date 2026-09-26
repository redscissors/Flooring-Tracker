# ADR 0049 — Configurator swaps remember the choice, not the part (slots)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Scope:** the Schluter and wedi shower configurators' swap machinery
  (`src/slots.js`, `src/drainswap.jsx`, `src/schluter.js`, `src/schluterdraw.js`,
  `src/wedi.js`, `SchluterConfigurator.jsx`, `WediConfigurator.jsx`) — drain/
  cover swaps in sub-project 1a; curb and panel swaps extend the same pattern
  in 1b–1d.
- **Related:** design spec `docs/superpowers/specs/2026-09-26-drain-slot-design.md`;
  plan `docs/superpowers/plans/2026-09-26-drain-slot.md`; ticket 158 Phase 1
  (`.scratch/158_shower-config-roadmap/ticket.md`); mockup
  `.scratch/mockups/drain-swap-2026-09-26.html` (layout A); ADR 0032 (Schluter
  registry-driven pricing); ADR 0035 (configurator kit instance id).

## Context

The two shower configurators can each swap only a few lines, and each brand
does it its own way:

- **Schluter.** `cfg.swaps` holds a part number for three roles: grate, curb
  and One-size board. A linear build has no grate line and no swap at all — it
  is always a Vario channel plus the Vario flange kit. The fixed KERDI-LINE
  range (bodies, framed/thin-frame/frameless grates), made classifiable by
  ticket 158's P0-2, sits in the catalog with no build able to reach it.
- **wedi.** The popup swaps more lines, but the saved marker stores the
  *resolved* pick (`coverKey`, `curbKey`, `panelKey` are always written). Two
  things follow from that: a reopened kit looks swapped on every role even
  when nobody touched it, and a linear cover is pinned to its old SKU, so it
  stops following the channel length when the room changes.

The owner's Phase 1 priority (2026-09-26) is drain swaps at every level —
family (Vario / fixed KERDI-LINE / frameless / point), then length, then
grate — with fixed lengths sizing themselves to the wall. Three approaches
were weighed: (A) a swap remembers the choice and the engine resolves parts
on every build; (B) store parts and look for a sibling on re-fit; (C) one
shared recipe engine for both brands. B and C were rejected — B still drifts
on re-fit as options change, and C would force two catalogs with different
shapes and pricing rules (ADR 0032's whole reason for splitting them) into
one recipe.

## Decision

1. **A swap saves a choice, never a part.** The marker records what the
   customer wants — family, style, frame, finish (Schluter `cfg.drainPick`);
   finish (wedi linear `coverPick` — the finish code carries the style); a
   key for a point pick with no length to follow (wedi `coverPick.key`,
   Schluter's point-drain `cfg.swaps.grate`, which already had no length to
   lose). It never records a resolved SKU as the choice.
2. **Engines resolve a choice into parts on every build**, so a length
   choice re-fits when the room does. `resolveDrain(choice, panW, cat,
   opts)` is the Schluter half; wedi's `kitFor` resolves `opts.coverPick`
   through `linearCoverFor` at the channel's current length. Nothing caches
   a resolved part across a re-fit.
3. **`SLOTS` (`src/slots.js`) is the one shared line vocabulary.** Both
   engines tag every bill line with one of its thirteen slots (`slotOf` in
   schluter.js, `wediSlotOf` in wedi.js), so a Schluter line and a wedi line
   for the same role — drain body, grate, flange, wall board, curb, and so
   on — read as the same kind of thing to a swap popover, a "+" picker, or
   Compare (ADR 0034). Only the drain slots change behaviour in 1a; the rest
   are data for 1b–1d.
4. **Old markers translate on read, never on write.** No saved kit's bill
   moves because of this change. No `cfg.drainPick` reads as Vario, exactly
   as today. An old wedi `coverKey` reads as a `coverPick` (`legacyCoverPick`)
   — `{ finish }` on a linear pan, so the cover starts following the channel
   length; `{ key }` on a point pan, unchanged. The read side does the
   translating (`seedState`, `buildFromMarker`); `normP` passes the marker
   through untouched.
5. **Defaults are unchanged.** Vario stays the default drain family and
   plain stainless the default wedi cover; every existing pinned bill stays
   pinned. The new families are reached only through a swap.

## Consequences

- 1b (curb and panel choices) and 1c/1d build on the same pattern: a choice
  record instead of a resolved part, resolved fresh per build, tagged with a
  `SLOTS` entry. wedi's resolved `curbKey`/`panelKey` markers get the same
  choice-not-part treatment 1a gave `coverKey`.
- A swap's engine call (`resolveDrain`, `kitFor`) is the only place that
  knows how to turn a choice into parts — a popover only has to enumerate
  choices and check `ok` by calling that same resolver, so the popover can
  never offer something the engine would then refuse.
- A choice that can't be built where it lands falls back rather than
  vanishing (Schluter fixed/frameless → Vario, with the reason on the first
  line) — the "never silently dropped" rule ADR 0032's `pickFrom`/`stockPool`
  already established for stock-only picks.
- The one accepted exception to "no saved kit's bill moves": an old wedi
  marker holding the non-stocked 27″ stainless twin (`US1000084`) reads as no
  pick and reopens on the stocked twin (`676797048`, $0.01 more) — the
  stock-first rule (ADR 0032/0037) outranks pinning that one key, and the
  amount is a rounding-scale cent, not a bill change.
