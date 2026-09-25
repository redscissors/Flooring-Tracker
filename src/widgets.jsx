import { Children, Component, Fragment, isValidElement, useState, useEffect, useLayoutEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, User, Paperclip, X, Lock, LockOpen, Eye, EyeOff, MapPin, ClipboardPaste, Check, ShoppingBasket } from "lucide-react";
import { num } from "./catalog.js";
import { money } from "./model.js";
import { TIER_COLOR } from "./uiconst.js";
import { normName, matchName } from "./names.js";
import { phoneChange } from "./phone.js";
import { mapsUrl, cleanAddress } from "./address.js";
import { escPush } from "./escstack.js";
import { flatten, moveIndex, edgeIndex, typeahead, placeMorph } from "./dropdown.js";
import { useAddressSuggest, fetchDistance, fetchPlaceDetails } from "./usemapslookup.js";
import { MIN_SUGGEST, formatDist, distStale } from "./mapslookup.js";

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

// The drawer's dropdowns keep a <select>'s call shape — <option>/<optgroup>
// children and onChange(e) reading e.target.value — so they read like the
// markup they replaced; underneath each is a MorphSelect (ADR 0048).
export const FitSelect = ({ display, className = "", sm, full, liveType, children, value, onChange, title, bg = "var(--ft-field)" }) => (
  <MorphSelect size={sm ? "sm" : "md"} full={full} liveType={liveType} className={className} title={title} value={String(value ?? "")} display={display}
    groups={selectGroups(children)} bg={bg} onChange={(v) => onChange?.({ target: { value: v } })} />
);

const selectGroups = (children) => {
  const groups = [];
  let loose = null;
  const walk = (nodes, into) => Children.forEach(nodes, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) return walk(c.props.children, into);
    if (c.type === GroutColorOptions) return walk(GroutColorOptions(c.props), into);
    if (c.type === "optgroup") {
      const g = { label: c.props.label, items: [] };
      groups.push(g);
      loose = null;
      return walk(c.props.children, g.items);
    }
    if (c.type !== "option") return;
    if (!into && !loose) { loose = { label: null, items: [] }; groups.push(loose); }
    const label = Children.toArray(c.props.children).join("");
    (into || loose.items).push({ v: String(c.props.value ?? label), label, disabled: c.props.disabled });
  });
  walk(children, null);
  return groups;
};

// A grout color dropdown's options (stock.js groutColorOptions): flat while
// the family is stock-only; grouped "In stock" / "Special order" once it has
// an order-book source.
export const GroutColorOptions = ({ groups }) => groups.special.length === 0
  ? groups.stock.map((c) => <option key={c}>{c}</option>)
  : <>
    <optgroup label="In stock">{groups.stock.map((c) => <option key={c}>{c}</option>)}</optgroup>
    <optgroup label="Special order">{groups.special.map((c) => <option key={c}>{c}</option>)}</optgroup>
  </>;

export const useDismissOutside = (open, anchorRef, panelRef, onDismiss) => {
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
      const field = { ft: r.top, fb: r.bottom, h: r.height };
      setPos(up
        ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, maxH: Math.max(above, 120), ...field }
        : { top: r.bottom + 4, left: r.left, width: r.width, maxH: Math.max(below, 120), ...field });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  useDismissOutside(open, anchorRef, panelRef, onDismiss);
  return pos;
};
export const vPos = (pos) => (pos.top != null ? { top: pos.top } : { bottom: pos.bottom });

const MORPH_EASE = "cubic-bezier(.2,.8,.2,1)";
const POP_SHADOW = "0 12px 28px -12px rgba(28,26,23,.45)";
const calmMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const searchInput = (el) => el && (el.matches("input, textarea") ? el : el.querySelector("input, textarea"));
const anchorTarget = (el) => searchInput(el) || el;

// The box a popover grows to from its anchor: `width` wide (never narrower
// than the anchor), running right from it unless that would leave the
// screen or `prefer` is "left". `right` says which side the extra room is on.
export const growBox = (pos, width, prefer = "right") => {
  const W = Math.max(width, pos.width);
  const fitsRight = pos.left + W <= window.innerWidth - 8;
  const fitsLeft = pos.left + pos.width - W >= 8;
  const right = prefer === "left" ? !fitsLeft && fitsRight : fitsRight || !fitsLeft;
  return { left: right ? pos.left : Math.max(8, pos.left + pos.width - W), width: W, right };
};
const foldingPops = new WeakMap();

// A search field's results in the price menu's open look (ADR 0048). The field
// focuses in the same ink line (.ft-search), and the box morphs out of it like
// MorphSelect: it mounts exactly over the field, then widens and grows its
// results below (above when it flips up). The field row is see-through and
// passes clicks, so the caret stays in the real field underneath. `box` is the
// results' { left, width } when wider than the field; `lead` / `trail` fill
// the box's field row left / right of the field (the price popup's cost
// input, the line menu's title). The anchor can also be a plain button (type
// chip, ⋯): its box outline then fades in rather than taking over a focus line.
export function SearchPop({ pos, box, fieldRef, panelRef, lead, trail, z = 50, bg = "var(--ft-card)", className = "", style, children }) {
  const rootRef = useRef(null);
  const [shown, setShown] = useState(false);
  const [B, setB] = useState(1.5);
  const [{ radius, inked }] = useState(() => {
    const f = anchorTarget(fieldRef?.current);
    return { radius: Math.min(8, Math.max(4, f ? parseFloat(getComputedStyle(f).borderTopLeftRadius) || 0 : 8)), inked: !!f?.matches(".ft-search") };
  });
  useLayoutEffect(() => {
    const field = anchorTarget(fieldRef?.current);
    foldingPops.get(field)?.remove();
    // The box's border now draws the field's line; the field's own rounded
    // outline would otherwise show its corners inside a box wider than it.
    const prevOutline = field?.style.outlineColor;
    if (field) field.style.outlineColor = "transparent";
    const root = rootRef.current;
    // Browsers snap the 1.5px line to whole device pixels; sizing the field
    // row off the drawn width keeps the closed box exactly field-high.
    setB(parseFloat(getComputedStyle(root).borderTopWidth) || 1.5);
    root.getBoundingClientRect(); // commit the field-sized start so the grow transitions
    const id = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(id);
      if (field) field.style.outlineColor = prevOutline;
      foldAway(root, field);
    };
  }, []);
  const up = pos.bottom != null;
  const left = box?.left ?? pos.left;
  const width = box?.width ?? pos.width;
  const ease = (prop) => `${prop} var(--ft-spop-in) ${MORPH_EASE}`;
  // The left fill's width and the box's left edge move in lockstep, so the
  // see-through hole stays pinned over the field while the box widens.
  const head = (
    <div className="flex shrink-0" style={{ height: Math.max(0, pos.h - 2 * B) }}>
      <div data-spop-fill className="flex justify-end overflow-hidden" style={{ width: shown ? Math.max(0, pos.left - left) : 0, background: bg, transition: ease("width") }}>
        {lead && <div className="shrink-0 flex items-center" style={{ width: Math.max(0, pos.left - left), pointerEvents: "auto" }}>{lead}</div>}
      </div>
      <div className="shrink-0" style={{ width: Math.max(0, pos.width - 2 * B) }} />
      <div className="flex-1 overflow-hidden" style={{ background: bg }}>
        {trail && <div className="h-full flex items-center whitespace-nowrap" style={{ width: Math.max(0, left + width - pos.left - pos.width), pointerEvents: "auto" }}>{trail}</div>}
      </div>
    </div>
  );
  const rule = <div className="shrink-0 border-t border-slate-300 mx-2" />;
  const body = <div className={"min-h-0 " + className} style={{ pointerEvents: "auto", maxHeight: pos.maxH, ...style }}>{children}</div>;
  const grow = children != null && children !== false && (
    <div data-spop-grow style={{ display: "grid", gridTemplateRows: shown ? "1fr" : "0fr", transition: ease("grid-template-rows") }}>
      <div className="min-h-0 overflow-hidden flex flex-col" style={{ background: bg }}>
        {up ? <>{body}{rule}</> : <>{rule}{body}</>}
      </div>
    </div>
  );
  return createPortal(
    <div ref={(el) => { rootRef.current = el; if (panelRef) panelRef.current = el; }} className="flex flex-col" data-up={up ? "true" : undefined} data-l0={pos.left} data-w0={pos.width}
      style={{ position: "fixed", zIndex: z, left: shown ? left : pos.left, width: shown ? width : pos.width,
        ...(up ? { bottom: window.innerHeight - pos.fb } : { top: pos.ft }),
        border: `${B}px solid ${shown || inked ? "var(--ft-text)" : "transparent"}`, borderRadius: radius, overflow: "hidden", pointerEvents: "none",
        boxShadow: shown ? POP_SHADOW : "none", transition: [ease("left"), ease("width"), ease("box-shadow"), ease("border-color")].join(", ") }}>
      {up ? <>{grow}{head}</> : <>{head}{grow}</>}
    </div>, document.body);
}

// Callers unmount SearchPop the moment results close, so the fold plays on an
// inert clone: the results shrink back into the field and the box narrows to
// it, then the clone is removed. Its outline fades out unless the field still
// has focus (a pick or Esc), where the field's own identical line takes over.
function foldAway(root, field) {
  if (!root || calmMotion()) return;
  const ghost = root.cloneNode(true);
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  const from = root.querySelectorAll("*"), to = ghost.querySelectorAll("*");
  from.forEach((el, i) => { if (el.scrollTop) to[i].scrollTop = el.scrollTop; });
  if (field) foldingPops.set(field, ghost);
  const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ft-spop-out")) || 200;
  requestAnimationFrame(() => {
    const ease = (prop) => `${prop} ${ms}ms cubic-bezier(.4,0,.2,1)`;
    const keep = field?.isConnected && field.matches(".ft-search") && document.activeElement === field;
    Object.assign(ghost.style, {
      transition: ["left", "width", "box-shadow", "border-color"].map(ease).join(", "),
      left: ghost.dataset.l0 + "px", width: ghost.dataset.w0 + "px", boxShadow: "none",
      borderColor: keep ? "var(--ft-text)" : "transparent",
    });
    const grow = ghost.querySelector("[data-spop-grow]");
    const fill = ghost.querySelector("[data-spop-fill]");
    if (grow) Object.assign(grow.style, { transition: ease("grid-template-rows"), gridTemplateRows: "0fr" });
    if (fill) Object.assign(fill.style, { transition: ease("width"), width: "0px" });
  });
  setTimeout(() => {
    ghost.remove();
    if (field && foldingPops.get(field) === ghost) foldingPops.delete(field);
  }, ms + 60);
}

// A floating panel with no button to grow from (right-click menus): `.ft-pop`
// at fixed coordinates, and on unmount an inert clone folds it up and fades
// it rather than dropping it in one frame. `plain` skips the .ft-pop shell for
// a panel that brings its own (the configurators' wall menus).
export function PointPop({ popRef, plain, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    return () => fadeAway(el);
  }, []);
  return createPortal(
    <div ref={(el) => { ref.current = el; if (popRef) popRef.current = el; }} style={style} className={(plain ? "" : "ft-pop fixed z-50 ") + className} {...rest}>{children}</div>,
    document.body);
}

// An option menu that grows out of what opened it (`at.anchor`: a row, a
// chip) or, with nothing to grow from, opens at `at.x`/`at.y`. Callers own Esc.
export function PopMenu({ at, ...props }) {
  return at.anchor?.isConnected
    ? <GrownMenu key="g" at={at} {...props} />
    : <PointMenu key={`${at.x},${at.y}`} at={at} {...props} />;
}

function GrownMenu({ at, width, align = "left", pad = 0, onClose, lead, trail, z, className = "", children }) {
  const anchorRef = useRef(at.anchor);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(true, anchorRef, panelRef, onClose);
  if (!pos) return null;
  const W = Math.max(width, pos.width + 2 * pad);
  const x = align === "right" ? pos.left + pos.width + pad - W : pos.left - pad;
  return (
    <SearchPop pos={pos} box={{ left: Math.max(8, Math.min(x, window.innerWidth - W - 8)), width: W }} fieldRef={anchorRef} panelRef={panelRef}
      lead={lead} trail={trail} z={z} className={"overflow-y-auto " + className}>{children}</SearchPop>
  );
}

function PointMenu({ at, width, onClose, z, className = "", children }) {
  const ref = useRef(null);
  useDismissOutside(true, ref, ref, onClose);
  const left = Math.max(8, Math.min(at.x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(at.y, window.innerHeight - 140));
  return <PointPop popRef={ref} className={"overflow-y-auto " + className} style={{ left, top, width, maxHeight: window.innerHeight - top - 8, zIndex: z }}>{children}</PointPop>;
}

function fadeAway(el) {
  if (!el || calmMotion()) return;
  const ghost = el.cloneNode(true);
  Object.assign(ghost.style, { pointerEvents: "none", animation: "none", clipPath: "inset(0 0 0 0 round .5rem)" });
  document.body.appendChild(ghost);
  ghost.scrollTop = el.scrollTop;
  const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ft-spop-out")) || 200;
  requestAnimationFrame(() => Object.assign(ghost.style, {
    transition: `clip-path ${ms}ms cubic-bezier(.4,0,.2,1), opacity ${ms}ms cubic-bezier(.4,0,.2,1)`,
    clipPath: ghost.dataset.up ? "inset(100% 0 0 0 round .5rem)" : "inset(0 0 100% 0 round .5rem)", opacity: "0",
  }));
  setTimeout(() => ghost.remove(), ms + 60);
}

// A right-anchored ⋯ action menu on the same portal + fixed-coordinates rig as
// the search panels: a scroll container can't clip it, and a trigger near the
// bottom of the screen flips the menu upward instead of dropping it off the
// page. The right edge hugs the trigger, clamped to the viewport; dismissal
// (outside pointer-down / focus-out) comes from useAnchoredPanel, so callers
// don't need a backdrop.
export function DotMenu({ open, onClose, anchorRef, width = 224, align = "right", bg, children }) {
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, onClose);
  useEscClose(open, onClose);
  if (!open || !pos) return null;
  const left = Math.max(8, Math.min(align === "left" ? pos.left : pos.left + pos.width - width, window.innerWidth - width - 8));
  return createPortal(
    <div ref={panelRef} data-up={pos.bottom != null ? "true" : undefined}
      style={{ ...vPos(pos), maxHeight: pos.maxH, width, left, "--pop-bg": bg }}
      className="ft-pop fixed z-50 py-1 text-sm overflow-y-auto">
      {children}
    </div>, document.body);
}

// Builder picker: type to search the canonical list or add a new one. Picking an
// existing builder links by id; typing a name close to an existing one warns
// before creating a duplicate ("P & L" vs "P&L") — ADR 0005.
export function BuilderCombo({ value, builders, onSelect, onAddBuilder, inp }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
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
    <div ref={wrapRef} className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); setQ(cur ? cur.name : ""); }, 150)}
        placeholder="No builder — type to search or add" className={inp + " ft-search"} />
      {open && pos && (
        <SearchPop pos={pos} fieldRef={wrapRef} panelRef={panelRef} className="overflow-y-auto" style={{ maxHeight: Math.min(256, pos.maxH) }}>
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
        </SearchPop>
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
  // The box grows out of the whole salesperson card (the name button's
  // parent — label, name, phone), not the one-line name.
  const cardRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, cardRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  const sp = { name: "", phone: "", email: "", ...(value || fallback || {}) };
  const fld = "ft-field w-full h-[28px] rounded-md border border-slate-200 px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const box = pos && growBox(pos, 220, alignRight ? "left" : "right");
  return (
    <>
      <button ref={anchorRef} onClick={(e) => { cardRef.current = e.currentTarget.parentElement; setOpen((o) => !o); }} aria-expanded={open} title="Salesperson — locked in when the project was created. Click to change." className={"min-w-0 max-w-full truncate hover:text-indigo-700 text-left" + (small ? " font-bold" : " ft-serif")} style={{ fontSize: small ? 11.5 : 17, lineHeight: 1.2, borderBottom: "1px dashed var(--ft-border-strong)", alignSelf: small ? "flex-start" : undefined }}>
        {sp.name || sp.email || "Set salesperson"}
      </button>
      {open && pos && (
        <SearchPop pos={pos} box={box} fieldRef={cardRef} panelRef={panelRef} className="p-2 space-y-1.5">
          <div className="space-y-1.5" onKeyDown={(e) => { if (e.key === "Enter") setOpen(false); }}>
            <input autoFocus value={sp.name} onChange={(e) => onChange({ ...sp, name: e.target.value })} placeholder="Name" className={fld} />
            <input type="tel" inputMode="tel" value={sp.phone} onChange={(e) => onChange({ ...sp, phone: phoneChange(sp.phone, e.target.value) })} placeholder="Phone" className={fld} />
            <input value={sp.email} onChange={(e) => onChange({ ...sp, email: e.target.value })} placeholder="Email" className={fld} />
            <button onClick={() => onChange({ name: fallback?.name || "", phone: fallback?.phone || "", email: fallback?.email || "" })} className="flex items-center gap-1 pt-0.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"><User size={13} /> Use my details</button>
          </div>
        </SearchPop>
      )}
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
      <button ref={anchorRef} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-tip={mini ? tip : undefined} title={mini ? undefined : `Files (not printed)${n ? ` — ${n}` : ""}`}
        className={mini ? "ft-tip relative w-[45px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-50" : "h-[30px] flex-1 flex items-center justify-center gap-1 rounded-md border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"}
        style={mini ? { border: "1px solid var(--ft-border-strong)" } : undefined}>
        <Paperclip size={mini ? 13 : 14} />
        {n > 0 && (mini
          ? <span className="absolute rounded-full font-bold" style={{ top: -6, right: -6, fontSize: 10, padding: "1px 5px", background: "var(--ft-sand)", color: "var(--ft-muted)", border: "1px solid var(--ft-border)" }}>{n}</span>
          : <span className="font-semibold">{n}</span>)}
      </button>
      {open && pos && (() => {
        const box = growBox(pos, W);
        const label = <span className={"ft-eyebrow text-[9px] " + (box.right ? "pl-2" : "pr-2 ml-auto")}>Files <span className="normal-case tracking-normal font-normal text-slate-400">— not printed</span></span>;
        return (
          <SearchPop pos={pos} box={box} fieldRef={anchorRef} panelRef={panelRef} className="p-2" {...(box.right ? { trail: label } : { lead: label })}>
            <div className="flex flex-wrap gap-1">
              {(attachments || []).map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-md bg-slate-100 pl-1.5 pr-1 py-0.5 text-[11px]">
                  <button onClick={() => onOpen(m)} className="hover:text-indigo-600 max-w-[9rem] truncate" title={`${m.name} · ${Math.max(1, Math.round(m.size / 1024))} KB`}>{m.name}</button>
                  <button onClick={() => onDelete(m)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                </span>
              ))}
              <button onClick={onAdd} className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"><Paperclip size={11} /> Add</button>
            </div>
          </SearchPop>
        );
      })()}
    </>
  );
}

// Dark mode is parked (owner, 2026-09-23) until its palette is reworked: every
// device renders light, and the rail switch and Settings picker are hidden. The
// saved "ft-theme" choice and both controls stay, so flipping this (and the
// pre-paint script in index.html) brings it all back.
export const DARK_MODE = false;

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

// The vendor configurators' header controls (owner 2026-09-24,
// app-header-options.html): flat on the header's own background, no outline,
// a hover tint only — one row of Stock only · Clear design | price · basket.
export const FLAT_BTN = "h-[30px] inline-flex items-center gap-1.5 rounded-md px-2 text-[12px] font-bold text-slate-600 hover:bg-[color:var(--ft-hover)] shrink-0 whitespace-nowrap";

// The shared Stock only switch (phase 4, a checkbox since 2026-09-24):
// unchecked is Full catalog. Both vendor configurators mount it, so the two
// popups can't drift on the control; it carries no engine knowledge — the
// caller owns what the source constrains.
export function SourceSwitch({ source, onChange, title }) {
  const on = source === "stock";
  return (
    <button className={FLAT_BTN} onClick={() => onChange(on ? "all" : "stock")} aria-pressed={on} data-source-toggle
      title={title || "Stock only removes non-stocked parts from the candidate pool; unchecked, the full catalog ranks freely and tags special order"}>
      <span className={"w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center " + (on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white" : "border-slate-400")}>
        {on && <Check size={10} strokeWidth={3} />}
      </span>
      Stock only
    </button>
  );
}

export function BasketButton({ count = 0, onClick, ...rest }) {
  return (
    <button className={FLAT_BTN + " relative w-[34px] !px-1.5 justify-center"} onClick={onClick} title="Basket" aria-label={`Basket, ${count} staged`} {...rest}>
      <ShoppingBasket size={20} strokeWidth={2} />
      {count > 0 && <span className="absolute -top-1.5 -right-1.5 rounded-full ring-2 ring-[color:var(--ft-cream)] bg-[color:var(--ft-brand)] text-white text-[10px] font-extrabold min-w-[16px] h-[16px] px-1 flex items-center justify-center">{count}</span>}
    </button>
  );
}

const touchRows = () => window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;

// The one pick-one dropdown (ADR 0048), the price-level menu's look: the open
// box is the trigger grown — portalled onto <body> at the trigger's spot so a
// scroll container can't clip it, wearing the trigger's zoom inside the
// shrink-to-fit workspaces. Focus stays on the trigger (rows preventDefault on
// mousedown) so it keeps a <select>'s keyboard contract.
export function MorphSelect({ value, onChange, options, groups, placeholder = "Pick…", display, bg = "var(--ft-card)", size = "md", flat = false, tinted = false, bold = false, full = false, align = "left", minOpenW = 0, liveType = false, title, className = "", triggerClass, triggerStyle, renderRow, tabIndex, chevron = true }) {
  const { items, heads } = flatten({ options, groups });
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const timer = useRef(0);
  const lid = useId();
  const sel = items.findIndex((it) => it.v === value);
  const cur = items[sel];
  const text = display ?? (cur ? cur.label : placeholder);
  const ink = tinted && cur?.dot ? cur.dot : undefined;
  const closedBorder = flat ? "transparent" : "var(--ft-border-strong)";
  const sz = size === "sm" ? "px-1.5 text-xs" : "px-2.5 text-[12.5px]";
  const rowSz = touchRows() ? "py-2.5 text-[14px]" : size === "sm" ? "py-1 text-xs" : "py-1.5 text-[12.5px]";

  const openMenu = () => {
    clearTimeout(timer.current);
    setActive(sel >= 0 ? sel : edgeIndex(items, "first"));
    if (open) setShown(true); else setOpen(true);
  };
  const closeMenu = () => {
    setShown(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 240);
  };
  const pick = (i) => { onChange(items[i].v); closeMenu(); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEscClose(open && shown, closeMenu);
  useDismissOutside(open, anchorRef, panelRef, closeMenu);

  useLayoutEffect(() => {
    if (!open) { setBox(null); setShown(false); return; }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const want = Math.min(PANEL_MAX, 12 + items.length * (touchRows() ? 40 : 30) + heads.length * 24);
      const pos = placeMorph({ rect: r, vw: window.innerWidth, vh: window.innerHeight, scale, align, want });
      setBox((b) => ({ ...pos, scale, w: el.offsetWidth, h: el.offsetHeight, target: b?.target ?? el.offsetWidth }));
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !box) return;
    const natural = listRef.current?.offsetWidth || 0;
    const target = Math.min(box.maxW, Math.max(box.w, natural, minOpenW));
    setBox((b) => ({ ...b, target }));
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open, !!box]);

  useEffect(() => {
    if (shown && active >= 0) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [shown, active]);

  const onKey = (e) => {
    const k = e.key;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    const letter = k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!(open && shown)) {
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") { stop(); openMenu(); }
      else if (letter) { const i = typeahead(items, sel, k); if (i >= 0) { stop(); onChange(items[i].v); } }
      return;
    }
    if (k === "Escape") { stop(); closeMenu(); }
    else if (k === "Tab") closeMenu();
    else if (k === "Enter" || k === " ") { stop(); if (active >= 0 && !items[active]?.disabled) pick(active); }
    else if (k === "ArrowDown" || k === "ArrowUp") { stop(); setActive(moveIndex(items, active, k === "ArrowDown" ? 1 : -1)); }
    else if (k === "Home" || k === "End") { stop(); setActive(edgeIndex(items, k === "Home" ? "first" : "last")); }
    // liveType: a letter press with the list open also picks the row, so the
    // field follows the cycling (grout colors) instead of only the highlight.
    else if (letter) { stop(); const i = typeahead(items, active, k); if (i >= 0) { setActive(i); if (liveType && !items[i].disabled) onChange(items[i].v); } }
  };

  const headAt = new Map(heads.filter((h) => h.label).map((h) => [h.at, h.label]));
  const chevronIcon = (turned) => <ChevronDown size={size === "sm" ? 12 : 14} className="ml-auto shrink-0 text-slate-400" style={{ transform: turned ? "rotate(180deg)" : "none", transition: "transform 220ms ease" }} />;
  const rows = items.map((it, i) => {
    const on = i === sel;
    const custom = renderRow?.(it, { selected: on, close: closeMenu });
    return (
      <div key={i}>
        {headAt.has(i) && <div className="ft-eyebrow text-[9px] px-3 pt-2 pb-0.5">{headAt.get(i)}</div>}
        <div data-i={i} id={`${lid}-${i}`} role="option" aria-selected={on} aria-disabled={it.disabled || undefined} title={it.title}
          onMouseEnter={() => { if (!it.disabled) setActive(i); }}
          onMouseDown={(e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); }}
          onClick={() => { if (!it.disabled) pick(i); }}
          className={"w-full flex items-center gap-2 px-3 whitespace-nowrap " + rowSz
            + (it.disabled ? " text-slate-300 cursor-default" : " cursor-pointer")
            + (i === active && !it.disabled ? " bg-[color:var(--ft-hover)]" : "")
            + (on ? " font-extrabold" : " font-semibold" + (it.disabled ? "" : " text-slate-600"))}>
          {it.dot && <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: it.dot }} />}
          {custom ?? <span className="flex-1" style={on && tinted && it.dot ? { color: it.dot } : undefined}>{it.label}</span>}
          {it.note && <span className="text-[10.5px] font-semibold text-slate-400">{it.note}</span>}
          <span className="w-3.5 shrink-0">{on && <Check size={13} />}</span>
        </div>
      </div>
    );
  });

  const header = box && (
    <div onMouseDown={(e) => e.preventDefault()} onClick={closeMenu}
      className={"flex items-center gap-1.5 whitespace-nowrap cursor-pointer " + sz + (bold ? " font-extrabold" : " font-semibold")}
      style={{ height: Math.max(box.h - 3, size === "sm" ? 20 : 24), color: ink || "var(--ft-text)" }}>
      <span className="truncate">{text}</span>{chevronIcon(shown)}
    </div>
  );
  const divider = <div className="border-t border-slate-300 mx-2" />;
  const list = (
    <div style={{ display: "grid", gridTemplateRows: shown ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${MORPH_EASE}` }}>
      <div className="min-h-0 overflow-hidden">
        <div ref={listRef} id={lid} role="listbox" className="py-1 overflow-y-auto" style={{ maxHeight: box?.maxList, minWidth: "100%", width: "max-content" }}>{rows}</div>
      </div>
    </div>
  );
  const panel = box && (
    <div ref={panelRef} className="fixed rounded-lg overflow-hidden"
      style={{ zIndex: 90, top: box.top, bottom: box.bottom, left: box.left, right: box.right, zoom: box.scale !== 1 ? box.scale : undefined,
        width: shown ? box.target : box.w, background: bg,
        border: "1.5px solid " + (shown ? "var(--ft-text)" : closedBorder),
        boxShadow: shown ? "0 12px 28px -12px rgba(28,26,23,.45)" : "none",
        transition: `width 220ms ${MORPH_EASE}, border-color 220ms ease, box-shadow 220ms ease` }}>
      {box.up ? <>{list}{divider}{header}</> : <>{header}{divider}{list}</>}
    </div>
  );

  return (
    <span ref={anchorRef} className={(full ? "flex w-full" : "inline-flex max-w-full") + " relative align-middle " + className}
      style={triggerClass ? undefined : { background: bg, border: "1.5px solid " + closedBorder, borderRadius: 8 }}>
      <button type="button" tabIndex={tabIndex} onClick={() => (open && shown ? closeMenu() : openMenu())} onKeyDown={onKey} title={title}
        aria-haspopup="listbox" aria-expanded={open && shown} aria-controls={open ? lid : undefined}
        aria-activedescendant={open && shown && active >= 0 ? `${lid}-${active}` : undefined}
        className={triggerClass ?? ("min-w-0 w-full flex items-center gap-1.5 rounded-[6.5px] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-[color:var(--ft-hover)] " + sz + (size === "sm" ? " h-[22px]" : " h-[27px]") + (bold ? " font-extrabold" : " font-semibold"))}
        style={triggerStyle ?? { color: ink || (cur || display ? "var(--ft-text)" : "var(--ft-muted)") }}>
        <span className="truncate">{text}</span>{chevron && chevronIcon(false)}
      </button>
      {open && box && createPortal(panel, document.body)}
    </span>
  );
}

const PRICE_LEVELS = ["retail", "builder", "employee", "sale", "custom"];
const levelInk = (t) => TIER_COLOR[t]?.main || "var(--ft-text)";

// The configurators' price level (owner 2026-09-24): closed it names the level
// — Custom shows only its discount — and a click slides the list open while a
// dark border grows around trigger and list as one piece (MorphSelect). `bg`
// is the header's own fill, which the open box takes on.
export function PriceLevelMenu({ value = "retail", customPct, onPick, onPct, bg = "var(--ft-cream)" }) {
  const options = PRICE_LEVELS.map((t) => ({ v: t, label: t[0].toUpperCase() + t.slice(1), dot: levelInk(t) }));
  return (
    <MorphSelect value={value} onChange={onPick} options={options} bg={bg} flat tinted bold align="right" minOpenW={170} title="Price level"
      display={value === "custom" ? `−${customPct || 0}%` : undefined}
      renderRow={(it, { close }) => it.v !== "custom" ? undefined : (
        <span className="flex-1">
          <span className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 text-[12px] font-bold" style={{ color: levelInk("custom") }} onClick={(e) => e.stopPropagation()}>
            −<input value={customPct ?? ""} inputMode="decimal" title="Custom % off retail"
              onFocus={() => onPick("custom")} onChange={(e) => onPct(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); close(); } }}
              className="w-6 text-right bg-transparent focus:outline-none" />%
          </span>
        </span>
      )} />
  );
}

// The kit-card confirm both popups raise over customized work (owner ask
// 2026-09-02): one component so wedi and Schluter can't drift. Three ways
// forward beside Cancel — Overwrite (the old hard reset), Keep what I added
// (the room's work rides onto the kit; the old kit's stepped quantities and
// part swaps don't), New shower (park this build in the basket, start the kit
// as a second shower). `onNew` is omitted where there is no basket.
export function KitOverwriteConfirm({ vendor, kitName, kitWord = "stock kit", onCancel, onOverwrite, onKeep, onNew }) {
  const opt = (label, sub, fn, attr, primary) => (
    <button onClick={fn} {...{ [attr]: true }}
      className={"w-full text-left rounded-lg border px-3 py-2 " + (primary ? "border-[color:var(--ft-brand)] bg-white hover:bg-slate-50" : "border-slate-300 bg-white hover:bg-slate-50")}>
      <div className="text-[12.5px] font-extrabold">{label}</div>
      <div className="text-[11px] font-semibold leading-snug text-slate-500">{sub}</div>
    </button>
  );
  return (
    <div className="print:hidden fixed inset-0 z-[80] flex items-center justify-center p-8" style={{ background: "rgba(20,15,10,.5)" }}
      onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className={vendor === "wedi" ? "wedi-pop w-full max-w-[500px] rounded-xl overflow-hidden shadow-2xl" : "sch-pop w-full max-w-[500px] rounded-xl overflow-hidden shadow-2xl"}
        style={{ background: "var(--ft-cream)" }} onClick={(e) => e.stopPropagation()} data-kit-confirm={vendor}>
        <div className="px-5 pt-4 pb-1 text-[14px] font-extrabold">Start the {kitName} kit?</div>
        <div className="px-5 pb-3 text-[12px] leading-relaxed" style={{ color: "var(--ft-muted)" }}>
          This build has been customized — walls, cuts, or parts differ from a {kitWord}.
        </div>
        <div className="flex flex-col gap-2 px-5 pb-4">
          {opt("Overwrite", "Reset everything to the kit's stock setup.", onOverwrite, "data-kit-overwrite", true)}
          {opt("Keep what I added", "Carry the walls, benches, add-ons and hand-added lines onto this kit. Stepped quantities and part swaps reset.", onKeep, "data-kit-keep")}
          {onNew && opt("New shower", "Park this build in the basket and start the kit as a second shower.", onNew, "data-kit-new")}
        </div>
        <div className="flex gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--ft-border-strong)", background: "var(--ft-sand)" }}>
          <button className="wbtn" style={{ flex: "none", marginLeft: "auto", padding: "7px 14px" }} onClick={onCancel} data-kit-cancel>Cancel</button>
        </div>
      </div>
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

// Why a lookup failed, in words the salesperson can act on. An unmapped code
// must still say something — silence reads as "no results", which is the one
// thing this must never be mistaken for.
const LOOKUP_ERR = {
  "not-configured": "Address lookup needs a Google key — see Settings",
  "over-quota": "Address lookup unavailable — daily limit reached",
  "no-route": "Couldn't find a route to that address",
  unauthorized: "Sign in again to use address lookup",
  offline: "Couldn't reach the lookup service",
};
export const lookupErrText = (code) => LOOKUP_ERR[code] || (code ? "Address lookup is unavailable right now" : "");

export function AddressField({ value, onChange, inp, placeholder, autoFocus, ping, suggest = false, distance = null, shopAddress = "", onDistance }) {
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const pos = useAnchoredPanel(open && suggest, ref, panelRef, () => setOpen(false));
  const { suggestions, err, ask, clear, takeToken } = useAddressSuggest();
  const [busy, setBusy] = useState(false);
  const [distErr, setDistErr] = useState("");
  const stale = distStale(distance, value, shopAddress);
  // Remembers the last origin|destination pair a measurement was attempted for
  // (success or failure) so a lookup that failed (e.g. no-route) doesn't re-bill
  // a fresh Routes call on every blur — distinct from the `stale`/`distance`
  // guard in commit(), which only covers the already-succeeded case.
  const lastAttempt = useRef("");

  const paste = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { ref.current?.focus(); ping?.(`Press ${PASTE_KEY} to paste`); return; }
    const clean = cleanAddress(text);
    if (clean) { onChange(clean); clear(); setOpen(false); } else ping?.("Nothing on the clipboard — copy the address from Maps first");
  };

  const measureAddr = async (addr) => {
    const to = String(addr || "").trim();
    if (!shopAddress || !to || busy) return;
    const attemptKey = `${shopAddress}|${to}`;
    if (lastAttempt.current === attemptKey) return;
    lastAttempt.current = attemptKey;
    setBusy(true); setDistErr("");
    try {
      const out = await fetchDistance(shopAddress, to);
      if (out?.error) { setDistErr(out.error); return; }
      onDistance?.({ ...out, from: shopAddress, to, at: Date.now() });
    } catch {
      setDistErr("upstream");
    } finally {
      setBusy(false);
    }
  };
  const measure = () => measureAddr(value);
  const recheck = () => { lastAttempt.current = ""; measureAddr(value); };

  const type = (v) => {
    onChange(v);
    setDistErr("");
    if (!suggest) return;
    if (v.trim().length < MIN_SUGGEST) clear(); else ask(v);
    setOpen(true);
  };
  const commit = () => { if (suggest) setTimeout(() => setOpen(false), 150); if (!distance || stale) measure(); };
  // A prediction carries no postal code — Autocomplete omits them — so the pick
  // fills the field with the prediction IMMEDIATELY, then upgrades it to the
  // complete address once Place Details answers. The field is never blocked on
  // the network, and a details failure simply leaves the prediction standing.
  // takeToken() must run before clear(), which retires the session.
  const pick = async (s) => {
    const sessionToken = takeToken();
    onChange(s.text);
    clear();
    setOpen(false);
    const full = await fetchPlaceDetails(s.placeId, sessionToken);
    if (full && full !== s.text) onChange(full);
    // Measure the address as it will READ, so the stored distance's `to`
    // matches the field and the drift chip doesn't fire on our own upgrade.
    if (shopAddress) measureAddr(full || s.text);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input ref={ref} value={value || ""} autoFocus={autoFocus} placeholder={placeholder} className={inp + (suggest ? " ft-search" : "")}
          onChange={(e) => type(e.target.value)}
          onFocus={() => suggest && setOpen(true)}
          onBlur={commit} />
        <button type="button" title="Look up on Google Maps" className={ADDR_BTN}
          onClick={() => window.open(mapsUrl(value), "_blank", "noopener,noreferrer")}><MapPin size={15} /></button>
        <button type="button" title="Paste the address you copied" className={ADDR_BTN} onClick={paste}><ClipboardPaste size={15} /></button>
      </div>
      {suggest && open && pos && (suggestions.length > 0 || (err && err !== "not-configured")) && (
        <SearchPop pos={pos} fieldRef={ref} panelRef={panelRef} className="overflow-y-auto" style={{ maxHeight: Math.min(256, pos.maxH) }}>
          {err && err !== "not-configured"
            ? <div className="px-3 py-2 text-[12.5px] text-amber-800 bg-amber-50">{lookupErrText(err)}</div>
            : suggestions.map((s) => (
              <div key={s.placeId || s.text} onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">{s.text}</div>
            ))}
        </SearchPop>
      )}
      {shopAddress && (distance || distErr || busy) && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs mt-1">
          {busy && <span className="text-slate-400">Measuring…</span>}
          {!busy && distErr && <span className="text-amber-700">{lookupErrText(distErr)}</span>}
          {!busy && !distErr && distance && (stale ? (
            <>
              <span className="text-amber-600">Address changed since this was measured — {formatDist(distance)} from the shop</span>
              <button tabIndex={-1} onClick={recheck} title="Measure the distance to the address as it reads now"
                className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Recheck</button>
            </>
          ) : (
            <span className="text-slate-400">{formatDist(distance)} from the shop</span>
          ))}
        </div>
      )}
    </div>
  );
}
