---
name: floortrack-config-and-catalog
description: The catalog of every configuration axis in FloorTrack — env vars (VITE_SUPABASE_URL/ANON_KEY, PORT), the shared Settings record (waste rates + the Company → grout/mortar/underlayment catalog), code-constant seeds (SEED_COMPANIES, SEED_UNDERLAYMENTS, GROUT_COLORS, DEFAULTS, REF), the per-user profile, and the stock price book. Load this when asking "where does setting X live", "what's the default for Y", "how do I add a catalog product / product field / env var", "why didn't editing the seed change the catalog", "who can change this and how", or before touching src/catalog.js normalizers, Settings UI, .env, or netlify.toml. Not for build/dev-server problems (floortrack-build-and-env) or what grout coverage means in trade terms (flooring-domain-reference).
---

# FloorTrack configuration & catalog

Every knob in FloorTrack, where it lives, its default, and who may turn it.
FloorTrack has no feature-flag system; its "configuration" is three layers plus
two config-like data stores:

| Layer | Lives in | Changed by | Change vehicle |
|---|---|---|---|
| Env vars | `.env` (local), `netlify.toml` (deploy) | Owner | Code PR (netlify.toml) or local file edit (.env) |
| Shared Settings | `shared_settings` table, one `jsonb` row | Any signed-in user | Settings UI in the app |
| Code constants (seeds, palettes, math baseline) | `src/catalog.js`, `src/App.jsx` | Developers | Code PR only |
| Per-user profile | `app_data.data.profile` | Each user, own row | Profile modal in the app |
| Stock price book | `stock_items` table | Any signed-in user | Settings → price book import (diff preview) |

All code changes go through PR-only change control — see
**floortrack-change-control** before merging anything below.

---

## 1. Environment variables

Three vars total (as of 2026-07-06). There are no other `import.meta.env` or
`process.env` reads in `src/`.

| Var | Read in | Default / missing behavior |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | Missing → `isConfigured` is `false`, client is `null` |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Same |
| `PORT` | `vite.config.js` | Unset → Vite default 5173; set → that port with `strictPort: true` (dev server only, not baked into the bundle) |

Missing-var behavior: `src/lib/supabase.js` deliberately does **not** throw —
it exports `isConfigured = Boolean(url && anonKey)` and a `null` client.
`src/Root.jsx` checks `isConfigured` and renders a friendly `<SetupNotice />`
("Almost there — connect Supabase") instead of a blank screen. If you add a
load-bearing env var, extend that gate (checklist 7c).

Where they're set:

- **Locally**: `.env` at repo root, copied from `.env.example` (which documents
  both Supabase vars; values come from Supabase dashboard → Project Settings →
  API). `.env` exists on the owner's machine and is not committed.
- **Deploys**: `netlify.toml` `[build.environment]` hard-codes both Supabase
  vars so GitHub-connected Netlify builds need no dashboard config. Every push
  to `main` auto-deploys — that file IS production config.

**The anon key is public by design.** It ships in the browser bundle either
way; Row-Level Security on the Supabase tables is the actual security
boundary. Do not "fix" the key being visible in `netlify.toml`. Do not add
any secret (e.g. an Anthropic API key) as a `VITE_*` var — `VITE_`-prefixed
vars are inlined into the public bundle; secrets belong in a serverless
function (see CLAUDE.md "Not yet implemented").

---

## 2. The shared Settings object

**Storage**: one singleton row in `shared_settings` (`id = 'singleton'`,
constant `SHARED_SETTINGS_ID` in `src/App.jsx`). Created by
`supabase/schema.sql`; RLS allows any authenticated user to select, insert,
and update it.

**Who changes it**: any signed-in user, through the Settings modal in the app.
Saved **whole** on every edit — last-write-wins, accepted deliberately
(ADR 0002). There is no per-field merge; two people editing Settings at once
means the second save wins.

**Write path**: `setSettings(patch)` in `src/App.jsx` → optimistic
`setData` + upsert of `serializeSettings(next.settings)`. Only
`{ waste, catalog }` is persisted (`serializeSettings`, `src/catalog.js`);
the flat `grouts` / `mortars` / `underlayments` maps the math reads are
**derived** at runtime by `withDerived` / `resolveCatalog` and never stored.
Never write `shared_settings` any other way.

**Load path**: `loadSharedSettings` (App.jsx) reads the row →
`normalizeSettings(raw)` (catalog.js) fills gaps so old records stay valid.

### Persisted shape and defaults (verified against src/catalog.js, 2026-07-06)

```
{ waste: { tile, floor },
  catalog: { companies: Company[], removedSeeds: string[] } }
```

**waste** — `normWaste`:

| Field | Default | Notes |
|---|---|---|
| `waste.tile` | `10` (%) | Applies to tile lines + their grout/mortar |
| `waste.floor` | `10` (%) | Shared by hardwood/vinyl/laminate/carpet |

Migration: records written before the split stored a single `wastePct` number.
`normWaste` maps an explicit `waste.tile`/`waste.floor` first, else the legacy
`wastePct`, else 10. Misc lines carry no waste (`wasteFor` is never reached
for them).

**Company** — `normalizeCatalog`:

| Field | Default | Notes |
|---|---|---|
| `id` | generated (`cid()`) | |
| `name` | `"Company"` | |
| `enabled` | `true` (`enabled !== false`) | Company-level show/hide |
| `grouts` / `mortars` / `underlayments` | `[]` | Product arrays |

**Grout product** — `normGroutProduct` + `groutFields`:

| Field | Default | Meaning |
|---|---|---|
| `id` | generated | |
| `name` | `""` | The job link key — unique within grouts |
| `enabled` | `true` | Product-level show/hide |
| `coverage` | `0` | Sq ft per unit at the 12×12×3/8", 1/8"-joint baseline |
| `unit` | `"units"` | e.g. bags, units |
| `price` | `0` | Per unit |

**Mortar product** — `normMortarProduct` + `mortarFields`:

| Field | Default | Meaning |
|---|---|---|
| `id` / `name` / `enabled` | as grout | Names unique within mortars (may repeat a grout name) |
| `tier1` | `0` | Coverage, tile longest side < 8" |
| `tier2` | `0` | Coverage, 8–15" |
| `tier3` | `0` | Coverage, > 15" |
| `unit` | `"units"` | |
| `price` | `0` | |

**Underlayment product** — `normUnderlayProduct` + `underlayFields`:

| Field | Default | Meaning |
|---|---|---|
| `id` / `name` / `enabled` | as grout | |
| `coverage` | `0` | Flat sq ft per unit (no tile-size volumetrics) |
| `unit` | `"rolls"` | |
| `price` | `0` | |
| `types` | `[]` | Flooring types it's offered for; filtered to `FLOOR_TYPES`; empty = all types |
| `install` | `[]` | Extra install materials (below) |

**Install item** — `installItem`, two kinds:

| Kind | Fields | Notes |
|---|---|---|
| `"mortar"` | `id`, `kind`, `product` (mortar name), `coverage: 0` | Unit/price resolve live from the named catalog mortar |
| `"custom"` | `id`, `kind`, `name`, `coverage: 0`, `unit: "units"`, `price: 0` | Self-contained (screws, tape) |

Legacy items with no `kind` normalize to `"custom"` with fields intact. A
stored underlayment with **no** `install` key predates the field and gets the
seed defaults backfilled by name — once persisted, a cleared list stays
cleared.

`catalog.removedSeeds` is a tombstone list (normalized names) of deleted
starter underlayments so `backfillUnderlayments` doesn't resurrect them.

---

## 3. Enabled / show-hide semantics

- A product appears in job dropdowns only when **both** its company and itself
  are enabled: `isOffered(company, product)` → `offeredGrouts` /
  `offeredMortars` / `offeredUnderlayments` (the latter also filters by the
  product's `types` tag against the row's flooring type).
- The math **ignores** enabled entirely: `resolveCatalog` flattens every
  product into the name→numbers maps, so a saved job that picked a since-
  hidden product still calculates. Disabling never breaks saved jobs.
- **Deleting is sharper than disabling** (`removeProduct`): saved jobs keep
  the stored name but the math can no longer resolve it, so quantities stop
  calculating. Prefer disable; delete only when the team means it.

---

## 4. Code-constant configuration (changeable only by a code PR)

All in `src/catalog.js` unless noted:

| Constant | What it configures |
|---|---|
| `GROUTS`, `MORTARS` | Built-in product name lists; keys of `DEFAULTS`; used by `mergeSettings` for pre-catalog records |
| `FLOOR_TYPES` | `["tile","hardwood","vinyl","laminate","carpet"]` — valid underlayment `types` tags. (App.jsx's `TYPES` adds `"misc"` for flat-priced extras; misc is not a FLOOR_TYPE) |
| `DEFAULTS` | `waste: { tile: 10, floor: 10 }` + built-in grout coverages (e.g. PermaColor Select 110 bags, CEG-Lite 187 units) and mortar tiers (e.g. ProLite 90/63/45 bags) — used only when seeding/backfilling |
| `REF` | Grout math baseline: `((12+12)/(12*12)) * 0.375 * 0.125` (12×12×3/8" tile, 1/8" joint). Changing it rescales every grout quantity — don't |
| `SEED_COMPANIES` | How built-in grouts/mortars group under companies **at first seed only** |
| `SEED_UNDERLAYMENTS` | Starter underlayments (company, coverage, unit, `types`, `install` defs) — merged in **by name** when missing |
| `GROUT_COLORS` + `DEFAULT_COLORS` (**src/App.jsx**, near top, ~lines 25–30) | Grout color palettes, per ADR 0002 amendment 2026-06-23: a map keyed by grout product **name** → color list, falling back to `DEFAULT_COLORS` for unlisted grouts (`colorsFor`). Deliberately code-defined, NOT in the persisted catalog, not team-editable |
| `JOINTS`, `THICK`, `TYPE_ACCENT`, `AREA_ACCENTS` (App.jsx) | Joint/thickness dropdown options and UI accent colors |

### The seed-vs-live trap (read this before editing any SEED_* constant)

Seeds fill an **empty or incomplete** store; they do not update a live one.
Verified triggers (`normalizeSettings` + `loadSharedSettings`):

- `seedCatalog` runs only when the stored settings have **no**
  `catalog.companies` array at all (fresh install or pre-catalog record).
- `backfillUnderlayments` adds only `SEED_UNDERLAYMENTS` entries whose **name**
  is missing from the whole catalog (and not tombstoned in `removedSeeds`).
- `loadSharedSettings` persists the merged result only when the row is
  missing, pre-catalog, or fails `catalogHasSeedUnderlayments`.

Consequences:

- Editing a product's numbers in `SEED_COMPANIES`/`DEFAULTS` does **nothing**
  to the live shared catalog — the team's row already exists. Change numbers
  or add grout/mortar products via the **Settings UI**.
- Adding a new entry to `SEED_UNDERLAYMENTS` **will** reach live installs (the
  name-based backfill), but renaming a seeded product in the app makes the
  backfill re-add it under the original name.
- `GROUT_COLORS` is different: it's read live at render time, so a palette
  edit **does** ship to everyone on the next deploy. That's the sanctioned way
  to change grout colors.

---

## 5. Per-user config: the profile

`app_data.data.profile` — `{ name: "", phone: "", email: "" }`
(`normProfile`, App.jsx). Each user edits their own via the profile modal;
written by `saveProfile` (upsert of the user's `app_data` row, preserving the
rest of the blob via `appBlobRef`). Prints on the estimate header under the
eyebrow **"Your salesperson"**. This is the only per-user configuration left —
customers and settings both migrated out of `app_data` (ADR 0002 / 0004).

---

## 6. Stock price book (config-like data)

The shop's price book lives in `stock_items` (one row per SKU,
`supabase/stock.sql`), shared team-wide. It is changed **only** through the
Settings import flow: `importPriceBook` (browser-side `.xlsx` parse) → diff
preview → `applyImport` (upserts + `active=false` marks; never deletes).
No other code writes stock rows.

It intersects the catalog in one place: `syncCatalogPrices` (`src/stock.js`)
runs during import preview and updates a catalog product's `price` **only
when every active, non-discontinued book item matching the product's name
agrees on one price** (word-match on name; several colors of one grout at one
price is fine, "ProLite" matching ProLite and ProLite Rapid Set at different
prices is skipped). Changes go through the normal `setSettings` write path.
Per ADR 0003, nothing reads `stock_items` at calc time — SKU picks snapshot
values onto the product row, so re-imports never change saved estimates.

---

## 7. Checklists

All three routes end in a PR — never push to `main` (see
**floortrack-change-control**). CLAUDE.md rule: `normC/normA/normP` and
`mergeSettings` (plus `normalizeCatalog`) normalize loaded/imported data —
**extend these when adding fields so old records stay valid.**

### (a) Add a field to a catalog product (grout / mortar / underlayment)

1. Add the field with its default to the right field builder in
   `src/catalog.js`: `groutFields` / `mortarFields` / `underlayFields`
   (and `installItem` for install materials). This covers both
   `normalizeCatalog` (via `normGroutProduct` etc.) and `resolveCatalog` —
   they all funnel through the builders.
2. If the field must also exist on pre-catalog flat records, extend
   `mergeSettings` / `DEFAULTS`.
3. Surface it in the Settings UI (`CatalogSettings` in `src/App.jsx`) and in
   the add-product form.
4. Make the math consume it (`getGrout`/`getMortar`/`getUnderlay`/… in
   `src/catalog.js`).
5. Add a normalization test in `src/catalog.test.js` (old record without the
   field → default appears). Run `npm test` — 77 tests pass as of 2026-07-06.
6. Consider `seedCatalog`/`SEED_UNDERLAYMENTS` if seeds should carry a
   non-default value, and whether `syncCatalogPrices` shape changes.

### (b) Add a field to a Product row (a job's selection line)

1. Add the default to `normP` **and** `newProduct` in `src/App.jsx` (they must
   agree).
2. Add the UI on the selection card.
3. If it shows on output, extend the print layout and the CSV export header +
   row builders (App.jsx, search `"Customer", "Area", "Type"`).
4. Product rows are normalized in App.jsx, which has no tests — verify by
   loading an old customer in the preview app (a record saved before the field
   existed must not break), and cover any pure math the field feeds in
   `src/catalog.test.js`.
5. If versions/backup restore the field, confirm `normA`→`normP` runs on those
   paths (it does today — restore and import both map through them).

### (c) Add an environment variable

1. Document it in `.env.example` with a placeholder.
2. If deploys need it, add it to `netlify.toml` `[build.environment]` —
   remembering `VITE_*` values are public; secrets don't go here.
3. If the app can't run without it, extend the `isConfigured` gate in
   `src/lib/supabase.js` (or the relevant module) and the `SetupNotice` copy
   in `src/Root.jsx` so a missing var fails friendly, not blank.
4. PR it; the Netlify build picks up `netlify.toml` on merge to `main`.

---

## 8. When NOT to use this skill

- **Build, dev server, dependency, or Node/Vite issues** → use
  **floortrack-build-and-env**.
- **What coverage/joint/waste/thinset mean in flooring terms**, or why the
  grout math is volumetric → use **flooring-domain-reference**.
- **Whether/how a change may merge** (PR gates, preview proof, SQL handoff)
  → use **floortrack-change-control**.
- **Estimate numbers coming out wrong** → **floortrack-debugging-playbook** /
  **floortrack-estimate-correctness-campaign**.

---

## Provenance and maintenance

All facts verified against the repo on **2026-07-06** (branch
`claude/compact-product-fields`). Line numbers drift; re-verify with the greps
below before trusting the volatile tables.

| Fact | Source | Re-verify |
|---|---|---|
| Env var names + missing-var gate | `src/lib/supabase.js`, `src/Root.jsx` | `grep -rn "import.meta.env\|process.env" src vite.config.js` |
| PORT handling | `vite.config.js` | `grep -n PORT vite.config.js` |
| Deploy env | `netlify.toml` | `grep -n VITE_ netlify.toml` |
| Settings defaults & field builders | `src/catalog.js` (`DEFAULTS`, `normWaste`, `groutFields`, `mortarFields`, `underlayFields`, `installItem`) | `grep -n "groutFields\|mortarFields\|underlayFields\|installItem\|DEFAULTS = " src/catalog.js` |
| Persisted vs derived settings | `serializeSettings`/`withDerived` in `src/catalog.js` | `grep -n "serializeSettings\|withDerived" src/catalog.js` |
| Singleton row + RLS + write path | `supabase/schema.sql` (`shared_settings`), `setSettings` in `src/App.jsx` | `grep -n shared_settings supabase/schema.sql src/App.jsx` |
| Seeding triggers | `normalizeSettings`, `backfillUnderlayments`, `catalogHasSeedUnderlayments` (catalog.js); `loadSharedSettings` (App.jsx) | `grep -n "seedCatalog\|backfillUnderlayments\|catalogHasSeedUnderlayments" src/catalog.js src/App.jsx` |
| Enabled semantics | `isOffered`, `resolveCatalog`, `offeredUnderlayments` in `src/catalog.js` | `grep -n "isOffered\|resolveCatalog" src/catalog.js` |
| Grout palettes (per-name map) | `GROUT_COLORS`/`DEFAULT_COLORS`/`colorsFor`, `src/App.jsx` ~lines 25–30; ADR `docs/adr/0002-shared-grout-mortar-catalog.md` amendment 2026-06-23 | `grep -n "GROUT_COLORS\|DEFAULT_COLORS" src/App.jsx` |
| Profile shape + print label | `normProfile`, `saveProfile`, "Your salesperson" in `src/App.jsx` | `grep -n "normProfile\|salesperson" src/App.jsx` |
| Price sync rule | `syncCatalogPrices` in `src/stock.js` + tests | `grep -n syncCatalogPrices src/stock.js src/stock.test.js` |
| Test count (77) | `npm test` output | `npm test 2>&1 \| tail -5` |
| normP / newProduct row defaults | `src/App.jsx` | `grep -n "const normP\|const newProduct" src/App.jsx` |
