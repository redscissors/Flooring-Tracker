// Preview harness for the mobile shell (mobile redesign PR 1, 2026-07-16).
// The sheet is the REAL MobileSheet and the tier/print bars are the REAL
// SegBar exported from App.jsx; the top bar / stat strip / add bar markup is
// copied from App.jsx's !isWide branches and bound to a local fixture project.
// Product rows are placeholders — PR 1 does not touch the row grid.
// Served by the vite dev server at /.scratch/020_mobile-shell-preview/preview.html;
// never shipped.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Menu, MoreHorizontal, Printer, Plus, Save, History, ClipboardList, Trash2, Check, X, Paperclip } from "lucide-react";
import "../../src/index.css";
import { num } from "../../src/catalog.js";
import { normPricing } from "../../src/pricing.js";
import { SegBar } from "../../src/widgets.jsx";
import { MobileSheet } from "../../src/mobile.jsx";
import { TIER_COLOR } from "../../src/uiconst.js";
import NedMark from "../../src/NedMark.jsx";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sf1 = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const tierBadgeText = (tier, pct) => tier === "retail" ? "" : tier === "employee" ? "Employee" : pct > 0 ? `${tier[0].toUpperCase()}${tier.slice(1)} −${pct}%` : "";
const areaLabel = (a, i) => (a.name || "").trim() || `Area ${i + 1}`;
const lbl = "block ft-eyebrow text-[9px] mb-1";
const inp = "ft-field w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const AREAS = [
  { id: "a1", name: "Kitchen", sf: 240, total: 2173.13, rows: [
    { t: "T", c: "var(--ft-type-tile)", name: "Portfolio · Iron Gray", sub: "PF08-1224 · 12×24 · 240 SF @ $3.49", amt: 837.6 },
    { t: "V", c: "var(--ft-type-vinyl)", name: "COREtec Pro Plus · Copano Oak", sub: "VV017-01005 · 9 ct × 28.84 SF @ $4.19", amt: 1087.53 },
    { t: "✕", c: "var(--ft-type-misc)", name: "Stairnose · Copano Oak", sub: "VV017-04005 · 4 EA @ $62.00", amt: 248 },
  ] },
  { id: "a2", name: "Master Bath", sf: 68, total: 763.72, rows: [
    { t: "T", c: "var(--ft-type-tile)", name: "Sterlina · Ivory", sub: "F02STERIV1224 · 12×24 · 68 SF @ $4.79", amt: 325.72 },
    { t: "✕", c: "var(--ft-type-misc)", name: "Ditra-XL membrane", sub: "DXL175 · 1 EA @ $438.00", amt: 438 },
  ] },
  { id: "a3", name: "Living Room", sf: 612, total: 1768.68, rows: [
    { t: "C", c: "var(--ft-type-carpet)", name: "Rock Solid · Mineral", sub: "RS-114 · 12' roll · 612 SF @ $2.89", amt: 1768.68 },
  ] },
];
const RETAIL = AREAS.reduce((t, a) => t + a.total, 0) + 468.13; // + materials, like the mockup
const SETTINGS = { pricing: { builderPct: 8, salePct: 10 } };

function Shell() {
  const [sel, setSel] = useState({
    name: "Miller Residence", address: "418 Orchard Hill Dr, Rockford", notes: "Install after cabinets — week of 8/3.",
    priceTier: "builder", customPct: "12", printPricing: "full",
    attachments: [{ id: "f1", name: "tile-layout.pdf", size: 48213 }, { id: "f2", name: "IMG_2214.jpg", size: 183001 }],
    versions: [1, 2, 3],
  });
  const upd = (patch) => setSel((s) => ({ ...s, ...patch }));
  const [projSheet, setProjSheet] = useState(false);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const mainRef = useRef(null);

  const pcts = normPricing(SETTINGS.pricing);
  const pct = sel.priceTier === "builder" ? pcts.builderPct : sel.priceTier === "sale" ? pcts.salePct : sel.priceTier === "custom" ? num(sel.customPct) : 0;
  const tv = { tier: sel.priceTier || "retail", pct };
  const grandTotal = tv.tier === "employee" ? RETAIL * 0.62 : RETAIL * (1 - pct / 100);
  const totalSf = AREAS.reduce((t, a) => t + a.sf, 0);
  const badge = tierBadgeText(tv.tier, tv.pct);

  // Same active-area tracking as App.jsx's mobile add bar effect.
  useEffect(() => {
    const el = mainRef.current; if (!el) return;
    const pick = () => {
      const nodes = el.querySelectorAll("[data-area-drop]");
      if (!nodes.length) return setActiveAreaId(null);
      const anchor = el.getBoundingClientRect().top + el.clientHeight * 0.3;
      let cur = nodes[0];
      nodes.forEach((n) => { if (n.getBoundingClientRect().top <= anchor) cur = n; });
      setActiveAreaId(cur.getAttribute("data-area-drop"));
    };
    pick();
    el.addEventListener("scroll", pick, { passive: true });
    return () => el.removeEventListener("scroll", pick);
  }, []);

  const tile = "shrink-0 text-left rounded-md border border-slate-200 bg-white px-2.5 py-1.5";
  const tLbl = "ft-eyebrow text-[8px]";
  const tVal = "text-[12.5px] font-bold whitespace-nowrap mt-px";
  const act = "h-[34px] flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-semibold text-slate-600";
  const cur = AREAS.find((a) => a.id === activeAreaId) || AREAS[0];

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: "var(--ft-ui)" }}>
      {/* Mobile top bar (App.jsx) */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 ft-rail border-b border-slate-200">
        <button className="p-1 -ml-1 text-slate-600"><Menu size={20} /></button>
        <NedMark size={28} />
        <span className="ft-serif text-lg truncate flex-1">{sel.name}</span>
        <button onClick={() => setProjSheet(true)} className="shrink-0 text-right" style={{ lineHeight: 1.15 }}>
          <span className="ft-mono block text-[13px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</span>
          {badge && <span className="block text-[8.5px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main }}>{badge}</span>}
        </button>
        <button onClick={() => setProjSheet(true)} title="Project details" className="shrink-0 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500"><MoreHorizontal size={15} /></button>
      </div>

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-3">
          {/* Stat strip (App.jsx) */}
          <div className="ft-noprint flex gap-1.5 overflow-x-auto mb-3" style={{ scrollbarWidth: "none" }}>
            <button className={tile}><div className={tLbl}>Customer</div><div className={tVal}>Dave &amp; Anne Miller ▾</div></button>
            <div className={tile}><div className={tLbl}>Floor</div><div className={tVal + " ft-mono"}>{sf1(totalSf)} SF</div></div>
            <button onClick={() => setProjSheet(true)} className={tile}><div className={tLbl}>Print</div><div className={tVal}>{sel.printPricing === "unit" ? "Unit $" : sel.printPricing === "none" ? "No $" : "All $"}</div></button>
            <button onClick={() => setProjSheet(true)} className={tile}><div className={tLbl}>Files</div><div className={tVal}>{sel.attachments.length}</div></button>
            <button className={tile}><div className={tLbl}>Versions</div><div className={tVal}>{sel.versions.length}</div></button>
            <div className={tile}><div className={tLbl}>Sync</div><div className={tVal} style={{ color: "var(--ft-brand)" }}>Saved ✓</div></div>
          </div>

          {/* Area cards — placeholder rows (PR 1 leaves the row grid alone) */}
          <div>
            {AREAS.map((a, ai) => (
              <div key={a.id} data-area-drop={a.id} onClickCapture={() => setActiveAreaId(a.id)} className="rounded-lg border bg-white overflow-hidden border-slate-200">
                <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-area-head)", padding: "8px 14px", ...(a.id === activeAreaId ? { boxShadow: "inset 3px 0 0 var(--ft-brand)" } : {}) }}>
                  <span className="ft-serif" style={{ fontSize: 20, lineHeight: 1.1 }}>{a.name}</span>
                  <span className="ft-mono" style={{ fontSize: 10.5 }}>{money(a.total)}</span>
                </div>
                {a.rows.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center px-3 py-2 border-t" style={{ borderColor: "var(--ft-row-line)" }}>
                    <span className="shrink-0 rounded flex items-center justify-center text-white font-extrabold" style={{ width: 19, height: 19, fontSize: 10, background: r.c }}>{r.t}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2"><span className="text-[13px] font-bold truncate flex-1 min-w-0">{r.name}</span><span className="ft-mono text-[12px] font-bold shrink-0">{money(r.amt)}</span></span>
                      <span className="block text-[10.5px] text-slate-400 truncate">{r.sub}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="text-center text-[10px] text-slate-400 mt-3 mb-1">placeholder rows — the real grid is unchanged in PR 1</div>
        </div>
      </main>

      {/* Mobile add bar (App.jsx) */}
      <div className="ft-noprint flex gap-2 px-3 pt-2.5 ft-rail border-t border-slate-200" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <button className="h-[38px] shrink-0 flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-bold"><Plus size={14} /> Area</button>
        <button className="h-[38px] flex-1 min-w-0 flex items-center justify-center gap-1 rounded-md text-[12.5px] font-bold" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}>
          <Plus size={14} className="shrink-0" /> Product<span className="truncate opacity-75 font-semibold">&nbsp;· {areaLabel(cur, AREAS.indexOf(cur))}</span>
        </button>
        <button style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[38px] shrink-0 flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 text-white px-4 text-[12.5px] font-bold"><Printer size={14} /> Print</button>
      </div>

      {/* Project sheet (REAL MobileSheet + SegBar, same body as App.jsx) */}
      <MobileSheet open={projSheet} onClose={() => setProjSheet(false)} title={sel.name || "Untitled project"}
        badge={badge ? <span className="shrink-0 rounded px-1 py-px font-semibold" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9.5 }}>{badge}</span> : null}
        footer={<>
          <div className="flex-1 min-w-0" style={{ lineHeight: 1.15 }}>
            <div className="ft-eyebrow text-[8.5px]">Total</div>
            <div className="ft-mono text-[17px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
          </div>
          <button onClick={() => setProjSheet(false)} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[38px] shrink-0 flex items-center justify-center gap-1.5 text-[13px] font-bold rounded-md bg-indigo-600 text-white px-7"><Printer size={15} /> Print</button>
        </>}>
        <div className="space-y-3">
          <div><label className={lbl}>Project name</label><input value={sel.name} onChange={(e) => upd({ name: e.target.value })} className={inp} /></div>
          <div><label className={lbl}>Project address</label><input value={sel.address} onChange={(e) => upd({ address: e.target.value })} className={inp} /></div>
          <div>
            <label className={lbl}>Price tier</label>
            <SegBar value={sel.priceTier || "retail"} inputValue={sel.customPct}
              onChange={(v) => upd({ priceTier: v })}
              onInput={(v) => upd({ priceTier: "custom", customPct: v })}
              options={[
                { v: "retail", label: "Retail", title: "Retail pricing" },
                { v: "builder", label: "Bldr", color: TIER_COLOR.builder.main, title: `Builder — ${pcts.builderPct}% off` },
                { v: "employee", label: "Emp", color: TIER_COLOR.employee.main, title: "Employee — cost + 6%" },
                { v: "sale", label: "Sale", color: TIER_COLOR.sale.main, title: `Sale — ${pcts.salePct}% off` },
                { v: "custom", input: true, color: TIER_COLOR.custom.main, title: "Custom % off" },
              ]} />
          </div>
          <div>
            <label className={lbl}>Printed pricing</label>
            <SegBar value={sel.printPricing || "full"} onChange={(v) => upd({ printPricing: v })}
              options={[
                { v: "full", label: "All $", title: "Print every price and total" },
                { v: "unit", label: "Unit $", title: "Unit prices only" },
                { v: "none", label: "No $", title: "No pricing" },
              ]} />
          </div>
          <div><label className={lbl}>Project notes</label><textarea value={sel.notes} onChange={(e) => upd({ notes: e.target.value })} rows={2} className={inp} /></div>
          <div>
            <label className={lbl}>Files <span className="text-slate-400 font-normal normal-case tracking-normal">— not printed</span></label>
            <div className="flex flex-wrap gap-1">
              {sel.attachments.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-md bg-slate-100 pl-1.5 pr-1 py-0.5 text-[11px]">
                  <button className="max-w-[9rem] truncate">{m.name}</button>
                  <button className="text-slate-400"><X size={11} /></button>
                </span>
              ))}
              <button className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500"><Paperclip size={11} /> Add</button>
            </div>
          </div>
          {namingVersion ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[34px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={() => setNamingVersion(false)} className="h-[34px] w-[34px] shrink-0 flex items-center justify-center rounded-md bg-indigo-600 text-white"><Check size={15} /></button>
              <button onClick={() => setNamingVersion(false)} className="h-[34px] w-[34px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 text-slate-400"><X size={15} /></button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button onClick={() => setNamingVersion(true)} className={act}><Save size={14} /> Save version</button>
              <button className={act}><History size={14} /> History ({sel.versions.length})</button>
              <button className={act}><ClipboardList size={14} /> Order sheet</button>
              <button className={act} style={{ color: "#b91c1c", borderColor: "#fecaca" }}><Trash2 size={14} /> Delete</button>
            </div>
          )}
        </div>
      </MobileSheet>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Shell />);
