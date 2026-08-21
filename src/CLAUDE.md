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
                    # node --test can drive them with a fake builder
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
                    # vendor mounts (never on the Apps-hub copies)
  uiconst.js        # shared UI constants: TYPES/TLBL, tier colors/labels,
                    # joints/thicknesses, grout color lists, sweep/keep constants,
                    # stock-loading messages, `skuSearchable`, `colorsFor`
  units.js          # the sell-unit vocabulary (2026-07-25): `unitCode` (RL/Rolls/
                    # roll → "RL"), `unitNoun` (3, "rl" → "rolls"), `isRollUnit`.
                    # One table so a unit reads the same in the grid, the print,
                    # and the order panel; a unit the table doesn't know falls
                    # through as the vendor's own code rather than a wrong "EA"
                    # (units.test.js)
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
  print.js          # print/order math: `printProduct`, `orderLineCost`, `lineTotal`,
                    # `printAreaFloor`, `areaPrintLabel`, `orderEntryRow`,
                    # `ESTIMATE_PRINT_LAYOUT`… (print.test.js)
  options.js        # quote options (ADR 0031): fixed slots A–F (letters live in
                    # model.js, re-exported here; extended past A–C 2026-08-19) +
                    # colors, shared/option scoping (bucketCats/scopedCats),
                    # titles, duplicateInto — an option is a TAG on an area,
                    # never a copy of the job. `compareOptionsPatch` (phase 5,
                    # ADR 0034) is the Compare tab's ONE-PATCH
                    # landing: two fresh sibling areas (`{...newArea(), …}`,
                    # never duplicateInto's shared-source retag — these aren't
                    # copies of shared work) tagged option A/B, inserted right
                    # after the host area (append if its id is gone), each
                    # `lines.map(p => ({...newProduct(), ...p}))` plus a
                    # trailing blank adder row; `optionNames` fills {A:"wedi",
                    # B:"Schluter"} only into empty slots, never over a custom
                    # name; null when either lines array is empty. Returns the
                    # patch object for the caller's single `updateProject`
                    # call — usedirectory's setter is built off a stale
                    # closure, so two calls in one tick would clobber each
                    # other (options.test.js)
  jobtotals.js      # the job's money math, extracted from App.jsx so it runs per
                    # option scope: one filtered project in, every aggregate out
                    # (totals, gList/mList/…, matAll, pMats, freight, margin).
                    # Whole-job = shared bucket + option bucket (additive on paper);
                    # order entry re-runs the UNION so freight minimums stay exact
                    # (jobtotals.test.js)
  fileread.js       # `readXlsxSheets`/`readPdfPages` — lazy `import("xlsx")`/
                    # `import("pdfjs-dist")` preserved
  widgets.jsx       # shared widgets: `Modal`, `LazyBoundary`, `FitSelect`, `DotMenu`,
                    # anchored-panel machinery, `ThemeSwitch`, popovers, bars,
                    # `HelpTip` (the hover/focus/tap ? for STANDING RULES only —
                    # state & warnings stay inline, hiding them hides the problem),
                    # and `SourceSwitch` — the shared Stock only / Full catalog
                    # seg both vendor configurators mount in their pop-head
                    # (phase 4), so the two popups can't drift on the control;
                    # it carries no engine knowledge, each popup owns what the
                    # source constrains and styles `.srcseg` in its own CSS
  search.jsx        # price-book search suite: `SkuPicker`, `StockSearch`,
                    # `FamilySearch`, hit rows, merged-results hooks
  grid.jsx          # selection-grid cells: `TypeSelect`, `GridPriceCell`,
                    # `GridSizeInput`, `GridProductBox`, `GridOmniSearch`
  mobile.jsx        # mobile sheets: `MobileSheet`, `MobileSearchSheet`,
                    # `MobileProductRow`, `MobileRowSheet`
  projectheader.jsx # the desktop project header, two layouts behind a per-device
                    # switch (Settings → General, localStorage "ft-header"):
                    # `ProjectHeaderBar` (the 2026-07-21 one-bar) and
                    # `ProjectHeaderClassic` (the print-sheet original, kept
                    # whole so the team can flip back without a revert)
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
  claudeflag.jsx    # `ClaudeMark` (the rays, moved out of pricebooklib) +
                    # `FlagForClaude` — the ONE flag popover every surface
                    # opens with a prebuilt source: captured-context box,
                    # quick-reason chips, optional note; CLAUDE_CLAY (#D97757)
                    # is the one non-theme color, marking everything Claude
  linemenu.jsx      # `LineMenu` — the product line's action menu (issue 087,
                    # owner "option A" 2026-08-13): opened by a plain CLICK on
                    # the row-end ⋯ (a HOLD on the same button drags — the dots
                    # are the row's one grip; no tip line, the grab cursor is
                    # the affordance) or a right-click on the row (suppressed
                    # inside fields so native paste keeps working). Duplicate /
                    # Move to area (inline expand, no floating submenu) / Flag
                    # for Claude / Delete (routes to the existing inline
                    # confirm). The old hand + trash hover icons are retired on
                    # product rows; the empty search-row adder wears the same ⋯
                    # dots (drag-only grip — no menu) and keeps its trash
  claudeissuespreview.jsx  # dev-only harness (claude-issues-preview.html): the
                    # REAL TeamTodos tabs + LineMenu + FlagForClaude over local
                    # mock state, no Supabase; not part of the app build
  headerpreview.jsx # dev-only harness (header-preview.html): the REAL
                    # ProjectHeaderBar + PriceBookLibrary over local mock state,
                    # no Supabase — preview proof for the 2026-08-14 compact
                    # headers and the book page's config drawers (stateful
                    # updateBook + a mock Glazzio book with items, so the
                    # markup/freight/brand tabs save-and-rerender);
                    # not part of the app build
  importpreview.jsx # dev-only harness (import-preview.html): the REAL
                    # BookImportWizard over local mock state, no Supabase —
                    # preview proof for the diff review's unfolding new/changed/
                    # retiring lists + per-line Flag for Claude (2026-08-17);
                    # not part of the app build
  custbrowser.js    # customer-browser pure logic (issue 040): rows/filter/sort +
                    # group-by-salesman over the boot's light rows (custbrowser.test.js)
  CustomerBrowser.jsx  # the customer browser, a `React.lazy` chunk (ADR 0026):
                    # near-fullscreen ERP-style directory grid — dense customer
                    # rows grouped by salesman over a bottom project-lines panel —
                    # opened from the sidebar's Customers folder (issue 040)
  EstimatePrint.jsx # `EstimatePaper` (+ `PRINT_DASH`) — the print/Preview-tab "paper", one
                    # component behind both call sites so they can never drift. STATIC import only:
                    # `window.print()` fires right after the print-mode render, so a `React.lazy`
                    # chunk here would still be loading and print a blank page
  usetoast.js       # `useToast` — toast/save-flash UI state (`ping`, `flashSaved`)
  usedirectory.js   # `useDirectory` — the project/people/builder directory: state, selection,
                    # and their write paths (`updateProject`/`addProject`/`setSettings`/`saveProfile`…);
                    # `migrateLegacyCustomers` (ADR 0004)
  usebooks.js       # `useBooks` — price book registry state + write paths (ADR 0009): addBook/
                    # updateBook/delBook/applyBookImport/reviewBookItemFlags/setBookItemsDisabled/
                    # setBookItemIssue (the Claude issue bucket — flagReview's contract:
                    # data jsonb, no edited stamp, carried across re-imports)
  usebookstock.js   # `useBookStock` — stock-kind registry books' items, a bounded cache
                    # background-loaded after the books metadata (ADR 0026); feeds the row
                    # search's instant stock tier, the grout family projection, the Settings
                    # picker, and link warnings (ADR 0027)
  usetodos.js       # `useTodos` — team to-do/issue list state + write paths (issue 006);
                    # the central Claude bucket lives beside it in useclaudeissues.js
  uselabels.js      # `useLabels` — Apps hub label-set state + write paths
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
                    # earlier files' flags to the last file's apply
  SettingsWorkspace.jsx  # the Settings workspace, now a `React.lazy` chunk (ADR 0026);
                    # `MATERIAL_CATEGORIES` lives here. Shrink-to-fit (issue 084,
                    # the wedi popup's rig): drawn at SETTINGS_DESIGN_W (1240)
                    # and zoomed to the overlay's measured width, so a phone
                    # gets the whole layout smaller instead of the fixed
                    # columns eating the detail pane; the low ZOOM_FLOOR is a
                    # sub-phone backstop (owner: scale first, revert if the
                    # type gets too small), below which the overlay scrolls
  catalog.js        # settings normalization + material math + shared catalog
  pricebook.js      # generic mapped import for registry books (ADR 0009) +
                    # vendor template recognizers (VTC EFT, ERP Vendor SKU
                    # Analysis); the retired shop workbook's hand-built
                    # parsers (ADR 0003) lived here until 2026-07-22.
                    # The EFT recognizer is BRAND-aware (2026-08-07): the
                    # title line above the header decides what the rows ARE —
                    # a Schluter book gets no tile default (it sells no
                    # flooring) and reads coverage ("= 323 SF") and
                    # feet-and-inches roll/board sizes out of the description
                    # in every spelling Schluter prints (3'3"x98'5",
                    # "3 FT 3 X 98 FT 5", 82FTX3-1/8INX5/16IN, trailing 10'
                    # stick lengths, 5/8IN X 48IN X 120IN boards)
  pdfbook.js        # text-PDF vendor price list -> canonical rows + mapping,
                    # header-driven per page, feeds the mapped import (ADR 0010)
  manningtonbook.js # Mannington "Cartons Detail" price list -> canonical rows,
                    # fixed x-band grid (leftmost col is Pattern, not the code);
                    # floors keyed by Color Code, trims imported as their own
                    # transition products keyed by Catalog # (their 94" length
                    # read off the column header into size), flagged `trim` so
                    # the book can mark trims up separately from floors (ADR 0012)
  stock.js          # stock-item search / SKU fill snapshot / drift / base
                    # companions / grout families, over stock-shaped items
                    # (the ADR 0027 book items + projected family rows)
  booklink.js       # catalog ↔ ERP stock-book links (ADR 0027): link/family rule shapes,
                    # series-rule + color-token parsing, family resolution + projection into
                    # stock-shaped items, import-time sync, migration link proposals
  orderbook.js      # special-order ("order") book helpers (ADR 0009): item shape,
                    # cost/markup/sell, pick snapshot, drift, import diff
                    # (BOOK_FIELDS — tracking stock-kind `price` too, so a
                    # retail-only re-export still upserts — with changedFieldBits
                    # for the wizard's what-moved lines), and the
                    # import-review classifiers `itemProblems` (per-row pricing/unit
                    # hazards; `unitComboWarnings` aggregates it) + `supersedePairs`
                    # — plus the search collapse: `skuKeys` (the exact-membership
                    # key set for one stated code — its spelling, the
                    # separator-free form for lettered codes, less a leading SLR
                    # reseller prefix — ADR 0009 amendment 2026-08-21, issue 099:
                    # the EFT writes SLRKST965810BF for the stocked
                    # KST965/810BF), `mergeSearch` (a stock twin outranks its
                    # order copy, colliding on any skuKeys spelling of the stock
                    # row's sku or its sheet-stated vendorSkus) and
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
                    # -> grade -> width -> sheen, and an off-standard sheen there
                    # adds a $250 flat fee line (free on the custom/floor tab).
                    # Vent tab: the Prefinished/Textured toggles reveal stain-color
                    # and scrape pickers (order text only — the sheet's adders are
                    # flat), and a "Copy floor" button maps the last-open floor/
                    # stocked/herringbone tab's config onto the vent
                    # (ventFromFloor in sheoga.js: Maple -> Hard Maple, Live Sawn
                    # -> White Oak, finish -> prefin+stain, texture -> scrape).
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
                    # addSheogaLines. Job size starts at 1. Two markups: flooring
                    # settings.pricing.sheogaMarkupPct (40%), vents & dampers
                    # .sheogaVentMarkupPct (50%) — both Settings -> Price book.
                    # Responsive (useIsWide, 768px): desktop is the two-pane
                    # rail+BuildCard; on mobile the options fill the screen with a
                    # pinned price bar that pulls up a swipe-down MobileBuildSheet
                    # (BuildCard + Add). BuildCard is the shared cost->sell card.
                    # A price-level bar (TierBar) mirrors the job's tier buttons
                    # two ways — seeded from project.priceTier, pressing one sets
                    # it — and every price on screen renders through that lens in
                    # the tier's color (sheoga.js tierSellOf/tierFeeOf). Display
                    # only: rows Add/Move land RETAIL, the job sheet's own lens
                    # reprices them (ADR 0018). Opened from the Apps hub instead,
                    # the bar falls back to a local retail-seeded preview
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
                    # (½" sheets in level courses, mixed sizes, vertical when that
                    # kills the seams), benches (issue 069: `normBench`/
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
                    # `figureConsumables` (1 screw+washer and
                    # 1.2 oz sealant per ft² of panel), `coverFrames`/
                    # `coverFrameFor` (issue 072: the channel frame a LINEAR
                    # cover drops into — a design opt-in, never in the house
                    # kit, so `opts.coverFrame` stores a FINISH and the length
                    # follows the cover; a perforated cover wears the plain
                    # frame of its metal, a tileable one can take any of the
                    # four so the chip opens a picker), `tierPrice`, `factoryKit`,
                    # and `lineItems` (build -> product rows; the pan anchors and
                    # carries `product.wedi`, companions `wedi.part`). A
                    # non-dimensional item keeps its pricelist CONTENTS as its
                    # sizeText ("100 ct 1 5/8\" Screws…", "20 oz foil sausage",
                    # "2 per bag" — contentOf), so a Fastener Kit row says what
                    # one EA holds everywhere a size shows. Display names are a
                    # LAYER over the transcribed tables (issue 080, owner asks
                    # 2026-08-06): curbs read <len>\" <profile> Curb (CURB_NAMES,
                    # SKU-keyed; sizeText blank — second line is the SKU alone;
                    # curbs() orders full foam → lean → AT → caps), panels by
                    # the foot (4'x5'x1/2\" Building Panel), bases size-first
                    # (36\"x60\" Shower Base, offset drains named), covers with
                    # finish WORDS for the codes (FIN_SHORT; full finish stays
                    # the second line), niches by their EXTERIOR with "interior
                    # 12\" x 8\"" as sizeText (vendor-name parse, 4\" flange
                    # fallback) — all derived in makeEntry, so a pricelist
                    # re-transcription keeps every treatment. A pricelist
                    # update is a re-transcription of this one file (wedi.test.js)
  wediquery.js      # the wedi search-entry recognizer — the BOOT half of issue
                    # 066: `queryHit`/`parseQuery`/`querySummary`/`seedFromQuery`
                    # over ~30 trade words and a size regex, so the pinned "Vendor
                    # configurators" row can decide on every keystroke without the
                    # ~2 000-row catalog. Must NEVER import wedi.js — wedi.js
                    # re-exports these four (ADR 0026, wediquery.test.js)
  WediConfigurator.jsx  # the wedi popup, a `React.lazy` chunk (ADR 0026) so the
                    # tables stay off boot. Carries the shared SourceSwitch
                    # (phase 4): Stock only re-solves an active custom room
                    # (options re-rank; with only a kit loaded the cards
                    # refresh WITHOUT touching the build — runSolve would
                    # adopt res[0] and wipe the kit), grays SO kit rows,
                    # hard-filters Browse, and narrows swap/chip/premade
                    # choice lists to stocked rows unless none are (then the
                    # full list stays so a menu is never empty and a pick
                    # lands flagged). Session state only — never persisted
                    # into product.wedi. Three tabs — Kits (every stocked pan
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
                    # "Clear design" sits in the popup head immediately LEFT of
                    # that tier bar (owner 2026-08-04): it wipes the whole build,
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
                    # there) but no `onQuoteOptions` — there is no host area
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
                    # split) — no per-item lookup table, so a caller feeds it
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
                    # 100) feed wallArea like any wall, and `entryOpening`
                    # is what the entry walls leave open: the curb is picked
                    # and cut to the OPENING, and a fully walled entry
                    # carries no curb line at all (curbless still ramps). `pickFrom`/`stockPool` (phase 4)
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
                    # 2/4/6 pinned in the header comment): factory-kit corner
                    # counts on point/offset (4 inside + 2 outside), the Vario
                    # flange kit self-contained on linear builds, curb
                    # multiples cut end-to-end with their own corners,
                    # membrane walls +10% for laps with a by-others backer
                    # note line, board walls at 1.05x coverage + fasteners,
                    # ALL-SET at ceil((wallSf+floorSf)/55), a curbless build
                    # taking the ramp instead of a curb, benches per decision
                    # 4 (framed -> 1/2" wrap, buildup -> 2x 2" board), and a
                    # no-fit room falling back to `cfg.mortarItem` (a Settings
                    # -> Materials pick, its own rate) plus KERDI over the
                    # cured bed — decision 2, never a $0 by-installer line.
                    # `buildKit` implements only the two site-built bench
                    # forms (framed / 2" build-up); the premade SB bench is
                    # a catalog pick (`g: "extra"`), landed as a UI add-on in
                    # phase 3 — decision 4's third option is deferred there,
                    # not dropped. `tierPrice` is the ADR 0032 lens: retail is a stocked
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
                    # kit's lines, companions carry `{ part: true }`. A
                    # classified row whose name doesn't lead with a Schluter
                    # family word gets a "Schluter — " brandColor lead (the
                    # wedi idiom); a non-classified item (the Settings
                    # mortar) never does — it isn't necessarily Schluter
                    # goods. Geometry (the Iso/TopDown drawings) is
                    # deliberately NOT this module's concern — that mapping
                    # lives in schluterdraw.js, and every live row this
                    # module sees crosses schluteradapter.js first
  schluterfixture.js  # the 2026-08-20 stock-sheet/EFT snapshot schluter.js's
                    # tests are pinned against (schluter.test.js) — the ERP
                    # Vendor SKU Analysis + dealer-cost EFT the prototype was
                    # approved on. Production NEVER reads this file; it exists
                    # so `classify`/`buildKit`/`tierPrice` have a real,
                    # stable catalog to run against without a live Supabase
                    # book (the registry-driven design, ADR 0032, means there
                    # is no other fixture to fall back on)
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
                    # the Vario channel at cfg.w−8 along the back wall),
                    # `schluterWalls` (the three fixed walls as dWalls, plus
                    # cfg.xwalls appended in the wedi extra-wall shape,
                    # anchored at whichever end their `at` says;
                    # 48"-panel course joints ONLY on board walls — membrane
                    # walls have no seams to tick — with y0/ch so the
                    # isometric draws the same joints), `schluterCurb` (one
                    # entry run over the OPENING the entry xwalls leave,
                    # butting them — fully walled = no band —
                    # the KBSC 4½"×6" profile; curbless = no band,
                    # the ramp is a build line), `schluterWallOn`. Never
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
  SchluterConfigurator.jsx  # the Schluter popup, a `React.lazy` chunk (ADR
                    # 0026) — the React port of the approved prototype
                    # (.scratch/097, P1/P2), wedi's sibling over the same
                    # shell idioms: Kits (every tray a row, grouped by TYPE —
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
                    # add-on chips (extras — premade SB bench = decision 4's
                    # third option — and both site-built bench forms) moved
                    # to the BUILD COLUMN's Add-ons group (issue 100, the
                    # wedi idiom) so a shelf-kit pick reaches them on every
                    # tab; the marker cfg carries xwalls/drainX/drainY and
                    # any of them flips mode to "custom") /
                    # Browse (filter board over the classified groups,
                    # factory kits ONLY here — decision 5 — the thin-set/
                    # KERDI figurer, stock-tinted stepper rows), over the
                    # shared build column (grouped lines, from-stock meter,
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
                    # restores add-ons and the source switch)
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
                    # the prop is given
  wedipreview.jsx   # dev-only harness (wedi-preview.html): the REAL
                    # WediConfigurator over the real engine, no Supabase and no
                    # App shell — the wedi half of the change-control preview
                    # shots. It feeds the SAME fixture-through-normOrderItem
                    # registry bag schluterpreview.jsx does (stockRows/books/
                    # loadBookItems/mortars), because the Compare tab inside
                    # the wedi popup assembles the Schluter catalog itself
                    # (useSchluterCatalog) — without the bag that column is
                    # only ever "Loading the Schluter price books…". Same
                    # no-op `onQuoteOptions`; not part of the app build
  comparekit.js     # one room priced in BOTH shower systems (phase 5,
                    # ADR 0034) — the first module allowed to import wedi.js
                    # and schluter.js together, and outside the compare chunk
                    # the only one that should: it owns the mapping and nothing
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
                    # align both bills on COMPARE_CATS (Schluter lines carry
                    # the token in `l.g`; wedi maps from the catalog
                    # `item.group`) as EXTENDED amounts, every price coming
                    # back out of the engine that made the line — nothing is
                    # re-derived here. `noteOnly` rows are KEPT at $0: the
                    # wedi column appends the "Thin-set for pan bed — by
                    # others" note and the Schluter column carries its
                    # substrate-by-others line, which together are the
                    # walls-difference story (the wedi panel IS the
                    # substrate); `compareTotals` then excludes them
                    # (comparekit.test.js, over the frozen schluterfixture)
  CompareTab.jsx    # the Compare surface (phase 5, ADR 0034, prototype P3):
                    # the fourth tab in EITHER vendor popup — the category rail
                    # beside a wedi column and a Schluter column, a Retail/
                    # Builder lens, totals + the delta line (with the
                    # walls-aren't-apples-to-apples caveat), the three
                    # diffnotes cards, and the optional quote-options footer,
                    # whose confirm modal takes its own rung on the Esc ladder
                    # (useEscClose, ADR 0028) so a press dismisses the modal
                    # and leaves the live build standing. The popup passes its
                    # raw live cfg as `hostCfg`, the NEUTRAL ROOM derived HERE
                    # (roomFromWedi/roomFromSchluter) — the popups must never
                    # import comparekit themselves, so the two engines only ever
                    # meet inside this lazy chunk. The HOST column shows that
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
                    # (App.jsx's compareOptionsPatch landing). LAZY-CHUNK-ONLY
                    # (ADR 0026): it pulls comparekit → both engines, so only a
                    # React.lazy mount may reach it
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
                    # { full, short, rank }; rank is DROP priority, not print
                    # order, and rank 0 is identity and never dropped
  orderentry.js     # "Copy for order entry" pure logic: `isSpecialOrder` (a row
                    # is a special order when it carries a price-book `bookId` OR
                    # a `sheoga` marker — Sheoga floors AND their at-cost fee
                    # lines, which carry `sheoga` with no `cfg`), plus
                    # `orderDescription` (the row -> descfit ladder, flowing
                    # unit · size · product · SKU · coverage; a Sheoga row
                    # abbreviates losslessly off `sheoga.descParts`, anything else
                    # is arbitrary vendor text with no short rung. The buy/sell
                    # unit tag LEADS and never drops (rank 0, 2026-08-01) — the
                    # ERP has no unit field and keys every line as each, so a
                    # carton line not saying CT in its own text orders 44 tiles
                    # instead of 44 cartons; `tightSize` makes a dimension one
                    # token, `12"x24"`, collapsing only between digits so a "Hex
                    # Tile" keeps its spaces) and
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
  orderentry.jsx    # the panel itself — Special order (per-line copy) above
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
                    # pieces can't share a quantity column
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
  labels.js         # Label Generator pure logic (Apps hub): LABEL_FIELDS,
                    # built-in size presets, preset/label normalization
                    # (incl. "sp_" filler spacer lines — user-added blanks
                    # whose size is a height in px, holding a gap open),
                    # stock->field mapping, per-letter-sheet math, print HTML
  AppsWorkspace.jsx # the Apps hub overlay (SettingsWorkspace-style shell) +
                    # the Label Generator UI (preset strip, SKU fill,
                    # drag-to-reorder lines + filler spacers, preview with
                    # line-boxes toggle, label set, print). Also hosts the
                    # embedded vendor configurators, each fed by App.jsx's
                    # `sheoga`/`wedi`/`schluter` prop bag — both shower bags now
                    # carry the OTHER engine's builder knob (and the wedi bag
                    # the Schluter registry props) so the hub's copies render
                    # their Compare tab; neither gets `onQuoteOptions`, since
                    # the hub has no host area to hang option A/B on
  lib/supabase.js   # Supabase client (reads VITE_ env vars)
```
