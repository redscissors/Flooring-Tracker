import { Fragment, useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Trash2, Settings, Save, Printer, ClipboardList, FileText, Download, Upload, X, History, Check, Paperclip, Menu, LogOut, ChevronRight, ChevronDown, Hand, Pencil } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { num, normalizeSettings, withDerived, serializeSettings, groutExact, mortarExact, getGrout, getMortar, cartonExact, getCarton, underlayExact, getUnderlay, getUnderlayInstall, offeredGrouts, offeredMortars, offeredUnderlayments, catalogHasSeedUnderlayments, isDuplicateName, addCompany, addProduct, removeProduct, removeCompany } from "./catalog.js";
import { normStockItem, stockData, searchStock, findStock, stockPatch, stockDrift, diffStock, syncCatalogPrices } from "./stock.js";
import { parsePriceBook } from "./pricebook.js";

const TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
const TLBL = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };
// The underlayment row is labelled per flooring type — a tile job wants "backer"
// language, the soft/plank goods want "underlayment".
const UNDERLAY_LABEL = { tile: "Tile Backer" };
const underlayLabel = (type) => UNDERLAY_LABEL[type] || "Underlayment";
// Editorial accents: each flooring type colours its selection card's left border
// and active chip; each area's index marker cycles through the area palette.
const TYPE_ACCENT = { tile: "oklch(0.55 0.08 232)", hardwood: "oklch(0.58 0.10 60)", vinyl: "oklch(0.55 0.07 158)", laminate: "oklch(0.57 0.10 32)", carpet: "oklch(0.53 0.08 320)", misc: "oklch(0.55 0.02 270)" };
const AREA_ACCENTS = ["oklch(0.60 0.11 45)", "oklch(0.58 0.07 232)", "oklch(0.56 0.10 350)", "oklch(0.57 0.08 145)", "oklch(0.63 0.10 75)", "oklch(0.57 0.07 200)"];
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

const StockHit = ({ it }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <span className="text-xs font-medium truncate flex-1">{it.description || it.product || it.section}</span>
    </div>
    <div className="flex items-baseline gap-2 text-[11px] text-slate-400">
      <span className="truncate">{[it.size, it.brand && !it.description.includes(it.brand) ? it.brand : it.section].filter(Boolean).join(" · ")}</span>
      <span className="ml-auto shrink-0 ft-mono">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
  </>
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

// SKU typeahead for a product row. Typing stores the text on the row (a SKU is
// just a field); picking a suggestion snapshots the stock item's values onto
// the row via onPick. Search matches SKU prefixes or words in the item text.
// Shift-click (or the leading checkbox) marks several results; committing the
// selection fills this row with the first item and appends a product row for
// each of the rest via onPickMany.
function SkuPicker({ value, stock, onChange, onPick, onPickMany }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [picked, setPicked] = useState([]); // SKUs, in click order
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const matches = open ? searchStock(stock, value) : [];
  const results = matches.slice(0, SKU_SHOW);
  const close = () => { setOpen(false); setPicked([]); };
  const pos = useAnchoredPanel(open, wrapRef, panelRef, close);
  const pick = (it) => { onPick(it); close(); };
  const toggle = (it) => setPicked((prev) => prev.includes(it.sku) ? prev.filter((s) => s !== it.sku) : [...prev, it.sku]);
  // Resolve against the full stock list, not the current matches — the user
  // may change search words between picks and the selection must survive that.
  const commit = () => {
    const items = picked.map((sku) => findStock(stock, sku)).filter(Boolean);
    if (items.length === 1) onPick(items[0]);
    else if (items.length) onPickMany(items);
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
    <div ref={wrapRef} className="relative w-28 shrink-0 h-9 border-r border-slate-200">
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        className="w-full h-full px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder="SKU" title="Stock price book — enter a SKU or search words, pick a match to fill this row. Shift-click to pick several at once." />
      {open && pos && (results.length > 0 || picked.length > 0) && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: Math.max(8, Math.min(pos.left, window.innerWidth - Math.min(416, window.innerWidth * 0.9) - 8)) }}
          className="fixed w-[26rem] max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg z-50">
          <div className="max-h-72 overflow-y-auto">
            {results.map((it, i) => {
              const sel = picked.includes(it.sku);
              return (
                <div key={it.sku} onClick={(e) => (e.shiftKey || picked.length ? toggle(it) : pick(it))} onMouseEnter={() => setHi(i)}
                  className={`flex items-start gap-2 cursor-pointer px-2.5 py-1.5 border-b border-slate-100 last:border-0 ${sel ? "bg-indigo-50/60" : i === hi ? "bg-slate-50" : ""}`}>
                  <button onClick={(e) => { e.stopPropagation(); toggle(it); }} title={sel ? "Remove from selection" : "Add to selection"}
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{sel && <Check size={11} />}</button>
                  <div className="flex-1 min-w-0"><StockHit it={it} /></div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
            <span className="truncate">{matchSummary(results.length, matches.length)}</span>
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
function StockSearch({ stock, onPick, inp }) {
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
        className={inp} placeholder="Search the price book to pre-fill (optional)…" />
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
    mats.push({ kind: "Grout", key: `g|${p.grout.product}|${p.grout.color || ""}`, name: p.grout.product, spec: p.grout.color || "", detail: j ? `${j} joint` : "", inline: true, order: G ? G.order : 0, unit: G ? G.unit : "", exact: G ? G.exact : 0, price: G ? G.price : 0, cost: G && G.price > 0 ? G.order * G.price : 0 });
    const ck = num(p.grout.caulk);
    if (ck > 0) mats.push({ kind: "Caulk", key: `c|${p.grout.product}|${p.grout.color || ""}`, name: `${p.grout.product} matching caulk`, spec: p.grout.color || "", detail: "", inline: true, order: ck, unit: "tubes", exact: ck, cost: 0 });
  }
  if (M) mats.push({ kind: "Mortar", key: `m|${M.product}`, name: M.product, spec: "", detail: "", inline: true, order: M.order, unit: M.unit, exact: M.exact, price: M.price, cost: M.price > 0 ? M.order * M.price : 0 });
  if (U && U.product) mats.push({ kind: underlayLabel(p.type), key: `u|${U.product}`, name: U.product, spec: "", detail: IN.length ? "+ install materials" : "", inline: true, order: U.order, unit: U.unit, exact: U.exact, price: U.price, cost: U.price > 0 ? U.order * U.price : 0 });
  IN.forEach((m) => mats.push(m.kind === "mortar"
    ? { kind: "Mortar", key: `m|${m.name}`, name: m.name, spec: "", detail: "", inline: false, order: m.order, unit: m.unit, exact: m.exact, price: m.price, cost: m.price > 0 ? m.order * m.price : 0 }
    : { kind: "Install", key: `i|${m.name}`, name: m.name, spec: U?.product ? `installs ${U.product}` : "", detail: "", inline: false, order: m.order, unit: m.unit, exact: m.exact, price: m.price, cost: m.price > 0 ? m.order * m.price : 0 }));
  const size = p.type === "tile" ? `${p.L}" × ${p.W}"${p.thickness ? ` × ${THICK.find((t) => t.v === String(p.thickness))?.label || p.thickness + '"'}` : ""}` : (p.sizeText || "");
  const qtyText = p.type === "misc" ? String(miscQty(p)) : C ? (C.order > 0 ? `${C.order} ${C.unit}` : "") : num(p.qty) > 0 ? `${p.qty} ${p.qtyType === "sqft" ? "sf" : "units"}` : "";
  const priceText = num(p.priceSqft) > 0 ? (p.type === "misc" ? money(num(p.priceSqft)) + (miscQty(p) !== 1 ? "/ea" : "") : `${money(num(p.priceSqft))}/${p.qtyType === "count" ? "ea" : "sf"}`) : "";
  return { size, C, line, mats, qtyText, priceText, orderedSf: p.type === "misc" ? 0 : C ? C.order * C.sf : sf };
}
// Estimate area headers show the flooring subtotal only — material costs live
// in the bottom "Setting materials & sundries" breakdown.
const printAreaFloor = (a, s) => a.products.reduce((t, p) => t + printProduct(p, s).line, 0);
const PRINT_KINDS = ["Grout", "Caulk", "Mortar", "Tile Backer", "Underlayment", "Install"];
const KSHORT = { Grout: "Grout", Caulk: "Caulk", Mortar: "Mortar", "Tile Backer": "Backer", Underlayment: "Underlay", Install: "Install" };
const u1 = (order, unit) => (order === 1 ? String(unit || "").replace(/s$/, "") : unit);
// Whole-job materials for the estimate's bottom breakdown: aggregate exact
// quantities per item (ceil once at the end, like the on-screen totals) and
// sum the per-line costs so the breakdown reconciles with the grand total.
function printMatList(cust, s) {
  const agg = new Map();
  (cust.categories || []).forEach((a) => a.products.forEach((p) => printProduct(p, s).mats.forEach((m) => {
    const e = agg.get(m.key) || { kind: m.kind, name: m.name, spec: m.spec, unit: m.unit, price: m.price, exact: 0, cost: 0 };
    e.exact += m.exact; e.cost += m.cost; agg.set(m.key, e);
  })));
  return [...agg.values()].map((m) => ({ ...m, order: Math.ceil(Math.round(m.exact * 1e6) / 1e6) })).sort((x, y) => PRINT_KINDS.indexOf(x.kind) - PRINT_KINDS.indexOf(y.kind));
}
const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const dataURLToBlob = (dataURL) => { const [meta, b64] = String(dataURL).split(","); const mime = (meta.match(/:(.*?);/) || [])[1] || "application/octet-stream"; const bin = atob(b64 || ""); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); };

const newProduct = () => ({ id: uid(), type: "tile", sku: "", L: "", W: "", thickness: "0.375", sizeText: "", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", cartonSf: "", cartonUnit: "CT", cartonManual: "", note: "", grout: { checked: false, product: "PermaColor Select", color: "", joint: 0.125, manual: "", caulk: "" }, mortar: { checked: false, product: "ProLite", manual: "" }, underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} } });
const newArea = () => ({ id: uid(), name: "New Area", note: "", products: [newProduct()] });
const newCustomer = () => ({ id: uid(), name: "New Customer", address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: [], versions: [], attachments: [] });

// thickness/joint use || not ??: rows migrated from the artifact can hold ""
// (or 0), which silently blocks the grout calc — mortar doesn't need either,
// so grout alone showed "—". Default them like a fresh row.
const normP = (p) => ({ id: p.id || uid(), type: TYPES.includes(p.type) ? p.type : "tile", sku: p.sku ?? "", L: p.L ?? "", W: p.W ?? "", thickness: p.thickness || "0.375", sizeText: p.sizeText ?? (p.size || ""), brandColor: p.brandColor ?? [p.brand, p.color].filter(Boolean).join(" / "), priceSqft: p.priceSqft ?? "", qtyType: p.qtyType === "count" ? "count" : "sqft", qty: p.qty ?? "", cartonSf: p.cartonSf ?? "", cartonUnit: p.cartonUnit || "CT", cartonManual: p.cartonManual ?? "", note: p.note ?? "", grout: { checked: !!p.grout?.checked, product: p.grout?.product || "PermaColor Select", color: p.grout?.color || "", joint: num(p.grout?.joint) > 0 ? p.grout.joint : 0.125, manual: p.grout?.manual ?? "", caulk: p.grout?.caulk ?? "" }, mortar: { checked: !!p.mortar?.checked, product: p.mortar?.product || "ProLite", manual: p.mortar?.manual ?? "" }, underlay: { checked: !!p.underlay?.checked, product: p.underlay?.product || "", manual: p.underlay?.manual ?? "", install: !!p.underlay?.install, installMortars: p.underlay?.installMortars || {}, installSkip: p.underlay?.installSkip || {} } });
const normA = (a) => ({ id: a.id || uid(), name: a.name || "Area", note: a.note || "", products: (a.products || [{}]).map(normP) });
const normC = (c) => ({ ...c, categories: (c.categories || []).map(normA), versions: c.versions || [], attachments: c.attachments || [] });

// The light list row: everything the sidebar draws/searches/sorts, projected out
// of the jsonb server-side. Shared by the initial load and server-side search.
const LIST_SELECT = "id, created_at, updated_at, name:data->>name, address:data->>address, phone:data->>phone, email:data->>email";
const lightRow = (r) => ({
  id: r.id,
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
const RECENT_COUNT = 10;

export default function App({ user, onSignOut }) {
  const [data, setData] = useState(() => ({ customers: [], settings: normalizeSettings() }));
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [allOpen, setAllOpen] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(min-width: 768px)").matches : true);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  // Active card drag: { pid, fromAid, to: { aid, index, y } | null }. The card
  // follows the pointer imperatively (no re-render per move); state only changes
  // when the drop target changes, to redraw the insertion bar / area highlight.
  const [drag, setDrag] = useState(null);
  const [insOpen, setInsOpen] = useState({});
  // Which products' materials drawers are expanded — view state only, never
  // persisted. Collapsed shows fine-print summaries of the checked materials.
  const [matOpen, setMatOpen] = useState({});
  const [confirmProd, setConfirmProd] = useState(null); // { aid, pid }
  const [confirmArea, setConfirmArea] = useState(null); // area id
  const mainRef = useRef(null);
  const fileRef = useRef(null);
  const attRef = useRef(null);
  const areaRefs = useRef({});
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

        const customers = await loadCustomers();
        setData({ customers, settings });
        // Best-effort: installs that haven't run supabase/stock.sql yet just
        // don't get the SKU picker.
        try { setStock(await loadStock()); } catch (x) { }
      } catch (e) { ping("Could not load your data — check connection"); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Fetch every customer the current user may see (own + public), but LIGHT:
  // only the fields the list draws/searches/sorts, projected out of the jsonb
  // server-side. The heavy detail (categories/products/versions/attachments)
  // stays on the server until a customer is opened (see loadDetail).
  const loadCustomers = async () => {
    const { data: rows, error } = await supabase.from("customers").select(LIST_SELECT);
    if (error) throw error;
    return (rows || []).map(lightRow);
  };

  // Lazy-load one customer's full record on open, merging it into the light row.
  // Version metadata (never snapshots) loads alongside; snapshots are fetched
  // one at a time on restore.
  const loadDetail = async (id) => {
    const existing = data.customers.find((c) => c.id === id);
    if (!existing || existing._full) return;
    try {
      const [{ data: row, error }, { data: vRows, error: vErr }] = await Promise.all([
        supabase.from("customers").select("data").eq("id", id).maybeSingle(),
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
        customers: prev.customers.map((c) => c.id === id
          ? { ...c, ...full, versions, id: c.id, createdAt: c.createdAt, _full: true }
          : c),
      }));
      baselineRef.current = { id, json: JSON.stringify(full.categories) };
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
    const { data: rows, error } = await supabase.from("stock_items").select("sku, active, data, updated_at");
    if (error) throw error;
    return (rows || []).map(normStockItem);
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
  const applyImport = async () => {
    const { diff, sync } = importPreview;
    setImportPreview(null);
    const upserts = [
      ...diff.added.map((it) => ({ sku: it.sku, active: true, data: stockData(it) })),
      ...diff.changed.map(({ item }) => ({ sku: item.sku, active: true, data: stockData(item) })),
      ...diff.missing.map((it) => ({ sku: it.sku, active: false, data: stockData(it) })),
    ];
    try {
      for (let i = 0; i < upserts.length; i += 200) {
        const { error } = await supabase.from("stock_items").upsert(upserts.slice(i, i + 200), { onConflict: "sku" });
        if (error) throw error;
      }
      if (sync.changes.length) setSettings({ catalog: sync.catalog });
      setStock(await loadStock());
      flashSaved();
      ping(`Price book imported — ${diff.added.length} new, ${diff.changed.length} updated, ${diff.missing.length} retired`);
    } catch (x) { ping("Import failed — has supabase/stock.sql been run?"); }
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
      const { ownerId, visibility, archived, ...rest } = c;
      await supabase.from("customers").upsert(
        { id: c.id, owner_id: user.id, data: rest, created_at: new Date(c.createdAt || Date.now()).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    // Drop the migrated array from the blob, keeping what still lives there
    // (the user's profile).
    await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" });
  };
  useEffect(() => { if (focusArea && areaRefs.current[focusArea]) { const el = areaRefs.current[focusArea]; el.focus(); el.select?.(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusArea(null); } }, [focusArea, data]);
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
        const { data: rows, error } = await supabase.from("customers").select(LIST_SELECT).or(ors);
        if (error) throw error;
        if (stale) return;
        const found = (rows || []).map(lightRow);
        setData((prev) => {
          const have = new Set(prev.customers.map((c) => c.id));
          const fresh = found.filter((r) => !have.has(r.id));
          return fresh.length ? { ...prev, customers: [...prev.customers, ...fresh] } : prev;
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
  const custData = ({ ownerId, visibility, archived, versions, _full, updatedAt, ...rest }) => rest;

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
  const sel = data.customers.find((c) => c.id === selId) || null;

  // Every customer-content mutation goes through here: optimistic state update +
  // an UPDATE of that one row's data.
  const updateCust = (id, patch) => {
    const next = { ...data, customers: data.customers.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) };
    setData(next);
    const cust = next.customers.find((c) => c.id === id);
    (async () => { try { const { error } = await supabase.from("customers").update({ data: custData(cust) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };

  const addCustomer = () => {
    const c = { ...newCustomer(), updatedAt: Date.now(), _full: true };
    setData((prev) => ({ ...prev, customers: [c, ...prev.customers] }));
    baselineRef.current = { id: c.id, json: JSON.stringify(c.categories) };
    setSelId(c.id); setSidebarOpen(false); setFocusName(true);
    (async () => { try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, data: custData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const pickCustomer = (id) => { setSelId(id); setSidebarOpen(false); loadDetail(id); };
  const delCustomer = async (id) => {
    const cust = data.customers.find((c) => c.id === id);
    if (cust) { for (const m of (cust.attachments || [])) { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(id, m.id)]); } catch (x) { } } }
    setData((prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }));
    if (selId === id) setSelId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("customers").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };
  const addArea = () => { const a = newArea(); updateCust(sel.id, { categories: [...sel.categories, a] }); setFocusArea(a.id); };
  const tabTo = (ref) => (e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); ref.current?.focus(); ref.current?.select?.(); } };
  const updArea = (aid, patch) => updateCust(sel.id, { categories: sel.categories.map((a) => a.id === aid ? { ...a, ...patch } : a) });
  const delArea = (aid) => updateCust(sel.id, { categories: sel.categories.filter((a) => a.id !== aid) });
  const addProduct = (aid) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: [...a.products, newProduct()] }); };
  const updProduct = (aid, pid, patch) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.map((p) => p.id === pid ? { ...p, ...patch } : p) }); };
  // Multi-pick from the SKU dropdown: the first item fills the anchor row, each
  // further item becomes its own new product row right below it.
  const addStockProducts = (aid, pid, items) => {
    if (!items.length) return;
    const a = sel.categories.find((x) => x.id === aid);
    const products = a.products.flatMap((p) => p.id !== pid ? [p] : [
      { ...p, ...stockPatch(items[0], p) },
      ...items.slice(1).map((it) => { const np = newProduct(); return { ...np, ...stockPatch(it, np) }; }),
    ]);
    updArea(aid, { products });
  };
  const delProduct = (aid, pid) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.filter((p) => p.id !== pid) }); };
  const moveProduct = (fromAid, pid, toAid, toIndex) => {
    const p = sel.categories.find((x) => x.id === fromAid)?.products.find((x) => x.id === pid);
    if (!p) return;
    updateCust(sel.id, { categories: sel.categories.map((a) => {
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
    Object.assign(node.style, { position: "relative", zIndex: 50, pointerEvents: "none", transition: "scale .18s ease, rotate .18s ease, box-shadow .18s ease", scale: "1.03", rotate: "0.6deg", boxShadow: "0 14px 34px rgba(40,30,20,.22)", willChange: "translate" });
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
      Object.assign(node.style, { position: "", zIndex: "", pointerEvents: "", transition: "", scale: "", rotate: "", boxShadow: "", willChange: "", translate: "" });
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
  const addAttachment = async (e) => { const f = e.target.files?.[0]; if (!f) return; const id = uid(); try { const { error } = await supabase.storage.from(ATT_BUCKET).upload(attPath(sel.id, id), f, { contentType: f.type, upsert: true }); if (error) throw error; updateCust(sel.id, { attachments: [...(sel.attachments || []), { id, name: f.name, type: f.type, size: f.size }] }); ping("Attachment added"); } catch (x) { ping("Upload failed — file may be too large"); } e.target.value = ""; };
  const openAttachment = async (m) => { try { const { data: blob, error } = await supabase.storage.from(ATT_BUCKET).download(attPath(sel.id, m.id)); if (error) throw error; const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = m.name; a.click(); URL.revokeObjectURL(u); } catch (x) { ping("Could not load attachment"); } };
  const delAttachment = async (m) => { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(sel.id, m.id)]); } catch (x) { } updateCust(sel.id, { attachments: (sel.attachments || []).filter((x) => x.id !== m.id) }); };

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
      setData((prev) => ({ ...prev, customers: prev.customers.map((c) => c.id === cust.id ? { ...c, versions: [v, ...(c.versions || [])] } : c) }));
      baselineRef.current = { id: cust.id, json: JSON.stringify(cust.categories) };
      flashSaved(); ping("Version saved");
    } catch (e) { ping("Save failed — check connection"); }
  };
  const loadVersion = async (v) => {
    try {
      const { data: row, error } = await supabase.from("versions").select("snapshot").eq("id", v.id).maybeSingle();
      if (error || !row) throw error || new Error("missing");
      updateCust(sel.id, { categories: (Array.isArray(row.snapshot) ? row.snapshot : []).map(normA) });
      setShowVersions(false); ping("Version loaded");
    } catch (e) { ping("Could not load version — check connection"); }
  };
  const delVersion = async (vid) => {
    setData((prev) => ({ ...prev, customers: prev.customers.map((c) => c.id === sel.id ? { ...c, versions: (c.versions || []).filter((v) => v.id !== vid) } : c) }));
    try { const { error } = await supabase.from("versions").delete().eq("id", vid); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // The safety net: when a work session on a customer ends (they get deselected,
  // or the user signs out) and the selections changed since open / last
  // snapshot, save an automatic version. Autos beyond the newest AUTO_KEEP are
  // pruned; named versions are never touched. Baseline advances only on a
  // successful save so a failed attempt is retried at the next deselect.
  const autoSnapshot = async (id) => {
    const c = dataRef.current.customers.find((x) => x.id === id);
    const base = baselineRef.current;
    if (!c || !c._full || !base || base.id !== id) return;
    const json = JSON.stringify(c.categories);
    if (json === base.json) return;
    const label = "Auto — " + new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    try {
      const v = await insertVersion(id, label, true, c.categories);
      baselineRef.current = { id, json };
      const drop = [v, ...(c.versions || []).filter((x) => x.auto)].sort((a, b) => b.savedAt - a.savedAt).slice(AUTO_KEEP).map((x) => x.id);
      setData((prev) => ({ ...prev, customers: prev.customers.map((x) => x.id === id ? { ...x, versions: [v, ...(x.versions || [])].filter((vv) => !drop.includes(vv.id)) } : x) }));
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

  const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const exportCSV = () => {
    const head = ["Customer", "Area", "Type", "SKU", "Size", "Brand/Color", "$/SqFt", "QtyType", "Qty", "SF/Carton", "Cartons Exact", "Cartons Order", "Line Total", "Note", "Grout", "Grout Color", "Joint", "Grout Exact", "Grout Order", "Caulk Tubes", "Mortar", "Mortar Exact", "Mortar Order", "Underlayment", "Underlayment Exact", "Underlayment Order", "Install Materials"]; const rows = [];
    sel.categories.forEach((a) => a.products.forEach((p) => { const size = p.type === "tile" ? `${p.L}x${p.W}x${p.thickness}` : p.sizeText; const j = JOINTS.find((x) => x.v === num(p.grout.joint))?.label || ""; const C = getCarton(p, settings); const line = p.type === "misc" ? num(p.priceSqft) * miscQty(p) : p.qtyType === "sqft" ? (C ? C.order * C.sf : num(p.qty)) * num(p.priceSqft) : ""; const G = getGrout(p, settings), M = getMortar(p, settings), U = getUnderlay(p, settings), IN = getUnderlayInstall(p, settings); rows.push([sel.name, a.name, TLBL[p.type], p.sku || "", size, p.brandColor, p.priceSqft, p.qtyType, p.qty, C ? C.sf : "", C ? C.exact.toFixed(2) : "", C ? C.order : "", line, p.note, G ? G.product : "", G ? G.color : "", G ? j : "", G ? G.exact.toFixed(2) : "", G ? G.order : "", p.type === "tile" && p.grout.checked && num(p.grout.caulk) > 0 ? num(p.grout.caulk) : "", M ? M.product : "", M ? M.exact.toFixed(2) : "", M ? M.order : "", U ? U.product : "", U ? U.exact.toFixed(2) : "", U ? U.order : "", IN ? IN.map((m) => `${m.name}: ${m.order} ${m.unit}`).join("; ") : ""]); }));
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    dl(new Blob([csv], { type: "text/csv" }), `${sel.name.replace(/\s+/g, "_")}_selections.csv`);
  };
  const exportBackup = async () => {
    // The in-memory list is light, so pull every full record before backing up.
    // Versions come from their own table and are re-embedded per customer, so
    // the backup file keeps the original (pre-table) shape.
    let customers;
    try {
      const [{ data: rows, error }, { data: vRows, error: vErr }] = await Promise.all([
        supabase.from("customers").select("id, data, created_at"),
        supabase.from("versions").select("id, customer_id, label, auto, saved_at, snapshot"),
      ]);
      if (error) throw error;
      if (vErr) throw vErr;
      const byCust = {};
      (vRows || []).forEach((r) => { (byCust[r.customer_id] = byCust[r.customer_id] || []).push({ id: r.id, label: r.label, auto: !!r.auto, savedAt: r.saved_at ? new Date(r.saved_at).getTime() : Date.now(), snapshot: r.snapshot || [] }); });
      customers = (rows || []).map((r) => {
        const c = { ...normC(r.data || {}), id: r.id };
        const table = (byCust[r.id] || []).sort((a, b) => b.savedAt - a.savedAt);
        return { ...c, versions: table.length ? table : c.versions };
      });
    } catch (e) { ping("Backup failed — check connection"); return; }
    const attachments = {};
    for (const c of customers) for (const m of (c.attachments || [])) { try { const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(attPath(c.id, m.id)); if (blob) attachments[m.id] = await blobToDataURL(blob); } catch (x) { } }
    dl(new Blob([JSON.stringify({ customers, settings: data.settings, attachments }, null, 2)], { type: "application/json" }), `floortrack_backup_${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importBackup = (e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try {
    const p = JSON.parse(fr.result);
    // Restore each customer as a new row (with a fresh id so it can't collide
    // with an existing customer), then upload its files.
    const restored = [];
    for (const raw of (p.customers || [])) {
      const c = { ...normC(raw), id: uid(), updatedAt: Date.now(), _full: true };
      const idMap = {};
      c.attachments = (c.attachments || []).map((m) => { const nid = uid(); idMap[m.id] = nid; return { ...m, id: nid }; });
      try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, data: custData(c), created_at: new Date(c.createdAt || Date.now()).toISOString() }); if (error) throw error; } catch (x) { continue; }
      // Versions restore as table rows with fresh ids — the same path handles
      // backups made before versions moved out of the blob.
      const vRows = (c.versions || []).map((v) => ({ id: uid(), customer_id: c.id, label: v.label || "Version", auto: !!v.auto, saved_at: new Date(v.savedAt || Date.now()).toISOString(), snapshot: v.snapshot || [] }));
      if (vRows.length) { try { const { error } = await supabase.from("versions").insert(vRows); if (error) throw error; } catch (x) { } }
      c.versions = vRows.map((r) => vMeta(r));
      for (const m of c.attachments) { const val = p.attachments?.[Object.keys(idMap).find((k) => idMap[k] === m.id)]; if (!val) continue; try { await supabase.storage.from(ATT_BUCKET).upload(attPath(c.id, m.id), dataURLToBlob(val), { upsert: true }); } catch (x) { } }
      restored.push(c);
    }
    if (p.settings) setSettings(serializeSettings(normalizeSettings(p.settings)));
    setData((prev) => ({ ...prev, customers: [...restored, ...prev.customers] }));
    ping("Backup restored");
  } catch (x) { ping("Invalid file"); } }; fr.readAsText(f); e.target.value = ""; };

  let totalSqft = 0, orderedSqft = 0, flooringPrice = 0, groutCost = 0, mortarCost = 0, underlayCost = 0, miscCost = 0; const gAgg = {}, mAgg = {}, uAgg = {}, cAgg = {};
  (sel?.categories || []).forEach((a) => a.products.forEach((p) => { if (p.type === "misc") { miscCost += num(p.priceSqft) * miscQty(p); } else if (p.qtyType === "sqft") { const sf = num(p.qty); totalSqft += sf; const C = getCarton(p, settings); orderedSqft += C ? C.order * C.sf : sf; flooringPrice += (C ? C.order * C.sf : sf) * num(p.priceSqft); } const G = getGrout(p, settings); if (G) { groutCost += G.order * G.price; const k = G.product + "||" + (G.color || "—"); if (!gAgg[k]) gAgg[k] = { product: G.product, color: G.color || "—", exact: 0 }; Object.assign(gAgg[k], { unit: G.unit, price: G.price, pending: false }); gAgg[k].exact += G.exact; } else if (p.type === "tile" && p.grout?.checked) { const k = p.grout.product + "||" + (p.grout.color || "—"); if (!gAgg[k]) gAgg[k] = { product: p.grout.product, color: p.grout.color || "—", unit: settings.grouts[p.grout.product]?.unit || "units", price: 0, exact: 0, pending: true }; } if (p.type === "tile" && p.grout?.checked) { const ck = num(p.grout.caulk); if (ck > 0) { const k = p.grout.product + "||" + (p.grout.color || "—"); if (!cAgg[k]) cAgg[k] = { product: p.grout.product, color: p.grout.color || "—", unit: "tubes", exact: 0 }; cAgg[k].exact += ck; } } const M = getMortar(p, settings); if (M) { mortarCost += M.order * M.price; const k = M.product; if (!mAgg[k]) mAgg[k] = { product: M.product, exact: 0 }; Object.assign(mAgg[k], { unit: M.unit, price: M.price, pending: false }); mAgg[k].exact += M.exact; } else if (p.type === "tile" && p.mortar?.checked) { const k = p.mortar.product; if (!mAgg[k]) mAgg[k] = { product: p.mortar.product, unit: settings.mortars[p.mortar.product]?.unit || "units", price: 0, exact: 0, pending: true }; } const U = getUnderlay(p, settings); if (U && U.product) { underlayCost += U.order * U.price; const k = U.product; if (!uAgg[k]) uAgg[k] = { product: U.product, exact: 0 }; Object.assign(uAgg[k], { unit: U.unit, price: U.price, pending: false }); uAgg[k].exact += U.exact; } else if (p.type !== "misc" && p.underlay?.checked && p.underlay.product) { const k = p.underlay.product; if (!uAgg[k]) uAgg[k] = { product: p.underlay.product, unit: settings.underlayments?.[p.underlay.product]?.unit || "units", price: 0, exact: 0, pending: true }; } const IN = getUnderlayInstall(p, settings); if (IN) IN.forEach((m) => { if (m.kind === "mortar") { mortarCost += m.order * m.price; const k = m.name; if (!mAgg[k]) mAgg[k] = { product: m.name, unit: m.unit, price: m.price, exact: 0 }; mAgg[k].exact += m.exact; } else { underlayCost += m.order * m.price; const k = "install||" + m.name; if (!uAgg[k]) uAgg[k] = { product: m.name, unit: m.unit, price: m.price, exact: 0 }; uAgg[k].exact += m.exact; } }); }));
  const gList = Object.values(gAgg).map((g) => { const order = Math.ceil(g.exact); return { ...g, order, cost: order * num(g.price) }; });
  const mList = Object.values(mAgg).map((m) => { const order = Math.ceil(m.exact); return { ...m, order, cost: order * num(m.price) }; });
  const uList = Object.values(uAgg).map((u) => { const order = Math.ceil(u.exact); return { ...u, order, cost: order * num(u.price) }; });
  const cList = Object.values(cAgg).map((c) => ({ ...c, order: Math.ceil(c.exact) }));
  const hasMat = gList.length > 0 || mList.length > 0 || uList.length > 0 || cList.length > 0; const grandTotal = flooringPrice + groutCost + mortarCost + underlayCost + miscCost;
  const pMats = sel && sel._full ? printMatList(sel, settings) : [];
  const selCount = (sel?.categories || []).reduce((n, a) => n + a.products.length, 0);
  const sortCustomers = (list) => [...list].sort((a, b) => sortBy === "name" ? (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }) : (b.createdAt || 0) - (a.createdAt || 0));
  // With no search, the list leads with the jobs anyone touched most recently;
  // everything else sits below in groups (letters when sorted A–Z, age buckets
  // when sorted Newest) behind an expandable "All customers".
  const q = search.trim().toLowerCase();
  const searchList = q ? sortCustomers(data.customers.filter((c) => [c.name, c.address, c.phone, c.email].some((f) => (f || "").toLowerCase().includes(q)))) : null;
  const visible = data.customers;
  // Sorting A–Z means "give me the whole list alphabetical" — the recency
  // shortcut would contradict that, so it only leads the Newest view.
  const recentList = !q && sortBy !== "name" ? [...visible].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, RECENT_COUNT) : [];
  const recentIds = new Set(recentList.map((c) => c.id));
  const restList = sortCustomers(visible.filter((c) => !recentIds.has(c.id)));
  const allExpanded = allOpen ?? restList.length <= 25;
  const groupOf = (c) => {
    if (sortBy === "name") { const ch = ((c.name || "").trim()[0] || "#").toUpperCase(); return /[A-Z]/.test(ch) ? ch : "#"; }
    const age = Date.now() - (c.createdAt || 0);
    return age < 30 * 24 * 3600 * 1000 ? "This month" : age < 365 * 24 * 3600 * 1000 ? "This year" : "Older";
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const lbl = "ft-eyebrow text-[10px] mb-1 block";

  const renderCustItem = (c) => {
    const on = selId === c.id;
    const areaCount = c._full ? (c.categories?.length || 0) : null;
    const sub = c.address || (areaCount != null ? `${areaCount} area${areaCount === 1 ? "" : "s"}` : "");
    return (
      <button key={c.id} onClick={() => pickCustomer(c.id)} className={`w-full text-left rounded-md px-2.5 py-2 mb-0.5 transition flex items-center gap-2.5 border ${on ? "bg-white border-slate-200 shadow-[0_1px_4px_rgba(40,30,20,.06)]" : "border-transparent hover:bg-slate-50"}`}>
        <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${on ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>{(c.name || "?").slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold truncate">{c.name || "Untitled"}</div>
          {sub && <div className="text-[11.5px] text-slate-400 truncate mt-px">{sub}</div>}
        </div>
      </button>
    );
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: '"Hanken Grotesk", ui-sans-serif, system-ui, sans-serif' }}>
      <div className={`print:hidden flex ${isWide ? "flex-row" : "flex-col"} flex-1 overflow-hidden relative`}>
        {/* Mobile top bar */}
        {!isWide && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 ft-rail border-b border-slate-200">
            <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1 text-slate-600"><Menu size={20} /></button>
            <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center ft-serif text-white" style={{ fontSize: 15 }}>F</div>
            <span className="ft-serif text-lg truncate flex-1">{sel ? sel.name : "FloorTrack"}</span>
          </div>
        )}

        {!isWide && sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={isWide ? "ft-rail border-r border-slate-200 flex flex-col w-64 shrink-0" : `ft-rail border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-lg bg-indigo-600 flex items-center justify-center ft-serif text-white shrink-0" style={{ fontSize: 20 }}>F</div>
            <div className="flex-1 min-w-0"><div className="ft-serif text-xl leading-none">FloorTrack</div><div className="ft-eyebrow text-[9.5px] mt-1.5">Selection Manager</div></div>
            {!isWide && <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><X size={18} /></button>}
          </div>
          <div className="p-2.5 space-y-2">
            <div className="relative"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className={inp + " pl-8"} /></div>
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
              {[["Newest", "newest"], ["A–Z", "name"]].map(([label, v]) => (
                <button key={v} onClick={() => setSortBy(v)} className={`flex-1 px-2.5 py-1.5 font-semibold ${sortBy === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}</button>
              ))}
            </div>
            <button onClick={addCustomer} className="w-full flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 transition"><Plus size={16} /> New Customer</button>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {q ? (<>
              {searchList.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">No matches</div>}
              {searchList.map((c) => renderCustItem(c))}
            </>) : (<>
              {visible.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">No customers yet</div>}
              {recentList.length > 0 && restList.length > 0 && <div className="mt-1 mb-1.5 px-2.5 ft-eyebrow text-[9px]">Recent</div>}
              {recentList.map((c) => renderCustItem(c))}
              {restList.length > 0 && recentList.length > 0 && (
                <button onClick={() => setAllOpen(!allExpanded)} className="w-full flex items-center gap-1 mt-4 mb-1.5 px-2.5 ft-eyebrow text-[9px] hover:text-slate-600">
                  {allExpanded ? <ChevronDown size={11} className="shrink-0" /> : <ChevronRight size={11} className="shrink-0" />} All customers ({restList.length})
                </button>
              )}
              {(recentList.length === 0 || allExpanded) && restList.map((c, i) => {
                const g = groupOf(c), prev = i > 0 ? groupOf(restList[i - 1]) : null;
                return (
                  <div key={c.id}>
                    {g !== prev && <div className={`px-2.5 ft-eyebrow text-[9px] mb-1 ${i === 0 && recentList.length === 0 ? "mt-1" : "mt-3"}`}>{g}</div>}
                    {renderCustItem(c)}
                  </div>
                );
              })}
            </>)}
          </div>
          <div className="p-2.5 border-t border-slate-100 space-y-2">
            <div className="flex gap-2">
              <button onClick={() => { setShowSettings(true); setSidebarOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><Settings size={15} /> Settings</button>
              <button onClick={exportBackup} title="Backup all data" className="rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-600"><Download size={15} /></button>
              <button onClick={() => fileRef.current?.click()} title="Restore backup" className="rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-600"><Upload size={15} /></button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button onClick={() => { setShowProfile(true); setSidebarOpen(false); }} title="User settings — your name, phone & email" className="flex items-center gap-2 flex-1 min-w-0 rounded-md hover:bg-slate-50 -mx-1 px-1 py-1 text-left">
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-semibold shrink-0">{(profile.name || user.email || "?").slice(0, 1).toUpperCase()}</div>
                <span className="truncate flex-1" title={user.email}>{profile.name || user.email}</span>
                <Pencil size={12} className="shrink-0 text-slate-300" />
              </button>
              <span className="w-px h-4 bg-slate-200 shrink-0" />
              <button onClick={handleSignOut} title="Sign out" className="rounded-md border border-slate-200 hover:bg-slate-50 p-1.5 text-slate-500"><LogOut size={14} /></button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {!sel ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center mb-4 ft-serif" style={{ background: "color-mix(in oklab, var(--ft-brand) 14%, transparent)", color: "var(--ft-brand)", fontSize: 30 }}>F</div>
              <h2 className="ft-serif text-2xl">Select or create a customer</h2>
              <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Pick a customer from the list, or add a new one to start building selections.</p>
            </div>
          ) : !sel._full ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading {sel.name || "customer"}…</div>
          ) : (
            <div className="max-w-4xl mx-auto p-3 md:p-5">
              <div className="bg-white rounded-lg border border-slate-200 mb-4" style={{ padding: "clamp(18px,2.4vw,28px)" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="ft-eyebrow-accent text-[10px] mb-2.5">Tile &amp; Flooring Selections</div>
                    <div className="flex items-center gap-2">
                      <input ref={nameRef} onKeyDown={tabTo(addAreaRef)} value={sel.name} onChange={(e) => updateCust(sel.id, { name: e.target.value })} placeholder="Customer name" className={"ft-serif bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-1 min-w-0 flex-1 transition" + (focusName ? " border-indigo-300" : "")} style={{ fontSize: "clamp(30px,5vw,52px)", lineHeight: 1 }} />
                      {saveOk && <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--ft-brand)" }}>Saved ✓</span>}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 text-sm text-slate-500 flex-wrap">
                      <input value={sel.address} onChange={(e) => updateCust(sel.id, { address: e.target.value })} placeholder="Address" className="bg-transparent focus:outline-none min-w-0" />
                      <span className="text-slate-300">·</span>
                      <input value={sel.phone} onChange={(e) => updateCust(sel.id, { phone: e.target.value })} placeholder="Phone" className="bg-transparent focus:outline-none w-28" />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="ft-eyebrow text-[9.5px]">Project estimate</div>
                    <div className="ft-serif" style={{ fontSize: "clamp(30px,4.5vw,46px)", lineHeight: 1, marginTop: 2 }}>{money(grandTotal)}</div>
                    <div className="ft-mono text-[11px] text-slate-500 mt-1.5">{totalSqft.toLocaleString()} sq ft · {selCount} selection{selCount === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div className="ft-noprint mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  {namingVersion ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") setNamingVersion(false); }} className="text-sm rounded-md border border-slate-200 px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button onClick={confirmVersion} className="flex items-center gap-1 text-sm rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5"><Check size={15} /></button>
                      <button onClick={() => setNamingVersion(false)} className="rounded-full border border-slate-200 hover:bg-slate-50 px-2 py-1.5 text-slate-400"><X size={15} /></button>
                    </div>
                  ) : (
                    <button onClick={startVersionName} className="flex items-center gap-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50 px-3 py-1.5"><Save size={15} /> Version</button>
                  )}
                  <button onClick={() => setShowVersions(true)} className="flex items-center gap-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50 px-3 py-1.5"><History size={15} /> {(sel.versions?.length || 0)}</button>
                  <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50 px-3 py-1.5"><FileText size={15} /> CSV</button>
                  <button onClick={() => setPrintMode("order")} className="flex items-center gap-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50 px-3 py-1.5"><ClipboardList size={15} /> Order sheet</button>
                  <button onClick={() => setPrintMode("estimate")} className="flex items-center gap-1.5 text-sm rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 font-semibold"><Printer size={15} /> Print</button>
                  <button onClick={() => setConfirm({ id: sel.id })} className="rounded-full border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 px-2 py-1.5 text-slate-400"><Trash2 size={15} /></button>
                </div>
                <div className="mt-4"><label className={lbl}>Project notes</label><textarea value={sel.notes} onChange={(e) => updateCust(sel.id, { notes: e.target.value })} rows={2} className={inp} /></div>
                <div className="ft-noprint mt-3 flex items-center gap-2 flex-wrap">
                  <span className="ft-eyebrow text-[9px] flex items-center gap-1"><Paperclip size={12} /> Attachments <span className="text-slate-300 normal-case tracking-normal">(not printed)</span></span>
                  {(sel.attachments || []).map((m) => (
                    <span key={m.id} className="flex items-center gap-1.5 rounded-md bg-slate-100 pl-2 pr-1 py-1 text-xs"><button onClick={() => openAttachment(m)} className="hover:text-indigo-600 max-w-[10rem] truncate" title={`${m.name} · ${Math.max(1, Math.round(m.size / 1024))} KB`}>{m.name}</button><button onClick={() => delAttachment(m)} className="text-slate-400 hover:text-red-500"><X size={12} /></button></span>
                  ))}
                  <button onClick={() => attRef.current?.click()} className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"><Plus size={12} /> Add</button>
                  <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="ft-serif" style={{ fontSize: "clamp(24px,3vw,34px)", lineHeight: 1 }}>Areas &amp; Selections</h2>
                <button ref={addAreaRef} onClick={addArea} className="ft-noprint flex items-center gap-1.5 text-sm font-semibold rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> Add area</button>
              </div>

              {sel.categories.length === 0 && <div className="bg-white rounded-lg border border-dashed border-slate-300 p-9 text-center text-sm text-slate-400">No areas yet. Add one to start building this customer's selections.</div>}

              <div className="space-y-4">
                {sel.categories.map((a, ai) => {
                  const areaColor = AREA_ACCENTS[ai % AREA_ACCENTS.length];
                  return (
                  <div key={a.id} data-area-drop={a.id} className={`rounded-lg border p-4 md:p-5 transition-colors ${drag?.to?.aid === a.id ? "border-indigo-400 bg-indigo-50/40" : drag ? "border-dashed border-slate-300 bg-white" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: areaColor }} />
                      <span className="ft-mono text-sm shrink-0" style={{ color: areaColor }}>{String(ai + 1).padStart(2, "0")}</span>
                      <input ref={(el) => { if (el) areaRefs.current[a.id] = el; }} value={a.name} onChange={(e) => updArea(a.id, { name: e.target.value })} className="ft-serif bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none flex-1 min-w-0" style={{ fontSize: 23, lineHeight: 1 }} />
                      <input value={a.note} onChange={(e) => updArea(a.id, { note: e.target.value })} placeholder="area note…" className="text-sm text-slate-500 bg-transparent focus:outline-none placeholder:text-slate-300 w-28 md:w-40 text-right" />
                      <button onClick={() => setConfirmArea(a.id)} title="Delete this area" className="ft-noprint text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                    {confirmArea === a.id && (
                      <div className="ft-noprint flex items-center gap-2 mt-2 text-xs">
                        <span className="text-red-600 flex-1">Delete "{a.name}" and its {a.products.length} selection{a.products.length === 1 ? "" : "s"}? Everything in this area comes off the estimate.</span>
                        <button onClick={() => { delArea(a.id); setConfirmArea(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
                        <button onClick={() => setConfirmArea(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
                      </div>
                    )}

                    <div data-prod-list="1" className="relative mt-3 space-y-3">
                      {a.products.map((p, pi) => {
                        const G = getGrout(p, settings), M = getMortar(p, settings);
                        const gEx = groutExact(p, settings), mEx = mortarExact(p, settings);
                        const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
                        // Sold by the carton: whole cartons drive the line total.
                        const C = getCarton(p, settings), cEx = cartonExact(p, settings);
                        const line = p.type === "misc" ? num(p.priceSqft) * miscQty(p) : C ? C.order * C.sf * num(p.priceSqft) : sf * num(p.priceSqft);
                        const thickKnown = THICK.some((t) => t.v === String(p.thickness));
                        // Dropdowns are driven by the catalog (resolve-by-name). A selection
                        // whose stored product is no longer offered is injected back as an
                        // option so it still shows — same pattern as tile thickness above.
                        const groutNames = offeredGrouts(settings.catalog), mortarNames = offeredMortars(settings.catalog);
                        const groutOpts = groutNames.includes(p.grout.product) ? groutNames : [p.grout.product, ...groutNames];
                        const colorBase = colorsFor(p.grout.product);
                        const colorOpts = (!p.grout.color || colorBase.includes(p.grout.color)) ? colorBase : [p.grout.color, ...colorBase];
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
                        // Collapsed materials drawer: one fine-print line per checked
                        // material; unchecked ones are hidden entirely.
                        const matExpanded = !!matOpen[p.id];
                        const jointLbl = JOINTS.find((x) => x.v === num(p.grout.joint))?.label;
                        const caulkN = num(p.grout.caulk);
                        const matRows = [];
                        if (p.type === "tile" && p.grout.checked) matRows.push({ label: "Grout", text: [p.grout.product, p.grout.color, jointLbl, caulkN > 0 ? `+${caulkN} caulk` : ""].filter(Boolean).join(" · "), qty: G && `${G.order} ${G.unit}` });
                        if (p.type === "tile" && p.mortar.checked) matRows.push({ label: "Mortar", text: p.mortar.product, qty: M && `${M.order} ${M.unit}` });
                        if (p.underlay.checked) matRows.push({ label: underlayLabel(p.type), text: `${p.underlay.product || "—"}${p.underlay.install && INS ? ` · +install (${INS.map((m) => `${m.order} ${m.unit}`).join(", ")})` : ""}`, qty: U && `${U.order} ${U.unit}` });
                        const underlayCard = (
                          <div className={`rounded-md border px-2.5 py-1.5 ${p.underlay.checked ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                              <button onClick={toggleUnderlay} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${p.underlay.checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{p.underlay.checked && <Check size={12} />}</button>
                              <span className="text-sm font-medium">{underlayLabel(p.type)}</span>
                              {p.underlay.checked && underlayOpts.length > 0 && (
                                <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0">
                                  <FitSelect value={p.underlay.product} display={p.underlay.product || "Select…"} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, product: e.target.value } })}>{!p.underlay.product && <option value="">Select…</option>}{underlayOpts.map((u) => <option key={u} value={u}>{u}</option>)}</FitSelect>
                                </div>
                              )}
                              {p.underlay.checked && <span className="ml-auto flex items-center gap-1 text-sm text-indigo-700 shrink-0">{uEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{uEx.toFixed(2)} →</span>}<input type="number" value={U ? String(U.order) : ""} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{underlayUnit}</span></span>}
                              {p.underlay.checked && underlayOpts.length === 0 && <div className="order-last basis-full text-xs text-amber-500">No {underlayLabel(p.type).toLowerCase()} products for {TLBL[p.type]} yet — add them in Settings.</div>}
                              {p.underlay.checked && underlayOpts.length > 0 && !U && <div className="order-last basis-full text-xs text-amber-500">Enter Sq Ft to calculate, or type a total above.</div>}
                            </div>
                            {p.underlay.checked && installDefs.length > 0 && (
                              <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, install: !p.underlay.install } })} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${p.underlay.install ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{p.underlay.install && <Check size={12} />}</button>
                                  {p.underlay.install ? (
                                    <button onClick={() => setInsOpen((o) => ({ ...o, [p.id]: !insExpanded }))} className="flex items-center gap-1 text-sm min-w-0">
                                      {insExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                                      Install materials
                                      <span className="text-xs text-slate-400 whitespace-nowrap">{insIncluded < installDefs.length ? `${insIncluded} of ${installDefs.length}` : `${installDefs.length} item${installDefs.length === 1 ? "" : "s"}`}</span>
                                    </button>
                                  ) : (
                                    <span className="text-sm">Install materials <span className="text-xs text-slate-400">({installDefs.length})</span></span>
                                  )}
                                  {p.underlay.install && !insExpanded && (INS ? (
                                    <span className="ml-auto text-xs text-indigo-700 font-medium truncate">{INS.slice(0, 3).map((m) => `${m.order} ${m.unit}`).join(" · ")}{INS.length > 3 ? ` +${INS.length - 3}` : ""}</span>
                                  ) : insIncluded === 0 ? (
                                    <span className="ml-auto text-xs text-slate-400">none included</span>
                                  ) : (
                                    <span className="ml-auto text-xs text-amber-500 truncate">{p.qtyType === "sqft" && num(p.qty) > 0 ? "No coverage set" : "Enter Sq Ft"}</span>
                                  ))}
                                </div>
                                {p.underlay.install && insExpanded && (
                                  <div className="mt-1 ml-7 space-y-1">
                                    {installDefs.map((d) => {
                                      const skipped = !!p.underlay.installSkip?.[d.id];
                                      const item = insById.get(d.id);
                                      const cur = p.underlay.installMortars?.[d.id] || d.product;
                                      const opts = cur && !mortarNames.includes(cur) ? [cur, ...mortarNames] : mortarNames;
                                      return (
                                        <div key={d.id} className="flex items-center gap-2">
                                          <button onClick={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, installSkip: { ...(p.underlay.installSkip || {}), [d.id]: !skipped } } })} title={skipped ? "Skipped — click to include" : "Included — click to skip"} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${skipped ? "border border-slate-300" : "bg-indigo-600 text-white"}`}>{!skipped && <Check size={10} />}</button>
                                          {d.kind === "mortar" && !skipped ? (
                                            <FitSelect sm value={cur} display={cur || "Select mortar…"} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, installMortars: { ...(p.underlay.installMortars || {}), [d.id]: e.target.value } } })} title="Mortar used to set the underlayment — combines with this job's other mortar totals">
                                              {!cur && <option value="">Select mortar…</option>}{opts.map((g) => <option key={g} value={g}>{g}</option>)}
                                            </FitSelect>
                                          ) : (
                                            <span className={`text-xs truncate ${skipped ? "text-slate-400 line-through" : "text-slate-600"}`}>{d.kind === "mortar" ? (cur || "mortar") : d.name}</span>
                                          )}
                                          <span className="ml-auto text-xs whitespace-nowrap">{skipped ? <span className="text-slate-300">skipped</span> : item ? <><span className="text-slate-400">{item.exact.toFixed(2)} → </span><span className="text-indigo-700 font-semibold">{item.order} {item.unit}</span></> : <span className="text-slate-300">—</span>}</span>
                                        </div>
                                      );
                                    })}
                                    {!INS && insIncluded > 0 && <div className="text-xs text-amber-500">{p.qtyType === "sqft" && num(p.qty) > 0 ? "Set install-material coverage in Settings to calculate." : "Enter Sq Ft to calculate install materials."}</div>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                        const selAccent = TYPE_ACCENT[p.type] || "var(--ft-text)";
                        const typeOrder = TYPES.includes(p.type) ? [p.type, ...TYPES.filter((t) => t !== p.type)] : TYPES;
                        // Stock link: the row keeps its snapshotted values; the
                        // chip below only points out drift from the current book.
                        const stockItem = findStock(stock, p.sku);
                        const drift = stockDrift(stockItem, p);
                        const stockRetired = p.sku && stockItem && (stockItem.discontinued || !stockItem.active);
                        const skuBox = stock.length > 0 ? (
                          <SkuPicker value={p.sku || ""} stock={stock}
                            onChange={(v) => updProduct(a.id, p.id, { sku: v })}
                            onPick={(it) => updProduct(a.id, p.id, stockPatch(it, p))}
                            onPickMany={(items) => addStockProducts(a.id, p.id, items)} />
                        ) : null;
                        return (
                          <div key={p.id} data-prod-card={p.id} data-flip={p.id} className="rounded-lg border border-slate-200 bg-white p-3 md:p-3.5" style={{ borderLeft: `3px solid ${selAccent}` }}>
                            <div className="ft-noprint flex flex-wrap items-center gap-2 mb-2.5">
                              <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                                {typeOrder.map((t) => {
                                  const on = p.type === t;
                                  return (
                                    <button key={t} data-flip={`${p.id}:${t}`} onClick={() => updProduct(a.id, p.id, { type: t })} className="rounded-full px-2.5 py-1 text-xs font-semibold transition" style={on ? { color: TYPE_ACCENT[t], background: `color-mix(in oklab, ${TYPE_ACCENT[t]} 15%, transparent)`, border: `1px solid ${TYPE_ACCENT[t]}` } : { color: "var(--ft-muted)", border: "1px solid transparent" }}>{TLBL[t]}</button>
                                  );
                                })}
                              </div>
                              {p.type === "misc" && miscQty(p) !== 1 && num(p.priceSqft) > 0 && (
                                <span className="ml-auto shrink-0 flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                                  <span>{miscQty(p)} × {money(num(p.priceSqft))}</span>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-sm font-semibold text-slate-700">{money(line)}</span>
                                </span>
                              )}
                              {p.type !== "misc" && p.qtyType === "sqft" && sf > 0 && (
                                <span className="ml-auto shrink-0 flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                                  <span>{sf.toLocaleString()} sf</span>
                                  {C && (<>
                                    <span className="text-slate-300">·</span>
                                    <span className="flex items-center gap-1 text-indigo-700">
                                      {cEx != null && <span className="text-slate-400 whitespace-nowrap">{cEx.toFixed(2)} →</span>}
                                      <input type="number" value={String(C.order)} onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })} title="Cartons to order — type to override the calculated amount" className="!w-11 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" />
                                      <span className="font-semibold">{C.unit}</span>
                                      <span className="text-slate-400 whitespace-nowrap">({sf1(C.order * C.sf)} sf)</span>
                                    </span>
                                  </>)}
                                  {num(p.priceSqft) > 0 && (<>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-sm font-semibold text-slate-700">{money(line)}</span>
                                  </>)}
                                </span>
                              )}
                              {a.products.length > 1 && <button onClick={() => setConfirmProd({ aid: a.id, pid: p.id })} title="Delete this selection" className="shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                            </div>
                            {confirmProd?.aid === a.id && confirmProd?.pid === p.id && (
                              <div className="ft-noprint flex items-center gap-2 mb-2 text-xs">
                                <span className="text-red-600 flex-1">Delete this selection{p.brandColor ? ` — "${p.brandColor}"` : ""}? Its materials come off the estimate too.</span>
                                <button onClick={() => { delProduct(a.id, p.id); setConfirmProd(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
                                <button onClick={() => setConfirmProd(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
                              </div>
                            )}

                            <div className="flex flex-wrap items-stretch w-full rounded-md border border-slate-200 ft-fieldbar text-sm overflow-hidden">
                              {p.type === "tile" ? (<>
                                {skuBox}
                                <div className="flex items-center shrink-0 h-9 pl-1">
                                  <input type="number" value={p.L} onChange={(e) => updProduct(a.id, p.id, { L: e.target.value })} className="w-10 px-1 py-1.5 text-center bg-transparent focus:outline-none focus:bg-white" placeholder="L" title="Length (in)" />
                                  <span className="text-slate-300 shrink-0">×</span>
                                  <input type="number" value={p.W} onChange={(e) => updProduct(a.id, p.id, { W: e.target.value })} className="w-10 px-1 py-1.5 text-center bg-transparent focus:outline-none focus:bg-white" placeholder="W" title="Width (in)" />
                                </div>
                                <select value={p.thickness} onChange={(e) => updProduct(a.id, p.id, { thickness: e.target.value })} className="shrink-0 h-9 border-l border-slate-200 px-1.5 py-1.5 bg-transparent focus:outline-none focus:bg-white" title="Thickness">{!thickKnown && <option value={p.thickness}>{p.thickness}"</option>}{THICK.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
                                <input value={p.brandColor} onChange={(e) => updProduct(a.id, p.id, { brandColor: e.target.value })} className="flex-1 min-w-0 h-9 border-l border-slate-200 px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder="Brand / color" />
                              </>) : p.type === "misc" ? (<>
                                {skuBox}
                                <input value={p.brandColor} onChange={(e) => updProduct(a.id, p.id, { brandColor: e.target.value })} className="flex-1 min-w-0 h-9 px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder="Description" />
                                <input type="number" value={p.qtyType === "count" ? p.qty : ""} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value, qtyType: "count" })} className="w-14 shrink-0 h-9 border-l border-slate-200 px-1 py-1.5 text-center bg-transparent focus:outline-none focus:bg-white" placeholder="1" title="Quantity" />
                              </>) : (<>
                                {skuBox}
                                <input value={p.sizeText} onChange={(e) => updProduct(a.id, p.id, { sizeText: e.target.value })} className="w-28 shrink-0 h-9 px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder={p.type === "hardwood" ? "Width" : "Size"} title={p.type === "hardwood" ? "Plank width (in)" : "Size"} />
                                <input value={p.brandColor} onChange={(e) => updProduct(a.id, p.id, { brandColor: e.target.value })} className="flex-1 min-w-0 h-9 border-l border-slate-200 px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder="Brand / color" />
                              </>)}
                              {p.type !== "misc" && <div className="basis-full md:hidden" />}
                              <div className={`relative w-20 shrink-0 h-9 border-slate-200 ${p.type === "misc" ? "border-l" : "border-t md:border-t-0 md:border-l"}`}><span className="absolute left-2 top-1.5 text-slate-400">$</span><input type="number" value={p.priceSqft} onChange={(e) => updProduct(a.id, p.id, { priceSqft: e.target.value })} className="w-full pl-5 pr-2 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder={p.type === "misc" ? "0.00" : "/sqft"} title={p.type === "misc" ? "Price each" : "Price per sq ft"} /></div>
                              {p.type !== "misc" && (<>
                                <input type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })} className="flex-1 md:flex-none md:w-16 min-w-0 h-9 border-l border-t md:border-t-0 border-slate-200 px-2 py-1.5 text-center bg-transparent focus:outline-none focus:bg-white" placeholder="0" title="Quantity" />
                                <div className="flex shrink-0 h-9 border-l border-t md:border-t-0 border-slate-200 text-xs">{["sqft", "count"].map((t) => <button key={t} onClick={() => updProduct(a.id, p.id, { qtyType: t })} className={`px-2.5 ${p.qtyType === t ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{t === "sqft" ? "SF" : "EA"}</button>)}</div>
                                {p.qtyType === "sqft" && (
                                  <div className="relative shrink-0 h-9 border-l border-t md:border-t-0 border-slate-200">
                                    <input type="number" value={p.cartonSf} onChange={(e) => updProduct(a.id, p.id, { cartonSf: e.target.value })} className="w-24 h-full pl-2 pr-10 py-1.5 bg-transparent focus:outline-none focus:bg-white" placeholder="—" title="Sq ft per carton/sheet — filled from the price book when the SKU has one. With this set, quantities and totals are figured by whole cartons." />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">sf/{(p.cartonUnit || "CT").toLowerCase()}</span>
                                  </div>
                                )}
                              </>)}
                            </div>
                            {(drift || stockRetired) && (
                              <div className="ft-noprint mt-1.5 flex items-center gap-2 text-xs flex-wrap">
                                {drift && (<>
                                  <span className="text-amber-600">Price book now {money(drift.to)} — this row has {money(drift.from)}</span>
                                  <button onClick={() => updProduct(a.id, p.id, { priceSqft: String(drift.to) })} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use new price</button>
                                </>)}
                                {stockRetired && <span className="text-slate-400">SKU {p.sku} is no longer in the stock price book</span>}
                              </div>
                            )}

                            {p.type !== "misc" && (
                              <div className="mt-2 rounded-md border border-slate-100 px-2.5 py-1.5">
                                {!matExpanded ? (
                                  <button onClick={() => setMatOpen((o) => ({ ...o, [p.id]: true }))} className="w-full flex items-start gap-1.5 text-left" title="Materials — click to edit">
                                    <ChevronRight size={13} className="text-slate-400 shrink-0 mt-[1px]" />
                                    {matRows.length === 0 ? (
                                      <span className="text-[11px] leading-4 text-slate-400">Associated materials</span>
                                    ) : (
                                      <span className="flex-1 min-w-0 space-y-px">
                                        {matRows.map((r) => (
                                          <span key={r.label} className="flex items-baseline gap-2 text-[11px] leading-4 min-w-0">
                                            <span className="w-16 shrink-0 text-slate-500 font-medium">{r.label}</span>
                                            <span className="text-slate-400 truncate min-w-0">{r.text}</span>
                                            <span className="ml-auto shrink-0 text-indigo-700 font-semibold">{r.qty || "—"}</span>
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </button>
                                ) : (<>
                                  <button onClick={() => setMatOpen((o) => ({ ...o, [p.id]: false }))} className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5" title="Collapse">
                                    <ChevronDown size={13} className="shrink-0" /> close
                                  </button>
                                  <div className="space-y-1.5">
                                {p.type === "tile" && (<>
                                {/* Grout */}
                                <div className={`rounded-md border px-2.5 py-1.5 ${p.grout.checked ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                    <button onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, checked: !p.grout.checked } })} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${p.grout.checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{p.grout.checked && <Check size={12} />}</button>
                                    <span className="text-sm font-medium">Grout</span>
                                    {p.grout.checked && (
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        <FitSelect value={p.grout.product} display={p.grout.product} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, product: e.target.value } })}>{groutOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                                        <FitSelect value={p.grout.color} display={p.grout.color || "Color…"} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, color: e.target.value } })}><option value="">Color…</option>{colorOpts.map((c) => <option key={c}>{c}</option>)}</FitSelect>
                                        <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px] shrink-0">{JOINTS.map((j) => <button key={j.v} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, joint: j.v } })} className={`px-1 py-1.5 ${num(p.grout.joint) === j.v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{j.label}</button>)}</div>
                                        <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0" title="Matching caulk for this grout color — tubes to order; leave blank for none">Caulk<input type="number" value={p.grout.caulk} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, caulk: e.target.value } })} placeholder="—" className={`w-10 text-right rounded border px-1 py-0.5 ft-field focus:border-indigo-500 focus:outline-none ${p.grout.caulk ? "border-indigo-300 text-indigo-700 font-semibold" : "border-slate-200"}`} /><span>tubes</span></span>
                                      </div>
                                    )}
                                    {p.grout.checked && <span className="ml-auto flex items-center gap-1 text-sm text-indigo-700 shrink-0">{gEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{gEx.toFixed(2)} →</span>}<input type="number" value={G ? String(G.order) : ""} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{G ? G.unit : settings.grouts[p.grout.product]?.unit}</span></span>}
                                    {p.grout.checked && !G && <div className="order-last basis-full text-xs text-amber-500">Enter Sq Ft + tile L/W/thickness to calculate, or type a total above.</div>}
                                  </div>
                                </div>
                                {/* Mortar */}
                                <div className={`rounded-md border px-2.5 py-1.5 ${p.mortar.checked ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                    <button onClick={() => updProduct(a.id, p.id, { mortar: { ...p.mortar, checked: !p.mortar.checked } })} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${p.mortar.checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{p.mortar.checked && <Check size={12} />}</button>
                                    <span className="text-sm font-medium">Mortar</span>
                                    {p.mortar.checked && (
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0">
                                        <FitSelect value={p.mortar.product} display={p.mortar.product} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, product: e.target.value } })}>{mortarOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                                      </div>
                                    )}
                                    {p.mortar.checked && <span className="ml-auto flex items-center gap-1 text-sm text-indigo-700 shrink-0">{mEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{mEx.toFixed(2)} →</span>}<input type="number" value={M ? String(M.order) : ""} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{M ? M.unit : settings.mortars[p.mortar.product]?.unit}</span></span>}
                                  </div>
                                </div>
                                </>)}
                                {underlayCard}
                                  </div>
                                </>)}
                              </div>
                            )}

                            <div className="mt-2 flex items-end gap-2">
                              <input value={p.note} onChange={(e) => updProduct(a.id, p.id, { note: e.target.value })} placeholder="note…" className="flex-1 min-w-0 text-sm text-slate-500 bg-transparent focus:outline-none placeholder:text-slate-300" />
                              <button onPointerDown={(e) => startDrag(e, a.id, p, pi)} title="Drag to reorder or move to another area" className="ft-noprint shrink-0 -m-1 p-1 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={15} /></button>
                            </div>
                          </div>
                        );
                      })}
                      {drag?.to?.aid === a.id && <div className="absolute left-1 right-1 h-1.5 rounded-full bg-indigo-600 pointer-events-none" style={{ top: drag.to.y, marginTop: 0 }} />}
                    </div>
                    <button onClick={() => addProduct(a.id)} className="ft-noprint mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-md border border-dashed border-slate-300 py-2 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={14} /> Add product</button>
                  </div>
                  );
                })}
              </div>

              {(totalSqft > 0 || hasMat || miscCost > 0) && (
                <div className="mt-5 bg-white border border-slate-200 rounded-lg" style={{ padding: "clamp(18px,2.4vw,28px)" }}>
                  <div className="ft-eyebrow-accent text-[10px] mb-1.5">Materials Estimate</div>
                  <h3 className="ft-serif mb-5" style={{ fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 1 }}>Order summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
                    <div>
                      <div className="ft-eyebrow text-[10px] tracking-[.1em] mb-2.5">Grout</div>
                      {gList.length + cList.length === 0 ? <div className="text-sm text-slate-400">—</div> : [...gList, ...cList.map((c) => ({ ...c, product: `${c.product} caulk` }))].map((g, i) => (
                        <div key={"g" + i} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                          <span className="text-[13px] font-medium">{g.product}{g.color !== "—" && <span className="text-slate-500 font-normal"> · {g.color}</span>}</span>
                          <span className="ft-mono text-[12px] text-slate-500 whitespace-nowrap text-right">{g.pending ? "—" : <>{g.order} {g.unit}</>}{g.cost > 0 && <span className="block text-[11px] text-slate-400">{money(g.cost)}</span>}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="ft-eyebrow text-[10px] tracking-[.1em] mb-2.5">Mortar</div>
                      {mList.length === 0 ? <div className="text-sm text-slate-400">—</div> : mList.map((m, i) => (
                        <div key={"m" + i} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                          <span className="text-[13px] font-medium">{m.product}</span>
                          <span className="ft-mono text-[12px] text-slate-500 whitespace-nowrap text-right">{m.pending ? "—" : <>{m.order} {m.unit}</>}{m.cost > 0 && <span className="block text-[11px] text-slate-400">{money(m.cost)}</span>}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="ft-eyebrow text-[10px] tracking-[.1em] mb-2.5">Underlayment</div>
                      {uList.length === 0 ? <div className="text-sm text-slate-400">—</div> : uList.map((u, i) => (
                        <div key={"u" + i} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                          <span className="text-[13px] font-medium">{u.product}</span>
                          <span className="ft-mono text-[12px] text-slate-500 whitespace-nowrap text-right">{u.pending ? "—" : <>{u.order} {u.unit}</>}{u.cost > 0 && <span className="block text-[11px] text-slate-400">{money(u.cost)}</span>}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between"><span className="text-[13px] text-slate-500">Flooring</span><span className="ft-mono text-[13px]">{money(flooringPrice)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-[13px] text-slate-500">Grout</span><span className="ft-mono text-[13px]">{money(groutCost)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-[13px] text-slate-500">Mortar</span><span className="ft-mono text-[13px]">{money(mortarCost)}</span></div>
                        {underlayCost > 0 && <div className="flex items-center justify-between"><span className="text-[13px] text-slate-500">Underlayment</span><span className="ft-mono text-[13px]">{money(underlayCost)}</span></div>}
                        {miscCost > 0 && <div className="flex items-center justify-between"><span className="text-[13px] text-slate-500">Miscellaneous</span><span className="ft-mono text-[13px]">{money(miscCost)}</span></div>}
                        <div className="flex items-center justify-between items-baseline mt-1.5 pt-3" style={{ borderTop: "2px solid var(--ft-text)" }}><span className="text-sm font-semibold">Total</span><span className="ft-serif" style={{ fontSize: 30, lineHeight: 1 }}>{money(grandTotal)}</span></div>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-3">Figures include {wasteNote(settings)}. Verify before ordering.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* PRINT VIEW — the print buttons pick the layout: estimate (default, also Ctrl+P) or order sheet */}
      <div className="hidden print:block text-black p-2">
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
                {sel.categories.flatMap((a) => a.products.map((p) => { const c = printProduct(p, settings); return (
                  <tr key={p.id} className="border-b border-slate-200 align-baseline">
                    <td className="py-1.5 text-center text-slate-400">☐</td>
                    <td className="py-1.5 pr-2"><b>{p.brandColor || TLBL[p.type]}</b> <span className="text-slate-500">{[p.brandColor ? TLBL[p.type] : "", c.size].filter(Boolean).join(", ")}</span></td>
                    <td className="py-1.5 pr-2 ft-mono text-[11px]">{p.sku}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{a.name}</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{c.qtyText}{c.C && c.C.order > 0 && <> = {sf1(c.orderedSf)} sf<span className="text-slate-400 font-normal text-[10.5px]"> ({c.C.exact.toFixed(2)})</span></>}</td>
                  </tr>
                ); }))}
                {[...mList.filter((m) => m.order > 0).map((m) => ({ ...m, kind: "Mortar" })),
                  ...gList.filter((g) => g.order > 0).map((g) => ({ ...g, product: `${g.product}${g.color !== "—" ? ` — ${g.color}` : ""}`, kind: "Grout" })),
                  ...cList.filter((c) => c.order > 0).map((c) => ({ ...c, product: `${c.product}${c.color !== "—" ? ` — ${c.color}` : ""} matching caulk`, kind: "Caulk" })),
                  ...uList.filter((u) => u.order > 0).map((u) => ({ ...u, kind: "Underlayment" }))].map((m, i) => (
                  <tr key={"mat" + i} className="border-b border-slate-200 align-baseline">
                    <td className="py-1.5 text-center text-slate-400">☐</td>
                    <td className="py-1.5 pr-2">{m.product}</td>
                    <td className="py-1.5 pr-2 text-slate-400 text-[11px]">{m.kind}</td>
                    <td className="py-1.5 pr-2 text-slate-500">all areas</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{m.order} {m.unit} <span className="text-slate-400 font-normal text-[10.5px]">({m.exact.toFixed(2)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs mt-3 text-slate-600">Quantities and prices are estimates, incl. {wasteNote(settings)}. Confirm against product specs and final measurements before ordering.</div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4 gap-4">
              <div>
                <div className="ft-serif text-3xl">{sel.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{[sel.address, `Selections · ${new Date().toLocaleDateString()}`].filter(Boolean).join("  ·  ")}</div>
              </div>
              <div className="flex items-stretch gap-6">
                {(profile.name || profile.phone || profile.email) && (() => { const pname = profile.name || profile.email; return (
                  <div className="flex flex-col justify-between text-right">
                    <div className="ft-eyebrow text-[9px] text-slate-500">Your salesperson</div>
                    <div className="ft-serif text-2xl leading-none">{pname}</div>
                    <div className="text-[9.5px] text-slate-500 leading-none">{[profile.phone, profile.email].filter((x) => x && x !== pname).join("  ·  ")}</div>
                  </div>
                ); })()}
                {grandTotal > 0 && (
                  <div className="text-right">
                    <div className="ft-eyebrow text-[9px]">Estimated total</div>
                    <div className="ft-serif text-3xl">{money(grandTotal)}</div>
                  </div>
                )}
              </div>
            </div>
            {sel.notes && <div className="text-sm mb-4 italic text-slate-600">{sel.notes}</div>}
            {sel.categories.map((a, ai) => (
              <div key={a.id} className="mb-5 break-inside-avoid">
                <div className="flex justify-between items-baseline border-b-2 border-black pb-1 mb-1.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="ft-mono text-[11px] text-slate-400">{String(ai + 1).padStart(2, "0")}</span>
                    <span className="ft-serif text-[21px]">{a.name}</span>
                  </div>
                  {printAreaFloor(a, settings) > 0 && <span className="ft-mono text-[11px] text-slate-500">{money(printAreaFloor(a, settings))}</span>}
                </div>
                {a.note && <div className="text-xs italic text-slate-500 mb-1">{a.note}</div>}
                <div className="pl-3" style={{ borderLeft: "2px solid var(--ft-border-strong)" }}>
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="ft-eyebrow text-[8px] text-slate-500">
                        <th className="text-left font-semibold py-0.5 pr-2">Selection</th>
                        <th className="text-left font-semibold py-0.5 pr-2">Size</th>
                        <th className="text-left font-semibold py-0.5 pr-2">SKU</th>
                        <th className="text-right font-semibold py-0.5 pr-2">Order</th>
                        <th className="text-right font-semibold py-0.5 pr-2">Price</th>
                        <th className="text-right font-semibold py-0.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.products.map((p) => { const c = printProduct(p, settings); const inline = c.mats.filter((m) => m.inline); return (
                        <Fragment key={p.id}>
                          <tr className="border-t border-slate-200 align-baseline">
                            <td className="py-1.5 pr-2"><b className="text-[12.5px]">{p.brandColor || TLBL[p.type]}</b>{p.brandColor && <span className="text-slate-500 text-[10.5px]"> · {TLBL[p.type]}</span>}</td>
                            <td className="py-1.5 pr-2 whitespace-nowrap text-[11px]">{c.size}</td>
                            <td className="py-1.5 pr-2 ft-mono text-[10.5px]">{p.sku}</td>
                            <td className="py-1.5 pr-2 text-right whitespace-nowrap">{c.qtyText}{c.C && c.C.order > 0 && <span className="text-slate-400 text-[10px]"> = {sf1(c.orderedSf)} sf</span>}</td>
                            <td className="py-1.5 pr-2 text-right whitespace-nowrap text-[11px]">{c.priceText}</td>
                            <td className="py-1.5 text-right font-semibold whitespace-nowrap">{c.line > 0 ? money(c.line) : ""}</td>
                          </tr>
                          {inline.length > 0 && (
                            <tr><td colSpan={6} className="pb-1 pl-4">
                              {/* Narrower than the table so the order/price/total rails stay scannable. */}
                              <div style={{ columns: 2, columnGap: 14, maxWidth: 470 }} className="text-[9.5px] leading-snug">
                                {inline.map((m, i) => (
                                  <div key={i} className="flex gap-1 break-inside-avoid">
                                    <span className="ft-eyebrow text-[6.5px] shrink-0 text-right" style={{ width: 34, paddingTop: 2, letterSpacing: ".05em" }}>{KSHORT[m.kind]}</span>
                                    <span className="ft-mono text-[8.5px] text-slate-500 shrink-0 text-right" style={{ width: 11, paddingTop: 0.5 }}>{m.order > 0 ? m.order : ""}</span>
                                    <span className="text-slate-700">{m.kind === "Caulk" ? "Matching caulk" : <>{m.name}{m.spec && ` — ${m.spec}`}{m.detail && <span className="text-slate-400"> · {m.detail}</span>}</>}</span>
                                  </div>
                                ))}
                              </div>
                            </td></tr>
                          )}
                          {p.note && <tr><td colSpan={6} className="pl-4 pb-1.5 italic text-slate-500 text-[10.5px]">{p.note}</td></tr>}
                        </Fragment>
                      ); })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {pMats.length > 0 && (
              <div className="break-inside-avoid mb-4">
                <div className="border-b-2 border-black pb-1 mb-2 flex justify-between items-baseline">
                  <span className="font-bold text-[13px]">Setting materials &amp; sundries</span>
                  {groutCost + mortarCost + underlayCost > 0 && <span className="ft-mono text-[11px] text-slate-500">{money(groutCost + mortarCost + underlayCost)}</span>}
                </div>
                <div style={{ columns: 2, columnGap: 24 }}>
                  {PRINT_KINDS.map((k) => ({ k, items: pMats.filter((m) => m.kind === k) })).filter((g) => g.items.length > 0).map(({ k, items }) => (
                    <div key={k} className="break-inside-avoid mb-2.5">
                      <div className="ft-eyebrow text-[8px] border-b border-slate-300 pb-0.5 mb-1">{k}</div>
                      {items.map((m, i) => (
                        <div key={i} className="text-[11px] flex justify-between gap-2 py-0.5">
                          <span><b>{m.name}</b>{m.spec && <span className="text-slate-500"> — {m.spec}</span>}{m.order > 0 && <><br /><span className="text-slate-400 text-[10px]">{m.order} {u1(m.order, m.unit)} ({m.exact.toFixed(2)})</span></>}</span>
                          <span className="ft-mono text-[10.5px] whitespace-nowrap">{m.cost > 0 ? money(m.cost) : m.price > 0 ? `${money(m.price)}/${u1(1, m.unit)}` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="break-inside-avoid">
              <div className="border-t-2 border-black pt-1.5 flex justify-between items-baseline">
                <div className="text-[11px] text-slate-500">
                  {[
                    flooringPrice + miscCost > 0 ? `Flooring ${money(flooringPrice + miscCost)}` : "",
                    groutCost + mortarCost + underlayCost > 0 ? `Materials ${money(groutCost + mortarCost + underlayCost)}` : "",
                    totalSqft > 0 ? `${totalSqft.toLocaleString()} sq ft measured${orderedSqft > 0 ? `, ${sf1(orderedSqft)} ordered` : ""}` : "",
                  ].filter(Boolean).join(" · ")}
                </div>
                {grandTotal > 0 && <div className="flex items-baseline gap-3"><span className="font-bold text-[13px]">Estimated total</span><span className="ft-serif text-2xl">{money(grandTotal)}</span></div>}
              </div>
              <div className="text-xs mt-3 text-slate-600">Quantities and prices are estimates, incl. {wasteNote(settings)}. Confirm against product specs and final measurements before ordering.</div>
            </div>
          </div>
        ))}
      </div>

      {/* Settings */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Coverage, Pricing & Settings">
          <p className="text-sm text-slate-500 mb-4">Calibrate coverage to your real-world results and set unit prices. Grout scales automatically for tile size, joint, and thickness from a 12×12×3/8" / 1/8"-joint baseline.</p>
          <div className="mb-4 flex gap-6">
            <div><label className={lbl}>Tile waste (%)</label><input type="number" value={settings.waste.tile} onChange={(e) => setSettings({ waste: { ...settings.waste, tile: e.target.value } })} className={inp + " w-28"} /></div>
            <div><label className={lbl}>Flooring waste (%)</label><input type="number" value={settings.waste.floor} onChange={(e) => setSettings({ waste: { ...settings.waste, floor: e.target.value } })} className={inp + " w-28"} /><div className="text-[11px] text-slate-400 mt-1">Hardwood, vinyl, laminate, carpet</div></div>
          </div>
          <div className="font-medium text-sm mb-1">Stock price book</div>
          <p className="text-xs text-slate-400 mb-2">
            {stock.length > 0
              ? `${stock.filter((s) => s.active).length} stock items loaded${(() => { const t = Math.max(0, ...stock.map((s) => s.updatedAt || 0)); return t ? ` · updated ${new Date(t).toLocaleDateString()}` : ""; })()}. `
              : "No stock items yet — run supabase/stock.sql once, then import the workbook. "}
            Importing the price book .xlsx shows a preview of what changed before anything is saved. Entering a SKU on a product row copies that item's values onto the row; later price changes never rewrite saved selections.
          </p>
          <button onClick={() => pbRef.current?.click()} disabled={importing} className="mb-4 flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600 disabled:opacity-50"><Upload size={14} /> {importing ? "Reading…" : "Import price book (.xlsx)"}</button>
          <input ref={pbRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importPriceBook} className="hidden" />
          <div className="font-medium text-sm mb-1">Grout, mortar &amp; underlayment catalog</div>
          <p className="text-xs text-slate-400 mb-2">Products grouped by company. Uncheck a company or product to hide it from the job dropdowns — it stays stored, and jobs that already use it are unaffected. Underlayments are offered only for the flooring types you tag them with.</p>
          <CatalogSettings catalog={settings.catalog} stock={stock} onChange={(c) => setSettings({ catalog: c })} inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} />
        </Modal>
      )}

      {showProfile && (
        <Modal onClose={() => setShowProfile(false)} title="User Settings">
          <p className="text-sm text-slate-500 mb-4">Your contact info prints at the top of the estimate ("Your salesperson") so the customer knows who to reach. It's saved with your login — each person on the team sets their own.</p>
          <div className="space-y-3">
            <div><label className={lbl}>Name</label><input value={profile.name} onChange={(e) => saveProfile({ name: e.target.value })} placeholder="Your name" className={inp} /></div>
            <div><label className={lbl}>Phone</label><input value={profile.phone} onChange={(e) => saveProfile({ phone: e.target.value })} placeholder="Phone number" className={inp} /></div>
            <div><label className={lbl}>Email</label><input value={profile.email} onChange={(e) => saveProfile({ email: e.target.value })} placeholder={user.email || "Email"} className={inp} /></div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Signed in as {user.email}. Leave a field blank to keep it off the estimate.</p>
        </Modal>
      )}

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
              <button onClick={applyImport} disabled={total === 0 && sync.changes.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Apply import</button>
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

      {confirm && (
        <Modal onClose={() => setConfirm(null)} title="Delete customer?">
          <p className="text-sm text-slate-500 mb-4">This permanently removes the customer — with all their selections, versions, and attachments — for everyone. Consider a backup export first.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button><button onClick={() => delCustomer(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button></div>
        </Modal>
      )}

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

// The shared grout/mortar catalog editor: a Company → Product tree. Each company
// and product has an enabled checkbox (show/hide for the job dropdowns); a
// product's numbers are shown and editable only while it is enabled, but stay
// stored when off. All edits flow up through onChange(newCatalog).
function CatalogSettings({ catalog, stock, onChange, inp, lbl, types, typeLabels }) {
  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(null); // { companyId, kind }
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // { companyId, kind, productId }
  // Which companies are expanded — view state only, never persisted. Collapsed
  // by default so the list stays tidy as products accumulate.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpanded = (id) => setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const setCompany = (cid, patch) => onChange({ companies: catalog.companies.map((co) => co.id === cid ? { ...co, ...patch } : co) });
  const setProduct = (cid, kind, pid, patch) => onChange({ companies: catalog.companies.map((co) => co.id === cid ? { ...co, [kind]: co[kind].map((p) => p.id === pid ? { ...p, ...patch } : p) } : co) });
  const setInstallItem = (cid, u, mid, patch) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id === mid ? { ...m, ...patch } : m) });
  const delInstallItem = (cid, u, mid) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).filter((m) => m.id !== mid) });
  const newInstallItem = (kind) => kind === "mortar" ? { id: uid(), kind: "mortar", product: "", coverage: "" } : { id: uid(), kind: "custom", name: "", coverage: "", unit: "units", price: "" };
  const addInstallItem = (cid, u, kind) => setProduct(cid, "underlayments", u.id, { install: [...(u.install || []), newInstallItem(kind)] });
  // Switching a row's kind rebuilds it (the field sets don't overlap), keeping
  // only the id and coverage.
  const setInstallKind = (cid, u, mid, kind) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id !== mid || m.kind === kind ? m : { ...newInstallItem(kind), id: m.id, coverage: m.coverage }) });
  const mortarNames = catalog.companies.flatMap((c) => c.mortars.map((m) => m.name));

  const kindLabel = (kind) => kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : "underlayment";
  const startAdd = (companyId, kind) => { setAdding({ companyId, kind }); setDraft(kind === "grouts" ? { name: "", coverage: "", unit: "units", price: "" } : kind === "mortars" ? { name: "", tier1: "", tier2: "", tier3: "", unit: "units", price: "" } : { name: "", coverage: "", unit: "rolls", price: "", types: [] }); setError(""); };
  const cancelAdd = () => { setAdding(null); setError(""); };
  const submitAdd = () => {
    const name = (draft.name || "").trim();
    if (!name) { setError("Product name is required."); return; }
    if (isDuplicateName(catalog, adding.kind, name)) { setError(`A ${kindLabel(adding.kind)} named "${name}" already exists.`); return; }
    onChange(addProduct(catalog, adding.companyId, adding.kind, { ...draft, name }));
    setAdding(null); setError("");
  };
  const submitCompany = () => { const name = newCompany.trim(); if (!name) return; onChange(addCompany(catalog, name)); setNewCompany(""); };
  // The book rarely carries coverage, so most items still need it typed in —
  // mortars always do (three tiers can't come from one number).
  const fillFromStock = (it) => setDraft((d) => ({
    ...d,
    name: it.product || it.description,
    ...(it.price != null ? { price: String(it.price) } : it.priceSqft != null ? { price: String(it.priceSqft) } : {}),
    ...(adding.kind !== "mortars" && it.coverage != null ? { coverage: String(it.coverage) } : {}),
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
  return (
    <div className="space-y-2">
      {catalog.companies.map((co) => (
        <div key={co.id} className="border border-slate-200 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => toggleExpanded(co.id)} className="text-slate-400 hover:text-slate-600 shrink-0" title={expanded.has(co.id) ? "Collapse" : "Expand"}>{expanded.has(co.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            {box(co.enabled, () => setCompany(co.id, { enabled: !co.enabled }), co.enabled ? "Hide all of this company's products" : "Show this company's products")}
            <button onClick={() => toggleExpanded(co.id)} className={`text-sm font-semibold flex-1 text-left ${co.enabled ? "" : "text-slate-400"}`}>{co.name}</button>
            <span className="text-xs text-slate-400 shrink-0">{co.grouts.length + co.mortars.length + (co.underlayments?.length || 0)}</span>
            {co.grouts.length + co.mortars.length + (co.underlayments?.length || 0) === 0 && (
              <button onClick={() => onChange(removeCompany(catalog, co.id))} title="Delete this empty company" className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
            )}
          </div>
          {expanded.has(co.id) && (
          <div className="mt-1.5 space-y-1.5 pl-7">
            {co.grouts.length === 0 && co.mortars.length === 0 && (co.underlayments?.length || 0) === 0 && <div className="text-xs text-slate-400">No products yet.</div>}
            {co.grouts.map((g) => (
              <div key={g.id} className={`rounded-md border px-2.5 py-1.5 ${g.enabled ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-2">
                  {box(g.enabled, () => setProduct(co.id, "grouts", g.id, { enabled: !g.enabled }))}
                  <span className={`text-sm font-medium flex-1 ${g.enabled ? "" : "text-slate-400"}`}>{g.name}</span>
                  <span className="text-xs text-slate-400">Grout</span>
                  {delButton(co, "grouts", g)}
                </div>
                {delConfirm(co, "grouts", g)}
                {g.enabled && (
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {numField("Cov. sq ft/unit", g.coverage, (v) => setProduct(co.id, "grouts", g.id, { coverage: v }))}
                    {txtField("Unit", g.unit, (v) => setProduct(co.id, "grouts", g.id, { unit: v }))}
                    {numField("$/unit", g.price, (v) => setProduct(co.id, "grouts", g.id, { price: v }))}
                  </div>
                )}
              </div>
            ))}
            {co.mortars.map((m) => (
              <div key={m.id} className={`rounded-md border px-2.5 py-1.5 ${m.enabled ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-2">
                  {box(m.enabled, () => setProduct(co.id, "mortars", m.id, { enabled: !m.enabled }))}
                  <span className={`text-sm font-medium flex-1 ${m.enabled ? "" : "text-slate-400"}`}>{m.name}</span>
                  <span className="text-xs text-slate-400">Mortar</span>
                  {delButton(co, "mortars", m)}
                </div>
                {delConfirm(co, "mortars", m)}
                {m.enabled && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1.5">
                    {numField('Tile < 8"', m.tier1, (v) => setProduct(co.id, "mortars", m.id, { tier1: v }))}
                    {numField('8"–15"', m.tier2, (v) => setProduct(co.id, "mortars", m.id, { tier2: v }))}
                    {numField('> 15"', m.tier3, (v) => setProduct(co.id, "mortars", m.id, { tier3: v }))}
                    {txtField("Unit", m.unit, (v) => setProduct(co.id, "mortars", m.id, { unit: v }))}
                    {numField("$/unit", m.price, (v) => setProduct(co.id, "mortars", m.id, { price: v }))}
                  </div>
                )}
              </div>
            ))}
            {(co.underlayments || []).map((u) => (
              <div key={u.id} className={`rounded-md border px-2.5 py-1.5 ${u.enabled ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-2">
                  {box(u.enabled, () => setProduct(co.id, "underlayments", u.id, { enabled: !u.enabled }))}
                  <span className={`text-sm font-medium flex-1 ${u.enabled ? "" : "text-slate-400"}`}>{u.name}</span>
                  <span className="text-xs text-slate-400">Underlayment</span>
                  {delButton(co, "underlayments", u)}
                </div>
                {delConfirm(co, "underlayments", u)}
                {u.enabled && (
                  <div className="mt-1.5 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {numField("Cov. sq ft/unit", u.coverage, (v) => setProduct(co.id, "underlayments", u.id, { coverage: v }))}
                      {txtField("Unit", u.unit, (v) => setProduct(co.id, "underlayments", u.id, { unit: v }))}
                      {numField("$/unit", u.price, (v) => setProduct(co.id, "underlayments", u.id, { price: v }))}
                    </div>
                    {typeChips(u.types, (v) => setProduct(co.id, "underlayments", u.id, { types: v }))}
                    <div>
                      <label className={lbl}>Install materials <span className="text-slate-400 font-normal normal-case tracking-normal">(added when a job checks "Install materials"; mortar rows pull unit &amp; price from that mortar and combine with the job's mortar totals)</span></label>
                      <div className="space-y-1.5">
                        {(u.install || []).map((m) => (
                          <div key={m.id} className={`grid gap-1.5 items-end ${m.kind === "mortar" ? "grid-cols-[auto_1.6fr_1fr_auto]" : "grid-cols-[auto_1.4fr_.9fr_.7fr_.7fr_auto]"}`}>
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
                            <button onClick={() => delInstallItem(co.id, u, m.id)} title="Remove install material" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
                          </div>
                        ))}
                        <div className="flex gap-3">
                          <button onClick={() => addInstallItem(co.id, u, "mortar")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Mortar</button>
                          <button onClick={() => addInstallItem(co.id, u, "custom")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Other (screws, tape…)</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {adding && adding.companyId === co.id ? (
              <div className="rounded-md border border-indigo-200 bg-white px-2.5 py-2">
                <div className="text-xs font-medium mb-1.5">New {kindLabel(adding.kind)} product</div>
                {stock.length > 0 && <StockSearch stock={stock} onPick={fillFromStock} inp={inp} />}
                <input autoFocus placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") cancelAdd(); }} className={inp + " mb-1.5"} />
                {adding.kind === "grouts" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
                    {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
                    {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
                  </div>
                ) : adding.kind === "mortars" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {numField('Tile < 8"', draft.tier1, (v) => setDraft({ ...draft, tier1: v }))}
                    {numField('8"–15"', draft.tier2, (v) => setDraft({ ...draft, tier2: v }))}
                    {numField('> 15"', draft.tier3, (v) => setDraft({ ...draft, tier3: v }))}
                    {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
                    {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
                      {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
                      {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
                    </div>
                    {typeChips(draft.types, (v) => setDraft({ ...draft, types: v }))}
                  </div>
                )}
                {error && <div className="text-xs text-red-500 mt-1.5">{error}</div>}
                <div className="flex gap-2 mt-2">
                  <button onClick={submitAdd} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Add</button>
                  <button onClick={cancelAdd} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 pt-0.5">
                <button onClick={() => startAdd(co.id, "grouts")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Grout</button>
                <button onClick={() => startAdd(co.id, "mortars")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Mortar</button>
                <button onClick={() => startAdd(co.id, "underlayments")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Underlayment</button>
              </div>
            )}
          </div>
          )}
        </div>
      ))}
      <div className="flex gap-2 items-center pt-1">
        <input placeholder="New company name" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCompany(); }} className={inp + " flex-1"} />
        <button onClick={submitCompany} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1 shrink-0"><Plus size={14} /> Company</button>
      </div>
    </div>
  );
}
