# src/ — file map

Every file under `src/`, annotated with the design rationale, ADR references, and
failure contracts that the code alone does not explain. This file loads when Claude
works with files under `src/`; the repo-wide orientation lives in the root
`CLAUDE.md`, and the stored record shapes live in the `floortrack-data-model` skill.

```
src/
  main.jsx          # React entry (+ Supabase preconnect link, ADR 0026)
  Root.jsx          # Supabase config check + auth session gate
  bootload.js       # boot loaders + row mappers, client injected as a required
                    # param (ADR 0026) — must never import lib/supabase.js so
                    # node --test can drive them with a fake builder. Both
                    # LIST_SELECTs project `erp:data->erpOrders` (ADR 0044)
                    # onto the light row's `erpNos`
  boottrace.js      # boot timing spans; every boot writes ft-boot-trace to
                    # localStorage, dev builds console.table it (ADR 0026)
  Auth.jsx          # sign-in screen (sign-up disabled by design)
  App.jsx           # the FloorTrack application (props: { user, onSignOut }) —
                    # the split files below carry its extracted pieces.
                    # Boot-chunk hygiene (ADR 0026): it may import options.js
                    # (`compareOptionsPatch` — model.js only) but NEVER
                    # comparekit.js or CompareTab.jsx; the Compare tab reaches
                    # it only through each popup's own React.lazy boundary.
                    # `addCompareOptions(aid, payload)` is the landing —
                    # ONE `updateProject` with compareOptionsPatch's single
                    # patch, wired as `onQuoteOptions` on both job-context
                    # vendor mounts. The Apps-hub bags carry their own pair:
                    # `addOptionsToCurrent` (compareOptionsPatch with no host
                    # area; a null patch pings "Only K option letters left —
                    # uncheck some" and returns false) and `addOptionsToNew`
                    # (a quick project whose areas are the options, via
                    # `createQuickFrom`, the creation path
                    # `createQuickWithSheoga` shares).
                    # The Compare set (ADR 0052): both job-context shower
                    # mounts get `compareSet` (the area's), `onCompareSet` →
                    # `writeCompareSet(pid, aid, next)` (merges onto
                    # dataRef's LATEST record — a popup saves as it unmounts,
                    # often in the tick its own Add wrote categories),
                    # `onOpenCell` → `openCompareCell` (closes one brand's
                    # popup, opens the other's; same brand re-seeds), and
                    # `onResume`, both through `kitPop`: reattach to a kept
                    # build's `target` row while it lives, else stay on the
                    # popup's row, `detached` when that row already holds a
                    # configurator kit so Add appends rather than writing one
                    # brand over another.
                    # `cleanCards` (isWide && either Clean layout, 2026-09-27)
                    # swaps the area frame for Clean's cards (the regular
                    # slate-200 card border): one slim tan bar
                    # per area carrying name · column labels · subtotal · ⋯
                    # (⋯ = the area menu + "Delete area…", hover-only grip);
                    # an option area washes the bar in its option color with
                    # the slot letter at the far left. On product lines, a
                    # line with content swaps its type chip for the extras +
                    # (type moves to LineMenu's `onType`), and the empty
                    # "＋ Extras" strip is dropped.
                    # Phone (!isWide, spec 2026-10-02): no area cards — each
                    # area is a 17px sticky `data-area-title` line (name in
                    # small caps, option chip, subtotal, ⋯ → area menu with
                    # Delete area…) over full-bleed lines; holding the line
                    # (not the input/buttons) drags the area. The wrapper
                    # carries no overflow-hidden on the phone — it would stop
                    # the sticky title. MobileProductRow wears a type dot
  uiconst.js        # shared UI constants: TYPES/TLBL (incl. `underlayment`, ADR 0043), tier colors/labels,
                    # joints/thicknesses, grout color lists, sweep/keep constants,
                    # stock-loading messages, `skuSearchable`, `colorsFor`
  units.js          # the sell-unit vocabulary (2026-07-25): `unitCode` (RL/Rolls/
                    # roll → "RL"), `unitNoun` (3, "rl" → "rolls"), `isRollUnit`.
                    # One table so a unit reads the same in the grid, the print,
                    # and the order panel; a unit the table doesn't know falls
                    # through as the vendor's own code rather than a wrong "EA".
                    # `isMeasureUnit`/`bundleUnit` (2026-08-31) hold the other
                    # half: SF/LF/SY MEASURE material, they never bundle it, so
                    # a book whose one U/M column is its price basis can't name
                    # the carton a coverage counts — read through bundleUnit
                    # (stockPatch at the pick, getCarton/getPieceCarton on the
                    # row, so lines saved before the rule heal on read).
                    # `BUNDLE_UNITS`/`COUNT_UNITS` (issue 138) are what a
                    # hand-typed row's UnitPick offers (units.test.js)
  costentry.js      # hand-entered cost on a product row (2026-07-26): the price
                    # cell's cost → markup → price popup. `MARKUP_PRESETS`
                    # (30/50/100) seeds `settings.pricing.quickMarkups`, which
                    # the team tunes in Settings → Price book — `normQuickMarkups`
                    # is what normPricing stores and the popup reads;
                    # `priceFromCost`/`markupFromPrice`/`unitMargin`,
                    # and the three patch builders `editCost`/`editMarkup`/
                    # `editPrice` — which write the SAME costSqft/markupPct a
                    # price-book pick snapshots, so a hand-costed line and a
                    # picked one read alike to the Employee tier, the internal
                    # margin and `orderLineCost` (costentry.test.js)
  freight.js        # vendor freight programs (ADR 0030): the rate table a book
                    # carries in `data.freight` (normFreight) and the rules that
                    # turn a job's rows into a charge. Every rule on a freight
                    # sheet is scoped to an ORDER — a minimum, a dollar threshold
                    # that flips the shipment onto pallets, a per-piece floor —
                    # so a row's chip is only an OPT-IN and `freightList` charges
                    # each book ONCE over the rows that opted in (the attachedList
                    # shape). Rates read LIVE at calc time, not snapshotted:
                    # freight follows the job's footage as it's edited, and a
                    # retyped sheet is the team restating what shipping costs, not
                    # a vendor re-import (freight.test.js)
  freightui.jsx     # the drawer row + the header master switch, presentation only
  model.js          # job-model factories + normalizers: `uid`/`money`, `newProduct`/
                    # `newArea`/`newProject`, `normP`/`normA`/`normC`, `catSig`,
                    # `rowBlank`, `personData`… (model.test.js, their first tests)
                    # + the configurator kit landing (ADR 0035): `stampKit`
                    # (one shared kitId per emission, idempotent) and
                    # `landKitLines` — the one rule all three configurators'
                    # Adds land through (App.jsx addSheogaLines): anchor filled
                    # in place, companions inserted after it, the OLD kit's
                    # companions removed by kitId group (refused when the group
                    # holds another cfg-bearing row — a Sheoga bundle sibling
                    # or duplicated anchor is never deleted by editing its
                    # neighbor — except by the bundle's OWN anchor: ownsGroup,
                    # it takes the whole group), legacy kitId-less anchors
                    # falling back to the contiguous same-vendor companion run
                    # below the anchor;
                    # removeKitLines (a placed kit's delete — anchor + the
                    # same companion set), kitRows (the rows a placed kit IS
                    # — anchor + that same set, what Reconfigure reads so a
                    # sheet-typed qty reopens as the override; a searched-in
                    # row has no marker/kitId so it never folds into a
                    # neighbouring shower) and placedKits (the derived
                    # in-this-project list — a stamped bundle's siblings fold
                    # under their anchor, legacy widths list singly)
                    # ; appendKitLines (a kit's lines as fresh rows at the
                    # end of an area — its own kitId per call);
                    # landOrAppendKit (the Sheoga popup's Add/Move landing,
                    # App.jsx addSheogaLines: a Sheoga trim kit lands in
                    # place only on a blank row or a trim anchor, and
                    # appends to the area off any other vendor row — a
                    # floor's Reconfigure → Trim tab never overwrites the
                    # floor; every other kit goes through landKitLines) and
                    # moveKitEntries (the basket "Move" landing, ADR 0035
                    # amendment 2026-09-01): staged entries land in ONE pass
                    # over the accumulating categories, a TARGETED entry
                    # replacing that kit through landKitLines while the rest
                    # append — returns { categories, stranded }, stranded
                    # counting targets that no longer point at the kit that was
                    # staged (row gone, or now another kit's), which append
                    # instead, because clobbering whatever took the row's place
                    # is worse than a duplicate the salesperson can see
                    # ; normKitBasketEntry(e, brand?) — the wedi/Schluter staged
                    # basket entry (ADR 0035 step 3), engine-free on purpose:
                    # model.js must never import wedi.js/schluter.js. It is
                    # brand-tagged and kept in the one project.showerBasket
                    # (ADR 0035 amendment 2026-09-29): a valid e.brand wins,
                    # else the argument, else null. normC merges legacy
                    # wediBasket/schluterBasket by addedAt and drops those
                    # keys. snap = the reconfigure marker, plus the optional `target`
                    # {areaId, rowId, kitId} an entry staged from a reconfigure
                    # carries (normKitTarget — both ids or nothing; kitId is
                    # the move-time staleness check)
                    # ; `normC` now carries `erpOrders`/`erpKeyed` (ADR 0044,
                    # normalized by src/erporders.js)
  print.js          # print/order math: `printProduct`, `orderLineCost`, `lineTotal`,
                    # `printAreaFloor`, `areaPrintLabel`, `orderEntryRow`,
                    # `ESTIMATE_PRINT_LAYOUT`… (print.test.js). Each
                    # printProduct mat carries `noCost` (priced, no cost) so
                    # the extras strip can say why Employee left it at retail.
                    # `printMatList` prices each material's JOB order (exact
                    # needs summed, rounded up once) × price (ADR 0053) and
                    # carries the grout color's `bookId`;
                    # `ESTIMATE_PRINT_LAYOUT` is "columns" (2026-09-30)
  printcols.js      # the material-columns sheet's pure half (spec 2026-09-30,
                    # owner pick G3c): `specSize`/`specParts`/`specLine` (tile
                    # thickness never prints, × tightened, SF/ct kept; the
                    # parts are separate so the sheet can keep "SKU n" on one
                    # line), `brandRow` (ADR 0054: a row carrying a wedi or
                    # Schluter marker → `{lead: "size name", tail: "SKU n" |
                    # the marker's vendor part number}`; null for any other
                    # row, however wedi-looking its text), `qtyCells`/
                    # `priceCells` (ct over SF, $/sf over $/ct), `COLS` +
                    # `matColumn`/`lineCells`/`columnsUsed` (Grout · Adhesive ·
                    # Underlay · Other — mortar reads "Adhesive" in the columns
                    # and the job list, issue 164; caulk and install items
                    # print only in the list, and a column no line uses never
                    # prints), `fitColumns`/`twoLineWidth`/`FIT` (each column
                    # sized so its materials wrap to two lines, clamped per
                    # column and capped for the strip — the sheet measures
                    # with a canvas, issue 164), `stripRuled` (the material
                    # rule spans the whole strip only when some column has a
                    # material above or below it),
                    # `needText` (exact, one decimal, the catalog's own unit
                    # word), `gridSpec` (the pricing-mode column set: the
                    # product block's own `left` grid beside the material
                    # columns as ONE strip of `matsW`, so their boxes butt and
                    # butt — issue 163), `cellParts` (a material cell's amount
                    # and unit apart, grout's color · joint as `sub`),
                    # `loneUnnamedArea` (a quote whose one printed area was
                    # never named prints no area header) and
                    # `jobListGroups` (the job order list's groups and rows)
                    # (printcols.test.js)
  options.js        # quote options (ADR 0031): fixed slots A–L (letters live in
                    # model.js, re-exported here; A–C → A–F 2026-08-19, → A–L
                    # 2026-08-26) + the ONE shared option tint (per-slot colors
                    # retired with the A–L extension — the letter is the
                    # identity; OPTION_COLOR keeps its per-slot map shape),
                    # shared/option scoping (bucketCats/scopedCats),
                    # titles, duplicateInto — an option is a TAG on an area,
                    # never a copy of the job. `compareOptionsPatch` (phase 5,
                    # ADR 0034; N options since ticket 158 Phase 3) is the
                    # Compare tab's ONE-PATCH landing: `(project, hostAreaId,
                    # {options: [{lines, name}], label})` — fresh sibling
                    # areas, up to the free letters (`{...newArea(), …}`,
                    # never duplicateInto's shared-source retag — these
                    # aren't copies of shared work) tagged with the job's
                    # next free letters (`nextFreeSlots(cats, n)` — gaps
                    # first; null when fewer than n are left, so the patch
                    # is null too) in the given order (the grid's
                    # reading order, checked cells only, packed — comparegrid.js
                    # decides that order, this file just letters what it's
                    # handed), inserted right after the host area (append if
                    # its id is gone), each `lines.map(p => ({...newProduct(),
                    # ...p}))` plus a trailing blank adder row; `optionNames`
                    # fills empty slots only from each option's own `name`
                    # ("wedi · S-DRY membrane"), never over a custom name;
                    # null when `options` is empty, longer than the free
                    # letters left, or ANY option's lines array is empty. The old
                    # `{wediLines, schluterLines}` shape still works, read as
                    # the N=2 case `[{lines: wediLines, name: "wedi"},
                    # {lines: schluterLines, name: "Schluter"}]` — that
                    # shape's payload is byte-identical (Phase 3 plan ruling
                    # 1), but CompareTab now sends cell names, so a two-cell
                    # send lands "Shower — wedi · S-DRY membrane" where it
                    # used to land "Shower — wedi". Returns the patch object for the
                    # caller's single `updateProject` call — usedirectory's
                    # setter is built off a stale closure, so two calls in one
                    # tick would clobber each other (options.test.js).
                    # `lettersLeft(k, fix)` is the one "Only K option
                    # letter(s) left — <fix>" string (basket: "select fewer",
                    # Compare: "uncheck some")
  jobtotals.js      # the job's money math, extracted from App.jsx so it runs per
                    # option scope: one filtered project in, every aggregate out
                    # (totals, gList/mList/…, matAll, pMats, freight, margin).
                    # Whole-job = shared bucket + option bucket (additive on paper);
                    # order entry re-runs the UNION so freight minimums stay exact
                    # (jobtotals.test.js). An underlayment row bills its sheets,
                    # never re-counts floor sq ft (ADR 0043). Grout, mortar and
                    # underlayment cost their JOB order × price (ADR 0053) —
                    # the gList/mList/uList costs, never each row's own
                    # rounded amount summed
  fileread.js       # `readXlsxSheets`/`readPdfPages` — lazy `import("xlsx")`/
                    # `import("pdfjs-dist")` preserved
  widgets.jsx       # shared widgets: `Modal`, `SideDock` (the order entry /
                    # Samples drawer; its edge tab flips it left⇄right, saved
                    # per user as ui.dockSide), `LazyBoundary`, `FitSelect`, `DotMenu`,
                    # anchored-panel machinery, `ThemeSwitch`, popovers, bars,
                    # `HelpTip` (the hover/focus/tap ? for STANDING RULES only —
                    # state & warnings stay inline, hiding them hides the problem),
                    # and the vendor configurators' one-row header set (owner
                    # 2026-09-24, app-header-options.html): `FLAT_BTN` (flat on
                    # the header's own fill, hover tint only), `SourceSwitch` —
                    # the shared Stock only checkbox (unchecked = Full catalog;
                    # phase 4, so the popups can't drift; no engine knowledge,
                    # each popup owns what the source constrains) —
                    # `PriceLevelMenu` (names the level, Custom its discount
                    # alone; slides open inside a growing dark border, on the
                    # Esc ladder) and `BasketButton` (icon + count badge).
                    # `MorphSelect` (ADR 0048) — the one pick-one dropdown,
                    # the price menu's look: the open box is the trigger
                    # grown, portalled at the trigger's spot and zoom, with a
                    # <select>'s keyboard contract; `PriceLevelMenu` and the
                    # phone band's price/print picks run on it. `DotMenu`
                    # wears `.ft-pop` (index.css), the shared panel shell;
                    # `useDismissOutside` is the outside-press/focus-out rule
                    # `useAnchoredPanel` and `MorphSelect` share.
                    # `FitSelect` keeps the <select> call shape (<option>/
                    # <optgroup> children, onChange(e) → e.target.value) over a
                    # MorphSelect — the materials drawer's dropdowns read as
                    # before; `GroutColorOptions` children are expanded inline.
                    # `SearchPop` — every search field's results box (grid
                    # search + product cell, the Settings book searches,
                    # builder/address/label-SKU lookups): one outline around
                    # field + results, the top row see-through so typing stays
                    # in the real field; useAnchoredPanel's pos carries the
                    # field rect (ft/fb/h) it needs. Its field wears
                    # `.ft-search` (ink focus line, not the moss ring); the box
                    # mounts field-sized and grows like MorphSelect, and on
                    # unmount an inert DOM clone plays the fold (foldAway).
                    # Speeds: --ft-spop-in / --ft-spop-out (index.css).
                    # The anchor may be a plain button or cell (type chip,
                    # order cell, ⋯ cell): `lead`/`trail` fill its row, the
                    # outline fades in. `PointPop` — `.ft-pop` at a point
                    # (right-click menus) that folds away on unmount.
                    # `PopMenu` — an option menu that grows from `at.anchor`
                    # or opens at `at.x/y` (customer + area menus).
                    # Row order: Stock only · Clear design | price · basket · X.
                    # `KitOverwriteConfirm` (2026-09-02, ADR 0035 amendment) —
                    # the kit-card confirm both popups raise over customized
                    # work: Overwrite · Keep what I added · New shower ·
                    # Cancel (an optional `copy` prop rewords it for other
                    # moments, e.g. the wedi wall-system switch), one component for the same no-drift reason; the
                    # callers own what each answer does to their state.
                    # `NumIn` (round 6) — the commit-on-blur/Enter number field
                    # both vendor configurators mount (moved out of
                    # WediConfigurator.jsx): whole builds re-solve off these,
                    # and a half-typed "4" of "48" is not a room, and
                    # KitBasketPanel — the shared wedi/Schluter basket drawer
                    # shell (ADR 0035 step 3, presentation-only view rows: the
                    # two popups can't drift on the drawer either); a row's
                    # `brand` draws the wedi/Schluter badge, `onAddOptions`
                    # adds the footer's "Add N as options" (ShowerBasket.jsx
                    # feeds it)
  dropdown.js       # MorphSelect's pure half (ADR 0048): `flatten` (grouped
                    # rows → one walkable list + heading positions),
                    # `moveIndex`/`edgeIndex` (skip disabled, wrap),
                    # `typeahead` (first-letter jump, cycling), `placeMorph`
                    # (over the trigger, flip up when short of room, lengths
                    # ÷ the trigger's zoom) (dropdown.test.js)
  search.jsx        # price-book search suite: `SkuPicker`, `StockSearch`,
                    # `FamilySearch`, hit rows, merged-results hooks
                    # (useMergedResults hands rankMerged the WHOLE stock
                    # cache as its twin index, not just the matches)
  grid.jsx          # selection-grid cells: `TypeSelect`, `GridPriceCell`
                    # (its cost & markup popup is the price cell grown on
                    # SearchPop's `lead` slot: cost left of the live price
                    # cell, presets 2×2 below; Tab cost → price → out),
                    # `GridSizeInput`, `GridProductBox`, `GridOmniSearch`,
                    # `UnitPick` (issue 138) — the SF/CT · PC/CT · EA tag as a
                    # select writing the row's cartonUnit / sellUnit, shared
                    # with mobile.jsx; a manual row had no way to say "sheet"
  mobile.jsx        # mobile sheets: `MobileSheet`, `MobileSearchSheet` (thumb-
                    # first, owner 2026-10-03: the field sits at the bottom on
                    # the keyboard and results stack UP from it, best match
                    # nearest — a flex-col-reverse list; vendor rows and
                    # messages sit nearest the field; ticket 171),
                    # `MobileProductRow`, `MobileRowSheet` + `MobileProjectHeader`
                    # (phone Clean layout, spec 2026-10-02, owner pick from
                    # .scratch/mockups/mobile-clean-options-2026-10-02.html —
                    # it replaced the 2026-09-15 Fold 5 band for EVERY phone
                    # user, whatever their Settings header): desktop Clean's
                    # header A at 344px, mounted by App in the phone top-bar
                    # slot so it stays pinned above <main>. Customer headline
                    # (Unassigned / Quick price in amber → File under customer)
                    # + salesperson; the project line (name · N · ErpChip ·
                    # phonehead.js `shownAddress`) opens the ⋯ sheet; the bar is
                    # PriceLevelMenu · All $ ▾ · FreightToggle compact · samples ·
                    # ⋯ · the total (`phoneTotal` — "N options" with quote
                    # options, opening ⋯). Waste lives only in the ⋯ sheet, so
                    # the total fits. Versions, files, save, order sheet, Email
                    # and Print live only in the ⋯ sheet (owner call); the phone
                    # has no Edit / Print preview tabs. `useKeyboardInset` is
                    # the visualViewport keyboard gap MobileSheet's footer and
                    # the search sheet's bottom field both lift by
  installers.js     # installers (spec 2026-10-03, ADR 0057), pure and
                    # import-free (model.js and catalog.js import it):
                    # INSTALL_TRADES tile/hard/carpet — hardwood, vinyl and
                    # laminate roll up to Hard Surface (`tradeOfType`);
                    # `normInstaller(s)` (the settings directory, priority
                    # clamped 1–10, default 5), `normProjInstallers` (the job's
                    # contact snapshots), `jobTrades(cats, rowBlank)` (derived,
                    # never stored), `rankInstallers` (whole job → part, more
                    # of the job first → none, priority inside each),
                    # `toggleProjInstaller`, `entryTradesOnJob` (what prints),
                    # `uncoveredTrades` (installers.test.js)
  installersui.jsx  # `InstallersSettings` (Settings → General → Installers:
                    # list + detail on one 520px grid; text commits on blur,
                    # trades/priority on click), `InstallerButton` +
                    # `InstallerPicker` (the header hammer, a SearchPop; a
                    # click adds/removes at once) and `InstallerBox` (beside
                    # the areas — App.jsx mounts it only when <main> fits the
                    # 896 column + 12 + 240, centering the pair; hidden
                    # narrower). Proof: .scratch/172_installers
  phonehead.js      # the phone header's derived text, pure (phonehead.test.js):
                    # `phoneTotal(grandTotal, optionCount)` and
                    # `shownAddress(sel, cust)` — the desktop Clean address rule
  projectheader.jsx # the desktop project header, three layouts behind a PER-USER
                    # switch (Settings → General, saved as ui.header through
                    # saveUiPref; localStorage "ft-header" only until a user
                    # picks): `ProjectHeaderBar` (the 2026-07-21 one-bar),
                    # `ProjectHeaderClassic` (the print-sheet original, kept
                    # whole so the team can flip back without a revert) and
                    # `ProjectHeaderClean` (2026-09-27, the default
                    # since 2026-10-02 for anyone who hasn't picked,
                    # .scratch/159_clean-editor), two choices: "clean" (tall:
                    # 30px customer headline over the project line, then the
                    # bar) and "cleancompact" (`compact`: two rows sized to the
                    # rail logo block, pinned by App in a sticky band whose
                    # bottom line continues the logo's — rail height measured
                    # with a ResizeObserver). Both share the pieces and the
                    # area cards. Row 1: customer · project (name · N ·
                    # ERP chip · address · notes — the address is the project's when set,
                    # else the customer's, which opens the customer; the
                    # project address edits in an AddressField popover from
                    # the line or ⋯) … the salesperson's name (no total — the
                    # Order summary has it). Row 2: the flat bar —
                    # PriceLevelMenu, a MorphSelect for
                    # Estimate shows, a waste popover over WasteBar, the freight
                    # truck (quiet when on, amber "No freight" when off), the
                    # page icon that IS the Edit ⇄ Print preview switch (App
                    # hides its tabs; the pinned band stays up in both),
                    # files, samples, a ⋯
                    # DotMenu (Project address / Versions / Save a named version /
                    # Delete), and
                    # the Order entry button carrying the ERP number — green
                    # with a check once erporders.js `erpStatus` says every
                    # line is keyed, an "N left" pill before that. No order
                    # sheet button in Clean. An Email icon sits right after the
                    # Samples icon (`onEmail`, ADR 0055; Clean only).
                    # The installers hammer (`installers` bag → InstallerButton,
                    # spec 2026-10-03) sits after Samples in all three layouts.
                    # Exported `ErpChip` (ADR 0044, `ERP 48213` · `+N`) mounts
                    # in both layouts (opens order entry) and is imported by
                    # mobile.jsx for the phone header (static there).
                    # `FreightToggle` is exported for the phone header too —
                    # `compact` reads off as the amber struck truck alone
  TeamTodos.jsx     # the Issues & To-Do modal: the team list (issue 006,
                    # unchanged) behind a tab strip beside the central Claude
                    # issue bucket (issue 087) — every "Flag for Claude" from
                    # anywhere lands on the Claude tab, each card wearing its
                    # source (job line / price book / general), with one
                    # Copy-report action (claudeissues.js issueReport)
  claudeissues.js   # central Claude issues pure logic (issue 087): the stored
                    # issue shape (normClaudeIssue), the source builders every
                    # flag point uses (jobSource/bookSource — snapshot at flag
                    # time + live ids, so the report survives edits/deletes),
                    # sourceLines for the popover's captured-context box, and
                    # issueReport — the per-book copy report generalized across
                    # the whole bucket (claudeissues.test.js)
  useclaudeissues.js  # `useClaudeIssues` — central Claude issue write paths
                    # (issue 087): add/update/toggle/del/clearDone, shaped like
                    # useTodos (shared rows, optimistic, claude-issues.sql)
  usesamples.js     # `useSamples` — sample_requests write paths (spec
                    # 2026-08-28), shaped like useClaudeIssues: shared rows,
                    # optimistic local update, one write per action.
                    # `addSampleRequest`/`delSampleRequest` and
                    # `setSampleOrdered(ids, ordered)` — an ID LIST so
                    # "Mark all ordered" is one upsert, not a write per row;
                    # stamps orderedBy/orderedAt (or clears them on undo).
                    # `refreshSampleRequests` re-runs `loadSampleRequests`
                    # (bootload.js) for the Customers-button/Samples-panel
                    # open refresh, on top of the table's own stage-2
                    # background hydrate (ADR 0026, alongside todos/claude
                    # issues)
  claudeflag.jsx    # `ClaudeMark` (the rays, moved out of pricebooklib) +
                    # `FlagForClaude` — the ONE flag popover every surface
                    # opens with a prebuilt source: captured-context box,
                    # quick-reason chips, optional note; CLAUDE_CLAY (#D97757)
                    # is the one non-theme color, marking everything Claude
  linemenu.jsx      # `LineMenu` — the product line's action menu (issue 087,
                    # Clean layout: a "Type" item on top when `onType` is passed),
                    # owner "option A" 2026-08-13): opened by a plain CLICK on
                    # the row-end ⋯ (a HOLD on the same button drags — the dots
                    # are the row's one grip; no tip line, the grab cursor is
                    # the affordance) or a right-click on the row (suppressed
                    # inside fields so native paste keeps working). Duplicate /
                    # Add note ("Edit note" once one exists — issue 131: the
                    # ONE per-line `note`, the same box the extras strip shows;
                    # App.jsx `noteOpen` reveals + focuses it before any text
                    # exists, so a misc line — which has no extras drawer to
                    # reach it through — gets a note too; a box blurred empty
                    # hides again) /
                    # Move to area (inline expand, no floating submenu) /
                    # Request sample (spec 2026-08-28 — toggles a shared
                    # sample_requests row for this line, see samples.js) /
                    # Waste… (sq ft lines only, ADR 0046 — opens LineWastePop) / Flag
                    # for Claude / Delete (routes to the existing inline
                    # confirm). The old hand + trash hover icons are retired on
                    # product rows; the empty search-row adder wears the same ⋯
                    # dots (drag-only grip — no menu) and keeps its trash
  linewaste.jsx     # per-line waste (ADR 0046): `wasteTag` (the Order cell's
                    # second line — grey job rate, moss own rate, null when
                    # no waste; taking a line to 0% drops its hand-set carton
                    # count through catalog.js `wastePatch`), `LineWasteControl` (Job rate / None / Custom,
                    # mounted inline in the phone row sheet) and `LineWastePop`
                    # (the same control anchored off the tag or the line
                    # menu's Waste…). Writes only through the caller's
                    # updProduct patch
  claudeissuespreview.jsx  # dev-only harness (claude-issues-preview.html): the
                    # REAL TeamTodos tabs + LineMenu + FlagForClaude over local
                    # mock state, no Supabase; not part of the app build
  headerpreview.jsx # dev-only harness (header-preview.html): the REAL
                    # ProjectHeaderBar + PriceBookLibrary over local mock state,
                    # no Supabase — preview proof for the 2026-08-14 compact
                    # headers (+ three live Clean-header states, 2026-09-27)
                    # and the book page's config drawers (stateful
                    # updateBook + a mock Glazzio book with items, so the
                    # markup/freight/brand tabs save-and-rerender) + the
                    # MobileProjectHeader in a 344px frame (phone Clean layout,
                    # spec 2026-10-02); not part of the app build
  importpreview.jsx # dev-only harness (import-preview.html): the REAL
                    # BookImportWizard over local mock state, no Supabase —
                    # preview proof for the diff review's unfolding new/changed/
                    # retiring lists + per-line Flag for Claude (2026-08-17);
                    # `?somerset` feeds the real Somerset sheet's pages through
                    # the wizard's PDF path as a new book;
                    # `?keim` drops Keim's real wedi sheet onto the wedi stock
                    # snapshot (the price-update mode, ticket 158 P0-6);
                    # not part of the app build
  orderentrypreview.jsx  # dev-only harness (order-entry-preview.html): the REAL
                    # OrderEntryPanel over rows built through the REAL
                    # orderEntryRow, no Supabase — preview proof for the
                    # 2026-08 job-line flag batch (.scratch/104: stock-SKU
                    # special-order rule, Sheoga lead kept, CT-only tag) and,
                    # since 2026-09-14 (.scratch/137), a three-area job that
                    # repeats SKUs — two wedi showers off the live catalog's
                    # stocked rows, a Daltile special in three rooms with one
                    # hand-edited sell, a quantity-less bullnose — so the
                    # merge/sort views have something to show;
                    # not part of the app build
  custbrowser.js    # customer-browser pure logic (issue 040): rows/filter/sort
                    # over the boot's light rows (custbrowser.test.js). No
                    # salesman bands (owner 2026-09-27): the Salesperson filter
                    # narrows one flat list kept in the chosen sort.
                    # `custSamples`/`filterBySamples` (spec 2026-08-28) roll a
                    # customer's projects up against the sample_requests tally
                    # Map (App's `projectSampleTally(sampleRequests)`) for the
                    # browser's samples column and filter.
                    # `stripOpenDefault`/`normPanelH`/`clampPanelH` + STRIP_H/
                    # LINES_H/PANEL_MIN (2026-09-01) are the two side panels'
                    # sizing rules: the strip opens WITH the browser (the quick
                    # prices are what it's opened for) unless a saved choice or
                    # an empty unfiled folder says otherwise, and a drag may
                    # never shrink a panel below one row or grow it past 60% of
                    # the overlay — the minimum outranking the maximum on a
                    # short window. `erpNos(projs)` + `erpHit` (ADR 0044) feed
                    # both `filterRows` and `unfiledRows`; `"erp"` joins
                    # BROWSER_COLS right after `"projno"`
  CustomerBrowser.jsx  # the customer browser, a `React.lazy` chunk (ADR 0026):
                    # ERP-style directory grid — one flat list of
                    # dense customer rows over a bottom project-lines panel —
                    # opened from the sidebar's Customers folder (issue 040) into
                    # the work area (ADR 0047 amendment: a railnav pane, not an
                    # overlay; back caret + X in its title row, no New customer
                    # button — the rail has one).
                    # Takes a `sampleTally` prop (App, `projectSampleTally`
                    # re-run on every sampleRequests change): a draggable
                    # Samples column (`sampleChips` — amber "N to order" +
                    # moss "M ordered", shared with the unfiled strips and the
                    # project-lines panel) and a Samples filter button
                    # (open = customer has any need>0) beside the salesperson
                    # box, over the same rows/strips it narrows.
                    # The Estimates & drafts strip and the project-lines panel
                    # are both DRAG-SIZED (2026-09-01): each carries a
                    # `ResizeHandle` on its open edge (pointer capture, so a
                    # fast drag can't outrun it; the start height measured off
                    # the live panel, so one still at its content-sized default
                    # resizes from where it actually is), and a double-click
                    # hands the panel back to that default. The strip also now
                    # opens BY DEFAULT at ~3 quick prices tall — the team comes
                    # here to check them, and the toggle still hides it. The
                    # toggle state and both heights ride `initialPanels` /
                    # `onPanels` up to App's `saveUiPref({ browserPanels })`,
                    # the same per-user `ui` blob as the column order; a
                    # committed size saves once per drag, on release. The ERP
                    # order column (ADR 0044) shows three numbers then +N; the
                    # lines panel tags each project's rows with a per-order
                    # `✓ 48213` chip
  EstimatePrint.jsx # `EstimatePaper` (+ `PRINT_DASH`) — the print/Preview-tab "paper", one
                    # component behind both call sites so they can never drift. STATIC import only:
                    # `window.print()` fires right after the print-mode render, so a `React.lazy`
                    # chunk here would still be loading and print a blank page.
                    # Selection-sheet masthead (2026-09-08, owner pick from
                    # .scratch/126), no footer; the SELECTIONS watermark that
                    # shipped with it was pulled the same day (owner).
                    # `EstimatePaper` hands off to EstimateColumns.jsx when
                    # ESTIMATE_PRINT_LAYOUT is "columns"; the cards and
                    # classic sheets stay intact as fallbacks
  EstimateColumns.jsx  # `EstimateColumnsPaper` — the material-columns selection
                    # sheet (spec 2026-09-30, ADR 0053): products left, one
                    # column per install material beside them with the exact
                    # amount each line needs, one priced job order list below
                    # (Needed · Order · Each · Total), same-size totals, and a
                    # ◆ special-order mark from orderentry.js's own classifiers
                    # (props `stockBookIds`/`stockSkus`, passed by App.jsx).
                    # Quote options: the shared list, then per option its rows
                    # and a compact list. Imported statically (same reason as
                    # EstimatePrint.jsx). Preview proof:
                    # .scratch/162_selection-sheet-columns.
                    # Issue 163 (owner 2026-10-01): the material strip reads
                    # lighter (thin rule, regular weight, amount first with its
                    # unit beneath, blank when there is no amount), open at the
                    # bottom and right; a product row's rule runs on to the
                    # first material divider (the gutter is padding); area bands
                    # sit flush on the grid above, their "Area Total" ends
                    # under the Total column and prints only on a multi-item
                    # area; a lone unnamed area prints no band and no "1 area
                    # selected". Proof: .scratch/163_selection-sheet-grid-options/proof
                    # ADR 0054 (2026-10-01): a brand row (`brandRow`) prints
                    # one dark `size name` line and a muted no-wrap tail
                    # ("SKU n" / the part number), no spec line; every other
                    # row keeps its spec line with the SKU part wrapped
                    # no-wrap. Proof: .scratch/165_shower-line-descriptions
                    # Installers (spec 2026-10-03, ADR 0057): a table after the
                    # totals when the job has any — Trade (stacked, this job's
                    # only) · Company · Contact · Phone · Email; no priority
  emailestimate.jsx # the Email estimate button's work (ADR 0055), a lazy chunk
                    # (modern-screenshot + jsPDF load on the first click): the
                    # Print paper rendered in an off-screen root, captured, and
                    # paged onto letter at the print margins, cut only between
                    # `break-inside: avoid` blocks. Inlines the Google Fonts
                    # Manrope files itself — the cross-origin stylesheet can't be
                    # read, and a fallback face wraps headings over the next line.
                    # Touch → share sheet (a refused share raises a one-tap Share
                    # button); else download + `mailto:`
  estimatemail.js   # what the email fills in: To (the customer's email or blank),
                    # subject "Selections - Customer - Project" (selection sheets
                    # with pricing, not estimates — owner), an EMPTY body, and the
                    # PDF name "Customer - Project Name.pdf" (estimatemail.test.js)
  sheethead.jsx     # `SheetHead` — the selection-sheet masthead + people row +
                    # job notes, shared by the cards and columns sheets
  usetoast.js       # `useToast` — toast/save-flash UI state (`ping`, `flashSaved`)
  usedirectory.js   # `useDirectory` — the project/people/builder directory: state, selection,
                    # and their write paths (`updateProject`/`addProject`/`setSettings`/`saveProfile`…);
                    # `migrateLegacyCustomers` (ADR 0004)
  usejobshowers.js  # `useJobShowers(categories)`: dynamic-imports showersf.js only
                    # when the job has a placed shower or a row with `sfParts`
                    # (ADR 0026).
  usebooks.js       # `useBooks` — price book registry state + write paths (ADR 0009): addBook/
                    # updateBook/confirmBook (the "still good" stamp — restarts the §8.3 stale
                    # clock via data.confirmed, never lastImport)/delBook/
                    # applyBookImport/reviewBookItemFlags/setBookItemsDisabled/
                    # setBookItemIssue (the Claude issue bucket — flagReview's contract:
                    # data jsonb, no edited stamp, carried across re-imports)
  usebookstock.js   # `useBookStock` — stock-kind registry books' items, a bounded cache
                    # background-loaded after the books metadata (ADR 0026); feeds the row
                    # search's instant stock tier, the grout family projection, the Settings
                    # picker, and link warnings (ADR 0027). The order-kind books a
                    # family's special-order source names (`familyBookIds`, ADR 0027
                    # amendment 2026-09-13) load beside it into `orderBookStock`,
                    # never into `bookStock` (a vendor list is not shop stock);
                    # `familyItems` is the union the family projection reads,
                    # `loadFamilyBook` the on-demand loader Settings' source dialog uses
  usetodos.js       # `useTodos` — team to-do/issue list state + write paths (issue 006);
                    # the central Claude bucket lives beside it in useclaudeissues.js
  uselabels.js      # `useLabels` — Label Generator label-set state (loaded
                    # when the Label Generator opens) + write paths; the bulk
                    # pair `updateLabelsBulk`/`delLabels` (spec 2026-09-25) is
                    # ONE upsert / ONE delete for a stock-book refresh or a
                    # template restyle, never a write per label.
                    # `saveLabelPreset` replaces in place, so an edited
                    # built-in keeps its spot; `saveLabelDropWords` writes the
                    # shared name drop list (both keep the other's key)
  useordersearch.js # `useOrderSearch` — fuzzy/synonym order-book search (ADR 0009 §6) + on-demand
                    # order-row drift fetch
  usetrims.js       # `useTrims` — session cache of a floor's trims (the ADR 0012
                    # `fits` relation read floor→trims), looked up by an exact key
                    # set across every active registry book: the row's SKU plus,
                    # for an ERP stock floor, its item's manufacturer codes
                    # (`vendorSkus`, the export's Supplier/Mfg Product Code columns;
                    # description-tail extraction only as a pre-column fallback) —
                    # fetched when a bookId row's materials drawer opens, cleared
                    # whole when an import applies
  trims.js          # trims-as-lines pure logic (2026-07-22 spec): seedTrimPlan/
                    # applyTrimPlan — the Trims popup mirrors the floor's existing trim
                    # rows, so reopening adjusts/removes instead of appending duplicates,
                    # and new picks insert directly below the floor — plus
                    # preferStockTrims: a live stock twin — matched on any of its
                    # exact keys (vendorKeys: SKU, the sheet's manufacturer-code
                    # columns, description-tail fallback; a shop-suffixed
                    # "589571E" matches its base, an ERP VN-marker code its bare
                    # Mannington color code "MPB770VN1" ↔ "MPB770") — outranks
                    # the special-order
                    # item (mergeSearch doctrine, exact equality only); and
                    # mergeTrimOptions: fits trims + the stock book's color-name
                    # tier (the shelf shows even when the vendor book lacks the
                    # piece — OneNose) + the OneNose MDF-fill companion, matched
                    # by name (trims.test.js)
  TrimsPopup.jsx    # the floor row's Trims popup, opened from the materials drawer's
                    # Trims row: a quantity per book-listed trim; Apply lands the picks
                    # as count-line product rows through the sanctioned pick patch
  useversions.js    # `useVersions` — saved/auto version write paths: insertVersion/loadVersion/
                    # delVersion/autoSnapshot
  vendorpanel.jsx   # the vendor-sheet board: `useVendorFetch`, `VendorFetchPage`,
                    # sign-in group cards, `StaleChip`/`FLAG_SEMANTICS`
  pricebooklib.jsx  # the price-book library (`PriceBookLibrary` + book detail,
                    # import wizard, stock items panel, markup editor — internal).
                    # The book page's config — source sheets + hand-added files,
                    # markup, freight, brand (BrandCard — the issue 092 brand
                    # box, order books only) — folds behind FOLDER TABS under a
                    # one-line title row (owner sketch 2026-08-07): each tab carries its
                    # live summary, one drawer opens at a time, and a book that
                    # needs attention starts open on the right tab (pending sheet
                    # review → Source, selling at cost → Markup).
                    # The book detail's item table reads in the PROJECT LINE's
                    # column order (Size/Type · Product/Color · SKU · Cov. ·
                    # Price), its Size/Cov./Price cells showing what a pick LANDS
                    # (bookRowPreview) with parse failures amber and every other
                    # stored field on a muted detail line; the ✳ button beside
                    # Edit parks a SKU in the Claude issue bucket (filter chip +
                    # paste-ready copy report for a Claude session).
                    # The import wizard's diff counts are buttons: each unfolds
                    # its bucket's rows (ImportDiffDetail) — a changed row says
                    # WHAT moved (changedFieldBits) — and every line has the
                    # shared Flag-for-Claude popover: the central issue lands at
                    # flag time (with the diff context in its snapshot), the
                    # book's item mark rides the apply as opts.claudeSkus since
                    # an added row doesn't exist to mark yet; a bundle carries
                    # earlier files' flags to the last file's apply.
                    # A Contacts tab (spec 2026-08-28, renamed + widened
                    # 2026-09-01, `ContactsCard`) sits last on EVERY book kind
                    # (not gated behind `isOrder` like Markup/Freight/Brand):
                    # the vendor's TWO contacts — the rep (book.data.rep
                    # {name, email}) and the sample-request address
                    # (book.data.sampleContact {name, email}) for vendors whose
                    # samples go to a company inbox rather than a person. One
                    # Save writes both slots. `sampleContactFor` (samples.js)
                    # picks which one the Samples panel emails; no salesperson
                    # info, samples ship straight to the customer. The rep
                    # slot also holds `phone` (2026-09-05, display only).
                    # A `vendor`-kind book (ADR 0040) routes to
                    # vendorbook.jsx's VendorBookPage instead of BookDetail;
                    # the New-book dialog offers "Sheoga (vendor)" until one
                    # exists, and the library's Sheoga-markup card turns into
                    # a link to that book while it does. A Sheoga accessory
                    # .xlsx dropped on the library routes past the item import
                    # (ImportRouter's SHEOGA_SHEET target) straight into that
                    # book's Price sheets review (pendingSheet state)
  SettingsWorkspace.jsx  # the Settings workspace, now a `React.lazy` chunk (ADR 0026);
                    # `MATERIAL_CATEGORIES` lives here. Shrink-to-fit (issue 084,
                    # the wedi popup's rig): drawn at SETTINGS_DESIGN_W (1240)
                    # and zoomed to the work-area pane's measured width, so a
                    # phone gets the whole layout smaller instead of the fixed
                    # columns eating the detail pane; the low ZOOM_FLOOR is a
                    # sub-phone backstop (owner: scale first, revert if the
                    # type gets too small), below which the pane scrolls.
                    # Renders in the work-area pane with a controlled
                    # `section` (ADR 0047) — no overlay shell or section menu;
                    # mounted with `key={section}`.
                    # General (spec 2026-10-03) is a category column like
                    # Materials: Waste · Shop address · Styles (header picker
                    # + Appearance) · Installers; `generalSub`/`onGeneralSub`
                    # remember the open one (App bumps the key's nonce for
                    # the hammer's "Manage installers →").
  catalog.js        # settings normalization + material math + shared catalog.
                    # Every material entry carries `cost` beside `price` (ADR
                    # 0018 amendment 2026-09-10) and the getters expose it as
                    # `unitCost` — the Employee lens's input, never the totals'.
                    # `wasteFor` = 1 on underlayment rows; `getUnderlay` null
                    # there, `underlaymentForSku` links the row's own entry
                    # (ADR 0043). `lineWastePct`/`ownWaste` — a row's own
                    # `waste` rate wins over the job's, even with the family
                    # off (ADR 0046); `wasteVaries` feeds the estimate's
                    # "some lines differ" note
  pricing.js        # price tiers as a display lens (ADR 0018): `tierView` maps
                    # the raw { project, settings } pair to the tier-priced pair
                    # every total/print reads. Employee = cost × 1.06 on costed
                    # flooring rows AND (2026-09-10 amendment) on every costed
                    # extra in the material maps + the row caulk snapshot;
                    # identity for retail and for a catalog with no costs
  pricebook.js      # generic mapped import for registry books (ADR 0009) +
                    # vendor template recognizers (VTC EFT, ERP Vendor SKU
                    # Analysis); the retired shop workbook's hand-built
                    # parsers (ADR 0003) lived here until 2026-07-22.
                    # Membrane/backer rows with bundled coverage type
                    # `underlayment` on both the stock export and the
                    # Schluter EFT (ADR 0043).
                    # The EFT recognizer is BRAND-aware (2026-08-07): the
                    # title line above the header decides what the rows ARE —
                    # a Schluter book gets no tile default (it sells no
                    # flooring) and reads coverage ("= 323 SF") and
                    # feet-and-inches roll/board sizes out of the description
                    # in every spelling Schluter prints (3'3"x98'5",
                    # "3 FT 3 X 98 FT 5", 82FTX3-1/8INX5/16IN, trailing 10'
                    # stick lengths, 5/8IN X 48IN X 120IN boards). Its
                    # `schluter` mapping flag (ADR 0041, 2026-09-14) — or,
                    # per row, a VTC MFG of SLR on any other brand's EFT — also
                    # drives `schluterDescription`/`schluterWords`: profile
                    # families read a bare-fraction thickness and land
                    # thickness×stick in size (`3/8"x8'`, the implied 2.5 m
                    # stick shortened to 8'), the vendor shorthand spells out
                    # (CRN/JNT/BRH/SS…), bare ALUM drops, a Schluter lead
                    # fronts every row and the product-line column never
                    # does (it is a grouping label — "RONDEC CORNERS").
                    # `schluterAccessory` (ADR 0041 amendment) pre-passes
                    # the non-profile rows for the generic split: inch words
                    # and pack counts ("N ct" size), whole curb/bench/notch
                    # dims, no lone-fraction thickness, KERDI-LINE grate
                    # length as size
  pdfbook.js        # text-PDF vendor price list -> canonical rows + mapping,
                    # header-driven per page, feeds the mapped import (ADR 0010);
                    # a lone finish sub-heading ("Polished" / "Matte") above a
                    # run of rows joins those rows' names unless already there
  manningtonbook.js # Mannington "Cartons Detail" price list -> canonical rows,
                    # fixed x-band grid (leftmost col is Pattern, not the code);
                    # floors keyed by Color Code, trims imported as their own
                    # transition products keyed by Catalog # (their 94" length
                    # read off the column header into size), flagged `trim` so
                    # the book can mark trims up separately from floors (ADR 0012)
  interfacebook.js  # Interface dealer price list PDF -> canonical rows (carpet
                    # tile + a trailing LVT section). Carpet costs are per
                    # SQUARE YARD on the sheet -> imported ÷9 per sq ft; carton
                    # coverage is the rep's stated standard pack (53.82 sf / 20
                    # tiles — the sheet states none, so it is assumed and the
                    # wizard warns; 1m×1m and 50cm×1m formats get none), the
                    # size a decoded format letter (SP/50/M/P), the collection
                    # deliberately on the MFG column, not Product Line — style
                    # names overlap their collection names ("Open Air 401
                    # Stria" in "Open Air Stria") and mappedItem's fronting
                    # would double the words. The sheet is one row per STYLE
                    # with no colors; the import joins interfacecolors.js and
                    # lands ONE ROW PER COLORWAY keyed by the real Interface
                    # item pair ("9628C 107689" = Open Air 401, Amber; twins
                    # keep the format code), the style's cost/carton on every
                    # row, QuickShip beside i2 in the note; a style the color
                    # book doesn't know imports style-only under its name and
                    # the wizard says which (docs/pricebook/interface.md)
  somersetbook.js   # Somerset Hardwood (Palmer Donavin "R35") price PDF ->
                    # canonical rows (.scratch/154). Floor pages are a matrix:
                    # carton table (SF/ctn by construction, species or width),
                    # Solid/Engineered band, width header, SKU-only color rows,
                    # and MERGED price cells printed at the middle of the rows
                    # they cover — `priceRuns` splits each column's rows into
                    # one run per printed price; no fit = no cost + a warning,
                    # never a guess. Grey cells are simply SKU-less. Molding
                    # pages -> EA trims fitted by collection + color (and
                    # construction for stair nose/reducer/threshold); a trim
                    # printed at two prices takes the higher (owner), a floor
                    # code printed on two rows stays with the row whose sibling
                    # codes share its letters (owner: as printed + warn).
                    # Detector keys on the carton header + warranty line — the
                    # brand names are logos. Format tag "somerset"
  somersetfixture.js  # the R35 sheet's positioned text items — parser INPUT
                    # for somersetbook.test.js; production never reads it.
                    # GENERATED — .scratch/154's tools/dump-pages.mjs
  interfacecolors.js  # the Interface color book: every colorway of every
                    # price-list style (name + color number + QuickShip),
                    # transcribed from shop.interface.com's US product pages
                    # (2026-08-27), keyed by the sheet's printed style name.
                    # GENERATED wholesale by .scratch/114's colorbook-styles.mjs
                    # + colorbook-scrape.py — refresh by re-running them, never
                    # by hand-editing rows. ~100 KB that must stay OFF the boot
                    # path: only interfacebook.js imports it, which keeps it in
                    # the Settings/pricebook lazy chunk
  stock.js          # stock-item search / SKU fill snapshot / drift / base
                    # companions / grout families, over stock-shaped items
                    # (the ADR 0027 book items + projected family rows).
                    # groutSnapshotPatch stamps caulkCost beside caulkPrice.
                    # `switchToSqftPatch`/`switchChipText` — the count-line →
                    # sq ft chip (ADR 0043). `dropOwnCodes` — a stock-kind
                    # pick's line name sheds the item's own manufacturer
                    # codes (its vendorSkus: exact, behind a 1–3 letter
                    # tag, or spelled out in order inside the word) plus a
                    # letters-and-digits word closing the name after a dash;
                    # the book's stored description is untouched
  groutbase.js      # grout base options (ADR 0006 amendment 2026-09-29): a
                    # catalog grout's ★ `base` + `altBases`, a row's pick in
                    # `grout.base` ("" = the ★; an unknown key falls back to
                    # it), `resolveGroutBase`, the chip labels, the project's
                    # `groutMemory` (last grout type + last base per type) and
                    # the tick / pick-product / pick-base choices App.jsx and
                    # mobile.jsx share, plus the Settings base-list edits
                    # (groutbase.test.js). catalog.js `groutBaseEntries` sums
                    # kits per (grout, color, base) for groutBaseList
  booklink.js       # catalog ↔ ERP stock-book links (ADR 0027): link/family rule shapes,
                    # series-rule + color-token parsing, family resolution + projection into
                    # stock-shaped items, import-time sync (price + cost, the
                    # cost silently — no `changes` entry), migration link proposals.
                    # A family's optional `order` source (a second rule over an
                    # order-kind book, amendment 2026-09-13) appends the vendor's
                    # unstocked colors flagged `special` with their `bookId`; a
                    # stocked color (same number, or same name) is never listed twice
  orderbook.js      # special-order ("order") book helpers (ADR 0009): item shape,
                    # cost/markup/sell (`bookNoMarkup` — the sells-at-cost red —
                    # skips a book `bookPublishesPrice` says maps a `price`
                    # column: wedi publishes retail, so no markup applies and
                    # none is missing), pick snapshot, drift, import diff
                    # (BOOK_FIELDS — tracking stock-kind `price` too, so a
                    # retail-only re-export still upserts — with changedFieldBits
                    # for the wizard's what-moved lines; `priceUpdateBundle` —
                    # a price-update drop moves only prices on live rows, adds
                    # new SKUs, retires nothing, leaves retired rows retired —
                    # ADR 0025 amendment 2026-09-26), and the
                    # import-review classifiers `itemProblems` (per-row pricing/unit
                    # hazards; `unitComboWarnings` aggregates it) + `supersedePairs`
                    # — plus the search collapse: `skuKeys` (the exact-membership
                    # key set for one stated code — its spelling, the
                    # separator-free form for lettered codes, less a leading SLR
                    # reseller prefix — ADR 0009 amendment 2026-08-21, issue 099:
                    # the EFT writes SLRKST965810BF for the stocked
                    # KST965/810BF), `mergeSearch` (a stock twin outranks its
                    # order copy, colliding on any skuKeys spelling of the stock
                    # row's sku or its sheet-stated vendorSkus against the
                    # order row's sku or ITS vendorSkus; the third argument
                    # is the whole stock cache — a live twin the typed words
                    # missed is surfaced into the stock list in the order
                    # row's place, `matchedAs` carrying that row so
                    # rankMerged ranks it as the hit it stands in for — ADR
                    # 0009 amendment 2026-09-02, the 3'x5' wedi panel that
                    # filed as special order) and
                    # `collapseCopies`/`sameProduct`
                    # (one product carried by two order books shows once, the
                    # cheapest, when the descriptions corroborate the SKU match;
                    # a spread past `PRICE_GAP_PCT` names the dearer book).
                    # (N-suffix old→new), surfaced in the wizard's review step.
                    # An item's `flagReview` ({code: confirmed/ignored verdict},
                    # ADR 0017) mutes that code's chip + import warnings and is
                    # carried across re-imports like the disabled column; its
                    # `claudeIssue` ({by, at}) parks the SKU in the Claude issue
                    # bucket, same carry. `bookRowPreview` derives the book
                    # table's project-line cells through the REAL pick path
                    # (pricedItem → stockPatch) so the table can't drift from
                    # what a pick lands. `withBookBrand` (issue 092): the book
                    # page's brand box (book.data.brandLabel) filled in as
                    # item.brand at pick/preview time when the sheet carried no
                    # brand of its own — label()'s lead-unless-said dedupe does
                    # the rest; never written to items, so clearing the box
                    # needs no re-import and saved rows never move (ADR 0003)
  synonyms.js       # trade-synonym map for price-book search (ADR 0009 §6, Option D)
  vendorbook.js     # vendor-kind books (ADR 0040): `vendorBookFor(books,
                    # engine)`, `vendorBookForRow` (a `sheoga`-marked row's
                    # book — configurator rows never carry a bookId, a stamped
                    # one would put them on the order-drift path),
                    # `vendorBookSeed` (name + data seeded from the Settings
                    # markups at creation), `sheogaMarkups(books, settings)`
                    # — the configurator's defaults: the Sheoga book's
                    # `data.markups {flooring, vents, trim}` when the book exists,
                    # Settings' sheogaMarkupPct/sheogaVentMarkupPct otherwise —
                    # `trimMarkupPct` has no Settings field: the book's, else
                    # DEFAULT_TRIM_MARKUP (100); `normVendorMarkups` reads the
                    # three, `trimBookOf(books)` returns `{ sheet }` (the
                    # uploaded accessory sheet, texture rates included) or null
                    # (also when the stored sheet lacks its species/prefin/
                    # slip objects)
                    # — what the configurator's trim tab prices from — and
                    # `sheetMonth`/`sheetDateMDY` format a sheet's ISO date
                    # (vendorbook.test.js; ADR 0056)
  vendorbook.jsx    # `VendorBookPage` — the vendor book's page: name, badge,
                    # "priced by the configurator" meta, Active, delete, and
                    # the Markup · Price sheets · Freight · Brand · Contacts
                    # tabs. No Source tab, no items, no import. Reuses
                    # pricebooklib's FreightCard/BrandCard/ContactsCard (a
                    # deliberate import cycle — both only touch each other
                    # inside render); `VendorMarkupCard` is its own — three
                    # percent fields (flooring, vents, trim) with a worked
                    # cost→sell example each. `pendingSheet` ({fileName,
                    # parsed}) opens Price sheets straight into review;
                    # `onPendingDone` fires on its Save/Cancel
  sheogasheets.jsx  # the Price sheets tab (spec 2026-10-02):
                    # `AccessorySheetCard` (the uploaded accessory sheet's row —
                    # Upload…/Replace… + drop onto the card — beside the three
                    # built-in sheets, then the stored table — its "+ Textured"
                    # row read-only from the sheet, "—" for a piece Sheoga
                    # can't texture — and slip tongue) and `SheetReview` (problems → Save disabled;
                    # else the table with diffAccessorySheets cells amber,
                    # "N prices changed" / "First upload — 40 prices").
                    # Writes only `data.sheets.accessories` through
                    # updateBook's dataPatch
  vendorbookpreview.jsx  # dev-only harness (vendor-book-preview.html): the
                    # REAL VendorBookPage beside the REAL SamplesPanel over
                    # local state — a pre-book name-only Sheoga request and an
                    # id-keyed one merge under one Email button; `?book=1`
                    # mounts the page alone (the panel's backdrop covers the
                    # tabs otherwise); `?sheet=1|replace|bad` reads the real
                    # accessory fixture into a first-upload / diff / problems
                    # review; not part of the app build
  sheoga.js         # Sheoga Hardwood vendor configurator engine (issue 023):
                    # Sheoga sells by DESCRIPTION, not SKU. Hand-transcribed
                    # sheet tables (flooring & stocked Jan '26, vents Feb '22,
                    # dampers Jul '26 — all distributor cost) + pure pricing for
                    # the five programs (unfinished/custom, stocked prefinished,
                    # herringbone, vents, dampers — herringbone RETIRED to
                    # custom quotes 2026-07-28: `HB_RETIRED` hides its tab and
                    # search routing, tables kept so saved rows still price and
                    # the tab can be repurposed; Live Sawn is unfinished-only,
                    # owner rule 2026-07-29), the prefinished-page table
                    # (`PREFIN_SHEET` + `prefinCost`, issue 065 — derived prices
                    # with green STOCK flags; a test pins derived == the
                    # transcribed STOCKED prices so a decoupled sheet edition
                    # fails loudly), `parseQuery`/`queryHit`/
                    # `seedFromQuery` for the SKU-search pinned entry row, and
                    # `lineItems` (configuration -> product-row payloads; fees
                    # as separate at-cost misc lines; `product.sheoga` keeps the
                    # raw config for Reconfigure). `smallOrderFee` is the one
                    # $600/$300 under-500-sf rule all three build paths use —
                    # Prefinished Natural is exempt (owner rule 2026-07-28).
                    # A sheet update is a re-transcription of this one file
  sheogatrim.js     # Sheoga trim & accessories engine (ADR 0056, spec
                    # 2026-10-02), pure: `parseAccessorySheet(sheets)` reads
                    # Sheoga's distributor accessory .xlsx by scanning for
                    # block headers (the five profile blocks sit side by side)
                    # into `{ sheet, problems[] }` — 8 species × 5 profiles,
                    # the Prefinished Charge row, the optional Texture Charge
                    # row (`tex`: a positive number, else null = "Cannot Be
                    # Textured" or no row), slip tongue, the UPDATED date
                    # (serial or text); any missing price is a named problem
                    # and no sheet. Plugs are never read.
                    # `isSheogaAccessorySheet` (the title cell, searched in
                    # each sheet's first 15 rows; the drop zone's router),
                    # `diffAccessorySheets` (changed cells for the replace
                    # review, slip tongue price and bundle lf included). Pricing: `trimRates` (per-profile
                    # $/lf: species + prefinish + the texture charge when the
                    # build is textured and the piece takes it; `smoothOnly`
                    # when it can't), `calcTrim(cfg, trimBook)` (null with no
                    # sheet; one line per piece/length run — nosing and shoe
                    # as `runs` of N pcs × L' or lf at random lengths,
                    # reducer/T-mold 8' counts, slip tongue in bundles),
                    # `trimLineItems` (the kit: anchor `{ mode: "trim", cfg }`
                    # with cfg.match false, companions `{ mode: "trim",
                    # part: true }`, count rows, unit cost rounded then
                    # sellOf; the vent idiom — `sizeText` width×length, no spaces (`3½"×8'`, RL at random lengths),
                    # `brandColor` "Sheoga " + the line's size-free `rest`,
                    # while the build card shows `desc` with the sized name), `trimEntryView` (the basket drawer's row; lists
                    # at 0 with no sheet so it can be removed),
                    # `trimFromFloor`/`effectiveTrimCfg` (Match floor: species
                    # map, a stocked color's texture carried over; live only
                    # inside one popup session). A piece Sheoga can't texture
                    # in a textured build prices and orders smooth, noted
                    # "Smooth — can't be textured"; nothing blocks the add
                    # (sheogatrim.test.js, real 10/01/26 fixtures in
                    # src/testdata/)
  SheogaConfigurator.jsx  # the configurator popup: mode tabs, an option rail,
                    # a build card (cost -> sell, carton preview, fee lines), and
                    # the price grids (issue 065): at ≥1400px the floor/stocked
                    # tabs dock a grid panel left of the rail — the vendor's
                    # prefinished sheet on Stocked (green STOCK/FAST TRACK cells
                    # set the stocked build; a white cell hands off to the custom
                    # tab pre-filled, same $/sf, since the buttons stay
                    # stock-only) and a live unfinished grid on the custom tab
                    # (every cell re-prices with the current scrape/finish/
                    # lengths; Live Sawn strips are unfinished-only) — both
                    # defaulting to Sell through the tier lens with a Cost
                    # toggle; 768–1400px keeps the Grade-row grid button/modal,
                    # phones get a Grid button on the price bar opening the same
                    # table as an overlay. The floor
                    # rail is compact — Species/Width chips, Construction+Grade
                    # paired, and Texture/Finishing/Lengths/Edge as dropdowns;
                    # prefinished finishes reveal Stain-color + Sheen pickers
                    # (each with a Custom… entry). Stocked tab is species -> color
                    # -> grade -> width -> sheen. Every prefinished color has a
                    # standard sheen (sheet footnote; textured = the lower of it
                    # and 20); any other sheen adds 25¢/sf on every tab, and on
                    # the stocked tab also the small-order fees (ADR 0039).
                    # A floor-tab build that IS a stocked item (green cell,
                    # standard sheen, the program's own build) prices as one:
                    # no small-order fee, stock note (stockedForFloor, ADR
                    # 0042); prefinished builds take micro bevel as the
                    # minimum edge (floorEdge — Square greys in the picker).
                    # Vent tab: the Prefinished/Textured toggles reveal stain-color
                    # and scrape pickers (order text only — the sheet's adders are
                    # flat). Like trim, a fresh vent is linked to the floor
                    # (`match: true`): species, prefin+stain and texture+scrape
                    # follow the last-open floor/stocked/herringbone tab live and
                    # their pickers lock until "Pick my own" (effectiveVentCfg /
                    # ventFromFloor in sheoga.js: Maple -> Hard Maple, Live Sawn
                    # -> White Oak). Priced, staged, added and reported builds
                    # are the resolved one, unlinked; a saved vent row (or a
                    # search naming a species) reopens unlinked.
                    # Herringbone tab (hidden while HB_RETIRED — shows only when
                    # a saved hb row's Reconfigure opens on it, with a custom-
                    # quote banner): the same Texture/scrape + Finishing + Edge
                    # dropdowns (+ stain/sheen + sample) as the custom tab, priced
                    # the same $/sf way; its own "Copy floor" pulls species/scrape/
                    # edge/prefinish from the last-open custom/stocked tab
                    # (hbFromFloor; a stocked source reads as Micro bevel).
                    # Opened from a row's search (the pinned "Vendor configurators"
                    # row in GridOmniSearch or MobileSearchSheet — "she" is enough)
                    # or its "Sheoga — reconfigure" chip; Add fills the row via
                    # addSheogaLines. Job size starts at 1. Three markups: flooring
                    # settings.pricing.sheogaMarkupPct (40%), vents & dampers
                    # .sheogaVentMarkupPct (50%) — both Settings -> Price book —
                    # and Trim & accessories (default 100%, the Sheoga book's
                    # `markups.trim`, no Settings field). The Trim & accessories
                    # tab (last in MODES; SheogaTrim.jsx) takes `trimBook` (the
                    # uploaded sheet, from App.jsx/AppsWorkspace via
                    # `trimBookOf`), `sheogaBook` (a Sheoga book exists —
                    # picks the empty state's wording) and `trimMarkupDefault`;
                    # its footer box reads "Trim markup". It stages the one
                    # `{ kind: "single", snap: { mode: "trim", cfg } }` basket
                    # entry. Basket Move keeps any entry that would land no
                    # lines (every kind — e.g. a trim kit with no sheet) in the
                    # basket instead of dropping it.
                    # Responsive (useIsWide, 768px): desktop is the two-pane
                    # rail+BuildCard; on mobile the options fill the screen with a
                    # pinned price bar that pulls up a swipe-down MobileBuildSheet
                    # (BuildCard + Add). BuildCard is the shared cost->sell card.
                    # A price level (PriceLevelMenu in the desktop header,
                    # the TierBar strip under it on a phone) mirrors the job's tier buttons
                    # two ways — seeded from project.priceTier, pressing one sets
                    # it — and every price on screen renders through that lens in
                    # the tier's color (sheoga.js tierSellOf/tierFeeOf). Display
                    # only: rows Add/Move land RETAIL, the job sheet's own lens
                    # reprices them (ADR 0018). Opened from the Apps hub instead,
                    # the bar falls back to a local retail-seeded preview.
                    # The basket drawer's second section, "In this project"
                    # (ADR 0035 step 2), derives from placedKits — Reconfigure
                    # retargets the popup onto that kit's anchor (App.jsx
                    # remounts on key={pid} so the seed re-applies; a bundle
                    # seed restores the whole multi-width build off
                    # sheoga.bundle) and Remove deletes the kit's lines
                    # through removeKitLines with an inline confirm.
                    # `escActive` (default true) gates its Escape handler —
                    # the Apps pane passes false while it is hidden (ADR
                    # 0047).
  SheogaTrim.jsx    # the configurator's Trim & accessories tab (spec
                    # 2026-10-02 §3): `TrimRail` (Match floor banner — the
                    # last-open floor tab's values via effectiveTrimCfg,
                    # pickers locked while matching; Pick my own unlinks onto
                    # those values; the Pieces box prices each row through
                    # the tier lens off sheogatrim.js `trimRates`, an
                    # untexturable piece muted "smooth — can't be textured"),
                    # `TrimCard` (one block per calcTrim line, cost → markup
                    # → sell) and `TrimEmpty` (no accessory sheet). The rail
                    # primitives arrive as a `kit` prop — SheogaConfigurator
                    # imports this file, so importing them back would cycle.
                    # What stages, lands or is reported for refresh restore
                    # is the resolved cfg, match:false, so a placed or
                    # restored kit reopens unlinked. A textured build shows
                    # "Textured — {texture} +$X/lf" on texturable pieces and
                    # "smooth — can't be textured" on the rest; there is no
                    # texture price to type in (the book's sheet carries it).
                    # `TrimEmpty` says to create the Sheoga book first when
                    # there is none (the `sheogaBook` flag), else to upload
                    # the sheet
  wedi.js           # wedi shower-system configurator engine (issue 066): the
                    # opposite of Sheoga on both axes — every piece has a part
                    # number and wedi publishes retail, so nothing is marked up
                    # (sell = book retail, cost = distributor net ≡ the ERP's
                    # stocked cost) and the one wedi rule is Builder = retail ×
                    # 0.82 (`BUILDER_MULT`, tunable as `wediBuilderPct`). Two
                    # generated tables (the 151-row WEDI_1 stock export + 229 Jan
                    # 2026 pricelist rows) behind a classified `catalog()`/`item`/
                    # `group`/`pans`, plus the system solver a shower needs:
                    # `kitFor` (the house-kit recipe per pan; `input.source`
                    # "stock" on `solve` — the shared phase-4 switch — drops
                    # non-stocked pans/modules from the candidate pools so
                    # options re-rank, while companion pieces an option needs
                    # stay as picked and render flagged, never silently
                    # dropped; absent source is Full catalog, pinned deepEqual
                    # in wedi.test.js), `solve` (room ->
                    # ranked options: exact pan · pan + extensions with the corner
                    # rule · pan cut down · Riolito neo module + same-length
                    # extension, at the wall or centred with one leading away each
                    # side; a pinned drain floats the pan, trimming a side 6"
                    # freely or up to 12" as a labeled "Deep cut" card (the 6"
                    # rule is SOFT — the offset bases are designed to cut up to
                    # a foot off to meet an existing waste line, owner
                    # 2026-07-31 — a deep cut never stands alone: the closest
                    # shallow placement rides along and the salesman chooses),
                    # and never dead-ends — no exact hit falls back to
                    # "Closest fit" cards that say how far the drain lands off the
                    # pin, then to the whole family, then to the plain layouts.
                    # Drain positions are transcribed per SKU off the 2026
                    # illustrated price list drawings — `OFFSET_DRAIN`,
                    # `LINEAR_DRAIN`, `moduleDrain` (channel + outlet dead centre
                    # of the module) — not derived), `panelPlan`
                    # (the three stocked ½" sheets through panelplan.js), benches (issue 069: `normBench`/
                    # `benchFootprint`/`benchLines` — a premade catalog piece,
                    # site-built 2" material (top + face + a support about every
                    # foot), or installer-framed with a ½" wrap and the pan cut
                    # down / swapped smaller (`benchPanRoom`/`smallerPanFor`);
                    # the shower always completes first and the bench goes ON it
                    # (owner rule 2026-07-31): only an installer-framed bench
                    # interrupts the envelope (`curbRuns` subtracts just framed
                    # footprints — the pan and curb butt its face); a 2" build-up
                    # or premade sits on the finished pan with the curb running
                    # across beneath it, and a suspended premade (corner seats
                    # US3000001/2, Sanoasa 4) hangs on the walls at seat height,
                    # only its slab drawn (`thick` — 4" seats, 3 1/8" bench);
                    # corner benches measure from the corner out along each wall,
                    # 18" to the top, never framed),
                    # one flat bag of PRO-SET (SKU.proSet) on every pan
                    # kit, owner 2026-09-26 (ticket 158 P0-5),
                    # `coverageOf` (sf for rolls/membranes/panels — S-DRY's
                    # read off its name — lf for tapes; ticket 158 P0-3),
                    # `figureConsumables` (1 screw+washer and
                    # 1.2 oz sealant per ft² of panel), `coverFrames`/
                    # `coverFrameFor` (issue 072: the channel frame a LINEAR
                    # cover drops into — a design opt-in, never in the house
                    # kit, so `opts.coverFrame` stores a FINISH and the length
                    # follows the cover; a perforated cover wears the plain
                    # frame of its metal, a tileable one can take any of the
                    # four so the chip opens a picker). Ticket 158 Phase 1a (ADR
                    # 0049): `kitFor` resolves a cover through `opts.coverPick`
                    # first, then the legacy `opts.coverKey`, then the recipe
                    # default — a linear `coverPick` is `{ finish }` (wedi's own
                    # finish codes already carry the style, so `linearCoverFor`
                    # takes no style argument) resolved at the CURRENT channel
                    # length, a point one `{ key }`. `legacyCoverPick(key)` reads
                    # an old resolved `coverKey` back into that same choice shape
                    # (plain SS = no choice) so a reopened kit nobody swapped
                    # starts following the room again. `coverStyles(len)` groups
                    # that length's covers by style (solid/perforated/tileable,
                    # off the finish code's trailing `P`/`T`) for the swap
                    # popover (drainswap.jsx). `wediSlotOf(line)` tags every
                    # `kitFor` line with its shared slots.js slot. `tierPrice`,
                    # `factoryKit`, and `lineItems` (build -> product rows; the pan anchors and
                    # carries `product.wedi`, companions `wedi.part`).
                    # `buildFromMarker` re-derives the billed kit from a saved
                    # marker/staged entry (re-solving a custom cfg and
                    # re-picking its option by id) so the basket drawer prices
                    # staged and placed kits through the engine itself (ADR
                    # 0035 step 3). `lineItems` stamps every line's catalog
                    # key (anchor `key`, companion `part: key` — legacy rows
                    # carry `part: true`) and `rowItemKey`/`sessionFromRows`
                    # read the placed rows back into a session (qtyOv +
                    # manual) so Reconfigure reopens on what the sheet says
                    # (ADR 0035 amendment 2026-09-02).
                    # A non-dimensional item keeps its pricelist CONTENTS as its
                    # sizeText ("100 ct 1 5/8\" Screws…", "20 oz foil sausage",
                    # "2 per bag" — contentOf), so a Fastener Kit row says what
                    # one EA holds everywhere a size shows — UNTIL ADR 0054
                    # (2026-10-01): `entryText` (the last step of makeEntry)
                    # now sets every entry's `sizeText` (the Size field: the
                    # measure — `sizeOf` by the foot for pans/panels when both
                    # sides are whole feet, inches otherwise, rolls w"×len',
                    # thickness last, hyphenated mixed numbers; a counted part's
                    # "100 ct"/"20 oz"/"25 lb") and a brand-free, size-free
                    # `name` ("Shower Base, Offset Drain", "Building Panel",
                    # "Lean Curb", "Stainless Drain Cover", "Fastener Kit,
                    # Screws & Washers with Tabs", "S-Dry Membrane, 104 sf";
                    # CURB_NAMES / FIN_SHORT / SDRY_COVER_NAMES still feed the
                    # words; a niche's interior rides `e.interior`, read by
                    # showersf.js and comparemirror.js). `lineItems` lands
                    # `brandColor: "wedi " + name` and `sizeText` — no dash
                    # lead, no "wedi US… —"; a special-order line's US number
                    # stays on the marker (`key`/`part`) and the print shows
                    # it. `panTitle(e)` (size + name) is what option cards and
                    # the kit view title with, since the name has no size.
                    # The 2026-08-06 treatments (feet in the name, inches on
                    # the second line, curb size blank) are superseded.
                    # The STOCK half is no longer transcribed (ADR 0037,
                    # 2026-09-01): `buildCatalog` reads `STOCK_SRC ||
                    # WEDI_STOCK`, and `setStockSource`/`clearStockSource`
                    # swap it, clearing BOTH memos (CAT and INDEX — INDEX is
                    # a side effect of buildCatalog, not a separate
                    # derivation) so `catalog`/`item`/`group`/`pans` all
                    # follow without changing their signatures. This is
                    # module-level state SHARED BY EVERY wedi.js CONSUMER —
                    # including comparekit.js, which the Schluter popup's
                    # Compare tab reaches — so ONLY usewedicatalog.js may
                    # call the installers, and any surface that reads the
                    # catalog must go through that hook first or it reads
                    # whatever the last caller installed.
                    # `stockSourceIsBook()` is the getter the hook's
                    # re-assert effect reads. WEDI_STOCK stays as the
                    # no-book fallback until 8b (never delete it — the
                    # engine must not go inert because a book is missing).
                    # The PRICELIST half followed in 8b (ADR 0038):
                    # `buildCatalog` reads `SO_SRC || WEDI_SO`,
                    # `setSoSource`/`clearSoSource` twin the stock
                    # installers, `stockSourceIs`/`soSourceIs` are identity
                    # getters for the hook's re-assert, and
                    # `missingRequiredParts()` is the plausibility floor.
                    # `kitFor` no longer dereferences a missing panel or
                    # cover — it hints `no-panel`/`no-cover`.
                    # Both halves are now imports; the tables are fallbacks
                    # only, removable together in a later PR.
                    # (wedi.test.js, wediequivalence.test.js)
                    # Ticket 158 Phase 1b (ADR 0049): `curbPick` replaces the
                    # resolved `curbKey` — `{ sub, len?, profile? } | { none: true }`,
                    # `profile` only on the AT style (full-foam vs the
                    # cheaper stocked lean piece); `resolveCurb`/`curbOptions`
                    # figure it fresh every build (Auto re-fits the opening),
                    # `legacyCurbPick`/`curbPickOf` translate an old `curbKey`
                    # on read so no bill moves except a stale key, which now
                    # bills the recipe default instead of no curb;
                    # `markerCurbKey` lets `showersf.js` resolve the same
                    # choice for tile sf; `kitFor` also returns `curbFit`
                    # (`{openLen, fam}`) for the popover. `panelOptions`/
                    # `panelSheets` and `fastenerKits`/`fastenerKey` are the
                    # wall-panel and fastener-kit swaps (panelKey/fastenerKey
                    # written only when picked, and only honoured when they
                    # name a real panel / one of the two boxed kits — a stale
                    # key falls back to the house part with a note on the
                    # line rather than vanishing). `coverPickApplies` keeps an
                    # inert cover pick (wrong pan type) from marking the build
                    # Custom.
                    # (wedimarkergolden.test.js)
                    # Ticket 158 Phase 1c (ADR 0049): added lines are parts +
                    # a hand-set qty, never choices. `cfg.manual`
                    # `{ key, qty, group? }` rides the marker (wedi's first
                    # time); `addons` retires. `addedRows(src)` reads a
                    # marker's or kitFor opts' rows, translating old
                    # `addons` into the add-on bucket (a key twice = qty 2)
                    # and dropping a key the book doesn't know;
                    # `setAddedRow` sets one row's qty keyed by bucket + key
                    # (0 removes it). `kitFor` bills the rows at the old
                    # add-on position, flags them `added`, and writes
                    # `manual` (never `addons`); `buildFromMarker` passes
                    # them through. `wediBucketOf` (moved from the popup,
                    # which aliases it `bucketOf`) and `WEDI_BUCKETS` name
                    # the engine buckets — since 1d internal keys only (an
                    # added row's `group`), no longer what the bill draws.
                    # Phase 1d: `WEDI_ADD_PARTS`/`wediAddParts(grp)` are
                    # keyed by the shared group (slots.js `GROUPS`) — what
                    # each group's "+" offers (a part the book lacks never
                    # shows). Each part stores the bucket an add writes
                    # (`group`: Recess kit `install`, Niche/Seat & bench
                    # `addon`…) and its `hit` only matches parts whose
                    # `wediSlotOf` under that bucket lands back in the
                    # offering group; Setting gains a PRO-SET part.
                    # `wediAddPartOf(grp, item)` is the part an added line's
                    # ⇄ swaps within, found by `groupOf(line.slot)`. The
                    # `fastener` catalog group fills slot `wallBoard` (was
                    # `seam`), so fasteners draw under Walls.
                    # `curbAddOptions` and `coverAddOptions`
                    # are the stepped "+" rows with no Auto (a real length,
                    # a real cover key). `sessionFromRows` takes the
                    # marker's added lines off each placed total first, so
                    # only a kit line's hand-set qty becomes `qtyOv`.
                    # (addedgolden.test.js)
                    # Ticket 158 Phase 2 (ADR 0051): `kitFor` takes
                    # `opts.wallSys` ("membrane") and `opts.sdryBase`
                    # ("wedi"). Under Membrane, sdry.js `sdryWalls` replaces
                    # the panel, the wall fasteners and sealant, the wedi
                    # collars and the putty knife. PRO-SET becomes
                    # `sdryProSet`, and the build hints `"backer"`. An S-DRY
                    # base under Membrane also bills the S-DRY curb and
                    # cover — never the bonding-flange drain, a mortar-bed
                    # part (the base's drain is built in) (the recipe is gated on Membrane — an S-DRY
                    # pan without it is an old marker shape the 1b golden
                    # pins). `solve` takes `input.system: "sdry"` (+
                    # `nearest`), `sdryNoFit(input)` names why nothing fits,
                    # and `markerCurbKey` knows the S-DRY curb (tile sf).
                    # S-DRY parts slot through `sdrySlot`, and
                    # `WEDI_ADD_PARTS` gains them (wedisdry.test.js,
                    # wallsysgolden.test.js). `opts.membraneKey` is the
                    # membrane-roll swap: written to the cfg only when it
                    # bills the XL roll, inert under Building Panel, carried
                    # by Compare's kept choices; `rowPickedMembrane` reads a
                    # kit placed before the swap (auto-billed XL, no key) back
                    # as the XL pick on Reconfigure. `opts.bench2Key`/
                    # `opts.wrapKey` (owner 2026-09-30) are the bench sheet
                    # swaps — one pick for every bench's 2" build-up (a
                    # `bench2Sheets` 2" board, else the 4×8s + one 4×5 mix),
                    # one for every framed wrap (a `benchWrapSheets` ½" sheet,
                    # else the wall panel); written only when honoured.
                    # A curbless pan under Membrane
                    # bills ONE SEAL line and ONE trowel: `withFieldSeal`
                    # folds the field seal's own unit into the walls' SEAL
                    # row (qty + 1, the note says so) rather than billing a
                    # second SEAL and a second trowel (build amendment 19 —
                    # the first pass double-billed both). A wedi pan under
                    # S-DRY walls (`sdryBase: "wedi"`) also seals its
                    # pan/extension floor joints: `figureConsumables` gained
                    # an optional 4th argument, `jointSf` — the floor
                    # footprint's bounding box (`floorSfOf`, not the sum of
                    # the solver's overlapping edge strips) — which figures
                    # the one Joint & Seal line (floor joints plus any bench
                    # surfaces; the walls bill none under Membrane, no
                    # fasteners on the floor either). An S-DRY cover pick
                    # carried onto a non-S-DRY pan
                    # stays inert: the wedi-pan branch of `kitFor` falls back
                    # to the stainless wedi cover for a `coverPick` whose
                    # `sdryRole` is `"cover"`, mirroring the S-DRY branch's
                    # own guard (build amendment 20 — stops an S-DRY cover
                    # carried across a flip to Building Panel from billing
                    # over a wedi drain).
                    # `panelFitLines(lines, walls, panelSf)` (ticket 158
                    # Phase 4): the popup's panel Fit plan, moved here
                    # verbatim so Compare prices a kept wedi build as the
                    # popup showed it.
  wedimarkergolden.js  # the golden bill of every old wedi marker shape,
                    # captured from wedi.js BEFORE 1b changed how curbPick/
                    # panelKey are written (ticket 158 Phase 1b) — every
                    # pan × a curb axis (every real curb key, plus null and
                    # the recipe default — no key) × a room axis (its own
                    # room and a 24″-widened open edge), plus every real
                    # panel key. Never hand-edited — GENERATED by
                    # `.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`.
                    # `wedimarkergolden.test.js` reopens each shape through
                    # `buildFromMarker` and fails if the bill moves. A stale
                    # curbKey — not in the book — is outside the golden (no
                    # such key is generated here); its bill-moves-on-purpose
                    # ruling is recorded in the ADR 0049 amendment instead
  addedgolden.js    # the golden bill of every old hand-added-line marker,
                    # captured BEFORE 1c moved added lines into their own
                    # groups (ticket 158 Phase 1c): wedi `addons` shapes (one
                    # niche, the same niche twice, niche + gun, niche + seat,
                    # …) on three pans, and Schluter `cfg.manual` rows in the
                    # old `{ sku, qty }` shape (a band, a board, niches ×2,
                    # KERDI-FIX, …) on a point and a linear build. Bills are
                    # quantities per part, plus the tile-sf niche back. Never
                    # hand-edited — GENERATED by
                    # `.scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs`.
                    # `addedgolden.test.js` reopens each shape through both
                    # `buildFromMarker`s and `showersf.js` and fails if a
                    # bill or niche figure moves
  wallsysgolden.js  # the golden bill of every Building Panel wedi build and
                    # both Schluter wall systems, captured BEFORE Phase 2
                    # added S-DRY (ticket 158): every kit card, a spread of
                    # room solves built and reopened, Schluter point/linear
                    # on membrane and board, Compare's default house kits.
                    # Never hand-edited — GENERATED by
                    # `.scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs`
                    # (wallsysgolden.test.js)
  comparegridgolden.js  # the golden bill of the four-way Compare grid's four
                    # cells (ticket 158 Phase 3, `comparegrid.js`) over a
                    # spread of fixture rooms — 60×38 curbed point, 60×38
                    # curbed linear (no S-DRY fit), 48×48 curbless point,
                    # 30×30 (deep cut) and 100×60, each from both hosts — each
                    # cell's retail/builder totals and flag ids, so a
                    # `comparegrid.js`/`comparekit.js` change that moves a
                    # cell's bill or its chips fails loudly. Never hand-edited
                    # — GENERATED by
                    # `.scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs`.
                    # `comparegridgolden.test.js` reopens each room through
                    # `cellBuild` for all four cells and fails if a total or a
                    # flag id moves
  wedibook.js       # wedi distribution pricelist parser (ADR 0038, 8b): a
                    # section-table state machine (ovfbook.js's parseSundries
                    # shape) that flattens the "wedi Fundo" and "wedi S-Dry"
                    # sheets to the canonical { name, rows, mapping, warnings }
                    # the wizard consumes. Section-title rows re-map the
                    # columns (layouts change mid-sheet); product rows match
                    # /^(US\d{7,9}|\d{9})\*?$/ (the asterisk is a footnote
                    # mark); size/details follow the section's captions with
                    # the two measured positional fallbacks; discount is the
                    # caption's "(less N%)" and is NOT mapped onto the item
                    # (nothing reads it). Other sheets are skipped BY NAME
                    # with a warning so a re-format fails loudly. Fundo wins a
                    # part priced on two sheets (US5076012). Detector
                    # isWediPricelist → fileFormat tag "wedi-pricelist" →
                    # an order-kind book (wedibook.test.js)
  keimwedibook.js   # Keim's own wedi retail sheet (ticket 158 P0-6, ADR 0025
                    # amendment 2026-09-26): `isKeimWediSheet` (account line +
                    # a WEDI title on a Retail tab) → fileFormat "keim-wedi",
                    # routed to the one active wedi STOCK book; `parseKeimWedi`
                    # reads the Retail + S-Dry Retail tabs only (Contractor
                    # skipped by name, owner) to canonical rows keyed by shop
                    # SKU, retail rounded UP to the cent (`ceilCents` — the
                    # ERP's rounding; nearest-cent read 48 rows as changed),
                    # and flags `priceUpdate` so the wizard runs
                    # orderbook.js `priceUpdateBundle` (price only, nothing
                    # retires, fingerprint/mapping untouched)
                    # (keimwedibook.test.js)
  keimwedifixture.js  # the Keim sheet's two Retail tabs as the raw grid the
                    # wizard sees (Contractor tabs named, rows omitted) —
                    # parser INPUT for keimwedibook.test.js and the
                    # import-preview `?keim` harness. GENERATED —
                    # .scratch/158_shower-config-roadmap/tools/gen-keim-fixture.mjs
  wedifixture.js    # the 2026-09-01 wedi stock-export snapshot, as
                    # `price_book_items` rows (sku + active + the jsonb data
                    # payload) — schluterfixture.js's opposite number, but
                    # stored in LIVE REGISTRY shape rather than engine shape,
                    # so the adapter is exercised on real import output
                    # instead of hand-shaped literals. 152 rows: the whole
                    # export including the `29WEDIT` custom-item placeholder
                    # the adapter drops, because a fixture pre-filtered to
                    # 151 could not prove the drop. Production NEVER reads
                    # this file. GENERATED — regenerate with
                    # `.scratch/119_wedi-stock-book/tools/gen-fixture.mjs`
                    # over the owner's workbook, never by hand
  wedipricelistfixture.js  # the 2026-09-02 wedi distribution pricelist as the
                    # RAW sheet grid readXlsxSheets hands the wizard — parser
                    # INPUT, not output, so wedibook.test.js is not circular.
                    # 5 sheets / 602 rows; production never reads it.
                    # GENERATED — `.scratch/120_wedi-pricelist-book/tools/
                    # dump-pricelist.mjs` (over the workbook, or --from-json
                    # over the committed snapshot)
  wediadapter.js    # the registry→engine adapter for wedi's stock half (ADR
                    # 0036) — schluteradapter.js's opposite number, and the
                    # only file that sees a raw book row. `usOf` recovers the
                    # wedi US-SKU from `vendorSkus`: the row's own sku is
                    # excluded (two rows repeat it in a vendor column), a
                    # `US`-shaped code beats a numeric article number. That
                    # PREFERENCE is order-independent; the remaining fallback
                    # is not — it takes codes[0] as given, and is stable only
                    # because normFits SORTED vendorSkus upstream (column
                    # order does not survive normalization). 7 rows use the
                    # fallback, 0 have two non-US candidates; a future row
                    # with two article numbers would key on whichever sorts
                    # first, which wediadapter.test.js pins deliberately
                    # rather than leaving to be discovered. NO fixup table: 28954 reads
                    # US50000005 in the export AND in WEDI_STOCK, and
                    # wedi.js's index-compensation line depends on the
                    # ten-digit spelling; "correcting" it re-keys the entry
                    # and breaks item("US50000005"). `descOf` puts back what
                    # the importer took out — splitSizeFromDescription
                    # (pricebook.js) always runs and moves leading dimensions
                    # into size/thickness/sfPerUnit, while makeEntry parses
                    # w/d/t back out of `desc`, which for a stock-only entry
                    # is the SOLE dimension source. Two heuristics earned
                    # from the data: inch marks are restored only on a
                    # NON-INTEGER bare size (restoring them always shrinks
                    # the 4x8 vapor sheet to an 8-inch chip), and a lifted
                    # fraction is re-attached at its dangling hyphen ONLY
                    # when exactly one candidate site exists — two or more
                    # and it bails to the lead, because guessing relocates a
                    # real board thickness. `adaptBookRows` drops rows with
                    # no derivable `us` (exactly the placeholder)
                    # The pricelist half (8b): `adaptSoRow`/`adaptSoRows` map
                    # an order-item row straight back to makeEntry's soRow —
                    # sku/description/size/note/price/cost/section/
                    # vendorSkus[0] — with `discount: null`.
  usewedicatalog.js # `useWediCatalog` — the registry→catalog assembly and,
                    # more importantly, the GATE (ADR 0037).
                    # useschlutercatalog.js's opposite number with three
                    # deliberate differences: it matches `kind === "stock"`
                    # (Schluter matches "order"), it has no dropStockTwins
                    # step, and it owns a fallback Schluter has no equivalent
                    # of. The spec originally said fall back when the book
                    # "is absent OR its rows haven't loaded"; the owner
                    # split those (2026-09-01) because they are different
                    # situations — no book means fall back to WEDI_STOCK
                    # with `onBook: false` and a visible "· transcribed
                    # table" marker, while a book present but NOT LOADED (or
                    # whose fetch failed) means WAIT, never substitute: a
                    # slow or failed fetch would otherwise quote last year's
                    # prices and resurrect retired items with nothing on
                    # screen saying so. A failed fetch resolves to `null`,
                    # NOT `[]` — the inverse of useschlutercatalog's
                    # `.catch(() => [])` — and one failure among several
                    # books nulls the whole result, because a partial
                    # catalog is a book missing SKUs, which quotes wrong
                    # without looking wrong. `gateOf` and `foldBookLists`
                    # are exported as PURE functions so the transition table
                    # is unit-testable without a React renderer; reading the
                    # hook did not catch two stale-pricing bugs that the
                    # table pins as named regressions. Two subtleties both
                    # of which were live bugs: rows travel WITH the id-set
                    # they were fetched for (`loaded.ids === targetIds`),
                    # because the `[]` written when there was no book yet is
                    # otherwise indistinguishable from an empty book once
                    # one arrives — and books hydrating after the popup
                    # mounts is ordinary, not a rare race; and `onBook` keys
                    # off the POST-adapter rows, because a book whose rows
                    # carry no wedi part numbers adapts to `[]`, which
                    # `setStockSource` collapses to the fallback, so gating
                    # on the pre-adapter count flies an on-the-book marker
                    # over the transcribed table. `pickWediBooks` is
                    # `\b`-anchored — unanchored /wedi/i matches "Swedish".
                    # LAZY-CHUNK-ONLY: imports wediadapter.js and wedi.js,
                    # so only a React.lazy surface may reach it — today
                    # WediConfigurator.jsx and CompareTab.jsx
                    # The pricelist half (ADR 0038, 8b): it now runs two
                    # halves (`pickWediSoBooks`, `useHalf`), installs through
                    # `installSources` (which applies the floor and refuses
                    # the pricelist first), and returns `onBook: {stock, so}`
                    # plus `caption` (`fallbackCaption`).
  wedikitview.js    # pure wedi basket pricing lifted out of the popup:
                    # `wediTierOf`, `wediApplySession` (the build column's tail —
                    # Fit plan, stepped qtys, added rows; the ONE copy the build
                    # memo, Reconfigure seeding and the views share) and
                    # `wediEntryView` (session undefined = placed kit, reads
                    # ctx.panelFit; an object = staged, reads its own Fit flag).
                    # Imports wedi.js only; WediConfigurator wraps it with its ctx
  wediquery.js      # the wedi search-entry recognizer — the BOOT half of issue
                    # 066: `queryHit`/`parseQuery`/`querySummary`/`seedFromQuery`
                    # over ~30 trade words and a size regex, so the pinned "Vendor
                    # configurators" row can decide on every keystroke without the
                    # ~2 000-row catalog. Must NEVER import wedi.js — wedi.js
                    # re-exports these four (ADR 0026, wediquery.test.js)
  sdry.js           # wedi's S-DRY system, the wedi "Membrane" wall choice
                    # (ticket 158 Phase 2, ADR 0051) — PURE: the caller
                    # passes its catalog, so it never imports wedi.js and
                    # wedi.js imports it freely. `sdryFit` (base cut evenly →
                    # + one 24×48 extension along an edge ≤48″ → + two side by
                    # side, seamed; least cut, stock, price; `{ options,
                    # reason }` — the no-fit reason the popup's prompt shows),
                    # `sdryNearest` (the "nearest S-DRY base anyway" answer,
                    # shortfall warned), `sdryCurb` (full default, lean on
                    # pick, ⌈open ÷ 72⌉), `sdryWalls` (membrane +10% laps on
                    # the standard 50″×25′ roll, or the roll `pick` names — the
                    # popup's ⇄ swaps to the 80″×16′ XL, owner 2026-09-30; a
                    # pick the book lacks falls back with a note — tape lf in
                    # 32′ rolls, corners, collars,
                    # SEAL ⌈lf ÷ 45⌉ + trowel; each 45° cut corner on a
                    # curbed build trades a 90° inside + outside pair for two
                    # 135° pairs — `cutCorners`, owner 2026-09-30),
                    # `sdryProSet` (1 + ⌈membrane
                    # sf ÷ 100⌉ — wedi's TDS: 36×60 → 2, 48×72 → 3),
                    # `sdryRole`/`sdrySlot` (role and slot off the SKU).
                    # Rates are wedi's published ones — see the Phase 2 spec's
                    # Sourced rates before changing any (sdry.test.js).
                    # Each fit option's `badges` end with the cut state, in
                    # order (build amendment 23): the whole-footprint cut
                    # text ("cut N″ off each side/end") when the layout's own
                    # footprint is larger than the room; else "Trim to fit"
                    # when any piece is cut — including an extension trimmed
                    # on the nearest option; else "No cutting".
                    # A base that covers the room alone never takes an
                    # extension; ext qty/seams/title follow surviving pieces.
  WediConfigurator.jsx  # the wedi popup, a `React.lazy` chunk (ADR 0026) so the
                    # tables stay off boot. Carries the shared SourceSwitch
                    # (phase 4): Stock only re-solves an active custom room
                    # (options re-rank; with only a kit loaded the cards
                    # refresh WITHOUT touching the build — runSolve would
                    # adopt res[0] and wipe the kit), grays SO kit rows,
                    # hard-filters Browse, and narrows swap/chip/premade
                    # choice lists to stocked rows unless none are (then the
                    # full list stays so a menu is never empty and a pick
                    # lands flagged). Stock only by default (owner 2026-09-02)
                    # and the marker carries it (cfg.source, read back by
                    # seedState — the Schluter rule) so a saved kit reopens
                    # under the catalog it was built from. The kit-card
                    # confirm (KitOverwriteConfirm) adds keepAdded — the
                    # room's work rides onto the kit, stepped quantities and
                    # part swaps drop — and newShower, which parks the build
                    # in the basket and DETACHES the popup from the kit it
                    # reopened (`detached` → `edit`/`commitLines`), so the
                    # next build appends as a second shower instead of
                    # replacing. Three tabs — Kits (every stocked pan
                    # a 21px ROW showing ONE price, the full kit through the tier
                    # lens — matching the build column's total; owner ask
                    # 2026-07-31 replaced the earlier our-stock-cost line — one
                    # click builds the house kit. Issue 075 retired the 120px
                    # cards: the size leads in FEET with inches behind it
                    # (`ftIn`), each family is sorted smallest side then longest
                    # (`panOrder`) so every 3-footer sits together, and a row is
                    # tagged ONLY where it breaks its family's pattern —
                    # `majority` + `panTag`, needing two pans to agree before
                    # anything counts as usual, or each Neo module's own length
                    # in its name makes every module an exception. The product
                    # name, the "full kit" caption, the per-card drain chip and
                    # the explanatory note box are all gone: they repeated on
                    # every card and buried the two pans that differ),
                    # Custom shower (the room form — size, curb, tile thickness,
                    # drain, and the WALL EDITOR, which moved here off the build
                    # column 2026-08-03: the rows are the room, not the bill, so
                    # per-wall on/off + length × height + sf, the added-wall rows,
                    # ⇄ flip, "+ Add wall" and "✂ Cut open corners" sit with the
                    # size and the drain, flowing as many rows per line as the
                    # group is wide for; the group's old "which get wedi" chips
                    # went with the move — each row's name button is that switch.
                    # Fit | One size stayed in the build column: it picks a sheet
                    # PLAN, so it belongs in the header of the lines it changes —
                    # then the solver's ranked option cards, which FLOW into an
                    # auto-fill grid and scroll DOWN rather than sideways
                    # (2026-08-03: past card two the answer used to be off screen
                    # with nothing saying so), + cut
                    # list) and Browse (the whole catalog, stock tinted green and
                    # ranked first, + the sealant/fastener figurer) — over one
                    # shared build column (grouped lines, swap popovers, steppers,
                    # add-on chips — a chip with several possible
                    # parts opens a picker instead of auto-adding, and curbless
                    # builds get a Recess chip since the bracket kit/ramp is a
                    # pick, never part of the house kit (owner asks 2026-07-30),
                    # and a LINEAR drain gets a Cover frame chip landing the
                    # matching channel frame under the cover (issue 072) —
                    # sausage-gun/small-order hints, Copy list, Print layout) and a
                    # permanent drawings rail. All three columns carry
                    # `flex: 1 1 0` (issue 075) so they hold an equal share on
                    # EVERY tab and nothing moves when you switch surfaces; the
                    # build column's own content still floors it near 567px once
                    # a kit is loaded, which is the one place the split shifts.
                    # The rail hosts the two shared shower drawings — a to-scale
                    # top-down and an isometric — over one shared build column;
                    # their rendering (wall-band corner rules, curb overhang,
                    # panel-seam ticks, drain callouts, pan hips, the isometric
                    # slabs, and the box-fit sizing that keeps both on screen
                    # without a scroll) now lives in `showerdraw.js`/
                    # `showerdraw.jsx` — see those entries and ADR 0033. This
                    # popup only wires up what you can click on them: click an
                    # edge to add a wall — which HALF of the edge you click
                    # picks the END it returns from, since a wall is a RUN
                    # with an end (`at: "lo"|"hi"`, wedi.js wallSpans) and not
                    # just a length: a front half wall can come off either side
                    # wall, and "both sides" is simply one at each end with the
                    # walk-in left between them (owner 2026-08-03) — a corner to
                    # toggle a cut, and hover the pan along a wall or into a
                    # corner for a BENCH zone — click/right-click opens the
                    # bench menu (issue 069): premades, 2" build-up, or framed
                    # with the pan cut/swapped. Right-clicking a wall in either
                    # view opens its menu: size + which faces get
                    # wedi (inside / both sides / inside + exposed end — the extra
                    # faces feed the panel plan via expandWallFaces and read as
                    # moss edges). Modifying a kit's geometry moves the build to
                    # the Custom shower tab (owner rule 2026-07-30), and so does a
                    # framed bench whose Smaller-pan choice RESOLVES — the swapped
                    # pan means it's no longer the kit (owner rule 2026-07-31);
                    # every other bench (2" build-up, premade, suspended, framed +
                    # cut down) stays a kit add-on. Both moves are one-way and keep
                    # the build. A kit card
                    # clicked over a custom shower confirms before hard-resetting
                    # to the stock kit. The custom form's "Sizes are — Pan size |
                    # Max — curb inside" toggle re-fits like the wall/curb changes
                    # do — re-solve, re-pick the equivalent option, benches and
                    # add-ons left standing — it never wipes the build. All three
                    # re-fits run through one `refit(results)`, which adopts the
                    # card carrying the pan already on screen whether or not a
                    # card was picked: a kit off the Kits tab has a pan and NO
                    # card, and every re-fit used to be a no-op there, so the
                    # toggle moved the numbers and left the drawing frozen until
                    # you clicked a card or retyped the room (owner 2026-08-03).
                    # Beside
                    # it sits "Tile thickness" (owner 2026-08-03): the finish
                    # that lands on the curb's OUTER face, which the stated
                    # footprint has to cover too, so `curbInsets` steps the curb
                    # that much further inside the line and the pan gives up
                    # curb width + tile. It only bites in max mode on a curbed
                    # shower — elsewhere the curb and its tile land outside the
                    # numbers — and reads fractions ("3/8") as well as decimals. Opened from a row's
                    # search ("wed" is enough) or its "wedi — reconfigure" chip;
                    # the TierBar mirrors the job's tier both ways (ADR 0018) and
                    # Add previews then lands lineItems() via addWediLines.
                    # "Clear design" sits in the popup head's one control row
                    # (owner 2026-08-04; row 2026-09-24): it wipes the whole build,
                    # not just the walls, so it reads as a header action on every
                    # tab rather than a control of the Custom shower's Walls
                    # group, where it used to hide.
                    # A FOURTH tab, Compare (phase 5), is the one surface that
                    # spans the whole body: the build column and the drawings
                    # rail step aside for CompareTab.jsx (its own React.lazy
                    # chunk), handed host="wedi", the live `build.cfg` as raw
                    # `hostCfg` — the neutral room is derived INSIDE CompareTab,
                    # this popup must never import comparekit.js — the live
                    # build, source, tier, both builder knobs, and the Schluter
                    # registry bag (stockRows/bookStockReady/books/
                    # loadBookItems/mortars/mortarDefault) the tab needs to
                    # assemble the OTHER engine's catalog. No build yet, or no
                    # registry rows, is a faint explanatory column, never a
                    # crash. `onQuoteOptions` lands both bills as option areas
                    # A/B and is passed only from the JOB-context mount.
                    # Also an Apps-hub tab beside Sheoga (embedded, still its
                    # own lazy chunk): the tier bar falls back to a local
                    # retail-seeded preview and Add raises the hub's shared
                    # destination prompt (current project / new quick price);
                    # the hub gets the registry bag too (so Compare works
                    # there) and an `onQuoteOptions` that raises the hub's
                    # destination prompt (no host area to land on).
                    # A basket drawer (ADR 0035 step 3, the Sheoga idiom via
                    # the shared KitBasketPanel): staged entries persist in
                    # the shared project.showerBasket ("Basket" beside Add;
                    # `stageBuild` stamps brand "wedi", `stageEntry` stages a
                    # given entry for Compare) and the drawer is the lazy
                    # ShowerBasket.jsx chunk, mounted the first time it opens
                    # (spec 2026-09-29) — it lists and prices BOTH brands and
                    # takes `onAddOptions`/`freeSlots`; the resume prompt keeps
                    # pricing through wediEntryView. The derived
                    # In-this-project section reconfigures/removes placed
                    # kits (App remounts on a pid+nonce key so reconfiguring
                    # the CURRENT kit re-seeds too), delete-on-move stands,
                    # and a staged entry carries its `session` sibling
                    # (qtyOv, the Fit flag, and — since 1c only for a
                    # Browse-only build — the manual extras) beside the
                    # marker snap, so a staged-then-moved kit bills what was
                    # on screen. A Reconfigure gets `editRows` (App: kitRows
                    # of the anchor) and seeds qtyOv/manual from them once
                    # on mount (sessionFromRows over the marker rebuilt with
                    # the default session), so a quantity typed on the sheet
                    # reopens as the override, not the recipe's figure.
                    # Ticket 158 Phase 1a (ADR 0049): ⇄ on the cover line
                    # opens `DrainSwapPop` (drainswap.jsx) — a linear pan's
                    # style/finish chips at the channel's current length, a
                    # point pan's finishes only, the frame keeping its own
                    # chip — seeded from the committed `coverPick` as a DRAFT;
                    # Use this commits it (plain stainless commits no pick, as
                    # `legacyCoverPick` already reads that as the default) and
                    # arms the kit-card overwrite confirm (kitDirty); Esc/
                    # outside click discards.
                    # `escActive` (default true) gates its Escape handler —
                    # the Apps pane passes false while it is hidden (ADR
                    # 0047).
                    # Ticket 158 Phase 1b (ADR 0049): ⇄ on the curb and the
                    # wall panel line opens `SwapPop` stepped (Style →
                    # Profile-on-AT-only → Length for the curb, Type →
                    # Thickness → Size for the panel, "Panel kit" a third Type
                    # chip); the fastener kit swaps via a one-click list.
                    # `curbPick` seeds from the old marker via `curbPickOf`
                    # and survives a room re-solve the way `coverPick` does; a
                    # kit-card reset wipes both. The panel ⇄ lives on the
                    # walls' panel line only — the bench's own sheet line
                    # doesn't open it. A cover pick that can't apply to the
                    # pan (`coverPickApplies`) stays inert. In a Browse-only
                    # build (no `build.pan`) every opts-backed ⇄ — cover,
                    # cover frame, curb, panel, fastener kit, joint sealant
                    # form, curbless recess/ramp — is hidden: only the curb
                    # ⇄ crashed there, the others would write settings a
                    # Browse-only build ignores. (1b hid opts-backed ⇄ on a
                    # kit build's Browse-added lines too; 1c replaced that —
                    # an added line's ⇄ writes its own row, below.) The curb
                    # popover's Δ counts only the kit's curb. A curb pick is
                    # cleared when the room's curb type changes (Curbed ⇄
                    # Curbless): it belongs to the curb type it was made for.
                    # Ticket 158 Phase 1c (ADR 0049): every bucket header
                    # carries a "+" (`data-add-group`), shown even on an empty
                    # bucket. It opens `SwapPop` in add mode: a Part row when
                    # the bucket offers more than one part (`wediAddParts`),
                    # then the part's stepped rows with no Auto (curb →
                    # `curbAddOptions`, panel → `panelOptions`, cover →
                    # `coverAddOptions`) and a qty stepper, or a one-click
                    # list (stock-first, a search box past 12 rows). The
                    # draft starts on the part the kit already bills. Added
                    # lines are `manual` rows `{ key, qty, group }` keyed by
                    # bucket + key (`setAddedRow`); `seedState` reads them
                    # through `addedRows` (old `addons` translated) and the
                    # marker saves them — `addons` state is gone. Browse,
                    # the chips and the figurer add under the part's own
                    # bucket; Browse's counter shows that added qty. Each
                    # added line is its own line with its own stepper, an
                    # "added" tag, "kit also bills N" when a kit line bills
                    # the same part (tag and hint hidden in a Browse-only
                    # build; screen only, never print), and a ⇄ that opens
                    # the "+" panel on its own part and replaces only that
                    # row, keeping its qty. A kit line's stepper
                    # (`stepLine`) writes `qtyOv` and never touches an added
                    # row; a placed premade bench (`auto:false` kit line)
                    # shows its count with no stepper. Niche · Seat · Bench
                    # · Glass shelf chips add another each click ("✓ Niche
                    # ×2"); Sealant gun stays a toggle. A room re-solve
                    # keeps added lines; the kit-card hard reset and Clear
                    # design clear them. The curb drawing and "Turn into a
                    # curb" read only the kit's own curb. Reconfigure tops
                    # up an added row by what the sheet carries beyond it.
                    # Ticket 158 Phase 1d (ADR 0049): the bill and the print
                    # sheet draw the nine shared groups (slots.js `GROUPS`,
                    # a line under `groupOf(line.slot)`) in place of the six
                    # buckets; a group with no lines and nothing its "+" can
                    # add stays hidden (the fixture book has no Extras
                    # "Other" parts, so it draws eight). The add-on chips
                    # (Niche · Seat · Bench · Glass shelf · …) are their own
                    # "Add-ons" block below the groups, as on Schluter; what
                    # a chip adds lands in its own group. `openAdd(grp, …)`
                    # takes the shared group; the panel keeps `add.grp` (the
                    # parts list) and `add.g` (the bucket rows are keyed
                    # under — the added line's own, else the part's).
                    # `data-add-group` carries the group label ("Niches").
                    # Browse-only lines get a `slot`. The Walls Fit /
                    # One-size control shows only when Walls holds a kit
                    # panel (fasteners now share the group). The popup holds
                    # Compare's `mirror` state (hand picks and drops for the
                    # Schluter column) for the session and passes
                    # `mirror`/`onMirror` to CompareTab.
                    # Ticket 158 Phase 2 (ADR 0051): the
                    # Building Panel | Membrane (S-DRY) segment sits on the Kits tab (Membrane
                    # lists the four S-DRY bases, each priced as a full S-DRY build) and in a
                    # Custom-tab Wall system group. State is `wallSys`/`sdryBase`/`sdryNear`
                    # (seeded from the marker). A change re-solves through one effect keyed on
                    # all three, so the solve reads the new state. Under S-DRY, the drain pin
                    # and Pan against are disabled (the base is cut evenly). No S-DRY fit shows
                    # an inline prompt (`data-wedi-sdryask`): wedi pan + S-DRY walls, nearest
                    # S-DRY base, or Back to Building Panel. A non-fit answer wears a bill chip
                    # (`data-wedi-sdrychip`) that reopens it. The subtitle and the print head
                    # name the wall system; the backer hint shows on the bill and prints under
                    # the install notes. The S-DRY cover and curb ⇄ are one-click lists,
                    # as is the membrane roll (standard / XL, `membraneKey`). A bench
                    # sheet line's ⇄ lists the 2" or ½" sheets for every bench
                    # (`bench2Key`/`wrapKey`), open under Fit too (Fit plans only the walls).
                    # `applyPanelFit` skips a build with no kit panel line.
                    # Flipping to Building Panel never wipes hand work silently (build
                    # amendment 21): on the Custom tab the room is kept and re-solved for wedi
                    # pans, but on the Kits tab a loaded S-DRY kit with `kitDirty` or hand-added
                    # lines asks first through the kit-overwrite confirm (`KitOverwriteConfirm`,
                    # `confirmBoard`/`confirmBoardModal`) — Cancel keeps Membrane. It passes
                    # `BOARD_FLIP_COPY`, which says what the switch clears (the S-DRY base,
                    # drain, curb and membrane) and what each choice keeps.
                    # Phase 4 (ADR 0052): props `compareSet`/`onCompareSet`/
                    # `onOpenCell`/`onResume`/`savedBy`/`startDetached`. The
                    # body keeps the build on screen in the shower's Compare
                    # set AS IT UNMOUNTS (a `keep` ref + one cleanup effect —
                    # every close path passes through it), skipping a write
                    # that changes nothing; a Browse-only build has no marker
                    # to keep. A `seed.tab: "compare"` marker seed lands on
                    # Compare (the hand-off); `startDetached` starts the
                    # `detached` fork (App: the row already holds a kit). A
                    # fresh start (not `isMarkerSeed`) on a shower that keeps
                    # a wedi build raises `ResumePrompt`. The panel Fit plan
                    # moved into wedi.js (`panelFitLines`).
  panelplan.js      # `planPanels(walls, sheets)` — the wall-board course
                    # planner both shower engines share (wedi `panelPlan`,
                    # Schluter `boardPlan`; owner 2026-09-22): full courses
                    # at the widest sheet, shorter courses as strips ripped
                    # from sheets SHARED across walls (lane packing, then each
                    # sheet drops to the cheapest size that holds its lanes),
                    # a wall stood vertical only when one column covers it.
                    # Every wall's options are shortlisted and the combination
                    # picked by fewest vertical seams unless >25% dearer than
                    # the cheapest plan, then fewest pieces and rips unless
                    # >20% dearer, then cost. Lines come out in first-use
                    # order; detail is index-aligned with the walls
  showerdraw.js     # the shared shower drawings' pure-geometry half — TopDown/
                    # Iso's constants and math, extracted out of
                    # WediConfigurator.jsx (issue 097, ADR 0033) so a second
                    # configurator (Schluter, phase 3) can draw the same shower
                    # shape without paying for wedi's ~2 000-row tables: this
                    # file and its JSX half MUST NEVER import wedi.js, in
                    # either direction of the dependency — wedi.js imports
                    # FROM here, never the reverse. No JSX, so plain
                    # `node --test` can parse it through wedi.js's import of
                    # its six geometry exports (WALL_THICK, CURB_LAP,
                    # panThick, benchFootprint, BENCH_DEPTH, and the private
                    # curbWidthOf — wedi.js wraps that last one in its own
                    # exported curbWidth(key), which still resolves a string
                    # key through the catalog before calling it). Also carries
                    # the drawing-only geometry: curbCornerOut (the one place
                    # a curb run's reach past the room line is figured — both
                    # drawings read it so they can't drift apart), bandPoly/
                    # curbBands (mitred plan outlines), framedStandIns, slopeMarks
                    # (fall-line hips + arrows off the drain), topGeom, and
                    # railSplit (the rail's box-fit sizing: natural 328×268 /
                    # 328×306 proportions while both fit the measured column,
                    # then only the HEIGHT gives — in drawing units, not
                    # pixels, so type never shrinks — split 268:306 down to a
                    # floor below which the rail scrolls as before). round2/
                    # inch are deliberately duplicated from wedi.js rather than
                    # shared — one comparison point, not worth the reach across
                    # modules for two one-line formatters
  showerdraw.jsx    # the shared shower drawings' React half — `TopDown` (plan)
                    # and `Iso` (isometric), the two components WediConfigurator's
                    # rail and Schluter (phase 3) render, imported from here
                    # rather than duplicated (ADR 0033). `export * from
                    # "./showerdraw.js"` so a caller gets both halves — geometry
                    # and components — off one import line. Same never-import-
                    # wedi.js rule as its .js half. TopDown draws wall bands at
                    # their TRUE lengths (4"-thick, reaching into a corner only
                    # where a perpendicular wall or curb run actually claims it —
                    # exactly one slab per corner square), panel-seam ticks, cut
                    # edges dashed, curb runs, the drain with slope arrows/hips
                    # off `slopeMarks`, and dimensions; a square-drain pan's hips
                    # aim at the UNCUT pan's corners, clipped to the material that
                    # remains, since the folds are moulded at the factory and a
                    # site cut doesn't re-pitch them (owner 2026-08-03). Iso draws
                    # the same build as 4"-thick wall slabs at per-wall heights,
                    # front (entry/right) walls clear with dashed edges, and the
                    # panel courses dotted on the inner faces. Bench rendering
                    # lives here too — premade part tags, site/framed bench
                    # bands in plan and iso, and the curb butting the bench
                    # face where a bench zone meets a curb run. All click targets
                    # (onCorner/onEdge/onWallMenu/onBenchMenu) are callback props
                    # — the caller (WediConfigurator.jsx today) owns what a click
                    # DOES; this file only owns what gets drawn and where a click
                    # landed. `itemFn` (the catalog part lookup) and `normBenchFn`
                    # (normBench) are REQUIRED whenever `benches` is non-empty —
                    # a premade bench's tag reads itemFn(b.part), and the hover
                    # preview reads normBenchFn(zone, room); only the mini
                    # thumbnail (WediConfigurator.jsx's kit-card preview) omits
                    # all three props, since it never renders benches
  showersf.js       # tile sq ft per piece of a placed wedi/Schluter shower
                    # from its saved cfg. LAZY-CHUNK-ONLY (imports both
                    # engines); loaded only by usejobshowers.js. Ticket 158
                    # Phase 1b (ADR 0049): the wedi curb piece resolves
                    # through `markerCurbKey` (wedi.js) instead of reading
                    # `cfg.curbKey` directly, so tile sf follows the same
                    # choice `kitFor` bills; a stale `curbKey` (not in the
                    # book) tiles the recipe curb, as it bills (R2).
                    # Phase 1c: the wedi niche back reads the added rows ×
                    # qty through `addedRows` (old `addons` translated), the
                    # way the Schluter side already read `cfg.manual` × qty,
                    # so several niches count; an old marker gives the same
                    # figure (addedgolden.test.js).
  slots.js          # the shared bill-line slot vocabulary (ticket 158 Phase 1,
                    # ADR 0049): `SLOTS`/`SLOT_LABEL`/`isSlot`, a pure,
                    # import-free module both engines and Compare read
                    # so a Schluter line and a wedi line for the same role
                    # (drain body, grate, flange, wall board, curb, …) read as
                    # the same kind of thing — never re-derive the list from a
                    # bill's own group names. Phase 1d: `GROUPS` (the nine
                    # shared bill groups in the owner's order — Base · Drain ·
                    # Curb · Walls · Seams · Niches · Bench · Setting · Extras
                    # — each holding one or more slots, every slot exactly
                    # once), `groupOf(slot)` (an unknown slot → "extras") and
                    # `groupLabel(key)`. Both bills, both print sheets and
                    # Compare draw a line under `groupOf(line.slot)`; the
                    # engines' own groups (Schluter `l.g`, wedi buckets) stay
                    # internal keys, never translated (slots.test.js)
  kitlabel.js       # how a part READS inside the wedi / Schluter popups
                    # (.scratch/160, owner 2026-09-28): `kitLabel(name, hint)`
                    # → { size, name, fromHint, rest? } — the size leads, tight
                    # ("48×96×½″", no spaces round ×; a foot-led trade size up
                    # to 8′ reads in inches, a roll length past 8′ in feet),
                    # then `cleanKitName` — wedi / Schluter / KERDI-family words
                    # and Subliner Dry (as a prefix) off; S-Dry STAYS (owner).
                    # The name's own size wins; `hint` (the item's sizeText /
                    # size) fills in when the name has none or holds the fuller
                    # size (curb profile, board sheet under the name's
                    # thickness, band width × roll length). Since ADR 0054 the
                    # entry names carry no size, so the hint is the usual
                    # source (pinned in kitlabel.test.js). DISPLAY ONLY — the
                    # rows that land, the print, order entry and Compare's
                    # quote-option names keep the vendor text. Mounted by both
                    # build columns and every Compare line (Qty | Size + item |
                    # Price); Compare rows carry `size` for it (comparekit.js).
                    # wedi's S-DRY SEAL "2 x 16 oz" and the drain covers'
                    # "3/3/4" typo no longer parse as dims (wedi.js dims(),
                    # ADR 0038 amendment 2026-09-28) (kitlabel.test.js)
  swappop.jsx       # `SwapPop` — the shared stepped popover (ticket 158 Phase
                    # 1a, mockup layout A; renamed from `DrainSwapPop` in 1b,
                    # which also folded in the two popups' duplicated Δ
                    # formatter) both configurators mount over `PopMenu`
                    # (widgets.jsx) for the drain AND every stepped 1b line
                    # (membrane, band, wedi curb, wedi panel): rows of chips
                    # plus a summary strip (what will land, why, the Δ against
                    # the committed line at the tier price, Use this). It
                    # renders a draft only — each popup owns what a chip means
                    # and what Use this commits (`cfg.drainPick`/
                    # `cfg.swaps.grate`/`cfg.swaps.membrane`/`cfg.swaps.band`
                    # for Schluter, `coverPick`/`curbPick` for wedi); Esc / an
                    # outside click discards the draft on the existing swap
                    # step of the Esc ladder. `fmDelta` (the shared Δ
                    # formatter) and `inchGlyph` (chip inch text) live here
                    # too; `stockFirst` only reorders a row's chips
                    # stocked-first under Stock only — the SO chip dot itself
                    # renders off each chip's own `c.so`, regardless of
                    # `stockFirst`. The `data-drain-*` DOM
                    # attributes are kept on every stepped popover (not just
                    # the drain) so the 1a proof scripts still run unchanged.
                    # Phase 1c: it is also every group's "+" popover. `add`
                    # marks it (`data-add-pop`); `qty`/`onQty` put a qty
                    # stepper in the summary strip (`data-add-qty`; the
                    # caller always passes `qty`); `children` render under
                    # the rows (a one-click part list); `summary` is
                    # optional — a list popover has no strip
  schluter.js       # Schluter shower-system engine (issue 097 prototype ->
                    # production, tasks 1-6) — wedi's sibling, deliberately
                    # built the opposite way: TABLE-FREE. `classify()` is a
                    # grammar over Schluter's SKU codes (KST/KSLT trays, KLVR
                    # Vario drain, KERDI-DRAIN, KERDI-BOARD panels/curb/niche/
                    # bench, KERDI membrane/band/corners/seals, ALL-SET/
                    # KERDI-FIX) plus the shared mm->inch marketing-round
                    # table every tray/curb/board/kit SKU is built from
                    # (`MM_IN`, greedy-longest-key digit scan so a fused code
                    # like 9151395 resolves to [915,1395] and not any other
                    # split; a KSLT linear tray's w is its CHANNEL edge —
                    # Schluter's first dimension — not the longer side, so
                    # the 38″- and 76″-drain twins land in different rooms,
                    # ticket 158 P0-1; the fixed KERDI-LINE range — channel
                    # bodies, grates, FC connectors, profiles, accessories —
                    # classifies as its own g:"line" so no buildKit drain
                    # pick can reach it, P0-2; `coverageOf` — sf per roll/
                    # board, lf per band — feeds both popups' "108 sf ·
                    # $1.92/sf" Browse line and the build lines' $/unit,
                    # P0-3) — no per-item lookup table, so a caller feeds it
                    # LIVE registry-book rows (`catalogOf`) and a re-import
                    # reprices/re-ranges the configurator with no code change
                    # (ADR 0032, the deliberate divergence from wedi.js's own
                    # transcribed tables). `trayCandidates` ranks the fit
                    # window (covers the room, total cut <=26") by drain
                    # match, then — curbless only — a thin "TT" tray beats a
                    # lipped one (decision 6: a curbed tray doesn't belong on
                    # a curbless install even if it cuts less), then cut size,
                    # then price; no fit at all is a single mortar-bed card,
                    # never silently dropped. A pinned drain (cfg.drainX/
                    # drainY, issue 100 — the wedi waste-line case) never
                    # moves the MOULDED drain on the tray: it splits the
                    # total cut between the sides (cutL/cutB vs the far
                    # edges) to land the drain as close as the tray allows,
                    # each candidate carrying dx/dy/miss, and pinned rooms
                    # rank by miss before cut size — so a bigger tray whose
                    # cut reaches the pin outranks an exact tray that can't.
                    # Added walls (cfg.xwalls — entry returns, jogs, issue
                    # 100) feed wallArea like any wall — per-wall `faces`
                    # (round 6, the wedi rule: "both" doubles the plane,
                    # "in-end" adds the WALL_THICK end strip) rides each
                    # walls/xwalls row. `openRuns` (round 6, the wedi
                    # curbRuns rule) is where the curb actually runs: EVERY
                    # open span of the perimeter, not just the entry — a wall
                    # turned off hands its edge to the curb, cut corners
                    # adjacent to open runs turn ONE diagonal figured at its
                    # longest point (leg + CURB_W each way, the exported
                    # 4.5" KBSC width schluterdraw imports), each touching
                    # run gives up the leg; billing and the drawings read
                    # the SAME openRuns so they can't drift. `entryOpening`
                    # stays for the note text; a fully walled room carries
                    # no curb line at all. A curbless build bills the ramp
                    # ONLY on cfg.ramp (opt-in chip, owner 2026-08-24 —
                    # never auto), and KERDI-FIX left the standing recipe
                    # the same day (it rides the tub kit, not every shower —
                    # the popup offers a chip); the standalone KERECK
                    # corner + KERDI-SEAL lines left too (owner flag
                    # 2026-08-24: the KD flange kit boxes 4+2 corners and
                    # both seals — separate packs double-billed, and a live
                    # book's 10-pack rows made it 2×10; the approved-bill
                    # pins moved deliberately, now 7 lines / $671.87).
                    # Round 7 — the KERDI-BOARD panel planner, the wedi
                    # panelPlan doctrine over the LIVE board range (never a
                    # transcribed sheet table, ADR 0032): classified boards
                    # now carry bw/bl (sheet sides, from text or the KB
                    # code's own dims); `boardSheets` derives the ladder
                    # (one entry per size, stocked-then-cheapest);
                    # `expandBoardFaces` turns cfg walls+xwalls into planner
                    # faces in schluterWalls' exact order, extra faces
                    # appended AFTER so detail[i] indexes the drawn walls;
                    # `boardPlan` runs that ladder (priced off each
                    # board's registry price) through panelplan.js.
                    # halfBoardPool is the ONE wall-panel pool Fit and the
                    # One-size area pick both draw from (exported — the
                    # popup's board swap lists it). wallArea is exported
                    # (the popup's plan note reads it). cfg.swaps (round 9)
                    # lets a hand pick win its role in buildKit — grate,
                    # curb (qty re-figured for the chosen length), One-size
                    # board — looked up by sku WITHIN the role so a stale
                    # sku falls back to the recipe, never the wrong part.
                    # orderCopyLines (round 8) is the clipboard rule.
                    # cfg.drain "any" (round 2) pools every tray and the
                    # PICKED tray decides what gets billed and drawn — the
                    # channel vs flange/grate/corner-pack branches key on
                    # cand.tray.drain, the mortar fallback on the stated
                    # preference; under a pin a linear tray's miss scores
                    # against its fixed channel run, never a free zero.
                    # `cfg.drain` stays that TYPE preference ("linear"/"point"/"any"); ticket 158 Phase 1a (ADR 0049)
                    # adds `cfg.drainPick` — the swapped drain CHOICE (family/design/style/frame/finish/offset),
                    # resolved fresh into lines every build by `resolveDrain(choice, panW, cat, opts)` (no choice =
                    # Vario, unchanged default), whose `{family,len,gap}` rides `buildKit`'s return as `drainFit` for
                    # schluterdraw.js and the cut list. `drainOptions` re-runs `resolveDrain` per candidate chip so the
                    # popover (drainswap.jsx) can never offer what the engine would refuse. `slotOf(g, item)` tags
                    # every buildKit line with its shared slots.js slot (catalog facts first, the bill group as
                    # fallback) — Compare (comparekit.js), 1b-1d's swap/picker UI and (1d) the bill's display
                    # group (`groupOf(slot)`) read it, not the engine group name.
                    # cfg.corners (45° cut corners, the wedi CORNER_CUT
                    # 12" legs) grow the curb need by each cut FRONT
                    # corner's diagonal extra — back corners never touch
                    # the bill. `pickFrom`/`stockPool` (phase 4)
                    # are the one stock-only rule every buildKit pick runs
                    # through: under "stock" a stocked match wins, a role with
                    # no stocked option lands flagged (grates and channels
                    # used to vanish), and a SO covering curb loses to stocked
                    # multiples cut end-to-end (the P2 60"→2×48" example);
                    # under "all" both are identity, so the pinned totals
                    # can't move. `pickRolls` is the same
                    # greedy-ladder idea for membrane coverage (largest roll
                    # for whole multiples, smallest single roll for the
                    # remainder), reused for both floor and wall membrane.
                    # `buildKit` is the ported prototype recipe (decisions
                    # 2/4/6 pinned in the header comment): BOTH drain flange
                    # kits self-contained (the KD point/offset box carries
                    # the same 4+2 KERECK corners + pipe/valve seals the
                    # Vario kit does — verified against retail listings
                    # 2026-08-24 — so no build lands standalone corner/seal
                    # lines), curb
                    # multiples cut end-to-end with their own corners,
                    # membrane walls +10% for laps with a by-others backer
                    # note line, board walls at 1.05x coverage + fasteners,
                    # ALL-SET at ceil((wallSf+floorSf)/55), a curbless build
                    # taking the ramp instead of a curb, benches per decision
                    # 4 (framed -> 1/2" wrap, buildup -> 2x 2" board), and a
                    # no-fit room falling back to `cfg.mortarItem` (a Settings
                    # -> Materials pick, its own rate) plus KERDI over the
                    # cured bed — decision 2, never a $0 by-installer line.
                    # Benches (parity round 3, 2026-08-22): `cfg.benches`
                    # rides the wedi bench-row shape through this module's own
                    # `normBench`/`cfgBenches` (a legacy `cfg.bench` flag
                    # normalizes to one back-wall bench, so old markers keep
                    # their bill) — decision 4's bill per bench: framed → the
                    # ½" wrap board, site → 2× 2" board, premade → its own
                    # line, the SB piece's dims derived off the KBSB SKU code
                    # (`classify` stamps `extra: niche/bench/benchkit` +
                    # `bench` dims so the popup's chips and menus never key on
                    # name text). A FRAMED bench holds the tray short of the
                    # room (`benchTrayRoom`, the wedi only-framed-interrupts
                    # rule) but the TRAY CHOICE never moves on its own (owner
                    # 2026-08-24): the bench row's `trayFit` is the wedi
                    # panFit fork — "cut" (default) ranks the FULL room and
                    # the bench face cut is a site cut buildKit notes, while
                    # "smaller" re-runs trayCandidates in the clear space
                    # with the drain pin shifted by x0/y0 AND, unpinned,
                    # auto-pins the clear space's CENTRE (cand.centered) so
                    # the re-fit chases a centred drain; typed drainX/Y
                    # always wins. `tierPrice` is the ADR 0032 lens: retail is a stocked
                    # row's own registry price, or cost x1.5 for a
                    # special-order row with no shelf price of its own
                    # (the shop's own observed markup, not wedi's
                    # publish-retail model); builder subtracts Settings'
                    # `pricing.schluterBuilderPct` (its own knob, default 8%
                    # — never shares wedi's or the flooring tier's percent).
                    # `classify` also derives the FACTS `buildKit` keys on
                    # (corner inside/outside, seal pipe/valve, fastener + ct,
                    # adhesive, membrane `wide`) — never name text, because a
                    # live row's name is normOrderItem's CLEANED (title-cased)
                    # description and a name regex silently misses on it
                    # (phase-3 ride-along; pinned by the name-case-immunity
                    # test). `lineItems(build, opts)` is wedi-shaped: the
                    # caller composes { ...buildKit(...), mode, cfg } —
                    # mode "kit" for an untouched Kits pick, else "custom" —
                    # and every surviving (non-`noteOnly`) line lands RETAIL
                    # for the job sheet's own tier lens to reprice (ADR
                    # 0018), with a builder-tier snapshot riding along; the
                    # anchor row carries `cfg` untouched so "Schluter —
                    # reconfigure" can re-run `buildKit` and replace the
                    # kit's lines, companions carry `{ part: true }`. ADR
                    # 0054 (2026-10-01): `catalogOf` keeps the book's text on
                    # `desc` and sets `name`/`size` from `partText(e)` —
                    # derived from the classified part ("KERDI-SHOWER-T Tray"
                    # · `38"x60"`, "KERDI-DRAIN Flange Kit, PVC" · `2"`,
                    # "KERDI Membrane, 108 sf" · `3'3"x33'`, "KERDI-BOARD-SC
                    # Curb" · `60"x6"x4-1/2"`), no brand word, the book text
                    # only as the fallback for a code the grammar doesn't
                    # size. `lineItems` lands `brandColor: e.name`,
                    # `sizeText: e.size`; the old "Schluter — " lead is gone,
                    # and a non-classified item (the Settings mortar) lands
                    # its own name. The grammar also reads a point drain's
                    # `pipe` + `material`, a KERECK pack's `ct`, a niche's mm
                    # pair (its own table), and the EFT's slash-less roll
                    # codes. Geometry (the Iso/TopDown drawings) is
                    # deliberately NOT this module's concern — that mapping
                    # lives in schluterdraw.js, and every live row this
                    # module sees crosses schluteradapter.js first.
                    # `buildFromMarker` is the same rule over the LIVE catalog
                    # (cfg.pick keeps the quoted tray; cfg.manual extras ride
                    # along); the popup's drawer gates it on catReady and
                    # applies its own board plan (ADR 0035 step 3).
                    # Ticket 158 Phase 1b (ADR 0049): classified rows carry
                    # `rollCode`/`roll`/`width`; `resolveMembrane`/
                    # `membraneOptions` and `resolveBand`/`bandOptions` are
                    # the stepped-line engines `buildKit` calls for
                    # `cfg.swaps.membrane`/`.band`, chip `ok` running the
                    # resolver rather than a hand-written rule; `cfg.swaps`
                    # also takes `.fastener` (a sku, count re-fit) and each
                    # bench's own `board`; `buildKit` returns `need` (
                    # `{wallSf, bandLf}`) and lines carry their `bench` index
                    # so the popup's list swap can key on group+bench+sku;
                    # `pointGrateLabel` reads the point grate's plain-English
                    # chip text. The point flange kit bills 2" PVC by default
                    # (owner 2026-09-30 — the live book also stocks a cheaper
                    # ABS kit, which the old first-match pick could land under
                    # a PVC note); `cfg.swaps.flange` picks another point
                    # flange, and `flangePipe` reads material + size for the
                    # note.
                    # Ticket 158 Phase 1c (ADR 0049): added lines are parts +
                    # a hand-set qty, never choices. `cfg.manual` rows gain
                    # `g` (the engine group they're keyed under, one of
                    # `BILL_GROUPS`); `addedGroup` files a row with no `g`
                    # where the kit bills that part (`slotOf` → the slot's
                    # group), so old Extras rows move group with no bill
                    # change. `addedLines(manual, cat)` turns the rows into
                    # bill lines flagged `manual` (`buildFromMarker` and the
                    # popup both use it); `addedQty`/`setAddedQty` read and
                    # set one row keyed by group + sku (0 removes it).
                    # `ADD_PARTS`/`addParts(grp, cat, { linear })` are what each
                    # group's "+" offers — a part the catalog lacks never
                    # shows, and the whole drain is a linear build's only;
                    # `addPartOf(grp, item)` is the part an added line's ⇄
                    # swaps within. Phase 1d re-keyed both by the shared
                    # group (slots.js `GROUPS`, `grp`): each part stores the
                    # engine `g` an add writes (Niche and Bench still write
                    # `g: "Extras"`), and its `hit` only matches parts whose
                    # `slotOf(g, item)` lands back in the offering group.
                    # `BILL_GROUPS` and `addedGroup` still speak engine `g`
                    # — the bill draws under `groupOf(line.slot)`.
                    # `addRollOptions` is the membrane/band Width → Roll rows
                    # with no Auto; `drainAddOptions` is the linear drain's
                    # rows plus a Length row, its chips `ok` only at a length
                    # the resolver actually lands (between lengths steps
                    # down, below every length falls to the shortest).
                    # `sessionFromRows` takes the marker's added lines off
                    # each placed total first, so only a kit line's hand-set
                    # qty becomes `qtyOv` (addedgolden.test.js).
                    # `applyBoardPlan(lines, cfg, plan, cat)` swaps the kit's
                    # by-area board line for the Fit plan's per-sheet lines
                    # in place (first line carries the sf/seam note) and
                    # `applyQtyOv(lines, ov)` applies the hand-set qtys (0
                    # drops a line) — the popup's build column, Reconfigure
                    # and basket drawer all run them; both leave `manual`
                    # lines alone (1c final review)
  schluterfixture.js  # the 2026-08-20 stock-sheet/EFT snapshot schluter.js's
                    # tests are pinned against (schluter.test.js) — the ERP
                    # Vendor SKU Analysis + dealer-cost EFT the prototype was
                    # approved on. Production NEVER reads this file; it exists
                    # so `classify`/`buildKit`/`tierPrice` have a real,
                    # stable catalog to run against without a live Supabase
                    # book (the registry-driven design, ADR 0032, means there
                    # is no other fixture to fall back on)
  schluterkitview.js  # pure Schluter basket pricing lifted out of the popup:
                    # `schluterTierOf` (the tier lens), `schluterEntryView` (marker +
                    # optional staged session + { cat, catReady, tier, … } → { title,
                    # meta, price, faint?, lines }). Imports schluter.js only, so the
                    # lazy basket drawer can reuse it beside wedikitview.js;
                    # SchluterConfigurator wraps it with its own ctx
  schluterquery.js  # the Schluter search-entry recognizer — the BOOT half of
                    # task 6, wediquery.js's sibling: `queryHit`/`parseQuery`/
                    # `querySummary`/`seedFromQuery` over ~20 trade words
                    # (KERDI/Vario/KST/KSLT/KBSC family vocabulary + generic
                    # parts needing "shower" or a size beside them) and the
                    # same size regex, so the pinned "Vendor configurators"
                    # row can decide on every keystroke without schluter.js's
                    # registry-fed catalog. Two binding word-list exclusions
                    # (owner/task-brief): Ditra stays out — a Schluter brand,
                    # but a floor product, not a shower part — and "wedi"
                    # stays out, so either word routes to the OTHER vendor's
                    # configurator, not this one. Bare "schluter"/"sch" is
                    # recognized only by a prefix match (never listed as its
                    # own word, same trick as wedi's own name in
                    # wediquery.js) so a bare brand mention lands on the
                    # shelf-kit tab rather than the catalog. Must NEVER
                    # import the engine module — it re-exports these four
                    # (ADR 0026, schluterquery.test.js). A weak word + size
                    # can legitimately pin BOTH configurators' rows at once
                    # (the phase-3 call: each row renders on its own
                    # recognizer, wedi listed first)
  schluteradapter.js  # the registry→engine adapter (ADR 0032 consequences —
                    # phase 3's mandatory first deliverable): live rows are
                    # normOrderItem-shaped (`description` title-cased by
                    # cleanDescription, book-level stock kind, the ERP stock
                    # export's shop code in `sku` with the manufacturer code
                    # in `vendorSkus`), while the engine was built against
                    # the prototype-shaped fixture. `adaptRow` tries the
                    # row's own sku then each vendorSkus entry and keeps the
                    # FIRST code classify() recognizes (null = not a shower
                    # part), mapping description→name, shop code→erp, the
                    # caller's book kind→stock; `dropStockTwins` drops adapted
                    # special-order entries whose code is a stocked entry in
                    # another skuKeys spelling (the EFT re-letters mfg codes —
                    # issue 099), stock winning; `mortarItemFrom` turns a
                    # Settings mortars entry into buildKit's cfg.mortarItem
                    # ({name, price, cost, stock, sfPerBagAt15}) — cost
                    # mirrors price (a Settings material carries one number;
                    # $0 on the Cost tier would lie) and the bed rate is the
                    # exported MORTAR_BED_SF_PER_BAG = 8 constant, since the
                    # Settings shape has no bed-coverage field. Tests build
                    # rows through the REAL normOrderItem, never hand-shaped
                    # literals (schluteradapter.test.js)
  schluterdraw.js   # Schluter build → the shared showerdraw shape: pure
                    # builders the popup feeds to TopDown/Iso exactly as the
                    # wedi popup feeds its own — `schluterDiag` (one
                    # room-sized tray piece, cut dims riding it the wedi
                    # cutdown way so cut edges dash; the drain at the
                    # candidate's ACHIEVED position — the moulded spot, or
                    # where a pinned drain's cut split lands it (issue 100) —
                    # keeping the off-centre warning for unpinned cuts and
                    # warning an unreachable pin's miss instead;
                    # the Vario channel at the pan's full width along the back wall — cut to the pan, owner 2026-09-26;
                    # a 4th `drainFit` arg (ticket 158 Phase 1a, ADR 0049 — buildKit's `resolveDrain` result) draws a
                    # fixed/frameless channel at its real length, centred, instead of the Vario full-width run),
                    # `schluterWalls` (the three fixed walls as dWalls, plus
                    # cfg.xwalls appended in the wedi extra-wall shape,
                    # anchored at whichever end their `at` says;
                    # 48"-panel course joints ONLY on board walls — membrane
                    # walls have no seams to tick — with y0/ch so the
                    # isometric draws the same joints), `schluterCurb` (one
                    # entry run over the OPENING the entry xwalls leave,
                    # butting them — fully walled = no band —
                    # the KBSC 4½"×6" profile; curbless = no band,
                    # the ramp is a build line — and a cut FRONT corner
                    # the run reaches turns the curb DIAGONALLY across it
                    # in the wedi diag shape, the run giving up the leg),
                    # (round 3: normalized benches thread through —
                    # `schluterDiag(cfg, cand, benches, drainFit)` draws the tray piece
                    # offset/reduced where a framed bench holds it short, and
                    # `schluterCurb(cfg, benches)` butts the entry run against
                    # a framed bench footprint that reaches the entry edge —
                    # both via schluter.js benchTrayRoom / showerdraw
                    # benchFootprint so the bill and the drawing can't drift),
                    # Round 7: `schluterWalls(cfg, plan)` — with a Fit plan
                    # each drawn wall takes its detail's courses (stacked,
                    # mixed lens, vertical walls seamless); without one the
                    # one-course 48" tick pattern stands in; membrane walls
                    # never carry courses either way.
                    # Round 6: `schluterCurb` reads the ENGINE's openRuns —
                    # every open edge carries a band (a wall turned off
                    # draws curb along its edge in both views), framed-bench
                    # spans subtract per edge, and `schluterWalls` passes
                    # each row's `faces` through so the drawings show the
                    # covered faces. `SCHLUTER_CURB_W` re-exports the
                    # engine's CURB_W (billing figures diagonals off it).
                    # `schluterWallOn`, and the round-2 corner pair:
                    # `schluterOpenCorners` (the wedi openCorners rule — a
                    # corner boxed by two walls can't be cut; the curb
                    # never boxes) and `schluterCuts` (cfg.corners →
                    # TopDown's cuts shape, silently dropping a stale cut
                    # behind a re-walled corner). Never
                    # imports wedi.js (ADR 0033 chunk hygiene)
                    # (schluterdraw.test.js)
  useschlutercatalog.js  # `useSchluterCatalog` — the registry→catalog
                    # assembly (task 3, phase 5), cut verbatim out of
                    # SchluterConfigurator.jsx so a later Compare tab inside
                    # the WEDI popup can build the same live Schluter catalog
                    # without duplicating it: stock cache rows adapted
                    # `{stock:true}` (bookStockReady gated) plus every active
                    # order book matching /schluter/i on name/brandLabel,
                    # fetched via `loadBookItems` and adapted `{stock:false}`,
                    # `active !== false && !disabled` filtered, stock winning
                    # SKU collisions in any skuKeys spelling (dropStockTwins —
                    # issue 099), through `catalogOf` — returns
                    # `{cat, catReady}`, the popup's own names, unchanged.
                    # LAZY-CHUNK-ONLY: imports schluteradapter.js, so it must
                    # never be pulled onto the boot path — only a
                    # `React.lazy` popup may import it
                    # `lineItems` stamps every line's sku (anchor `key`,
                    # companion `part: sku`; legacy `part: true`), and
                    # `ovKey`/`rowItemEntry`/`sessionFromRows` read placed
                    # rows back into the popup's session for Reconfigure
                    # (the wedi rule, ADR 0035 amendment 2026-09-02)
  SchluterConfigurator.jsx  # the Schluter popup, a `React.lazy` chunk (ADR
                    # 0026) — the React port of the approved prototype
                    # (`editRows` — the kit's rows from App via kitRows —
                    # seed qtyOv/manual once the catalog is up, through
                    # schluter.js sessionFromRows: the wedi rule)
                    # (.scratch/097, P1/P2), wedi's sibling over the same
                    # shell idioms (incl. the 2026-09-02 pair: Stock only by
                    # default, and KitOverwriteConfirm's keepAdded / newShower
                    # with the same `detached` rule — see WediConfigurator.jsx): Kits (every tray a row, grouped by TYPE —
                    # Point/TT/Offset/Linear family headers, each sorted
                    # smallest side then longest with the small side leading
                    # the label, the wedi issue-075 idiom — click one and
                    # the build column fills the shelf kit and you STAY on
                    # the tab, the clicked row highlighted; a TT pick lands
                    # curbless (issue 100 — the old click jumped to Custom);
                    # trays gray out under Stock only) / Custom shower
                    # (room + entry +
                    # drain — with the wedi "from left × back" drain-pin
                    # inputs, disabled on linear; the engine splits the cut
                    # to chase the pin, the cards say what it lands, the cut
                    # list says which sides the saw takes (issue 100) —
                    # the WALL-SYSTEM FORK — KERDI-over-backer vs
                    # KERDI-BOARD, Schluter's one structural choice wedi
                    # doesn't have — wall rows whose lengths follow the room
                    # plus wedi-style ADDED-wall rows (cfg.xwalls: end-flip
                    # name button, len × h, ×-remove) and a "+ Add wall"
                    # chip arming placing mode — TopDown's onEdge, which
                    # half of the edge you click picks the end it returns
                    # from (issue 100) —
                    # ranked tray option cards, and the
                    # mortar-bed fallback card with its Settings → Materials
                    # pick mapped through mortarItemFrom — decision 2. The
                    # add-on chips moved
                    # to the BUILD COLUMN's Add-ons group (issue 100, the
                    # wedi idiom) so a shelf-kit pick reaches them on every
                    # tab; round 3 (owner feedback 2026-08-22, .scratch/101)
                    # made a chip with several possible parts open a PICKER
                    # instead of one chip per catalog variant (the niches
                    # collapse to one "+ Niche" chip; choice lists narrow to
                    # stocked rows under Stock only unless none are) and
                    # moved BENCHES onto the DRAWING entirely — the shared
                    # showerdraw zone machinery (hover the tray along a wall
                    # or into a corner) now drives a Schluter bench menu:
                    # 2" build-up, framed + ½" wrap (wall zones only), or the
                    # premade SB benches read live off the registry (corner
                    # zones list the TA triangles, wall zones the RA
                    # rectangles), with size fields, a build seg and Remove on
                    # an existing bench's zone; round 4 (owner ask 2026-08-24)
                    # added ONE "+ Bench" chip back in the build column's
                    # Add-ons whose picker holds every form — 2″ build-up
                    # (wall or corner), framed, the premade SB list, and the
                    # KERS-B seal kits as accessory toggles — a placement
                    # pick landing on the next open wall/corner zone, existing
                    # benches listed with click-to-remove; the drawing's zones
                    # stay where a bench moves, resizes or changes build.
                    # Adding a bench (chip or drawing) bumps the popup onto
                    # the Custom shower tab (owner rule 2026-08-24), a framed
                    # bench's menu carries the wedi "Cut it down | Smaller
                    # tray" seg (trayFit — see schluter.js), and "Clear
                    # design" sits in the pop-head left of the Source switch
                    # (the wedi header action; pickKit resets through it).
                    # Benches ride the marker as
                    # cfg.benches (ids stay local; a legacy cfg.bench flag
                    # reopens as one back-wall bench) and any bench flips
                    # mode to "custom" like the other geometry. Wall bands
                    # (plan AND isometric) take a right-click WALL MENU —
                    # size × height writing into the same walls/xwalls rows
                    # the Custom tab edits, End seg + "Both ends" mirror +
                    # Remove on added walls, Turn off on base walls; no faces
                    # seg, the membrane/board fork is whole-shower. Esc
                    # ladder: payload → picker → bench menu → wall menu →
                    # close; each menu also closes on a press outside.
                    # Round 2 (owner screenshot, same day) finished the
                    # wedi form: an "Any" drain preference (pool everything,
                    # the pick decides), "Sizes are — Tray size | Max — curb
                    # inside" + Tile thickness (parseIn fractions; the entry
                    # curb + tile step inside the stated depth, popup-level
                    # like wedi's maxIn), editable base-wall lengths with a
                    # Default height box (blank = auto), the ⇄ room flip
                    # (w↔d, the drain pin follows, typed lengths re-auto),
                    # and 45° corner cuts — "✂ Cut open corners" + a corner
                    # click on the drawing, openMap-gated, the curb turning
                    # cut front corners diagonally. The drain pin's X carries
                    # a Left|Right DATUM toggle (owner 2026-08-22: a builder
                    # calls the drain off the right wall — type it as given):
                    # the popup converts to the engine's canonical from-left
                    # drainX, the marker carries drainRef so Reconfigure
                    # shows the number as given, the cut list echoes both,
                    # and the ⇄ flip converts to from-left before rotating. "Pan against" is the one
                    # wedi control deliberately NOT ported: a tray is cut to
                    # the whole room, so there is no anchoring choice — the
                    # drain pin already picks which sides the saw takes.
                    # The marker cfg carries xwalls/drainX/drainY/corners/
                    # maxIn/tileT (cfg.w/d stay the EFFECTIVE tray dims;
                    # seedState adds the curb+tile back to recover the
                    # stated depth) and any of them flips mode to "custom") /
                    # Browse (filter board over the classified groups,
                    # factory kits ONLY here — decision 5 — the thin-set/
                    # KERDI figurer, stock-tinted stepper rows), over the
                    # shared build column (grouped lines — every line carries
                    # wedi's qty stepper (round 4): a recipe line takes a
                    # session-only qtyOv override (never in the marker, the
                    # wedi precedent), hand-set qty reads rust with the
                    # recipe's figure in the title, stepped to 0 the line
                    # leaves the bill, and a hand-added line steps its own
                    # manual row — from-stock meter,
                    # cost & margin behind a click, payload preview modal)
                    # and the showerdraw rail (TopDown/Iso via
                    # schluterdraw.js + the cut list) — plus a FOURTH tab,
                    # Compare (phase 5), which is the one surface that spans
                    # the whole body: the build column and the drawings rail
                    # step aside for CompareTab.jsx (its own React.lazy chunk,
                    # handed host="schluter", the live markCfg, the current
                    # build, the assembled cat, source, tier and both builder
                    # knobs). The Source switch
                    # (Stock only / Full catalog) is the shared SourceSwitch
                    # (widgets.jsx, phase 4) — both configurators mount it.
                    # Stock-only picks go through the engine's pickFrom/
                    # stockPool rule: a stocked match wins, a role with no
                    # stocked option lands flagged, never silently dropped.
                    # The catalog is LIVE registry rows through
                    # schluteradapter, assembled by the shared
                    # useSchluterCatalog hook (task 3, useschlutercatalog.js):
                    # the stock cache (bookStockReady
                    # gated) plus every active order book named/branded
                    # Schluter, fetched on open (ADR 0026's
                    # re-fetch-on-open pattern); stock rows win a SKU
                    # collision; an empty catalog after load names the
                    # import path instead of a blank pane (ADR 0032's
                    # inert-without-rows consequence). TierBar mirrors the
                    # job's tier both ways (ADR 0018) with Builder on the
                    # schluterBuilderPct knob; embedded (Apps hub) it falls
                    # back to a local retail-seeded preview like wedi. Same
                    # shrink-to-fit rig and open-layer/onConfigChange
                    # contract as the wedi popup; Add lands lineItems() via
                    # addSchluterLines, anchor row schluter:{mode,cfg} (the
                    # cfg also carries manual + source so Reconfigure
                    # restores add-ons and the source switch).
                    # Round 6 (owner verdicts on the issue-105 inventory,
                    # 2026-08-24): Kits-tab rows price the FULL kit through
                    # the tier lens (kitTotals — the wedi owner rule; the
                    # one number matches the build column) under a Kits-tab
                    # wall-system seg (same wallSys state as the Custom
                    # form; pickKit preserves it, a separate tab was
                    # rejected — two lists drift), with exception-only
                    # stock/SO tags (the wedi majority idiom); every number
                    # field is the shared NumIn (commit on blur/Enter — the
                    # wall/bench menus therefore dismiss on outside CLICK,
                    # not mousedown, so a blur commit lands first); toasts
                    # (`say`, .sch-toast) narrate wall adds, refused corner
                    # cuts, kit→custom moves — wall/corner/drawing edits off
                    # the Kits tab bump to Custom like a bench add
                    # (leaveKit); room-size commits clear wall lengths that
                    # only tracked the kit (the wedi retuneWalls rule); the
                    # wall menu grew the faces seg (Inside / Both sides /
                    # In + end → engine wallArea + drawings) and the base-
                    # wall action reads "Turn into a curb" on curbed builds
                    # (openRuns hands the edge to the curb); the curbless
                    # ramp is an opt-in "+ Ramp" chip (cfg.ramp — never
                    # auto-billed), "+ KERDI-FIX" is a chip since the recipe
                    # dropped it, and the Browse figurer gained "Add to
                    # build" (top-up over what the build already carries);
                    # Esc cancels placing mode before closing.
                    # Round 7 — Fit | One size on the build column's Walls
                    # header (board walls only, the wedi seg): `panelFit`
                    # is session-only (never in markCfg or the mode test —
                    # the plan is the default presentation of a kit, not a
                    # customization, default ON); `applyBoardPlan` swaps
                    # the recipe's by-area panel line for the plan's
                    # per-sheet lines IN PLACE (fastener line stays — its
                    # count is pure area), first line wearing the wedi note
                    # ("N sf — M vertical seams · K walls stood vertical",
                    # the rest "panel plan"), and runs in BOTH the build
                    # memo (before qtyOv) and kitTotals so a Kits row can
                    # never disagree with the click; dWalls passes the plan
                    # to schluterWalls so the drawings show the real
                    # courses.
                    # Round 8 — Print layout (the wedi sheet, ported as
                    # .sch-printsheet: both drawings re-rendered at print
                    # size, cut list + noteOnly by-others notes, materials
                    # table through the tier lens; PRINT_CSS makes it the
                    # only thing that prints, afterprint + 2.5s fallback
                    # unmounts) and Copy for order entry (engine
                    # orderCopyLines: stocked SKU ⇥ qty, SO by description,
                    # noteOnly dropped; the toast reports the copy result).
                    # Round 9 — the ⇄ swap popovers (cfg.swaps → engine:
                    # grate finish, curb with qty re-figured, the One-size
                    # wall board — under Fit the PLAN picks the sheets so
                    # the board line doesn't swap; persisted in the marker,
                    # any swap flips mode to custom); a kit row over
                    # customized work raises the wedi overwrite-confirm
                    # modal (kitDirty — an untouched kit-to-kit hop stays
                    # one click); option cards carry the mini TopDown plan
                    # thumbnail; Browse gets the wedi ★ starred pin list
                    # (localStorage ft-schluter-starred, per-device) with
                    # its filter chip. Ticket 158 Phase 1a (ADR 0049): ⇄ on
                    # any drain/channel/grate/flange line opens `DrainSwapPop`
                    # (drainswap.jsx) — a linear pan's family → grate → frame
                    # → finish chips, or a point pan's single Grate row —
                    # seeded from the committed `cfg.drainPick`/`swaps.grate`
                    # as a DRAFT (drainOptions gates each chip's `ok`); Use
                    # this commits the draft (drainPick, or swaps.grate on a
                    # point pan) and flips mode to custom like any other swap;
                    # Esc/outside click discards it. Esc ladder rungs: payload →
                    # confirmKit → swap → picker → bench → wall → placing.
                    # Same basket drawer (the shared project.showerBasket and
                    # the lazy ShowerBasket.jsx chunk, handed this popup's
                    # assembled cat/catReady; `stageBuild` stamps brand
                    # "schluter") — entries
                    # wait FAINT on catReady before pricing (ADR 0032); a
                    # staged snap is markCfg, so manual extras and the quoted
                    # tray survive staging, and the entry's `session` sibling
                    # (qtyOv + the Fit flag) rides beside it, so a
                    # staged-then-moved kit bills what was on screen.
                    # `escActive` (default true) gates its Escape handler —
                    # the Apps pane passes false while it is hidden (ADR
                    # 0047).
                    # Ticket 158 Phase 1b (ADR 0049): ⇄ on the KERDI membrane
                    # and KERDI-BAND lines opens `SwapPop` stepped (Width →
                    # Roll, Auto the default so it re-fits the room); the
                    # board fastener pack and each bench's board swap via a
                    # one-click list, keyed by group+bench+sku so a bench
                    # board sharing a sku with another line can't hijack its
                    # ⇄. The point flange kit swaps via a one-click list
                    # (`cfg.swaps.flange`; PVC ↔ ABS), not the grate popover.
                    # ⇄ shows only when the line has more than one valid
                    # part; a saved `drainPick` inert on a point tray stays in
                    # the marker without forcing Custom.
                    # Ticket 158 Phase 1c (ADR 0049): every group header
                    # carries a "+" (`data-add-group`), shown even on an
                    # empty group. It opens `SwapPop` in add mode: a Part row
                    # when the group offers more than one part (`addParts`;
                    # a point build's Drain reads Grate · Body · Flange),
                    # then membrane/band Width → Roll (`addRollOptions`) or
                    # the linear drain's rows + Length (`drainAddOptions`),
                    # with no Auto and a qty stepper, or a one-click list
                    # (stock-first, a search box past 12 rows). The draft
                    # starts on the part the build already bills — the
                    # drain from `build.drainFit`, not a pick that fell
                    # back. A drain "+" adds every part the strip lists as
                    # separate lines. Added lines are `cfg.manual` rows
                    # keyed by group + sku; Browse, the chips and the
                    # figurer add under the part's own group (`addedGroup`).
                    # Each is its own line with its own stepper, an "added"
                    # tag, "kit also bills N" when a kit line bills the same
                    # sku (screen only, never print), and a ⇄ that opens the
                    # "+" panel on its own part and replaces only that row,
                    # keeping its qty; the kit's ⇄s never open on an added
                    # line. Niche picker rows add another (`✓ ×n`).
                    # Reconfigure tops up an added row by what the sheet
                    # carries beyond it.
                    # Ticket 158 Phase 1d (ADR 0049): the bill and the print
                    # sheet draw the nine shared groups (slots.js `GROUPS`,
                    # a line under `groupOf(line.slot)`) — niches and benches
                    # leave Extras for their own groups; a group with no
                    # lines and nothing its "+" can add stays hidden. The
                    # Add-ons chip block stays below the groups.
                    # `openAdd(grp, …)` takes the shared group; the panel
                    # keeps `add.grp` (the parts list) and `add.g` (the
                    # engine group rows are keyed under — the added line's
                    # own, else the part's), so `ovKey`s and saved rows keep
                    # their engine `g`. `data-add-group` carries the group
                    # label ("Niches"). The popup holds Compare's `mirror`
                    # state (hand picks and drops for the wedi column) for
                    # the session and passes `mirror`/`onMirror` to
                    # CompareTab.
                    # Phase 2: the wall-system segment reads
                    # "Membrane | KERDI-BOARD" (was "KERDI over backer") and the bill subtitle
                    # "Membrane walls (KERDI)"; the saved `cfg.wallSys` values are unchanged.
                    # Phase 4 (ADR 0052): the wedi popup's Compare-set props,
                    # keep-on-unmount (markCfg with a room; mode as the marker
                    # writes it), `seed.tab: "compare"`, `startDetached` and
                    # the resume prompt — the same contract.
  schluterpreview.jsx  # dev-only harness (schluter-preview.html): the REAL
                    # SchluterConfigurator over the fixture pushed BACKWARDS
                    # through normOrderItem into live registry shape (shop
                    # code in sku + mfg code in vendorSkus for stocked rows,
                    # EFT-shaped special-order rows), so preview shots
                    # exercise the production adapter path end to end; no
                    # Supabase, not part of the app build. The EFT side also
                    # carries the live book's re-lettered twin of a stocked
                    # tray (SLRKST965810BF) so the catalog's stock-wins dedup
                    # stays visibly exercised (issue 099). Carries
                    # `wediBuilderPct` + a no-op `onQuoteOptions` too (phase 5),
                    # so the Compare tab shows both builder knobs and renders
                    # its quote-options footer — a footer that only exists when
                    # the prop is given. Stateful cats/basket (ADR 0035 step 3)
                    # so the drawer shots run the real landKitLines/
                    # placedKits/removeKitLines paths. The bag also carries
                    # wedipreview.jsx's two wedi books so the shared drawer
                    # prices wedi entries; `?mixed=1` seeds a wedi entry, and
                    # Add as options lands through compareOptionsPatch.
  wedipreview.jsx   # dev-only harness (wedi-preview.html): the REAL
                    # WediConfigurator over the real engine, no Supabase and no
                    # App shell — the wedi half of the change-control preview
                    # shots. It feeds the SAME fixture-through-normOrderItem
                    # registry bag schluterpreview.jsx does (stockRows/books/
                    # loadBookItems/mortars), because the Compare tab inside
                    # the wedi popup assembles the Schluter catalog itself
                    # (useSchluterCatalog) — without the bag that column is
                    # only ever "Loading the Schluter price books…". Same
                    # no-op `onQuoteOptions` (`?hub=1` omits it, the hub-less
                    # Compare); not part of the app build.
                    # Stateful cats/basket (ADR 0035 step 3) so the drawer
                    # shots run the real landKitLines/placedKits/
                    # removeKitLines paths; `?mixed=1` seeds a Schluter entry
                    # into the shared basket, and Add as options lands through
                    # compareOptionsPatch.
  sheogapreview.jsx # dev-only harness (sheoga-preview.html): the REAL
                    # SheogaConfigurator over local mock state, no Supabase —
                    # preview proof for the ADR 0035 step 2 drawer; landing/
                    # delete/reconfigure run the real model.js paths over
                    # local state (Add/Move through landOrAppendKit, as App
                    # does); not part of the app build. `?tab=trim`
                    # opens the trim tab over the real accessory fixture
                    # (`&nosheet=1` / `&nobook=1` for the two empty states);
                    # rows ride `window.__cats`, the last onConfigChange
                    # report `window.__live`, for proof scripts
  comparekit.js     # one room priced in BOTH shower systems (phase 5,
                    # ADR 0034) — where the Compare tab's engine reads live
                    # (the 1d mirror included): it owns the mapping and nothing
                    # else, so neither engine has to learn about the other and
                    # neither engine's pinned totals can move. A neutral room
                    # ({w,d,curbed,drain,walls[{side,on,len,h}]}) sits between
                    # them — `roomFromSchluter`/`roomFromWedi` read it off
                    # either engine's cfg (a Kits-tab wedi build has no solver
                    # input — kitFor stamps `solve: null` — so roomFromWedi
                    # falls back to the PAN's own drain type and curbless
                    # family, never to a curbed point drain),
                    # `wediBuildFor` re-makes WediConfigurator's own
                    # solve()→kitFor() composition (top-ranked option, mode
                    # "kit", no popup customizations) and `schluterBuildFor`
                    # re-makes SchluterConfigurator's cfg useMemo +
                    # trayCandidates[0] pick, returning the cfg beside the
                    # build because that cfg is what a Reconfigure chip
                    # reopens on. `wediCompareRows`/`schluterCompareRows`
                    # turn both bills into rows as EXTENDED amounts, every
                    # price coming back out of the engine that made the line
                    # — nothing is re-derived here. Since ticket 158 Phase 1d
                    # (ADR 0049) each row carries its engine-tagged `slot`,
                    # `group: groupOf(slot)` (slots.js), `key` (engine group
                    # + part, the 1c added-row identity) and `added`
                    # (Schluter `manual`, wedi `added` on a kit build);
                    # COMPARE_CATS/WEDI_CAT retired. `compareLayout(cols,
                    # plus)` is the grid: one band per shared group, one row
                    # per slot either column fills (or a mirror "+" needs),
                    # kit lines before added ones in a cell, empty slots and
                    # groups dropped. The mirror — each host added line
                    # answered on the other brand: `hostAddedLines`,
                    # `mirrorParts(brand, grp, {cat, source})` (the brand's
                    # own "+" table for the group, so Compare never offers a
                    # part that bill wouldn't), `mirrorCandidates` (the ONE
                    # candidate list the picker shows and the auto-match
                    # takes the top of), `mirrorPlan(hostBuild, hostBrand,
                    # state, …)` → entries (`matched`/`picked`/`none`/
                    # `dropped`) plus the other engine's `manual` rows (one
                    # per engine group + part, qty summed), `mirrorRow`,
                    # `pruneMirror`. A hand pick resolves against the full
                    # catalog (it stands under Stock only); a pick whose part
                    # left the book is `none`, never a silent auto-match.
                    # `wediBuildFor`/`schluterBuildFor` take `manual`, and
                    # `schluterBuildFor` bills it (`addedLines` — buildKit
                    # bills the recipe only), so option B's marker carries
                    # the mirrored rows as ordinary added lines.
                    # Sizes and ranking are comparemirror.js's; the engine
                    # reads stay here.
                    # `noteOnly` rows are KEPT at $0: the
                    # Schluter column carries its substrate-by-others line,
                    # the walls-difference story (the wedi panel IS the
                    # substrate); wedi's own PRO-SET bag files under
                    # Setting (ticket 158 — it replaced the old "Thin-set
                    # for pan bed — by others" note); `compareTotals` then excludes them
                    # (comparekit.test.js, over the frozen schluterfixture)
                    # Phase 2 (ADR 0051): `wediBuildFor(room, { wallSys,
                    # sdryBase })` tries the S-DRY fit under Membrane, else a wedi pan with
                    # S-DRY walls (`cfg.sdryBase: "wedi"`, no prompt).
                    # `schluterBuildFor(room, cat, { wallSys })` bills KERDI-BOARD with the
                    # popup's default Fit plan. `wediCompareRows` adds the $0 backer note row
                    # when the build hints it.
                    # Phase 3 (ticket 158, ADR 0034/0051 Phase 3 amendments —
                    # the four-way grid, `comparegrid.js`'s engine-facing
                    # helpers): `wediBuildFor` also takes `sdryBase:
                    # "nearest"`, routed through `sdry.js`'s `sdryNearest`
                    # exactly as the popup's own no-fit prompt is — the
                    # grid's OTHER no-fit answer (the third, back to Building
                    # Panel, only makes sense inside the popup that owns the
                    # choice). `wediSdryNoFit(room, {source})` is `sdry.js`'s
                    # `sdryNoFit` over the same solver input `wediBuildFor`
                    # would use — the grid's inline S-DRY prompt reads it.
                    # `wediOptionOf(build)` re-solves the build's saved
                    # `cfg.solve.input` and takes the option back by id + pan
                    # — the solver option (`warnings`, `deep`) a wedi cell's
                    # `cellFlags` reads; null for a Kits-tab pick (no solve,
                    # `cfg.solve` is null) or an option that no longer comes
                    # back. One extra wedi solve per wedi cell, only while
                    # the Compare tab is open. `compareLayout(cols, plus)`
                    # now takes ANY column keys (was fixed `wedi`/`schluter`) — each slot
                    # row carries `r[k]`/`r[k+"Plus"]` per key given — so the
                    # same function still serves the two-column detail
                    # (CompareTab.jsx passes `{L, R}`) with no shape change.
                    # Phase 4 (ADR 0052): the neutral room gains `benches` (it
                    # now lives in compareset.js, re-exported here) and both
                    # builders bill them (`benchesFor` — a premade SKU crosses
                    # only within its brand). `wediKeptBuild`/
                    # `schluterKeptBuild` price a kept marker exactly as its
                    # popup showed it (buildFromMarker + the default Fit plan).
                    # `syncKept(brand, entry, ctx)` is Sync: the anchor's room
                    # + benches + added lines (`anchorManualFor` — same brand
                    # as-is, other brand the auto nearest match) over the kept
                    # cfg's choices and own lines (`mergeManual`), brand-only
                    # geometry reset, the tray/pan re-ranked; `keptDropped`
                    # names a kept choice that fell back to the house pick.
                    # `wediBuildFor` takes `benches` and `choices`.
  comparemirror.js  # how Compare sizes and ranks the other brand's parts for
                    # a hand-added line (ticket 158 Phase 1d, ADR 0049) —
                    # pure and ENGINE-FREE: comparekit hands it parts
                    # (`{ brand, item, slot, g, id, cov, retail }`) and it
                    # imports no engine; the mirror's engine reads live in
                    # comparekit. (Other modules import both engines for
                    # their own ends: CompareTab.jsx both `lineItems` for the
                    # quote-options payload, showersf.js and orderlines.js
                    # outside Compare.) `sizeOf` reads a comparable size per sized
                    # slot (niche interior W×H — wedi's size text, Schluter's
                    # `KB..SN<mm><mm>` SKU only, so the lighted niche never
                    # sizes; bench footprint; curb len; tray W×D; wall board
                    # thickness then sf — Schluter thickness from `thickMm`,
                    # else the `KB<mm>` code through a copy of schluter.js
                    # THICK_IN, the name last; membrane sf; seam width then
                    # lf); every other slot is unsized and never auto-
                    # matches. `sizeDistance`, `rankParts` (nearest, then
                    # stock, then retail, then part number; unsized last),
                    # `nearest` (null without a readable size on both sides)
                    # and `matchQty` (coverage for coverage, else the same
                    # count) (comparemirror.test.js). LAZY-CHUNK-ONLY: only
                    # comparekit.js and CompareTab.jsx import it
  comparegrid.js    # the four-way Compare grid's pure per-cell builder
                    # (ticket 158 Phase 3, ADR 0034's Phase 3 amendment):
                    # CompareTab.jsx draws the grid, this module decides what
                    # each of the FOUR cells (wedi/Schluter × Board/Membrane —
                    # `CELLS`, in reading order) prices to and what didn't
                    # map cleanly. Imports `comparekit.js` ONLY, never an
                    # engine directly — decision 1's rule extends here — so
                    # it is LAZY-CHUNK-ONLY, same as comparekit.js/
                    # CompareTab.jsx. `hostCellKey(brand, cfg)` is the live
                    # cell (absent/unknown `wallSys` reads as that brand's
                    # default, ADR 0051); `opposite(key)` is today's other
                    # column (the other brand, same wall system) — what the
                    # detail opens on first. `cellBuild(key, ctx, {mirror,
                    # sdryPick})` returns `{key, brand, sys, live, build, cfg,
                    # rows, plan, totals, flags, label, name}` (empty `rows` =
                    # unbuildable, `CompareTab.jsx`'s `missOf` words why): the
                    # live cell is `ctx.hostBuild` unchanged; the same
                    # brand's other wall system passes the host's added lines
                    # through AS-IS (`sameBrandManual` — same parts, no
                    # mirror, no swaps or solver pick — a house kit, not a
                    # copy); the other brand runs `mirrorPlan` with THAT
                    # cell's own mirror state, keyed by cell key — two cells
                    # of one brand can each hold a different pick.
                    # `cellFlags(brand, build, rows, plan, option)` is what
                    # didn't map cleanly, most severe first (`FLAG_ORDER`):
                    # Schluter reads `build.cand` (mortar/drain/short/deep);
                    # wedi reads the solver `option`'s `warnings`/`deep`
                    # first (`WEDI_DRAIN_MISS`), then `cfg.sdryBase ===
                    # "wedi"` or `cfg.solve.id === "sdry-nearest"` for the
                    # `sdry` chip (ADR 0051's Phase 3 amendment — the chip
                    # covers BOTH no-fit answers); both brands also flag a
                    # billed $0 row (`price`) and an unmatched mirror entry
                    # (`unmatched`). The cell shows the first two flags plus
                    # "+N more" (CompareTab.jsx). `option` is
                    # `comparekit.js`'s `wediOptionOf(build)` — one extra
                    # wedi solve per wedi cell, only while the tab is open.
                    # Never hand-edited outside a `CELLS`/flag-table change;
                    # `comparegridgolden.test.js` pins its output (the golden
                    # itself sits with the other goldens, `comparegridgolden.js`)
                    # Phase 4 (ADR 0052): `CELLS` is the FIXED column order
                    # (wedi Board, wedi Membrane, Schluter Board, Schluter
                    # Membrane). `cellBuild(key, ctx,
                    # {mirror, sdryPick, kept})` prices a kept entry as the
                    # column (`status: "yours"`, no mirror, `kept` returned),
                    # leading its flags with `room` ("Built for 60×36 — room
                    # changed" / "Built for a different room") and
                    # `dropped:<slot>`; a kept build that can't be rebuilt
                    # falls back to the house kit with a `lost` chip; a kept
                    # entry on the live cell is ignored. The golden test reads
                    # the Phase 3 golden in its own pinned order (GOLDEN_ORDER).
                    # `cellSeed(c, source)` (Open's seed) and
                    # `stageEntryFor(c, source)` (+ Basket's entry — see
                    # CompareTab.jsx) live here so node --test reaches them
                    # (comparestage.test.js).
  basketkit.js      # the shared shower basket's two-engine side (spec 2026-09-29):
                    # `entryView(entry, ctx)` / `placedView(kit, ctx)` dispatch on
                    # `brand` to wediEntryView / schluterEntryView with
                    # `ctx = { wedi, schluter }` — a staged entry passes
                    # `entry.session || {}` (its own Fit flag), a placed kit NO
                    # session (the live one). A Schluter title runs through
                    # kitlabel `cleanKitName` — the drawer's badge already
                    # says Schluter (the popup's own resume prompt keeps the
                    # raw title). `optionName` is "wedi Building
                    # Panel" / "Schluter KERDI membrane" off `hostCellKey`;
                    # `optionsFromEntries(views, entries, cats)` names the ready
                    # views' options (repeats " 2", " 3") or returns `{ short }`,
                    # the free letters left, when `nextFreeSlots` is null;
                    # `moveable` splits ready from faint. LAZY-CHUNK-ONLY
                    # (ADR 0026): imports both view modules; model.js never does
  ShowerBasket.jsx  # the shared wedi+Schluter basket drawer (spec 2026-09-29
                    # §1), default export, mounted via React.lazy by BOTH
                    # popups inside their slide-in panel once it first opens.
                    # Runs both catalog hooks the CompareTab way (the host's
                    # own engine fed nulls / `enabled:false`; the Schluter host
                    # passes its cat through), prices every entry through
                    # basketkit.js — the host's live Fit only for its own
                    # brand's placed kits, the other brand Fit on — and draws
                    # KitBasketPanel. An entry whose catalog is still loading
                    # reads faint "Loading the <brand> price book…"; Move and
                    # Add as options land only priced entries, the rest stay
                    # staged and selected ("N still loading — they stay in the
                    # basket"). Add as options runs optionsFromEntries against
                    # `freeSlots` (absent = the hub: the destination decides)
                    # and says "Only K option letters left — select fewer" when
                    # short. The popup's `onAddOptions` returns false when
                    # nothing landed (App: no patch) and the selection stays;
                    # undefined (the hub, whose destination prompt is still
                    # pending) counts as landed. LAZY-CHUNK-ONLY (ADR 0026)
  compareset.js     # the Compare set (ticket 158 Phase 4, ADR 0052) — PURE
                    # and ENGINE-FREE, because model.js imports it (boot
                    # path): `CELL_KEYS` (the fixed column order),
                    # `normCompareSets` (normC's normalizer — junk, unknown
                    # cells and orphaned areas dropped), `entryOf` (a kept
                    # build: marker + room + savedAt/savedBy + target +
                    # dropped), `neutralRoomWedi`/`neutralRoomSchluter` (the
                    # neutral room, benches included — comparekit re-exports
                    # them as roomFromWedi/roomFromSchluter so a popup's kept
                    # room and Compare's room are the same shape; the wedi one
                    # takes the engine's item lookup as an argument),
                    # `roomChanged`/`sizeChanged`/`roomLabel` (a bench's
                    # brand `part` is not geometry), `saveEntry`/`clearSet`,
                    # `resumeChoices`, `isMarkerSeed` (a Reconfigure/hand-off
                    # never prompts), `mergeManual` (Sync's own-lines-first
                    # merge) and `savedAgo`. Brand display names stay OUT of
                    # it (they live in resumeprompt.jsx) so the boot-chunk
                    # grep for KERDI stays 0 (compareset.test.js)
  resumeprompt.jsx  # `ResumePrompt` — "Pick up where you left off?" (ADR
                    # 0052): one row per kept build of the brand (system,
                    # room, price now, saved ago by who) + Start new; its own
                    # Esc rung. Presentation only; lazy (popups only)
  comparesetpreview.jsx  # dev-only harness (compare-set-preview.html): BOTH
                    # real configurators mounted the way App mounts them — one
                    # open at a time, a per-shower set, the cross-brand
                    # hand-off, the resume re-seed — over local state.
                    # `?host=wedi|schluter`, `?kept=1` (a KERDI-BOARD build
                    # kept for 60×36 with a hand-picked grate). Drives
                    # .scratch/158_shower-config-roadmap/p4/shoot-set.mjs;
                    # not part of the app build
  CompareTab.jsx    # the Compare surface (phase 5, ADR 0034, prototype P3):
                    # the fourth tab in EITHER vendor popup — the category rail
                    # beside a wedi column and a Schluter column, a Retail/
                    # Builder lens, totals + the delta line, and the optional
                    # quote-options footer (its standing notes — the walls
                    # caveat, the three difference cards, the quote-options
                    # caption — live behind one ? on the title, ADR 0045),
                    # whose confirm modal takes its own rung on the Esc ladder
                    # (useEscClose, ADR 0028) so a press dismisses the modal
                    # and leaves the live build standing. The popup passes its
                    # raw live cfg as `hostCfg`, the NEUTRAL ROOM derived HERE
                    # (roomFromWedi/roomFromSchluter) — the popups must never
                    # import comparekit themselves, so Compare's two-engine
                    # code stays inside this lazy chunk. The HOST column shows that
                    # popup's build as it stands; the other column is that
                    # engine's derived house kit for the same room. A column
                    # that can't be built (no wedi pan solves the room, no
                    # Schluter rows in the books yet, no room typed) renders ONE
                    # faint explanatory cell and the totals dash — never a
                    # crash, and the delta line stays hidden. Inside the wedi
                    # popup it assembles the Schluter catalog itself via
                    # useSchluterCatalog (the hook runs unconditionally; the
                    # Schluter popup's own `cat` prop wins when given). The
                    # quote-options confirm modal composes each side's payload
                    # through that engine's OWN lineItems — wedi
                    # `lineItems(build,{tier,builderPct})`, Schluter
                    # `lineItems({...build,mode:"custom",cfg},{builderPct})` —
                    # so both anchors keep their reconfigure markers, then hands
                    # {wediLines, schluterLines, label} to `onQuoteOptions`
                    # (App.jsx's compareOptionsPatch landing).
                    # Ticket 158 Phase 1d (ADR 0049): the category rail gave
                    # way to group bands (slots.js `GROUPS`) with one row per
                    # slot, laid out by comparekit `compareLayout`; added
                    # lines sit in their slot row tagged "added". Each host
                    # added line is mirrored onto the other column
                    # (`mirrorPlan`): the nearest-size part, tagged "added ·
                    # matched", with ⇄ (re-pick) and × (drop); or a "+" row —
                    # "Nothing comparable in the <brand> book", "No <brand>
                    # <slot> in the book" (no "+", the brand has no parts for
                    # the group) or "Not mirrored" after ×. The other
                    # column's build is re-run with the plan's `manual` rows,
                    # so that engine prices them; its column draws kit rows
                    # plus one `mirrorRow` per host line. The picker is
                    # `SwapPop` in add mode: a Part row when the group has
                    # several parts, the `mirrorCandidates` list (retail
                    # price whatever the lens; a search box past 12, the
                    # first 60 matches, "N more — narrow the search"), a
                    # standing pick outside the Stock-only pool shown at the
                    # top, marked, and a qty stepper; it takes its own Esc
                    # rung (useEscClose). Picks and drops are the popup's
                    # `mirror`/`onMirror` session state, pruned of host lines
                    # that are gone; hooks `data-cmp-group`, `data-cmp-slot`,
                    # `data-mirror-*`. LAZY-CHUNK-ONLY
                    # (ADR 0026): it pulls comparekit → both engines, so only a
                    # React.lazy mount may reach it
                    # Phase 2 (ADR 0051): the other column follows the
                    # host's wall system (`hostCfg.wallSys`). The column headers
                    # (`data-cmp-sys`) name each side's system; the help tip's walls caveat is
                    # gone.
                    # Phase 3 (ticket 158, ADR 0034/0051 Phase 3 amendments):
                    # a 2×2 grid (`comparegrid.js`'s `CELLS`, reading
                    # order) sits above the same two-column detail, driving
                    # which cell the detail shows instead of a fixed host-vs-
                    # opposite pairing. Clicking a non-live tile selects it
                    # (`data-cmp-tile`); the detail is always the LIVE cell
                    # and the SELECTED cell, re-sorted into grid order
                    # (`[left, right]`) so the columns never swap sides on a
                    # click. A tile's checkbox (`data-cmp-check`) and its
                    # chips (`data-cmp-flag`, jump-to-line via `jump`) sit on
                    # the tile; each cell's flags render the first two plus
                    # "+N more". The grid's SESSION STATE — `selected`,
                    # `checked` (the cells landed as options) and `sdryPick`
                    # (the wedi-Membrane cell's no-fit answer, "wedi"/
                    # "nearest") — rides the popup's EXISTING `mirror`/
                    # `onMirror` prop under a reserved key `grid` (cell keys
                    # all contain ":", so it can't collide with a per-cell
                    # mirror entry): `gridOf` stamps it with the `hostKey` it
                    # was built for and reads it back only when that still
                    # matches — flip the wall system on another tab and the
                    # stale grid reads as absent, falling back to today's
                    # defaults (live cell + its opposite checked, the
                    # opposite selected, S-DRY answer "wedi"); nothing writes
                    # on read (build ruling 10). This is why the grid needed
                    # no new prop or storage: the popups already carry
                    # `mirror`/`onMirror` for Phase 1d's mirror. Per-cell
                    # mirror state moved from one flat shape to `{[cellKey]:
                    # state}` — `pruneMirror` runs per cell, and the OLD flat
                    # shape simply reads as `{}` (harmless, session-only).
                    # The wedi-Membrane no-fit prompt (`data-cmp-sdryask`)
                    # shows inline in the detail only when that cell is
                    # selected and has no fit (`askSdry`), offering "wedi pan
                    # + S-DRY walls" (default) or "the nearest S-DRY base
                    # anyway" (`data-cmp-sdry-answer`) — never "back to
                    # Building Panel", which only makes sense in the popup
                    # (ADR 0051's Phase 3 amendment). The confirm modal's
                    # send button reads "Check two or more cells for quote
                    # options" (disabled) below two checked cells, else "Add
                    # N as quote options"; `data-compare-confirm` is kept.
                    # Since 2026-09-29 the confirm reads the job's real
                    # next-free letters (`freeSlots`, "Add options C–D"),
                    # short of letters the footer button reads "Only K option
                    # letters left — uncheck some", and the hub (no
                    # `freeSlots`) says "Add N options" with no letters.
                    # An unbuildable cell is unchecked and disabled
                    # (`sendable` only counts checked, buildable cells —
                    # build ruling 9). Sending composes each checked cell's
                    # own `lineItems` payload and hands `{options: [{lines,
                    # name}], label}` to `onQuoteOptions` (options.js
                    # `compareOptionsPatch`'s new N-option signature) — a
                    # two-cell send lands the same lines as before, under
                    # cell names ("wedi · S-DRY membrane") rather than
                    # "wedi"/"Schluter". A tile is a plain clickable div; its
                    # keyboard target is the name `<button>` (`data-cmp-pick`,
                    # `aria-pressed`), so the checkbox and chips are never
                    # nested inside a role="button" (supersedes build ruling
                    # 13's tile key handler). The delta line hides on a tie
                    # (|diff| < half a cent). A stale "nearest S-DRY base"
                    # answer is ignored once the room fits (`cellBuild`). The
                    # `CSS` stylesheet string SHADOWS the global `CSS` object
                    # (build ruling 6): the chip-jump code matches
                    # `data-row-key` by attribute value, never `CSS.escape`.
                    # `cellBuild`'s empty `rows` (an unbuildable cell) carries
                    # no reason string — `missOf` words it here (build ruling
                    # 12). The picker title and modal rows name the CELL, not
                    # just the brand ("Add to wedi · Building Panel · Drain",
                    # "B Schluter · KERDI membrane — 7 lines" — build ruling
                    # 7, two cells of one brand can each hold a mirror).
                    # Phase 4 (ADR 0052) SUPERSEDES the grid + detail: four
                    # FIXED columns (`CELLS` order — wedi Board, wedi
                    # Membrane, Schluter Board, Schluter Membrane) from either
                    # popup, one CSS grid whose slot rows align across all
                    # four (compareLayout with keys c0–c3). Each column header
                    # (`data-cmp-col`) holds brand + system, a status tag
                    # (`data-cmp-status`: House kit / Your build), total,
                    # delta, up to two chips (`data-cmp-flag`, the room chip
                    # first), Open (`data-cmp-open`), Sync (`data-cmp-sync`,
                    # Your build only) and the Include checkbox (always
                    # shown; title "include in the print and quote options",
                    # or "include in the print" without `onQuoteOptions`).
                    # The host's
                    # column wears the ring — `.cur` inset shadows on every
                    # cell of that column, `top`/`bot` closing it, and a
                    # CURRENT tab (`data-cmp-current`); no absolute overlay.
                    # Props `compareSet` (the area's set,
                    # or the Apps hub's session-only one; absent → no
                    # Open/Sync/Clear set),
                    # `onCompareSet`, `onOpenCell(key, seed, target)`,
                    # `savedBy`. Open builds a `{ mode, cfg, tab: "compare" }`
                    # seed — a kept build as kept, a house kit as shown (its
                    # mirror rides cfg.manual). Sync runs comparekit
                    # `syncKept` and writes one entry; Clear set
                    # (`data-cmp-clear`, window.confirm) keeps only the
                    # host's own. `grid.selected` is gone; the S-DRY no-fit
                    # ask shows above the columns while wedi Membrane is a
                    # house kit without a fit.
                    # Compact layout (owner 2026-09-28, ADR 0052 amendment):
                    # no header row — prices follow the popup's own price
                    # level (`tier` + `salePct`/`customPct` props, comparegrid
                    # `levelAmt` over each row's retail/builder/cost), the
                    # room label and the ? tip sit in the grid's corner cell,
                    # the Sync/Clear message and Clear set in the footer;
                    # Every line / Subtotals is gone (always every line); a
                    # part's gray detail line is hidden and rides the name's
                    # hover title (mirror "+" rows keep theirs).
                    # Spec 2026-09-29 §2: a quiet "+ Basket" per column
                    # (`data-cmp-stage`, shown when the popup passes
                    # `onStage` + `onStageLive`) stages that column's build in
                    # the shared shower basket — Current through the popup's
                    # own `stageBuild`, the rest as comparegrid.js
                    # `stageEntryFor(c, source)` — `{brand, snap: cellSeed(c,
                    # source)}` (`cellSeed` is `openCell`'s seed, shared), plus
                    # `session: {panelFit: false}` on a wedi HOUSE kit, which
                    # bills its recipe panels with no Fit plan (a sessionless
                    # staged entry reads Fit ON and priced dearer than the
                    # column; comparestage.test.js pins column = staged price
                    # at Retail for every house column). `freeSlots` (the job's free option letters,
                    # undefined in the Apps hub) drives the quote-options
                    # letters: the confirm rows/button/note read them, the
                    # footer button disables with "Only K option letters left
                    # — uncheck some", and with none given (hub) the modal
                    # says "options" without letters.
                    # Spec 2026-09-29 §4: the footer ALWAYS renders and carries
                    # Print (`data-cmp-print`, Printer icon; disabled with title
                    # "Check the columns to print" when `printColumns` is empty).
                    # `printing` state mirrors WediConfigurator's layout print:
                    # the sheet is portalled into body, `window.print()`,
                    # unmounted on afterprint with a 2.5s timer fallback. New
                    # `projectName` prop (both popups pass it) heads the sheet;
                    # `hubPrintLabel` (the Apps hub passes "Shower", through
                    # either popup) replaces it: the hub's areaName is a
                    # destination placeholder, so its sheet names no project;
                    # the sheet's layout is `compareLayout` over the printed
                    # columns only, keyed by cell key.
  compareprintcols.js  # pure half of Compare's print (spec 2026-09-29 §4):
                    # `printColumns(cells, checked, missOf)` — the checked
                    # cells with a price, in `CELL_KEYS` order — `tierLabel`
                    # ("" at retail, else "<TIER_LONG> pricing") and the shared
                    # `fm` money formatter. No JSX so node --test can import it
                    # (compareprint.test.js)
  compareprint.jsx  # `ComparePrintSheet` — the customer print of the checked
                    # Compare columns: a `.cmp-printsheet` table (column heads
                    # in a repeating `<thead>`, a band row per group, a row per
                    # slot, a totals row) with black-on-white brand badges.
                    # Mounted only while a print is in flight; `PRINT_CSS`
                    # hides every other body child (the wedi PRINT_CSS idiom)
                    # and a separate `@page{size:landscape}` <style> is emitted
                    # only for 3+ columns. Prints Qty · Size + item · Price per
                    # line; note-only lines in italics with no price, placeholder
                    # and "+" rows as "—"; leaves off part numbers, tags, pills,
                    # flags, "vs current" and cost. Imported only by
                    # CompareTab.jsx (same lazy chunk, ADR 0026)
  descfit.js        # fitting an order description into a fixed-width ERP field.
                    # A special line has no SKU, so a dropped CATEGORY reads as a
                    # different product — this never truncates to fit, it climbs
                    # down a ladder: `full` (fits as written) -> `short` (every
                    # category kept, abbreviated only as far as the field
                    # requires — `promote` spends the leftover room writing
                    # words back out, most important first) -> `split` (identity
                    # in the field with a trailing "+", the complete text going
                    # to the ERP's extended-text field as a second copy; kept
                    # categories fill back out the same way). Parts are
                    # { full, short, rank, pin, soft }; rank is DROP priority,
                    # not print order, and rank 0 is identity and never dropped;
                    # a pin (SKU, coverage) never drops or clips; a soft part
                    # (brand, "Collection" — owner 2026-08-26) can drop WITHOUT
                    # the "+": the marker appears only when identity text was
                    # actually cut, reported as `cut` for the panel's amber note
  orderentry.js     # "Copy for order entry" pure logic: `isSpecialOrder` —
                    # three tiers, most authoritative first, because they
                    # disagree and the old OR chain let the weakest win (owner
                    # 2026-09-01). (1) PROVENANCE: an "order" book's `bookId`
                    # is special; a stock-kind book's is not. (2) THE
                    # CONFIGURATOR'S VERDICT: every `sheoga` line is special
                    # (Sheoga sells by description — floors AND their at-cost
                    # fee lines, which carry the marker with no `cfg`), while a
                    # `wedi`/`schluter` line splits on its SKU, because either
                    # engine emits a shop code ONLY for a stocked item
                    # (`sku: e.stock ? e.erp : ""`) — so the SKU IS the verdict
                    # and tier 3 must not re-litigate it. It used to: a
                    # configurator row has no bookId, so tier 3 re-checked its
                    # code against the stock cache and — the shop having no wedi
                    # stock book — flipped every stocked wedi line to special
                    # once the cache came up; Schluter had the mirror fault, no
                    # clause at all, so its special-order lines fell through to
                    # "stock" (the dangerous direction: the desk keys a stock
                    # SKU the ERP's stock side doesn't hold). (3) THE
                    # HAND-ENTERED GAP: with the stock cache up, a bookless row
                    # whose SKU the shop doesn't stock in any skuKeys spelling
                    # can't key as stock SKU ⇥ qty — Marcus 2026-08-21. Plus
                    # `orderDescription` (the row -> descfit ladder, flowing
                    # unit · size · product · SKU · coverage; a Sheoga row
                    # abbreviates losslessly off `sheoga.descParts` and keeps a
                    # rank-0 "Sheoga" lead that never drops — a Sheoga order is
                    # keyed by description, so the brand is identity, Marcus
                    # 2026-08-21 — anything else
                    # is arbitrary vendor text with no short rung. A CARTON
                    # line's CT tag LEADS and never drops (rank 0) — the ERP has
                    # no unit field and keys every line as each, so a carton
                    # line not saying CT in its own text orders 44 tiles instead
                    # of 44 cartons; every other unit start (PC/RL/SH/GL…) is
                    # dropped as desk noise (Marcus 2026-08-20 — the coverage
                    # tail still names the unit when it fits); `tightSize` makes
                    # a dimension one
                    # token, `12"x24"`, collapsing only between digits so a "Hex
                    # Tile" keeps its spaces; `plankSizeParts` — plank rows
                    # ONLY (hardwood / vinyl / laminate — owner 2026-08-27,
                    # the Hallmark NO6EMEO-19 case) — splits a thickness ×
                    # width × length
                    # size into per-dimension parts so the fit ladder drops the
                    # thickness first and the length next, each taking its own
                    # "x" with it, while the WIDTH never leaves the field as
                    # long as anything fits; both drops are soft, so a
                    # width-only size pastes without the "+" and the extended
                    # text keeps the full dimensions. Every other type keeps
                    # the one-token size. `nameBudget` (same day) budgets the
                    # grid's red overflow tail against the field AFTER those
                    # soft drops — width-only size, brand and "Collection"
                    # room handed back — so red letters mean the paste will
                    # actually cut, never that the ladder merely has work to
                    # do) and
                    # `orderCopyText` (the description field's contents, nothing
                    # else — qty/cost/sell are separate ERP fields with their own
                    # columns; the unit tag is NOT one of them, so it rides
                    # inside the description). A row whose name leads with its
                    # book's brand label (r.brand, issue 092) carries the brand
                    # as its own rank-3 part — FIRST dropped when the field
                    # runs tight (before coverage and the SKU: the PO already
                    # names the vendor), kept in place between size and product
                    # while there's room so the paste matches the screen, and
                    # always surviving into the extended text. And `orderQty` (2026-07-27): a line with no
                    # quantity is keyed as ONE of its sell unit — the ERP takes
                    # no zero-quantity line, and a zero qty also blanks the
                    # per-unit cost/sell, which are extended totals ÷ qty.
                    # orderEntryRow re-runs the row's math at qty 1 so a
                    # carton-sold line's "one" is a whole carton, and sets
                    # `qtyAssumed` for the panel's amber flag. Split from the
                    # .jsx so `node --test` can cover it;
                    # imports always name the extension
  deliverto.js      # the panel's "Deliver to" block (owner 2026-09-15): the
                    # project's ONE-LINE address split into ERP 1's
                    # delivery-form fields — `splitAddress` reads from the
                    # tail (ZIP · state, 2-letter or spelled out · city, each
                    # its own comma part or sharing the city's), what's left is
                    # the street, with a unit part ("PO Box 288") or a unit on
                    # the street's tail ("Suite 200", "#4", designator-anchored
                    # so "County Road 314" keeps its number) moved to apt/
                    # suite; a line with no state at the tail goes WHOLE into
                    # Street with ok:false — the panel warns, never pastes a
                    # guessed city. `deliverToRows` (the form's order: name ·
                    # street · apt · city · state · ZIP · phone),
                    # `deliverToLabel` (the on-screen block, one field per
                    # line, city/state/ZIP sharing the fourth) and
                    # `deliverToSequence` (what copy-all writes, owner
                    # 2026-09-15: every non-blank field on its own, LAST TO
                    # FIRST, then the label — the desk pastes with Win+V,
                    # Windows clipboard history, newest first, so the fields
                    # list top-to-bottom in form order under the label, and
                    # plain Ctrl+V gives the whole address; the earlier
                    # tab-joined one-paste fill was dropped, ERP 1's form
                    # never verified to take tabs)
  orderentry.jsx    # the panel itself — Deliver to (deliverto.js rows off
                    # App.jsx's custInfo: customer name, project address
                    # falling back to the customer's mailing address, project
                    # phone falling back to the customer's — the Samples
                    # panel's rule) read as a MAILING LABEL (owner 2026-09-15,
                    # after a seven-row per-field card was "way too large"):
                    # name · street · apt · "City, ST ZIP" · phone, every
                    # line — and the city, state and ZIP each on their own,
                    # since ERP 1 keys them as three fields — a click-to-copy
                    # `Seg` that latches green by itself, plus ONE latching
                    # copy-all at the left like a special line's button
                    # (`LatchCopy texts=` — deliverToSequence written entry
                    # by entry through clipseq.js, counting up on the button
                    # while it runs, disabled meanwhile, so the desk waits
                    # for the check before Win+V); no per-field buttons. Above
                    # Special order (per-line copy) above
                    # Stock (checkboxes + Copy all as SKU⇥qty; the estimated
                    # materials ride the Stock list unfiltered — App.jsx's
                    # `matAll`, so a pending grout/mortar still keys as 1, while
                    # the printed order sheet keeps the quantified `matLines`).
                    # A `qtyAssumed`
                    # line reads amber (tint + edge bar + "ASSUMED") with a
                    # count in the section footer. A Sheoga line has
                    # no SKU to key, so it reads "by description — no SKU".
                    # Vendor freight rides the Special list too — ONE line per
                    # book (freightOrderRow), reading "Freight — <vendor>" and
                    # keyed 1 EA at that vendor's whole charge: the parts and
                    # the destination justify the price on the ESTIMATE, but the
                    # desk keys shipping as a single charge and pallets/feet/
                    # pieces can't share a quantity column.
                    # Three views (owner 2026-09-17, .scratch/143, replacing
                    # the 2026-09-14 vendor-first Merged & sorted): opens on
                    # AREA + VENDOR (areaVendorBands — areas in sheet order,
                    # tile before trims, a SKU merging only inside its area,
                    # the configurator wedi/Schluter lines pulled into vendor
                    # bands beneath), COMPACT (compactBands — every SKU
                    # merged across the job, one run), and SHEET ORDER (the
                    # as-entered list banded by area); a moss "×N areas"
                    # pill on a merged line opens its per-area breakdown, a
                    # quiet "same SKU · unit/price differs" note marks a
                    # line held apart; copies follow the visible view,
                    # selection resets on a switch. Each section's STANDING rules (green check
                    # tracks your place, per-unit cost/sell, the 70-char fit,
                    # SKU⇥qty) live behind a HelpTip ? on its heading (owner
                    # 2026-09-15 — widgets.jsx's doctrine); the footer under a
                    # list keeps only what reports STATE (merge note, assumed
                    # count, splits, red no-SKU) and is gone when there's
                    # nothing to report. A `React.lazy` chunk in App.jsx (ADR
                    # 0026): orderlines.js pulls wedi.js + schluter.js for
                    # the grouping, which must stay off boot — which is also
                    # why CopyBtn lives in copybtn.jsx (samples.jsx imports
                    # it statically). A header bar (Deliver to · ERP 1 order ·
                    # Project + View, ADR 0044) replaces the title row and the
                    # Deliver to section; props `projectNo`/`quick`/`erpOrders`/
                    # `erpKeyed` + four one-patch callbacks gate copies on a
                    # numbered, keyed job and stamp lines — `KeyedPop` (Copy
                    # again / Clear / Keep), Copy remaining replaces Copy all.
                    # Cleanup (owner 2026-09-21, .scratch/148): the ERP field
                    # takes focus on open (fine-pointer screens only — no
                    # phone keyboard over the list) with "ERP #" as its gray
                    # placeholder, no prefix; the special rows' zebra is gone
                    # and a COPIED line's whole row wears the Order summary's
                    # `--ft-tint` in both lists (`rowStyle` — the amber edge
                    # bar rides over it), a ticked-but-uncopied stock row
                    # showing only its checkbox
  orderlines.js     # merge-and-sort for the panel (owner 2026-09-14): ERP One
                    # keeps two pasted lines with one SKU as two lines, so
                    # `mergeOrderLines` combines them — same SKU in any
                    # skuKeys spelling (the first line's spelling pastes) AND
                    # the same sell unit, the special side ALSO needing
                    # per-unit cost and sell to agree to the cent (a merged PO
                    # line carries one price); a group that disagrees stays
                    # apart and EVERY line in it says why (`kept`: unit |
                    # price). An assumed 1 (orderQty) is a stand-in, never a
                    # count: real quantities absorb it, and only an
                    # all-assumed merge stays an assumed 1. No-SKU lines
                    # (Sheoga by description, freight) never merge; a line
                    # left alone is the same object. `lineGroup`/
                    # `groupOrderLines` file lines in the desk's order — ONE
                    # wedi band (owner 2026-09-21, .scratch/148: the per-group
                    # "wedi · Pans / Drains / Curbs" eyebrows were "insanely
                    # busy"), ranked inside by catalog group off the row's
                    # marker (`sub`: rowItemKey → item().group; building
                    # panels RIGHT AFTER curbs, owner) · ONE Schluter band,
                    # ranked by family (`classify` over the marker's
                    # manufacturer code — the sheet sku is the shop number,
                    # which the grammar can't read) · Sheoga · book brands
                    # A–Z · Other items (hand-typed) · Materials (print-sheet
                    # kind order) · Freight; SKU breaks ties. `sheetBands`
                    # bands the as-entered list by consecutive area.
                    # `compactBands` / `areaVendorBands` (owner 2026-09-17,
                    # .scratch/143) are the panel's two merged views: one
                    # job-wide run vs. per-area bands (merge scoped to the
                    # area — `mergeOrderLines(rows, scope)` salts the merged
                    # id) with ONLY configurator wedi/Schluter lines pulled
                    # into groupOrderLines' vendor bands beneath; both rank
                    # tile & flooring before misc ahead of the SKU compare
                    # (orderlines.test.js)
  erporders.js      # ERP 1 order numbers on a project (ADR 0044): normalizers
                    # (normErpNo digits-only ≤10; normErpOrders dedupes; normErpKeyed
                    # drops stamps on unknown orders), the ONE-PATCH builders
                    # (addErpOrder / removeErpOrder / stampErpLines / clearErpStamps
                    # — null = nothing to write), `gated` (numbered + no order),
                    # line helpers over the panel's rows (lineIds — a merged
                    # row's sources; keyedNo — "mixed" across orders, null
                    # when any source is unstamped; remainingRows; keyedNote),
                    # erpNosOf/erpHit for the browser's column + search over
                    # light or full rows; `erpLabel` ("ERP 48260 +1"),
                    # `matIdMaker` (the materials line ids — the panel and the
                    # Clean header's count both mint through it, or a stamp
                    # stops matching) and `erpStatus` (keyed/left/done over
                    # App's unmerged `erpLines`). Never imports model.js (erporders.test.js)
  clipseq.js        # `writeSequence` + `CLIP_GAP_MS` (400): writes a list of
                    # texts to the clipboard one after another, a pause
                    # between, so Windows clipboard history (Win+V) keeps
                    # every one — the history is a background listener that
                    # reads the clipboard some time after each change, and a
                    # write landing before it gets to the last one is
                    # skipped; at 80 ms the desk saw one or two of eight
                    # survive (owner 2026-09-16). Pure (injectable write/
                    # wait) so the sequencing is tested under node
  copybtn.jsx       # `CopyBtn` + `DONE_MOSS` + `writeClipboard` — the copy
                    # button both the order-entry and samples panels mount,
                    # in its own file so samples.jsx (boot chunk) never
                    # imports orderentry.jsx (lazy, catalog-bearing). `onCopied`
                    # (ADR 0044) lets order-entry stamp a line on a real copy
  samples.js        # sample-ordering pure logic (spec 2026-08-28, reworked off
                    # the issue 115 v1): request rows are the ONE source —
                    # shared `sample_requests` rows (snapshot + live ids, the
                    # claude-issues doctrine — supabase/samples.sql), never a
                    # field on the product row. `normSampleRequest` (status
                    # need/ordered only — v1's "in"/received dropped) +
                    # `requestFrom` (a NEW request, the line frozen at request
                    # time: vendor resolves ONCE here — book brandLabel/name,
                    # Sheoga lines under Sheoga, everything else under a
                    # trailing "Other / hand-entered"). `sampleGroups` (rows
                    # grouped by that frozen vendor, Other always last — a
                    # sample order is placed per vendor), `sampleCounts` (the
                    # header badge), `projectSampleTally` (a
                    # projectId→{need,ordered} Map — the browser column/
                    # filter's one shared roll-up),
                    # `repEmail`/`mailtoHref` (the vendor email: item
                    # list + the CUSTOMER as ship-to — samples ship direct —
                    # and deliberately NO salesperson info, owner call
                    # 2026-08-28), and `sampleContactFor`/`contactLabel` (WHO
                    # that email goes to: book.data.sampleContact wins when it
                    # carries an email, book.data.rep is the fallback, null
                    # when neither can be mailed — so a book whose rep IS the
                    # samples contact needs nothing typed twice; the label
                    # reads "Email {first name}", or "Email samples" for a
                    # nameless company inbox). `sampleBookFor(group, books)`
                    # (ADR 0040) is the panel's book lookup: by id, else by
                    # brand label/name — so requests saved before Sheoga had
                    # a book (name only) still find its contact and merge in;
                    # `requestFrom` files a `sheoga`-marked line under the
                    # Sheoga vendor book when one exists. Split from
                    # samples.jsx so `node --test` can cover it (samples.test.js)
  samples.jsx       # the Samples panel (spec 2026-08-28) — this project's
                    # sample_requests, grouped by vendor via `sampleGroups`,
                    # in the same `SideDock` drawer as order entry. Per-line
                    # two-way status toggle (To order ⇄ Ordered), per-vendor
                    # "Mark all ordered" and an "Email {contact}" mailto button
                    # built from `repEmail`/`mailtoHref` + `contactLabel` (falls
                    # back to a Copy-email button + a "No sample contact on
                    # file" hint pointing at the book's Contacts tab when the
                    # vendor has neither email saved),
                    # remove ×. Presentation only — contract is
                    # `SamplesPanel({ name, requests, custInfo, contactFor,
                    # onOrdered, onRemove, onClose })`: every write goes back
                    # through `onOrdered(ids, ordered)` — an ID LIST, so "Mark
                    # all ordered" is one write, never one per row (useSamples'
                    # `setSampleOrdered`). Marks are made from the line menu's
                    # "Request sample" (and the mobile row sheet's toggle); a
                    # marked row wears a status-colored layers icon in its
                    # action cell that opens the panel, and both header
                    # layouts carry a Samples button badged on any open
                    # (need) request. Deliberately UNSCOPED across quote
                    # options — samples get ordered while options are still
                    # being decided, and there's no cross-project samples desk
  samplespreview.jsx  # dev-only harness (samples-preview.html): the REAL
                    # SamplesPanel over request rows built through the REAL
                    # requestFrom/normSampleRequest, no Supabase, no App shell.
                    # Stateful, so the status toggle, Mark all ordered, the
                    # mailto button, and remove all exercise the real
                    # onOrdered(ids, ordered) contract. `?empty=1` shows the
                    # empty state. `?browser=1` mounts the REAL
                    # CustomerBrowser instead, over a second sample-less
                    # customer (Task 8 preview proof — the samples column/
                    # filter's mock state), fed `sampleTally={projectSampleTally(SEED)}`
                    # so the filter visibly narrows the grid, five unfiled
                    # projects so the default-open strip has three quick prices
                    # to show with the next peeking, and stateful `panels` so a
                    # drag round-trips the real initialPanels/onPanels contract
  sfparts.js        # the stored sq ft breakdown (`p.sfParts`): normalize
                    # (normSfParts), totals, toggles, drift state, print text.
                    # Boot-safe.
  SfPartsMenu.jsx   # the sq ft breakdown menu (right-click the desktop sq ft
                    # field / Bath icon on the phone) and its drift/removed chips.
                    # The menu renders through a portal to document.body so it
                    # stays viewport-fixed inside the phone row sheet.
  vendorfetch.js    # vendor sheet fetch (ADR 0019): portal-link parse/validate,
                    # bookmarklet source + clipboard hand-off (copies a marked
                    # base64 payload — HANDOFF_MARK/stripHandoffMark — that the
                    # "Paste sign-in" button folds in via decodeHandoff; the old
                    # #vfetch URL-fragment reader stays as a legacy fallback),
                    # response sniffing; shared by the browser panel and relay.
                    # + sign-in groups (ADR 0020): remembered sheets organized
                    # into named `settings.ops.vendorGroups` (one per portal
                    # {host,user}); `normVendorGroups`/`migrateVendorSheets`
                    # (one-way flat→groups migration, called from catalog.js
                    # normOps), `moveSheetInGroups`/`sheetMatchesGroup`/
                    # `rememberIntoGroups` for the library board's sign-in
                    # columns. `portal`
                    # is nominal (naming + mismatch chip), never authorizes a
                    # fetch — a sheet's sesid comes from a live link matching its
                    # OWN {host,user}, so freely moving sheets between groups is
                    # safe. Groups render as board columns with checkbox
                    # batch download and always-live (never pre-locked) fetch
                    # buttons; moves happen from a row's ⋯ menu (ADR 0021 —
                    # board layout, batch selection, always-live downloads;
                    # its old standalone "Vendor sheets" tab is retired, see
                    # the library board below)
                    # + review-when-ready pending pool (ADR 0024):
                    # poolPendingReview/removePendingReview/pendingForSheet —
                    # fetched Files park session-side until reviewed.
                    # + the library board (ADR 0024): renders each sign-in as
                    # a column of book rows beside an In-house column; a
                    # linked sheet lives inside its book (source-sheet strip
                    # on the book page), and the separate Vendor sheets tab +
                    # the price-book sidebar list are retired
  dropimport.js     # multi-file drop routing (ADR 0009 PR C): `fileFormat` /
                    # `computeFingerprint` / `routeFile` map each dropped file to
                    # its book — VTC/Mannington by
                    # format tag PLUS the EFT brand-title line above the header
                    # ("Virginia Tile Core" / "Anatolia Tile" / …), since VTC
                    # reuses one template for every brand it distributes — a
                    # title mismatch is a hard "not this book"; others by a
                    # book's saved mapping that parses the file. A book stamps
                    # `data.importFingerprint` on import so the next drop
                    # matches. The Price book library's drop area (top of the
                    # board page, ADR 0024) routes a mixed drop and reuses
                    # each book's normal import preview.
  railnav.js        # rail drawers + work-area pane state (ADR 0047): pure
                    # reducer (toggleDrawer / pick / resolveResume /
                    # closePane / projectChanged / restore / switchApp —
                    # Compare's Open in the hub moves the pane to the other
                    # configurator, drawers untouched, never a resume
                    # prompt, ADR 0052 amendment), the "break"
                    # flags behind Continue / Start new, and the
                    # ft-open-layer mapping (layerOf / stateFromLayer,
                    # reads pre-0047 shapes). `openCustomers` puts the
                    # Customers browser in the pane (ADR 0047 amendment),
                    # still stored as the { kind: "browser" } layer
  raildrawer.jsx    # RailSlide (the one ~1.3 s height slide, content pinned
                    # top or bottom), DrawerList, APP_ITEMS / SETTINGS_ITEMS,
                    # PaneTitleBar (caret · serif title · controls · X —
                    # the one bar every Settings/Apps page opens with; the
                    # configurators and Customers draw the same row by hand),
                    # and PaneBack / PaneClose: its caret + X
  appheaderoptions.jsx  # dev-only mockup (app-header-options.html): the
                    # Apps configurator header top-right options the owner
                    # reviewed 2026-09-24 (flat controls, price dropdown,
                    # basket icon); not part of the app build
  dropdownpreview.jsx  # dev-only harness (dropdown-preview.html): the REAL
                    # MorphSelect/DotMenu beside today's dropdowns (materials
                    # drawer, Sheoga options, ⋯ menus, phone), plus a 75%-zoomed
                    # box and a near-the-bottom flip — ADR 0048's gallery; not
                    # part of the app build
  gridpreview.jsx   # dev-only harness (grid-preview.html): the REAL
                    # TypeSelect, UnitPick, drawer FitSelects, GridPriceCell's
                    # popup, LineMenu and LineWastePop, plus the grid search,
                    # product cell, StockSearch and BuilderCombo boxes, over
                    # local state and mock book items — the
                    # grid rows live inside App.jsx, so this is ADR 0048's
                    # preview proof for them; not part of the app build
  railpreview.jsx   # dev-only harness (rail-preview.html): the REAL drawers,
                    # reducer, pane header and workspaces over mock state —
                    # preview proof for ADR 0047. The hub's wedi/Schluter
                    # tabs get the fixture registry bag (the Compare-set
                    # harness's), so their Compare columns price —
                    # .scratch/158_shower-config-roadmap/p4/shoot-hub.mjs
  labels.js         # Label Generator pure logic (Apps hub): LABEL_FIELDS,
                    # built-in size presets, preset/label normalization
                    # (incl. "sp_" filler spacer lines — user-added blanks
                    # whose size is a height in px, holding a gap open),
                    # stock->field mapping, per-letter-sheet math, print HTML.
                    # Overhaul (spec 2026-09-25): one "pin" divider in `lines`
                    # — lines after it ride the card's bottom group
                    # (`splitPinned`); a list without one pins nothing, so
                    # every label saved before it renders unchanged; the
                    # built-ins pin Grout. A saved built-in id now OVERRIDES
                    # the code default (owner-approved reversal — code used to
                    # always win); only an entry differing from the default
                    # persists (`isBuiltinOverridden`, `builtinDefault` = Reset).
                    # `fitNameSize` is the ONE shrink rule the screen card and
                    # the print popup both run over their own DOM measure;
                    # `twoSizeDraft` (bigger face first, size trimmed off the
                    # name), `restyleLabel` (template layout, text kept),
                    # `refreshPlan` (price only; retired/disabled items count
                    # as gone; skuKeys injected so this file stays import-free).
                    # The drop list (owner 2026-09-28): `normDropWords` seeds
                    # DEFAULT_DROP_WORDS (manufacturers) when absent, keeps an
                    # explicit []; stored shared at settings.apps.labels.dropWords,
                    # persisted only once it differs from the default.
                    # `cleanLabelName` strips each entry as whole words; the
                    # stock fill and `twoSizeDraft` take the list. `renamePlan`
                    # rebuilds saved names from the stock book under the list
                    # (the only way a removed word comes back) for a review
  AppsWorkspace.jsx # the Apps work-area pane (ADR 0047: no shell or app list
                    # of its own — the rail's Apps tray picks; configurators
                    # stay mounted after first pick, track in-progress, show
                    # the Continue / Start new prompt) and
                    # mounts LabelMaker.jsx for the Label Generator. Also hosts the
                    # embedded vendor configurators, each fed by App.jsx's
                    # `sheoga`/`wedi`/`schluter` prop bag — both shower bags now
                    # carry the OTHER engine's builder knob (and the wedi bag
                    # the Schluter registry props) so the hub's copies render
                    # their Compare tab. The two shower tabs share ONE
                    # `showerBasket` (Start new on either clears it; the
                    # resume text counts it for both), and Compare's
                    # `onQuoteOptions` plus the drawer's Add as options
                    # (`label: "Shower"`) go through `requestCommit(…,
                    # "options")` — the pending item carries `kind` and
                    # `commitTo` calls the bag's `addOptionsToCurrent/New`
                    # instead of `addToCurrent/New`; a bag returning false
                    # (too few letters) leaves the basket standing. Takes a
                    # `visible` prop (App.jsx: the pane is showing an app) and
                    # passes each configurator `escActive={visible &&
                    # shown(k)}` (ADR 0047) so a hidden, still-mounted
                    # configurator's Escape handler stays off.
                    # The Compare set in the hub (ADR 0052 amendment): a
                    # SESSION-ONLY `hubSet` handed to both shower tabs with
                    # `keepLive` (the tabs stay mounted while hidden, so the
                    # set follows each build as it changes rather than on
                    # unmount); `openCell(key, seed)` stores the seed, bumps
                    # that tab's generation key (a remount onto the seed, on
                    # Compare) and calls `onSwitchApp` (App: the rail's
                    # `switchApp`) when the target is the other tab; Start
                    # new clears the tab's seed. No `onResume` is passed, so
                    # the popups' resume prompt stays off here
  LabelMaker.jsx    # the Label Generator UI (spec 2026-09-25, mockups in
                    # .scratch/157): three columns like the configurators —
                    # find & fill (stock search with multi-pick: tick two →
                    # "One label, 2 sizes" via twoSizeDraft, or "Add N
                    # labels"; New/Save under it; a label | box | quiet −n+
                    # form grid showing only the template's shown lines, the
                    # pinned ones under a moss "Bottom of label" divider) ·
                    # template + preview (TemplateMenu: every template, Edit…,
                    # New…; the preview reports fitNameSize's shrink) · the
                    # label set (corner-circle selection → Print / Update from
                    # stock book / Delete). The template editor and the
                    # update review take the set's column while open. The
                    # editor edits the DRAFT's layout live (✕ restores the
                    # snapshot); Update asks before restyling saved labels.
                    # Update from stock book waits on `bookStockReady` and
                    # writes only through the bulk pair. The print popup
                    # re-runs the name fit once its fonts load. The set column's
                    # controls (and the editor/review) stop at a letter
                    # sheet's width (SHEET_W, owner 2026-09-25) while the cards
                    # use the whole column; an unselected card shows no
                    # circle — it fades in on hover. It draws its own title
                    # bar (PaneTitleBar); the gear beside the X edits the
                    # shared drop list ("Words dropped from names");
                    # its "Update saved labels…" opens the name review
                    # (renamePlan, every label ticked, untick hand-typed names)
  lib/supabase.js   # Supabase client (reads VITE_ env vars)
```
