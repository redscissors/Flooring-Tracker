import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, FolderInput, Trash2, ChevronRight } from "lucide-react";
import { useEscClose } from "./widgets.jsx";
import { ClaudeMark, CLAUDE_CLAY_DEEP } from "./claudeflag.jsx";

const MENU_W = 236;

// The product line's action menu (issue 087, owner "option A" 2026-08-13):
// opened by a plain CLICK on the row-end ⋯ — a hold on that same button drags,
// the dots are the row's one grip — or by right-click anywhere on the row.
// Fixed at the pointer, clamped to the viewport; "Move to area" expands inline
// instead of floating a submenu.
export function LineMenu({ menu, title, subtitle, areas, canDelete, onClose, onDuplicate, onMoveTo, onFlag, onDelete }) {
  const ref = useRef(null);
  const [moving, setMoving] = useState(false);
  useEscClose(!!menu, onClose);
  useEffect(() => { setMoving(false); }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [menu, onClose]);
  if (!menu) return null;
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(menu.y + 2, window.innerHeight - 60));
  const mi = "flex w-full items-center gap-2.5 px-3 py-1.5 text-[12.5px] font-medium text-left hover:bg-slate-50";
  return createPortal(
    <div ref={ref} style={{ left, top, width: MENU_W, maxHeight: window.innerHeight - top - 8 }} className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm overflow-y-auto">
      <div className="px-3 pt-1 pb-1.5 border-b border-slate-100 mb-1">
        <div className="text-xs font-semibold truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-slate-400 truncate">{subtitle}</div>}
      </div>
      <button className={mi} onClick={() => { onDuplicate(); onClose(); }}><Copy size={13} className="text-slate-400" /> Duplicate line</button>
      {areas.length > 0 && (
        <button className={mi} onClick={() => setMoving((v) => !v)}>
          <FolderInput size={13} className="text-slate-400" /> Move to area
          <ChevronRight size={12} className={`ml-auto text-slate-300 transition-transform ${moving ? "rotate-90" : ""}`} />
        </button>
      )}
      {moving && areas.map((a) => (
        <button key={a.id} className={mi + " pl-9 text-slate-600"} onClick={() => { onMoveTo(a.id); onClose(); }}>{a.name}</button>
      ))}
      <button className={mi} style={{ color: CLAUDE_CLAY_DEEP }} onClick={() => { onFlag(); onClose(); }}><ClaudeMark size={13} /> Flag for Claude…</button>
      {canDelete && <>
        <div className="border-t border-slate-100 my-1" />
        <button className={mi + " hover:bg-red-50"} style={{ color: "#b91c1c" }} onClick={() => { onDelete(); onClose(); }}><Trash2 size={13} /> Delete line</button>
      </>}
    </div>, document.body);
}
