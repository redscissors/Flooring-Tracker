// src/booklink.js
// Catalog ↔ ERP stock-book links (spec 2026-07-21). Pure and React-free, like
// catalog.js/stock.js, so node --test covers it. A grout FAMILY is stored as a
// matching RULE over one book's descriptions — never a row list — so a re-drop
// recomputes membership and new colors appear on their own.

const str = (v) => (v == null ? "" : String(v).trim());
const squish = (s) => str(s).replace(/\s+/g, " ");
const low = (s) => squish(s).toLowerCase();

export const normLink = (l) => {
  const bookId = str(l?.bookId), sku = str(l?.sku);
  return bookId && sku ? { bookId, sku } : null;
};

export const titleWords = (s) =>
  low(s).replace(/\b[a-z]/g, (c) => c.toUpperCase());

// The color token between a rule's prefix and suffix, sliced from the ORIGINAL
// text so display casing survives; null when the row isn't in the series (or
// is frame-only, e.g. a base row that shares the prefix but not the suffix).
export function matchRule(rule, description) {
  const d = squish(description), p = squish(rule?.prefix), s = squish(rule?.suffix);
  if (!p && !s) return null;
  const dl = d.toLowerCase(), pl = p.toLowerCase(), sl = s.toLowerCase();
  if (pl && !dl.startsWith(pl)) return null;
  if (sl && (!dl.endsWith(sl) || dl.length < pl.length + sl.length)) return null;
  const mid = d.slice(p.length, sl ? d.length - s.length : undefined).replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, "");
  return mid || null;
}

// "24 NATURAL GREY" → { num: "24", name: "Natural Grey" }. The number keys the
// caulk match (Laticrete 24↔24, TEC 910↔910); name is the fallback. Handles
// the exports' glued typos ("93FOSSIL", "52TOASTED ALMOND").
export function parseColorToken(token) {
  const t = squish(token);
  const m = t.match(/(?:^|[\s#])(\d{2,3})(?=[\s]|$|[A-Za-z])/);
  const num = m ? m[1] : "";
  const name = m ? squish(t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)) : t;
  return { num, name: name ? titleWords(name) : "" };
}

// Propose a series rule from one picked row: the longest token-prefix shared by
// ≥3 sibling descriptions, then the longest character-suffix common to those
// siblings — character-based so a messy row that glues punctuation
// ("…10.3 OZ- 100%…") still shares the frame. The seed row anchors both the
// slicing and the length cap, so sibling order never changes the result; the
// suffix is kept whole when any one sibling shows a clean token boundary
// before it (glued rows are typos — the clean rows define the frame). Under 3
// siblings the whole description becomes the prefix — the confirm UI is where
// messy families (DOIT's premixed grout) get hand-fixed.
export function deriveSeriesRule(description, descriptions) {
  const seed = squish(description);
  const toks = seed.split(" ");
  for (let n = toks.length - 1; n >= 1; n--) {
    const prefix = toks.slice(0, n).join(" ");
    const hits = (descriptions || []).filter((d) => low(d).startsWith(low(prefix)));
    if (hits.length < 3) continue;
    const rows = [seed, ...hits.map((d) => squish(d))];
    const maxLen = seed.length - prefix.length - 1;
    let suffix = "";
    for (let i = 1; i <= maxLen; i++) {
      const cand = seed.slice(seed.length - i);
      if (!rows.every((d) => d.toLowerCase().endsWith(cand.toLowerCase()))) break;
      suffix = cand;
    }
    if (/^\s/.test(suffix)) suffix = suffix.trim();
    else if (suffix && !rows.some((d) => d.length === suffix.length || d[d.length - suffix.length - 1] === " "))
      suffix = suffix.includes(" ") ? suffix.slice(suffix.indexOf(" ") + 1).trim() : "";
    return { prefix, suffix };
  }
  return { prefix: seed, suffix: "" };
}
