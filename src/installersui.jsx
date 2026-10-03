import { useEffect, useRef, useState } from "react";
import { Hammer, Plus, X, Check, User, Phone } from "lucide-react";
import { HelpTip, SearchPop, growBox, useAnchoredPanel, useEscClose } from "./widgets.jsx";
import { phoneChange } from "./phone.js";
import { uid } from "./model.js";
import { INSTALL_TRADES, TRADE_LABEL, normInstaller, rankInstallers, entryTradesOnJob, uncoveredTrades } from "./installers.js";

// Installers (spec 2026-10-03, mockup .scratch/mockups/installers-2026-10-03.html):
// the Settings → General → Installers directory, the project header's hammer
// picker, and the side box beside the areas. The print block lives in
// EstimateColumns.jsx.

const tradeText = (trades) => INSTALL_TRADES.filter((t) => trades.includes(t)).map((t) => TRADE_LABEL[t]).join(" · ");
const HEAD = "h-10 shrink-0 flex items-center gap-2 border-b border-slate-200";

function PriorityTicks({ value }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tabular-nums" title={`Priority ${value} of 10`}>
      <span className="inline-grid gap-[1.5px]" style={{ gridTemplateColumns: "repeat(10, 3px)", height: 9 }}>
        {Array.from({ length: 10 }, (_, k) => <i key={k} className="rounded-[1px]" style={{ background: k < value ? "var(--ft-brand)" : "var(--ft-border-strong)" }} />)}
      </span>
      <span className="w-3.5 text-right">{value}</span>
    </span>
  );
}

function TradeChip({ t, state = "plain" }) {
  const look = state === "yes" ? { background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" }
    : state === "no" ? { border: "1px dashed var(--ft-border-strong)", color: "var(--ft-faint)", textDecoration: "line-through" }
      : { background: "var(--ft-sand)", color: "var(--ft-muted)" };
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10.5px] font-bold" style={look}>
      {state === "yes" && <Check size={10} strokeWidth={3} />}{TRADE_LABEL[t]}
    </span>
  );
}

// ---- Settings → General → Installers -----------------------------------------

const blankDraft = () => ({ id: "", company: "", contact: "", phone: "", email: "", trades: [], priority: 5 });

function InstallerForm({ value, isNew, onField, onCommit, onAdd, onCancel, inp, lbl }) {
  const text = (k, label, extra = {}) => (
    <div>
      <label className={lbl} htmlFor={`inst-${k}`}>{label}</label>
      <input id={`inst-${k}`} className={inp} value={value[k]} {...extra}
        onChange={(e) => onField({ [k]: k === "phone" ? phoneChange(value.phone, e.target.value) : e.target.value })}
        onBlur={() => !isNew && onCommit()} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 max-w-[520px]">
      {text("company", "Company", { placeholder: "e.g. Hartline Tile & Stone", autoFocus: isNew })}
      {text("contact", "Contact name")}
      {text("phone", "Phone", { type: "tel", inputMode: "tel" })}
      {text("email", "Email", { type: "email" })}
      <div className="col-span-2">
        <div className={lbl + " flex items-center gap-1.5"}>Installs <HelpTip w={240} tip="Hard Surface covers hardwood, vinyl and laminate lines. The hammer on a project suggests installers by the trades on that job." /></div>
        <div className="grid grid-cols-3 gap-1.5">
          {INSTALL_TRADES.map((t) => {
            const on = value.trades.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} data-inst-trade={t}
                onClick={() => onField({ trades: on ? value.trades.filter((x) => x !== t) : [...value.trades, t] }, true)}
                className="h-[30px] flex items-center gap-2 rounded-md border px-2.5 text-[13px] font-bold"
                style={on ? { borderColor: "var(--ft-brand)", background: "var(--ft-tint)", color: "var(--ft-text)" } : { borderColor: "var(--ft-border-strong)", color: "var(--ft-muted)" }}>
                <span className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center shrink-0" style={on ? { background: "var(--ft-brand)", color: "var(--ft-card)" } : { border: "1.5px solid var(--ft-border-strong)" }}>{on && <Check size={10} strokeWidth={3.5} />}</span>
                {TRADE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="col-span-2">
        <div className={lbl + " flex items-center gap-1.5"}>Priority <HelpTip w={240} tip="Higher numbers come up first in a job's hammer picker. Priority never prints." /></div>
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
          {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
            <button key={n} type="button" aria-pressed={n === value.priority} onClick={() => onField({ priority: n }, true)}
              className="h-7 rounded-md border text-[13px] font-extrabold tabular-nums"
              style={n === value.priority ? { background: "var(--ft-brand)", borderColor: "var(--ft-brand)", color: "var(--ft-card)" }
                : n < value.priority ? { background: "var(--ft-brand-soft)", borderColor: "var(--ft-tint-border)", color: "var(--ft-text)" }
                  : { borderColor: "var(--ft-border-strong)", color: "var(--ft-muted)" }}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10.5px] text-slate-400"><span>1 · last resort</span><span>10 · first call</span></div>
      </div>
      {isNew && (
        <div className="col-span-2 flex gap-2 pt-1">
          <button type="button" onClick={onAdd} disabled={!value.company.trim()} className="h-7 rounded-md bg-indigo-600 px-3 text-[12.5px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40">Add installer</button>
          <button type="button" onClick={onCancel} className="h-7 rounded-md border border-slate-200 px-3 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      )}
    </div>
  );
}

export function InstallersSettings({ installers, onSave, inp, lbl }) {
  const sorted = [...installers].sort((a, b) => b.priority - a.priority || a.company.localeCompare(b.company));
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState(sorted[0]?.id || null);
  const [draft, setDraft] = useState(null); // the record being edited — a copy, committed on blur / click
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const sel = installers.find((i) => i.id === selId) || null;
  useEffect(() => { if (!isNew) setDraft(sel ? { ...sel } : null); setConfirmDel(false); }, [selId, isNew]);

  const commit = (next) => {
    const rec = normInstaller(next);
    const was = installers.find((i) => i.id === rec?.id);
    if (!rec || !rec.company || JSON.stringify(rec) === JSON.stringify(was)) return;
    onSave(installers.map((i) => (i.id === rec.id ? rec : i)));
  };
  const field = (patch, now) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (now && !isNew) commit(next);
  };
  const add = () => {
    const rec = normInstaller({ ...draft, id: uid() });
    if (!rec?.company) return;
    onSave([...installers, rec]);
    setIsNew(false);
    setFilter("all");
    setSelId(rec.id);
  };
  const remove = () => {
    const rest = installers.filter((i) => i.id !== selId);
    onSave(rest);
    setSelId(rest[0]?.id || null);
  };
  const shown = sorted.filter((i) => filter === "all" || i.trades.includes(filter));

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className={HEAD + " px-4"}>
        <span className="text-[14px] font-extrabold">Installers</span>
        <span className="text-[12px] font-semibold text-slate-400">{installers.length} on file</span>
        <HelpTip w={280} tip="Shared with the whole team. Add a job's installers from the hammer in the project header; they print at the bottom of the selection sheet. A job keeps the contact info it was quoted with, so editing or removing an installer here never changes a job you already added them to." />
        <span className="flex-1" />
        <button type="button" data-inst-new onClick={() => { setIsNew(true); setDraft(blankDraft()); }}
          className="h-6 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 text-[11.5px] font-bold text-white hover:bg-indigo-700"><Plus size={12} /> Add installer</button>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="w-[280px] shrink-0 border-r border-slate-200 flex flex-col min-h-0">
          <div className={HEAD + " px-3 gap-1"}>
            {["all", ...INSTALL_TRADES].map((t) => (
              <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)}
                className={"h-[22px] whitespace-nowrap rounded-full border px-2 text-[11px] font-bold " + (filter === t ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50")}>
                {t === "all" ? "All" : TRADE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!installers.length && <p className="px-3 py-3 text-[12px] text-slate-400">No installers yet. Add the companies you send jobs to.</p>}
            {!!installers.length && !shown.length && <p className="px-3 py-3 text-[12px] text-slate-400">No installers do {TRADE_LABEL[filter]} yet.</p>}
            {shown.map((i) => {
              const on = !isNew && i.id === selId;
              return (
                <button key={i.id} type="button" data-inst-row={i.id} aria-current={on} onClick={() => { setIsNew(false); setSelId(i.id); }}
                  className="w-full grid gap-x-2 text-left px-3 py-1.5 border-b border-slate-100 hover:bg-[color:var(--ft-hover)]"
                  style={{ gridTemplateColumns: "minmax(0,1fr) auto", boxShadow: on ? "inset 2px 0 0 var(--ft-brand)" : undefined, background: on ? "var(--ft-tint)" : undefined }}>
                  <span className="truncate text-[13px] font-extrabold">{i.company}</span>
                  <PriorityTicks value={i.priority} />
                  <span className="col-span-2 truncate text-[11px] text-slate-400">
                    <b className="font-bold" style={{ color: "var(--ft-brand-deep)" }}>{tradeText(i.trades) || "No trades yet"}</b>{i.contact ? ` · ${i.contact}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          {draft && (
            <>
              <div className={HEAD + " px-4"}>
                <span className="truncate text-[13px] font-extrabold">{isNew ? "New installer" : draft.company || "Untitled"}</span>
                <span className="flex-1" />
                {!isNew && (confirmDel ? (
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="text-slate-500">Remove from the list? Jobs keep their copy.</span>
                    <button type="button" onClick={remove} className="font-bold text-red-600 hover:text-red-700">Remove</button>
                    <button type="button" onClick={() => setConfirmDel(false)} className="font-bold text-slate-500">Keep</button>
                  </span>
                ) : <button type="button" onClick={() => setConfirmDel(true)} className="text-[12px] font-bold text-red-600 hover:text-red-700">Remove</button>)}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3.5">
                <InstallerForm value={draft} isNew={isNew} inp={inp} lbl={lbl} onField={field} onCommit={() => commit(draft)} onAdd={add}
                  onCancel={() => { setIsNew(false); setDraft(sel ? { ...sel } : null); }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- the project header's hammer ---------------------------------------------

function PickRow({ i, trades, on, full, onToggle }) {
  return (
    <button type="button" data-inst-pick={i.id} aria-pressed={on} onClick={() => onToggle(i)}
      className="w-full grid gap-x-2.5 text-left px-3.5 py-2 border-t border-slate-100 items-start hover:bg-[color:var(--ft-hover)]"
      style={{ gridTemplateColumns: "18px minmax(0,1fr) auto", background: full ? "var(--ft-tint)" : undefined }}>
      <span className="mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
        style={on ? { background: "var(--ft-brand)", color: "var(--ft-card)" } : { border: "1.5px solid var(--ft-border-strong)" }}>{on && <Check size={11} strokeWidth={3.5} />}</span>
      <span className="truncate text-[13px] font-extrabold">{i.company}</span>
      {on ? <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--ft-brand-deep)" }}>On job</span> : <PriorityTicks value={i.priority} />}
      <span className="col-start-2 col-span-2 truncate text-[11px] text-slate-500">{[i.contact, i.phone].filter(Boolean).join(" · ")}</span>
      <span className="col-start-2 col-span-2 flex flex-wrap gap-1 mt-1">
        {trades.map((t) => <TradeChip key={t} t={t} state={i.trades.includes(t) ? "yes" : "no"} />)}
        {INSTALL_TRADES.filter((t) => !trades.includes(t) && i.trades.includes(t)).map((t) => <span key={t} className="text-[10.5px] font-bold text-slate-400">+{TRADE_LABEL[t]}</span>)}
      </span>
    </button>
  );
}

export function InstallerPicker({ anchorRef, installers, entries, trades, onToggle, onManage, onClose }) {
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(true, anchorRef, panelRef, onClose);
  useEscClose(true, onClose);
  const [showNone, setShowNone] = useState(false);
  if (!pos) return null;
  const r = rankInstallers(installers, trades);
  const onJob = (i) => entries.some((e) => e.id === i.id);
  const group = (label, list, full) => list.length > 0 && (
    <>
      <div className="px-3.5 pt-2 pb-1 ft-eyebrow text-[9px] flex items-center gap-1" style={full ? undefined : { color: "var(--ft-faint)" }}>{full && <Check size={10} strokeWidth={3} />}{label}</div>
      {list.map((i) => <PickRow key={i.id} i={i} trades={trades} on={onJob(i)} full={full} onToggle={onToggle} />)}
    </>
  );
  return (
    <SearchPop pos={pos} box={growBox(pos, 440)} fieldRef={anchorRef} panelRef={panelRef} bg="var(--ft-card)">
      <div data-inst-picker>
        <div className="px-3.5 pt-2.5 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 text-[14px] font-extrabold"><Hammer size={15} /> Installers for this job</div>
          <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[11px] text-slate-500">
            {trades.length ? <>This job needs {trades.map((t) => <TradeChip key={t} t={t} />)}</> : "No tile, hard surface or carpet lines yet."}
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: Math.max(160, Math.min(440, pos.maxH - 110)) }}>
          {!installers.length && <p className="px-3.5 py-3 text-[12px] text-slate-500">No installers on file yet.</p>}
          {group("Can do the whole job", r.full, true)}
          {group(trades.length ? "Can do part of it" : "Installers", r.part, false)}
          {trades.length > 0 && r.none.length > 0 && !showNone && (
            <button type="button" onClick={() => setShowNone(true)} className="w-full text-left px-3.5 py-2 border-t border-slate-100 text-[11px] font-bold text-slate-400 hover:text-slate-600">
              Show {r.none.length} who don't do anything on this job
            </button>
          )}
          {(showNone || !trades.length) && group(trades.length ? "Don't do anything on this job" : "Installers", r.none, false)}
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 border-t border-slate-200 text-[11px] text-slate-500" style={{ background: "var(--ft-cream)" }}>
          Click to add or remove. Saves right away.
          <span className="flex-1" />
          {onManage && <button type="button" onClick={() => { onClose(); onManage(); }} className="font-bold" style={{ color: "var(--ft-brand-deep)" }}>Manage installers →</button>}
        </div>
      </div>
    </SearchPop>
  );
}

// The header icon + its picker. `triggerClass` matches the header's own icons.
export function InstallerButton({ triggerClass, installers, entries, trades, onToggle, onManage, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <>
      <button ref={ref} type="button" data-inst-hammer onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Installers"
        data-tip="Installers — who's installing this job" title={label || triggerClass.includes("ft-tip") ? undefined : "Installers"} className={triggerClass}>
        <Hammer size={label ? 11 : 16} />{label}
        {entries.length > 0 && <span className="absolute rounded-full font-bold" style={{ top: -4, right: -4, fontSize: 9.5, lineHeight: "14px", minWidth: 14, padding: "0 3px", background: "var(--ft-brand)", color: "var(--ft-card)" }}>{entries.length}</span>}
      </button>
      {open && <InstallerPicker anchorRef={ref} installers={installers} entries={entries} trades={trades} onToggle={onToggle} onManage={onManage} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---- the box beside the areas ------------------------------------------------

export function InstallerBox({ entries, trades, onRemove, onOpen }) {
  const gaps = uncoveredTrades(entries, trades);
  return (
    <div data-inst-box className="rounded-lg border border-slate-200 p-3" style={{ background: "var(--ft-card)" }}>
      <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
        <Hammer size={14} /> Installers
        <span className="flex-1" />
        <button type="button" onClick={onOpen} aria-label="Add installers" title="Add installers" className="w-6 h-6 -mr-1 rounded-md flex items-center justify-center text-slate-500 hover:bg-[color:var(--ft-hover)]"><Plus size={14} /></button>
      </div>
      {!entries.length && <p className="pt-2 text-[11.5px] text-slate-400">None on this job yet. Click the hammer to pick.</p>}
      {entries.map((e, k) => (
        <div key={e.id} data-inst-entry={e.id} className={"py-2 grid gap-0.5 " + (k ? "border-t border-slate-100" : "")}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold min-w-0">
            <span className="truncate">{e.company}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => onRemove(e)} aria-label={`Remove ${e.company} from this job`} title="Remove from this job" className="p-0.5 rounded text-slate-400 hover:text-slate-700"><X size={12} /></button>
          </div>
          {e.contact && <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 min-w-0"><User size={11} className="shrink-0" /><span className="truncate">{e.contact}</span></div>}
          {e.phone && <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 min-w-0"><Phone size={11} className="shrink-0" /><span className="truncate">{e.phone}</span></div>}
          <div className="flex flex-wrap gap-1 mt-0.5">{entryTradesOnJob(e, trades).map((t) => <TradeChip key={t} t={t} state="yes" />)}</div>
        </div>
      ))}
      {entries.length > 0 && gaps.length > 0 && (
        <div className="mt-1 rounded-md px-2 py-1.5 text-[11px]" style={{ background: "var(--ft-hover-amber)", color: "#92400e" }}>No installer yet for {gaps.map((t) => TRADE_LABEL[t]).join(" · ")}</div>
      )}
    </div>
  );
}
