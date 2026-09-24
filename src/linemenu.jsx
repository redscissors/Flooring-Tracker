import { useRef, useState } from "react";
import { Copy, FolderInput, Trash2, ChevronRight, Layers, StickyNote, Percent } from "lucide-react";
import { useEscClose, useAnchoredPanel, useDismissOutside, SearchPop, PointPop } from "./widgets.jsx";
import { ClaudeMark, CLAUDE_CLAY_DEEP } from "./claudeflag.jsx";

const MENU_W = 204;

// The product line's action menu (issue 087, owner "option A" 2026-08-13):
// opened by a plain CLICK on the row-end ⋯ — a hold on that same button drags,
// the dots are the row's one grip — or by right-click anywhere on the row.
// From the ⋯ it grows out of the row-end cell (menu.anchor), the line's name
// sharing that top row (ADR 0048); from a right-click it opens at the pointer.
// "Move to area" expands inline instead of floating a submenu.
export function LineMenu(props) {
  const { menu } = props;
  if (!menu) return null;
  return menu.anchor?.isConnected
    ? <GrownMenu key={"g" + menu.pid} {...props} />
    : <PointMenu key={`p${menu.x},${menu.y}`} {...props} />;
}

function GrownMenu({ menu, title, subtitle, onClose, ...rest }) {
  const anchorRef = useRef(menu.anchor);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(true, anchorRef, panelRef, onClose);
  useEscClose(true, onClose);
  if (!pos) return null;
  const left = Math.max(8, Math.min(pos.left + pos.width - MENU_W, window.innerWidth - MENU_W - 8));
  return (
    <SearchPop pos={pos} box={{ left, width: MENU_W }} fieldRef={anchorRef} panelRef={panelRef} className="py-1 text-sm overflow-y-auto"
      lead={<div className="flex-1 min-w-0 pl-2.5 pr-1 leading-tight">
        <div className="text-xs font-bold truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-slate-400 truncate">{subtitle}</div>}
      </div>}>
      <MenuItems onClose={onClose} {...rest} />
    </SearchPop>
  );
}

function PointMenu({ menu, title, subtitle, onClose, ...rest }) {
  const ref = useRef(null);
  useEscClose(true, onClose);
  useDismissOutside(true, ref, ref, onClose);
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(menu.y + 2, window.innerHeight - 60));
  return (
    <PointPop popRef={ref} className="py-1 text-sm overflow-y-auto" style={{ left, top, width: MENU_W, maxHeight: window.innerHeight - top - 8 }}>
      <div className="px-3 pt-1 pb-1.5 border-b border-slate-100 mb-1">
        <div className="text-xs font-semibold truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-slate-400 truncate">{subtitle}</div>}
      </div>
      <MenuItems onClose={onClose} {...rest} />
    </PointPop>
  );
}

function MenuItems({ areas, canDelete, sampleOn, hasNote, wasteText, onClose, onDuplicate, onMoveTo, onSample, onNote, onWaste, onFlag, onDelete }) {
  const [moving, setMoving] = useState(false);
  const mi = "flex w-full items-center gap-2.5 px-3 py-1.5 text-[12.5px] font-medium text-left hover:bg-slate-50";
  return (<>
    <button className={mi} onClick={() => { onDuplicate(); onClose(); }}><Copy size={13} className="text-slate-400" /> Duplicate line</button>
    {onNote && <button className={mi} onClick={() => { onNote(); onClose(); }}><StickyNote size={13} className="text-slate-400" /> {hasNote ? "Edit note" : "Add note"}</button>}
    {onWaste && (
      <button className={mi} onClick={() => { onWaste(); onClose(); }}>
        <Percent size={13} className="text-slate-400" /> Waste…
        <span className="ml-auto text-[11px] font-medium text-slate-400">{wasteText}</span>
      </button>
    )}
    {areas.length > 0 && (
      <button className={mi} onClick={() => setMoving((v) => !v)}>
        <FolderInput size={13} className="text-slate-400" /> Move to area
        <ChevronRight size={12} className={`ml-auto text-slate-300 transition-transform ${moving ? "rotate-90" : ""}`} />
      </button>
    )}
    {moving && areas.map((a) => (
      <button key={a.id} className={mi + " pl-9 text-slate-600"} onClick={() => { onMoveTo(a.id); onClose(); }}>{a.name}</button>
    ))}
    {onSample && (
      <button className={mi} onClick={() => { onSample(); onClose(); }}>
        <Layers size={13} className="text-slate-400" /> {sampleOn ? "Remove sample request" : "Request sample"}
      </button>
    )}
    <button className={mi} style={{ color: CLAUDE_CLAY_DEEP }} onClick={() => { onFlag(); onClose(); }}><ClaudeMark size={13} /> Flag for Claude…</button>
    {canDelete && <>
      <div className="border-t border-slate-100 my-1" />
      <button className={mi + " hover:bg-red-50"} style={{ color: "#b91c1c" }} onClick={() => { onDelete(); onClose(); }}><Trash2 size={13} /> Delete line</button>
    </>}
  </>);
}
