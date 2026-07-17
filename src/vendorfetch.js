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

// The remembered shape carries stable portal params plus two optional
// attributes that survive re-fetch: `bookId` links the sheet to the price book
// it feeds (set by "Create price book from this sheet"; drives the stale/amber
// flag), and `lastFetched` stamps the last successful download. Neither is part
// of recordKey — a sheet keeps its link and history across moves and re-pulls.
export function sheetRecord(entry) {
  const { vendor, host, uid, filename, user, bookId, lastFetched } = entry || {};
  const r = { vendor, host, uid, filename, user };
  if (typeof bookId === "string" && bookId) r.bookId = bookId;
  if (typeof lastFetched === "number" && lastFetched > 0) r.lastFetched = lastFetched;
  return r;
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

// ---- sign-in groups ------------------------------------------------------
// Remembered sheets are organized into named groups — one per portal sign-in
// (dealer account). A group's `portal` {host,user} is NOMINAL: it names the
// group and flags mismatched sheets, but never authorizes a fetch. A sheet is
// always fetched with a live session token matching its OWN {host,user}, so a
// sheet dragged into a mismatched group still refreshes off its own account's
// fresh link. Groups supersede the flat vendorSheets list (settings.ops.
// vendorGroups); pre-groups records migrate on first load and are never
// written back flat.

let _gid = 0;
function groupId() {
  _gid += 1;
  return `vg_${Date.now().toString(36)}${_gid.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function vendorForHost(host) {
  for (const [vendor, cfg] of Object.entries(VENDORS)) {
    if (cfg.hosts.includes(host)) return vendor;
  }
  return null;
}

// A group's display name from its portal: the distributor's own label for that
// host, suffixed with the dealer account so two accounts on one portal read
// apart.
export function groupName(portal) {
  if (!portal || !portal.host) return "Vendor sign-in";
  const cfg = VENDORS[vendorForHost(portal.host)];
  const base = (cfg && (cfg.hostLabels?.[portal.host] || cfg.label)) || portal.host;
  return portal.user ? `${base} · ${portal.user}` : base;
}

const normPortal = (p) =>
  p && typeof p.host === "string" && p.host && typeof p.user === "string" && p.user
    ? { host: p.host, user: p.user }
    : null;

export function newGroup(portal = null) {
  const p = normPortal(portal);
  return { id: groupId(), name: p ? groupName(p) : "New sign-in", loginUrl: "", portal: p, sheets: [] };
}

// A sheet belongs in a group whose portal matches its own account. A group
// with no portal (a hand-made bucket) accepts anything.
export function sheetMatchesGroup(sheet, group) {
  const p = group && group.portal;
  return !p || (sheet.host === p.host && sheet.user === p.user);
}

export function groupForSheet(sheet, groups) {
  const k = recordKey(sheet);
  return (groups || []).find((g) => (g.sheets || []).some((s) => recordKey(s) === k)) || null;
}

// Move one sheet from group `fromId` to `toId`, keyed by recordKey. Pure:
// returns the next groups array. Dedups into the target (a re-drop is a no-op),
// leaves every group's portal untouched — the sheet keeps its own account.
export function moveSheetInGroups(groups, sheet, fromId, toId) {
  if (fromId === toId) return groups;
  const k = recordKey(sheet);
  const from = (groups || []).find((g) => g.id === fromId);
  const moving = from && (from.sheets || []).find((s) => recordKey(s) === k);
  if (!moving) return groups;
  return groups.map((g) => {
    if (g.id === fromId) return { ...g, sheets: g.sheets.filter((s) => recordKey(s) !== k) };
    if (g.id === toId && !g.sheets.some((s) => recordKey(s) === k)) return { ...g, sheets: [...g.sheets, sheetRecord(moving)] };
    return g;
  });
}

// Link (or, with bookId null, unlink) a sheet to the price book it feeds,
// keyed by recordKey wherever the user filed it. Pure — returns next groups.
export function setSheetBook(groups, sheet, bookId) {
  const k = recordKey(sheet);
  return (groups || []).map((g) => ({
    ...g,
    sheets: (g.sheets || []).map((s) => {
      if (recordKey(s) !== k) return s;
      const { bookId: _drop, ...rest } = s;
      return bookId ? { ...rest, bookId } : rest;
    }),
  }));
}

// Fold a flat pre-groups vendorSheets array into one group per {host,user}
// dealer account, in first-seen order.
export function migrateVendorSheets(flat) {
  const groups = [];
  const byKey = new Map();
  for (const rec of flat || []) {
    const r = sheetRecord(rec);
    if (![r.vendor, r.host, r.uid, r.user].every((v) => typeof v === "string" && v)) continue;
    const key = `${r.host}|${r.user}`;
    let g = byKey.get(key);
    if (!g) {
      g = { id: groupId(), name: groupName({ host: r.host, user: r.user }), loginUrl: "", portal: { host: r.host, user: r.user }, sheets: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    if (!g.sheets.some((s) => recordKey(s) === recordKey(r))) g.sheets.push(r);
  }
  return groups;
}

const normGroup = (g) => {
  if (!g || typeof g !== "object") return null;
  const sheets = Array.isArray(g.sheets)
    ? g.sheets
        .filter((r) => r && [r.vendor, r.host, r.uid, r.user].every((v) => typeof v === "string" && v))
        .map(sheetRecord)
    : [];
  const portal = normPortal(g.portal);
  return {
    id: typeof g.id === "string" && g.id ? g.id : groupId(),
    name: typeof g.name === "string" && g.name ? g.name : groupName(portal),
    loginUrl: typeof g.loginUrl === "string" ? g.loginUrl : "",
    portal,
    sheets,
  };
};

// Record freshly-fetched sheets back into their groups: a sheet already known
// (by recordKey, wherever the user filed it) is refreshed in place (fresh
// filename wins); an unknown sheet joins the group matching its account, or a
// new group if none exists. Pure — returns the next groups array.
export function rememberIntoGroups(groups, recs) {
  const next = (groups || []).map((g) => ({ ...g, sheets: [...(g.sheets || [])] }));
  for (const raw of recs || []) {
    const rec = sheetRecord(raw);
    const k = recordKey(rec);
    let g = next.find((x) => x.sheets.some((s) => recordKey(s) === k));
    if (!g) g = next.find((x) => x.portal && x.portal.host === rec.host && x.portal.user === rec.user);
    if (!g) { g = newGroup({ host: rec.host, user: rec.user }); next.push(g); }
    const i = g.sheets.findIndex((s) => recordKey(s) === k);
    // Merge, don't replace: a re-fetch (rec = base fields + a fresh
    // lastFetched) must not drop the sheet's remembered bookId link.
    if (i >= 0) g.sheets[i] = { ...g.sheets[i], ...rec }; else g.sheets.push(rec); // in place → order preserved
  }
  return next;
}

// Normalize settings.ops for the groups store: take vendorGroups if present,
// else migrate a legacy flat vendorSheets array, else nothing. Caps the total
// remembered sheets defensively (shared jsonb).
export function normVendorGroups(raw) {
  let groups;
  if (Array.isArray(raw?.vendorGroups)) groups = raw.vendorGroups.map(normGroup).filter(Boolean);
  else if (Array.isArray(raw?.vendorSheets)) groups = migrateVendorSheets(raw.vendorSheets);
  else return [];
  let budget = 500;
  for (const g of groups) {
    if (g.sheets.length > budget) g.sheets = g.sheets.slice(0, Math.max(0, budget));
    budget -= g.sheets.length;
  }
  return groups;
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
