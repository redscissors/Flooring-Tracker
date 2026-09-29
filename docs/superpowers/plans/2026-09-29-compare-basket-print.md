# Shared shower basket, + Basket on Compare, Print Compare — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One wedi+Schluter basket shared by both shower popups (with Add as options), a quiet + Basket on every Compare column, Include checkboxes everywhere including the Apps hub, and a customer print of the Compare grid.

**Architecture:** The saved record merges `wediBasket`/`schluterBasket` into `project.showerBasket` (brand-tagged entries, merged in `normC`). The per-brand entry pricing now lives inside each popup; it moves into two pure modules (`wedikitview.js`, `schluterkitview.js`), each importing only its own engine. A new lazy chunk (`ShowerBasket.jsx` + `basketkit.js`) imports both, so either popup's drawer prices every entry live, the way `CompareTab.jsx` already spans both engines. Every option landing uses one rule, `nextFreeSlots`, inside `compareOptionsPatch`.

**Tech Stack:** React 18, Vite 5, Tailwind 3, `node --test` (`npm test`), ESLint (`npm run lint`), Playwright + Chromium at `/opt/pw-browsers` for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-29-compare-basket-print-design.md`

## Global Constraints

- Never run SQL or write to the live Supabase project. `npm run dev` talks to the live project, so preview proof uses the `*-preview.html` harnesses only.
- Never push to `main`. Work lands on `claude/eloquent-allen-d7yaqk` through a PR.
- No UI or print change merges without preview screenshots.
- ADR 0026: `basketkit.js`, `ShowerBasket.jsx` and `CompareTab.jsx` are lazy-chunk-only. Nothing on the boot path imports them.
- `WediConfigurator.jsx` never imports `schluter.js`/`schluterkitview.js`. `SchluterConfigurator.jsx` never imports `wedi.js`/`wedikitview.js`. Only the lazy chunks import both.
- Only `usewedicatalog.js` installs the wedi catalog. Any surface reading it goes through `useWediCatalog`.
- `model.js` never imports an engine.
- Rows land RETAIL (ADR 0018). The drawer price is a display lens only.
- Copy, verbatim from the spec:
  - "Staged in the basket — <column name>"
  - "Nothing to stage in this column"
  - "Only K option letters left — select fewer" (basket)
  - "Only K option letters left — uncheck some" (Compare)
  - "Check the columns to print"
  - "Include"
  - "include in the print and quote options" / "include in the print"
- Comments: conservative, per CLAUDE.md. Match surrounding idiom.

## Review Focus

1. **Other brand's price book still loading when the rep presses Move / Add as options.** Only ready entries land. The rest stay staged, with a message naming how many waited. → Task 5 test `moveable skips faint entries`.
2. **A job that already uses every free letter.** Add as options refuses with the exact copy and writes nothing. → Task 1 (`compareOptionsPatch` null) + Task 5 test `optionsFromEntries returns short when letters run out`.
3. **A record carrying both `showerBasket` and legacy arrays** (e.g. saved by a stale tab after deploy). `showerBasket` wins, and the legacy arrays are ignored, not appended twice. → Task 2 test.
4. **Reconfigure on the other brand's placed kit while the current popup holds an unsaved build.** The Compare-set keep runs on unmount, and the other popup opens on that kit. → Task 6 manual check in the preview step.
5. **Printing when a checked column has no price (miss).** It is skipped. When nothing printable is left, Print is disabled with "Check the columns to print". → Task 9 test `printColumns drops missing columns`.

---

### Task 1: Next free option letters

**Files:**
- Modify: `src/options.js` (`compareOptionsPatch`, lines ~78-95)
- Test: `src/options.test.js`

**Interfaces:**
- Produces: `nextFreeSlots(cats: Area[], n: number): string[] | null`. The first `n` letters of `OPTION_SLOTS` not in `optionsUsed(cats)`, or null if fewer than `n` are free.
- Produces: `compareOptionsPatch(project, hostAreaId, payload)`: same signature, now letters from `nextFreeSlots`, null when short. `optionNames` still only fills unnamed letters.

- [ ] **Step 1: Write failing tests** in `src/options.test.js`:
  - `nextFreeSlots skips used letters`: cats with options `["A","","B"]`, `n=2` → `["C","D"]`.
  - `nextFreeSlots fills gaps first`: options `["A","C"]`, `n=2` → `["B","D"]`.
  - `nextFreeSlots null when short`: 11 of 12 letters used, `n=2` → `null`.
  - `compareOptionsPatch lands C and D beside existing A and B`: a project with areas A, B and a host → the new areas' `.option` are `["C","D"]`; `optionNames` keeps the existing A name.
  - `compareOptionsPatch null when too few letters`: 11 used, 2 options → `null`.
- [ ] **Step 2:** Run `node --test src/options.test.js`. Expected: the new tests FAIL (`nextFreeSlots` is not exported).
- [ ] **Step 3:** Implement `nextFreeSlots` and have `compareOptionsPatch` use `slots[i]` instead of `OPTION_SLOTS[i]`. Update the comment above `compareOptionsPatch` in one line ("next free letters, owner 2026-09-29").
- [ ] **Step 4:** Run `node --test src/options.test.js`. Expected: all PASS, including the existing A/B/C/D tests (those jobs have no options).
- [ ] **Step 5:** Commit `feat(options): option landings take the next free letters`.

### Task 2: `showerBasket` record

**Files:**
- Modify: `src/model.js` (`newProject` line ~96, `normKitBasketEntry` ~169, `normKitBasket` ~178, `normC` ~180)
- Test: `src/model.test.js`
- Docs: `.claude/skills/floortrack-data-model/SKILL.md` (Customer block), `docs/adr/0035-configurator-kit-instance-id.md` (new amendment "2026-09-29 — one shower basket"), `docs/adr/README.md` if amendments are indexed

**Interfaces:**
- Produces: `normKitBasketEntry(e, brand?)`. It keeps `e.brand` when it is `"wedi"|"schluter"`, else uses the `brand` argument, else returns null.
- Produces: `normC(c).showerBasket: Entry[]`. `normC` output has no `wediBasket`/`schluterBasket` keys.
- Produces: `newProject(...).showerBasket === []`, and no legacy keys.

- [ ] **Step 1: Write failing tests** in `src/model.test.js`:
  - `normC merges legacy baskets by addedAt with brands`: `wediBasket` [e(addedAt 30)], `schluterBasket` [e(10), e(20)] → `showerBasket.map(b=>[b.brand,b.addedAt])` equals `[["schluter",10],["schluter",20],["wedi",30]]`.
  - `normC showerBasket wins over legacy`: `showerBasket` [wedi e], `schluterBasket` [e] → length 1.
  - `normC drops a brandless showerBasket entry`.
  - `normC output has no legacy basket keys`: `!("wediBasket" in out) && !("schluterBasket" in out)`.
  - `newProject seeds showerBasket`.
- [ ] **Step 2:** Run `node --test src/model.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement. `normC` must strip the legacy keys from the spread (destructure them out of `c`). Grep `src/*.test.js` for `wediBasket|schluterBasket` and update any fixture that asserted the old keys.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Update the data-model skill's Customer block. Write the ADR 0035 amendment: one basket, the brand field, the merge on load, the rollback note from the spec, and why the drawer is a lazy two-engine chunk.
- [ ] **Step 6:** Commit `feat(model): one showerBasket for wedi and Schluter kits`.

### Task 3: Pure per-brand entry views

Behavior-preserving extraction. The popups' `entryView`/`applySession`/`tierOf` move out, so the drawer chunk can reuse them.

**Files:**
- Create: `src/wedikitview.js` (imports `wedi.js` only)
- Create: `src/schluterkitview.js` (imports `schluter.js`)
- Modify: `src/WediConfigurator.jsx` (`applySession` ~933, `tierOf` ~815, `entryView` ~1574, resume `priceOf` ~3037)
- Modify: `src/SchluterConfigurator.jsx` (`tierOf` ~588, `entryView` ~774, resume `priceOf` ~2626)
- Test: `src/wedikitview.test.js`, `src/schluterkitview.test.js`

**Interfaces:**
- Produces (wedi): `wediTierOf({ tier, customPct, salePct, bPct }) => (item) => number`. `wediApplySession(build, walls, { qtyOv, manual, panelFit }) => line[]`. `wediEntryView(marker, session | undefined, { tier, customPct, salePct, bPct, panelFit }) => { title, meta, price, faint?, lines: (() => row[]) | null }`. `session` undefined means a placed kit (reads `panelFit`); an object means staged (reads `session.panelFit !== false`).
- Produces (Schluter): `schluterTierOf({ tier, customPct, salePct, bPct })`. `schluterEntryView(marker, session | undefined, { cat, catReady, tier, customPct, salePct, bPct, panelFit })`, with the same return shape. The "waiting on the price books…" faint state applies when `!catReady || !cat.length`.
- Titles, metas and the faint copy stay exactly as the popups have them today.

- [ ] **Step 1: Write failing tests.** Use the fixtures the engine tests already use (`wedipricelistfixture.js`, `schluterfixture.js` through `normOrderItem`, as `schluteradapter.test.js` does):
  - `wediEntryView prices a kit marker at retail = sum of lineItems`: build a marker from a known pan key. `price` equals the sum of `lines()` retail × qty, and `title` is the pan's name.
  - `wediEntryView applies a staged qtyOv`: the session `qtyOv` on one item changes that line's qty in `lines()`.
  - `wediEntryView staged vs placed Fit fork`: `session={}` uses Fit on; `session=undefined, panelFit:false` uses Fit off. The line counts differ.
  - `schluterEntryView faint until catReady`: `{ faint: true, lines: null, meta: "waiting on the price books…" }`.
  - `schluterEntryView prices a tray marker`: `price` = the sum over non-noteOnly lines of `schluterTierOf(retail ctx)`.
  - `schluterTierOf employee = cost × 1.06`.
- [ ] **Step 2:** Run `node --test src/wedikitview.test.js src/schluterkitview.test.js`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Create both modules by moving the code verbatim. In the popups, replace the closures with calls (`applySession` in the build memo → `wediApplySession`, `entryView` → the module's view with the popup's ctx). Keep the popups' own `stagedViews`/`placedViews` for now (Task 5 removes them).
- [ ] **Step 4:** Run `npm test && npm run lint && npm run build`. Expected: all pass. Build output still shows `CompareTab` as its own chunk.
- [ ] **Step 5:** Commit `refactor: move basket entry pricing into per-brand kitview modules`.

### Task 4: `basketkit.js` (the two-engine side)

**Files:**
- Create: `src/basketkit.js` (lazy-chunk-only header comment, like `comparekit.js`)
- Test: `src/basketkit.test.js`

**Interfaces:**
- Consumes: Task 3 views; Task 1 `nextFreeSlots`; `CELLS`/`BRAND` from `comparegrid.js`; `hostCellKey`.
- Produces:
  - `entryView(entry, ctx) => { id, brand, target, title, meta, price, faint, lines }`. Dispatches on `entry.brand`, passing `entry.session || {}` (the staged fork). `ctx = { wedi: wediCtx, schluter: schluterCtx }`, each the Task 3 ctx.
  - `placedView(kit, ctx) => { ...kit, brand, title, meta, price, faint, lines }`, with no session.
  - `optionName(entry) => string`. `BRAND[brand] + " " + system`, where system is `"Building Panel"|"S-DRY membrane"` for wedi and `"KERDI-BOARD"|"KERDI membrane"` for Schluter, from `hostCellKey(brand, entry.snap.cfg)`.
  - `optionsFromEntries(views, entries, cats) => { options: [{ name, lines }] } | { short: number }`. `views` are ready (non-faint) entry views. Names repeat-suffix " 2", " 3". `short` is the free-letter count when `nextFreeSlots(cats, n)` is null.
  - `moveable(views) => { ready: View[], waiting: number }`.

- [ ] **Step 1: Write failing tests:**
  - `optionName per wallSys`: wedi with no wallSys → "wedi Building Panel"; wedi membrane → "wedi S-DRY membrane"; Schluter board → "Schluter KERDI-BOARD"; Schluter with no wallSys → "Schluter KERDI membrane".
  - `entryView dispatches by brand`: a wedi entry and a Schluter entry return brand-matching titles equal to `wediEntryView`/`schluterEntryView` for the same marker.
  - `optionsFromEntries suffixes repeat names`: two wedi Building Panel entries → names `["wedi Building Panel", "wedi Building Panel 2"]`.
  - `optionsFromEntries returns short when letters run out`: cats using 11 letters, 2 views → `{ short: 1 }`.
  - `moveable skips faint entries`: 1 ready + 1 faint → `ready.length === 1, waiting === 1`.
- [ ] **Step 2:** Run `node --test src/basketkit.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test src/basketkit.test.js`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(basketkit): two-engine basket entry views and option naming`.

### Task 5: The shared drawer chunk in both popups

**Files:**
- Create: `src/ShowerBasket.jsx` (default export, lazy)
- Modify: `src/widgets.jsx` `KitBasketPanel` (~938)
- Modify: `src/WediConfigurator.jsx` (basket block ~1568-1692, drawer mount ~3041-3050, `stageBuild`)
- Modify: `src/SchluterConfigurator.jsx` (basket block ~766-888, drawer mount ~2630-2639, `stageBuild`)

**Interfaces:**
- Consumes: Task 4 (`entryView`, `placedView`, `moveable`, `optionsFromEntries`); `useSchluterCatalog`, `useWediCatalog`.
- `ShowerBasket` props:
  - `host: "wedi"|"schluter"`, `basket`, `onBasketChange`, `onMoveEntries(groups, nextBasket)`, `onAddOptions(options, nextBasket)` (optional; omitted hides the button), `placed` (brand-tagged `[{...kit, brand}]`), `onOpenPlaced(kit)`, `onDeleteKit(kit)`, `areaName`, `tierColor`, `onClose`, `say(msg)`.
  - Price ctx: `tier, customPct, salePct, wediBuilderPct, schluterBuilderPct, panelFit` (host's own live Fit, used only for its own brand's placed kits; the other brand uses Fit on).
  - Registry bag: `stockRows, bookStockReady, books, loadBookItems`, and Schluter host `cat, catReady` passed through.
- `KitBasketPanel` gains: per-row `brand` (renders a badge, wedi = `--ft-brand`, Schluter = `--s-rust`), and `onAddOptions` (a footer button "Add N as options", disabled at 0 selected). The empty text becomes `Basket is empty. Build a shower kit and click "Basket".`
- Popup `stageBuild` stamps `brand` and applies the `target.rowId` replace rule across the whole `basket`.
- Popups expose `stageEntry(entry)` for Task 7: `(entry) => { const e = normKitBasketEntry({ ...entry, addedAt: Date.now() }); if (!e) return false; onBasketChange([...(basket||[]), e]); return true; }`.

- [ ] **Step 1:** Build `ShowerBasket.jsx`:
  - Run both catalog hooks exactly as `CompareTab.jsx` lines 247-263 do (host-owned one fed nulls / `enabled:false`).
  - Build `ctx`, then compute `staged = basket.map(e => entryView(e, ctx))` and `placedV = placed.map(k => placedView(k, ctx))`, both memoized.
  - Handle selection state.
  - **Move:** `moveable(selected)` → `onMoveEntries(ready.map(v=>({lines: v.lines(), target: v.target})), basket minus ready ids)`. When `waiting > 0`, call `say` with `N still loading — they stay in the basket`.
  - **Add as options:** `optionsFromEntries(...)`. On `short`, `say("Only K option letters left — select fewer")`. Otherwise `onAddOptions(options, basket minus ready ids)`.
  - Render `KitBasketPanel`.
- [ ] **Step 2:** In both popups:
  - delete `entryView`/`stagedViews`/`placedViews`/`moveEntries`/`basketSel`;
  - mount `const ShowerBasket = lazy(() => import("./ShowerBasket.jsx"))` inside the existing slide-in panel, rendered once `basketOpen` has been true (a `basketSeen` ref), under `<Suspense fallback={null}>`;
  - keep the resume prompt on the Task 3 own-brand view;
  - add `onAddOptions` to the popup props and pass it through.
- [ ] **Step 3:** Update `wedipreview.jsx` and `schluterpreview.jsx`. One basket state carries `brand`, `placed` is both brands tagged, and `onAddOptions` applies `compareOptionsPatch`-shaped areas onto the harness cats. Point the Schluter harness at the same fixture bag so the wedi drawer can price Schluter entries.
- [ ] **Step 4:** Run `npm test && npm run lint && npm run build`. Expected: pass, with `ShowerBasket` emitted as its own chunk (check the `vite build` output).
- [ ] **Step 5:** Preview check (Playwright over `wedi-preview.html`, built via `npx vite build` + `npx vite preview`, or `npx vite` for the harness only):
  - stage a wedi kit;
  - open the Schluter tab of the harness (or the Schluter harness with the shared state), stage a Schluter kit;
  - open the drawer from each popup: both entries, badges, prices.
  - Screenshot to the scratchpad.
- [ ] **Step 6:** Commit `feat(basket): one shared wedi+Schluter drawer, Add as options`.

### Task 6: App wiring

**Files:**
- Modify: `src/App.jsx` (wedi mount ~3043-3090, Schluter mount ~3093-3130, `addCompareOptions` ~901)

**Interfaces:**
- Consumes: Task 2 `showerBasket`; Task 5 popup props.
- Produces, to both popups:
  - `basket={sel.showerBasket || []}`
  - `onBasketChange={(next) => updateProject(sel.id, { showerBasket: next })}`
  - `onMoveEntries` writing `showerBasket` (keeps the stranded ping)
  - `onAddOptions={(options, next) => { const patch = compareOptionsPatch(sel, pop.aid, { options, label: areaName }); if (patch) updateProject(sel.id, { ...patch, showerBasket: next }); }}`
  - `placed={[...placedKits(cats,"wedi").map(k=>({...k,brand:"wedi"})), ...placedKits(cats,"schluter").map(k=>({...k,brand:"schluter"}))]}`
  - `onOpenPlaced(k)` → if `k.brand` matches the popup, today's reseed; else close this popup (`setWediPop(null)` / `setSchluterPop(null)`) and open the other on `{ aid: k.areaId, pid: k.rowId, seed: k.marker, n: 1 }`.
  - `freeSlots={OPTION_SLOTS.filter(s => !optionsUsed(sel.categories).includes(s))}` (for Task 7).

- [ ] **Step 1:** Wire the props above. `addCompareOptions` is unchanged (Task 1 moved the letter rule into the patch).
- [ ] **Step 2:** Run `npm run lint && npm run build`. Expected: pass.
- [ ] **Step 3:** Manually check the Review Focus 4 path in the preview harness (a Schluter placed kit, Reconfigure from the wedi drawer). The wedi build on screen appears in its Compare column afterwards.
- [ ] **Step 4:** Commit `feat(app): wire the shared shower basket and cross-brand reconfigure`.

### Task 7: + Basket on Compare columns; Compare letters

**Files:**
- Modify: `src/CompareTab.jsx` (`openCell` ~375, `colHead` acts ~464, confirm modal ~601-636, footer ~544)
- Modify: `src/WediConfigurator.jsx`, `src/SchluterConfigurator.jsx` (CompareTab mount: pass `onStage`, `onStageLive`, `freeSlots`)

**Interfaces:**
- Consumes: Task 5 popup `stageEntry`, `stageBuild({ open: false })`; Task 6 `freeSlots`.
- CompareTab new props:
  - `onStage(entry) => boolean`, `onStageLive() => boolean`. The + Basket button shows only when both are given.
  - `freeSlots: string[] | undefined`. Undefined means the Apps hub: no letters shown.
- Produces: `cellSeed(c, source)` inside CompareTab. It is `openCell`'s seed logic lifted into a helper (kept → `{...kept.snap}`; wedi house → `{ mode, cfg: {...cfg, source} }`; Schluter house → `{ mode:"custom", cfg: {...c.cfg, source, pick} }`). Both `openCell` and staging use it.

- [ ] **Step 1:** Add `cellSeed` and refactor `openCell` onto it.
- [ ] **Step 2:** Add a `+ Basket` `cbtn` (`data-cmp-stage={c.key}`), disabled when `missOf(c)`:
  - Current calls `onStageLive()`; others call `onStage({ brand: c.brand, snap: cellSeed(c, source) })`.
  - On true, set `msg` to `Staged in the basket — ${c.name}`; on false, `Nothing to stage in this column`.
- [ ] **Step 3:** Confirm modal and footer:
  - Letters come from `freeSlots` when given: `freeSlots[i]` in rows and "Add options X–Y".
  - When `freeSlots && freeSlots.length < sendable.length`, disable the send button with `Only ${freeSlots.length} option letters left — uncheck some`.
  - The modal note's "tagged options A–…" uses the same letters.
- [ ] **Step 4:** Popups pass `onStage={stageEntry}`, `onStageLive={() => stageBuild({ open: false })}` and `freeSlots` (thread the new popup prop from App).
- [ ] **Step 5:** Run `npm test && npm run lint && npm run build`. Expected: pass. Check `comparegridgolden.test.js` is unaffected.
- [ ] **Step 6:** Preview check. Open Compare in `wedi-preview.html` and click + Basket on a Schluter house-kit column. The message shows, the Basket badge count increments, and the drawer lists a Schluter entry priced the same as the column total at Retail. Screenshot.
- [ ] **Step 7:** Commit `feat(compare): + Basket per column; quote options show the next free letters`.

### Task 8: Include checkboxes and hub quote options / shared hub basket

**Files:**
- Modify: `src/CompareTab.jsx` (checkbox label ~475-480, `toggle`, footer)
- Modify: `src/AppsWorkspace.jsx` (basket state ~24-56, `requestCommit`/`commitTo` ~78-91, popup mounts ~143-182)
- Modify: `src/App.jsx` (hub `wedi`/`schluter` destination bags ~2832-2853)

**Interfaces:**
- CompareTab: the checkbox renders always, labeled `Include`. Its title is `include in the print and quote options` when `onQuoteOptions`, else `include in the print`. The default checked set is unchanged (`[hostKey, opposite(hostKey)]`).
- Destination bags gain `addOptionsToCurrent(payload)` → `compareOptionsPatch(sel, null, payload)` + `updateProject` + close pane, and `addOptionsToNew(payload)` → a new quick project whose `categories` are the option areas. Reuse `createQuickWithSheoga`'s creation path: add a sibling `createQuickWithAreas(categories, optionNames)`, or extend it with an options arg.
- AppsWorkspace:
  - one `showerBasket` state; `basketOf.wedi` and `basketOf.schluter` both read it, and `setBasketFor.wedi/schluter` both set it;
  - `requestCommit(destKey, dest, payload, nextBasket, kind = "lines")`, where `commitTo` calls `addToCurrent/addToNew` for `"lines"` and `addOptionsToCurrent/addOptionsToNew` for `"options"`;
  - both popups get `onQuoteOptions={(p) => requestCommit(k, dest, p, undefined, "options")}` and `onAddOptions={(options, next) => requestCommit(k, dest, { options, label: "Shower" }, next, "options")}`.

- [ ] **Step 1:** Add a CompareTab label/title change test hook: `data-cmp-check` stays, so existing selectors hold. Implement.
- [ ] **Step 2:** AppsWorkspace and App bag changes as above.
- [ ] **Step 3:** Run `npm test && npm run lint && npm run build`. Expected: pass.
- [ ] **Step 4:** Preview check: the hub Compare (the Apps harness if there is one, else `wedi-preview.html` with `onQuoteOptions` omitted) shows the Include boxes. Screenshot.
- [ ] **Step 5:** Commit `feat(compare): Include checks everywhere; hub quote options through the destination prompt`.

### Task 9: Print Compare

**Files:**
- Create: `src/compareprint.jsx` (the print sheet component + its CSS string; imported only by `CompareTab.jsx`, so it lives in the same lazy chunk)
- Modify: `src/CompareTab.jsx` (footer Print button; `printing` state + afterprint unmount, mirroring `WediConfigurator.jsx` ~843-855; new `projectName` prop)
- Modify: both popups' CompareTab mount (pass `projectName`)
- Test: `src/compareprint.test.js` (pure helper only)

**Interfaces:**
- Produces: `printColumns(cells: Cell[], checked: string[], missOf) => Cell[]`. The checked cells with no miss, in `CELLS` order. Exported from `compareprint.jsx`'s sibling pure module `src/compareprintcols.js`, so `node --test` can import it without JSX.
- Produces: `<ComparePrintSheet cols projectName areaName roomText tierLabel layout amtOf />`, portalled into `document.body` as `.cmp-printsheet`.
  - `layout` = `compareLayout` over just the printed columns.
  - `tierLabel` is `""` at Retail, else e.g. "Builder pricing".

- [ ] **Step 1: Write failing tests** in `src/compareprint.test.js`:
  - `printColumns keeps checked in column order`: checked `["schluter:membrane","wedi:board"]` → keys `["wedi:board","schluter:membrane"]`.
  - `printColumns drops missing columns`: a checked cell whose `missOf` is truthy is absent; all missing → `[]`.
- [ ] **Step 2:** Run `node --test src/compareprint.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement `compareprintcols.js` and `ComparePrintSheet`. The sheet is a `<table>`:
  - `<thead>`: brand + system + total per column (repeats per page);
  - per group, a band row, then per slot a row with each column's lines (Qty · Size + item via `kitLabel` · Price via `amtOf`);
  - note-only lines in italics without a price; placeholder/plus rows as "—";
  - a totals row.
  - CSS: `.cmp-printsheet{display:none}` plus `@media print{ body > *:not(.cmp-printsheet){display:none !important} .cmp-printsheet{display:block} … tr{break-inside:avoid} }`, and `@page{size:landscape}` only when `cols.length > 2` (a separate `<style>` emitted conditionally).
  - Black-on-white brand badges. No part numbers, pills, flags, "vs current" or cost.
- [ ] **Step 4:** Add the footer Print button (Printer icon, `data-cmp-print`). It is disabled with title `Check the columns to print` when `printColumns(...)` is empty. The footer always renders.
- [ ] **Step 5:** Run `npm test && npm run lint && npm run build`. Expected: pass.
- [ ] **Step 6:** Preview proof. In `wedi-preview.html` Compare, use Playwright `page.emulateMedia({ media: "print" })` with the sheet mounted (set `printing` via clicking Print with `window.print` stubbed to a no-op). Take full-page screenshots with 2 columns checked and with 4 columns checked, and a `page.pdf()` to confirm landscape vs portrait.
- [ ] **Step 7:** Commit `feat(compare): print the checked columns as a customer sheet`.

### Task 10: Docs and final verification

**Files:**
- Modify: `src/CLAUDE.md` (annotate `basketkit.js`, `ShowerBasket.jsx`, `wedikitview.js`, `schluterkitview.js`, `compareprint.jsx`, `compareprintcols.js`; update the `CompareTab.jsx`, `WediConfigurator.jsx`, `SchluterConfigurator.jsx`, `AppsWorkspace.jsx`, `KitBasketPanel`, `options.js` and `model.js` notes that mention the two baskets or A-first letters)
- Modify: `docs/adr/0052-compare-set.md`: an amendment for + Basket, Include, print, and next-free letters.

- [ ] **Step 1:** Update the docs above. Grep `src/CLAUDE.md` and `CLAUDE.md` for `wediBasket|schluterBasket|options A` and fix each hit.
- [ ] **Step 2:** Run `npm test && npm run lint && npm run build`. Expected: all green. Paste the summary lines.
- [ ] **Step 3:** Commit `docs: shared shower basket, Compare basket/print`. Push `git push -u origin claude/eloquent-allen-d7yaqk`.
- [ ] **Step 4:** Send the owner the preview screenshots from Tasks 5, 7, 8 and 9 (SendUserFile). Open a PR only if the owner asks for one.
