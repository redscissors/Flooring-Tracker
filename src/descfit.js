// Fitting an order description into a fixed-width ERP field.
//
// A special-order line has no SKU — the description IS the order — so the
// categories that make it up (species, grade, construction, finish…) are what
// identify the product. Losing one doesn't read as a shorter description, it
// reads as a different floor. So this never truncates to fit; it climbs down a
// three-rung ladder and only descends when the rung above can't hold every
// category:
//
//   full   the written-out description fits as-is
//   short  every category still present, each abbreviated ("White Oak" → "WO")
//   split  even abbreviated it overruns, so the field takes the identity
//          categories with a trailing "+" and the FULL text goes to the ERP's
//          extended-text field as a second copy
//
// The "+" matters: a partial spec that doesn't announce itself reads as a whole
// one, which is the failure this whole module exists to prevent.
//
// A part is { full, short, rank }. Rank is drop priority, not print order —
// parts print in array order, and on the split rung the highest ranks drop
// first. Rank 0 is identity and is never dropped (it gets clipped only if the
// identity categories alone overrun, which means the limit is unusable).

export const DEFAULT_DESC_LIMIT = 30;
const MARK = "+";

const rankOf = (p) => p.rank || 0;
const text = (p, key) => String((key === "short" ? p.short || p.full : p.full) || "").trim();
const join = (parts, key) => parts.map((p) => text(p, key)).filter(Boolean).join(" ");

// Last resort on the split rung: cut at a word boundary so a half-word never
// reads as an abbreviation we meant. When there is no boundary — one word longer
// than the whole field — keep the word intact and let it overrun; a hard cut
// would hand back a fragment indistinguishable from a real short form, and an
// overrun the caller can see beats a lie it can't.
const clip = (s, n) => {
  if (s.length <= n) return s;
  const sp = s.slice(0, n).lastIndexOf(" ");
  return (sp > 0 ? s.slice(0, sp) : s.split(" ")[0]).trim();
};

// parts → { tier, main, ext, full, over }.
//   main  what goes in the description field
//   ext   the extended-text field, or null when the description says everything
//   full  the complete written-out description, always
//   over  how many characters main is still over the limit — only non-zero when
//         a single word is wider than the whole field
export function fitDescription(parts, limit) {
  const clean = (parts || []).filter((p) => p && (p.full || p.short));
  const full = join(clean, "full");
  const lim = Number(limit);
  if (!(lim > 0) || full.length <= lim) return { tier: "full", main: full, ext: null, full, over: 0 };

  const short = join(clean, "short");
  if (short && short.length <= lim) return { tier: "short", main: short, ext: null, full, over: 0 };

  // Split rung. Reserve room for " +" so the marker never pushes it back over.
  const budget = lim - MARK.length - 1;
  // Drop ONE category at a time rather than a whole rank, so the field keeps as
  // much as it can hold — dropping by rank strands headroom (a 30-char field
  // ending up with 20 chars in it). Least important goes first: highest rank,
  // and within a rank the later-printed one.
  const order = clean
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rankOf(b.p) - rankOf(a.p) || b.i - a.i);
  let kept = clean;
  for (const { p } of order) {
    if (join(kept, "short").length <= budget) break;
    if (rankOf(p) === 0) break; // identity is the floor — clip instead of dropping
    kept = kept.filter((x) => x !== p);
  }
  // A cut that lands after a separator leaves "Small-order fee — +", which reads
  // as a typo rather than a continuation.
  const body = clip(join(kept, "short"), budget).replace(/[\s–—·,;:-]+$/, "");
  const main = `${body} ${MARK}`.trim();
  return { tier: "split", main, ext: full, full, over: Math.max(0, main.length - lim) };
}

// An unstructured description — a price-book special's vendor text, which isn't
// assembled from known enums and so has no lossless short form. One identity
// part: it either fits or it splits, never a middle rung.
export const textParts = (s) => (String(s || "").trim() ? [{ full: String(s).trim(), rank: 0 }] : []);
