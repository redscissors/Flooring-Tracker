// Sample-ordering pure logic (2026-08-28): the project's marked lines
// (product.sample — see model.js normSample) collected for the Samples panel.
// Grouped by the vendor the row snapshotted from, because that's the unit a
// sample order is actually placed in — one email/portal visit per vendor.
// Read-only over the categories; every write goes back through the caller's
// updateProject patch. Split from samples.jsx so `node --test` can cover it.

import { areaLabel, SAMPLE_STATUSES } from "./model.js";
import { TLBL } from "./uiconst.js";

export { SAMPLE_STATUSES };
export const SAMPLE_LABEL = { need: "To order", ordered: "Ordered", in: "Received" };

// Status colors, shared by the panel's chips, the grid's row indicator, and
// the mobile row sheet: amber = on you (order it), slate = waiting on the
// vendor, moss = it's here. Inline hexes like the order panel's ASSUMED
// palette — the theme's emerald/amber utilities don't all render in this build.
export const SAMPLE_COLOR = { need: "#b45309", ordered: "#64748b", in: "var(--ft-brand)" };
export const SAMPLE_CHIP = {
  need: { background: "#fef6e2", color: "#b45309", borderColor: "#f0c96f" },
  ordered: { background: "#eef1f4", color: "#475569", borderColor: "#cbd5e1" },
  in: { background: "var(--ft-brand)", color: "#fff", borderColor: "var(--ft-brand)" },
};

const OTHER_KEY = "__other";
const sizeOf = (p) => p.sizeText || (p.L && p.W ? `${p.L}×${p.W}` : "");

// One panel row per marked product line. The name falls back the same way the
// line menu's title does, so an unnamed row is still recognizable.
const sampleRow = (a, ai, p) => ({
  aid: a.id, pid: p.id, areaName: areaLabel(a, ai),
  name: (p.brandColor || "").trim() || p.sku || TLBL[p.type] || "This line",
  sku: p.sku || "", size: sizeOf(p),
  status: p.sample.status, at: p.sample.at || null,
});

// Marked lines grouped by vendor: the row's snapshotted book (brand label over
// book name), a Sheoga-configurator line's vendor is Sheoga, and everything
// else — hand-entered rows, wedi lines (transcribed tables, no registry book) —
// files under one trailing "Other" group. Group order is encounter order,
// Other always last.
export const sampleGroups = (categories, books = []) => {
  const bookName = new Map(books.map((b) => [b.id, (b.data?.brandLabel || "").trim() || b.name || "Price book"]));
  const groups = new Map();
  (categories || []).forEach((a, ai) => (a.products || []).forEach((p) => {
    if (!p.sample) return;
    const key = p.bookId && bookName.has(p.bookId) ? p.bookId : p.sheoga ? "sheoga" : OTHER_KEY;
    const name = key === OTHER_KEY ? "Other / hand-entered" : key === "sheoga" ? "Sheoga Hardwood" : bookName.get(key);
    if (!groups.has(key)) groups.set(key, { key, name, rows: [] });
    groups.get(key).rows.push(sampleRow(a, ai, p));
  }));
  const out = [...groups.values()];
  const oi = out.findIndex((g) => g.key === OTHER_KEY);
  if (oi >= 0) out.push(out.splice(oi, 1)[0]);
  return out;
};

// Badge math: open = not yet received (a request still being chased).
export const sampleCounts = (categories) => {
  const c = { need: 0, ordered: 0, in: 0, total: 0 };
  for (const a of categories || []) for (const p of a.products || []) {
    if (!p.sample) continue;
    c[p.sample.status] = (c[p.sample.status] || 0) + 1;
    c.total++;
  }
  return { ...c, open: c.need + c.ordered };
};

// The per-vendor copy list — one readable line per sample (size, name, SKU),
// pasteable into a vendor email or portal notes. Samples are one each, so
// there is no quantity column.
export const sampleCopyText = (rows) =>
  rows.map((r) => [r.size, r.name].filter(Boolean).join(" ") + (r.sku ? ` — ${r.sku}` : "")).join("\n");
