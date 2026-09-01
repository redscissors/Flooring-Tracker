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

  // Trimmed: a value pasted with stray whitespace is a missing key, not a key
  // that fails at Google with a confusing 400.
  const key = (process.env.GOOGLE_MAPS_KEY || "").trim();
  // The probe exists to answer "is the key reaching this function", so it must
  // report a missing key in its OWN terms below — handing it the same generic
  // not-configured as every other op leaves the one diagnostic tool unable to
  // diagnose the one thing it was built for.
  if (!key && body.op !== "probe") return json(503, { error: "not-configured" });

  try {
    if (body.op === "probe") {
      // Diagnostic for the owner after setting the env var: does each API
      // answer a trivial call? Never echoes the key or any address.
      if (!key) return json(200, { ok: false, keyPresent: false, keyLen: 0 });
      const p = await callGoogle(PLACES, PLACES_MASK, { input: "1600 Amphitheatre" }, key);
      const r = await callGoogle(ROUTES, ROUTES_MASK, { origin: { address: "Cleveland OH" }, destination: { address: "Akron OH" }, travelMode: "DRIVE" }, key);
      // keyLen is a character count, never any part of the value.
      return json(200, { ok: p.status === 200 && r.status === 200, keyPresent: true, keyLen: key.length, places: p.status, routes: r.status });
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
