// Vendor sheet fetch (ADR 0019). Pure helpers shared by the browser UI and the
// Netlify relay function (netlify/functions/vendor-fetch.mjs): recognize a
// distributor portal's price-list download links, validate/rebuild them
// server-side, and hand a bookmarklet's discovered links back to the app.
//
// Framework shape: one adapter per portal *platform* (not per distributor —
// Dancik is an ERP many flooring distributors run, so new Dancik-hosted
// vendors are just extra allowlisted hosts). The relay never accepts a raw
// URL: the browser sends structured params, the function rebuilds the URL
// from the adapter's fixed host + path template, so it can't be used as an
// open proxy.

export const VENDORS = {
  dancik: {
    label: "Dancik portal",
    // Allowlisted portal hosts. Adding a distributor that runs Dancik = one
    // more host here (plus its brand books in the app, which already exist).
    hosts: ["connect24.virginiatile.com", "ovf400.ovf.com"],
    hostLabels: { "connect24.virginiatile.com": "Virginia Tile connect24", "ovf400.ovf.com": "OVF (ovf400)" },
    path: "/danciko/dancik-ows/d24/getPrettyPriceList/xls",
    linkMark: "getPrettyPriceList",
  },
};

const DANCIK_RULES = {
  uid: /^\d{1,10}$/,
  user: /^[A-Za-z0-9]{1,24}$/,
  sesid: /^[A-Za-z0-9]{1,64}$/,
  filename: /^[\w .\-&()]{1,120}$/,
};

// A portal link (from the bookmarklet, a pasted URL, or the address bar) ->
// structured entry, or null when it isn't a recognized price-list link.
export function parseVendorLink(href) {
  let u;
  try { u = new URL(String(href || "")); } catch { return null; }
  if (u.protocol !== "https:") return null;
  for (const [vendor, cfg] of Object.entries(VENDORS)) {
    if (!cfg.hosts.includes(u.hostname)) continue;
    if (!u.pathname.includes(cfg.linkMark)) continue;
    const p = u.searchParams;
    return {
      vendor,
      host: u.hostname,
      uid: p.get("d24_uid") || "",
      filename: p.get("d24_filename") || p.get("filename") || "",
      user: p.get("d24user") || "",
      sesid: p.get("d24sesid") || "",
    };
  }
  return null;
}

// Why an entry can't be fetched, or null when it's valid. Used browser-side
// before calling the relay and server-side before building the URL.
export function entryProblems(entry) {
  const cfg = entry && VENDORS[entry.vendor];
  if (!cfg) return "unknown vendor";
  if (!cfg.hosts.includes(entry.host)) return "host not allowlisted";
  for (const [k, re] of Object.entries(DANCIK_RULES)) {
    const v = String(entry[k] ?? "");
    if (!re.test(v)) return `bad ${k}`;
  }
  return null;
}

// Server-side only: rebuild the portal download URL from a validated entry.
export function buildVendorUrl(entry) {
  const cfg = VENDORS[entry.vendor];
  const q = new URLSearchParams({
    d24_uid: entry.uid,
    d24_filename: entry.filename,
    d24_type: "X",
    d24user: entry.user,
    d24sesid: entry.sesid,
    filename: `${entry.filename}.xls`,
    "content-disposition": "inline",
  });
  return `https://${entry.host}${cfg.path}?${q}`;
}

export function entryFileName(entry) {
  const base = String(entry.filename || "price list").trim();
  return /\.xls$/i.test(base) ? base : `${base}.xls`;
}

export function entryKey(entry) {
  return `${entry.vendor}:${entry.host}:${entry.uid}:${entry.filename}`;
}

// ---- bookmarklet hand-off ------------------------------------------------
// The bookmarklet stays dumb: it harvests raw price-list URLs on the portal
// page (top document + same-origin frames) and opens the app with them
// base64'd in the URL *fragment* — fragments never reach a server or its
// logs, which matters because each link carries the portal session token. All
// parsing and validation happens app-side in decodeHandoff.
//
// Harvesting sweeps the serialized HTML, not just <a> tags: some portal pages
// offer the sheets through a dropdown, so the URLs live in <option> values or
// inline handler code instead of links. Entity-decode (&amp;) and resolve
// against the frame's base URL so relative URLs still parse.

const LINK_MARK_RE = /[^\s"'<>()]*getPrettyPriceList[^\s"'<>()]*/g;

export function harvestVendorLinks(html, base) {
  const out = new Set();
  for (const m of String(html || "").match(LINK_MARK_RE) || []) {
    try { out.add(new URL(m.replace(/&amp;/g, "&"), base).href); } catch {}
  }
  return [...out];
}

// ---- remembered sheets ---------------------------------------------------
// A fetched sheet's stable params (never the session token) are remembered in
// shared settings (settings.ops.vendorSheets) so next quarter ONE fresh link
// from the portal — its sesid — re-fetches every remembered sheet for that
// portal + dealer account. Menu-style portals (Dancik's #menu-option nav)
// never expose bulk links, so this is their only bulk path.

export function sheetRecord(entry) {
  const { vendor, host, uid, filename, user } = entry || {};
  return { vendor, host, uid, filename, user };
}

export function recordKey(r) {
  return `${r.vendor}:${r.host}:${r.uid}:${r.user}`;
}

// Replace same-sheet records (the new capture carries the current filename),
// keep the rest.
export function mergeRecords(prev, next) {
  const fresh = new Set((next || []).map(recordKey));
  return [...(prev || []).filter((r) => !fresh.has(recordKey(r))), ...(next || []).map(sheetRecord)];
}

export function applySesid(record, sesid) {
  return { ...sheetRecord(record), sesid };
}

// Merge a new hand-off into previously stashed entries: same-key sheets are
// replaced (the new ones carry the fresher session token), the rest kept.
// Menu-style portals build the download URL in their own code at click time,
// so sheets arrive one bookmark-click at a time — accumulating lets the user
// stack them up and fetch once.
export function mergeEntries(prev, next) {
  const fresh = new Set((next || []).map(entryKey));
  return [...(prev || []).filter((e) => !fresh.has(entryKey(e)) && !entryProblems(e)), ...(next || [])];
}

export function bookmarkletSource(origin) {
  const src = `(()=>{var L=new Set();var RE=new RegExp(${JSON.stringify(LINK_MARK_RE.source)},"g");var scan=function(d){try{d.querySelectorAll('a[href*="getPrettyPriceList"]').forEach(function(a){L.add(a.href)});var h=d.documentElement?d.documentElement.outerHTML:"";(h.match(RE)||[]).forEach(function(u){try{L.add(new URL(u.replace(/&amp;/g,"&"),d.baseURI).href)}catch(e){}});d.querySelectorAll("iframe,frame").forEach(function(f){try{if(f.contentDocument)scan(f.contentDocument)}catch(e){}})}catch(e){}};scan(document);if(location.href.indexOf("getPrettyPriceList")>-1)L.add(location.href);if(!L.size){alert("No price sheets found on this page. Open the page or menu that lists them and click the bookmark again — on menu-style portals, open one sheet first, then click the bookmark; repeat per sheet and they stack up in FloorTrack.");return}var w=window.open(${JSON.stringify(origin)}+"/#vfetch="+btoa(JSON.stringify({v:1,links:Array.from(L)})),"ftvfetch");if(w)w.focus()})()`;
  return `javascript:${src}`;
}

export function decodeHandoff(raw) {
  try {
    const payload = JSON.parse(atob(String(raw)));
    if (payload?.v !== 1 || !Array.isArray(payload.links)) return null;
    const seen = new Set();
    const entries = [];
    for (const href of payload.links) {
      const e = parseVendorLink(href);
      if (!e || entryProblems(e)) continue;
      const k = entryKey(e);
      if (seen.has(k)) continue;
      seen.add(k);
      entries.push(e);
    }
    return entries.length ? entries : null;
  } catch {
    return null;
  }
}

const HANDOFF_KEY = "ft-vendor-fetch-handoff";

// Browser-only. Moves a #vfetch= fragment into sessionStorage (so it survives
// sign-in and settings navigation) and strips it from the address bar — the
// links carry a live portal session token and shouldn't linger anywhere
// shareable. Returns the pending entries, from this call or an earlier one.
export function captureHandoff() {
  if (typeof window === "undefined") return null;
  const m = /[#&]vfetch=([^&]+)/.exec(window.location.hash || "");
  if (m) {
    const entries = decodeHandoff(decodeURIComponent(m[1]));
    if (entries) {
      try {
        const prev = JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY) || "[]");
        window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(mergeEntries(Array.isArray(prev) ? prev : [], entries)));
      } catch {}
    }
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
  }
  try {
    const stored = window.sessionStorage.getItem(HANDOFF_KEY);
    const entries = stored ? JSON.parse(stored) : null;
    return Array.isArray(entries) && entries.length ? entries.filter((e) => !entryProblems(e)) : null;
  } catch {
    return null;
  }
}

export function clearHandoff() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(HANDOFF_KEY); } catch {}
}

// ---- response sniffing ---------------------------------------------------
// The portal answers a dead session with its login page, not an error status.
// Real sheets are OLE .xls (d0 cf 11 e0), zip .xlsx (PK), or an HTML table
// export ("pretty" ERP lists) — SheetJS parses all three. Only an HTML body
// with login markers and no table is confidently a login bounce.

export function classifySheetBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "sheet";
  if (b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b) return "sheet";
  let head = "";
  for (let i = 0; i < Math.min(b.length, 4096); i++) head += String.fromCharCode(b[i]);
  head = head.toLowerCase();
  if (head.includes("<table")) return "sheet";
  if (/(password|login|log in|sign in|session)/.test(head)) return "login";
  return "unknown";
}
