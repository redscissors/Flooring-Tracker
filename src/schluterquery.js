// Schluter search-entry recognizer — the BOOT-CHUNK half of the Schluter
// shower-system configurator (task 6, wediquery.js's sibling). Word lists
// and a size regex, nothing else.
//
// The pinned "Vendor configurators" row in GridOmniSearch / MobileSearchSheet
// has to decide on every keystroke whether a query means Schluter, and where
// in the popup it lands. That decision needs ~20 trade words, not the
// registry-fed classify()/solver engine module — so it lives here and the
// engine module re-exports these four functions. This module must NEVER
// import the engine; the dependency only runs the other way.
//
// Word-list decisions (owner/task-brief, binding): Ditra is a floor product,
// not a shower part — it stays OUT of every list even though it's a Schluter
// brand name. "wedi" is a competing brand and stays OUT too, so a shopper
// typing either lands on the other vendor's configurator, not this one.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Words that name Schluter's shower system on their own — brand + SKU-family
// vocabulary. The generic ones below (WEAK) need "shower" beside them or a
// size, or every board/screw query would pin this configurator.
// "schluter" itself is deliberately absent here — it's caught by the prefix
// match in queryHit() below, same as wedi's own name is absent from
// wediquery's STRONG/WEAK — so a bare "schluter" (no other word) falls
// through parseQuery's kitWords/partWords checks to the "kits" default.
const STRONG = ["kerdi", "kerdi-board", "kerdi-line", "kerdi-drain",
  "kerdi-band", "kerdi-fix", "kerdi-shower", "kereck", "vario", "kst", "kslt",
  "kbsc", "all-set", "allset", "shower kit", "shower system"];
const WEAK = ["tray", "curb", "drain", "bench", "niche", "board", "membrane",
  "channel", "corner", "seal", "screw", "washer", "fastener", "ramp", "shower"];

const SIZE_RE = new RegExp(
  "(\\d+(?:\\.\\d+)?)\\s*(''|\"|in\\.?|'|ft\\.?)?\\s*(?:x|×|by)\\s*(\\d+(?:\\.\\d+)?)\\s*(''|\"|in\\.?|'|ft\\.?)?", "i");

export function parseQuery(q) {
  const s = " " + String(q || "").toLowerCase().replace(/[,]/g, " ") + " ";
  const out = { size: null, curbed: true, drain: "point", wallSys: "membrane", tab: "browse" };
  const m = s.match(SIZE_RE);
  if (m) {
    const a = +m[1], b = +m[3];
    let ft = /^(?:'|ft\.?)$/.test((m[2] || "").trim()) || /^(?:'|ft\.?)$/.test((m[4] || "").trim());
    if (!ft && !m[2] && !m[4] && a <= 12 && b <= 12) ft = true;
    out.size = { w: ft ? a * 12 : a, d: ft ? b * 12 : b };
  }
  if (/curbless|barrier[- ]free|zero[- ]entry/.test(s)) out.curbed = false;
  else if (/curbed|\bcurb\b/.test(s)) out.curbed = true;
  if (/linear|vario|channel/.test(s)) out.drain = "linear";
  else if (/offset/.test(s)) out.drain = "offset";
  if (/kerdi-?board|\bboard\b/.test(s)) out.wallSys = "board";
  const kitWords = /\bkits?\b|shower kit|\btrays?\b|kerdi-shower|shower system/.test(s);
  const partWords = STRONG.concat(WEAK).some((w) => s.indexOf(w) >= 0);
  // A bare "schluter" lands on the shelf-kit cards; naming a part goes to the catalog.
  out.tab = out.size ? "custom" : kitWords ? "kits" : partWords ? "browse" : "kits";
  return out;
}

export function queryHit(q) {
  const s = String(q || "").toLowerCase();
  const toks = s.split(/[^a-z0-9'"×.\/-]+/).filter(Boolean);
  if (toks.some((t) => t.length >= 3 && "schluter".indexOf(t) === 0)) return true;
  if (STRONG.some((w) => s.indexOf(w) >= 0)) return true;
  const weak = WEAK.filter((w) => s.indexOf(w) >= 0);
  if (!weak.length) return false;
  if (weak.indexOf("shower") >= 0 && weak.length > 1) return true;
  const p = parseQuery(q);
  return !!(p.size && p.size.w && p.size.d);
}

export function querySummary(p) {
  if (typeof p === "string") p = parseQuery(p);
  if (!p) return "";
  if (p.tab === "custom") {
    const bits = [round2(p.size.w) + "×" + round2(p.size.d) + '"', p.curbed === false ? "curbless" : "curbed"];
    if (p.drain !== "point") bits.push(p.drain + " drain");
    return "opens the room solver: " + bits.join(" · ");
  }
  if (p.tab === "kits") {
    return "opens the shelf-kit tab" + (p.curbed === false ? " · curbless" : "") + (p.drain !== "point" ? " · " + p.drain + " drain" : "");
  }
  return "opens the Schluter catalog — stock first, special order behind it";
}

export function seedFromQuery(q) {
  const p = parseQuery(q);
  return {
    tab: p.tab,
    input: {
      w: (p.size && p.size.w) || 36, d: (p.size && p.size.d) || 60,
      curbed: p.curbed, drain: p.drain, wallSys: p.wallSys,
    },
    search: p.tab === "browse" ? String(q || "").replace(/\b(schluter|sch|kerdi)\b/gi, "").trim() : "",
    parsed: p,
  };
}
