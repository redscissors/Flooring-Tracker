// The pure half of MorphSelect (ADR 0048): the flat row list a grouped
// dropdown walks, keyboard moves, first-letter jump, and where the open box
// goes. No React, so node --test drives it.

export function flatten({ options, groups }) {
  if (!groups) return { items: options || [], heads: [] };
  const items = [];
  const heads = [];
  for (const g of groups) {
    if (!g.items?.length) continue;
    heads.push({ label: g.label, at: items.length });
    items.push(...g.items);
  }
  return { items, heads };
}

const usable = (it) => !!it && !it.disabled;

export function moveIndex(items, from, delta) {
  const n = items.length;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = i < 0 ? (delta > 0 ? 0 : n - 1) : (i + delta + n) % n;
    if (usable(items[i])) return i;
  }
  return -1;
}

export const edgeIndex = (items, edge) => moveIndex(items, -1, edge === "first" ? 1 : -1);

export function typeahead(items, from, ch) {
  const c = String(ch || "").toLowerCase();
  const n = items.length;
  if (!c) return -1;
  for (let k = 1; k <= n; k++) {
    const i = (Math.max(from, -1) + k) % n;
    if (usable(items[i]) && String(items[i].label).toLowerCase().startsWith(c)) return i;
  }
  return -1;
}

// The open box covers the trigger exactly (it IS the trigger, grown), so it
// starts at the trigger's top going down, or its bottom going up. Inside a
// `zoom`ed workspace the box carries the same zoom, and a zoomed fixed box
// multiplies its own offsets too — so every length comes back ÷ scale.
export function placeMorph({ rect, vw, vh, scale = 1, align = "left", want = 320 }) {
  const below = vh - rect.top - 8;
  const above = rect.bottom - 8;
  const up = below < Math.min(want, above);
  const pos = { up, maxList: Math.max(96, Math.floor(((up ? above : below) - rect.height) / scale)) };
  if (up) pos.bottom = (vh - rect.bottom) / scale; else pos.top = rect.top / scale;
  if (align === "right") pos.right = (vw - rect.right) / scale; else pos.left = rect.left / scale;
  pos.maxW = Math.floor(((align === "right" ? rect.right : vw - rect.left) - 8) / scale);
  return pos;
}
