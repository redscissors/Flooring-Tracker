import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tag, Layers, ShowerHead, TreePine, User, Percent, BookOpen, Database, X } from "lucide-react";

export const RAIL_SLIDE_MS = 1300;

export const APP_ITEMS = [
  { id: "labels", label: "Label Generator", icon: Tag },
  { id: "schluter", label: "Schluter", icon: Layers },
  { id: "wedi", label: "wedi", icon: ShowerHead },
  { id: "sheoga", label: "Sheoga", icon: TreePine },
];
export const SETTINGS_ITEMS = [
  { id: "profile", label: "Your details", icon: User },
  { id: "general", label: "General", icon: Percent },
  { id: "book", label: "Price book", icon: BookOpen },
  { id: "materials", label: "Materials & add-ons", icon: Layers },
  { id: "backup", label: "Backup & restore", icon: Database },
];

function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const f = () => setOn(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return on;
}

// One solid panel whose height slides 0 ↔ its content. `anchor` pins the
// content to the panel's top edge (the tray rises out of the bottom bar
// heading-first) or its bottom edge (Settings drops from under the logo
// last-row-first) — the owner rejected per-row fades for this.
export function RailSlide({ open, anchor = "top", children }) {
  const inner = useRef(null);
  const [h, setH] = useState(0);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const on = () => setH(el.offsetHeight);
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div aria-hidden={!open} inert={open ? undefined : ""}
      style={{
        height: open ? h : 0, overflow: "hidden", flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: anchor === "bottom" ? "flex-end" : "flex-start",
        transition: reduce ? "none" : `height ${RAIL_SLIDE_MS}ms cubic-bezier(.32,.72,0,1)`,
      }}>
      <div ref={inner} style={{ flex: "none" }}>{children}</div>
    </div>
  );
}

export function DrawerList({ title, items, activeId, onPick, baseClass, className = "", divider = false }) {
  return (
    <div className={className} style={divider ? { borderBottom: "1px solid var(--ft-border-strong)" } : undefined}>
      <div className="mb-1 px-3.5 ft-eyebrow text-[9px]">{title}</div>
      {items.map(({ id, label, icon: Icon }) => {
        const on = id === activeId;
        return (
          <button key={id} onClick={() => onPick(id)} aria-current={on ? "page" : undefined}
            className={`${baseClass} ${on ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={15} className="w-4 shrink-0" /> <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PaneHeader({ backLabel, group, title, onBack, onClose }) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-slate-200 text-[13px] bg-white">
      <button onClick={onBack} className="rounded-md px-1.5 py-0.5 font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-700 truncate max-w-[40%]">← {backLabel}</button>
      <span className="text-slate-300">›</span>
      <span className="font-semibold text-slate-400">{group}</span>
      <span className="text-slate-300">›</span>
      <span className="font-bold text-slate-800 truncate">{title}</span>
      <button onClick={onClose} aria-label="Close" title="Close" className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"><X size={17} /></button>
    </div>
  );
}
