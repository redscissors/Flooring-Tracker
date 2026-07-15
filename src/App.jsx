import { Fragment, useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Trash2, Settings, Save, Printer, ClipboardList, FileText, Download, Upload, X, History, Check, Paperclip, Menu, LogOut, ChevronRight, ChevronDown, ChevronUp, Hand, Pencil, ListTodo, Phone, Mail, MapPin, Building2, StickyNote, Percent, BookOpen, Paintbrush, Layers, Database, Link2, Link2Off, MoreHorizontal, Sun, Moon, Laptop, User, Lock, Pin, RotateCcw, AlertTriangle, Eye, EyeOff, Copy } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { fetchAllRows } from "./fetchall.js";
import { num, ceilQty, normalizeSettings, withDerived, serializeSettings, groutExact, mortarExact, getGrout, getMortar, groutBaseList, cartonExact, getCarton, underlayExact, getUnderlay, getUnderlayInstall, materialWarnings, offeredGrouts, offeredMortars, offeredUnderlayments, catalogHasSeedUnderlayments, isDuplicateName, addCompany, addProduct, removeProduct, removeCompany, renameProduct } from "./catalog.js";
import { normStockItem, stockData, searchStock, findStock, stockPatch, stockDrift, diffStock, syncCatalogPrices, stockCompanionBase, stockBaseVariant, stockBaseCompanion, groutFamilies, groutColorItem, groutCaulkItem, priceUnitOf, orderUnitOf } from "./stock.js";
import { parsePriceBook, parseMapped, mappedSkuRe, guessHeaderRow, bestDataSheet, columnsFromHeader, detectVtcEft } from "./pricebook.js";
import { parsePdfPages } from "./pdfbook.js";
import { isManningtonCartons, parseManningtonPages } from "./manningtonbook.js";
import { normBookItem, bookItemData, diffBookItems, pricedItem, markupGroups, orderPatch, orderDrift, mergeSearch, editedInDiff, bookStaleness, DEFAULT_STALE_DAYS, specialOrderMargin, orderFloorFirst, rowCostSqft, itemProblems, supersedePairs } from "./orderbook.js";
import { OrderEntryPanel } from "./orderentry.jsx";
import { normName, matchName } from "./names.js";
import { expand } from "./synonyms.js";
import NedMark from "./NedMark.jsx";
import keimLogo from "./assets/keim-logo-ink.png";

const TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
const TLBL = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };
// The underlayment row is labelled per flooring type — a tile job wants "backer"
// language, the soft/plank goods want "underlayment".
const UNDERLAY_LABEL = { tile: "Tile Backer" };
const underlayLabel = (type) => UNDERLAY_LABEL[type] || "Underlayment";
// Product-type accents: the small type button, active joint toggle and the
// material check chips carry the flooring type's color (the selection rows
// themselves are paper-washed, not type-colored — see ROW_WASH below). They
// resolve to CSS tokens (src/index.css) sourced from the NED data series, so
// each flips with light/dark and a recolor is a one-line stylesheet change.
const TYPE_ACCENT = { tile: "var(--ft-type-tile)", hardwood: "var(--ft-type-hardwood)", vinyl: "var(--ft-type-vinyl)", laminate: "var(--ft-type-laminate)", carpet: "var(--ft-type-carpet)", misc: "var(--ft-type-misc)" };

// Selection grid tone recipe (prototype 2026-07-12): rows and the materials
// box sit on the page tone (--ft-area-row) so the card interior reads as the
// surrounding surface; the band, column header and the Price/Total cells share
// one head tone (--ft-area-head — page ink in dark, where the rows lift 5%
// instead). Not the flooring-type color — the type accent is reserved for the
// small type button, joint toggles and the material check chips. Product boxes
// stack flush inside their area card with a thin --ft-grid-line divider; the
// area card's own border is that same line, so a product's left/right edge
// lines up with the card outline as one clean line.
const ROW_WASH = "var(--ft-area-row)";
const TOTAL_WASH = "var(--ft-area-head)";
const JOINTS = [{ label: '1/16"', v: 0.0625 }, { label: '1/8"', v: 0.125 }, { label: '3/16"', v: 0.1875 }];
const THICK = [{ label: '1/8"', v: "0.125" }, { label: '3/16"', v: "0.1875" }, { label: '1/4"', v: "0.25" }, { label: '5/16"', v: "0.3125" }, { label: '3/8"', v: "0.375" }, { label: '7/16"', v: "0.4375" }, { label: '1/2"', v: "0.5" }, { label: '5/8"', v: "0.625" }, { label: '3/4"', v: "0.75" }];
// Grout colors are code-defined (out of the persisted catalog — see ADR 0002),
// but keyed per grout product so each brand offers its own palette. A grout not
// listed here (e.g. a team-added one) falls back to DEFAULT_COLORS. The job's
// color picker resolves the list by the selected grout's name.
const DEFAULT_COLORS = ["Mushroom", "Natural Gray", "Bright White", "Dusty Grey", "Desert Khaki", "Latte", "Antique White", "Marble Beige", "Light Pewter", "Parchment", "Raven", "Sterling Silver", "Mocha", "Smoke Grey", "Silver Shadow", "Sand Beige", "Sauterne", "Platinum", "Midnight Black", "Espresso", "Butter Cream", "Silk", "Slate Grey", "Almond", "Toasted Almond", "Hemp", "Hot Cocoa", "Terra Cotta", "Quarry Red", "Chestnut Brown", "Autumn Green", "Twilight Blue", "Sandstone", "Fossil", "Walnut", "Mink", "Steamship", "Iron", "Frosty", "Stormy Grey"];
const GROUT_COLORS = {
  "Tec Power Grout": ["Antique White", "Birch", "Bright White", "Charcoal", "Coffee", "Dark Walnut", "Dove Grey", "Espresso", "Jet Black", "Light Bronze", "Light Buff", "Light Cool Gray", "Light Pewter", "Light Smoke", "Mist", "Mocha", "Optic White", "Pearl", "Praline", "Raven", "Sable", "Sandstone", "Silhouette", "Silverado", "Slate Grey", "Standard Grey", "Standard White", "Starry Night", "Sterling", "Summer Wheat", "Urban Bronze", "Warm Taupe"],
  "CEG-Lite": ["Bright White", "Snow White", "Antique White", "Alabaster", "Bone", "Linen", "Quartz", "Urban Putty", "Haystack", "Sandstone", "Mushroom", "Light Smoke", "Khaki", "Fawn", "Sahara Tan", "Summer Wheat", "Earth", "Nutmeg", "Walnut", "Chateau", "New Taupe", "Saddle Brown", "Tobacco Brown", "Sable Brown", "Truffle", "Surf Green", "Ice Blue", "Platinum", "Rolling Fog", "Bleached Wood", "Oyster Gray", "Cape Gray", "Delorean Gray", "Driftwood", "Graystone", "Natural Gray", "Winter Gray", "Pewter", "Dove Gray", "Charcoal"],
};
const colorsFor = (groutName) => GROUT_COLORS[groutName] || DEFAULT_COLORS;

// A native select sizes to its longest option (or its container), not the
// selected one — an invisible twin of the selected label sets the width here.
const FitSelect = ({ display, className = "", sm, children, ...rest }) => {
  const pad = sm ? "pl-1.5 pr-5 py-0.5 text-xs" : "pl-2 pr-6 py-1.5 text-sm";
  return (
    <span className={`relative inline-block max-w-full align-middle ${className}`}>
      <span aria-hidden="true" className={`invisible block truncate whitespace-pre border border-transparent ${pad}`}>{display || " "}</span>
      <select {...rest} className={`ft-field absolute inset-0 w-full h-full appearance-none rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${pad}`}>{children}</select>
      <ChevronDown size={sm ? 11 : 13} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
};

const SKU_SHOW = 30;

// A stable id for a search hit across stock and every order book — the same
// string used as the React key and to dedupe the multi-select. Stock items have
// no bookId; two order books can legitimately reuse a SKU, so the book scopes it.
const hitKey = (it) => (it.bookId || "stock") + "|" + it.sku;

const StockHit = ({ it }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <span className="text-xs font-medium truncate flex-1 text-slate-900">{it.description || it.product || it.section}</span>
    </div>
    <div className="flex items-baseline gap-2 text-[11px] text-slate-400">
      <span className="truncate">{[it.size, it.brand && !it.description.includes(it.brand) ? it.brand : it.section].filter(Boolean).join(" · ")}</span>
      <span className="ml-auto shrink-0 ft-mono">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
  </>
);

// A special-order search hit (ADR 0009 §6): StockHit's shape plus the book
// badge, the lead time a salesperson needs before quoting, and a freight flag
// (highlight only — no charge math, §3.6). The price shown is the live sell
// (cost × book markup); the snapshot happens only on pick.
const OrderHit = ({ it, bookName }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <span className="text-xs font-medium truncate flex-1 text-slate-900">{it.description || it.product}</span>
      <span className="ml-auto shrink-0 ft-mono text-[11px]">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
    <div className="flex items-baseline gap-1.5 text-[11px]">
      <span className="shrink-0 rounded px-1 bg-indigo-50 text-indigo-600 font-medium">{bookName(it.bookId)} · special order</span>
      {it.leadTime && <span className="text-slate-400 truncate">{it.leadTime}</span>}
      {it.freightFlag && <span className="shrink-0 rounded px-1 bg-amber-50 text-amber-700 font-medium">+ freight</span>}
    </div>
  </>
);

// One search-result body: an order item badges as special-order; a stock item
// renders as today, plus an "also on {book}" note when the same SKU also lives
// in an order book (the collision resolved to stock — mergeSearch §6).
const Hit = ({ it, bookName = () => "special order" }) => (
  it.bookId ? <OrderHit it={it} bookName={bookName} /> : (
    <>
      <StockHit it={it} />
      {it.alsoOn?.length > 0 && <div className="text-[11px] text-slate-400">also on {it.alsoOn.map(bookName).join(", ")}</div>}
    </>
  )
);

const matchSummary = (shown, total) => total > shown ? `Showing ${shown} of ${total} matches — keep typing to narrow` : `${total} match${total === 1 ? "" : "es"}`;

// Dropdown panels render in a portal on <body>: the product-row field bar and
// the settings modal both clip absolutely-positioned children (overflow), so
// the panel anchors to the input with fixed coordinates instead. Returns the
// anchor's viewport rect (tracked through scroll/resize) and dismisses on a
// pointer-down outside both the anchor and the panel.
const useAnchoredPanel = (open, anchorRef, panelRef, onDismiss) => {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!anchorRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) onDismiss(); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return pos;
};

// Order-book search for the selection-row pickers (ADR 0009 §6). Stock stays
// instant from the in-memory list; special-order matches stream in behind them
// from a debounced server query (searchOrder — null when no order books exist,
// which keeps the whole feature inert until one is imported).
function useOrderResults(query, searchOrder) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = (query || "").trim();
    if (!q || !searchOrder) { setItems([]); return; }
    let stale = false;
    const t = setTimeout(async () => {
      try { const r = await searchOrder(q); if (!stale) setItems(r); }
      catch { if (!stale) setItems([]); }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [query, searchOrder]);
  return items;
}

// Instant stock matches + streamed order matches, merged stock-first with the
// exact-SKU collision resolved to stock (mergeSearch), then capped for display.
// Each stock match is shallow-copied so mergeSearch's alsoOn tag never lands on
// the shared in-memory stock objects.
function useMergedResults(active, stock, query, searchOrder) {
  const orderRaw = useOrderResults(active ? query : "", searchOrder);
  const stockMatches = active ? searchStock(stock, query) : [];
  const { stock: sMatches, order: oMatches } = mergeSearch(stockMatches.map((it) => ({ ...it })), orderRaw);
  const combined = [...sMatches, ...oMatches];
  return { results: combined.slice(0, SKU_SHOW), total: combined.length };
}

// SKU typeahead for a product row. Typing stores the text on the row (a SKU is
// just a field); picking a suggestion snapshots the stock item's values onto
// the row via onPick. Search matches SKU prefixes or words in the item text.
// Shift-click (or the leading checkbox) marks several results; committing the
// selection fills this row with the first item and appends a product row for
// each of the rest via onPickMany.
const fitW = (v, minCh, padRem) => ({ width: `calc(${Math.max(String(v ?? "").length, minCh)}ch + ${padRem}rem)` });

function SkuPicker({ value, stock, onChange, onPick, onPickMany, searchOrder, bookName, wrapClass, wrapStyle, inputClass }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [picked, setPicked] = useState([]); // picked hits (stock or order), in click order
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const { results, total } = useMergedResults(open, stock, value, searchOrder);
  const close = () => { setOpen(false); setPicked([]); };
  const pos = useAnchoredPanel(open, wrapRef, panelRef, close);
  const pick = (it) => { onPick(it); close(); };
  // Keep the whole hit, not just its SKU — order items aren't in the in-memory
  // stock list to re-resolve from, and holding the snapshot lets the selection
  // survive the user changing search words between picks.
  const toggle = (it) => setPicked((prev) => prev.some((x) => hitKey(x) === hitKey(it)) ? prev.filter((x) => hitKey(x) !== hitKey(it)) : [...prev, it]);
  const commit = () => {
    if (picked.length === 1) onPick(picked[0]);
    else if (picked.length) onPickMany(picked);
    close();
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (picked.length) commit();
      else if (results[hi]) pick(results[hi]);
      else if (results.length) pick(results[0]);
    }
    if (e.key === "Escape") close();
  };
  return (
    <div ref={wrapRef} className={wrapClass ?? "relative shrink-0 h-9 border-r border-slate-200"} style={wrapStyle ?? { ...fitW(value, 6, 1.4), maxWidth: "18rem" }}>
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)}
        onKeyDown={onKey} data-c="sku"
        className={inputClass ?? "w-full h-full px-2 py-1.5 ft-field focus:outline-none focus:bg-white"} placeholder="SKU" title="Stock price book — enter a SKU or search words, pick a match to fill this row. Shift-click to pick several at once." />
      {open && pos && (results.length > 0 || picked.length > 0) && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: Math.max(8, Math.min(pos.left, window.innerWidth - Math.min(416, window.innerWidth * 0.9) - 8)) }}
          className="fixed w-[26rem] max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg z-50">
          <div className="max-h-72 overflow-y-auto">
            {results.map((it, i) => {
              const sel = picked.some((x) => hitKey(x) === hitKey(it));
              return (
                <div key={hitKey(it)} onClick={(e) => (e.shiftKey ? toggle(it) : pick(it))} onMouseEnter={() => setHi(i)}
                  className={`flex items-start gap-2 cursor-pointer px-2.5 py-1.5 border-b border-slate-100 last:border-0 ${sel ? "bg-indigo-50/60" : i === hi ? "bg-slate-50" : ""}`}>
                  <button onClick={(e) => { e.stopPropagation(); toggle(it); }} title={sel ? "Remove from selection" : "Add to selection"}
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{sel && <Check size={11} />}</button>
                  <div className="flex-1 min-w-0"><Hit it={it} bookName={bookName} /></div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
            <span className="truncate">{matchSummary(results.length, total)}</span>
            {picked.length > 0 ? (
              <button onClick={commit} className="ml-auto shrink-0 rounded-md bg-indigo-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-indigo-700">Add {picked.length} product{picked.length === 1 ? "" : "s"}</button>
            ) : (
              <span className="ml-auto shrink-0">Shift-click to pick several</span>
            )}
          </div>
        </div>, document.body)}
    </div>
  );
}

// Price book lookup for the Settings catalog's add-product form: picking an
// item pre-fills the draft (name, price, coverage when the book has one). No
// multi-select — catalog products are added one at a time.
function StockSearch({ stock, onPick, inp, placeholder = "Search the price book to pre-fill (optional)…" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const matches = open ? searchStock(stock, q) : [];
  const results = matches.slice(0, SKU_SHOW);
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  const pick = (it) => { onPick(it); setQ(`${it.sku} — ${it.description || it.product}`); setOpen(false); };
  return (
    <div ref={wrapRef} className="relative mb-1.5">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && results.length) { e.preventDefault(); pick(results[0]); } if (e.key === "Escape") setOpen(false); }}
        className={inp} placeholder={placeholder} />
      {open && pos && results.length > 0 && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50">
          <div className="max-h-60 overflow-y-auto">
            {results.map((it) => (
              <button key={it.sku} onClick={() => pick(it)} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <StockHit it={it} />
              </button>
            ))}
          </div>
          <div className="px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">{matchSummary(results.length, matches.length)}</div>
        </div>, document.body)}
    </div>
  );
}

// Grout family lookup (ADR 0007): search the imported book's Grout & Caulk
// families to link a catalog grout's color source.
function FamilySearch({ families, onPick, inp }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const t = q.trim().toLowerCase();
  const matches = open ? families.filter((f) => !t || `${f.brand} ${f.product}`.toLowerCase().includes(t)) : [];
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  const pick = (f) => { onPick(f); setQ(""); setOpen(false); };
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && matches.length) { e.preventDefault(); pick(matches[0]); } if (e.key === "Escape") setOpen(false); }}
        className={inp} placeholder="Link colors — search the book's grout & caulk families…" />
      {open && pos && matches.length > 0 && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 max-h-60 overflow-y-auto">
          {matches.map((f) => (
            <button key={f.product} onClick={() => pick(f)} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <div className="flex items-baseline gap-2"><span className="text-xs font-medium truncate flex-1">{f.product}</span><span className="ft-mono text-[11px] text-slate-400 shrink-0">{f.colors.length} colors</span></div>
              <div className="flex items-baseline gap-2 text-[11px] text-slate-400"><span className="truncate">{f.brand}</span>{f.price != null && <span className="ml-auto shrink-0 ft-mono">${f.price.toFixed(2)}</span>}</div>
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}

const ATT_BUCKET = "attachments";
const SHARED_SETTINGS_ID = "singleton";
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sf1 = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
// Estimate disclaimer wording for the waste factor: one number when tile and
// other flooring share a rate, both spelled out when they differ.
const wasteNote = (s) => num(s?.waste?.tile) === num(s?.waste?.floor)
  ? `${num(s?.waste?.tile)}% material waste`
  : `material waste (tile ${num(s?.waste?.tile)}%, other flooring ${num(s?.waste?.floor)}%)`;
// Misc lines are flat-priced; a typed quantity multiplies the price. Only
// count-mode qty is honored so a stale sqft value left over from a type
// switch (or legacy rows) can't silently multiply the total.
const miscQty = (p) => (p.qtyType === "count" && String(p.qty ?? "").trim() !== "" ? num(p.qty) : 1);

// One product row -> everything the print layouts render for it. Materials
// carry a `kind` + aggregation `key`; `inline` rows print under the product
// (label · qty · name), install extras only reach the bottom breakdown.
function printProduct(p, s) {
  const G = getGrout(p, s), M = getMortar(p, s), U = getUnderlay(p, s), IN = getUnderlayInstall(p, s) || [];
  const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
  const C = p.type === "misc" ? null : getCarton(p, s);
  const line = p.type === "misc" ? num(p.priceSqft) * miscQty(p) : (C ? C.order * C.sf : sf) * num(p.priceSqft);
  const j = JOINTS.find((x) => x.v === num(p.grout?.joint))?.label;
  const mats = [];
  if (p.type === "tile" && p.grout?.checked) {
    // Show selected grout even when the quantity can't be computed (e.g. tile
    // thickness/joint not entered) so it prints like mortar/backer instead of
    // silently vanishing; blank order/price when uncomputed.
    mats.push({ kind: "Grout", key: `g|${p.grout.product}|${p.grout.color || ""}`, name: p.grout.product, spec: p.grout.color || "", sku: p.grout.sku || "", detail: j ? `${j} joint` : "", inline: true, order: G ? G.order : 0, unit: G ? G.unit : "", exact: G ? G.exact : 0, price: G ? G.price : num(s.grouts[p.grout.product]?.price), cost: G && G.price > 0 ? G.order * G.price : 0 });
    const ck = num(p.grout.caulk);
    if (ck > 0) mats.push({ kind: "Caulk", key: `c|${p.grout.product}|${p.grout.color || ""}`, name: `${p.grout.product} matching caulk`, spec: p.grout.color || "", sku: p.grout.caulkSku || "", detail: "", inline: true, order: ck, unit: "tubes", exact: ck, price: num(p.grout.caulkPrice), cost: ck * num(p.grout.caulkPrice) });
  }
  if (M) mats.push({ kind: "Mortar", key: `m|${M.product}`, name: M.product, spec: "", detail: "", inline: true, order: M.order, unit: M.unit, exact: M.exact, price: M.price, cost: M.price > 0 ? M.order * M.price : 0 });
  if (U && U.product) mats.push({ kind: underlayLabel(p.type), key: `u|${U.product}`, name: U.product, spec: "", detail: IN.length ? "+ install materials" : "", inline: true, order: U.order, unit: U.unit, exact: U.exact, price: U.price, cost: U.price > 0 ? U.order * U.price : 0 });
  IN.forEach((m) => mats.push(m.kind === "mortar"
    ? { kind: "Mortar", key: `m|${m.name}`, name: m.name, spec: "", detail: "", inline: false, order: m.order, unit: m.unit, exact: m.exact, price: m.price, cost: m.price > 0 ? m.order * m.price : 0 }
    : { kind: "Install", key: `i|${m.name}`, name: m.name, spec: U?.product ? `installs ${U.product}` : "", sku: m.sku || "", detail: "", inline: false, order: m.order, unit: m.unit, exact: m.exact, price: m.price, cost: m.price > 0 ? m.order * m.price : 0 }));
  const thickSuffix = p.type === "tile" && p.thickness ? ` × ${THICK.find((t) => t.v === String(p.thickness))?.label || p.thickness + '"'}` : "";
  const size = p.type === "tile" ? (p.sizeText ? `${p.sizeText}${thickSuffix}` : `${p.L}" × ${p.W}"${thickSuffix}`) : (p.sizeText || "");
  const qtyText = p.type === "misc" ? String(miscQty(p)) : C ? (C.order > 0 ? `${C.order} ${C.unit}` : "") : num(p.qty) > 0 ? `${p.qty} ${p.qtyType === "sqft" ? "sf" : "units"}` : "";
  const priceText = num(p.priceSqft) > 0 ? (p.type === "misc" ? money(num(p.priceSqft)) + (miscQty(p) !== 1 ? "/ea" : "") : `${money(num(p.priceSqft))}/${p.qtyType === "count" ? "ea" : "sf"}`) : "";
  return { size, C, line, mats, qtyText, priceText, orderedSf: p.type === "misc" ? 0 : C ? C.order * C.sf : sf };
}
// The honest extended vendor cost of a special-order line: the snapshotted
// per-unit cost (costSqft, parallel to priceSqft) carried through the SAME
// quantity math as its sell (printProduct.line), so hand-editing the sale price
// moves the margin, not the cost. Rows saved before costSqft existed fall back
// to deriving the cost from the markup — the prior behavior, correct until the
// price is edited. `sell` is the line's extended sell (printProduct.line).
function orderLineCost(p, s, sell) {
  if (String(p.costSqft ?? "").trim() !== "") {
    const csf = num(p.costSqft);
    if (p.type === "misc") return csf * miscQty(p);
    const C = getCarton(p, s);
    const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
    return (C ? C.order * C.sf : sf) * csf;
  }
  const pct = num(p.markupPct);
  return pct > 0 ? sell / (1 + pct / 100) : sell;
}
// Estimate area headers show the flooring subtotal only — material costs live
// in the bottom "Setting materials & sundries" breakdown.
const printAreaFloor = (a, s) => a.products.reduce((t, p) => t + printProduct(p, s).line, 0);
const PRINT_KINDS = ["Grout", "Grout base", "Caulk", "Mortar", "Tile Backer", "Underlayment", "Install"];
// Kiln #8b estimate sheet: the 9-column product grid and the muted em dash
// empty cells render (the Color column is a dash for now — the data model
// keeps brand+color in one brandColor field).
const PRINT_COLS = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.6fr 0.8fr 0.8fr";
const PRINT_DASH = <span style={{ color: "var(--ft-faint)" }}>—</span>;
const KSHORT = { Grout: "Grout", "Grout base": "Base", Caulk: "Caulk", Mortar: "Mortar", "Tile Backer": "Backer", Underlayment: "Underlay", Install: "Install" };
const u1 = (order, unit) => (order === 1 ? String(unit || "").replace(/s$/, "") : unit);
// The catalog SKU a breakdown row carries (materials resolve by name — the SKU
// is display-only, per ADR 0006).
const matSku = (kind, name, s) =>
  kind === "Grout" ? s.grouts[name]?.sku || ""
    : kind === "Mortar" ? s.mortars[name]?.sku || ""
      : kind === "Tile Backer" || kind === "Underlayment" ? s.underlayments?.[name]?.sku || "" : "";
// Whole-job materials for the estimate's bottom breakdown: aggregate exact
// quantities per item (ceil once at the end, like the on-screen totals) and
// sum the per-line costs so the breakdown reconciles with the grand total.
// Base units derive from the aggregated grout kit counts (ADR 0006) via the
// same groutBaseList the on-screen summary uses.
function printMatList(cust, s) {
  const agg = new Map();
  (cust.categories || []).forEach((a) => a.products.forEach((p) => printProduct(p, s).mats.forEach((m) => {
    const e = agg.get(m.key) || { kind: m.kind, name: m.name, spec: m.spec, sku: "", unit: m.unit, price: m.price, exact: 0, cost: 0 };
    e.exact += m.exact; e.cost += m.cost; e.sku = e.sku || m.sku || ""; agg.set(m.key, e);
  })));
  // A selection-snapshotted SKU (the grout color's own SKU, ADR 0007) outranks
  // the catalog product's SKU; the catalog SKU is the fallback.
  const rows = [...agg.values()].map((m) => ({ ...m, sku: m.sku || matSku(m.kind, m.name, s), order: ceilQty(m.exact) }));
  const bases = groutBaseList(rows.filter((m) => m.kind === "Grout").map((m) => ({ product: m.name, order: m.order })), s)
    .map((b) => ({ kind: "Grout base", name: b.name, spec: "", sku: b.sku, unit: b.unit, price: b.price, exact: b.exact, order: b.order, cost: b.cost }));
  return [...rows, ...bases].sort((x, y) => PRINT_KINDS.indexOf(x.kind) - PRINT_KINDS.indexOf(y.kind));
}
const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const dataURLToBlob = (dataURL) => { const [meta, b64] = String(dataURL).split(","); const mime = (meta.match(/:(.*?);/) || [])[1] || "application/octet-stream"; const bin = atob(b64 || ""); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); };

const newProduct = () => ({ id: uid(), type: "tile", sku: "", L: "", W: "", thickness: "0.375", sizeText: "", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", cartonSf: "", cartonUnit: "CT", cartonManual: "", note: "", grout: { checked: false, product: "PermaColor Select", color: "", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" }, mortar: { checked: false, product: "ProLite", manual: "" }, underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} } });
const newArea = () => ({ id: uid(), name: "", note: "", products: [newProduct()] });
const areaLabel = (a, i) => (a.name || "").trim() || `Area ${i + 1}`;
// A row with no identity yet — the empty state renders as a price-book search
// instead of the full grid (pick a match to fill it, or a type/double-click to
// enter it by hand).
const rowBlank = (p) => !p.sku && !p.brandColor && !p.L && !p.W && !p.sizeText && !(num(p.priceSqft) > 0) && !(num(p.qty) > 0);
// Every area carries one trailing blank "adder" row (the inline New-row
// affordance). It's ephemeral scaffolding, not a real selection, so change
// detection for auto-versions compares categories with blank rows stripped —
// otherwise the adder would look like an edit on every open.
const catSig = (cats) => JSON.stringify((cats || []).map((a) => ({ ...a, products: (a.products || []).filter((p) => !rowBlank(p)) })));
// A Project is what a "Customer" used to be: one job/estimate holding areas.
// It belongs to a Customer (person) via customerId (the projects.customer_id
// column). See ADR 0005.
// salesperson is SNAPSHOTTED from the creator's profile at addProject time and
// never read live again — projects are team-shared, so without the snapshot a
// teammate opening the job would print THEIR name on the estimate. Editable
// only through the header's salesperson popover.
const newProject = (customerId = null, name = "New Project") => ({ id: uid(), customerId, name, address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: [], versions: [], attachments: [], salesperson: null });
// A Customer is the person/account that owns many projects and holds contact
// info once. A Builder is a canonical name-list a customer links to by id.
const newPerson = (name = "") => ({ id: uid(), builderId: null, name, phone: "", email: "", address: "", notes: "", createdAt: Date.now() });
const newBuilder = (name = "") => ({ id: uid(), name });

// thickness/joint use || not ??: rows migrated from the artifact can hold ""
// (or 0), which silently blocks the grout calc — mortar doesn't need either,
// so grout alone showed "—". Default them like a fresh row.
const normP = (p) => ({ id: p.id || uid(), type: TYPES.includes(p.type) ? p.type : "tile", sku: p.sku ?? "", L: p.L ?? "", W: p.W ?? "", thickness: p.thickness || "0.375", sizeText: p.sizeText ?? (p.size || ""), brandColor: p.brandColor ?? [p.brand, p.color].filter(Boolean).join(" / "), priceSqft: p.priceSqft ?? "", qtyType: p.qtyType === "count" ? "count" : "sqft", qty: p.qty ?? "", cartonSf: p.cartonSf ?? "", cartonUnit: p.cartonUnit || "CT", cartonManual: p.cartonManual ?? "", note: p.note ?? "", bookId: p.bookId ?? "", cost: p.cost ?? "", costSqft: p.costSqft ?? "", markupPct: p.markupPct ?? "", freightFlag: !!p.freightFlag, tierPrice: p.tierPrice ?? "", grout: { checked: !!p.grout?.checked, product: p.grout?.product || "PermaColor Select", color: p.grout?.color || "", sku: p.grout?.sku ?? "", joint: num(p.grout?.joint) > 0 ? p.grout.joint : 0.125, manual: p.grout?.manual ?? "", caulk: p.grout?.caulk ?? "", caulkSku: p.grout?.caulkSku ?? "", caulkPrice: p.grout?.caulkPrice ?? "" }, mortar: { checked: !!p.mortar?.checked, product: p.mortar?.product || "ProLite", manual: p.mortar?.manual ?? "" }, underlay: { checked: !!p.underlay?.checked, product: p.underlay?.product || "", manual: p.underlay?.manual ?? "", install: !!p.underlay?.install, installMortars: p.underlay?.installMortars || {}, installSkip: p.underlay?.installSkip || {} } });
const normA = (a) => ({ id: a.id || uid(), name: a.name || "", note: a.note || "", products: (a.products || [{}]).map(normP) });
const normC = (c) => ({ ...c, customerId: c.customerId ?? null, categories: (c.categories || []).map(normA), versions: c.versions || [], attachments: c.attachments || [], salesperson: c.salesperson || null });

// Customer (person) rows: contact info lives in the data jsonb; builder_id is a
// real column. personData is what gets written back to the jsonb.
const PERSON_SELECT = "id, created_at, updated_at, builder_id, name:data->>name, phone:data->>phone, email:data->>email, address:data->>address, notes:data->>notes";
const personRow = (r) => ({ id: r.id, builderId: r.builder_id ?? null, name: r.name || "", phone: r.phone || "", email: r.email || "", address: r.address || "", notes: r.notes || "", createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(), updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now() });
const personData = ({ id, createdAt, updatedAt, builderId, ...rest }) => rest;
const builderRow = (r) => ({ id: r.id, name: r.name || "" });

// Builder picker: type to search the canonical list or add a new one. Picking an
// existing builder links by id; typing a name close to an existing one warns
// before creating a duplicate ("P & L" vs "P&L") — ADR 0005.
function BuilderCombo({ value, builders, onSelect, onAddBuilder, inp }) {
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
function MetaChip({ icon: Icon, label, value, active, onClick }) {
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
function SalespersonPop({ value, fallback, onChange, alignRight }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  const sp = { name: "", phone: "", email: "", ...(value || fallback || {}) };
  const fld = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const W = 240;
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen((o) => !o)} title="Salesperson — locked in when the project was created. Click to change." className="ft-serif min-w-0 max-w-full truncate hover:text-indigo-700" style={{ fontSize: 17, lineHeight: 1.2, borderBottom: "1px dashed var(--ft-border-strong)" }}>
        {sp.name || sp.email || "Set salesperson"}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: Math.max(8, Math.min(alignRight ? pos.left + pos.width - W : pos.left, window.innerWidth - W - 8)) }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 p-3 space-y-1.5" onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setOpen(false); }} >
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

// Product flooring-type picker: a colour-coded pill that opens a swatch menu of
// all types. Each type keeps its editorial accent (TYPE_ACCENT) here and on the
// card's left border.
function TypeSelect({ type, onChange, triggerRef, compact, blank }) {
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
        <div ref={panelRef} style={{ position: "fixed", top: pos.top, left: Math.max(8, Math.min(pos.left, window.innerWidth - 176 - 8)), width: 176 }}
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

// ---- Kiln #14a grid input model ----------------------------------------
// The area editing surface is a spreadsheet grid (same 9 columns as the
// printed sheet, plus a slim utility column) over the exact same product
// state — every write still goes through updProduct/updArea.
const GRID_COLS = "0.85fr 2.75fr 1fr 0.55fr 0.5fr 0.55fr 0.7fr 0.8fr 44px";
const gridCell = { borderRight: "1px solid var(--ft-row-line)", minWidth: 0, display: "flex", alignItems: "center" };

// Tile size cell: one typeable "L×W" or "L×W×thickness" string, parsed on
// commit (blur) back into the row's L / W / thickness fields. When the row
// carries a free-text `sizeText` (a non-rectangular vendor size like "2\" Hex",
// ticket 009 Variant A), that vendor string is the primary field and the
// derived square L×W it computes grout/mortar from is a quiet, correctable
// footnote beneath — never presented as the size itself.
function GridSizeInput({ p, onCommit }) {
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
function GridProductBox({ value, stock, onChange, onPick, searchOrder, bookName, placeholder = "Product…", inputRef }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const { results: matches } = useMergedResults(open, stock, value, searchOrder);
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0 self-stretch flex">
      <input ref={inputRef} value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && open && matches.length && e.altKey) { e.preventDefault(); onPick(matches[0]); setOpen(false); } }}
        data-c="product" className={`ft-cell font-bold ${value ? "" : "ft-field"}`} placeholder={placeholder} title="Brand / color — or search the price book and pick a match to fill the row" />
      {open && pos && matches.length > 0 && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: Math.max(8, Math.min(pos.left, window.innerWidth - Math.min(416, window.innerWidth * 0.9) - 8)) }}
          className="fixed w-[26rem] max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg z-50">
          <div className="max-h-60 overflow-y-auto">
            {matches.map((it) => (
              <button key={(it.bookId || "stock") + "|" + it.sku} onClick={() => { onPick(it); setOpen(false); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
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
function GridOmniSearch({ stock, query, onQuery, onPick, onPickMany, onManual, onAbandon, searchOrder, bookName, inputRef }) {
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
  const onKey = (e) => {
    if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (picked.length) commit();
      else if (results[hi]) pick(results[hi]);
      else if (results.length) pick(results[0]);
      else if (query.trim()) goManual();
    } else if (e.key === "Escape") close();
  };
  const noHits = query.trim() && (stock.length > 0 || !!searchOrder) && results.length === 0;
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0 self-stretch flex" onDoubleClick={goManual}>
      <input ref={inputRef} value={query} onChange={(e) => { onQuery(e.target.value); setOpen(true); setHi(0); }} onFocus={() => { committedRef.current = false; setOpen(true); }} onBlur={onBlur}
        onKeyDown={onKey} data-c="product" className="ft-cell ft-field font-bold" placeholder="Search SKU or product…  (double-click to type by hand)"
        title="Search the price book by SKU or product name, then pick a match to fill the whole row. Shift-click to add several. Double-click to enter a product by hand." />
      {open && pos && (results.length > 0 || picked.length > 0 || noHits) && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: Math.max(8, Math.min(pos.left, window.innerWidth - Math.min(416, window.innerWidth * 0.9) - 8)) }}
          className="fixed w-[26rem] max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg z-50">
          {results.length > 0 && (
            <div className="max-h-72 overflow-y-auto">
              {results.map((it, i) => {
                const sel = picked.some((x) => hitKey(x) === hitKey(it));
                return (
                  <div key={hitKey(it)} onClick={(e) => (e.shiftKey ? toggle(it) : pick(it))} onMouseEnter={() => setHi(i)}
                    className={`flex items-start gap-2 cursor-pointer px-2.5 py-1.5 border-b border-slate-100 last:border-0 ${sel ? "bg-indigo-50/60" : i === hi ? "bg-slate-50" : ""}`}>
                    <button onClick={(e) => { e.stopPropagation(); toggle(it); }} title={sel ? "Remove from selection" : "Add to selection"}
                      className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{sel && <Check size={11} />}</button>
                    <div className="flex-1 min-w-0"><Hit it={it} bookName={bookName} /></div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
            {noHits ? (
              <><span className="truncate">No price-book match.</span>
                <button onMouseDown={(e) => { e.preventDefault(); onManual(); }} className="ml-auto shrink-0 rounded-md bg-indigo-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-indigo-700">Enter "{query.trim()}" by hand</button></>
            ) : (<>
              <span className="truncate">{matchSummary(results.length, total)}</span>
              {picked.length > 0 ? (
                <button onClick={commit} className="ml-auto shrink-0 rounded-md bg-indigo-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-indigo-700">Add {picked.length} product{picked.length === 1 ? "" : "s"}</button>
              ) : (
                <span className="ml-auto shrink-0">Shift-click to pick several</span>
              )}
            </>)}
          </div>
        </div>, document.body)}
    </div>
  );
}

// Enter in any grid cell moves to the same column one product row down
// (spreadsheet-style); on the last row it grows the area by one product.
function gridEnterNav(e, addRow) {
  if (e.key !== "Enter" || e.defaultPrevented || e.target.tagName === "SELECT") return;
  const col = e.target.getAttribute?.("data-c");
  const card = e.target.closest?.("[data-prod-card]");
  if (!col || !card) return;
  const cards = [...e.currentTarget.querySelectorAll("[data-prod-card]")];
  const i = cards.indexOf(card);
  const next = cards[i + 1]?.querySelector(`[data-c="${col}"]`);
  if (next) { e.preventDefault(); next.focus(); next.select?.(); }
  else if (i === cards.length - 1) { e.preventDefault(); addRow(); }
}

// The light list row: everything the sidebar draws/searches/sorts, projected out
// of the jsonb server-side. Shared by the initial load and server-side search.
const LIST_SELECT = "id, created_at, updated_at, customer_id, name:data->>name, address:data->>address, phone:data->>phone, email:data->>email";
const lightRow = (r) => ({
  id: r.id,
  customerId: r.customer_id ?? null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  name: r.name || "", address: r.address || "", phone: r.phone || "", email: r.email || "",
  _full: false,
});
// Version metadata as held in memory — snapshots stay on the server until a
// restore actually needs one.
const vMeta = (r) => ({ id: r.id, label: r.label || "Version", auto: !!r.auto, savedAt: r.saved_at ? new Date(r.saved_at).getTime() : Date.now() });
const normProfile = (p) => ({ name: "", phone: "", email: "", ...(p || {}) });
const AUTO_KEEP = 5;
// Price-book import versions kept per book (pinned rows are never pruned).
const BOOK_VERSION_KEEP = 3;
// Reserved pricebook_versions.book_id for the shop workbook (its items live in
// stock_items, not price_book_items — ADR 0009 §5).
const STOCK_BOOK_ID = "stock";

// Animated light/dark switch (RiccardoRapelli sun/moon toggle, Uiverse.io) —
// a quick binary shortcut for the three-way theme control in Settings. Checked
// = dark; toggling writes an explicit "light"/"dark" (leaving "System").
function ThemeSwitch({ theme, setTheme }) {
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
function MarginLine({ margin, show, onToggle }) {
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

export default function App({ user, onSignOut }) {
  const [data, setData] = useState(() => ({ projects: [], people: [], builders: [], settings: normalizeSettings() }));
  const [loading, setLoading] = useState(true);
  // selId = the open Project (drives the estimate pane). selCustId = the open
  // Customer (person) when no project is selected (drives the customer view).
  const [selId, setSelId] = useState(null);
  const [selCustId, setSelCustId] = useState(null);
  // Which customers are expanded in the sidebar tree.
  const [openCust, setOpenCust] = useState({});
  // The "New customer" modal: null when closed, else the draft name string.
  const [newCust, setNewCust] = useState(null);
  const [custModal, setCustModal] = useState(null); // customer id whose details box is open
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showSettings, setShowSettings] = useState(false);
  // Per-user profile (name/phone/email), printed on the estimate header.
  const [profile, setProfile] = useState(normProfile());
  // The rest of this user's app_data blob, kept so profile saves don't clobber
  // anything else stored there.
  const appBlobRef = useRef({});
  const [showVersions, setShowVersions] = useState(false);
  // Stock price book (ADR 0003): all active+retired items, loaded once — the
  // SKU picker and drift chips search this in memory. Empty until the team has
  // run supabase/stock.sql and imported the workbook.
  const [stock, setStock] = useState([]);
  // Grout color families from the book's Grout & Caulk sheet (ADR 0007) — read
  // at edit time only (color dropdowns, Settings linking), never at calc time.
  const gFamilies = useMemo(() => groutFamilies(stock), [stock]);
  // Team to-do / issue list (issue 006): shared rows, loaded once for the
  // sidebar badge and refreshed every time the list is opened.
  const [todos, setTodos] = useState([]);
  const [showTodos, setShowTodos] = useState(false);
  // Price book library (ADR 0009): registry books beyond the stock workbook.
  // Metadata is loaded up front for the Settings list; a book's items load
  // lazily when it's opened (a vendor book is ~10x the stock book). Empty
  // until the team has run supabase/pricebooks.sql.
  const [books, setBooks] = useState([]);
  // Current book items for the SKUs on the open project's order rows, nested
  // { [bookId]: { [sku]: normBookItem | null } }. Order items aren't eagerly
  // loaded, so the row drift chip fetches just the handful of SKUs actually on
  // the estimate on demand; a SKU that has left the book resolves to null and
  // stays cached so it isn't refetched.
  const [orderItems, setOrderItems] = useState({});
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const pbRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  // Which print layout the buttons chose; null (e.g. browser-menu Ctrl+P) prints the estimate.
  const [printMode, setPrintMode] = useState(null);
  useEffect(() => { if (!printMode) return; window.print(); setPrintMode(null); }, [printMode]);
  const [focusArea, setFocusArea] = useState(null);
  const [focusName, setFocusName] = useState(false);
  // Keyboard-flow focus targets (product id): after Add product, land on the
  // new row's type; after a SKU pick, land on the Sq Ft box (so the footage
  // still gets keyed) then Tab carries on to the materials; when that line
  // expands via Enter, land on its first checkbox.
  const [focusProd, setFocusProd] = useState(null);
  const [focusQty, setFocusQty] = useState(null);
  const [focusProdBox, setFocusProdBox] = useState(null); // after a row goes manual, land in its product box
  // Empty rows render as a price-book search; these hold the transient search
  // text and which rows the user has committed to manual entry this session.
  // Neither is persisted — a blank row simply re-opens as search on reload.
  const [manualRows, setManualRows] = useState({});
  const [omniQ, setOmniQ] = useState({});
  // Appearance: "system" | "light" | "dark", per-device (localStorage, not
  // Supabase). index.html applies the saved class pre-paint; this keeps <html>
  // in sync when the user changes it. "system" clears both classes and lets the
  // prefers-color-scheme block in index.css decide.
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("ft-theme") || "system"; } catch { return "system"; } });
  const themedOnce = useRef(false);
  useEffect(() => {
    try { localStorage.setItem("ft-theme", theme); } catch {}
    const el = document.documentElement;
    el.classList.remove("ned-dark", "ned-light");
    if (theme === "dark") el.classList.add("ned-dark");
    else if (theme === "light") el.classList.add("ned-light");
    // Crossfade the whole palette on a user toggle (but not the first paint):
    // .ft-theming briefly enables a color transition on everything, removed
    // once the fade is done so it never slows ordinary interaction.
    if (!themedOnce.current) { themedOnce.current = true; return; }
    el.classList.add("ft-theming");
    const t = setTimeout(() => el.classList.remove("ft-theming"), 600);
    return () => clearTimeout(t);
  }, [theme]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(min-width: 768px)").matches : true);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [custChip, setCustChip] = useState(null); // which contact chip is expanded (customer view)
  const [viewTab, setViewTab] = useState("edit"); // project detail: "edit" | "preview" (on-screen estimate paper)
  // Internal materials-margin reveal (ADR 0011): ephemeral, default hidden, never
  // persisted, never printed. Resets when switching projects (customer-safe).
  const [showMargin, setShowMargin] = useState(false);
  // Copy-for-order-entry panel (special-order + stock, formatted for pasting
  // into the vendor order program). Ephemeral, read-only, never printed.
  const [showOrderCopy, setShowOrderCopy] = useState(false);
  useEffect(() => { setViewTab("edit"); setShowMargin(false); setShowOrderCopy(false); }, [selId]);
  // Active card drag: { pid, fromAid, to: { aid, index, y } | null }. The card
  // follows the pointer imperatively (no re-render per move); state only changes
  // when the drop target changes, to redraw the insertion bar / area highlight.
  const [drag, setDrag] = useState(null);
  const [insOpen, setInsOpen] = useState({});
  // Which product's materials drawer is open — view state only, never
  // persisted, and only one at a time: it opens as a modal that floats over the
  // rows below rather than pushing them down. A full-screen backdrop under the
  // drawer blocks every other field and folds the drawer when clicked (anywhere
  // outside the drawer or its note). Collapsed rows show fine-print summaries of
  // the checked materials. See the matExpanded overlay in the grid below.
  const [matOpen, setMatOpen] = useState({});
  const [confirmProd, setConfirmProd] = useState(null); // { aid, pid }
  const [confirmArea, setConfirmArea] = useState(null); // area id
  const mainRef = useRef(null);
  const fileRef = useRef(null);
  const attRef = useRef(null);
  const areaRefs = useRef({});
  const typeRefs = useRef({});
  const qtyRefs = useRef({});
  const prodRefs = useRef({});
  const nameRef = useRef(null);
  const addAreaRef = useRef(null);
  const saveOkTimer = useRef(null);
  // Auto-version bookkeeping: { id, json } — the open customer's categories as
  // of open / last snapshot. dataRef mirrors state so the deselect effect and
  // sign-out handler compare against the latest edits, not a stale closure.
  const baselineRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const prevSelRef = useRef(null);

  // FLIP: slide the flooring-type labels (and product cards) to their new spots
  // when a render reorders them. Offset coords (not getBoundingClientRect) so
  // CSS transforms don't skew the distances; WAAPI so we don't clobber classes.
  // Chips measure relative to their card, otherwise a card that moves would
  // double-animate the chips inside it. A just-dropped card animates from where
  // the pointer released it (dropAnim) instead of from its old layout slot.
  const flipPos = useRef(new Map());
  const dropAnim = useRef(null);
  useLayoutEffect(() => {
    const prev = flipPos.current;
    const next = new Map();
    document.querySelectorAll("[data-flip]").forEach((el) => {
      const id = el.getAttribute("data-flip");
      const card = el.closest("[data-prod-card]");
      const base = card && card !== el ? { left: card.offsetLeft, top: card.offsetTop } : { left: 0, top: 0 };
      const pos = { left: el.offsetLeft - base.left, top: el.offsetTop - base.top };
      next.set(id, pos);
      if (el.dataset.dragging) return;
      const drop = dropAnim.current;
      if (drop && drop.id === id) {
        dropAnim.current = null;
        const r = el.getBoundingClientRect();
        el.animate([
          { transform: `translate(${drop.rect.left - r.left}px, ${drop.rect.top - r.top}px) scale(1.03)`, boxShadow: "0 14px 34px rgba(40,30,20,.22)" },
          { transform: "translate(0,0) scale(1)", boxShadow: "0 0 0 rgba(40,30,20,0)" },
        ], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
        return;
      }
      const old = prev.get(id);
      if (old) {
        const dx = old.left - pos.left, dy = old.top - pos.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0,0)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
    flipPos.current = next;
  });

  useEffect(() => {
    (async () => {
      try {
        // The legacy per-user blob is still read: to pick up any customers
        // awaiting migration, and as the seed fallback for the shared settings.
        const { data: row, error } = await supabase.from("app_data").select("data").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        // Customers and settings have both moved out of this blob (migrated
        // below / seeded into shared_settings), so drop them from the copy that
        // profile saves write back.
        appBlobRef.current = (({ customers, settings, ...rest }) => rest)(row?.data || {});
        setProfile(normProfile(row?.data?.profile));

        // Settings now live in one shared record every signed-in user reads and
        // writes (ADR 0002), no longer in per-user app_data.
        const settings = await loadSharedSettings(row?.data?.settings);

        // One-time migration: move any customers still embedded in the blob into
        // the customers table (and relocate their attachment files), then strip
        // them from the blob. Idempotent — safe to run on every load.
        const legacy = row?.data?.customers;
        if (Array.isArray(legacy) && legacy.length) {
          await migrateLegacyCustomers(legacy.map(normC));
        }

        const [projects, people, builders] = await Promise.all([loadProjects(), loadPeople(), loadBuilders()]);
        setData({ projects, people, builders, settings });
        // Best-effort: installs that haven't run supabase/stock.sql yet just
        // don't get the SKU picker.
        try { setStock(await loadStock()); } catch (x) { }
        // Best-effort: installs that haven't run supabase/todos.sql yet just
        // don't get the team to-do list.
        try { setTodos(await loadTodos()); } catch (x) { }
        // Best-effort: installs that haven't run supabase/pricebooks.sql yet
        // just don't get the price book library (registry affordances hide).
        try { setBooks(await loadBooks()); } catch (x) { }
      } catch (e) { ping("Could not load your data — check connection"); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Fetch every customer the current user may see (own + public), but LIGHT:
  // only the fields the list draws/searches/sorts, projected out of the jsonb
  // server-side. The heavy detail (categories/products/versions/attachments)
  // stays on the server until a customer is opened (see loadDetail).
  const loadProjects = async () => {
    const { data: rows, error } = await supabase.from("projects").select(LIST_SELECT);
    if (error) throw error;
    return (rows || []).map(lightRow);
  };
  // People (customers) and builders are small — load them whole. Best-effort:
  // an install that hasn't run supabase/migrate-hierarchy.sql yet just gets
  // empty lists (the projects list still works on its own).
  const loadPeople = async () => {
    try {
      const { data: rows, error } = await supabase.from("customers").select(PERSON_SELECT);
      if (error) throw error;
      return (rows || []).map(personRow);
    } catch (x) { return []; }
  };
  const loadBuilders = async () => {
    try {
      const { data: rows, error } = await supabase.from("builders").select("id, name");
      if (error) throw error;
      return (rows || []).map(builderRow);
    } catch (x) { return []; }
  };

  // Lazy-load one customer's full record on open, merging it into the light row.
  // Version metadata (never snapshots) loads alongside; snapshots are fetched
  // one at a time on restore.
  const loadDetail = async (id) => {
    const existing = data.projects.find((c) => c.id === id);
    if (!existing || existing._full) return;
    try {
      const [{ data: row, error }, { data: vRows, error: vErr }] = await Promise.all([
        supabase.from("projects").select("data").eq("id", id).maybeSingle(),
        supabase.from("versions").select("id, label, auto, saved_at").eq("customer_id", id).order("saved_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (vErr) throw vErr;
      const full = normC(row?.data || {});
      let versions = (vRows || []).map(vMeta);
      // Safety net for a client deployed before the schema migration ran: lift
      // any versions still embedded in this blob into the table (idempotent);
      // custData strips them from the blob on the next content write.
      if (full.versions.length) {
        try {
          await supabase.from("versions").upsert(full.versions.map((v) => ({
            id: v.id || uid(), customer_id: id, label: v.label || "Version", auto: false,
            saved_at: new Date(v.savedAt || Date.now()).toISOString(), snapshot: v.snapshot || [],
          })), { onConflict: "id", ignoreDuplicates: true });
          const have = new Set(versions.map((v) => v.id));
          versions = [...versions, ...full.versions.filter((v) => !have.has(v.id)).map((v) => vMeta({ id: v.id, label: v.label, auto: false, saved_at: v.savedAt ? new Date(v.savedAt).toISOString() : null }))].sort((a, b) => b.savedAt - a.savedAt);
        } catch (x) { /* best-effort */ }
      }
      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((c) => c.id === id
          ? { ...c, ...full, customerId: c.customerId, versions, id: c.id, createdAt: c.createdAt, _full: true }
          : c),
      }));
      baselineRef.current = { id, json: catSig(full.categories) };
    } catch (e) { ping("Could not open customer — check connection"); }
  };

  // Read the one shared settings record. If it is missing or empty (the seed
  // migration hasn't run yet), seed it from this user's former per-user settings
  // — falling back to built-in defaults — so the team starts from real numbers.
  const loadSharedSettings = async (fallbackRaw) => {
    const { data: row, error } = await supabase.from("shared_settings").select("data").eq("id", SHARED_SETTINGS_ID).maybeSingle();
    if (error) throw error;
    const hasRow = row?.data && Object.keys(row.data).length;
    const settings = normalizeSettings(hasRow ? row.data : fallbackRaw);
    // Persist when the stored record is missing, still pre-catalog, or lacks
    // any of the starter underlayments, so the backfilled catalog (with stable
    // ids) becomes the canonical shared copy.
    if (!hasRow || !row.data.catalog || !catalogHasSeedUnderlayments(row.data.catalog)) {
      try { await supabase.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(settings) }, { onConflict: "id" }); } catch (x) { /* best-effort seed */ }
    }
    return settings;
  };

  const loadStock = async () => {
    // select * so the app keeps working whether or not the disabled column
    // exists yet (pricebook-disabled.sql); a named select of a missing column
    // errors and would silently kill the SKU picker.
    const rows = await fetchAllRows(() => supabase.from("stock_items").select("*").order("sku"));
    return rows.map(normStockItem);
  };

  // Parse a freshly exported price book workbook in the browser and show what
  // an import would change — nothing is written until the preview is applied.
  const importPriceBook = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    (async () => {
      setImporting(true);
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) }));
        const { items, warnings } = parsePriceBook(sheets);
        if (!items.length) { ping("No stock items found in that file"); }
        else {
          const parsed = items.map((it) => ({ ...it, active: true }));
          setImportPreview({ parsed, diff: diffStock(stock, parsed), warnings, sync: syncCatalogPrices(settings.catalog, parsed) });
        }
      } catch (x) { ping("Could not read that file — is it the price book .xlsx?"); }
      setImporting(false);
    })();
  };

  // Upsert by SKU: new + changed items, plus active-off rows for items that
  // dropped out of the book (never deleted — old selections keep resolving).
  // Catalog products whose price the book pins get updated through the normal
  // settings write path.
  // Chunked upsert of a stock diff: new + changed active, dropped rows marked
  // active=false (never deleted). Shared by the workbook import and rollback.
  const upsertStock = async (diff) => {
    const upserts = [
      ...diff.added.map((it) => ({ sku: it.sku, active: true, data: stockData(it) })),
      ...diff.changed.map(({ item }) => ({ sku: item.sku, active: true, data: stockData(item) })),
      ...diff.missing.map((it) => ({ sku: it.sku, active: false, data: stockData(it) })),
    ];
    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await supabase.from("stock_items").upsert(upserts.slice(i, i + 200), { onConflict: "sku" });
      if (error) throw error;
    }
  };

  const applyImport = async () => {
    const { diff, sync } = importPreview;
    setImportPreview(null);
    try {
      await upsertStock(diff);
      const applied = appliedFromDiff(diff);
      await snapshotBookVersion(STOCK_BOOK_ID, applied, stockData);
      const ops = { ...(settings.ops || {}), lastImport: { at: Date.now(), by: profile.name || user.email || "", skus: applied.length } };
      setSettings(sync.changes.length ? { catalog: sync.catalog, ops } : { ops });
      setStock(await loadStock());
      flashSaved();
      ping(`Price book imported — ${diff.added.length} new, ${diff.changed.length} updated, ${diff.missing.length} retired`);
    } catch (x) { ping("Import failed — has supabase/stock.sql been run?"); }
  };

  // Roll the shop workbook back to a version snapshot: replay it through the
  // normal diffStock -> upsert flow (never a blind overwrite), snapshot a fresh
  // version so the rollback is the newest, and bump ops.lastImport so the
  // history list refreshes. No catalog price-sync — a rollback restores the
  // book's own rows, not catalog prices.
  const rollbackStock = async (diff) => {
    try {
      await upsertStock(diff);
      const applied = appliedFromDiff(diff);
      await snapshotBookVersion(STOCK_BOOK_ID, applied, stockData);
      const ops = { ...(settings.ops || {}), lastImport: { at: Date.now(), by: profile.name || user.email || "", skus: applied.length } };
      setSettings({ ops });
      setStock(await loadStock());
      flashSaved();
    } catch (x) { ping("Rollback failed"); }
  };

  // --- price book library (ADR 0009) -----------------------------------------
  //
  // Registry books (stock- and order-kind) live in price_books; their items in
  // price_book_items, one row per (book_id, sku). Same trust + no-delete rules
  // as stock_items. Writes go only through these paths.

  const normBook = (row) => ({
    id: row.id, kind: row.kind || "order", name: row.name || "",
    active: row.active !== false, data: row.data || {},
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  });

  const loadBooks = async () => {
    const { data: rows, error } = await supabase.from("price_books").select("id, kind, name, active, data, updated_at");
    if (error) throw error;
    return (rows || []).map(normBook);
  };

  // A book's items, loaded on demand (Settings browse). Not held in app state —
  // the caller keeps them while the book is open.
  const loadBookItems = async (bookId) => {
    const rows = await fetchAllRows(() => supabase.from("price_book_items").select("*").eq("book_id", bookId).order("sku"));
    return rows.map((r) => normBookItem(r, bookId));
  };

  const addBook = async ({ kind, name }) => {
    const id = uid();
    const row = { id, kind, name: name || "", active: true, data: {} };
    setBooks((bs) => [...bs, normBook(row)]);
    try { const { error } = await supabase.from("price_books").insert(row); if (error) throw error; flashSaved(); }
    catch (x) { ping("Couldn't create book — has supabase/pricebooks.sql been run?"); }
    return id;
  };

  // Column fields (name/active) and/or a merge into the data jsonb. Whole-record
  // upsert of that one row, last-write-wins like settings.
  const updateBook = async (id, { name, active, dataPatch } = {}) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const nextData = dataPatch ? { ...book.data, ...dataPatch } : book.data;
    setBooks((bs) => bs.map((b) => b.id === id ? { ...b, ...(name != null ? { name } : {}), ...(active != null ? { active } : {}), data: nextData } : b));
    const cols = {};
    if (name != null) cols.name = name;
    if (active != null) cols.active = active;
    if (dataPatch) cols.data = nextData;
    try { const { error } = await supabase.from("price_books").update(cols).eq("id", id); if (error) throw error; flashSaved(); }
    catch (x) { ping("Save failed"); }
  };

  // Permanently remove a registry book: its items, its import history, then the
  // book row (in that order — price_book_items has a FK to price_books). Unlike
  // every other price-book write this is a hard delete (ADR 0009 delete amendment). Saved
  // selections that referenced the book keep their snapshotted values — only the
  // live drift/freight chips for that book stop resolving. Needs the DELETE
  // policies from supabase/pricebook-delete.sql.
  const delBook = async (id) => {
    setBooks((bs) => bs.filter((b) => b.id !== id));
    try {
      let { error } = await supabase.from("price_book_items").delete().eq("book_id", id);
      if (error) throw error;
      ({ error } = await supabase.from("pricebook_versions").delete().eq("book_id", id));
      if (error) throw error;
      ({ error } = await supabase.from("price_books").delete().eq("id", id));
      if (error) throw error;
      flashSaved();
    } catch (x) { ping("Delete failed — has supabase/pricebook-delete.sql been run?"); }
  };

  // Apply a mapped-import diff: upsert added/changed items, mark missing SKUs
  // inactive (never delete), stamp the book's lastImport. opts.disableSkus (PR B)
  // are the SKUs the user ignored or superseded — they land disabled. Every
  // upsert row carries an explicit `disabled` so the batch's columns are uniform
  // for PostgREST: added take the ignore value; changed/missing preserve their
  // prior disabled unless newly ignored. Ignored SKUs in no bucket (unchanged
  // rows) are disabled through the PR A path.
  const applyBookImport = async (bookId, diff, opts = {}) => {
    const disable = new Set(opts.disableSkus || []);
    const off = (sku, prevDisabled) => (disable.has(sku) ? true : !!prevDisabled);
    const upserts = [
      ...diff.added.map((it) => ({ book_id: bookId, sku: it.sku, active: true, disabled: disable.has(it.sku), data: bookItemData(it) })),
      ...diff.changed.map(({ item, prev }) => ({ book_id: bookId, sku: item.sku, active: true, disabled: off(item.sku, prev?.disabled), data: bookItemData(item) })),
      ...diff.missing.map((it) => ({ book_id: bookId, sku: it.sku, active: false, disabled: off(it.sku, it.disabled), data: bookItemData(it) })),
    ];
    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await supabase.from("price_book_items").upsert(upserts.slice(i, i + 200), { onConflict: "book_id,sku" });
      if (error) throw error;
    }
    const inBuckets = new Set(upserts.map((u) => u.sku));
    const rest = [...disable].filter((s) => !inBuckets.has(s));
    if (rest.length) await setBookItemsDisabled(bookId, rest, true);
    // A disable-only apply (identical book, just toggling SKUs) must NOT reset
    // the book's last-import date/staleness or add an import-history version —
    // no vendor data actually landed. Only a real import stamps/snapshots.
    if (!upserts.length) { flashSaved(); return; }
    const li = { at: Date.now(), by: profile.name || user.email || "", count: diff.added.length + diff.changed.length };
    if (opts.superseded?.length) li.superseded = opts.superseded;
    if (disable.size) li.disabled = disable.size;
    await updateBook(bookId, { dataPatch: { lastImport: li } });
    await snapshotBookVersion(bookId, appliedFromDiff(diff), bookItemData);
  };

  // The active set an apply leaves the book in: added + changed + unchanged
  // (retired SKUs are excluded — they were just marked inactive). Both diff
  // shapes (diffBookItems / diffStock) match, so this serves stock and registry.
  const appliedFromDiff = (diff) => [...diff.added, ...diff.changed.map((c) => c.item), ...(diff.unchanged || [])];

  // Snapshot a book's applied active set as a pricebook_versions row (values as
  // applied — cost/price, never derived sell), then prune unpinned to newest 3.
  // Shared by the registry-book import and the stock-workbook import/rollback.
  // Best-effort: the items are already applied, so a version-write failure must
  // not surface as an import failure. `toData` strips the row's column-backed
  // fields (bookItemData for registry items, stockData for stock items).
  const snapshotBookVersion = async (bookId, appliedItems, toData) => {
    try {
      const snapshot = appliedItems.map((it) => ({ sku: it.sku, data: toData(it) }));
      const { error: ve } = await supabase.from("pricebook_versions").insert({ id: uid(), book_id: bookId, label: "", pinned: false, imported_by: profile.name || user.email || "", item_count: appliedItems.length, snapshot });
      if (ve) throw ve;
      const versions = await loadBookVersions(bookId);
      const drop = versions.filter((v) => !v.pinned).slice(BOOK_VERSION_KEEP).map((v) => v.id);
      if (drop.length) await supabase.from("pricebook_versions").delete().in("id", drop);
    } catch (x) { /* best-effort — the items are already applied */ }
  };

  // Import versions for a book, newest first (metadata only; the snapshot stays
  // on the server until a rollback needs it). Own table, mirrors the customer
  // versions split — never held in app state.
  const loadBookVersions = async (bookId) => {
    const { data: rows, error } = await supabase.from("pricebook_versions").select("id, book_id, label, pinned, imported_at, imported_by, item_count").eq("book_id", bookId).order("imported_at", { ascending: false });
    if (error) throw error;
    return (rows || []).map((r) => ({ id: r.id, bookId: r.book_id, label: r.label || "", pinned: !!r.pinned, importedAt: r.imported_at ? new Date(r.imported_at).getTime() : null, importedBy: r.imported_by || "", itemCount: r.item_count || 0 }));
  };

  const loadBookVersionSnapshot = async (versionId) => {
    const { data: row, error } = await supabase.from("pricebook_versions").select("snapshot").eq("id", versionId).single();
    if (error) throw error;
    return row?.snapshot || [];
  };

  // Toggle a version's keeper flag (the SQL's version UPDATE policy exists only
  // for pinned/label — the client never rewrites a snapshot).
  const pinBookVersion = async (versionId, pinned) => {
    const { error } = await supabase.from("pricebook_versions").update({ pinned }).eq("id", versionId);
    if (error) throw error;
  };

  // Single-row hand-edit of a book item (Settings inline edit). Writes the one
  // (book_id, sku) row's data jsonb, stamping editedBy/editedAt so the next
  // import's diff can warn the manual fix will be overwritten. Sanctioned path
  // — the item UPDATE RLS exists for exactly this; imports still only upsert.
  const updateBookItem = async (bookId, item) => {
    const data = { ...bookItemData(item), editedBy: profile.name || user.email || "", editedAt: Date.now() };
    const { error } = await supabase.from("price_book_items").update({ data }).eq("book_id", bookId).eq("sku", item.sku);
    if (error) { ping("Save failed"); throw error; }
    flashSaved();
    return data;
  };

  // Enable/disable book items (importer-upgrades spec, PR A): flips ONLY the
  // disabled column, keyed (book_id, sku). Import upserts never mention the
  // column, so the team's choice survives every reimport. Chunked like the
  // imports.
  const setBookItemsDisabled = async (bookId, skus, disabled) => {
    for (let i = 0; i < skus.length; i += 200) {
      const { error } = await supabase.from("price_book_items").update({ disabled }).eq("book_id", bookId).in("sku", skus.slice(i, i + 200));
      if (error) { ping("Save failed — has supabase/pricebook-disabled.sql been run?"); throw error; }
    }
    flashSaved();
  };

  const migrateLegacyCustomers = async (legacy) => {
    for (const c of legacy) {
      // Move attachment files from <user_id>/<file_id> to <customer_id>/<file_id>.
      for (const m of (c.attachments || [])) {
        try {
          const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(`${user.id}/${m.id}`);
          if (!blob) continue;
          await supabase.storage.from(ATT_BUCKET).upload(`${c.id}/${m.id}`, blob, { contentType: m.type, upsert: true });
          await supabase.storage.from(ATT_BUCKET).remove([`${user.id}/${m.id}`]);
        } catch (x) { /* best-effort */ }
      }
      const { ownerId, visibility, archived, customerId, ...rest } = c;
      // Late legacy-blob migration lands as an unassigned project (customer_id
      // null); the owner links it to a customer from the sidebar.
      await supabase.from("projects").upsert(
        { id: c.id, owner_id: user.id, data: rest, created_at: new Date(c.createdAt || Date.now()).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    // Drop the migrated array from the blob, keeping what still lives there
    // (the user's profile).
    await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" });
  };
  useEffect(() => { if (focusArea && areaRefs.current[focusArea]) { const el = areaRefs.current[focusArea]; el.focus(); el.select?.(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusArea(null); } }, [focusArea, data]);
  useEffect(() => { if (focusProd && typeRefs.current[focusProd]) { const el = typeRefs.current[focusProd]; el.focus(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusProd(null); } }, [focusProd, data]);
  useEffect(() => { if (focusQty && qtyRefs.current[focusQty]) { const el = qtyRefs.current[focusQty]; el.focus(); el.select?.(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusQty(null); } }, [focusQty, data]);
  useEffect(() => { if (focusProdBox && prodRefs.current[focusProdBox]) { const el = prodRefs.current[focusProdBox]; el.focus(); el.select?.(); setFocusProdBox(null); } }, [focusProdBox, data]);
  useEffect(() => { if (focusName && nameRef.current) { nameRef.current.focus(); nameRef.current.select?.(); const t = setTimeout(() => setFocusName(false), 1500); return () => clearTimeout(t); } }, [focusName]);
  useEffect(() => { const mq = window.matchMedia("(min-width: 768px)"); const on = () => setIsWide(mq.matches); on(); mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on); return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); }; }, []);

  // Server-side search (debounced): ask the backend which customers match and
  // merge any rows the client doesn't hold into the light list. The visible
  // filter stays a client-side substring test over loaded rows — instant while
  // typing, complete once the server responds — so search no longer depends on
  // every row having been loaded up front.
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        // Strip characters that would break PostgREST's or=() syntax.
        const pat = "%" + q.replace(/[%_,()"\\]/g, " ").trim() + "%";
        const ors = ["name", "address", "phone", "email"].map((f) => `data->>${f}.ilike.${pat}`).join(",");
        const { data: rows, error } = await supabase.from("projects").select(LIST_SELECT).or(ors);
        if (error) throw error;
        if (stale) return;
        const found = (rows || []).map(lightRow);
        setData((prev) => {
          const have = new Set(prev.projects.map((c) => c.id));
          const fresh = found.filter((r) => !have.has(r.id));
          return fresh.length ? { ...prev, projects: [...prev.projects, ...fresh] } : prev;
        });
      } catch (e) { /* loaded rows still cover the search */ }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [search]);

  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const flashSaved = () => { if (saveOkTimer.current) clearTimeout(saveOkTimer.current); setSaveOk(true); saveOkTimer.current = setTimeout(() => setSaveOk(false), 2000); };

  // Strip the in-memory-only fields before writing to jsonb (versions live in
  // their own table; _full is load state; updatedAt mirrors the updated_at
  // column; ownerId/visibility/archived are legacy fields old records may carry).
  // customerId is the projects.customer_id column, not part of the data blob.
  const custData = ({ ownerId, visibility, archived, versions, _full, updatedAt, customerId, ...rest }) => rest;

  // Settings live in one shared record (ADR 0002) — last-write-wins across the
  // whole team, the same as a Public customer's data.
  const setSettings = (patch) => {
    const next = { ...data, settings: withDerived({ ...data.settings, ...patch }) };
    setData(next);
    (async () => { try { const { error } = await supabase.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(next.settings) }, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const saveProfile = (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    appBlobRef.current = { ...appBlobRef.current, profile: next };
    (async () => { try { const { error } = await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Couldn't save your info"); } })();
  };
  const settings = data.settings;
  const sel = data.projects.find((c) => c.id === selId) || null;
  const selCust = data.people.find((c) => c.id === selCustId) || null;
  const builderNameOf = (id) => data.builders.find((b) => b.id === id)?.name || "";
  const projectsOf = (customerId) => data.projects.filter((p) => p.customerId === customerId);
  const fmtAgo = (ts) => {
    if (!ts) return "";
    const d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return "today";
    if (d === 1) return "yesterday";
    if (d < 7) return `${d} days ago`;
    if (d < 14) return "1 week ago";
    if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
    if (d < 60) return "1 month ago";
    if (d < 365) return `${Math.floor(d / 30)} months ago`;
    return new Date(ts).toLocaleDateString();
  };

  // Keep one trailing "adder" row (a fresh search row) at the end of every area
  // of the open project — the inline New-row affordance. An adder is a blank row
  // not yet handed to manual entry (same `searchMode` test the grid uses), so a
  // row that's blank-but-manual (e.g. a type was picked) still needs a new adder
  // after it. Local-only: the blank is ephemeral scaffolding — it persists to
  // the DB on the next real edit and is stripped from the estimate/exports
  // (rowBlank) and the version baseline (catSig), so it never shows up as data.
  // The guard reaches a fixed point (a fresh adder satisfies it), so no loop.
  const isAdderRow = (p) => rowBlank(p) && !manualRows[p.id];
  useEffect(() => {
    if (!sel || !sel._full) return;
    const needs = sel.categories.some((a) => !a.products.length || !isAdderRow(a.products[a.products.length - 1]));
    if (!needs) return;
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((c) => c.id !== sel.id ? c : {
        ...c,
        categories: c.categories.map((a) => (a.products.length && isAdderRow(a.products[a.products.length - 1])) ? a : { ...a, products: [...a.products, newProduct()] }),
      }),
    }));
  }, [sel?.id, sel?._full, sel?.categories, manualRows]);

  // Every project-content mutation goes through here: optimistic state update +
  // an UPDATE of that one row's data blob. customer_id is a column, moved via
  // linkProject — never through here.
  const updateProject = (id, patch) => {
    const next = { ...data, projects: data.projects.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) };
    setData(next);
    const cust = next.projects.find((c) => c.id === id);
    (async () => { try { const { error } = await supabase.from("projects").update({ data: custData(cust) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };

  const addProject = (customerId = null, name = "New Project") => {
    const c = { ...newProject(customerId, name), salesperson: { name: profile.name || "", phone: profile.phone || "", email: profile.email || "" }, updatedAt: Date.now(), _full: true };
    setData((prev) => ({ ...prev, projects: [c, ...prev.projects] }));
    baselineRef.current = { id: c.id, json: catSig(c.categories) };
    setSelId(c.id); setSelCustId(customerId); setSidebarOpen(false); setFocusName(true);
    (async () => { try { const { error } = await supabase.from("projects").insert({ id: c.id, owner_id: user.id, customer_id: customerId, data: custData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
    return c;
  };
  const pickProject = (id) => { const p = data.projects.find((c) => c.id === id); setSelId(id); if (p) setSelCustId(p.customerId || null); setSidebarOpen(false); loadDetail(id); };
  const delProject = async (id) => {
    const cust = data.projects.find((c) => c.id === id);
    if (cust) { for (const m of (cust.attachments || [])) { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(id, m.id)]); } catch (x) { } } }
    setData((prev) => ({ ...prev, projects: prev.projects.filter((c) => c.id !== id) }));
    if (selId === id) setSelId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };
  // Move a project to a different customer (or unassign with null).
  const linkProject = (id, customerId) => {
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === id ? { ...c, customerId: customerId || null, updatedAt: Date.now() } : c) }));
    (async () => { try { const { error } = await supabase.from("projects").update({ customer_id: customerId || null }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };

  // --- Customers (people): the person/account that owns projects (ADR 0005). ---
  const addPerson = (name = "") => {
    const c = { ...newPerson(name), updatedAt: Date.now() };
    setData((prev) => ({ ...prev, people: [c, ...prev.people] }));
    setSidebarOpen(false);
    (async () => { try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: null, data: personData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/migrate-hierarchy.sql?"); } })();
    return c;
  };
  const updatePerson = (id, patch) => {
    // Functional update: setting a builder right after adding one (BuilderCombo)
    // must not clobber the freshly-added builder from a stale closure.
    setData((prev) => ({ ...prev, people: prev.people.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) }));
    const merged = { ...(data.people.find((x) => x.id === id) || {}), ...patch };
    const upd = {};
    if ("builderId" in patch) upd.builder_id = patch.builderId || null;
    if (Object.keys(patch).some((k) => k !== "builderId")) upd.data = personData(merged);
    (async () => { try { const { error } = await supabase.from("customers").update(upd).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const delPerson = async (id) => {
    // Projects survive — the FK nulls their customer_id (on delete set null), so
    // they resurface under "Unassigned" rather than being deleted.
    setData((prev) => ({ ...prev, people: prev.people.filter((c) => c.id !== id), projects: prev.projects.map((p) => p.customerId === id ? { ...p, customerId: null } : p) }));
    if (selCustId === id) setSelCustId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("customers").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // --- Builders: a canonical name list customers link to by id. ---
  // Create a new builder and assign it to a customer in one flow. The builder
  // INSERT is awaited before the customer's builder_id UPDATE so the FK
  // (customers.builder_id -> builders.id) is always satisfied.
  const addBuilderFor = async (personId, name) => {
    const b = newBuilder(String(name || "").trim());
    setData((prev) => ({ ...prev, builders: [...prev.builders, b], people: prev.people.map((c) => c.id === personId ? { ...c, builderId: b.id, updatedAt: Date.now() } : c) }));
    try {
      const { error: be } = await supabase.from("builders").insert({ id: b.id, owner_id: user.id, name: b.name });
      if (be) throw be;
      const { error: ce } = await supabase.from("customers").update({ builder_id: b.id }).eq("id", personId);
      if (ce) throw ce;
      flashSaved();
    } catch (e) { ping("Save failed — run supabase/migrate-hierarchy.sql?"); }
    return b;
  };
  const addArea = () => { const a = newArea(); updateProject(sel.id, { categories: [...sel.categories, a] }); setFocusArea(a.id); };
  const tabTo = (ref) => (e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); ref.current?.focus(); ref.current?.select?.(); } };
  const updArea = (aid, patch) => updateProject(sel.id, { categories: sel.categories.map((a) => a.id === aid ? { ...a, ...patch } : a) });
  const delArea = (aid) => updateProject(sel.id, { categories: sel.categories.filter((a) => a.id !== aid) });
  const addProduct = (aid) => { const a = sel.categories.find((x) => x.id === aid); const np = newProduct(); updArea(aid, { products: [...a.products, np] }); setFocusProd(np.id); };
  const updProduct = (aid, pid, patch) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.map((p) => p.id === pid ? { ...p, ...patch } : p) }); };
  const orderBooks = useMemo(() => books.filter((b) => b.kind === "order" && b.active), [books]);
  const bookName = (id) => books.find((b) => b.id === id)?.name || "special order";
  // Prefer the fuzzy RPC (supabase/pricebook-fuzzy.sql); flips false for the
  // session the first time the function is absent, so the search keeps working
  // before the migration is run — just via the exact-substring ILIKE fallback
  // below (still synonym-aware, just no typo tolerance).
  const fuzzyRpc = useRef(true);
  // Debounced server-side search across every active order book (§6). Order
  // items aren't eagerly loaded (a vendor book runs to thousands of rows), so
  // the selection-row pickers query price_book_items on demand, price each hit
  // by its book's markup, and stream the results in behind the instant stock
  // matches. null with no order books — the pickers behave exactly as before,
  // stock-only.
  const searchOrder = useMemo(() => {
    if (!orderBooks.length) return null;
    const byId = new Map(orderBooks.map((b) => [b.id, b]));
    const ids = orderBooks.map((b) => b.id);
    const price = (rows) => (rows || []).map((r) => pricedItem(normBookItem(r, r.book_id), byId.get(r.book_id)?.data?.markups));
    const base = () => supabase.from("price_book_items").select("*").in("book_id", ids).eq("active", true).limit(SKU_SHOW * 2);
    // Every group must match (AND across the typed words), matching searchStock's
    // word-by-word rule; within a group any synonym alternate matches (OR).
    // `size` isn't in the generated search_text column, so the ILIKE fallback ORs
    // it in explicitly — that keeps size searchable ("12x24 white") without a
    // SQL re-run (search_text already covers the rest, index-backed).
    const fields = ["sku", "data->>description", "data->>product", "data->>brand", "data->>mfg", "data->>color", "data->>size"];
    return async (q) => {
      const words = q.replace(/[%_,()"\\]/g, " ").trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      const groups = words.map(expand); // Option D: each word -> [itself, ...synonyms]
      if (fuzzyRpc.current) {
        const { data: rows, error } = await supabase.rpc("search_price_book_items", { p_book_ids: ids, p_groups: groups, p_threshold: 0.3, p_limit: SKU_SHOW * 2 });
        // The client-side disabled guard (both paths) also covers installs
        // where the RPC/column migrations haven't been re-run yet.
        if (!error) return orderFloorFirst(price(rows).filter((it) => !it.disabled), q);
        // PGRST202 / 42883 = undefined_function: the fuzzy migration isn't run yet.
        if (error.code !== "PGRST202" && error.code !== "42883") throw error;
        fuzzyRpc.current = false;
      }
      let query = base();
      for (const grp of groups) query = query.or(grp.flatMap((alt) => fields.map((f) => `${f}.ilike.%${alt}%`)).join(","));
      const { data: rows, error } = await query;
      if (error) throw error;
      return orderFloorFirst(price(rows).filter((it) => !it.disabled), q);
    };
  }, [orderBooks]);
  // The distinct (book, SKU) pairs the open project's order rows reference, as
  // a stable JSON signature so the fetch below fires only when that set changes
  // (sel is a fresh object on every edit, not a useful dependency by itself).
  const orderRowKeys = useMemo(() => {
    const seen = new Set();
    const pairs = [];
    for (const a of sel?.categories || []) for (const p of a.products || []) {
      if (!p.bookId || !p.sku) continue;
      const k = JSON.stringify([p.bookId, p.sku]);
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push([p.bookId, p.sku]);
    }
    pairs.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    return JSON.stringify(pairs);
  }, [sel]);
  // Fetch just those SKUs (one query per book, only keys not resolved yet), so
  // the row drift chip can compare against today's cost x markup without ever
  // loading a whole vendor book. Missing SKUs resolve to null and stay cached.
  useEffect(() => {
    const pairs = JSON.parse(orderRowKeys || "[]");
    const want = new Map();
    for (const [bookId, sku] of pairs) {
      if (orderItems[bookId] && sku in orderItems[bookId]) continue;
      if (!want.has(bookId)) want.set(bookId, new Set());
      want.get(bookId).add(sku);
    }
    if (!want.size) return;
    let stale = false;
    (async () => {
      const adds = {};
      for (const [bookId, skus] of want) {
        try {
          const { data: rows, error } = await supabase.from("price_book_items").select("sku, active, data, updated_at").eq("book_id", bookId).in("sku", [...skus]);
          if (error) throw error;
          const m = { ...(adds[bookId] || {}) };
          for (const sku of skus) m[sku] = null;
          for (const r of rows || []) m[r.sku] = normBookItem(r, bookId);
          adds[bookId] = m;
        } catch (x) { /* leave unresolved; retried when the key set next changes */ }
      }
      if (!stale && Object.keys(adds).length) setOrderItems((prev) => {
        const next = { ...prev };
        for (const bid of Object.keys(adds)) next[bid] = { ...(next[bid] || {}), ...adds[bid] };
        return next;
      });
    })();
    return () => { stale = true; };
  }, [orderRowKeys]);
  // Pick from the SKU dropdown: the first item fills the anchor row, each
  // further item becomes its own new product row right below it. A Laticrete
  // pigment (Spectralock Part C, Permacolor Color Kit) drags its default base
  // unit along as an extra row, since neither is usable without the other.
  // The snapshot patch for a picked item: a special-order item (bookId set)
  // goes through orderPatch — which prices it by its book's markup and carries
  // the order provenance (cost/markupPct/freight/tier) — while a stock item
  // keeps the stock path. One sanctioned pick path for both spaces (ADR 0009).
  const patchFor = (it, p) => it.bookId ? orderPatch(it, books.find((b) => b.id === it.bookId), p) : stockPatch(it, p);
  const addStockProducts = (aid, pid, items) => {
    if (!items.length) return;
    // Only stock items carry a companion base unit (Laticrete pigment → base).
    const expanded = items.flatMap((it) => { const base = it.bookId ? null : stockCompanionBase(it, stock); return base ? [it, base] : [it]; });
    const a = sel.categories.find((x) => x.id === aid);
    const products = a.products.flatMap((p) => p.id !== pid ? [p] : [
      { ...p, ...patchFor(expanded[0], p) },
      ...expanded.slice(1).map((it) => { const np = newProduct(); return { ...np, ...patchFor(it, np) }; }),
    ]);
    updArea(aid, { products });
  };
  const delProduct = (aid, pid) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.filter((p) => p.id !== pid) }); };
  const moveProduct = (fromAid, pid, toAid, toIndex) => {
    const p = sel.categories.find((x) => x.id === fromAid)?.products.find((x) => x.id === pid);
    if (!p) return;
    updateProject(sel.id, { categories: sel.categories.map((a) => {
      if (a.id !== fromAid && a.id !== toAid) return a;
      let products = a.id === fromAid ? a.products.filter((x) => x.id !== pid) : a.products;
      if (a.id === toAid) { products = [...products]; products.splice(toIndex, 0, p); }
      return { ...a, products };
    }) });
  };

  // Pointer-driven drag of a product card (mouse + touch via pointer events).
  // A short hold arms the drag, so brushing the handle doesn't yank the card;
  // lifting or slipping more than a few pixels during the hold cancels it.
  // The grabbed card pops out and tracks the pointer via CSS `translate`; drop
  // targets are hit-tested with elementFromPoint (the card is pointer-events:
  // none while held). Data is written once, on drop, through moveProduct.
  const startDrag = (e, aid, p, pi) => {
    if (e.button != null && e.button !== 0) return;
    const node = e.currentTarget.closest("[data-prod-card]");
    const main = mainRef.current;
    if (!node || !main) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const last = { ...start };
    const abort = () => { clearTimeout(timer); window.removeEventListener("pointermove", onHoldMove); window.removeEventListener("pointerup", abort); window.removeEventListener("pointercancel", abort); };
    const onHoldMove = (ev) => { last.x = ev.clientX; last.y = ev.clientY; if (Math.hypot(last.x - start.x, last.y - start.y) > 6) abort(); };
    const timer = setTimeout(() => { abort(); beginDrag(node, main, last.x, last.y, aid, p, pi); }, 220);
    window.addEventListener("pointermove", onHoldMove);
    window.addEventListener("pointerup", abort);
    window.addEventListener("pointercancel", abort);
  };
  const beginDrag = (node, main, startX, startY, aid, p, pi) => {
    const d = { startX, startY, lastX: startX, lastY: startY, startScroll: main.scrollTop, to: null, raf: 0 };
    node.dataset.dragging = "1";
    Object.assign(node.style, { position: "relative", zIndex: 50, pointerEvents: "none", transition: "scale .18s ease, rotate .18s ease, box-shadow .18s ease", scale: "1.03", rotate: "0.6deg", boxShadow: "0 0 0 1px rgba(40,30,20,.10), 0 6px 14px rgba(40,30,20,.16), 0 18px 44px rgba(40,30,20,.28)", borderRadius: "8px", overflow: "hidden", willChange: "translate" });
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    // Add the scroll delta so the card stays glued to the pointer while the
    // main pane auto-scrolls underneath it.
    const applyPos = () => { node.style.translate = `${d.lastX - d.startX}px ${d.lastY - d.startY + (main.scrollTop - d.startScroll)}px`; };
    const setTo = (to) => {
      if (!to && !d.to) return;
      if (to && d.to && to.aid === d.to.aid && to.index === d.to.index) return;
      d.to = to;
      setDrag((prev) => (prev ? { ...prev, to } : prev));
    };
    const hitTest = () => {
      const el = document.elementFromPoint(d.lastX, d.lastY);
      const areaEl = el && el.closest ? el.closest("[data-area-drop]") : null;
      const list = areaEl && areaEl.querySelector("[data-prod-list]");
      if (!list) return setTo(null);
      const taid = areaEl.getAttribute("data-area-drop");
      const cards = [...list.querySelectorAll("[data-prod-card]")].filter((c) => c !== node);
      let index = 0;
      for (const c of cards) { const r = c.getBoundingClientRect(); if (d.lastY > r.top + r.height / 2) index++; }
      // Dropping back where it came from is a no-op — show no target.
      if (taid === aid && index === pi) return setTo(null);
      const lr = list.getBoundingClientRect();
      const y = cards.length === 0 ? 0 : index < cards.length ? cards[index].getBoundingClientRect().top - lr.top - 9 : cards[cards.length - 1].getBoundingClientRect().bottom - lr.top + 3;
      setTo({ aid: taid, index, y });
    };
    const onMove = (ev) => { d.lastX = ev.clientX; d.lastY = ev.clientY; applyPos(); hitTest(); };
    const loop = () => {
      const r = main.getBoundingClientRect(); const zone = 70; let dy = 0;
      if (d.lastY < r.top + zone) dy = -Math.min(18, (r.top + zone - d.lastY) / 3);
      else if (d.lastY > r.bottom - zone) dy = Math.min(18, (d.lastY - (r.bottom - zone)) / 3);
      if (dy) { main.scrollTop += dy; applyPos(); hitTest(); }
      d.raf = requestAnimationFrame(loop);
    };
    d.raf = requestAnimationFrame(loop);
    const finish = (commit) => {
      cancelAnimationFrame(d.raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const rect = node.getBoundingClientRect();
      delete node.dataset.dragging;
      Object.assign(node.style, { position: "", zIndex: "", pointerEvents: "", transition: "", scale: "", rotate: "", boxShadow: "", borderRadius: "", overflow: "", willChange: "", translate: "" });
      dropAnim.current = { id: p.id, rect };
      if (commit && d.to) moveProduct(aid, p.id, d.to.aid, d.to.index);
      setDrag(null);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === "Escape") finish(false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    setDrag({ pid: p.id, fromAid: aid, to: null });
  };

  const attPath = (custId, fileId) => `${custId}/${fileId}`;
  const addAttachment = async (e) => { const f = e.target.files?.[0]; if (!f) return; const id = uid(); try { const { error } = await supabase.storage.from(ATT_BUCKET).upload(attPath(sel.id, id), f, { contentType: f.type, upsert: true }); if (error) throw error; updateProject(sel.id, { attachments: [...(sel.attachments || []), { id, name: f.name, type: f.type, size: f.size }] }); ping("Attachment added"); } catch (x) { ping("Upload failed — file may be too large"); } e.target.value = ""; };
  const openAttachment = async (m) => { try { const { data: blob, error } = await supabase.storage.from(ATT_BUCKET).download(attPath(sel.id, m.id)); if (error) throw error; const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = m.name; a.click(); URL.revokeObjectURL(u); } catch (x) { ping("Could not load attachment"); } };
  const delAttachment = async (m) => { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(sel.id, m.id)]); } catch (x) { } updateProject(sel.id, { attachments: (sel.attachments || []).filter((x) => x.id !== m.id) }); };

  // Versions are their own rows (issue 003) — saving/deleting one never touches
  // the customer's data blob. In memory a customer carries version metadata
  // only; the snapshot is fetched when a restore needs it.
  const insertVersion = async (custId, label, auto, categories) => {
    const v = { id: uid(), label, auto, savedAt: Date.now() };
    const { error } = await supabase.from("versions").insert({ id: v.id, customer_id: custId, label, auto, saved_at: new Date(v.savedAt).toISOString(), snapshot: categories });
    if (error) throw error;
    return v;
  };
  const namedCount = (c) => (c.versions || []).filter((v) => !v.auto).length;
  const startVersionName = () => { setVersionName(`Version ${namedCount(sel) + 1}`); setNamingVersion(true); };
  const confirmVersion = async () => {
    const label = versionName.trim() || `Version ${namedCount(sel) + 1}`;
    const cust = sel;
    setNamingVersion(false); setVersionName("");
    try {
      const v = await insertVersion(cust.id, label, false, cust.categories);
      setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === cust.id ? { ...c, versions: [v, ...(c.versions || [])] } : c) }));
      baselineRef.current = { id: cust.id, json: catSig(cust.categories) };
      flashSaved(); ping("Version saved");
    } catch (e) { ping("Save failed — check connection"); }
  };
  const loadVersion = async (v) => {
    try {
      const { data: row, error } = await supabase.from("versions").select("snapshot").eq("id", v.id).maybeSingle();
      if (error || !row) throw error || new Error("missing");
      updateProject(sel.id, { categories: (Array.isArray(row.snapshot) ? row.snapshot : []).map(normA) });
      setShowVersions(false); ping("Version loaded");
    } catch (e) { ping("Could not load version — check connection"); }
  };
  const delVersion = async (vid) => {
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === sel.id ? { ...c, versions: (c.versions || []).filter((v) => v.id !== vid) } : c) }));
    try { const { error } = await supabase.from("versions").delete().eq("id", vid); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // The safety net: when a work session on a customer ends (they get deselected,
  // or the user signs out) and the selections changed since open / last
  // snapshot, save an automatic version. Autos beyond the newest AUTO_KEEP are
  // pruned; named versions are never touched. Baseline advances only on a
  // successful save so a failed attempt is retried at the next deselect.
  const autoSnapshot = async (id) => {
    const c = dataRef.current.projects.find((x) => x.id === id);
    const base = baselineRef.current;
    if (!c || !c._full || !base || base.id !== id) return;
    const json = catSig(c.categories);
    if (json === base.json) return;
    const label = "Auto — " + new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    try {
      const v = await insertVersion(id, label, true, c.categories);
      baselineRef.current = { id, json };
      const drop = [v, ...(c.versions || []).filter((x) => x.auto)].sort((a, b) => b.savedAt - a.savedAt).slice(AUTO_KEEP).map((x) => x.id);
      setData((prev) => ({ ...prev, projects: prev.projects.map((x) => x.id === id ? { ...x, versions: [v, ...(x.versions || [])].filter((vv) => !drop.includes(vv.id)) } : x) }));
      if (drop.length) await supabase.from("versions").delete().in("id", drop);
    } catch (e) { /* best-effort — the live data is already saved */ }
  };
  useEffect(() => {
    const prev = prevSelRef.current;
    prevSelRef.current = selId;
    if (prev && prev !== selId) autoSnapshot(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);
  const handleSignOut = async () => { await autoSnapshot(selId); onSignOut(); };

  // Team to-do / issue list (issue 006): every item is its own shared row.
  // Open items order by `position` (smaller = higher); a drag renumbers all
  // open items 0..n-1 and writes them in one upsert. Done items keep their row
  // and sort by completion time instead.
  const todoFromRow = (r) => ({ id: r.id, position: r.position ?? 0, text: r.data?.text || "", done: !!r.data?.done, doneAt: r.data?.doneAt || null, createdBy: r.data?.createdBy || "", createdAt: r.data?.createdAt || null });
  const todoData = (t) => ({ text: t.text, done: t.done, doneAt: t.doneAt, createdBy: t.createdBy, createdAt: t.createdAt });
  const loadTodos = async () => {
    const { data: rows, error } = await supabase.from("todos").select("id, position, data").order("position");
    if (error) throw error;
    return (rows || []).map(todoFromRow);
  };
  const openTodos = () => {
    setShowTodos(true); setSidebarOpen(false);
    // Refresh so the list shows what teammates added since load.
    loadTodos().then(setTodos).catch(() => { });
  };
  const addTodo = (text) => {
    const top = Math.min(0, ...todos.filter((t) => !t.done).map((t) => t.position));
    const t = { id: uid(), position: top - 1, text, done: false, doneAt: null, createdBy: profile.name || user.email || "", createdAt: Date.now() };
    setTodos((prev) => [t, ...prev]);
    (async () => { try { const { error } = await supabase.from("todos").insert({ id: t.id, position: t.position, data: todoData(t) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/todos.sql?"); } })();
  };
  const updateTodo = (id, patch) => {
    const next = todos.map((t) => t.id === id ? { ...t, ...patch } : t);
    setTodos(next);
    const t = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("todos").update({ position: t.position, data: todoData(t) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const toggleTodo = (id) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    // Reopening puts the item back on top so it gets looked at again.
    updateTodo(id, t.done
      ? { done: false, doneAt: null, position: Math.min(0, ...todos.filter((x) => !x.done).map((x) => x.position)) - 1 }
      : { done: true, doneAt: Date.now() });
  };
  const delTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    (async () => { try { const { error } = await supabase.from("todos").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const clearDoneTodos = () => {
    const ids = todos.filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    setTodos((prev) => prev.filter((t) => !t.done));
    (async () => { try { const { error } = await supabase.from("todos").delete().in("id", ids); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // `from`/`to` index into the open list; `to` counts positions with the moved
  // item already lifted out (same convention as moveProduct).
  const reorderTodos = (from, to) => {
    const open = todos.filter((t) => !t.done).sort((a, b) => a.position - b.position);
    const [moved] = open.splice(from, 1);
    if (!moved) return;
    open.splice(to, 0, moved);
    const pos = new Map(open.map((t, i) => [t.id, i]));
    const next = todos.map((t) => pos.has(t.id) ? { ...t, position: pos.get(t.id) } : t);
    setTodos(next);
    const rows = next.filter((t) => pos.has(t.id)).map((t) => ({ id: t.id, position: t.position, data: todoData(t) }));
    (async () => { try { const { error } = await supabase.from("todos").upsert(rows, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };

  const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const exportBackup = async () => {
    // Pull every full project + all people + builders. Versions come from their
    // own table and are re-embedded per project (the file keeps the pre-table
    // snapshot shape). Format v2 uses projects/people/builders; a v1 file (just
    // `customers`) still restores — see importBackup.
    let projects, people, builders;
    try {
      const [{ data: rows, error }, { data: vRows, error: vErr }, { data: pplRows }, { data: bRows }] = await Promise.all([
        supabase.from("projects").select("id, customer_id, data, created_at"),
        supabase.from("versions").select("id, customer_id, label, auto, saved_at, snapshot"),
        supabase.from("customers").select("id, builder_id, data, created_at"),
        supabase.from("builders").select("id, name"),
      ]);
      if (error) throw error;
      if (vErr) throw vErr;
      const byCust = {};
      (vRows || []).forEach((r) => { (byCust[r.customer_id] = byCust[r.customer_id] || []).push({ id: r.id, label: r.label, auto: !!r.auto, savedAt: r.saved_at ? new Date(r.saved_at).getTime() : Date.now(), snapshot: r.snapshot || [] }); });
      projects = (rows || []).map((r) => {
        const c = { ...normC(r.data || {}), id: r.id, customerId: r.customer_id ?? null };
        const table = (byCust[r.id] || []).sort((a, b) => b.savedAt - a.savedAt);
        return { ...c, versions: table.length ? table : c.versions };
      });
      people = (pplRows || []).map((r) => ({ id: r.id, builderId: r.builder_id ?? null, ...(r.data || {}), createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now() }));
      builders = (bRows || []).map((r) => ({ id: r.id, name: r.name || "" }));
    } catch (e) { ping("Backup failed — check connection"); return; }
    const attachments = {};
    for (const c of projects) for (const m of (c.attachments || [])) { try { const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(attPath(c.id, m.id)); if (blob) attachments[m.id] = await blobToDataURL(blob); } catch (x) { } }
    dl(new Blob([JSON.stringify({ version: 2, builders, people, projects, settings: data.settings, attachments }, null, 2)], { type: "application/json" }), `kiln_backup_${new Date().toISOString().slice(0, 10)}.json`);
    setSettings({ ops: { ...(settings.ops || {}), lastBackup: { at: Date.now(), by: profile.name || user.email || "" } } });
  };
  const importBackup = (e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try {
    const p = JSON.parse(fr.result);
    // Restore with fresh ids so nothing collides. Builders first, then people
    // (remap builderId), then projects (remap customerId). A v1 backup (its
    // projects under `customers`, no people/builders) restores its jobs as
    // unassigned projects.
    const bMap = {}, newBuilders = [];
    for (const raw of (p.builders || [])) {
      const b = newBuilder(raw.name || ""); bMap[raw.id] = b.id; newBuilders.push(b);
      try { await supabase.from("builders").insert({ id: b.id, owner_id: user.id, name: b.name }); } catch (x) { }
    }
    const cMap = {}, newPeople = [];
    for (const raw of (p.people || [])) {
      const c = { ...newPerson(raw.name || ""), phone: raw.phone || "", email: raw.email || "", address: raw.address || "", notes: raw.notes || "", builderId: raw.builderId ? (bMap[raw.builderId] || null) : null, updatedAt: Date.now() };
      cMap[raw.id] = c.id; newPeople.push(c);
      try { await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: c.builderId, data: personData(c), created_at: new Date(c.createdAt).toISOString() }); } catch (x) { }
    }
    const restored = [];
    for (const raw of (p.projects || p.customers || [])) {
      const c = { ...normC(raw), id: uid(), customerId: raw.customerId ? (cMap[raw.customerId] || null) : null, updatedAt: Date.now(), _full: true };
      const idMap = {};
      c.attachments = (c.attachments || []).map((m) => { const nid = uid(); idMap[m.id] = nid; return { ...m, id: nid }; });
      try { const { error } = await supabase.from("projects").insert({ id: c.id, owner_id: user.id, customer_id: c.customerId, data: custData(c), created_at: new Date(c.createdAt || Date.now()).toISOString() }); if (error) throw error; } catch (x) { continue; }
      const vRows = (c.versions || []).map((v) => ({ id: uid(), customer_id: c.id, label: v.label || "Version", auto: !!v.auto, saved_at: new Date(v.savedAt || Date.now()).toISOString(), snapshot: v.snapshot || [] }));
      if (vRows.length) { try { const { error } = await supabase.from("versions").insert(vRows); if (error) throw error; } catch (x) { } }
      c.versions = vRows.map((r) => vMeta(r));
      for (const m of c.attachments) { const val = p.attachments?.[Object.keys(idMap).find((k) => idMap[k] === m.id)]; if (!val) continue; try { await supabase.storage.from(ATT_BUCKET).upload(attPath(c.id, m.id), dataURLToBlob(val), { upsert: true }); } catch (x) { } }
      restored.push(c);
    }
    if (p.settings) setSettings(serializeSettings(normalizeSettings(p.settings)));
    setData((prev) => ({ ...prev, builders: [...prev.builders, ...newBuilders], people: [...newPeople, ...prev.people], projects: [...restored, ...prev.projects] }));
    ping("Backup restored");
  } catch (x) { ping("Invalid file"); } }; fr.readAsText(f); e.target.value = ""; };

  let totalSqft = 0, orderedSqft = 0, flooringPrice = 0, groutCost = 0, caulkCost = 0, mortarCost = 0, underlayCost = 0, miscCost = 0; const gAgg = {}, mAgg = {}, uAgg = {}, cAgg = {};
  (sel?.categories || []).forEach((a) => a.products.forEach((p) => { if (p.type === "misc") { miscCost += num(p.priceSqft) * miscQty(p); } else if (p.qtyType === "sqft") { const sf = num(p.qty); totalSqft += sf; const C = getCarton(p, settings); orderedSqft += C ? C.order * C.sf : sf; flooringPrice += (C ? C.order * C.sf : sf) * num(p.priceSqft); } const G = getGrout(p, settings); if (G) { groutCost += G.order * G.price; const k = G.product + "||" + (G.color || "—"); if (!gAgg[k]) gAgg[k] = { product: G.product, color: G.color || "—", exact: 0 }; Object.assign(gAgg[k], { unit: G.unit, price: G.price, pending: false, colorSku: gAgg[k].colorSku || p.grout.sku || "" }); gAgg[k].exact += G.exact; } else if (p.type === "tile" && p.grout?.checked) { const k = p.grout.product + "||" + (p.grout.color || "—"); if (!gAgg[k]) gAgg[k] = { product: p.grout.product, color: p.grout.color || "—", colorSku: p.grout.sku || "", unit: settings.grouts[p.grout.product]?.unit || "units", price: num(settings.grouts[p.grout.product]?.price), exact: 0, pending: true }; } if (p.type === "tile" && p.grout?.checked) { const ck = num(p.grout.caulk); if (ck > 0) { caulkCost += ck * num(p.grout.caulkPrice); const k = p.grout.product + "||" + (p.grout.color || "—"); if (!cAgg[k]) cAgg[k] = { product: p.grout.product, color: p.grout.color || "—", sku: "", unit: "tubes", price: 0, exact: 0 }; cAgg[k].sku = cAgg[k].sku || p.grout.caulkSku || ""; if (num(p.grout.caulkPrice) > 0) cAgg[k].price = num(p.grout.caulkPrice); cAgg[k].exact += ck; } } const M = getMortar(p, settings); if (M) { mortarCost += M.order * M.price; const k = M.product; if (!mAgg[k]) mAgg[k] = { product: M.product, exact: 0 }; Object.assign(mAgg[k], { unit: M.unit, price: M.price, pending: false }); mAgg[k].exact += M.exact; } else if (p.type === "tile" && p.mortar?.checked) { const k = p.mortar.product; if (!mAgg[k]) mAgg[k] = { product: p.mortar.product, unit: settings.mortars[p.mortar.product]?.unit || "units", price: num(settings.mortars[p.mortar.product]?.price), exact: 0, pending: true }; } const U = getUnderlay(p, settings); if (U && U.product) { underlayCost += U.order * U.price; const k = U.product; if (!uAgg[k]) uAgg[k] = { product: U.product, exact: 0 }; Object.assign(uAgg[k], { unit: U.unit, price: U.price, pending: false }); uAgg[k].exact += U.exact; } else if (p.type !== "misc" && p.underlay?.checked && p.underlay.product) { const k = p.underlay.product; if (!uAgg[k]) uAgg[k] = { product: p.underlay.product, unit: settings.underlayments?.[p.underlay.product]?.unit || "units", price: num(settings.underlayments?.[p.underlay.product]?.price), exact: 0, pending: true }; } const IN = getUnderlayInstall(p, settings); if (IN) IN.forEach((m) => { if (m.kind === "mortar") { mortarCost += m.order * m.price; const k = m.name; if (!mAgg[k]) mAgg[k] = { product: m.name, unit: m.unit, price: m.price, exact: 0 }; mAgg[k].exact += m.exact; } else { underlayCost += m.order * m.price; const k = "install||" + m.name; if (!uAgg[k]) uAgg[k] = { product: m.name, itemSku: m.sku || "", unit: m.unit, price: m.price, exact: 0 }; uAgg[k].exact += m.exact; } }); }));
  // The color's own snapshotted SKU (ADR 0007) outranks the catalog product SKU.
  const gList = Object.values(gAgg).map((g) => { const order = ceilQty(g.exact); return { ...g, sku: g.colorSku || settings.grouts[g.product]?.sku || "", order, cost: order * num(g.price) }; });
  const mList = Object.values(mAgg).map((m) => { const order = ceilQty(m.exact); return { ...m, sku: settings.mortars[m.product]?.sku || "", order, cost: order * num(m.price) }; });
  const uList = Object.values(uAgg).map((u) => { const order = ceilQty(u.exact); return { ...u, sku: u.itemSku || settings.underlayments?.[u.product]?.sku || "", order, cost: order * num(u.price) }; });
  const cList = Object.values(cAgg).map((c) => { const order = ceilQty(c.exact); return { ...c, order, cost: order * num(c.price) }; });
  // Base units ride the CONSOLIDATED kit counts (ADR 0006), so they're derived
  // from gList — not per line — and their cost joins the grout family's.
  const bList = groutBaseList(gList, settings);
  const baseCost = bList.reduce((t, b) => t + b.cost, 0);
  // Every estimated material line with an order quantity, flattened and labeled
  // — shared by the printed order sheet and the order-entry panel.
  const matLines = [
    ...mList.filter((m) => m.order > 0).map((m) => ({ ...m, kind: "Mortar" })),
    ...gList.filter((g) => g.order > 0).map((g) => ({ ...g, product: `${g.product}${g.color !== "—" ? ` — ${g.color}` : ""}`, kind: "Grout" })),
    ...bList.filter((b) => b.order > 0).map((b) => ({ ...b, product: b.name, kind: "Grout base" })),
    ...cList.filter((c) => c.order > 0).map((c) => ({ ...c, product: `${c.product}${c.color !== "—" ? ` — ${c.color}` : ""} matching caulk`, kind: "Caulk" })),
    ...uList.filter((u) => u.order > 0).map((u) => ({ ...u, kind: "Underlayment" })),
  ];
  const hasMat = gList.length > 0 || bList.length > 0 || mList.length > 0 || uList.length > 0 || cList.length > 0; const grandTotal = flooringPrice + groutCost + baseCost + caulkCost + mortarCost + underlayCost + miscCost;
  // Internal materials margin over special-order rows only (ADR 0011 / 0009 §8.1):
  // those snapshot a cost. Each row's sell mirrors its flooring/misc line total,
  // so this margin is a subset of grandTotal. On screen only — never printed.
  const soLines = [];
  (sel?.categories || []).forEach((a) => a.products.forEach((p) => {
    if (!(num(p.cost) > 0)) return;
    const C = getCarton(p, settings);
    const sell = p.type === "misc" ? num(p.priceSqft) * miscQty(p)
      : p.qtyType === "sqft" ? (C ? C.order * C.sf : num(p.qty)) * num(p.priceSqft)
      : 0;
    if (sell > 0) soLines.push({ sell, cost: orderLineCost(p, settings, sell), markupPct: num(p.markupPct) });
  }));
  const margin = specialOrderMargin(soLines);
  const pMats = sel && sel._full ? printMatList(sel, settings) : [];

  // The estimate "paper", moved verbatim from the hidden print block. It renders in
  // BOTH the print layout and the on-screen Print preview tab — one source, so the
  // preview can never drift from what actually prints. Callers guard sel && sel._full.
  const renderEstimatePaper = () => (
          <div>
            <div className="flex justify-between items-center mb-5" style={{ borderBottom: "2px solid var(--ft-text)", paddingBottom: 16 }}>
              <img src={keimLogo} alt="Keim" style={{ height: 40, width: "auto", display: "block" }} />
              <div className="flex flex-col items-end" style={{ gap: 4 }}>
                <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: "var(--ft-brand-deep)" }}>Selection Sheet</div>
                <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
              </div>
            </div>
            {(() => {
              const cust = data.people.find((c) => c.id === sel.customerId);
              // Pre-snapshot projects have no salesperson — fall back to the
              // signed-in profile, which is exactly what they printed before.
              const sp = sel.salesperson || profile;
              const pname = sp.name || sp.email;
              const areaCount = sel.categories.length;
              const wt = num(settings.waste?.tile), wf = num(settings.waste?.floor);
              const col = (label, name, detail) => (
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-faint)" }}>{label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{name || PRINT_DASH}</div>
                  {detail && <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>{detail}</div>}
                </div>
              );
              return (
                <div className="mb-5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {col("Customer", cust?.name || sel.name, cust?.address || sel.address)}
                  {col("Your salesperson", pname, [sp.phone, sp.email].filter((x) => x && x !== pname).join("  ·  "))}
                  {col("Project", sel.name, [areaCount ? `${areaCount} area${areaCount === 1 ? "" : "s"}` : "", wt === wf ? `waste factor ${wt}%` : `waste tile ${wt}% · other ${wf}%`].filter(Boolean).join("  ·  "))}
                </div>
              );
            })()}
            {sel.notes && <div className="text-sm mb-4 italic text-slate-600">{sel.notes}</div>}
            {sel.categories.map((a, ai) => { const areaSf = a.products.reduce((t, p) => t + (p.qtyType === "sqft" ? num(p.qty) : 0), 0); return (
              <div key={a.id} className="mb-5 break-inside-avoid">
                <div className="flex justify-between items-center" style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "8px 12px" }}>
                  <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Area {String(ai + 1).padStart(2, "0")}{(a.name || "").trim() ? ` · ${a.name}` : ""}</div>
                  <div className="ft-mono" style={{ fontSize: 10 }}>{[areaSf > 0 ? `${sf1(areaSf)} SF` : "", printAreaFloor(a, settings) > 0 ? money(printAreaFloor(a, settings)) : ""].filter(Boolean).join(" · ")}</div>
                </div>
                {a.note && <div className="text-xs italic text-slate-500 mt-1.5" style={{ padding: "0 12px" }}>{a.note}</div>}
                <div style={{ display: "grid", gridTemplateColumns: PRINT_COLS, gap: 7, padding: "8px 12px 6px", borderBottom: "1px solid var(--ft-text)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-faint)" }}>
                  <div>Size</div><div>Product / Color</div><div>SKU</div><div>Cov.</div>
                  <div className="text-right">SF</div><div className="text-right">Price</div><div className="text-right">Order</div><div className="text-right">Total</div>
                </div>
                {a.products.filter((p) => !rowBlank(p)).map((p, pi) => { const c = printProduct(p, settings); const inline = c.mats.filter((m) => m.inline); const thickLabel = p.type === "tile" && p.thickness ? THICK.find((t) => t.v === String(p.thickness))?.label || `${p.thickness}"` : ""; return (
                  <Fragment key={p.id}>
                    <div style={{ display: "grid", gridTemplateColumns: PRINT_COLS, gap: 7, padding: "2px 12px 6px", fontSize: 11, alignItems: "baseline", borderTop: pi > 0 ? "1px solid var(--ft-border)" : "none" }}>
                      <div style={{ whiteSpace: "nowrap" }}>{p.type === "tile" ? <>{p.sizeText || (p.L && p.W ? `${p.L}×${p.W}` : PRINT_DASH)}{thickLabel && <span style={{ fontSize: 9.5, color: "var(--ft-muted)" }}> · {thickLabel}</span>}</> : (p.sizeText || PRINT_DASH)}</div>
                      <div style={{ fontWeight: 700 }}>{p.brandColor || TLBL[p.type]}{p.brandColor && <span style={{ fontWeight: 400, fontSize: 10, color: "var(--ft-muted)" }}> · {TLBL[p.type]}</span>}</div>
                      <div className="ft-mono" style={{ fontSize: 9 }}>{p.sku || PRINT_DASH}</div>
                      <div className="ft-mono" style={{ fontSize: 9.5 }}>{c.C ? <>{sf1(c.C.sf)}<span style={{ fontSize: 7.5, color: "var(--ft-muted)" }}> SF/{c.C.unit.toUpperCase()}</span></> : PRINT_DASH}</div>
                      <div className="text-right">{p.qtyType === "sqft" && num(p.qty) > 0 ? sf1(num(p.qty)) : PRINT_DASH}</div>
                      <div className="text-right">{num(p.priceSqft) > 0 ? money(num(p.priceSqft)) : PRINT_DASH}</div>
                      <div className="text-right whitespace-nowrap">{p.type === "misc" ? `${c.qtyText} EA` : c.C && c.C.order > 0 ? `${c.C.order} ${c.C.unit}` : c.qtyText || PRINT_DASH}</div>
                      <div className="text-right" style={{ fontWeight: 700 }}>{c.line > 0 ? money(c.line) : PRINT_DASH}</div>
                    </div>
                    {inline.length > 0 && (
                      <div style={{ padding: "0 12px 4px 24px", fontSize: 9.5, color: "var(--ft-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {inline.map((m, i) => (
                          <span key={i}>
                            <span style={{ fontWeight: 700, color: "var(--ft-brand-deep)" }}>{KSHORT[m.kind]}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : <>{m.name}{m.spec && <> — {m.spec}</>}{m.detail && <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span>}</>}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.note && <div className="italic" style={{ padding: "0 12px 6px 24px", fontSize: 10.5, color: "var(--ft-muted)" }}>{p.note}</div>}
                  </Fragment>
                ); })}
              </div>
            ); })}
            {pMats.length > 0 && (
              <div className="break-inside-avoid mb-4">
                <div className="uppercase mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Setting materials &amp; sundries</div>
                <div style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "14px 16px" }}>
                  <div style={{ columns: 2, columnGap: 28 }}>
                    {(() => {
                      // pMats is pre-sorted by PRINT_KINDS, so same-kind items are
                      // already adjacent — one heading per category, its items listed
                      // beneath it (no repeated category labels).
                      const groups = [];
                      pMats.forEach((m) => {
                        const g = groups[groups.length - 1];
                        if (g && g.kind === m.kind) g.items.push(m);
                        else groups.push({ kind: m.kind, items: [m] });
                      });
                      return groups.map((g, gi) => (
                        <div key={gi} className="break-inside-avoid" style={{ marginBottom: 12 }}>
                          <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>{g.kind}</div>
                          {g.items.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700 }}>{m.name}{m.order > 0 && <> · {m.order} {u1(m.order, m.unit)}</>} <span className="ft-mono" style={{ fontWeight: 400, fontSize: 10 }}>{m.cost > 0 ? money(m.cost) : m.price > 0 ? `${money(m.price)}/${u1(1, m.unit)}` : ""}</span></div>
                              <div style={{ fontSize: 10, color: "var(--ft-muted)" }}>{[m.spec, m.sku, m.exact > 0 ? `(${m.exact.toFixed(2)})` : ""].filter(Boolean).join(" · ")}</div>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex justify-between items-baseline" style={{ borderTop: "1px solid var(--ft-border)", marginTop: 2, paddingTop: 8 }}>
                    <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Materials subtotal</div>
                    <div className="ft-mono" style={{ fontSize: 12, fontWeight: 700 }}>{money(groutCost + baseCost + caulkCost + mortarCost + underlayCost)}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="break-inside-avoid">
              <div className="flex justify-between items-center gap-4" style={{ borderTop: "2px solid var(--ft-text)", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>
                  {[
                    flooringPrice + miscCost > 0 ? `Flooring ${money(flooringPrice + miscCost)}` : "",
                    groutCost + baseCost + caulkCost + mortarCost + underlayCost > 0 ? `Materials ${money(groutCost + baseCost + caulkCost + mortarCost + underlayCost)}` : "",
                    totalSqft > 0 ? `${totalSqft.toLocaleString()} SF measured${orderedSqft > 0 ? `, ${sf1(orderedSqft)} ordered` : ""}` : "",
                  ].filter(Boolean).join(" · ")}
                </div>
                {grandTotal > 0 && <div className="flex items-baseline gap-2 shrink-0"><span className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Estimated total</span><span className="ft-serif" style={{ fontSize: 22 }}>{money(grandTotal)}</span></div>}
              </div>
              <div className="mt-2" style={{ fontSize: 10.5, color: "var(--ft-muted)" }}>Quantities and prices are estimates, incl. {wasteNote(settings)}. Confirm against product specs and final measurements before ordering.</div>
            </div>
            <div className="break-inside-avoid flex mt-6" style={{ gap: 40 }}>
              <div className="flex-1 flex flex-col" style={{ gap: 4 }}>
                <div style={{ borderBottom: "1px solid var(--ft-text)", height: 28 }} />
                <div className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-faint)" }}>Customer approval</div>
              </div>
              <div className="flex flex-col" style={{ width: 160, gap: 4 }}>
                <div style={{ borderBottom: "1px solid var(--ft-text)", height: 28 }} />
                <div className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-faint)" }}>Date</div>
              </div>
            </div>
            <div className="break-inside-avoid flex justify-between items-center mt-5" style={{ borderTop: "1px solid var(--ft-paper-footer)", paddingTop: 10 }}>
              <div className="flex items-center gap-2">
                <span className="ft-wordmark-inline" style={{ fontSize: 15 }}><span className="the">the</span>ned</span>
              </div>
              <div className="text-[9.5px] text-slate-400">Prepared with the ned</div>
            </div>
          </div>
  );
  // The sidebar is two-level: Customers (people), each expandable to their
  // Projects, plus an "Unassigned projects" group for jobs with no customer.
  // Search spans builder + customer contact + project names (ADR 0005).
  const q = search.trim().toLowerCase();
  const matchProj = (p) => [p.name, p.address, p.phone, p.email].some((f) => (f || "").toLowerCase().includes(q));
  const matchPerson = (c) => !q || [c.name, c.phone, c.email, c.address, builderNameOf(c.builderId)].some((f) => (f || "").toLowerCase().includes(q)) || projectsOf(c.id).some(matchProj);
  // "Newest" bubbles a customer up on any activity — their own edit or any of
  // their projects'. "A–Z" ignores recency.
  const personActivity = (c) => Math.max(c.updatedAt || 0, 0, ...projectsOf(c.id).map((p) => p.updatedAt || 0));
  const sortPeople = (list) => [...list].sort((a, b) => sortBy === "name" ? (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }) : personActivity(b) - personActivity(a));
  const peopleList = sortPeople(q ? data.people.filter(matchPerson) : data.people);
  const unassigned = data.projects.filter((p) => !p.customerId && (!q || matchProj(p)));

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const lbl = "ft-eyebrow text-[10px] mb-1 block";

  const renderProjRow = (p) => {
    const on = selId === p.id;
    return (
      <button key={p.id} onClick={() => pickProject(p.id)} className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 border ${on ? "bg-white border-slate-200 shadow-[0_1px_3px_var(--ft-shadow)]" : "border-transparent hover:bg-slate-50"}`}>
        <FileText size={13} className="text-slate-300 shrink-0" />
        <span className="ft-item-name text-[12.5px] truncate flex-1">{p.name || "Untitled project"}</span>
      </button>
    );
  };
  const renderPersonRow = (c) => {
    const projs = projectsOf(c.id);
    const shown = q ? projs.filter(matchProj) : projs;
    const isOpen = !!openCust[c.id] || (q && projs.some(matchProj));
    // Highlight the person row when their open project is hidden behind a
    // collapsed group (or the legacy customer pane is showing).
    const on = (selCustId === c.id && !selId) || (!isOpen && projs.some((p) => p.id === selId));
    const bn = builderNameOf(c.builderId);
    const clickName = () => {
      if (projs.length === 1) pickProject(projs[0].id);
      else setOpenCust((s) => ({ ...s, [c.id]: !isOpen }));
    };
    return (
      <div key={c.id} className="mb-0.5">
        <div className={`w-full rounded-md flex items-center gap-0.5 border ${on ? "bg-white border-slate-200 shadow-[0_1px_4px_var(--ft-shadow)]" : "border-transparent hover:bg-slate-50"}`}>
          <button onClick={clickName} title={projs.length === 1 ? "Open project" : isOpen ? "Collapse" : "Expand"} className="flex items-center gap-1.5 min-w-0 flex-1 py-1.5 pl-1.5 pr-1 text-left">
            {projs.length !== 1 && <ChevronRight size={13} className={`text-slate-300 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
            <div className="min-w-0 flex-1">
              <div className="ft-item-name text-[13.5px] font-semibold truncate">{c.name || "Unnamed customer"}</div>
              <div className="text-[11px] text-slate-400 truncate mt-px">{[bn, `${projs.length} project${projs.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
            </div>
          </button>
          <button onClick={() => setCustModal(c.id)} title="Customer details" className="shrink-0 mr-1.5 rounded border border-slate-200 p-1 text-slate-400 hover:text-slate-600 hover:bg-white">
            <MoreHorizontal size={13} />
          </button>
        </div>
        {isOpen && (
          <div className="ml-6 mt-0.5 mb-1 space-y-0.5 border-l border-slate-200 pl-1.5">
            {shown.map((p) => renderProjRow(p))}
            <button onClick={() => addProject(c.id)} className="w-full flex items-center gap-1 px-2 py-1 text-[11.5px] text-slate-400 hover:text-indigo-600"><Plus size={12} /> New project</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: 'var(--ft-ui)' }}>
      <div className={`print:hidden flex ${isWide ? "flex-row" : "flex-col"} flex-1 overflow-hidden relative`}>
        {/* Mobile top bar */}
        {!isWide && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 ft-rail border-b border-slate-200">
            <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1 text-slate-600"><Menu size={20} /></button>
            <NedMark size={28} />
            <span className="ft-serif text-lg truncate flex-1">{sel ? sel.name : selCust ? selCust.name : "the ned"}</span>
          </div>
        )}

        {!isWide && sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={isWide ? "ft-rail border-r border-slate-200 flex flex-col w-64 shrink-0" : `ft-rail border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="flex-1 min-w-0"><div className="ft-wordmark-stacked" style={{ fontSize: 24 }}><span className="the">the</span>ned</div><div className="ft-eyebrow text-[9.5px] mt-1.5">Selection Manager</div></div>
            {!isWide && <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><X size={18} /></button>}
          </div>
          <div className="p-2.5 space-y-2">
            <div className="relative"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className={inp + " pl-8"} /></div>
            <div className="flex gap-2">
              <div className="flex items-stretch rounded-md border border-slate-200 overflow-hidden text-xs shrink-0">
                {[["Newest", "newest"], ["A–Z", "name"]].map(([label, v]) => (
                  <button key={v} onClick={() => setSortBy(v)} className={`px-2 flex items-center font-medium ${sortBy === v ? "ft-seg-on" : "ft-seg-off"}`}>{label}</button>
                ))}
              </div>
              <button onClick={() => setNewCust("")} className="ft-spark-btn flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2"><Plus size={16} className="-ml-1" /> New Customer</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {data.people.length === 0 && unassigned.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">No customers yet</div>}
            {q && peopleList.length === 0 && unassigned.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">No matches</div>}
            {peopleList.length > 0 && <div className="mt-1 mb-1 px-2.5 ft-eyebrow text-[9px]">Customers ({peopleList.length})</div>}
            {peopleList.map((c) => renderPersonRow(c))}
            {unassigned.length > 0 && (<>
              <div className="mt-3 mb-1 px-2.5 ft-eyebrow text-[9px]">Unassigned jobs ({unassigned.length})</div>
              {unassigned.map((p) => renderProjRow(p))}
            </>)}
          </div>
          <div className="p-2.5 border-t border-slate-100">
            <div className="flex mb-2">
              <ThemeSwitch theme={theme} setTheme={setTheme} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowSettings(true); setSidebarOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><Settings size={15} /> Settings</button>
              <button onClick={openTodos} title="Team issues & to-do list" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600">
                <ListTodo size={15} /> Issues
                {todos.filter((t) => !t.done).length > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">{todos.filter((t) => !t.done).length}</span>}
              </button>
              <button onClick={handleSignOut} title={`Sign out — ${user.email}`} className="shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-500"><LogOut size={15} /></button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {!sel ? (
            selCust ? (
              <div className="max-w-3xl mx-auto p-3 md:p-5">
                <div className="bg-white rounded-lg border border-slate-200" style={{ padding: "clamp(12px,1.8vw,18px)" }}>
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="ft-eyebrow-accent text-[10px] mb-1.5">{builderNameOf(selCust.builderId) ? `${builderNameOf(selCust.builderId)} · Customer` : "Customer"}</div>
                      <div className="flex items-center gap-2">
                        <input value={selCust.name} onChange={(e) => updatePerson(selCust.id, { name: e.target.value })} placeholder="Customer name" className="ft-serif bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 flex-1" style={{ fontSize: "clamp(26px,4vw,34px)", lineHeight: 1 }} />
                        {saveOk && <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--ft-brand)" }}>Saved ✓</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="ft-serif" style={{ fontSize: "clamp(22px,3vw,28px)", lineHeight: 1 }}>{projectsOf(selCust.id).length}</div>
                      <div className="ft-eyebrow text-[9px] mt-1">project{projectsOf(selCust.id).length === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                    <MetaChip icon={Phone} label="Phone" value={selCust.phone} active={custChip === "phone"} onClick={() => setCustChip(custChip === "phone" ? null : "phone")} />
                    <MetaChip icon={Mail} label="Email" value={selCust.email} active={custChip === "email"} onClick={() => setCustChip(custChip === "email" ? null : "email")} />
                    <MetaChip icon={MapPin} label="Address" value={selCust.address} active={custChip === "address"} onClick={() => setCustChip(custChip === "address" ? null : "address")} />
                    <MetaChip icon={Building2} label="Builder" value={builderNameOf(selCust.builderId)} active={custChip === "builder"} onClick={() => setCustChip(custChip === "builder" ? null : "builder")} />
                    <MetaChip icon={StickyNote} label="Notes" value={selCust.notes ? "Notes" : ""} active={custChip === "notes"} onClick={() => setCustChip(custChip === "notes" ? null : "notes")} />
                    <span className="flex-1" />
                    <button onClick={() => setConfirm({ kind: "person", id: selCust.id })} className="flex items-center justify-center rounded-full border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 p-2 text-slate-400" title="Delete customer"><Trash2 size={15} /></button>
                  </div>
                  {custChip && (
                    <div className="mt-3">
                      {custChip === "phone" && <><label className={lbl}>Phone</label><input autoFocus value={selCust.phone} onChange={(e) => updatePerson(selCust.id, { phone: e.target.value })} className={inp} /></>}
                      {custChip === "email" && <><label className={lbl}>Email</label><input autoFocus value={selCust.email} onChange={(e) => updatePerson(selCust.id, { email: e.target.value })} className={inp} /></>}
                      {custChip === "address" && <><label className={lbl}>Mailing address</label><input autoFocus value={selCust.address} onChange={(e) => updatePerson(selCust.id, { address: e.target.value })} className={inp} /></>}
                      {custChip === "builder" && <><label className={lbl}>Builder</label><BuilderCombo value={selCust.builderId} builders={data.builders} inp={inp} onSelect={(bid) => updatePerson(selCust.id, { builderId: bid })} onAddBuilder={(name) => addBuilderFor(selCust.id, name)} /></>}
                      {custChip === "notes" && <><label className={lbl}>Customer notes</label><textarea autoFocus value={selCust.notes} onChange={(e) => updatePerson(selCust.id, { notes: e.target.value })} rows={2} className={inp} /></>}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-6 mb-3 gap-2">
                  <h2 className="ft-serif" style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1 }}>Projects</h2>
                  <button onClick={() => addProject(selCust.id)} className="flex items-center gap-1.5 text-sm font-semibold rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> New project</button>
                </div>
                {projectsOf(selCust.id).length === 0 && <div className="bg-white rounded-lg border border-dashed border-slate-300 p-9 text-center text-sm text-slate-400">No projects yet. Add the first job for this customer.</div>}
                <div className="space-y-2">
                  {projectsOf(selCust.id).map((p) => (
                    <button key={p.id} onClick={() => pickProject(p.id)} className="w-full text-left bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition p-4 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{p.name || "Untitled project"}</div>
                        {p.address && <div className="text-[12.5px] text-slate-400 truncate mt-px">{p.address}</div>}
                      </div>
                      {p.updatedAt && <div className="ft-mono text-[11px] text-slate-400 shrink-0 whitespace-nowrap">{fmtAgo(p.updatedAt)}</div>}
                      <ChevronRight size={18} className="text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="ft-wordmark-stacked" style={{ fontSize: "clamp(64px,11vw,128px)" }}><span className="the">the</span>ned</div>
                <div className="ft-eyebrow mt-4" style={{ fontSize: "clamp(11px,1.4vw,16px)", letterSpacing: ".32em" }}>Selection Manager</div>
                <button onClick={() => setNewCust("")} className="ft-spark-btn mt-8 inline-flex items-center gap-2 font-semibold px-6 py-3 text-base"><Plus size={18} className="-ml-1" /> New customer</button>
              </div>
            )
          ) : !sel._full ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading {sel.name || "customer"}…</div>
          ) : (
            <div className="max-w-4xl mx-auto p-3 md:p-5">
              <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
                {[["edit", "Edit"], ["preview", "Print preview"]].map(([k, label]) => (
                  <button key={k} onClick={() => setViewTab(k)} className={"px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition " + (viewTab === k ? "" : "border-transparent text-slate-400 hover:text-slate-600")} style={viewTab === k ? { color: "var(--ft-brand)", borderColor: "var(--ft-brand)" } : {}}>{label}</button>
                ))}
              </div>
              {/* Edit view stays mounted (hidden, not unmounted) so field focus and in-progress typing survive tab flips. */}
              <div className={viewTab === "edit" ? "" : "hidden"}>
              {/* Header card, print-sheet style: customer | project | salesperson
                  up top, then builder + attachments | notes | actions, then a
                  full-width Add-area row. The middle (project) column is the
                  widest, like the estimate paper's header. */}
              <div className="rounded-lg border mb-4" style={{ padding: "clamp(12px,1.8vw,18px)", background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
                {(() => {
                  const cust = data.people.find((c) => c.id === sel.customerId);
                  const bn = cust ? builderNameOf(cust.builderId) : "";
                  const sp = sel.salesperson || profile;
                  const cols = isWide ? { display: "grid", gridTemplateColumns: "1fr 1.28fr 1.08fr", gap: 16 } : { display: "grid", gridTemplateColumns: "1fr", gap: 12 };
                  const midPad = isWide ? { borderLeft: "1px solid var(--ft-border)", borderRight: "1px solid var(--ft-border)", padding: "0 16px" } : {};
                  return (
                    <>
                      <div style={cols}>
                        <div className="min-w-0">
                          <div className="ft-eyebrow text-[9px] mb-1">Customer</div>
                          {cust ? (
                            <>
                              <button onClick={() => setCustModal(cust.id)} title="Open customer details" className="ft-serif flex items-center gap-1 min-w-0 max-w-full text-indigo-600 hover:text-indigo-700" style={{ fontSize: 19, lineHeight: 1.15 }}>
                                <span className="truncate">{cust.name || "Customer"}</span><ChevronDown size={14} className="shrink-0" />
                              </button>
                              <div className="text-xs text-slate-500 mt-1 truncate">{cust.address || " "}</div>
                            </>
                          ) : (
                            <div className="text-amber-600 text-sm font-semibold" style={{ lineHeight: 1.6 }}>Unassigned job</div>
                          )}
                        </div>
                        <div className="min-w-0 relative" style={midPad}>
                          {isWide && <div className="ft-mono absolute top-0 text-[12px] font-bold" style={{ right: 16, color: "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>}
                          {saveOk && <span className="absolute top-0 text-[11px] font-medium whitespace-nowrap" style={{ left: isWide ? 16 : 0, color: "var(--ft-brand)" }}>Saved ✓</span>}
                          <div className={"ft-eyebrow text-[9px] mb-1" + (isWide ? " text-center" : "")}>Project</div>
                          <input ref={nameRef} onKeyDown={tabTo(addAreaRef)} value={sel.name} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name" className={"ft-serif w-full bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 transition" + (isWide ? " text-center" : "") + (focusName ? " border-indigo-300" : "")} style={{ fontSize: "clamp(22px,3vw,28px)", lineHeight: 1.05 }} />
                          <input value={sel.address} onChange={(e) => updateProject(sel.id, { address: e.target.value })} placeholder="Project address…" className={"w-full bg-transparent text-xs text-slate-500 border-b border-transparent focus:border-indigo-500 focus:outline-none mt-1" + (isWide ? " text-center" : "")} />
                          {!isWide && <div className="ft-mono text-[12px] font-bold mt-1" style={{ color: "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>}
                        </div>
                        <div className={"min-w-0 flex flex-col" + (isWide ? " items-end text-right" : " items-start")}>
                          <div className="ft-eyebrow text-[9px] mb-1 flex items-center gap-1"><Lock size={10} /> Salesperson</div>
                          <SalespersonPop value={sel.salesperson} fallback={profile} alignRight={isWide} onChange={(v) => updateProject(sel.id, { salesperson: v })} />
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-full">{sp.phone || " "}</div>
                        </div>
                      </div>
                      <div className="ft-noprint mt-3 pt-3 border-t" style={{ ...cols, borderColor: "var(--ft-border)" }}>
                        <div className="flex flex-col gap-1.5 min-w-0" style={isWide ? { height: 66 } : {}}>
                          <div className="ft-eyebrow text-[9px] truncate">{bn || "Files"}</div>
                          <div className="flex-1 min-h-0 rounded-md border border-dashed border-slate-300 px-1.5 py-1 flex flex-wrap gap-1 items-start content-start overflow-hidden">
                            {(sel.attachments || []).map((m) => (
                              <span key={m.id} className="flex items-center gap-1 rounded-md bg-slate-100 pl-1.5 pr-1 py-0.5 text-[11px]">
                                <button onClick={() => openAttachment(m)} className="hover:text-indigo-600 max-w-[7rem] truncate" title={`${m.name} · ${Math.max(1, Math.round(m.size / 1024))} KB`}>{m.name}</button>
                                <button onClick={() => delAttachment(m)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                              </span>
                            ))}
                            <button onClick={() => attRef.current?.click()} title="Attach a file (not printed)" className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"><Paperclip size={11} /> Add</button>
                            <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
                          </div>
                        </div>
                        <textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ height: 66, background: "var(--ft-cream)" }} />
                        <div className="flex flex-col justify-between gap-1.5" style={isWide ? { height: 66 } : {}}>
                          {namingVersion ? (
                            <div className="flex items-center gap-1.5">
                              <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") setNamingVersion(false); }} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[30px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <button onClick={confirmVersion} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"><Check size={15} /></button>
                              <button onClick={() => setNamingVersion(false)} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-400"><X size={15} /></button>
                            </div>
                          ) : (
                            <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
                              <div className="flex gap-1.5">
                                <button onClick={startVersionName} className="h-[30px] flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 whitespace-nowrap"><Save size={14} /> Version</button>
                                <button onClick={() => setShowVersions(true)} title={`Version history (${sel.versions?.length || 0})`} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"><History size={14} /></button>
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => setPrintMode("order")} className="h-[30px] flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 whitespace-nowrap"><ClipboardList size={14} /> Order sheet</button>
                                <button onClick={() => setConfirm({ id: sel.id })} title="Delete project" className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          )}
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
                            <button onClick={() => setShowOrderCopy(true)} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Copy size={14} /> Order entry</button>
                            <button onClick={() => setPrintMode("estimate")} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Printer size={14} /> Print</button>
                          </div>
                        </div>
                      </div>
                      {/* Ink row — same action as the dashed Add-area bar that
                          trails the areas list; both stay on purpose. */}
                      <button ref={addAreaRef} onClick={addArea} className="ft-noprint mt-3 w-full h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md transition hover:opacity-90" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}><Plus size={14} /> Add area</button>
                    </>
                  );
                })()}
              </div>

              {sel.categories.length === 0 && <div className="bg-white rounded-lg border border-dashed border-slate-300 p-9 text-center text-sm text-slate-400">No areas yet. Add one to start building this customer's selections.</div>}

              {/* Areas butt up against each other (no gap) — each area still
                  rounds its own corners, so touching areas keep the soft "pill"
                  notch at their seam that the flush product boxes don't. */}
              <div>
                {sel.categories.map((a, ai) => {
                  const areaSf = a.products.reduce((t, p) => t + (p.qtyType === "sqft" ? num(p.qty) : 0), 0);
                  const areaTotal = printAreaFloor(a, settings);
                  const areaMatOpen = a.products.some((pp) => matOpen[pp.id]);
                  return (
                  // overflow-hidden lifts while a card is dragged (so the floating
                  // card isn't clipped at its home area's edge) and while one of its
                  // products' materials drawers is open (so the drawer can float past
                  // the card's bottom edge without being clipped).
                  <div key={a.id} data-area-drop={a.id} className={`rounded-lg border bg-white transition-colors ${drag || areaMatOpen ? "" : "overflow-hidden"} ${drag?.to?.aid === a.id ? "border-indigo-400" : drag ? "border-dashed border-slate-300" : "border-slate-200"}`}>
                    <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-area-head)", padding: "8px 14px" }}>
                      <div className="flex items-baseline gap-2.5 flex-1 min-w-0">
                        <input ref={(el) => { if (el) areaRefs.current[a.id] = el; }} value={a.name} onChange={(e) => updArea(a.id, { name: e.target.value })} placeholder={`Area ${ai + 1}`} className="ft-serif bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none min-w-0 placeholder:text-slate-400" style={{ fontSize: 20, lineHeight: 1.1, width: `${Math.max(a.name.length || `Area ${ai + 1}`.length, 4) + 1}ch` }} />
                        <input tabIndex={-1} value={a.note} onChange={(e) => updArea(a.id, { note: e.target.value })} placeholder="area note…" className="text-xs bg-transparent focus:outline-none placeholder:text-current flex-1 min-w-0" style={{ color: "color-mix(in oklab, var(--ft-text) 80%, transparent)" }} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="ft-mono" style={{ fontSize: 10.5 }}>{[areaSf > 0 ? `${sf1(areaSf)} SF` : "", areaTotal > 0 ? money(areaTotal) : ""].filter(Boolean).join(" · ")}</span>
                        <button tabIndex={-1} onClick={() => setConfirmArea(a.id)} title="Delete this area" className="ft-noprint text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {confirmArea === a.id && (
                      <div className="ft-noprint flex items-center gap-2 px-3 py-2 text-xs border-b border-slate-100">
                        {(() => { const realN = a.products.filter((p) => !rowBlank(p)).length; return (
                        <span className="text-red-600 flex-1">Delete "{areaLabel(a, ai)}"{realN > 0 ? <> and its {realN} selection{realN === 1 ? "" : "s"}</> : ""}? Everything in this area comes off the estimate.</span>
                        ); })()}
                        <button onClick={() => { delArea(a.id); setConfirmArea(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
                        <button onClick={() => setConfirmArea(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
                      </div>
                    )}

                    <div data-prod-list="1" className="relative" onKeyDown={(e) => gridEnterNav(e, () => addProduct(a.id))}>
                      <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, background: "var(--ft-area-head)", borderTop: "1px solid var(--ft-border)", borderBottom: "1px solid var(--ft-border)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-muted)" }}>
                        <div style={{ padding: "5px 10px", borderRight: "1px solid var(--ft-row-line)" }}>Size / Type ▾</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" }}>Product / Color ▾</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" }}>SKU</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" }}>Cov.</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>SF</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>Price</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>Order</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>Total</div>
                        <div />
                      </div>
                      {a.products.map((p, pi) => {
                        const G = getGrout(p, settings), M = getMortar(p, settings);
                        const gEx = groutExact(p, settings), mEx = mortarExact(p, settings);
                        const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
                        // Amber-flag the empty qty box only once the row has identity —
                        // a freshly added blank row shouldn't glow before you start.
                        const qtyMissing = p.type !== "misc" && !(num(p.qty) > 0) && !!(p.sku || p.brandColor || num(p.priceSqft) > 0);
                        // Sold by the carton: whole cartons drive the line total.
                        const C = getCarton(p, settings), cEx = cartonExact(p, settings);
                        const line = p.type === "misc" ? num(p.priceSqft) * miscQty(p) : C ? C.order * C.sf * num(p.priceSqft) : sf * num(p.priceSqft);
                        // Dropdowns are driven by the catalog (resolve-by-name). A selection
                        // whose stored product is no longer offered is injected back as an
                        // option so it still shows — same pattern as tile thickness above.
                        const groutNames = offeredGrouts(settings.catalog), mortarNames = offeredMortars(settings.catalog);
                        const groutOpts = groutNames.includes(p.grout.product) ? groutNames : [p.grout.product, ...groutNames];
                        // A grout linked to a price-book family (ADR 0007) offers that
                        // family's colors; picking one snapshots the color's SKU onto
                        // the row. Unlinked grouts keep the standard code list.
                        const gBook = settings.grouts[p.grout.product]?.book || "";
                        const gFam = gBook ? gFamilies.find((f) => f.product.toLowerCase() === gBook.toLowerCase()) : null;
                        const colorBase = gFam ? gFam.colors.map((c) => c.color) : colorsFor(p.grout.product);
                        const colorOpts = (!p.grout.color || colorBase.includes(p.grout.color)) ? colorBase : [p.grout.color, ...colorBase];
                        const pickGroutColor = (color) => { const it = gBook ? groutColorItem(stock, gBook, color) : null; const ck = gBook ? groutCaulkItem(stock, gBook, color) : null; updProduct(a.id, p.id, { grout: { ...p.grout, color, sku: it ? it.sku : "", caulkSku: ck ? ck.sku : "", caulkPrice: ck && ck.price != null ? String(ck.price) : "" } }); };
                        const pickGroutProduct = (product) => { const book = settings.grouts[product]?.book || ""; const it = book && p.grout.color ? groutColorItem(stock, book, p.grout.color) : null; const ck = book && p.grout.color ? groutCaulkItem(stock, book, p.grout.color) : null; updProduct(a.id, p.id, { grout: { ...p.grout, product, sku: it ? it.sku : "", caulkSku: ck ? ck.sku : "", caulkPrice: ck && ck.price != null ? String(ck.price) : "" } }); };
                        const mortarOpts = mortarNames.includes(p.mortar.product) ? mortarNames : [p.mortar.product, ...mortarNames];
                        // Underlayment applies to every flooring type but its options are
                        // filtered to the ones tagged for this type; a stored pick that is
                        // no longer offered is injected back so it still shows.
                        const U = getUnderlay(p, settings), uEx = underlayExact(p, settings);
                        const installDefs = settings.underlayments[p.underlay.product]?.install || [];
                        const INS = getUnderlayInstall(p, settings);
                        const insById = new Map((INS || []).map((m) => [m.defId, m]));
                        const insIncluded = installDefs.filter((d) => !p.underlay.installSkip?.[d.id]).length;
                        const insExpanded = !!insOpen[p.id];
                        const underlayNames = offeredUnderlayments(settings.catalog, p.type);
                        const underlayOpts = p.underlay.product && !underlayNames.includes(p.underlay.product) ? [p.underlay.product, ...underlayNames] : underlayNames;
                        const underlayUnit = U ? U.unit : settings.underlayments[p.underlay.product]?.unit;
                        const toggleUnderlay = () => updProduct(a.id, p.id, { underlay: { ...p.underlay, checked: !p.underlay.checked, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayNames[0] || "") } });
                        // Collapsed rows reuse the print sheet's inline material line
                        // (Phase 2 wording, incl. swatch + subtotal) — the #14a spec
                        // wants the collapsed line identical to the printed one.
                        const matExpanded = !!matOpen[p.id];
                        const pInline = printProduct(p, settings).mats.filter((m) => m.inline);
                        const matsCost = pInline.reduce((t, m) => t + m.cost, 0);
                        const warns = materialWarnings(p, settings);
                        const WLBL = { grout: "Grout", mortar: "Mortar", underlay: underlayLabel(p.type), install: "Install materials" };
                        // The strip shows uncomputed grout as a name with no number;
                        // when it's being warned about, the warning replaces that ghost.
                        const stripMats = pInline.filter((m) => !(m.kind === "Grout" && m.order <= 0 && warns.includes("grout")));
                        const hasMats = p.type !== "misc" && ((p.type === "tile" && (p.grout.checked || p.mortar.checked)) || p.underlay.checked);
                        const openMats = () => setMatOpen({ [p.id]: true });
                        const closeMats = () => setMatOpen({});
                        const addables = p.type === "misc" ? [] : [
                          ...(p.type === "tile" && !p.grout.checked ? ["Grout"] : []),
                          ...(p.type === "tile" && !p.mortar.checked ? ["Mortar"] : []),
                          ...(!p.underlay.checked ? [KSHORT[underlayLabel(p.type)]] : []),
                        ];
                        const gUnit = G ? G.unit : settings.grouts[p.grout.product]?.unit || "";
                        const mUnit = M ? M.unit : settings.mortars[p.mortar.product]?.unit || "";
                        // Price-book link: the row keeps its snapshotted values; the
                        // chip below only points out drift from the current book. An
                        // order row (bookId set) drifts on cost x markup, its book item
                        // fetched on demand (orderItems), so it takes the order path and
                        // skips the stock lookup entirely.
                        const orderRow = !!p.bookId;
                        const oBook = orderRow ? books.find((b) => b.id === p.bookId) : null;
                        const oItem = orderRow && p.sku ? orderItems[p.bookId]?.[p.sku] : null;
                        const oDrift = oItem && oBook ? orderDrift(oItem, oBook, p) : null;
                        const stockItem = orderRow ? null : findStock(stock, p.sku);
                        const drift = stockDrift(stockItem, p);
                        const stockRetired = p.sku && stockItem && (stockItem.discontinued || !stockItem.active);
                        const baseAlt = stockItem && stockBaseVariant(stockItem, stock);
                        // The type accent stays on the small type button and the material
                        // chips; the row itself carries the page tone (constant — it does
                        // not deepen when the materials box expands), and the Price and
                        // Total cells carry the head tone to anchor the money columns.
                        // The row tone continues below the row and wraps the materials
                        // box, which reads as the exact same color as the row, open or
                        // closed.
                        const accent = TYPE_ACCENT[p.type];
                        const rowTint = ROW_WASH;
                        const totalTint = TOTAL_WASH;
                        const matBoxBg = rowTint;
                        // The materials box and its collapsed summary chip both carry the
                        // light hairline border.
                        const chipBorder = "1px solid var(--ft-border)";
                        // When the drawer is open the owning row + drawer form one sharp,
                        // undimmed unit framed by a double border (row draws the top & sides,
                        // the drawer the sides & bottom, so they read as a single box).
                        const matBorder = "3px double color-mix(in oklab, var(--ft-text) 45%, var(--ft-prod))";
                        const rowOpen = matExpanded && p.type !== "misc";
                        // The note lives inside the tinted wrap, hugging the chip's
                        // bottom edge; rows with no wrap fall back to a cream note row.
                        const noteInput = (
                          <input value={p.note} onChange={(e) => updProduct(a.id, p.id, { note: e.target.value })} placeholder="note…" className="w-full min-w-0 text-xs italic text-slate-500 bg-transparent focus:outline-none placeholder:text-slate-300" style={{ padding: "3px 7px 0" }} />
                        );
                        const searchMode = rowBlank(p) && !manualRows[p.id];
                        // The last row of an area is the permanent inline "adder";
                        // a blank row above it is a real selection the user cleared.
                        const isAdder = pi === a.products.length - 1;
                        const clearOmni = () => setOmniQ((o) => { const n = { ...o }; delete n[p.id]; return n; });
                        const omniText = omniQ[p.id] || "";
                        const goManual = (extra) => { const t = omniText.trim(); updProduct(a.id, p.id, { ...(t ? { brandColor: t } : {}), ...extra }); setManualRows((m) => ({ ...m, [p.id]: true })); setOmniQ((o) => { const n = { ...o }; delete n[p.id]; return n; }); setFocusProdBox(p.id); };
                        const fillFromStock = (items) => { addStockProducts(a.id, p.id, items); setOmniQ((o) => { const n = { ...o }; delete n[p.id]; return n; }); setFocusQty(p.id); };
                        return (
                          // flow-root keeps the collapsed pill's bottom margin inside the
                          // card — collapsed through, it painted a white strip between rows
                          <div key={p.id} data-prod-card={p.id} data-flip={p.id} style={{
                            display: "flow-root",
                            position: "relative",
                            background: "var(--ft-area-row)",
                            borderBottom: "1px solid var(--ft-grid-line)",
                          }}>
                            {searchMode ? (
                            /* empty row: type chip + one wide price-book search that fills the row on pick */
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 44px", fontSize: 11, fontWeight: 600, background: "var(--ft-card)" }}>
                              <div style={{ ...gridCell, paddingLeft: 0, gap: 2 }}>
                                <TypeSelect compact blank type={p.type} onChange={(t) => goManual({ type: t })} />
                                <span className="w-1 shrink-0" />
                              </div>
                              <div style={gridCell}>
                                <GridOmniSearch stock={stock} query={omniText}
                                  onQuery={(v) => setOmniQ((o) => ({ ...o, [p.id]: v }))}
                                  onPick={(it) => fillFromStock([it])} onPickMany={(items) => fillFromStock(items)}
                                  onManual={() => goManual()} onAbandon={clearOmni}
                                  searchOrder={searchOrder} bookName={bookName}
                                  inputRef={(el) => { if (el) typeRefs.current[p.id] = el; }} />
                              </div>
                              <div className="ft-noprint flex items-center justify-center gap-0.5" style={{ background: "var(--ft-card)" }}>
                                <button tabIndex={-1} onPointerDown={(e) => startDrag(e, a.id, p, pi)} title="Drag to reorder or move to another area" className="p-0.5 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={12} /></button>
                                {a.products.length > 1 && !isAdder && <button tabIndex={-1} onClick={() => delProduct(a.id, p.id)} title="Remove this empty row" className="p-0.5 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>}
                              </div>
                            </div>
                            ) : (<>
                            {/* main product row */}
                            <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, fontSize: 11, fontWeight: 600, background: rowTint, ...(rowOpen ? { position: "relative", zIndex: 46, borderTop: matBorder, borderLeft: matBorder, borderRight: matBorder, marginTop: -3 } : null) }}>
                              <div style={{ ...gridCell, paddingLeft: 0, gap: 2 }}>
                                <TypeSelect compact type={p.type} onChange={(t) => updProduct(a.id, p.id, { type: t })} triggerRef={(el) => { if (el) typeRefs.current[p.id] = el; }} />
                                {/* no expand carrot — the materials pill opens the drawer,
                                    clicking anywhere outside folds it */}
                                <span className="w-1 shrink-0" />
                                {p.type === "tile" ? (
                                  <GridSizeInput p={p} onCommit={(patch) => updProduct(a.id, p.id, patch)} />
                                ) : p.type === "misc" ? (
                                  <span className="px-1" style={{ color: "var(--ft-faint)" }}>Misc</span>
                                ) : (
                                  <input value={p.sizeText} onChange={(e) => updProduct(a.id, p.id, { sizeText: e.target.value })} data-c="size" className="ft-cell" style={{ padding: "6px 4px" }} placeholder={p.type === "hardwood" ? "Width" : "Size"} title={p.type === "hardwood" ? "Plank width (in)" : "Size"} />
                                )}
                              </div>
                              <div style={gridCell}>
                                <GridProductBox value={p.brandColor} stock={stock} onChange={(v) => updProduct(a.id, p.id, { brandColor: v })} onPick={(it) => { addStockProducts(a.id, p.id, [it]); setFocusQty(p.id); }} searchOrder={searchOrder} bookName={bookName} placeholder={p.type === "misc" ? "Description…" : "Product / color…"} inputRef={(el) => { if (el) prodRefs.current[p.id] = el; }} />
                              </div>
                              <div style={{ ...gridCell, fontSize: 9.5 }} className="ft-mono">
                                {stock.length > 0 || searchOrder ? (
                                  <SkuPicker value={p.sku || ""} stock={stock}
                                    onChange={(v) => updProduct(a.id, p.id, { sku: v })}
                                    onPick={(it) => { addStockProducts(a.id, p.id, [it]); setFocusQty(p.id); }}
                                    onPickMany={(items) => addStockProducts(a.id, p.id, items)}
                                    searchOrder={searchOrder} bookName={bookName}
                                    wrapClass="relative flex-1 min-w-0 self-stretch flex" wrapStyle={{}} inputClass="ft-cell" />
                                ) : (
                                  <input value={p.sku} onChange={(e) => updProduct(a.id, p.id, { sku: e.target.value })} data-c="sku" className="ft-cell" placeholder="SKU" />
                                )}
                              </div>
                              <div style={{ ...gridCell, fontSize: 9.5 }} className="ft-mono">
                                {p.type !== "misc" && p.qtyType === "sqft" ? (<>
                                  <input tabIndex={p.sku ? -1 : 0} type="number" value={p.cartonSf} onChange={(e) => updProduct(a.id, p.id, { cartonSf: e.target.value })} data-c="cov" className="ft-cell" style={{ flex: 1, minWidth: 0 }} placeholder="—" title="Sq ft per carton/sheet — filled from the price book when the SKU has one. With this set, quantities and totals are figured by whole cartons." />
                                  {num(p.cartonSf) > 0 && p.cartonUnit && <span className="shrink-0 pr-1" style={{ fontSize: 8, color: "var(--ft-muted)" }}>SF/{String(p.cartonUnit).toUpperCase()}</span>}
                                </>) : <span className="px-2" style={{ color: "var(--ft-faint)" }}>—</span>}
                              </div>
                              <div style={gridCell}>
                                {p.type !== "misc" && p.qtyType === "sqft" ? (
                                  <input ref={(el) => { if (el) qtyRefs.current[p.id] = el; }} type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })} data-c="sf" className={`ft-cell text-right ${qtyMissing ? "ring-2 ring-inset ring-amber-400 bg-amber-50 rounded" : ""}`} placeholder="0" title={qtyMissing ? "Enter square footage" : "Square feet"} />
                                ) : <span className="px-2 ml-auto" style={{ color: "var(--ft-faint)" }}>—</span>}
                              </div>
                              <div style={{ ...gridCell, background: totalTint }}>
                                <input type="number" value={p.priceSqft} onChange={(e) => updProduct(a.id, p.id, { priceSqft: e.target.value })} data-c="price" className="ft-cell text-right" placeholder="0.00" title={p.type === "misc" || p.qtyType === "count" ? "Price each" : "Price per sq ft"} />
                              </div>
                              <div style={{ ...gridCell, justifyContent: "flex-end", gap: 3 }}>
                                {p.type !== "misc" && C ? (<>
                                  <input tabIndex={-1} type="number" value={String(C.order)} onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })} data-c="order" className="ft-cell text-right" style={{ width: 42, flex: "none", padding: "6px 2px" }} title={`Cartons to order — type to override${cEx != null ? ` (exact ${cEx.toFixed(2)}, ${sf1(C.order * C.sf)} sf ordered)` : ""}`} />
                                  <span className="shrink-0" style={{ fontSize: 9.5 }}>{C.unit}</span>
                                  <span className="ft-noprint flex flex-col shrink-0 pr-1">
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(C.order + 1) })} title="One more carton" className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronUp size={9} /></button>
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(Math.max(0, C.order - 1)) })} title="One less carton" className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronDown size={9} /></button>
                                  </span>
                                </>) : p.type === "misc" || p.qtyType === "count" ? (<>
                                  <input type="number" value={p.qtyType === "count" ? p.qty : ""} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value, qtyType: "count" })} data-c="order" className="ft-cell text-right" style={{ width: 42, flex: "none", padding: "6px 2px" }} placeholder={p.type === "misc" ? "1" : "0"} title="Quantity" />
                                  {p.type === "misc" ? <span className="shrink-0 pr-1.5" style={{ fontSize: 9.5 }}>EA</span> : (
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { qtyType: "sqft" })} title="Counted each — click to switch to square feet" className="shrink-0 pr-1.5 font-semibold hover:text-slate-600" style={{ fontSize: 9.5 }}>EA</button>
                                  )}
                                </>) : (<>
                                  <span className="text-slate-500">{num(p.qty) > 0 ? sf1(num(p.qty)) : ""}</span>
                                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { qtyType: "count" })} title="Square feet — click to switch to counted each" className="shrink-0 pr-1.5 font-semibold hover:text-slate-600" style={{ fontSize: 9.5 }}>sf</button>
                                </>)}
                              </div>
                              <div style={{ ...gridCell, justifyContent: "flex-end", padding: "6px 8px", fontWeight: 700, background: totalTint }}>{line > 0 ? money(line) : PRINT_DASH}</div>
                              <div className="ft-noprint flex items-center justify-center gap-0.5" style={{ background: "var(--ft-area-row)" }}>
                                <button tabIndex={-1} onPointerDown={(e) => startDrag(e, a.id, p, pi)} title="Drag to reorder or move to another area" className="p-0.5 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={12} /></button>
                                {a.products.length > 1 && <button tabIndex={-1} onClick={() => setConfirmProd({ aid: a.id, pid: p.id })} title="Delete this selection" className="p-0.5 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>}
                              </div>
                            </div>
                            {confirmProd?.aid === a.id && confirmProd?.pid === p.id && (
                              <div className="ft-noprint flex items-center gap-2 px-3 py-1.5 text-xs" style={{ background: "var(--ft-area-row)" }}>
                                <span className="text-red-600 flex-1">Delete this selection{p.brandColor ? ` — "${p.brandColor}"` : ""}? Its materials come off the estimate too.</span>
                                <button onClick={() => { delProduct(a.id, p.id); setConfirmProd(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
                                <button onClick={() => setConfirmProd(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
                              </div>
                            )}
                            {(drift || oDrift || p.freightFlag || stockRetired || baseAlt) && (
                              <div className="ft-noprint flex items-center gap-2 text-xs flex-wrap" style={{ padding: "2px 12px 4px 26px" }}>
                                {drift && (<>
                                  <span className="text-amber-600">Price book now {money(drift.to)} — this row has {money(drift.from)}</span>
                                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { priceSqft: String(drift.to) })} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use new price</button>
                                </>)}
                                {oDrift && (<>
                                  <span className="text-amber-600">Price book now {money(oDrift.to)} — this row has {money(oDrift.from)}</span>
                                  {(oDrift.cost || oDrift.markup) && (
                                    <span className="text-slate-400">
                                      {oDrift.cost && `cost ${money(oDrift.cost.from)} → ${money(oDrift.cost.to)}`}
                                      {oDrift.cost && oDrift.markup && ", "}
                                      {oDrift.markup && `markup ${oDrift.markup.from}% → ${oDrift.markup.to}%`}
                                    </span>
                                  )}
                                  <button tabIndex={-1} onClick={() => { const priced = pricedItem(oItem, oBook?.data?.markups); const csf = rowCostSqft(oItem); updProduct(a.id, p.id, { priceSqft: String(oDrift.to), cost: oItem.cost != null ? String(oItem.cost) : "", costSqft: csf != null ? String(Math.round(csf * 100) / 100) : "", markupPct: priced.markupPct != null ? String(priced.markupPct) : "" }); }} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use new price</button>
                                </>)}
                                {p.freightFlag && <span className="shrink-0 rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 font-medium">+ freight</span>}
                                {baseAlt && (
                                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, stockPatch(baseAlt, p))} className="rounded-full border border-slate-300 text-slate-600 px-2 py-0.5 hover:bg-slate-50 font-medium">Use {baseAlt.style || baseAlt.description}</button>
                                )}
                                {stockRetired && <span className="text-slate-400">SKU {p.sku} is no longer in the stock price book</span>}
                              </div>
                            )}
                            {/* Materials footer. The collapsed pill/summary/note (below)
                                stays in normal flow so opening the drawer never reflows the
                                page; the open drawer is a modal that overlays that footprint
                                (absolute, top:0) and floats down over the rows below. A
                                dimmed, lightly blurred backdrop covers everything else —
                                signalling the drawer must be clicked out of — and folds it
                                when clicked. Each material shows checked (full controls) or
                                unchecked (slim card, click ✓ to add). */}
                            {(pInline.length > 0 || warns.length > 0 || (!hasMats && addables.length > 0) || p.note || (matExpanded && p.type !== "misc")) && (
                            <div style={{ position: "relative" }}>
                            {matExpanded && p.type !== "misc" && (
                              <>
                              <div className="ft-noprint" style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(20,15,10,.14)", backdropFilter: "blur(0.6px)", WebkitBackdropFilter: "blur(0.6px)" }} onClick={closeMats} />
                              <div style={{ position: "absolute", left: 0, top: 0, zIndex: 45, width: "100%", background: rowTint, padding: "4px 8px 7px 26px", borderLeft: matBorder, borderRight: matBorder, borderBottom: matBorder, boxShadow: "0 10px 24px rgba(20,15,10,.16)" }}>
                              <div className="ft-mats" style={{ background: matBoxBg, border: chipBorder, overflow: "hidden", "--mat-acc": accent }}>
                                {p.type === "tile" && p.grout.checked && (
                                  <div className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                      <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, checked: false } })} title="Remove grout" className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                      <span className="text-sm font-medium">Grout</span>
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        <FitSelect sm value={p.grout.product} display={p.grout.product} onChange={(e) => pickGroutProduct(e.target.value)}>{groutOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                                        <span className="inline-flex items-center gap-1 min-w-0">
                                          <span className="shrink-0" style={{ width: 10, height: 10, borderRadius: 999, background: p.grout.color ? "#C9B79D" : "#F4F2EC", border: "1px solid #B3A38D" }} />
                                          <FitSelect sm value={p.grout.color} display={p.grout.color || "Color…"} onChange={(e) => pickGroutColor(e.target.value)}><option value="">Color…</option>{colorOpts.map((c) => <option key={c}>{c}</option>)}</FitSelect>
                                        </span>
                                        {(p.grout.sku || settings.grouts[p.grout.product]?.sku) && <span className="ft-mono text-[10px] text-slate-400 shrink-0" title="This color's price book SKU — prints on the order summary">{p.grout.sku || settings.grouts[p.grout.product]?.sku}</span>}
                                        <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px] shrink-0">{JOINTS.map((j) => <button tabIndex={-1} key={j.v} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, joint: j.v } })} className={`px-1.5 py-1 ${num(p.grout.joint) === j.v ? "" : "ft-field text-slate-500 hover:bg-slate-50"}`} style={num(p.grout.joint) === j.v ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>{j.label}</button>)}</div>
                                      </div>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{gEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{gEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={G ? String(G.order) : ""} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{gUnit}</span></span>
                                      {!G && <div className="order-last basis-full text-xs text-amber-500">Enter Sq Ft + tile L/W/thickness to calculate, or type a total above.</div>}
                                    </div>
                                    <div className="mt-1.5 pl-7 flex items-center gap-2 text-xs text-slate-500">
                                      <span className="text-slate-400">Matching caulk</span>
                                      {p.grout.color && <span className="inline-flex items-center gap-1"><span className="shrink-0" style={{ width: 9, height: 9, borderRadius: 999, background: "#C9B79D", border: "1px solid #B3A38D" }} />{p.grout.color} match</span>}
                                      {p.grout.caulkSku && <span className="ft-mono text-[10px] text-slate-400">{p.grout.caulkSku}</span>}
                                      <span className="ml-auto flex items-center gap-1"><input tabIndex={-1} type="number" value={p.grout.caulk} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, caulk: e.target.value } })} placeholder="—" title="Matching caulk for this grout color — tubes to order; leave blank for none" className={`w-10 text-right rounded border px-1 py-0.5 ft-field focus:border-indigo-500 focus:outline-none ${p.grout.caulk ? "border-indigo-300 text-indigo-700 font-semibold" : "border-slate-200"}`} /><span>tubes</span></span>
                                    </div>
                                  </div>
                                )}
                                {p.type === "tile" && !p.grout.checked && (
                                  <div className="px-2.5 py-1 flex items-center gap-2">
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, checked: true } })} title="Add grout" className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                    <span className="text-sm text-slate-500">Grout</span>
                                    <span className="text-xs text-slate-400 truncate">{p.grout.product || groutNames[0] || ""}</span>
                                  </div>
                                )}
                                {p.type === "tile" && p.mortar.checked && (
                                  <div className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                      <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { mortar: { ...p.mortar, checked: false } })} title="Remove mortar" className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                      <span className="text-sm font-medium">Mortar</span>
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        <FitSelect sm value={p.mortar.product} display={p.mortar.product} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, product: e.target.value } })}>{mortarOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                                        {settings.mortars[p.mortar.product]?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{settings.mortars[p.mortar.product]?.sku}</span>}
                                      </div>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{mEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{mEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={M ? String(M.order) : ""} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{mUnit}</span></span>
                                    </div>
                                  </div>
                                )}
                                {p.type === "tile" && !p.mortar.checked && (
                                  <div className="px-2.5 py-1 flex items-center gap-2">
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { mortar: { ...p.mortar, checked: true } })} title="Add mortar" className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                    <span className="text-sm text-slate-500">Mortar</span>
                                    <span className="text-xs text-slate-400 truncate">{p.mortar.product || mortarNames[0] || ""}</span>
                                  </div>
                                )}
                                {p.type !== "misc" && p.underlay.checked && (
                                  <div className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                      <button tabIndex={-1} onClick={toggleUnderlay} title={`Remove ${underlayLabel(p.type).toLowerCase()}`} className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                      <span className="text-sm font-medium">{KSHORT[underlayLabel(p.type)]}</span>
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        {underlayOpts.length > 0 ? (
                                          <FitSelect sm value={p.underlay.product} display={p.underlay.product || "Select…"} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, product: e.target.value } })}>{!p.underlay.product && <option value="">Select…</option>}{underlayOpts.map((u) => <option key={u} value={u}>{u}</option>)}</FitSelect>
                                        ) : (
                                          <span className="text-amber-500 text-xs">No {underlayLabel(p.type).toLowerCase()} products for {TLBL[p.type]} yet — add them in Settings.</span>
                                        )}
                                        {settings.underlayments[p.underlay.product]?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{settings.underlayments[p.underlay.product]?.sku}</span>}
                                      </div>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{uEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{uEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={U ? String(U.order) : ""} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{underlayUnit}</span></span>
                                    </div>
                                    {installDefs.length > 0 && (
                                      <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--ft-border)" }}>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, install: !p.underlay.install } })} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${p.underlay.install ? "" : "border border-slate-300"}`} style={p.underlay.install ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>{p.underlay.install && <Check size={10} />}</button>
                                    {p.underlay.install ? (
                                      <button onClick={() => setInsOpen((o) => ({ ...o, [p.id]: !insExpanded }))} className="flex items-center gap-1 text-xs min-w-0">
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
                                    <div className="mt-1 ml-6 space-y-1">
                                      {installDefs.map((d) => {
                                        const skipped = !!p.underlay.installSkip?.[d.id];
                                        const item = insById.get(d.id);
                                        const cur = p.underlay.installMortars?.[d.id] || d.product;
                                        const opts = cur && !mortarNames.includes(cur) ? [cur, ...mortarNames] : mortarNames;
                                        return (
                                          <div key={d.id} className="flex items-center gap-2">
                                            <button onClick={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, installSkip: { ...(p.underlay.installSkip || {}), [d.id]: !skipped } } })} title={skipped ? "Skipped — click to include" : "Included — click to skip"} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${skipped ? "border border-slate-300" : ""}`} style={skipped ? undefined : { background: accent, color: "var(--ft-type-ink)" }}>{!skipped && <Check size={10} />}</button>
                                            {d.kind === "mortar" && !skipped ? (
                                              <FitSelect sm value={cur} display={cur || "Select mortar…"} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, installMortars: { ...(p.underlay.installMortars || {}), [d.id]: e.target.value } } })} title="Mortar used to set the underlayment — combines with this job's other mortar totals">
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
                                  </div>
                                )}
                                {p.type !== "misc" && !p.underlay.checked && (
                                  <div className="px-2.5 py-1 flex items-center gap-2">
                                    <button tabIndex={-1} onClick={toggleUnderlay} title={`Add ${underlayLabel(p.type).toLowerCase()}`} className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                    <span className="text-sm text-slate-500">{KSHORT[underlayLabel(p.type)]}</span>
                                    <span className="text-xs text-slate-400 truncate">{p.underlay.product || underlayNames[0] || ""}</span>
                                  </div>
                                )}
                              </div>
                              {noteInput}
                              </div>
                              </>
                            )}
                            {(stripMats.length > 0 || warns.length > 0) && (
                              <div style={{ background: rowTint, width: "calc(100% - 44px)", padding: "4px 8px 7px 26px" }}>
                              <button onClick={openMats} className="flex items-center flex-wrap text-left" style={{ width: "100%", padding: "4px 7px", columnGap: 12, rowGap: 3, fontSize: 9.5, color: "var(--ft-muted)", background: rowTint, border: "1px solid var(--ft-border)" }} title="Materials — click to edit">
                                {stripMats.map((m, i) => (
                                  <span key={i} className="inline-flex items-center" style={{ gap: 4 }}>
                                    <span style={{ fontWeight: 700, color: accent }}>{KSHORT[m.kind]}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : m.name}{m.spec && m.kind !== "Caulk" ? <> — <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 999, background: "#C9B79D", border: "1px solid #B3A38D", display: m.kind === "Grout" ? "inline-block" : "none" }} /> {m.spec}</> : ""}{m.detail ? <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span> : ""}
                                  </span>
                                ))}
                                {warns.map((w) => (
                                  <span key={w} className="ft-warn-orange inline-flex items-center font-semibold" style={{ gap: 4 }}>
                                    <AlertTriangle size={10} /> {WLBL[w]} — not calculating
                                  </span>
                                ))}
                                <span className="flex-1" />
                                {matsCost > 0 && <span className="ft-mono" style={{ fontSize: 9, color: "var(--ft-muted)" }}>+ {money(matsCost)}</span>}
                              </button>
                              {p.note ? noteInput : null}
                              </div>
                            )}
                            {stripMats.length === 0 && warns.length === 0 && !hasMats && addables.length > 0 && (
                              <div style={{ background: rowTint, width: "calc(100% - 44px)", padding: "4px 8px 7px 26px" }}>
                              <button onClick={openMats} className="ft-noprint flex items-center text-left" style={{ width: "100%", padding: "4px 7px", fontSize: 9.5, color: "var(--ft-muted)", border: "1px dashed var(--ft-border)" }} title="Materials — click to choose">
                                ＋ {addables.join(" · ")}…
                              </button>
                              {p.note ? noteInput : null}
                              </div>
                            )}
                            {stripMats.length === 0 && warns.length === 0 && (hasMats || addables.length === 0) && p.note && (
                              <div className="flex items-center" style={{ padding: "1px 12px 4px 26px" }}>
                                {noteInput}
                              </div>
                            )}
                            </div>
                            )}
                            </>)}
                          </div>
                        );
                      })}
                      {drag?.to?.aid === a.id && <div className="absolute left-1 right-1 h-1.5 rounded-full bg-indigo-600 pointer-events-none" style={{ top: drag.to.y, marginTop: 0 }} />}
                    </div>
                  </div>
                  );
                })}
              </div>

              {sel.categories.length > 0 && (
                <button onClick={addArea} className="ft-noprint mt-4 w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg border border-dashed border-slate-300 py-2.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> Add area</button>
              )}

              {(totalSqft > 0 || hasMat || miscCost > 0) && (
                <div className="mt-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-band)", padding: "10px 16px" }}>
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <span className="uppercase shrink-0" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Materials Estimate</span>
                      <span className="ft-serif" style={{ fontSize: 20 }}>Order summary</span>
                    </div>
                    {groutCost + baseCost + caulkCost + mortarCost + underlayCost > 0 && <span className="ft-mono shrink-0" style={{ fontSize: 10.5 }}>{money(groutCost + baseCost + caulkCost + mortarCost + underlayCost)} materials</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-6" style={{ padding: 16 }}>
                    <div>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Grout</div>
                      {gList.length + bList.length + cList.length === 0 ? <div className="text-sm text-slate-400">—</div> : [...gList, ...bList.map((b) => ({ product: b.name, sku: b.sku, color: "—", order: b.order, unit: b.unit, cost: b.cost, price: b.price, pending: false })), ...cList.map((c) => ({ ...c, product: `${c.product} caulk` }))].map((g, i) => (
                        <div key={"g" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                          <span className="font-medium min-w-0">{g.product}{g.color !== "—" && <span className="text-slate-500 font-normal"> · {g.color}</span>}{g.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{g.sku}</span>}</span>
                          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{g.pending ? "—" : <>{g.order} {g.unit}</>}{g.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.cost)}</span> : g.pending && g.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.price)}/{u1(1, g.unit)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Mortar</div>
                      {mList.length === 0 ? <div className="text-sm text-slate-400">—</div> : mList.map((m, i) => (
                        <div key={"m" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                          <span className="font-medium min-w-0">{m.product}{m.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{m.sku}</span>}</span>
                          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{m.pending ? "—" : <>{m.order} {m.unit}</>}{m.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(m.cost)}</span> : m.pending && m.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(m.price)}/{u1(1, m.unit)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Underlayment</div>
                      {uList.length === 0 ? <div className="text-sm text-slate-400">—</div> : uList.map((u, i) => (
                        <div key={"u" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                          <span className="font-medium min-w-0">{u.product}{u.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{u.sku}</span>}</span>
                          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{u.pending ? "—" : <>{u.order} {u.unit}</>}{u.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(u.cost)}</span> : u.pending && u.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(u.price)}/{u1(1, u.unit)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Flooring</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(flooringPrice)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Grout &amp; caulk</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(groutCost + baseCost + caulkCost)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Mortar</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(mortarCost)}</span></div>
                        {underlayCost > 0 && <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Underlayment</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(underlayCost)}</span></div>}
                        {miscCost > 0 && <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Miscellaneous</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(miscCost)}</span></div>}
                        <div className="flex justify-between items-baseline" style={{ marginTop: 4, paddingTop: 10, borderTop: "2px solid var(--ft-text)" }}><span style={{ fontSize: 13, fontWeight: 700 }}>Total</span><span className="ft-serif" style={{ fontSize: 26, lineHeight: 1 }}>{money(grandTotal)}</span></div>
                        <MarginLine margin={margin} show={showMargin} onToggle={() => setShowMargin((v) => !v)} />
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--ft-faint)", marginTop: 10 }}>Figures include {wasteNote(settings)}. Verify before ordering.</div>
                    </div>
                  </div>
                </div>
              )}
              </div>
              {viewTab === "preview" && (
                <div className="rounded-lg py-6 px-3 md:px-6" style={{ background: "color-mix(in oklab, var(--ft-text) 6%, var(--ft-cream))" }}>
                  <div className="ft-light bg-white text-black rounded-sm shadow-lg mx-auto" style={{ maxWidth: 780, padding: "clamp(18px,3vw,38px)" }}>
                    {renderEstimatePaper()}
                  </div>
                  <div className="text-center mt-4">
                    <button onClick={() => setPrintMode("estimate")} className="inline-flex items-center gap-1.5 text-sm rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 font-semibold"><Printer size={15} /> Print</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* PRINT VIEW — the print buttons pick the layout: estimate (default, also Ctrl+P) or order sheet */}
      <div className="ft-light hidden print:block text-black p-2">
        {sel && sel._full && (printMode === "order" ? (
          <div>
            <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-3">
              <div className="font-bold text-xl">Order sheet</div>
              <div className="text-sm">{sel.name} · {new Date().toLocaleDateString()}</div>
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="ft-eyebrow text-[8.5px] text-slate-500 border-b border-slate-400">
                  <th className="w-6 py-1" />
                  <th className="text-left font-semibold py-1 pr-2">Item</th>
                  <th className="text-left font-semibold py-1 pr-2">SKU</th>
                  <th className="text-left font-semibold py-1 pr-2">Area</th>
                  <th className="text-right font-semibold py-1">Order</th>
                </tr>
              </thead>
              <tbody>
                {sel.categories.flatMap((a, ai) => a.products.filter((p) => !rowBlank(p)).map((p) => { const c = printProduct(p, settings); return (
                  <tr key={p.id} className="border-b border-slate-200 align-baseline">
                    <td className="py-1.5 text-center text-slate-400">☐</td>
                    <td className="py-1.5 pr-2"><b>{p.brandColor || TLBL[p.type]}</b> <span className="text-slate-500">{[p.brandColor ? TLBL[p.type] : "", c.size].filter(Boolean).join(", ")}</span></td>
                    <td className="py-1.5 pr-2 ft-mono text-[11px]">{p.sku}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{areaLabel(a, ai)}</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{c.qtyText}{c.C && c.C.order > 0 && <> = {sf1(c.orderedSf)} sf<span className="text-slate-400 font-normal text-[10.5px]"> ({c.C.exact.toFixed(2)})</span></>}</td>
                  </tr>
                ); }))}
                {matLines.map((m, i) => (
                  <tr key={"mat" + i} className="border-b border-slate-200 align-baseline">
                    <td className="py-1.5 text-center text-slate-400">☐</td>
                    <td className="py-1.5 pr-2">{m.product} <span className="text-slate-400 text-[10.5px]">{m.kind}</span></td>
                    <td className="py-1.5 pr-2 ft-mono text-[11px]">{m.sku || ""}</td>
                    <td className="py-1.5 pr-2 text-slate-500">all areas</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{m.order} {m.unit} <span className="text-slate-400 font-normal text-[10.5px]">({m.exact.toFixed(2)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs mt-3 text-slate-600">Quantities and prices are estimates, incl. {wasteNote(settings)}. Confirm against product specs and final measurements before ordering.</div>
          </div>
        ) : renderEstimatePaper())}
      </div>

      {/* Settings — PC-first workspace (issue 007); all writes still flow
          through setSettings / the import + backup handlers. */}
      {showSettings && (
        <SettingsWorkspace onClose={() => setShowSettings(false)}
          settings={settings} setSettings={setSettings} stock={stock} gFamilies={gFamilies}
          importing={importing} importPriceBook={importPriceBook} pbRef={pbRef}
          exportBackup={exportBackup} importBackup={importBackup} fileRef={fileRef}
          inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} theme={theme} setTheme={setTheme}
          profile={profile} saveProfile={saveProfile} user={user}
          books={books} addBook={addBook} updateBook={updateBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImport}
          loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} rollbackStock={rollbackStock} />
      )}

      {showTodos && (
        <Modal onClose={() => setShowTodos(false)} title="Issues & To-Do">
          <TeamTodos todos={todos} onAdd={addTodo} onToggle={toggleTodo} onDelete={delTodo} onReorder={reorderTodos} onClearDone={clearDoneTodos} inp={inp} />
        </Modal>
      )}

      {showOrderCopy && sel && sel._full && (() => {
        const rows = [];
        (sel.categories || []).forEach((a, ai) => a.products.forEach((p) => { if (!rowBlank(p)) rows.push(orderEntryRow(p, settings, areaLabel(a, ai))); }));
        const mats = matLines.map((m, i) => ({ id: "mat" + i, sku: m.sku || "", qty: m.order, qtyText: `${m.order} ${m.unit}`, name: m.product, kind: m.kind }));
        return <OrderEntryPanel name={sel.name} special={rows.filter((r) => r.special)} stock={[...rows.filter((r) => !r.special), ...mats]} onClose={() => setShowOrderCopy(false)} />;
      })()}

      {custModal && (() => {
        const c = data.people.find((x) => x.id === custModal);
        if (!c) return null;
        const projs = projectsOf(c.id);
        return (
          <Modal onClose={() => setCustModal(null)} title={c.name || "Customer"}>
            <div className="space-y-3">
              <div><label className={lbl}>Name</label><input value={c.name} onChange={(e) => updatePerson(c.id, { name: e.target.value })} placeholder="Customer name" className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Phone</label><input value={c.phone} onChange={(e) => updatePerson(c.id, { phone: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Email</label><input value={c.email} onChange={(e) => updatePerson(c.id, { email: e.target.value })} className={inp} /></div>
              </div>
              <div><label className={lbl}>Mailing address</label><input value={c.address} onChange={(e) => updatePerson(c.id, { address: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Builder</label><BuilderCombo value={c.builderId} builders={data.builders} inp={inp} onSelect={(bid) => updatePerson(c.id, { builderId: bid })} onAddBuilder={(name) => addBuilderFor(c.id, name)} /></div>
              <div><label className={lbl}>Customer notes</label><textarea value={c.notes} onChange={(e) => updatePerson(c.id, { notes: e.target.value })} rows={2} className={inp} /></div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className={lbl + " mb-0"}>Projects ({projs.length})</label>
                <button onClick={() => { setCustModal(null); addProject(c.id); }} className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-indigo-700"><Plus size={13} /> New project</button>
              </div>
              {projs.length === 0 ? <div className="text-sm text-slate-400 rounded-md border border-dashed border-slate-200 px-3 py-2.5">No projects yet.</div> : (
                <div className="rounded-md border border-slate-200 divide-y divide-slate-100">
                  {projs.map((p) => (
                    <button key={p.id} onClick={() => { setCustModal(null); pickProject(p.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <FileText size={13} className="text-slate-300 shrink-0" />
                      <span className="text-sm truncate flex-1">{p.name || "Untitled project"}</span>
                      {p.updatedAt && <span className="ft-mono text-[11px] text-slate-400 shrink-0">{fmtAgo(p.updatedAt)}</span>}
                      <ChevronRight size={14} className="text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => { setCustModal(null); setConfirm({ kind: "person", id: c.id }); }} className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-red-500"><Trash2 size={14} /> Delete customer</button>
              <button onClick={() => setCustModal(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Done</button>
            </div>
          </Modal>
        );
      })()}

      {importPreview && (() => {
        const { parsed, diff, warnings, sync } = importPreview;
        const total = diff.added.length + diff.changed.length + diff.missing.length;
        const money2 = (n) => (n == null ? "—" : money(n));
        const itemPrice = (it) => (it.priceSqft != null && it.type ? it.priceSqft : it.price);
        return (
          <Modal onClose={() => setImportPreview(null)} title="Import price book">
            <p className="text-sm text-slate-600 mb-3"><b>{parsed.length}</b> items read · <b>{diff.added.length}</b> new · <b>{diff.changed.length}</b> changed · <b>{diff.missing.length}</b> no longer listed · {diff.unchanged.length} unchanged</p>
            {total === 0 && sync.changes.length === 0 && <p className="text-sm text-slate-400 mb-3">Everything already matches the current stock list — nothing to apply.</p>}
            {diff.changed.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Changed items</label>
                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100 text-xs">
                  {diff.changed.slice(0, 60).map(({ item, prev, fields }) => (
                    <div key={item.sku} className="px-2.5 py-1.5 flex items-baseline gap-2">
                      <span className="ft-mono text-slate-400 shrink-0">{item.sku}</span>
                      <span className="truncate flex-1">{item.description}</span>
                      <span className="shrink-0 ft-mono">{fields.includes("price") || fields.includes("priceSqft") ? <>{money2(itemPrice(prev))} → <b>{money2(itemPrice(item))}</b></> : <span className="text-slate-400">{fields.join(", ") || "re-activated"}</span>}</span>
                    </div>
                  ))}
                  {diff.changed.length > 60 && <div className="px-2.5 py-1.5 text-slate-400">…and {diff.changed.length - 60} more</div>}
                </div>
              </div>
            )}
            {diff.missing.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>No longer listed (marked inactive, never deleted)</label>
                <div className="text-xs text-slate-500 max-h-24 overflow-y-auto rounded-md border border-slate-200 px-2.5 py-1.5">{diff.missing.slice(0, 30).map((it) => it.sku).join(", ")}{diff.missing.length > 30 ? ` …and ${diff.missing.length - 30} more` : ""}</div>
              </div>
            )}
            {sync.changes.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Catalog price updates (grout / mortar / underlayment)</label>
                <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100 text-xs">
                  {sync.changes.map((c) => <div key={c.name} className="px-2.5 py-1.5 flex items-baseline gap-2"><span className="truncate flex-1">{c.name}</span><span className="shrink-0 ft-mono">{money(c.from)} → <b>{money(c.to)}</b></span><span className="ft-mono text-slate-400 shrink-0">SKU {c.sku}</span></div>)}
                </div>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Warnings</label>
                <div className="text-xs text-amber-600 space-y-1 max-h-28 overflow-y-auto">{warnings.slice(0, 12).map((w, i) => <div key={i}>{w}</div>)}{warnings.length > 12 && <div>…and {warnings.length - 12} more</div>}</div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportPreview(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={applyImport} disabled={total === 0 && sync.changes.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Apply import{total > 0 ? ` — ${diff.added.length} new · ${diff.changed.length} changed · ${diff.missing.length} retired` : ""}</button>
            </div>
          </Modal>
        );
      })()}

      {showVersions && sel && (
        <Modal onClose={() => setShowVersions(false)} title="Saved Versions">
          {(!sel.versions || sel.versions.length === 0) ? <p className="text-sm text-slate-400">No versions yet. Use "Version" to snapshot the current selections.</p> : (
            <div className="space-y-2">{sel.versions.map((v) => (<div key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><div className="flex-1 min-w-0"><div className="text-sm font-medium flex items-center gap-1.5 truncate">{v.label}{v.auto && <span className="ft-eyebrow text-[8.5px] tracking-[.1em] bg-slate-100 rounded px-1.5 py-0.5 shrink-0">Auto</span>}</div><div className="text-xs text-slate-400">{new Date(v.savedAt).toLocaleString()}</div></div><button onClick={() => loadVersion(v)} className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Restore</button><button onClick={() => delVersion(v.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button></div>))}</div>
          )}
          <p className="text-xs text-slate-400 mt-4">Auto versions are saved when you leave a job after changing its selections — the newest {AUTO_KEEP} are kept. Named versions are kept until you delete them.</p>
        </Modal>
      )}

      {confirm && (confirm.kind === "person" ? (
        <Modal onClose={() => setConfirm(null)} title="Delete customer?">
          <p className="text-sm text-slate-500 mb-4">This removes the customer for everyone. Their projects are kept but become <b>unassigned</b> — reassign them to another customer afterward. Consider a backup export first.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button><button onClick={() => delPerson(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button></div>
        </Modal>
      ) : (
        <Modal onClose={() => setConfirm(null)} title="Delete project?">
          <p className="text-sm text-slate-500 mb-4">This permanently removes the project — with all its selections, versions, and attachments — for everyone. Consider a backup export first.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button><button onClick={() => delProject(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button></div>
        </Modal>
      ))}

      {newCust !== null && (() => {
        const m = matchName(data.people, newCust);
        const create = () => { const c = addPerson(newCust.trim()); setNewCust(null); setCustModal(c.id); return c; };
        const useExisting = (id) => { setNewCust(null); setOpenCust((s) => ({ ...s, [id]: true })); setCustModal(id); };
        const n = m ? projectsOf(m.item.id).length : 0;
        return (
          <Modal onClose={() => setNewCust(null)} title="New customer">
            <p className="text-sm text-slate-500 mb-3">Type the customer's name. If they already exist, jump straight to them instead of making a duplicate.</p>
            <input autoFocus value={newCust} onChange={(e) => setNewCust(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (m) useExisting(m.item.id); else if (newCust.trim()) create(); } if (e.key === "Escape") setNewCust(null); }}
              placeholder="e.g. Sarah Jones" className={inp} />
            {m && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <div className="font-semibold mb-0.5">{m.kind === "exact" ? `A customer named "${m.item.name}" already exists` : `Did you mean "${m.item.name}"?`}</div>
                <div className="text-amber-700">{n} project{n === 1 ? "" : "s"}. Open them instead of creating a duplicate?</div>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <button onClick={() => useExisting(m.item.id)} className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-[13px] font-medium hover:bg-amber-700">Use {m.item.name}</button>
                  <button onClick={create} className="rounded-md border border-amber-300 px-3 py-1.5 text-[13px] hover:bg-amber-100">Create separate customer</button>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setNewCust(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={create} disabled={!newCust.trim()} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-40">Create customer</button>
            </div>
          </Modal>
        );
      })()}

      {toast && <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg z-50">{toast}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="ft-serif text-2xl">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

// Display unit codes for the order-entry panel. The order unit ("ct"/"sh" for
// carton/sheet-billed rows, "units" for a piece count, "ea" for misc, "sf" for
// square-foot flooring) becomes a short uppercase code shown on the qty and the
// per-unit cost/sell — so a line always reads in the unit it's bought and sold.
const ORDER_UNIT_CODE = { ct: "CT", sh: "SH", sf: "SF", units: "PC", ea: "EA" };

// One product row → the fields the order-entry panel shows. Special-order rows
// (bookId set) carry a snapshotted cost; the sell is the row's line total, and
// the cost is the honest vendor cost carried through the same quantity math
// (orderLineCost) — so a hand-edited sale price moves the margin, not the cost.
// Per-unit values are the extended totals ÷ ordered qty, so they read in the
// sell unit (per carton / sheet / piece / sf). The item text
// splits at the SKU: size + color on top, SKU + coverage beneath — thickness
// dropped, spaces only. Carton/sheet rows lead with a CT/SH tag (also in the
// copied text) since the order-entry system can't be switched off "each".
// Read-only; no math is mutated.
function orderEntryRow(p, s, area) {
  const c = printProduct(p, s);
  const isMisc = p.type === "misc";
  const qty = isMisc ? miscQty(p) : (c.C ? c.C.order : num(p.qty));
  const rawUnit = isMisc ? "ea" : (c.C ? c.C.unit : (p.qtyType === "sqft" ? "sf" : "units"));
  const unitCode = ORDER_UNIT_CODE[rawUnit] || String(rawUnit || "").toUpperCase();
  // Only carton/sheet-billed lines flag a non-"each" order unit.
  const tag = c.C ? unitCode : "";
  const sizePlain = p.type === "tile" ? (p.sizeText || `${p.L}" × ${p.W}"`) : (p.sizeText || "");
  const coverage = num(p.cartonSf) > 0 ? `${sf1(num(p.cartonSf))} SF/${unitCode}` : "";
  const extSell = c.line;
  const extCost = orderLineCost(p, s, extSell);
  const copy = [tag, sizePlain, p.brandColor, p.sku, coverage].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  return {
    id: p.id, special: !!p.bookId, area,
    tag, sizePlain, name: p.brandColor, sku: p.sku, coverage,
    qty, unitCode, qtyText: qty > 0 ? `${qty} ${unitCode}` : "—",
    perCost: qty > 0 ? extCost / qty : 0,
    perSell: qty > 0 ? extSell / qty : 0,
    copy,
  };
}

// The shared team issue / to-do list (issue 006). Open items are ordered by
// priority — drag the handle to put the most important on top; done items drop
// to a struck-through section below. All writes flow up through the on* props.
function TeamTodos({ todos, onAdd, onToggle, onDelete, onReorder, onClearDone, inp }) {
  const [text, setText] = useState("");
  const [to, setTo] = useState(null); // insertion bar while dragging: { index, y }
  const listRef = useRef(null);
  const open = todos.filter((t) => !t.done).sort((a, b) => a.position - b.position);
  const doneList = todos.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const submit = () => { const v = text.trim(); if (!v) return; onAdd(v); setText(""); };

  // Pointer drag of an open row (mouse + touch): the handle captures the
  // pointer, the row follows vertically, and the other rows' midpoints decide
  // the insertion index. Data is written once, on drop, through onReorder.
  const startDrag = (e, index) => {
    if (e.button != null && e.button !== 0) return;
    const handle = e.currentTarget;
    const row = handle.closest("[data-todo-row]");
    const list = listRef.current;
    if (!row || !list) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (x) { }
    const startY = e.clientY;
    let target = index;
    Object.assign(row.style, { position: "relative", zIndex: 30, scale: "1.02", boxShadow: "0 10px 26px rgba(40,30,20,.18)" });
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      row.style.translate = `0 ${ev.clientY - startY}px`;
      const rows = [...list.querySelectorAll("[data-todo-row]")].filter((r) => r !== row);
      let idx = 0;
      for (const r of rows) { const rc = r.getBoundingClientRect(); if (ev.clientY > rc.top + rc.height / 2) idx++; }
      if (idx === target) return;
      target = idx;
      if (idx === index) return setTo(null); // dropping back where it came from
      const lr = list.getBoundingClientRect();
      const y = rows.length === 0 ? 0 : idx < rows.length ? rows[idx].getBoundingClientRect().top - lr.top - 5 : rows[rows.length - 1].getBoundingClientRect().bottom - lr.top + 3;
      setTo({ index: idx, y });
    };
    const finish = (commit) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      Object.assign(row.style, { position: "", zIndex: "", scale: "", boxShadow: "", translate: "" });
      setTo(null);
      if (commit && target !== index) onReorder(index, target);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === "Escape") finish(false); };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Shared with the whole team — anyone can add bugs, feature ideas, or shop reminders. Drag the handle to put the most important on top; check an item off when it's handled.</p>
      <div className="flex gap-2 mb-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Add an issue or idea…" className={inp} />
        <button onClick={submit} disabled={!text.trim()} className="shrink-0 flex items-center gap-1 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 disabled:opacity-50"><Plus size={15} /> Add</button>
      </div>
      {open.length === 0 && doneList.length === 0 && <p className="text-sm text-slate-400">Nothing on the list yet. (If new items won't save, run supabase/todos.sql once.)</p>}
      <div ref={listRef} className="relative space-y-1.5">
        {to && <div className="absolute left-1 right-1 h-1 rounded-full bg-indigo-600 pointer-events-none z-10" style={{ top: to.y }} />}
        {open.map((t, i) => (
          <div key={t.id} data-todo-row className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <button onPointerDown={(e) => startDrag(e, i)} title="Drag to reorder" className="shrink-0 mt-0.5 -m-1 p-1 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={14} /></button>
            <button onClick={() => onToggle(t.id)} title="Mark done" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 border-slate-300 hover:border-indigo-600 flex items-center justify-center text-transparent hover:text-indigo-600"><Check size={11} strokeWidth={3} /></button>
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-snug break-words">{t.text}</div>
              {(t.createdBy || t.createdAt) && <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>}
            </div>
            <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {doneList.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="ft-eyebrow text-[9px]">Done ({doneList.length})</div>
            <button onClick={onClearDone} className="text-[11px] text-slate-400 hover:text-red-500">Clear done</button>
          </div>
          <div className="space-y-1.5">
            {doneList.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                <button onClick={() => onToggle(t.id)} title="Reopen — puts it back on top" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"><Check size={11} strokeWidth={3} /></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug break-words line-through text-slate-400">{t.text}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.doneAt ? "done " + new Date(t.doneAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// The shared grout/mortar catalog editor: a Company → Product tree. Each company
// and product has an enabled checkbox (show/hide for the job dropdowns); a
// product's numbers are shown and editable only while it is enabled, but stay
// stored when off. All edits flow up through onChange(newCatalog).
// The PC-first Settings workspace (issue 007): near-fullscreen, left-nav
// sections, master→detail catalog editing. Pure UI — every write still flows
// through setSettings and the import/backup handlers passed in from App.
// --- Price book library (ADR 0009, Phase 1) ---------------------------------
//
// The Settings "Price book" section grown into a library: the stock workbook
// plus registry books (stock- and order-kind). Order books import via a saved
// column mapping and store a vendor COST; a flat default markup turns that into
// a browse-time selling price (the markup editor and pick snapshot are Phase 2).
// A session-local "hide costs" toggle masks every cost/margin figure for
// over-the-shoulder moments — presentation only, never stored, never printed.

const bookFieldOptions = [
  ["", "— ignore —"], ["sku", "SKU"], ["cost", "Cost"], ["description", "Description"],
  ["mfg", "Manufacturer"], ["productLine", "Product line"], ["color", "Color"], ["style", "Style"],
  ["unit", "Unit (U/M)"], ["priceUnit", "Price unit (cost basis)"], ["orderUnit", "Order unit (No Broken)"],
  ["size", "Size"], ["thickness", "Thickness"], ["sfPerUnit", "SF per carton"], ["pcPerUnit", "Pieces per carton"],
  ["coverage", "Coverage"], ["leadTime", "Lead time"], ["msrp", "MSRP / consumer"], ["brand", "Brand"],
  ["section", "Section"], ["note", "Notes"], ["type", "Flooring type"], ["flag", "Status flag"],
];
const FLAG_SEMANTICS = [["", "— ignore —"], ["discontinued", "Discontinued"], ["freight", "Extra freight"], ["madeToOrder", "Made to order"], ["transitioning", "Transitioning"]];

// guessBookField / guessHeaderRow moved to src/pricebook.js (pure + tested);
// bookFieldOptions / FLAG_SEMANTICS above stay here as UI dropdown lists.

// Amber chip for a stale book (§8.3): last imported longer ago than the
// staleness threshold. A months-old vendor cost list quietly misprices jobs, so
// the age is surfaced wherever the book is named.
function StaleChip({ days }) {
  return (
    <span title={`Last imported ${days} days ago — vendors re-issue cost lists roughly quarterly; re-import to be sure prices are current`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle size={11} /> Stale · {days}d
    </span>
  );
}

function PriceBookLibrary({ books, stock, addBook, updateBook, delBook, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, rollbackStock, importing, importPriceBook, pbRef, settings, setSettings, gFamilies, inp, lbl, types, typeLabels }) {
  const [sel, setSel] = useState("stock"); // "stock" | bookId
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("order");
  const [newName, setNewName] = useState("");
  const [hideCosts, setHideCosts] = useState(false);

  const stockBooks = books.filter((b) => b.kind === "stock");
  const orderBooks = books.filter((b) => b.kind === "order");
  const selBook = sel === "stock" ? null : books.find((b) => b.id === sel);
  const stockCount = stock.filter((s) => s.active).length;

  // Staleness (§8.3): flag a book whose last import predates the owner-set
  // threshold. The shop workbook stamps settings.ops.lastImport; registry books
  // stamp book.data.lastImport.
  const staleDays = settings.ops?.staleDays || DEFAULT_STALE_DAYS;
  const stockStale = bookStaleness(settings.ops?.lastImport?.at, staleDays);
  const bookStale = (b) => bookStaleness(b.data?.lastImport?.at, staleDays);
  const setStaleDays = (v) => { const n = Math.round(Number(v)); setSettings({ ops: { ...(settings.ops || {}), staleDays: n > 0 ? n : null } }); };

  const create = async () => {
    const name = newName.trim() || (newKind === "stock" ? "New stock book" : "New vendor book");
    const id = await addBook({ kind: newKind, name });
    setAdding(false); setNewName(""); setSel(id);
  };

  const rowCls = (on) => `w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left ${on ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-56 shrink-0 border-r border-slate-100 overflow-y-auto p-3 space-y-3">
        <div>
          <div className="ft-eyebrow text-[10px] text-slate-400 px-1 mb-1">Stock</div>
          <button onClick={() => setSel("stock")} className={rowCls(sel === "stock")}>
            <BookOpen size={14} className={sel === "stock" ? "" : "text-slate-400"} />
            <span className="flex-1 truncate">Shop workbook</span>
            {stockStale.stale && <AlertTriangle size={12} className={sel === "stock" ? "text-amber-200" : "text-amber-500"} aria-label={`Stale — imported ${stockStale.days} days ago`} />}
            <span className={`text-[10px] ${sel === "stock" ? "text-white/70" : "text-slate-400"}`}>{stockCount || "—"}</span>
          </button>
          {stockBooks.map((b) => (
            <button key={b.id} onClick={() => setSel(b.id)} className={rowCls(sel === b.id)}>
              <BookOpen size={14} className={sel === b.id ? "" : "text-slate-400"} />
              <span className="flex-1 truncate">{b.name || "Untitled"}</span>
              {bookStale(b).stale && <AlertTriangle size={12} className={sel === b.id ? "text-amber-200" : "text-amber-500"} aria-label={`Stale — imported ${bookStale(b).days} days ago`} />}
            </button>
          ))}
        </div>
        <div>
          <div className="ft-eyebrow text-[10px] text-slate-400 px-1 mb-1">Special order</div>
          {orderBooks.length === 0 && <div className="text-[11px] text-slate-400 px-1 py-1">None yet</div>}
          {orderBooks.map((b) => (
            <button key={b.id} onClick={() => setSel(b.id)} className={rowCls(sel === b.id)}>
              <Database size={14} className={sel === b.id ? "" : "text-slate-400"} />
              <span className="flex-1 truncate">{b.name || "Untitled"}</span>
              {bookStale(b).stale && <AlertTriangle size={12} className={sel === b.id ? "text-amber-200" : "text-amber-500"} aria-label={`Stale — imported ${bookStale(b).days} days ago`} />}
              {!b.active && <span className={`text-[10px] ${sel === b.id ? "text-white/70" : "text-slate-400"}`}>off</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setAdding(true)} className="w-full flex items-center gap-1.5 text-sm rounded-md border border-dashed border-slate-300 px-2.5 py-2 text-slate-500 hover:bg-slate-50"><Plus size={14} /> New book</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="ft-serif text-3xl">Price book</h2>
          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-slate-500" title="Books not re-imported within this many days get an amber ‘stale’ flag in the list. Vendors re-issue cost lists roughly quarterly.">
              Flag stale after
              <input type="number" min="1" value={settings.ops?.staleDays || ""} placeholder={String(DEFAULT_STALE_DAYS)} onChange={(e) => setStaleDays(e.target.value)} className={inp + " w-16 text-center"} />
              days
            </label>
            <button onClick={() => setHideCosts((v) => !v)} title="Mask cost & margin figures on screen" className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 ${hideCosts ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {hideCosts ? <Lock size={13} /> : <Percent size={13} />} {hideCosts ? "Costs hidden" : "Hide costs"}
            </button>
          </div>
        </div>

        {sel === "stock" ? (
          <div className="mt-3">
            <p className="text-xs text-slate-400 max-w-xl">
              {stockCount > 0
                ? `${stockCount} stock items loaded${(() => { const t = Math.max(0, ...stock.map((s) => s.updatedAt || 0)); return t ? ` · updated ${new Date(t).toLocaleDateString()}` : ""; })()}. `
                : "No stock items yet — run supabase/stock.sql once, then import the workbook. "}
              The shop workbook keeps its hand-built import; a SKU on a product row copies that item's values onto the row, and later price changes never rewrite saved selections.
            </p>
            {settings.ops?.lastImport && <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">Last imported {new Date(settings.ops.lastImport.at).toLocaleDateString()}{settings.ops.lastImport.by ? ` by ${settings.ops.lastImport.by}` : ""}{settings.ops.lastImport.skus ? ` · ${settings.ops.lastImport.skus} SKUs` : ""}{stockStale.stale && <StaleChip days={stockStale.days} />}</p>}
            {gFamilies.length > 0 && <p className="text-xs text-slate-400 mt-1 max-w-xl">Grout &amp; caulk: {gFamilies.length} color families · {gFamilies.reduce((n, f) => n + f.colors.length, 0)} color SKUs.</p>}
            <button onClick={() => pbRef.current?.click()} disabled={importing} className="mt-4 flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600 disabled:opacity-50"><Upload size={14} /> {importing ? "Reading…" : "Import shop workbook (.xlsx)"}</button>
            <input ref={pbRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importPriceBook} className="hidden" />
            <ImportHistory bookId={STOCK_BOOK_ID} refreshKey={settings.ops?.lastImport?.at || 0} currentItems={stock}
              loadVersions={loadBookVersions} loadSnapshot={loadBookVersionSnapshot} pinVersion={pinBookVersion}
              snapshotToItems={(snap) => snap.map((r) => normStockItem({ sku: r.sku, active: true, data: r.data || {} }))}
              computeDiff={diffStock} onRollback={rollbackStock} noun="the shop workbook" />
          </div>
        ) : selBook ? (
          <BookDetail key={selBook.id} book={selBook} updateBook={updateBook} delBook={delBook} onDeleted={() => setSel("stock")} loadBookItems={loadBookItems} applyBookImport={applyBookImport} loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} hideCosts={hideCosts} staleDays={staleDays} inp={inp} lbl={lbl} types={types} typeLabels={typeLabels} />
        ) : (
          <p className="text-xs text-slate-400 mt-3">Select a book.</p>
        )}
      </div>

      {adding && (
        <Modal title="New price book" onClose={() => setAdding(false)}>
          <label className={lbl}>Type</label>
          <div className="flex gap-2 mb-3">
            {[["order", "Special order", "Vendor cost list — a markup makes the selling price"], ["stock", "Stock", "Shop-priced sheet, like the main workbook"]].map(([k, t, d]) => (
              <button key={k} onClick={() => setNewKind(k)} className={`flex-1 text-left rounded-lg border px-3 py-2 ${newKind === k ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <div className="text-sm font-medium">{t}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{d}</div>
              </button>
            ))}
          </div>
          <label className={lbl}>Name</label>
          <input className={inp} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={newKind === "stock" ? "e.g. Schluter 2026" : "e.g. Virginia Tile SO"} autoFocus onKeyDown={(e) => e.key === "Enter" && create()} />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setAdding(false)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button onClick={create} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Create book</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Import history + rollback for any versioned price book — a registry book
// (BookDetail) or the shop workbook (the stock panel). Owns its version list;
// the parent bumps refreshKey after an import so it re-fetches. Rollback diffs a
// version's snapshot against the current items and hands the diff to onRollback,
// which replays it through that book's normal apply path (never a blind
// overwrite) — the apply writes a fresh version, so the rollback is the newest.
function ImportHistory({ bookId, refreshKey, currentItems, loadVersions, loadSnapshot, pinVersion, snapshotToItems, computeDiff, onRollback, noun = "this book" }) {
  const [versions, setVersions] = useState(null);
  const [rollback, setRollback] = useState(null); // { version, diff } — confirm modal
  const reload = () => loadVersions(bookId).then(setVersions).catch(() => setVersions([]));
  useEffect(() => { let ok = true; loadVersions(bookId).then((v) => ok && setVersions(v)).catch(() => ok && setVersions([])); return () => { ok = false; }; }, [bookId, refreshKey]);

  const togglePin = async (v) => {
    setVersions((vs) => (vs || []).map((x) => x.id === v.id ? { ...x, pinned: !x.pinned } : x));
    try { await pinVersion(v.id, !v.pinned); } catch (x) { reload(); }
  };
  const openRollback = async (v) => {
    try {
      const snap = await loadSnapshot(v.id);
      setRollback({ version: v, diff: computeDiff(currentItems || [], snapshotToItems(snap || [])) });
    } catch (x) { /* transient — user can retry */ }
  };
  const confirmRollback = async () => {
    if (!rollback) return;
    await onRollback(rollback.diff);
    setRollback(null);
  };

  if (versions == null || versions.length === 0) return null;
  return (
    <>
      <div className="mt-6">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400"><History size={13} /> Import history</div>
        <div className="mt-2 border border-slate-100 rounded-lg divide-y divide-slate-100">
          {versions.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <button onClick={() => togglePin(v)} title={v.pinned ? "Pinned — kept through pruning" : "Pin to keep"} className={v.pinned ? "text-indigo-600" : "text-slate-300 hover:text-slate-500"}><Pin size={14} className={v.pinned ? "fill-current" : ""} /></button>
              <div className="min-w-0">
                <div className="truncate">
                  {v.label || (i === 0 ? "Latest import" : "Import")}
                  {i === 0 && <span className="ml-1.5 text-[9px] uppercase rounded bg-emerald-100 text-emerald-700 px-1 py-0.5">current</span>}
                </div>
                <div className="text-[11px] text-slate-400">{v.importedAt ? new Date(v.importedAt).toLocaleString() : "—"}{v.importedBy ? ` · ${v.importedBy}` : ""} · {v.itemCount} item{v.itemCount === 1 ? "" : "s"}</div>
              </div>
              {i !== 0 && <button onClick={() => openRollback(v)} className="ml-auto flex items-center gap-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-slate-600"><RotateCcw size={12} /> Roll back</button>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">The newest {BOOK_VERSION_KEEP} unpinned imports are kept; pin one to keep it indefinitely.</p>
      </div>

      {rollback && (
        <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={() => setRollback(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="ft-serif text-xl mb-1">Roll back {noun}?</h3>
            <p className="text-sm text-slate-500">Restores {noun} to the <b>{rollback.version.importedAt ? new Date(rollback.version.importedAt).toLocaleString() : ""}</b> import ({rollback.version.itemCount} item{rollback.version.itemCount === 1 ? "" : "s"}). This is applied as a new import — it becomes the newest version, and nothing older is lost.</p>
            <div className="flex items-center gap-3 flex-wrap mt-3 text-xs">
              <span className="text-emerald-600">{rollback.diff.added.length} restored</span>
              <span className="text-amber-600">{rollback.diff.changed.length} changed back</span>
              <span className="text-slate-400">{rollback.diff.missing.length} retiring · {rollback.diff.unchanged.length} unchanged</span>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRollback(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmRollback} disabled={rollback.diff.added.length + rollback.diff.changed.length + rollback.diff.missing.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Roll back</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BookDetail({ book, updateBook, delBook, onDeleted, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, hideCosts, staleDays, inp, lbl, types, typeLabels }) {
  const [items, setItems] = useState(null); // null = loading
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all"); // all | enabled | disabled
  const [confirmBulk, setConfirmBulk] = useState(null); // null | { disabled: boolean }
  const [wizard, setWizard] = useState(false);
  const [name, setName] = useState(book.name);
  const [editItem, setEditItem] = useState(null); // the item being hand-edited
  const [vSeq, setVSeq] = useState(0); // bump to refresh the import-history list
  const [confirmDel, setConfirmDel] = useState(false);

  const reload = () => { setItems(null); loadBookItems(book.id).then(setItems).catch(() => setItems([])); };
  useEffect(() => { let ok = true; loadBookItems(book.id).then((x) => ok && setItems(x)).catch(() => ok && setItems([])); return () => { ok = false; }; }, [book.id]);

  const markups = book.data?.markups || null;
  const li = book.data?.lastImport;
  const st = bookStaleness(li?.at, staleDays);
  const isOrder = book.kind === "order";
  const cost = (n) => (hideCosts ? "•••" : n == null ? "—" : money(n));
  const activeItems = (items || []).filter((it) => it.active);
  const query = q.trim().toLowerCase();
  // Bulk enable/disable acts on ALL filtered matches, not the 300-row display slice.
  const filtered = (items || [])
    .filter((it) => (show === "disabled" ? it.disabled : show === "enabled" ? !it.disabled : true))
    .filter((it) => !query || `${it.sku} ${it.description} ${it.mfg} ${it.color}`.toLowerCase().includes(query));
  const shown = filtered.slice(0, 300);
  const disabledCount = (items || []).filter((it) => it.disabled).length;

  // Apply an import/rollback diff and refresh the table + history. applyBookImport
  // itself writes the version, so a rollback lands as the newest one.
  const applyDiff = async (diff) => {
    try { await applyBookImport(book.id, diff); reload(); setVSeq((s) => s + 1); }
    catch (x) { /* surfaced by applyBookImport */ }
  };
  const onApply = async (diff, opts) => {
    try { await applyBookImport(book.id, diff, opts); setWizard(false); reload(); setVSeq((s) => s + 1); }
    catch (x) { /* surfaced by applyBookImport */ }
  };

  // Persist a hand-edit and merge the stamped result back into the open list
  // (re-normalized so it renders like a freshly loaded row).
  const saveItemEdit = async (edited) => {
    try {
      const data = await updateBookItem(book.id, edited);
      const merged = normBookItem({ sku: edited.sku, active: edited.active, data }, book.id);
      setItems((its) => (its || []).map((x) => x.sku === edited.sku ? merged : x));
      setEditItem(null);
    } catch (x) { /* surfaced by updateBookItem */ }
  };

  // Optimistic toggle; rolls the list back if the write fails (e.g. the
  // disabled-column migration hasn't been run).
  const setDisabled = async (skus, disabled) => {
    const set = new Set(skus);
    const prev = items;
    setItems((its) => (its || []).map((x) => (set.has(x.sku) ? { ...x, disabled } : x)));
    try { await setBookItemsDisabled(book.id, skus, disabled); }
    catch (x) { setItems(prev); }
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="ft-field rounded-md border border-slate-200 px-2 py-1 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== book.name && updateBook(book.id, { name: name.trim() })} />
        <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">{isOrder ? "Special order" : "Stock"}</span>
        <label className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
          <input type="checkbox" checked={book.active} onChange={(e) => updateBook(book.id, { active: e.target.checked })} /> Active
        </label>
        <button onClick={() => setConfirmDel(true)} title="Delete this book" className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
      </div>

      {confirmDel && (
        <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
          <span className="text-red-600 flex-1">
            Delete "{book.name || "Untitled"}" for everyone{items && items.length ? <> — its {items.length} item{items.length === 1 ? "" : "s"} and import history</> : " and its import history"}? This can't be undone. Estimates that already used it keep the prices they saved.
          </span>
          <button onClick={() => { delBook(book.id); onDeleted?.(); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete book</button>
          <button onClick={() => setConfirmDel(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => setWizard(true)} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Upload size={14} /> Import…</button>
        <span className="text-xs text-slate-400">
          {items == null ? "Loading items…" : `${activeItems.length} active item${activeItems.length === 1 ? "" : "s"}`}
          {li ? ` · imported ${new Date(li.at).toLocaleDateString()}${li.by ? ` by ${li.by}` : ""}` : " · never imported"}
        </span>
        {st.stale && <StaleChip days={st.days} />}
      </div>

      {isOrder && items && items.length > 0 && (
        <MarkupEditor book={book} items={items} onSave={(m) => updateBook(book.id, { dataPatch: { markups: m } })} inp={inp} lbl={lbl} />
      )}

      {items && items.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <input className={`${inp} max-w-sm`} placeholder="Search this book…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
              {[["all", "All"], ["enabled", "Enabled"], ["disabled", disabledCount ? `Disabled (${disabledCount})` : "Disabled"]].map(([v, label]) => (
                <button key={v} onClick={() => setShow(v)} className={`px-2.5 py-1.5 ${show === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}</button>
              ))}
            </div>
            {(query || show !== "all") && filtered.length > 0 && (
              <>
                <button onClick={() => setConfirmBulk({ disabled: true })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Disable all {filtered.length}</button>
                <button onClick={() => setConfirmBulk({ disabled: false })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Enable all {filtered.length}</button>
              </>
            )}
          </div>
          {confirmBulk && (
            <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <span className="text-amber-700 flex-1">
                {confirmBulk.disabled ? "Disable" : "Enable"} {filtered.length} item{filtered.length === 1 ? "" : "s"}{query ? ` matching “${q.trim()}”` : ""}? Disabled items stop showing in SKU search for everyone; estimates that already picked them keep their prices.
              </span>
              <button onClick={() => { setDisabled(filtered.map((it) => it.sku), confirmBulk.disabled); setConfirmBulk(null); }} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">{confirmBulk.disabled ? "Disable" : "Enable"} {filtered.length}</button>
              <button onClick={() => setConfirmBulk(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          )}
          <div className="mt-2 overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 w-8"></th>
                  <th className="text-left px-2 py-1.5">SKU</th>
                  <th className="text-left px-2 py-1.5">Description</th>
                  {isOrder && <th className="text-left px-2 py-1.5">Mfg</th>}
                  <th className="text-left px-2 py-1.5">U/M</th>
                  <th className="text-left px-2 py-1.5">Lead</th>
                  {isOrder && <th className="text-right px-2 py-1.5">Cost</th>}
                  <th className="text-right px-2 py-1.5">{isOrder ? "Sell" : "Price"}</th>
                  <th className="px-2 py-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => {
                  const priced = isOrder ? pricedItem(it, markups) : it;
                  const sell = priced.priceSqft != null ? priced.priceSqft : priced.price;
                  return (
                    <tr key={it.sku} className={`border-t border-slate-100 ${!it.active || it.discontinued || it.disabled ? "text-slate-300" : ""}`}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={!it.disabled} onChange={(e) => setDisabled([it.sku], !e.target.checked)} title={it.disabled ? "Enable — offer this SKU in search again" : "Disable — hide this SKU from search (estimates that already picked it keep their prices)"} /></td>
                      <td className="px-2 py-1.5 font-mono text-xs">{it.sku}</td>
                      <td className="px-2 py-1.5">
                        {it.description || "—"}
                        {it.freightFlag && <span className="ml-1.5 text-[9px] uppercase rounded bg-amber-100 text-amber-700 px-1 py-0.5">freight</span>}
                        {it.discontinued && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">disc</span>}
                        {it.disabled && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">off</span>}
                        {it.editedAt && <span title={`Hand-edited${it.editedBy ? ` by ${it.editedBy}` : ""} ${new Date(it.editedAt).toLocaleDateString()} — a re-import overwrites this`} className="ml-1.5 text-[9px] uppercase rounded bg-indigo-100 text-indigo-700 px-1 py-0.5">edited</span>}
                      </td>
                      {isOrder && <td className="px-2 py-1.5 text-xs">{it.mfg || "—"}</td>}
                      <td className="px-2 py-1.5 text-xs">{it.unit || "—"}</td>
                      <td className="px-2 py-1.5 text-xs">{it.leadTime || "—"}</td>
                      {isOrder && <td className="px-2 py-1.5 text-right text-xs tabular-nums">{cost(it.cost)}</td>}
                      <td className="px-2 py-1.5 text-right tabular-nums">{sell != null ? money(sell) : "—"}</td>
                      <td className="px-2 py-1.5 text-right"><button onClick={() => setEditItem(it)} title="Edit this item" className="text-slate-300 hover:text-slate-600"><Pencil size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(filtered.length > shown.length) && <p className="text-[11px] text-slate-400 mt-1">Showing {shown.length} of {filtered.length}.</p>}
        </>
      )}

      {items && items.length === 0 && (
        <p className="text-sm text-slate-400 mt-6">This book is empty. Click <span className="text-slate-600">Import…</span> to map a vendor sheet's columns and load its items.</p>
      )}

      <ImportHistory bookId={book.id} refreshKey={vSeq} currentItems={items}
        loadVersions={loadBookVersions} loadSnapshot={loadBookVersionSnapshot} pinVersion={pinBookVersion}
        snapshotToItems={(snap) => snap.map((r) => normBookItem({ sku: r.sku, active: true, data: r.data || {} }, book.id))}
        computeDiff={diffBookItems} onRollback={applyDiff} noun="this book" />

      {editItem && <BookItemEditModal item={editItem} isOrder={isOrder} onClose={() => setEditItem(null)} onSave={saveItemEdit} inp={inp} lbl={lbl} />}

      {wizard && <BookImportWizard book={book} existingItems={items || []} onClose={() => setWizard(false)} onApply={onApply} saveMapping={(m) => updateBook(book.id, { dataPatch: { mapping: m } })} types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} />}
    </div>
  );
}

// A single hand-edit of a book item (Phase 4b). Edits the fields a shop most
// often needs to correct between vendor imports — the diff/warning contract
// (editedInDiff) then flags the row so the next import doesn't silently clobber
// the fix. Sell is not editable on order books: it derives from cost × markup.
function BookItemEditModal({ item, isOrder, onClose, onSave, inp, lbl }) {
  const [d, setD] = useState({
    description: item.description || "",
    mfg: item.mfg || "",
    unit: item.unit || "",
    leadTime: item.leadTime || "",
    cost: item.cost != null ? String(item.cost) : "",
    price: item.price != null ? String(item.price) : "",
    discontinued: !!item.discontinued,
  });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const numField = (v) => { const n = parseFloat(String(v).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
  const save = () => {
    const patch = { ...item, description: d.description.trim(), mfg: d.mfg.trim(), unit: d.unit.trim(), leadTime: d.leadTime.trim(), discontinued: d.discontinued };
    if (isOrder) patch.cost = d.cost.trim() === "" ? null : numField(d.cost);
    else patch.price = d.price.trim() === "" ? null : numField(d.price);
    onSave(patch);
  };
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="ft-serif text-xl">Edit item</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        <p className="font-mono text-xs text-slate-400 mb-3">{item.sku}</p>
        <div className="space-y-3">
          <div><label className={lbl}>Description</label><input className={inp} value={d.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="flex gap-3">
            {isOrder && <div className="flex-1"><label className={lbl}>Manufacturer</label><input className={inp} value={d.mfg} onChange={(e) => set("mfg", e.target.value)} /></div>}
            <div className="w-24"><label className={lbl}>U/M</label><input className={inp} value={d.unit} onChange={(e) => set("unit", e.target.value)} /></div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1"><label className={lbl}>{isOrder ? "Cost" : "Price"}</label><input className={inp} inputMode="decimal" value={isOrder ? d.cost : d.price} onChange={(e) => set(isOrder ? "cost" : "price", e.target.value)} /></div>
            <div className="flex-1"><label className={lbl}>Lead time</label><input className={inp} value={d.leadTime} onChange={(e) => set("leadTime", e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={d.discontinued} onChange={(e) => set("discontinued", e.target.checked)} /> Discontinued</label>
        </div>
        {isOrder && <p className="text-[11px] text-slate-400 mt-3">Selling price stays cost × markup — edit the markup on the book to move sell.</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
          <button onClick={save} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Save edit</button>
        </div>
      </div>
    </div>
  );
}

// The markup editor (Phase 2): a book default plus per-group overrides keyed on
// a chosen column (mfg, product line…). Selling price = cost × (1 + markup),
// computed at browse/pick time — editing a markup moves future picks only, never
// a saved estimate. The group axis is chosen here (no re-import needed) from the
// columns the book actually populates, and only the groups the sheet has are
// priceable (markupGroups), so there's no free-form matcher to get wrong.
const GROUP_LABEL = { mfg: "manufacturer", productLine: "product line", section: "section", brand: "brand" };
const GROUP_AXES = [["mfg", "Manufacturer"], ["productLine", "Product line"], ["section", "Section"], ["brand", "Brand"]];
function MarkupEditor({ book, items, onSave, inp, lbl }) {
  const markups = book.data?.markups || {};
  const [groupBy, setGroupBy] = useState(markups.groupBy || book.data?.mapping?.groupBy || "");
  const [def, setDef] = useState(markups.default != null ? String(markups.default) : "");
  const [byGroup, setByGroup] = useState(markups.byGroup || {});
  const [trim, setTrim] = useState(markups.trim != null ? String(markups.trim) : "");
  // Books carrying trim/molding lines (Mannington, ADR 0012) can mark trims up at
  // their own rate; the field is hidden on books that have no trims.
  const hasTrims = (items || []).some((it) => it.trim);
  // Only offer a group axis the book's items actually fill (Mannington carries a
  // product line but no mfg), so the dropdown never lists a dead choice.
  const axes = GROUP_AXES.filter(([f]) => (items || []).some((it) => String(it[f] ?? "").trim()));

  const commit = (nextDef, nextBy, nextTrim = trim, nextGroupBy = groupBy) => onSave({
    ...(nextGroupBy ? { groupBy: nextGroupBy } : {}),
    default: num(nextDef),
    byGroup: nextBy,
    ...(String(nextTrim).trim() !== "" ? { trim: num(nextTrim) } : {}),
  });
  const setGroup = (key, val) => {
    const next = { ...byGroup };
    if (val === "" || val == null) delete next[key]; else next[key] = num(val);
    setByGroup(next); commit(def, next);
  };
  // Switching the axis retires the old overrides — they were keyed on the prior
  // column's values and mean nothing under the new one.
  const changeGroupBy = (val) => { setGroupBy(val); setByGroup({}); commit(def, {}, trim, val); };
  const groups = groupBy ? markupGroups(items, { groupBy, default: num(def), byGroup }) : [];

  return (
    <div className="mt-4 border border-slate-100 rounded-lg p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Percent size={14} className="text-slate-400" />
        <span className="text-sm font-medium">Markup</span>
        <span className="text-[11px] text-slate-400">selling price = cost × (1 + markup)</span>
      </div>
      <div className="flex items-end gap-3 mt-2 flex-wrap">
        <div>
          <label className={lbl}>Default %</label>
          <input type="number" className={`${inp} w-24`} value={def} onChange={(e) => setDef(e.target.value)} onBlur={() => commit(def, byGroup)} placeholder="0" />
        </div>
        <span className="text-[11px] text-slate-400 pb-2">$10 cost → {money(10 * (1 + num(def) / 100))} sell</span>
        {hasTrims && (
          <div className="ml-auto text-right">
            <label className={lbl}>Trim %</label>
            <input type="number" className={`${inp} w-24`} value={trim} onChange={(e) => setTrim(e.target.value)} onBlur={() => commit(def, byGroup, trim)} placeholder={String(num(def))} />
            <p className="text-[10px] text-slate-400 mt-0.5">reducers, T-molds, stair-noses… (blank = default)</p>
          </div>
        )}
      </div>
      {axes.length > 0 ? (
        <div className="mt-3">
          <div>
            <label className={lbl}>Group markups by</label>
            <select className={`${inp} w-auto`} value={axes.some(([f]) => f === groupBy) ? groupBy : ""} onChange={(e) => changeGroupBy(e.target.value)}>
              <option value="">— one markup for all —</option>
              {axes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          {groupBy && groups.length > 0 && (
            <div className="mt-3">
              <label className={lbl}>Per-{GROUP_LABEL[groupBy] || groupBy} overrides <span className="normal-case tracking-normal text-slate-400">(blank = default)</span></label>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 max-w-xl">
                {groups.map((g) => (
                  <div key={g.key} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{g.key} <span className="text-slate-300">({g.count})</span></span>
                    <input type="number" className="ft-field w-16 rounded border border-slate-200 px-1.5 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" value={g.overridden ? String(byGroup[g.key]) : ""} placeholder={String(num(def))} onChange={(e) => setGroup(g.key, e.target.value)} />
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 mt-2">This book has no product-line or manufacturer column to price by — only the default (and trim) markup applies.</p>
      )}
    </div>
  );
}

// Upload a vendor .xlsx, pick the data sheet, map its columns (headerless ones
// too), set the SKU pattern and a status-flag legend, watch the parse preview
// live, then apply the diff. The mapping is saved on the book so re-imports are
// one click. The parse is entirely client-side; nothing writes until Apply.
function BookImportWizard({ book, existingItems, onClose, onApply, saveMapping, types, typeLabels, inp, lbl, hideCosts }) {
  const saved = book.data?.mapping || null;
  const [sheets, setSheets] = useState(null); // [{ name, rows }]
  const [sheetName, setSheetName] = useState(saved?.sheet || "");
  const [headerRow, setHeaderRow] = useState(saved?.headerRow ?? -1);
  const [columns, setColumns] = useState(saved?.columns || {});
  const [skuPattern, setSkuPattern] = useState(saved?.skuPattern || mappedSkuRe().source);
  const [flags, setFlags] = useState(saved?.flags || {});
  const [groupBy, setGroupBy] = useState(saved?.groupBy || (book.kind === "order" ? "mfg" : ""));
  const [defaultType, setDefaultType] = useState(saved?.defaultType || "");
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");
  const [ignored, setIgnored] = useState(() => new Set());   // SKUs the user chose to ignore (→ disabled)
  const [keepOld, setKeepOld] = useState(() => new Set());   // superseded oldSkus the user opted to KEEP active
  const toggleSet = (setter) => (key) => setter((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleIgnored = toggleSet(setIgnored);
  const toggleKeepOld = toggleSet(setKeepOld);

  const sheet = sheets?.find((s) => s.name === sheetName) || null;
  const rows = sheet?.rows || [];
  const maxCol = Math.min(30, rows.reduce((m, r) => Math.max(m, r?.length || 0), 0));

  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setReading(true); setErr("");
    try {
      // Text-PDF vendor price lists: extract each page's text items with pdf.js
      // (lazy-loaded like xlsx) and let pdfbook align every page's own header
      // onto one canonical sheet, then apply its suggested mapping. Everything
      // downstream — sheet picker, mapping controls, diff preview — is unchanged.
      if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
        const pages = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const vh = page.getViewport({ scale: 1 }).height; // pdf y is bottom-up; flip to top-down
          const content = await page.getTextContent();
          pages.push(content.items.filter((i) => i.str && i.str.trim()).map((i) => ({ str: i.str, x: i.transform[4], y: vh - i.transform[5], w: i.width })));
        }
        // Mannington's account price list leads each row with Pattern, not the
        // item code, so the generic header-driven reader finds no table; its
        // fixed grid gets a dedicated parser (ADR 0012) that emits the same
        // canonical shape. Every other text PDF stays on parsePdfPages.
        const parsePdf = isManningtonCartons(pages) ? parseManningtonPages : parsePdfPages;
        const { name, rows, mapping } = parsePdf(pages, f.name.replace(/\.pdf$/i, ""));
        setSheets([{ name, rows }]);
        applyDetected({ sheet: name, ...mapping });
        setReading(false);
        return;
      }
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const parsed = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) }));
      setSheets(parsed);
      // A saved mapping wins; else recognize the VTC "EFT" template (fills the
      // whole mapping in one step); else pick the best data sheet by header
      // quality and guess its columns.
      if (saved?.sheet && parsed.find((s) => s.name === saved.sheet)) { applySheet(parsed.find((s) => s.name === saved.sheet)); }
      else {
        const detected = detectVtcEft(parsed);
        if (detected) applyDetected(detected);
        else applySheet(bestDataSheet(parsed));
      }
    } catch (x) { setErr("Could not read that file — is it an .xlsx / .xls, or a text-based .pdf?"); }
    setReading(false);
  };

  // A recognized vendor template (detectVtcEft) fills every mapping control at
  // once, so a known sheet is one upload with nothing to hand-map.
  const applyDetected = (m) => {
    setSheetName(m.sheet);
    setHeaderRow(m.headerRow ?? -1);
    setColumns(m.columns || {});
    if (m.skuPattern) setSkuPattern(m.skuPattern);
    if (m.flags) setFlags(m.flags);
    if (m.groupBy) setGroupBy(m.groupBy);
    if (m.defaultType) setDefaultType(m.defaultType);
  };

  // Choosing a sheet (auto or manual): if we have no saved mapping, guess the
  // header row and the columns from it.
  const applySheet = (s) => {
    if (!s) return;
    setSheetName(s.name);
    if (saved?.sheet === s.name && saved.columns) { setHeaderRow(saved.headerRow ?? -1); setColumns(saved.columns); return; }
    const hr = guessHeaderRow(s.rows);
    setHeaderRow(hr);
    setColumns(hr >= 0 ? columnsFromHeader(s.rows[hr] || []) : {});
  };

  const setCol = (i, field) => setColumns((c) => {
    const next = { ...c };
    if (field) { for (const k of Object.keys(next)) if (next[k] === field && field !== "flag") delete next[k]; next[i] = field; }
    else delete next[i];
    return next;
  });

  const mapping = { sheet: sheetName, headerRow: headerRow >= 0 ? headerRow : undefined, columns, skuPattern, flags, groupBy: groupBy || undefined, defaultType: defaultType || undefined };
  const { items, warnings } = sheet ? parseMapped(rows, mapping) : { items: [], warnings: [] };
  const diff = sheet ? diffBookItems(existingItems, items) : { added: [], changed: [], missing: [], unchanged: [] };
  const editedOverwritten = sheet ? editedInDiff(existingItems, items) : [];
  const flagCol = Object.entries(columns).find(([, f]) => f === "flag")?.[0];
  const flagValues = flagCol != null ? [...new Set(rows.slice((headerRow >= 0 ? headerRow : -1) + 1).map((r) => String(r?.[flagCol] ?? "").trim()).filter((v) => v && v.length <= 4))].slice(0, 12) : [];

  // The sheet's own header labels, shown above each mapping dropdown so a column
  // is identified without reading sample rows. Blank cells (VTC's status-flag and
  // description columns) show "— no header —" so their emptiness is explicit.
  const headerCells = headerRow >= 0 ? (rows[headerRow] || []) : [];
  const headerLabel = (i) => String(headerCells[i] ?? "").replace(/\s+/g, " ").trim();

  const preview = items.slice(0, 8);

  // Per-row pricing/unit hazards and N-suffix supersede pairs for the review
  // sections. Derived each render like `diff` — nothing is stored on an item.
  const problems = sheet ? items.map((it) => ({ it, probs: itemProblems(it) })).filter((x) => x.probs.length) : [];
  const supersedes = sheet ? supersedePairs(existingItems, items) : [];
  const supersedeOld = supersedes.filter((p) => !keepOld.has(p.oldSku)).map((p) => p.oldSku);
  const disableSkus = [...new Set([...ignored, ...supersedeOld])];
  const appliedSupersede = supersedes.filter((p) => !keepOld.has(p.oldSku)).map((p) => ({ oldSku: p.oldSku, newSku: p.newSku }));
  const importCount = diff.added.length + diff.changed.length + diff.missing.length;
  // Disabling SKUs is a valid apply even when the re-import is otherwise a no-op
  // (identical book → every row unchanged) — so the button also opens on pending
  // disables, and reads them alone when there's no import to report.
  const applyLabel = importCount === 0 && disableSkus.length
    ? `Apply — ${disableSkus.length} disabled`
    : `Apply — ${diff.added.length} new · ${diff.changed.length} changed · ${diff.missing.length} retiring${disableSkus.length ? ` · ${disableSkus.length} disabled` : ""}`;

  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="ft-serif text-2xl">Import — {book.name || "book"}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>

        {!sheets ? (
          <div className="py-8 text-center">
            <label className="inline-flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-4 py-2 text-slate-600 cursor-pointer">
              <Upload size={15} /> {reading ? "Reading…" : "Choose vendor sheet (.xlsx / .xls / .pdf)"}
              <input type="file" accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} className="hidden" />
            </label>
            {err && <p className="text-xs text-red-500 mt-3">{err}</p>}
            <p className="text-[11px] text-slate-400 mt-3 max-w-md mx-auto">Nothing is saved until you apply. The file is parsed here in your browser.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={lbl}>Data sheet</label>
                <select className={`${inp} w-auto`} value={sheetName} onChange={(e) => applySheet(sheets.find((s) => s.name === e.target.value))}>
                  {sheets.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.rows?.length || 0})</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Header row</label>
                <input type="number" className={`${inp} w-20`} value={headerRow < 0 ? "" : headerRow + 1} placeholder="none" onChange={(e) => setHeaderRow(e.target.value === "" ? -1 : Math.max(0, Number(e.target.value) - 1))} />
              </div>
              <div>
                <label className={lbl}>SKU pattern</label>
                <input className={`${inp} w-56 font-mono text-xs`} value={skuPattern} onChange={(e) => setSkuPattern(e.target.value)} />
              </div>
              {book.kind === "order" && (
                <div>
                  <label className={lbl}>Markup group</label>
                  <select className={`${inp} w-auto`} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                    {[["", "— none —"], ["mfg", "Manufacturer"], ["productLine", "Product line"], ["section", "Section"], ["brand", "Brand"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={lbl}>Default type</label>
                <select className={`${inp} w-auto`} value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
                  <option value="">Misc / accessory</option>
                  {types.filter((t) => t !== "misc").map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={lbl}>Map columns — a row is imported only when its SKU cell matches the pattern</label>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="text-xs">
                  <thead>
                    <tr>{Array.from({ length: maxCol }, (_, i) => (
                      <th key={i} className="px-1.5 py-1 border-b border-slate-100 align-top">
                        <div className={`text-[10px] mb-1 max-w-[120px] truncate ${headerLabel(i) ? "text-slate-500 font-medium" : "text-slate-300 italic"}`} title={headerLabel(i) || "no header"}>{headerLabel(i) || "— no header —"}</div>
                        <select className="ft-field rounded border border-slate-200 px-1 py-0.5 text-[11px] max-w-[120px]" value={columns[i] || ""} onChange={(e) => setCol(i, e.target.value)}>
                          {bookFieldOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                      </th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {rows.slice((headerRow >= 0 ? headerRow : -1) + 1, (headerRow >= 0 ? headerRow : -1) + 6).map((r, ri) => (
                      <tr key={ri}>{Array.from({ length: maxCol }, (_, i) => (
                        <td key={i} className={`px-1.5 py-1 border-b border-slate-50 whitespace-nowrap max-w-[120px] truncate ${columns[i] === "sku" ? "bg-indigo-50" : ""}`}>{String(r?.[i] ?? "")}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {flagValues.length > 0 && (
              <div>
                <label className={lbl}>Status flag legend</label>
                <div className="flex flex-wrap gap-2">
                  {flagValues.map((v) => (
                    <div key={v} className="flex items-center gap-1 border border-slate-200 rounded px-2 py-1">
                      <span className="font-mono text-xs">{v}</span>
                      <select className="ft-field text-[11px] border-0 focus:ring-0" value={flags[v] || ""} onChange={(e) => setFlags((f) => { const n = { ...f }; if (e.target.value) n[v] = e.target.value; else delete n[v]; return n; })}>
                        {FLAG_SEMANTICS.map(([val, t]) => <option key={val} value={val}>{t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">{items.length} item{items.length === 1 ? "" : "s"} parsed</span>
                <span className="text-xs text-emerald-600">{diff.added.length} new</span>
                <span className="text-xs text-amber-600">{diff.changed.length} changed</span>
                <span className="text-xs text-slate-400">{diff.missing.length} retiring · {diff.unchanged.length} unchanged</span>
              </div>
              {editedOverwritten.length > 0 && (
                <p className="mt-1.5 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 inline-block" title={editedOverwritten.map((i) => i.sku).join(", ")}>
                  <Pencil size={11} className="inline -mt-0.5 mr-1" />{editedOverwritten.length} item{editedOverwritten.length === 1 ? " you" : "s you"} hand-edited will be overwritten by this import.
                </p>
              )}
              {warnings.length > 0 && <ul className="mt-1 text-[11px] text-amber-600 list-disc pl-4">{warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}</ul>}
              {preview.length > 0 && (
                <div className="mt-2 overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>
                      <th className="text-left px-2 py-1">SKU</th><th className="text-left px-2 py-1">Description</th>
                      {book.kind === "order" && <th className="text-left px-2 py-1">Mfg</th>}
                      <th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Size</th><th className="text-left px-2 py-1">U/M</th><th className="text-right px-2 py-1">{book.kind === "order" ? "Cost" : "Price"}</th>
                    </tr></thead>
                    <tbody>{preview.map((it) => (
                      <tr key={it.sku} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-mono">{it.sku}</td><td className="px-2 py-1 truncate max-w-xs">{it.description}{it.freightFlag && <span className="ml-1 text-[9px] text-amber-600">◇frt</span>}</td>
                        {book.kind === "order" && <td className="px-2 py-1">{it.mfg}</td>}
                        <td className={`px-2 py-1 whitespace-nowrap ${it.type ? "text-slate-600" : "text-amber-600"}`}>{it.type ? (typeLabels[it.type] || it.type) : "Misc"}</td>
                        <td className="px-2 py-1 whitespace-nowrap ft-mono">{it.size || "—"}{it.thickness ? <span className="text-slate-400"> · {it.thickness}</span> : ""}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{orderUnitOf(it) && orderUnitOf(it) !== priceUnitOf(it) ? `${priceUnitOf(it)} → ${orderUnitOf(it)}` : priceUnitOf(it)}</td><td className="px-2 py-1 text-right tabular-nums">{hideCosts ? "•••" : it.cost != null ? money(it.cost) : it.price != null ? money(it.price) : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>

            {problems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-amber-800">{problems.length} problem row{problems.length === 1 ? "" : "s"} — these will misprice unless fixed at the source</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setIgnored(new Set(problems.map((p) => p.it.sku)))} className="rounded-md border border-amber-300 px-2 py-1 text-amber-700 hover:bg-amber-100">Ignore all</button>
                    <button onClick={() => setIgnored(new Set())} className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-white">Include all</button>
                  </div>
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-amber-100 border-t border-amber-100">
                  {problems.map(({ it, probs }) => {
                    const off = ignored.has(it.sku);
                    return (
                      <div key={it.sku} className="py-1.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-slate-500 shrink-0">{it.sku}</span>
                        <span className="truncate flex-1 min-w-0">{it.description || "—"}<span className="text-amber-700"> · {probs[0].msg}</span></span>
                        <button onClick={() => toggleIgnored(it.sku)} className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${off ? "bg-slate-200 text-slate-600" : "bg-white border border-amber-300 text-amber-700"}`}>{off ? "Ignored" : "Include"}</button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-amber-700">Ignored rows still import, but disabled — hidden from SKU search. Turn any back on later from the book table.</p>
              </div>
            )}

            {supersedes.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-medium">{supersedes.length} superseded SKU{supersedes.length === 1 ? "" : "s"} — a new “N” code replaces an older one</span>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                  {supersedes.map((p) => (
                    <label key={`${p.oldSku}>${p.newSku}`} className="py-1.5 flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={!keepOld.has(p.oldSku)} onChange={() => toggleKeepOld(p.oldSku)} title="Disable the old SKU" />
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-mono text-slate-400 line-through">{p.oldSku}</span>{p.oldDesc ? ` ${p.oldDesc}` : ""}
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-mono text-slate-600">{p.newSku}</span>{p.newDesc ? ` ${p.newDesc}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Checked = disable the old SKU (kept for saved estimates, just hidden from new search). Uncheck to keep it active.</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <button onClick={() => saveMapping(mapping)} className="text-sm text-slate-500 hover:text-slate-700 underline">Save mapping only</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
                <button onClick={() => { saveMapping(mapping); onApply(diff, { disableSkus, superseded: appliedSupersede }); }} disabled={importCount + disableSkus.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">{applyLabel}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsWorkspace({ onClose, settings, setSettings, stock, gFamilies, importing, importPriceBook, pbRef, exportBackup, importBackup, fileRef, inp, lbl, types, typeLabels, theme, setTheme, profile, saveProfile, user, books, addBook, updateBook, delBook, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, rollbackStock }) {
  const catalog = settings.catalog;
  const onChange = (c) => setSettings({ catalog: c });
  const [section, setSection] = useState("grout");
  // Master→detail selection: an existing product, or (via `adding`) an
  // add-draft under a company. View state only, never persisted.
  const [sel, setSel] = useState(null); // { companyId, kind, productId }
  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(null); // { companyId, kind }
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // { companyId, kind, productId }
  const [menuFor, setMenuFor] = useState(null); // company id with the ⋯ menu open
  const [showOthers, setShowOthers] = useState(false); // "Not in this section" group
  const [rename, setRename] = useState(null); // { value, error } — renaming the selected product
  const [coRename, setCoRename] = useState(null); // { id, value } — renaming a company inline

  const setCompany = (cid, patch) => onChange({ companies: catalog.companies.map((co) => co.id === cid ? { ...co, ...patch } : co) });
  const setProduct = (cid, kind, pid, patch) => onChange({ companies: catalog.companies.map((co) => co.id === cid ? { ...co, [kind]: co[kind].map((p) => p.id === pid ? { ...p, ...patch } : p) } : co) });
  const setInstallItem = (cid, u, mid, patch) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id === mid ? { ...m, ...patch } : m) });
  const delInstallItem = (cid, u, mid) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).filter((m) => m.id !== mid) });
  const newInstallItem = (kind) => kind === "mortar" ? { id: uid(), kind: "mortar", product: "", coverage: "" } : { id: uid(), kind: "custom", name: "", coverage: "", unit: "units", price: "", sku: "" };
  const addInstallItem = (cid, u, kind) => setProduct(cid, "underlayments", u.id, { install: [...(u.install || []), newInstallItem(kind)] });
  // Switching a row's kind rebuilds it (the field sets don't overlap), keeping
  // only the id and coverage.
  const setInstallKind = (cid, u, mid, kind) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id !== mid || m.kind === kind ? m : { ...newInstallItem(kind), id: m.id, coverage: m.coverage }) });
  const mortarNames = catalog.companies.flatMap((c) => c.mortars.map((m) => m.name));

  const kindLabel = (kind) => kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : "underlayment";
  const startAdd = (companyId, kind) => { setAdding({ companyId, kind }); setSel(null); setConfirmDel(null); setRename(null); setDraft(kind === "grouts" ? { name: "", coverage: "", unit: "units", price: "", sku: "", book: "", base: null } : kind === "mortars" ? { name: "", tier1: "", tier2: "", tier3: "", unit: "units", price: "", sku: "" } : { name: "", coverage: "", unit: "rolls", price: "", sku: "", types: [] }); setError(""); };
  const cancelAdd = () => { setAdding(null); setError(""); };
  const pickProduct = (companyId, kind, productId) => { setSel({ companyId, kind, productId }); setAdding(null); setConfirmDel(null); setRename(null); };
  const submitAdd = () => {
    const name = (draft.name || "").trim();
    if (!name) { setError("Product name is required."); return; }
    if (isDuplicateName(catalog, adding.kind, name)) { setError(`A ${kindLabel(adding.kind)} named "${name}" already exists.`); return; }
    onChange(addProduct(catalog, adding.companyId, adding.kind, { ...draft, name }));
    setAdding(null); setError("");
  };
  // A new company starts empty, so it would land in the collapsed "Not in this
  // section" group — open the add form for it right away so it doesn't seem to
  // vanish.
  const submitCompany = () => { const name = newCompany.trim(); if (!name) return; const next = addCompany(catalog, name); onChange(next); setNewCompany(""); setShowOthers(true); startAdd(next.companies[next.companies.length - 1].id, kindsFor[0]); };
  // The book rarely carries coverage, so most items still need it typed in —
  // mortars always do (three tiers can't come from one number). The pick keeps
  // the item's SKU on the product (ADR 0006), and a Laticrete pigment brings
  // its default base unit along (editable before and after adding).
  const fillFromStock = (it) => setDraft((d) => ({
    ...d,
    name: it.product || it.description,
    sku: it.sku,
    ...(it.price != null ? { price: String(it.price) } : it.priceSqft != null ? { price: String(it.priceSqft) } : {}),
    ...(adding.kind !== "mortars" && it.coverage != null ? { coverage: String(it.coverage) } : {}),
    ...(adding.kind === "grouts" ? { base: stockBaseCompanion(it, stock) } : {}),
    // A pick from the Grout & Caulk color matrix also suggests the color
    // family link (ADR 0007) — the grout offers that family's colors.
    ...(adding.kind === "grouts" && it.sheet === "Grout & Caulk" && it.product && it.color ? { book: it.product } : {}),
  }));

  const box = (on, onClick, title) => (
    <button onClick={onClick} title={title} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${on ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{on && <Check size={12} />}</button>
  );
  const delButton = (co, kind, p) => (
    <button onClick={() => setConfirmDel({ companyId: co.id, kind, productId: p.id })} title={`Delete ${p.name}`} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
  );
  const delConfirm = (co, kind, p) => confirmDel && confirmDel.companyId === co.id && confirmDel.kind === kind && confirmDel.productId === p.id && (
    <div className="flex items-center gap-2 mt-1.5 text-xs">
      <span className="text-red-600 flex-1">Delete "{p.name}"? Saved jobs that use it keep the name but stop calculating. To just hide it from new jobs, uncheck it instead.</span>
      <button onClick={() => { onChange(removeProduct(catalog, co.id, kind, p.id)); setConfirmDel(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
      <button onClick={() => setConfirmDel(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
    </div>
  );
  const numField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input type="number" value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  const txtField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  // Which flooring types an underlayment is offered for. No chips selected = all
  // types (the empty-tag convention in the catalog).
  const typeChips = (selected, onVal) => {
    const sel = selected || [];
    const toggle = (t) => onVal(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]);
    return (
      <div><label className={lbl}>Offered for {sel.length === 0 && <span className="text-slate-400 font-normal normal-case tracking-normal">(all types)</span>}</label>
        <div className="flex flex-wrap gap-1">{types.map((t) => <button key={t} onClick={() => toggle(t)} className={`text-xs rounded-md px-2 py-1 border ${sel.includes(t) ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{typeLabels[t]}</button>)}</div>
      </div>
    );
  };
  const selCo = sel ? catalog.companies.find((c) => c.id === sel.companyId) : null;
  const selProd = selCo ? (selCo[sel.kind] || []).find((p) => p.id === sel.productId) : null;
  const addCo = adding ? catalog.companies.find((c) => c.id === adding.companyId) : null;
  const kindsFor = section === "grout" ? ["grouts"] : ["mortars", "underlayments"];
  const kindTag = { grouts: "Grout", mortars: "Mortar", underlayments: "Underlayment" };
  const countAll = (co) => co.grouts.length + co.mortars.length + (co.underlayments?.length || 0);
  // A company "belongs" to a section by having products of its kinds — the rest
  // sit in a collapsed group so e.g. underlayment-only brands stay out of
  // Grout & colors. Deleting a company's last grout drops it out of the
  // section the same way.
  const inSection = (co) => kindsFor.some((k) => (co[k] || []).length > 0);
  const famFor = (g) => (g.book ? gFamilies.find((f) => f.product.toLowerCase() === g.book.toLowerCase()) : null);
  const masterHint = (kind, p) => kind === "grouts"
    ? (p.book ? (famFor(p) ? `${famFor(p).colors.length} colors · book` : "book link missing") : "standard colors")
    : kind === "mortars" ? [p.unit, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ")
      : ((p.types || []).length ? p.types.map((t) => typeLabels[t]).join(", ") : "all types") + ((p.install || []).length ? ` · ${p.install.length} install` : "");
  const SECTIONS = [
    { id: "profile", label: "Your details", icon: User, hint: profile.name || "salesperson" },
    { id: "general", label: "General", icon: Percent, hint: "waste %" },
    { id: "book", label: "Price book", icon: BookOpen, hint: books.length ? `${1 + books.length} books` : stock.length ? `${stock.filter((s) => s.active).length} SKUs` : "empty" },
    { id: "grout", label: "Grout & colors", icon: Paintbrush, hint: String(catalog.companies.reduce((n, c) => n + c.grouts.length, 0)) },
    { id: "matunder", label: "Mortar & underlayment", icon: Layers, hint: String(catalog.companies.reduce((n, c) => n + c.mortars.length + (c.underlayments?.length || 0), 0)) },
    { id: "backup", label: "Backup & restore", icon: Database, hint: settings.ops?.lastBackup ? new Date(settings.ops.lastBackup.at).toLocaleDateString() : "" },
  ];

  const companyHeader = (co) => (
    <div className="px-3 py-1 flex items-center gap-2 relative">
      {box(co.enabled, () => setCompany(co.id, { enabled: !co.enabled }), co.enabled ? "Hide all of this company's products" : "Show this company's products")}
      {coRename?.id === co.id ? (
        <input autoFocus value={coRename.value} onChange={(e) => setCoRename({ id: co.id, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { const n = coRename.value.trim(); if (n) setCompany(co.id, { name: n }); setCoRename(null); } if (e.key === "Escape") setCoRename(null); }}
          onBlur={() => setCoRename(null)} placeholder="Enter to save" className={inp + " flex-1 min-w-0 !py-0.5 !text-xs"} />
      ) : (
        <span className={`ft-eyebrow text-[9px] flex-1 truncate ${co.enabled ? "" : "opacity-50"}`}>{co.name}</span>
      )}
      <button onClick={() => setMenuFor(menuFor === co.id ? null : co.id)} title="Company options" className={`shrink-0 ${menuFor === co.id ? "text-slate-600" : "text-slate-300 hover:text-slate-600"}`}><MoreHorizontal size={14} /></button>
      {menuFor === co.id && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
          <div className="absolute right-2 top-6 z-20 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            {kindsFor.map((kind) => (
              <button key={kind} onClick={() => { setMenuFor(null); startAdd(co.id, kind); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={12} className="text-slate-400" /> Add {kindLabel(kind)}</button>
            ))}
            <button onClick={() => { setMenuFor(null); setCoRename({ id: co.id, value: co.name }); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Pencil size={12} className="text-slate-400" /> Rename company</button>
            {countAll(co) === 0 && <button onClick={() => { setMenuFor(null); onChange(removeCompany(catalog, co.id)); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"><Trash2 size={12} /> Delete company</button>}
          </div>
        </>
      )}
    </div>
  );

  const detailHeader = (co, kind, p, tag) => {
    const submitRename = () => {
      const name = (rename?.value || "").trim();
      if (!name) { setRename({ ...rename, error: "Name is required." }); return; }
      if (name.toLowerCase() !== p.name.trim().toLowerCase() && isDuplicateName(catalog, kind, name)) { setRename({ ...rename, error: `A ${kindLabel(kind)} named "${name}" already exists.` }); return; }
      onChange(renameProduct(catalog, co.id, kind, p.id, name));
      setRename(null);
    };
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="ft-eyebrow text-[9px] mb-1">{co.name} · {tag}</div>
          {rename ? (
            <div className="max-w-md">
              <div className="flex items-center gap-2">
                <input autoFocus value={rename.value} onChange={(e) => setRename({ value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRename(null); }} className={inp + " font-medium"} />
                <button onClick={submitRename} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700 shrink-0">Save</button>
                <button onClick={() => setRename(null)} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 shrink-0">Cancel</button>
              </div>
              {rename.error && <div className="text-xs text-red-500 mt-1">{rename.error}</div>}
              <p className="text-[11px] text-amber-600 mt-1.5">Jobs resolve materials by name — saved jobs keep the old name and stop calculating until this product is re-picked on them.</p>
            </div>
          ) : (
            <h2 className="ft-serif text-3xl leading-tight">{p.name}
              <button onClick={() => setRename({ value: p.name })} title={`Rename ${p.name}`} className="ml-2.5 text-slate-300 hover:text-slate-600 align-middle"><Pencil size={15} /></button>
            </h2>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">{box(p.enabled, () => setProduct(co.id, kind, p.id, { enabled: !p.enabled }), p.enabled ? "Hide from job dropdowns" : "Offer in job dropdowns")} offered on jobs</label>
          {delButton(co, kind, p)}
        </div>
      </div>
    );
  };

  const renderGroutDetail = (co, g) => {
    const family = famFor(g);
    return (
      <div key={g.id}>
        {detailHeader(co, "grouts", g, "Grout")}
        {delConfirm(co, "grouts", g)}
        <div className="flex flex-wrap items-end gap-2.5 mt-4">
          <div className="w-36">{numField("Cov. sq ft/unit", g.coverage, (v) => setProduct(co.id, "grouts", g.id, { coverage: v }))}</div>
          <div className="w-24">{txtField("Unit", g.unit, (v) => setProduct(co.id, "grouts", g.id, { unit: v }))}</div>
          <div className="w-28">{numField("$/unit", g.price, (v) => setProduct(co.id, "grouts", g.id, { price: v }))}</div>
          <div className="w-36">{txtField("SKU", g.sku || "", (v) => setProduct(co.id, "grouts", g.id, { sku: v }))}</div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Coverage is calibrated here — the book doesn't carry one. Grout scales for tile size, joint and thickness from the 12×12×3/8" / 1/8" baseline.</p>
        <div className="mt-6 flex items-baseline justify-between gap-3">
          <div className="font-medium text-sm">Colors &amp; SKUs</div>
          {family && <span className="text-[11px] text-slate-400">picking a color on a job stamps that color's SKU on the estimate</span>}
        </div>
        {g.book ? (family ? (
          <div className="mt-2 rounded-lg border border-slate-200 p-3 max-h-72 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-0.5">
              {family.colors.map((c) => (
                <div key={c.sku} className="flex items-baseline gap-2 text-xs py-0.5 min-w-0">
                  <span className="truncate">{c.color}</span>
                  <span className="ft-mono text-[10px] text-slate-400 ml-auto shrink-0">{c.sku}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 rounded-md border border-amber-200 px-3 py-2"><Link2Off size={12} className="shrink-0" /> Linked to "{g.book}", which isn't in the imported book — re-import the price book or re-link below.</div>
        )) : (
          <p className="mt-2 text-xs text-slate-400">No color link — jobs offer the standard color list and grout lines print without a per-color SKU.</p>
        )}
        <div className="mt-2 flex items-center gap-2 max-w-xl">
          {gFamilies.length > 0 ? <FamilySearch families={gFamilies} inp={inp} onPick={(f) => setProduct(co.id, "grouts", g.id, { book: f.product })} />
            : <p className="text-[11px] text-slate-400 flex-1">Import the price book to link a color family.</p>}
          {g.book && <button onClick={() => setProduct(co.id, "grouts", g.id, { book: "" })} className="text-xs text-slate-400 hover:text-red-500 shrink-0">Unlink colors</button>}
        </div>
        <div className="mt-6 max-w-2xl">
          <label className={lbl}>Base unit <span className="text-slate-400 font-normal normal-case tracking-normal">(a two-part grout's base — ordered with the kits and shown in the order summary; "per" = kits one base covers)</span></label>
          {g.base ? (
            <div className="grid gap-1.5 items-end grid-cols-[1.6fr_.9fr_.6fr_.7fr_.7fr_auto]">
              {txtField("Name", g.base.name, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, name: v } }))}
              {txtField("SKU", g.base.sku, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, sku: v } }))}
              {numField("Per", g.base.per, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, per: v } }))}
              {txtField("Unit", g.base.unit, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, unit: v } }))}
              {numField("$/unit", g.base.price, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, price: v } }))}
              <button onClick={() => setProduct(co.id, "grouts", g.id, { base: null })} title="Remove base unit" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
            </div>
          ) : (
            <div>
              {stock.length > 0 && <StockSearch stock={stock} inp={inp} placeholder="Search the book for the base unit…" onPick={(it) => setProduct(co.id, "grouts", g.id, { base: { sku: it.sku, name: it.description || it.product, unit: it.unit || "units", price: it.price ?? 0, per: 1 } })} />}
              <button onClick={() => setProduct(co.id, "grouts", g.id, { base: { sku: "", name: "", unit: "units", price: "", per: 1 } })} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Base unit</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMortarDetail = (co, m) => (
    <div key={m.id}>
      {detailHeader(co, "mortars", m, "Mortar")}
      {delConfirm(co, "mortars", m)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        <div className="w-28">{numField('Tile < 8"', m.tier1, (v) => setProduct(co.id, "mortars", m.id, { tier1: v }))}</div>
        <div className="w-28">{numField('8"–15"', m.tier2, (v) => setProduct(co.id, "mortars", m.id, { tier2: v }))}</div>
        <div className="w-28">{numField('> 15"', m.tier3, (v) => setProduct(co.id, "mortars", m.id, { tier3: v }))}</div>
        <div className="w-24">{txtField("Unit", m.unit, (v) => setProduct(co.id, "mortars", m.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", m.price, (v) => setProduct(co.id, "mortars", m.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", m.sku || "", (v) => setProduct(co.id, "mortars", m.id, { sku: v }))}</div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">Coverage sq ft per unit, tiered by the tile's longest side.</p>
    </div>
  );

  const renderUnderlayDetail = (co, u) => (
    <div key={u.id}>
      {detailHeader(co, "underlayments", u, "Underlayment")}
      {delConfirm(co, "underlayments", u)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        <div className="w-36">{numField("Cov. sq ft/unit", u.coverage, (v) => setProduct(co.id, "underlayments", u.id, { coverage: v }))}</div>
        <div className="w-24">{txtField("Unit", u.unit, (v) => setProduct(co.id, "underlayments", u.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", u.price, (v) => setProduct(co.id, "underlayments", u.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", u.sku || "", (v) => setProduct(co.id, "underlayments", u.id, { sku: v }))}</div>
      </div>
      <div className="mt-4">{typeChips(u.types, (v) => setProduct(co.id, "underlayments", u.id, { types: v }))}</div>
      <div className="mt-6 max-w-3xl">
        <label className={lbl}>Install materials <span className="text-slate-400 font-normal normal-case tracking-normal">(added when a job checks "Install materials"; mortar rows pull unit &amp; price from that mortar and combine with the job's mortar totals)</span></label>
        <div className="space-y-1.5">
          {(u.install || []).map((m) => (
            <div key={m.id} className={`grid gap-1.5 items-end ${m.kind === "mortar" ? "grid-cols-[auto_1.6fr_1fr_auto]" : "grid-cols-[auto_1.3fr_.8fr_.6fr_.6fr_.9fr_auto]"}`}>
              <div><label className={lbl}>Type</label>
                <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px]">{[["mortar", "Mortar"], ["custom", "Other"]].map(([k, l]) => <button key={k} onClick={() => setInstallKind(co.id, u, m.id, k)} className={`px-1.5 py-1.5 ${m.kind === k ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{l}</button>)}</div>
              </div>
              {m.kind === "mortar" ? (
                <div><label className={lbl}>Mortar</label>
                  <select value={m.product} onChange={(e) => setInstallItem(co.id, u, m.id, { product: e.target.value })} className={inp}>
                    {!m.product && <option value="">Select…</option>}
                    {(m.product && !mortarNames.includes(m.product) ? [m.product, ...mortarNames] : mortarNames).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ) : (
                txtField("Name", m.name, (v) => setInstallItem(co.id, u, m.id, { name: v }))
              )}
              {numField("Cov. sq ft/unit", m.coverage, (v) => setInstallItem(co.id, u, m.id, { coverage: v }))}
              {m.kind !== "mortar" && txtField("Unit", m.unit, (v) => setInstallItem(co.id, u, m.id, { unit: v }))}
              {m.kind !== "mortar" && numField("$/unit", m.price, (v) => setInstallItem(co.id, u, m.id, { price: v }))}
              {m.kind !== "mortar" && txtField("SKU", m.sku || "", (v) => setInstallItem(co.id, u, m.id, { sku: v }))}
              <button onClick={() => delInstallItem(co.id, u, m.id)} title="Remove install material" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={() => addInstallItem(co.id, u, "mortar")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Mortar</button>
            <button onClick={() => addInstallItem(co.id, u, "custom")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Other (screws, tape…)</button>
          </div>
          {stock.length > 0 && <StockSearch stock={stock} inp={inp} placeholder="Add from the price book — screws, tape, sealer… (keeps the SKU for the order summary)" onPick={(it) => setProduct(co.id, "underlayments", u.id, { install: [...(u.install || []), { id: uid(), kind: "custom", name: it.description || it.product, coverage: it.coverage != null ? String(it.coverage) : "", unit: it.unit || "units", price: it.price != null ? String(it.price) : "", sku: it.sku }] })} />}
        </div>
      </div>
    </div>
  );
  const renderAddForm = () => addCo && (
    <div className="max-w-xl">
      <div className="ft-eyebrow text-[9px] mb-1">{addCo.name}</div>
      <h2 className="ft-serif text-3xl leading-tight">New {kindLabel(adding.kind)}</h2>
      <div className="mt-4 space-y-2">
        {stock.length > 0 && <StockSearch stock={stock} onPick={fillFromStock} inp={inp} />}
        <input autoFocus placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") cancelAdd(); }} className={inp} />
        {adding.kind === "grouts" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
              {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
              {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
              {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
            </div>
            {draft.book && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <Link2 size={12} className="shrink-0" /><span className="flex-1">Colors &amp; per-color SKUs from <b>{draft.book}</b></span>
                <button onClick={() => setDraft({ ...draft, book: "" })} title="Don't link colors" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
            {draft.base && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <span className="flex-1">Also orders <b>{draft.base.name}</b>{draft.base.sku ? <span className="ft-mono text-slate-400"> · {draft.base.sku}</span> : ""} — 1 per kit (editable after adding)</span>
                <button onClick={() => setDraft({ ...draft, base: null })} title="Don't attach a base unit" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
          </>
        ) : adding.kind === "mortars" ? (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {numField('Tile < 8"', draft.tier1, (v) => setDraft({ ...draft, tier1: v }))}
            {numField('8"–15"', draft.tier2, (v) => setDraft({ ...draft, tier2: v }))}
            {numField('> 15"', draft.tier3, (v) => setDraft({ ...draft, tier3: v }))}
            {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
            {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
            {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
              {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
              {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
              {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
            </div>
            {typeChips(draft.types, (v) => setDraft({ ...draft, types: v }))}
          </>
        )}
        {error && <div className="text-xs text-red-500">{error}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={submitAdd} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Add</button>
          <button onClick={cancelAdd} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Settings</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon, hint }) => (
              <button key={id} onClick={() => { setSection(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); }} className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left ${section === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={15} className={section === id ? "" : "text-slate-400"} />
                <span className="flex-1">{label}</span>
                {hint && <span className={`text-[10px] ${section === id ? "text-white/70" : "text-slate-400"}`}>{hint}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-4 text-[11px] text-slate-400 border-t border-slate-100 space-y-0.5">
            {settings.ops?.lastImport && <div>Book imported {new Date(settings.ops.lastImport.at).toLocaleDateString()}{settings.ops.lastImport.by ? ` by ${settings.ops.lastImport.by}` : ""}</div>}
            {settings.ops?.lastBackup && <div>Last backup {new Date(settings.ops.lastBackup.at).toLocaleDateString()}</div>}
          </div>
        </aside>

        {(section === "grout" || section === "matunder") ? (
          <>
            <div className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto py-2">
              <p className="px-3 pb-1.5 text-[11px] text-slate-400">Uncheck a company or product to hide it from the job dropdowns — it stays stored, and jobs that already use it are unaffected.</p>
              {catalog.companies.filter(inSection).map((co) => (
                <div key={co.id} className="mb-1">
                  {companyHeader(co)}
                  {kindsFor.flatMap((kind) => (co[kind] || []).map((p) => { const active = sel && sel.companyId === co.id && sel.kind === kind && sel.productId === p.id; return (
                    <button key={p.id} onClick={() => pickProduct(co.id, kind, p.id)} className={`w-full text-left pl-9 pr-2.5 py-1.5 flex items-center gap-2 border-l-2 ${active ? "border-indigo-600 bg-indigo-50/40" : "border-transparent hover:bg-slate-50"}`}>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm truncate ${p.enabled ? "font-medium" : "text-slate-400"}`}>{p.name}</span>
                        <span className="block text-[10px] text-slate-400 truncate">{section === "matunder" ? `${kindTag[kind]} · ${masterHint(kind, p)}` : masterHint(kind, p)}</span>
                      </span>
                      <ChevronRight size={13} className="text-slate-300 shrink-0" />
                    </button>
                  ); }))}
                </div>
              ))}
              {(() => { const others = catalog.companies.filter((co) => !inSection(co)); return others.length > 0 && (
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <button onClick={() => setShowOthers(!showOthers)} className="w-full px-3 py-1 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
                    <ChevronRight size={11} className={`transition-transform ${showOthers ? "rotate-90" : ""}`} />
                    <span className="flex-1 text-left">Companies with no {section === "grout" ? "grouts" : "mortars or underlayments"}</span>
                    <span>{others.length}</span>
                  </button>
                  {showOthers && others.map((co) => <div key={co.id}>{companyHeader(co)}</div>)}
                </div>
              ); })()}
              <div className="px-3 pt-2 mt-1 border-t border-slate-100 flex gap-2 items-center">
                <input placeholder="New company" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCompany(); }} className={inp + " flex-1"} />
                <button onClick={submitCompany} className="text-xs rounded-md border border-slate-200 px-2 py-2 hover:bg-slate-50 flex items-center gap-1 shrink-0"><Plus size={12} /> Add</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {adding ? renderAddForm()
                : selProd && sel.kind === "grouts" ? renderGroutDetail(selCo, selProd)
                  : selProd && sel.kind === "mortars" ? renderMortarDetail(selCo, selProd)
                    : selProd ? renderUnderlayDetail(selCo, selProd)
                      : <div className="h-full flex items-center justify-center text-sm text-slate-400">Select a product on the left — or add one under its company.</div>}
            </div>
          </>
        ) : section === "profile" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">Your details</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Your contact info prints at the top of the estimate ("Your salesperson") so the customer knows who to reach. It's saved with your login — each person on the team sets their own.</p>
            <div className="mt-5 space-y-3 max-w-md">
              <div><label className={lbl}>Name</label><input value={profile.name} onChange={(e) => saveProfile({ name: e.target.value })} placeholder="Your name" className={inp} /></div>
              <div><label className={lbl}>Phone</label><input value={profile.phone} onChange={(e) => saveProfile({ phone: e.target.value })} placeholder="Phone number" className={inp} /></div>
              <div><label className={lbl}>Email</label><input value={profile.email} onChange={(e) => saveProfile({ email: e.target.value })} placeholder={user.email || "Email"} className={inp} /></div>
            </div>
            <p className="text-xs text-slate-400 mt-4">Signed in as {user.email}. Leave a field blank to keep it off the estimate.</p>
          </div>
        ) : section === "general" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">General</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Calibrate coverage to your real-world results and set unit prices. Grout scales automatically for tile size, joint, and thickness from a 12×12×3/8" / 1/8"-joint baseline.</p>
            <div className="mt-5 flex gap-6">
              <div><label className={lbl}>Tile waste (%)</label><input type="number" value={settings.waste.tile} onChange={(e) => setSettings({ waste: { ...settings.waste, tile: e.target.value } })} className={inp + " w-28"} /></div>
              <div><label className={lbl}>Flooring waste (%)</label><input type="number" value={settings.waste.floor} onChange={(e) => setSettings({ waste: { ...settings.waste, floor: e.target.value } })} className={inp + " w-28"} /><div className="text-[11px] text-slate-400 mt-1">Hardwood, vinyl, laminate, carpet</div></div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <label className={lbl}>Appearance</label>
              <p className="text-[11px] text-slate-400 mt-1 mb-2.5 max-w-md">Applies on this device only. The printed estimate stays on white paper.</p>
              <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
                {[{ v: "system", label: "System", icon: Laptop }, { v: "light", label: "Light", icon: Sun }, { v: "dark", label: "Dark", icon: Moon }].map(({ v, label, icon: Icon }) => (
                  <button key={v} onClick={() => setTheme(v)} className={`flex items-center gap-1.5 px-3.5 py-2 font-medium ${theme === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}><Icon size={14} /> {label}</button>
                ))}
              </div>
            </div>
          </div>
        ) : section === "book" ? (
          <PriceBookLibrary books={books} stock={stock} addBook={addBook} updateBook={updateBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImport} loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} rollbackStock={rollbackStock} importing={importing} importPriceBook={importPriceBook} pbRef={pbRef} settings={settings} setSettings={setSettings} gFamilies={gFamilies} inp={inp} lbl={lbl} types={types} typeLabels={typeLabels} />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">Backup &amp; restore</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-xl">Download everything (customers, versions, settings, attachments) as one file. Restoring adds each customer from the file as a new entry — nothing existing is overwritten.</p>
            {settings.ops?.lastBackup && <p className="text-xs text-slate-400 mt-1">Last backup downloaded {new Date(settings.ops.lastBackup.at).toLocaleDateString()}{settings.ops.lastBackup.by ? ` by ${settings.ops.lastBackup.by}` : ""}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={exportBackup} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Download size={14} /> Download backup</button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Upload size={14} /> Restore backup</button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
