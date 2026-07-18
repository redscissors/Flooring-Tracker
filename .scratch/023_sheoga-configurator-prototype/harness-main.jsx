// Preview harness for issue 023 (run `npm run dev`, open
// /.scratch/023_sheoga-configurator-prototype/harness.html): mounts the REAL
// production components — GridOmniSearch with the pinned vendor row, and
// SheogaConfigurator — against fake in-memory stock, no Supabase involved.
// This is the preview-proof surface for the non-negotiable "no UI change
// without preview"; it ships nothing (vite build only bundles index.html).
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "/src/index.css";
import { GridOmniSearch, MobileSearchSheet } from "/src/App.jsx";
import SheogaConfigurator from "/src/SheogaConfigurator.jsx";
import { normStockItem } from "/src/stock.js";
import { seedFromQuery } from "/src/sheoga.js";

const FAKE_STOCK = [
  { sku: "5187941", active: true, data: { type: "hardwood", style: '5" White Oak Natural 4mm T&G Eng', size: '5"', price: 6.99, um: "SF" } },
  { sku: "5202230", active: true, data: { type: "hardwood", style: '7½" Euro White Oak Brushed UV Eng', size: '7.5"', price: 8.49, um: "SF" } },
].map(normStockItem);

function Harness() {
  const [q, setQ] = useState("");
  const [pop, setPop] = useState(null); // { seed }
  const [added, setAdded] = useState(null); // lines from the last Add
  const [mobileSearch, setMobileSearch] = useState(false); // MobileSearchSheet demo
  const [basket, setBasket] = useState([]);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="ft-eyebrow text-[10px] mb-1">issue 023 · production preview harness</div>
        <h1 className="text-2xl font-extrabold mb-4">Sheoga configurator — real components, fake data</h1>

        <div className="rounded-lg border border-slate-300 bg-white p-4 mb-6">
          <div className="ft-eyebrow text-[9px] mb-2">Product row — Kitchen · hardwood (blank-row search)</div>
          <div className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: "var(--ft-grid-line)" }}>
            <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center shrink-0" style={{ background: "var(--ft-brand-deep)" }}>H</span>
            <GridOmniSearch stock={FAKE_STOCK} query={q} onQuery={setQ}
              onPick={() => {}} onPickMany={() => {}} onManual={() => {}} onAbandon={() => {}}
              onVendor={(query) => { setQ(""); setPop({ seed: seedFromQuery(query) }); }}
              searchOrder={null} bookName="Stock" />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Type <b>"she"</b> or trade words ("white oak char 5 1/4 eng", "vent", "chevron") — the pinned Vendor configurators row opens the popup pre-filled.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setPop({ seed: null })} className="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold">Open configurator</button>
          <button onClick={() => setPop({ seed: seedFromQuery("walnut vent") })} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Open on vents</button>
          <button onClick={() => setPop({ seed: seedFromQuery("chevron red oak") })} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Open on herringbone</button>
          <button onClick={() => setMobileSearch(true)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Open mobile search</button>
        </div>

        {added && (
          <div className="rounded-lg border border-slate-300 bg-white p-4" data-added>
            <div className="ft-eyebrow text-[9px] mb-2">Add to product line → the row payload{added.length > 1 ? "s" : ""} (what lands on the job)</div>
            {added.map((l, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-md border border-slate-200 px-3 py-2 mb-1.5 text-xs">
                <span className={`w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center shrink-0 ${l.type === "misc" ? "bg-slate-400" : ""}`} style={l.type === "misc" ? {} : { background: "var(--ft-brand-deep)" }}>{l.type === "misc" ? "$" : "H"}</span>
                <span className="flex-1 min-w-0 font-semibold">{l.sizeText ? <b>{l.sizeText} · </b> : null}{l.brandColor}
                  <span className="block text-[10.5px] font-medium text-slate-400">{l.qtyType === "sqft" ? `${l.qty} sf` : `${l.qty} ×`} @ ${l.priceSqft}{l.qtyType === "sqft" ? "/sf" : " ea"}{l.cartonSf ? ` · ${l.cartonSf} sf/ctn` : ""} · cost ${l.costSqft} · markup ${l.markupPct}%</span>
                </span>
              </div>
            ))}
            <pre className="mt-2 text-[10px] leading-relaxed rounded-md p-3 overflow-auto" style={{ background: "#1C1A17", color: "#D8E4C6" }}>{JSON.stringify(added, null, 2)}</pre>
          </div>
        )}
      </div>

      {pop && (
        <SheogaConfigurator seed={pop.seed} initialSf={0} markupDefault={40} ventMarkupDefault={50}
          basket={basket} onBasketChange={setBasket} areaName="Kitchen"
          onMove={(lines) => setAdded(lines)}
          onAdd={(lines) => { setAdded(lines); setPop(null); }}
          onClose={() => setPop(null)} />
      )}
      {mobileSearch && (
        <MobileSearchSheet stock={FAKE_STOCK} searchOrder={null} bookName="Stock" initial=""
          onPick={() => setMobileSearch(false)} onPickMany={() => setMobileSearch(false)} onManual={() => setMobileSearch(false)}
          onVendor={(query) => { setMobileSearch(false); setPop({ seed: seedFromQuery(query) }); }}
          onClose={() => setMobileSearch(false)} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><Harness /></StrictMode>);
