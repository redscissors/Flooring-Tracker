# ADR 0049 — Configurator swaps remember the choice, not the part (slots)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Scope:** the Schluter and wedi shower configurators' swap machinery
  (`src/slots.js`, `src/swappop.jsx`, `src/schluter.js`, `src/schluterdraw.js`,
  `src/wedi.js`, `src/showersf.js`, `SchluterConfigurator.jsx`,
  `WediConfigurator.jsx`) — drain/cover swaps in sub-project 1a; curb, panel,
  membrane, band and fastener/bench swaps extend the same pattern in 1b–1d.
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

## Amendment (2026-09-27): every line swaps (Phase 1b)

1. **Lines.**
   - Schluter: `cfg.swaps` gains `membrane` `{ wide, roll? }`, `band`
     `{ width, roll? }` and `fastener` (a sku, whose count re-fits). Bench rows
     gain `board`; `part` already existed.
   - wedi: `curbPick` `{ sub, len?, profile? } | { none: true }`, plus
     `panelKey` and `fastenerKey`.
   - Engines: `resolveMembrane`, `resolveBand` and `resolveCurb`, each with an
     options function the popover reads.
2. **Write-only-when-picked.**
   - wedi no longer writes the resolved `curbKey`, and writes `panelKey` and
     `fastenerKey` only when they differ from the house part.
   - Old markers translate on read: `legacyCurbPick` / `curbPickOf` / an old
     default `panelKey` = no pick.
   - `src/wedimarkergolden.test.js` pins that every old marker shape reopens to
     its pre-1b bill.
   - `markerCurbKey` lets the tile-sf reader (`showersf.js`) resolve a choice
     the same way.
3. **Inert picks.** A saved pick the pan type can't use stays in the marker but
   doesn't mark the build Custom or dirty: a Schluter `drainPick` on a point
   tray, or a wedi `coverPick` of the wrong shape (`coverPickApplies`).
4. **Consequence.** 1c ("+" per group) and 1d (Compare alignment) build on
   these choice records and the `SwapPop` component (`src/swappop.jsx`, which
   replaced `drainswap.jsx`).

One exception beyond the one 1a already recorded: a stale wedi `curbKey` the
catalog no longer knows now bills the recipe's default curb, where it used to
bill none — the "nothing silently dropped" rule outranks pinning a key the
books no longer carry. The owner confirmed this on 2026-09-27, and tile sf
(`markerCurbKey`) now falls through to the same recipe curb.

## Amendment (2026-09-27): add another line (Phase 1c)

1. **Added lines are parts + a hand-set qty, never choices.** They don't
   re-fit.
   - One list per brand, in the marker. Schluter: `cfg.manual`
     `{ sku, qty, g? }`. wedi: `cfg.manual` `{ key, qty, group? }` — wedi's
     first time in the marker; `kitFor` bills it and writes it.
   - Rows key on group + part. An added line is always its own line; it
     never merges into a kit line.
2. **Translation on read.**
   - Schluter: a row with no `g` files where the kit bills that part
     (`addedGroup`). It moves out of Extras on screen and in print; its qty
     and the total don't change.
   - wedi: `addons` keys become rows in the add-on bucket (a key listed twice
     = qty 2). Nothing writes `addons` again.
   - `src/addedgolden.test.js` pins every old shape to its pre-1c bill and
     tile-sf niche.
3. **The "+" popover is the ⇄ popover** (`SwapPop`) with Auto dropped. An
   added line's ⇄ replaces only its own row. This replaces 1b's rule that
   hid opts-backed ⇄ on Browse-added lines in a wedi kit build.
4. **The wedi curb drawing** (and "Turn into a curb") follows only the kit's
   own curb. An added curb is a part on the bill, not a curb in the room.

## Amendment (2026-09-27): shared groups and the Compare mirror (Phase 1d)

1. **The display group derives from the slot.** `src/slots.js` gains
   `GROUPS` (Base · Drain · Curb · Walls · Seams · Niches · Bench · Setting ·
   Extras, the owner's order), `groupOf(slot)` and `groupLabel(key)`. Both
   bills, both print sheets and Compare draw a line under
   `groupOf(line.slot)`.
   - The engines' own groups stay internal keys: Schluter `l.g` ("Walls",
     "Extras"…) and wedi buckets (`floor`, `install`, `addon`…). They are
     already saved in qty-override keys (`"<g>|<sku>"`) and added rows
     (`g` / `group`).
   - So nothing saved changes and nothing translates on read. Both goldens
     (`wedimarkergolden.test.js`, `addedgolden.test.js`) stay green,
     untouched.
2. **wedi fasteners fill `wallBoard`** (`WEDI_SLOT`, was `seam`). They sit
   with the panels under Walls and line up with Schluter's board fasteners in
   Compare. No other slot mapping changes.
3. **"+" tables key on the shared group.** `ADD_PARTS` (schluter.js) and
   `WEDI_ADD_PARTS` (wedi.js) are keyed by group key. Each part stores the
   engine group an add writes (`g` / `group`), so a Schluter "+ Niches" still
   writes `g: "Extras"`. A part's `hit` only matches parts whose slot, read
   under that engine group, lands back in the group that offered it, so "+"
   and display can't disagree. Added rows are still keyed by engine group +
   part (1c).
4. **Compare's other column holds session state.** Each line the host build
   added by hand is mirrored onto the other brand:
   - by default the nearest-size part in the same slot (niche, bench, curb,
     tray, wall board, wall membrane, seam), stock before special order, qty
     by coverage where both parts have it;
   - otherwise a "+" that opens a picker of that brand's "+" parts for the
     group;
   - hand picks and drops live in the host popup's `mirror` state
     (`{ [hostKey]: { pick: { g, id, qty } } | { dropped: true } }`), kept for
     the popup session only and never saved. Auto-matches are recomputed
     every render.

   The other engine prices the mirrored lines: CompareTab rebuilds its house
   kit with them as ordinary added rows (`cfg.manual`), so "Quote options"
   lands them in option B's marker as added lines. The size readers and
   ranking live in `src/comparemirror.js`, which imports no engine; the
   brand-specific side lives in `comparekit.js`.

ADR 0034's `COMPARE_CATS` / `WEDI_CAT` retire with this: Compare rows are
group bands with one row per slot.
