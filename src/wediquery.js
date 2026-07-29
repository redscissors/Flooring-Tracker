// wedi search-entry recognizer — the BOOT-CHUNK half of the wedi configurator
// (issue 066). Word lists and a size regex, nothing else.
//
// The pinned "Vendor configurators" row in GridOmniSearch / MobileSearchSheet
// has to decide on every keystroke whether a query means wedi, and where in
// the popup it lands. That decision needs ~30 trade words, not the ~2 000-row
// catalog — so it lives here and `wedi.js` (tables + engine, a lazy chunk
// under ADR 0026) re-exports these four functions. This module must NEVER
// import wedi.js; the dependency only runs the other way.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Words that name wedi on their own; the generic ones below need a size or the
// word "shower" beside them, or every tile query would pin the configurator.
const STRONG = ["fundo", "curbless", "riolito", "subliner", "sanoasa", "discreto",
  "click and seal", "shower base", "shower pan", "shower kit", "niche", "vapor 85",
  "curbless pan", "linear drain", "shower system"];
const WEAK = ["pan", "curb", "sealant", "vapor", "base", "panel", "drain", "cover",
  "seat", "bench", "shelf", "ramp", "screw", "washer", "fastener", "membrane",
  "backer", "shower"];

const SIZE_RE = new RegExp(
  "(\\d+(?:\\.\\d+)?)\\s*(''|\"|in\\.?|'|ft\\.?)?\\s*(?:x|×|by)\\s*(\\d+(?:\\.\\d+)?)\\s*(''|\"|in\\.?|'|ft\\.?)?", "i");

export function parseQuery(q) {
  const s = " " + String(q || "").toLowerCase().replace(/[,]/g, " ") + " ";
  const out = { w: null, d: null, curb: null, drain: "any", tab: "browse" };
  const m = s.match(SIZE_RE);
  if (m) {
    const a = +m[1], b = +m[3];
    let ft = /^(?:'|ft\.?)$/.test((m[2] || "").trim()) || /^(?:'|ft\.?)$/.test((m[4] || "").trim());
    if (!ft && !m[2] && !m[4] && a <= 12 && b <= 12) ft = true;
    out.w = ft ? a * 12 : a;
    out.d = ft ? b * 12 : b;
  }
  if (/curbless|barrier[- ]free|zero[- ]entry|ligno/.test(s)) out.curb = "curbless";
  else if (/curbed|\bcurb\b/.test(s)) out.curb = "curbed";
  if (/linear|riolito|channel|trough/.test(s)) out.drain = "linear";
  else if (/offset/.test(s)) out.drain = "offset";
  else if (/cente?re?r?\b/.test(s)) out.drain = "center";
  const kitWords = /\bkits?\b|\bpans?\b|shower base|\bbase\b|fundo|curbless|linear|riolito|shower system/.test(s);
  const partWords = STRONG.concat(WEAK).some((w) => s.indexOf(w) >= 0);
  // A bare "wedi" lands on the kit cards; naming a part goes to the catalog.
  out.tab = out.w && out.d ? "custom" : kitWords ? "kits" : partWords ? "browse" : "kits";
  return out;
}

export function queryHit(q) {
  const s = String(q || "").toLowerCase();
  const toks = s.split(/[^a-z0-9'"×.\/]+/).filter(Boolean);
  if (toks.some((t) => t.length >= 3 && "wedi".indexOf(t) === 0)) return true;
  if (STRONG.some((w) => s.indexOf(w) >= 0)) return true;
  const weak = WEAK.filter((w) => s.indexOf(w) >= 0);
  if (!weak.length) return false;
  if (weak.indexOf("shower") >= 0 && weak.length > 1) return true;
  const p = parseQuery(q);
  return !!(p.w && p.d);
}

export function querySummary(p) {
  if (typeof p === "string") p = parseQuery(p);
  if (!p) return "";
  if (p.tab === "custom") {
    const bits = [round2(p.w) + "×" + round2(p.d) + '"', p.curb === "curbless" ? "curbless" : "curbed"];
    if (p.drain !== "any") bits.push(p.drain + " drain");
    return "opens the room solver: " + bits.join(" · ");
  }
  if (p.tab === "kits") {
    return "opens one-click stock kits" + (p.curb ? " · " + p.curb : "") + (p.drain !== "any" ? " · " + p.drain + " drain" : "");
  }
  return "opens the wedi catalog — stock first, special order behind it";
}

export function seedFromQuery(q) {
  const p = parseQuery(q);
  return {
    tab: p.tab,
    input: {
      w: p.w || 36, d: p.d || 60,
      curb: p.curb || "curbed", drain: p.drain || "any", tolerance: 0,
    },
    search: p.tab === "browse" ? String(q || "").replace(/\bwedi\b/gi, "").trim() : "",
    parsed: p,
  };
}
