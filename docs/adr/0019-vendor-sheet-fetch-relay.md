# ADR 0019 — Vendor sheet fetch: a bookmarklet discovers portal links, a Netlify Function relays the bytes

- **Status:** Accepted
- **Date:** 2026-07-17
- **Scope:** system-wide — the app's **first server-side component** (`netlify/functions/vendor-fetch.mjs`), plus `src/vendorfetch.js` (shared pure helpers) and a "Fetch from vendor…" panel in the Price book library. No schema change; no new Supabase write path.
- **Related:** ADR 0009 (price book library), ADR 0003 (snapshot doctrine), `src/dropimport.js` (multi-file routing), `docs/pricebook/design.md` §"Deferred"

## Context

Keeping 10–30 vendor books current means someone visits each distributor
portal every quarter, logs in, and downloads each brand's sheet one at a time —
the acquisition step is the whole cost; the drop → route → diff → apply side is
already one gesture. The design doc had deferred automatic fetching with "no
server today."

Virginia Tile's connect24 (a **Dancik** portal — an ERP many flooring
distributors run) exposes each price list as a plain GET whose URL carries a
stable list id (`d24_uid`), the dealer account (`d24user`), the current file
name, and a per-login session token (`d24sesid`). The owner verified the URL
works in a logged-out browser: the token in the URL is self-sufficient, no
cookie needed. But the browser still can't fetch it — the portal is
cross-origin with no CORS — and the current file name changes with every
release, so a stored "shopping list" of URLs would drift.

## Decision

1. **A bookmarklet does the discovery, on the portal page, logged in as the
   user.** It scrapes every `getPrettyPriceList` link off the page (top
   document + same-origin frames), which yields fresh file names *and* a live
   session token in one click, then opens FloorTrack with the raw links
   base64'd in the **URL fragment** (fragments never reach a server or its
   logs). No vendor credentials are ever stored anywhere — the user's own
   portal login is the auth, renewed by re-clicking the bookmark. A paste-box
   accepts the same links by hand as the no-bookmark fallback.

2. **A Netlify Function relays the bytes; it never accepts a raw URL.** The
   browser sends structured params (vendor kind, host, uid, user, filename,
   sesid); the function validates each against per-adapter rules, rebuilds the
   URL from an **allowlisted host + fixed path template**, fetches, sniffs the
   body (a dead session returns the portal's login page, not an error status —
   `classifySheetBytes`), and streams the sheet back. It requires a Supabase
   JWT (verified via `auth.getUser`), so it is neither an open proxy nor a
   public fetcher. The session token passes through per-request, unlogged.
   Netlify over a Supabase Edge Function because the site already deploys
   there: same origin (no CORS), one pipeline, zero new dashboards.

3. **Fetched sheets enter the existing import path unchanged.** Each response
   becomes a `File` and the batch is handed to the same state the drag-drop
   sets (`setDropped`), so `ImportRouter` does the routing (EFT title-line
   fingerprints already distinguish VTC's sibling brands), and each book gets
   its normal diff preview → apply. No pre-mapping of link → book is needed,
   which is why no per-book config or SQL is required.

4. **The framework is per-platform, not per-distributor.** `VENDORS` in
   `src/vendorfetch.js` keys adapters by portal platform (`dancik` first);
   another Dancik-hosted distributor is one more allowlisted host, and a
   different platform is a new adapter entry + link parser feeding the same
   hand-off, relay, and drop-router path.

## Consequences

- Updating every VTC brand collapses to: log into connect24 → click the
  bookmark → review diffs → apply. The quarterly staleness problem (design
  §8.3) loses its main cause.
- The repo now ships server code; `netlify.toml` gains a `[functions]` block.
  The function needs no secrets — it verifies JWTs with the public URL + anon
  key (committed fallbacks, same values the browser bundle ships).
- A fetch can fail soft: an expired portal session surfaces per-sheet as
  "session expired — log in and click the bookmark again," never a broken
  import (nothing writes until the user applies a diff).
- Fully hands-off fetching (cron + stored portal credentials) remains
  deliberately out: it would store vendor passwords and break on 2FA. If ever
  wanted, it slots behind the same relay.
