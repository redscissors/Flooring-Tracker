import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, ChevronDown, Check, Settings } from "lucide-react";
import { TYPES, TLBL, TYPE_ACCENT, THICK, TIER_COLOR, TIER_LONG } from "./uiconst.js";
import { money } from "./model.js";
import { queryHit as sheogaQueryHit, parseQuery as sheogaParseQuery, querySummary as sheogaQuerySummary } from "./sheoga.js";
import { useAnchoredPanel, vPos } from "./widgets.jsx";
import { Hit, searchPanelBox, hitKey, matchSummary, useMergedResults } from "./search.jsx";

// Product flooring-type picker: a colour-coded pill that opens a swatch menu of
// all types. Each type keeps its editorial accent (TYPE_ACCENT) here and on the
// card's left border.
export function TypeSelect({ type, onChange, triggerRef, compact, blank }) {
  const [open, setOpen] = useState(false);
  const accent = TYPE_ACCENT[type];
  // The menu renders in a body portal (like the SKU/search pickers) so the area
  // card's overflow-hidden can't clip it — the adder sits at the card's bottom
  // edge, where an in-flow dropdown would be cut off.
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, btnRef, panelRef, () => setOpen(false));
  const setBtn = (el) => { btnRef.current = el; if (typeof triggerRef === "function") triggerRef(el); else if (triggerRef) triggerRef.current = el; };
  // Keyboard: a printable letter jumps to the type(s) whose label starts with
  // it, cycling through them when several share a first letter — so the field
  // behaves like a native <select> even though it's a custom swatch menu.
  const pickByLetter = (e) => {
    if (e.key.length !== 1 || !/[a-z]/i.test(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const hits = TYPES.filter((t) => TLBL[t][0].toLowerCase() === k);
    if (!hits.length) return;
    e.preventDefault();
    onChange(hits[(hits.indexOf(type) + 1) % hits.length]);
  };
  return (
    <div className={`relative shrink-0 ${compact ? "self-stretch flex" : ""}`}>
      {compact ? (
        <button ref={setBtn} onClick={() => setOpen((o) => !o)} onKeyDown={pickByLetter} title={blank ? "Pick a material type" : `Product type — ${TLBL[type]} (click to change)`}
          className="ft-mat-toggle shrink-0 flex items-center justify-center font-bold leading-none"
          style={blank
            ? { width: 18, background: "var(--ft-field, #fff)", color: "var(--ft-muted)", fontSize: 10, margin: "6px 0", border: "1px dashed var(--ft-border)" }
            : { width: 18, background: accent, color: "var(--ft-type-ink)", fontSize: 10, margin: "6px 0" }}>
          {blank ? <Plus size={11} /> : TLBL[type][0]}
        </button>
      ) : (
      <button ref={setBtn} onClick={() => setOpen((o) => !o)} onKeyDown={pickByLetter} title="Product type"
        className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-1.5 py-1 text-xs font-semibold"
        style={{ color: accent, background: `color-mix(in oklab, ${accent} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${accent} 45%, transparent)` }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        {TLBL[type]}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      )}
      {open && pos && createPortal(
        <div ref={panelRef} style={{ position: "fixed", ...vPos(pos), left: Math.max(8, Math.min(pos.left, window.innerWidth - 176 - 8)), width: 176, maxHeight: pos.maxH, overflowY: "auto" }}
          className="z-50 rounded-lg border border-slate-200 bg-white shadow-lg py-1 overflow-hidden">
          {TYPES.map((t) => {
            const on = !blank && t === type;
            return (
              <button key={t} onClick={() => { onChange(t); setOpen(false); }}
                className={`ft-grow-row w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-slate-50 ${on ? "font-semibold" : "text-slate-700"}`}
                style={on ? { color: TYPE_ACCENT[t] } : undefined}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_ACCENT[t], opacity: on ? 1 : 0.65 }} />
                {TLBL[t]}
                {on && <Check size={12} className="ml-auto" />}
              </button>
            );
          })}
        </div>, document.body)}
    </div>
  );
}

export const GRID_COLS = "0.85fr 2.75fr 1fr 0.55fr 0.5fr 0.55fr 0.7fr 0.8fr 44px";

// Price cell under a non-retail tier: the tier-adjusted price takes the
// input's spot (color-coded like the tier chips) and the editable retail
// slides beneath as a micro field — the GridSizeInput footnote pattern.
// Retail stays the stored value; the top line is derived, never typed.
export function GridPriceCell({ p, tier, tierPrice, noCost, onRetail, title }) {
  if (tierPrice == null && !noCost) return (
    <input type="number" value={p.priceSqft} onChange={(e) => onRetail(e.target.value)} data-c="price" className="ft-cell text-right" placeholder="0.00" title={title} />
  );
  const color = TIER_COLOR[tier]?.main || "var(--ft-brand-deep)";
  return (
    <div className="flex flex-col min-w-0 flex-1 self-stretch justify-center" style={{ gap: 1, padding: "2px 0" }}>
      {noCost ? (
        <div className="text-right font-bold" style={{ fontSize: 10.5, padding: "3px 4px 0", color: "#dc2626" }} title="No vendor cost on this line — Employee can't compute cost + 6%, so it stays at the retail price below">Retail</div>
      ) : (
        <div className="text-right font-bold" style={{ fontSize: 11, padding: "3px 4px 0", color }} title={`${TIER_LONG[tier]} price — what the estimate uses`}>{money(tierPrice)}</div>
      )}
      <div className="flex items-center justify-end" style={{ gap: 2, padding: "0 4px 2px" }}>
        <span style={{ fontSize: 8.5, color: "var(--ft-faint)" }}>retail</span>
        <input type="number" value={p.priceSqft} onChange={(e) => onRetail(e.target.value)} data-c="price" className="ft-cell text-right" style={{ width: 40, flex: "none", fontSize: 9, padding: "1px 2px", color: "var(--ft-muted)" }} placeholder="0.00" title={noCost ? `${title} — the estimate uses this retail price (no cost on the line)` : `${title} — stored retail; the ${TIER_LONG[tier]?.toLowerCase()} price above derives from it`} />
      </div>
    </div>
  );
}

// Tile size cell: one typeable "L×W" or "L×W×thickness" string, parsed on
// commit (blur) back into the row's L / W / thickness fields. When the row
// carries a free-text `sizeText` (a non-rectangular vendor size like "2\" Hex",
// ticket 009 Variant A), that vendor string is the primary field and the
// derived square L×W it computes grout/mortar from is a quiet, correctable
// footnote beneath — never presented as the size itself.
export function GridSizeInput({ p, onCommit }) {
  const [editDims, setEditDims] = useState(false);
  const shown = p.L || p.W ? `${p.L}×${p.W}${p.thickness ? `×${THICK.find((t) => t.v === String(p.thickness))?.label || p.thickness + '"'}` : ""}` : "";
  const commit = (raw) => {
    const t = String(raw).trim();
    if (!t) { onCommit({ L: "", W: "" }); return; }
    const m = t.split(/\s*[x×]\s*/);
    const patch = { L: m[0] ? m[0].replace(/[^\d.]/g, "") : "", W: m[1] ? m[1].replace(/[^\d.]/g, "") : "" };
    if (m[2] !== undefined) {
      const th = m[2].trim();
      const known = THICK.find((k) => k.label.replace(/"/g, "") === th.replace(/"/g, ""));
      const frac = th.match(/^(\d+)\s*\/\s*(\d+)/);
      patch.thickness = known ? known.v : frac ? String(Number(frac[1]) / Number(frac[2])) : th.replace(/[^\d.]/g, "") || p.thickness;
    }
    onCommit(patch);
  };
  if (p.sizeText) {
    const micro = { width: 26, fontSize: 9, padding: "1px 2px" };
    return (
      <div className="flex flex-col min-w-0 flex-1 self-stretch justify-center" style={{ gap: 1, padding: "2px 0" }}>
        <input value={p.sizeText} onChange={(e) => onCommit({ sizeText: e.target.value })} data-c="size"
          className="ft-cell" style={{ padding: "3px 4px 1px" }} placeholder="Size"
          title="Vendor size — grout & mortar compute from the L×W below" />
        {editDims ? (
          <div className="flex items-center" style={{ gap: 2, padding: "0 4px 2px" }}>
            <input value={p.L} onChange={(e) => onCommit({ L: e.target.value.replace(/[^\d.]/g, "") })} className="ft-cell" style={micro} title="Length (in) grout/mortar compute from" />
            <span style={{ fontSize: 9, color: "var(--ft-faint)" }}>×</span>
            <input value={p.W} onChange={(e) => onCommit({ W: e.target.value.replace(/[^\d.]/g, "") })} className="ft-cell" style={micro} title="Width (in) grout/mortar compute from" />
          </div>
        ) : p.L && p.W ? (
          <button type="button" onClick={() => setEditDims(true)} className="text-left"
            style={{ fontSize: 8.5, color: "var(--ft-brand)", padding: "0 4px 2px", lineHeight: 1.1, background: "none", border: 0, cursor: "pointer" }}
            title="Correct the L×W grout & mortar compute from">▦ computes as {p.L}×{p.W}</button>
        ) : (
          <button type="button" onClick={() => setEditDims(true)} className="text-left"
            style={{ fontSize: 8.5, color: "var(--ft-faint)", padding: "0 4px 2px", lineHeight: 1.1, background: "none", border: 0, cursor: "pointer" }}
            title="No coverage yet — add an L×W for grout & mortar">＋ add size for grout</button>
        )}
      </div>
    );
  }
  return (
    <input key={shown} defaultValue={shown} data-c="size"
      onBlur={(e) => { if (e.target.value !== shown) commit(e.target.value); }}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target.value !== shown) commit(e.target.value); }}
      className="ft-cell" style={{ padding: "6px 4px" }} placeholder="L×W" title='Tile size — type "12×24" or "12×24×3/8"' />
  );
}

// Product cell: typed text is the row's brand/color; matches from the stock
// price book drop down beneath (same search the SKU cell uses) and picking
// one fills the row exactly like a SKU pick.
//
// A long description wraps to a second line INSIDE the row instead of
// scrolling out of sight — the box is capped at two lines (the height the
// price cell's tier/retail stack already gives a row) and never grows past it.
// An <input> can't wrap or color part of its text, so the field is a
// transparent-text textarea over a painted mirror: the mirror sizes the box,
// draws the glyphs, and paints everything past `budget` red — the characters
// that stop the row's order description (size · product · SKU · coverage,
// nameBudget in orderentry.js) from fitting the ERP field in one piece. A
// count chip shows the would-be paste length against descLimit while over.
const CELL_LINE = 14;              // px line-height; two lines + pad = 34px cap
const OVER_RED = "#dc2626";
export function GridProductBox({ value, stock, onChange, onPick, searchOrder, bookName, placeholder = "Product…", inputRef, budget = Infinity, descLimit = 0 }) {
  const [open, setOpen] = useState(false);
  const [twoLine, setTwoLine] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const mirrorRef = useRef(null);
  const { results: matches } = useMergedResults(open, stock, value, searchOrder);
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  // Measured, not guessed, so the single/two-line toggle survives any column
  // width — single-line text keeps today's centered look. scrollHeight includes
  // the mode's own padding, so subtract it or a shrink could never toggle back.
  useLayoutEffect(() => {
    const el = mirrorRef.current;
    if (el) setTwoLine(el.scrollHeight - (twoLine ? 6 : 12) > CELL_LINE + 1);
  }, [value, twoLine]);
  const over = Number.isFinite(budget) && String(value || "").length > budget;
  const text = {
    fontWeight: 700, lineHeight: `${CELL_LINE}px`, padding: twoLine ? "3px 8px" : "6px 8px",
    whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden",
  };
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0 self-stretch flex items-center">
      <div className="relative w-full" style={{ minHeight: CELL_LINE + 12, maxHeight: 2 * CELL_LINE + 6 }}>
        {/* zIndex 1: the mirror paints ABOVE the textarea — the focused cell's
            opaque .ft-cell:focus background would otherwise hide the glyphs.
            Caret, selection and focus ring show through its transparent body.
            No minHeight here: the wrapper carries it, so the line measurement
            reads pure content height and a trimmed row can drop back to one. */}
        <div ref={mirrorRef} aria-hidden style={{ ...text, position: "relative", zIndex: 1, maxHeight: 2 * CELL_LINE + 6, pointerEvents: "none" }}>
          {over ? (
            <>
              {String(value).slice(0, budget)}
              <span style={{ color: OVER_RED, textDecoration: "underline", textDecorationThickness: 1, textUnderlineOffset: 2 }}>{String(value).slice(budget)}</span>
            </>
          ) : value}
        </div>
        <textarea ref={inputRef} value={value} rows={1}
          onChange={(e) => { onChange(e.target.value.replace(/\r?\n/g, " ")); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && open && matches.length && e.altKey) { e.preventDefault(); onPick(matches[0]); setOpen(false); } }}
          onScroll={(e) => { if (mirrorRef.current) mirrorRef.current.scrollTop = e.target.scrollTop; }}
          data-c="product" className={`ft-cell font-bold ${value ? "" : "ft-field"}`} placeholder={placeholder}
          style={{ ...text, position: "absolute", inset: 0, height: "100%", resize: "none", color: "transparent", caretColor: "var(--ft-text)" }}
          title="Brand / color — or search the price book and pick a match to fill the row" />
        {over && descLimit > 0 && (
          <span style={{ position: "absolute", right: 2, bottom: 1, zIndex: 2, fontSize: 8.5, fontWeight: 700, padding: "0 3px", borderRadius: 4, background: "var(--ft-card)", color: OVER_RED, border: "1px solid color-mix(in oklab, #dc2626 40%, transparent)", pointerEvents: "none" }}
            title={`The order-entry description would be ${String(value).length + (descLimit - budget)} characters — the ERP field holds ${descLimit}. Trim the red tail to fit in one piece.`}>
            {String(value).length + (descLimit - budget)}/{descLimit}
          </span>
        )}
      </div>
      {open && pos && matches.length > 0 && createPortal(
        <div ref={panelRef} style={searchPanelBox(pos)}
          className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 flex flex-col">
          <div className="max-h-60 min-h-0 overflow-y-auto">
            {matches.map((it) => (
              <button key={(it.bookId || "stock") + "|" + it.sku} onMouseDown={(e) => { e.preventDefault(); onPick(it); setOpen(false); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <Hit it={it} bookName={bookName} />
              </button>
            ))}
          </div>
        </div>, document.body)}
    </div>
  );
}

// Empty-row search: one wide field spanning the row that queries the stock
// price book by SKU or product words. Picking a match fills the whole row
// (like the SKU/product cells do); shift-click adds several as their own rows;
// Enter with no match — or a double-click — hands the row to manual entry.
export function GridOmniSearch({ stock, stockReady, query, onQuery, onPick, onPickMany, onManual, onAbandon, onVendor, searchOrder, bookName, inputRef }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [picked, setPicked] = useState([]); // picked hits (stock or order), in click order
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  // Revert-on-abandon: leftover search text in the permanent adder row is
  // cleared once focus truly leaves the widget without a commit, so an
  // untouched adder always shows its placeholder. committedRef suppresses the
  // clear when a pick/manual just fired (that path unmounts this search row);
  // pickedRef guards a shift-click that toggled a match but blurred the input.
  const committedRef = useRef(false);
  const pickedRef = useRef(picked); pickedRef.current = picked;
  const blurTimer = useRef(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  const { results, total } = useMergedResults(open, stock, query, searchOrder);
  const close = () => { setOpen(false); setPicked([]); };
  const pos = useAnchoredPanel(open, wrapRef, panelRef, close);
  const pick = (it) => { committedRef.current = true; onPick(it); close(); };
  // Keep the whole hit (see SkuPicker): order items have no in-memory list to
  // re-resolve from, and the snapshot survives changing the search words.
  const toggle = (it) => setPicked((prev) => prev.some((x) => hitKey(x) === hitKey(it)) ? prev.filter((x) => hitKey(x) !== hitKey(it)) : [...prev, it]);
  const goManual = () => { committedRef.current = true; onManual(); };
  const commit = () => {
    committedRef.current = true;
    if (picked.length === 1) onPick(picked[0]);
    else if (picked.length) onPickMany(picked);
    close();
  };
  const onBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      const ae = document.activeElement;
      const inside = (wrapRef.current && wrapRef.current.contains(ae)) || (panelRef.current && panelRef.current.contains(ae));
      if (inside || committedRef.current || pickedRef.current.length > 0) return;
      onAbandon?.(); close();
    }, 120);
  };
  // Sheoga has no SKUs, so it can never be a book match — a query that starts
  // spelling the vendor ("she" is enough) or hits its trade words pins a
  // "Vendor configurators" row under the real matches (issue 023).
  const vendor = !!onVendor && sheogaQueryHit(query);
  const goVendor = () => { committedRef.current = true; onVendor(query); close(); };
  const commitFromKey = () => {
    if (picked.length) commit();
    else if (results[hi]) pick(results[hi]);
    else if (results.length) pick(results[0]);
    else if (vendor) goVendor();
    // No results while the book is still loading is not "not in the book" —
    // Enter must not silently commit a real SKU to manual entry.
    else if (query.trim() && stockReady) goManual();
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); commitFromKey(); }
    // Tab adds the built-up selection (or the highlighted match) when the panel
    // is offering something; otherwise it stays plain field navigation.
    else if (e.key === "Tab" && open && (picked.length || results.length)) { e.preventDefault(); commitFromKey(); }
    else if (e.key === "Escape") close();
  };
  // Pick/toggle on mousedown, not click: streaming order matches re-render the
  // list mid-gesture, and a click spanning that re-render is dropped (pointerup
  // lands on a fresh node) — it read as the popup closing on you. preventDefault
  // keeps focus in the field so the pick never trips blur/focus-out dismissal.
  const onRow = (e, it) => { e.preventDefault(); e.shiftKey ? toggle(it) : pick(it); };
  const noHits = query.trim() && (stock.length > 0 || !!searchOrder) && results.length === 0;
  const bookLoading = !stockReady && query.trim() && results.length === 0;
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0 self-stretch flex" onDoubleClick={goManual}>
      <input ref={inputRef} value={query} onChange={(e) => { onQuery(e.target.value); setOpen(true); setHi(0); }} onFocus={() => { committedRef.current = false; setOpen(true); }} onBlur={onBlur}
        onKeyDown={onKey} data-c="product" className="ft-cell ft-field font-bold" placeholder="Search SKU or product…  (double-click to type by hand)"
        title="Search the price book by SKU or product name, then pick a match to fill the whole row. Shift-click to add several. Double-click to enter a product by hand." />
      {open && pos && (results.length > 0 || picked.length > 0 || noHits || vendor || bookLoading) && createPortal(
        <div ref={panelRef} style={searchPanelBox(pos)}
          className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 flex flex-col">
          {results.length > 0 && (
            <div className="max-h-72 min-h-0 overflow-y-auto">
              {results.map((it, i) => {
                const sel = picked.some((x) => hitKey(x) === hitKey(it));
                return (
                  <div key={hitKey(it)} onMouseDown={(e) => onRow(e, it)} onMouseEnter={() => setHi(i)}
                    className={`flex items-start gap-2 cursor-pointer px-2.5 py-1.5 border-b border-slate-100 last:border-0 ${sel ? "bg-indigo-50/60" : i === hi ? "bg-slate-50" : ""}`}>
                    <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(it); }} title={sel ? "Remove from selection" : "Add to selection"}
                      className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{sel && <Check size={11} />}</button>
                    <div className="flex-1 min-w-0"><Hit it={it} bookName={bookName} /></div>
                  </div>
                );
              })}
            </div>
          )}
          {vendor && (
            <div className="shrink-0 border-t border-slate-100">
              <div className="ft-eyebrow text-[9px] px-2.5 pt-1.5" style={{ color: "var(--ft-brand-deep)" }}>Vendor configurators</div>
              <button onMouseDown={(e) => { e.preventDefault(); goVendor(); }} data-sheoga-entry
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-slate-50" style={{ background: "var(--ft-tint)" }}>
                <span className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0" style={{ background: "var(--ft-brand)" }}><Settings size={12} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-extrabold">Sheoga Hardwood — configure by description</span>
                  <span className="block text-[11px] font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{sheogaQuerySummary(sheogaParseQuery(query))}</span>
                </span>
                <span className="shrink-0 font-extrabold" style={{ color: "var(--ft-brand-deep)" }}>→</span>
              </button>
            </div>
          )}
          <div className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
            {bookLoading ? (
              <span className="truncate">Price book still loading…</span>
            ) : noHits ? (
              <><span className="truncate">No price-book match.</span>
                <button onMouseDown={(e) => { e.preventDefault(); onManual(); }} className="ml-auto shrink-0 rounded-md bg-indigo-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-indigo-700">Enter "{query.trim()}" by hand</button></>
            ) : (<>
              <span className="truncate">{matchSummary(results.length, total)}</span>
              {picked.length > 0 ? (
                <button onMouseDown={(e) => { e.preventDefault(); commit(); }} className="ml-auto shrink-0 rounded-md bg-indigo-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-indigo-700">Add {picked.length} product{picked.length === 1 ? "" : "s"}</button>
              ) : (
                <span className="ml-auto shrink-0">Shift-click to pick several</span>
              )}
            </>)}
          </div>
        </div>, document.body)}
    </div>
  );
}
