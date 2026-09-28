// How a part reads inside the wedi / Schluter popups (spec .scratch/160):
// the size first, tight and bold ("48×96×½″"), then the name without the
// brand words — the popup already says which brand it is. Display only: the
// rows that land on the job, the print and order entry keep the full vendor
// text. S-Dry stays in names (owner 2026-09-28): it names a wedi system.

const NUM = "(?:\\d+(?:\\.\\d+)?(?:[ -]\\d+\\/\\d+|[½¼¾⅛⅜⅝⅞])?|\\d+\\/\\d+|[½¼¾])";
const FT = "['′’]";
const IN = "[\"″”]";
const PART = `${NUM}\\s*${FT}(?:\\s*${NUM}\\s*${IN})?|${NUM}\\s*${IN}|${NUM}`;
const DIM = new RegExp(`(?<![\\w/.\\-])(?:${PART})(?:\\s*[x×X]\\s*(?:${PART}))*(?![\\d/])`, "g");
const PART_ONE = new RegExp(`^(?:(${NUM})\\s*${FT}(?:\\s*(${NUM})\\s*${IN})?|(${NUM})\\s*(${IN})?)$`);

const GLYPH = { 0.125: "⅛", 0.25: "¼", 0.375: "⅜", 0.5: "½", 0.625: "⅝", 0.75: "¾", 0.875: "⅞" };
const GLYPH_VAL = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };

function num(s) {
  const t = String(s).trim();
  const g = /^(\d*)([½¼¾⅛⅜⅝⅞])$/.exec(t);
  if (g) return (+g[1] || 0) + GLYPH_VAL[g[2]];
  const m = /^(\d+(?:\.\d+)?)(?:[ -](\d+)\/(\d+))?$/.exec(t);
  if (m) return +m[1] + (m[2] ? +m[2] / +m[3] : 0);
  const f = /^(\d+)\/(\d+)$/.exec(t);
  return f ? +f[1] / +f[2] : NaN;
}

function fmtIn(n) {
  const whole = Math.floor(n + 1e-9), rem = +(n - whole).toFixed(6);
  if (rem < 1e-6) return String(whole);
  const key = Object.keys(GLYPH).find((k) => Math.abs(+k - rem) < 1e-6);
  if (key) return (whole || "") + GLYPH[key];
  if (Number.isInteger(+(rem * 64).toFixed(6))) {
    let a = Math.round(rem * 64), b = 64;
    while (a % 2 === 0) { a /= 2; b /= 2; }
    return (whole ? whole + " " : "") + a + "/" + b;
  }
  return String(+n.toFixed(2));
}

// one measure → { total inches, feet?, marked? }, or null
function part(s) {
  const m = PART_ONE.exec(String(s).trim());
  if (!m) return null;
  if (m[1] != null) {
    const ft = num(m[1]), inch = m[2] != null ? num(m[2]) : 0;
    return { v: ft * 12 + inch, ft: true, marked: true };
  }
  return { v: num(m[3]), ft: false, marked: !!m[4] };
}

const partsOf = (s) => String(s).split(/\s*[x×X]\s*/).map(part);

function render(parts) {
  if (parts.some((p) => p.v > 96)) {
    return parts.map((p) => {
      if (!p.ft && p.v <= 96) return fmtIn(p.v) + "″";
      const f = Math.floor(p.v / 12 + 1e-9), r = p.v - f * 12;
      return f + "′" + (r > 1e-6 ? fmtIn(r) + "″" : "");
    }).join("×");
  }
  // a bare "24x48" on these sheets is inches too
  return parts.map((p) => fmtIn(p.v)).join("×") + "″";
}

/** '48" x 96" x 1/2"' → "48×96×½″"; a foot-led size up to 8′ reads in inches. */
export function tightSize(s) {
  const parts = partsOf(s);
  return parts.every(Boolean) ? render(parts) : String(s || "").trim();
}

// the first size in a name: a lone number only counts with a mark on it, and
// a length followed by "side" names a drain edge, not the part
function nameDim(name) {
  DIM.lastIndex = 0;
  let m;
  while ((m = DIM.exec(name))) {
    const parts = partsOf(m[0]);
    if (!parts.every(Boolean)) continue;
    if (parts.length === 1 && !parts[0].marked) continue;
    if (/^\s*side\b/i.test(name.slice(m.index + m[0].length))) continue;
    return { parts, at: m.index, len: m[0].length };
  }
  return null;
}

const UNIT = /^\s*(\d+(?:\.\d+)?)\s*(ct|oz|lbs?)\b/i;
const PER = /^\s*(\d+)\s+per\s+(?:pack|bag|box)\b/i;

function hintOf(hint) {
  const h = String(hint || "").trim();
  if (!h) return null;
  const [lead, tail] = h.split(/\s*=\s*/);
  const u = UNIT.exec(lead);
  if (u) return { unit: u[1] + " " + u[2].toLowerCase().replace(/^lbs$/, "lb") };
  const p = PER.exec(lead);
  if (p) return { unit: p[1] + " pc" };
  DIM.lastIndex = 0;
  const m = DIM.exec(lead);
  if (!m || m.index !== 0) return null;
  const parts = partsOf(m[0]);
  if (!parts.every(Boolean) || (parts.length === 1 && !parts[0].marked && !tail)) return null;
  if (/^\s*(?:oz|lbs?|ct|bags?)\b/i.test(lead.slice(m[0].length))) return null;
  return { parts, rest: tail ? tail.trim() : "", roll: /^\s*roll\b/i.test(lead.slice(m[0].length)) };
}

const BRAND = [
  [/\bwedi\b\s*®?/gi, ""],
  [/\bschluter\b\s*®?/gi, ""],
  [/[®™]/g, ""],
  // "Subliner Dry 323 ft2" is the membrane itself — only a part of the line loses it
  [/\bsubliner dry\s+(?=[a-z])/gi, ""],
  [/\bkerdi-shower-kit\b/gi, "Shower kit"],
  [/\bkerdi-shower-lts\s+tray\b/gi, "Linear drain shower tray"],
  [/\bkerdi-shower-tt\s+tray\b/gi, "Curbless shower tray"],
  [/\bkerdi-shower-ts?\s+tray\b/gi, "Shower tray"],
  [/\bkerdi-shower-r\b/gi, ""],
  [/\bkerdi-line(?:-vario)?\b/gi, "Linear drain"],
  [/\bkerdi-drain\b/gi, "Drain"],
  [/\bkerdi-board-s[nbc](?:-lt)?\b/gi, (m) => (/-sc$/i.test(m) ? "Board" : "")],
  [/\bkerdi-board\b/gi, "Board"],
  [/\bkerdi-(?:band|fix|seal-[a-z]+)\b/gi, ""],
  [/\bkerdi\b/gi, ""],
  [/\bkereck-f\b/gi, ""],
  [/\bkers-b\b/gi, ""],
];

/** A part's name without wedi / Schluter / KERDI words (S-Dry stays). */
export function cleanKitName(name) {
  let s = String(name || "");
  for (const [re, to] of BRAND) s = s.replace(re, to);
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s—–,·-]+|[\s—–,·-]+$/g, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * { size, name, fromHint, rest? } for one part. The name's own size leads;
 * `hint` (the catalog's size text) fills in when the name has none, or when
 * it holds the fuller size — a curb's profile, a board's sheet under the
 * name's thickness, a band's roll length beside the name's width. `fromHint`
 * tells the caller the size text is already on the line; `rest` is what the
 * size text carried past an "=" ("108 sf").
 */
export function kitLabel(name, hint) {
  const raw = String(name || "");
  const nd = nameDim(raw);
  const h = hintOf(hint);
  const out = (size, fromHint) => {
    const r = { size, name: cleanKitName(nd ? raw.slice(0, nd.at) + " " + raw.slice(nd.at + nd.len) : raw), fromHint };
    if (fromHint && h && h.rest) r.rest = h.rest;
    return r;
  };
  if (nd) {
    if (nd.parts.length === 1 && h && h.parts) {
      const v = nd.parts[0].v;
      if (h.parts.some((p) => Math.abs(p.v - v) < 1e-6)) return out(render(h.parts), true);
      if (v < 1 && h.parts.length >= 2) return out(render([...h.parts, nd.parts[0]]), true);
      if (h.roll && h.parts.length === 1) return out(render([nd.parts[0], h.parts[0]]), true);
    }
    return out(render(nd.parts), false);
  }
  if (h && h.parts) return out(render(h.parts), true);
  if (h && h.unit) return out(h.unit, true);
  return out("", false);
}
