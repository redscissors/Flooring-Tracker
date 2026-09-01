# Address typeahead and job-site distance — design

Owner request, 2026-09-01, following the Maps/paste buttons that shipped the
same day (issue 119, PR #352). Two features on one plumbing: suggestions as you
type an address, and the driving distance from the shop to the job.

## Decisions (owner, 2026-09-01)

| Question | Decision |
|---|---|
| Provider | Google — Places Autocomplete (New) + Routes API |
| Key location | Netlify Function relay; key in Netlify env vars only |
| Fixed origin | One shop address, team-wide, in shared Settings |
| Distance on the printed estimate | No — internal only |
| When distance is fetched | On address commit, cached on the record, drift chip when stale |
| Which fields | Typeahead **and** distance on all three: project address + both customer mailing addresses |

## Non-goals

- No structured address (city/state/zip as separate fields). `address` stays one
  free-text string; a picked suggestion fills that string and nothing else.
- No address *validation*. A hand-typed address is still whatever was typed.
- No distance on the printed estimate, and no trip-charge pricing derived from
  it. Internal reference only.
- No route optimization, multi-stop, or map rendering in the app.
- The Maps and paste buttons from issue 119 stay exactly as they are.

## Cost model

Google retired the $200 monthly credit in March 2025; it is now a free monthly
allowance per SKU — 10,000 calls for Essentials-tier SKUs, then $5.00/1,000 for
Compute Routes.

Both SKUs we use are Essentials:

- **Autocomplete Requests** — one call per debounced keystroke burst. Typing one
  address at a 350 ms debounce is ~3 calls. 10,000/month ≈ 3,000 addresses.
- **Compute Routes** — one call per *commit*, cached on the record. One call per
  job, not per screen view.

Two deliberate simplifications keep it to those two SKUs:

- **No Place Details call.** Because the stored address is one free-text string,
  the autocomplete prediction's own text is the whole answer. This also means no
  session tokens: session pricing exists to discount an Autocomplete→Details
  pair, and we never make the second call.
- **No Geocoding call.** Routes accepts a plain address string as a waypoint and
  geocodes it internally.

**Required of the owner:** a hard daily quota cap on both APIs in Cloud Console.
It is the only thing that turns a runaway client loop into a broken feature
rather than a bill.

**Stay on pay-as-you-go; do not buy a subscription.** Since 3 November 2025
Google's pricing page leads with flat-rate Subscriptions — Starter ~$100/mo,
Essentials ~$275/mo, Pro ~$1,200/mo — which look, at a glance, like the price of
entry. They are an optional alternative for high-volume users who want a
predictable bill. Pay-as-you-go still exists and still carries the per-SKU free
allowance above. Starter buys 50,000 calls for $100/mo against 10,000 free plus
$5/1,000 on PAYG, so a subscription only starts to pay at roughly 20,000
calls/month — an order of magnitude beyond this use. A billing account is still
required at $0 usage.

The authority on all of this is the owner's own Cloud Console billing page,
which shows real usage against the free threshold; the numbers here were checked
against Google's billing docs and independent 2026 breakdowns, but no agent
working on this repo can reach `developers.google.com` (egress-blocked) or hold
a key to measure with.

## Architecture

```
browser ──POST──> /.netlify/functions/maps ──> places.googleapis.com
   (Supabase JWT)      (GOOGLE_MAPS_KEY)   └──> routes.googleapis.com
```

One relay, both operations, modeled on `netlify/functions/vendor-fetch.mjs`
(ADR 0019): JWT-gated so it can never serve as an open proxy, secret only in the
function's environment, and the request the browser sends is a small structured
body the function validates — never a caller-supplied URL.

**Why not the Supabase Edge twin.** Vendor-fetch's primary path is a Supabase
Edge function with Netlify as fallback. Deploying an Edge function is a live-
Supabase mutation, which non-negotiable #1 forbids an agent from performing —
the owner would deploy it by hand and no agent could verify it end to end. A
Netlify function deploys with the merge. Same security properties.

**Why not a browser key.** A referrer-restricted browser key would cut ~200 ms
off each suggestion and is Google's own default pattern, but it ships the key in
a public bundle and referrer checks are spoofable. `normOps` already encodes the
house rule this follows: *a session token must never persist in shared settings.*
A key belongs in the same category.

### `netlify/functions/maps.mjs`

Method POST only. Requires `Authorization: Bearer <supabase jwt>`; verified with
`supabase.auth.getUser` exactly as vendor-fetch does. Body is one of:

```jsonc
{ "op": "suggest",  "input": "4905 harris" }
{ "op": "distance", "origin": "<shop address>", "destination": "<job address>" }
```

Validation lives in `src/mapsrelay.js` as a pure `relayProblems(body)`, imported
by the function — the same split vendor-fetch uses with `src/vendorfetch.js`, so
the rules are unit-testable without invoking a function.

**Upstream calls.**

- suggest → `POST https://places.googleapis.com/v1/places:autocomplete`
  with `{ input, regionCode: "US" }`, headers `X-Goog-Api-Key` and
  `X-Goog-FieldMask: suggestions.placePrediction.text`.
- distance → `POST https://routes.googleapis.com/directions/v2:computeRoutes`
  with `{ origin: { address }, destination: { address }, travelMode: "DRIVE" }`,
  field mask `routes.distanceMeters,routes.duration`.

The field masks are not optional politeness — Routes rejects a request without
one, and the mask is what keeps both calls on the cheap Essentials SKU.

**Responses.** `{ suggestions: string[] }` for suggest; for distance, Google's
Routes envelope forwarded largely verbatim (`routes`/`distanceMeters`/`duration`
untouched) — the browser parses it into `{ miles, minutes }` client-side
(`parseDistance`, `src/mapslookup.js`), so the parser stays unit-testable
against committed fixture JSON without a function to invoke. Errors are a
stable code the client renders, never a raw Google body:
`not-configured` (no key in env), `unauthorized`, `bad-request`, `over-quota`,
`no-route`, `upstream`.

**Never logged:** the key, and the addresses passed through. Addresses are
customer PII and the function is the one place they'd land in a third-party log.

**`op: "probe"`** returns `{ ok, keyPresent, places, routes }` — whether the env
var is set and whether each API answers a trivial call — without ever echoing
the key. This exists because no agent can test the live Google calls: this
sandbox reaches `googleapis.com` (verified — it answers `PERMISSION_DENIED` for
an unkeyed call, so the host is not egress-blocked) but has no key, and the key
must never be pasted into a chat transcript. The owner clicks one button in
Settings after setting the env var and reports what it says.

## Data model

### Shared settings: the shop address

`Settings` gains an optional `shop` group, following `normOps`'s exact shape —
returns `undefined` when empty so it serializes out of existing rows entirely
and no migration is needed:

```js
const normShop = (raw) => {
  const address = String(raw?.address || "").trim().slice(0, 200);
  return address ? { address } : undefined;
};
```

Threaded through `normalizeSettings` and `serializeSettings` beside `ops`.
Edited in **Settings → General**, above the waste percentages, as an
`AddressField` (it gets the same Maps/paste buttons and typeahead as any other).

Team-wide and singular by decision: a distance means the same thing no matter
who looked it up.

### Cached distance on a record

`newProject` + `normC` (projects) and `newPerson` (people) each gain:

```js
distance: { miles, minutes, from, to, at } | null
```

`from` is the shop address used, `to` the record address used, `at` the fetch
timestamp. Storing both endpoints is what makes staleness computable with no
extra state — the same reasoning behind ADR 0003 snapshots.

```js
distStale(rec, address, shopAddress)  // true when from/to no longer match
```

A stale record renders a drift chip in the shape the codebase already uses for
`QtyDriftChip` and the price-book drift chip: *"Address changed since this was
measured — Recheck"* with a one-click refetch. **Nothing clears or silently
refetches a stored distance** — a stored value is a record of a measurement,
and the drift chip is how a disagreement is surfaced, exactly as `qtyDrift`
handles a standing manual override.

**Write paths need no change.** Both serializers are rest-spreads that strip
known columns and pass everything else through — `personData` in `model.js:299`
and `custData` in `usedirectory.js:103` — so `distance` persists automatically
once it exists on the in-memory object. The sanctioned mutators (`updatePerson`,
`updateProject`) carry it with no edit. This is the whole reason the field goes
on the record rather than in a side table.

**One read path must be extended**, and missing it means the value silently
never loads:

- `PERSON_SELECT` in `bootload.js:41` — people are fully projected at boot from
  this explicit field list, with no later detail fetch. Add
  `distance:data->distance`, and extend `personRow` to read it.
- Projects need no change: `LIST_SELECT` is the light row for the browser, which
  does not show distance, and the open project's detail fetch carries the whole
  jsonb.

Both are `data->…` projections inside existing jsonb, so unlike `project_no`
there is no new column and no `supabase/*.sql` migration — nothing for the owner
to run, and no risk of the load failing on an install that hasn't migrated.

## Client modules

**`src/mapslookup.js`** — pure, unit-tested, no network:

| Function | Responsibility |
|---|---|
| `parseSuggestions(json)` | Google's autocomplete envelope → `string[]`; tolerant of a missing/renamed field, never throws |
| `parseDistance(json)` | `distanceMeters` + ISO-ish `"1234s"` duration → `{ miles, minutes }` |
| `formatDist(d)` | `"18.4 mi · 27 min"` |
| `distStale(rec, address, shop)` | staleness predicate above |
| `shouldSuggest(input)` | the debounce gate: min length, and skip an input unchanged since the last call |

Parsers are defensive by design. The request shapes here are written from
knowledge and **cannot be verified against live Google before the key exists**
(docs host `developers.google.com` is egress-blocked from this sandbox, and the
API needs a key). A wrong shape must therefore fail *visibly* — an explicit
error surfaced in the UI — never as a silently empty suggestion list.

**`src/usemapslookup.js`** — the network half: 350 ms debounce, `AbortController`
cancelling in-flight requests, one in-flight suggest at a time, errors surfaced
rather than swallowed. Not unit-tested (network hook); covered by the preview
harness against a stubbed relay.

## UI

**`AddressField` gains two things**, staying the same component used everywhere:

1. **A suggestion dropdown** — same anchored-panel shape and mouse/keyboard
   conventions as `BuilderCombo` (`onMouseDown` + `preventDefault` to beat blur,
   Escape via `escPush`, arrow keys, blur-to-close). Picking a suggestion sets
   the field to that text and commits.
2. **A distance chip** below the field — `"18.4 mi · 27 min from the shop"`,
   or the drift chip when stale, or nothing at all when no shop address is set.

**Empty and error states, all of which must be visible rather than silent:**

| State | What shows |
|---|---|
| No shop address in Settings | No chip; the Settings General field is where it's set. Never an error. |
| `not-configured` (no key yet) | Chip reads "Distance needs a Google key — see Settings" |
| `over-quota` | "Distance unavailable — daily limit reached" |
| `no-route` / unrecognized address | "Couldn't find a route to that address" |
| Offline / relay down | "Couldn't reach the lookup service" |
| Suggest fails | The dropdown shows the error row; typing is never blocked |

**Typing is never blocked by any of this.** The field is a plain text input that
works exactly as it does today if every network call fails.

## Testing and proof

- **TDD** on `src/mapslookup.js` and `src/mapsrelay.js` — tests first, watched
  failing, per the repo's `node --test` convention.
- Golden-sample parser tests built from recorded response JSON committed as
  fixtures, including a malformed and an empty response.
- **Preview harness** in `.scratch/120_address-lookup-distance/` — the real
  `AddressField` and the real Settings field against a stubbed relay, with
  Playwright screenshots of: suggestions open, a picked suggestion, the distance
  chip, the stale drift chip, and each error state. Required by non-negotiable
  #3 before merge.
- **Live smoke test is the owner's**, once the key is set: the Settings probe
  button, then one real address in a real project. No agent can do this.

## Owner setup

1. Cloud Console → enable **Places API (New)** and **Routes API**.
2. Create an API key; restrict it to those two APIs. No referrer restriction —
   calls come from the Netlify function, not a browser.
3. Set a **daily quota cap** on both APIs.
4. Netlify → Site configuration → Environment variables → `GOOGLE_MAPS_KEY`.
   Not `netlify.toml` — that file is committed to the repo.
   (Removing this variable later is the kill switch: the feature goes inert with
   a "needs a Google key" message, no code change and no app redeploy needed.)
5. Redeploy, then Settings → General → set the shop address and hit the probe.

Until step 4 is done the feature is inert and says so: no suggestions, and the
distance chip reads "needs a Google key". Nothing else in the app changes.

## Risks

| Risk | Mitigation |
|---|---|
| Request shapes unverifiable before the key exists | Defensive parsers, visible errors, and the probe op; owner smoke-tests first |
| A client bug loops the suggest call and bills | Debounce + abort + single in-flight, and the Cloud Console daily cap as the real backstop |
| Addresses (customer PII) reaching a third party | Inherent to the feature; the relay never logs them, and only signed-in users can call it |
| Relay latency makes typeahead feel sluggish | Accepted (~200 ms). If it grates in use, the browser-key option is a contained swap of the transport only |
| Autocomplete misses rural/new-construction lots | The issue-119 Maps and paste buttons remain as the fallback path, untouched |

## ADR

Two decisions here are hard to reverse and belong in `docs/adr/` once
implemented, following `docs/skills-reference/decide/SKILL.md`:

- **The Google relay and where the key lives** — extends ADR 0019's precedent to
  a second, differently-shaped server-side dependency, and commits the project
  to a metered third-party API in the quoting path.
- **A cached distance is a snapshot, not a cache** — it records what was measured
  and when, and only a drift chip reconciles it. This is the same doctrine as
  ADR 0003 snapshots and the `qtyDrift` override rule, and it is the decision a
  future reader is most likely to try to "fix" by auto-refreshing.
