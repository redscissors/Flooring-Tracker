import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { sfPartsTotal, sfPartsState, droppedText, togglePiece, addExtra, removeAt, sfPatch, fmtSf } from "./sfparts.js";

export function SfPartsMenu({ x, y, product, showers, onPatch, onClose }) {
  const parts = product.sfParts || [];
  const [label, setLabel] = useState("");
  const [sf, setSf] = useState("");
  const commit = (next) => onPatch(sfPatch(next));
  const on = (s, piece) => parts.some((e) => e.kind === "shower" && e.kitId === s.key && e.piece === piece);
  const extras = parts.map((e, i) => [e, i]).filter(([e]) => e.kind === "extra");
  const total = sfPartsState(product, showers)?.live ?? sfPartsTotal(parts);
  const add = () => { if (+sf > 0) { commit(addExtra(parts, label, +sf)); setLabel(""); setSf(""); } };
  const anchored = x != null;
  const box = anchored
    ? { left: Math.max(8, Math.min(x, window.innerWidth - 296)), top: Math.max(8, Math.min(y, window.innerHeight - 428)), width: 288 }
    : { left: 12, right: 12, bottom: 12 };
  return createPortal(
    <div className="ft-noprint fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="ft-pop fixed text-xs overflow-y-auto" style={{ ...box, maxHeight: 420, padding: 10 }} onClick={(e) => e.stopPropagation()}>
        {(showers || []).length === 0 && <div className="text-slate-400 mb-2">No wedi or Schluter shower on this job.</div>}
        {(showers || []).map((s) => (
          <div key={s.key} className="mb-2">
            {s.unmeasured ? (<>
              <div className="font-semibold text-slate-700 mb-0.5">{s.areaName}</div>
              <div className="text-slate-400">can't measure this shower — add its sq ft under Extra space</div>
            </>) : (
              <div className="font-semibold text-slate-700 mb-0.5">{s.areaName} — {s.size}{s.curbed ? "" : ", curbless"}</div>
            )}
            {s.pieces.map((pc) => (
              <label key={pc.piece} className={`flex items-center gap-2 py-0.5 ${pc.sf == null && !on(s, pc.piece) ? "text-slate-400" : "cursor-pointer"}`}>
                <input type="checkbox" disabled={pc.sf == null && !on(s, pc.piece)} checked={on(s, pc.piece)} onChange={() => commit(togglePiece(parts, s, pc))} />
                <span className="flex-1">{pc.label}</span>
                <span className="ft-mono">{pc.sf == null ? "size unknown — add below" : fmtSf(pc.sf)}</span>
              </label>
            ))}
          </div>
        ))}
        <div className="border-t border-slate-200 pt-2 mt-1">
          <div className="font-semibold text-slate-700 mb-1">Extra space</div>
          {extras.map(([e, i]) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="flex-1">{e.label || "Extra"}</span>
              <span className="ft-mono">{fmtSf(e.sf)}</span>
              <button onClick={() => commit(removeAt(parts, i))} title="Remove" className="text-slate-400 hover:text-slate-700"><X size={12} /></button>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (Hall)" className="ft-cell flex-1 min-w-0 border border-slate-200 rounded px-1.5 py-1" />
            <input type="number" value={sf} onChange={(e) => setSf(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="sf" className="ft-cell w-14 text-right border border-slate-200 rounded px-1.5 py-1" />
            <button onClick={add} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 font-medium">Add</button>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold">
          <span>Total on this row</span><span className="ft-mono">{fmtSf(total)} sf</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SfPartsChips({ state, onPatch }) {
  if (!state) return null;
  const gone = state.gone;
  const goneSf = sfPartsTotal(gone);
  const keep = state.fresh.filter((e) => !gone.includes(e));
  const dropped = state.dropped || [];
  return (<>
    {state.drift && (<>
      <span className="text-amber-600">{state.changed ? "Shower now calculates to" : "Pieces add to"} {fmtSf(state.drift.auto)} sf — this row is set to {fmtSf(state.drift.have)}</span>
      <button tabIndex={-1} onClick={() => onPatch(sfPatch(state.fresh))} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use {fmtSf(state.drift.auto)}</button>
    </>)}
    {gone.length > 0 && (<>
      <span className="text-amber-600">{[...new Set(gone.map((e) => e.where || "A"))].join(", ")} shower was removed — {fmtSf(goneSf)} sf still counted</span>
      <button tabIndex={-1} onClick={() => onPatch(sfPatch(keep))} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Remove</button>
    </>)}
    {dropped.length > 0 && (<>
      <span className="text-amber-600">{droppedText(dropped)} {dropped.length > 1 ? "are" : "is"} no longer on the shower — {fmtSf(sfPartsTotal(dropped))} sf still counted</span>
      <button tabIndex={-1} onClick={() => onPatch(sfPatch(state.fresh.filter((e) => !dropped.includes(e))))} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Remove</button>
    </>)}
  </>);
}
