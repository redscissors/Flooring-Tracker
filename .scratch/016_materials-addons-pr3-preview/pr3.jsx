// Preview harness for Materials & add-ons PR 3 (job wiring, ADR 0016).
// Reproduces the REAL App.jsx markup for the add-on-bearing surfaces —
// materials box sections, the order summary, and the printed estimate + order
// sheet — driven by the REAL catalog.js math (getAttached / attachedList).
// Served by the vite dev server; never shipped (lives in .scratch).
import React from "react";
import { createRoot } from "react-dom/client";
import { Check, AlertTriangle } from "lucide-react";
import "../../src/index.css";
import { normalizeSettings, serializeSettings, addCategory, addProduct, getAttached, attachedList, offeredCategories, offeredAttached, resolveMaterialDefault, wasteFor, ceilQty, num } from "../../src/catalog.js";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sf1 = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const u1 = (order, unit) => (order === 1 ? String(unit || "").replace(/s$/, "") : unit);
const accent = "var(--ft-type-tile)";
const rowTint = "var(--ft-area-row)";
const KSHORT = { Grout: "Grout", "Grout base": "Base", Caulk: "Caulk", Mortar: "Mortar", "Tile Backer": "Backer", Underlayment: "Underlay", Install: "Install" };
const TLBL = { tile: "Tile", vinyl: "Vinyl" };

// --- Build a settings record with two add-on categories --------------------
let s0 = normalizeSettings(undefined);
let cat = addCategory(s0.catalog, { name: "Trim & transitions", floorTypes: ["tile", "vinyl"], math: "manual", default: "Schluter Reno-U" });
const trimId = cat.categories[0].id;
const coId = cat.companies.find((c) => c.name === "Schluter").id;
cat = addProduct(cat, coId, "attached", { name: "Schluter Reno-U", categoryId: trimId, sku: "RENO-U-114", unit: "pieces", price: 18.4 });
cat = addProduct(cat, coId, "attached", { name: "Schluter Rondec", categoryId: trimId, sku: "RONDEC-125", unit: "pieces", price: 22.5 });
cat = addCategory(cat, { name: "Sealer", floorTypes: [], math: "coverage", default: "" });
const sealerId = cat.categories[1].id;
const cbpId = cat.companies.find((c) => c.name === "Custom Building Products").id;
cat = addProduct(cat, cbpId, "attached", { name: "Aqua Mix Sealer's Choice", categoryId: sealerId, sku: "AM-2050", unit: "bottles", price: 42, coverage: 250 });
const settings = normalizeSettings(serializeSettings({ ...s0, catalog: cat }));

// --- A job (one area, two tile products) -----------------------------------
const p1 = {
  id: "p1", type: "tile", qtyType: "sqft", qty: "200", L: "12", W: "12", thickness: "0.375",
  sizeText: '12" × 12"', brandColor: "Carrara Marble Polished", sku: "TIL-9001", priceSqft: "8.50", note: "",
  grout: { checked: true, product: "PermaColor Select", color: "Silverdale", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" },
  mortar: { checked: true, product: "ProLite", manual: "" },
  underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} },
  attached: { [trimId]: { checked: true, product: "Schluter Reno-U", manual: "14" }, [sealerId]: { checked: true, product: "Aqua Mix Sealer's Choice", manual: "" } },
};
const p2 = {
  id: "p2", type: "vinyl", qtyType: "sqft", qty: "340", L: "", W: "", thickness: "",
  sizeText: "7\" plank", brandColor: "Coretec Blackstone Oak", sku: "LVP-220", priceSqft: "4.20", note: "",
  grout: { checked: false, product: "", color: "", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" },
  mortar: { checked: false, product: "", manual: "" },
  underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} },
  attached: { [trimId]: { checked: true, product: "Schluter Rondec", manual: "8" } },
};
const job = { _full: true, name: "Whitman Kitchen & Bath", categories: [{ id: "a1", name: "Kitchen", products: [p1, p2] }] };

const aList = attachedList(job, settings);
const aByCat = (settings.catalog.categories || []).map((c) => ({ cat: c, rows: aList.filter((r) => r.categoryId === c.id) })).filter((g) => g.rows.length);
const addonCost = aList.reduce((t, r) => t + r.cost, 0);

// --- Surface 1: materials box add-on sections (real markup) -----------------
function AddonSections({ p }) {
  const offCats = offeredCategories(settings.catalog, p.type);
  return (
    <div className="ft-mats" style={{ background: rowTint, border: "1px solid var(--ft-border)", overflow: "hidden", "--mat-acc": accent }}>
      {offCats.map((c) => {
        const jobA = p.attached?.[c.id] || { checked: false, product: "", manual: "" };
        const names = offeredAttached(settings.catalog, c.id);
        const opts = jobA.product && !names.includes(jobA.product) ? [jobA.product, ...names] : names;
        const def = resolveMaterialDefault(names, jobA.product, c.default);
        const A = getAttached(p, settings, c);
        const pf = settings.attached?.[c.id]?.[jobA.product];
        const aUnit = A ? A.unit : pf?.unit || "";
        const covEx = c.math === "coverage" && p.qtyType === "sqft" && num(p.qty) > 0 && num(pf?.coverage) > 0 ? num(p.qty) * wasteFor(p, settings) / num(pf.coverage) : null;
        return jobA.checked ? (
          <div key={c.id} className="px-2.5 py-1.5" style={{ background: rowTint }}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <button className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
              <span className="text-sm font-medium">{c.name}</span>
              <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                <select className="ft-field text-sm rounded border border-slate-200 px-1 py-0.5" value={jobA.product} readOnly>{opts.map((n) => <option key={n}>{n}</option>)}</select>
                {pf?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{pf.sku}</span>}
              </div>
              <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{covEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{covEx.toFixed(2)} →</span>}<input readOnly type="text" value={c.math === "manual" ? jobA.manual : (A ? String(A.order) : "")} className="!w-12 text-right font-semibold rounded border border-slate-200 px-1 py-0.5 ft-field" /><span className="font-semibold">{aUnit}</span></span>
            </div>
          </div>
        ) : (
          <div key={c.id} className="px-2.5 py-1 flex items-center gap-2">
            <button className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field" />
            <span className="text-sm text-slate-500">{c.name}</span>
            <span className="text-xs text-slate-400 truncate">{jobA.product || def}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Surface 2: order summary (add-on columns + totals) ---------------------
function OrderSummary() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-band)", padding: "10px 16px" }}>
        <div className="flex items-baseline gap-2.5 min-w-0">
          <span className="uppercase shrink-0" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Materials Estimate</span>
          <span className="ft-serif" style={{ fontSize: 20 }}>Order summary</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-6" style={{ padding: 16 }}>
        <SummaryCol title="Grout" rows={[{ product: "PermaColor Select", spec: "Silverdale", order: 2, unit: "bags", cost: 10.78 }]} />
        <SummaryCol title="Mortar" rows={[{ product: "ProLite", order: 4, unit: "bags", cost: 0 }]} />
        <div>
          <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Underlayment</div>
          <div className="text-sm text-slate-400">—</div>
        </div>
        {aByCat.map(({ cat, rows }) => (
          <div key={cat.id}>
            <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>{cat.name}</div>
            {rows.map((r, i) => (
              <div key={i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                <span className="font-medium min-w-0">{r.product}{r.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{r.sku}</span>}</span>
                <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{r.order > 0 ? <>{r.order} {r.unit}</> : "—"}{r.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(r.cost)}</span> : null}</span>
              </div>
            ))}
          </div>
        ))}
        <div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Flooring</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(1700 + 1428)}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Grout &amp; caulk</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(10.78)}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Mortar</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(0)}</span></div>
            {aByCat.map(({ cat, rows }) => { const c = rows.reduce((t, r) => t + r.cost, 0); return c > 0 ? <div key={cat.id} className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>{cat.name}</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(c)}</span></div> : null; })}
            <div className="flex justify-between items-baseline" style={{ marginTop: 4, paddingTop: 10, borderTop: "2px solid var(--ft-text)" }}><span style={{ fontSize: 13, fontWeight: 700 }}>Total</span><span className="ft-serif" style={{ fontSize: 26, lineHeight: 1 }}>{money(1700 + 1428 + 10.78 + addonCost)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
function SummaryCol({ title, rows }) {
  return (
    <div>
      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>{title}</div>
      {rows.map((g, i) => (
        <div key={i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
          <span className="font-medium min-w-0">{g.product}{g.spec && <span className="text-slate-500 font-normal"> · {g.spec}</span>}</span>
          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{g.order} {g.unit}{g.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.cost)}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}

// --- Surface 3: printed estimate inline line + order sheet ------------------
function PrintInline({ p }) {
  const mats = [];
  if (p.grout.checked) mats.push({ kind: "Grout", name: p.grout.product, spec: p.grout.color, order: p.id === "p1" ? 2 : 0, detail: '1/8" joint' });
  if (p.mortar.checked) mats.push({ kind: "Mortar", name: p.mortar.product, spec: "", order: 4, detail: "" });
  for (const c of (settings.catalog.categories || [])) { const A = getAttached(p, settings, c); if (A) mats.push({ kind: c.name, addon: true, name: A.product, spec: "", order: A.order, detail: "" }); }
  return (
    <div style={{ padding: "0 12px 4px 24px", fontSize: 9.5, color: "var(--ft-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
      {mats.map((m, i) => (
        <span key={i}>
          <span style={{ fontWeight: 700, color: "var(--ft-brand-deep)" }}>{KSHORT[m.kind] || m.kind}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.name}{m.spec && <> — {m.spec}</>}{m.detail && <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span>}
        </span>
      ))}
    </div>
  );
}
function OrderSheet() {
  const lines = aList.filter((r) => r.order > 0);
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-[8.5px] text-slate-500 border-b border-slate-400" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>
          <th className="w-6 py-1" /><th className="text-left font-semibold py-1 pr-2">Item</th><th className="text-left font-semibold py-1 pr-2">SKU</th><th className="text-left font-semibold py-1 pr-2">Area</th><th className="text-right font-semibold py-1">Order</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((m, i) => (
          <tr key={i} className="border-b border-slate-200 align-baseline">
            <td className="py-1.5 text-center text-slate-400">☐</td>
            <td className="py-1.5 pr-2">{m.product} <span className="text-slate-400 text-[10.5px]">{m.category}</span></td>
            <td className="py-1.5 pr-2 ft-mono text-[11px]">{m.sku}</td>
            <td className="py-1.5 pr-2 text-slate-500">all areas</td>
            <td className="py-1.5 text-right font-semibold whitespace-nowrap">{m.order} {m.unit} <span className="text-slate-400 font-normal text-[10.5px]">({m.exact.toFixed(2)})</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductRow({ p, label }) {
  return (
    <div style={{ marginBottom: 12, border: "1px solid var(--ft-border)", background: "var(--ft-card)" }}>
      <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--ft-text)" }}>{p.brandColor} <span style={{ color: "var(--ft-muted)", fontSize: 11 }}>{TLBL[p.type]} · {p.sizeText} · {p.qty} sf</span> <span className="ft-mono" style={{ fontSize: 10, color: "var(--ft-faint)" }}>({label})</span></div>
      <div style={{ padding: "4px 8px 7px 26px", background: rowTint }}><AddonSections p={p} /></div>
    </div>
  );
}

function Panel({ title, dark }) {
  return (
    <div className={dark ? "ned-dark" : "ned-light"} style={{ flex: 1, minWidth: 560, background: "var(--ft-cream)", padding: 22 }}>
      <div className="ft-serif" style={{ fontSize: 15, color: "var(--ft-text)", marginBottom: 4 }}>{title}</div>
      <div className="ft-eyebrow" style={{ fontSize: 10, marginBottom: 10, color: "var(--ft-muted)" }}>ADR 0016 · job wiring: add-on chips, math, summary, print</div>

      <div className="ft-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Materials box — add-on sections (tile: manual "Trim" + coverage "Sealer")</div>
      <ProductRow p={p1} label="tile" />
      <div className="ft-eyebrow" style={{ fontSize: 10, margin: "4px 0 6px" }}>Materials box — vinyl row (Trim offered, Sealer offered; Sealer unchecked)</div>
      <ProductRow p={p2} label="vinyl" />

      <div className="ft-eyebrow" style={{ fontSize: 10, margin: "14px 0 6px" }}>Order summary — add-on columns + per-category total</div>
      <OrderSummary />

      <div className="ft-eyebrow" style={{ fontSize: 10, margin: "14px 0 6px" }}>Printed estimate — inline add-on lines under each product</div>
      <div className="ft-light" style={{ background: "#fff", color: "#000", padding: "10px 8px", borderRadius: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 12, padding: "0 12px" }}>Carrara Marble Polished <span style={{ fontWeight: 400, color: "#666" }}>· Tile</span></div>
        <PrintInline p={p1} />
        <div style={{ fontWeight: 700, fontSize: 12, padding: "6px 12px 0" }}>Coretec Blackstone Oak <span style={{ fontWeight: 400, color: "#666" }}>· Vinyl</span></div>
        <PrintInline p={p2} />
      </div>

      <div className="ft-eyebrow" style={{ fontSize: 10, margin: "14px 0 6px" }}>Order sheet — add-on material lines</div>
      <div className="ft-light" style={{ background: "#fff", color: "#000", padding: "10px 12px", borderRadius: 4 }}><OrderSheet /></div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <div style={{ display: "flex", gap: 0, alignItems: "stretch", minHeight: "100vh" }}>
    <Panel title="Light" />
    <Panel title="Dark" dark />
  </div>
);
