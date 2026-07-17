# Supabase Edge Functions

Deployed by hand in the Supabase dashboard, like the `supabase/*.sql` files —
an agent ships the file, the owner deploys it. Never run against the live
project automatically.

## `vendor-fetch` — vendor price-sheet relay (ADR 0019)

Primary relay for the "Fetch from vendor…" panel. Dancik portals build big
price sheets on demand (largest observed ~103s), longer than a Netlify
function's window; a Supabase Edge Function gets 150s to respond, so it holds
the connection long enough. The browser prefers this function and falls back
to `netlify/functions/vendor-fetch.mjs` only when it isn't deployed.

### Deploy (once)

1. Supabase dashboard → **Edge Functions** → **Deploy a new function** → the
   **"via editor"** option.
2. Name it **exactly** `vendor-fetch` — the browser calls
   `/functions/v1/vendor-fetch`.
3. Paste the full contents of `vendor-fetch/index.ts`, replacing the starter.
4. Leave **Enforce JWT verification ON** — the gateway then rejects anyone not
   signed in to FloorTrack before the code runs. No secrets, no env vars.
5. **Deploy.**

### Confirm it's live

Open `https://<your-project-ref>.supabase.co/functions/v1/vendor-fetch` in a
browser. A **401 "Missing authorization header"** means deployed + gated
(correct). A **404 "not found"** means it isn't deployed and fetches are
falling back to Netlify's shorter window.

Keep the allowlist / validation / login-sniffing in sync with
`src/vendorfetch.js` when either changes.
