---
issue_type: Feature
summary: "Preview proof for address lookup + distance (2026-09-01 plan, task 9):
  the REAL AddressField/useAddressSuggest/mapslookup parsers driven with only
  the /.netlify/functions/maps fetch stubbed, shot in all six states —
  suggestions open, a fresh distance chip, a stale-distance drift chip +
  Recheck, and the three relay error cards (not-configured / over-quota /
  no-route) — plus the transient Measuring… state, the Recheck round trip,
  and a 420px-wide pass for dropdown clearance and chip wrap."
status: done
labels: [ready-for-human]
---

# Address lookup + distance — preview proof (task 9)

Non-negotiable #3: no UI change merges without preview proof. This harness
covers the address-lookup + distance feature (google-key autocomplete
suggestions, a shop→address distance measurement, and the drift/Recheck
chip when a stored distance no longer matches the addresses it was measured
between).

## What's real, what's stubbed

Everything above the network boundary is the real shipped code: the real
`AddressField` (src/widgets.jsx), the real `useAddressSuggest` hook and
`fetchDistance` (src/usemapslookup.js), the real debounce, and the real
parsers (src/mapslookup.js — `parseSuggestions`, `parseDistance`,
`distStale`, `formatDist`). Only `window.fetch` for
`/.netlify/functions/maps` is faked, keyed off a `netMode` switch
(`ok` / `not-configured` / `over-quota` / `no-route`) driven by the
`data-mode` buttons at the top of the page, matching the reply shape the
task brief specified.

**Session stub, and why:** `useAddressSuggest` calls
`supabase.auth.getSession()` before every relay call, and `src/lib/supabase.js`
exports `supabase` as `null` when the Vite env vars are absent — which would
make every card show the "Sign in again" copy instead of the six states this
proof needs. The harness was run with the real
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` passed straight to the `vite`
process (no `.env.local`, no credential added to any file), so `supabase` is
a real, non-null client and the hook's real "client exists, ask it for a
session" branch runs. There is no interactive sign-in available in a
headless preview, so `preview.jsx` stubs
`supabase.auth.getSession = async () => ({ data: { session: { access_token:
"preview-fake-token" } } })` — only that one call's own network round trip
is faked; every other line the hook runs is production code. No real
credential lives in the harness or in this file.

## Cards (`.scratch/120_address-lookup-distance/preview.jsx`)

Six `AddressField`s over local state, `SHOP = "1 Shop St, Akron, OH"`:

| # | Card | How it's reached |
|---|---|---|
| 1 | Suggestions open | mode `ok`, type `4905 Har` |
| 2 | Fresh distance | mode `ok`, pick suggestion 1, wait for the chip |
| 3 | Stale + Recheck | seeded `distance={miles:18.4,minutes:27,from:SHOP,to:"9 Old Rd",at:1}`, `value` seeded to a different address |
| 4 | `not-configured` | mode `not-configured`, type — the dropdown's error banner |
| 5 | `over-quota` | mode `over-quota`, type — the dropdown's error banner |
| 6 | `no-route` | mode `no-route` (suggest still succeeds under this mode), pick a suggestion — the distance-chip error |

## What I saw, opening every screenshot

- **`01-suggestions-open.png`** — typing `4905 Har` into card 1 opens a
  white bordered dropdown directly under the input, three suggestion rows,
  sitting above card 2 below it (z-30) with no clipping.
- **`02a-measuring.png`** — 20ms after clicking a suggestion in card 2, the
  row under the input reads "Measuring…" in muted gray — the transient state
  renders.
- **`02-fresh-distance.png`** — after the fake relay resolves (~120ms), the
  same row reads "18.4 mi · 27 min from the shop" in the same muted gray
  (no error, no drift styling) — a fresh chip.
- **`03-stale-distance.png`** — card 3 at rest: an amber "Address changed
  since this was measured — 18.4 mi · 27 min from the shop" line with an
  amber-outlined **Recheck** pill beside it, addresses genuinely mismatched
  (`to: "9 Old Rd"` stored vs. `9 New Rd, Akron, OH` typed).
- **`03a-recheck-measuring.png`** — clicking Recheck immediately swaps the
  amber drift line for the same gray "Measuring…" used in card 2 — confirms
  the pill really dispatches `measureAddr`, not a no-op.
- **`03b-recheck-resolved.png`** — once resolved, the line reads plain gray
  "18.4 mi · 27 min from the shop" with **no** amber and **no** Recheck pill —
  because the fresh record's `to`/`from` now match the field and `shopAddress`,
  `distStale` correctly reports false.
- **`04-not-configured.png`** — dropdown shows one amber-tinted row: "Address
  lookup needs a Google key — see Settings" — real copy, not an empty panel.
- **`05-over-quota.png`** — same slot: "Address lookup unavailable — daily
  limit reached".
- **`06a-no-route-suggestions.png`** — under `no-route` mode the suggest call
  still succeeds (by design — only the distance op errors), so the dropdown
  shows normal suggestion rows.
- **`06-no-route.png`** — after picking one, the chip row shows amber
  "Couldn't find a route to that address" instead of a mileage figure.
- **`07-suggestions-420.png`** (820px pass repeated at 420px) — dropdown
  still sits directly under the input, still above the next card, and its
  right edge (`right-16`) stops clear of the two icon buttons at this width
  too — a thin sliver of card 2's placeholder is visible in the gap between
  the dropdown's right edge and the buttons, which is exactly what `right-16`
  intends (the dropdown doesn't reach under the icons), not a clipping bug.
- **`08-stale-distance-420.png`** — at 420px the amber drift line wraps onto
  two lines and the Recheck pill drops to its own line below — `flex-wrap`
  is doing its job; nothing overflows the card or truncates.

## Six visual-property verdicts

1. **Dropdown position/z-index/clipping** — Pass. Sits flush under the
   input, `z-30` above the next card, no ancestor clips it (no card or
   wrapper carries `overflow-hidden`).
2. **Dropdown right edge clears the two icon buttons at both widths** —
   Pass, at both 820px and 420px. `right-16` leaves the icon-button column
   fully clickable/visible in every shot.
3. **Chips wrap rather than overflow** — Pass. `08-stale-distance-420.png`
   shows the drift line and Recheck pill wrapping onto their own lines at
   420px with no horizontal overflow.
4. **Transient "Measuring…" state renders** — Pass. `02a-measuring.png` and
   `03a-recheck-measuring.png` both caught it.
5. **Clicking Recheck actually triggers a re-measure** — Pass. Confirmed by
   the Measuring→resolved transition in `03a`/`03b`, and the resolved record's
   `from`/`to` now matching what's on screen (drift clears).
6. **Error cards show real copy, not an empty panel** — Pass. All three
   (`04`, `05`, `06`) render the exact strings from `LOOKUP_ERR`
   (widgets.jsx).

No real UI defects found in `AddressField`/`useAddressSuggest` during this
pass.

## Commands run

```
VITE_SUPABASE_URL="https://mzftplcyfotlzolqeapl.supabase.co" \
VITE_SUPABASE_ANON_KEY="sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO" \
npx vite --port 5199 &
sleep 4
PLAYWRIGHT_LIB=<scratchpad>/node_modules/playwright-core \
  node .scratch/120_address-lookup-distance/shot.mjs
# -> done, no [pageerror] lines (Google Fonts 404/connection-reset are the
#    expected, harmless no-network noise)
npx eslint .scratch/120_address-lookup-distance/preview.jsx
# -> "File ignored because no matching configuration was supplied" — the
#    repo's eslint.config.mjs only targets src/**/*.{js,jsx} and
#    netlify/functions/**/*.mjs; .scratch/ is out of its scope
npm test
# -> 1253/1253 pass
```

## Proof

Preview screenshots in this folder: `01-suggestions-open.png`,
`02-fresh-distance.png` (+ `02a-measuring.png`), `03-stale-distance.png`
(+ `03a-recheck-measuring.png`, `03b-recheck-resolved.png`),
`04-not-configured.png`, `05-over-quota.png`, `06-no-route.png`
(+ `06a-no-route-suggestions.png`), `07-suggestions-420.png`,
`08-stale-distance-420.png`.

---

## Task 11 fix round 1, Finding 3 — the probe button's preview proof

Task 11 added a "Test address lookup" button to Settings → General
(`src/SettingsWorkspace.jsx`), wiring `probeMaps()` (already built, never
called) to a control. It shipped with zero preview proof — Task 9's shots
above predate this control entirely. This section adds it.

### What's real, what's stubbed

`.scratch/120_address-lookup-distance/settingsprobe.jsx` mounts the **real
`SettingsWorkspace` component** (`initialSection="general"`) — not a
reproduction. The button, `runProbe`, and `probeText` are all the real
shipped code; only `window.fetch` for `/.netlify/functions/maps` is
stubbed, keyed off a `probeMode` switch (`ok` / `not-configured` /
`places-403` / `both-403` / `unauthorized`) driven by the `data-mode`
buttons pinned at the top of the page, returning exactly the status/body
shapes `netlify/functions/maps.mjs`'s real `probe` op returns for each
case. `SettingsWorkspace`'s other ~35 props are stubbed with real
production helpers where cheap and correct to do so, rather than ad hoc
literals: `settings` comes from the real `normalizeSettings()`/`withDerived()`
(`catalog.js`) so the catalog, waste, and pricing shapes are exactly what
production seeds; `types`/`typeLabels` are the real `TYPES`/`TLBL`
(`uiconst.js`); `ping` is the real `useToast()` hook. Everything else
touching Materials/Price book/Backup (books, bookStock, gFamilies, the
book-write callbacks) is a no-op or empty collection, since the General
section never reads them — confirmed by reading the component: nothing
above the section switch touches those props except default-safe
`.length`/`.reduce` calls over empty arrays for the sidebar's per-section
counts. This mounts cleanly with no `pageerror` (verified below), so this
is the "mount the real panel" case, not the "reproduce the block" fallback.

The session stub is the same as `preview.jsx` above (real Supabase env
vars, `supabase.auth.getSession` stubbed to a fake token) — see that
section's write-up; the same reasoning applies here since `probeMaps()`
(`usemapslookup.js`) calls the identical `call()` helper.

### Cards (`.scratch/120_address-lookup-distance/settingsprobe.jsx` / `shotprobe.mjs`)

One real Settings panel, driven through all five relay replies by clicking
the mode buttons then the real "Test address lookup" button:

| # | Case | Relay reply the fake fetch returns | Shot |
|---|---|---|---|
| — | transient | (any mode, caught mid-flight) | `11-01-not-configured-checking.png` |
| 1 | not configured | `503 {error:"not-configured"}` | `11-01-not-configured.png` |
| 2 | working | `200 {ok:true, places:200, routes:200}` | `11-02-working.png` |
| 3 | Places alone failing | `200 {ok:false, places:403, routes:200}` | `11-03-places-403.png` |
| 4 | both failing | `200 {ok:false, places:403, routes:403}` | `11-04-both-403.png` |
| 5 | other relay error | `401 {error:"unauthorized"}` | `11-05-unauthorized.png` |

### What I saw, opening every screenshot

- **`11-01-not-configured-checking.png`** — immediately after the click, the
  button itself reads "Checking…" in muted gray and is visibly disabled
  (dimmed) — the transient state renders, confirming the try/finally can't
  strand it there.
- **`11-01-not-configured.png`** — button back to "Test address lookup",
  amber text beside it: **"Address lookup needs a Google key — see
  Settings"** — `lookupErrText("not-configured")`'s real copy, byte-for-byte.
- **`11-02-working.png`** — brand-green (`var(--ft-brand)`) text: **"Working
  — Places and Routes both answered."**
- **`11-03-places-403.png`** — amber text: **"Key is set, but Places 403 did
  not answer 200 — the API may not be enabled, the key may be restricted
  from it, or the quota/billing may be exhausted."** — names Places
  specifically, not Routes; all three 403 causes named (Finding 1's fix).
- **`11-04-both-403.png`** — amber text: **"Key is set, but Places 403,
  Routes 403 did not answer 200 — the API may not be enabled, the key may
  be restricted from it, or the quota/billing may be exhausted."** — both
  APIs named when both fail.
- **`11-05-unauthorized.png`** — amber text: **"Sign in again to use address
  lookup"** — `lookupErrText`'s real copy for a code that isn't
  not-configured/over-quota/no-route, confirming the fourth reporting case
  (any other relay error) actually reaches the real function and renders.

No `[pageerror]` lines in any run — only the same expected Google Fonts
404/connection-reset noise as the Task 9 shots above.

### Commands run

```
VITE_SUPABASE_URL="https://mzftplcyfotlzolqeapl.supabase.co" \
VITE_SUPABASE_ANON_KEY="sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO" \
npx vite --port 5199 &
sleep 4
PLAYWRIGHT_LIB=<scratchpad>/node_modules/playwright-core \
  node .scratch/120_address-lookup-distance/shotprobe.mjs
# -> done, no [pageerror] lines
npx eslint .scratch/120_address-lookup-distance/settingsprobe.jsx .scratch/120_address-lookup-distance/shotprobe.mjs
# -> "File ignored because no matching configuration was supplied" (settingsprobe.jsx);
#    shotprobe.mjs produced no output — same as the rest of .scratch/
npx eslint src/SettingsWorkspace.jsx src/settingsprobe.test.js   # no output
npm run lint 2>&1 | tail -20   # same 7 pre-existing errors, none new
npm test   # 1259/1259 pass
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run build   # succeeds
```

### Proof

`11-01-not-configured-checking.png`, `11-01-not-configured.png`,
`11-02-working.png`, `11-03-places-403.png`, `11-04-both-403.png`,
`11-05-unauthorized.png` — plus the harness itself,
`settingsprobe.jsx`/`settingsprobe.html`/`shotprobe.mjs`.
