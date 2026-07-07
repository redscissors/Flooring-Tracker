---
name: floortrack-proof-and-analysis-toolkit
description: The first-principles analysis recipes for FloorTrack — how to PROVE a claim about this codebase instead of eyeballing it. Load this when about to claim "this is correct", "the math checks out", "this migration is safe", "this policy does what we think", or "nothing is lost on concurrent edits"; when asked to verify the grout/mortar/carton math, hand-audit an estimate's numbers, pin behavior before a refactor (characterization tests), analyze a lost-update/last-write-wins risk, audit an RLS policy in supabase/*.sql, reason about a parser's failure mode, or check whether a migration is safe to re-run. Each recipe is a method with a worked, code-verified example from this repo. Not for deciding what evidence a PR needs (floortrack-validation-and-qa), learning domain terms (flooring-domain-reference), or running the big refactor itself (floortrack-estimate-correctness-campaign).
---

# FloorTrack proof and analysis toolkit

FloorTrack produces quote numbers a real shop hands to real customers. The bar
for "this is correct" is therefore: **you computed the expected answer
independently, ran the real code, and the two matched.** Reading the code and
nodding is not proof. A screenshot alone is not proof of math. This skill is
the recipe book for earning correctness claims.

The house pattern for every recipe below:

1. Derive or state the expected result **without** the code (first principles,
   the ADR, the SQL text).
2. Run the real thing (`node -e` against `src/*.js`, `npm test`, read the
   actual policy).
3. Show both, side by side. If they differ, the claim dies, not the evidence.

`src/catalog.js`, `src/pricebook.js`, and `src/stock.js` are pure ES modules
with zero dependencies — you can import them from a `node -e` one-liner and
interrogate them directly. `src/App.jsx` cannot be imported that way (JSX +
React); claims about it are proven by quoting exact lines and, for UI, preview
proof. All commands below run from the repo root in bash or PowerShell.

---

## Recipe 1 — Derive the formula (grout math)

**When to use:** any change to, or claim about, the material math in
`src/catalog.js`; any "why did it order N bags" dispute; before trusting a
constant like `REF`.

**Steps**

1. Derive the formula from physical first principles — don't start from the
   code.
2. Compute a worked example by hand, every intermediate number written out.
3. Run the real functions on the same inputs and compare.

**The derivation** (half-perimeter joint-volume argument, `REF = 0.0078125`,
`coverage = baseCoverage × REF/vol`) is homed in **flooring-domain-reference
§3** — read the physical reasoning there. Restated only as the formula this
recipe verifies: `vol = ((L + W) / (L × W)) × T × J` (`src/catalog.js` line 76),
scaled against the 12×12×3/8"/1/8" baseline `REF` (line 25) so
`coverage = baseCoverage × (REF / vol)`.

**Worked example (all arithmetic by hand first).** 24×12" tile, 3/8" thick,
1/8" joint, 200 sq ft, 10% tile waste, PermaColor Select (seed coverage 110
sq ft/bag at baseline):

```
vol      = ((24 + 12) / (24 × 12)) × 0.375 × 0.125
         = (36 / 288) × 0.046875 = 0.125 × 0.046875 = 0.005859375
REF/vol  = 0.0078125 / 0.005859375 = 1.3333… (= 4/3: the bigger tile has
           only 3/4 the joint length per sq ft — 0.125 vs 0.1667 in/in² —
           so it needs less grout and coverage RISES by 4/3)
coverage = 110 × 4/3 = 146.666… sq ft/bag
exact    = 200 × (1 + 10/100) / 146.666… = 220 / 146.666… = 1.5
order    = ceil(1.5) = 2 bags
```

Mortar on the same row (ProLite, tiered by longest side `max(L,W)` = 24" >
15" → tier3 = 45 sq ft/bag): `exact = 220 / 45 = 4.888…`, `order = 5 bags`.

**Verify against the code** (run from repo root):

```
node -e "
import('./src/catalog.js').then(({ REF, groutExact, getGrout, getMortar, normalizeSettings }) => {
  const s = normalizeSettings(undefined);
  const p = { type:'tile', qtyType:'sqft', qty:'200', L:'24', W:'12', thickness:'0.375',
    grout:{ checked:true, product:'PermaColor Select', color:'', joint:0.125, manual:'' },
    mortar:{ checked:true, product:'ProLite', manual:'' } };
  console.log('REF =', REF);
  console.log('groutExact =', groutExact(p, s));
  console.log('getGrout =', JSON.stringify(getGrout(p, s)));
  console.log('getMortar =', JSON.stringify(getMortar(p, s)));
});
"
```

Actual output (2026-07-06):

```
REF = 0.0078125
groutExact = 1.5000000000000002
getGrout = {"exact":1.5000000000000002,"order":2,"unit":"bags","price":0,"product":"PermaColor Select","color":""}
getMortar = {"exact":4.888888888888889,"order":5,"unit":"bags","price":0,"product":"ProLite"}
```

**Passing result:** every hand number matches the code output to within float
noise (`1.5000000000000002` vs `1.5` is a match; `1.6` would not be). Sanity
anchor: the 12×12 baseline tile must give `exact = 220 / 110 = 2.0` — verified
output was `2.0000000000000004`.

Two traps this recipe catches:

- `getGrout` returns `null` (not 0) when the calc can't run — a fully-checked
  grout with a missing joint or thickness silently produces nothing. See
  Recipe 2 for why that was a live bug.
- A `manual` override bypasses the whole derivation: `getGrout` returns the
  typed value as both `exact` and `order`, **not ceiled** (`src/catalog.js`
  line 84).

---

## Recipe 2 — Characterization testing (pin before you change)

**When to use:** before refactoring or "simplifying" any behavior you did not
write, especially in `src/catalog.js` / `src/stock.js` / `src/pricebook.js`.
A characterization test asserts what the code **does today**, right or wrong,
so a refactor that changes it fails loudly.

**Steps**

1. Find the behavior's current output for concrete inputs — run it, don't
   infer it.
2. Write a `node:test` case asserting exactly that output, named for the
   business rule, not the implementation.
3. Only then change the code. A red test now means "you changed behavior",
   which is either the point (update the test, say so in the PR) or a bug you
   just caught.

**Worked example — a subtle pin that already exists.** `src/catalog.test.js`
lines 200–205 pins the float-noise guard in `getCarton`:

```js
test("getCarton: an exact carton count doesn't over-order from float noise", () => {
  const s = normalizeSettings(undefined);
  // 200 sf at 10% waste over 22 sf/ct is exactly 10 cartons.
  const C = getCarton(tile({ qty: "200", cartonSf: "22", cartonManual: "" }), s);
  assert.equal(C.order, 10);
});
```

Why this is a *characterization* and not an obvious assertion — the naive math
over-orders:

```
node -e "console.log(200*1.1/22, '-> naive ceil:', Math.ceil(200*1.1/22))"
# 10.000000000000002 -> naive ceil: 11
```

`getCarton` (`src/catalog.js` lines 107–109) rounds away the noise before
ceiling. A "cleanup" that replaces it with a plain `Math.ceil` passes review
by eye and charges the customer an 11th carton. The pinned test is the only
thing standing in the way. That is the standard you're writing to.

**The legacy-grout rule: old-shaped data is part of current behavior.** The
legacy-grout "—" bug (old rows with `""`/0 thickness/joint never auto-computed;
full incident: floortrack-failure-archaeology entry 4) was fixed in `normP`
(`src/App.jsx` line 264) by defaulting those fields with `||` / `num(...) > 0`,
not `??`, so falsy legacy values get the fresh-row defaults.

The rule to generalize: **when you characterize a normalizer, feed it the OLD
shape, not the current one.** Existing examples of this done right:

- `src/catalog.test.js` line 474: "a stored pre-link install item (no kind)
  normalizes to a custom row with its fields intact".
- `src/catalog.test.js` lines 61–71: `normWaste` migrating the legacy scalar
  `wastePct` onto the `{ tile, floor }` split, and an explicit split beating a
  stale legacy number.

If your change adds a field, the characterization suite must include a record
that *lacks* it (see the "extend `normC`/`normA`/`normP` and `mergeSettings`"
convention in CLAUDE.md).

**Passing result:** `npm test` green before the change (77 tests as of
2026-07-06), your new pins green before the change, and after the change every
red test is one you can explain as an intended behavior change.

---

## Recipe 3 — Hand-audit an estimate

**When to use:** any doubt about an on-screen or printed number; after any
change touching totals, print, or the material math; when the shop reports "the
quote looks wrong".

**Method:** recompute every line from the customer's stored selections and the
current shared Settings, then reconcile against the screen/print. The formulas
below are read from the code, with exact locations (line numbers as of
2026-07-06) — recompute them, don't trust this table blindly either.

| Quantity | Formula (from code) | Where |
|---|---|---|
| Flooring line, non-carton | measured sqft × priceSqft — **no waste in the dollars** | App.jsx 1155 (screen), 216 (print) |
| Flooring line, carton (`cartonSf` set) | ceil(sqft × (1+waste) / cartonSf) × cartonSf × priceSqft | same lines; ceil via `getCarton`, catalog.js 109 |
| Misc line | priceSqft × qty (count-mode qty, else 1) | App.jsx 207, 216, 1155 |
| Grout exact | sqft × (1+waste.tile/100) / (baseCoverage × REF/vol) | catalog.js 72–79 |
| Mortar exact | sqft × (1+waste.tile/100) / tier(max(L,W)) — tiers: <8 / ≤15 / >15 | catalog.js 55–62 |
| Underlay exact | sqft × (1+waste/100) / coverage (flat, no tile volumetrics) | catalog.js 116–122 |
| Material cost (grand total) | Σ over lines of (per-line **order** × price) | App.jsx 942 |
| Summary list quantity | ceil(Σ of per-line **exact**) per product(+color) key | App.jsx 943–946 |
| Measured sqft | Σ qty of sqft-mode non-misc lines | App.jsx 942 |
| Ordered sqft | Σ (carton lines: order × cartonSf; else measured sqft) | App.jsx 942 |
| Estimated total | flooring + grout + mortar + underlay + misc costs | App.jsx 947 |

Two reconciliation subtleties that are correct behavior, not bugs:

- **Waste inflates quantities, not non-carton dollars.** A 200 sq ft
  non-carton line at $3/sf totals $600, not $660. Carton lines DO carry waste
  into dollars because the customer buys whole cartons.
- **Per-line ceil for money, ceil-of-sum for the summary quantity.** Two lines
  each needing 1.2 bags of the same grout cost 2+2=4 bags' worth of money
  (App.jsx 942) but the summary lists ceil(2.4)=3 bags (App.jsx 943). The
  print breakdown does the same (App.jsx 246–253: costs summed per line,
  order ceiled once on the aggregate) so it reconciles with the grand total by
  construction. If you see 4 vs 3 here, that is the design, dated 2026-07-06.

**First place hand-audits diverge: manual overrides.** Before computing
anything, list every override on the job — `grout.manual`, `mortar.manual`,
`underlay.manual`, `cartonManual`. A non-empty manual replaces both exact and
order with the typed value (not ceiled) and skips the formula entirely. A
hand-audit that "finds a bug" has, more often than not, found an override.
Second place: `pending` rows — a checked material whose quantity can't compute
(missing thickness/joint/product) shows "—" with cost 0 (post-`33982cf`), so
a line can display a grout yet contribute nothing to the total.

**Reconciliation table template** (one row per product line, then the roll-up):

```
Area | Line (type/brand) | qty sf | waste% | price | override? | expected line $ | screen line $ | Δ
...
Material | product (color) | Σ exact (hand) | order (hand) | unit price | expected cost | screen cost | Δ
...
Measured sqft: hand ___ screen ___   Ordered sqft: hand ___ screen ___
Estimated total: hand ___ screen ___ print ___
```

**Worked example (carton line).** 200 sq ft of tile at 23.5 sf/carton, 10%
tile waste: `exact = 220 / 23.5 = 9.3617…`, `order = 10 CT`, ordered sqft
= 235, line total at $4/sf = 10 × 23.5 × 4 = **$940** (vs $800 if it were
mis-audited as measured-sqft × price). Code check (verified 2026-07-06):

```
node -e "import('./src/catalog.js').then(({getCarton, normalizeSettings}) => console.log(JSON.stringify(getCarton({type:'tile',qtyType:'sqft',qty:'200',cartonSf:'23.5',cartonUnit:'CT',cartonManual:''}, normalizeSettings(undefined)))))"
# {"exact":9.361702127659576,"order":10,"sf":23.5,"unit":"ct"}
```

**Passing result:** every Δ column is zero (or explained by a listed
override/pending row), and measured/ordered sqft and the estimated total match
on screen AND on print. For bulk audits, the measurement scripts live with
**floortrack-diagnostics-and-tooling**.

---

## Recipe 4 — Concurrency / lost-update analysis

**When to use:** designing any write path; reviewing a change that widens or
adds one; deciding whether ADR 0002's shelved optimistic-concurrency control
(OCC) should be un-shelved. This is the exact method used in ADR 0001/0002.

**Steps**

1. **Name the write and its payload.** What exact bytes go to the server?
   Whole blob or one column?
2. **Measure the read-modify-write window.** When was the in-memory copy
   read, and how stale can it be when the write fires?
3. **Enumerate concurrent writers of the same chunk.** Who else can write
   that row/blob during the window?
4. **State what is silently lost.** Last-write-wins (LWW) means the loser's
   changes vanish with no error — write down exactly which fields.
5. **Ask if the write can narrow.** Can the payload shrink to only what
   changed, so collisions on *different* fields stop being collisions?
6. **Verdict:** accept (with the ADR-0002 reasoning), narrow, or OCC.

**Worked example: `updateCust` vs the removed `setArchived`.**
`updateCust(id, patch)` (`src/App.jsx` 621–626) merges the patch into the
in-memory customer and writes the **entire `data` jsonb** back
(`update({ data: custData(cust) }).eq("id", id)`).

- Window: from `loadDetail` (customer opened) to the write — minutes or hours.
- Concurrent writers: any teammate with the same customer open (all customers
  are team-shared, ADR 0004), plus a version restore doing the same.
- Silently lost: the *entire* other edit — areas, product rows, notes,
  attachment metadata. Not just the colliding field: the whole blob is the
  unit of clobber.
- Narrowing: ADR 0001 did exactly this for the archive flag — `archived` was a
  top-level column flipped by a narrow `setArchived(id, value)` write sending
  only `{ archived }`, so archiving could never clobber a concurrent content
  edit. ADR 0004 later removed archive entirely, so that narrow write is gone
  — but it remains the canonical worked example of step 5.

**The accepted-risk verdict (ADR 0002, restated):** whole-chunk LWW on
customer `data` and on shared Settings is accepted deliberately — edits are
rare, the team is small, and optimistic conflict detection (check `updated_at`
on save, prompt overwrite/refresh) was **designed and consciously shelved**,
not forgotten. This recipe is how you know when to un-shelve it: run steps
1–4 on the real usage. The moment step 3 shows routine simultaneous editing of
the same customer, or a hand-audit (Recipe 3) traces a wrong number to a lost
update, the shelved design is the pre-approved answer — propose it via
`/decide` referencing ADR 0002 rather than inventing a new mechanism.

**Passing result:** a filled-in six-step table for the write path in question,
and a verdict that either matches the recorded ADRs or explicitly surfaces the
conflict (never silently contradicts them).

---

## Recipe 5 — RLS policy audit

**When to use:** any change under `supabase/`; any claim like "anon can't read
X" or "only the owner can Y"; after running a migration file; before trusting
the anon key's public exposure (the RLS layer IS the security boundary — the
anon key is public by design, see netlify.toml).

**Steps**

1. Read the actual `create policy` statements — never the comments, never the
   ADR alone.
2. Build a who-can-do-what table: one row per table × operation, noting the
   role (`to authenticated` / none) and the `using` / `with check` expressions.
3. **Absent policy = denied.** With RLS enabled, an operation with no policy
   is blocked. Missing rows in your table are grants of *nothing* — list them
   explicitly, they are often the most load-bearing lines.
4. Check the table against the intended trust model (ADR 0004: any signed-in
   user can do everything on shared data; anon: nothing; app_data: own row
   only) and report mismatches.

**Worked example — the current files (audited 2026-07-06; fresh-install shape
from `schema.sql` + `storage.sql` + `stock.sql` + `todos.sql`, which
`migrate-shared-only.sql` converges pre-ADR-0004 installs onto).** The full
who-can-do-what table is homed in **floortrack-architecture-contract §1**; a few
illustrative rows show what step 3 ("absent policy = denied") catches:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `customers` | any authed | any authed, **must set `owner_id = auth.uid()`** | any authed | any authed |
| `versions` | any authed | any authed | **no policy → denied** (rows immutable by design) | any authed |
| `app_data` | own row only (`auth.uid() = user_id`) | own row | own row | own row |

Anon (signed-out): **nothing, on every table.** Every policy is either
`to authenticated` or predicated on `auth.uid()`, which is null for anon, and
absent policies deny the rest. Verified against the policy texts, not assumed.

Findings worth stating when you audit (these are the current, intended state):

- `customers.insert`'s `with check (owner_id = auth.uid())` is the **only**
  asymmetric grant left — it forces honest attribution, nothing more.
  `owner_id` grants no rights afterward (ADR 0004); the old `customers_guard`
  trigger is dropped by `migrate-shared-only.sql` lines 67–68.
- The storage policies scope to `bucket_id = 'attachments'` only — **no path
  check**. Any signed-in user can read/write any customer's files, matching
  ADR 0004; the bucket being non-public is what shuts out the world.
- `versions` having no update policy is a real invariant: version snapshots
  cannot be edited even by a buggy client.

**Passing result:** a table like the above where every cell is traceable to a
quoted policy or an explicit "no policy → denied", plus a stated match/mismatch
against the trust model. A mismatch is a finding to surface, never to patch
live — SQL changes go through the owner-run file process
(**floortrack-change-control**).

---

## Recipe 6 — Parser degradation analysis (visible absence over silent wrongness)

**When to use:** assessing what happens when an input format drifts — a
renamed price-book sheet, a moved header, a new column — or designing any new
parser/importer. This is the ADR 0003 method.

**Steps**

1. Identify the parser's **admission guard**: the predicate a row must pass to
   become data at all.
2. Trace a concrete format change through the code: does the change make rows
   fail the guard (→ they vanish, countably) or pass it with wrong fields
   (→ garbage that looks like data)?
3. Check the absence is **surfaced**, not just silent: a warning, a diff
   count, an empty preview a human will see.

**Worked example — `src/pricebook.js`.** The admission guard: a row is only
ever consumed if its SKU cell looks like a real SKU —
`const SKU_RE = /^\d{4,8}$/` (line 24) via `isSku` (line 26), and table
sheets only enter data-row mode after a header row containing a cell spelled
exactly `SKU` (`isHeaderRow`, line 66). Surfacing: a sheet that yields no SKUs
pushes `Sheet "<name>": no items recognized — was its layout changed?`
(line 148), and the import flow shows a diff preview where the missing items
appear as counts before anything is written.

Trace of a real format change, run against the actual parser (2026-07-06):

```
node -e "
import('./src/pricebook.js').then(({ parsePriceBook }) => {
  const renamed = [{ name: 'Hardwood', rows: [ ['Sheoga'], ['ITEM#','Description','Retail'], ['12345','Oak plank 3/4', 3.99] ] }];
  const r = parsePriceBook(renamed);
  console.log('items:', r.items.length, 'warnings:', JSON.stringify(r.warnings));
});
"
# items: 0 warnings: ["Sheet \"Hardwood\": no items recognized — was its layout changed?"]
```

With the header spelled `SKU` the same rows parse into one clean hardwood item
(verified). Rename the header and the sheet degrades to **zero items plus a
named warning** — not to rows with the price in the description field. The
diff preview then shows the sheet's items as "no longer listed", which the
import marks `active=false` (never deletes), so even a bad import a human
clicks through is recoverable.

**The generalized principle:** prefer designs whose failure mode is **visible
absence** (missing counts, warnings, empty previews) over **silent wrongness**
(plausible-looking garbage). When reviewing any parser, ask: "if the input
shifts one column left, do I get fewer rows or wrong rows?" Fewer rows is a
design property; wrong rows are a quoting incident waiting for a customer.

**Passing result:** you can name the guard, demonstrate (with a run, as above)
that a plausible format change produces countable absence plus a surfaced
warning, and confirm nothing destructive happens downstream of the absence.

---

## Recipe 7 — Migration idempotency check

**When to use:** writing or reviewing anything that runs "once" — client-side
first-load migrations, the owner-run `supabase/*.sql` files — and any claim
that re-running is safe.

**The four questions**

1. **Trigger:** what condition makes it run, and does *success remove the
   condition*?
2. **Re-run overwrite:** if it runs again anyway, does it clobber data that
   changed since the first run?
3. **Partial failure:** if it dies halfway, does the next run resume correctly?
4. **Interleaving:** can normal app writes land between its steps?

**Worked example — `migrateLegacyCustomers` (`src/App.jsx` 542–562, called
from the load effect at 405–408).** What it does on first load: for each
customer still embedded in the legacy per-user `app_data` blob, (a) move each
attachment file from `<user_id>/<file_id>` to `<customer_id>/<file_id>`
(download → upload with `upsert: true` → remove old), (b) upsert the customer
row with `{ onConflict: "id", ignoreDuplicates: true }`, then (c) write the
blob back **without** the `customers` array.

Reading the code and answering truthfully:

1. **Trigger:** `Array.isArray(legacy) && legacy.length` (line 406) — step (c)
   strips the array, so a fully successful run removes its own trigger.
   Re-runs after success are no-ops by absence.
2. **Re-run overwrite: safe.** `ignoreDuplicates: true` turns the upsert into
   insert-if-missing — a re-run **never overwrites** a customer row the team
   has edited since migration. This is the single load-bearing flag; an
   ordinary upsert here would silently roll edited customers back to their
   legacy snapshots on every re-run.
3. **Partial failure: resumable.** If (c) fails after (b) succeeded, the next
   load re-runs; already-migrated rows are skipped (point 2), and the
   attachment move no-ops when the source file is already gone (`download`
   returns nothing → `continue`; each move is wrapped best-effort). The code's
   own claim — "Idempotent — safe to run on every load" (line 404) — checks
   out.
4. **Interleaving: acceptable.** The migration runs before `loadCustomers`
   populates the UI for this user; a *teammate* could edit a just-migrated row
   mid-run, but point 2 means the migration can't clobber it.

One honest caveat: step (c) writes `appBlobRef.current` (the whole per-user
blob minus customers/settings) — if the same user were signed in on two
devices mid-migration, that blob write is itself LWW on the profile (Recipe 4
applies). Accepted: it's a one-time path on a per-user row.

**The SQL files use the same discipline** — verify by grepping for the guards:
`schema.sql`'s embedded versions-lift ends `on conflict (id) do nothing`
(lines 177–188) and its settings seed `on conflict (id) do nothing` (199–206);
every table is `create table if not exists`; every policy is
`drop policy if exists` then `create`. `migrate-shared-only.sql` is
re-runnable for the same reasons (`if exists` everywhere) except the two
`alter table ... add constraint` / `drop not null` lines, which are converging
(second run finds the target state) — but per the owner rule you never run SQL
against the live project anyway; this recipe is for *reviewing* the files.

**Passing result:** written answers to the four questions with line citations,
and — for client-side migrations — a characterization test (Recipe 2) feeding
the pre-migration shape through the normalizers.

---

## When NOT to use this skill

- **Deciding what evidence a given PR needs** (tests vs screenshots vs worked
  examples, acceptance thresholds) → **floortrack-validation-and-qa**. This
  skill supplies the *methods*; that one says which are required when.
- **Learning the domain concepts themselves** (what grout/thinset/waste/CT
  actually are to a flooring shop) → **flooring-domain-reference**.
- **Executing the big estimate-correctness refactor** the audits feed into →
  **floortrack-estimate-correctness-campaign**.
- **Measurement scripts and bulk tooling** for audits → **floortrack-diagnostics-and-tooling**.
- **Change gating** (can this merge, does it need an ADR, SQL handoff rules)
  → **floortrack-change-control**; record decisions with `/decide`.
- Symptom-first debugging of a broken app → **floortrack-debugging-playbook**.

---

## Provenance and maintenance

All facts verified against the repo on **2026-07-06**, branch
`claude/compact-product-fields`. Volatile items and how to re-verify:

| Fact | Source | Re-verify |
|---|---|---|
| 77 passing tests | `npm test` run 2026-07-06 | `npm test 2>&1 \| tail -5` |
| REF = 0.0078125; grout/mortar/carton formulas | `src/catalog.js` 25, 55–62, 72–79, 94–110 | the `node -e` one-liners in Recipes 1 and 3 (paste and run) |
| Line-total formulas & App.jsx line numbers (207, 216, 264, 405–408, 542–562, 621–626, 941–947, 1155) | read 2026-07-06 | `grep -n "updateCust = \|migrateLegacyCustomers = \|grandTotal = " src/App.jsx` |
| Legacy-grout fix and its rule | commit `33982cf` | `git show 33982cf --stat` |
| Float-noise carton pin | `src/catalog.test.js` 200–205; guard at `src/catalog.js` 107–109 | `grep -n "float noise" src/catalog.test.js src/catalog.js` |
| Pricebook guard + warning | `src/pricebook.js` 24, 26, 66, 148 | `grep -n "SKU_RE\|no items recognized" src/pricebook.js` |
| RLS who-can-do-what table | `supabase/schema.sql`, `storage.sql`, `stock.sql`, `todos.sql`, `migrate-shared-only.sql` read 2026-07-06 | `grep -n "create policy" supabase/*.sql` |
| LWW accepted / OCC shelved; snapshot doctrine; team-shared model | `docs/adr/0002` Consequences, `docs/adr/0003`, `docs/adr/0004` | re-read the ADRs; `ls docs/adr` |

If any re-verification disagrees with this file, the repo wins — update the
recipe, and treat the drift itself as a Recipe 2 moment (what changed, was it
intended?).
