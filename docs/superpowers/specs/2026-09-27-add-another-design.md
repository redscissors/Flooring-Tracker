# "+" on every group — add another line, sub-project 1c — design

**Date:** 2026-09-27 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1)
· **Builds on:** 1a (`docs/superpowers/specs/2026-09-26-drain-slot-design.md`),
1b (`docs/superpowers/specs/2026-09-26-swap-every-line-design.md`), ADR 0049

## Problem

After 1b every line can be swapped, but nothing can be *added* except through
Browse, and Browse adds behave differently on each brand:

- **Schluter.** Hand-added lines live in one flat `cfg.manual = [{ sku, qty }]`.
  They always draw under **Extras**, whatever the part is, and there is one row
  per SKU. A hand-added band sits in Extras, not under Seams.
- **wedi.** The popup's `manual` list is **session state only**. It is never
  written to the marker; it survives only in the basket session and through
  `sessionFromRows` on Reconfigure. Niche/seat/bench/shelf picks and the
  sealant gun go into `addons`, which saves keys but drops quantity. A second
  niche added from Browse never reaches the saved kit, tile sf or the placed
  view.
- **wedi merges.** `applySession` folds a manual entry into a kit line with the
  same key (`hit.qty += m.qty`). Two bugs follow:
  - Browse + on a merged line reads the merged qty as the auto qty, writes it
    to `qtyOv`, then adds the manual qty again: kit 4 + manual 2 shows 6, one
    press of + gives 9.
  - − on a niche at qty 2 drops the manual entry and then the addon too, so the
    quantity goes 2 → 0.
- **No tell.** On both brands a hand-added line looks exactly like a figured
  one. After a room or kit change there's no way to see which lines won't
  re-figure and may need deleting.

The ticket's Phase 1 asks for a "+" on each group header that opens a picker
filtered to that slot, "swap" and "add another" as separate actions (owner
2026-09-26: a second KERDI-BAND width lands with the "+"), and several niches of
different sizes in wedi.

## Owner decisions (2026-09-27)

1. **Every group gets a "+"**, built once for every slot.
2. **The "+" reuses the stepped popover** on stepped slots (the owner's own
   suggestion). Where a group's parts are stepped, "+" opens the same `SwapPop`
   rows ⇄ does; **Use this** adds instead of replacing.
3. **An added line is a concrete part + a hand-set qty.** The "+" popover has
   **no Auto chip** — the build's own line already covers the room's need, so an
   Auto add would bill that need twice. Added lines are parts, not ADR 0049
   choices; they don't re-figure.
4. **One added-lines list per brand**, saved in the marker. "+" adds, Browse adds,
   chip adds and figurer adds are the same kind of line.
5. **An added line is always its own line with its own qty**, even when the kit
   bills the same part. It never merges into a kit line.
6. **An added line gets its own ⇄**, which replaces only that row's part. It never
   touches the kit's own pick.
7. **Browse adds land under their own group** (a band under Seams, a panel under
   Walls). Old Schluter hand-added lines move out of Extras on screen and print;
   quantities and totals don't change.
8. **All wedi add-ons become added lines.** `addons` retires into the list; old
   markers translate on read.
9. **Tell added from figured** (owner's ask during Section 1): an **"added"** tag
   on every hand-added line, and a **"kit also bills N"** hint when the kit bills
   the same part. **Screen only** — the customer print stays clean.

## Design

### 1. The added-lines record

One list per brand, in the marker, one row per (group, part):

```js
// Schluter — extends today's cfg.manual
cfg.manual = [{ sku, qty, g? }]      // g = the bill group it draws under ("Walls", "Seams", "Extras"…)
// wedi — manual is saved in the marker for the first time
cfg.manual = [{ key, qty, group? }]  // group = the wedi bucket ("walls", "install", "addon"…)
```

- **Row identity is group + part.** The same part may be added under two groups
  (a board under Walls and under Bench) as two rows; within one group a part has
  one row and its qty.
- **Which group.**
  - A "+" add stores the group whose header was clicked, so a board added under
    Bench stays a bench board.
  - A Browse, chip or figurer add stores the group the brand files that part under
    when a kit bills it: Schluter by `slotOf` → the slot's group (below); wedi by
    `bucketOf`. A niche goes to Extras (Schluter) / Add-ons (wedi), since neither
    brand has a Niches group until 1d.
  - Schluter's Browse rule reads the slot from catalog facts alone
    (`slotOf(undefined, item)`), so a board is a wall board (Walls) and a KERDI
    roll a wall membrane (Walls); a bench board is only ever a bench line when
    it's added under Bench.
  - Schluter slot → group: `tray` → Base; `drainBody`/`grate`/`flange` → Drain;
    `wallBoard`/`wallMembrane` → Walls; `seam`/`corners` → Seams; `curb` → Curb;
    `setting` → Setting; `niche`/`bench`/`extra` → Extras.
- **Slot.** Each line's `slot` is still derived (`slotOf(g, item)` /
  `wediSlotOf`), not stored, so Compare and 1d read the same tags they do today.
- **Old markers translate on read (ADR 0049 rule 4). No bill moves.**
  - Schluter: a row with no `g` takes its group from the Browse rule. It draws
    under that group on screen and in print; its qty and the total are
    unchanged.
  - wedi: each `addons` key becomes `{ key, qty: 1, group: "addon" }` — the group
    `kitFor` drew it in, so nothing moves on screen. A key listed twice becomes
    qty 2, which is what tile sf already counted.
  - Translation happens in `seedState` and `buildFromMarker` (and the tile-sf
    reader); `normP` passes the marker through untouched.
- **Write side.** Schluter's `markCfg` writes `manual` with `g`; wedi's marker
  writes `manual` with `group` and stops writing `addons`.

### 2. The "+" picker

- **Placement.** A small **+** at the right end of every group header (`bg-h`) on
  both brands, beside any control already there (the Walls Fit | One size
  toggle). Groups that are empty today are hidden; with 1c a group that's usually
  empty (Curb on a curbless build, Extras, Add-ons) still shows its header, with
  only the "+".
- **One popover per "+", built on `SwapPop` (`src/swappop.jsx`):**
  1. **Part row** — only when the group holds more than one slot. Chips name what
     can be added there, e.g. Walls: **Board · Membrane**; Seams: **Band ·
     Corners**; Drain: **Drain · Grate · Flange**; Extras: **Niche · Bench ·
     Other**. A single-slot group skips it.
  2. **The slot's own rows**, the same rows its ⇄ shows, with two changes:
     - **No Auto chip.** A Length / Roll row must land on a real part. The draft
       starts on the part the build already uses (a second band starts at the
       build's width and roll).
     - **Qty stepper in the summary strip**, starting at 1. The strip shows what
       lands, "+$X" and the new total, in place of the swap's Δ.
  3. **Use this** adds the line(s); Esc / outside click discards.
- **Stepped slots** use the stepped rows: Schluter drain, membrane, band; wedi
  curb, wall panel, cover.
- **Every other slot** (trays/pans, boards, Schluter curbs, corners, fasteners,
  sealant, setting, niches, benches, shelves) shows a list of that slot's parts
  in the list-swap / Browse row markup (name, price, SO dot), stock-first,
  filtered to the pool under Stock only. **One click adds 1 and closes**, like a
  list swap. Long lists (trays, pans, niches) get the Browse search box on top.
- **Drain "+"** (and a linear wedi cover "+") has a concrete **Length** row (the
  lengths that family comes in) in place of fitting to the pan;
  **Use this** adds every part the strip lists — body, grate, flange — as
  separate added lines. A point drain's "+" is the grate list.
- **The popover asks the resolver.** A chip's `ok` comes from the same engine
  call ⇄ uses (`resolveDrain`, `resolveMembrane`, `resolveBand`, `resolveCurb`,
  `panelOptions`, the cover options), never a rule of its own (the 1b lesson).
- **Stock rules as today:** stocked first; a special-order pick lands flagged
  `so` with the dot; the popover is never empty.

### 3. How an added line behaves

- **Its own stepper.** − / + edit that row's qty; at 0 the row leaves the bill and
  the marker. A kit line's stepper is unchanged: it writes a hand-set qty
  (`qtyOv`) and never touches an added row.
- **Browse +/−** always edits the added row for that part, in the part's own
  group.
  - This changes wedi: Browse + on a part the kit already bills used to bump the
    kit line's `qtyOv`; now it adds an added line. The total is the same; the
    line wears the "added" tag and "kit also bills N".
  - Browse's counter shows the added qty, as Schluter's already does.
  - The figurer's "Add to build" keeps topping up only the shortfall over what
    the whole build carries.
- **Its own ⇄.** Opens the group's "+" popover without the Part row; **Use this**
  replaces that row's part, keeping its qty and group. If the new part is already
  an added row in that group, the two merge. Lookups key on **group + part**,
  never part alone, so a same-SKU kit line or added row in another group can't
  be hijacked. This replaces 1b's rule that hid opts-backed ⇄ on Browse-added
  lines in a wedi kit build — an added line's ⇄ now writes its own row, not the
  kit's option.
- **Tag and hint (screen only).**
  - An **"added"** tag beside the name, styled like the "special order" tag;
    tooltip "added by hand — doesn't re-figure when the room or kit changes".
  - **"kit also bills N"** on the added line's second line when the kit's own
    lines bill the same part.
  - A kit line with a hand-set qty keeps today's styled qty ("hand-set — the
    recipe figures N"). So: figured = plain, figured-but-changed = styled qty,
    added = tagged.
  - **Browse-only builds** (no kit; wedi's no-pan case) hide the tag and hint —
    every line is added there. The "+" still works.
  - The customer print shows neither.
- **Customization.** Any added row marks the build Custom and arms the kit-card
  overwrite confirm (`kitDirty`), as Schluter's manual rows already do.
- **Re-solves, kit changes, clearing.** A room re-solve keeps added rows untouched
  (they don't re-figure; the hint shows any new overlap). A kit change keeps them
  (`keepAdded`); **Clear design** removes them; Schluter's `pickKit` still clears
  them — all as today.
- **Reconfigure from a placed item.** Added rows come back from the marker (wedi
  for the first time). `sessionFromRows` then compares the placed rows against the
  build **including** added rows, so only a hand-set kit qty becomes `qtyOv`; a
  placed added line can't turn into a kit override or bill twice.
- **Everywhere else follows the marker.** The basket, placed view, Compare, order
  entry and `buildFromMarker` bill the added rows, each with its `slot`.
- **Left alone:** bench lines sharing a board SKU still share one hand-set qty
  (pre-existing; on the ticket).

### 4. Niches, add-on chips, tile sf, drawing

- **wedi `addons` retire** into the added-lines list (§1). `kitFor` stops billing
  `opts.addons`; `buildFromMarker` bills the translated rows instead — same lines,
  same total.
- **Several niches, both brands.** Niches are ordinary added rows: a 12×8 ×1 and
  a 12×24 ×2 are two lines in Add-ons (wedi) / Extras (Schluter), each with its
  own qty and ⇄. Schluter already allowed this; wedi gains it.
- **Chips become "add another" shortcuts.**
  - wedi **Niche · Seat · Bench · Glass shelf** always open their size picker and
    add a row; they read "✓ Niche ×3" when any exist. Clicking an "on" chip no
    longer deletes every niche at once; removal is the line's − or its ⇄.
    Schluter's Niche chip already works this way.
  - **Toggles stay toggles:** wedi Sealant gun (one gun) and Schluter's single
    extras (KERDI-FIX, the other extra chips).
  - Chips that write build options — wedi Recess kit and Cover frame, Schluter
    Ramp and Bench — are unchanged.
- **Tile sf (`showersf.js`).** wedi's niche-back area reads the added rows × qty
  (after translating any old `addons`), the way Schluter already reads
  `cfg.manual` × qty. An old `addons` marker gives today's figure. A niche whose
  interior can't be read still gives "enter manually".
- **Drawing.** Neither brand draws niches today (they have no position); 1c
  doesn't add that. **One drawing change:** the curb drawing follows only the
  kit's own curb, not any curb line — "+" makes a curb one click away, and an
  added curb is a part on the bill, not a curb in the room (1b carry-over).

## Testing

- **Golden first.** Before any engine change, the first task extends the wedi
  marker golden (`.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`
  → `src/wedimarkergolden.js`) with `addons` shapes — one niche, the same niche
  twice, niche + gun, niche + seat — and pins old Schluter `cfg.manual` markers
  in the old `{ sku, qty }` shape (a band, a board, a niche ×2, KERDI-FIX). Every
  later task keeps both green and untouched. Any bill that moves fails.
- **Round trips**, per brand: "+" add → marker → `buildFromMarker` gives the same
  bill, for a list add, a stepped add (band 7¼″, a pinned roll), a drain "+"
  (body + grate + flange), and two niches of different sizes.
- **No merge.** An added line with a kit line's part stays its own line; the kit
  line's qty and `qtyOv` are untouched; "kit also bills N" reads the kit qty.
- **Steppers.** The wedi regressions (no jump by 3; no 2 → 0); Browse +/− edits
  only the added row.
- **⇄ on an added line** replaces only that row; the kit's pick is untouched; a
  same-SKU line in another group isn't hijacked.
- **Reconfigure.** A placed build with added rows plus a hand-set kit qty reopens
  with each on its own side; nothing bills twice.
- **Pickers.** No Auto chip in a "+" popover; the Part row only where a group has
  more than one slot; stock-only ordering; an SO pick lands flagged; chip `ok`
  from the resolver.
- **Tile sf.** wedi counts several niches × qty; an old `addons` marker gives
  today's figure; Schluter unchanged.
- **Curb drawing.** A curb added to a curbless kit is billed but not drawn.
- **Preview proof** (`.scratch/158_shower-config-roadmap/p1c/`, both harnesses):
  "+" on a single-slot group (list); "+" on Walls with the Part row; a stepped
  band "+" with the qty stepper; a drain "+"; an added line with its "added" tag
  and "kit also bills N"; two wedi niches with "✓ Niche ×2"; an added line's ⇄.
  The p1a / p1b scripts re-run unchanged; a PNG that re-renders with no real
  change is restored.

## Records

- **ADR 0049 amendment** (not a new ADR): added lines are parts + qty, not
  choices; one list per brand in the marker; wedi `addons` retire into it; the
  translation-on-read rules; the curb drawing follows the kit's curb only.
- **Updates:** `src/CLAUDE.md` entries for `schluter.js`, `wedi.js`, both popups,
  `swappop.jsx` and `showersf.js`.
- **Ticket 158:** 1c in the Phase 1 section; the carry-over list trimmed (the
  merged-line ⇄ and curb-drawing items resolve here).

### Amendments during planning and build

_None yet._

## Out of scope (1c)

- Shared group headings on screen (a Niches group included), Compare row
  alignment (1d).
- Drawing niches or giving them a position.
- Added lines that re-figure to the room (declined, decision 3).
- The shared bench-board hand-set qty; the other 1b carry-overs not named above.
- Board vs Membrane (Phase 2), 4-way compare (Phase 3).
