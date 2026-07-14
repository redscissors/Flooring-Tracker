---
name: floortrack-debugging-playbook
description: Symptom-to-cause triage for FloorTrack failures. Load when something is broken, wrong, or missing in the running app — "a number on the estimate looks wrong", "grout shows a dash", "the SKU box / stock search disappeared", "app shows a setup screen", "my catalog edit doesn't show up", "import says hundreds of items are missing", "there's an amber price chip on a row", "print comes out empty", "git push fails", "sign-in / invite link problems", "dev server port conflict". Gives the likely cause, the check that discriminates it, and the known traps that have cost real time. Not for designing fixes (floortrack-change-control), learning the math (flooring-domain-reference), or tooling to measure with (floortrack-diagnostics-and-tooling).
---

# FloorTrack debugging playbook

Triage runbook for this repo's known failure modes. Every mechanism below was
verified against the source as of 2026-07-06 — re-verification commands are in
"Provenance and maintenance" at the end.

Ground rules while debugging (non-negotiable, see floortrack-change-control):

- **Never run SQL or mutations against the live Supabase project.** Read-only
  observation through the running app is fine; the owner runs SQL files by hand.
- `main` auto-deploys to the live site on every push. There is no CI. Debug on
  a branch; fixes land via PR only.

Vocabulary: a **snapshot** is the copy of a stock item's values pasted onto a
product row when its SKU is picked (ADR 0003) — math never reads the stock
table afterward. A **normalizer** is a function that fills gaps in old saved
data so new code can read it (`normP`/`normA`/`normC` in `src/App.jsx`,
`mergeSettings`/`normalizeCatalog`/`normalizeSettings` in `src/catalog.js`).

## Symptom → likely cause → discriminating check

| Symptom | Likely cause | Discriminating check |
|---|---|---|
| App shows "Almost there — connect Supabase" instead of the app | Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. `src/lib/supabase.js` exports `isConfigured = Boolean(url && anonKey)`; `src/Root.jsx` renders `<SetupNotice />` when false. | Check `.env` against `.env.example` (real values are also in `netlify.toml` and PROJECT_STATUS.md). Vite reads env at startup — **restart `npm run dev`** after editing `.env`. |
| SKU box / stock search / drift chips invisible everywhere | `stock_items` table empty or absent — `supabase/stock.sql` never run, or no workbook imported yet. `loadStock()` failures are swallowed (`try { setStock(await loadStock()) } catch {}` in App.jsx), so `stock` stays `[]`, and every stock affordance is gated on `stock.length > 0`. This is deliberate (ADR 0003 consequences). | Open Settings → "Stock price book" panel. It says either "N stock items loaded · updated <date>" or "No stock items yet — run supabase/stock.sql once, then import the workbook." That message IS the diagnosis. |
| Grout qty shows "—" / grout missing from order summary on an old customer | Normalization gap: old rows carried empty/`0` `thickness` or `grout.joint`; the grout calc needs both, mortar needs neither, so grout alone silently vanished (full incident: floortrack-failure-archaeology entry 4). | If a similar symptom recurs with a *different* field: the fix belongs in the normalizers (`normP` in App.jsx, or `mergeSettings`/`normalizeCatalog` in `src/catalog.js`), not in the UI. See "The class of bug" below. |
| Edited the catalog seed in code but the app still shows old products/prices | **Seed-vs-live trap.** The seed only runs when the stored settings have no catalog; the shared row was seeded long ago, so code edits never re-run it (mechanism + the underlayment-backfill exception are homed in floortrack-config-and-catalog §4). | Live catalog changes go through the Settings UI (writes via `setSettings`), not the seed constants. |
| Price book import preview shows a huge "missing"/retired count | The workbook changed shape: a special-cased sheet was renamed, or SKUs no longer look like SKUs. `src/pricebook.js` hardcodes sheet names `Index` (skipped), `Mann Aduramax`, `Grout & Caulk`, `Tile Seats, Curbs, Trims`; every other sheet goes through the generic table parser, which only consumes a row when its SKU cell matches `SKU_RE = /^\d{4,8}$/` and only after a header row containing a cell reading exactly `SKU`. Unparsed rows degrade to "items went missing" — by design, visible in the preview. | The preview lists warnings like `Sheet "X": no items recognized — was its layout changed?`. Nothing is written until "apply", so **cancel the import**, open the .xlsx, and compare sheet names / SKU column against the parser. Applying would only mark items `active=false` (never delete), but don't apply a bad parse. |
| Amber chip on a product row: "Price book now $X — this row has $Y" | **Not a bug.** The row's snapshot differs from the current book — either the book price changed on re-import or someone hand-edited the row's price (manual edits count as drift too, `stockDrift` in `src/stock.js`). Snapshot-is-truth is ADR 0003 doctrine: applying the new price is a deliberate human click ("Use new price"). | If the chip's numbers are *wrong*, that's a bug — check `stockDrift` (tolerance 0.005) and `stockPrice` ($/sqft derivation for carton/sheet items). If the numbers are right, close the ticket. |
| Grey note: "SKU N is no longer in the stock price book" | The SKU was marked `active=false` (dropped from a re-import) or flagged discontinued. Also not a bug — the row keeps its snapshot and keeps calculating. | `stockRetired` in App.jsx: `p.sku && stockItem && (stockItem.discontinued \|\| !stockItem.active)`. |
| Dev server on a weird port / port conflict | `vite.config.js` honors a `PORT` env var with `strictPort: true`; otherwise Vite's default 5173. `npm run preview` uses 4173. | Check whether `PORT` is set in the shell/harness. With `PORT` set and taken, Vite exits instead of hopping ports (that's what `strictPort` means). |
| User can't sign in / no sign-up button | **Sign-up is disabled by design** — accounts are created by the admin in the Supabase dashboard. Invite/password-reset links route to `SetPassword.jsx`: `Root.jsx` watches the URL for `type=invite` / `type=recovery` markers and the `PASSWORD_RECOVERY` auth event. | If an invite/reset link opens localhost or a dead page: the Supabase Auth **Site URL / Redirect URLs** must point at the live site — see the "Pending / to verify" checklist in PROJECT_STATUS.md. Dashboard changes are the owner's to make. |
| `git push` fails from an old session | The repo was renamed `Label-Designer` → `Flooring-Tracker`. GitHub redirects clones/API but a session started against the old name can no longer push (PROJECT_STATUS.md, "Heads-up: repo was renamed"). | `git remote -v` — if it says `Label-Designer`, that's it. Start fresh against `redscissors/Flooring-Tracker` (or re-point the remote). |
| Print output empty or the wrong layout | The print layout (`hidden print:block` div in App.jsx) renders **only when a customer is selected and fully loaded** (`sel && sel._full`). The buttons set `printMode`; an effect calls `window.print()` and resets it. `printMode === "order"` prints the order sheet, anything else (including browser-menu Ctrl+P, where `printMode` is null) prints the estimate. The app UI is hidden in print via Tailwind `print:hidden`; page margins come from `@media print` in `src/index.css`. | Empty print → no customer open (or detail not loaded yet). Wrong layout via Ctrl+P → expected: Ctrl+P always prints the estimate. Elements leaking into print → missing `print:hidden` / `ft-noprint` class, or the change bypassed `printMode`. |

## The class of bug behind the grout "—" incident

(The incident itself is homed in floortrack-failure-archaeology entry 4; this is
its standing rule.) Old saved rows in Postgres don't gain fields when the code
does. Any code that assumes a field exists (or is non-zero) will work on fresh
rows and fail silently on legacy ones — and it fails *per-material*, so one calc
vanishes while its neighbors compute, which reads as "the math is broken" when
it's actually "the data is older than the field".

Rule: when adding or newly-requiring a field on Customer/Area/Product, extend
`normP`/`normA`/`normC` (App.jsx) so old records get a sane default; for
Settings/catalog fields, extend `mergeSettings`/`normalizeCatalog`
(`src/catalog.js`). Second rule from the same incident: summaries and print
must **show** a checked material whose quantity can't compute (with "—"),
never silently drop it — silent-vanish is what let this bug live so long.

## "A number on the estimate looks wrong" — triage order

Work top to bottom; each step discriminates a whole cause family.

1. **Check manual overrides first.** A non-empty `grout.manual`,
   `mortar.manual`, `underlay.manual`, or `cartonManual` **bypasses the calc
   entirely** (`getGrout` et al. return the manual value verbatim, no ceil).
   A stale manual number is the most common "wrong quantity" and involves zero
   code. In the UI, clear the override box and see if the computed value is right.
2. **Reproduce with the pure functions.** All math lives dependency-free in
   `src/catalog.js` (`groutExact`/`getGrout`, `mortarExact`/`getMortar`,
   `cartonExact`/`getCarton`, `underlayExact`/`getUnderlay`,
   `getUnderlayInstall`, `wasteFor`). Verified one-liner (bash; in PowerShell
   put the same code in a scratch `.mjs` file and `node` it):

   ```bash
   node --input-type=module -e "
   import { getGrout, normalizeSettings } from './src/catalog.js';
   const s = normalizeSettings();   // default settings — substitute real ones to match live
   const p = { type: 'tile', qtyType: 'sqft', qty: 120, L: 12, W: 24, thickness: 0.375,
               grout: { checked: true, product: 'PermaColor Select', joint: 0.125, manual: '' } };
   console.log(getGrout(p, s));"
   ```

   If the pure function gives the right answer with the row's real inputs, the
   bug is in the inputs (data/normalization/UI wiring), not the math. Note
   `normalizeSettings()` yields seed defaults (`price: 0` everywhere) — for a
   price discrepancy you must feed the team's real coverage/price numbers
   (read them off the Settings UI or a JSON backup).
3. **Check the waste rate family.** Waste is split: `waste.tile` for tile
   lines, `waste.floor` for hardwood/vinyl/laminate/carpet (`wasteFor` in
   `src/catalog.js` picks by `p.type === "tile"`). A "10% expected, got 15%"
   complaint is usually the *other* family's rate, set in Settings.
4. **Carton rows compute differently.** With `cartonSf` set (snapshotted from
   the book's SF/CT or typed), quantity is whole cartons —
   `ceil(sqft × (1+waste) / cartonSf)` with float-noise rounding at 1e-6 —
   and the **line total is ordered cartons × cartonSf × priceSqft**, not
   sqft × priceSqft. "Total is more than sqft × price" on a carton item is
   correct behavior (you pay for the whole cartons).
5. **Snapshot vs price book.** If the complaint is "the row's price doesn't
   match the current book": that is the design (ADR 0003). The drift chip
   surfaces it; nothing recalculates old estimates automatically.
6. The un-rounded "exact" value shown next to every order quantity is your
   free probe — if *exact* is right and *order* looks wrong, look at
   ceil/manual handling; if exact is wrong, walk the formula inputs.

For measuring tools and deeper instrumentation see
**floortrack-diagnostics-and-tooling**; for what the formulas *mean* and the
domain baseline (12×12×3/8", 1/8" joint) see **flooring-domain-reference**.

## Discriminating experiments

**Data problem vs code problem**

- Build a **fresh customer** with the same inputs in the running app. Fresh
  works + old fails → data/normalization problem (see the class-of-bug section);
  both fail → code problem.
- Inspect the raw stored data without touching the server: Settings → backup
  export downloads the JSON; read the failing product row's actual fields
  (look for missing keys, `""` vs `0`, legacy field names).
- Settings-side normalizers are importable under plain node
  (`normalizeSettings`, `mergeSettings`, `normalizeCatalog` in
  `src/catalog.js`) — feed them the suspect blob and see what comes out. The
  customer-row normalizers `normP`/`normA`/`normC` live in `src/App.jsx` (JSX,
  not node-importable); read them and hand-trace the suspect row instead.

**Shared-state problem vs local-state problem**

- Nearly everything is shared server state: customers, versions, settings +
  catalog (one `shared_settings` row), stock, todos. Only view state (open
  drawers, drag, search box) and the per-user profile are local.
- Open the app as a **second user or in a second browser profile**. Both see
  the anomaly → shared data or code. Only one sees it → local: most likely
  **optimistic in-memory state whose write failed** (`updateCust`/`setSettings`
  update React state first, then write; failures only `ping` a toast like
  "Save failed — export a backup"). A hard refresh re-reads the server and is
  the cheapest truth test: if the anomaly survives refresh it's persisted, if
  it disappears the write never landed.
- Remember last-write-wins (ADR 0002/0004): two people editing the same
  customer can silently clobber each other. "My edit vanished" with no error
  is consistent with a concurrent whole-record save, not necessarily a bug.

**Reproduce locally before blaming production.** `npm run dev` against the
same Supabase project shows the same shared data; `npm test` (77 passing tests
over `catalog.js`/`pricebook.js`/`stock.js` as of 2026-07-06) tells you whether
the pure logic still holds. `src/App.jsx` has zero automated tests — anything
UI-side must be verified by eye in the preview.

## When NOT to use this skill

- **Designing the fix** — anything that changes the data model, write paths,
  or behavior needs **floortrack-change-control** (classification, PR gates,
  preview proof, SQL handoff).
- **Understanding the material math itself** (why grout scales volumetrically,
  what the tiers mean) — **flooring-domain-reference**.
- **Building or running measurement tooling** (probes, harnesses, log
  inspection) — **floortrack-diagnostics-and-tooling**.
- **Historical dead ends and reverted designs** (the archive column, the
  organic theme, print-layout churn) — **floortrack-failure-archaeology**.
- **Test strategy / what counts as verification evidence** —
  **floortrack-validation-and-qa**.

## Provenance and maintenance

All claims verified against the repo on 2026-07-06 (branch
`claude/compact-product-fields`). Line numbers avoided on purpose — grep the
anchors below instead.

| Fact | Source | Re-verify with |
|---|---|---|
| Setup screen gate | `src/Root.jsx` (`SetupNotice`), `src/lib/supabase.js` (`isConfigured`) | `grep -n "isConfigured" src/Root.jsx src/lib/supabase.js` |
| Stock affordances gated on `stock.length > 0`; load failure swallowed | `src/App.jsx` | `grep -n "stock.length > 0\|setStock(await loadStock" src/App.jsx` |
| Grout "—" fix story | commit `33982cf` | `git show 33982cf --stat` |
| Seed runs only when stored settings lack a catalog | `src/catalog.js` `normalizeSettings` | `grep -n "seedCatalog(mergeSettings" src/catalog.js` |
| Underlayment seed backfill + tombstones | `src/catalog.js` | `grep -n "backfillUnderlayments\|removedSeeds" src/catalog.js` |
| Parser sheet names, `SKU_RE = /^\d{4,8}$/`, "no items recognized" warning | `src/pricebook.js` | `grep -n "SKU_RE\|Mann Aduramax\|no items recognized" src/pricebook.js` |
| Import never deletes; missing → `active=false` | `src/stock.js` `diffStock`, `src/App.jsx` `applyImport` | `grep -n "missing" src/stock.js` |
| Drift chip text + 0.005 tolerance; retired condition | `src/stock.js` `stockDrift`, `src/App.jsx` | `grep -n "Price book now\|stockRetired" src/App.jsx` |
| PORT env / strictPort / default 5173 | `vite.config.js` | `cat vite.config.js` |
| Sign-up disabled; invite/recovery markers; Site URL checklist | `src/Root.jsx`, `src/Auth.jsx`, `PROJECT_STATUS.md` | `grep -n "type=invite\|PASSWORD_RECOVERY" src/Root.jsx` |
| Repo rename push failure | `PROJECT_STATUS.md` | `grep -n "renamed" PROJECT_STATUS.md` |
| Print mechanism (`printMode`, `sel && sel._full`, `print:hidden`) | `src/App.jsx`, `src/index.css` | `grep -n "printMode\|hidden print:block" src/App.jsx` |
| Manual overrides bypass calc; carton math; `wasteFor` split | `src/catalog.js` | `grep -n "manual\|cartonExact\|wasteFor" src/catalog.js` |
| Node one-liner output | ran it 2026-07-06: `{ exact: 0.9, order: 1, unit: 'bags', ... }` | re-run the one-liner in step 2 |
| 77 passing tests, pure modules only | `npm test` on 2026-07-06 | `npm test 2>&1 \| tail -5` |
| Snapshot doctrine, hide-never-delete, stock affordances hidden until stock.sql | `docs/adr/0003-stock-price-book-snapshot.md` | read the ADR's Consequences section |
| Last-write-wins accepted | `docs/adr/0002-shared-grout-mortar-catalog.md` | read the ADR |
