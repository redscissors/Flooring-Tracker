# FloorTrack

A flooring & tile **selection manager** for contractors and designers. Track
customers, build out their selections by area (product, brand, color, size,
quantity), auto-calculate material add-ons (mortar, grout, underlayment,
waterproofing) with a configurable waste factor, save named versions, and
print/export clean selection sheets.

Built with **React + Vite + Tailwind**, with **cloud sync and login** powered by
**Supabase** so your data follows you across devices.

---

## Quick start (local dev)

```bash
npm install
cp .env.example .env   # then fill in your Supabase values (see below)
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

If the Supabase env vars are missing, the app shows a setup screen instead of
crashing.

---

## One-time Supabase setup

You only do this once.

1. **Create a project** — sign up free at [supabase.com](https://supabase.com),
   create a new project, and wait for it to finish provisioning.
2. **Create the database table** — in the dashboard go to **SQL Editor → New
   query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
   and click **Run**. This creates the `app_data` table and the Row-Level
   Security policies that keep each user's data private.
3. **Get your API keys** — go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. **Add them to `.env`** (copy from `.env.example`):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. **(Optional) Email confirmation** — under **Authentication → Providers →
   Email** you can turn off "Confirm email" while testing so new sign-ups can
   log in immediately. Leave it on for production.

Restart `npm run dev` after editing `.env`.

> The **anon key is safe to ship to the browser** — it's designed to be public.
> Row-Level Security (from the schema) is what actually protects the data.

---

## Deploy (get a real URL)

Any static host works since this is a client-side app. Easiest is **Vercel** or
**Netlify**:

1. Push this repo to GitHub.
2. Import it into Vercel/Netlify.
3. Build command: `npm run build` — output directory: `dist`.
4. Add the two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in the host's project settings.
5. Deploy. You'll get a live URL that works on any device — log in and your
   data syncs.

---

## How data & sync work

- All app state (customers, areas, settings, versions) is stored as a single
  JSON document in one `app_data` row **per user**, written on every change.
- Sync is **last-write-wins**: open the app on two devices and the most recent
  save wins. Fine for a single owner; if you later need real-time multi-editor
  collaboration, the data layer can be moved to relational tables + Supabase
  Realtime.
- **Backup / Restore** (sidebar) exports/imports the whole dataset as JSON —
  handy before big deletes or for moving data around.

## Project structure

```
index.html
src/
  main.jsx          # React entry
  Root.jsx          # config check + auth session gate
  Auth.jsx          # sign in / sign up screen
  App.jsx           # the FloorTrack application
  lib/supabase.js   # Supabase client (reads env vars)
supabase/
  schema.sql        # run once in the Supabase SQL editor
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
