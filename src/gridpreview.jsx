// Dev-only harness (grid-preview.html): the REAL grid dropdowns and popups —
// TypeSelect, UnitPick, the materials drawer's FitSelects, GridPriceCell's
// cost → markup → price popup, LineMenu and LineWastePop — over local state,
// no Supabase and no App shell (ADR 0048 preview proof; the rows themselves
// live inside App.jsx). Not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MoreHorizontal, UserRound, Plus, Trash2, Check } from "lucide-react";
import "./index.css";
import { FitSelect, GroutColorOptions, BuilderCombo, PopMenu, useEscClose } from "./widgets.jsx";
import { TypeSelect, UnitPick, GridPriceCell, GridOmniSearch, GridProductBox } from "./grid.jsx";
import { StockSearch } from "./search.jsx";
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
      <div data-shot="row" onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }} className="flex items-center gap-3 px-3 py-2 text-[12px] font-semibold" style={{ background: ROW_WASH }}>
        <span data-shot="type" className="self-stretch flex"><TypeSelect compact type={p.type} onChange={(type) => patch({ type })} /></span>
        <span className="flex-1 font-bold">{p.brandColor}</span>
        <span className="ft-mono">{p.cartonSf} SF/<span data-shot="unit" className="inline-flex"><UnitPick value={p.cartonUnit} options={BUNDLE_UNITS} onChange={(cartonUnit) => patch({ cartonUnit })} title="What the coverage counts in" size={11} /></span></span>
        <span data-shot="price" className="w-24 flex self-stretch items-center"><GridPriceCell p={p} tier="retail" onPatch={patch} title="Price per sq ft" /></span>
        <span data-shot="price-tier" className="w-24 flex self-stretch items-center"><GridPriceCell p={p} tier="builder" tierPrice={Math.round(parseFloat(p.priceSqft || 0) * 90) / 100} onPatch={patch} title="Price per sq ft" /></span>
        <span data-shot="order" className="self-stretch flex items-center justify-end" style={{ width: 64, borderLeft: "1px solid var(--ft-row-line)" }}>
          <span className="flex flex-col items-end" style={{ lineHeight: 1.1 }}>
            <span className="ft-mono">16 <span style={{ fontSize: 9.5 }}>CT</span></span>
            <button data-shot="waste-tag" onClick={(e) => setWaste({ x: 0, y: 0, anchor: e.currentTarget.parentElement.closest("span[data-shot]") })} className="hover:underline" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--ft-faint)" }}>+{p.waste === "" ? 10 : p.waste}%</button>
          </span>
        </span>
        <span className="self-stretch flex items-center justify-center" style={{ width: 44, borderLeft: "1px solid var(--ft-row-line)" }}>
          <button data-shot="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left - 200, y: r.bottom, anchor: e.currentTarget.parentElement }); }} className="p-0.5 rounded text-slate-400 hover:text-slate-600"><MoreHorizontal size={13} /></button>
        </span>
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

const STOCK = [
  { active: true, sku: "DAL-VL1224B", description: "DALTILE VOLUME 1.0 BONE 12X24 MATTE", product: "Volume 1.0", brand: "Daltile", type: "tile", size: "12x24", priceSqft: 4.29, sfPerUnit: 15.5, unit: "SF", orderUnit: "CT" },
  { active: true, sku: "DAL-VL1224G", description: "DALTILE VOLUME 1.0 GRAY 12X24 MATTE", product: "Volume 1.0", brand: "Daltile", type: "tile", size: "12x24", priceSqft: 4.29, sfPerUnit: 15.5, unit: "SF", orderUnit: "CT" },
  { active: true, sku: "DAL-VL0624B", description: "DALTILE VOLUME 1.0 BONE 6X24 MATTE", product: "Volume 1.0", brand: "Daltile", type: "tile", size: "6x24", priceSqft: 4.49, sfPerUnit: 11.6, unit: "SF", orderUnit: "CT" },
  { active: true, sku: "AR-214", description: "ARVORA GLACIER MATTE 12X24", product: "Arvora", type: "tile", size: "12x24", priceSqft: 5.1, sfPerUnit: 15.5, unit: "SF", orderUnit: "CT" },
];
const BUILDERS = [{ id: "b1", name: "Ridgeline Homes" }, { id: "b2", name: "Rivera Custom Builders" }, { id: "b3", name: "Redstone Construction" }];

function Searches() {
  const [q, setQ] = useState("");
  const [prod, setProd] = useState("");
  const [picked, setPicked] = useState("");
  const [builder, setBuilder] = useState(null);
  const inp = "ft-field w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  return (
    <div className="space-y-5">
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--ft-border)", background: ROW_WASH }}>
        <div className="grid items-stretch" style={{ gridTemplateColumns: "1fr 1.4fr", height: 34 }}>
          <div data-shot="omni" className="flex" style={{ borderRight: "1px solid var(--ft-border)" }}>
            <GridOmniSearch stock={STOCK} stockReady query={q} onQuery={setQ} onPick={(it) => { setPicked(it.sku); setQ(""); }} onPickMany={() => {}} onManual={() => {}} onAbandon={() => setQ("")} />
          </div>
          <div data-shot="product" className="relative">
            <GridProductBox value={prod} stock={STOCK} onChange={setProd} onPick={(it) => { setProd(it.description); setPicked(it.sku); }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 max-w-3xl">
        <div data-shot="stock"><div className="ft-eyebrow text-[10px] mb-1">Settings — add from the price book</div><StockSearch stock={STOCK} inp={inp} onPick={(it) => setPicked(it.sku)} /></div>
        <div data-shot="builder"><div className="ft-eyebrow text-[10px] mb-1">Customer — builder</div><BuilderCombo value={builder} builders={BUILDERS} onSelect={setBuilder} onAddBuilder={() => {}} inp={inp} /></div>
      </div>
      <pre className="text-[10px] text-slate-500" data-search-state>{JSON.stringify({ picked, builder })}</pre>
    </div>
  );
}

// The sidebar customer row and an area band as App.jsx draws them, with its
// right-click / option-chip menus on the real PopMenu (App's own wiring needs
// a signed-in session).
function ShellMenus() {
  const [cust, setCust] = useState(null);
  const [area, setArea] = useState(null);
  const [opt, setOpt] = useState("A");
  useEscClose(!!cust, () => setCust(null));
  useEscClose(!!area, () => setArea(null));
  const item = "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] text-left hover:bg-slate-100";
  const inLabel = "uppercase text-[9px] font-bold tracking-widest text-slate-400";
  const fromChip = area?.anchor?.isConnected;
  const pick = (o) => { setOpt(o); setArea(null); };
  return (
    <div className="flex gap-6 items-start">
      <div className="w-60 p-2 rounded-lg" style={{ background: "var(--ft-cream)", border: "1px solid var(--ft-border)" }}>
        {["Jordan Whitaker", "Maria Delgado", "Sam Okafor"].map((n, i) => (
          <div key={n} data-shot={"cust" + i} onContextMenu={(e) => { e.preventDefault(); setCust({ x: e.clientX, y: e.clientY, anchor: e.currentTarget }); }}
            className={`w-full rounded-md flex items-center border ${i === 0 ? "bg-white border-slate-200" : "border-transparent hover:bg-slate-50"}`}>
            <div className="py-2 pl-[13px] pr-1 text-[12.5px] font-semibold truncate">{n}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-lg overflow-hidden" style={{ border: "1px solid var(--ft-border)" }}>
        <div data-shot="band" onContextMenu={(e) => { e.preventDefault(); setArea({ x: e.clientX, y: e.clientY }); }} className="flex items-baseline gap-2.5" style={{ background: "var(--ft-area-head)", padding: "8px 14px" }}>
          <span className="ft-serif" style={{ fontSize: 20, lineHeight: 1.1 }}>Kitchen</span>
          <button data-shot="chip" onClick={(e) => setArea({ x: 0, y: 0, anchor: e.currentTarget })} className="rounded-md px-2 py-0.5 text-[10.5px] font-bold"
            style={{ border: "1px dashed var(--ft-border-strong)", color: "var(--ft-muted)" }}>{opt ? "OPTION " + opt : "SHARED"}</button>
        </div>
        <div className="px-3 py-3 text-[12px] text-slate-400">(area rows)</div>
      </div>
      {cust && (
        <PopMenu at={cust} width={196} onClose={() => setCust(null)} className="p-1">
          <button className={item} onClick={() => setCust(null)}><UserRound size={13} className="text-slate-400" /> Customer details…</button>
          <button className={item} onClick={() => setCust(null)}><Plus size={13} className="text-slate-400" /> New project</button>
          <div className="border-t border-slate-100 my-1" />
          <button className={`${item} text-red-600 hover:bg-red-50`} onClick={() => setCust(null)}><Trash2 size={13} /> Delete customer…</button>
        </PopMenu>
      )}
      {area && (
        <PopMenu at={area} width={212} onClose={() => setArea(null)} className="p-1" trail={<span className={inLabel + " pl-2.5"}>This area is in</span>}>
          {!fromChip && <div className={inLabel + " px-2.5 pt-1.5 pb-0.5"}>This area is in</div>}
          <button className={item} onClick={() => pick("")}><span className="w-2 h-2 rounded-sm" style={{ background: "var(--ft-faint)" }} />Shared — every option{!opt && <Check size={12} className="ml-auto" />}</button>
          {["A", "B"].map((o) => <button key={o} className={item} onClick={() => pick(o)}><span className="w-2 h-2 rounded-sm" style={{ background: o === "A" ? "#57703A" : "#8a5a14" }} />Option {o}{opt === o && <Check size={12} className="ml-auto" />}</button>)}
          <button className={item} onClick={() => pick("C")}><span className="w-2 h-2 rounded-sm" style={{ background: "#3b6a8a" }} />New option…</button>
          <div className="border-t border-slate-100 my-1" />
          <button className={item} onClick={() => setArea(null)}>Duplicate into Option A…</button>
          <button className={item} onClick={() => setArea(null)}>Duplicate into new option…</button>
          {opt && <button className={item} onClick={() => setArea(null)}>Rename Option {opt}…</button>}
          {opt && <button className={item} onClick={() => setArea(null)}>Print this option…</button>}
        </PopMenu>
      )}
    </div>
  );
}

// Try the search boxes' open/close speed before one is locked into index.css.
const SPEEDS = [["Quicker", 180, 150], ["Current", 240, 200], ["Softer", 320, 260]];
function SpeedToggle() {
  const [cur, setCur] = useState("Current");
  const set = ([name, open, close]) => {
    document.documentElement.style.setProperty("--ft-spop-in", open + "ms");
    document.documentElement.style.setProperty("--ft-spop-out", close + "ms");
    setCur(name);
  };
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold" data-speed>
      <span className="text-slate-500 mr-1">Search box speed</span>
      {SPEEDS.map((sp) => (
        <button key={sp[0]} onClick={() => set(sp)} className={`px-2.5 py-1 rounded-md border ${cur === sp[0] ? "border-slate-800 font-extrabold" : "border-slate-200 text-slate-500"}`}>
          {sp[0]} <span className="ft-mono text-[10px] text-slate-400">{sp[1]}/{sp[2]}ms</span>
        </button>
      ))}
    </div>
  );
}

function Page() {
  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "var(--ft-cream)", maxWidth: 1100 }}>
      <h1 className="ft-serif text-2xl">Grid dropdowns — the real components</h1>
      <Row />
      <h2 className="text-base font-extrabold pt-4">Customer &amp; area menus</h2>
      <ShellMenus />
      <h2 className="text-base font-extrabold pt-4">Search boxes</h2>
      <SpeedToggle />
      <Searches />
      <div style={{ height: 420 }} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Page />);
