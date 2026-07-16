// Preview harness for the pricing-tier + print-pricing feature (spec
// 2026-07-16). The header column-1 controls are the REAL SegBar / FilesPop
// exported from App.jsx; tier prices, chips, and the estimate paper's numbers
// all flow through the REAL pricing lens (tierView / tierUnitPrice / tierTag)
// and the REAL catalog math (getCarton, getGrout, getMortar). The estimate
// paper markup mirrors renderEstimatePaper with the same showUnit/showTotals
// gating expressions. Served by the vite dev server; never shipped.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Save, History, ClipboardList, Trash2, Copy, Printer, Plus } from "lucide-react";
import "../../src/index.css";
import { num, getCarton, getPieceCarton, getGrout, getMortar } from "../../src/catalog.js";
import { tierView, tierUnitPrice, employeeNoCost, tierTag, normPricing, normPrintPricing } from "../../src/pricing.js";
import { SegBar, FilesPop } from "../../src/App.jsx";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sf1 = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const miscQty = (p) => (p.qtyType === "count" && String(p.qty ?? "").trim() !== "" ? num(p.qty) : 1);
const TIER_SHORT = { builder: "bldr", employee: "emp", sale: "sale", custom: "cust" };

// --- fixture -------------------------------------------------------------------

const settings = {
  waste: { tile: 10, floor: 10 },
  pricing: { builderPct: 8, salePct: 10 },
  grouts: { "PermaColor Select": { coverage: 30, unit: "bags", price: 21.5, sku: "PCS-GRT" } },
  mortars: { "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 32.99, sku: "PRL-50" } },
  underlayments: {},
  attached: {},
  catalog: { categories: [] },
};

const base = { qtyType: "sqft", qty: "", L: "", W: "", thickness: "", sizeText: "", cartonSf: "", cartonPc: "", cartonUnit: "CT", cartonManual: "", priceSqft: "", costSqft: "", sku: "", brandColor: "", note: "", grout: { checked: false }, mortar: { checked: false }, underlay: { checked: false } };
const PROJECT = {
  id: "j1", name: "Maple St remodel", address: "412 Maple St", notes: "",
  priceTier: "retail", customPct: "", printPricing: "full",
  categories: [
    { id: "a1", name: "Kitchen", note: "", products: [
      // Stock tile — priced from the shop book, NO cost (employee flags it).
      { ...base, id: "p1", type: "tile", L: "12", W: "24", thickness: "0.375", sizeText: "12×24", brandColor: "Earth Ash Gray", sku: "ANDEARAG1224", cartonSf: "15.5", priceSqft: "4.61", qty: "212",
        grout: { checked: true, product: "PermaColor Select", color: "Silverado", sku: "PCS-SIL", joint: 0.125, manual: "", caulk: "2", caulkSku: "PCS-SIL-C", caulkPrice: "9.85" },
        mortar: { checked: true, product: "ProLite", manual: "" } },
    ] },
    { id: "a2", name: "Family room", note: "", products: [
      // Special-order vinyl — snapshotted vendor cost, so Employee reprices it.
      { ...base, id: "p2", type: "vinyl", sizeText: '7" × 48"', brandColor: "Adura Max Sausalito", sku: "APX020", bookId: "man", cartonSf: "23.2", priceSqft: "5.49", costSqft: "3.61", qty: "340" },
      // Hand-typed misc line — flat price, no cost.
      { ...base, id: "p3", type: "misc", qtyType: "count", brandColor: "Custom threshold — solid oak", priceSqft: "45", qty: "2" },
    ] },
  ],
};

// --- printProduct-lite (quantities via the real catalog math) -------------------

function calcLine(p, s) {
  const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
  const C = p.type === "misc" ? null : getCarton(p, s);
  const PC = getPieceCarton(p);
  const line = p.type === "misc" ? num(p.priceSqft) * (PC ? PC.pieces : miscQty(p)) : (C ? C.order * C.sf : sf) * num(p.priceSqft);
  const qtyText = p.type === "misc" ? `${miscQty(p)} EA` : C && C.order > 0 ? `${C.order} ${C.unit}` : num(p.qty) > 0 ? `${p.qty} sf` : "";
  return { C, line, qtyText };
}

const PRINT_COLS = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.6fr 0.8fr 0.8fr";
const PRINT_COLS_UNIT = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.6fr 0.8fr";
const PRINT_COLS_NONE = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.8fr";
const DASH = <span style={{ color: "var(--ft-faint)" }}>—</span>;
const TLBL = { tile: "Tile", vinyl: "Vinyl", misc: "Misc" };

// --- estimate paper (mirrors renderEstimatePaper's gating) ----------------------

function EstimatePaper({ proj, tv }) {
  const tSet = tv.settings;
  const pMode = normPrintPricing(proj.printPricing);
  const showUnit = pMode !== "none", showTotals = pMode === "full";
  const pCols = showTotals ? PRINT_COLS : showUnit ? PRINT_COLS_UNIT : PRINT_COLS_NONE;
  const tag = showUnit ? tierTag(tv.tier, tv.pct) : "";
  let flooring = 0, mats = [];
  tv.proj.categories.forEach((a) => a.products.forEach((p) => {
    flooring += calcLine(p, tSet).line;
    const G = getGrout(p, tSet), M = getMortar(p, tSet);
    if (G) mats.push({ kind: "Grout", name: `${p.grout.product} — ${p.grout.color}`, sku: p.grout.sku, order: G.order, unit: G.unit, price: G.price, cost: G.order * G.price });
    if (p.grout?.checked && num(p.grout.caulk) > 0) mats.push({ kind: "Caulk", name: `${p.grout.product} matching caulk — ${p.grout.color}`, sku: p.grout.caulkSku, order: num(p.grout.caulk), unit: "tubes", price: num(p.grout.caulkPrice), cost: num(p.grout.caulk) * num(p.grout.caulkPrice) });
    if (M) mats.push({ kind: "Mortar", name: M.product, sku: tSet.mortars[M.product]?.sku, order: M.order, unit: M.unit, price: M.price, cost: M.order * M.price });
  }));
  const materialsCost = mats.reduce((t, m) => t + m.cost, 0);
  const grandTotal = flooring + materialsCost;
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm" style={{ padding: 28 }}>
      <div className="flex justify-between items-center mb-5" style={{ borderBottom: "2px solid var(--ft-text)", paddingBottom: 16 }}>
        <div className="ft-serif" style={{ fontSize: 22 }}>KEIM</div>
        <div className="flex flex-col items-end" style={{ gap: 4 }}>
          <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: "var(--ft-brand-deep)" }}>Selection Sheet</div>
          <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
          {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
        </div>
      </div>
      {tv.proj.categories.map((a, ai) => {
        const areaSf = a.products.reduce((t, p) => t + (p.qtyType === "sqft" ? num(p.qty) : 0), 0);
        const areaTotal = a.products.reduce((t, p) => t + calcLine(p, tSet).line, 0);
        return (
          <div key={a.id} className="mb-5">
            <div className="flex justify-between items-center" style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "8px 12px" }}>
              <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Area {String(ai + 1).padStart(2, "0")} · {a.name}</div>
              <div className="ft-mono" style={{ fontSize: 10 }}>{[areaSf > 0 ? `${sf1(areaSf)} SF` : "", showTotals && areaTotal > 0 ? money(areaTotal) : ""].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: pCols, gap: 7, padding: "8px 12px 6px", borderBottom: "1px solid var(--ft-text)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-faint)" }}>
              <div>Size</div><div>Product / Color</div><div>SKU</div><div>Cov.</div>
              <div className="text-right">SF</div>{showUnit && <div className="text-right">Price</div>}<div className="text-right">Order</div>{showTotals && <div className="text-right">Total</div>}
            </div>
            {a.products.map((p, pi) => {
              const c = calcLine(p, tSet);
              return (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: pCols, gap: 7, padding: "2px 12px 6px", fontSize: 11, alignItems: "baseline", borderTop: pi > 0 ? "1px solid var(--ft-border)" : "none" }}>
                  <div style={{ whiteSpace: "nowrap" }}>{p.sizeText || DASH}</div>
                  <div style={{ fontWeight: 700 }}>{p.brandColor}<span style={{ fontWeight: 400, fontSize: 10, color: "var(--ft-muted)" }}> · {TLBL[p.type]}</span></div>
                  <div className="ft-mono" style={{ fontSize: 9 }}>{p.sku || DASH}</div>
                  <div className="ft-mono" style={{ fontSize: 9.5 }}>{num(p.cartonSf) > 0 ? <>{sf1(num(p.cartonSf))}<span style={{ fontSize: 7.5, color: "var(--ft-muted)" }}> SF/CT</span></> : DASH}</div>
                  <div className="text-right">{p.qtyType === "sqft" && num(p.qty) > 0 ? sf1(num(p.qty)) : DASH}</div>
                  {showUnit && <div className="text-right">{num(p.priceSqft) > 0 ? money(num(p.priceSqft)) : DASH}</div>}
                  <div className="text-right whitespace-nowrap">{c.qtyText || DASH}</div>
                  {showTotals && <div className="text-right" style={{ fontWeight: 700 }}>{c.line > 0 ? money(c.line) : DASH}</div>}
                </div>
              );
            })}
          </div>
        );
      })}
      {mats.length > 0 && (
        <div className="mb-4">
          <div className="uppercase mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Setting materials &amp; sundries</div>
          <div style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ columns: 2, columnGap: 28 }}>
              {mats.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--ft-brand-deep)", marginBottom: 3 }}>{m.kind}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{m.name} · {m.order} {m.unit} <span className="ft-mono" style={{ fontWeight: 400, fontSize: 10 }}>{!showUnit ? "" : showTotals && m.cost > 0 ? money(m.cost) : m.price > 0 ? `${money(m.price)}/${m.unit.replace(/s$/, "")}` : ""}</span></div>
                  <div style={{ fontSize: 10, color: "var(--ft-muted)" }}>{m.sku}</div>
                </div>
              ))}
            </div>
            {showTotals && (
              <div className="flex justify-between items-baseline" style={{ borderTop: "1px solid var(--ft-border)", marginTop: 2, paddingTop: 8 }}>
                <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Materials subtotal</div>
                <div className="ft-mono" style={{ fontSize: 12, fontWeight: 700 }}>{money(materialsCost)}</div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex justify-between items-center gap-4" style={{ borderTop: "2px solid var(--ft-text)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>
          {[showTotals && flooring > 0 ? `Flooring ${money(flooring)}` : "", showTotals && materialsCost > 0 ? `Materials ${money(materialsCost)}` : "", "552 SF measured"].filter(Boolean).join(" · ")}
        </div>
        {showTotals && grandTotal > 0 && <div className="flex items-baseline gap-2 shrink-0"><span className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Estimated total</span><span className="ft-serif" style={{ fontSize: 22 }}>{money(grandTotal)}</span></div>}
      </div>
      <div className="mt-2" style={{ fontSize: 10.5, color: "var(--ft-muted)" }}>Quantities{showUnit ? " and prices" : ""} are estimates, incl. 10% waste. Confirm against product specs and final measurements before ordering.</div>
    </div>
  );
}

// --- header column mock (real SegBar / FilesPop) --------------------------------

function HeaderRow({ proj, upd, pcts }) {
  const btn = "h-[30px] flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 whitespace-nowrap bg-white";
  return (
    <div className="rounded-lg border" style={{ padding: 18, background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.28fr 1.08fr", gap: 16 }}>
        <div className="flex flex-col gap-1.5 min-w-0" style={{ height: 92 }}>
          <div className="flex items-center justify-between gap-2 min-w-0 h-[20px]">
            <div className="ft-eyebrow text-[9px] truncate">Miller Custom Homes</div>
            <FilesPop attachments={[{ id: "f1", name: "measure-sheet.pdf", size: 88000 }, { id: "f2", name: "tile-photo.jpg", size: 421000 }]} onOpen={() => {}} onDelete={() => {}} onAdd={() => {}} />
          </div>
          <SegBar value={proj.priceTier} inputValue={proj.customPct}
            onChange={(v) => upd({ priceTier: v })}
            onInput={(v) => upd({ priceTier: "custom", customPct: v })}
            options={[
              { v: "retail", label: "Retail", title: "Retail pricing" },
              { v: "builder", label: "Bldr", title: `Builder pricing — ${pcts.builderPct}% off retail` },
              { v: "employee", label: "Emp", title: "Employee pricing — cost + 6%" },
              { v: "sale", label: "Sale", title: `Sale pricing — ${pcts.salePct}% off retail` },
              { v: "custom", input: true, title: "Custom % off retail" },
            ]} />
          <SegBar value={proj.printPricing}
            onChange={(v) => upd({ printPricing: v })}
            options={[
              { v: "full", label: "All $", title: "Print every price and total" },
              { v: "unit", label: "Unit $", title: "Print unit prices only" },
              { v: "none", label: "No $", title: "Print no pricing" },
            ]} />
        </div>
        <textarea readOnly placeholder="Project notes…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm resize-none focus:outline-none" style={{ height: 92, background: "var(--ft-cream)" }} />
        <div className="flex flex-col justify-between gap-1.5" style={{ height: 92 }}>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
            <div className="flex gap-1.5">
              <button className={btn}><Save size={14} /> Version</button>
              <button className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-white"><History size={14} /></button>
            </div>
            <div className="flex gap-1.5">
              <button className={btn}><ClipboardList size={14} /> Order sheet</button>
              <button className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
            <button className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 text-white"><Copy size={14} /> Order entry</button>
            <button className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 text-white"><Printer size={14} /> Print</button>
          </div>
        </div>
      </div>
      <button className="mt-3 w-full h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}><Plus size={14} /> Add area</button>
    </div>
  );
}

// Per-line tier chips, as the edit grid shows them.
function ChipsDemo({ tv }) {
  if (tv.tier === "retail") return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-1.5">
      <div className="ft-eyebrow text-[9px]">Edit-grid tier chips</div>
      {tv.proj.categories.flatMap((a) => a.products).map((p) => {
        const orig = PROJECT.categories.flatMap((a) => a.products).find((o) => o.id === p.id);
        const tp = tierUnitPrice(orig, tv.tier, tv.pct);
        const noCost = tv.tier === "employee" && employeeNoCost(orig);
        return (
          <div key={p.id} className="flex items-center gap-2">
            <span className="w-56 truncate text-slate-500">{orig.brandColor}</span>
            <span className="ft-mono text-slate-400">{money(num(orig.priceSqft))} retail</span>
            {tp != null && <span className="shrink-0 rounded px-1.5 py-0.5 font-medium" style={{ background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" }}>{TIER_SHORT[tv.tier]} {money(tp)}{orig.type === "misc" ? "/ea" : "/sf"}</span>}
            {noCost && <span className="shrink-0 rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 font-medium">no cost — retail</span>}
          </div>
        );
      })}
    </div>
  );
}

function Preview() {
  const [proj, setProj] = useState(PROJECT);
  const upd = (patch) => setProj((p) => ({ ...p, ...patch }));
  const tv = tierView(proj, settings);
  const pcts = normPricing(settings.pricing);
  return (
    <div className="max-w-4xl mx-auto my-8 space-y-5" data-ready="1">
      <HeaderRow proj={proj} upd={upd} pcts={pcts} />
      <ChipsDemo tv={tv} />
      <EstimatePaper proj={proj} tv={tv} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
