import { Component, useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, User, Paperclip, X, Lock, LockOpen, Eye, EyeOff, MapPin, ClipboardPaste } from "lucide-react";
import { num } from "./catalog.js";
import { money } from "./model.js";
import { normName, matchName } from "./names.js";
import { mapsUrl, cleanAddress } from "./address.js";
import { escPush } from "./escstack.js";

// Register onClose as the Escape action while `active` (escstack.js). Later
// registrations sit above earlier ones, so the most recently opened layer
// closes first.
export function useEscClose(active, onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    return escPush((ev) => ref.current(ev));
  }, [active]);
}

// A lazy chunk can fail to fetch — an offline blip, or a tab open from before
// a deploy whose hashed chunk no longer exists (main auto-deploys, Netlify
// deploys are atomic). Suspense doesn't catch that rejection; unguarded, it
// unmounts the entire app mid-estimate.
export class LazyBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 print:hidden">
        <div className="bg-white rounded-lg shadow-xl p-5 max-w-sm text-center">
          <div className="text-sm font-bold mb-1">Couldn't open this screen</div>
          <div className="text-xs text-slate-500 mb-3">The app has likely updated since this tab loaded — your work is saved.</div>
          <button onClick={() => location.reload()} className="rounded-md bg-indigo-600 text-white px-4 py-1.5 text-xs font-bold">Reload</button>
        </div>
      </div>
    );
  }
}

// A native select sizes to its longest option (or its container), not the
// selected one — an invisible twin of the selected label sets the width here.
export const FitSelect = ({ display, className = "", sm, children, ...rest }) => {
  const pad = sm ? "pl-1.5 pr-5 py-0.5 text-xs" : "pl-2 pr-6 py-1.5 text-sm";
  return (
    <span className={`relative inline-block max-w-full align-middle ${className}`}>
      <span aria-hidden="true" className={`invisible block truncate whitespace-pre border border-transparent ${pad}`}>{display || " "}</span>
      <select {...rest} className={`ft-field absolute inset-0 w-full h-full appearance-none rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${pad}`}>{children}</select>
      <ChevronDown size={sm ? 11 : 13} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
};

// Dropdown panels render in a portal on <body>: the product-row field bar and
// the settings modal both clip absolutely-positioned children (overflow), so
// the panel anchors to the input with fixed coordinates instead. Returns the
// anchor's viewport rect (tracked through scroll/resize) and dismisses on a
// pointer-down outside both the anchor and the panel.
// The panel opens below the anchor but flips above it when the space below
// can't fit a full panel and the space above shows more (on phones the
// keyboard eats the bottom half of the screen). pos carries `top` OR `bottom`
// plus `maxH`, the room on the chosen side; vPos() is the style fragment.
export const PANEL_MAX = 320; // tallest search panel: max-h-72 list + footer
export const useAnchoredPanel = (open, anchorRef, panelRef, onDismiss) => {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < Math.min(PANEL_MAX, above);
      setPos(up
        ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, maxH: Math.max(above, 120) }
        : { top: r.bottom + 4, left: r.left, width: r.width, maxH: Math.max(below, 120) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!anchorRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) onDismiss(); };
    // Focus leaving the field (Tab, or clicking into another input) must dismiss
    // too — a pointer-outside alone leaves the panel orphaned over the new field.
    // Deferred so focus has settled onto its target; picks keep focus in the
    // anchor (they preventDefault on mousedown), so they never trip this.
    const onFocusOut = () => requestAnimationFrame(() => {
      const ae = document.activeElement;
      if (ae && ae !== document.body && !anchorRef.current?.contains(ae) && !panelRef.current?.contains(ae)) onDismiss();
    });
    document.addEventListener("pointerdown", close);
    anchorRef.current?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", close);
      anchorRef.current?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);
  return pos;
};
export const vPos = (pos) => (pos.top != null ? { top: pos.top } : { bottom: pos.bottom });

// A right-anchored ⋯ action menu on the same portal + fixed-coordinates rig as
// the search panels: a scroll container can't clip it, and a trigger near the
// bottom of the screen flips the menu upward instead of dropping it off the
// page. The right edge hugs the trigger, clamped to the viewport; dismissal
// (outside pointer-down / focus-out) comes from useAnchoredPanel, so callers
// don't need a backdrop.
export function DotMenu({ open, onClose, anchorRef, width = 224, children }) {
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, onClose);
  useEscClose(open, onClose);
  if (!open || !pos) return null;
  const left = Math.max(8, Math.min(pos.left + pos.width - width, window.innerWidth - width - 8));
  return createPortal(
    <div ref={panelRef} style={{ ...vPos(pos), maxHeight: pos.maxH, width, left }} className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm overflow-y-auto">
      {children}
    </div>, document.body);
}

// Builder picker: type to search the canonical list or add a new one. Picking an
// existing builder links by id; typing a name close to an existing one warns
// before creating a duplicate ("P & L" vs "P&L") — ADR 0005.
export function BuilderCombo({ value, builders, onSelect, onAddBuilder, inp }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const cur = builders.find((b) => b.id === value) || null;
  useEffect(() => { setQ(cur ? cur.name : ""); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const typed = q.trim();
  const matches = builders.filter((b) => !typed || b.name.toLowerCase().includes(typed.toLowerCase()));
  const exists = builders.some((b) => normName(b.name) === normName(typed));
  const nd = typed && !exists ? matchName(builders, typed) : null;
  const pick = (b) => { onSelect(b ? b.id : null); setQ(b ? b.name : ""); setOpen(false); };
  // onAddBuilder creates + assigns the builder; the value prop then updates and
  // the effect above syncs the input text.
  const add = (name) => { onAddBuilder(name); setOpen(false); };
  return (
    <div className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); setQ(cur ? cur.name : ""); }, 150)}
        placeholder="No builder — type to search or add" className={inp} />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {cur && <div onMouseDown={(e) => { e.preventDefault(); pick(null); }} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 cursor-pointer flex justify-between"><span>Remove builder</span><span className="text-[11px]">direct customer</span></div>}
          {matches.map((b) => (
            <div key={b.id} onMouseDown={(e) => { e.preventDefault(); pick(b); }} className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer truncate">{b.name}</div>
          ))}
          {typed && !exists && (nd ? (
            <div className="px-3 py-2 text-[12.5px] border-t border-amber-200 bg-amber-50 text-amber-800">
              ⚠ "{typed}" looks like <b>{nd.item.name}</b>.{" "}
              <button onMouseDown={(e) => { e.preventDefault(); pick(nd.item); }} className="underline font-medium">Use {nd.item.name}</button>
              {" · "}
              <button onMouseDown={(e) => { e.preventDefault(); add(typed); }} className="underline">add "{typed}" anyway</button>
            </div>
          ) : (
            <div onMouseDown={(e) => { e.preventDefault(); add(typed); }} className="px-3 py-2 text-[12.5px] border-t border-slate-100 text-slate-600 hover:bg-slate-50 cursor-pointer">+ Add new builder <b>"{typed}"</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact contact/meta chip: shows the current value (or a muted placeholder
// label when empty) and highlights while its editor is expanded below.
export function MetaChip({ icon: Icon, label, value, active, onClick }) {
  return (
    <button onClick={onClick} className={"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] transition " + (active ? "bg-indigo-50 text-slate-700 ring-1 ring-indigo-200" : "bg-slate-100 text-slate-500 hover:text-slate-700")}>
      <Icon size={13} className="opacity-70" />
      {value ? <span className="max-w-[12rem] truncate font-medium text-slate-700">{value}</span> : <span>{label}</span>}
    </button>
  );
}

// The header's locked-in salesperson: shows the project's snapshotted
// salesperson (or the signed-in profile on pre-snapshot jobs) and opens an
// anchored editor to change it. Fields edit live like the rest of the app;
// "Use my details" restamps the whole snapshot from the current profile.
export function SalespersonPop({ value, fallback, onChange, alignRight, small }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  const sp = { name: "", phone: "", email: "", ...(value || fallback || {}) };
  const fld = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const W = 240;
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen((o) => !o)} title="Salesperson — locked in when the project was created. Click to change." className={"min-w-0 max-w-full truncate hover:text-indigo-700 text-left" + (small ? " font-bold" : " ft-serif")} style={{ fontSize: small ? 11.5 : 17, lineHeight: 1.2, borderBottom: "1px dashed var(--ft-border-strong)", alignSelf: small ? "flex-start" : undefined }}>
        {sp.name || sp.email || "Set salesperson"}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), left: Math.max(8, Math.min(alignRight ? pos.left + pos.width - W : pos.left, window.innerWidth - W - 8)) }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 p-3 space-y-1.5" onKeyDown={(e) => { if (e.key === "Escape") e.preventDefault(); if (e.key === "Escape" || e.key === "Enter") setOpen(false); }} >
          <div className="ft-eyebrow text-[9px]">Salesperson</div>
          <input autoFocus value={sp.name} onChange={(e) => onChange({ ...sp, name: e.target.value })} placeholder="Name" className={fld} style={{ width: W - 24 }} />
          <input value={sp.phone} onChange={(e) => onChange({ ...sp, phone: e.target.value })} placeholder="Phone" className={fld} style={{ width: W - 24 }} />
          <input value={sp.email} onChange={(e) => onChange({ ...sp, email: e.target.value })} placeholder="Email" className={fld} style={{ width: W - 24 }} />
          <div className="flex items-center justify-between pt-1">
            <button onClick={() => onChange({ name: fallback?.name || "", phone: fallback?.phone || "", email: fallback?.email || "" })} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"><User size={13} /> Use my details</button>
            <button onClick={() => setOpen(false)} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-2.5 py-1.5">Done</button>
          </div>
        </div>, document.body)}
    </>
  );
}

// A tiny ? that pops the full explanation on hover, keyboard focus, or tap —
// unlike a title= tooltip it works on the shop iPads. For STANDING RULES only:
// text that's true every day and needs reading once. Text that reports state
// or a warning (import hazards, ASSUMED quantities, drift) stays inline —
// hiding it hides the problem.
export function HelpTip({ tip, w = 240, className = "" }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  return (
    <span className={"inline-flex shrink-0 " + className} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button ref={anchorRef} type="button" aria-label="More about this" aria-expanded={open}
        onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="w-3.5 h-3.5 rounded-full border border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 text-[9.5px] font-extrabold leading-none flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-indigo-500">?</button>
      {open && pos && createPortal(
        <div ref={panelRef} role="tooltip"
          style={{ ...vPos(pos), left: Math.max(8, Math.min(pos.left + pos.width / 2 - w / 2, window.innerWidth - w - 8)), width: w, background: "var(--ft-text)", color: "var(--ft-cream)" }}
          className="fixed z-[70] rounded-md px-3 py-2 text-[11px] font-medium leading-relaxed shadow-lg">{tip}</div>, document.body)}
    </span>
  );
}

// Single-choice slide bar (spec 2026-07-16) — mirrors the header action
// buttons' 30px height. An `input` option renders an inline % field (the
// Custom tier) that selects its tier on focus/typing. Exported (with FilesPop)
// for the .scratch preview harnesses only.
export function SegBar({ value, onChange, options, inputValue, onInput }) {
  return (
    <div className="flex h-[30px] shrink-0 rounded-md border border-slate-200 overflow-hidden" style={{ background: "var(--ft-band)" }}>
      {options.map((o, i) => {
        const active = value === o.v;
        const seg = "flex-1 min-w-0 flex items-center justify-center text-[11.5px] font-semibold transition-colors " + (i > 0 ? "border-l border-slate-200 " : "") + (active ? (o.color ? "text-white" : "bg-indigo-600 text-white") : "text-slate-500 hover:bg-white");
        const fill = active && o.color ? { background: o.color } : undefined;
        if (o.input) return (
          <label key={o.v} className={seg + " cursor-text px-1"} style={fill} title={o.title}>
            <input type="number" min="0" max="100" value={inputValue} onFocus={() => onChange(o.v)} onChange={(e) => onInput(e.target.value)} className={"w-8 bg-transparent text-right focus:outline-none " + (active ? "text-white" : "text-slate-500")} />
            <span className="pr-0.5">%</span>
          </label>
        );
        return <button key={o.v} onClick={() => onChange(o.v)} title={o.title} className={seg} style={fill}>{o.label}</button>;
      })}
    </div>
  );
}

// Waste, per job (spec 2026-07-19). Each family is a press-to-apply button
// showing the rate it applies: unpressed means the quote orders raw measured
// footage. Pressed fills ink at the shop default and moss when the rate has
// been changed, so "waste is on" and "waste is on but not our usual number"
// read differently across the room.
//
// The rates hide behind the lock because waste multiplies EVERY quantity on
// the job — a bare number input sitting in the header is one stray scroll
// away from silently repricing the whole quote, with nothing on screen to say
// why. Editing is deliberate: unlock, type, and it re-locks the moment focus
// leaves. Text inputs (not number) for the same reason — no wheel, no spinner.
export function WasteBar({ w, dflt, onChange, className = "" }) {
  const [unlocked, setUnlocked] = useState(false);
  useEscClose(unlocked, () => setUnlocked(false));
  const wrap = useRef(null);
  const cells = [{ k: "tile", flag: "tileOn", label: "Tile", of: "tile" }, { k: "floor", flag: "floorOn", label: "Flr", of: "other flooring" }];
  return (
    <div ref={wrap} className={"flex h-[30px] shrink-0 rounded-md border overflow-hidden " + className}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget)) setUnlocked(false); }}
      onKeyDown={(e) => { if (e.key === "Escape" && unlocked) e.preventDefault(); if (e.key === "Escape" || e.key === "Enter") setUnlocked(false); }}
      style={{ borderColor: unlocked ? "var(--ft-brand)" : "var(--ft-border)", background: unlocked ? "var(--ft-card)" : "var(--ft-band)", boxShadow: unlocked ? "0 0 0 2px var(--ft-brand-soft)" : undefined }}>
      {cells.map((c, i) => {
        const on = !!w[c.flag], pct = num(w[c.k]);
        const custom = on && pct !== num(dflt?.[c.k]);
        const fill = !unlocked && on ? (custom ? "var(--ft-brand-deep)" : "var(--ft-text)") : undefined;
        const dim = on && !unlocked ? "rgba(246,243,236,.7)" : "var(--ft-faint)";
        return (
          <div key={c.k} className="flex-1 min-w-0 flex items-center" style={{ background: fill, borderLeft: i ? "1px solid var(--ft-border)" : undefined }}>
            {unlocked ? (
              <label className="flex-1 min-w-0 flex items-center gap-1 px-1.5 cursor-text">
                <span className="text-[10.5px]" style={{ color: "var(--ft-brand-deep)" }}>{c.label}</span>
                <input value={w[c.k]} inputMode="numeric" onChange={(e) => onChange({ [c.k]: e.target.value })}
                  className="ml-auto w-6 min-w-0 bg-transparent text-right text-[12.5px] font-semibold focus:outline-none"
                  style={{ color: "var(--ft-text)", borderBottom: "1px solid var(--ft-brand)" }} />
                <span className="text-[10px]" style={{ color: "var(--ft-faint)" }}>%</span>
              </label>
            ) : (
              <button onClick={() => onChange({ [c.flag]: !on })} title={on ? `${pct}% waste applied to ${c.of} — press to order raw measured footage` : `No waste on ${c.of} — press to add ${pct}%`}
                className="flex-1 min-w-0 h-full flex items-center gap-1 px-1.5">
                <span className="text-[10.5px]" style={{ color: dim }}>{c.label}</span>
                <span className="ml-auto text-[12.5px]" style={{ color: on ? "var(--ft-cream)" : "var(--ft-faint)", fontWeight: on ? 600 : 400 }}>{pct}</span>
                <span className="text-[10px]" style={{ color: dim }}>%</span>
              </button>
            )}
          </div>
        );
      })}
      <button onClick={() => setUnlocked((v) => !v)} title={unlocked ? "Lock the waste rates" : "Change the waste rates"}
        className="w-6 shrink-0 flex items-center justify-center"
        style={{ borderLeft: "1px solid var(--ft-border)", background: unlocked ? "var(--ft-brand)" : undefined, color: unlocked ? "var(--ft-cream)" : "var(--ft-faint)" }}>
        {unlocked ? <LockOpen size={12} /> : <Lock size={12} />}
      </button>
    </div>
  );
}

// Files, collapsed to a paperclip chip (spec 2026-07-16): the old dashed box
// moved into an anchored popover so header column 1 can hold the pricing bars.
export function FilesPop({ attachments, onOpen, onDelete, onAdd, mini, tip }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  const n = (attachments || []).length;
  const W = 260;
  return (
    <>
      {/* mini = the one-bar header's 45×26 square with a count badge and the
          square hover-tip card in place of the native title */}
      <button ref={anchorRef} onClick={() => setOpen((o) => !o)} data-tip={mini ? tip : undefined} title={mini ? undefined : `Files (not printed)${n ? ` — ${n}` : ""}`}
        className={mini ? "ft-tip relative w-[45px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-50" : "h-[30px] flex-1 flex items-center justify-center gap-1 rounded-md border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"}
        style={mini ? { border: "1px solid var(--ft-border-strong)" } : undefined}>
        <Paperclip size={mini ? 13 : 14} />
        {n > 0 && (mini
          ? <span className="absolute rounded-full font-bold" style={{ top: -6, right: -6, fontSize: 10, padding: "1px 5px", background: "var(--ft-sand)", color: "var(--ft-muted)", border: "1px solid var(--ft-border)" }}>{n}</span>
          : <span className="font-semibold">{n}</span>)}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), left: Math.max(8, Math.min(pos.left, window.innerWidth - W - 8)), width: W }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 p-2">
          <div className="ft-eyebrow text-[9px] mb-1.5">Files <span className="normal-case tracking-normal font-normal text-slate-400">— not printed</span></div>
          <div className="flex flex-wrap gap-1">
            {(attachments || []).map((m) => (
              <span key={m.id} className="flex items-center gap-1 rounded-md bg-slate-100 pl-1.5 pr-1 py-0.5 text-[11px]">
                <button onClick={() => onOpen(m)} className="hover:text-indigo-600 max-w-[9rem] truncate" title={`${m.name} · ${Math.max(1, Math.round(m.size / 1024))} KB`}>{m.name}</button>
                <button onClick={() => onDelete(m)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
              </span>
            ))}
            <button onClick={onAdd} className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"><Paperclip size={11} /> Add</button>
          </div>
        </div>, document.body)}
    </>
  );
}

// Animated light/dark switch (RiccardoRapelli sun/moon toggle, Uiverse.io) —
// a quick binary shortcut for the three-way theme control in Settings. Checked
// = dark; toggling writes an explicit "light"/"dark" (leaving "System").
export function ThemeSwitch({ theme, setTheme }) {
  const sysDark = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
  const dark = theme === "dark" || (theme === "system" && sysDark);
  const circle = <circle cx="50" cy="50" r="50" />;
  const starPath = "M 10 0 C 10 5 5 10 0 10 C 5 10 10 15 10 20 C 10 15 15 10 20 10 C 15 10 10 5 10 0 Z";
  return (
    <label className="ft-theme-switch" title={dark ? "Dark mode — switch to light" : "Light mode — switch to dark"}>
      <input id="ft-theme-cb" type="checkbox" checked={dark} onChange={() => setTheme(dark ? "light" : "dark")} />
      <div className="slider round">
        <div className="sun-moon">
          <svg id="moon-dot-1" className="moon-dot" viewBox="0 0 100 100">{circle}</svg>
          <svg id="moon-dot-2" className="moon-dot" viewBox="0 0 100 100">{circle}</svg>
          <svg id="moon-dot-3" className="moon-dot" viewBox="0 0 100 100">{circle}</svg>
          <svg id="light-ray-1" className="light-ray" viewBox="0 0 100 100">{circle}</svg>
          <svg id="light-ray-2" className="light-ray" viewBox="0 0 100 100">{circle}</svg>
          <svg id="light-ray-3" className="light-ray" viewBox="0 0 100 100">{circle}</svg>
          <svg id="cloud-1" className="cloud-dark" viewBox="0 0 100 100">{circle}</svg>
          <svg id="cloud-2" className="cloud-dark" viewBox="0 0 100 100">{circle}</svg>
          <svg id="cloud-3" className="cloud-dark" viewBox="0 0 100 100">{circle}</svg>
          <svg id="cloud-4" className="cloud-light" viewBox="0 0 100 100">{circle}</svg>
          <svg id="cloud-5" className="cloud-light" viewBox="0 0 100 100">{circle}</svg>
          <svg id="cloud-6" className="cloud-light" viewBox="0 0 100 100">{circle}</svg>
        </div>
        <div className="stars">
          <svg id="star-1" className="star" viewBox="0 0 20 20"><path d={starPath} /></svg>
          <svg id="star-2" className="star" viewBox="0 0 20 20"><path d={starPath} /></svg>
          <svg id="star-3" className="star" viewBox="0 0 20 20"><path d={starPath} /></svg>
          <svg id="star-4" className="star" viewBox="0 0 20 20"><path d={starPath} /></svg>
        </div>
      </div>
    </label>
  );
}

// Internal materials-margin line for the on-screen Order summary (ADR 0011 /
// 0009 §8.1). Special-order lines only; sell − cost with the blended margin as a
// percent of sell. Default masked, click to reveal (customer-safe). `ft-noprint`
// and its placement outside renderEstimatePaper keep it off both print paths.
export function MarginLine({ margin, show, onToggle }) {
  if (!margin || !(margin.sell > 0)) return null;
  return (
    <div className="ft-noprint flex items-center justify-between gap-2" style={{ marginTop: 6, fontSize: 11 }} title="Internal only — sell minus cost on special-order lines (% of sell). Never printed.">
      <button onClick={onToggle} className="flex items-center gap-1.5" style={{ color: "var(--ft-faint)" }}>
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
        <span className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".14em" }}>Special-order margin</span>
      </button>
      <span className="ft-mono" style={{ color: show ? "var(--ft-brand-deep)" : "var(--ft-faint)" }}>{show ? `${money(margin.margin)} · ${margin.pct}%` : "•••"}</span>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  useEscClose(true, onClose);
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="ft-serif text-2xl">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

// The shared Stock only / Full catalog switch (phase 4): both vendor
// configurators mount this seg in their pop-head, so the two popups can't
// drift on what the control looks like or says. Styling is each popup's own
// `.srcseg` block; this carries no engine knowledge — the caller owns what
// the source constrains.
export function SourceSwitch({ source, onChange, title }) {
  return (
    <div className="srcseg" title={title || "Stock only removes non-stocked parts from the candidate pool; Full catalog ranks freely and tags special order"}>
      <button className={source === "stock" ? "on" : ""} onClick={() => onChange("stock")} data-source-stock>Stock only</button>
      <button className={source === "all" ? "on" : ""} onClick={() => onChange("all")} data-source-all>Full catalog</button>
    </div>
  );
}

// The wedi/Schluter basket drawer shell (ADR 0035 step 3) — one shared
// presentation component so the two popups can't drift (the SourceSwitch
// doctrine). Engine-free: callers hand it pre-priced view rows. Staged rows
// carry checkboxes + Move (delete-on-move rides the caller's patch); placed
// rows carry Reconfigure + the armed two-click Remove (the Sheoga idiom).
const fmt$ = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString());
export function KitBasketPanel({ title = "Basket", staged = [], sel = {}, onToggle, onSelectAll, onRemove, onMove, onMoveAll, placed = [], onEditPlaced, onDeletePlaced, areaName, onClose, tierColor, emptyText = 'Basket is empty. Build a kit and click "Basket".' }) {
  const n = staged.length, selCount = staged.filter((b) => sel[b.id]).length;
  const [armDel, setArmDel] = useState(null);
  return (
    <div className="flex flex-col h-full" data-kit-basket>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-extrabold">{title}</span>
        <span className="text-[11px] text-slate-400 font-semibold">{n} staged · saved with this job</span>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {n === 0 && !placed.length ? <div className="text-center text-xs font-semibold text-slate-400 py-10">{emptyText}</div> :
          staged.map((v) => { const on = !!sel[v.id]; return (
            <div key={v.id} className={`flex gap-2.5 items-start rounded-lg border p-2.5 mb-2 ${on ? "border-[color:var(--ft-brand)]" : "border-slate-200"} ${v.faint ? "opacity-60" : ""}`}>
              <button onClick={() => onToggle(v.id)} className={`w-[18px] h-[18px] mt-0.5 rounded-[5px] border flex items-center justify-center text-[11px] font-black text-white shrink-0 ${on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)]" : "border-slate-300"}`}>{on ? "✓" : ""}</button>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-tight">{v.title}</div>
                <div className="text-[11px] text-slate-500 font-semibold">
                  {/* A targeted entry REPLACES a kit already on the job — it has
                      to read differently from one that adds a second shower. */}
                  {v.target && <span className="mr-1.5 rounded-full px-1.5 py-px text-[10px] font-extrabold uppercase tracking-wide"
                    style={{ background: "var(--ft-brand)", color: "#fff" }}>Update</span>}
                  {v.meta}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5"><span className="font-extrabold tabular-nums text-[13px]" style={tierColor ? { color: tierColor } : undefined}>{fmt$(v.price)}</span><button onClick={() => onRemove(v.id)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button></div>
            </div>); })}
        {n > 0 && <div className="text-center pt-1"><button onClick={onSelectAll} className="text-[11px] font-bold underline underline-offset-2" style={{ color: "var(--ft-brand-deep)" }}>{selCount === n ? "Clear selection" : "Select all"}</button></div>}
        {placed.length > 0 && <>
          <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">In this project</span>
            <span className="text-[10px] text-slate-400 font-semibold">reconfigure to change — the lines follow</span>
          </div>
          {placed.map((k) => { const arm = armDel === k.rowId; return (
            <div key={k.rowId} className={`rounded-lg border border-slate-200 p-2.5 mb-2 ${k.faint ? "opacity-60" : ""}`}>
              <div className="flex gap-2.5 items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold leading-tight">{k.title}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{k.meta}{k.areaName ? <> · in <b>{k.areaName}</b></> : null}</div>
                </div>
                <span className="font-extrabold tabular-nums text-[13px]" style={tierColor ? { color: tierColor } : undefined}>{fmt$(k.price)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1.5">
                <button onClick={() => onEditPlaced(k)} className="rounded-full border px-2 py-0.5 text-[11px] font-bold hover:bg-slate-50" style={{ borderColor: "var(--ft-brand)", color: "var(--ft-brand-deep)" }}>Reconfigure</button>
                {arm ? <>
                  <span className="text-[11px] font-semibold text-red-600">Remove this kit's lines?</span>
                  <button onClick={() => { setArmDel(null); onDeletePlaced(k); }} className="rounded-full border border-red-300 text-red-600 px-2 py-0.5 text-[11px] font-bold hover:bg-red-50">Remove</button>
                  <button onClick={() => setArmDel(null)} className="text-[11px] font-semibold text-slate-400">Keep</button>
                </> : <button onClick={() => setArmDel(k.rowId)} className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-slate-600">Remove…</button>}
              </div>
            </div>); })}
        </>}
      </div>
      {onMove && <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200">
        <span className="text-[11px] text-slate-500 font-semibold">{selCount} selected → <b>{areaName}</b></span>
        <button disabled={!n} onClick={onMoveAll} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Move all</button>
        <button disabled={!selCount} onClick={onMove} className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold disabled:opacity-40">Move {selCount} → {areaName}</button>
      </div>}
    </div>
  );
}

// A number field that commits on blur/Enter rather than per keystroke — both
// vendor configurators re-solve whole builds off these, and a half-typed "4"
// of "48" is not a room (the wedi doctrine, shared here in round 6 so the
// popups can't drift on input behavior).
export function NumIn({ value, onCommit, ...rest }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const live = useRef(false);
  useEffect(() => { if (!live.current) setDraft(value == null ? "" : String(value)); }, [value]);
  return <input {...rest} value={draft}
    onFocus={() => { live.current = true; }}
    onChange={(e) => setDraft(e.target.value)}
    onBlur={() => { live.current = false; onCommit(draft); }}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />;
}

// The address field, with the two shortcuts that stand in for a typeahead:
// open Maps seeded with what's typed, and paste back what you copied there.
// Clipboard reads are gated by the browser (Firefox and Safari prompt; an
// http origin refuses outright), so a refusal falls back to focusing the
// field — the button is a convenience, never the only way in.
const ADDR_BTN = "shrink-0 flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-400 hover:text-indigo-700 hover:border-indigo-300 transition";
const PASTE_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "") ? "⌘V" : "Ctrl+V";

export function AddressField({ value, onChange, inp, placeholder, autoFocus, ping }) {
  const ref = useRef(null);
  const paste = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { ref.current?.focus(); ping?.(`Press ${PASTE_KEY} to paste`); return; }
    const clean = cleanAddress(text);
    if (clean) onChange(clean); else ping?.("Nothing on the clipboard — copy the address from Maps first");
  };
  return (
    <div className="flex items-center gap-1">
      <input ref={ref} value={value || ""} autoFocus={autoFocus} placeholder={placeholder} className={inp} onChange={(e) => onChange(e.target.value)} />
      <button type="button" title="Look up on Google Maps" className={ADDR_BTN}
        onClick={() => window.open(mapsUrl(value), "_blank", "noopener,noreferrer")}><MapPin size={15} /></button>
      <button type="button" title="Paste the address you copied" className={ADDR_BTN} onClick={paste}><ClipboardPaste size={15} /></button>
    </div>
  );
}
