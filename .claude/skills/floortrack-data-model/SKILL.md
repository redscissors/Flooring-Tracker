---
name: floortrack-data-model
description: The shape of every stored FloorTrack record — the app_data, customers, versions and todos tables and the Customer/Area/Product object graph. Use before changing any persisted shape, normalizer (normC/normA/normP/mergeSettings), snapshot field, or supabase/*.sql migration.
---

# FloorTrack data model

Customers live in their own `customers` table (one row each) so they can be
shared; the per-user `app_data.data` jsonb blob now holds only that user's
`profile` (settings moved to the shared record, ADR 0002).

```
app_data.data : { profile: { name, phone, email } }   // per user; stamped onto each
                                                      // NEW project as its salesperson
                                                      // snapshot (ADR 0008)

customers row : { id (text), owner_id (uuid, nullable "created by"),
                  data: Customer, created_at, updated_at,
                  project_no (int, unique, nullable) }
                  // project_no (projects table post-ADR-0005, spec 2026-08-14):
                  // the permanent N-number, minted by the claim_project_no RPC
                  // on the first REAL name (isRealProjectName — never for the
                  // "New Project" default or quick auto-names), never reused or
                  // renumbered. Column only: the app mirrors it as `projectNo`
                  // in memory and custData strips it from every jsonb write.
                  // supabase/project-numbers.sql; absent until the owner runs it.

versions row  : { id (text), customer_id, label, auto (bool), saved_at,
                  snapshot: Area[] }            // one row per saved version

todo row      : { id (text pk), position (float — open-item order, smaller = higher),
                  data: { text, done, doneAt, createdBy, createdAt } }
                  // team issue / to-do list (issue 006), shared like customers

claude_issue row : { id (text pk), data: { text, done, doneAt, createdBy, createdAt,
                  source: { kind: "job"|"book"|"general", custId, custName,
                            areaName, productId, bookId, bookName, sku,
                            snapshot } } }
                  // central Claude issue bucket (issue 087), shared like todos;
                  // reads newest-first (created_at), no manual ordering.
                  // `source.snapshot` freezes the flagged row/item AT FLAG TIME
                  // alongside the live ids, so the copy report survives later
                  // edits and deletes; shape in src/claudeissues.js
                  // (normClaudeIssue / jobSource / bookSource). A price-book
                  // flag ALSO writes the item's `claudeIssue` mark (ADR 0009
                  // contract) so the book page's filter chip stays cheap —
                  // unparking the mark does not touch the central row.

Customer { id, name, address, phone, email, notes, createdAt,
           categories: Area[], attachments: Att[],
           salesperson: { name, phone, email } | null,
           priceTier: "retail|builder|employee|sale|custom", customPct,
           printPricing: "full|unit|none", freight: bool,
           optionNames: {A?..L?} }   // optionNames = quote-option labels (ADR 0031; slots A–L since 2026-08-26)
           // freight = the job's freight master switch (ADR 0030), default ON
           // (an absent field is a job quoted before it existed). Off means no
           // freight line anywhere, whatever the rows say.
           // priceTier/printPricing (ADR 0018) = the job's price point and how
           // much pricing the printed estimate shows. Tiers are a DISPLAY LENS
           // (src/pricing.js tierView) over the stored retail prices — rows are
           // never repriced. Employee = costSqft × 1.06 on costed lines only;
           // order entry stays retail except on the Employee tier.
           // salesperson = snapshot of the CREATOR's profile (ADR 0008); the
           // estimate prints it (falling back to the signed-in profile when
           // null, i.e. pre-0008 records); editable via the header popover.
Area     { id, name, option: ""|"A"…"L", products: Product[] }   // option = quote-option slot (ADR 0031, A–L since 2026-08-26); "" = shared base
Product  { id, type:"tile|hardwood|vinyl|laminate|carpet",
           sku, L, W, thickness, sizeText, brandColor, priceSqft,
           qtyType:"sqft|count", qty,
           cartonSf, cartonPc, cartonUnit, cartonManual, note,
           grout:{checked,product,color,sku,joint,manual,caulk,caulkSku,caulkPrice}, mortar:{checked,product,manual},
           // grout.sku = the picked color's own price-book SKU, snapshotted at
           // color-pick time when the grout is linked to a book family
           // (ADR 0007); display-only, outranks the catalog product SKU on
           // summary/print lines. grout.caulkSku/caulkPrice = the same
           // section's color-matched caulk (the matrix's caulk column in that
           // color), snapshotted at the same moment; the SKU shows on caulk
           // lines and tubes × caulkPrice joins the estimate totals (rows
           // without a snapshot price cost $0, as before).
           underlay:{checked,product,manual,install},
           attached:{ [categoryId]: {checked,product,manual} },
           freight: "" | "off",
           sheoga: { mode, cfg } | null,
           wedi: { mode, cfg } | { part: true } | null }
           // freight = the row's opt-OUT of its book's freight program
           // (ADR 0030). "" (the default) means the row rides the vendor's
           // shipment; only the explicit "off" is stored, so a row saved before
           // the program existed is included too. The AMOUNT is never per row —
           // the vendor's minimum and pallet threshold are order-scoped, so
           // freightList charges each book once over every row that opted in.
           // sheoga = the raw Sheoga-configurator configuration (issue 023)
           // snapshotted onto a row added from the configurator, so
           // "Reconfigure" reopens the popup pre-filled (src/sheoga.js
           // calcConfig/lineItems). Display/reopen attribute only — the row's
           // price stays the ADR 0003 snapshot; nothing reprices from it.
           // wedi = the same marker for the wedi configurator (issue 066), on
           // the ANCHOR line only (the pan): { mode, cfg } re-lands the whole
           // kit through wedi.js kitFor, so "wedi — reconfigure" replaces the
           // kit's lines. Every companion line carries { part: true } instead.
           // attached = add-on material categories (ADR 0016, PR 3): one entry
           // per custom category, keyed by the category id, resolved by NAME at
           // calc time (mortar convention, no snapshot). getAttached does the
           // math — "coverage" scales like underlayment, "manual" is the typed
           // quantity — and attachedList aggregates the job's lines once for the
           // order summary, estimate breakdown, order sheet, and grand total.
           // underlay.install = also order the catalog-defined install
           // materials (backer mortar, screws) for the chosen underlayment
           // cartonSf = sq ft one carton/sheet covers (any type but misc;
           // snapshotted from the book's SF/CT or typed). With it set, the
           // order is whole cartons — exact = sqft×(1+waste)/cartonSf, order =
           // ceil, cartonManual overrides (like grout) — and the line total is
           // ordered cartons × cartonSf × priceSqft instead of sqft × priceSqft.
           // cartonPc = the piece-count twin for carton-only count lines
           // (ADR 0013 amendment): pieces typed in the grid's SF/EA column
           // round up to whole cartons of cartonPc, billing every piece.
           // cartonUnit = what those bundles ARE (CT/SH/RL) — a roll bundles
           // coverage exactly like a carton, so a 240 sf/RL sheet-vinyl row
           // orders in whole rolls and bills sqft × priceSqft.
           // sellUnit = what ONE of a COUNT line is (2026-07-25): "" means
           // each — the old and still the default — and a pick snapshots the
           // vendor's own unit when it isn't ("RL" for a Schluter roll), so
           // the grid, the print's price column, and the order panel all read
           // "$84.20/rl · 3 RL" instead of assuming "each". Label only: the
           // math is unchanged, and like every picked value it's a snapshot
           // (ADR 0003), so a re-import never re-labels a saved row.
Att      { id, name, type, size }   // file bytes live in Storage, not here
Settings { wastePct, mortars{...}, grouts{...},
           pricing: { builderPct: 8, salePct: 10, wediBuilderPct: 18,
                      quickMarkups: [30,50,100], descLimit: 30 } }
           // builderPct/salePct = Builder/Sale tier %s (ADR 0018).
           // wediBuilderPct = wedi's own Builder discount (issue 066) — 18
           // resolves to the owner's × 0.82 stamp, which every wedi line
           // carries in `tierPrice` and pricing.js prefers over builderPct.
           // quickMarkups = the price cell's cost-popup markup buttons
           // (costentry.js normQuickMarkups): up to 6, an absent list seeds
           // 30/50/100, an explicitly empty one means no buttons (the popup's
           // % box still takes any markup).
           // descLimit = how many characters the ERP's order-description field
           // holds; drives the order-entry fit ladder (descfit.js), 0 = off.
           // All edited in Settings → Price book.
```

**Versions** (issue 003) live in their own table so customer saves never carry
history. In memory a customer holds version *metadata* only (`{ id, label,
auto, savedAt }`, loaded with the detail); the snapshot is fetched on restore.
Besides hand-named versions (unlimited), an **auto version** is saved when a
customer is deselected (or the user signs out) with its `categories` changed
since open — the newest 5 autos per customer are kept, autos never evict named
versions. Versions, like customers, are open to every signed-in user.

**Stock price books** (issue 004, ADR 0003 → ADR 0027). The shop's stock is a
set of per-supplier ERP "Vendor SKU Analysis" exports (DOIT, GLATI, GUNDL,
MANMI, OHIVA, SHEOG…), each its own stock-kind registry book, dropped into the
Price book library like any vendor sheet (whole-book diff on re-drop, retired
SKUs marked `active=false`, never deleted). Their items are the row search's
instant in-memory tier (the bounded `useBookStock` cache), badged "stock" and
ranked ahead of the streamed special-order results. Typing/picking a SKU on a
product row **snapshots** the item's values onto the row — nothing reads a
book at calc time, so re-imports never change saved estimates. Items sold by
the carton/sheet fill their real flooring type even when the book has only a
per-carton price ($/sqft derives as price ÷ sf-per-carton) and snapshot their
coverage onto the row (`cartonSf`), so quantities and totals compute in whole
cartons. The exports carry no type column: the Unit of Stock column gates the
sell basis, and the type is read from the description's wording/size at import
(carton/bundle-sold rows with sf/ct coverage only); a leading bare plank width
(`6"`) lands in the size field, not the name (ADR 0029). The row keeps `sku` +
`bookId` so the UI can flag price drift
("price book now $X") via the on-demand item fetch. The SKU box searches by
SKU prefix or words ("transition" is a synonym for trim labels — reducer,
t-mold, end cap, stairnose…); shift-click selects several matches and adds
each as its own product row, and the Settings catalog's add-product form can
pre-fill name/price/coverage from a price book search. A Laticrete pigment
(Spectralock Part C, Permacolor Color Kit) is only the color; picking one
**auto-adds its default base unit** as an extra product row (Spectralock →
Full, Permacolor → Sanded), and that base row carries a chip to toggle the
alternate variant (Comm. Unit / Unsanded) — the pairing resolves against the
projected grout-family rows (`stockCompanionBase`/`stockBaseVariant`), no
hardcoded SKUs. The original hand-kept shop workbook and its `stock_items`
table were retired 2026-07-22 (ADR 0027 amendment); the table's data is kept
but unread.

**Catalog SKU link & grout base units** (ADR 0006). Catalog grout/mortar/
underlayment products carry an optional price-book `sku` — a display/refresh
attribute only (jobs still link materials by name, and nothing reads the stock
table at calc time). It shows on every material line in the order summary and
print, and lets the import refresh that product's price by exact SKU. A grout
product can also carry a `base` companion `{ sku, name, unit, price, per }` —
the two-part grout's base unit — ordered from the **consolidated** kit counts
(`ceil(total kits / per)`, Commercial unit = per 4) via `groutBaseList`, and
shown with the grout family in the order summary, estimate breakdown, and
order sheet. The Settings add-product pre-fill keeps the picked item's SKU and
auto-attaches a Laticrete pigment's default base. The hand-kept stock workbook
this pairing came from was replaced by linked ERP stock books (`product.link`,
ADR 0027) — the base-companion mechanics carried over unchanged.

**Grout colors from the book & the Settings workspace** (issue 007, ADR 0007).
A catalog grout can carry a `book` field naming a price-book grout *family*
(the Grout & Caulk sheet's per-color matrix, one stock item per family ×
color). A linked grout's job color dropdown lists the family's live colors
(`groutFamilies`/`groutColorItem` in stock.js, read at edit time only), and
picking a color snapshots that color's own SKU onto the selection
(`grout.sku`) — it outranks the catalog SKU on the summary/print lines and
re-imports never change it. The same pick also snapshots the color-matched
caulk's SKU and price (`grout.caulkSku`/`caulkPrice`, via `groutCaulkItem` —
the matrix section's caulk column in that color), shown on caulk lines in
the summary, order sheet, and print breakdown, with tubes × price counted
into the estimate totals; caulk itself never lives in the catalog.
Unlinked grouts keep the code-defined standard color list. Custom
underlayment install items also carry an optional `sku`. Families are defined
by `catalog.bookFamilies` — a matching rule over linked ERP stock books,
projected into the same stock-shaped items the retired workbook's parser
produced, so this resolution logic runs unchanged (ADR 0027); a grout whose
`book` names a family with no rule resolves like an unlinked grout.
Settings itself is a near-fullscreen workspace (`SettingsWorkspace` in
`SettingsWorkspace.jsx`): left-nav sections (General · Price book · Materials & add-ons ·
Backup & restore; the built-in Grout / Mortar / Underlayment categories
present as a locked library, spec 2026-07-15) with master→detail catalog
editing; every
SKU-bearing field is price-book-search-first with manual entry as the
fallback. The catalog master list is section-scoped: a company shows under a
section only when it has products of that section's kinds, the rest sit in a
collapsed "Companies with no …" group, and each company row's ⋯ menu holds
the add-product actions, rename, and delete (when empty). Products rename in
place from the detail header (`renameProduct` in catalog.js — same saved-jobs
consequence as delete since jobs resolve by name, and a renamed seed
underlayment tombstones its seed name like a deleted one).
The Add-ons group below the built-ins holds team-defined custom material
categories (ADR 0016): `catalog.categories` (name · floorTypes · coverage-or-
manual math · chip default · enabled) with company-grouped products in each
company's flat `attached` array (`categoryId` ties product → category), full
price-book parity including exact-SKU price refresh on import. Jobs wire them in
(PR 3): each enabled category whose `floorTypes` include a product row's type
shows an add chip beside Grout/Mortar/Underlayment; toggling it on pre-fills the
category default and the line joins the materials box, order summary, estimate
breakdown/totals, printed estimate, and order sheet. `getAttached` does the math
("coverage" like underlayment, "manual" a typed quantity), `attachedList` the
shared aggregate, and `materialWarnings` flags a checked chip whose product no
longer resolves — all resolving by name at calc time, like mortar.

**Vendor freight** (issue 061, ADR 0030). A special-order book can carry a
**freight program** — the rate table off the vendor's shipping sheet, stored in
`price_books.data.freight` (the slot ADR 0009 §3 reserved) and edited on the book
page beside the markup editor. Switching a blank program on prefills the
**Glazzio book only** (`freightSeedFor`, matched on the book name) with the
transcribed Ohio rates, labeled on the card until a rate is edited; every other
vendor's program opens empty rather than wearing Glazzio's prices. Unlike everything else a book holds, freight rates
are **read live at calc time**, never snapshotted: the charge depends on the job's
square footage, which moves with every edit, and a retyped sheet is the team
restating what shipping costs today rather than a vendor re-import rewriting a
quote. Every rule on a freight sheet is scoped to an **order** — the minimum, the
dollar threshold that flips a shipment onto flat-rate pallets, the per-piece
floor — so a product row's Freight chip is only an **opt-in** (freight is on by
default; only the explicit `"off"` is stored), and `freightList` charges each book
**once** over all the rows that opted in. What the row's chip shows is therefore
the job's charge from that vendor, not a share of it. A per-job master switch
(`project.freight`) turns the whole thing off — its own Include/None card in the
header, under Estimate shows but not part of it. Freight is charged **at cost**, exempt from the price tiers (ADR 0018
already excluded it from Employee pricing), prints as its own group in the
estimate's extras band, and files with the **special orders** in the order-entry
panel — by description, since there's no SKU to key. Size picks the rate table,
and the vendor draws that line at the **face area of one piece**: at
`largeAtSqin` and up (144 in² — a 12x12 — at Glazzio) a row is large format,
which no side measurement can express (an 8x16 is 128 in², a *smaller* piece
than the 12x12 that pallets, with a longer side). Two name lists override it,
both matched whole-word against the row's description: `largeSeries` ships large
whatever its size (the sheet's own "Harmonic 12x24 & Arvora LVT"), and
`smallSeries` — seeded `mosaic, mesh, penny round, sheet` — ships small whatever
the sheet measures, because **mounted sheet goods are priced by the chip**: a
12x12 mosaic is 144 in² of backing carrying a hundred 1" chips and rides the
per-foot table beside the 12x12 field tile that doesn't. A book-picked mosaic
needs no such help (ADR 0014 leaves L×W blank for the chip size, which is 1–4
in²); the list is what catches a hand-typed row carrying the sheet size in L×W.
First program: Glazzio, Ohio (`.scratch/061_vendor-freight-program/ticket.md`
transcribes the sheet; `.scratch/062_glazzio-large-format/` fixes the size rule).

**Team to-do list** (issue 006). The sidebar's "Issues" button (with an
open-item count badge) opens a shared list where anyone signed in can add
bugs/feature ideas, drag open items into priority order, check them off, reopen
or delete them, and clear the done section. Items live one-per-row in `todos`;
open items order by `position` (a drag renumbers all open items in one upsert),
done items sort by completion time. Backup/restore moved off the sidebar into
the bottom of the Settings modal.

**Sharing** (ADR 0004). Every customer is team-shared: any signed-in user can
see, edit, and delete any customer (last-write-wins). `owner_id` only records
who created the row — it grants no special rights and is nulled (not cascaded)
if that account is deleted. There is no private/public split and no archive
flag; old jobs sit behind the customer browser (the sidebar's Customers folder
opens the ERP-style directory grid, issue 040) and search. Attachment files are stored at
`<customer_id>/<file_id>` in a bucket open to any signed-in user. Existing data
is migrated out of the old `app_data` blob on first load
(`migrateLegacyCustomers`); installs created before ADR 0004 run
`supabase/migrate-shared-only.sql` once.
