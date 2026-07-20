// Preview harness for the order-entry work. Renders the REAL OrderEntryPanel
// over rows built from the REAL sheoga.lineItems() payloads, classified by the
// REAL isSpecialOrder and fitted by the REAL orderDescription — so what shows
// here is the code path the app runs, without touching Supabase or signing in.
// The slider is the Settings → Price book "Desc. field" value, live.
// Dev-only entry (preview.html); not part of the app build.
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrderEntryPanel } from "./orderentry.jsx";
import { isSpecialOrder, orderCopyText, orderDescription } from "./orderentry.js";
import { lineItems, defaultConfig } from "./sheoga.js";

// A plain configured floor (fits abbreviated) and a heavily-optioned one with
// two fees (can't fit — the case that needs the extended-text field).
const plainCfg = { ...defaultConfig("floor"), sp: "White Oak", w: 5.25, grade: "char", cons: "solid", finish: "t1" };
const loadedCfg = { ...plainCfg, sp: "Q/R White Oak", tex: "bandsawn", edge: "pillow", len: "3-10", finish: "est", stain: "Toasted Acorn", sample: true };
const plainLines = lineItems({ mode: "floor", cfg: plainCfg }, { sf: 900, markupPct: 40 });
const loadedLines = lineItems({ mode: "floor", cfg: loadedCfg }, { sf: 240, markupPct: 40 });
const ventLines = lineItems({ mode: "vent", cfg: { ...defaultConfig("vent"), sp: "Walnut", size: "4×12", qty: 6 } }, { sf: 0 });

const bookRow = {
  id: "bk1", bookId: "bkVTC", sku: "ANA-CAR-1224", brandColor: "Anatolia Carrara Bianco Polished Rectified",
  sizeText: '12" × 24"', qtyType: "sqft", qty: "310", cartonSf: "15.5", priceSqft: "7.20", costSqft: "4.10",
};
const stockRow = { id: "st1", sku: "SCH-DIL-8MM", brandColor: "Schluter Ditra 8mm", qtyType: "count", qty: "4" };

// The quantity/price math orderEntryRow() does needs App.jsx's whole calc chain,
// so the harness states plausible numbers directly. The SECTION SPLIT and the
// DESCRIPTION FIT — what this change is about — come from the real helpers.
const NUMS = {
  bk1: { qty: 20, unitCode: "CT", tag: "CT", coverage: "15.5 SF/CT", perCost: 63.55, perSell: 111.6 },
  st1: { qty: 4, unitCode: "EA", tag: "", coverage: "", perCost: 0, perSell: 0 },
  carton: { qty: 12, unitCode: "CT", tag: "CT", coverage: "20.5 SF/CT" },
  each: { qty: 1, unitCode: "EA", tag: "", coverage: "" },
  vent: { qty: 6, unitCode: "PC", tag: "", coverage: "" },
};

const toRow = (p, nums, limit) => {
  const sell = Number(p.priceSqft || 0);
  const cost = Number(p.costSqft || 0);
  const r = {
    id: p.id, special: isSpecialOrder(p), byDesc: !!p.sheoga && !p.sku, area: "Kitchen",
    tag: nums.tag, sizePlain: p.sizeText || "", name: String(p.brandColor || ""), sku: p.sku || "",
    sheoga: p.sheoga, coverage: nums.coverage, qty: nums.qty, unitCode: nums.unitCode,
    qtyText: nums.qty > 0 ? `${nums.qty} ${nums.unitCode}` : "—",
    perCost: nums.perCost ?? (nums.unitCode === "CT" ? cost * 20.5 : cost),
    perSell: nums.perSell ?? (nums.unitCode === "CT" ? sell * 20.5 : sell),
  };
  const desc = orderDescription(r, limit);
  return { ...r, desc, copy: orderCopyText({ ...r, desc }) };
};

const build = (limit) => [
  toRow({ ...bookRow }, NUMS.bk1, limit),
  toRow({ ...plainLines[0], id: "shp" }, NUMS.carton, limit),
  ...loadedLines.map((p, i) => toRow({ ...p, id: `shl${i}` }, i === 0 ? NUMS.carton : NUMS.each, limit)),
  toRow({ ...ventLines[0], id: "shv" }, NUMS.vent, limit),
  toRow({ ...stockRow }, NUMS.st1, limit),
];

const TIER_NOTE = {
  full: "fits as written",
  short: "abbreviated — every category kept",
  split: "won't fit — identity in the field, everything in Ext",
};

function Preview() {
  const [limit, setLimit] = React.useState(30);
  const rows = build(limit);
  const special = rows.filter((r) => r.special);
  const stock = rows.filter((r) => !r.special);
  const tally = special.reduce((a, r) => ({ ...a, [r.desc.tier]: (a[r.desc.tier] || 0) + 1 }), {});
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      {/* The panel is a fixed inset-0 overlay, so the controls have to sit above
          it to stay clickable. */}
      <div className="max-w-xl relative z-[60]">
        <h1 className="text-lg font-semibold mb-1">Fitting descriptions to the ERP field</h1>
        <p className="text-xs text-slate-500 mb-4">
          Rows come from the real <code>lineItems()</code>; the section split is the real{" "}
          <code>isSpecialOrder()</code> and the fit the real <code>orderDescription()</code>.
        </p>

        <label className="block text-xs mb-1 font-semibold">
          Description field: {limit === 0 ? "no limit" : `${limit} characters`}
        </label>
        <input type="range" min="0" max="80" value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          className="w-full max-w-sm mb-3" style={{ accentColor: "var(--ft-brand)" }} />

        <div className="text-xs space-y-1">
          {["full", "short", "split"].map((t) => (
            <div key={t} className="flex items-baseline gap-2">
              <span className="ft-mono font-bold w-6 text-right">{tally[t] || 0}</span>
              <span className="font-semibold w-10">{t}</span>
              <span className="text-slate-500">{TIER_NOTE[t]}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3 max-w-sm">
          Drag to 0 for the old behaviour. Around 24–30 most builds land on “short”; below ~20 even
          the abbreviations stop fitting and the Ext button appears.
        </p>
      </div>
      <OrderEntryPanel name="Preview — 1421 Maple Ave" special={special} stock={stock}
        descLimit={limit} onClose={() => {}} />
    </div>
  );
}

const el = document.getElementById("preview");
const root = (window.__previewRoot ||= createRoot(el));
root.render(<Preview />);
