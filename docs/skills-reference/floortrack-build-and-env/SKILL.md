---
name: floortrack-build-and-env
description: How to recreate the FloorTrack working environment from scratch and avoid its known setup traps — clone, npm install, .env creation, dev server ports, the npm scripts table, Node/toolchain facts, Supabase one-time provisioning (owner-run only), Netlify deploy anatomy, and environment gotchas (path with spaces, OneDrive, repo rename, xlsx lazy-load). Load this when setting up the project on a new machine, when "npm run dev" / "npm run build" / "npm test" fails or behaves oddly, when the app shows the "connect Supabase" setup screen, when a port is taken, when asked "how do I run this locally", or before touching package.json, vite.config.js, netlify.toml, or .env. Not for operating the running app (see floortrack-run-and-operate) or for what settings/catalog values mean (see floortrack-config-and-catalog).
---

# FloorTrack — Build & Environment Runbook

Everything needed to go from a bare clone to a running dev server, plus the
traps that waste time. All commands and facts below were verified against the
repo on 2026-07-06 (see "Provenance and maintenance" at the end).

**Jargon, once:**
- **Vite** — the build tool/dev server (`npm run dev` serves, `npm run build` bundles to `dist/`).
- **Supabase** — the hosted backend (Postgres database, auth, file storage). The app is a static client; Supabase is the only server.
- **anon key** — Supabase's public client key. It ships in the browser bundle *by design*; Row-Level Security (RLS) in the database is the real security boundary.
- **Netlify** — the static host. It rebuilds and publishes the live site on every push to `main`.

---

## 1. From-scratch local setup

```bash
git clone https://github.com/redscissors/Flooring-Tracker.git
cd Flooring-Tracker
npm install
```

Then create `.env` from the template:

```bash
# bash / Git Bash
cp .env.example .env
```
```powershell
# PowerShell
Copy-Item .env.example .env
```

Fill in the two values. For the shop's **live** project the values are recorded
in `netlify.toml` and `PROJECT_STATUS.md` — the anon key is public by design.

> **There is no staging environment.** Pointing a local dev server at these
> values means local clicks write **real production data** the sales team
> quotes from. That is how the owner uses it, but **an agent NEVER mutates the
> live project on its own initiative — no SQL, no data or storage writes**. The
> owner runs SQL files by hand. (Owner non-negotiable — see
> floortrack-change-control, and floortrack-run-and-operate's boundary section.)

```
VITE_SUPABASE_URL=https://mzftplcyfotlzolqeapl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO
```

Start the dev server:

```bash
npm run dev
```

- Default port **5173**. `vite.config.js` honors an externally assigned
  `PORT` env var (used by the preview harness when 5173 is taken) and sets
  `strictPort: true` in that case — with `PORT` set, Vite fails rather than
  silently picking another port. Without `PORT`, Vite's default behavior
  applies (5173, auto-bumping if busy).
- **Restart the dev server after editing `.env`** — Vite reads env vars at startup.

### What happens with missing env

Nothing crashes. `src/lib/supabase.js` deliberately does **not** throw when
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent — it exports
`isConfigured = false` and a `null` client. `src/Root.jsx` checks
`isConfigured` and renders a friendly `<SetupNotice />` ("Almost there —
connect Supabase") instead of the app. So a blank screen is *not* an env
problem; a setup screen is.

---

## 2. Toolchain facts

| Fact | Value | Where verified |
|---|---|---|
| Framework | React 18 (hooks only, **no router**) | `package.json` (`react ^18.3.1`) |
| Build | Vite 5 | `package.json` (`vite ^5.4.3`) |
| Styling | Tailwind 3 + CSS custom props (`--ft-*`) | `tailwind.config.js`, `src/index.css` |
| Tailwind content globs | `./index.html`, `./src/**/*.{js,jsx}` | `tailwind.config.js` |
| PostCSS | `tailwindcss` + `autoprefixer` only | `postcss.config.js` |
| Language | Plain JS/JSX — **no TypeScript** | no tsconfig, `.jsx` sources |
| Modules | ESM — `"type": "module"` | `package.json` |
| Node requirement | **Not pinned** — no `engines` field | `package.json` |
| Known-good Node | **v24.17.0** (npm 11.13.0) runs all 77 tests and the build on the owner's machine, as of 2026-07-06 | `node --version`; `npm test` |
| Other deps | `@supabase/supabase-js`, `lucide-react` (icons), `xlsx` (SheetJS, lazy-loaded — see §6) | `package.json` |

New Tailwind classes only work in files matched by the content globs above —
a new `.js`/`.jsx` file under `src/` is covered automatically.

---

## 3. npm scripts

| Script | Command | Notes |
|---|---|---|
| `npm run dev` | `vite` | Dev server, port 5173 (or `PORT` env, strict — §1) |
| `npm run build` | `vite build` | Production bundle → `dist/` (~3 s, verified) |
| `npm run preview` | `vite preview` | Serves the built `dist/` on port **4173** |
| `npm test` | `node --test src/*.test.js` | Node's built-in test runner, no framework |

- **Test glob:** any new `src/*.test.js` file is picked up automatically — no
  registration step. As of 2026-07-06 there are three test files
  (`src/catalog.test.js`, `src/pricebook.test.js`, `src/stock.test.js`), **77
  tests, all passing**. They cover only the pure-logic modules; `src/App.jsx`
  (all UI + all Supabase writes) has zero automated tests.
- **`dist/` is gitignored, not tracked** (`.gitignore` line 2; `git ls-files
  dist` is empty). A local `dist/` folder existing is just leftover build
  output — never commit it, never edit it.

---

## 4. Supabase one-time provisioning — OWNER-RUN ONLY

**An agent never executes these.** The SQL files are run **once, by hand, by
the owner** in the Supabase dashboard SQL Editor (paste → Run). If a change
requires new SQL, hand the file to the owner via the PR description (see
floortrack-change-control). `README.md` has the step-by-step walkthrough for
schema, storage, and auth lockdown; `CLAUDE.md` lists all the SQL files.

Order for a fresh install:

| # | File | Creates | If missing |
|---|---|---|---|
| 1 | `supabase/schema.sql` | `app_data` + `customers` + `versions` tables + RLS | App can't load/save anything after sign-in |
| 2 | `supabase/storage.sql` | Private `attachments` bucket + storage policies | Attachment upload/download fails (`PROJECT_STATUS.md` lists this as the "enables attachments" step) |
| 3 | `supabase/stock.sql` | `stock_items` table + RLS | Stock load is best-effort (`App.jsx` ~line 414): the SKU picker simply doesn't render (gated on `stock.length > 0`), Settings shows "run supabase/stock.sql once", and a price-book import fails with "Import failed — has supabase/stock.sql been run?" |
| 4 | `supabase/todos.sql` | `todos` table + RLS | To-do load is best-effort (`App.jsx` ~line 417): the team Issues list just stays empty |
| — | `supabase/migrate-shared-only.sql` | Drops pre-ADR-0004 visibility/archived columns | Only needed **once** on installs created before ADR 0004 |

Auth configuration (also owner-run, in the Supabase dashboard — from
`README.md` step 4 and `PROJECT_STATUS.md`):

- **Sign-up OFF**: Authentication → Sign In / Providers → Email → turn off
  "Allow new users to sign up". The app's login screen is sign-in only.
- **Users added by admin**: Authentication → Users → Add user, tick **Auto
  Confirm User**.
- **Site URL + Redirect URLs**: Site URL `https://flooringkeeper.netlify.app`,
  add `https://flooringkeeper.netlify.app/**` to Redirect URLs — otherwise
  invite/password-reset links open localhost instead of the live site.
  (`src/Root.jsx` routes `type=invite` / `type=recovery` URL markers to a
  "Set your password" screen.)

---

## 5. Deploy anatomy

- Host: **Netlify**, live at https://flooringkeeper.netlify.app.
- `netlify.toml`: build command `npm run build`, publish directory `dist`,
  and both `VITE_SUPABASE_*` values baked into `[build.environment]` — builds
  need zero Netlify-UI configuration.
- **Every push to `main` deploys to production automatically.** There is no
  CI and no test gate. This is why the PR-only rule exists: never push
  straight to `main` — see **floortrack-change-control** before merging
  anything.

---

## 6. Known traps

| Trap | What to do |
|---|---|
| **Repo path contains spaces** (`...\Claude ReadWrite\Flooring-Tracker`) | Always quote the path in shell commands: `git -C "C:\...\Claude ReadWrite\Flooring-Tracker" status`. Unquoted paths split at the space and fail confusingly. |
| **Repo lives under OneDrive** | Caution (not a verified incident): OneDrive sync can hold file locks or lag writes, which can surface as flaky `npm install` / build / git errors. If you hit an inexplicable EPERM/EBUSY, suspect sync before suspecting the code. |
| **Repo was renamed** `Label-Designer` → `Flooring-Tracker` | Sessions/clones created against the old name can no longer `git push` (GitHub's redirect keeps fetch/API working, push breaks). Fix: point the remote at `redscissors/Flooring-Tracker` or start fresh. Documented in `PROJECT_STATUS.md`. |
| **xlsx (SheetJS) is lazy-loaded** | `await import("xlsx")` happens only inside the price-book import handler (`src/App.jsx`, ~line 504). It builds as its own chunk (`dist/assets/xlsx-*.js`, ~429 kB — verified in build output), so the main bundle never pays for it. Don't add a top-level `import ... from "xlsx"` anywhere — that would pull it into the main chunk. |
| **`.env` edits need a dev-server restart** | Vite reads env at startup (§1). |
| **Preview harness ports** | `.claude/launch.json` defines two configs for the preview tooling: `dev` (npm run dev, port 5173) and `preview` (npm run preview, port 4173), both with `autoPort: true` — the harness sets `PORT` when the default is taken, which triggers the `strictPort` branch in `vite.config.js`. |
| **README's "Project structure" section is stale** | It predates `catalog.js`/`pricebook.js`/`stock.js` and the extra SQL files. Trust `CLAUDE.md`'s source layout instead. |

---

## When NOT to use this skill

- **Operating the running app** — signing in, building estimates, printing,
  running a price-book import, taking preview screenshots → **floortrack-run-and-operate**.
- **What a setting/catalog value means** (waste %, grout/mortar rates, seed
  vs live catalog) → **floortrack-config-and-catalog**.
- **Whether a change may merge / needs a PR / needs SQL handed to the owner**
  → **floortrack-change-control**.
- **A bug in app behavior** (not an environment failure) → **floortrack-debugging-playbook**.

---

## Provenance and maintenance

All volatile facts dated 2026-07-06. Sources and one-line re-checks:

| Fact | Source | Re-verify with |
|---|---|---|
| Scripts, deps, `"type": "module"`, no `engines` | `package.json` | `node -e "const p=require('./package.json');console.log(p.scripts,p.engines)"` |
| PORT / strictPort behavior | `vite.config.js` | read the file (9 lines) |
| Missing-env setup screen | `src/Root.jsx` + `src/lib/supabase.js` | `grep -n "isConfigured" src/Root.jsx src/lib/supabase.js` |
| 77 tests passing, Node v24.17.0 | test run on owner's machine | `node --version` then `npm test 2>&1 \| tail -5` |
| `dist/` ignored, untracked | `.gitignore`, git | `git check-ignore -v dist; git ls-files dist` |
| Live Supabase URL/key, deploy config | `netlify.toml`, `PROJECT_STATUS.md` | read `netlify.toml` (12 lines) |
| SQL file list | `supabase/` dir | `ls supabase` |
| Missing stock.sql/todos.sql consequences | `src/App.jsx` best-effort loads + gating | `grep -n "stock.sql\|todos.sql\|stock.length > 0" src/App.jsx` |
| xlsx lazy-load + own chunk | `src/App.jsx` ~line 504; build output | `grep -n "import(\"xlsx\")" src/App.jsx; npm run build 2>&1 \| tail -6` |
| Auth setup steps, rename trap | `README.md` §"One-time Supabase setup", `PROJECT_STATUS.md` | read those files |
| Launch configs | `.claude/launch.json` | read the file |

If any re-check disagrees with this skill, **the repo wins** — update this file.
