# ADR 0036 — Google Maps relay and distance snapshot

- **Status:** Accepted
- **Date:** 2026-09-01
- **Scope:** system-wide — `netlify/functions/maps.mjs` (the app's second
  server-side component, ADR 0019's sibling), plus `src/mapsrelay.js` (shared
  request-shape validation), `src/mapslookup.js` (pure response parsing and the
  staleness predicate), `src/usemapslookup.js` (the network hook), the
  `AddressField` suggestion dropdown and distance chip (`src/widgets.jsx`), the
  `shop` settings group (`src/catalog.js`), the `distance` field on Project and
  Person (`src/model.js`), and the Settings → General probe button
  (`src/SettingsWorkspace.jsx`, `src/probetext.js`). No schema change; both new
  fields live in existing jsonb columns.
- **Related:** ADR 0019 (vendor-fetch relay — the precedent this extends),
  ADR 0003 (snapshot doctrine), `catalog.js`'s `qtyDrift` (the same
  override-doesn't-clear-itself rule), `docs/superpowers/specs/
  2026-09-01-address-lookup-and-distance-design.md` (the design doc this
  formalizes)

## Context

The owner asked for two features on one plumbing: address suggestions as a
project or customer address is typed, and the driving distance from the shop
to the job. Both need a live call to a mapping provider — Google was picked
(Places Autocomplete (New) + Routes API) because it's the incumbent the
issue-119 Maps/paste buttons already link out to.

A Google API key must exist somewhere to make these calls, and it must never
reach the browser bundle — a public key is scraped and abused within hours of
being noticed. ADR 0019 already solved exactly this shape of problem for a
different secret (a distributor portal session), with a JWT-gated Netlify
Function relay. This ADR extends that precedent rather than inventing a new
one, and separately records that a fetched distance is not something to keep
fresh automatically.

## Decision

### 1. A JWT-gated Netlify Function relay holds the key; the browser never sees it

`netlify/functions/maps.mjs` requires `Authorization: Bearer <supabase jwt>`,
verified with `supabase.auth.getUser` exactly as `vendor-fetch.mjs` does. The
browser sends one of three small structured bodies (`{op:"suggest",input}`,
`{op:"distance",origin,destination}`, `{op:"probe"}`), validated by
`relayProblems` in `src/mapsrelay.js` — imported by the function so the same
rules are unit-testable without invoking it, the same split ADR 0019 uses
between `src/vendorfetch.js` and `vendor-fetch.mjs`. `GOOGLE_MAPS_KEY` lives
only in the function's environment (Netlify → Site configuration →
Environment variables, never `netlify.toml`, which is committed).

**Alternatives considered and rejected:**

- **A Supabase Edge Function twin**, the way vendor-fetch runs Netlify as
  fallback behind an Edge primary. Rejected because deploying an Edge function
  is a live-Supabase mutation, and this repo's non-negotiable #1 forbids an
  agent from performing one — the owner would have to deploy it by hand, and
  no agent could then verify it end to end. A Netlify function deploys with
  the same PR merge as everything else in this change. Same security
  properties as the browser is concerned, more friction for no benefit here
  (vendor-fetch's Edge twin exists for a *different* reason — a 100+ second
  portal build outlives Netlify's synchronous window; neither Google call
  approaches that).
- **A referrer-restricted browser key**, Google's own default pattern for a
  client-side Maps integration. Rejected because it ships the key in a public
  bundle and referrer checks are spoofable — the same reasoning `normOps`
  already encodes for vendor session tokens ("a session token must never
  persist in shared settings"). A key belongs in the same category. The
  accepted cost of the relay instead is roughly 200ms of extra latency per
  suggestion; if that ever grates in use, the browser-key option is a
  contained swap of the transport only, not a rearchitecture.

**Two Essentials-tier SKUs, deliberately, and nothing else.** Both Autocomplete
Requests and Compute Routes carry a 10,000-call free monthly allowance; the
relay is shaped to stay on them:

- **No Place Details call.** ~~Superseded by the 2026-09-01 amendment below.~~ The stored address is one free-text string
  (no city/state/zip breakout — a deliberate non-goal), so an autocomplete
  prediction's own text is the whole answer; there is nothing a Details call
  would add. This also means session tokens are unnecessary — session pricing
  exists to discount an Autocomplete→Details pair, and that second call is
  never made.
- **No Geocoding call.** Routes takes an address string directly as a waypoint
  (`{origin:{address},destination:{address}}`) and geocodes it internally.
  `netlify/functions/maps.mjs` sends exactly that shape.

Both upstream calls carry a field mask (`X-Goog-FieldMask`) — Routes rejects a
request with none, and for both calls the mask is what keeps the request on
the cheap SKU rather than a metered add-on.

**Required of the owner, and not enforceable from code:** a hard daily quota
cap on both APIs in Cloud Console. It's the only thing that turns a runaway
client-side loop (a bug, or a bot hammering the endpoint) into a broken
feature rather than a bill — the debounce/abort/single-in-flight discipline in
`usemapslookup.js` is the polite half, not the backstop.

**The relay forwards Google's response largely unparsed; the browser parses
it.** `distance` returns Google's Routes envelope verbatim (`routes`,
`distanceMeters`, `duration` fields untouched); `suggest` does only a
top-level unwrap (`{suggestions: data?.suggestions ?? []}`) and leaves each
prediction object's own shape (`placePrediction.text`) alone. Parsing happens
client-side in `src/mapslookup.js` (`parseDistance`, `parseSuggestions`),
because those parsers are unit-tested against committed fixture JSON and the
Netlify function has no test harness at all. Errors ARE translated at the
relay, though: Google's own status/message is never passed through (it can
echo the request back, addresses included) — the function maps upstream
failures to a small stable code set (`not-configured`, `unauthorized`,
`bad-request`, `over-quota`, `no-route`, `upstream`) that the UI has copy for.

### 2. A measured distance is a snapshot, not a cache

A record's `distance` field is `{miles, minutes, from, to, at} | null` — what
was measured, between which two addresses (`from` the shop address used, `to`
the record's address used), and when. Nothing auto-refreshes it. `distStale`
(`src/mapslookup.js`) compares the stored `from`/`to` against the record's
current address and the current shop address; when either has moved, the
`AddressField` distance chip (`src/widgets.jsx`) renders the drift wording —
*"Address changed since this was measured — 18.4 mi · 27 min from the shop"* —
with a one-click **Recheck** button, instead of silently showing a stale
number or silently fetching a new one.

This is the same doctrine as ADR 0003's snapshot rule and the `qtyDrift`
override contract in `catalog.js`: a stored value is a record of something
that happened, and a drift chip is how a disagreement between that record and
the present is surfaced — never resolved automatically.

**"Just refresh it when the project opens" is the tempting change that would
break this**, and it's worth stating why plainly, because a future reader is
the likeliest person to try it. It would:

1. Bill a Routes call on every project open, not once per addressed job — the
   cost model's whole "one call per commit, cached on the record" premise
   (roughly 10,000 free calls/month ≈ 10,000 job-address commits) collapses
   into one call per *view*, which is a different and much larger number.
2. Silently discard a measurement the team may have already quoted a trip
   charge or a schedule decision from, replacing it with a new number the
   salesperson never asked for and may not notice changed.

The stored endpoints (`from`/`to`) are what make staleness computable with no
extra state — the same reasoning ADR 0003 gives for snapshotting instead of
re-deriving. `distStale` is a read-only comparison; only `measure()` (an
explicit user action — committing an edited address, picking a suggestion, or
pressing Recheck) ever writes a new `distance`.

## Consequences

- The site now has two server-side dependencies instead of one, both
  JWT-gated Netlify Functions with no vendor-specific state. `netlify.toml`'s
  `[functions]` block, already present for vendor-fetch, covers this one too.
- The project is committed to a metered third-party API sitting in the
  quoting path. Removing `GOOGLE_MAPS_KEY` from Netlify's environment is the
  kill switch: the feature goes fully inert (no suggestions; the distance chip
  reads "Distance needs a Google key — see Settings") with no code change and
  no redeploy required.
- Typing is never blocked by any of this: `AddressField` is a plain text input
  first, and every network failure (offline, no key yet, over quota, no route
  found) renders a visible message rather than swallowing the error or
  freezing the field.
- **The two Google request shapes were written from documentation, not
  verified against a live call, because no API key can exist in an agent
  session** — this sandbox reaches `googleapis.com` (confirmed: an unkeyed
  call answers `PERMISSION_DENIED`, so the host isn't egress-blocked), but has
  no key to test with, and a key must never be pasted into a chat transcript
  regardless. The parsers in `mapslookup.js` are defensive specifically because
  of this: a shape guessed wrong must come back empty and be *reported*, never
  throw and never masquerade as "no results found."

  The `probe` operation closes that gap. `{op:"probe"}` makes one trivial call
  to each API (Places for `"1600 Amphitheatre"`, Routes for
  `Cleveland OH → Akron OH`) and returns `{ok, keyPresent, places, routes}` —
  status codes only, the key and the request bodies never echoed. The
  **"Test address lookup" button in Settings → General**, beside the shop
  address field, is the only control that calls it (`probeMaps()` in
  `usemapslookup.js`, wired in `SettingsWorkspace.jsx`). Until the owner sets
  `GOOGLE_MAPS_KEY` in Netlify and clicks that button, the correctness of both
  Google request shapes in this change is **unverified** — not merely
  untested in the usual sense, but never exercised against the real API by
  anyone who built it. An ADR that omitted this would misrepresent what was
  actually proven before merge; the preview harness and the 1259-test suite
  prove the surrounding plumbing (parsing, debounce, staleness, UI states),
  not that Google answers these two exact request bodies the way the docs say
  it will.


---

## Amendment, 2026-09-01: Place Details, for the postal code

**Status:** Accepted, same day, before merge.

The owner ran the probe on the deploy preview: both Google calls answered 200,
which is the first and only proof the request shapes above are right. The first
real address typed then showed what no fixture had — **Autocomplete predictions
carry no postal code.** Google omits postal codes and unit numbers from
prediction text by design and documents Place Details, keyed by the prediction's
`placeId`, as the way to a complete address. No amount of tuning the
Autocomplete request produces a ZIP.

The preview screenshots taken before merge showed ZIPs. They were invented
fixture data, written by someone who could not call the API. That is the exact
failure mode this ADR's last section warns about, arriving one day later.

**Decision:** reverse the "no Place Details call" consequence. Picking a
suggestion now resolves it through `op: "details"` and stores the returned
`formattedAddress`.

**What this costs.** A third Essentials-tier SKU, Place Details Essentials, with
its own 10,000-call monthly free allowance. It fires **once per address picked**,
never per keystroke, so the allowance is 10,000 picked addresses a month —
further from this shop's volume than the Autocomplete allowance already was.
Session tokens were added at the same time (a token is minted lazily on the first
suggest of a burst and retired by the details call that ends it), which is
Google's own pricing mechanism for exactly this pair.

**What did not change.** No Geocoding call — Routes still takes the address
string directly. The relay still returns raw envelopes and the browser still
parses them. The key still lives only in the function.

**The failure rule.** A picked suggestion fills the field with the prediction
text immediately, then upgrades it when Details answers. A details failure
leaves the prediction standing: a missing postal code is never worse than a pick
that does nothing. The distance is measured against the address as it finally
reads, so our own upgrade cannot trip the drift chip.
