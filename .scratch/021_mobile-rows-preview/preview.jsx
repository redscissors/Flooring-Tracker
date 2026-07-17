// Preview harness for the mobile compact rows + row editor sheet (mobile
// redesign PR 2, 2026-07-17). The rows, editor sheet, and full-screen search
// are the REAL MobileProductRow / MobileRowSheet / MobileSearchSheet exported
// from App.jsx, driven by a local fixture project + fixture price-book stock —
// no Supabase reads or writes. The top bar / add bar markup is copied from
// App.jsx's !isWide branches like the PR 1 harness.
// Served by the vite dev server at /.scratch/021_mobile-rows-preview/preview.html;
// never shipped.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Menu, MoreHorizontal, Printer, Plus } from "lucide-react";
import "../../src/index.css";
import { num, normalizeSettings } from "../../src/catalog.js";
import { normStockItem, stockPatch, groutFamilies } from "../../src/stock.js";
import { MobileProductRow, MobileRowSheet, TIER_COLOR } from "../../src/App.jsx";
import NedMark from "../../src/NedMark.jsx";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const areaLabel = (a, i) => (a.name || "").trim() || `Area ${i + 1}`;

const SETTINGS = normalizeSettings(null);

// Fixture price book — enough shape variety to exercise the search + fill
// paths: a plain tile, a carton-sold vinyl, a per-piece trim, a misc membrane.
const STOCK = [
  { sku: "PF08-1224", data: { type: "tile", section: "Floor Tile", brand: "Florida Tile", description: "Portfolio Iron Gray", size: "12x24", thickness: '3/8"', priceSqft: 3.49, unit: "SF" } },
  { sku: "PF08-1224W", data: { type: "tile", section: "Floor Tile", brand: "Florida Tile", description: "Portfolio Cream", size: "12x24", thickness: '3/8"', priceSqft: 3.49, unit: "SF" } },
  { sku: "F02STERIV1224", data: { type: "tile", section: "Floor Tile", brand: "Emser", description: "Sterlina Ivory", size: "12x24", priceSqft: 4.79, unit: "SF" } },
  { sku: "VV017-01005", data: { type: "vinyl", section: "LVP", brand: "COREtec", description: "Pro Plus Copano Oak", size: "7x48", priceSqft: 4.19, sfPerUnit: 28.84, unit: "CT" } },
  { sku: "VV017-04005", data: { section: "Trim", brand: "COREtec", description: "Stairnose Copano Oak", price: 62, unit: "EA" } },
  { sku: "DXL175", data: { section: "Setting Materials", brand: "Schluter", description: "Ditra-XL membrane 175 sf roll", price: 438, unit: "EA" } },
  { sku: "RS-114", data: { type: "carpet", section: "Carpet", brand: "Dream Weaver", description: "Rock Solid Mineral 12' roll", priceSqft: 2.89, unit: "SF" } },
].map(normStockItem);
const GFAMILIES = groutFamilies(STOCK);

const mkP = (over = {}) => ({
  id: uid(), type: "tile", sku: "", L: "", W: "", thickness: "0.375", sizeText: "", brandColor: "", priceSqft: "",
  qtyType: "sqft", qty: "", cartonSf: "", cartonPc: "", cartonUnit: "CT", cartonManual: "", note: "",
  grout: { checked: false, product: "", color: "", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" },
  mortar: { checked: false, product: "", manual: "" },
  underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} },
  attached: {}, ...over,
});
const rowBlank = (p) => !p.sku && !p.brandColor && !p.L && !p.W && !p.sizeText && !(num(p.priceSqft) > 0) && !(num(p.qty) > 0);
const groutName = Object.keys(SETTINGS.grouts)[0] || "";
const mortarName = Object.keys(SETTINGS.mortars)[0] || "";

const AREAS0 = [
  { id: "a1", name: "Kitchen", note: "", products: [
    mkP({ sku: "PF08-1224", brandColor: "Portfolio · Iron Gray", L: "12", W: "24", qty: "240", priceSqft: "3.49", note: "layout per drawing", grout: { checked: true, product: groutName, color: "Raven", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" }, mortar: { checked: true, product: mortarName, manual: "" } }),
    mkP({ type: "vinyl", sku: "VV017-01005", brandColor: "COREtec Pro Plus · Copano Oak", sizeText: "7x48", qty: "245", priceSqft: "4.19", cartonSf: "28.84" }),
    mkP({ type: "misc", sku: "VV017-04005", brandColor: "Stairnose · Copano Oak", qtyType: "count", qty: "4", priceSqft: "62" }),
    mkP(),
  ] },
  { id: "a2", name: "Master Bath", note: "", products: [
    mkP({ sku: "F02STERIV1224", brandColor: "Sterlina · Ivory", L: "12", W: "24", qty: "68", priceSqft: "4.79", grout: { checked: true, product: groutName, color: "", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" }, mortar: { checked: true, product: mortarName, manual: "" } }),
    mkP(),
  ] },
  { id: "a3", name: "Living Room", note: "", products: [
    mkP({ type: "carpet", sku: "RS-114", brandColor: "Rock Solid · Mineral", sizeText: "12' roll", qty: "612", priceSqft: "2.89" }),
    mkP(),
  ] },
];

function Shell() {
  const [areas, setAreas] = useState(AREAS0);
  const [tier, setTier] = useState("retail");
  const [rowSheet, setRowSheet] = useState(null);
  const [activeAreaId, setActiveAreaId] = useState("a1");
  const tv = { tier, pct: tier === "builder" ? 8 : 0 };

  const updProduct = (aid, pid, patch) => setAreas((as) => as.map((a) => a.id !== aid ? a : { ...a, products: a.products.map((p) => p.id === pid ? { ...p, ...patch } : p) }));
  const delProduct = (aid, pid) => setAreas((as) => as.map((a) => a.id !== aid ? a : { ...a, products: a.products.filter((p) => p.id !== pid) }));
  const addStock = (aid, pid, items) => setAreas((as) => as.map((a) => a.id !== aid ? a : {
    ...a, products: a.products.flatMap((p) => p.id !== pid ? [p] : [
      { ...p, ...stockPatch(items[0], p) },
      ...items.slice(1).map((it) => { const np = mkP(); return { ...np, ...stockPatch(it, np) }; }),
    ]),
  }));
  const mobileAddProduct = () => {
    const a = areas.find((x) => x.id === activeAreaId) || areas[0];
    const last = a.products[a.products.length - 1];
    if (last && rowBlank(last)) setRowSheet({ aid: a.id, pid: last.id });
    else {
      const np = mkP();
      setAreas((as) => as.map((x) => x.id !== a.id ? x : { ...x, products: [...x.products, np] }));
      setRowSheet({ aid: a.id, pid: np.id });
    }
  };
  const lineOf = (p) => { // rough retail line for the header total, fixture-only
    const q = num(p.qty); const pr = num(p.priceSqft);
    if (p.type === "misc" || p.qtyType === "count") return pr * (q || 1);
    if (num(p.cartonSf) > 0 && q > 0) return Math.ceil(q * 1.1 / num(p.cartonSf)) * num(p.cartonSf) * pr;
    return q * pr;
  };
  const retailTotal = areas.reduce((t, a) => t + a.products.reduce((s, p) => s + lineOf(p), 0), 0);
  const grandTotal = tier === "builder" ? retailTotal * 0.92 : retailTotal;
  const cur = areas.find((a) => a.id === activeAreaId) || areas[0];

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: "var(--ft-ui)" }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 ft-rail border-b border-slate-200">
        <button className="p-1 -ml-1 text-slate-600"><Menu size={20} /></button>
        <NedMark size={28} />
        <span className="ft-serif text-lg truncate flex-1">Miller Residence</span>
        <button onClick={() => setTier((t) => t === "retail" ? "builder" : "retail")} className="shrink-0 text-right" title="Tap to flip retail/builder (fixture)" style={{ lineHeight: 1.15 }}>
          <span className="ft-mono block text-[13px] font-bold" style={{ color: TIER_COLOR[tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</span>
          {tier === "builder" && <span className="block text-[8.5px] font-bold" style={{ color: TIER_COLOR.builder.main }}>Builder −8%</span>}
        </button>
        <button className="shrink-0 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500"><MoreHorizontal size={15} /></button>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-3">
          {areas.map((a, ai) => (
            <div key={a.id} data-area-drop={a.id} onClickCapture={() => setActiveAreaId(a.id)} className="rounded-lg border bg-white overflow-hidden border-slate-200">
              <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-area-head)", padding: "8px 14px", ...(a.id === activeAreaId ? { boxShadow: "inset 3px 0 0 var(--ft-brand)" } : {}) }}>
                <span className="ft-serif" style={{ fontSize: 20, lineHeight: 1.1 }}>{areaLabel(a, ai)}</span>
                <span className="ft-mono" style={{ fontSize: 10.5 }}>{money(a.products.reduce((s, p) => s + lineOf(p), 0) * (tier === "builder" ? 0.92 : 1))}</span>
              </div>
              <div>
                {a.products.map((p, pi) => {
                  const isAdder = pi === a.products.length - 1;
                  const rowEditor = rowSheet?.pid === p.id ? (
                    <MobileRowSheet p={p} areaName={areaLabel(a, ai)} canDelete={a.products.length > 1 && !(rowBlank(p) && isAdder)}
                      settings={SETTINGS} stock={STOCK} gFamilies={GFAMILIES} searchOrder={null} bookName={() => "special order"} tv={tv}
                      onPatch={(patch) => updProduct(a.id, p.id, patch)}
                      onPickStock={(items) => addStock(a.id, p.id, items)}
                      onDelete={() => delProduct(a.id, p.id)}
                      onClose={() => setRowSheet(null)} />
                  ) : null;
                  if (rowBlank(p) && isAdder) return <span key={p.id}>{rowEditor}</span>;
                  return (
                    <div key={p.id} style={{ borderBottom: "1px solid var(--ft-grid-line)" }}>
                      <MobileProductRow p={p} settings={SETTINGS} tv={tv} onOpen={() => setRowSheet({ aid: a.id, pid: p.id })} />
                      {rowEditor}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="ft-noprint flex gap-2 px-3 pt-2.5 ft-rail border-t border-slate-200" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <button className="h-[38px] shrink-0 flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-bold"><Plus size={14} /> Area</button>
        <button onClick={mobileAddProduct} className="h-[38px] flex-1 min-w-0 flex items-center justify-center gap-1 rounded-md text-[12.5px] font-bold" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}>
          <Plus size={14} className="shrink-0" /> Product<span className="truncate opacity-75 font-semibold">&nbsp;· {areaLabel(cur, areas.indexOf(cur))}</span>
        </button>
        <button style={TIER_COLOR[tier] ? { background: TIER_COLOR[tier].main } : undefined} className="h-[38px] shrink-0 flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 text-white px-4 text-[12.5px] font-bold"><Printer size={14} /> Print</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Shell />);
