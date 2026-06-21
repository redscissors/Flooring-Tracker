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
  lib/supabase.js   # Supabase client (reads VITE_ env vars)
supabase/
  schema.sql        # run once: app_data + customers tables + RLS
  storage.sql       # run once: attachments bucket + storage policies
netlify.toml        # build config for Netlify
```

## Data model

Customers live in their own `customers` table (one row each) so they can be
shared; per-user `settings` still live in the `app_data.data` jsonb blob.

```
app_data.data : { settings: Settings }          // per user

customers row : { id (text), owner_id (uuid), visibility:"private|public",
                  data: Customer, created_at, updated_at }

Customer { id, name, address, phone, email, notes, createdAt,
           categories: Area[], versions: Version[], attachments: Att[] }
Area     { id, name, note, products: Product[] }
Product  { id, type:"tile|hardwood|vinyl|laminate|carpet",
           L, W, thickness, sizeText, brandColor, priceSqft,
           qtyType:"sqft|count", qty, note,
           grout:{checked,product,color,joint}, mortar:{checked,product,manual} }
Version  { id, label, savedAt, snapshot: Area[] }
Att      { id, name, type, size }   // file bytes live in Storage, not here
Settings { wastePct, mortars{...}, grouts{...} }
```

**Sharing.** `visibility` is `private` (owner only) or `public` (every signed-in
user can see AND edit it — last-write-wins). RLS enforces this: read = own or
public; edit = own or public; delete = owner anytime, or anyone once a *public*
customer is 30+ days old (from `created_at`); a trigger blocks non-owners from
changing `owner_id`/`visibility`. In memory each customer carries `ownerId` +
`visibility` (stripped out by `custData()` before writing the jsonb). Attachment
files are stored at `<customer_id>/<file_id>` so storage policies can follow the
same rules. Existing data is migrated out of the old `app_data` blob on first
load (`migrateLegacyCustomers`).

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
  an `UPDATE` of that one row's `data`. Sharing changes use `setVisibility`,
  create/delete use `addCustomer`/`delCustomer`, and settings use `setSettings`
  (writes the `app_data` blob). Keep these write paths; don't write ad hoc.
  `updateCust` never sends `owner_id`/`visibility`, so the guard trigger only
  fires for the explicit visibility toggle.
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
