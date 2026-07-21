// Vendor price-sheet relay — Supabase Edge Function twin of
// netlify/functions/vendor-fetch.mjs (ADR 0019, long-window amendment).
// Exists because Dancik portals BUILD big sheets on demand — the largest
// observed took ~103s, longer than any Netlify sync-function window — while
// an Edge Function may wait several minutes on IO. The browser prefers this
// relay and falls back to the Netlify one until it is deployed.
//
// Self-contained on purpose so it can be pasted straight into the dashboard's
// function editor; keep VENDORS/RULES/classify in sync with src/vendorfetch.js.
//
// Deploy (owner, once): Dashboard → Edge Functions → Deploy new function →
// name it exactly "vendor-fetch" → paste this file → deploy. Leave
// "Enforce JWT verification" ON — the gateway then rejects callers who are
// not signed in to FloorTrack before this code runs. No secrets needed.

const VENDORS: Record<string, { hosts: string[]; path: string; rules: Record<string, RegExp> }> = {
  dancik: {
    hosts: ["connect24.virginiatile.com", "ovf400.ovf.com"],
    path: "/danciko/dancik-ows/d24/getPrettyPriceList/xls",
    rules: {
      uid: /^\d{1,10}$/,
      user: /^[A-Za-z0-9]{1,24}$/,
      sesid: /^[A-Za-z0-9]{1,64}$/,
      filename: /^[\w .\-&()]{1,120}$/,
    },
  },
  // Emser's per-account document URL carries no session token — the filename
  // (acct-period-doc.xlsx) is the whole identity (ADR 0019, Emser amendment).
  emser: {
    hosts: ["www.emser.com"],
    path: "/api/v1/custom/customerDocuments/",
    rules: {
      uid: /^\d{1,10}$/,
      user: /^\d{1,10}$/,
      sesid: /^$/,
      filename: /^\d{1,10}-[\w.\- ]{1,80}\.(xlsx?|csv|pdf)$/i,
    },
  },
};

// The app runs on a different origin (Netlify), so CORS headers are required
// on every response, including errors.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Real sheets are OLE .xls, zip .xlsx, or an HTML table export; an HTML body
// with login markers and no table is the portal's dead-session bounce.
function classifySheetBytes(b: Uint8Array): string {
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "sheet";
  if (b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b) return "sheet";
  let head = "";
  for (let i = 0; i < Math.min(b.length, 4096); i++) head += String.fromCharCode(b[i]);
  head = head.toLowerCase();
  if (head.includes("<table")) return "sheet";
  if (/(password|login|log in|sign in|session)/.test(head)) return "login";
  return "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let entry: Record<string, unknown>;
  try { entry = await req.json(); } catch { return json(400, { error: "bad request body" }); }
  const cfg = VENDORS[String(entry?.vendor)];
  if (!cfg) return json(400, { error: "unknown vendor" });
  if (!cfg.hosts.includes(String(entry.host))) return json(400, { error: "host not allowlisted" });
  for (const k of Object.keys(cfg.rules)) {
    if (!cfg.rules[k].test(String(entry[k] ?? ""))) return json(400, { error: `bad ${k}` });
  }

  const url = entry.vendor === "emser"
    ? `https://${entry.host}${cfg.path}${encodeURIComponent(String(entry.filename))}`
    : `https://${entry.host}${cfg.path}?${new URLSearchParams({
        d24_uid: String(entry.uid),
        d24_filename: String(entry.filename),
        d24_type: "X",
        d24user: String(entry.user),
        d24sesid: String(entry.sesid),
        filename: `${entry.filename}.xls`,
        "content-disposition": "inline",
      })}`;

  let res: Response;
  try {
    // Supabase gives a sync function 150s to answer, so wait just under that:
    // the observed worst-case portal build is ~103s, well inside this.
    res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(145000) });
  } catch (err) {
    const timedOut = (err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError";
    return json(timedOut ? 504 : 502, { error: timedOut ? "vendor-timeout" : "could not reach the vendor portal" });
  }
  // Dancik bounces a dead session as a redirect to its login page; Emser's
  // document API answers a hard 401 (its downloads require emser.com's login,
  // verified 2026-07-21). All classify as the sign-in bounce, mirroring
  // deadSessionStatus in src/vendorfetch.js.
  if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400)) return json(409, { error: "session-expired" });
  if (!res.ok) return json(502, { error: `vendor portal answered ${res.status}` });

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (classifySheetBytes(bytes) === "login") return json(409, { error: "session-expired" });

  return new Response(bytes, {
    status: 200,
    headers: {
      ...CORS,
      "content-type": res.headers.get("content-type") || "application/vnd.ms-excel",
      "cache-control": "no-store",
    },
  });
});
