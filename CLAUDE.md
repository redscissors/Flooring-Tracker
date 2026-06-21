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
  schema.sql        # run once: app_data table + RLS
  storage.sql       # run once: attachments bucket + storage policies
netlify.toml        # build config for Netlify
```

## Data model (stored in `app_data.data` jsonb)

```
{ customers: Customer[], settings: Settings }

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

- Every mutation goes through `persist(next)` → `setState` + upsert to Supabase.
  Keep that single write path; don't write to Supabase ad hoc.
- `normC/normA/normP` and `mergeSettings` normalize loaded/imported data — extend
  these when adding fields so old records stay valid.
- The Sage & Cream theme works by **overriding Tailwind's slate/indigo classes**
  in the `<style>` block. Reuse existing utility classes rather than inventing
  new colors.

## Not yet implemented

- **AI "Scan handwritten notes."** Requires the Anthropic API key to live in a
  serverless function (Netlify Function / Supabase Edge Function); the browser
  calls that function, never Anthropic directly. Restrict who can trigger it
  (accounts are already admin-only) and set a spend cap.
