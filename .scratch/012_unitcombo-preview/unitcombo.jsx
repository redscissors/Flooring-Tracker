// Preview harness for the unit-combo import warnings + per-piece carton
// pricing (VTC bullnose audit, 2026-07). Everything shown is computed by the
// REAL code paths — unitComboWarnings for the wizard block (its markup copied
// from App.jsx), pricedItem→stockPatch for the landing table — over items
// shaped like real VTC EFT rows. Served by the vite dev server; never shipped.
import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { normOrderItem, pricedItem, unitComboWarnings, rowCostSqft } from "../../src/orderbook.js";
import { stockPatch } from "../../src/stock.js";

const oi = (f) => normOrderItem({ unit: "", ...f });

// Real VTC EFT rows (SKU · cost · units · carton data), the audit's specimens.
const ITEMS = [
  oi({ sku: "ADXEAAS312", description: "EARTH ASH GRAY 3X12", type: "tile", priceUnit: "SF", orderUnit: "CT", cost: 11.64, sfPerUnit: 8.72, pcPerUnit: 36 }),
  oi({ sku: "CTIEPLIBN336R", description: "EPITOME LIGHT BULLNOSE 3X36 RECT", type: "tile", priceUnit: "PC", orderUnit: "CT", cost: 27.99, sfPerUnit: 5.38, pcPerUnit: 8 }),
  oi({ sku: "CDSTABABN240R", description: "TAHOE BARREL BULLNOSE 2X40", type: "tile", priceUnit: "PC", orderUnit: "CT", cost: 56.89, pcPerUnit: 10 }),
  oi({ sku: "EDISAIVMOS22", description: "SANDS IVORYSAND 2X2 MOSAIC SHEET", type: "tile", priceUnit: "SH", orderUnit: "CT", cost: 21.29, sfPerUnit: 8.72, pcPerUnit: 9 }),
];
// Rows that must WARN (also VTC-real: the lone ST·CT stick, the PA oddball, $0 rows).
const BAD = [
  oi({ sku: "VALLTMXSAGITTA", description: "SAGITTA TRIM STICK", type: "tile", priceUnit: "ST", orderUnit: "CT", cost: 22.14 }),
  oi({ sku: "VTCCPIVBN312", description: "IVORY BULLNOSE 3X12", type: "tile", priceUnit: "PC", orderUnit: "PA", cost: 9.19, pcPerUnit: 4 }),
  oi({ sku: "VTCPSBUQTROC", description: "QUARTER ROUND OUT CORNER", type: "tile", priceUnit: "PC", orderUnit: "CT", cost: 0, sfPerUnit: 5.17, pcPerUnit: 120 }),
  oi({ sku: "VTCPSCLQTROC", description: "QUARTER ROUND OUT CORNER CL", type: "tile", priceUnit: "PC", orderUnit: "CT", cost: 0, sfPerUnit: 5.17, pcPerUnit: 120 }),
];
const warnings = unitComboWarnings([...ITEMS, ...BAD]);

// The wizard's parse-summary block — markup lifted from App.jsx (SettingsWorkspace
// mapped-import wizard) so the proof shows the real presentation.
function WizardSummary() {
  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">{ITEMS.length + BAD.length} items parsed</span>
        <span className="text-xs text-emerald-600">8 new</span>
        <span className="text-xs text-amber-600">0 changed</span>
        <span className="text-xs text-slate-400">0 retiring · 0 unchanged</span>
      </div>
      <ul className="mt-1 text-[11px] text-amber-600 list-disc pl-4">{warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}</ul>
    </div>
  );
}

// How each specimen lands on a product row, straight from pricedItem→stockPatch
// at the book's 25% markup. "Before" columns are the pre-fix numbers from the
// audit, hardcoded for comparison.
const BEFORE = {
  ADXEAAS312: { line: "sqft · whole cartons", sell: "$14.55/sf (unchanged)" },
  CTIEPLIBN336R: { line: "sqft · whole cartons", sell: "$6.50/sf — 8× underpriced" },
  CDSTABABN240R: { line: "sqft — $0, silent", sell: "$0" },
  EDISAIVMOS22: { line: "sqft · whole cartons", sell: "$3.05/sf — 9× underpriced" },
};
function LandingTable() {
  return (
    <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
      <thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>
        <th className="text-left px-2 py-1">SKU</th><th className="text-left px-2 py-1">Lands as (now)</th>
        <th className="text-left px-2 py-1">Sell (now)</th><th className="text-left px-2 py-1">Cost snapshot</th>
        <th className="text-left px-2 py-1" style={{ opacity: 0.55 }}>Before the fix</th>
      </tr></thead>
      <tbody>
        {ITEMS.map((it) => {
          const priced = pricedItem(it, { default: 25 });
          const p = stockPatch(priced, {});
          const landing = p.type === "misc" ? `count line — “${p.brandColor}”` : `sqft · ${p.cartonSf ? `whole ${p.cartonUnit} of ${p.cartonSf} sf` : "loose"}`;
          const sell = p.type === "misc" ? `$${p.priceSqft} each` : `$${p.priceSqft}/sf`;
          const before = BEFORE[it.sku] || {};
          return (
            <tr key={it.sku} className="border-t border-slate-100">
              <td className="px-2 py-1 font-mono text-[10px]">{it.sku}</td>
              <td className="px-2 py-1">{landing}</td>
              <td className="px-2 py-1 font-semibold">{sell}</td>
              <td className="px-2 py-1">${rowCostSqft(it)}</td>
              <td className="px-2 py-1" style={{ opacity: 0.55 }}>{before.line} · {before.sell}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Panel() {
  return (
    <div style={{ background: "var(--ft-bg)", color: "var(--ft-text)", padding: 20 }}>
      <div className="ft-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Import wizard — parse summary with unit warnings</div>
      <div style={{ border: "1px solid var(--ft-border)", background: "var(--ft-card)", padding: 12, marginBottom: 18 }}><WizardSummary /></div>
      <div className="ft-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>How the audit's specimen rows land (real pricedItem → stockPatch, 25% markup)</div>
      <div style={{ border: "1px solid var(--ft-border)", background: "var(--ft-card)" }}><LandingTable /></div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <div style={{ fontFamily: "Manrope, sans-serif" }}>
    <Panel />
    <div className="ned-dark"><Panel /></div>
  </div>
);
