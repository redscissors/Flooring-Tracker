// Pure per-brand basket pricing for a wedi kit marker — the popup's entryView /
// applySession / tierOf lifted out so the lazy basket drawer prices a staged
// wedi entry the same way the popup does. Imports wedi.js only.
import { tierPrice, lineItems, buildFromMarker, panelFitLines, addedRows, item, wediSlotOf, round2 } from "./wedi.js";

const clampPct = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; };

export const wediTierOf = ({ tier, customPct, salePct, bPct }) =>
  (e) => tierPrice(e, tier, tier === "builder" ? bPct : tier === "sale" ? salePct : tier === "custom" ? clampPct(customPct) : null);

// The build column's tail over a kitFor result — panel plan, stepped
// quantities. The basket drawer runs it too, so a staged entry prices the
// build that was staged and not just its marker. Added lines ride the cfg
// (kitFor bills them); `s.manual` is only a basket entry staged before
// Phase 1c, whose extras rode the session — each its own line now.
export const wediApplySession = (b, wl, s) => {
  let lines = b.lines.map((l) => ({ item: l.item, qty: l.qty, group: l.group, note: l.note, auto: l.auto, slot: l.slot, added: l.added }));
  if (s.panelFit) lines = panelFitLines(lines, wl, b.panelSf);
  lines.forEach((l) => {
    const ov = s.qtyOv[l.item.key];
    if (ov != null && !l.added) { l.autoQty = l.qty; l.qty = ov; l.ov = true; }
  });
  // the Fit plan re-appends the kit's panels, so added lines move back to
  // the end — below the kit lines of their bucket
  lines = [...lines.filter((l) => l.qty > 0 && !l.added), ...lines.filter((l) => l.qty > 0 && l.added)];
  addedRows({ manual: s.manual }).forEach((r) => {
    const it = item(r.key);
    lines.push({ item: it, qty: r.qty, group: r.group, note: "", auto: false, added: true, slot: wediSlotOf({ item: it, group: r.group }) });
  });
  return lines;
};

// A STAGED entry carries its own session (owner decision 2026-08-31), so its
// price is the build column's; a PLACED kit is a marker-only derivation —
// once landed the rows are the truth — and reads the live Fit setting.
// Callers pass `session || {}` for a staged entry: a truthy session makes the
// entry read its OWN Fit flag, and an entry saved without a session must still
// take the staged path.
export const wediEntryView = (marker, session, { tier, customPct, salePct, bPct, panelFit }) => {
  const b = buildFromMarker(marker);
  if (!b) return { title: "wedi build", meta: "the catalog no longer knows this kit", price: null, faint: true, lines: null };
  const room = b.cfg.room;
  const s = session || {};
  const tierOf = wediTierOf({ tier, customPct, salePct, bPct });
  const lines = wediApplySession(b, b.cfg.walls, {
    qtyOv: s.qtyOv || {}, manual: s.manual || [], panelFit: session ? s.panelFit !== false : panelFit,
  });
  return {
    title: b.pan ? b.pan.name : "wedi build",
    meta: `${lines.length} lines${room ? ` · ${round2(room.w)}×${round2(room.d)}"` : ""}`,
    price: round2(lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0)),
    lines: () => lineItems({ ...b, lines }, { tier, builderPct: bPct }),
  };
};
