# Compare set — four fixed columns, Open into any kit, Sync, resume — design

**Date:** 2026-09-28 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 4)
· **Mockup:** `.scratch/mockups/compare-set-2026-09-28.html` (layout A, chosen)
· **Builds on:** Phase 3 (`2026-09-29-four-way-compare-design.md`), ADR 0034,
ADR 0035, ADR 0049, ADR 0051

## Problem

- **You can't work a compared kit.** The three non-live cells are house kits.
  The only thing you can change in one is a mirror pick. To change a drain or
  a curb, you have to leave Compare, open the other popup, and rebuild the
  room from scratch.
- **Work is lost on the jump.** If you do rebuild it in the other popup, its
  Compare treats *that* build as live. It then re-derives the kit you came
  from as a fresh house kit, so your customized build disappears from the
  comparison.
- **The layout moves.** Today's 2×2 grid plus a two-column detail shows only
  two builds' lines at once. Which pair it shows depends on the host popup
  and the selected tile, so nothing is where muscle memory expects it.

## Owner decisions (2026-09-28)

1. **Approach B.** Compare hands off to the real configurator ("Open") rather
   than embedding four build columns. There's no configurator inside Compare,
   so ADR 0034 decision 3's objection stands in spirit.
2. **The anchor is the kit you're in.** Opening another column makes that kit
   the new anchor ("Current").
3. **Builds you leave are kept.** Jumping away saves the build you were in.
   Coming back shows every build as you left it. Nothing changes on its own
   except the house kits, and a kept build changes only when you **Sync** it.
4. **Sync = pull, but keep my picks (option b).** It takes the room, benches
   and added lines from the anchor, and keeps the column's own swaps and
   added lines. A pick that no longer fits falls back to the house pick and
   says so.
5. **A hidden, saved set per shower (area)**, not per job. It is shared with
   the team, like everything on the job.
6. **Builds keep choices, never prices**, so a set shows today's prices.
7. **A room-changed chip** flags a kept build built for a different room.
8. **A resume prompt** appears when starting a fresh wedi/Schluter kit in a
   shower that has a kept build of that brand.
9. **Layout A:** four fixed columns, always in the same order, each with a
   header holding its actions. The anchor gets a moss outline and a
   **CURRENT** tab.
10. **No drawings in Compare.**

## 1. The layout

```
          [CURRENT]
          ┌─────────────────┐
 System   │ WEDI Building   │ WEDI S-DRY        SCHLUTER KERDI-    SCHLUTER KERDI
          │ Panel           │ membrane          BOARD              membrane
          │                 │ House kit         Your build         House kit
          │ $1,774.76       │ $1,317.70         $1,026.30          $871.15
          │ Current build   │ −$457 vs current  −$748 vs current   −$903 vs current
          │                 │                   [Built for 60×36 — room changed]
          │         ☑Option │ Open    ☐Option   Open Sync ☐Option  Open  ☑Option
 ─────────┼─────────────────┼──────────────────────────────────────────────────
 BASE     │ …lines…         │ …                 …                  …
```

- **Columns never move.** They are always, left to right: wedi Building
  Panel (`wedi:board`), wedi S-DRY membrane (`wedi:membrane`), Schluter
  KERDI-BOARD (`schluter:board`), Schluter KERDI membrane
  (`schluter:membrane`). This holds whichever popup you opened Compare from.
  The layout replaces Phase 3's 2×2 grid and two-column detail.
- **Rows:** the seven Compare groups (Base, Drain, Curb, Walls, Seams,
  Setting, Extras, with benches filed under Extras as today), aligned across
  all four columns by `compareLayout` extended to four columns. The label
  column and the header row are sticky.
- **Column header,** top to bottom:
  - brand badge and system name (`cellLabel`, so S-DRY no-fit cells keep
    their Phase 3 names);
  - a status tag: **House kit**, **Your build**, or none on the anchor;
  - the total in the current price lens;
  - the difference from Current, or "Current build" on the anchor, with the
    delta hidden on a tie (Phase 3 ruling 16);
  - up to two chips, then "+N more";
  - the actions: **Open**, **Sync** (Your build only) and an **Option**
    checkbox.
- **The anchor** is drawn as a 2px `--ft-brand` outline around its whole
  column (header plus every row) with a **CURRENT** tab on top. Its Open is
  disabled.
- **Every line / Subtotals**, a segmented toggle in the Compare head. Every
  line is the default.
  - Subtotals collapses each group to one money cell per column with a line
    count.
  - Clicking a subtotal expands that group only.
  - The choice is session state (the popup's Compare session object, as
    Phase 3 keeps its grid state).
- **Narrow screens:** below the width four columns need, the column area
  scrolls sideways with the label column pinned. Nothing wraps or stacks.
- **Carried over from Phase 3, now per column:**
  - Clicking a chip scrolls to that column's flagged line and highlights it.
  - A house kit's unmatched added line keeps its ⇄/×/+ mirror controls in
    its own column (per-cell mirror state, unchanged).
  - The wedi Membrane S-DRY no-fit answer sits at the top of that column,
    only while it is a house kit with no fit.
- **Mirror controls live only on house kits.** A Your build column has no
  mirror: its added lines are real lines of its own build.
- **Quote options:**
  - Checked columns send as options lettered **A–D in column order**. That
    means B = wedi Membrane and C = Schluter Board (Phase 3 had B = Schluter
    Board).
  - When the tab opens, the anchor and the other brand's same-wall-system
    column start checked, as today.
  - The foot's "Add N as quote options" button and the confirm modal are
    unchanged.
- **Clear set** is a text button in the Compare head. After a confirm, it
  removes every kept build for this shower except the anchor's own, and
  those columns go back to house kits.
- **Removed:** the 2×2 tiles, the tile select, and the two-column detail.

## 2. Status of a column

| Status | Which | What it shows | Changes when |
|---|---|---|---|
| **Current** | the popup's live build | the live build, as today | you edit it in the popup |
| **Your build** | a kept entry in the set for that cell, not the anchor | the entry's build, re-priced now | only on Sync (or Open → edit → leave) |
| **House kit** | no kept entry | `cellBuild`'s derived kit, as today | automatically, with the anchor's room |

The anchor's own cell may also have a kept entry, from an earlier visit. The
live build always wins, and the entry is overwritten the next time it saves.

## 3. Open (the hand-off)

**Open** on a column:

1. Saves the anchor's live build into the set under the anchor's cell key.
   This is skipped when the build is empty (nothing built, or a Browse-only
   build with no lines).
2. Picks the target build:
   - the column's kept entry if it has one;
   - otherwise the house kit's own cfg, with that column's resolved mirror
     picks baked into its `cfg.manual` so the build you land in is the one
     you saw.
3. Hands off:
   - **Other brand:** the popup closes and the other brand's popup opens on
     the same area, seeded with that build.
   - **Same brand, other wall system:** the popup re-seeds itself (App's
     existing remount-on-nonce).
4. The opened build is **detached** from any placed kit (the ADR 0035
   `detached` path), so its "Add to product lines" **appends** a new kit.
   The one exception: a kept entry saved from a placed kit carries its
   `target` ({areaId, rowId, kitId}). Opening it reattaches, and Add replaces
   that kit, exactly as Reconfigure would.
5. The popup lands on its **Compare** tab, so the columns are what you see
   first. The new build is now Current.

**Closing the popup** (✕, Esc, backdrop, or Add to product lines) also saves
the live build into the set, with the same empty-build skip. Browse-only
builds and Kits-tab picks save like any other build.

## 4. Sync (option b)

`syncEntry(entry, anchor, ctx)` is pure and lives in `src/compareset.js`. It
returns a new entry built from:

- **From the anchor:**
  - the neutral room: `w`, `d`, `curbed`, `drain`, `walls`, and now
    `benches` (§6);
  - the anchor's hand-added lines. Same brand: they pass through as-is.
    Other brand: they take the nearest match (`mirrorPlan` with an empty
    mirror state, the auto pick).
- **Kept from the entry:**
  - every choice field ADR 0049 defines:
    - Schluter: `drainPick`, `swaps` (`grate`/`curb`/`board`/`membrane`/
      `band`/`fastener`) and `mortarItem`;
    - wedi: `coverPick`, `curbPick`, `panelPick` and `sdryBase`;
  - its `source`;
  - its own hand-added lines.
- **Merging added lines:** the entry's lines come first. An anchor line is
  added only when the entry has no line of the same slot + part (`key`), so
  a niche you already matched by hand isn't doubled.
- **Rebuilding:** the build is re-solved for the new room:
  - wedi through the solver's top option, as `wediBuildFor` does, then
    `kitFor` with the kept choices;
  - Schluter through `trayCandidates`' top pick, then `buildKit` with the
    kept cfg choices.
- **Dropped picks:**
  - A kept choice the engines can't resolve for the new room (for example a
    fixed-length drain body longer than the new wall) resolves to the house
    pick, as ADR 0049's engines already do.
  - Sync records each one on the entry as `dropped: [slot]`. The column
    shows a chip, "Your ⟨slot⟩ pick doesn't fit — house pick used", until
    the next Open or Sync.
- **After Sync:** the entry's `room` is set to the anchor's room, so the
  room-changed chip clears. The write goes through `updateProject`.

**Where Sync appears:** only on Your build columns. A house kit already
follows the anchor. The anchor has nothing to pull from.

## 5. Saving, storage, resume

**Storage:** a new project field, `compareSets`:

```
Customer.compareSets: {
  [areaId]: {
    [cellKey]: {                       // "wedi:board" | "wedi:membrane" | "schluter:board" | "schluter:membrane"
      snap: { mode, cfg },             // exactly a row marker — what Reconfigure / the basket reopen on
      session?: { qtyOv?, manual?, panelFit? },   // normKitSession, as the basket
      target?: { areaId, rowId, kitId },          // normKitTarget, as the basket
      room: { w, d, curbed, drain, walls: [{ side, on, len, h }], benches: [...] },
      dropped?: [slot],                // Sync's did-not-fit picks (§4)
      savedAt: number, savedBy: string // profile name at save time
    }
  }
}
```

- **Normalizer:** `normCompareSets(v, areaIds)` in `model.js`, called from
  `normC`.
  - It reuses `normKitSession` and `normKitTarget`.
  - It drops unknown cell keys, entries without a `snap.cfg`, and areas that
    no longer exist on the project.
  - Absent reads as `{}`, so every existing job is valid with no migration.
  - No SQL: it rides the existing `customers.data` jsonb.
- **Write path:** only through `updateProject(pid, { compareSets })`, built
  by the pure helpers in `compareset.js`:
  - `saveEntry(sets, areaId, cellKey, entry)`
  - `syncInto(sets, areaId, cellKey, entry)`
  - `clearSet(sets, areaId, keepKey)`
  - The popups get the area's set plus one `onCompareSet(nextAreaSet)`
    callback from App. They never call `updateProject` themselves.
- **What is not stored:**
  - prices (they're re-priced from the books on every render, ADR 0003
    doesn't apply because nothing is snapshotted);
  - Compare's session state (selected, checked, Subtotals, mirror picks on
    house kits), which stays in the popup's session object as Phase 3 has
    it.
- **Versions:** they snapshot `categories` only, so the set is not
  versioned. That's intended, since it's scratch work.
- **Room-changed chip:**
  - `roomChanged(entry.room, anchorRoom)` compares `w`, `d`, `curbed`,
    `drain`, each wall's `on`/`len`/`h`, and bench geometry.
  - Chip wording: "Built for ⟨w⟩×⟨d⟩ — room changed", or "Built for a
    different room" when only walls, benches or the drain differ.
  - It ranks first among the column's chips.

**The resume prompt:**

- **Trigger:** a wedi/Schluter popup opens on an area whose set holds at
  least one entry of that brand, and the seed is **not** a marker. That
  means a fresh start: a row-search seed or no seed. A Reconfigure,
  basket-open or Open hand-off never prompts.
- **Content:**
  - one row per kept build of that brand, showing the system name, room
    size, total now, and "saved ⟨ago⟩ by ⟨name⟩";
  - a room-changed note when the entry's room differs from the room the
    fresh start was seeded with (a row-search seed may carry none);
  - a **Start new** button.
- **Picking a row** seeds the popup from that entry (reattaching its
  `target` if it has one). **Start new** starts as today. Nothing is deleted
  until the popup next saves over that cell.

**The Apps hub** (a configurator with no job or area): there is no set. Its
Compare shows the four columns with no Open, Sync or Clear set, and it never
prompts.

## 6. Benches travel with the room

- **The neutral room gains `benches`.**
  - `roomFromWedi` and `roomFromSchluter` read `cfg.benches`. Both engines
    already normalize the shared shape `{kind, side|corner, build, len,
    depth, h, size, part?}` (Schluter's `normBench` mirrors wedi's).
  - Legacy Schluter `cfg.bench` goes through `cfgBenches`.
- **House kits now bill the anchor's benches.**
  - `wediBuildFor` and `schluterBuildFor` pass them through, replacing
    `bench: null`.
  - Across brands, `part` (a brand-specific premade SKU) is dropped, so each
    engine's `normBench` picks its own default for that kind. Within a brand
    it passes through.
- **Goldens:** the existing goldens build rooms with no benches, so they stay
  byte-identical. A new golden room with a corner bench pins both brands'
  house kits.

## 7. Components and files

| Unit | Change |
|---|---|
| `src/compareset.js` (new, compare chunk + popups) | pure: `normCompareSets`, `roomOfEntry`, `roomChanged`, `saveEntry`, `syncEntry`, `clearSet`, `resumeChoices`, `entryFromBuild`. Imports no engine. Sync's rebuild is injected by the caller (CompareTab passes the comparekit builders), so this file stays boot-safe. |
| `src/model.js` | `normC` calls `normCompareSets`; `newProject` seeds `compareSets: {}` |
| `src/comparekit.js` | the neutral room gains `benches`; `wediBuildFor`/`schluterBuildFor` accept `benches` and kept choices (`opts.choices`), used by Sync |
| `src/comparegrid.js` | `CELLS` reorders to column order (A–D follow it); `cellBuild` gains a `kept` input (a kept entry's build, re-priced) and `cellFlags` a `roomChanged`/`dropped` pair |
| `src/CompareTab.jsx` | the four-column layout, headers, anchor ring, Subtotals, Clear set, Open/Sync handlers; the grid + detail are removed |
| `WediConfigurator.jsx`, `SchluterConfigurator.jsx` | new props `compareSet`, `onCompareSet`, `onOpenCell(cellKey, entry)`; save on close; resume prompt; land on Compare after a hand-off |
| `App.jsx` | passes the area's set, writes it through `updateProject`, and does the cross-brand hand-off (close one popup, open the other with the seed and `n` nonce) |

- **ADR 0026 boot rule:** `compareset.js` imports no engine, so it may load
  with the popups. `comparekit`/`comparegrid` stay in the compare chunk. The
  boot-chunk grep must still read 0.

## 8. Error handling

- **A kept entry that no longer builds** (its pan left the catalog, or the
  room is now empty): the column shows the house kit with a chip, "Your
  build can't be rebuilt — showing the house kit". The entry is kept until
  Clear set or the next save.
- **A malformed stored set** is dropped entry-by-entry by the normalizer. It
  never throws on load.
- **A failed `updateProject` write** behaves like every project write:
  optimistic, with the existing save-error ping.
- **Two people editing one job's set:** last write wins (ADR 0004), as for
  every project field.

## 9. Testing, proof, records

- **`src/compareset.test.js`:**
  - the normalizer (junk, unknown keys, orphaned areas, an absent field);
  - `saveEntry` / `clearSet`;
  - `roomChanged` (each field);
  - `syncEntry`: choices kept, room taken, added lines merged without
    doubles, a dropped pick recorded;
  - `resumeChoices` (marker vs query seed).
- **`src/comparegrid.test.js`:**
  - the new `CELLS` order;
  - `cellBuild` with a kept entry;
  - the room-changed and dropped chips, and their order.
- **`src/comparekit` tests:**
  - benches on the neutral room, both directions;
  - `part` dropped across brands and kept within a brand;
  - kept choices honored by both builders.
- **Goldens:**
  - `comparegridgolden` re-pins its letter order only; its totals stay
    unchanged;
  - a new corner-bench room is added;
  - `wallsysgolden`, `wedimarkergolden` and `addedgolden` stay untouched and
    green.
- **`src/options.test.js`:** A–D in the new column order.
- **`src/model.test.js`:** `normC` with and without `compareSets`.
- **Checks:**
  - `npm test`, `npm run lint`, and a build with the dummy env vars;
  - the boot-chunk grep reads 0.
- **Preview proof** (`.scratch/158_shower-config-roadmap/p4/shoot-set.mjs`,
  ending "all checks passed"):
  - the four columns from a wedi host and from a Schluter host (same order);
  - Open from wedi to Schluter, edit a drain, then Open back to wedi, where
    Schluter reads Your build with the pick shown;
  - a room edit, the room-changed chip, Sync, and the chip clearing with the
    pick kept;
  - a dropped-pick chip;
  - Subtotals;
  - Clear set;
  - the resume prompt;
  - the three-option confirm with new letters.

  Re-run `p1a`–`p3` and restore any PNG with no real change. `p3`'s grid
  shots are superseded by `p4`.
- **Records:**
  - **ADR 0052 "Compare set"**, which amends ADR 0034 decision 3 (a
    column's build can be the rep's own, and Open hands off to the real
    popup) and decision 5 (Compare's kept builds are saved on the project);
  - an ADR 0049 note (Sync resolves kept choices, and a dropped pick is
    named);
  - the data-model skill's `Customer` entry;
  - `src/CLAUDE.md` entries;
  - ticket 158's Phase 4 row and a handoff.

## Out of scope

- Editing inside a Compare column (⇄/+/× on a Your build column). Open is
  the way in.
- Drawings in Compare.
- A shared wedi+Schluter basket drawer. It was discussed, and the set covers
  the need for now.
- Feedback after sending options (ADR 0034 "Open", still open).
- Syncing *from* a non-anchor column to others ("push", option c).
- Sheoga.

## Amendments during planning and build

1. **Kept builds store the marker only.** There is no `session`.
   - Stepped quantities don't carry into a kept build. That's the rule a
     placed kit's marker already follows.
   - Hand-added lines already ride `cfg.manual` on both brands.
2. **Browse-only builds are not kept.** They have no marker to reopen.
3. **wedi's panel Fit plan moved into `wedi.js`** (`panelFitLines`,
   verbatim). A kept wedi column prices exactly what the popup showed, and
   no engine total moved.
4. **Sync takes the neutral room** (`w`, `d`, `curbed`, `drain`, `walls`,
   `benches`). It resets the brand-only geometry the room can't place
   (Schluter `xwalls`/`corners`/drain offset/`ramp`/`maxIn`/`tileT`/`pick`;
   wedi `corners`/`maxIn`/`tileT`/solve), and re-ranks the tray or pan.
   - On a wedi Membrane build, Sync takes the default S-DRY-first route: an
     S-DRY base if one fits, else a wedi pan.
5. **The save happens as the popup body unmounts.** Every close path passes
   through it. A save that changes nothing (same marker, room and target)
   isn't written, so opening and closing a popup doesn't cost a database
   write.
6. **The neutral room moved into `compareset.js`** (`neutralRoomWedi`/
   `neutralRoomSchluter`). The popups stamp a kept build with the same room
   shape Compare compares against, without importing comparekit.
   comparekit re-exports them under the old names.
7. **Brand display names live in `resumeprompt.jsx`, not `compareset.js`.**
   `compareset.js` is on the boot path through `model.js`, and "KERDI" in it
   broke the boot-chunk grep.
8. **The S-DRY no-fit answer shows above the columns** while wedi Membrane
   is a house kit with no fit. It isn't inside that column's header, which
   would stretch all four headers.
9. **The Current ring is inset shadows on every cell of the host's
   column** (`.cur`, with `top`/`bot` closing it), not an absolutely placed
   overlay. It survives any row count and the Subtotals fold.
10. **A cross-brand bench carries its geometry only.** The other engine's
    `normBench` picks its own build for the kind, so a Schluter premade
    corner reads as a wedi site-built corner seat in the wedi house kit.
11. **Proof lives in a new two-popup harness** (`compare-set-preview.html`),
    because the hand-off crosses popups. `p3/shoot-grid.mjs`,
    `p1d/shoot-compare.mjs` and `p2/shoot-compare.mjs` drove the retired
    grid and detail. They are superseded by `p4/shoot-set.mjs`, and their
    shots stay as history.
12. **(Final review.) Picking a resume row never saves the build on
    screen.** A sized row search builds a default kit on mount, and that
    unmount used to write it over the kept build the rep had just picked.
    The pick sets a skip flag. Proof step 6b pins it, and was shown to fail
    without the fix.
13. **(Final review.) The save waits a tick and checks the body is really
    gone.** StrictMode's dev-only unmount/remount would otherwise write on
    open under `npm run dev`, which talks to the live project.
14. **(Final review.) The "nothing changed" check is key-order-free**
    (`entrySig`), because jsonb returns the record's keys reordered.
15. **(Final review.) Dropped-pick chips read the bill before the Fit
    plan.**
    - Schluter membrane/band swaps are width/roll choices, never checked as
      SKUs.
    - Board/fastener picks count only on a KERDI-BOARD build.
    - A wedi Membrane build's `panelKey` is never flagged.
16. **(Final review.) wedi Sync keeps the Membrane floor answer.** A kept
    "wedi pan + S-DRY walls" stays a wedi pan where S-DRY now fits. "Nearest
    S-DRY base" holds only while nothing fits.
17. **(Final review.) A bench compares by where it sits (kind + wall or
    corner) only.** Each engine normalizes its own dims and build, so the
    same bench seen from the other brand isn't a room change.
18. **(Final review.) A hand-off reattaches only to the same kit.** The
    target row must still carry the kept `kitId` (moveKitEntries' rule);
    otherwise the popup opens detached.
19. **(Final review.) A kit Added from a fresh start is stamped as its kept
    build's target** (App `writeCompareSet`), so reopening it reattaches
    instead of adding a second copy.
20. **(Final review.) The resume row notes "room changed since"** when the
    fresh start was seeded with another size (spec §5).
21. **(After merge, owner 2026-09-28.) Open works in the Apps hub.** This
    supersedes §5's "Apps hub" paragraph. The owner works the configurators
    from the Apps tray.
    - The hub keeps a **session-only** set (`AppsWorkspace` `hubSet`,
      never saved).
    - Open reseeds the target tab and moves the pane to it (the rail's
      `switchApp`).
    - The hidden-but-mounted tabs keep the set current as their builds
      change (`keepLive`).
    - Sync, Clear set, Your build and the room chip all work there.
    - The resume prompt stays off: a popup only prompts when its host
      passes `onResume`, and the hub doesn't.
    - Proof: `p4/shoot-hub.mjs` on `rail-preview.html`.

