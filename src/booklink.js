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

const numOr = (v, d = null) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function normBookFamily(f) {
  return {
    id: str(f?.id) || Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    name: str(f?.name),
    bookId: str(f?.bookId),
    rule: { prefix: str(f?.rule?.prefix), suffix: str(f?.rule?.suffix) },
    baseSkus: { default: str(f?.baseSkus?.default), variant: str(f?.baseSkus?.variant) },
    caulk: f?.caulk && (str(f.caulk.prefix) || str(f.caulk.suffix))
      ? { bookId: str(f.caulk.bookId) || str(f?.bookId), prefix: str(f.caulk.prefix), suffix: str(f.caulk.suffix) }
      : null,
    cache: (Array.isArray(f?.cache) ? f.cache : []).map((c) => ({
      color: str(c?.color), num: str(c?.num), sku: str(c?.sku), price: numOr(c?.price), unit: str(c?.unit),
    })),
  };
}

const liveRows = (items) => (items || []).filter((it) => it.active !== false && !it.disabled && !it.discontinued);

export function resolveFamily(fam, itemsByBook) {
  const baseSet = new Set([fam.baseSkus.default, fam.baseSkus.variant].filter(Boolean));
  const colors = [];
  for (const it of liveRows(itemsByBook?.[fam.bookId])) {
    if (baseSet.has(it.sku)) continue;
    const token = matchRule(fam.rule, it.description);
    if (!token) continue;
    const { num, name } = parseColorToken(token);
    if (!name && !num) continue;
    colors.push({ color: name || num, num, sku: it.sku, price: numOr(it.price), unit: str(it.unit) });
  }
  const caulkByColor = new Map();
  if (fam.caulk) {
    const byNum = new Map(), byName = new Map();
    for (const it of liveRows(itemsByBook?.[fam.caulk.bookId])) {
      const token = matchRule(fam.caulk, it.description);
      if (!token) continue;
      const { num, name } = parseColorToken(token);
      const entry = { sku: it.sku, price: numOr(it.price) };
      if (num && !byNum.has(num)) byNum.set(num, entry);
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), entry);
    }
    for (const c of colors) {
      const hit = (c.num && byNum.get(c.num)) || byName.get(c.color.toLowerCase());
      if (hit) caulkByColor.set(c.color.toLowerCase(), hit);
    }
  }
  const bases = liveRows(itemsByBook?.[fam.bookId]).filter((it) => baseSet.has(it.sku));
  // Zero matches after a re-drop (supplier rewrote every description) must not
  // blank a job's color dropdown — serve the cached colors, flagged, until the
  // rule is re-confirmed (spec §6).
  if (!colors.length && fam.cache.length) return { colors: fam.cache, caulkByColor, bases, usedCache: true };
  return { colors, caulkByColor, bases, usedCache: false };
}

// Families → stock-shaped items, so ADR 0006/0007 stock.js helpers (and every
// App/mobile call site built on them) work on [...stock, ...projected] without
// change. Caulk rows are emitted under the GROUT's color name — that is what
// groutCaulkItem matches on (same section, same color).
export function projectFamilies(bookFamilies, itemsByBook) {
  const out = [];
  for (const raw of bookFamilies || []) {
    const fam = normBookFamily(raw);
    if (!fam.name || !fam.bookId) continue;
    const { colors, caulkByColor, bases } = resolveFamily(fam, itemsByBook);
    const flags = { active: true, disabled: false, discontinued: false };
    for (const c of colors) {
      out.push({ ...flags, sku: c.sku, sheet: "Grout & Caulk", section: `bookfam:${fam.id}`, product: fam.name, color: c.color, price: c.price, unit: c.unit, description: "" });
      const ck = caulkByColor.get(c.color.toLowerCase());
      if (ck) out.push({ ...flags, sku: ck.sku, sheet: "Grout & Caulk", section: `bookfam:${fam.id}`, product: `${fam.name} Caulk`, color: c.color, price: ck.price, unit: "", description: "" });
    }
    for (const b of bases) out.push({ ...flags, sku: b.sku, sheet: "Grout & Caulk", section: "Bulk & Base Units", product: fam.name, color: "", price: numOr(b.price), unit: str(b.unit), description: str(b.description) });
  }
  return out;
}

export function familyWarnings(bookFamilies, itemsByBook) {
  const out = [];
  for (const raw of bookFamilies || []) {
    const fam = normBookFamily(raw);
    if (!fam.name || !fam.bookId) continue;
    const r = resolveFamily(fam, itemsByBook);
    if (r.usedCache || (!r.colors.length && !fam.cache.length)) out.push({ familyId: fam.id, name: fam.name, kind: "zero-match" });
    else if ((fam.baseSkus.default || fam.baseSkus.variant) && !r.bases.length) out.push({ familyId: fam.id, name: fam.name, kind: "base-missing" });
  }
  return out;
}
