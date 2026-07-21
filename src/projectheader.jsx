import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Building2, Lock, LockOpen, Save, History, ClipboardList, Copy, Printer, Trash2, Plus, Check, X } from "lucide-react";
import { SalespersonPop, SegBar, WasteBar, FilesPop, useAnchoredPanel, vPos } from "./widgets.jsx";
import { normPricing } from "./pricing.js";
import { TIER_COLOR, tierBadgeText } from "./uiconst.js";
import { money } from "./model.js";

// The desktop project header, two layouts behind a per-device switch
// (Settings → General, localStorage "ft-header"):
//   ProjectHeaderBar     — the one-bar (2026-07-21,
//                          .scratch/mockups/header-redesign-2026-07-21.html rev 5)
//   ProjectHeaderClassic — the print-sheet original it replaced, kept whole so
//                          the team can flip back without a revert
// Both take the same props from App and share all state — switching layouts
// never loses in-progress work. Mobile (<768px) has its own shell in App.jsx.

// ---- one-bar ----------------------------------------------------------------

const MINI = "ft-tip w-[45px] h-[40px] flex items-center justify-center rounded-md bg-white hover:bg-slate-50";
const MINI_STYLE = { border: "1px solid var(--ft-border-strong)" };

// Vertical SegBar: same options shape ({ v, label, color, title, input }), the
// active row pressed in. Default active paints ink (the .bg-indigo-600 theme
// override), tier rows paint their tier color.
function VertBar({ header, headerIcon, value, onChange, options, inputValue, onInput }) {
  return (
    <div className="ft-hcol shrink-0">
      <div className="ft-hhead">{headerIcon}{header}</div>
      {options.map((o) => {
        const active = value === o.v;
        const cls = "ft-hopt " + (active ? "on " + (o.color ? "text-white" : "bg-indigo-600") : "");
        const fill = active && o.color ? { background: o.color } : undefined;
        if (o.input) return (
          <label key={o.v} className={cls + " cursor-text gap-1"} style={fill} title={o.title}>
            <span>{o.label}</span>
            <input type="number" min="0" max="100" value={inputValue} onFocus={() => onChange(o.v)} onChange={(e) => onInput(e.target.value)}
              className={"w-8 ml-auto bg-transparent text-right focus:outline-none " + (active ? "" : "text-slate-500")} />
            <span>%</span>
          </label>
        );
        return <button key={o.v} onClick={() => onChange(o.v)} title={o.title} className={cls} style={fill}>{o.label}</button>;
      })}
    </div>
  );
}

// WasteBar's exact semantics turned vertical: rows toggle the flag when
// locked, edit the rate when the header padlock is open.
function WasteCard({ w, dflt, onChange }) {
  const [unlocked, setUnlocked] = useState(false);
  const wrap = useRef(null);
  const cells = [{ k: "tile", flag: "tileOn", label: "Tile", of: "tile" }, { k: "floor", flag: "floorOn", label: "Flooring", of: "other flooring" }];
  const n = (v) => Number(v) || 0;
  return (
    <div ref={wrap} className="ft-hcol flex-1"
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget)) setUnlocked(false); }}
      onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setUnlocked(false); }}
      style={unlocked ? { borderColor: "var(--ft-brand)", boxShadow: "0 0 0 2px var(--ft-brand-soft)" } : undefined}>
      <div className="ft-hhead">
        Waste
        <button onClick={() => setUnlocked((v) => !v)} title={unlocked ? "Lock the waste rates" : "Change the waste rates"}
          className="ml-auto flex items-center justify-center" style={{ color: unlocked ? "var(--ft-brand)" : "var(--ft-faint)" }}>
          {unlocked ? <LockOpen size={11} /> : <Lock size={11} />}
        </button>
      </div>
      {cells.map((c) => {
        const on = !!w[c.flag], pct = n(w[c.k]);
        const custom = on && pct !== n(dflt?.[c.k]);
        if (unlocked) return (
          <label key={c.k} className="ft-hopt cursor-text gap-1">
            <span className="text-[10.5px]" style={{ color: "var(--ft-brand-deep)" }}>{c.label}</span>
            <input value={w[c.k]} inputMode="numeric" onChange={(e) => onChange({ [c.k]: e.target.value })}
              className="ml-auto w-6 min-w-0 bg-transparent text-right text-[12.5px] font-semibold focus:outline-none"
              style={{ color: "var(--ft-text)", borderBottom: "1px solid var(--ft-brand)" }} />
            <span className="text-[10px]" style={{ color: "var(--ft-faint)" }}>%</span>
          </label>
        );
        const dim = on ? "color-mix(in oklab, var(--ft-cream) 70%, transparent)" : "var(--ft-faint)";
        return (
          <button key={c.k} onClick={() => onChange({ [c.flag]: !on })}
            title={on ? `${pct}% waste applied to ${c.of} — press to order raw measured footage` : `No waste on ${c.of} — press to add ${pct}%`}
            className="ft-hopt gap-1" style={on ? { background: custom ? "var(--ft-brand-deep)" : "var(--ft-text)" } : undefined}>
            <span className="text-[10.5px]" style={{ color: dim }}>{c.label}</span>
            <span className="ml-auto text-[12.5px]" style={{ color: on ? "var(--ft-cream)" : "var(--ft-faint)", fontWeight: on ? 600 : 400 }}>{pct}</span>
            <span className="text-[10px]" style={{ color: dim }}>%</span>
          </button>
        );
      })}
    </div>
  );
}

// Save-a-version popover off the small Save button — drives the same
// namingVersion/versionName state the classic inline flow uses.
function SaveVersionPop({ open, onOpen, onClose, name, setName, onConfirm, tip }) {
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, onClose);
  const W = 230;
  return (
    <>
      <button ref={anchorRef} onClick={() => (open ? onClose() : onOpen())} data-tip={tip} className={MINI} style={MINI_STYLE}><Save size={15} /></button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), left: Math.max(8, Math.min(pos.left + pos.width / 2 - W / 2, window.innerWidth - W - 8)), width: W }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 p-2">
          <div className="ft-eyebrow text-[9px] mb-1.5">Save a version</div>
          <div className="flex items-center gap-1.5">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onClose(); }} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[30px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={onConfirm} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"><Check size={15} /></button>
          </div>
        </div>, document.body)}
    </>
  );
}

export function ProjectHeaderBar({ sel, cust, builderName, profile, tv, grandTotal, saveOk, settings, jobWasteUI, updateProject, onOpenCustomer, onPromote, nameRef, addAreaRef, focusName, tabTo, namingVersion, setNamingVersion, versionName, setVersionName, startVersionName, confirmVersion, openAttachment, delAttachment, attRef, addAttachment, setShowVersions, setPrintMode, setConfirm, setShowOrderCopy, addArea }) {
  const sp = sel.salesperson || profile;
  const pcts = normPricing(settings.pricing);
  const tierFill = TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined;
  const idbox = { background: "var(--ft-card)", border: "1px solid var(--ft-border-strong)", borderRadius: 6, padding: "5px 10px 6px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 };
  const prim = "rounded-md flex flex-col items-center justify-center text-[13.5px] font-bold text-white bg-indigo-600";
  return (
    <>
      <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
      <div className="rounded-lg border mb-4" style={{ padding: 10, background: "var(--ft-band)", borderColor: "var(--ft-border)", display: "flex", gap: 8, alignItems: "stretch" }}>
        <div className="flex flex-col gap-1.5 shrink-0" style={{ width: 188 }}>
          <div style={idbox}>
            <div className="ft-eyebrow text-[8.5px]" style={{ color: "var(--ft-faint)" }}>Customer</div>
            {cust ? (
              <>
                <button onClick={onOpenCustomer} title="Open customer details" className="flex items-center gap-1 min-w-0 max-w-full text-indigo-600 hover:text-indigo-700 text-[14px] font-bold" style={{ lineHeight: 1.2 }}>
                  <span className="truncate">{cust.name || "Customer"}</span><ChevronDown size={12} className="shrink-0" />
                </button>
                {builderName && <div className="text-[10px] text-slate-500 truncate flex items-center gap-1"><Building2 size={10} className="shrink-0 text-slate-400" /> {builderName}</div>}
              </>
            ) : (
              <button onClick={onPromote} title="File this job under a customer" className="flex flex-col items-start gap-0.5 text-amber-600 hover:text-amber-700 transition">
                <span className="text-[13px] font-bold" style={{ lineHeight: 1.2 }}>{sel.quick ? "Quick price" : "Unassigned"}</span>
                <span className="text-[9.5px] font-semibold rounded border border-amber-300 px-1 py-px">File under customer ▾</span>
              </button>
            )}
          </div>
          <div style={idbox}>
            <div className="ft-eyebrow text-[8.5px]" style={{ color: "var(--ft-faint)" }}>Project</div>
            <input ref={nameRef} onKeyDown={tabTo(addAreaRef)} value={sel.name} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name"
              className={"w-full bg-transparent text-[14px] font-bold border-b border-transparent focus:border-indigo-500 focus:outline-none min-w-0 transition" + (focusName ? " border-indigo-300" : "")} style={{ lineHeight: 1.25 }} />
            <input value={sel.address} onChange={(e) => updateProject(sel.id, { address: e.target.value })} placeholder="Project address…" className="w-full bg-transparent text-[10px] text-slate-500 border-b border-transparent focus:border-indigo-500 focus:outline-none" />
          </div>
          <div style={idbox}>
            <div className="ft-eyebrow text-[8.5px] flex items-center gap-1" style={{ color: "var(--ft-faint)" }}><Lock size={9} /> Salesperson</div>
            <SalespersonPop small value={sel.salesperson} fallback={profile} onChange={(v) => updateProject(sel.id, { salesperson: v })} />
            <div className="text-[10px] text-slate-500 truncate max-w-full">{sp.phone || " "}</div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…"
            className="w-full flex-1 rounded-md px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border-strong)" }} />
          <div style={{ padding: "1px 4px 0" }}>
            <div className="ft-eyebrow text-[8.5px] flex items-center gap-2" style={{ color: "var(--ft-faint)" }}>
              Job total
              {tierBadgeText(tv.tier, tv.pct) && <span className="rounded px-1 py-px font-semibold normal-case tracking-normal" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9 }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
              {saveOk && <span className="font-medium normal-case tracking-normal" style={{ color: "var(--ft-brand)", fontSize: 10 }}>Saved ✓</span>}
            </div>
            <div className="ft-mono font-bold" style={{ fontSize: 20, lineHeight: 1.15, letterSpacing: "-.02em", color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
          </div>
        </div>

        <VertBar header="Estimate shows" value={sel.printPricing || "full"} onChange={(v) => updateProject(sel.id, { printPricing: v })}
          options={[
            { v: "full", label: "All prices", title: "Print every price and total" },
            { v: "unit", label: "Unit only", title: "Print unit prices only — no line or job totals" },
            { v: "none", label: "No prices", title: "Print no pricing" },
          ]} />

        <VertBar header="Price level" value={sel.priceTier || "retail"} inputValue={sel.customPct}
          onChange={(v) => updateProject(sel.id, { priceTier: v })}
          onInput={(v) => updateProject(sel.id, { priceTier: "custom", customPct: v })}
          options={[
            { v: "retail", label: "Retail", title: "Retail pricing" },
            { v: "builder", label: "Builder", color: TIER_COLOR.builder.main, title: `Builder pricing — ${pcts.builderPct}% off retail` },
            { v: "employee", label: "Employee", color: TIER_COLOR.employee.main, title: "Employee pricing — cost + 6% (no-cost lines stay retail)" },
            { v: "sale", label: "Sale", color: TIER_COLOR.sale.main, title: `Sale pricing — ${pcts.salePct}% off retail` },
            { v: "custom", label: "Custom", input: true, color: TIER_COLOR.custom.main, title: "Custom % off retail" },
          ]} />

        <div className="flex flex-col gap-2 shrink-0" style={{ width: 96 }}>
          <WasteCard w={jobWasteUI} dflt={settings.waste} onChange={(patch) => updateProject(sel.id, { waste: { ...jobWasteUI, ...patch } })} />
          <div className="grid gap-1.5 shrink-0" style={{ gridTemplateColumns: "repeat(2,45px)" }}>
            <button onClick={() => setPrintMode("order")} data-tip="Order sheet — pull list for ordering & the warehouse" className={MINI} style={MINI_STYLE}><ClipboardList size={15} /></button>
            <FilesPop mini tip="Files — photos & docs attached to this job" attachments={sel.attachments} onOpen={openAttachment} onDelete={delAttachment} onAdd={() => attRef.current?.click()} />
            <SaveVersionPop open={namingVersion} onOpen={startVersionName} onClose={() => setNamingVersion(false)} name={versionName} setName={setVersionName} onConfirm={confirmVersion} tip="Save version — snapshot today's numbers before big changes" />
            <button onClick={() => setShowVersions(true)} data-tip={`History — reopen or restore an earlier version (${sel.versions?.length || 0} saved)`} className={MINI} style={MINI_STYLE}><History size={15} /></button>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0" style={{ width: 148 }}>
          <button onClick={() => setConfirm({ id: sel.id })} className="rounded-md flex items-center justify-center gap-1.5 text-[10.5px] font-bold shrink-0" style={{ height: 24, color: "#DC2626", border: "1px solid rgba(220,38,38,.55)", background: "var(--ft-card)" }}><Trash2 size={12} /> Delete</button>
          <button onClick={() => setShowOrderCopy(true)} className={prim} style={{ flex: 1, ...tierFill }}>
            <span className="flex items-center gap-1.5"><Copy size={14} /> Order entry</span>
            <span className="text-[9.5px] font-semibold opacity-70" style={{ marginTop: 1 }}>For ERP One</span>
          </button>
          <button onClick={() => setPrintMode("estimate")} className={prim} style={{ flex: 1, ...tierFill }}>
            <span className="flex items-center gap-1.5"><Printer size={14} /> Print</span>
          </button>
        </div>
      </div>
      <button ref={addAreaRef} onClick={addArea} className="ft-noprint -mt-2 mb-4 w-full h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md transition hover:opacity-90" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}><Plus size={14} /> Add area</button>
    </>
  );
}

// ---- classic ----------------------------------------------------------------
// Moved whole from App.jsx (print-sheet style: customer | project | salesperson
// up top, then pricing + notes | actions, then the Add-area row).

export function ProjectHeaderClassic({ sel, cust, builderName, profile, tv, grandTotal, saveOk, settings, jobWasteUI, updateProject, onOpenCustomer, onPromote, nameRef, addAreaRef, focusName, tabTo, namingVersion, setNamingVersion, versionName, setVersionName, startVersionName, confirmVersion, openAttachment, delAttachment, attRef, addAttachment, setShowVersions, setPrintMode, setConfirm, setShowOrderCopy, addArea }) {
  const sp = sel.salesperson || profile;
  const cols = { display: "grid", gridTemplateColumns: "1fr 1.28fr 1.08fr", gap: 16 };
  const midPad = { borderLeft: "1px solid var(--ft-border)", borderRight: "1px solid var(--ft-border)", padding: "0 16px" };
  return (
    <div className="rounded-lg border mb-4" style={{ padding: "clamp(10px,1.5vw,15px)", background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
      <div style={cols}>
        <div className="min-w-0">
          <div className="ft-eyebrow text-[9px] mb-1">Customer</div>
          {cust ? (
            <>
              <button onClick={onOpenCustomer} title="Open customer details" className="ft-serif flex items-center gap-1 min-w-0 max-w-full text-indigo-600 hover:text-indigo-700" style={{ fontSize: 19, lineHeight: 1.15 }}>
                <span className="truncate">{cust.name || "Customer"}</span><ChevronDown size={14} className="shrink-0" />
              </button>
              <div className="text-xs text-slate-500 mt-1 truncate">{cust.address || " "}</div>
              {builderName && <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1"><Building2 size={11} className="shrink-0 text-slate-400" /> {builderName}</div>}
            </>
          ) : (
            <button onClick={onPromote} title="File this job under a customer" className="flex items-center gap-2 text-amber-600 hover:text-amber-700 transition" style={{ lineHeight: 1.6 }}>
              <span className="text-sm font-semibold">{sel.quick ? "Quick price" : "Unassigned"}</span>
              <span className="text-[10.5px] font-semibold rounded border border-amber-300 px-1.5 py-0.5">File under customer ▾</span>
            </button>
          )}
        </div>
        <div className="min-w-0 relative" style={midPad}>
          <div className="absolute top-0 flex flex-col items-end" style={{ right: 16 }}>
            <div className="ft-mono text-[12px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
            {tierBadgeText(tv.tier, tv.pct) && <span className="rounded px-1 py-px mt-0.5 font-semibold" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9.5 }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
          </div>
          {saveOk && <span className="absolute top-0 text-[11px] font-medium whitespace-nowrap" style={{ left: 16, color: "var(--ft-brand)" }}>Saved ✓</span>}
          <div className="ft-eyebrow text-[9px] mb-1 text-center">Project</div>
          <input ref={nameRef} onKeyDown={tabTo(addAreaRef)} value={sel.name} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name" className={"ft-serif w-full bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 transition text-center" + (focusName ? " border-indigo-300" : "")} style={{ fontSize: "clamp(19px,2.6vw,24px)", lineHeight: 1.05 }} />
          <input value={sel.address} onChange={(e) => updateProject(sel.id, { address: e.target.value })} placeholder="Project address…" className="w-full bg-transparent text-xs text-slate-500 border-b border-transparent focus:border-indigo-500 focus:outline-none mt-1 text-center" />
        </div>
        <div className="min-w-0 flex flex-col items-end text-right">
          <div className="ft-eyebrow text-[9px] mb-1 flex items-center gap-1"><Lock size={10} /> Salesperson</div>
          <SalespersonPop value={sel.salesperson} fallback={profile} alignRight onChange={(v) => updateProject(sel.id, { salesperson: v })} />
          <div className="text-xs text-slate-500 mt-1 truncate max-w-full">{sp.phone || " "}</div>
        </div>
      </div>
      <div className="ft-noprint mt-2 pt-2 border-t" style={{ ...cols, borderColor: "var(--ft-border)" }}>
        <div className="flex flex-col gap-1.5 min-w-0" style={{ height: 66 }}>
          {(() => { const pcts = normPricing(settings.pricing); return (
            <SegBar value={sel.priceTier || "retail"} inputValue={sel.customPct}
              onChange={(v) => updateProject(sel.id, { priceTier: v })}
              onInput={(v) => updateProject(sel.id, { priceTier: "custom", customPct: v })}
              options={[
                { v: "retail", label: "Retail", title: "Retail pricing" },
                { v: "builder", label: "Bldr", color: TIER_COLOR.builder.main, title: `Builder pricing — ${pcts.builderPct}% off retail` },
                { v: "employee", label: "Emp", color: TIER_COLOR.employee.main, title: "Employee pricing — cost + 6% (no-cost lines stay retail)" },
                { v: "sale", label: "Sale", color: TIER_COLOR.sale.main, title: `Sale pricing — ${pcts.salePct}% off retail` },
                { v: "custom", input: true, color: TIER_COLOR.custom.main, title: "Custom % off retail" },
              ]} />
          ); })()}
          {/* Printed pricing shares its row with the waste
              toggles; the tier bar above keeps the full width. */}
          <div className="flex gap-1.5 min-w-0">
            <div className="flex-1 min-w-0">
              <SegBar value={sel.printPricing || "full"}
                onChange={(v) => updateProject(sel.id, { printPricing: v })}
                options={[
                  { v: "full", label: "All $", title: "Print every price and total" },
                  { v: "unit", label: "Unit $", title: "Print unit prices only — no line or job totals" },
                  { v: "none", label: "No $", title: "Print no pricing" },
                ]} />
            </div>
            <WasteBar w={jobWasteUI} dflt={settings.waste} className="w-[134px]"
              onChange={(patch) => updateProject(sel.id, { waste: { ...jobWasteUI, ...patch } })} />
          </div>
        </div>
        <textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ height: 66, background: "var(--ft-cream)" }} />
        <div className="flex flex-col justify-between gap-1.5" style={{ height: 66 }}>
          {namingVersion ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") setNamingVersion(false); }} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[30px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={confirmVersion} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"><Check size={15} /></button>
              <button onClick={() => setNamingVersion(false)} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-400"><X size={15} /></button>
            </div>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
              <div className="flex gap-1.5">
                <button onClick={startVersionName} title="Save a version" className="h-[30px] flex-1 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"><Save size={14} /></button>
                <FilesPop attachments={sel.attachments} onOpen={openAttachment} onDelete={delAttachment} onAdd={() => attRef.current?.click()} />
                <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
                <button onClick={() => setShowVersions(true)} title={`Version history (${sel.versions?.length || 0})`} className="h-[30px] flex-1 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"><History size={14} /></button>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setPrintMode("order")} className="h-[30px] flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 whitespace-nowrap"><ClipboardList size={14} /> Order sheet</button>
                <button onClick={() => setConfirm({ id: sel.id })} title="Delete project" className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400"><Trash2 size={14} /></button>
              </div>
            </div>
          )}
          {/* Non-retail tiers repaint both buttons in the tier's color —
              the pricing state is visible right where you commit to it. */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
            <button onClick={() => setShowOrderCopy(true)} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Copy size={14} /> Order entry</button>
            <button onClick={() => setPrintMode("estimate")} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Printer size={14} /> Print</button>
          </div>
        </div>
      </div>
      {/* Ink row — same action as the dashed Add-area bar that
          trails the areas list; both stay on purpose. */}
      <button ref={addAreaRef} onClick={addArea} className="ft-noprint mt-2 w-full h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md transition hover:opacity-90" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}><Plus size={14} /> Add area</button>
    </div>
  );
}
