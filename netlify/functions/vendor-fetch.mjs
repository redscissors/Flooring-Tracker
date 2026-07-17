// Vendor price-sheet relay (ADR 0019) — the app's first server-side piece.
// The browser can't fetch a distributor portal cross-origin, so it POSTs the
// structured link params here and this function fetches the sheet and relays
// the bytes back. It rebuilds the URL from the adapter's allowlisted host +
// fixed path (never a caller-supplied URL) and requires a signed-in
// FloorTrack user, so it can't serve as an open proxy. The portal session
// token passes through per-request and is never stored or logged.
import { createClient } from "@supabase/supabase-js";
import { entryProblems, buildVendorUrl, entryFileName, classifySheetBytes } from "../../src/vendorfetch.js";

// Fallbacks are the committed values from netlify.toml — public by design
// (they ship in the browser bundle); [build.environment] vars don't reach the
// functions runtime unless also set in the Netlify UI.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://mzftplcyfotlzolqeapl.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_oa96t2IYhNv_UE3nCx0LCw_s_amtTtO";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "sign in first" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) return json(401, { error: "sign in first" });

  let entry;
  try { entry = await req.json(); } catch { return json(400, { error: "bad request body" }); }
  const problem = entryProblems(entry);
  if (problem) return json(400, { error: problem });

  let res;
  try {
    // The portal builds big sheets on demand, so wait generously. 50s is a
    // deliberate over-ask: Netlify's sync-function window (plan/era dependent,
    // 10–60s) is the real ceiling and kills us first when shorter — the
    // browser sees that as a retriable 5xx, same as our own 504, and the
    // retry usually hits the portal's just-built cache.
    res = await fetch(buildVendorUrl(entry), { redirect: "manual", signal: AbortSignal.timeout(50000) });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    return json(timedOut ? 504 : 502, { error: timedOut ? "vendor-timeout" : "could not reach the vendor portal" });
  }
  // Dancik answers a dead session with a redirect or its login page, not an
  // error status — classify instead of trusting res.ok alone.
  if (res.status >= 300 && res.status < 400) return json(409, { error: "session-expired" });
  if (!res.ok) return json(502, { error: `vendor portal answered ${res.status}` });

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (classifySheetBytes(bytes) === "login") return json(409, { error: "session-expired" });

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": res.headers.get("content-type") || "application/vnd.ms-excel",
      "x-vendor-filename": encodeURIComponent(entryFileName(entry)),
      "cache-control": "no-store",
    },
  });
}

export const config = { path: "/api/vendor-fetch" };
