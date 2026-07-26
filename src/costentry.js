// Hand-entered cost on a product row (2026-07-26). A price-book pick snapshots
// the vendor cost beside the sell price (costSqft + markupPct); a manually typed
// line had nowhere to put one, so the Employee tier, the internal margin and the
// order sheet all read it as costless. The price cell's popup writes the same
// three fields a pick writes, so a hand-costed row and a picked one mean the
// same thing everywhere downstream.
//
// Markup is on COST — sell = cost × (1 + pct/100) — the same frame the price
// books mark up in (orderbook.sellPrice). The margin readout is of SELL (gross
// margin), matching the job's margin line, so 50% markup reads as 33.3% margin.

const round2 = (n) => Math.round(n * 100) / 100;
const round1 = (n) => Math.round(n * 10) / 10;
const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

// The shop's common markups — the seed for `settings.pricing.quickMarkups`,
// which the team tunes in Settings → Price book. Presets only: the popup's %
// field still takes anything, so an unlisted markup is always one keystroke
// away and a shop that clears the list entirely just types every markup.
export const MARKUP_PRESETS = [30, 50, 100];
export const MAX_QUICK_MARKUPS = 6;   // what the popup's button row fits before it reads as a menu

// A saved list normalizes to buttons the popup can actually render: numbers
// only, deduped, in the order they were entered. An absent list seeds the
// defaults; an explicitly empty one is a choice and stays empty.
export function normQuickMarkups(raw) {
  if (!Array.isArray(raw)) return [...MARKUP_PRESETS];
  const out = [];
  for (const v of raw) {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n < 0 || n > 500) continue;
    const r = Math.round(n * 10) / 10;
    if (!out.includes(r)) out.push(r);
  }
  return out.slice(0, MAX_QUICK_MARKUPS);
}

export function priceFromCost(cost, pct) {
  const c = numOr(cost, NaN), p = numOr(pct, NaN);
  if (!(c > 0) || !Number.isFinite(p)) return null;
  return round2(c * (1 + p / 100));
}

export function markupFromPrice(cost, price) {
  const c = numOr(cost, NaN), s = numOr(price, NaN);
  if (!(c > 0) || !(s > 0)) return null;
  return round1((s / c - 1) * 100);
}

export function unitMargin(cost, price) {
  const c = numOr(cost, NaN), s = numOr(price, NaN);
  if (!(c > 0) || !(s > 0)) return null;
  return { amount: round2(s - c), pct: round1(((s - c) / s) * 100) };
}

const patchOf = (field, raw) => ({ [field]: String(raw ?? "").trim() });

// Typing a cost with a markup already chosen drives the price live — that is
// the point of the popup. With no markup chosen the cost is recorded alone and
// a price already typed stands.
export function editCost(p, cost) {
  const patch = patchOf("costSqft", cost);
  const next = priceFromCost(patch.costSqft, p?.markupPct);
  if (next != null) patch.priceSqft = next.toFixed(2);
  return patch;
}

export function editMarkup(p, pct) {
  const patch = patchOf("markupPct", pct);
  const next = priceFromCost(p?.costSqft, patch.markupPct);
  if (next != null) patch.priceSqft = next.toFixed(2);
  return patch;
}

// Typing a price is the truth and the markup re-derives beneath it — editing
// the sale price moves the margin, never the cost (print.js orderLineCost).
// With nothing to derive from, a book row's snapshotted markup is left alone.
export function editPrice(p, price) {
  const patch = patchOf("priceSqft", price);
  const m = markupFromPrice(p?.costSqft, patch.priceSqft);
  if (m != null) patch.markupPct = String(m);
  return patch;
}
