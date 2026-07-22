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
    const sq = hits.map((d) => squish(d));
    const maxLen = seed.length - prefix.length - 1;
    // The suffix needs only a MAJORITY (≥3) of the prefix-siblings, not all of
    // them: a one-word prefix catches unrelated rows (OHIVA's "Custom …"
    // primers beside the CEG-Lite colorants, whose real frame is the suffix
    // "Part A - Ceg-Lite Colorant"), and demanding every sibling share the
    // tail erased it. Highest share wins; the longest such suffix breaks ties.
    let suffix = "", best = 0;
    for (let i = 1; i <= maxLen; i++) {
      const cand = seed.slice(seed.length - i).toLowerCase();
      const share = sq.reduce((k, d) => k + (d.toLowerCase().endsWith(cand) ? 1 : 0), 0);
      if (share >= 3 && share * 2 >= hits.length && share >= best) { best = share; suffix = seed.slice(seed.length - i); }
    }
    const sharers = suffix ? sq.filter((d) => d.toLowerCase().endsWith(suffix.toLowerCase())) : sq;
    if (/^\s/.test(suffix)) suffix = suffix.trim();
    else if (suffix && !sharers.some((d) => d.length === suffix.length || d[d.length - suffix.length - 1] === " "))
      suffix = suffix.includes(" ") ? suffix.slice(suffix.indexOf(" ") + 1).trim() : "";
    return { prefix, suffix };
  }
  return { prefix: seed, suffix: "" };
}

// "9LB SPECTRALOCK PRO" → "Spectralock Pro": the family name a rule's prefix
// suggests — leading size/unit tokens dropped, trailing separators trimmed.
const UNIT_TOKEN_RE = /^(lb|lbs|oz|gal|gals|kg|qt|pt|ml|l|ct|pk|pc|pcs|ea|box|bag|bags)\.?$/i;
export function proposeFamilyName(prefix) {
  const toks = squish(prefix).split(" ").filter(Boolean);
  const numish = (t) => /^[#\d.]/.test(t);
  let i = 0;
  while (i < toks.length && (numish(toks[i]) || (i > 0 && numish(toks[i - 1]) && UNIT_TOKEN_RE.test(toks[i])))) i++;
  const rest = toks.slice(i).join(" ").replace(/[\s\-–·:]+$/g, "");
  return titleWords(rest || squish(prefix));
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

// A row that reads like a two-part grout's base/kit unit, never a color —
// CEG-Lite's "PART A&B" kits share the color rows' frame, so rule matching
// alone can't keep them out of a color list. "Sanded" is deliberately absent:
// classic Permacolor's color bags say sanded and ARE colors.
export const looksLikeBase = (d) => /part a\s*&\s*b|grout base|full unit|commercial unit|\bbase\b/i.test(str(d));

// Candidate color collections for the family-seed picker: each query hit
// proposes the series it belongs to (deriveSeriesRule), deduped by frame so
// one entry stands for the whole collection ("Permacolor Select — 40 colors").
// The caller passes already-matched, capped hits — deriving a rule per hit
// scans the whole book, so the cap is the cost bound. A series under 2 colors
// is dropped; the picker's single-row list stays the escape hatch for messy
// families the derivation can't cluster.
export function suggestSeries(hits, itemsByBook) {
  const descCache = new Map();
  const seen = new Set();
  const out = [];
  for (const it of hits || []) {
    const bookId = str(it?.bookId), d = squish(it?.description);
    // A base row never seeds a color series — its frame is the kit wording,
    // not the color family's (it stays pickable as a single row).
    if (!bookId || !d || looksLikeBase(d)) continue;
    if (!descCache.has(bookId)) descCache.set(bookId, (itemsByBook?.[bookId] || []).map((x) => x.description));
    const rule = deriveSeriesRule(d, descCache.get(bookId));
    const key = [bookId, low(rule.prefix), low(rule.suffix)].join("\n");
    if (seen.has(key)) continue;
    seen.add(key);
    const colors = [], skus = [], numSkus = [];
    for (const row of liveRows(itemsByBook?.[bookId])) {
      if (looksLikeBase(row.description)) continue;
      const token = matchRule(rule, row.description);
      if (!token) continue;
      const { num, name } = parseColorToken(token);
      if (!name && !num) continue;
      colors.push(name || num);
      skus.push(row.sku);
      if (num) numSkus.push(row.sku);
    }
    if (colors.length < 2) continue;
    // A one-word prefix alone makes a blank name ("Custom") — fold the
    // suffix's identity words in, minus the part-letter noise.
    const pName = proposeFamilyName(rule.prefix);
    const tail = rule.suffix.replace(/\bpart [a-c]\b/gi, " ").replace(/^[\s\-–·:]+/, "").trim();
    const name = pName.includes(" ") || !tail ? pName : proposeFamilyName(squish(`${rule.prefix} ${tail}`));
    out.push({ bookId, rule, name, count: colors.length, sample: colors.slice(0, 4), seedDescription: d, skus, numSkus });
  }
  // A frame-only sibling (a base row) seeds a LOOSE rule that swallows a more
  // specific series plus itself ("PERMACOLOR SELECT" ⊃ "PERMACOLOR SELECT
  // COLOR KIT" + the base). Keep the specific frame, drop its loose superset —
  // but ONLY when the specific frame still covers every numbered color, so a
  // tight sub-series (CEG-Lite's PART A&B kits before the base filter above)
  // can never kill the real color family it sits inside.
  const frameLen = (x) => x.rule.prefix.length + x.rule.suffix.length;
  const kept = out.filter((a) => {
    const set = new Set(a.skus);
    return !out.some((b) => {
      if (b === a || b.bookId !== a.bookId || frameLen(b) <= frameLen(a)) return false;
      const bset = new Set(b.skus);
      return b.skus.every((s) => set.has(s)) && a.numSkus.every((s) => bset.has(s));
    });
  });
  return kept.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function resolveFamily(fam, itemsByBook) {
  const baseSet = new Set([fam.baseSkus.default, fam.baseSkus.variant].filter(Boolean));
  const colors = [];
  for (const it of liveRows(itemsByBook?.[fam.bookId])) {
    // looksLikeBase mirrors suggestSeries: CEG-Lite's PART A&B kits match the
    // color rows' frame, and only two baseSkus slots exist to exclude them by.
    if (baseSet.has(it.sku) || looksLikeBase(it.description)) continue;
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

export function linkedItemState(link, itemsByBook) {
  const l = normLink(link);
  if (!l) return null;
  const it = (itemsByBook?.[l.bookId] || []).find((x) => x.sku === l.sku);
  return !it ? "missing" : it.active === false ? "inactive" : "ok";
}

export function syncLinkedCatalog(catalog, bookId, items) {
  const live = new Map(liveRows(items).map((it) => [it.sku, it]));
  const all = new Map((items || []).map((it) => [it.sku, it]));
  const changes = [], lost = [];
  let dirty = false;
  const syncKind = (list) => (list || []).map((p) => {
    let next = p;
    const l = normLink(p.link);
    if (l && l.bookId === bookId) {
      const it = live.get(l.sku);
      if (!it) { lost.push({ name: p.name, sku: l.sku }); return p; }
      const to = numOr(it.price, numOr(parseFloat(p.price), 0));
      const from = parseFloat(p.price) || 0;
      const unit = str(it.unit) || p.unit;
      if (Math.abs(from - to) > 0.005 || unit !== p.unit || str(p.sku) !== it.sku) {
        if (Math.abs(from - to) > 0.005) changes.push({ name: p.name, from, to, sku: it.sku });
        next = { ...next, price: to, unit, sku: it.sku };
      }
    }
    // A grout base companion linked into this book rides the same refresh.
    if (next.base && str(next.base.sku) && all.has(str(next.base.sku))) {
      const b = live.get(str(next.base.sku));
      if (b && Math.abs((parseFloat(next.base.price) || 0) - numOr(b.price, 0)) > 0.005) {
        changes.push({ name: `${next.name} — base`, from: parseFloat(next.base.price) || 0, to: numOr(b.price, 0), sku: b.sku });
        next = { ...next, base: { ...next.base, price: numOr(b.price, 0) } };
      }
    }
    if (next !== p) dirty = true;
    return next;
  });
  const companies = (catalog?.companies || []).map((co) => ({
    ...co,
    grouts: syncKind(co.grouts), mortars: syncKind(co.mortars),
    underlayments: syncKind(co.underlayments), attached: syncKind(co.attached),
  }));
  const newColors = [];
  const bookFamilies = (catalog?.bookFamilies || []).map((raw) => {
    const fam = normBookFamily(raw);
    if (fam.bookId !== bookId) return raw;
    const { colors, usedCache } = resolveFamily(fam, { [bookId]: items });
    if (usedCache || !colors.length) return raw;
    const had = new Set(fam.cache.map((c) => c.sku));
    const fresh = colors.filter((c) => !had.has(c.sku)).length;
    if (fresh && fam.cache.length) newColors.push({ family: fam.name, count: fresh });
    dirty = true;
    return { ...fam, cache: colors };
  });
  return { catalog: { ...catalog, companies, bookFamilies }, changes, lost, newColors, dirty };
}

export function proposeLinks(catalog, itemsByBook, books) {
  const stockBooks = (books || []).filter((b) => b.kind === "stock" && b.active !== false);
  const proposals = [], unmatched = [];
  for (const co of (catalog?.companies || [])) {
    for (const kind of ["grouts", "mortars", "underlayments", "attached"]) {
      for (const p of (co[kind] || [])) {
        const sku = str(p.sku);
        if (!sku || normLink(p.link)) continue;
        const hits = stockBooks.filter((b) => liveRows(itemsByBook?.[b.id]).some((it) => it.sku === sku));
        if (hits.length === 1) proposals.push({ companyId: co.id, companyName: co.name, kind, productId: p.id, name: p.name, sku, bookId: hits[0].id, bookName: hits[0].name });
        else unmatched.push({ name: p.name, sku, reason: hits.length ? "ambiguous" : "none" });
      }
    }
  }
  return { proposals, unmatched };
}

export function applyProposals(catalog, proposals) {
  const byProduct = new Map((proposals || []).map((pr) => [pr.productId, pr]));
  const companies = (catalog?.companies || []).map((co) => {
    const stamp = (list) => (list || []).map((p) => {
      const pr = byProduct.get(p.id);
      return pr ? { ...p, link: { bookId: pr.bookId, sku: pr.sku } } : p;
    });
    return { ...co, grouts: stamp(co.grouts), mortars: stamp(co.mortars), underlayments: stamp(co.underlayments), attached: stamp(co.attached) };
  });
  return { ...catalog, companies };
}
