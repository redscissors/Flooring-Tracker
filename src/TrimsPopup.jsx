import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Modal } from "./widgets.jsx";
import { money } from "./model.js";
import { orderUnitOf, isCartonUnit } from "./stock.js";

// The floor row's trims popup (2026-07-22 spec): every trim the price book
// says fits this floor, one quantity each. It mirrors the floor's existing
// trim lines (seedTrimPlan), so reopening adjusts instead of appending —
// Apply hands the quantities back and applyTrimPlan does the row surgery.
// A trim's name carries the "· fits …" search note; drop it here like the
// order panel does.
const stripFits = (s) => String(s || "").replace(/\s*·\s*fits\b.*$/i, "").trim();

export default function TrimsPopup({ floorName, trims, seed, onApply, onClose }) {
  const seedBySku = new Map(seed.map((e) => [e.sku, e]));
  const [qtys, setQtys] = useState(() => Object.fromEntries(seed.map((e) => [e.sku, e.qty > 0 ? String(e.qty) : ""])));
  const qtyOf = (sku) => { const n = parseFloat(qtys[sku]); return Number.isFinite(n) && n > 0 ? n : 0; };
  const setQty = (sku, v) => setQtys((q) => ({ ...q, [sku]: v }));
  const step = (sku, d) => setQty(sku, String(Math.max(0, qtyOf(sku) + d)));
  const hasExisting = seed.some((e) => e.rowId);
  const changed = trims.some((it) => qtyOf(it.sku) !== (seedBySku.get(it.sku)?.qty || 0));
  const picked = trims.filter((it) => qtyOf(it.sku) > 0);
  const total = picked.reduce((t, it) => t + (it.price || 0) * qtyOf(it.sku), 0);

  return (
    <Modal title="Trims & transitions" onClose={onClose}>
      <div className="text-sm text-slate-500 -mt-2 mb-3">For <span className="font-medium text-slate-700">{floorName}</span> — lines land right below the floor and stay adjustable on the grid.</div>
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {trims.map((it) => {
          const s = seedBySku.get(it.sku);
          const q = qtyOf(it.sku);
          const carton = isCartonUnit(orderUnitOf(it)) && it.pcPerUnit > 0;
          return (
            <div key={it.sku} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{stripFits(it.description) || it.sku}</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="ft-mono">{it.sku}</span>
                  {it.size && <span>{it.size}</span>}
                  {it.price != null && <span className="text-slate-500">{money(it.price)}/ea</span>}
                  {carton && <span title="Ordered quantities round up to whole cartons">cartons of {it.pcPerUnit}</span>}
                  {s?.rowId && (q > 0
                    ? <span className="rounded px-1 py-px bg-slate-100 text-slate-500 font-medium">on job</span>
                    : <span className="rounded px-1 py-px bg-red-50 text-red-600 font-medium">removes its line</span>)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => step(it.sku, -1)} disabled={q <= 0} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Minus size={12} /></button>
                <input type="number" min="0" value={qtys[it.sku]} onChange={(e) => setQty(it.sku, e.target.value)} placeholder="0"
                  className={`w-14 text-right rounded border px-1.5 py-1 text-sm ft-field focus:border-indigo-500 focus:outline-none ${q > 0 ? "border-indigo-300 font-semibold" : "border-slate-200"}`} />
                <button onClick={() => step(it.sku, 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"><Plus size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <span className="text-xs text-slate-400">{picked.length > 0 ? <>{picked.length} line{picked.length === 1 ? "" : "s"} · about {money(total)} <span title="Carton-sold trims round up to whole cartons on the row">before carton rounding</span></> : "Pick quantities above."}</span>
        <span className="flex-1" />
        <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Cancel</button>
        <button onClick={() => onApply(Object.fromEntries(trims.map((it) => [it.sku, qtyOf(it.sku)])))} disabled={!changed}
          className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50">
          {hasExisting ? "Update lines" : "Add to job"}
        </button>
      </div>
    </Modal>
  );
}
