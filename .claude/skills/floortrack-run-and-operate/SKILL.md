---
name: floortrack-run-and-operate
description: How to run, verify, and operate FloorTrack — starting the dev/preview servers (ports, launch.json, the sign-in wall), the UI/print verification workflow that produces preview proof, and the operational runbooks (deploy + rollback, price-book import, backup/restore, user management, version saves/restores), with owner-only boundaries marked. Load this when asked to "run the app", "start the dev server", "verify this UI change", "take a screenshot", "check the print layout", "how do we deploy / roll back", "import the price book", "take a backup", "restore a backup", "add a user / reset a password", or "restore a version". Not for first-time machine/project setup (see floortrack-build-and-env), diagnosing failures (see floortrack-debugging-playbook), or deciding what evidence a merge needs (see floortrack-validation-and-qa).
---

# FloorTrack: run and operate

Runbooks for the day-to-day operation of a **live production tool**: the sales
team quotes real customers from https://flooringkeeper.netlify.app daily.
Facts below verified against the repo as of 2026-07-06.

## The one fact that changes everything

**There is no staging environment.** A local `npm run dev` reads Supabase
credentials from `.env` (gitignored; values also baked into `netlify.toml`)
and talks to the **same live Supabase project** (`mzftplcyfotlzolqeapl`) as
the deployed site. Signing in locally and clicking "delete customer" deletes a
real customer. Local dev sandboxes the *code*, never the *data*.

Consequence for agents: run the app freely, but do not sign in and mutate data
on your own initiative. Anything that writes to the live project — imports,
restores, deletes, SQL — is **OWNER-run** and marked so below.

## Command anatomy

All commands run from the repo root; identical in PowerShell and bash.

| Command | What it does | Port | Talks to |
|---|---|---|---|
| `npm run dev` | Vite dev server, hot reload, source-served | 5173 (honors `PORT` env, `vite.config.js`) | Live Supabase via `.env` |
| `npm run build` | Production build → `dist/` (exactly what Netlify runs) | — | — (build only) |
| `npm run preview` | Serves the last `dist/` build | 4173 | Live Supabase (values baked at build) |
| `npm test` | `node --test src/*.test.js` — pure-logic modules only | — | Nothing (no network) |

`.claude/launch.json` defines two configs for the Claude Code preview harness:
`dev` (port 5173) and `preview` (port 4173), both with `autoPort: true`, so
`preview_start` with name `dev` is the normal way an agent runs the app.

If `.env` is missing, the app renders a "connect Supabase" setup notice
instead of crashing (`src/Root.jsx` `SetupNotice`).

### The sign-in wall

Auth is Supabase email/password, **sign-in only** (no sign-up; accounts are
created by the owner). An agent without credentials sees only the Auth screen
(`src/Auth.jsx`). So:

- **Verifiable without credentials:** app boots, no console errors on load,
  Auth screen renders and is styled, build passes.
- **Needs the owner (or a screenshot from them):** anything behind login —
  customer UI, estimate math on screen, print output with real data.
  Ask rather than guess.

## Verification workflow for UI changes

This is what produces the "preview proof" that the no-UI-merge-without-preview
rule (see `floortrack-change-control`) requires.

1. Start the server: `preview_start` config `dev` (or `npm run dev`).
2. Load the page; check the **console** for errors/warnings and the
   **network** tab for failed requests (a red Supabase 4xx on load usually
   means a policy/schema mismatch, not your change).
3. Exercise the changed UI; capture a snapshot/screenshot of the changed state.
4. If you cannot get past the Auth screen, capture what you can and request an
   owner screenshot for the rest — say so plainly in the PR.

### Print verification

The print path: the **Print** (estimate) and **Order sheet** buttons set
`printMode` ("estimate" / "order"), and an effect immediately calls
`window.print()` and clears the mode (`src/App.jsx` lines 314–315; buttons at
~1106–1107). The screen UI is `print:hidden`; a separate print-only layout
(`hidden print:block`, App.jsx ~1480) renders instead, with page margins set
in the `@media print` block of `src/index.css` (~line 94).

To verify a print change: sign in (owner), open a customer, click Print /
Order sheet, and inspect the browser's print-preview dialog — or use the
browser's own print preview (Ctrl+P) after setting up the state. A print
change is not verified until the *print preview* has been seen, not just the
screen.

## Deploy runbook

1. Open a PR; get it reviewed and merged to `main` (never push `main` directly).
2. Netlify auto-builds every push to `main`: `npm run build`, publishes
   `dist/`, env vars from `netlify.toml` (`[build.environment]` carries the
   Supabase URL + publishable anon key — public by design; RLS is the
   security boundary).
3. Live at https://flooringkeeper.netlify.app within a few minutes. There is
   no CI gate between merge and live — the pre-merge checks are the gate.

### Where state lives

| State | Lives in | In the repo? |
|---|---|---|
| Code, SQL files, docs | GitHub `redscissors/Flooring-Tracker` | yes |
| Deploys, build logs, domain | Netlify account | **no** |
| Database, auth users, storage files | Supabase account, project `mzftplcyfotlzolqeapl` | **no** |

(PROJECT_STATUS.md: keep those account logins — losing them loses the
deploy/data state, not recoverable from git.)

### Rollback

- **Verified path:** `git revert -m 1 <merge-commit-sha>` on a branch → PR →
  merge. Netlify rebuilds and the old behavior is live. This is just the
  normal deploy pipeline run in reverse, so it needs no special access.
- **Candidate path (unverified from this repo):** the Netlify UI offers
  "publish a previous deploy" for instant rollback without a rebuild. Owner
  account access required; not exercised or confirmed from this repo — treat
  as a candidate, verify in the Netlify dashboard before relying on it.
- A code rollback does **not** roll back data. If bad data was written, that
  is a data operation (owner-only, below) — a backup taken beforehand is the
  real safety net.

## Price-book import runbook — OWNER-run

Writes to the live `stock_items` table, so the owner performs it in the app.
Agents may change the import *code* (with tests — `src/pricebook.js` and
`src/stock.js` are tested modules) but never run an import against live data.

Flow (verified in `src/App.jsx` `importPriceBook` ~497 / `applyImport` ~522):

1. **Settings modal → choose the price book `.xlsx`.** Parsing is entirely
   browser-side (`parsePriceBook`, `src/pricebook.js` — SheetJS lazy-loaded);
   nothing is written yet.
2. **Diff preview** (`diffStock`, `src/stock.js`): counts of *new* /
   *changed* (with old → new price per SKU) / *no longer listed* /
   *unchanged*, plus catalog price updates (`syncCatalogPrices` — book prices
   that uniquely match a catalog product name) and parser warnings.
3. **Apply import**: upserts in batches of 200 by SKU — new and changed rows
   `active=true`, dropped-out rows marked `active=false`. **Never deletes**,
   so old estimates keep resolving their SKUs. Catalog price updates go
   through the normal `setSettings` path.

What a bad import looks like — and why **Cancel is always safe** (nothing
writes until Apply):

- "No stock items found in that file" / "Could not read that file" → wrong
  file or wrong format; nothing happened.
- A huge "no longer listed" count on the preview → probably a partial or
  wrong workbook; applying would mark most of the stock inactive
  (recoverable — a correct re-import re-activates them — but noisy). Cancel,
  check the file.
- Many warnings → skim them before applying.
- "Import failed — has supabase/stock.sql been run?" after Apply → the table
  or its policies are missing on the project (owner checks the dashboard).

Re-imports never touch saved estimates: SKU fill is a **snapshot** (ADR
0003), so rows already on a customer only show a "price book now $X" drift
chip — applying the new price is a deliberate per-row human act.

## Backup / restore runbook — OWNER-run

Lives at the **bottom of the Settings modal** ("Backup & restore" — moved off
the sidebar, issue 006). Download is read-only and harmless; **Restore writes
to live data**.

**What the export actually contains** (verified in `exportBackup`, App.jsx
~894–917): one JSON file `floortrack_backup_YYYY-MM-DD.json` with

- `customers` — every customer's full record, freshly pulled from the
  `customers` table, with each customer's **versions re-embedded including
  their full snapshots** (fetched from the `versions` table; pre-table backup
  shape preserved);
- `settings` — the shared settings (waste, catalog);
- `attachments` — the actual **file contents** as data URLs, keyed by
  attachment id, downloaded from Storage.

**Not included:** the team to-do list (`todos`), the stock price book
(`stock_items` — recoverable by re-importing the `.xlsx`), per-user profiles
(`app_data`), and auth users. A backup is a *dataset* snapshot, not a full
project snapshot.

**Restore** (same Settings section) reads a backup file and inserts every
customer as a **new row with a fresh id** — it duplicates alongside existing
data rather than overwriting, so restoring on a non-empty install creates
copies. Versions and attachment files are re-created with fresh ids;
`settings` in the file overwrite the shared settings.

**When to take one:** before any bulk delete, before the owner runs any
migration SQL, before a restore, and before importing an unfamiliar price
book. "Save failed — export a backup" toasts in the app are the same advice.

## User management — OWNER-only (Supabase dashboard)

No self-service sign-up exists; the Auth screen is sign-in only by design.

- **Add a user:** Supabase dashboard → Authentication → Users → Add user,
  tick **Auto Confirm User**. Keep "Allow new users to sign up" **off**
  (Authentication → Sign In / Providers → Email).
- **Invite / password reset:** the sign-in screen's "Forgot password? / First
  time setting one up" calls `resetPasswordForEmail` with
  `redirectTo: window.location.origin` (`src/Auth.jsx` ~29). Arriving via an
  invite or recovery link (`type=invite` / `type=recovery` in the URL, or a
  `PASSWORD_RECOVERY` auth event) routes to the "Set your password" screen
  (`src/SetPassword.jsx`, gated in `src/Root.jsx`).
- **For those links to open the live site** (not localhost), the Supabase
  Auth **Site URL** must be `https://flooringkeeper.netlify.app` and
  `https://flooringkeeper.netlify.app/**` must be in Redirect URLs
  (PROJECT_STATUS.md "Pending / to verify" — dashboard-side, cannot be
  confirmed from the repo).

## Version operations (in-app, any signed-in user)

Verified in App.jsx (`insertVersion` ~767, `autoSnapshot` ~804, `AUTO_KEEP = 5`
at line 282):

- **Named save:** "Version" button → name it → one row in the `versions`
  table with the customer's current areas/products as the snapshot. Unlimited;
  kept until hand-deleted.
- **Auto version:** saved automatically when a customer is *deselected* or
  the user *signs out* **and** its selections changed since open / last
  snapshot (JSON comparison against a baseline). Labeled "Auto — <date time>".
  Only the newest **5** autos per customer are kept; pruning removes autos
  only — **autos never evict named versions**. A failed auto-save retries at
  the next deselect.
- **Restore:** the Versions modal lists metadata only; clicking Restore
  fetches that row's snapshot from the table and replaces the customer's
  current areas/products (via `updateCust` — so the pre-restore state is
  itself auto-versioned on the next deselect if changed).
- Deleting a customer cascades its versions (FK `on delete cascade`).

## Access truth: what the RLS files grant (as of 2026-07-06)

Read from the current `supabase/*.sql` files: **nothing is anonymously
readable** (every policy requires an authenticated user); **versions are
immutable** (no update policy); **stock and shared settings are undeletable by
the client** (no delete policy). The full per-table select/insert/update/delete
table is homed in **floortrack-architecture-contract §1** (the data-topology
table) — read it there rather than maintaining a second copy here.

An earlier policy generation (pre-ADR-0004, with a private/public customer
split) is gone from the current files; `supabase/migrate-shared-only.sql`
exists to drop/replace those old policies on installs set up before ADR 0004.

**Caveat — files are not the live project** (the operationally load-bearing
point, unique to this skill). These files are run by hand by
the owner in the dashboard SQL editor; the repo cannot prove which have been
run on project `mzftplcyfotlzolqeapl`. If the migrate script has not been run
on a pre-ADR-0004 install, the *old* policies (whatever they were) are still
live. Confirming the actual deployed policy state is a dashboard check —
owner-only.

## Data operations boundary

Standing owner rule (see `floortrack-change-control`, non-negotiable #1):
**agents never execute SQL, data mutations, or storage operations against the
live Supabase project** — no dashboard actions, no `supabase` CLI, no ad-hoc
API writes. When a task needs a schema change or a data migration, the
deliverable is a `.sql` file under `supabase/` **plus run instructions**
(where it fits in the run order: schema.sql → storage.sql → stock.sql →
todos.sql; one-time vs re-runnable), shipped in a PR for the owner to run by
hand. Precedent: `supabase/migrate-shared-only.sql`.

## When NOT to use this skill

- **First-time setup** — cloning, `npm install`, creating `.env`, node/vite
  problems, ports already in use → `floortrack-build-and-env`.
- **Something is broken** and you're diagnosing why →
  `floortrack-debugging-playbook`.
- **Deciding what evidence a merge needs** (what to test, what to screenshot,
  how to prove math) → `floortrack-validation-and-qa`; the gates themselves
  live in `floortrack-change-control`.
- **Understanding the data model or math** you're operating on →
  `floortrack-architecture-contract` / `flooring-domain-reference`.

## Provenance and maintenance

Volatile facts and one-line re-verification (from repo root; PowerShell and
bash unless noted):

| Fact | Source | Re-verify |
|---|---|---|
| Scripts + ports (dev 5173 / preview 4173, `PORT` honored) | `package.json`, `vite.config.js` | `git grep -n "PORT" vite.config.js; git grep -n "\"dev\"" package.json` |
| launch.json `dev`/`preview` configs | `.claude/launch.json` | `cat .claude/launch.json` |
| Local dev talks to live Supabase | `.env` present (gitignored), values match `netlify.toml` | `git grep -n "VITE_SUPABASE_URL" netlify.toml` |
| Sign-in only, setup notice when unconfigured | `src/Auth.jsx`, `src/Root.jsx` | `git grep -n "SetupNotice" src/Root.jsx` |
| printMode → `window.print()` (App.jsx 314–315); print layout ~1480; `@media print` in index.css | `src/App.jsx`, `src/index.css` | `git grep -n "window.print" src/App.jsx; git grep -n "media print" src/index.css` |
| Netlify build cmd/publish/env; live URL; Supabase project id | `netlify.toml`, `PROJECT_STATUS.md` | `cat netlify.toml; git grep -n "flooringkeeper" PROJECT_STATUS.md` |
| Netlify "publish a previous deploy" rollback | **unverified candidate** — not exercised from this repo | check in the Netlify dashboard (owner) |
| Import flow: `importPriceBook` ~497 → preview → `applyImport` ~522, 200-row batches, `active=false` marks, no deletes | `src/App.jsx` | `git grep -n "const importPriceBook\|const applyImport" src/App.jsx` |
| Backup export = customers (versions + snapshots re-embedded) + settings + attachment data URLs; restore inserts fresh-id copies | `exportBackup` / `importBackup`, App.jsx ~894–939 | `git grep -n "const exportBackup" src/App.jsx` |
| Backup UI at bottom of Settings modal | App.jsx ~1660 | `git grep -n "Backup &amp; restore" src/App.jsx` (the `&amp;` is a literal JSX entity in source — do not "fix" it) |
| `AUTO_KEEP = 5`; auto on deselect/sign-out; autos never evict named | App.jsx 282, `autoSnapshot` ~804 | `git grep -n "AUTO_KEEP" src/App.jsx` |
| RLS: nothing anon-readable in current SQL files | `supabase/*.sql` read 2026-07-06 | `git grep -n "to authenticated\|auth.uid()" supabase/*.sql` (every policy line matches one) |
| Live project policy state unknowable from repo; migrate script for pre-ADR-0004 installs | `supabase/migrate-shared-only.sql` header | `head -12 supabase/migrate-shared-only.sql` (bash) / `Get-Content supabase/migrate-shared-only.sql -TotalCount 12` (PowerShell) |
| User management steps, Site URL config | `PROJECT_STATUS.md`, `README.md`, `src/Auth.jsx` ~29, `src/SetPassword.jsx` | `git grep -n "Auto Confirm" PROJECT_STATUS.md README.md; git grep -n "resetPasswordForEmail" src/Auth.jsx` |
| 77 tests passing (2026-07-06) | `npm test` run | `npm test 2>&1 \| tail -5` (bash) / `npm test 2>&1 \| Select-Object -Last 5` (PowerShell) |
| Owner-only / never-touch-live rules | owner interview 2026-07-06 — not stated in any repo doc; re-confirm with the owner before relaxing | — |
