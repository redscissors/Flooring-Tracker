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
3. **Create the attachments storage** — new SQL query, paste
   [`supabase/storage.sql`](supabase/storage.sql), **Run**. This creates a
   private `attachments` bucket (for customer photos / spec sheets / PDFs) with
   policies so each user only sees their own files.
4. **Lock down sign-up (team-only)** — under **Authentication → Sign In /
   Providers → Email**, turn **off** "Allow new users to sign up". Then add your
   people yourself under **Authentication → Users → Add user** (tick *Auto
   Confirm User*). The app's login screen is sign-in only.
5. **Get your API keys** — go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
6. **Add them to `.env`** (copy from `.env.example`):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

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

- All app state (customers, areas, products, settings, versions) is stored as a
  single JSON document in one `app_data` row **per user**, written on every
  change.
- **Attachments** (photos, spec sheets, PDFs) are stored as files in the private
  Supabase **Storage** bucket under `<user_id>/<file_id>`, not in the database
  row. Only metadata (name, type, size) lives in the JSON.
- Sync is **last-write-wins**: open the app on two devices and the most recent
  save wins. Fine for a single owner; if you later need real-time multi-editor
  collaboration, the data layer can be moved to relational tables + Supabase
  Realtime.
- **Backup / Restore** (sidebar) exports/imports the whole dataset as JSON,
  including attachment file contents — handy before big deletes or for moving
  data around.

## Not yet wired up

- **AI "Scan handwritten notes."** The original artifact called Anthropic's API
  directly from the browser, which isn't safe in a deployed app (it would expose
  the API key). To add it, put the Anthropic key in a serverless function
  (Netlify Function or Supabase Edge Function) and have the app call that. Left
  out of this version by choice.

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
