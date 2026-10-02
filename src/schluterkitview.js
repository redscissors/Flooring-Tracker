// Pure per-brand basket pricing for a Schluter kit marker — the popup's
// entryView / tierOf lifted out so the lazy basket drawer prices a staged
// Schluter entry the same way the popup does. Imports schluter.js only.
import { tierPrice, lineItems, buildFromMarker, boardPlan, expandBoardFaces, applyBoardPlan, applyQtyOv } from "./schluter.js";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const clampPct = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; };

export const schluterTierOf = ({ tier, customPct, salePct, bPct }) => (e) => {
  const retail = tierPrice(e, "retail", {});
  switch (tier) {
    case "builder": return tierPrice(e, "builder", { builderPct: bPct });
    case "employee": return round2((+e.cost || 0) * 1.06);
    case "sale": return round2(retail * (1 - salePct / 100));
    case "custom": return round2(retail * (1 - clampPct(customPct) / 100));
    default: return retail;
  }
};

// The catalog is LIVE registry rows (ADR 0032): until catReady every entry
// renders faint instead of pricing — never a crash. Prices re-derive through
// buildFromMarker + the board plan + the tier lens, so a kit reads the same
// number in the drawer and the build column.
// A STAGED entry carries its own session (owner decision 2026-08-31), so its
// price is the build column's; a PLACED kit is a marker-only derivation —
// once landed the rows are the truth — and reads the live Fit setting.
// Callers pass `session || {}` for a staged entry: a truthy session makes the
// entry read its OWN Fit flag, and an entry saved without a session must still
// take the staged path.
export const schluterEntryView = (marker, session, { cat, catReady, tier, customPct, salePct, bPct, panelFit }) => {
  if (!catReady || !cat.length) return { title: "Schluter kit", meta: "waiting on the price books…", price: null, faint: true, lines: null };
  const b = buildFromMarker(marker, cat);
  if (!b) return { title: "Schluter kit", meta: "the catalog no longer knows this kit", price: null, faint: true, lines: null };
  const tierOf = schluterTierOf({ tier, customPct, salePct, bPct });
  const c2 = marker.cfg;
  const s = session || {};
  const fit = session ? s.panelFit !== false : panelFit;
  let lines = applyBoardPlan(b.lines, c2, fit && c2.wallSys === "board" ? boardPlan(expandBoardFaces(c2), cat, { source: c2.source === "stock" ? "stock" : "all" }) : null, cat);
  lines = applyQtyOv(lines, s.qtyOv || {});
  const bill = lines.filter((l) => !l.noteOnly);
  return {
    title: b.pick && b.pick.tray ? [b.pick.tray.size, b.pick.tray.name].filter(Boolean).join(" ") : "Mortar-bed build",
    meta: `${bill.length} lines · ${round2(c2.w)}×${round2(c2.d)}"`,
    price: round2(bill.reduce((t, l) => t + tierOf(l.item) * l.qty, 0)),
    lines: () => lineItems({ ...b, lines, mode: marker.mode || "custom", cfg: c2 }, { builderPct: bPct }),
  };
};
