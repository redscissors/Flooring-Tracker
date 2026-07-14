# CLAUDE.md — FloorTrack

> Flooring & Tile Selection Manager — real web app (React + Vite + Supabase)

This file orients Claude Code (and humans) working in this repo. It reflects the
**deployed web app**, which was ported from the original Claude artifact.

---

## What it is

A single-page business tool for flooring/tile contractors to manage customer
selections by area, auto-calculate grout/mortar quantities, track pricing, save
versions, attach files, and print/export clean estimates. Cloud-synced with
per-user login.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 (hooks only, no router) |
| Build | Vite 5 |
| Styling | Tailwind 3 + CSS custom properties (Sage & Cream theme in a `<style>` block) |
| Icons | lucide-react |
| Auth | Supabase Auth (email/password, **sign-in only** — accounts created by admin) |
| Data | Supabase Postgres — one `app_data` row per user holding all state as `jsonb` |
| Files | Supabase Storage (private `attachments` bucket, path `<user_id>/<file_id>`) |
| Export | Browser `Blob` + `URL.createObjectURL` (CSV, JSON backup) |
| Print | CSS `@media print` — separate hidden print layout |

> **Differs from the original artifact:** `window.storage` → Supabase; attachment
> bytes → Supabase Storage; the AI "Scan notes" feature is **not** included (it
> needs a server-side API key — see below).

## Source layout

```
index.html
src/
  main.jsx          # React entry
  Root.jsx          # Supabase config check + auth session gate
  Auth.jsx          # sign-in screen (sign-up disabled by design)
  App.jsx           # the FloorTrack application (props: { user, onSignOut })
  catalog.js        # settings normalization + material math + shared catalog
  pricebook.js      # stock price book .xlsx -> flat stock items (ADR 0003);
                    # + generic mapped import for order/registry books (ADR 0009)
  pdfbook.js        # text-PDF vendor price list -> canonical rows + mapping,
                    # header-driven per page, feeds the mapped import (ADR 0010)
  manningtonbook.js # Mannington "Cartons Detail" price list -> canonical rows,
                    # fixed x-band grid (leftmost col is Pattern, not the code);
                    # floors keyed by Color Code, trims imported as their own
                    # transition products keyed by Catalog # (ADR 0012)
  stock.js          # stock search / SKU fill / drift / import diff / catalog sync
  synonyms.js       # trade-synonym map for price-book search (ADR 0009 §6, Option D)
  lib/supabase.js   # Supabase client (reads VITE_ env vars)
supabase/
  schema.sql        # run once: app_data + customers + versions tables + RLS
  storage.sql       # run once: attachments bucket + storage policies
  stock.sql         # run once: stock_items table + RLS (stock price book)
  todos.sql         # run once: todos table + RLS (team issue / to-do list)
  pricebooks.sql    # run once: price book registry + items + versions tables
                    # + RLS (ADR 0009; docs/pricebook/design.md)
  pricebook-search.sql  # run once after pricebooks.sql: pg_trgm + generated
                    # search_text column on price_book_items for indexed
                    # selection-row order search (ADR 0009 §6; code falls back
                    # to per-field ILIKE until it is run)
  pricebook-delete.sql  # run once after pricebooks.sql on existing installs:
                    # DELETE policies so registry books can be hard-deleted
                    # (ADR 0009 delete amendment; folded into pricebooks.sql
                    # for fresh installs)
  pricebook-fuzzy.sql  # run once after pricebook-search.sql: search_price_book_items
                    # RPC (pg_trgm word_similarity) for typo-tolerant selection-row
                    # order search + trade synonyms (ADR 0009 §6; src/synonyms.js;
                    # code falls back to synonym-aware exact ILIKE until it is run)
  migrate-shared-only.sql  # run once on pre-ADR-0004 installs: drop visibility/archived
netlify.toml        # build config for Netlify
```

## Data model

Customers live in their own `customers` table (one row each) so they can be
shared; the per-user `app_data.data` jsonb blob now holds only that user's
`profile` (settings moved to the shared record, ADR 0002).

```
app_data.data : { profile: { name, phone, email } }   // per user; stamped onto each
                                                      // NEW project as its salesperson
                                                      // snapshot (ADR 0008)

customers row : { id (text), owner_id (uuid, nullable "created by"),
                  data: Customer, created_at, updated_at }

versions row  : { id (text), customer_id, label, auto (bool), saved_at,
                  snapshot: Area[] }            // one row per saved version

stock row     : { sku (text pk), active (bool), data: StockItem, updated_at }
                  // one row per price book SKU; imports upsert, never delete

todo row      : { id (text pk), position (float — open-item order, smaller = higher),
                  data: { text, done, doneAt, createdBy, createdAt } }
                  // team issue / to-do list (issue 006), shared like customers

Customer { id, name, address, phone, email, notes, createdAt,
           categories: Area[], attachments: Att[],
           salesperson: { name, phone, email } | null }
           // salesperson = snapshot of the CREATOR's profile (ADR 0008); the
           // estimate prints it (falling back to the signed-in profile when
           // null, i.e. pre-0008 records); editable via the header popover.
Area     { id, name, note, products: Product[] }
Product  { id, type:"tile|hardwood|vinyl|laminate|carpet",
           sku, L, W, thickness, sizeText, brandColor, priceSqft,
           qtyType:"sqft|count", qty,
           cartonSf, cartonUnit, cartonManual, note,
           grout:{checked,product,color,sku,joint,manual,caulk,caulkSku,caulkPrice}, mortar:{checked,product,manual},
           // grout.sku = the picked color's own price-book SKU, snapshotted at
           // color-pick time when the grout is linked to a book family
           // (ADR 0007); display-only, outranks the catalog product SKU on
           // summary/print lines. grout.caulkSku/caulkPrice = the same
           // section's color-matched caulk (the matrix's caulk column in that
           // color), snapshotted at the same moment; the SKU shows on caulk
           // lines and tubes × caulkPrice joins the estimate totals (rows
           // without a snapshot price cost $0, as before).
           underlay:{checked,product,manual,install} }
           // underlay.install = also order the catalog-defined install
           // materials (backer mortar, screws) for the chosen underlayment
           // cartonSf = sq ft one carton/sheet covers (any type but misc;
           // snapshotted from the book's SF/CT or typed). With it set, the
           // order is whole cartons — exact = sqft×(1+waste)/cartonSf, order =
           // ceil, cartonManual overrides (like grout) — and the line total is
           // ordered cartons × cartonSf × priceSqft instead of sqft × priceSqft.
Att      { id, name, type, size }   // file bytes live in Storage, not here
Settings { wastePct, mortars{...}, grouts{...} }
```

**Versions** (issue 003) live in their own table so customer saves never carry
history. In memory a customer holds version *metadata* only (`{ id, label,
auto, savedAt }`, loaded with the detail); the snapshot is fetched on restore.
Besides hand-named versions (unlimited), an **auto version** is saved when a
customer is deselected (or the user signs out) with its `categories` changed
since open — the newest 5 autos per customer are kept, autos never evict named
versions. Versions, like customers, are open to every signed-in user.

**Stock price book** (issue 004, ADR 0003). The shop's price book workbook is
imported (Settings, browser-side parse with a diff preview) into `stock_items`,
shared team-wide. Typing/picking a SKU on a product row **snapshots** the
item's values onto the row — nothing reads the stock table at calc time, so
re-imports never change saved estimates. Items sold by the carton/sheet (U/M
`CT`/`SH`) fill their real flooring type even when the book has only a
per-carton price ($/sqft derives as price ÷ sf-per-carton) and snapshot their
SF/CT coverage onto the row (`cartonSf`), so quantities and totals compute in
whole cartons. The row keeps `sku` so the UI can
flag price drift ("price book now $X") and retired SKUs. Items missing from a
re-import are marked `active=false`, never deleted. The import also updates
ADR-0002 catalog prices when a catalog product name uniquely matches one book
price. The SKU box searches by SKU prefix or words ("transition" is a synonym
for the book's trim labels — reducer, t-mold, end cap, stairnose…); shift-click
selects several matches and adds each as its own product row, and the Settings
catalog's add-product form can pre-fill name/price/coverage from a price book
search. A Laticrete pigment (Spectralock Part C, Permacolor Color Kit) is only
the color; picking one **auto-adds its default base unit** as an extra product
row (Spectralock → Full, Permacolor → Sanded), and that base row carries a chip
to toggle the alternate variant (Comm. Unit / Unsanded). The pairing is
data-driven off the book's "Bulk & Base Units" section
(`stockCompanionBase`/`stockBaseVariant`), so no SKUs are hardcoded.

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
auto-attaches a Laticrete pigment's default base.

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
underlayment install items also carry an optional `sku`.
Settings itself is a near-fullscreen workspace (`SettingsWorkspace` in
App.jsx): left-nav sections (General · Price book · Grout & colors · Mortar &
underlayment · Backup & restore) with master→detail catalog editing; every
SKU-bearing field is price-book-search-first with manual entry as the
fallback. The catalog master list is section-scoped: a company shows under a
section only when it has products of that section's kinds, the rest sit in a
collapsed "Companies with no …" group, and each company row's ⋯ menu holds
the add-product actions, rename, and delete (when empty). Products rename in
place from the detail header (`renameProduct` in catalog.js — same saved-jobs
consequence as delete since jobs resolve by name, and a renamed seed
underlayment tombstones its seed name like a deleted one).

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
flag; old jobs sit behind the sidebar's age buckets ("This month" / "This
year" / "Older") and search. Attachment files are stored at
`<customer_id>/<file_id>` in a bucket open to any signed-in user. Existing data
is migrated out of the old `app_data` blob on first load
(`migrateLegacyCustomers`); installs created before ADR 0004 run
`supabase/migrate-shared-only.sql` once.

## Material math (tile only)

Grout scales volumetrically from a 12×12×3/8" / 1/8"-joint baseline:
```
REF = ((12+12)/(12×12)) × 0.375 × 0.125
vol = ((L+W)/(L×W)) × thickness × joint
coverage = baseCoverage × (REF / vol)
exact = sqft × (1 + wastePct/100) / coverage ;  order = ceil(exact)
```
Mortar uses tiered coverage by tile longest side (`max(L,W)`): `<8"`, `8–15"`,
`>15"`. Both have manual overrides. All rates/prices live in Settings.

The un-rounded "exact" value is always shown next to the rounded order quantity.

## Conventions

- Customer mutations go through `updateCust(id, patch)` → optimistic `setData` +
  an `UPDATE` of that one row's `data`. Create/delete use
  `addCustomer`/`delCustomer`, versions use
  `insertVersion`/`delVersion`/`loadVersion` (their own table, never the blob),
  settings use `setSettings`, and to-do items use `addTodo`/`updateTodo`/
  `delTodo`/`reorderTodos`/`clearDoneTodos`. Stock rows are written only by
  the import flow (`importPriceBook` -> preview -> `applyImport`: upserts +
  `active=false` marks — no deletes). Keep these write paths;
  don't write ad hoc.
- `normC/normA/normP` and `mergeSettings` normalize loaded/imported data — extend
  these when adding fields so old records stay valid.
- The theme ("the ned" Moss kit: ink & paper UI, single moss-green accent,
  moss data ramp, Manrope only) works by **overriding Tailwind's slate/indigo
  classes**. These overrides live in `src/index.css` so the login screen
  (`Auth.jsx`) and the app share one palette. Reuse existing utility classes
  rather than inventing new colors; adjust the `--ft-*` variables in
  `index.css` to retheme.

## Non-negotiables

Three standing rules govern every change. They exist because `main` auto-deploys
to the live site the sales team quotes real customers from, and there is no CI
gate — discipline is the only gate.

1. **Never mutate the live Supabase project on your own initiative** — no SQL, no
   data or storage writes. The `supabase/*.sql` files are run by hand by the owner
   in the dashboard; an agent ships the file and instructions, never executes it.
   (Local `npm run dev` talks to the *same* live project — there is no staging, so
   the code is sandboxed but the data never is.)
2. **Never push straight to `main`** — every change lands through a PR, even a
   one-liner, because a push to `main` is a deploy to production.
3. **No UI or print change merges without preview proof** — show it working
   (preview screenshot or prototype) before merge.

Rationale, the change-classification table, and the sanctioned write paths live in
the `floortrack-change-control` skill (`.claude/skills/`).

## Not yet implemented

- **AI "Scan handwritten notes."** Requires the Anthropic API key to live in a
  serverless function (Netlify Function / Supabase Edge Function); the browser
  calls that function, never Anthropic directly. Restrict who can trigger it
  (accounts are already admin-only) and set a spend cap.

Issue tracker
Issues live as local markdown files under `.scratch/NNN_<slug>/` (numbered group directories — see `docs/agents/issue-tracker.md`).
When you complete an issue, update its `Status:` field to `done` before committing.
Triage labels
Default canonical label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.
Domain docs
The project's north star lives at `docs/project-charter.md` (what it is, pillars, non-goals); the domain glossary lives at `docs/CONTEXT.md`; functional docs live under `docs/<area>/`. See `docs/agents/domain.md`.
Design decisions
Decisions that are hard to reverse, surprising, or trade-off-bearing are recorded as ADRs under `docs/adr/` (system-wide) or `docs/<area>/adr/` (area-scoped), indexed in `docs/adr/README.md`. When a decision lands mid-conversation, use `/decide` to record it and check it against the charter, glossary, and existing ADRs; use `/design-review` for a full pre-implementation grilling. Before contradicting a recorded decision or the charter, surface the conflict rather than silently overriding it.
Code Comments
Be very conservative with comments. Do not explain code that an experienced developer can understand by reading it. Comments should be rare and reserved for non-obvious business rules, surprising constraints, external system quirks, workarounds, or decisions that would look wrong without context. Prefer deleting comments unless they prevent a likely misunderstanding.