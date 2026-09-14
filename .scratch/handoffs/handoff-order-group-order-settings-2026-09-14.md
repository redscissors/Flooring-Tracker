# Handoff — order-entry group order in Settings (2026-09-14)

**For the next session.** Owner: "lets start on the group order system in
settings." This is the follow-up the owner deferred when merge & sort
landed ([PR #381](https://github.com/redscissors/Flooring-Tracker/pull/381),
`.scratch/137_order-entry-merge-sort/`): a team-shared way to change the
order the vendor groups paste in, instead of the hard-coded desk order.

Start with brainstorming (the owner interaction rule applies — ask the
clarifying questions below and present the design before building). The
owner's own words on the direction, 2026-09-14, when asked about dragging
sections around: they liked the idea; we recommended a saved, team-shared
order living in Settings rather than a per-order drag in the panel, and the
owner said "we will work on a system to change the line order later." No
decision beyond that has been made.

## What exists today (read these first)

- `src/orderlines.js` — `lineGroup(row)` returns `{ key, label, order }`;
  `order` is `V[vendor] * 100 + sub` where `V = { wedi: 0, schluter: 1,
  sheoga: 2, brand: 3, other: 4, materials: 5, freight: 6 }`, `sub` is the
  index into `WEDI_GROUPS` / `SCHLUTER_FAMILIES` (both module constants).
  `groupOrderLines(rows)` sorts groups by `(order, label)` then rows by SKU
  (materials by print-sheet kind first). Book brands all share one `order`
  and fall back to label A–Z. **This is the one place the order lives.**
  The settings-driven version replaces the constants' implied order with a
  saved list, defaults preserved.
- `src/orderlines.test.js` — 17 tests; the group-order assertions pin the
  current default (wedi pans < curbs < building panels < extensions; wedi <
  Schluter < Sheoga < brand < Other < Materials < Freight). Extend, don't
  loosen.
- `src/orderentry.jsx` — the panel (a `React.lazy` chunk since #381; keep it
  that way — orderlines.js pulls wedi.js + schluter.js). It calls
  `groupOrderLines(mergeOrderLines(rows))`. It receives props from App.jsx;
  a saved order would arrive as one more prop (or be read from `settings`
  inside App.jsx and passed down).
- `src/orderentrypreview.jsx` + `order-entry-preview.html` — the preview
  harness with a three-area fixture that produces every group; the
  screenshot script is `.scratch/137_order-entry-merge-sort/shot.mjs`
  (Vite on :5199, playwright-core at
  `/opt/node22/lib/node_modules/playwright/node_modules/playwright-core`).
- Settings: `src/SettingsWorkspace.jsx` (`React.lazy`), tabs in `SECTIONS`
  at ~line 420 (`profile`, `general`, `book`, `materials`, `backup`).
  General holds waste % and the address-lookup probe. Cards use the
  `ft-eyebrow` label idiom.
- Settings persistence: shared record (ADR 0002). Normalizers in
  `src/catalog.js` — `normalizeSettings` (~line 802) composes `waste`,
  `catalog`, `pricing` (`normPricing`, line 783), `apps`, `ops` (`normOps`,
  line 732 — vendor groups, lastBackup), `shop`. **Load the
  `floortrack-data-model` skill before adding a field**; extend a normalizer
  so old records stay valid; write only through `setSettings(patch)`
  (`src/usedirectory.js` line 107).
- Drag-to-reorder patterns already in the repo, both plain HTML5 DnD, no
  library:
  - `src/AppsWorkspace.jsx` ~line 183: grip arms the row (`dragArm`),
    `onDragEnter` live-reorders, `onDragEnd` settles; `GripVertical` icon.
    Rows there hold inputs, hence the arming trick.
  - `src/CustomerBrowser.jsx` ~line 94: draggable column headers, saved
    through `saveUiPref({ browserCols })` (that one is per-user, not the
    model for this feature).

## Recommendation carried over (not yet approved)

- **Team-shared, in Settings.** A new General-tab card, "Order entry group
  order" (or its own small section if General gets crowded). The paste order
  is a desk convention, so it belongs to the team, not the user.
- **Shape:** an ordered list of group keys, e.g.
  `settings.ops.orderGroups: ["wedi:pan", "wedi:drain", …, "schluter:tray",
  …, "sheoga", "brand", "other", "materials", "freight"]` — one flat list so
  the desk can also put, say, Schluter trays above wedi curbs if it ever
  wants to. `brand` stands for "every book brand, A–Z" as one movable block
  (per-brand ordering is YAGNI until asked). Normalizer: unknown keys
  dropped, missing keys appended in default order — so a new group (a
  Schluter family that has never shown up) always has a place and the saved
  order never hides a line.
- **UI:** the list drawn with the AppsWorkspace grip-drag idiom plus
  up/down arrow buttons (touch fallback — Settings shrinks to fit on phones
  rather than reflowing) and a "Reset to default" link. Labels come from
  the same tables orderlines.js uses so Settings and the panel can't drift.
- **Wiring:** `groupOrderLines(rows, orderKeys?)` — optional second
  argument, default = today's order; App.jsx passes
  `settings.ops.orderGroups`. The preview harness gets a `?order=` param or
  a second fixture call to prove a non-default order.

## Clarifying questions to ask the owner before designing

1. One flat list across vendors, or vendor blocks that can only be reordered
   within themselves? (Flat is more flexible; blocks are simpler to read.)
2. Should book brands be one block ("all brands, A–Z") or individually
   orderable once they've appeared on an order?
3. Where in Settings: a card on General, or its own tab? (General currently
   has two cards.)
4. Does the Sheet order view stay untouched? (Assumed yes — it is "as
   entered".)
5. Any interest in a per-order override in the panel later, or is the
   Settings list the whole feature?

## Ground rules that bit last time

- No Supabase writes or SQL from the agent; the settings row changes only
  through `setSettings`. This feature needs no SQL.
- Every change through a PR; UI changes need the preview screenshot before
  merge (`order-entry-preview.html` for the panel, and a Settings preview —
  `header-preview.html` mounts Settings-adjacent surfaces; check
  `src/headerpreview.jsx` or add a small harness).
- Keep wedi.js / schluter.js off the boot chunk: SettingsWorkspace is
  already lazy, but do not import orderlines.js into anything eager.
  Labels for the Settings list should come from a light table (move the
  `WEDI_GROUPS` / `SCHLUTER_FAMILIES` label+key tables into a small
  `ordergroups.js` with no catalog imports, and have orderlines.js import
  them from there).
- TDD: `node --test src/orderlines.test.js` — write the order-override and
  normalizer tests first.
- Pre-existing lint noise you'll see and can ignore: `claimProjectNo` unused
  in App.jsx; unused imports in WediConfigurator.jsx, prototypes.jsx,
  wedi.test.js.
- `npm run build` needs `VITE_SUPABASE_URL=https://example.supabase.co
  VITE_SUPABASE_ANON_KEY=x` in the cloud container or index.html fails to
  parse.

## Mockup from the merge/sort round

The interactive mockup the owner reviewed for #381 (moss pill, group
bands, Sheet order toggle) is a claude.ai artifact from the 2026-09-14
session, "Order Entry Merge Mockup". Useful as the visual baseline if you
mock the Settings card in the same style: paper `#F6F3EC`, ink `#1C1A17`,
moss `#57703A` / deep `#40542A`, Manrope only, eyebrow labels at 10px
`.12em`.
