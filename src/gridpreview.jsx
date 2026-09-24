// Dev-only harness (grid-preview.html): the REAL grid dropdowns and popups —
// TypeSelect, UnitPick, the materials drawer's FitSelects, GridPriceCell's
// cost → markup → price popup, LineMenu and LineWastePop — over local state,
// no Supabase and no App shell (ADR 0048 preview proof; the rows themselves
// live inside App.jsx). Not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MoreHorizontal } from "lucide-react";
import "./index.css";
import { FitSelect, GroutColorOptions } from "./widgets.jsx";
import { TypeSelect, UnitPick, GridPriceCell } from "./grid.jsx";
import { LineMenu } from "./linemenu.jsx";
import { LineWastePop } from "./linewaste.jsx";
import { mergeSettings } from "./catalog.js";
import { newProduct } from "./model.js";
import { ROW_WASH } from "./uiconst.js";
import { BUNDLE_UNITS } from "./units.js";

const settings = mergeSettings({});
const GROUTS = ["Prism", "Permacolor Select", "Polyblend Plus"];
const COLOR_GROUPS = { stock: ["Bright White", "Delorean Gray", "Frost", "Oyster Gray", "Pewter", "Charcoal"], special: ["Antique White", "Bone", "Fawn", "Mocha", "Walnut"] };
const MORTARS = ["VersaBond", "MegaLite", "Ultraflex LFT"];

function Row() {
  const [p, setP] = useState(() => ({ ...newProduct(), type: "tile", brandColor: "Daltile Volume 1.0 Bone", sizeText: "12x24", cartonSf: "15.5", priceSqft: "4.29", costSqft: "2.35", qty: "220",
    grout: { ...newProduct().grout, checked: true, product: "Prism", color: "Delorean Gray" }, mortar: { ...newProduct().mortar, checked: true, product: "VersaBond" } }));
  const patch = (x) => setP((q) => ({ ...q, ...x }));
  const [menu, setMenu] = useState(null);
  const [waste, setWaste] = useState(null);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--ft-border)" }}>
      <div className="flex items-center gap-3 px-3 py-2 text-[12px] font-semibold" style={{ background: ROW_WASH }}>
        <span data-shot="type"><TypeSelect type={p.type} onChange={(type) => patch({ type })} /></span>
        <span className="flex-1 font-bold">{p.brandColor}</span>
        <span className="ft-mono">{p.cartonSf} SF/<span data-shot="unit" className="inline-flex"><UnitPick value={p.cartonUnit} options={BUNDLE_UNITS} onChange={(cartonUnit) => patch({ cartonUnit })} title="What the coverage counts in" size={11} /></span></span>
        <span data-shot="price" className="w-24"><GridPriceCell p={p} tier="retail" onPatch={patch} /></span>
        <button data-shot="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left - 200, y: r.bottom }); }} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-[color:var(--ft-hover)]"><MoreHorizontal size={16} /></button>
      </div>
      <div className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm" style={{ background: ROW_WASH, borderTop: "1px solid var(--ft-border)" }}>
        <span className="font-medium">Grout</span>
        <span data-shot="grout"><FitSelect sm bg={ROW_WASH} value={p.grout.product} display={p.grout.product} onChange={(e) => patch({ grout: { ...p.grout, product: e.target.value } })}>{GROUTS.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect></span>
        <span data-shot="color"><FitSelect sm bg={ROW_WASH} value={p.grout.color} display={p.grout.color || "Color…"} onChange={(e) => patch({ grout: { ...p.grout, color: e.target.value } })}><option value="">Color…</option><GroutColorOptions groups={COLOR_GROUPS} /></FitSelect></span>
        <span className="font-medium ml-4">Mortar</span>
        <span data-shot="mortar"><FitSelect sm bg={ROW_WASH} value={p.mortar.product} display={p.mortar.product} onChange={(e) => patch({ mortar: { ...p.mortar, product: e.target.value } })}>{MORTARS.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect></span>
        <button data-shot="waste" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setWaste({ x: r.left, y: r.bottom + 4 }); }} className="ml-auto text-[11px] font-bold text-slate-500 underline decoration-dotted">waste {p.waste === "" ? "job" : p.waste + "%"}</button>
      </div>
      <LineMenu menu={menu} title={p.brandColor} subtitle="Kitchen" areas={[{ id: "a2", name: "Primary bath" }]} canDelete wasteText="job 10%"
        onClose={() => setMenu(null)} onDuplicate={() => setMenu(null)} onMoveTo={() => setMenu(null)} onSample={() => setMenu(null)} onNote={() => setMenu(null)}
        onWaste={() => { setWaste(menu); setMenu(null); }} onFlag={() => setMenu(null)} onDelete={() => setMenu(null)} />
      <LineWastePop pop={waste} p={p} s={settings} dflt={settings.waste?.tile} onPatch={patch} onClose={() => setWaste(null)} />
      <pre className="px-3 py-2 text-[10px] text-slate-500" data-state>{JSON.stringify({ type: p.type, unit: p.cartonUnit, grout: p.grout.product, color: p.grout.color, mortar: p.mortar.product, waste: p.waste, price: p.priceSqft, cost: p.costSqft })}</pre>
    </div>
  );
}

function Page() {
  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "var(--ft-cream)", maxWidth: 1100 }}>
      <h1 className="ft-serif text-2xl">Grid dropdowns — the real components</h1>
      <Row />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Page />);
