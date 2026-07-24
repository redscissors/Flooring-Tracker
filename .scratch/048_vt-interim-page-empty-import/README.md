# VT price-sheet fetch imports as "0 items" — the portal's mid-build page (2026-07-24)

Status: done

Symptom: a fetched VT EFT sheet (`CAE_EFT_25_06_23.xls`, Caesar Italy /
Virginia Tile) imported as **0 items with no error**. The file itself is fine —
the same sheet parses to 1,873 items through the app's real code path (verified
in Node, the browser's `xlsx` build, and headless Chromium).

## Root cause

Dancik builds big sheets on demand and can answer **200 with an interim HTML
page** while the sheet is still building. That page has no `<table>` and no
login markers, so `classifySheetBytes` called it `"unknown"` and both relays
streamed it to the browser as a valid sheet. SheetJS parses it to a few junk
rows → "0 items parsed", silently. Worse, the import diff read every existing
row as missing, so the enabled Apply button offered to **retire the entire
book** ("0 new · 0 changed · 1873 retiring").

A true download timeout was already loud ("portal took too long") — this was
the different, silent path.

## What changed (ADR 0019 amendment, 2026-07-24)

- `classifySheetBytes` (src/vendorfetch.js + the Edge twin's inline copy):
  new `"interim"` class for an HTML document with no table and no login words;
  `%PDF` now classifies `"sheet"` (Emser fetches PDFs); non-HTML text (CSV)
  stays `"unknown"` and passes through.
- Both relays (netlify/functions/vendor-fetch.mjs,
  supabase/functions/vendor-fetch/index.ts) answer an interim body with
  **503 `sheet-not-ready`** — retriable, so the browser's retry loop usually
  lands on the portal's just-built cache.
- The browser's fetch engine (`runFetch` in src/vendorpanel.jsx) sniffs the
  relayed 200 body too — the Edge twin is hand-pasted into the dashboard and
  can lag behind the site build, so the client-side check is the reliable one.
  Interim → retried in place, then a friendly "the portal sent a page instead
  of the sheet" error; login body → the existing session advice.
- Import wizard (src/pricebooklib.jsx): a sheet that parses to **0 items**
  shows a loud red explanation, and an apply that would retire the whole book
  (0 parsed, everything missing) is **blocked**; the Force full re-import
  checkbox hides on an empty parse.

## Preview proof

`preview-1-wizard-zero-row-blocked.png` — the REAL `BookImportWizard`
(src/preview.jsx harness, `npm run dev` → /preview.html) fed the placeholder
page as its parsed sheet over a fake 1,873-item book: red banner, "Applying it
would retire all 1873 items in this book, so Apply is disabled", Apply greyed
out (`isDisabled() === true` confirmed via the shoot.mjs Playwright run).

## Follow-up (same day): longer patience for slow builds

After deploying, the owner's retry still hit the relay's 504. The relay's
145s wait CANNOT go higher — Supabase's gateway enforces a hard **150s
request-response ceiling** on Edge Functions (the 400s wall-clock figure is
for background work only; see supabase.com/docs/guides/functions/limits), so
any bigger number in the code still 504s at ~150s.

The long patience therefore lives in the browser (`runFetch`), which has no
such ceiling: a "still building" failure (the relay's 504 `vendor-timeout`,
or the interim page / `sheet-not-ready`) now retries up to 3 times spaced
~25s apart — roughly 10 minutes of automatic asking per sheet, with the
progress note saying "portal is still building this sheet". Other 5xx blips
keep the quick 2.5s hops. Client-side only: **no Edge re-paste needed** for
this part; the pasted 145s twin stays correct.

## Follow-up 2 (same day): the streamed heartbeat envelope

The patient retries still 504ed on CAE and SLR. Owner timed a direct browser
download: **2m20s (~140s)** — right against Supabase's hard 150s
answer-the-request clock (which also covers auth + streaming the body out),
so the sync relay loses the photo finish every attempt and retries rebuild
from zero. Fix: the Edge twin now answers instantly with a heartbeat stream
and waits out the build inside it (360s budget), final line `OK <base64>` /
`ERR <code>`; the browser branches on the stream content-type, shows a live
"portal is building — Ns…" note, and doesn't re-ask after a streamed timeout.
Full detail in ADR 0019's second 2026-07-24 amendment. **This one DOES need
the Edge re-paste.**

## Follow-up 3 (same day): the in-flight note never rendered

"Where should it show 'portal is building this sheet'?" — nowhere, it turned
out. The fetch engine narrated the wait into per-sheet progress state, but the
board rows rendered `prog.note` only in the ERROR state; while fetching they
drew just the thin bar. So the streamed build's counter and the retry-pacing
notes were invisible, and a minutes-long build looked like a stalled bar.
Fixed: both row variants print the note under the bar while fetching
(`preview-2-fetch-note-states.png` — the real `VendorSheetRow` in all states).

Diagnostic corollary: "no counter seen" says nothing about whether the
streamed Edge relay is live. The user's post-paste fetch failed at ~210s with
"failed (504)" — which arithmetic fits the NETLIFY fallback loop (4 × ~50s
attempts + pauses ≈ 210s, platform-level 504s that carry no JSON so the raw
status shows). That would mean the browser got a 404 from the Edge relay and
fell back — i.e. the paste didn't land under the exact name `vendor-fetch`,
or wasn't deployed. Dashboard checks: the function list must show
`vendor-fetch` with a deploy timestamp matching the paste, and its Logs must
show invocations AT the time of the failed fetch.

## Owner actions

- **Re-paste the Edge twin**: Dashboard → Edge Functions → vendor-fetch →
  paste the updated `supabase/functions/vendor-fetch/index.ts`. (If it isn't
  deployed at all, deploy it — big VT sheets need its ~145s window; the
  Netlify fallback gets ~50s.)
- Optional diagnosis: Edge Functions → vendor-fetch → Logs/Invocations around
  the failed VT fetches — 504s mean timeouts, 200s with small bodies are the
  interim page. (Read-only; the Supabase MCP wasn't authenticated in the
  build session, so this wasn't checked automatically.)
