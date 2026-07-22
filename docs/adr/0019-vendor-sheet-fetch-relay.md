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

## Amendment (2026-07-17): remembered sheets — one link refreshes the lot

Field testing found connect24's own price-list navigation is a **menu of
`#menu-option/N/N` app-code links**: the download URL exists nowhere in the
page until a sheet is opened, and opening one triggers a download whose blank
tab can't run the bookmarklet. Static harvesting is impossible there, and
per-sheet capture saves nothing over just downloading.

So the panel **remembers every successfully fetched sheet's stable params**
(`settings.ops.vendorSheets`: vendor/host/uid/user/filename — normOps strips
any session token before shared settings ever see one; identity is
`vendor:host:uid:user`, so a re-release's new filename replaces its
predecessor's). All entries for one portal share one login session, so any
single fresh link — pasted from the browser's Downloads page, or captured by
the bookmarklet on page-style portals — donates its `sesid` to every
remembered sheet for that portal + dealer account. Quarterly VTC updates
become: open one sheet, paste its link, fetch all. The fetch still relays
per-sheet and lands in the same review flow.

## Amendment (2026-07-17): Supabase Edge Function for long portal builds

Measured reality: Dancik portals **build** a requested sheet on demand, and
the largest VTC book took **~103 seconds** to generate — longer than a Netlify
synchronous function's window under any of its (plan/era-dependent, disputed:
10 / 26 / 30 / 60s) limits, so no retry schedule reliably beats it.

A **Supabase Edge Function** (`supabase/functions/vendor-fetch/index.ts`) may
wait minutes on IO, so it becomes the primary relay; the Netlify function
stays as fallback. The browser (`relay()` in the fetch panel) prefers the Edge
Function and downgrades to Netlify only on a 404 (not deployed) or an
unreachable error — a live Edge Function's 5xx is retried in place, never sent
to the shorter-window relay. The Edge Function is self-contained (its own copy
of the allowlist/validation/sniffing, kept in sync with `src/vendorfetch.js`)
so it pastes straight into the dashboard editor, and relies on Supabase's
"Enforce JWT verification" gateway toggle for auth instead of verifying the
token in code. Owner deploys it by hand (dashboard, like the `*.sql` files);
until then the Netlify relay serves every fetch the platform window allows.

## Amendment (2026-07-18): the bookmarklet grabs the bare session, not just links

Field reality on connect24 (a menu-style portal): the harvest step from the
original decision finds **zero** `getPrettyPriceList` links — the download URL
doesn't exist in the page until a sheet is opened — so the bookmarklet only
ever hit its "nothing found" dead end there. The remembered-sheets amendment
solved the *bulk* problem but still required pasting one fresh link per quarter
to donate a `sesid`.

The token turns out to be reachable without a link: connect24 keeps its live
session in the portal's own **`localStorage`** (`d24sesid`, and `d24user` for
the dealer account) — no cookie, readable by page JS. So the bookmarklet now
also grabs that bare session (storage first, page-HTML regex as fallback) and
ships it in the same `#vfetch` fragment as an optional `session:{host,user,
sesid}`. FloorTrack validates it exactly like a link's fields (`normSession` —
allowlisted host, token/user shape) and folds it into the live-session pool
**without remembering any sheet** (`poolSession`; a known account keys one
entry, an unknown one fans the token across that host's remembered accounts).
One bookmark click on any signed-in portal page unlocks every saved sheet for
that sign-in.

This also decouples the paste box: "Unlock downloads" pools a pasted link's
`sesid` only (temp), while "Add to board" keeps the old remember-the-sheet
behavior for bootstrapping a portal by hand. No sheet is ever saved as a
side effect of unlocking. Session tokens still live only in this browser tab
(component state + `sessionStorage` hand-off) and never reach shared settings
or a server log — unchanged from the original decision.

Boundary unchanged: the relay still never accepts a raw URL and still requires
a Supabase JWT; grabbing the token client-side only removes the manual paste,
it does not widen what the server will fetch.

## Amendment (2026-07-18): clipboard hand-off instead of opening a tab

The original decision handed the payload over by **opening FloorTrack** at a
`#vfetch=` fragment (`window.open(origin + "/#vfetch=…", "ftvfetch")`). The named
window was meant to reuse one tab, but in practice — a separately-opened
FloorTrack tab isn't named `ftvfetch`, and a closed tab can't be reused — clicks
kept spawning new tabs. The owner asked for "no new tabs."

So the bookmarklet now **copies** the payload to the clipboard instead of opening
anything: the same base64 `{v:1,links,session}` blob, prefixed with a recognizable
mark (`HANDOFF_MARK = "FTSHEETS:"`), via `navigator.clipboard.writeText` with a
textarea+`execCommand` fallback and a `prompt()` last resort. In FloorTrack a
**"Paste sign-in"** button reads the clipboard (`navigator.clipboard.readText`,
falling back to a manual paste box when a browser blocks the read) and folds the
blob in through the same `decodeHandoff` / `decodeHandoffSession` path the
fragment used — so the receiver is unchanged and the token still only ever lives
in this browser, never a URL, server, or log. One tab, forever.

The privacy/relay boundary is untouched: the clipboard is local, the blob is the
same shape, the relay still takes only structured params behind a JWT. The
`#vfetch` fragment reader (`captureHandoff` + the `hashchange` listener) is kept
as a harmless fallback so a bookmark a user dragged before this change still
works until they re-drag the new one; the setup UI now hands out only the
clipboard bookmarklet. Companion UI in the same change: the paste card shrank to
a compact box, and a sheet whose sign-in is live now shows an emerald "ready"
glow on its download button (`.ft-live`) until it's fetched (then the ✓).

## Amendment (2026-07-21): Emser — the first sessionless adapter

Emser Tile publishes each dealer's price list at a **stable per-account URL
with no session token anywhere in it**:
`https://www.emser.com/api/v1/custom/customerDocuments/<acct>-<period>-ISPL.xlsx`
(e.g. `1374258-Jul2026-ISPL.xlsx`). That makes it the framework's first
non-Dancik platform — and its first **sessionless** one, which the original
decision's sesid mechanics didn't model.

The `emser` adapter (`VENDORS.emser`) carries `sessionless: true` and
per-vendor validation rules (rules moved from the module-level Dancik constants
into each adapter):

- **Identity is the filename.** uid and user are both the dealer account, read
  off the filename's leading digit run, so recordKey/grouping work exactly like
  Dancik's ("Emser Tile · 1374258" board column). The sesid rule is `/^$/` —
  the relay rejects any entry that *carries* a token for this vendor.
- **Always live.** `sheetSesid` returns a sentinel for sessionless vendors, so
  remembered Emser sheets are permanently green/ready — no bookmarklet, no
  session pool, no quarterly unlock. `applySesid` clamps the sentinel back to
  `""` before the wire.
- **Releases are period-stamped filenames.** A new release means pasting the
  new link once ("Add to board" — it replaces its predecessor, recordKey
  excludes the filename by design), the same gesture as a VTC quarterly. If a
  cadence emerges, deriving candidate filenames (`<acct>-<Mon><YYYY>-ISPL.xlsx`)
  is a possible later nicety; deliberately not built on one observed release.
- **Failure stays soft.** If the URL turns out to require emser.com's login
  after all (the relay sends no cookies), the login-bounce classifier surfaces
  a per-sheet "the vendor declined the download" note — pointing at a fresh
  link, not at the bookmarklet, which can't help a token-free vendor.

**Owner verification required before trusting it:** open the URL in a private/
incognito window. If it downloads logged-out (as Dancik's did), the relay path
is sound. The Edge Function twin gained the same adapter — re-paste it in the
dashboard (Edge Functions → vendor-fetch) to update the deployed copy; the
Netlify fallback ships with the site build as usual.

### Verification outcome (2026-07-21, same day): the URL is NOT public

The owner ran the incognito test: the document URL **errors logged-out**.
Emser's `customerDocuments` endpoint requires the emser.com login after all —
it answers the relay's cookie-less fetch with a hard **401**, which the
relays passed through as the raw "vendor portal answered 401" instead of the
soft note this amendment promised (401 is neither a redirect nor a login-page
body, so both classifiers missed it).

Consequences, applied with this note:

- Portal 401/403 now classify as the sign-in bounce (`deadSessionStatus` in
  `src/vendorfetch.js`, mirrored inline in the Edge twin) — same 409
  `session-expired` shape the browser already maps per vendor.
- The sessionless-vendor note now points at **download-and-drop** ("grab the
  sheet from their site while signed in and drop the file on this page") —
  the old "paste its fresh link" advice was wrong, since no Emser link works
  without the login the relay can't send. Remembered Emser sheets still show
  on the board as the book's identity; their fetch button just always lands
  on this note until real auth exists.
- **One-click Emser fetch is future work gated on recon**, not on code: with
  a signed-in emser.com session, check the download request's headers in
  DevTools. An `Authorization: Bearer …` header means a bookmarklet can
  capture the token and this adapter can carry it (Dancik-style). Cookie-only
  auth (HttpOnly) is unreachable from a bookmarklet by browser design — then
  the options grow server-side credentials, a decision the owner must make
  deliberately (secrets storage, spend, liability), not an adapter tweak.

Boundary unchanged: the relay still accepts only structured params behind a
FloorTrack JWT and rebuilds the URL from the allowlisted host + fixed path —
`customerDocuments/<validated filename>` — so it still can't proxy anything
else on emser.com.
