# Board vs Membrane on both brands — wedi S-DRY, Phase 2 — design

**Date:** 2026-09-28 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 2)
· **Builds on:** Phase 1 (1a–1d specs under `docs/superpowers/specs/2026-09-2{6,7}-*`),
ADR 0049, ADR 0034 (Compare)

## Problem

- **Only Schluter has a wall-system fork.** Its popup offers "KERDI over
  backer | KERDI-BOARD" (`cfg.wallSys`). wedi walls are always Building Panel.
- **wedi's membrane system isn't built.** wedi stocks S-DRY (March 2026): bases,
  a 24×48 extension, 72″ curbs, a bonding-flange drain, covers, membrane rolls,
  tape, corners, collars, S-DRY SEAL. The configurator keeps S-DRY bases out of
  the solver (`pans()` hides `sub: "sdry"`) and files every S-DRY part under one
  slot (`seam`).
- **"Overbacker" wording.** The ticket asks for the membrane option to be called
  **Membrane** everywhere.
- **Compare compares unlike walls.** It always builds the other brand with its
  default walls, so a Schluter membrane build faces a wedi panel build (ADR 0034,
  open item).

## Owner decisions (2026-09-27/28)

1. **wedi's Membrane is S-DRY** (not Subliner Dry, not a choice of both).
2. **Membrane means the whole S-DRY system, top to bottom**, whenever the room
   allows: S-DRY base (+ extensions), S-DRY curb, S-DRY drain and cover, S-DRY
   walls. When it can't, a prompt offers a regular wedi pan + curb with S-DRY
   walls, or the nearest S-DRY base anyway (decision 5).
3. **S-DRY fit:** cut a base down first; else add a 24×48 extension along a 48″
   (or shorter) edge; two extensions side by side along a 72″ edge, seamed with
   S-DRY tape, is allowed as a lower-ranked option (owner: "possible with S-DRY,
   not encouraged with Fundo").
4. **The fork lives where Schluter's does:** a segment on the Kits tab and the
   Custom shower tab, on both brands.
5. **Fallback "choose S-DRY parts myself" = the nearest S-DRY build** with a
   warning; every line keeps its ⇄ / "+".
6. **Wall recipe mirrors KERDI**, with wedi's published rates (below).
7. **Compare:** Phase 2 builds the plumbing (each brand buildable on either wall
   system), labels each column's system, and has the other column follow the
   host's wall choice. The checkbox grid ("compare against any of the four") is
   Phase 3.
8. **One Phase 2** — the fork, the rename, the S-DRY fit, the S-DRY walls, the
   popup, Compare — in one spec/plan/PR (owner declined splitting 2a/2b).

### Sourced rates

- **PRO-SET:** 1/8″ × 1/8″ square-notch trowel (owner: the S-DRY membrane
  trowel) = **100–103 sf per 25 lb bag**. wedi plans ~2 bags for a 36×60 S-DRY
  shower (3 walls + curb) and ~3 bags for a 48×72. Source: wedi PRO-SET
  Technical Data Sheet, "How much wedi PRO-SET is needed" (owner screenshot,
  2026-09-28).
- **S-DRY SEAL:** ~45 lf of sealing tape / seams (≈ a 36×60 shower, 3 walls +
  curb) with 32 liquid oz (2 batches of 16 oz liquid + 16 oz powder). Source:
  wedi S-DRY SEAL Technical Data Sheet, "Coverage" (owner screenshot,
  2026-09-28). One unit `US5076011` = one 32 oz liquid bottle + two 16 oz powder
  bags (source: wedi's "Mixing & Applying S-DRY SEAL" video, owner 2026-09-28) —
  so **one unit seals ~45 lf**.
- **S-DRY SEAL's job:** sealing membrane overlaps, transitions, seam tape and the
  bonding-flange drain connection. The membrane sheet itself is set in PRO-SET.

## Design

### 1. The fork, the saved choice, the rename

**Schluter.**

- The segment "KERDI over backer | KERDI-BOARD" becomes
  **"Membrane | KERDI-BOARD"** on the Kits and Custom shower tabs.
- The bill subtitle "KERDI membrane walls" becomes "Membrane walls (KERDI)".
- The wall menu keeps "KERDI membrane over backer".
- The saved value is unchanged: `cfg.wallSys` `"membrane"` / `"board"`.

**wedi.**

- A **"Building Panel | Membrane (S-DRY)"** segment sits in the same two places.
- New marker fields (wedi):
  - `cfg.wallSys: "membrane"` — absent means Building Panel, so every old marker
    reopens exactly as today.
  - `cfg.sdryBase: "sdry" | "wedi"` — which base the Membrane choice resolves to:
    the S-DRY system (default) or a regular wedi pan + curb (the fallback
    answer).
  - Both are ADR 0049 choices, not parts. The engine resolves them on every
    build; an absent or unknown value reads as the default.
- **Browse-only** wedi builds (no pan) ignore the fork.

### 2. The S-DRY fit (`sdryFit`, new `src/sdry.js`)

The parts, all in the book today:

| Part | SKU |
|---|---|
| Bases | 38×64 (`US9176001`), 38×64 offset (`US9176002`), 4′×6′ (`US9176003`), 6′×6′ (`US9176004`) |
| Extension, 24×48 | `US3076003` (the ERP swaps its w/d — read the larger as 48) |
| Curbs, 72″ | full `US3076001`, lean `US3076002` |
| Bonding-flange drain | `US9476006` |
| Covers | stainless, chrome, oil-rubbed bronze, matte black, gold, brass, tileable |

`sdryFit(input, catalog)` returns options in the shape the wedi solver already
returns: `{ id, kind, title, badges, pieces, drain, warnings, floorLines,
floorPrice, room, pan, input }`. Pieces are the base (`kind: "pan"`) and
extensions (`kind: "ext"`), each with its placement, size and cut, so the
existing drawings render them.

**Tiers, in rank order:**

1. **One base, cut down.**
   - Any S-DRY base, in either orientation, that covers the room.
   - The cut is split evenly between opposite sides, so the drain stays
     centred. The card says so ("cut 6″ off each end").
2. **Base + one extension.**
   - The extension lies 24″ deep along one base edge of 48″ or less, cut along
     its 48″ side to that edge (38×64 → 38×88; 48×72 → 48×96).
   - The rest is then cut to the room as in tier 1.
3. **Base + two extensions side by side**, along a 72″ edge (up to 72×96).
   - The two are cut to the edge between them.
   - The bill adds a tape run for their seam.

**Ties within a tier:** least cut-away area, then stock before special order,
then retail price.

**Drain.**

- A point-drain room prefers the centre base; an offset room prefers the
  offset base.
- The floor lines carry 1 bonding-flange drain and 1 S-DRY cover — stainless
  by default, with a ⇄ finish swap like today's wedi cover.

**Curb.**

- Curbed builds get the S-DRY curb: full by default, lean via ⇄.
- Quantity = ⌈entry width ÷ 72⌉, cut to fit.
- Curbless builds get no curb.

**Setting.** PRO-SET's base bag (§3).

**No fit.** Each case carries a stated reason:

- a linear drain — S-DRY has no linear base;
- the room is larger than any tier covers;
- the book has no S-DRY bases (Stock only pools like the rest of the solver).

**Out of scope:** extensions stacked two deep, an extension on the curbless
entry side, and the drain height kit.

### 3. The S-DRY walls (`sdryWalls`)

Under Membrane, in place of Building Panel, fasteners and joint sealant:

- **Membrane rolls.** Wall sf + 10% for laps. Use whichever roll —
  `US5076009` 104 sf or `US5076008` 106 sf XL — costs least for the count
  needed.
- **S-DRY tape** (`US5076007`, 5″ × 32′), in rolls = ⌈lf ÷ 32⌉. The lf is the
  sum of:
  - every vertical wall-to-wall corner, at its height;
  - every wall-to-base joint, at the wall length;
  - the curb run: entry width, plus its two ends;
  - extension seams.
- **Inside corners** (90°, `US5076002`, 2 per bag). One per wall-to-wall
  corner at the base, plus 2 at the curb ends. Bags = ⌈n ÷ 2⌉.
- **Outside corners** (90°, `US5076005`, 2 per bag). 2 at the curb ends, curbed
  builds only.
- **Collars.** 1 mixing-valve collar (`US5076003`) and 1 shower-pipe collar
  (`US5076006`).
- **S-DRY SEAL** (`US5076011`). Units = ⌈tape lf ÷ 45⌉, plus 1 seal trowel
  (`US5076010`).
- **PRO-SET** (`US5076012`). Bags = **1 for the base + ⌈membrane sf ÷ 100⌉**.
  - This replaces today's flat 1 bag on Membrane builds only; Building Panel
    builds keep 1 bag.
  - Check: a 36×60 with 3 walls at 84″ gives 1 + 1 = 2 bags, and a 48×72 gives
    1 + 2 = 3 — both wedi's own figures.
- **A backer note line** (note only, $0): "Cement board / drywall substrate —
  by others · membrane needs a backer".

**`sdryBase: "wedi"`** — S-DRY walls on a regular wedi pan. The pan side
(Fundo / curbless / linear pan, extensions, curb, drain, cover, and the curbless
field seal) is billed exactly as today. The wall recipe above replaces Building
Panel.

**Slots.** wedi gains a per-part S-DRY role, read from the SKU:

| S-DRY part | Slot | Group |
|---|---|---|
| Membrane | `wallMembrane` | Walls |
| Tape | `seam` | Seams |
| Inside / outside corners, collars | `corners` | Seams |
| SEAL, seal trowel | `setting` | Setting |
| Base, extension | `tray` | Base |
| Curbs | `curb` | Curb |
| Bonding-flange drain | `drainBody` | Drain |
| Covers | `grate` | Drain |

- **One display move on existing kits:** the curbless Fundo kit's "S-DRY Seal —
  field seal" line moves from Seams to Setting. Its bill is unchanged.
- **"+"** (`WEDI_ADD_PARTS`): each group gains its S-DRY parts, and every part
  still lands back in its own group.
- **The Compare mirror** needs no change: a KERDI roll and an S-DRY roll mirror
  each other by sf (both `wallMembrane`).

### 4. The popup (wedi)

- **Kits tab.**
  - Under Membrane, the cards are the four S-DRY bases. Each is priced as a
    full S-DRY build at its own size: no cuts, curbed with an S-DRY curb, three
    walls at the default height, S-DRY walls.
  - Under Building Panel the tab is exactly as today.
- **Custom shower tab.** Under Membrane the solver runs `sdryFit` and lists its
  options as cards, like Fundo options today, e.g.:
  - "S-DRY 4′×6′ — cut 6″ each end"
  - "S-DRY 4′×6′ + extension"
  - "S-DRY 6′×6′ + 2 extensions (seamed)"
- **The fallback prompt.** When Membrane is on and no S-DRY option fits, the
  Custom tab shows an inline panel stating the reason, with three buttons:
  1. **Use a wedi pan + curb, with S-DRY walls.** Sets
     `cfg.sdryBase: "wedi"`; the regular solve runs, with S-DRY walls.
  2. **Use the nearest S-DRY base anyway.** Builds on the closest S-DRY base.
     A warning line names the shortfall, e.g. "room is 8″ wider than the base —
     the extra floor is by others".
  3. **Back to Building Panel.**
  - The choice shows on the bill as a chip ("S-DRY walls on a wedi pan ·
    change") that reopens the prompt.
- **Bill and print.**
  - The subtitle reads "S-DRY membrane walls" / "Building Panel walls".
  - Lines draw in the nine shared groups.
  - The backer note prints under the install notes.
- **Saved and reopened.** The marker carries `cfg.wallSys`, `cfg.sdryBase` and
  the solve option (as today). Reconfigure and quote options reopen the same
  S-DRY build.

### 5. Compare

- **Wall system in the build-fors:**
  - `schluterBuildFor(room, cat, { wallSys })`
  - `wediBuildFor(room, { wallSys, sdryBase })`
- **The other column follows the host's wall system.** Where S-DRY can't fit,
  the wedi side falls back to a wedi pan with S-DRY walls, without a prompt,
  and says so in its header.

  | Host | Other side |
  |---|---|
  | Schluter Membrane | wedi S-DRY |
  | Schluter KERDI-BOARD | wedi Building Panel |
  | wedi S-DRY | Schluter KERDI membrane |
  | wedi Building Panel | Schluter KERDI-BOARD |

- **Column headers name the system:** e.g. "wedi · S-DRY membrane",
  "Schluter · KERDI-BOARD".
- **Wording.** The help tip and the delta line drop the "unlike walls" caveat
  when both sides match.
- **Changed default:** the Schluter popup opens on Membrane, so its Compare now
  shows wedi as S-DRY (was Building Panel). Owner chose like-for-like.
- **ADR 0034's open "KERDI-BOARD toggle" item** is closed by this. The
  four-way checkbox grid is Phase 3.

## Testing

- **Golden first (Task 1).** Before any engine change, capture today's bills:
  - wedi: every Kits-tab card; a spread of room solves (point, offset, linear,
    curbless); the saved-marker fixtures (`wedimarkergolden`, `addedgolden`
    inputs);
  - Schluter: both wall systems.

  The golden stays green and untouched. No Building Panel build and no Schluter
  build moves.
- **`sdryFit`:**
  - each tier;
  - both orientations and the even cut split;
  - extensions only on edges of 48″ or less; two side by side only along 72″;
  - the ranking;
  - each no-fit reason;
  - curb count by entry width;
  - drain + cover;
  - Stock only.
- **`sdryWalls`:**
  - roll pick, tape lf, corners, collars;
  - SEAL = ⌈lf ÷ 45⌉;
  - PRO-SET against wedi's two examples (36×60 → 2, 48×72 → 3);
  - the backer note;
  - `sdryBase: "wedi"` keeps the pan side byte-identical to today's.
- **Slots and "+":**
  - the S-DRY slot map;
  - every S-DRY "+" part lands back in its group;
  - the curbless field-seal line moves display only.
- **Markers:**
  - `cfg.wallSys` / `cfg.sdryBase` save and reopen;
  - old markers unchanged;
  - an unknown value reads as the default.
- **Compare:**
  - each brand builds on each wall system;
  - the other column follows the host;
  - headers;
  - the KERDI ↔ S-DRY roll mirror.
- **Schluter labels.**

## Proof

New `.scratch/158_shower-config-roadmap/p2/` scripts (house style, ending
"— all checks passed"; print shots under `emulateMedia({ media: "print" })`):

- **wedi Kits tab on Membrane.**
- **The Custom tab's three S-DRY tiers:**
  - a room that cuts down;
  - one needing an extension;
  - one needing two side by side.
- **The fallback prompt** on a linear-drain room, and each of its three
  buttons.
- **An S-DRY bill and its print sheet.**
- **Schluter's "Membrane | KERDI-BOARD".**
- **Compare both ways** with the new headers, and a KERDI ↔ S-DRY mirror.
- **Re-run** the p1a–p1d scripts; keep only PNGs that changed for real.

## Records

- **ADR 0051 — "wedi's Membrane is the S-DRY system":** the choice, the fit
  rules, the fallback, and the sourced rates (wedi's two data sheets and the
  video).
- **ADR 0034 amendment:** the open KERDI-BOARD item is closed.
- **ADR 0049 amendment:** the new wedi choice records (`wallSys`, `sdryBase`).
- **Data-model skill:** the wedi marker's two new fields.
- **`src/CLAUDE.md`:** `sdry.js` (new), `wedi.js`, both popups, `comparekit.js`,
  `CompareTab.jsx`.
- **Ticket 158:** a Phase 2 block.
- **A Phase 3 handoff** (the four-way grid).

### Amendments during planning and build

Each of these is a call the spec left open or got wrong. 1–18 were made
prototyping the plan; 19–23 were made building it.

1. **The S-DRY floor recipe rides Membrane.** An S-DRY pan with no `wallSys`
   (a shape only an old marker can carry; the 1b golden pins it) bills exactly
   as before. The first prototype applied the S-DRY recipe to every S-DRY pan,
   and the 1b golden caught it.
2. **The backer is a build hint, not a bill line.** wedi lines have no
   `noteOnly` concept. Instead:
   - `kitFor` pushes hint `"backer"`;
   - the bill shows it as a `whint`;
   - the print sheet adds it under "Cuts & install notes";
   - Compare writes the same $0 note row the Schluter column carries
     (`wediCompareRows`).
3. **Membrane drops, from the walls:**
   - the Building Panel line;
   - the fastener kit and joint sealant, figured on wall sf (see 22);
   - the wedi collars (`US5000000` / `US5000033`), replaced by the S-DRY
     collars;
   - the corner putty trowel (`US5000044`).

   PRO-SET becomes 1 + ⌈membrane sf ÷ 100⌉.
4. **Benches stay panel-based under Membrane.** Their wrap and board lines
   bill as today, and fasteners and joint sealant are figured on the bench
   surfaces only.
5. **The S-DRY solve.**
   - `solve({ ...input, system: "sdry" })` returns `sdryFit`'s options;
     `nearest: true` returns `[sdryNearest]`. Both flags ride the option's
     `input`, so `buildFromMarker` re-solves the same answer.
   - The S-DRY fit ignores the Max-curb-inside inset, the drain pin and
     "Pan against": the base is cut evenly. The popup disables those inputs
     under S-DRY.
   - `sdryNoFit(input)` is exported for the prompt, and the popup passes it
     the Stock only source.
6. **`cfg.sdryBase: "wedi"` is derived.** kitFor writes it from
   `opts.sdryBase`. The popup passes `"wedi"` whenever Membrane sits on a
   non-S-DRY pan. The popup's own `sdryBase` state is the owner's prompt
   answer, and it decides which solve runs.
7. **Two extensions side by side** are allowed along a base edge of 49–96″.
   The S-DRY bases' longest edge is 72″, so this is the spec's "along 72″".
   Extensions sit on the back (depth) or left (width) side. The footprint is
   then cut evenly back to the room. An extension that isn't cut carries no
   cut, so the cut list doesn't show "Cut to 48×24 (from 48×24)".
8. **Roll coverage** is read from the name ("104sf"), else from wedi's
   published `ROLL_SF` constant. The distribution pricelist names the roll
   "S-DRY™ XL" with no sf, and the preview proved it.
9. **Tape lf, the curb term** = entry width + 12″ (the two curb ends).
10. **S-DRY cover and curb ⇄** are one-click lists.
    - Cover: every S-DRY cover.
    - Curb: Full / Lean / No curb.
    - They store the usual `coverPick: { key }` and `curbPick: { sub: "lean" }`
      / `{ none: true }`.
    - A non-S-DRY cover pick (e.g. a Fundo cover carried over) falls back to
      S-DRY stainless.
11. **Compare's KERDI-BOARD side bills the Fit plan** (`applyBoardPlan`),
    which is the Schluter popup's default.
12. **The curb drawing and tile sf read the S-DRY curb.** The popup's `curb`
    memo and `markerCurbKey` both know it; the S-DRY curb is group `sdry`, not
    `curb`.
13. **Flipping the wall system:**
    - On the Custom tab, or with an option picked, it re-solves and picks the
      top option.
    - On the Kits tab, it refreshes the cards only.
    - A loaded S-DRY kit (no option) flipped to Building Panel clears the
      build (see 21).
    - A loaded wedi kit flipped to Membrane keeps its pan with S-DRY walls,
      and the chip says so.
    - The re-solve runs in an effect keyed on
      `wallSys|sdryBase|sdryNear`, so it reads the new state rather than a
      stale closure.
14. **The prompt** shows when Membrane + S-DRY finds no fit, or when the bill
    chip reopens it. Its buttons:
    - "S-DRY base, fit to the room" (only when one fits);
    - "Use a wedi pan + curb, with S-DRY walls";
    - "Use the nearest S-DRY base anyway";
    - "Back to Building Panel".
15. **The Fit panel plan skips a build with no kit panel line.** Under
    Membrane it used to replace the membrane line with panel sheets; the
    preview caught it (`applyPanelFit` guard).
16. **Showroom samples stay out of Extras "+".** S-DRY samples (`US7076001`/`2`,
    role `other`) are excluded; before Phase 2 their slot was `seam`, so they
    never showed.
17. **Compare's help tip** drops the "not apples-to-apples" walls caveat. Both
    columns are now always on the same wall system. The delta line never
    carried a walls caveat.
18. **The S-DRY Kits cards** price the full S-DRY build at the popup's current
    wall setup, the same rule every other card follows.
19. **Curbless wedi pan under Membrane bills one SEAL line and one trowel.**
    The curbless field-seal block's SEAL + trowel are skipped under Membrane;
    the field seal's unit folds into the walls' SEAL row (qty = walls + 1,
    note mentions the field seal). The prototype billed the trowel twice and
    split SEAL across two lines. (Task 3 review, commit fcb12f5.)
20. **An S-DRY cover pick is inert on a non-S-DRY pan.** kitFor's wedi-pan
    branch ignores a coverPick whose sdryRole is "cover" (falls back to the
    stainless wedi cover), and coverPickApplies returns false for it — mirror
    of the S-DRY branch's check. Stops an S-DRY cover carried across a flip
    to Building Panel from billing over a wedi drain. (Task 5 review, commit
    2b534ae.)
21. **Flipping to Building Panel never wipes hand work silently.** On the
    Custom tab the room is kept and re-solved for wedi pans (top option). On
    the Kits tab a loaded S-DRY kit still clears (ruling 13), but when
    kitDirty or hand-added lines exist it asks first through the
    kit-overwrite confirm (KitOverwriteConfirm); Cancel keeps Membrane. Its
    copy names what the switch clears ("Switch to Building Panel?" — the
    S-DRY base, drain, curb and membrane come off; Start over / Keep my walls
    and extras / New shower), owner ask 2026-09-27. (Task 5 review, commit
    2b534ae.)
22. **A wedi pan under S-DRY walls seals its pan/extension joints with wedi
    Joint & Seal** (OWNER DECISION, 2026-09-28, asked during the build).
    Figured on the pan + extension floor footprint (bounding footprint, not
    the sum of overlapping edge strips); the floor takes no fasteners (bench
    surfaces still do); one Joint & Seal line. figureConsumables gained an
    optional 4th arg jointSf. S-DRY floors unchanged (their extension seams
    ride S-DRY tape). (Task 7 proof review, commit c9503ef.)
23. **The S-DRY option badge's cut state checks three cases in order**: the
    whole-footprint cut text ("cut N″ off each side/end") when the layout's
    own footprint is larger than the room; else "Trim to fit" for any cut
    piece (incl. an extension trim on the nearest option); else "No cutting".
    (Task 7 proof review, commit c9503ef.)
24. **Final review fixes.** A base that covers the room alone offers no
    extension card; extensions, seams, titles and badges follow the pieces
    that survive the cut-back. The popup reopens a saved option by id + pan
    (`savedOption`, shared with buildFromMarker). `coverPickApplies` takes the
    wall system (a wedi cover is inert on an S-DRY base under Membrane). An
    uncut 72″ S-DRY curb reads "full length — no cut". Membrane drawings show
    no panel courses.

Also: the final suite count is 1822 (the plan said 1814), because of the
tests the build added.

## Out of scope (Phase 2)

- The four-way compare grid and its checkboxes (Phase 3).
- Subliner Dry as a wall system.
- Stacked extensions, an extension on the curbless entry side, the S-DRY drain
  height kit.
- The S-DRY factory kits (`US2076001/2`) as a billed kit SKU. Builds bill the
  components.
