# ADR 0051 — wedi's "Membrane" wall system is S-DRY

- **Status:** Accepted
- **Date:** 2026-09-27
- **Scope:** the wedi and Schluter shower configurators and Compare
  (`src/sdry.js`, `src/wedi.js`, `src/comparekit.js`, `WediConfigurator.jsx`,
  `SchluterConfigurator.jsx`, `CompareTab.jsx`).
- **Related:**
  - spec `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md`;
  - plan `docs/superpowers/plans/2026-09-28-board-vs-membrane.md`;
  - ticket 158 Phase 2 (`.scratch/158_shower-config-roadmap/ticket.md`);
  - ADR 0049 (choices, not parts — amended for Phase 2);
  - ADR 0034 (Compare — its KERDI-BOARD open item closes here).

## Context

Schluter has a wall-system fork: KERDI membrane over a backer, or
KERDI-BOARD. wedi had only Building Panel. So Compare set a structural wedi
panel against a membrane that still needs cement board by others, and the
difference lived in a caveat sentence.

wedi does sell a membrane system, S-DRY, and every part is in the book:
- four bases, and a 24×48 extension;
- full and lean 72″ curbs;
- a bonding-flange drain and seven covers;
- 104 and 106 sf rolls, 5″ × 32′ tape, corners and collars;
- S-DRY SEAL.

The owner chose S-DRY over Subliner Dry as wedi's Membrane. The goal is the
whole system: an S-DRY base when one fits, and the owner's pick when none
does.

## Decision

1. **Both brands carry the same fork.**
   - Schluter's segment reads **Membrane | KERDI-BOARD**.
   - wedi's reads **Building Panel | Membrane (S-DRY)**.
2. **Two choices, not parts (ADR 0049).**
   - `cfg.wallSys: "membrane"`; absent means Building Panel.
   - `cfg.sdryBase: "wedi"`, meaning S-DRY walls on a wedi pan; absent means
     S-DRY.
   - `kitFor` resolves both on every build, and an unknown value reads as
     the default. Every marker saved before this bills exactly as it did
     (`src/wallsysgolden.test.js`).
   - A saved cover pick that doesn't fit where it lands stays inert rather
     than mis-billing: `kitFor`'s wedi-pan branch ignores a `coverPick`
     whose `sdryRole` is `"cover"` and falls back to the stainless wedi
     cover, and `coverPickApplies` reads it the same way — the mirror of
     the S-DRY branch's own inert-pick guard. Stops an S-DRY cover carried
     across a flip to Building Panel from billing over a wedi drain (Task 5
     review finding, made during the build).
3. **The S-DRY fit (`sdryFit`), in rank order:**
   - one base, cut evenly;
   - a base + one 24×48 extension along an edge ≤ 48″;
   - a base + two extensions side by side along the 72″ edge, seamed with
     tape.

   Ties within a tier: least cut-away, then stock, then price. A linear
   drain, an oversize room and a book with no bases each carry a stated
   reason.
4. **The Membrane bill comes from wedi's published rates.**
   - Membrane: wall sf + 10% for laps, on the cheaper roll.
   - Tape: corners + wall bases + the curb + extension seams, in 32′ rolls.
   - Inside corners: 2 per bag.
   - Outside corners: 1 bag when curbed.
   - Collars: 1 valve and 1 pipe collar.
   - SEAL: ⌈tape lf ÷ 45⌉ + 1 trowel. A curbless build's field seal folds
     into this one SEAL line (qty +1, the note says so) instead of billing
     its own SEAL and trowel a second time.
   - PRO-SET: 1 + ⌈membrane sf ÷ 100⌉ at the 1/8″ notch. This matches
     wedi's TDS: a 36×60 alcove takes 2 bags, a 48×72 takes 3.
   - An S-DRY base also bills the S-DRY curb (⌈open ÷ 72⌉), the
     bonding-flange drain and an S-DRY cover.
   - **A wedi pan under S-DRY walls (`sdryBase: "wedi"`) seals its own
     pan/extension floor joints with wedi Joint & Seal too** (owner
     decision, made during the build): figured on the pan + extension
     footprint — the bounding box, not the sum of the solver's overlapping
     edge strips — one line, and the floor takes no fasteners (bench
     surfaces still do). An S-DRY floor's own extension seams ride S-DRY
     tape instead, so this never doubles a seam. `figureConsumables` gained
     an optional 4th argument, `jointSf`, to carry it.
   - The backer (cement board or drywall, by others) is a build hint, a
     print note and a Compare note row — never a priced line.
5. **No fit → the owner picks.** The Custom tab shows the reason and three
   answers, plus "S-DRY base, fit to the room" when a fit exists (the chip
   can reopen the prompt after the room changes back into a fit):
   - a wedi pan + curb with S-DRY walls;
   - the nearest S-DRY base anyway, with a warning naming the shortfall;
   - back to Building Panel.

   A non-fit answer wears a bill chip that reopens the choice.
6. **Compare follows the host's wall system.**
   - Membrane faces Membrane, and board faces board.
   - The wedi side falls back to a wedi pan with S-DRY walls, without a
     prompt, and its header says so.

## Consequences

- **Old kits.** No saved kit's bill moves. One display move: the curbless
  Fundo kit's S-DRY Seal line draws under Setting (was Seams), with the same
  bill.
- **Rates.** They are wedi's, and they live in `src/sdry.js`. Change them
  only against a new wedi source, and cite it.
- **Benches under Membrane** stay panel-based; their fasteners and sealant
  are figured on the bench surfaces only.
- **Compare on the Schluter host.** It now shows wedi as S-DRY, since the
  popup opens on Membrane (it showed Building Panel before). ADR 0034's
  "KERDI-BOARD toggle" open item is closed.
- **Out of scope:**
  - extensions stacked two deep, and on the curbless entry side;
  - the drain height kit;
  - a four-way compare (Phase 3).
