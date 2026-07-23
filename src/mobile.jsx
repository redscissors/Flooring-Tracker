import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, X, Check, ChevronRight, ChevronDown, Trash2, StickyNote, Settings } from "lucide-react";
import { num, wasteFor, groutExact, mortarExact, getGrout, getMortar, cartonExact, getCarton, getPieceCarton, underlayExact, getUnderlay, getUnderlayInstall, materialWarnings, offeredGrouts, offeredMortars, offeredUnderlayments, resolveMaterialDefault, offeredAttached, offeredCategories, getAttached } from "./catalog.js";
import { groutSnapshotPatch } from "./stock.js";
import { tierUnitPrice, employeeNoCost } from "./pricing.js";
import { queryHit as sheogaQueryHit, parseQuery as sheogaParseQuery, querySummary as sheogaQuerySummary } from "./sheoga.js";
import { STOCK_LOADING_MSG, skuSearchable, TYPES, TLBL, underlayLabel, TYPE_ACCENT, JOINTS, colorsFor, TIER_COLOR } from "./uiconst.js";
import { money, sf1, miscQty, rowBlank } from "./model.js";
import { lineTotal, printProduct, KSHORT } from "./print.js";
import { FitSelect, useEscClose } from "./widgets.jsx";
import { Hit, hitKey, matchSummary, useMergedResults } from "./search.jsx";
import { GridSizeInput } from "./grid.jsx";

// Mobile bottom sheet (mobile shell 2026-07-16): the phone's pop-open editing
// surface — scrim + slide-up panel with an optional pinned footer. Portaled so
// nothing in the edit view can clip it; desktop never renders one. Exported
// (like SegBar/FilesPop) for the .scratch preview harnesses only.
export function MobileSheet({ open, onClose, title, badge, children, footer }) {
  // Keyboard plan (mobile v2 spec): iOS Safari doesn't resize the layout
  // viewport for the keyboard, so the sheet snaps to full height the moment a
  // field inside it takes focus — the focused input and the pinned footer both
  // stay reachable above the keyboard. It stays tall until closed (shrinking
  // on blur would bounce the layout between every field).
  const [tall, setTall] = useState(false);
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const drag = useRef(null);
  useEscClose(open, onClose);
  useEffect(() => { if (!open) setTall(false); }, [open]);
  // Swipe-down to dismiss. Native listeners because React registers touchmove
  // as passive, which blocks the preventDefault that keeps the pull from also
  // scrolling. A pull starting inside the scroll body only grabs the sheet
  // when the body is already at its top — otherwise the body scrolls normally.
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    const start = (e) => {
      const t = e.touches[0];
      const inBody = bodyRef.current?.contains(e.target);
      drag.current = { y0: t.clientY, x0: t.clientX, t0: e.timeStamp, armed: !inBody || (bodyRef.current?.scrollTop ?? 0) <= 0, on: false, dy: 0 };
    };
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const t = e.touches[0];
      const dy = t.clientY - d.y0;
      if (!d.on) {
        if (!d.armed || dy < 10 || Math.abs(t.clientX - d.x0) > dy) return;
        d.on = true;
      }
      e.preventDefault();
      d.dy = Math.max(0, dy);
      el.style.transition = "none";
      el.style.transform = `translateY(${d.dy}px)`;
    };
    const end = (e) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.on) return;
      el.style.transition = "transform .2s ease-out";
      if (d.dy > 90 || d.dy / Math.max(1, e.timeStamp - d.t0) > 0.6) {
        el.style.transform = "translateY(105%)";
        setTimeout(onClose, 180);
      } else {
        el.style.transform = "translateY(0)";
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="ft-sheet-scrim absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} className="ft-sheet absolute left-0 right-0 bottom-0 flex flex-col"
        onFocusCapture={(e) => { if (e.target.matches?.("input, textarea, select")) setTall(true); }}
        style={{ background: "var(--ft-cream)", height: tall ? "100%" : undefined, maxHeight: tall ? "100%" : "88%", borderRadius: tall ? 0 : "12px 12px 0 0", boxShadow: "0 -8px 40px rgba(28,26,23,.25)" }}>
        <div className="mx-auto mt-2 h-1 w-9 rounded-full shrink-0" style={{ background: "var(--ft-border-strong)" }} />
        <div className="flex items-center gap-2 px-4 pt-1.5 pb-2 shrink-0">
          <div className="ft-serif text-[16px] flex-1 min-w-0 truncate">{title}</div>
          {badge}
          <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400"><X size={14} /></button>
        </div>
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">{children}</div>
        {footer && <div className="flex items-center gap-2 px-4 pt-2.5 border-t border-slate-200 shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// Full-screen price-book search (mobile rows 2026-07-17): on the phone the
// SKU / product search gets its own surface — never a half sheet — so the
// keyboard and the results list can share the screen. Same merged stock+order
// search as the grid pickers; tapping a row picks it, the leading checkbox
// builds a multi-selection (the shift-click stand-in), and a no-match query
// can be handed to manual entry.
export function MobileSearchSheet({ stock, stockReady, searchOrder, bookName, initial = "", onPick, onPickMany, onManual, onVendor, onClose, strictness }) {
  const [q, setQ] = useState(initial);
  const [picked, setPicked] = useState([]);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, []);
  const { results, total } = useMergedResults(true, stock, q, searchOrder, strictness);
  const toggle = (it) => setPicked((prev) => prev.some((x) => hitKey(x) === hitKey(it)) ? prev.filter((x) => hitKey(x) !== hitKey(it)) : [...prev, it]);
  const commit = () => { if (picked.length === 1) onPick(picked[0]); else if (picked.length) onPickMany(picked); };
  // Sheoga has no SKUs, so it never book-matches — pin the same vendor row the
  // desktop search shows when the query spells the vendor or hits a trade word.
  const vendor = !!onVendor && sheogaQueryHit(q);
  const noHits = q.trim() && results.length === 0;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col print:hidden" style={{ background: "var(--ft-cream)" }}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 shrink-0">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or product…"
          className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold focus:outline-none placeholder:text-slate-300" />
        {q && <button onClick={() => { setQ(""); inputRef.current?.focus(); }} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-400"><X size={14} /></button>}
        <button onClick={onClose} className="shrink-0 text-[12.5px] font-bold text-slate-500 px-1">Cancel</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {results.map((it) => {
          const sel = picked.some((x) => hitKey(x) === hitKey(it));
          return (
            <div key={hitKey(it)} onClick={() => (picked.length ? toggle(it) : onPick(it))}
              className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-slate-100 ${sel ? "bg-indigo-50/60" : "bg-white"}`}>
              <button onClick={(e) => { e.stopPropagation(); toggle(it); }} title={sel ? "Remove from selection" : "Add to selection"}
                className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 ${sel ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{sel && <Check size={12} />}</button>
              <div className="flex-1 min-w-0"><Hit it={it} bookName={bookName} /></div>
            </div>
          );
        })}
        {vendor && (
          <button onClick={() => onVendor(q)} data-sheoga-entry className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 text-left" style={{ background: "var(--ft-tint)" }}>
            <span className="w-6 h-6 rounded flex items-center justify-center text-white shrink-0" style={{ background: "var(--ft-brand)" }}><Settings size={13} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-extrabold">Sheoga Hardwood — configure by description</span>
              <span className="block text-[11.5px] font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{sheogaQuerySummary(sheogaParseQuery(q))}</span>
            </span>
            <span className="shrink-0 font-extrabold" style={{ color: "var(--ft-brand-deep)" }}>→</span>
          </button>
        )}
        {noHits && !vendor && (stockReady ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            No price-book match.
            <button onClick={() => onManual(q.trim())} className="mt-3 mx-auto block rounded-md bg-indigo-600 text-white px-4 h-[38px] text-[12.5px] font-bold">Enter "{q.trim()}" by hand</button>
          </div>
        ) : (
          // A no-match claim would be a lie while stage 2 is in flight — it
          // steers a real book SKU into hand entry with no snapshot.
          <div className="px-4 py-6 text-center text-sm text-slate-400">Price book still loading…</div>
        ))}
        {!q.trim() && <div className="px-4 py-6 text-center text-sm text-slate-300">Type a SKU or product words — picks fill the row.</div>}
      </div>
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2 border-t border-slate-200 text-[11px] text-slate-400" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        <span className="truncate">{q.trim() ? matchSummary(results.length, total) : ""}</span>
        {picked.length > 0 ? (
          <button onClick={commit} className="ml-auto shrink-0 rounded-md bg-indigo-600 text-white px-3 h-[34px] text-xs font-bold">Add {picked.length} product{picked.length === 1 ? "" : "s"}</button>
        ) : q.trim() ? (
          <button onClick={() => onManual(q.trim())} className="ml-auto shrink-0 rounded-md border border-slate-300 px-3 h-[34px] text-xs font-semibold text-slate-500">Enter by hand</button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

// Compact two-line product row (mobile rows 2026-07-17): the phone list shows
// read-only summaries — type chip, product · line total, then SKU · size ·
// qty · price with the checked materials as letter tags — and every edit
// happens in the row's bottom sheet. Line 2 reuses printProduct so the text
// matches the printed estimate's wording for the same row.
export function MobileProductRow({ p, settings, tv, onOpen, onPointerDown }) {
  const c = printProduct(p, settings);
  const tierPrice = tv.tier !== "retail" ? tierUnitPrice(p, tv.tier, tv.pct) : null;
  const tLine = tierPrice == null ? c.line : lineTotal(p, c.C, c.PC, tierPrice);
  const warns = materialWarnings(p, settings);
  const tags = c.mats.filter((m) => m.inline && m.kind !== "Caulk").map((m) => (KSHORT[m.kind] || m.kind)[0]);
  const blank = rowBlank(p);
  const sub = blank ? ["tap to fill in"] : [
    p.sku, c.size,
    c.qtyText && c.C ? `${c.qtyText} × ${sf1(c.C.sf)} SF` : p.type === "misc" && !c.PC && c.qtyText ? `${c.qtyText} EA` : c.qtyText,
    c.priceText ? `@ ${c.priceText.replace(/\/(sf|ea)$/, "")}` : "",
  ].filter(Boolean);
  return (
    <div onClick={onOpen} onPointerDown={onPointerDown} title="Tap to edit — hold to move"
      className="flex items-start gap-2 w-full text-left cursor-pointer select-none" style={{ padding: "9px 12px", background: "var(--ft-area-row)" }}>
      <span className="shrink-0 rounded flex items-center justify-center font-extrabold" style={{ width: 19, height: 19, fontSize: 10, marginTop: 1, background: blank ? "var(--ft-field, #fff)" : TYPE_ACCENT[p.type], color: blank ? "var(--ft-muted)" : "var(--ft-type-ink)", border: blank ? "1px dashed var(--ft-border)" : "none" }}>
        {blank ? <Plus size={11} /> : p.type === "misc" ? "✕" : TLBL[p.type][0]}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className={`text-[13px] font-bold truncate flex-1 min-w-0 ${blank ? "text-slate-400 font-semibold" : ""}`}>{blank ? "New product…" : p.brandColor || TLBL[p.type]}</span>
          <span className="ft-mono text-[12px] font-bold shrink-0" style={tierPrice != null && tLine > 0 ? { color: TIER_COLOR[tv.tier]?.main } : tLine > 0 ? undefined : { color: "var(--ft-faint)" }}>{money(tLine)}</span>
        </span>
        <span className="flex items-center gap-1.5 mt-px text-[10.5px] whitespace-nowrap overflow-hidden" style={{ color: "var(--ft-faint)" }}>
          <span className="truncate">{sub.join(" · ")}</span>
          {p.note && <StickyNote size={10} className="shrink-0" />}
          {(tags.length > 0 || warns.length > 0) && (
            <span className="ml-auto flex gap-0.5 shrink-0">
              {tags.map((t, i) => <i key={i} className="not-italic rounded px-1 font-extrabold" style={{ fontSize: 8.5, padding: "1px 4px", color: "var(--ft-brand-deep)", background: "var(--ft-brand-soft)" }}>{t}</i>)}
              {warns.length > 0 && <i className="not-italic rounded font-extrabold ft-warn-orange" style={{ fontSize: 8.5, padding: "1px 4px" }} title="A checked material isn't calculating — open the row">!</i>}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

// The phone's row editor (mobile rows 2026-07-17): everything the desktop grid
// row + materials drawer edit, restyled as labeled fields in a MobileSheet with
// the line total pinned in the footer. All the per-row math is recomputed here
// from (p, settings, stock) with the same catalog helpers the grid uses, and
// every write funnels through onPatch — the caller's updProduct — so the two
// editors can't drift on write paths. The SKU field opens MobileSearchSheet
// (full-screen, per the keyboard plan); picks flow through onPickStock, the
// caller's addStockProducts, exactly like a grid SKU pick.
export function MobileRowSheet({ p, areaName, canDelete, settings, stock, groutStock, stockReady, bookStockReady, isBookFam, gFamilies, searchOrder, bookName, tv, onPatch, onPickStock, onOpenSheoga, onDelete, onClose, qtyRef, notify, strictness }) {
  const [searching, setSearching] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [insExpanded, setInsExpanded] = useState(false);
  if (!p) return null;
  const blank = rowBlank(p);
  const accent = TYPE_ACCENT[p.type];
  const canSearch = skuSearchable(stock, searchOrder, stockReady);

  // Same per-row derivations as the desktop grid (App's products map).
  const G = getGrout(p, settings), M = getMortar(p, settings);
  const gEx = groutExact(p, settings), mEx = mortarExact(p, settings);
  const C = getCarton(p, settings), cEx = cartonExact(p, settings), PC = getPieceCarton(p);
  const line = lineTotal(p, C, PC, num(p.priceSqft));
  const tierPrice = tv.tier !== "retail" ? tierUnitPrice(p, tv.tier, tv.pct) : null;
  const tierNoCost = tv.tier === "employee" && employeeNoCost(p);
  const tLine = tierPrice == null ? line : lineTotal(p, C, PC, tierPrice);
  const groutNames = offeredGrouts(settings.catalog), mortarNames = offeredMortars(settings.catalog);
  const groutOpts = groutNames.includes(p.grout.product) ? groutNames : [p.grout.product, ...groutNames];
  const gBook = settings.grouts[p.grout.product]?.book || "";
  const gFam = gBook ? gFamilies.find((f) => f.product.toLowerCase() === gBook.toLowerCase()) : null;
  const colorBase = gFam ? gFam.colors.map((c) => c.color) : colorsFor(p.grout.product);
  const colorOpts = (!p.grout.color || colorBase.includes(p.grout.color)) ? colorBase : [p.grout.color, ...colorBase];
  // Book-linked picks snapshot from the stock-book cache at click time
  // (ADR 0007 mechanics, groutSnapshotPatch) — while that cache is still
  // loading the pick would blank an existing snapshot, so refuse loudly
  // instead (ADR 0026).
  const stockBusy = (book) => {
    if (!book || !isBookFam(book)) return false;
    if (!bookStockReady) { notify?.(STOCK_LOADING_MSG); return true; }
    return false;
  };
  const pickGroutColor = (color) => { if (stockBusy(gBook)) return; onPatch({ grout: { ...p.grout, color, ...groutSnapshotPatch(groutStock, gBook, color) } }); };
  const pickGroutProduct = (product) => { const book = settings.grouts[product]?.book || ""; if (stockBusy(book)) return; onPatch({ grout: { ...p.grout, product, ...groutSnapshotPatch(groutStock, book, p.grout.color) } }); };
  const mortarDefault = resolveMaterialDefault(mortarNames, p.mortar.product, settings.catalog.defaults?.mortar);
  const groutDefault = resolveMaterialDefault(groutNames, p.grout.product, settings.catalog.defaults?.grout);
  const addGrout = () => { if (groutDefault === p.grout.product) { onPatch({ grout: { ...p.grout, checked: true } }); return; } const book = settings.grouts[groutDefault]?.book || ""; if (stockBusy(book)) return; onPatch({ grout: { ...p.grout, checked: true, product: groutDefault, ...groutSnapshotPatch(groutStock, book, p.grout.color) } }); };
  const mortarOpts = mortarNames.includes(p.mortar.product) ? mortarNames : [p.mortar.product, ...mortarNames];
  const U = getUnderlay(p, settings), uEx = underlayExact(p, settings);
  const installDefs = settings.underlayments[p.underlay.product]?.install || [];
  const INS = getUnderlayInstall(p, settings);
  const insById = new Map((INS || []).map((m) => [m.defId, m]));
  const insIncluded = installDefs.filter((d) => !p.underlay.installSkip?.[d.id]).length;
  const underlayNames = offeredUnderlayments(settings.catalog, p.type);
  const underlayOpts = p.underlay.product && !underlayNames.includes(p.underlay.product) ? [p.underlay.product, ...underlayNames] : underlayNames;
  const underlayUnit = U ? U.unit : settings.underlayments[p.underlay.product]?.unit;
  const underlayDefault = resolveMaterialDefault(underlayNames, "", settings.catalog.defaults?.underlay);
  const toggleUnderlay = () => onPatch({ underlay: { ...p.underlay, checked: !p.underlay.checked, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayDefault) } });
  const offCats = p.type === "misc" ? [] : offeredCategories(settings.catalog, p.type);
  const warns = materialWarnings(p, settings);
  const gUnit = G ? G.unit : settings.grouts[p.grout.product]?.unit || "";
  const mUnit = M ? M.unit : settings.mortars[p.mortar.product]?.unit || "";
  const pInline = printProduct(p, settings).mats.filter((m) => m.inline);
  const matsCost = pInline.reduce((t, m) => t + m.cost, 0);

  const fl = "ft-eyebrow text-[8.5px] mb-1 block";
  const fi = "ft-field w-full h-[38px] rounded-md border border-slate-200 px-2.5 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const warnNote = (text) => <div className="basis-full text-[11px] text-amber-500 pb-1">{text}</div>;
  // Element helpers (not components — stable tree positions, no remount churn).
  const sw = (on, toggle, label) => (
    <button onClick={toggle} title={label} className="shrink-0 rounded-full transition-colors" style={{ width: 40, height: 24, position: "relative", background: on ? "var(--ft-brand)" : "var(--ft-border-strong)" }}>
      <span className="absolute rounded-full bg-white transition-all" style={{ width: 20, height: 20, top: 2, left: on ? 18 : 2 }} />
    </button>
  );
  const matHead = (label, hint, on, toggle) => (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="flex-1 min-w-0">
        <div className={`text-[12.5px] font-bold ${on ? "" : "text-slate-500"}`}>{label}</div>
        {hint && <div className="text-[10.5px] truncate" style={{ color: "var(--ft-faint)" }}>{hint}</div>}
      </div>
      {sw(on, toggle, label)}
    </div>
  );
  const qtyOverride = (exact, value, unit, onManual, placeholder = "—") => (
    <span className="ml-auto flex items-center gap-1.5 text-sm shrink-0" style={{ color: accent }}>
      {exact != null && <span className="text-slate-400 text-xs whitespace-nowrap">{exact.toFixed(2)} →</span>}
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onManual(e.target.value)} placeholder={placeholder} title="Total — type to override the calculated amount" className="!w-14 h-[32px] text-right font-semibold rounded border border-slate-200 focus:border-indigo-500 focus:outline-none px-1.5 ft-field" />
      <span className="font-semibold">{unit}</span>
    </span>
  );
  const stepper = (val, unit, set, note) => (
    <div>
      <div className="flex items-stretch h-[38px] rounded-md border border-slate-200 overflow-hidden bg-white">
        <button onClick={() => set(String(Math.max(0, val - 1)))} className="w-10 shrink-0 text-lg font-bold text-slate-400" title="One less">−</button>
        <input type="number" inputMode="numeric" value={String(val)} onChange={(e) => set(e.target.value)} className="ft-field min-w-0 flex-1 text-center text-[13.5px] font-extrabold focus:outline-none" style={{ border: 0 }} />
        <span className="flex items-center shrink-0 text-[10px] font-bold text-slate-400">{unit}</span>
        <button onClick={() => set(String(val + 1))} className="w-10 shrink-0 text-lg font-bold text-slate-400" title="One more">+</button>
      </div>
      {note && <div className="mt-0.5 text-[9.5px]" style={{ color: "var(--ft-faint)" }}>{note}</div>}
    </div>
  );

  return (
    <MobileSheet open onClose={onClose}
      title={blank ? "New product" : p.brandColor || TLBL[p.type]}
      badge={areaName ? <span className="shrink-0 rounded px-1.5 py-px text-[9.5px] font-semibold" style={{ background: "var(--ft-band)", color: "var(--ft-muted)" }}>{areaName}</span> : null}
      footer={<>
        <div className="flex-1 min-w-0" style={{ lineHeight: 1.15 }}>
          <div className="ft-eyebrow text-[8.5px]">Line total{matsCost > 0 ? <span className="normal-case tracking-normal font-normal" style={{ color: "var(--ft-faint)" }}> · + {money(matsCost)} materials</span> : ""}</div>
          <div className="ft-mono text-[17px] font-bold" style={tierPrice != null && tLine > 0 ? { color: TIER_COLOR[tv.tier]?.main } : undefined}>{money(tLine)}</div>
          {tierPrice != null && tLine > 0 && <div className="text-[9px]" style={{ color: "var(--ft-faint)" }}>retail {money(line)}</div>}
        </div>
        <button onClick={onClose} className="h-[38px] shrink-0 rounded-md px-8 text-[13px] font-bold" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}>Done</button>
      </>}>
      {blank && canSearch && (
        <button onClick={() => setSearching(true)} className="w-full h-[44px] mb-3 rounded-md flex items-center justify-center gap-2 text-[13.5px] font-bold" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}>
          <Search size={15} /> Search the price book
        </button>
      )}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {TYPES.map((t) => (
          <button key={t} onClick={() => onPatch({ type: t })}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1 text-[11px] font-bold ${p.type === t ? "border-slate-400" : "border-slate-200 text-slate-500"}`}
            style={p.type === t ? { background: "var(--ft-band)" } : { background: "var(--ft-card, #fff)" }}>
            <span className="rounded flex items-center justify-center font-extrabold" style={{ width: 16, height: 16, fontSize: 8.5, background: TYPE_ACCENT[t], color: "var(--ft-type-ink)" }}>{TLBL[t][0]}</span>
            {t === "misc" ? "Misc" : TLBL[t]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1.5">
        <div>
          <label className={fl}>{p.type === "misc" ? "Description" : "Product / color"}</label>
          <input value={p.brandColor} onChange={(e) => onPatch({ brandColor: e.target.value })} placeholder={p.type === "misc" ? "Description…" : "Product / color…"} className={fi} />
        </div>
        <div>
          <label className={fl}>SKU</label>
          {/* Plain field by request (2026-07-22): the SKU is typed or snapshotted,
              never searched from here — the search button above is the entry. */}
          <input value={p.sku} onChange={(e) => onPatch({ sku: e.target.value })} placeholder="SKU" className={fi + " ft-mono text-[12px]"} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div>
          <label className={fl}>{p.type === "tile" ? "Size · L×W×thk" : p.type === "hardwood" ? "Plank width" : "Size"}</label>
          <div className="ft-field flex items-center h-[38px] rounded-md border border-slate-200 px-1" style={{ fontSize: 13, fontWeight: 600 }}>
            {p.type === "tile" ? (
              <GridSizeInput p={p} onCommit={onPatch} />
            ) : (
              <input value={p.sizeText} onChange={(e) => onPatch({ sizeText: e.target.value })} className="ft-cell" placeholder={p.type === "hardwood" ? "Width" : "Size"} />
            )}
          </div>
        </div>
        <div>
          <label className={fl}>{p.type === "misc" ? "Pieces / carton" : "Coverage"}</label>
          {p.type !== "misc" && p.qtyType === "sqft" ? (
            <div className="relative">
              <input type="number" inputMode="decimal" value={p.cartonSf} onChange={(e) => onPatch({ cartonSf: e.target.value })} placeholder="—" className={fi + " text-right ft-mono pr-12"} title="Sq ft per carton/sheet — filled from the price book when the SKU has one. With this set, quantities and totals are figured by whole cartons." />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8.5px] font-bold" style={{ color: "var(--ft-muted)" }}>SF/{String(p.cartonUnit || "CT").toUpperCase()}</span>
            </div>
          ) : p.type === "misc" ? (
            <div className="relative">
              <input type="number" inputMode="decimal" value={p.cartonPc} onChange={(e) => onPatch({ cartonPc: e.target.value })} placeholder="—" className={fi + " text-right ft-mono pr-12"} title="Pieces per carton — with this set, pieces needed round up to whole cartons." />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8.5px] font-bold" style={{ color: "var(--ft-muted)" }}>PC/{String(p.cartonUnit || "CT").toUpperCase()}</span>
            </div>
          ) : (
            <div className={fi + " flex items-center justify-end"} style={{ color: "var(--ft-faint)" }}>—</div>
          )}
        </div>
        <div>
          <label className={fl}>{p.type === "misc" || p.qtyType === "count" ? "Price each" : "Price / SF"}</label>
          {tierPrice == null && !tierNoCost ? (
            <input type="number" inputMode="decimal" value={p.priceSqft} onChange={(e) => onPatch({ priceSqft: e.target.value })} placeholder="0.00" className={fi + " text-right ft-mono"} />
          ) : (
            <div className="rounded-md border border-slate-200 px-2.5 py-1 h-[38px] flex flex-col justify-center" style={{ background: "var(--ft-band)" }}>
              {tierNoCost ? (
                <div className="text-right font-bold text-[11px]" style={{ color: "#dc2626" }} title="No vendor cost on this line — Employee can't compute cost + 6%, so it stays at the retail price">Retail</div>
              ) : (
                <div className="text-right font-bold text-[12px] ft-mono" style={{ color: TIER_COLOR[tv.tier]?.main }}>{money(tierPrice)}</div>
              )}
              <div className="flex items-center justify-end gap-1">
                <span style={{ fontSize: 8.5, color: "var(--ft-faint)" }}>retail</span>
                <input type="number" inputMode="decimal" value={p.priceSqft} onChange={(e) => onPatch({ priceSqft: e.target.value })} placeholder="0.00" className="ft-cell text-right ft-mono" style={{ width: 48, flex: "none", fontSize: 10, padding: "0 2px", color: "var(--ft-muted)" }} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2.5">
        <div>
          <label className={fl}>{p.type === "misc" ? "Quantity (EA)" : p.qtyType === "count" ? "Quantity (EA)" : "Square feet"}</label>
          <div className="relative">
            <input ref={qtyRef} type="number" inputMode="decimal" value={p.qty} onChange={(e) => onPatch(p.type === "misc" || p.qtyType === "count" ? { qty: e.target.value, qtyType: "count" } : { qty: e.target.value })} placeholder={p.type === "misc" ? "1" : "0"} className={fi + " text-right ft-mono" + (p.type !== "misc" ? " pr-10" : "")} />
            {p.type !== "misc" && (
              <button onClick={() => onPatch({ qtyType: p.qtyType === "count" ? "sqft" : "count" })} title={p.qtyType === "count" ? "Counted each — tap to switch to square feet" : "Square feet — tap to switch to counted each"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 px-1 py-px text-[9px] font-extrabold text-slate-500" style={{ background: "var(--ft-band)" }}>{p.qtyType === "count" ? "EA" : "SF"}</button>
            )}
          </div>
        </div>
        <div>
          <label className={fl}>Order</label>
          {p.type !== "misc" && C ? (
            stepper(C.order, C.unit, (v) => onPatch({ cartonManual: v }), cEx != null ? `exact ${cEx.toFixed(2)} · ${sf1(C.order * C.sf)} SF ordered` : null)
          ) : PC ? (
            stepper(PC.cartons, PC.unit, (v) => onPatch({ cartonManual: v }), `${PC.need} pcs needed · ${PC.pieces} billed at ${PC.per}/${PC.unit.toUpperCase()}`)
          ) : (
            <div className={fi + " flex items-center justify-end gap-1 ft-mono"} style={{ color: "var(--ft-muted)" }}>
              {p.type === "misc" ? <>{miscQty(p)} <span className="text-[10px] font-bold">EA</span></> : num(p.qty) > 0 ? <>{sf1(num(p.qty))} <span className="text-[10px] font-bold">{p.qtyType === "count" ? "EA" : "SF"}</span></> : "—"}
            </div>
          )}
        </div>
      </div>
      {p.type !== "misc" && (
        <>
          <div className="ft-eyebrow text-[8.5px] mt-4 mb-1">Materials</div>
          <div className="rounded-md border border-slate-200 px-3 divide-y divide-slate-100" style={{ background: "var(--ft-card, #fff)" }}>
            {p.type === "tile" && (
              <div>
                {matHead("Grout", p.grout.checked ? [p.grout.product, p.grout.color].filter(Boolean).join(" · ") : groutDefault, p.grout.checked, () => p.grout.checked ? onPatch({ grout: { ...p.grout, checked: false } }) : addGrout())}
                {p.grout.checked && (
                  <div className="pb-2.5 -mt-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FitSelect sm value={p.grout.product} display={p.grout.product} onChange={(e) => pickGroutProduct(e.target.value)}>{groutOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                      <FitSelect sm value={p.grout.color} display={p.grout.color || "Color…"} onChange={(e) => pickGroutColor(e.target.value)}><option value="">Color…</option>{colorOpts.map((c) => <option key={c}>{c}</option>)}</FitSelect>
                      {(p.grout.sku || settings.grouts[p.grout.product]?.sku) && <span className="ft-mono text-[10px] text-slate-400 shrink-0" title="This color's price book SKU — prints on the order summary">{p.grout.sku || settings.grouts[p.grout.product]?.sku}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px] shrink-0">{JOINTS.map((j) => <button key={j.v} onClick={() => onPatch({ grout: { ...p.grout, joint: j.v } })} className={`px-2 py-1.5 ${num(p.grout.joint) === j.v ? "" : "ft-field text-slate-500"}`} style={num(p.grout.joint) === j.v ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>{j.label}</button>)}</div>
                      {qtyOverride(gEx, G ? String(G.order) : "", gUnit, (v) => onPatch({ grout: { ...p.grout, manual: v } }))}
                    </div>
                    {!G && warnNote("Enter Sq Ft + tile L×W×thickness to calculate, or type a total above.")}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="text-slate-400 shrink-0">Matching caulk</span>
                      {p.grout.caulkSku && <span className="ft-mono text-[10px] text-slate-400 truncate">{p.grout.caulkSku}</span>}
                      <span className="ml-auto flex items-center gap-1 shrink-0"><input type="number" inputMode="numeric" value={p.grout.caulk} onChange={(e) => onPatch({ grout: { ...p.grout, caulk: e.target.value } })} placeholder="—" title="Matching caulk for this grout color — tubes to order; leave blank for none" className={`w-12 h-[32px] text-right rounded border px-1.5 ft-field focus:border-indigo-500 focus:outline-none ${p.grout.caulk ? "border-indigo-300 text-indigo-700 font-semibold" : "border-slate-200"}`} /><span>tubes</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {p.type === "tile" && (
              <div>
                {matHead("Mortar", p.mortar.checked ? p.mortar.product : mortarDefault, p.mortar.checked, () => onPatch({ mortar: { ...p.mortar, checked: !p.mortar.checked, product: p.mortar.checked ? p.mortar.product : mortarDefault } }))}
                {p.mortar.checked && (
                  <div className="pb-2.5 -mt-1 flex flex-wrap items-center gap-1.5">
                    <FitSelect sm value={p.mortar.product} display={p.mortar.product} onChange={(e) => onPatch({ mortar: { ...p.mortar, product: e.target.value } })}>{mortarOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                    {settings.mortars[p.mortar.product]?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{settings.mortars[p.mortar.product]?.sku}</span>}
                    {qtyOverride(mEx, M ? String(M.order) : "", mUnit, (v) => onPatch({ mortar: { ...p.mortar, manual: v } }))}
                    {warns.includes("mortar") && warnNote("Not calculating — enter Sq Ft, or type a total.")}
                  </div>
                )}
              </div>
            )}
            <div>
              {matHead(underlayLabel(p.type), p.underlay.checked ? p.underlay.product || "Select…" : (p.underlay.product || underlayDefault), p.underlay.checked, toggleUnderlay)}
              {p.underlay.checked && (
                <div className="pb-2.5 -mt-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {underlayOpts.length > 0 ? (
                      <FitSelect sm value={p.underlay.product} display={p.underlay.product || "Select…"} onChange={(e) => onPatch({ underlay: { ...p.underlay, product: e.target.value } })}>{!p.underlay.product && <option value="">Select…</option>}{underlayOpts.map((u) => <option key={u} value={u}>{u}</option>)}</FitSelect>
                    ) : (
                      <span className="text-amber-500 text-xs">No {underlayLabel(p.type).toLowerCase()} products for {TLBL[p.type]} yet — add them in Settings.</span>
                    )}
                    {settings.underlayments[p.underlay.product]?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{settings.underlayments[p.underlay.product]?.sku}</span>}
                    {qtyOverride(uEx, U ? String(U.order) : "", underlayUnit, (v) => onPatch({ underlay: { ...p.underlay, manual: v } }))}
                  </div>
                  {installDefs.length > 0 && (
                    <div className="pt-1.5" style={{ borderTop: "1px solid var(--ft-border)" }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onPatch({ underlay: { ...p.underlay, install: !p.underlay.install } })} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${p.underlay.install ? "" : "border border-slate-300"}`} style={p.underlay.install ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>{p.underlay.install && <Check size={10} />}</button>
                        {p.underlay.install ? (
                          <button onClick={() => setInsExpanded((x) => !x)} className="flex items-center gap-1 text-xs min-w-0">
                            {insExpanded ? <ChevronDown size={12} className="text-slate-400 shrink-0" /> : <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                            Install materials
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{insIncluded < installDefs.length ? `${insIncluded} of ${installDefs.length}` : `${installDefs.length} item${installDefs.length === 1 ? "" : "s"}`}</span>
                          </button>
                        ) : (
                          <span className="text-xs">Install materials <span className="text-[10px] text-slate-400">({installDefs.length})</span></span>
                        )}
                        {p.underlay.install && !insExpanded && (INS ? (
                          <span className="ml-auto text-[10px] font-medium truncate" style={{ color: accent }}>{INS.slice(0, 3).map((m) => `${m.order} ${m.unit}`).join(" · ")}{INS.length > 3 ? ` +${INS.length - 3}` : ""}</span>
                        ) : insIncluded === 0 ? (
                          <span className="ml-auto text-[10px] text-slate-400">none included</span>
                        ) : (
                          <span className="ml-auto text-[10px] text-amber-500 truncate">{p.qtyType === "sqft" && num(p.qty) > 0 ? "No coverage set" : "Enter Sq Ft"}</span>
                        ))}
                      </div>
                      {p.underlay.install && insExpanded && (
                        <div className="mt-1 ml-6 space-y-1.5">
                          {installDefs.map((d) => {
                            const skipped = !!p.underlay.installSkip?.[d.id];
                            const item = insById.get(d.id);
                            const cur = p.underlay.installMortars?.[d.id] || d.product;
                            const opts = cur && !mortarNames.includes(cur) ? [cur, ...mortarNames] : mortarNames;
                            return (
                              <div key={d.id} className="flex items-center gap-2">
                                <button onClick={() => onPatch({ underlay: { ...p.underlay, installSkip: { ...(p.underlay.installSkip || {}), [d.id]: !skipped } } })} title={skipped ? "Skipped — tap to include" : "Included — tap to skip"} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${skipped ? "border border-slate-300" : ""}`} style={skipped ? undefined : { background: accent, color: "var(--ft-type-ink)" }}>{!skipped && <Check size={10} />}</button>
                                {d.kind === "mortar" && !skipped ? (
                                  <FitSelect sm value={cur} display={cur || "Select mortar…"} onChange={(e) => onPatch({ underlay: { ...p.underlay, installMortars: { ...(p.underlay.installMortars || {}), [d.id]: e.target.value } } })} title="Mortar used to set the underlayment — combines with this job's other mortar totals">
                                    {!cur && <option value="">Select mortar…</option>}{opts.map((g) => <option key={g} value={g}>{g}</option>)}
                                  </FitSelect>
                                ) : (
                                  <span className={`text-xs truncate ${skipped ? "text-slate-400 line-through" : "text-slate-600"}`}>{d.kind === "mortar" ? (cur || "mortar") : d.name}</span>
                                )}
                                <span className="ml-auto text-xs whitespace-nowrap">{skipped ? <span className="text-slate-300">skipped</span> : item ? <><span className="text-slate-400">{item.exact.toFixed(2)} → </span><span className="font-semibold" style={{ color: accent }}>{item.order} {item.unit}</span></> : <span className="text-slate-300">—</span>}</span>
                              </div>
                            );
                          })}
                          {!INS && insIncluded > 0 && <div className="text-xs text-amber-500">{p.qtyType === "sqft" && num(p.qty) > 0 ? "Set install-material coverage in Settings to calculate." : "Enter Sq Ft to calculate install materials."}</div>}
                        </div>
                      )}
                    </div>
                  )}
                  {warns.includes("underlay") && warnNote("Not calculating — pick a product and enter Sq Ft, or type a total.")}
                </div>
              )}
            </div>
            {offCats.map((cat) => {
              const jobA = p.attached?.[cat.id] || { checked: false, product: "", manual: "" };
              const names = offeredAttached(settings.catalog, cat.id);
              const opts = jobA.product && !names.includes(jobA.product) ? [jobA.product, ...names] : names;
              const def = resolveMaterialDefault(names, jobA.product, cat.default);
              const A = getAttached(p, settings, cat);
              const pf = settings.attached?.[cat.id]?.[jobA.product];
              const aUnit = A ? A.unit : pf?.unit || "";
              const covEx = cat.math === "coverage" && p.qtyType === "sqft" && num(p.qty) > 0 && num(pf?.coverage) > 0 ? num(p.qty) * wasteFor(p, settings) / num(pf.coverage) : null;
              const setA = (patch) => onPatch({ attached: { ...p.attached, [cat.id]: { ...jobA, ...patch } } });
              return (
                <div key={cat.id}>
                  {matHead(cat.name, jobA.checked ? jobA.product || "Select…" : (jobA.product || def), jobA.checked, () => jobA.checked ? setA({ checked: false }) : setA({ checked: true, product: jobA.product || def, manual: cat.math === "manual" ? (jobA.manual || "1") : jobA.manual }))}
                  {jobA.checked && (
                    <div className="pb-2.5 -mt-1 flex flex-wrap items-center gap-1.5">
                      {names.length > 0 || jobA.product ? (
                        <FitSelect sm value={jobA.product} display={jobA.product || "Select…"} onChange={(e) => setA({ product: e.target.value })}>{!jobA.product && <option value="">Select…</option>}{opts.map((n) => <option key={n} value={n}>{n}</option>)}</FitSelect>
                      ) : (
                        <span className="text-amber-500 text-xs">No {cat.name.toLowerCase()} products for {TLBL[p.type]} yet — add them in Settings.</span>
                      )}
                      {pf?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{pf.sku}</span>}
                      {qtyOverride(covEx, cat.math === "manual" ? jobA.manual : (A ? String(A.order) : ""), aUnit, (v) => setA({ manual: v }), cat.math === "manual" ? "qty" : "—")}
                      {cat.math === "coverage" && !A && jobA.product && warnNote("Enter Sq Ft + a coverage for this product to calculate, or type a total.")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <div className="mt-3">
        <label className={fl}>Note</label>
        <input value={p.note} onChange={(e) => onPatch({ note: e.target.value })} placeholder="note…" className={fi + " italic font-normal"} />
      </div>
      {canDelete && (confirmDel ? (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-red-600 flex-1">Delete this selection{p.brandColor ? ` — "${p.brandColor}"` : ""}? Its materials come off the estimate too.</span>
          <button onClick={() => { setConfirmDel(false); onDelete(); onClose(); }} className="h-[34px] shrink-0 rounded-md bg-red-600 text-white px-3 text-xs font-bold">Delete</button>
          <button onClick={() => setConfirmDel(false)} className="h-[34px] shrink-0 rounded-md border border-slate-200 px-3 text-xs">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)} className="mt-3 w-full h-[38px] rounded-md border text-[12.5px] font-bold" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "var(--ft-card, #fff)" }}><Trash2 size={13} className="inline -mt-0.5 mr-1" />Delete product</button>
      ))}
      <div style={{ height: 6 }} />
      {searching && (
        <MobileSearchSheet stock={stock} stockReady={stockReady} searchOrder={searchOrder} bookName={bookName} initial={p.sku || ""} strictness={strictness}
          onPick={(it) => { setSearching(false); onPickStock([it]); }}
          onPickMany={(items) => { setSearching(false); onPickStock(items); }}
          onManual={(t) => { setSearching(false); if (t && !p.brandColor) onPatch({ brandColor: t }); }}
          onVendor={onOpenSheoga ? (query) => { setSearching(false); onOpenSheoga(query); } : undefined}
          onClose={() => setSearching(false)} />
      )}
    </MobileSheet>
  );
}
