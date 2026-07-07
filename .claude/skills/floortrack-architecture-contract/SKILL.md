---
name: floortrack-architecture-contract
description: FloorTrack's load-bearing architecture as a contract — the data topology (which Supabase table holds what, RLS per table), the five doctrine pillars from the ADRs with their WHY and where code enforces them, a numbered list of invariants any change must preserve, the module map (pure/tested vs App.jsx untested), and the known weak points stated plainly. Load this before designing any change that touches the data model, storage, settings, catalog, stock, versions, or write paths; when asked "where does X live", "why is it built this way", "what must not break", "can I add a field/table", or when a proposed change might contradict a recorded decision. Not for day-to-day debugging (see floortrack-debugging-playbook), historical how-we-got-here (see floortrack-failure-archaeology), or making a NEW architectural decision (use /decide and floortrack-change-control).
---

# FloorTrack architecture contract

What this system promised itself, and where those promises are kept. Treat
every invariant below as binding: if your change breaks one, that is an
architectural decision — stop and run `/decide` (and load
`floortrack-change-control`) before writing code.

Jargon used once, defined once:

- **Selection** — one product row on a job (the domain glossary `docs/CONTEXT.md`
  flags "Product" as overloaded; the per-job thing is a Selection).
- **RLS** — Postgres Row Level Security; with the Supabase anon key public by
  design, RLS policies ARE the security boundary.
- **LWW** — last-write-wins: whole-object saves where the later save silently
  replaces the earlier one.
- **Snapshot** — values copied onto a row at pick time; later changes to the
  source do not alter the row.

## 1. Data topology

One Supabase Postgres project. Seven stores (six tables + one storage bucket),
each created by a SQL file the owner runs by hand in the dashboard — **never
run SQL against the live project yourself** (owner non-negotiable).

| Store | Key | Holds | Writes | RLS (verified in SQL) | SQL file |
|---|---|---|---|---|---|
| `customers` | `id` text (client `uid()`) | whole Customer as `data` jsonb (areas → selections); `owner_id` = "created by" only, nullable, `on delete set null` | whole-blob `UPDATE` per edit | select/update/delete: any authenticated; insert: `owner_id = auth.uid()` | `supabase/schema.sql` |
| `shared_settings` | `id` text, **one row `'singleton'`** | shop-wide Settings: `{ waste, catalog }` (waste split `{tile, floor}`; catalog = Company → grout/mortar/underlayment products) | whole-record upsert (`setSettings`) | select/insert/update: any authenticated; **no delete policy** | `supabase/schema.sql` (lines ~108–132) |
| `versions` | `id` text | one snapshot per row: `customer_id` FK (cascade), `label`, `auto`, `saved_at`, `snapshot` jsonb = categories only | insert/delete only | select/insert/delete: any authenticated; **no update policy — rows immutable by design** | `supabase/schema.sql` |
| `stock_items` | `sku` text PK | `active` bool + `data` jsonb (one price-book item) | import flow only (upserts) | select/insert/update: `auth.uid() is not null`; **no delete policy — client cannot delete** | `supabase/stock.sql` |
| `todos` | `id` text PK | `position` float (open-item order) + `data` jsonb | per-item + bulk reorder upsert | full CRUD: any authenticated | `supabase/todos.sql` |
| `app_data` | `user_id` uuid PK | **only** `{ profile: { name, phone, email } }` per user (everything else migrated out) | whole-blob upsert (`saveProfile`) | own row only: `auth.uid() = user_id` on all four ops — the ONE per-user store | `supabase/schema.sql` |
| Storage bucket `attachments` | path `<customer_id>/<file_id>` | attachment bytes (metadata stays in the customer blob) | upload/remove alongside customer edits | private bucket; all four ops: any authenticated, no per-customer check | `supabase/storage.sql` |

**Where shared settings actually live** (ADR 0002 says "one shared store" —
here is the mechanism, verified as of 2026-07-06): the table is
`public.shared_settings` with a single row whose primary key is the literal
string `'singleton'` (`supabase/schema.sql` line 109 default). The client
constant is `SHARED_SETTINGS_ID = "singleton"` (`src/App.jsx` line 195);
`loadSharedSettings` (App.jsx ~line 475) reads it with
`.eq("id", SHARED_SETTINGS_ID).maybeSingle()` and best-effort seeds it from the
user's legacy per-user settings if missing; `setSettings` (App.jsx ~line 605)
writes it back whole via upsert. Only `{ waste, catalog }` is persisted
(`serializeSettings`, `src/catalog.js`); the derived name→numbers maps the math
reads are recomputed in memory (`withDerived`). Note: CLAUDE.md's data-model
sketch does not name this table — this section is the record.

Pre-ADR-0004 installs additionally ran `supabase/migrate-shared-only.sql` once
(drops `visibility`/`archived`, the owner-guard trigger, and re-points
`owner_id` to `on delete set null`).

## 2. The five doctrine pillars

Each pillar: what it is, why (from the ADR), and where code enforces it. Do not
route around any of these; contradicting one requires surfacing the conflict
(`/decide`), not silent override.

### P1 — Snapshot, don't live-link (ADR 0003)

Picking a SKU **copies** the stock item's values onto the selection
(`stockPatch`, `src/stock.js` line 108: type, price, brand/size, `cartonSf`);
the material math and totals never read `stock_items` at calculation time.
**Why:** estimates are quotes — a live link would silently rewrite every old
estimate when the book changes, precisely the failure the team asked to avoid.
Freshness is surfaced instead as a drift chip (`stockDrift`, stock.js line 143,
>$0.005 difference) with a one-click "Use new price" that is always a
deliberate human act (App.jsx ~line 1345).

### P2 — Hide, never delete (ADR 0002 / 0003)

Retired price-book SKUs are marked `active = false` (import `diff.missing` →
upsert in `applyImport`, App.jsx ~line 522); disabled catalog products keep
their numbers and stay resolvable. **Why:** old jobs and version snapshots hold
names and SKUs forever; deleting the referent orphans them and corrupts old
quotes. Enforced in code (`resolveCatalog` ignores `enabled`; `diffStock` has
no delete branch) and at the database (`stock.sql` and `shared_settings` define
no delete policy). Caveat the code documents itself (`removeProduct`,
catalog.js line 342): *hard-deleting* a catalog product is possible via
Settings and is deliberately sharper — jobs holding that name stop calculating.

### P3 — Jobs link products by name; names unique per kind (ADR 0002)

A selection stores only the grout/mortar/underlayment product **name**; math
resolves it against the flattened catalog at calc time. **Why:** every
existing job is a frozen blob holding only names — requiring ids or
company-qualified keys would force rewriting every old job; a unique-name rule
gets unambiguous resolution for free. Enforced by `isDuplicateName`
(catalog.js line 317, case/whitespace-insensitive via `normName`), gated in the
add-product UI (App.jsx line 1907). `resolveCatalog` (catalog.js line 364)
would let a duplicate silently last-write-win — the add-time gate is the only
guard, which is why it is an invariant (I3).

### P4 — LWW concurrency, accepted deliberately (ADR 0002)

Customers and settings save whole; two concurrent editors clobber each other,
later save wins. **Why:** the team is small, settings edits rare; optimistic
conflict detection (check-on-save, prompt) was designed and **consciously
shelved** — it is not missed, it is deferred. Do not "fix" this in passing;
reviving it is the recorded upgrade path and needs its own decision.

### P5 — All customers team-shared; the team is the trust boundary (ADR 0004)

Any signed-in user can see, edit, and delete any customer, version, todo,
stock row, attachment, and the shared settings. **Why:** accounts are
admin-created (sign-up disabled in `src/Auth.jsx`), the team is small and
trusted, and the private/public split plus archive flag duplicated what age
buckets + search already did — so ADR 0004 removed them entirely, superseding
ADR 0001. `owner_id` is decorative ("created by", nulled on account delete).
Enforced in RLS (`using (true)` policies, table above), not in the client.

## 3. Invariants that must hold

Numbered and testable. A PR that breaks one without an ADR is wrong by
definition.

1. **Re-importing the price book never changes a saved estimate.** Imports
   only upsert `stock_items` (`applyImport` builds `added`/`changed`/`missing`
   upserts, no deletes); no calc path reads `stock_items`. (Contrast
   deliberately: editing a *catalog* product's coverage/price DOES re-flow
   into every job using that name — live-by-name is ADR 0002's recorded
   behavior, not a bug. Selection-level `priceSqft`/`cartonSf` are
   snapshotted; grout/mortar/underlay numbers are live.)
2. **Every field read off a Customer/Area/Selection has a default.** All
   loaded/imported/restored data passes through `normC`/`normA`/`normP`
   (App.jsx lines 264–266); settings through
   `normalizeSettings`/`normalizeCatalog` (catalog.js). Adding a field to any
   of these shapes REQUIRES extending the matching normalizer, or year-old
   rows crash or miscalculate (the legacy grout `thickness: ""` bug is the
   precedent — see the comment above `normP`).
3. **Grout names are unique among grouts; mortar names among mortars**
   (reuse across kinds is allowed). Gate: `isDuplicateName` before every
   `addProduct` call. Without it, `resolveCatalog` silently drops one
   product's numbers.
4. **Stock rows are never deleted** — client-side (import flow only writes
   upserts) and server-side (no delete policy in `stock.sql`).
5. **All writes go through the sanctioned paths** (the enumerated function
   list lives in floortrack-change-control's write-path table / CLAUDE.md
   conventions). No ad-hoc `supabase.from(...)` writes elsewhere.
6. **Math resolves catalog products regardless of `enabled`.**
   `resolveCatalog` flattens every product; `isOffered` (catalog.js line 377)
   filters dropdowns only. Offering is forward-looking; resolving serves
   already-saved jobs.
7. **Carton lines bill by ordered cartons.** When `cartonSf` is set:
   `order = ceil(sqft × waste / cartonSf)` with float-noise rounding first
   (`getCarton`, catalog.js line 109 — 200 sf at 22 sf/ct must be 10, not 11),
   and the line total is `order × cartonSf × priceSqft`, not
   `sqft × priceSqft`. That formula is duplicated at FOUR call sites in
   App.jsx — line calc (~216), CSV export (~890), job totals (~942), print
   (~1155) — all four must agree; changing one is a bug.
8. **The un-rounded exact quantity is always displayed next to the rounded
   order quantity** (e.g. "3 bags (2.41)") — selection chips, summary tables,
   and print all do this (App.jsx ~lines 1239, 1504, 1516, 1614). It is the
   salesperson's sanity check that a rounding didn't hide an input error.
9. **Version rows are immutable once saved** — no update policy exists in
   `schema.sql`; the app only inserts, deletes, and restores. Auto-versions:
   newest 5 per customer kept (`AUTO_KEEP`, App.jsx line 282); autos never
   evict named versions.
10. **Manual overrides always win over computed quantities** — grout/mortar/
    underlay `manual` and `cartonManual` short-circuit before any math
    (`getGrout`/`getMortar`/`getUnderlay`/`getCarton` all check first).

## 4. Module map

Line counts and test count verified 2026-07-06 (`npm test`: 77 pass, 0 fail).

| Module | Lines | Responsibility | Pure? | Tested? |
|---|---|---|---|---|
| `src/Root.jsx` | 60 | Supabase config check + auth session gate; routes invite/recovery links to SetPassword | no (Supabase auth) | no |
| `src/Auth.jsx` | 94 | sign-in screen; sign-up disabled by design | no | no |
| `src/SetPassword.jsx` | 69 | set password after invite/reset link (user already authenticated by the link) | no | no |
| `src/App.jsx` | **2,108** | everything else: all UI, all Supabase write paths, load/migration, print layout, import UI, todos, versions | no | **no — zero tests** |
| `src/catalog.js` | 409 | settings normalization, catalog CRUD helpers, seeds, ALL material math (`groutExact`/`getGrout`, `mortarExact`/`getMortar`, `cartonExact`/`getCarton`, `underlayExact`/`getUnderlay`/`getUnderlayInstall`, `wasteFor`) | yes | yes (`catalog.test.js`) |
| `src/pricebook.js` | 420 | price-book .xlsx → flat stock items; takes plain arrays-of-arrays so it tests without SheetJS | yes | yes (`pricebook.test.js`) |
| `src/stock.js` | 209 | stock search / `stockPatch` snapshot / `stockDrift` / `diffStock` / `syncCatalogPrices` | yes | yes (`stock.test.js`) |
| `src/lib/supabase.js` | 10 | client from `VITE_*` env vars + `isConfigured` | no | no |

The split is the contract: **estimate-number logic belongs in the pure trio**
(catalog/pricebook/stock), where `node --test` can reach it. New math in
App.jsx is a regression of the architecture, not just style.

## 5. Known weak points — stated plainly

| Weak point | Reality | Mitigation status |
|---|---|---|
| **App.jsx sprawl** | 2,108 lines holding every UI concern AND every Supabase write path, zero automated tests. Any UI change risks the write paths sitting in the same file. | Sanctioned decomposition path lives in `floortrack-estimate-correctness-campaign`; the pure-module split is the beachhead. Do not ad-hoc refactor outside that path. |
| **No CI** | No `.github/`, no test gate; `main` auto-deploys to the live site on push. `npm test` runs only if someone runs it. | Discipline-only gate: PR-only merges, preview proof, checklist in `floortrack-change-control`. Adding CI is an open candidate, not decided. |
| **LWW clobber window** | Two people editing the same customer or Settings simultaneously: later save silently wins, no warning. | Deliberate (ADR 0002 consequences); optimistic conflict detection designed and shelved. Reviving it needs a decision, not a drive-by. |
| **Whole-blob customer saves** | Every edit (`updateCust`) re-writes the customer's entire `data` jsonb — cheap for one user, but it widens the LWW window and makes every keystroke a full-object race. | Accepted; versions were already extracted out of the blob (issue 003) to shrink it. No further split decided. |
| **Price-book parser coupling** | `src/pricebook.js` is keyed to the workbook's sheet names (`SHEET_TYPE`), header vocabulary (`HEADER_FIELDS` — including the sheet's long-standing "Decription" typo), and a SKU regex (`/^\d{4,8}$/`). A renamed sheet or removed "SKU" header drops items. | Degrades visibly by design (ADR 0003): rows are only consumed when the SKU cell looks like a SKU, so damage shows as missing counts and warnings in the import diff preview, never as garbage rows. Fragile but honest. |
| **Live migration code in App.jsx** | `migrateLegacyCustomers` (App.jsx ~line 542) and the attachment path move (`<user_id>/…` → `<customer_id>/…`) still run on load checks long after most installs migrated. Dead weight and a subtle write path outside the day-to-day conventions. | Unremoved as of 2026-07-06; removal is safe only once every account has loaded post-migration at least once. Candidate cleanup, undecided. |
| **Docs drift** | CLAUDE.md references `docs/project-charter.md` and `docs/agents/*.md` that do not exist in the repo. | Known gap; do not cite those files or invent their contents. ADRs (`docs/adr/`) and `docs/CONTEXT.md` are real and current. |

## When NOT to use this skill

- **A bug or symptom to triage right now** ("totals look wrong", "save
  failed") → `floortrack-debugging-playbook`.
- **How/why a decision happened historically** (the ADR 0001→0004 reversal,
  the design swap, the repo rename) → `floortrack-failure-archaeology`.
- **Making a NEW architectural decision** or checking whether a change needs
  an ADR/PR/preview proof → `/decide` and `floortrack-change-control`.
- **Domain vocabulary** (what a mortar tier or waste factor means) →
  `flooring-domain-reference` and `docs/CONTEXT.md`.
- **Editing catalog/settings content** as a user task →
  `floortrack-config-and-catalog`.

## Provenance and maintenance

Volatile facts and how to re-verify each (commands work in both PowerShell and
Git Bash unless marked; run from the repo root):

| Fact (as of 2026-07-06) | Source | Re-verify |
|---|---|---|
| Test suite: 77 pass, 0 fail, over the three pure modules | `npm test` run | `npm test 2>&1 \| tail -5` (bash) / `npm test` and read the tail (PowerShell) |
| Line counts (App.jsx 2,108; catalog 409; pricebook 420; stock 209) | `wc -l src/*.jsx src/*.js` | bash: `wc -l src/App.jsx` · PowerShell: `(Get-Content src/App.jsx).Count` |
| Shared settings = `shared_settings` table, singleton row `'singleton'` | `supabase/schema.sql` lines 108–132; `src/App.jsx` lines 195, 476, 608 | `git grep -n "SHARED_SETTINGS_ID" src/App.jsx` and `git grep -n "shared_settings" supabase/schema.sql` |
| RLS policies per table (incl. missing delete/update policies) | the five `supabase/*.sql` files, read in full | `git grep -n "create policy" supabase/` |
| Snapshot fill + drift chip | `src/stock.js` lines 108 (`stockPatch`), 143 (`stockDrift`) | `git grep -n "export function stockPatch\|export function stockDrift" src/stock.js` |
| Resolve-regardless-of-enabled + unique-name gate | `src/catalog.js` lines 364 (`resolveCatalog`), 377 (`isOffered`), 317 (`isDuplicateName`); gate call App.jsx line 1907 | `git grep -n "isDuplicateName\|resolveCatalog" src/` |
| Carton billing (order × sf × price) at four call sites | `src/App.jsx` lines 216 (line calc), 890 (CSV export), 942 (job totals), 1155 (print); `src/catalog.js` line 109 | `git grep -n "C.order \* C.sf" src/App.jsx` |
| Normalizers | `src/App.jsx` lines 264–266 (`normP`/`normA`/`normC`); `src/catalog.js` (`normalizeSettings`/`normalizeCatalog`) | `git grep -n "const normP\|const normA\|const normC" src/App.jsx` |
| Migration code still present | `src/App.jsx` line 542 | `git grep -n "migrateLegacyCustomers" src/App.jsx` |
| Doctrine WHYs | `docs/adr/0002…0004` (0001 superseded) | `ls docs/adr` and read the Status lines |
| Missing charter/agents docs | absent from working tree | `ls docs/project-charter.md docs/agents 2>/dev/null` (bash) — expect not-found |

Line numbers drift with every edit to App.jsx — trust the grep, not the
number. If a re-verification command contradicts this file, the repo wins;
update this skill in the same PR.
