import { useRef, useState } from "react";
import { ChevronDown, Building2, Lock, LockOpen, Save, History, ClipboardList, Copy, Printer, Trash2, Check, Truck, X, Layers, FileText, MoreHorizontal, MapPin } from "lucide-react";
import { SalespersonPop, SegBar, WasteBar, FilesPop, useAnchoredPanel, useEscClose, SearchPop, growBox, PriceLevelMenu, MorphSelect, PopMenu, AddressField } from "./widgets.jsx";
import { FreightColumn } from "./freightui.jsx";
import { normPricing } from "./pricing.js";
import { TIER_COLOR, tierBadgeText, PROJECT_NAME_MAX } from "./uiconst.js";
import { money } from "./model.js";
import { erpLabel } from "./erporders.js";

// The desktop project header, three layouts behind a per-user switch
// (Settings → General, saved as ui.header; "ft-header" in localStorage is the
// fallback before a user has picked):
//   ProjectHeaderBar     — the one-bar (2026-07-21,
//                          .scratch/mockups/header-redesign-2026-07-21.html rev 5;
//                          compacted ~30% 2026-08-14,
//                          .scratch/mockups/header-compact-2026-08-14.html)
//   ProjectHeaderClassic — the print-sheet original it replaced, kept whole so
//                          the team can flip back without a revert
//   ProjectHeaderClean   — the customer-first header (2026-09-27, on trial;
//                          .scratch/159_clean-editor), tall ("clean") or
//                          `compact` ("cleancompact", pinned level with the
//                          rail logo line)
// All take the same props from App and share all state — switching layouts
// never loses in-progress work. Mobile (<768px) has its own shell in App.jsx.

// The ERP 1 order chip beside the N-number (spec 2026-09-19): shows once the
// job has an order; two or more read "+N" with the full list on hover. A
// button where order entry exists (desktop), a static chip on mobile.
// `done` (Clean header only) splits the look: moss once every line is keyed,
// neutral while some are still to paste.
export function ErpChip({ erpOrders = [], onOpen, done, size = 9 }) {
  if (!erpOrders.length) return null;
  const nos = erpOrders.map((o) => o.no);
  const label = erpLabel(nos);
  const cls = "ft-mono rounded px-1.5 font-extrabold whitespace-nowrap";
  const style = { fontSize: size, letterSpacing: ".05em", lineHeight: `${size + 6}px`,
    background: done === false ? "var(--ft-sand)" : "var(--ft-brand-soft)", color: done === false ? "var(--ft-muted)" : "var(--ft-brand-deep)" };
  const title = `ERP 1 order${nos.length > 1 ? "s" : ""}: ${[...nos].reverse().join(", ")}${onOpen ? " — open order entry" : ""}`;
  return onOpen ? <button type="button" onClick={onOpen} title={title} className={cls + " hover:opacity-80"} style={style}>{label}</button>
    : <span title={title} className={cls} style={style}>{label}</span>;
}

// ---- one-bar ----------------------------------------------------------------

const MINI = "ft-tip w-[45px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-50";
const MINI_STYLE = { border: "1px solid var(--ft-border-strong)" };

// Tab-flow cleanup (2026-07-21): Tab from anywhere in the header card hands
// focus to the first area's name — the header's secondary controls (address,
// notes, tier/waste bars, minis) are mouse territory, reachable backwards with
// Shift+Tab. The flow-end buttons (Order entry / Print) keep native order so
// the Add area → Order entry → Print chain works.
const headerTabOut = (nameTabRef) => (e) => {
  if (e.key !== "Tab" || e.shiftKey) return;
  if (e.target.closest && e.target.closest("[data-flow-end]")) return;
  e.preventDefault();
  const el = nameTabRef?.current;
  el?.focus(); el?.select?.();
};

// Vertical SegBar: same options shape ({ v, label, color, title, input }), the
// active row pressed in. Default active paints ink (the .bg-indigo-600 theme
// override), tier rows paint their tier color.
function VertBar({ header, headerIcon, value, onChange, options, inputValue, onInput, width, className = "" }) {
  return (
    <div className={"ft-hcol shrink-0 " + className} style={width ? { width } : undefined}>
      <div className="ft-hhead">{headerIcon}{header}</div>
      {options.map((o) => {
        const active = value === o.v;
        const cls = "ft-hopt " + (active ? "on " + (o.color ? "text-white" : "bg-indigo-600") : "");
        const fill = active && o.color ? { background: o.color } : undefined;
        if (o.input) return (
          <label key={o.v} className={cls + " cursor-text gap-1"} style={fill} title={o.title}>
            <span>{o.label}</span>
            <input type="number" min="0" max="100" value={inputValue} onFocus={() => onChange(o.v)} onChange={(e) => onInput(e.target.value)}
              className={"ft-nospin w-7 ml-auto bg-transparent text-right focus:outline-none " + (active ? "" : "text-slate-500")} />
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
  useEscClose(unlocked, () => setUnlocked(false));
  const wrap = useRef(null);
  const cells = [{ k: "tile", flag: "tileOn", label: "Tile", of: "tile" }, { k: "floor", flag: "floorOn", label: "Flooring", of: "other flooring" }];
  const n = (v) => Number(v) || 0;
  return (
    <div ref={wrap} className="ft-hcol flex-1"
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget)) setUnlocked(false); }}
      onKeyDown={(e) => { if (e.key === "Escape" && unlocked) e.preventDefault(); if (e.key === "Escape" || e.key === "Enter") setUnlocked(false); }}
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
            <span className="text-[10px]" style={{ color: "var(--ft-brand-deep)" }}>{c.label}</span>
            <input value={w[c.k]} inputMode="numeric" onChange={(e) => onChange({ [c.k]: e.target.value })}
              className="ml-auto w-6 min-w-0 bg-transparent text-right text-[11.5px] font-semibold focus:outline-none"
              style={{ color: "var(--ft-text)", borderBottom: "1px solid var(--ft-brand)" }} />
            <span className="text-[9.5px]" style={{ color: "var(--ft-faint)" }}>%</span>
          </label>
        );
        const dim = on ? "color-mix(in oklab, var(--ft-cream) 70%, transparent)" : "var(--ft-faint)";
        return (
          <button key={c.k} onClick={() => onChange({ [c.flag]: !on })}
            title={on ? `${pct}% waste applied to ${c.of} — press to order raw measured footage` : `No waste on ${c.of} — press to add ${pct}%`}
            className="ft-hopt gap-1" style={on ? { background: custom ? "var(--ft-brand-deep)" : "var(--ft-text)" } : undefined}>
            <span className="text-[10px]" style={{ color: dim }}>{c.label}</span>
            <span className="ml-auto text-[11.5px]" style={{ color: on ? "var(--ft-cream)" : "var(--ft-faint)", fontWeight: on ? 700 : 500 }}>{pct}</span>
            <span className="text-[9.5px]" style={{ color: dim }}>%</span>
          </button>
        );
      })}
    </div>
  );
}

// Save-a-version popover off the small Save button — drives the same
// namingVersion/versionName state the classic inline flow uses.
// `anchor` hangs it off another button instead (the Clean header's ⋯ menu).
function SaveVersionPop({ open, onOpen, onClose, name, setName, onConfirm, tip, anchor }) {
  const ownRef = useRef(null);
  const anchorRef = anchor || ownRef;
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, onClose);
  // One row: the name field and ✓ sit beside the Save button inside the box.
  const box = pos && growBox(pos, 236);
  const row = box && (
    <div className="flex items-center gap-1 w-full px-1.5">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") { e.preventDefault(); onClose(); } }} placeholder="Name this version"
        className="ft-field flex-1 min-w-0 h-[20px] text-[12px] rounded border border-slate-200 px-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      <button onClick={onConfirm} title="Save version" className="h-[20px] w-[22px] shrink-0 flex items-center justify-center rounded bg-indigo-600 hover:bg-indigo-700 text-white"><Check size={12} /></button>
    </div>
  );
  return (
    <>
      {!anchor && <button ref={anchorRef} onClick={() => (open ? onClose() : onOpen())} aria-expanded={open} data-tip={tip} className={MINI} style={MINI_STYLE}><Save size={13} /></button>}
      {open && pos && <SearchPop pos={pos} box={box} fieldRef={anchorRef} panelRef={panelRef} {...(box.right ? { trail: row } : { lead: row })} />}
    </>
  );
}

export function ProjectHeaderBar({ sel, cust, builderName, profile, tv, grandTotal, optionBadges = null, freightCost = 0, saveOk, settings, jobWasteUI, updateProject, onOpenCustomer, onPromote, nameRef, nameTabRef, orderEntryRef, focusName, namingVersion, setNamingVersion, versionName, setVersionName, startVersionName, confirmVersion, openAttachment, delAttachment, attRef, addAttachment, setShowVersions, setPrintMode, setConfirm, setShowOrderCopy, samples = null, onOpenSamples }) {
  const sp = sel.salesperson || profile;
  const pcts = normPricing(settings.pricing);
  const tierFill = TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined;
  const idbox = { background: "transparent", border: "1px solid var(--ft-border-strong)", borderRadius: 6, padding: "1px 8px 2px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 };
  const prim = "rounded-md flex flex-col items-center justify-center text-[12.5px] font-bold text-white bg-indigo-600 hover:bg-indigo-700";
  return (
    <>
      <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
      <div className="ft-hbar rounded-lg border mb-4" onKeyDown={headerTabOut(nameTabRef)} style={{ padding: 5, background: "var(--ft-band)", borderColor: "var(--ft-border)", display: "flex", gap: 5, alignItems: "stretch" }}>
        <div className="flex flex-col gap-[3px] shrink-0" style={{ width: 138 }}>
          <div style={idbox}>
            <div className="ft-eyebrow text-[8px]" style={{ color: "var(--ft-faint)" }}>Customer</div>
            {cust ? (
              <>
                <button onClick={onOpenCustomer} title="Open customer details" className="flex items-center gap-1 min-w-0 max-w-full text-indigo-600 hover:text-indigo-700 text-[12px] font-bold" style={{ lineHeight: 1.15 }}>
                  <span className="truncate">{cust.name || "Customer"}</span><ChevronDown size={10} className="shrink-0" />
                </button>
                {builderName && <div className="text-[9.5px] text-slate-500 truncate flex items-center gap-1" style={{ lineHeight: 1.2 }}><Building2 size={9} className="shrink-0 text-slate-400" /> {builderName}</div>}
              </>
            ) : (
              <button onClick={onPromote} title="File this job under a customer" className="flex flex-col items-start gap-0.5 text-amber-600 hover:text-amber-700 transition">
                <span className="text-[12px] font-bold" style={{ lineHeight: 1.15 }}>{sel.quick ? "Quick price" : "Unassigned"}</span>
                <span className="text-[9px] font-semibold rounded border border-amber-300 px-1 py-px">File under customer ▾</span>
              </button>
            )}
          </div>
          <div style={idbox}>
            <div className="ft-eyebrow text-[8px] flex items-center gap-1" style={{ color: "var(--ft-faint)" }}><Lock size={8} /> Salesperson</div>
            <SalespersonPop small value={sel.salesperson} fallback={profile} onChange={(v) => updateProject(sel.id, { salesperson: v })} />
            <div className="text-[9.5px] text-slate-500 truncate max-w-full" style={{ lineHeight: 1.2 }}>{sp.phone || " "}</div>
          </div>
          <div style={idbox}>
            {/* fixed-height row: the tier badge / Saved ✓ pop in and out, and
                without the reservation they nudge the whole band's height */}
            {/* the row is 10px tall in a 138px column, so when a tier tag is up
                everything else yields to it: the label drops to "Total", the
                save flash to "✓", and the tag itself sits flush in the 10px
                line — it must never spill the box or truncate into "B…" */}
            <div className="ft-eyebrow text-[8px] flex items-center gap-1" style={{ color: "var(--ft-faint)", height: 10 }}>
              <span className="shrink-0">{tierBadgeText(tv.tier, tv.pct) ? "Total" : "Job total"}</span>
              {tierBadgeText(tv.tier, tv.pct) && <span className="rounded px-0.5 font-semibold normal-case tracking-normal truncate" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 8, lineHeight: "10px" }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
              {saveOk && <span className="shrink-0 font-medium normal-case tracking-normal" style={{ color: "var(--ft-brand)", fontSize: 9 }}>{tierBadgeText(tv.tier, tv.pct) ? "✓" : "Saved ✓"}</span>}
            </div>
            {optionBadges ? (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {optionBadges.map((b) => (
                  <span key={b.slot} className="ft-mono rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: `color-mix(in srgb, ${b.color.main} 12%, var(--ft-card))`, color: b.color.deep, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${b.color.main} 45%, transparent)` }}>
                    {b.label} <span className="opacity-75 font-semibold">{money(b.total)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="ft-mono font-bold" style={{ fontSize: 14, lineHeight: 1.1, letterSpacing: "-.02em", color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div style={{ ...idbox, flex: "0 0 auto", justifyContent: "flex-start", padding: "4px 8px 5px" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="ft-eyebrow text-[8px]" style={{ color: "var(--ft-faint)" }}>Project</div>
              <div className="flex items-center gap-1.5">
                {sel.projectNo && <div className="ft-eyebrow text-[8px]" style={{ color: "var(--ft-faint)", letterSpacing: ".08em" }}>N{sel.projectNo}</div>}
                <ErpChip erpOrders={sel.erpOrders} onOpen={() => setShowOrderCopy(true)} />
              </div>
            </div>
            <input ref={nameRef} value={sel.name} maxLength={PROJECT_NAME_MAX} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name"
              className={"w-full bg-transparent text-[15px] font-bold border-b border-transparent focus:border-indigo-500 focus:outline-none min-w-0 transition" + (focusName ? " border-indigo-300" : "")} style={{ lineHeight: 1.15, marginTop: 1 }} />
            <input value={sel.address} onChange={(e) => updateProject(sel.id, { address: e.target.value })} placeholder="Project address…" className="w-full bg-transparent text-[10px] text-slate-500 border-b border-transparent focus:border-indigo-500 focus:outline-none mt-0.5" />
          </div>
          <textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…"
            className="w-full rounded-md px-2 py-1 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ flex: "1 1 0", minHeight: 0, background: "var(--ft-cream)", border: "1px solid var(--ft-border-strong)" }} />
        </div>

        {/* Two cards share this column slot — Freight sits UNDER Estimate shows
            but is its own bordered category, not a fourth row hanging off the
            end of it (it answers its own question). The waste/minis column
            stacks the same way. */}
        <div className="flex flex-col gap-1 shrink-0" style={{ width: 120 }}>
          <VertBar header="Estimate shows" className="flex-1" value={sel.printPricing || "full"} onChange={(v) => updateProject(sel.id, { printPricing: v })}
            options={[
              { v: "full", label: "All prices", title: "Print every price and total" },
              { v: "unit", label: "Unit only", title: "Print unit prices only — no line or job totals" },
              { v: "none", label: "No prices", title: "Print no pricing" },
            ]} />
          <FreightColumn on={sel.freight !== false} amount={freightCost > 0 ? `$${Math.round(freightCost).toLocaleString()}` : ""}
            onSet={(v) => updateProject(sel.id, { freight: v })} />
        </div>

        <VertBar header="Price level" width={116} value={sel.priceTier || "retail"} inputValue={sel.customPct}
          onChange={(v) => updateProject(sel.id, { priceTier: v })}
          onInput={(v) => updateProject(sel.id, { priceTier: "custom", customPct: v })}
          options={[
            { v: "retail", label: "Retail", title: "Retail pricing" },
            { v: "builder", label: "Builder", color: TIER_COLOR.builder.main, title: `Builder pricing — ${pcts.builderPct}% off retail` },
            { v: "employee", label: "Employee", color: TIER_COLOR.employee.main, title: "Employee pricing — cost + 6% (no-cost lines stay retail)" },
            { v: "sale", label: "Sale", color: TIER_COLOR.sale.main, title: `Sale pricing — ${pcts.salePct}% off retail` },
            { v: "custom", label: "Custom", input: true, color: TIER_COLOR.custom.main, title: "Custom % off retail" },
          ]} />

        <div className="flex flex-col gap-1 shrink-0" style={{ width: 96 }}>
          <WasteCard w={jobWasteUI} dflt={settings.waste} onChange={(patch) => updateProject(sel.id, { waste: { ...jobWasteUI, ...patch } })} />
          <div className="grid gap-1 shrink-0" style={{ gridTemplateColumns: "repeat(2,45px)" }}>
            <button onClick={() => setPrintMode("order")} data-tip="Order sheet — pull list for ordering & the warehouse" className={MINI} style={MINI_STYLE}><ClipboardList size={13} /></button>
            <FilesPop mini tip="Files — photos & docs attached to this job" attachments={sel.attachments} onOpen={openAttachment} onDelete={delAttachment} onAdd={() => attRef.current?.click()} />
            <SaveVersionPop open={namingVersion} onOpen={startVersionName} onClose={() => setNamingVersion(false)} name={versionName} setName={setVersionName} onConfirm={confirmVersion} tip="Save version — snapshot today's numbers before big changes" />
            <button onClick={() => setShowVersions(true)} data-tip={`History — reopen or restore an earlier version (${sel.versions?.length || 0} saved)`} className={MINI} style={MINI_STYLE}><History size={13} /></button>
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0" style={{ width: 148 }}>
          <button onClick={() => setConfirm({ id: sel.id })} className="rounded-md flex items-center justify-center gap-1.5 text-[10px] font-bold shrink-0 border text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500" style={{ height: 19, borderColor: "var(--ft-border-strong)" }}><Trash2 size={11} /> Delete</button>
          {onOpenSamples && (
            <button onClick={onOpenSamples} data-tip="Samples — this job's sample requests, grouped by vendor and ready to order"
              className="rounded-md flex items-center justify-center gap-1.5 text-[10px] font-bold shrink-0 border text-slate-500 hover:bg-slate-50" style={{ height: 19, borderColor: "var(--ft-border-strong)" }}>
              <Layers size={11} /> Samples
              {samples?.need > 0 && <span className="rounded px-1 font-bold" style={{ background: "#fef6e2", color: "#b45309" }}>{samples.need}</span>}
            </button>
          )}
          <button ref={orderEntryRef} data-flow-end="1" onClick={() => setShowOrderCopy(true)} className={prim} style={{ flex: 1, ...tierFill }}>
            <span className="flex items-center gap-1.5"><Copy size={13} /> Order entry</span>
            <span className="text-[9px] font-semibold opacity-70">For ERP One</span>
          </button>
          <button data-flow-end="1" onClick={() => setPrintMode("estimate")} className={prim} style={{ flex: 1, ...tierFill }}>
            <span className="flex items-center gap-1.5"><Printer size={13} /> Print</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ---- classic ----------------------------------------------------------------
// Moved whole from App.jsx (print-sheet style: customer | project | salesperson
// up top, then pricing + notes | actions, then the Add-area row).

export function ProjectHeaderClassic({ sel, cust, builderName, profile, tv, grandTotal, optionBadges = null, saveOk, settings, jobWasteUI, updateProject, onOpenCustomer, onPromote, nameRef, nameTabRef, orderEntryRef, focusName, namingVersion, setNamingVersion, versionName, setVersionName, startVersionName, confirmVersion, openAttachment, delAttachment, attRef, addAttachment, setShowVersions, setPrintMode, setConfirm, setShowOrderCopy, samples = null, onOpenSamples }) {
  const sp = sel.salesperson || profile;
  const cols = { display: "grid", gridTemplateColumns: "1fr 1.28fr 1.08fr", gap: 16 };
  const midPad = { borderLeft: "1px solid var(--ft-border)", borderRight: "1px solid var(--ft-border)", padding: "0 16px" };
  return (
    <div className="rounded-lg border mb-4" onKeyDown={headerTabOut(nameTabRef)} style={{ padding: "clamp(10px,1.5vw,15px)", background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
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
            {optionBadges ? (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {optionBadges.map((b) => (
                  <span key={b.slot} className="ft-mono rounded-md px-2 py-0.5 text-[12px] font-bold whitespace-nowrap" style={{ background: `color-mix(in srgb, ${b.color.main} 12%, var(--ft-card))`, color: b.color.deep, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${b.color.main} 45%, transparent)` }}>
                    {b.label} <span className="opacity-75 font-semibold">{money(b.total)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="ft-mono text-[12px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
            )}
            {tierBadgeText(tv.tier, tv.pct) && <span className="rounded px-1 py-px mt-0.5 font-semibold" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9.5 }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
          </div>
          {saveOk && <span className="absolute top-0 text-[11px] font-medium whitespace-nowrap" style={{ left: 16, color: "var(--ft-brand)" }}>Saved ✓</span>}
          <div className="ft-eyebrow text-[9px] mb-1 text-center">Project{sel.projectNo ? <span style={{ letterSpacing: ".08em" }}> · N{sel.projectNo}</span> : null}</div>
          {sel.erpOrders?.length > 0 && <div className="flex justify-center mb-1"><ErpChip erpOrders={sel.erpOrders} onOpen={() => setShowOrderCopy(true)} /></div>}
          <input ref={nameRef} value={sel.name} maxLength={PROJECT_NAME_MAX} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name" className={"ft-serif w-full bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 transition text-center" + (focusName ? " border-indigo-300" : "")} style={{ fontSize: "clamp(19px,2.6vw,24px)", lineHeight: 1.05 }} />
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
            {/* The freight master switch (ADR 0030) — one press for "no shipping
                on this job"; the per-row chips do the rest. */}
            <button onClick={() => updateProject(sel.id, { freight: sel.freight === false })}
              title={sel.freight === false ? "No freight on this job. Press to add vendor shipping to the special orders." : "Freight is included — vendor shipping is added to this job's special orders. Press to leave it off entirely."}
              className={"h-[30px] shrink-0 flex items-center justify-center gap-1 rounded-md border px-2 text-[11.5px] font-semibold whitespace-nowrap " +
                (sel.freight === false ? "border-slate-200 text-slate-400 hover:bg-slate-50" : "bg-indigo-600 border-indigo-600 text-white")}>
              <Truck size={13} /> {sel.freight === false ? "No freight" : "Freight"}
            </button>
            <WasteBar w={jobWasteUI} dflt={settings.waste} className="w-[134px]"
              onChange={(patch) => updateProject(sel.id, { waste: { ...jobWasteUI, ...patch } })} />
          </div>
        </div>
        <textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ height: 66, background: "var(--ft-cream)" }} />
        <div className="flex flex-col justify-between gap-1.5" style={{ height: 66 }}>
          {namingVersion ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") { e.preventDefault(); setNamingVersion(false); } }} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[30px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                {onOpenSamples && (
                  <button onClick={onOpenSamples} title={`Samples — this job's sample requests (${samples?.need || 0} to order)`} className="h-[30px] flex-1 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 relative">
                    <Layers size={14} />
                    {samples?.need > 0 && <span className="absolute rounded-full px-1 font-bold" style={{ top: -5, right: -5, fontSize: 9, lineHeight: "13px", minWidth: 13, background: "#b45309", color: "#fff" }}>{samples.need}</span>}
                  </button>
                )}
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
            <button ref={orderEntryRef} data-flow-end="1" onClick={() => setShowOrderCopy(true)} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Copy size={14} /> Order entry</button>
            <button data-flow-end="1" onClick={() => setPrintMode("estimate")} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Printer size={14} /> Print</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- clean ------------------------------------------------------------------
// The customer-first header (2026-09-27, .scratch/159_clean-editor, mockup E):
// two rows sized to the rail logo block — customer · project · address · notes
// … salesperson over the flat bar of job settings and actions. It also owns
// the Edit ⇄ Print preview switch (the page icon) — App hides its tabs and
// keeps this header on screen in both views. No order sheet button here (the
// one-bar and classic layouts keep theirs).

const ICON = "ft-tip relative w-[32px] h-[30px] shrink-0 flex items-center justify-center rounded-md border border-transparent hover:bg-[color:var(--ft-hover)]";
const BAR_TXT = "h-[30px] shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 text-[12.5px] font-extrabold whitespace-nowrap hover:bg-[color:var(--ft-hover)]";

// The project name edits in place. An invisible copy of the text
// sizes the input, so the line reads as text rather than a row of boxes.
function InlineField({ value, onChange, placeholder, inputRef, className = "", maxLength, style }) {
  const cls = "col-start-1 row-start-1 px-px " + className;
  return (
    <span className="inline-grid min-w-0 max-w-full" style={style}>
      <span aria-hidden="true" className={cls + " invisible whitespace-pre overflow-hidden"}>{value || placeholder}</span>
      <input ref={inputRef} size={1} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={cls + " w-full min-w-0 text-ellipsis bg-transparent border-b border-transparent hover:border-[color:var(--ft-border-strong)] focus:border-indigo-500 focus:outline-none placeholder:text-[color:var(--ft-faint)]"} />
    </span>
  );
}

function NotesPop({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  const has = !!String(value || "").trim();
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={has ? value : "Add project notes"}
        className={"shrink-0 whitespace-nowrap hover:text-[color:var(--ft-text)] " + (has ? "font-semibold" : "")} style={{ color: has ? "var(--ft-muted)" : "var(--ft-faint)" }}>
        {has ? "Notes" : "+ Notes"}
      </button>
      {open && pos && (
        <SearchPop pos={pos} box={growBox(pos, 320)} fieldRef={anchorRef} panelRef={panelRef} className="p-2">
          <textarea autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="Project notes…" rows={4}
            className="w-full rounded-md px-2 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ background: "var(--ft-cream)", border: "1px solid var(--ft-border-strong)" }} />
        </SearchPop>
      )}
    </>
  );
}

// The project address (job site) editor. The AddressField's own suggestion
// list is a second portal on <body>, so a pick there counts as "inside" —
// otherwise the pointerdown would close this box before the pick lands.
const ADDR_INP = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
function AddressPop({ anchorRef, value, custAddress, distance, shopAddress, ping, onChange, onDistance, onClose }) {
  const boxRef = useRef(null);
  const panelRef = useRef({ contains: (t) => !!(boxRef.current?.contains(t) || t?.closest?.("[data-l0]")) });
  const pos = useAnchoredPanel(true, anchorRef, panelRef, onClose);
  useEscClose(true, onClose);
  return pos && (
    <SearchPop pos={pos} box={growBox(pos, 360)} fieldRef={anchorRef} panelRef={boxRef} bg="var(--ft-cream)" className="p-2">
      <div onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur?.(); onClose(); } }}>
        <div className="ft-eyebrow text-[9px] mb-1.5">Project address</div>
        <AddressField autoFocus suggest value={value} onChange={onChange} placeholder={custAddress || "Job site address…"} inp={ADDR_INP} ping={ping}
          distance={distance} shopAddress={shopAddress} onDistance={onDistance} />
        <div className="flex items-center gap-3 mt-2 text-[12px]">
          {value && <button onClick={() => { onChange(""); onClose(); }} className="font-semibold text-indigo-600 hover:text-indigo-700">{custAddress ? "Use customer's address" : "Clear"}</button>}
          <span className="flex-1" />
          <button onClick={onClose} className="h-[26px] rounded-md px-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700">Done</button>
        </div>
      </div>
    </SearchPop>
  );
}

// "Tile 10% · Floor 5%" opening the one WasteBar (its padlock and its
// press-to-apply rules unchanged) in the shared popover box.
function WastePop({ w, dflt, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  const pct = (flag, k) => (w[flag] ? Number(w[k]) || 0 : 0);
  const part = (label, flag, k) => <span style={w[flag] ? undefined : { color: "var(--ft-faint)" }}>{label} {pct(flag, k)}%</span>;
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Waste — press to change" className={BAR_TXT}>
        {part("Tile", "tileOn", "tile")}<span className="font-medium" style={{ color: "var(--ft-faint)" }}>·</span>{part("Floor", "floorOn", "floor")}
      </button>
      {open && pos && (
        <SearchPop pos={pos} box={growBox(pos, 220)} fieldRef={anchorRef} panelRef={panelRef} className="p-2">
          <div className="ft-eyebrow text-[9px] mb-1.5">Waste on this job</div>
          <WasteBar w={w} dflt={dflt} onChange={onChange} />
        </SearchPop>
      )}
    </>
  );
}

// Freight is on for nearly every job, so "on" is a quiet truck and "off" is
// the thing that has to be seen: amber, struck through, and named.
function FreightToggle({ on, amount, onSet }) {
  const tip = on ? `Freight included${amount ? ` — ${amount}` : ""}: vendor shipping is added to this job's special orders. Press to leave it off.` : "No freight on this job. Press to add vendor shipping to the special orders.";
  const truck = (
    <span className="relative inline-flex">
      <Truck size={16} />
      {!on && <span className="absolute left-1/2 top-1/2 h-[1.75px] w-[20px] rounded bg-current" style={{ transform: "translate(-50%,-50%) rotate(-40deg)" }} />}
    </span>
  );
  return (
    <button onClick={() => onSet(!on)} aria-pressed={on} aria-label={on ? "Freight included" : "No freight"} title={tip}
      className={on ? ICON + " text-slate-500" : "h-[30px] shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-bold whitespace-nowrap"}
      style={on ? undefined : { background: "var(--ft-hover-amber-strong)", color: "#b45309", border: "1px solid color-mix(in oklab, #b45309 40%, transparent)" }}>
      {truck}{!on && "No freight"}
    </button>
  );
}

export function ProjectHeaderClean({ sel, cust, builderName, profile, freightCost = 0, saveOk, settings, jobWasteUI, updateProject, onOpenCustomer, onPromote, nameRef, nameTabRef, orderEntryRef, focusName, namingVersion, setNamingVersion, versionName, setVersionName, startVersionName, confirmVersion, openAttachment, delAttachment, attRef, addAttachment, setShowVersions, setPrintMode, setConfirm, setShowOrderCopy, samples = null, onOpenSamples, preview = false, onTogglePreview, erp = null, ping, compact = false }) {
  const [menu, setMenu] = useState(false);
  const [addrAt, setAddrAt] = useState(null);
  useEscClose(menu, () => setMenu(false));
  const moreRef = useRef(null);
  const addrRef = useRef(null);
  const upd = (patch) => updateProject(sel.id, patch);
  const tierFill = TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined;
  const dot = <span style={{ color: "var(--ft-border-strong)" }}>·</span>;
  const nos = erp?.nos || [];
  const done = !!erp?.done;
  const left = erp?.left || 0;
  const oeTitle = nos.length
    ? `ERP 1 order${nos.length > 1 ? "s" : ""} ${[...nos].reverse().join(", ")} — ${done ? "every line pasted" : `${erp.keyed} of ${erp.total} lines pasted`}. Open order entry.`
    : "Order entry — copy this job into ERP One";
  const custEl = (fs) => cust ? (
    <div className="flex items-baseline gap-3 min-w-0 shrink">
      <button onClick={onOpenCustomer} title="Open customer details" className="min-w-0 truncate text-left font-extrabold hover:opacity-80" style={{ fontSize: fs, lineHeight: 1.1, letterSpacing: "-.025em" }}>{cust.name || "Customer"}</button>
      {builderName && <span className="shrink min-w-0 truncate text-[13px] text-slate-500 flex items-center gap-1"><Building2 size={13} className="shrink-0 text-slate-400" />{builderName}</span>}
    </div>
  ) : (
    <button onClick={onPromote} title="File this job under a customer" className="self-start shrink-0 flex items-baseline gap-3 text-amber-600 hover:text-amber-700">
      <span className="font-extrabold" style={{ fontSize: fs, lineHeight: 1.1, letterSpacing: "-.025em" }}>{sel.quick ? "Quick price" : "Unassigned"}</span>
      <span className="text-[11px] font-semibold rounded border border-amber-300 px-1.5 py-0.5">File under customer ▾</span>
    </button>
  );
  const nameEl = (fs) => (
    <InlineField inputRef={nameRef} value={sel.name} onChange={(v) => upd({ name: v })} placeholder="Project name" maxLength={PROJECT_NAME_MAX}
      className={"font-bold text-[color:var(--ft-text)]" + (focusName ? " border-indigo-300" : "")} style={{ fontSize: fs }} />
  );
  const noEl = <>
    {sel.projectNo && <span className="shrink-0 font-semibold" style={{ color: "var(--ft-faint)" }}>N{sel.projectNo}</span>}
    <ErpChip erpOrders={sel.erpOrders} onOpen={() => setShowOrderCopy(true)} done={nos.length ? done : undefined} size={10} />
  </>;
  const addrEl = <>
    {sel.address ? (
      <button ref={addrRef} onClick={() => setAddrAt(addrRef)} title="Project address (job site) — press to change" className="min-w-0 truncate text-left hover:text-[color:var(--ft-text)]">{sel.address}</button>
    ) : cust ? (
      <button ref={addrRef} onClick={onOpenCustomer} title={cust.address ? "Customer's address — open customer" : "No address yet — open customer"} className="min-w-0 truncate text-left hover:text-[color:var(--ft-text)]" style={{ color: "var(--ft-faint)" }}>{cust.address || "Add address"}</button>
    ) : (
      <button ref={addrRef} onClick={() => setAddrAt(addrRef)} title="Add the job site address" className="min-w-0 truncate text-left hover:text-[color:var(--ft-text)]" style={{ color: "var(--ft-faint)" }}>Add address</button>
    )}
    {addrAt && <AddressPop anchorRef={addrAt} value={sel.address} custAddress={cust?.address || ""} distance={sel.distance} shopAddress={settings.shop?.address || ""} ping={ping}
      onChange={(v) => upd({ address: v })} onDistance={(d) => upd({ distance: d })} onClose={() => setAddrAt(null)} />}
  </>;
  const notesEl = <NotesPop value={sel.notes} onChange={(v) => upd({ notes: v })} />;
  const savedEl = <span className="shrink-0 text-[12px]" style={{ color: "var(--ft-brand)", visibility: saveOk ? undefined : "hidden" }}>Saved ✓</span>;
  const salesEl = (fs) => (
    <div className="min-w-0 flex justify-end font-bold" style={{ fontSize: fs }}>
      <SalespersonPop plain alignRight value={sel.salesperson} fallback={profile} onChange={(v) => upd({ salesperson: v })} />
    </div>
  );
  const settingsEl = <>
    <PriceLevelMenu value={sel.priceTier || "retail"} customPct={sel.customPct} onPick={(v) => upd({ priceTier: v })} onPct={(v) => upd({ priceTier: "custom", customPct: v })} align="left" />
    <MorphSelect value={sel.printPricing || "full"} onChange={(v) => upd({ printPricing: v })} bg="var(--ft-cream)" flat bold minOpenW={150} title="What the estimate shows"
      options={[
        { v: "full", label: "All prices", title: "Print every price and total" },
        { v: "unit", label: "Unit only", title: "Print unit prices only — no line or job totals" },
        { v: "none", label: "No prices", title: "Print no pricing" },
      ]} />
    <WastePop w={jobWasteUI} dflt={settings.waste} onChange={(patch) => upd({ waste: { ...jobWasteUI, ...patch } })} />
    <FreightToggle on={sel.freight !== false} amount={freightCost > 0 ? `$${Math.round(freightCost).toLocaleString()}` : ""} onSet={(v) => upd({ freight: v })} />
  </>;
  const iconsEl = <>
    <button onClick={onTogglePreview} aria-pressed={preview} aria-label="Print preview" data-tip={preview ? "Back to editing" : "Print preview — see the estimate as it prints"}
      className={ICON} style={preview ? { background: "var(--ft-brand-soft)", borderColor: "color-mix(in oklab, var(--ft-brand) 45%, transparent)", color: "var(--ft-brand-deep)" } : { color: "var(--ft-muted)" }}>
      <FileText size={16} />
    </button>
    <FilesPop mini tip="Files — photos & docs attached to this job" triggerClass={ICON + " text-slate-500"} attachments={sel.attachments} onOpen={openAttachment} onDelete={delAttachment} onAdd={() => attRef.current?.click()} />
    {onOpenSamples && (
      <button onClick={onOpenSamples} aria-label="Samples" data-tip="Samples — this job's sample requests, grouped by vendor" className={ICON + " text-slate-500"}>
        <Layers size={16} />
        {samples?.need > 0 && <span className="absolute rounded-full font-bold" style={{ top: -4, right: -4, fontSize: 9.5, lineHeight: "14px", minWidth: 14, padding: "0 3px", background: "#b45309", color: "#fff" }}>{samples.need}</span>}
      </button>
    )}
    <button ref={moreRef} onClick={() => setMenu((m) => !m)} aria-label="More" aria-expanded={menu} data-tip="Project address, versions and delete" className={ICON + " text-slate-500"}><MoreHorizontal size={17} /></button>
    {menu && moreRef.current && <PopMenu at={{ anchor: moreRef.current }} width={264} onClose={() => setMenu(false)} bg="var(--ft-cream)" className="py-1 text-sm whitespace-nowrap">
      <button onClick={() => { setMenu(false); setAddrAt(moreRef); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left font-semibold hover:bg-[color:var(--ft-hover)]">
        <MapPin size={15} className="text-slate-500" /><span className="flex-1">{sel.address ? "Change project address…" : "Add project address…"}</span>
      </button>
      <div className="my-1 mx-2 border-t border-slate-200" />
      <button onClick={() => { setMenu(false); setShowVersions(true); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left font-semibold hover:bg-[color:var(--ft-hover)]">
        <History size={15} className="text-slate-500" /><span className="flex-1">Versions</span><span className="text-[12px] font-medium text-slate-400">{sel.versions?.length || 0} saved</span>
      </button>
      <button onClick={() => { setMenu(false); startVersionName(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left font-semibold hover:bg-[color:var(--ft-hover)]">
        <Save size={15} className="text-slate-500" /><span className="flex-1">Save a named version…</span>
      </button>
      <div className="my-1 mx-2 border-t border-slate-200" />
      <button onClick={() => { setMenu(false); setConfirm({ id: sel.id }); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left font-semibold text-red-600 hover:bg-[color:var(--ft-hover-red)]">
        <Trash2 size={15} /><span className="flex-1">Delete project</span>
      </button>
    </PopMenu>}
    <SaveVersionPop anchor={moreRef} open={namingVersion} onOpen={startVersionName} onClose={() => setNamingVersion(false)} name={versionName} setName={setVersionName} onConfirm={confirmVersion} />
  </>;
  const actionsEl = (h) => <>
    <button ref={orderEntryRef} data-flow-end="1" onClick={() => setShowOrderCopy(true)} title={oeTitle}
      className="shrink-0 mr-1.5 inline-flex items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold whitespace-nowrap border hover:opacity-90"
      style={{ height: h, ...(done ? { background: "var(--ft-brand-soft)", borderColor: "color-mix(in oklab, var(--ft-brand) 50%, transparent)", color: "var(--ft-brand-deep)" } : { borderColor: "var(--ft-border-strong)", color: "var(--ft-text)" }) }}>
      {done ? <Check size={14} strokeWidth={2.6} /> : <Copy size={14} />}
      <span className="ft-mono">{nos.length ? erpLabel(nos) : "Order entry"}</span>
      {nos.length > 0 && !done && left > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--ft-sand)", color: "var(--ft-muted)" }}>{left} left</span>}
    </button>
    <button data-flow-end="1" onClick={() => setPrintMode("estimate")} className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 text-[13px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap" style={{ height: h, ...tierFill }}>
      <Printer size={14} /> Print
    </button>
  </>;
  const shell = (cls, kids) => (
    <div className={cls} onKeyDown={headerTabOut(nameTabRef)}>
      <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
      {kids}
    </div>
  );
  const proj = "flex items-center gap-2 min-w-0 text-slate-500 whitespace-nowrap";

  // Clean compact (owner pick "h1", 2026-09-27): the whole header fits the
  // rail logo block's height; App pins it in a band whose bottom line
  // continues the line under the logo straight across the top.
  if (!compact) return shell("mb-4", <>
    <div className="flex items-end gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {custEl(30)}
        <div className={proj + " text-[13px]"}>{nameEl(14)}{noEl}{dot}{addrEl}{dot}{notesEl}</div>
      </div>
      <div className="shrink-0 max-w-[40%] min-w-0 flex flex-col items-end gap-0.5">
        <span className="text-[12px] h-[16px]" style={{ color: "var(--ft-brand)" }}>{saveOk && "Saved ✓"}</span>
        {salesEl(15)}
      </div>
    </div>
    <div role="toolbar" aria-label="Job settings and actions" className="mt-3 flex items-center gap-0.5 py-1.5 border-y" style={{ borderColor: "var(--ft-border-soft)" }}>
      {settingsEl}<span className="w-3 shrink-0" />{iconsEl}<span className="flex-1" />{actionsEl(32)}
    </div>
  </>);
  return shell("h-full flex flex-col justify-center gap-0.5", <>
    <div className="flex items-center gap-2.5 min-w-0" style={{ height: 30 }}>
      {custEl(19)}
      <div className={proj + " text-[12.5px]"}>{dot}{nameEl(13)}{noEl}{dot}{addrEl}{dot}{notesEl}</div>
      <span className="flex-1" />{savedEl}{salesEl(14)}
    </div>
    <div role="toolbar" aria-label="Job settings and actions" className="flex items-center gap-0.5 -ml-2.5" style={{ height: 32 }}>
      {settingsEl}<span className="w-2 shrink-0" />{iconsEl}<span className="flex-1" />{actionsEl(28)}
    </div>
  </>);
}
