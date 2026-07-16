// Preview harness for the mobile SKU-search popup changes (2026-07-15):
// (1) below md the SKU drops to the result row's second line, and (2) the
// popup flips above the field when the space below can't fit it. Copies the
// REAL useAnchoredPanel/vPos/StockHit/OrderHit code from App.jsx plus the
// SkuPicker panel markup, over a fake in-memory stock list. Served by the
// vite dev server; never shipped (lives in .scratch).
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import "../../src/index.css";

// ---- copied verbatim from src/App.jsx (post-change) ----------------------
const PANEL_MAX = 320;
const useAnchoredPanel = (open, anchorRef, panelRef, onDismiss) => {
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
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return pos;
};
const vPos = (pos) => (pos.top != null ? { top: pos.top } : { bottom: pos.bottom });

const hitKey = (it) => (it.bookId || "stock") + "|" + it.sku;

const StockHit = ({ it }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="hidden md:inline ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <span className="text-xs font-medium truncate flex-1 text-slate-900">{it.description || it.product || it.section}</span>
    </div>
    <div className="flex items-baseline gap-2 text-[11px] text-slate-400">
      <span className="md:hidden ft-mono shrink-0">{it.sku}</span>
      <span className="truncate">{[it.size, it.brand && !it.description.includes(it.brand) ? it.brand : it.section].filter(Boolean).join(" · ")}</span>
      <span className="ml-auto shrink-0 ft-mono">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
  </>
);

const OrderHit = ({ it, bookName }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="hidden md:inline ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <span className="text-xs font-medium truncate flex-1 text-slate-900">{it.description || it.product}</span>
      <span className="ml-auto shrink-0 ft-mono text-[11px]">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
    <div className="flex items-baseline gap-1.5 text-[11px]">
      <span className="md:hidden ft-mono text-slate-400 shrink-0">{it.sku}</span>
      <span className="shrink-0 rounded px-1 bg-indigo-50 text-indigo-600 font-medium">{bookName(it.bookId)} · special order</span>
      {it.leadTime && <span className="text-slate-400 truncate">{it.leadTime}</span>}
      {it.freightFlag && <span className="shrink-0 rounded px-1 bg-amber-50 text-amber-700 font-medium">+ freight</span>}
    </div>
  </>
);

const Hit = ({ it, bookName = () => "special order" }) => (
  it.bookId ? <OrderHit it={it} bookName={bookName} /> : <StockHit it={it} />
);

const matchSummary = (shown, total) => total > shown ? `Showing ${shown} of ${total} matches — keep typing to narrow` : `${total} match${total === 1 ? "" : "es"}`;
// ---- end copies -----------------------------------------------------------

const FAKE = [
  { sku: "MSI-ALT12", description: "Alterna Reserve Mesa Stone Cream 12x24", brand: "MSI", section: "LVT", size: "12×24", priceSqft: 5.55 },
  { sku: "DT-URB324", description: "Urban Putty Matte Mosaic", brand: "Daltile", section: "Tile", size: "3×24", priceSqft: 8.1 },
  { sku: "SH-END221", description: "Endura Plus Oak Natural", brand: "Shaw", section: "Vinyl plank", size: '7"', priceSqft: 3.29 },
  { sku: "LAT-PC-SS", description: "PermaColor Select Silver Shadow", brand: "Laticrete", section: "Grout", price: 21.4 },
  { sku: "MAN-ADR52", description: "Adura Rigid Dockside Sand", brand: "Mannington", section: "LVP", size: "6×48", priceSqft: 4.05 },
  { sku: "VT-HEX15", description: "Moroccan Concrete Off White Hex", brand: "Virginia Tile", section: "Tile", size: '1-1/2" Hex', priceSqft: 11.2 },
  { sku: "DT-RES612", description: "Restore Bright White Subway", brand: "Daltile", section: "Tile", size: "6×12", priceSqft: 2.89 },
  { sku: "SH-PAR884", description: "Paragon Mix Plus Toasted Barnwood", brand: "Shaw", section: "Vinyl plank", size: '7"', priceSqft: 3.75 },
  { sku: "MSI-TRIM9", description: "Reducer Mesa Stone Cream 94in", brand: "MSI", section: "Trim", price: 42.0 },
  { sku: "LAT-SLFULL", description: "Spectralock Pro Full Unit Base", brand: "Laticrete", section: "Grout", price: 89.9 },
  { sku: "VTC-88401", description: "Ceramica Bianco Polished", bookId: "vtc", leadTime: "2–3 weeks", size: "24×48", priceSqft: 9.4, freightFlag: true },
  { sku: "VTC-77120", description: "Terrazzo Nouveau Pearl", bookId: "vtc", leadTime: "10 days", priceSqft: 12.75 },
];
const search = (q) => {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return FAKE.filter((it) => words.every((w) => `${it.sku} ${it.description} ${it.brand || ""} ${it.section || ""}`.toLowerCase().includes(w)));
};

// SkuPicker's panel markup (multi-select rows + footer), over the fake search.
function Picker({ label }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const results = open ? search(value) : [];
  const close = () => { setOpen(false); setPicked([]); };
  const pos = useAnchoredPanel(open, wrapRef, panelRef, close);
  const pick = (it) => { setValue(it.sku); close(); };
  const toggle = (it) => setPicked((prev) => prev.some((x) => hitKey(x) === hitKey(it)) ? prev.filter((x) => hitKey(x) !== hitKey(it)) : [...prev, it]);
  const bookName = () => "Virginia Tile";
  return (
    <div>
      <div className="ft-eyebrow text-[9px] mb-1">{label}</div>
      <div ref={wrapRef} className="relative border border-slate-200 rounded" style={{ background: "var(--ft-field, #fff)" }}>
        <input value={value} onChange={(e) => { setValue(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          className="w-full h-9 px-2 py-1.5 ft-field focus:outline-none focus:bg-white" placeholder="SKU" />
        {open && pos && (results.length > 0 || picked.length > 0) && createPortal(
          <div ref={panelRef} style={{ ...vPos(pos), maxHeight: pos.maxH, left: Math.max(8, Math.min(pos.left, window.innerWidth - Math.min(416, window.innerWidth * 0.9) - 8)) }}
            className="fixed w-[26rem] max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg z-50 flex flex-col">
            <div className="max-h-72 min-h-0 overflow-y-auto">
              {results.map((it) => {
                const sel = picked.some((x) => hitKey(x) === hitKey(it));
                return (
                  <div key={hitKey(it)} onClick={(e) => (e.shiftKey ? toggle(it) : pick(it))}
                    className={`flex items-start gap-2 cursor-pointer px-2.5 py-1.5 border-b border-slate-100 last:border-0 ${sel ? "bg-indigo-50/60" : ""}`}>
                    <button onClick={(e) => { e.stopPropagation(); toggle(it); }}
                      className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{sel && <Check size={11} />}</button>
                    <div className="flex-1 min-w-0"><Hit it={it} bookName={bookName} /></div>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
              <span className="truncate">{matchSummary(results.length, results.length)}</span>
              <span className="ml-auto shrink-0">Shift-click to pick several</span>
            </div>
          </div>, document.body)}
      </div>
    </div>
  );
}

function Page() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--ft-cream)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 16 }}>
      <div>
        <div className="ft-serif" style={{ fontSize: 16, color: "var(--ft-text)", marginBottom: 4 }}>SKU popup — mobile preview</div>
        <p className="text-[11px] text-slate-500" style={{ marginBottom: 12 }}>Type “tile”, “shaw”, or “grout”. Top field opens downward; bottom field flips upward.</p>
        <Picker label="Field near the top — opens below" />
      </div>
      <div style={{ paddingBottom: 8 }}>
        <Picker label="Field near the bottom — flips above" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Page />);
