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
                    # the split files below carry its extracted pieces
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
                    # never a copy of the job (options.test.js)
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
                    # state & warnings stay inline, hiding them hides the problem)
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
                    # transition products keyed by Catalog #, flagged `trim` so
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
                    # — plus the search collapse: `mergeSearch` (a stock twin
                    # outranks its order copy) and `collapseCopies`/`sameProduct`
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
                    # `kitFor` (the house-kit recipe per pan), `solve` (room ->
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
                    # tables stay off boot: three tabs — Kits (every stocked pan
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
                    # The rail sizes both drawings to its own measured box
                    # (railSplit) so they fit the column without scrolling on a
                    # big monitor: the 328-wide viewBox still stretches to the
                    # full width — type keeps its apparent size — and only the
                    # HEIGHT gives, split 268:306 down to a floor below which
                    # the rail scrolls as before. The column width never moves.
                    # The rail draws a to-scale top-down (4"-thick wall
                    # bands that only reach into a corner some perpendicular
                    # wall actually fills, exactly one slab claiming each corner
                    # square: at the BACK the back wall runs through and the side
                    # walls butt it; at the FRONT it inverts — the side wall
                    # carries all the way forward and the front wall butts
                    # against it, the continuous member on a real frame (owner
                    # 2026-08-03) — and a run carries out to the CURB's finished
                    # face wherever a curb turns that corner, because the curb
                    # butts into the wall: "the walls should always be flush with
                    # the curb / curb and tile thickness" (owner 2026-08-03).
                    # `curbCornerOut` is the ONE place that reach is figured and
                    # BOTH drawings read it, so they cannot drift apart again; it
                    # comes off the curb's own bands, so a lean curb asks 1½"
                    # where a standard one asks 4", and an "overall max" curb asks
                    # NOTHING — there the curb and the tile on its face sit inside
                    # the stated line the wall already stands on, which is what
                    # makes the wall flush with the TILED face. A run takes the
                    # longer of the wall reach and the curb reach, so a corner
                    # with both still draws one slab; with neither it stops on the
                    # line (which retired the isometric's own 4" overhang into an
                    # empty corner) — panel-seam ticks, square drains,
                    # dashed cut edges,
                    # drain callouts, corner cuts ghosting the full-size pan,
                    # pan hips aimed at the UNCUT pan's corners and clipped to
                    # the material — the folds are moulded, a site cut doesn't
                    # re-pitch them (owner 2026-08-03) —
                    # click an edge to add a wall — which HALF of the edge you
                    # click picks the END it returns from, since a wall is a RUN
                    # with an end (`at: "lo"|"hi"`, wedi.js wallSpans) and not
                    # just a length: a front half wall can come off either side
                    # wall, and "both sides" is simply one at each end with the
                    # walk-in left between them (owner 2026-08-03) — a corner to
                    # toggle a cut, and
                    # hover the pan along a wall or into a corner for a BENCH
                    # zone — click/right-click opens the bench menu (issue 069):
                    # premades, 2" build-up, or framed with the pan cut/swapped,
                    # the bench drawn in plan with the curb butting its face) over
                    # an isometric with 4"-thick wall slabs at per-wall heights,
                    # front (entry/right) walls drawn clear with dashed edges, and
                    # the panel courses dotted on the inner faces. Right-clicking
                    # a wall in either view opens its menu: size + which faces get
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
                    # Also an Apps-hub tab beside Sheoga (embedded, still its
                    # own lazy chunk): the tier bar falls back to a local
                    # retail-seeded preview and Add raises the hub's shared
                    # destination prompt (current project / new quick price)
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
                    # line-boxes toggle, label set, print)
  lib/supabase.js   # Supabase client (reads VITE_ env vars)
```
