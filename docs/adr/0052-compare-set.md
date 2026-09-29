# ADR 0052 — The Compare set: four fixed columns, kept builds per shower, Open hands off, Sync keeps the picks

- **Status:** Accepted
- **Date:** 2026-09-28
- **Scope:** the shower configurators' Compare tab and the project record
  (`src/compareset.js`, `src/comparekit.js`, `src/comparegrid.js`,
  `CompareTab.jsx`, `WediConfigurator.jsx`, `SchluterConfigurator.jsx`,
  `resumeprompt.jsx`, `App.jsx`, `model.js`).
- **Related:**
  - spec `docs/superpowers/specs/2026-09-28-compare-set-design.md`;
  - plan `docs/superpowers/plans/2026-09-28-compare-set.md`;
  - ticket 158 Phase 4 (`.scratch/158_shower-config-roadmap/ticket.md`);
  - ADR 0034 (Compare — decisions 3 and 5 amended here);
  - ADR 0049 (choices, not parts — what Sync keeps);
  - ADR 0035 (the basket and its `target`, which a kept build reuses).

## Context

Phase 3 gave Compare a 2×2 grid over a two-column detail. The popup's own
build was live and the other three were house kits, re-derived on every
render. The owner wanted three things Phase 3 couldn't do:

- work a compared kit with the real configurator;
- come back to Compare and still see that work;
- find every system in the same place every time.

## Decision

1. **Four fixed columns.** They are always wedi Building Panel, wedi S-DRY
   membrane, Schluter KERDI-BOARD, Schluter KERDI membrane, left to right,
   from either popup (`CELLS`).
   - Each column's header holds its actions.
   - The popup's own column is **Current**: a moss ring and a CURRENT tab.
   - Quote-option letters follow the column order.
   - An Every line / Subtotals toggle folds groups to one number per column.
2. **The build you leave is kept, per shower.** `project.compareSets[areaId]`
   holds at most one kept build per column.
   - A kept build is a marker (`snap: { mode, cfg }`), the room it was
     built for, who and when, and the placed kit it came from (`target`,
     the basket's shape).
   - The popups write it as they unmount. That is the one place every close
     path passes through: ✕, Esc, Add, a hand-off, Reconfigure-another.
   - A save that changes nothing isn't written.
   - It rides `customers.data`, so no SQL is needed. `normCompareSets` drops
     junk and orphaned areas.
3. **Open hands off to the real configurator; there is still no
   configurator inside Compare.** This keeps ADR 0034 decision 3's
   objection.
   - A column opens in its own popup, landing on Compare.
   - A kept build reattaches to its placed kit while that row lives.
   - Otherwise the popup opens **detached** when its row already holds a
     kit, so Add appends and never writes one brand over another.
4. **Only house kits follow the room.** A kept build never changes on its
   own.
   - A chip says when it was built for a different room.
   - **Sync** (the owner's option b) takes the anchor's neutral room,
     benches and hand-added lines, and keeps the column's own choices
     (ADR 0049) and its own added lines.
   - Brand-only geometry the neutral room can't place (Schluter's added
     walls, corners, drain offset, ramp; wedi's corners and solve) resets.
   - A kept choice that no longer resolves falls back to the house pick
     and is named in a chip.
5. **Choices, never prices.** A kept build is re-priced from the books on
   every render, so a set left for weeks quotes today's prices. Stepped
   quantities never ride a marker, so they don't ride a kept build either.
   Browse-only builds have no marker to keep.
6. **Resume.** A fresh start of a brand whose shower keeps a build of that
   brand offers it ("Pick up where you left off?").
   - A Reconfigure or a hand-off never asks.
   - Start new deletes nothing.
7. **Benches are part of the room.** The neutral room carries them, and
   house kits bill them. A premade's SKU crosses only within its brand;
   the other engine picks its own premade for the same geometry.

## Consequences

- The set is shared with the team like every job field, last write wins
  (ADR 0004). Versions snapshot `categories` only, so the set is not
  versioned. It is scratch work.
- `compareset.js` is imported by `model.js`, so it is on the boot path. It
  imports no engine, and the brand display names live in the lazy
  `resumeprompt.jsx` so the boot-chunk grep stays at 0.
- wedi's panel Fit plan moved verbatim into `wedi.js` (`panelFitLines`), so
  a kept wedi build prices exactly what its popup showed.
- The Phase 3 golden is read in its own pinned order. Its totals did not
  move.
- The Apps hub has no shower to keep a set for. Its Compare shows the
  columns with no Open, Sync or Clear set, and it never prompts.
  *(Superseded by the 2026-09-28 amendment below.)*

## Amendment — 2026-09-28: Open in the Apps hub

The owner works the configurators from the Apps tray, and missed Open there.
The hub now gets the full Compare set, **for the session only**:

- `AppsWorkspace` holds the set in state (`hubSet`). It is never saved:
  there is no job or shower to hang it on, so it lasts until a page reload.
- **Open** reseeds the target configurator (a remount by its generation
  key, landing on Compare) and moves the pane to it. That uses the rail's
  new `switchApp` action, which never opens the tray and never asks to
  resume.
- The hub keeps its configurators mounted while they're hidden, so an
  unmount save would come too late. There, the popups keep the set current
  as their build changes (`keepLive`).
- Sync, Clear set, the room chip and Your build all work as on a job. The
  resume prompt stays off in the hub (a popup only prompts when the host
  passes `onResume`), since the hub has its own Continue / Start new.
- Adding to a project is unchanged: the hub's destination prompt.

## Amendment — 2026-09-28: compact layout, no Subtotals

The owner wanted the whole shower on screen at once. Compare dropped its own
header row and the Every line / Subtotals toggle:

- **Prices follow the popup's price level** (the menu at the top of the
  configurator) instead of Compare's own Retail/Builder switch. All five
  levels work — Employee is cost × 1.06, Sale and Custom a percent off
  retail, applied to each extended row (`comparegrid.js` `levelAmt`), so a
  figure can sit a cent off the popup's per-unit rounding. Quote options
  still land RETAIL.
- **Every line only.** The owner doesn't want a subtotals-only view, so the
  toggle and the folded groups are gone (the old `grid.view`/`grid.open`
  session keys are simply ignored).
- The room label and the ? tip moved into the grid's corner cell; the
  Sync/Clear message and Clear set moved to the footer.
- Tighter rows and column headers, and a part's gray detail line (part
  number, cut, plan) shows on hover rather than under every line.

## Amendment 2026-09-29 — + Basket, Include, Print, next-free letters

Compare could price four builds side by side but not do much with them: a
column could only be opened, synced or landed as quote options, the checkbox
only existed where quote options did, and the comparison could not be handed to
the customer. Spec `docs/superpowers/specs/2026-09-29-compare-basket-print-design.md`;
the shared basket it stages into is ADR 0035's amendment of the same date.

- **+ Basket per column.** A quiet button in each column header stages that
  column's build in the shared `project.showerBasket`: the host's own
  `stageBuild` for Current, the kept snapshot for Your build, the same seed Open
  builds for a house kit. No target rides along, so a staged column always lands
  as new work. The button shows only in a popup that has a basket.
- **One checkbox, "Include".** The column checkbox now shows everywhere Compare
  renders, including the Apps hub, and means "in the print and the quote
  options" (just "in the print" where quote options don't exist). The hub's
  quote options go through its destination prompt like its other lines, landing
  on the current project or as a new quick price.
- **Print.** A Print button in the footer prints the included columns that have
  a price, as a customer sheet at the popup's price level: the screen's group
  bands and slot rows, Qty · Size + item · Price per line, no part numbers,
  flags, cost or "vs current". The sheet is a hidden layout portalled into the
  body while printing, the same idiom as the wedi layout print. The on-screen
  grid is untouched.
- **Next-free letters.** `compareOptionsPatch` no longer letters options from A:
  it takes the job's next free letters (gaps first), the same rule as the
  basket's Add as options, so a job that already has A and B gets C and D and
  never a second A. It returns null when too few are free. The confirm shows the
  real letters, the footer button disables with "Only K option letters left —
  uncheck some", and the hub, where the destination isn't known until the
  prompt, says "options" without letters. On a job with no options nothing
  changes: the letters are A onward.

The stored Compare set is unchanged, so there is no migration and no SQL.
