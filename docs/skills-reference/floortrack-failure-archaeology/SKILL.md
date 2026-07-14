---
name: floortrack-failure-archaeology
description: The chronicle of FloorTrack's settled battles — every major investigation, dead end, rejected approach, and superseded decision, with evidence pointers, so no session re-fights one. Load this BEFORE proposing a data-model change, a sharing/permission change, a redesign, or "wouldn't it be better if..." ideas; when about to suggest private customers, an archive flag, id-based product links, admin-only writes, or a live price link (all already rejected — see why) — or optimistic locking (NOT rejected: deliberately shelved, reopen on real evidence; see entry 2); when a bug smells like old/legacy data misbehaving; when editing SEED_COMPANIES in src/catalog.js and expecting the live catalog to change; when git push mysteriously fails in an old session; or when asked "was this tried before", "why is it like this", "what happened with X".
---

# FloorTrack failure archaeology

The war record. Each entry is one battle: what hurt, what was tried, how it
ended, where the evidence lives, and whether it is closed. Read the relevant
entry before re-opening any of these topics; if you must contradict a settled
entry, surface the conflict explicitly (per CLAUDE.md's decision policy) —
never silently override it.

**Status legend:**

| Status | Meaning |
|---|---|
| settled | Fought, decided, recorded. Do not re-propose without new evidence. |
| superseded | An earlier decision was deliberately replaced; the old one is dead, the new one is settled. |
| open / deferred | Consciously parked, not forgotten. Fair game when its trigger condition arrives. |

All commit hashes below are verifiable with `git show <hash> --stat`. Paths are
repo-relative. Dates are from commit metadata / doc headers.

---

## The chronicle

### 1. Archive + private/public visibility: built, then torn out 13 days later

- **Pressure:** finished jobs cluttered the list; the team wanted an Archive state (issue 001) on top of the existing Private/Public split.
- **Tried:** full build. Private/public sharing (`cfb25b2`), light-load list + shared `archived` column (`3bf3c19`), ADR 0001 (2026-06-22) even recorded the subtle part — `archived` deliberately sits *outside* the owner-only `customers_guard` trigger so any editor can archive a Public job, flipped via a narrow `setArchived` write to avoid whole-blob clobbers.
- **Root cause / outcome:** reality: the team shares every job. The private/public split, the guard trigger, and the archive flag were all ceremony nobody used — and the sidebar's age buckets ("This month" / "This year" / "Older") already did archive's job. ADR 0004 (2026-07-05) removed all of it: `visibility` and `archived` columns dropped, guard trigger dropped, `owner_id` demoted to a nullable "created by" record (commit `50ec4d6`; existing installs ran `supabase/migrate-shared-only.sql` once).
- **Evidence:** `docs/adr/0001-archived-as-ungated-column.md` (status: Superseded), `docs/adr/0004-all-customers-team-shared.md`, `.scratch/001_customer-scale-and-archive/ticket.md`, commits `cfb25b2`, `3bf3c19`, `a5d5ef5` (anyone-can-delete-public, the halfway step), `50ec4d6`.
- **Status:** **superseded → settled.** Do NOT re-propose private customers, a visibility toggle, an archive flag, or an owner-permission guard without new evidence; ADR 0004 records why they died. "No private drafts" is an accepted consequence, not an oversight.

### 2. Data-model roads not taken (they stay not-taken)

Rejected alternatives from ADR 0002 (2026-06-23) and ADR 0003 (2026-07-03).
Each looks attractive fresh; each was weighed and lost.

| Rejected idea | Why it lost | Winner |
|---|---|---|
| Id-based or company-qualified job→product links | Every saved job is a frozen snapshot holding only a product *name*; a new key would force migrating every old job | Name link + unique-name rule (unique within grout, within mortar) — zero changes to saved jobs |
| Optimistic concurrency control (check-on-save, conflict prompt) | Designed in full, then **deliberately shelved** — settings/catalog edits are rare and by few people | Last-write-wins, accepted with eyes open. "It is not missed, it is shelved" (ADR 0002 Consequences) |
| Per-user Settings / per-user catalog | The jobs the catalog feeds are shared; per-user lists reproduce "teammate never saw that product" | One shared settings store |
| Stock price book inside the Settings blob | ~700 SKUs would make every price tweak a full-blob write and a collision window | Own `stock_items` table, per-SKU rows |
| Stock as build-time JSON | A price change must not require a deploy | Same table, imported from the shop's .xlsx in-browser |
| Admin-only stock writes | Inconsistent with the existing trust model (accounts are admin-created; the team IS the trust boundary) | Any signed-in user can import |

- **Evidence:** `docs/adr/0002-shared-grout-mortar-catalog.md` and `docs/adr/0003-stock-price-book-snapshot.md`, "Alternatives considered" and "Why" sections.
- **Status:** **settled.** Re-opening OCC has a defined trigger: it becomes fair game only "if this ever bites" — i.e., a real observed lost-update incident. Everything else needs new evidence plus an ADR superseding the old one.

### 3. Print layout churn — and the birth of the throwaway-prototype method

- **Pressure:** the estimate print view grew into dense run-on lines nobody could scan; separately, the salesperson block needed a home on the page.
- **Tried (round 1, 2026-07-03):** a throwaway `src/PrintPrototype.jsx` rendered **5 variants + the old layout** behind a `?pv=` URL param, previewed with real customer data. Variants explicitly rejected: (A) flat spec tables without boxes, (B) customer-summary page without per-product math, (C) label-over-value cards. The user picked a blend (boxed per-area spec tables, indented material sub-rows, 3-line totals, separate Order sheet), built into App.jsx the same day (commits `859ea6d`, `7d09df5`, `48b76ec`); prototype deleted same day.
- **Tried (round 2, 2026-07-05):** same method for the salesperson block — header byline, letterhead strip, footer signature, and a borderless "salesperson card" beside the total; the card won and was iterated to **C3: "serif name, mirrors the total"** (commits `051f93b` byline baseline → `d6d3ae3` header block). Prototype `src/PreparedByPrototype.jsx` deleted same day.
- **Root cause / outcome:** print design questions are not answerable in the abstract — radically different variants on real data, user picks, blend, delete. **This throwaway-prototype method is the house research method** (the `/prototype` skill exists for it).
- **Evidence:** `.scratch/handoffs/prototype-print-layouts-2026-07-03.md`, `.scratch/handoffs/prototype-prepared-by-print-2026-07-05.md`.
- **Status:** **settled** (both layouts shipped; rejected variants A/B/C stay rejected). The method itself: settled house practice — don't debate print/UI layout in prose, prototype it.

### 4. The legacy grout "—" bug: normalization gaps bite silently

- **Symptom:** on rows migrated from the original artifact, grout quantity sat at "—" and the grout vanished from the printed estimate AND the order summary — while mortar on the same row computed fine. Typing a number "fixed" it (manual override bypasses the calc), masking the bug.
- **Root cause:** old rows carried empty-or-0 tile `thickness` / grout `joint`. The grout calc needs both (mortar needs neither — that's why only grout broke). `normP` used `??`, which passes `""` and `0` straight through, so legacy rows never got the fresh-row defaults. Compounding it: summary/print code silently *dropped* any checked material whose quantity couldn't compute.
- **Fix (two commits, 2026-07-06):** `2f3b74d` made print emit selected-but-uncomputed grout with a blank order/price; `33982cf` made `normP` default thickness/joint with `||` (and `num(joint) > 0` guard) like a fresh row, and made checked-but-uncomputed materials stay listed with a "—" quantity everywhere.
- **Durable rule:** this is a *class*, not a one-off. Every new Product/Settings field MUST be added to the normalizers (`normP`/`normA`/`normC` in `src/App.jsx`, `mergeSettings`/`normalizeCatalog`/`normWaste` in `src/catalog.js`) with legacy-safe defaults — and beware `??` vs `||` when `""`/`0` are invalid values. Second rule: never silently drop a user's selection from a summary; show it with "—".
- **Evidence:** `git show 2f3b74d`, `git show 33982cf` (both commit messages narrate the full diagnosis). Precursor of the same "silent vanish" class: `070e9ba` (grout color omitted from printout when sqft was empty, 2026-06-24).
- **Status:** **settled** (bug fixed; the normalizer rule is standing convention in CLAUDE.md).

### 5. Catalog seed vs live store: editing the code seed changes nothing

- **Symptom:** a session edited `SEED_COMPANIES` in `src/catalog.js` expecting new products to appear in the live app's catalog. Nothing changed. Real confusion, real wasted time.
- **Root cause / mechanism:** the seed runs only when the stored settings have no catalog; once seeded, the code constants are dead weight (the one exception is the by-name underlayment backfill). Full mechanism — `seedCatalog`, `backfillUnderlayments`, `removedSeeds` tombstones, line numbers — is homed in **floortrack-config-and-catalog §4**.
- **Outcome / rule:** to add or change products on a live install, use the **Settings UI** (the catalog editor, or the price-book pre-fill from issue 005). Editing seeds is only meaningful for fresh installs and the underlayment backfill path.
- **Status:** **settled.** If a task says "add product X", reach for the UI/data path, not the seed constants.

### 6. Repo rename fallout: Label-Designer → Flooring-Tracker

- **Symptom:** an older Claude Code session could no longer `git push`.
- **Root cause:** the repo was renamed `Label-Designer` → `Flooring-Tracker` (handoff doc updated in commit `c38a750`, 2026-06-21). GitHub keeps a redirect for links/clones, but sessions started against the old name lose push.
- **Outcome:** start fresh sessions against `redscissors/Flooring-Tracker`. If push fails in a long-lived session, check `git remote -v` before debugging credentials.
- **Evidence:** `PROJECT_STATUS.md` ("Heads-up: repo was renamed"), commit `c38a750`.
- **Status:** **settled** (workaround is permanent knowledge; nothing to fix).

### 7. The theme swap: monochrome won, Organic/Natural is in cold storage

- **Pressure:** the original Sage & Cream theme was replaced.
- **Tried:** two directions exist in history. `main` was rethemed to a black/grey/white palette inspired by matthaeusjandl.com (`5f7ea83`, 2026-06-21 — lavender and vivid blue dropped per user request). A separate **Organic/Natural design system** retheme (`f111d2a`, `fa9010f`, `0ec79cf`) lives ONLY on branch `backup/main-organic-design` — verified absent from `main`.
- **Outcome:** monochrome is the shipped identity; it works by overriding Tailwind's slate/indigo classes via `--ft-*` variables in `src/index.css`. Later commits refined it (`bc3d282` tighter corners, `b8e0a35` Editorial shell) without changing the palette decision.
- **Evidence:** `git show 5f7ea83 --stat`; `git branch -a` shows `backup/main-organic-design`; `git branch --contains f111d2a` → only that branch.
- **Status:** **settled.** Do not resurrect the Organic design or introduce new colors without an explicit owner ask; reuse existing utility classes (CLAUDE.md convention).

### 8. Version snapshots moved out of the customer blob

- **Pressure (issue 003):** versions lived *inside* each customer's `data` jsonb, and `updateCust` rewrites the whole blob **on every keystroke** — so every snapshot ever saved rode along on every save, forever. Also: snapshots were manual-only, and the flat sidebar wouldn't scale.
- **Outcome:** own `versions` table (one row per snapshot); customers hold version *metadata* only; snapshot fetched on restore; auto-versions on deselect (newest 5 autos kept, named versions never evicted); recency-first sidebar. The table move is what made auto-versioning cheap — sequencing was deliberate.
- **Evidence:** `.scratch/003_versions-table-and-auto-versions/ticket.md` (status: done), commits `8e9fdf9` (ticket), `9409401` (implementation); write paths `insertVersion`/`delVersion`/`loadVersion` in `src/App.jsx`.
- **Status:** **settled.** Never put version snapshots back into customer `data`, and never route version writes through `updateCust`. Any new heavy per-customer history (audit trails, activity logs) should presume its own table for the same reason.

### 9. The artifact → web-app port, and the deliberately-excluded AI feature

- **Pressure:** FloorTrack began as a Claude artifact using `window.storage`; the team needed a real multi-user tool.
- **Outcome:** ported to Vite + React + Supabase (`a02b44b`, 2026-06-21; v2 features in `c0cb2e8`; Supabase config baked into `netlify.toml` in `011561c`). Two casualties of the port: (a) `window.storage` → Supabase Postgres/Storage, and (b) the AI "Scan handwritten notes" feature was **excluded on purpose** — in the browser it would expose the Anthropic API key. It needs a serverless function (Netlify Function / Supabase Edge Function) holding the key, admin-gated, with a spend cap.
- **Evidence:** commits `a02b44b`, `c0cb2e8`, `011561c`; `CLAUDE.md` "Not yet implemented"; `PROJECT_STATUS.md` "Not implemented (future)". Legacy-data tail: customers were later migrated out of the per-user `app_data` blob on first load (`migrateLegacyCustomers`, `src/App.jsx` ~line 542) — the source of the legacy rows in entries 4 and 10.
- **Status:** port **settled**; AI scan-notes **open / deferred** — do not implement it browser-side, ever. For the current plan see `floortrack-research-frontier`.

### 10. Waste factor split: one number → `waste:{tile,floor}`

- **Pressure:** one shop-wide waste percentage was wrong for the business — tile overage and plank/roll flooring overage differ.
- **Outcome (`aa5601a`, 2026-07-06):** `wastePct` became `waste: { tile, floor }` (tile rate covers tile + its grout/mortar; hardwood/vinyl/laminate/carpet share the floor rate; carton and underlayment lines follow their product's type; misc lines carry no waste). Migration handled in code, not SQL: `normWaste` in `src/catalog.js` maps a pre-split record's single `wastePct` onto **both** rates, precedence explicit `waste.tile/floor` > legacy `wastePct` > 10% default.
- **Why it's archaeology, not just a feature:** it's the model migration done *right* — the counter-example to entry 4. Field shape changed, old jsonb records kept their meaning, zero SQL, normalizer extended in the same commit as the feature.
- **Evidence:** `git show aa5601a`; `normWaste`/`wasteFor` in `src/catalog.js` (~lines 33–49 as of 2026-07-06).
- **Status:** **settled.** Template for future jsonb shape changes: migrate in the normalizer, document precedence, same commit.

### 11. SKU search field feedback: a capped list read as missing inventory

- **Symptom (issue 005):** the issue-004 SKU typeahead silently capped results at 8. A salesperson searching "stairnose" (34 matches in the book) concluded "only 4 stairnose colors exist". Searching "transition" found nothing — the price book labels those pieces by profile (Reducer, T-Mold, End Cap, Stairnosing), never by the trade word.
- **Root cause:** truncation without a count, and a vocabulary gap between trade language and the source document's labels.
- **Outcome (`b9b96da`, `44214fe`):** `searchStock` returns every match, display slices to 30 with "Showing 30 of N matches"; `transition`/`transitions` became a synonym matching trim-profile labels; multi-select add + catalog pre-fill rode along. Verified against the shop's real 697-item workbook.
- **Evidence:** `.scratch/005_sku-search-dropdown/ticket.md` (status: done), `src/stock.js`.
- **Status:** **settled**, with two durable rules: never truncate a result list without showing the total, and when search runs over a document the team didn't write, expect trade-word synonyms to be needed.

---

## How to add an entry

Add a battle here when an investigation ends, an approach is rejected, or a
decision is superseded — anything a future session might otherwise re-fight.

1. One `###` entry, same shape: **Symptom/Pressure → Tried → Root cause / Outcome → Evidence → Status.** Compact; the evidence pointers carry the detail.
2. Evidence must be checkable from the repo alone: commit hashes (`git show <hash>` narrates most of them — the commit messages here are unusually good, keep that up), repo-relative doc paths, function names. No conversation links as sole evidence.
3. Status is exactly one of **settled / superseded / open (deferred)**. A superseding decision gets its own ADR (use `/decide`) and flips the old entry, not deletes it.
4. Date-stamp line-number claims ("as of YYYY-MM-DD") — App.jsx moves fast.
5. If the battle produced a standing rule, state the rule in one sentence and let `floortrack-change-control` / `floortrack-architecture-contract` own its enforcement.

## When NOT to use this skill

- **A live symptom right now** ("grout shows NaN", "import fails") → `floortrack-debugging-playbook`. Come back here only if the symptom smells like a past battle (legacy-data gaps especially — see entries 4 and 10).
- **The standing rules themselves** (PR-only, preview proof, no live Supabase, write paths) → `floortrack-change-control`; the architecture doctrine (snapshot-not-link, hide-never-delete, name links, LWW) → `floortrack-architecture-contract`. This skill records *how* those rules were won, not what they are.
- **The deferred AI scan-notes feature and other future work** → `floortrack-research-frontier` (entry 9 here records only why it was excluded).
- **Running a new prototype/investigation** → `floortrack-research-methodology` (entry 3 here records the method's origin story).

## Provenance and maintenance

All facts verified against the repo on **2026-07-06** (branch `claude/compact-product-fields`, HEAD `ab51a12`, ~80 commits). Sources: `git log`/`git show`; `docs/adr/0001`–`0004`; `.scratch/001`–`006/ticket.md`; `.scratch/handoffs/*.md`; `PROJECT_STATUS.md`; `src/catalog.js`; `src/App.jsx`. Note: CLAUDE.md references `docs/project-charter.md` and `docs/agents/*.md`, which do not exist in the repo as of this date — nothing here cites them.

Re-verify volatile claims:

| Claim | Command |
|---|---|
| Cited commits exist / messages match | `git show --stat 50ec4d6 33982cf aa5601a 5f7ea83 a02b44b` |
| Organic design still only on its branch | `git branch -a --contains f111d2a` |
| ADR statuses (0001 superseded) | `git grep -n "Status:" docs/adr/` |
| Seed-only-when-empty behavior | `git grep -n "seedCatalog\|backfillUnderlayments" src/catalog.js` |
| Normalizers still present at cited spots | `git grep -n "const normP\|normWaste\|migrateLegacyCustomers" src/App.jsx src/catalog.js` |
| Ticket statuses | `git grep -n "^status:" .scratch/*/ticket.md` |
| Repo remote (rename check) | `git remote -v` |
