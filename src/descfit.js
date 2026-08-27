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
//   short  every category still present, abbreviated ("White Oak" → "WO") —
//          but only as far as the field requires: leftover room is spent
//          writing words back out, most important first (see promote)
//   split  even abbreviated it overruns, so the field takes the identity
//          categories with a trailing "+" and the FULL text goes to the ERP's
//          extended-text field as a second copy
//
// The "+" matters: a partial spec that doesn't announce itself reads as a whole
// one, which is the failure this whole module exists to prevent.
//
// A part is { full, short, rank, pin }. Rank is drop priority, not print order —
// parts print in array order, and on the split rung the highest ranks drop
// first. Rank 0 is identity and is never dropped (it gets clipped only if the
// identity categories alone overrun, which means the limit is unusable).
//
// A pinned part (pin: true — the order tail: SKU, coverage; Marcus 2026-08-26)
// is never dropped AND never clipped: on the split rung the pins reserve their
// room first and render after the "+" marker, so the cut body still announces
// itself while the tail survives whatever the limit is. Pins past the limit
// overrun and report `over` rather than losing the tail.
//
// A soft part (soft: true — the book brand, "Collection"; owner 2026-08-26) is
// series typography rather than identity: a line whose ONLY losses are soft
// parts is not a partial spec, so it renders WITHOUT the marker — the marker's
// own room goes back into the body, and the ext copy still carries the full
// text. The "+" appears only when identifying text was actually cut.

// The desk's ERP description field holds 70 characters (owner 2026-08-27 —
// corrected from the 30 the feature shipped with).
export const DEFAULT_DESC_LIMIT = 70;
const MARK = "+";

const rankOf = (p) => p.rank || 0;
const text = (p, key) => String((key === "short" ? p.short || p.full : p.full) || "").trim();
const join = (parts, key) => parts.map((p) => text(p, key)).filter(Boolean).join(" ");

// With every part abbreviated the field often has room to spare, and an
// all-short line wastes it ("WO Char Sol" alone in the field). Spend the
// headroom writing words back out, most important first — lowest rank, print
// order within a rank — keeping each promotion only if the line still fits.
// Greedy on purpose: deterministic, and the identity words get the room before
// the cosmetic ones do.
const promote = (parts, budget) => {
  const pick = parts.map((p) => text(p, "short"));
  const width = () => pick.filter(Boolean).join(" ").length;
  const order = parts.map((p, i) => ({ p, i })).sort((a, b) => rankOf(a.p) - rankOf(b.p) || a.i - b.i);
  for (const { p, i } of order) {
    const was = pick[i];
    pick[i] = text(p, "full");
    if (width() > budget) pick[i] = was;
  }
  return pick.filter(Boolean).join(" ");
};

// Last resort on the split rung: cut at a word boundary so a half-word never
// reads as an abbreviation we meant. The scan runs to n+1 so a word ending
// exactly at the budget is kept, not cut back a word. When there is no
// boundary — one word longer than the whole field — keep the word intact and
// let it overrun; a hard cut would hand back a fragment indistinguishable from
// a real short form, and an overrun the caller can see beats a lie it can't.
const clip = (s, n) => {
  if (s.length <= n) return s;
  const sp = s.slice(0, n + 1).lastIndexOf(" ");
  return (sp > 0 ? s.slice(0, sp) : s.split(" ")[0]).trim();
};

// parts → { tier, main, ext, full, over, cut }.
//   main  what goes in the description field
//   ext   the extended-text field, or null when the description says everything
//   full  the complete written-out description, always
//   over  how many characters main is still over the limit — only non-zero when
//         a single word is wider than the whole field
//   cut   identifying text is missing from main (the marked split) — false when
//         the line fits or its only losses are soft parts
export function fitDescription(parts, limit) {
  const clean = (parts || []).filter((p) => p && (p.full || p.short));
  const full = join(clean, "full");
  const lim = Number(limit);
  if (!(lim > 0) || full.length <= lim) return { tier: "full", main: full, ext: null, full, over: 0, cut: false };

  const short = join(clean, "short");
  if (short && short.length <= lim) return { tier: "short", main: promote(clean, lim), ext: null, full, over: 0, cut: false };

  // Split rung. Pinned parts reserve their room first (plus " +" for the
  // marker); only the unpinned body drops and clips against what's left.
  const pins = clean.filter((p) => p.pin);
  const rest = clean.filter((p) => !p.pin);
  const pinText = join(pins, "full");
  const pinRoom = pinText ? pinText.length + 1 : 0;
  // Losing only soft parts leaves the identity whole — try that first, with the
  // marker's own room back in the body's budget, and render unmarked when it
  // lands. Softs drop least-important first, same order as the marked loop.
  const softOrder = rest
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.soft)
    .sort((a, b) => rankOf(b.p) - rankOf(a.p) || b.i - a.i);
  let whole = rest;
  for (const { p } of softOrder) {
    if (join(whole, "short").length <= lim - pinRoom) break;
    whole = whole.filter((x) => x !== p);
  }
  if (join(whole, "short").length <= lim - pinRoom) {
    const main = [promote(whole, lim - pinRoom), pinText].filter(Boolean).join(" ") || full;
    return { tier: "split", main, ext: full, full, over: 0, cut: false };
  }
  const budget = Math.max(0, lim - MARK.length - 1 - pinRoom);
  // Drop ONE category at a time rather than a whole rank, so the field keeps as
  // much as it can hold — dropping by rank strands headroom (the field ending
  // up two-thirds full). Least important goes first: highest rank,
  // and within a rank the later-printed one.
  const order = rest
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rankOf(b.p) - rankOf(a.p) || b.i - a.i);
  let kept = rest;
  for (const { p } of order) {
    if (join(kept, "short").length <= budget) break;
    if (rankOf(p) === 0) break; // identity is the floor — clip instead of dropping
    kept = kept.filter((x) => x !== p);
  }
  // A cut that lands after a separator leaves "Small-order fee — +", which reads
  // as a typo rather than a continuation.
  // When the drop loop stopped at the identity floor the all-short join still
  // overruns — promote finds nothing to accept and clip does the work as before.
  const body = clip(promote(kept, budget), budget).replace(/[\s–—·,;:-]+$/, "");
  // The split rung always marks its body — except a pin-only line (no body at
  // all), where a bare "+" would claim text the ext doesn't hold.
  const main = [body ? `${body} ${MARK}` : "", pinText].filter(Boolean).join(" ") || full;
  return { tier: "split", main, ext: full, full, over: Math.max(0, main.length - lim), cut: true };
}

// An unstructured description — a price-book special's vendor text, which isn't
// assembled from known enums and so has no lossless short form. One identity
// part: it either fits or it splits, never a middle rung.
export const textParts = (s) => (String(s || "").trim() ? [{ full: String(s).trim(), rank: 0 }] : []);
