# Address Typeahead and Job-Site Distance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address suggestions as you type, and the driving distance from a team-wide shop address to each job, both fed by one JWT-gated Netlify Function that holds the Google API key.

**Architecture:** A single relay function (`netlify/functions/maps.mjs`) forwards two operations to Google — Places Autocomplete and Routes — with the key living only in Netlify's environment. All parsing, validation, formatting and staleness logic lives in two pure browser modules that the function also imports, so the rules are unit-testable without invoking a function. The distance is stored on the project/person record as a snapshot of what was measured, reconciled by a drift chip rather than silently refreshed.

**Tech Stack:** React 18 (hooks, no router), Vite 5, Tailwind 3, lucide-react, Supabase (auth + Postgres jsonb), Netlify Functions, `node --test` for unit tests, Playwright for preview screenshots.

**Spec:** `docs/superpowers/specs/2026-09-01-address-lookup-and-distance-design.md`

## Global Constraints

- **Never mutate the live Supabase project.** This feature adds no SQL and no migration — if you think you need one, you have misread the plan.
- **Never push to `main`.** Everything lands through a PR off `claude/address-autocomplete-google-maps-noyfk4`.
- **No UI change merges without preview proof** (Task 9 produces it).
- Tests are `node --test src/*.test.js` via `npm test`. There is no React test renderer in this repo — component behaviour is proven by the preview harness, not unit tests.
- `npm run lint` has 1 pre-existing error (`src/App.jsx:167` `claimProjectNo` unused) plus 6 in `WediConfigurator.jsx` / `prototypes.jsx` / `wedi.test.js`. Introduce **zero new ones**.
- `npm run build` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set; use the committed values from `netlify.toml`.
- The key env var is `GOOGLE_MAPS_KEY`, set in the **Netlify UI only**. Never in `netlify.toml` (committed), never in a settings row, never logged.
- Addresses are customer PII: the relay must never log request bodies.
- Free-tier discipline: exactly two Google SKUs. **No Place Details call. No Geocoding call. No session tokens.**
- Distance units are US: miles to one decimal, minutes as a whole number.
- Max address/input length everywhere: **200 characters**.

---

### Task 1: `src/mapsrelay.js` — relay request validation

Pure validation shared by the browser (before calling) and the function (before forwarding), mirroring `entryProblems` in `src/vendorfetch.js:86`. Keeping it here means the relay's contract is tested by `npm test` without standing up a function.

**Files:**
- Create: `src/mapsrelay.js`
- Test: `src/mapsrelay.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `relayProblems(body) -> string | null`, `OPS: string[]`, `MAX_INPUT: number`, `MIN_INPUT: number`.

- [ ] **Step 1: Write the failing test**

```js
// src/mapsrelay.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { relayProblems, MAX_INPUT } from "./mapsrelay.js";

test("relayProblems rejects an unknown or missing op", () => {
  assert.equal(relayProblems({ op: "delete-everything" }), "unknown op");
  assert.equal(relayProblems({}), "unknown op");
  assert.equal(relayProblems(null), "unknown op");
});

test("relayProblems passes a probe with no other fields", () => {
  assert.equal(relayProblems({ op: "probe" }), null);
});

test("relayProblems needs enough typed input to be worth a suggest call", () => {
  assert.equal(relayProblems({ op: "suggest", input: "49" }), "input too short");
  assert.equal(relayProblems({ op: "suggest", input: "   " }), "input too short");
  assert.equal(relayProblems({ op: "suggest", input: "4905 Harris" }), null);
});

test("relayProblems caps input so a pasted page cannot be forwarded", () => {
  assert.equal(relayProblems({ op: "suggest", input: "x".repeat(MAX_INPUT + 1) }), "input too long");
});

test("relayProblems requires both ends of a distance request", () => {
  assert.equal(relayProblems({ op: "distance", destination: "b" }), "missing origin");
  assert.equal(relayProblems({ op: "distance", origin: "a" }), "missing destination");
  assert.equal(relayProblems({ op: "distance", origin: " ", destination: "b" }), "missing origin");
  assert.equal(relayProblems({ op: "distance", origin: "a", destination: "b" }), null);
});

test("relayProblems caps both distance addresses", () => {
  const long = "x".repeat(MAX_INPUT + 1);
  assert.equal(relayProblems({ op: "distance", origin: long, destination: "b" }), "address too long");
  assert.equal(relayProblems({ op: "distance", origin: "a", destination: long }), "address too long");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/mapsrelay.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND: Cannot find module '.../src/mapsrelay.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/mapsrelay.js
// The relay's request contract (netlify/functions/maps.mjs), kept pure and
// beside the browser code so both ends validate identically — the split
// vendorfetch.js/vendor-fetch.mjs uses (ADR 0019). The function never accepts a
// URL, only these three shapes, so it cannot be driven as an open proxy.

export const OPS = ["suggest", "distance", "probe"];
export const MIN_INPUT = 3;
export const MAX_INPUT = 200;

const clean = (v) => String(v ?? "").trim();

export function relayProblems(body) {
  const op = body && body.op;
  if (!OPS.includes(op)) return "unknown op";
  if (op === "probe") return null;
  if (op === "suggest") {
    if (clean(body.input).length < MIN_INPUT) return "input too short";
    if (String(body.input ?? "").length > MAX_INPUT) return "input too long";
    return null;
  }
  const origin = clean(body.origin), destination = clean(body.destination);
  if (!origin) return "missing origin";
  if (!destination) return "missing destination";
  if (origin.length > MAX_INPUT || destination.length > MAX_INPUT) return "address too long";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/mapsrelay.test.js`
Expected: PASS, 6/6

- [ ] **Step 5: Commit**

```bash
git add src/mapsrelay.js src/mapsrelay.test.js
git commit -m "Maps relay: the request contract, validated on both ends"
```

---

### Task 2: `src/mapslookup.js` — response parsers, formatting, staleness

Pure, defensive, no network. These parsers are the one place a wrong assumption about Google's response shape can hide, so they are written tolerantly and tested against both the documented shape and a malformed one. **A wrong shape must produce an empty result the UI reports, never a thrown error.**

**Files:**
- Create: `src/mapslookup.js`
- Test: `src/mapslookup.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseSuggestions(json) -> string[]`, `parseDistance(json) -> {miles, minutes}|null`, `formatDist(d) -> string`, `normDistance(d) -> {miles,minutes,from,to,at}|null`, `distStale(rec, address, shopAddress) -> boolean`, `shouldSuggest(input, last) -> boolean`, `MIN_SUGGEST: number`.

**Note on placement:** `normDistance` lives here rather than in `model.js` because `bootload.js` needs it too, and `bootload.js` carries an explicit warning (its line 4) about importing modules that read `import.meta.env` at evaluation. `mapslookup.js` is pure and imports nothing, so it is safe from both.

- [ ] **Step 1: Write the failing test**

```js
// src/mapslookup.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSuggestions, parseDistance, formatDist, normDistance, distStale, shouldSuggest } from "./mapslookup.js";

// Places Autocomplete (New) wraps the prediction text in a LocalizedText
// object; older/alternate shapes hand back a bare string. Accept both.
const AUTOCOMPLETE = {
  suggestions: [
    { placePrediction: { text: { text: "4905 Harris Rd, Broadview Heights, OH 44147, USA" } } },
    { placePrediction: { text: "5063 County Road 314, Millersburg, OH 44654, USA" } },
  ],
};

test("parseSuggestions reads both the LocalizedText and bare-string shapes", () => {
  assert.deepEqual(parseSuggestions(AUTOCOMPLETE), [
    "4905 Harris Rd, Broadview Heights, OH 44147, USA",
    "5063 County Road 314, Millersburg, OH 44654, USA",
  ]);
});

test("parseSuggestions returns an empty list rather than throwing on junk", () => {
  assert.deepEqual(parseSuggestions(null), []);
  assert.deepEqual(parseSuggestions({}), []);
  assert.deepEqual(parseSuggestions({ suggestions: "nope" }), []);
  assert.deepEqual(parseSuggestions({ suggestions: [{}, { placePrediction: {} }] }), []);
});

test("parseSuggestions drops duplicates and blanks", () => {
  const dup = { suggestions: [{ placePrediction: { text: { text: "A" } } }, { placePrediction: { text: { text: " A " } } }, { placePrediction: { text: { text: "  " } } }] };
  assert.deepEqual(parseSuggestions(dup), ["A"]);
});

test("parseDistance converts meters to miles and the duration string to minutes", () => {
  assert.deepEqual(parseDistance({ routes: [{ distanceMeters: 29610, duration: "1620s" }] }), { miles: 18.4, minutes: 27 });
});

test("parseDistance keeps miles when the duration is missing or unparseable", () => {
  assert.deepEqual(parseDistance({ routes: [{ distanceMeters: 1609 }] }), { miles: 1, minutes: null });
  assert.deepEqual(parseDistance({ routes: [{ distanceMeters: 1609, duration: "soon" }] }), { miles: 1, minutes: null });
});

test("parseDistance returns null when there is no usable route", () => {
  assert.equal(parseDistance(null), null);
  assert.equal(parseDistance({}), null);
  assert.equal(parseDistance({ routes: [] }), null);
  assert.equal(parseDistance({ routes: [{}] }), null);
  assert.equal(parseDistance({ routes: [{ distanceMeters: -5 }] }), null);
});

test("formatDist reads as a trip, and degrades to miles alone", () => {
  assert.equal(formatDist({ miles: 18.4, minutes: 27 }), "18.4 mi · 27 min");
  assert.equal(formatDist({ miles: 18.4, minutes: null }), "18.4 mi");
  assert.equal(formatDist(null), "");
});

test("normDistance keeps a whole record and rejects one with no miles", () => {
  const rec = { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 123 };
  assert.deepEqual(normDistance(rec), rec);
  assert.equal(normDistance(null), null);
  assert.equal(normDistance({ minutes: 27 }), null);
  assert.equal(normDistance("18.4"), null);
});

test("normDistance fills the ends it was saved without", () => {
  assert.deepEqual(normDistance({ miles: 3 }), { miles: 3, minutes: null, from: "", to: "", at: 0 });
});

test("distStale is false while both ends still match, ignoring case and padding", () => {
  const rec = { miles: 18.4, minutes: 27, from: "1 Shop St", to: "2 Job Rd", at: 1 };
  assert.equal(distStale(rec, "2 Job Rd", "1 Shop St"), false);
  assert.equal(distStale(rec, "  2 job rd ", "1 SHOP ST"), false);
});

test("distStale is true when either end moved", () => {
  const rec = { miles: 18.4, minutes: 27, from: "1 Shop St", to: "2 Job Rd", at: 1 };
  assert.equal(distStale(rec, "9 Other Rd", "1 Shop St"), true);
  assert.equal(distStale(rec, "2 Job Rd", "9 New Shop"), true);
});

test("distStale is false with nothing stored — there is no drift to report", () => {
  assert.equal(distStale(null, "2 Job Rd", "1 Shop St"), false);
});

test("shouldSuggest gates on length and on the input actually having changed", () => {
  assert.equal(shouldSuggest("490", ""), false);
  assert.equal(shouldSuggest("4905", ""), true);
  assert.equal(shouldSuggest("4905", "4905"), false);
  assert.equal(shouldSuggest(" 4905 ", "4905"), false);
  assert.equal(shouldSuggest("4905 H", "4905"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/mapslookup.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND: Cannot find module '.../src/mapslookup.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/mapslookup.js
// Reading Google's two answers, and deciding when a stored distance no longer
// describes the addresses it was measured between.
//
// The request/response shapes here were written from the API docs without a key
// to test against, so every parser is defensive on purpose: a shape we guessed
// wrong must come back empty and be REPORTED by the caller, never throw and
// never look like "no results".

export const MIN_SUGGEST = 4;
const METERS_PER_MILE = 1609.344;
const key = (s) => String(s || "").trim().toLowerCase();

// suggestions[].placePrediction.text is a LocalizedText ({ text }) in the
// current API; tolerate a bare string too.
export const parseSuggestions = (json) => {
  const list = Array.isArray(json?.suggestions) ? json.suggestions : [];
  const out = [];
  for (const s of list) {
    const t = s?.placePrediction?.text;
    const str = String((t && typeof t === "object" ? t.text : t) ?? "").trim();
    if (str && !out.some((o) => key(o) === key(str))) out.push(str);
  }
  return out;
};

// Routes answers duration as seconds with a trailing "s" ("1620s").
export const parseDistance = (json) => {
  const r = Array.isArray(json?.routes) ? json.routes[0] : null;
  const meters = Number(r?.distanceMeters);
  if (!Number.isFinite(meters) || meters < 0) return null;
  const secs = parseFloat(String(r?.duration ?? "").replace(/s$/, ""));
  return {
    miles: Math.round((meters / METERS_PER_MILE) * 10) / 10,
    minutes: Number.isFinite(secs) ? Math.round(secs / 60) : null,
  };
};

export const formatDist = (d) => {
  if (!d || !Number.isFinite(d.miles)) return "";
  return Number.isFinite(d.minutes) ? `${d.miles} mi · ${d.minutes} min` : `${d.miles} mi`;
};

export const normDistance = (d) => {
  if (!d || typeof d !== "object") return null;
  const miles = Number(d.miles);
  if (!Number.isFinite(miles)) return null;
  const minutes = Number(d.minutes);
  return { miles, minutes: Number.isFinite(minutes) ? minutes : null, from: String(d.from || ""), to: String(d.to || ""), at: Number(d.at) || 0 };
};

// A stored distance is a record of a measurement, not a cache: nothing clears
// or refetches it on its own. This only reports that the ends have moved, so
// the row can offer a recheck — the qtyDrift doctrine (catalog.js).
export const distStale = (rec, address, shopAddress) =>
  !!rec && Number.isFinite(rec.miles) && !(key(rec.to) === key(address) && key(rec.from) === key(shopAddress));

export const shouldSuggest = (input, last) => {
  const q = String(input || "").trim();
  return q.length >= MIN_SUGGEST && q !== String(last || "").trim();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/mapslookup.test.js`
Expected: PASS, 13/13

- [ ] **Step 5: Run the whole suite and commit**

```bash
npm test          # expect 1226 + 19 new = 1245 pass, 0 fail
git add src/mapslookup.js src/mapslookup.test.js
git commit -m "Maps lookup: parse Google's answers, and know when a stored distance is stale"
```

---

### Task 3: `netlify/functions/maps.mjs` — the relay

**Files:**
- Create: `netlify/functions/maps.mjs`

**Interfaces:**
- Consumes: `relayProblems`, `MAX_INPUT` from `src/mapsrelay.js` (Task 1).
- Produces: HTTP contract `POST /.netlify/functions/maps` — `{op:"suggest"|"distance"|"probe", ...}` in, `{suggestions}` / `{miles,minutes}` / `{ok,keyPresent,places,routes}` out, `{error:"<code>"}` on failure where code is one of `not-configured | unauthorized | bad-request | over-quota | no-route | upstream`.

- [ ] **Step 1: Write the function**

There is no unit test for this file — it is I/O against a live third party, exactly like `vendor-fetch.mjs`, whose logic is likewise tested through `src/vendorfetch.js`. Its validation is already proven by Task 1.

```js
// netlify/functions/maps.mjs
// Google Maps relay: address suggestions and job-site distance. The key lives
// only in this function's environment, so it never reaches the browser bundle
// or the repo, and a signed-in FloorTrack user is required — it can't serve as
// an open proxy. Modeled on vendor-fetch.mjs (ADR 0019).
//
// Two Google SKUs, both Essentials-tier (10k free calls/month each). We
// deliberately make NO Place Details call (the prediction text is the whole
// answer for a free-text address field, which also means no session tokens are
// needed) and NO Geocoding call (Routes takes an address string directly).
//
// Request bodies carry customer addresses — PII — so nothing here logs them.
import { createClient } from "@supabase/supabase-js";
import { relayProblems } from "../../src/mapsrelay.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://mzftplcyfotlzolqeapl.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO";

const PLACES = "https://places.googleapis.com/v1/places:autocomplete";
const ROUTES = "https://routes.googleapis.com/directions/v2:computeRoutes";
// Routes REJECTS a request without a field mask, and the mask is also what
// keeps both calls on the cheap Essentials SKU — never widen these casually.
const PLACES_MASK = "suggestions.placePrediction.text";
const ROUTES_MASK = "routes.distanceMeters,routes.duration";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const callGoogle = async (url, mask, body, key) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

// Google's own status, mapped to a code the UI has copy for. The upstream
// message is never relayed — it can echo the request back, addresses included.
const upstreamError = (status) => (status === 429 || status === 403 ? "over-quota" : "upstream");

export default async function handler(req) {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthorized" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !auth?.user) return json(401, { error: "unauthorized" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad-request" }); }
  if (relayProblems(body)) return json(400, { error: "bad-request" });

  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return json(503, { error: "not-configured" });

  try {
    if (body.op === "probe") {
      // Diagnostic for the owner after setting the env var: does each API
      // answer a trivial call? Never echoes the key or any address.
      const p = await callGoogle(PLACES, PLACES_MASK, { input: "1600 Amphitheatre" }, key);
      const r = await callGoogle(ROUTES, ROUTES_MASK, { origin: { address: "Cleveland OH" }, destination: { address: "Akron OH" }, travelMode: "DRIVE" }, key);
      return json(200, { ok: p.status === 200 && r.status === 200, keyPresent: true, places: p.status, routes: r.status });
    }

    if (body.op === "suggest") {
      const { status, data } = await callGoogle(PLACES, PLACES_MASK, { input: String(body.input).trim(), regionCode: "US" }, key);
      if (status !== 200) return json(502, { error: upstreamError(status) });
      return json(200, { suggestions: data?.suggestions ?? [] });
    }

    const { status, data } = await callGoogle(ROUTES, ROUTES_MASK, {
      origin: { address: String(body.origin).trim() },
      destination: { address: String(body.destination).trim() },
      travelMode: "DRIVE",
    }, key);
    if (status !== 200) return json(502, { error: upstreamError(status) });
    // Routes answers 200 with an empty routes list when it can't connect the
    // two addresses — a real outcome for a mistyped or brand-new lot, not an
    // error, and the UI says so differently.
    if (!Array.isArray(data?.routes) || !data.routes.length) return json(200, { error: "no-route" });
    return json(200, data);
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    return json(timedOut ? 504 : 502, { error: "upstream" });
  }
}
```

- [ ] **Step 2: Verify it lints and the import resolves**

Run: `npx eslint netlify/functions/maps.mjs && node -e "import('./src/mapsrelay.js').then(m=>console.log('relayProblems:', typeof m.relayProblems))"`
Expected: no lint output; `relayProblems: function`

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/maps.mjs
git commit -m "Maps relay function: JWT-gated, key server-side, two Essentials SKUs"
```

---

### Task 4: The shop address in shared Settings

**Files:**
- Modify: `src/catalog.js` (add `normShop`; thread through `normalizeSettings` ~line 788 and `serializeSettings` ~line 780)
- Modify: `src/SettingsWorkspace.jsx` (General section, after the waste row at ~line 866)
- Test: `src/catalog.test.js` (append)

**Interfaces:**
- Consumes: `AddressField` from `src/widgets.jsx` (already exists, shipped in issue 119).
- Produces: `settings.shop?.address` — a trimmed string or the whole `shop` key absent. Read by Tasks 6 and 8 as `settings.shop?.address || ""`.

- [ ] **Step 1: Write the failing test**

Append to `src/catalog.test.js`, and add `normShop` to that file's existing import list from `./catalog.js`:

```js
test("normShop keeps a trimmed address and vanishes when blank", () => {
  assert.deepEqual(normShop({ address: "  1 Shop St, Akron OH " }), { address: "1 Shop St, Akron OH" });
  assert.equal(normShop({ address: "   " }), undefined);
  assert.equal(normShop({}), undefined);
  assert.equal(normShop(null), undefined);
});

test("normShop caps a runaway address", () => {
  assert.equal(normShop({ address: "x".repeat(500) }).address.length, 200);
});

test("settings round-trip carries the shop address, and omits the key entirely without one", () => {
  const withShop = serializeSettings(normalizeSettings({ shop: { address: "1 Shop St" } }));
  assert.deepEqual(withShop.shop, { address: "1 Shop St" });
  assert.equal("shop" in serializeSettings(normalizeSettings({})), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/catalog.test.js`
Expected: FAIL — `normShop` is not an exported binding of `./catalog.js`

- [ ] **Step 3: Add the normalizer**

In `src/catalog.js`, immediately after `normOps` (which ends ~line 741):

```js
// The shop the team measures job distance from (spec 2026-09-01). One address,
// team-wide, so a stored distance means the same thing whoever looked it up.
// Optional like ops: absent settings rows serialize without the key, so there
// is nothing to migrate.
export const normShop = (raw) => {
  const address = String(raw?.address || "").trim().slice(0, 200);
  return address ? { address } : undefined;
};
```

Then thread it through both settings functions. In `serializeSettings`:

```js
export const serializeSettings = (s) => {
  const ops = normOps(s.ops);
  const shop = normShop(s.shop);
  return { waste: s.waste, catalog: s.catalog, pricing: normPricing(s.pricing), apps: serializeApps(s.apps), ...(ops ? { ops } : {}), ...(shop ? { shop } : {}) };
};
```

And in `normalizeSettings`, add `const shop = normShop(raw?.shop);` beside the existing `const ops = ...`, then extend the returned object:

```js
  return withDerived({ waste, catalog, pricing: normPricing(raw?.pricing), apps: normApps(raw?.apps), ...(ops ? { ops } : {}), ...(shop ? { shop } : {}) });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/catalog.test.js`
Expected: PASS, including the 3 new tests

- [ ] **Step 5: Add the Settings General field**

In `src/SettingsWorkspace.jsx`, in the `section === "general"` branch, insert a new block after the waste-percentages `<div className="mt-5 flex gap-6">…</div>` and before the Appearance block:

```jsx
            <div className="mt-8 pt-6 border-t border-slate-100">
              <label className={lbl + " mb-2"}>Shop address <HelpTip className="align-middle" w={300} tip="Where job distance is measured from. Team-wide — one address, so a distance means the same thing whoever looked it up. Leave blank to turn job distance off." /></label>
              <div className="max-w-xl">
                <AddressField value={settings.shop?.address || ""} onChange={(v) => setSettings({ shop: { address: v } })} inp={inp} placeholder="Shop address…" ping={ping} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Job distance is internal — it never prints on an estimate.</div>
            </div>
```

Add `AddressField` to the file's existing `./widgets.jsx` import. `ping` must be available in this component — check its props; if it is not passed, thread it down from `App.jsx` where `SettingsWorkspace` is rendered, alongside the existing `settings`/`setSettings` props.

- [ ] **Step 6: Verify it builds and lints clean**

```bash
npx eslint src/catalog.js src/SettingsWorkspace.jsx     # expect no output
VITE_SUPABASE_URL="https://mzftplcyfotlzolqeapl.supabase.co" VITE_SUPABASE_ANON_KEY="sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO" npm run build
```
Expected: lint silent, build ends `✓ built in …`

- [ ] **Step 7: Commit**

```bash
git add src/catalog.js src/catalog.test.js src/SettingsWorkspace.jsx
git commit -m "Settings: one team-wide shop address, the origin job distance measures from"
```

---

### Task 5: `distance` on the project and person records

**Files:**
- Modify: `src/model.js` (`newProject` ~line 88, `newPerson` ~line 91, `normC` ~line 168)
- Modify: `src/bootload.js` (`PERSON_SELECT` line 41, `personRow` line 42)
- Test: `src/model.test.js` (append), `src/bootload.test.js` (append)

**Interfaces:**
- Consumes: `normDistance` from `src/mapslookup.js` (Task 2).
- Produces: `project.distance` and `person.distance`, each `{miles, minutes, from, to, at} | null`. Written by Task 8 through the existing `updateProject` / `updatePerson` mutators.

**Why no write-path change:** both serializers are rest-spreads that strip known columns and pass everything else through — `personData` (`src/model.js:299`) and `custData` (`src/usedirectory.js:103`) — so `distance` persists the moment it exists on the in-memory object. **Do not add it to either.**

- [ ] **Step 1: Write the failing tests**

Append to `src/model.test.js` (add `normDistance`-free — it comes via the module under test; add `newPerson` to the import list if absent):

```js
test("a new project and a new person start with no measured distance", () => {
  assert.equal(newProject().distance, null);
  assert.equal(newPerson("Kathy").distance, null);
});

test("normC keeps a stored distance and drops a malformed one", () => {
  const rec = { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 5 };
  assert.deepEqual(normC({ distance: rec }).distance, rec);
  assert.equal(normC({ distance: { minutes: 27 } }).distance, null);
  assert.equal(normC({}).distance, null);
});
```

Append to `src/bootload.test.js`:

```js
test("PERSON_SELECT asks for the stored distance — without it the value silently never loads", () => {
  assert.match(PERSON_SELECT, /distance:data->distance/);
});

test("personRow normalizes the distance jsonb it gets back", () => {
  const row = { id: "p1", data: {}, distance: { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 5 } };
  assert.deepEqual(personRow(row).distance, { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 5 });
  assert.equal(personRow({ id: "p2" }).distance, null);
});
```

`PERSON_SELECT` and `personRow` are currently module-private in `bootload.js` — export both (they are already grouped under a comment calling them internal; change that comment to note the tests consume them).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/model.test.js src/bootload.test.js`
Expected: FAIL — `distance` is `undefined` rather than `null`; `PERSON_SELECT` is not exported

- [ ] **Step 3: Implement**

In `src/model.js`, add the import:

```js
import { normDistance } from "./mapslookup.js";
```

Add `distance: null` to the object literal `newProject` returns, and to `newPerson`'s. In `normC`, add to the returned object:

```js
  distance: normDistance(c.distance),
```

In `src/bootload.js`, add the import (`mapslookup.js` is pure and reads no `import.meta.env`, so it is safe for this module — see its line-4 warning), export both bindings, and extend them:

```js
export const PERSON_SELECT = "id, created_at, updated_at, builder_id, name:data->>name, phone:data->>phone, email:data->>email, address:data->>address, notes:data->>notes, distance:data->distance";
export const personRow = (r) => ({ id: r.id, builderId: r.builder_id ?? null, name: r.name || "", phone: r.phone || "", email: r.email || "", address: r.address || "", notes: r.notes || "", distance: normDistance(r.distance), createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(), updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now() });
```

`data->distance` (single arrow) returns the nested jsonb object, unlike the `->>` text projections beside it. Because it reads a key inside the existing `data` blob rather than a real column, it cannot fail on an un-migrated install the way `project_no` could — no downgrade retry is needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 0 fail — the new tests plus every existing one (`bootload.test.js` guards what this module may import; if it now fails, the import above is the cause).

- [ ] **Step 5: Commit**

```bash
git add src/model.js src/model.test.js src/bootload.js src/bootload.test.js
git commit -m "Records carry the distance measured to them, and load it back"
```

---

### Task 6: `src/usemapslookup.js` — the network half

**Files:**
- Create: `src/usemapslookup.js`

**Interfaces:**
- Consumes: `relayProblems` (Task 1); `parseSuggestions`, `parseDistance`, `shouldSuggest` (Task 2); `supabase` from `src/lib/` (match how `src/vendorpanel.jsx:52` obtains its session — read that file first and follow it exactly).
- Produces: `useAddressSuggest() -> { suggestions, err, loading, ask(input), clear() }` and `fetchDistance(origin, destination) -> { miles, minutes } | { error: string }`.

- [ ] **Step 1: Write the module**

No unit test: this is network I/O and timers, and the repo has no React test renderer. Everything decidable was pushed into Tasks 1–2, which are tested. Behaviour is proven by the preview harness in Task 9.

```js
// src/usemapslookup.js
// The network half of address lookup: talk to /.netlify/functions/maps, debounce
// what the user types, and abandon a request the moment it's superseded.
//
// Cost discipline lives here. Autocomplete bills per REQUEST, so every keystroke
// firing one would burn the month's free allowance in an afternoon: 350ms
// debounce, a 4-character floor, one in-flight request at a time, and no repeat
// call for an unchanged input (shouldSuggest). The real backstop is the daily
// quota cap the owner sets in Cloud Console — this is the polite half.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { relayProblems } from "./mapsrelay.js";
import { parseSuggestions, parseDistance, shouldSuggest } from "./mapslookup.js";

const ENDPOINT = "/.netlify/functions/maps";
const DEBOUNCE_MS = 350;

// Running `npm run dev` serves the app from Vite alone, where this path 404s —
// the feature is inert locally unless the site is served by `netlify dev`, and
// says so rather than looking broken.
const call = async (body, signal) => {
  const problem = relayProblems(body);
  if (problem) return { error: "bad-request" };
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "unauthorized" };
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return { error: "offline" };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) return { error: json?.error || "upstream" };
  return json?.error ? { error: json.error } : json;
};

export const fetchDistance = async (origin, destination) => {
  const out = await call({ op: "distance", origin, destination });
  if (out?.error) return out;
  const d = parseDistance(out);
  return d || { error: "no-route" };
};

export const probeMaps = () => call({ op: "probe" });

export function useAddressSuggest() {
  const [suggestions, setSuggestions] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const abort = useRef(null);
  const last = useRef("");

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    abort.current?.abort();
    last.current = "";
    setSuggestions([]); setErr(""); setLoading(false);
  }, []);

  useEffect(() => () => { clearTimeout(timer.current); abort.current?.abort(); }, []);

  const ask = useCallback((input) => {
    clearTimeout(timer.current);
    if (!shouldSuggest(input, last.current)) return;
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      last.current = String(input).trim();
      setLoading(true);
      try {
        const out = await call({ op: "suggest", input }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (out?.error) { setErr(out.error); setSuggestions([]); }
        else { setErr(""); setSuggestions(parseSuggestions(out)); }
      } catch (e) {
        if (e?.name !== "AbortError") { setErr("upstream"); setSuggestions([]); }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { suggestions, err, loading, ask, clear };
}
```

- [ ] **Step 2: Verify the supabase import path is right**

Run: `sed -n '1,20p' src/vendorpanel.jsx && ls src/lib/`
Expected: confirm the module path and the export name this repo uses for the Supabase client, and correct the import above to match it exactly before continuing.

- [ ] **Step 3: Lint and commit**

```bash
npx eslint src/usemapslookup.js     # expect no output
git add src/usemapslookup.js
git commit -m "Address lookup transport: debounced, abortable, one call in flight"
```

---

### Task 7: Suggestions in `AddressField`

**Files:**
- Modify: `src/widgets.jsx` (`AddressField`, at the end of the file)

**Interfaces:**
- Consumes: `useAddressSuggest` (Task 6).
- Produces: `AddressField` gains optional props `suggest` (boolean, default false) — no other call site changes shape.

Follow `BuilderCombo` (`src/widgets.jsx:127`) exactly for dropdown mechanics: `onMouseDown` with `preventDefault()` so the pick beats the input's blur, and a `setTimeout(…, 150)` blur close.

- [ ] **Step 1: Add error copy and the dropdown**

Add above `AddressField`:

```js
// Why a lookup failed, in words the salesperson can act on. An unmapped code
// must still say something — silence reads as "no results", which is the one
// thing this must never be mistaken for.
const LOOKUP_ERR = {
  "not-configured": "Address lookup needs a Google key — see Settings",
  "over-quota": "Address lookup unavailable — daily limit reached",
  "no-route": "Couldn't find a route to that address",
  unauthorized: "Sign in again to use address lookup",
  offline: "Couldn't reach the lookup service",
};
export const lookupErrText = (code) => LOOKUP_ERR[code] || (code ? "Address lookup is unavailable right now" : "");
```

Rewrite `AddressField` to take `suggest` and render the panel. Keep the existing input, Maps button and paste button exactly as they are:

```jsx
export function AddressField({ value, onChange, inp, placeholder, autoFocus, ping, suggest = false }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const { suggestions, err, ask, clear } = useAddressSuggest();

  const paste = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { ref.current?.focus(); ping?.(`Press ${PASTE_KEY} to paste`); return; }
    const clean = cleanAddress(text);
    if (clean) { onChange(clean); clear(); setOpen(false); } else ping?.("Nothing on the clipboard — copy the address from Maps first");
  };

  const type = (v) => {
    onChange(v);
    if (suggest) { ask(v); setOpen(true); }
  };
  const pick = (s) => { onChange(s); clear(); setOpen(false); };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input ref={ref} value={value || ""} autoFocus={autoFocus} placeholder={placeholder} className={inp}
          onChange={(e) => type(e.target.value)}
          onFocus={() => suggest && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        <button type="button" title="Look up on Google Maps" className={ADDR_BTN}
          onClick={() => window.open(mapsUrl(value), "_blank", "noopener,noreferrer")}><MapPin size={15} /></button>
        <button type="button" title="Paste the address you copied" className={ADDR_BTN} onClick={paste}><ClipboardPaste size={15} /></button>
      </div>
      {suggest && open && (suggestions.length > 0 || err) && (
        <div className="absolute left-0 right-16 top-full mt-1 z-30 rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {err
            ? <div className="px-3 py-2 text-[12.5px] text-amber-800 bg-amber-50">{lookupErrText(err)}</div>
            : suggestions.map((s) => (
              <div key={s} onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">{s}</div>
            ))}
        </div>
      )}
    </div>
  );
}
```

Add `useAddressSuggest` to the file's imports from `./usemapslookup.js`.

- [ ] **Step 2: Turn suggestions on at every address field**

Add the `suggest` prop at all four call sites — the three from issue 119 plus the Settings field from Task 4:
- `src/App.jsx:1488` (customer chip editor), `src/App.jsx:1610` (project sheet), `src/App.jsx:2965` (customer modal)
- `src/SettingsWorkspace.jsx` (shop address, Task 4)

Each becomes `<AddressField suggest … />` with its existing props untouched.

- [ ] **Step 3: Verify build and lint**

```bash
npx eslint src/widgets.jsx src/App.jsx src/SettingsWorkspace.jsx     # only the pre-existing App.jsx:167 error
npm test                                                            # still 0 fail
VITE_SUPABASE_URL="https://mzftplcyfotlzolqeapl.supabase.co" VITE_SUPABASE_ANON_KEY="sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO" npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets.jsx src/App.jsx src/SettingsWorkspace.jsx
git commit -m "Address fields suggest as you type"
```

---

### Task 8: The distance chip and its drift chip

**Files:**
- Modify: `src/widgets.jsx` (`AddressField`)
- Modify: `src/App.jsx` (the three address call sites, passing distance props)

**Interfaces:**
- Consumes: `fetchDistance` (Task 6); `formatDist`, `distStale` (Task 2); `settings.shop?.address` (Task 4); `record.distance` (Task 5).
- Produces: `AddressField` gains optional props `distance`, `shopAddress`, `onDistance(rec | null)`.

- [ ] **Step 1: Add the chip to `AddressField`**

Add these props to the signature: `distance = null, shopAddress = "", onDistance`. Add state and the fetch, then render below the input row:

```jsx
  const [busy, setBusy] = useState(false);
  const [distErr, setDistErr] = useState("");
  const stale = distStale(distance, value, shopAddress);
```

Measurement fires on **commit** — leaving the field, or picking a suggestion — never per keystroke. Replace Task 7's `onBlur` and extend `pick`:

```jsx
  const commit = () => { if (suggest) setTimeout(() => setOpen(false), 150); if (!distance || stale) measure(); };
  const pick = (s) => { onChange(s); clear(); setOpen(false); if (shopAddress) fetchFor(s); };
```

where `fetchFor(addr)` is `measure()` reading `addr` rather than `value` — the picked text has not reached `value` yet on this render. Extract one helper both call:

```jsx
  const measureAddr = async (addr) => {
    const to = String(addr || "").trim();
    if (!shopAddress || !to || busy) return;
    setBusy(true); setDistErr("");
    const out = await fetchDistance(shopAddress, to);
    setBusy(false);
    if (out?.error) { setDistErr(out.error); return; }
    onDistance?.({ ...out, from: shopAddress, to, at: Date.now() });
  };
  const measure = () => measureAddr(value);
```

and wire the input with `onBlur={commit}`. The `!distance || stale` guard is what stops a Routes call every time focus passes through an unchanged field.

Render after the input row, inside the outer `relative` div:

```jsx
      {shopAddress && (distance || distErr || busy) && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs mt-1">
          {busy && <span className="text-slate-400">Measuring…</span>}
          {!busy && distErr && <span className="text-amber-700">{lookupErrText(distErr)}</span>}
          {!busy && !distErr && distance && (stale ? (
            <>
              <span className="text-amber-600">Address changed since this was measured — {formatDist(distance)} from the shop</span>
              <button tabIndex={-1} onClick={measure} title="Measure the distance to the address as it reads now"
                className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Recheck</button>
            </>
          ) : (
            <span className="text-slate-400">{formatDist(distance)} from the shop</span>
          ))}
        </div>
      )}
```

Import `fetchDistance` from `./usemapslookup.js` and `formatDist`, `distStale` from `./mapslookup.js`.

The drift copy and the `Recheck` pill deliberately mirror `QtyDriftChip` (`src/App.jsx:113`): a stored measurement is never discarded on its own, the disagreement is stated, and taking the new value is one click.

- [ ] **Step 2: Wire the three record call sites**

At each of `src/App.jsx:1488`, `1610`, `2965`, add:

```jsx
  distance={selCust.distance} shopAddress={settings.shop?.address || ""}
  onDistance={(d) => updatePerson(selCust.id, { distance: d })}
```

using the matching record and mutator at each site — `updateProject(sel.id, …)` with `sel.distance` at line 1610, `updatePerson(c.id, …)` with `c.distance` at line 2965. **Do not** pass these to the Settings shop field: measuring the shop's distance to itself is meaningless.

- [ ] **Step 3: Verify**

```bash
npx eslint src/widgets.jsx src/App.jsx     # only the pre-existing App.jsx:167 error
npm test                                   # 0 fail
VITE_SUPABASE_URL="https://mzftplcyfotlzolqeapl.supabase.co" VITE_SUPABASE_ANON_KEY="sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO" npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets.jsx src/App.jsx
git commit -m "Job distance from the shop, measured on commit and drift-chipped when stale"
```

---

### Task 9: Preview harness and screenshots

Non-negotiable #3: no UI change merges without preview proof.

**Files:**
- Create: `.scratch/120_address-lookup-distance/preview.html`, `preview.jsx`, `shot.mjs`, `ticket.md`

- [ ] **Step 1: Build the harness**

Copy `.scratch/119_address-maps-paste/preview.html`, retitle it, and point its script tag at `/.scratch/120_address-lookup-distance/preview.jsx`.

In `preview.jsx`, stub the transport rather than the component — the real `AddressField`, the real hook, the real parsers, with only the network replaced. `useAddressSuggest` reads a Supabase session, so stub that too:

```jsx
// The relay, faked at the fetch boundary: everything above it — the hook, the
// debounce, the parsers, the chips — is the real code the app ships.
const ROUTE = { routes: [{ distanceMeters: 29610, duration: "1620s" }] };
const SUGGESTIONS = {
  suggestions: [
    { placePrediction: { text: { text: "4905 Harris Rd, Broadview Heights, OH 44147, USA" } } },
    { placePrediction: { text: { text: "4905 Harrison Ave, Cleveland, OH 44102, USA" } } },
    { placePrediction: { text: { text: "4905 Harvard Ave, Newburgh Heights, OH 44105, USA" } } },
  ],
};

let mode = "ok";           // "ok" | "not-configured" | "over-quota" | "no-route"
const reply = (body) => {
  if (mode !== "ok" && mode !== "no-route") return { error: mode };
  if (body.op === "suggest") return SUGGESTIONS;
  return mode === "no-route" ? { error: "no-route" } : ROUTE;
};

window.fetch = async (url, opts) => {
  if (!String(url).includes("/.netlify/functions/maps")) throw new Error("unexpected fetch: " + url);
  await new Promise((r) => setTimeout(r, 120));      // so "Measuring…" is shootable
  return { ok: true, json: async () => reply(JSON.parse(opts.body)) };
};
```

Stub the session by mocking the module the hook imports — add to `preview.jsx`'s Vite config-free setup a tiny shim, or (simpler, and what this harness should do) give `usemapslookup.js` no special casing and instead let the preview import a wrapper that supplies a fake token. If `supabase.auth.getSession()` resolves to nothing in the preview, the hook returns `{error:"unauthorized"}` and every card shows the sign-in copy — which is itself a state worth one screenshot, but not the six below. Resolve this when building the harness and note which approach was taken in `ticket.md`.

Cards to render, each a real `AddressField` over local state (`SHOP = "1 Shop St, Akron, OH"`):

| # | Card | How to reach it |
|---|---|---|
| 1 | Suggestions open | `mode = "ok"`, type `4905 Har` into the field |
| 2 | Fresh distance | pick suggestion 1, wait for the chip |
| 3 | Stale + Recheck | seed `distance={{miles:18.4,minutes:27,from:SHOP,to:"9 Old Rd",at:1}}` with `value` set to a different address |
| 4 | `not-configured` | `mode = "not-configured"` |
| 5 | `over-quota` | `mode = "over-quota"` |
| 6 | `no-route` | `mode = "no-route"` |

Give each mode a button with a `data-mode` attribute, as `.scratch/119_address-maps-paste/preview.jsx` does, so `shot.mjs` can drive it.

- [ ] **Step 2: Shoot it**

Adapt `.scratch/119_address-maps-paste/shot.mjs` (URL and OUT paths, one screenshot per state above). Then:

```bash
npx vite --port 5199 &
sleep 4
# playwright-core is not a repo dependency; install it in the scratchpad, never
# into package.json. The browser is pre-installed at /opt/pw-browsers/chromium.
(cd /tmp/claude-0/-home-user-Flooring-Tracker/ebf2a274-56e3-54bb-b111-7362445b9ba8/scratchpad && npm init -y >/dev/null && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright-core)
PLAYWRIGHT_LIB=/tmp/claude-0/-home-user-Flooring-Tracker/ebf2a274-56e3-54bb-b111-7362445b9ba8/scratchpad/node_modules/playwright-core node .scratch/120_address-lookup-distance/shot.mjs
```
Expected: `done`, with one `.png` per state and no `[pageerror]` lines.

- [ ] **Step 3: Read every screenshot before claiming anything works**

Open each PNG. Confirm the dropdown is not clipped by its container, the chips wrap rather than overflow, and each error card shows real copy rather than an empty panel.

- [ ] **Step 4: Write `ticket.md` and commit**

Follow `.scratch/119_address-maps-paste/ticket.md`'s front-matter exactly (`issue_type`, `summary`, `status: done`, `labels`).

```bash
git add .scratch/120_address-lookup-distance/
git commit -m "Preview proof: suggestions, distance chip, drift chip, and every error state"
```

---

### Task 10: ADR and owner setup documentation

**Files:**
- Create: `docs/adr/0036-google-maps-relay-and-distance-snapshot.md`
- Modify: `docs/adr/README.md` (index row)
- Modify: `CLAUDE.md` (source-layout block: add `maps.mjs` beside `vendor-fetch.mjs`)

- [ ] **Step 1: Write the ADR**

Match the format of `docs/adr/0019-vendor-sheet-fetch-relay.md`. Record both decisions, and the alternatives with why they lost:

- **The relay and the key's home.** Netlify Function over a Supabase Edge twin (deploying Edge is a live-Supabase mutation an agent may not perform) and over a referrer-restricted browser key (ships the key publicly; referrer checks are spoofable). Cost: ~200 ms per suggestion.
- **A stored distance is a snapshot, not a cache.** It records what was measured, between which two addresses, and when; a drift chip reconciles it and nothing auto-refreshes. Same doctrine as ADR 0003 snapshots and the `qtyDrift` override rule. Note explicitly that "just refresh it on open" is the tempting change that would break it — and would also bill a Routes call per project open.

Also record the two free-tier constraints as consequences: no Place Details call, no Geocoding call, and the daily quota cap the owner must set.

- [ ] **Step 2: Add the index row**

In `docs/adr/README.md`, following the existing table format:

```
| [0036](0036-google-maps-relay-and-distance-snapshot.md) | Google Maps relay: one JWT-gated Netlify Function holds the key; a measured distance is a snapshot with a drift chip | Accepted | 2026-09-01 |
```

- [ ] **Step 3: Note the function in CLAUDE.md**

In the source-layout block, under `netlify/functions/`, after the `vendor-fetch.mjs` entry:

```
    maps.mjs         # address suggestions + job distance relay (ADR 0036):
                     # JWT-gated, key in Netlify env only (GOOGLE_MAPS_KEY),
                     # two Essentials SKUs — no Place Details, no Geocoding
```

- [ ] **Step 4: Commit**

```bash
git add docs/adr/ CLAUDE.md
git commit -m "ADR 0036: the Maps relay, and why a measured distance is a snapshot"
```

---

## Handing it over

The feature is **inert until the owner does five things**, and says so in the UI rather than looking broken:

1. Cloud Console → enable **Places API (New)** and **Routes API**
2. Create an API key restricted to those two APIs (no referrer restriction — calls come from the function)
3. Set a **daily quota cap** on both
4. Netlify → Environment variables → `GOOGLE_MAPS_KEY` (**not** `netlify.toml`)
5. Redeploy, then Settings → General → set the shop address

**No agent can verify the live Google calls** — this sandbox reaches `googleapis.com` but has no key, and a key must never be pasted into a chat transcript. The `probe` op exists for exactly this: after step 4, the owner triggers it and reports `{ok, keyPresent, places, routes}`. Anything other than `ok: true` with both statuses `200` means the request shapes in Task 3 need correcting against the live API before the feature is trusted.

Say so plainly in the PR: unit tests and preview screenshots prove the parsing, the storage and the UI; they do **not** prove the two Google calls.
