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
  pricebook.js      # stock price book .xlsx -> flat stock items (ADR 0003)
  stock.js          # stock search / SKU fill / drift / import diff / catalog sync
  lib/supabase.js   # Supabase client (reads VITE_ env vars)
supabase/
  schema.sql        # run once: app_data + customers + versions tables + RLS
  storage.sql       # run once: attachments bucket + storage policies
  stock.sql         # run once: stock_items table + RLS (stock price book)
  migrate-shared-only.sql  # run once on pre-ADR-0004 installs: drop visibility/archived
netlify.toml        # build config for Netlify
```

## Data model

Customers live in their own `customers` table (one row each) so they can be
shared; per-user `settings` still live in the `app_data.data` jsonb blob.

```
app_data.data : { settings: Settings }          // per user

customers row : { id (text), owner_id (uuid, nullable "created by"),
                  data: Customer, created_at, updated_at }

versions row  : { id (text), customer_id, label, auto (bool), saved_at,
                  snapshot: Area[] }            // one row per saved version

stock row     : { sku (text pk), active (bool), data: StockItem, updated_at }
                  // one row per price book SKU; imports upsert, never delete

Customer { id, name, address, phone, email, notes, createdAt,
           categories: Area[], attachments: Att[] }
Area     { id, name, note, products: Product[] }
Product  { id, type:"tile|hardwood|vinyl|laminate|carpet",
           sku, L, W, thickness, sizeText, brandColor, priceSqft,
           qtyType:"sqft|count", qty,
           cartonSf, cartonUnit, cartonManual, note,
           grout:{checked,product,color,joint,manual}, mortar:{checked,product,manual},
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
search.

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
  and settings use `setSettings`. Stock rows are written only by
  the import flow (`importPriceBook` -> preview -> `applyImport`: upserts +
  `active=false` marks — no deletes). Keep these write paths;
  don't write ad hoc.
- `normC/normA/normP` and `mergeSettings` normalize loaded/imported data — extend
  these when adding fields so old records stay valid.
- The theme (monochrome, inspired by matthaeusjandl.com) works by **overriding
  Tailwind's slate/indigo classes**. These overrides live in `src/index.css` so
  the login screen (`Auth.jsx`) and the app share one palette. Reuse existing
  utility classes rather than inventing new colors; adjust the `--ft-*` variables
  in `index.css` to retheme.

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