# Shared shower basket, + Basket on Compare, Print Compare — design

**Date:** 2026-09-29 · **Status:** design approved by owner in chat; spec
awaiting review · **Builds on:** ADR 0035 (the basket), ADR 0052 (the
Compare set), ADR 0031 (quote options), ADR 0026 (lazy chunks)

## Problem

- **Two baskets for one shower.** The wedi and Schluter popups each keep their
  own staged list (`project.wediBasket`, `project.schluterBasket`). The two
  systems are compared in the same Compare tab, but staging from one popup is
  invisible in the other.
- **Compare can't stage.** To stage a compared column the rep has to Open it
  in its configurator first and press Basket there.
- **Compare can't print.** The side-by-side is what the customer needs to
  see, and there is no way to hand it to them.
- **The Apps hub Compare has no Option checks.** They render only when a
  quote-options landing exists, and the hub has no host area to land on.

## Owner decisions (2026-09-29)

1. **One basket, both popups.** Either popup's Basket shows every staged
   shower kit, wedi and Schluter, each priced correctly. Move (and the new
   Add as options) works on any entry from either popup.
2. **Approach A: live pricing.** The drawer re-derives every entry from its
   marker through its own engine, as today. It becomes a lazy chunk that
   carries both engines. Freezing prices at staging (approach B) was
   rejected.
3. **+ Basket per Compare column, quiet.** One click stages that column's
   build. The drawer does not open; a short message confirms it.
4. **Add as options from the basket.** The drawer can land the selected
   entries as new quote-option areas, one area per entry.
5. **Print Compare shows every line, like the screen**, for the customer.
6. **Print uses the checked columns** (the Option/Include boxes).
7. **The Apps hub gets the checkboxes too**, and its quote options land
   through the hub's destination prompt.

## 1. The shared basket

### Record

- `project.showerBasket: KitBasketEntry[]` replaces `wediBasket` and
  `schluterBasket`.
- Each entry is today's `normKitBasketEntry` shape plus
  `brand: "wedi" | "schluter"`:
  `{ id, kind: "kit", brand, addedAt, snap: { mode, cfg }, session?, target? }`.
- `normC` builds `showerBasket`:
  - If `c.showerBasket` is an array, normalize it. Drop entries with no
    valid brand.
  - Else merge `c.wediBasket` (brand wedi) and `c.schluterBasket` (brand
    schluter) and sort by `addedAt`.
  - The legacy keys are removed from the normalized object, so the next
    `updateProject` write drops them. No SQL; the field rides
    `customers.data`.
- `newProject` seeds `showerBasket: []` and stops seeding the two legacy
  arrays.
- **Rollback note:** if this change is reverted after a job has been saved,
  the old code reads empty `wediBasket`/`schluterBasket` for that job; its
  staged entries are then invisible, not lost (`showerBasket` stays in the
  record).
- Sheoga's basket (`sheogaBasket`) is unchanged.

### Write paths (App.jsx)

- Both popups get `basket={sel.showerBasket}` and
  `onBasketChange={(next) => updateProject(sel.id, { showerBasket: next })}`.
- `onMoveEntries(groups, nextBasket)` is unchanged in shape. The groups'
  lines are already built, so `moveKitEntries` stays engine-free.
- New `onAddOptions(options, nextBasket)`: one `updateProject` with the
  options patch (§1, Add as options) and `showerBasket: nextBasket`.
- `placed` becomes both brands:
  `[...placedKits(cats, "wedi"), ...placedKits(cats, "schluter")]`, each
  tagged with its brand.
- `onOpenPlaced(k)` opens the popup for `k`'s brand. When that isn't the
  popup you're in, the current popup closes (its Compare-set keep runs on
  unmount, as for any close) and the other opens on the kit.
- `onDeleteKit` is unchanged (it's engine-free).

### Staging

- Each popup's `stageBuild` stamps `brand` on the entry. The rule that
  replaces an earlier update of the same kit (`target.rowId`) is applied
  across the whole shared list.
- The popups' own drawer code (`entryView`, `stagedViews`, `placedViews`,
  `moveEntries`) moves out. The popup keeps `stageBuild`, `newShower`, the
  Basket button and the count badge.

### The drawer chunk

- New `src/ShowerBasket.jsx`, mounted via `React.lazy` from both popups. It
  mounts when the drawer first opens; the drawer's slide animation stays in
  the popup.
- New `src/basketkit.js`, the engine side (imports `wedi.js` and
  `schluter.js`; lazy-chunk-only, like `comparekit.js`):
  - `entryView(entry, ctx)` returns
    `{ brand, title, meta, price, faint, lines() }`. It dispatches to the
    wedi logic moved out of `WediConfigurator.jsx` (`buildFromMarker` →
    `applySession` → `lineItems`), or the equivalent Schluter logic moved
    out of `SchluterConfigurator.jsx`. The price uses the job's tier lens
    and each brand's builder knob, exactly as the popup's build column does.
  - `placedView(kit, ctx)`: the same derivation for a placed marker, with no
    session (placed rows are the truth). A wedi placed kit follows the live
    Fit flag only in the wedi popup. In the Schluter popup it uses the
    default (Fit on).
  - `optionName(entry)`: the system label for Add as options, e.g.
    "wedi Building Panel", "wedi S-DRY membrane", "Schluter KERDI-BOARD",
    "Schluter KERDI membrane". It comes from the entry's `cfg.wallSys` and
    reuses `comparegrid.js` `CELLS` names.
- **Catalogs:** the chunk takes the registry bag the popups already receive
  (`stockRows`, `bookStockReady`, `books`, `loadBookItems`, `mortars`,
  `mortarDefault`). It runs `useSchluterCatalog` when the host is wedi, and
  `useWediCatalog({ enabled: host !== "wedi" })` when the host is Schluter,
  mirroring `CompareTab.jsx` (a host-owned catalog is never re-installed).
  In the Schluter popup the host passes its assembled `cat` through.
- **Waiting and errors:** an entry whose catalog is still loading shows
  faint with "Loading the … price book", and can't be moved or landed until
  it's ready. A marker the catalog no longer knows reads faint, as today.
- **Drawer rows:** a brand badge (the Compare `bbadge` styles), the title,
  the meta (lines and room), the price, the Update tag when targeted, and ✕.
  "In this project" rows get the brand badge too.
- **Footer:** `N selected → <area>`, then **Add N as options**, **Move
  all**, and **Move N → area**. `KitBasketPanel` (widgets.jsx) gains
  `onAddOptions` and a per-row `brand`, and stays the presentational shell.

### Add as options

- New `options.js` helper `nextFreeSlots(cats, n)`: the first `n` letters of
  `OPTION_SLOTS` not in `optionsUsed(cats)`. If fewer than `n` are free, it
  returns null and the drawer says "Only K option letters left — select
  fewer".
- `compareOptionsPatch` itself uses `nextFreeSlots` (owner 2026-09-29:
  Compare matches the basket). Every option landing — the Compare footer,
  the basket, the Apps hub — takes the next free letters, so a job that
  already has A and B gets C and D, never a second A. It returns null when
  too few letters are free. On a job with no options the letters are A
  onward, exactly as today, so the existing tests hold.
- CompareTab gets a `freeSlots` prop (the job's free letters, computed in
  App.jsx and passed through both popups). The confirm modal and its button
  show the real letters ("Add options C–D"). With too few free letters the
  footer button is disabled: "Only K option letters left — uncheck some".
  The hub, where the destination isn't known until the prompt, shows
  "options" without letters.
- Each selected entry becomes one sibling area after the popup's area. It is
  named `<area name> — <optionName>` (two entries with the same system get
  " 2", " 3" suffixes), tagged with its letter, and its rows are the entry's
  `lines()`, stamped as one kit. `optionNames` fills only letters that don't
  already have a name.
- The landed entries leave the basket in the same `updateProject`, like
  Move.
- A targeted entry (Update) lands as a new option too. Its target is
  ignored, since it becomes a new area, not a replacement.

### Apps hub

- `AppsWorkspace.jsx` replaces `wediBasket`/`schluterBasket` state with one
  `showerBasket` state, passed to both popups. The in-progress check counts
  it for both wedi and Schluter, and Start new on either clears it.
- Move and Add as options go through `requestCommit` → the destination
  prompt (§3).

## 2. + Basket on a Compare column

- A **+ Basket** `cbtn` in each column header's actions, after Open/Sync. It
  is disabled on a column with a miss message and shown only when the host
  passes `onStage` (a popup with a basket).
- What gets staged:
  - **Current** calls the host's `onStageLive()`, which is the popup's
    `stageBuild({ open: false })` (session, Fit flag and target included).
  - **Your build**:
    `{ brand, snap: kept.snap, session: none, target: none }`.
  - **House kit**: the same seed Open builds (`openCell`'s seed, without
    `tab`), with no target.
- CompareTab calls `onStage(entry)`. The popup adds `brand`/`addedAt`,
  normalizes the entry and appends it through `onBasketChange`.
- Message: `Staged in the basket — <column name>`, in the existing footer
  `msg` slot. If staging fails (no build): "Nothing to stage in this column".
- The Basket badge in the popup head updates, since it's the same list.

## 3. Checkboxes and quote options in the Apps hub

- The column checkbox renders whenever CompareTab can print (always). Its
  label changes from "Option" to **"Include"**. Its title reads "include in
  the print and quote options" when quote options exist, else "include in
  the print".
- The hub passes an `onQuoteOptions` that raises the destination prompt:
  - **Current project:** `compareOptionsPatch(project, null, payload)`, next
    free letters. The areas append at the end, since there's no host
    area. The same applies to the basket's Add as options.
  - **New quick price:** a new quick project whose categories are the
    option areas (letters from A).
- App.jsx's hub `wedi`/`schluter` destination bags gain
  `addOptionsToCurrent(payload)` and `addOptionsToNew(payload)`.
  `AppsWorkspace`'s pending item carries a `kind: "lines" | "options"` so
  `commitTo` calls the right pair.

## 4. Print Compare

- A **Print** button (Printer icon) in the Compare footer. The footer now
  always renders.
- The print sheet is a hidden `.cmp-printsheet` portalled into `body` while
  printing. `@media print` shows only it (the wedi `PRINT_CSS` idiom:
  mounted, `window.print()`, unmounted on `afterprint`, with a timer
  fallback). The on-screen grid is untouched.
- **Header:** project name (new `projectName` prop, passed by both popups),
  area name, the room line (`roomText`) and the date. The price level is
  printed only when it isn't Retail ("Builder pricing").
- **Columns:** the checked columns that have a price, in column order. With
  none checked, the Print button is disabled with a hint ("Check the columns
  to print"). Each column's head shows the brand badge (printed in black on
  white), the system name and a bold total.
- **Body:** the same group bands and slot rows as the screen
  (`compareLayout` over the printed columns only, so an empty band drops).
  Each line shows Qty, Size + item and Price at the popup's price level.
  Note-only lines print in italics without a price. Placeholder rows
  ("Nothing comparable…", "Not mirrored") print as "—".
- **Left off:** Open/Sync/+ Basket, ⇄ and ×, flag chips, Your build/House
  kit pills, "vs current", the Current ring, part numbers and cost.
- **Page:** `@page { size: landscape }` for 3–4 columns, portrait for 1–2.
  Rows use `break-inside: avoid`, and the column heads repeat on each page
  (a `<table>` with a `<thead>`).
- A totals row at the bottom repeats each column's total.

## Testing

- **Unit** (vitest, next to the existing tests):
  - `model.test.js`: `normC` merges legacy baskets with brands and `addedAt`
    order; drops a brandless `showerBasket` entry; `showerBasket` wins over
    legacy keys; legacy keys are absent after normalizing.
  - `options.test.js`: `nextFreeSlots` (gaps, full, `n` larger than free);
    `compareOptionsPatch` on a job that already has A/B lands C/D, and
    returns null when too few letters are free.
  - `basketkit.test.js`: a wedi entry and a Schluter entry each produce a
    title, price and lines matching the popup's own `lineItems` for the same
    marker; a staged session's `qtyOv` carries through; `optionName` per
    `wallSys`.
- **Existing suites** stay green: `npm test`, `npm run build`, and lint.
- **Preview proof** (non-negotiable 3), using the wedi and Schluter preview
  harnesses (their stateful basket gets the shared list):
  - the shared drawer with one wedi and one Schluter entry, from each popup;
  - + Basket on a house-kit column and the message;
  - Add as options landing C and D beside existing A/B;
  - the Apps hub checkboxes;
  - print preview (emulated print media) at 2 and 4 columns.

## Out of scope

- The Sheoga basket stays separate.
- No change to how placed kits reconfigure within their own brand.
