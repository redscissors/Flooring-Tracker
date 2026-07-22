import { useMemo, useState } from "react";
import { X, Search, Plus, Users, Folder, FileText, ChevronRight, ArrowUpRight, Zap } from "lucide-react";
import { browserRows, quickRows, filterRows, filterBySales, sortRows, groupBySales, salesNameOf, shortDate, SORTS, NO_SALES, normColOrder, moveCol } from "./custbrowser.js";
import { useEscClose } from "./widgets.jsx";

// The customer browser (issue 040): an ERP-style directory — a dense grid of
// every customer, grouped by salesman, over a bottom panel of the selected
// customer's projects (the order-screen master→lines layout the team already
// reads all day). Replaces the sidebar's expanding age-bucket folders. Pure
// UI over the boot's light rows; opening it fetches nothing, and every action
// routes back through App's existing handlers.
export default function CustomerBrowser({ people, projects, builders, myName, initialCols, onColOrder, onClose, onOpenCustomer, onOpenProject, onNewCustomer, onNewProject }) {
  const [q, setQ] = useState("");
  // Column order: seeded from the salesperson's saved arrangement, edited by
  // dragging the header cells; every change flows up through onColOrder.
  const [cols, setCols] = useState(() => normColOrder(initialCols));
  const [dragCol, setDragCol] = useState(null);
  const [overCol, setOverCol] = useState(null); // { key, after } while a drag hovers
  // The salesperson box (the ERP order screen's Salesperson filter): typed
  // name narrows to that salesman's customers; "Me" fills the signed-in
  // profile's name.
  const [salesQ, setSalesQ] = useState("");
  const [sortKey, setSortKey] = useState("created");
  const [selId, setSelId] = useState(null);
  // Quick-price drafts live folded into this folder (they have no customer
  // row), hidden until the header's Quick-prices toggle shows the strip.
  const [showQuick, setShowQuick] = useState(false);
  useEscClose(true, onClose);

  const rows = useMemo(() => browserRows({ people, projects, builders }), [people, projects, builders]);
  const quick = useMemo(() => quickRows(projects, q), [projects, q]);
  const quickCount = useMemo(() => quickRows(projects).length, [projects]);
  const shown = useMemo(() => sortRows(filterBySales(filterRows(rows, q), salesQ), sortKey), [rows, q, salesQ, sortKey]);
  // Flat list by default; the salesman bands appear only while the
  // salesperson box narrows the list (they show which salesmen matched).
  const groups = useMemo(() => salesQ.trim() ? groupBySales(shown) : [{ sales: null, rows: shown }], [salesQ, shown]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const sel = flat.find((r) => r.id === selId) || null;
  const projCount = rows.reduce((n, r) => n + r.projs.length, 0);

  // Arrow keys walk the visible rows from the search box; Enter opens the
  // highlighted customer (or the single match).
  const onSearchKeys = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = flat.findIndex((r) => r.id === selId);
      const next = flat[i < 0 ? 0 : Math.min(flat.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) setSelId(next.id);
    } else if (e.key === "Enter") {
      const target = sel || (flat.length === 1 ? flat[0] : null);
      if (target) onOpenCustomer(target.id);
    }
  };

  // w-px + nowrap: every column shrinks to its widest content (plus the small
  // cell padding); the trailing filler column absorbs the leftover width so
  // the free space sits after the last column instead of stretching them.
  const th = "text-left px-1.5 py-1.5 ft-eyebrow text-[9px] whitespace-nowrap w-px";
  const sortBtn = (key, label) => (
    <button onClick={() => setSortKey(key)} className={`inline-flex items-center gap-0.5 uppercase tracking-[.16em] hover:text-slate-700 ${sortKey === key ? "text-slate-700" : ""}`}>
      {label}{sortKey === key && <span className="normal-case tracking-normal">{key === "name" ? "↓" : "▾"}</span>}
    </button>
  );
  const td = "px-1.5 py-[5px] border-b border-slate-100 truncate w-px";

  // The draggable columns (Customer stays pinned — the row's identity).
  // Per-key head config + cell renderer, laid out in `cols` order.
  const HEAD = {
    sales: { label: "Salesman" },
    builder: { label: "Builder" },
    phone: { label: "Phone" },
    address: { label: "Address" },
    email: { label: "Email", cls: "hidden lg:table-cell" },
    jobs: { label: "Jobs", cls: "text-center" },
    created: { label: "Created", sort: "created", cls: "text-right" },
    modified: { label: "Modified", sort: "modified", cls: "text-right" },
  };
  const CELL = {
    sales: (r) => <td key="sales" className={`${td} max-w-[130px] text-slate-500`}>{r.sales}</td>,
    builder: (r) => <td key="builder" className={`${td} max-w-[160px] text-slate-500`}>{r.builderName}</td>,
    phone: (r) => <td key="phone" className={`${td} ft-mono whitespace-nowrap text-slate-600`}>{r.phone}</td>,
    address: (r) => <td key="address" className={`${td} max-w-[240px] text-slate-500`}>{r.address}</td>,
    email: (r) => <td key="email" className={`${td} max-w-[180px] text-slate-500 hidden lg:table-cell`}>{r.email}</td>,
    jobs: (r) => (
      <td key="jobs" className={`${td} text-center`}>
        {r.projs.length > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-1.5 leading-4 inline-block">{r.projs.length}</span>}
      </td>
    ),
    created: (r) => <td key="created" className={`${td} ft-mono whitespace-nowrap text-right text-slate-500`}>{shortDate(r.createdAt)}</td>,
    modified: (r) => <td key="modified" className={`${td} ft-mono whitespace-nowrap text-right text-slate-500`}>{shortDate(r.activity)}</td>,
  };

  // HTML5 drag on the header cells: drop on a column's left half inserts
  // before it, right half after — so any arrangement is one drag away.
  const dragProps = (key) => ({
    draggable: true,
    onDragStart: (e) => { setDragCol(key); e.dataTransfer.effectAllowed = "move"; },
    onDragEnd: () => { setDragCol(null); setOverCol(null); },
    onDragOver: (e) => {
      if (!dragCol) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setOverCol({ key, after: e.clientX > rect.left + rect.width / 2 });
    },
    onDrop: (e) => {
      e.preventDefault();
      if (dragCol && overCol) {
        const before = overCol.after ? cols[cols.indexOf(overCol.key) + 1] || null : overCol.key;
        const next = moveCol(cols, dragCol, before);
        if (next !== cols) { setCols(next); onColOrder(next); }
      }
      setDragCol(null); setOverCol(null);
    },
  });
  const dropMark = (key) => overCol && overCol.key === key && dragCol && dragCol !== key
    ? { boxShadow: `inset ${overCol.after ? "-2px" : "2px"} 0 0 var(--ft-brand)` } : undefined;

  const rowEl = (r) => {
    const on = r.id === selId;
    return (
      <tr key={r.id} onClick={() => setSelId(on ? null : r.id)} onDoubleClick={() => onOpenCustomer(r.id)}
        className="cursor-pointer group" style={{ background: on ? "var(--ft-seg-on-bg)" : undefined }}>
        <td className={`${td} max-w-[220px]`}>
          <span className="ft-item-name font-semibold text-[12.5px]">{r.name || "Unnamed customer"}</span>
        </td>
        {cols.map((k) => CELL[k](r))}
        <td className="border-b border-slate-100" aria-hidden />
      </tr>
    );
  };

  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white h-full rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header: title + counts, search, sort, grouping, new customer */}
        <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-2.5 border-b border-slate-200 shrink-0">
          <Folder size={17} className="text-indigo-500 shrink-0" />
          <h3 className="ft-serif text-xl leading-none">Customers</h3>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`} · {projCount} projects</span>
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={14} className="absolute left-2 top-2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKeys}
              placeholder="Name, phone, address…" className="ft-field w-full rounded-md border border-slate-200 pl-7 pr-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div className="flex items-stretch rounded-md border border-slate-200 overflow-hidden text-xs shrink-0 h-[26px]">
            {SORTS.map(([key, label]) => (
              <button key={key} onClick={() => setSortKey(key)} className={`px-2 flex items-center font-medium ${sortKey === key ? "ft-seg-on" : "ft-seg-off"}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-stretch rounded-md border border-slate-200 overflow-hidden shrink-0 h-[26px]">
            <div className="relative">
              <Users size={13} className="absolute left-1.5 top-[6px] text-slate-400" />
              <input value={salesQ} onChange={(e) => setSalesQ(e.target.value)} placeholder="Salesperson"
                className="ft-field h-full w-[118px] border-0 pl-6 pr-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {salesQ ? (
              <button onClick={() => setSalesQ("")} title="Show every salesperson" className="px-1.5 flex items-center border-l border-slate-200 text-slate-400 hover:text-slate-600"><X size={12} /></button>
            ) : (
              <button onClick={() => myName && setSalesQ(myName)} disabled={!myName}
                title={myName ? `My customers — ${myName}` : "Set your name in Settings → General first"}
                className="px-2 flex items-center border-l border-slate-200 text-xs font-semibold text-indigo-600 hover:bg-slate-50 disabled:text-slate-300">Me</button>
            )}
          </div>
          {quickCount > 0 && (
            <button onClick={() => setShowQuick((s) => !s)}
              title={showQuick ? "Hide quick prices" : "Show quick prices"}
              className={`h-[26px] flex items-center gap-1 rounded-md border px-2 text-xs font-semibold shrink-0 ${showQuick ? "ft-seg-on border-slate-200" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <Zap size={13} /> Quick prices
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 leading-4">{quickCount}</span>
            </button>
          )}
          <button onClick={onNewCustomer} className="ft-spark-btn h-[26px] flex items-center gap-1 text-xs font-semibold px-2.5 shrink-0"><Plus size={14} className="-ml-0.5" /> New customer</button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 ml-auto"><X size={18} /></button>
        </div>

        {/* Quick prices strip — customer-less drafts (ADR 0022), shown only on
            demand so they never crowd the directory itself */}
        {showQuick && quickCount > 0 && (
          <div className="border-b border-slate-200 shrink-0 flex flex-col" style={{ maxHeight: "34%" }}>
            <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 shrink-0" style={{ background: "var(--ft-band)" }}>
              <span className="ft-eyebrow text-[9.5px] flex items-center gap-1.5"><Zap size={11} className="text-indigo-500" /> Quick prices <span className="normal-case tracking-normal font-normal text-slate-400">· {quick.length === quickCount ? quickCount : `${quick.length} of ${quickCount}`}</span></span>
              <span className="ml-auto text-[9.5px] text-slate-400 whitespace-nowrap">unfiled drafts clear 30 days after their last edit</span>
            </div>
            <div className="overflow-y-auto px-1.5 py-1">
              {quick.length === 0 && <div className="text-[12px] text-slate-400 px-2.5 py-1.5">No matches</div>}
              {quick.map((p) => (
                <button key={p.id} onClick={() => onOpenProject(p.id)}
                  className="w-full text-left rounded-md px-2 py-1 flex items-center gap-2 border border-transparent hover:bg-slate-50 group">
                  <Zap size={13} className="text-slate-300 shrink-0" />
                  <span className="ft-item-name text-[12.5px] truncate">{p.name || "Quick price"}</span>
                  {salesNameOf(p) && <span className="text-[10.5px] text-slate-400 truncate">{salesNameOf(p)}</span>}
                  <span className="ml-auto ft-mono text-[11px] text-slate-400 whitespace-nowrap">{shortDate(p.createdAt)} · {shortDate(p.updatedAt)}</span>
                  <ChevronRight size={13} className="text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The grid */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-[12px] border-collapse" style={{ minWidth: 780 }}>
            <thead className="sticky top-0 z-10" style={{ background: "var(--ft-card, #fff)", boxShadow: "0 1px 0 var(--ft-border, #e2e8f0)" }}>
              <tr>
                <th className={th}>{sortBtn("name", "Customer")}</th>
                {cols.map((k) => (
                  <th key={k} {...dragProps(k)} style={dropMark(k)} title="Drag to rearrange columns"
                    className={`${th} ${HEAD[k].cls || ""} cursor-grab select-none ${dragCol === k ? "opacity-40" : ""}`}>
                    {HEAD[k].sort ? sortBtn(HEAD[k].sort, HEAD[k].label) : HEAD[k].label}
                  </th>
                ))}
                <th className="w-full" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <FragmentRows key={g.sales ?? "all"} group={g} rowEl={rowEl} />
              ))}
            </tbody>
          </table>
          {flat.length === 0 && <div className="text-center text-sm text-slate-400 mt-10">{q ? "No matches" : "No customers yet"}</div>}
        </div>

        {/* Project lines for the selected customer — the ERP order-lines panel */}
        {sel && (
          <div className="border-t border-slate-200 shrink-0 flex flex-col" style={{ maxHeight: "38%" }}>
            <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-2 shrink-0" style={{ background: "var(--ft-band)" }}>
              <span className="ft-item-name font-semibold text-[13px] truncate">{sel.name || "Unnamed customer"}</span>
              <span className="text-[11px] text-slate-500 truncate">{[sel.builderName, sel.phone, sel.address].filter(Boolean).join(" · ")}</span>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <button onClick={() => onNewProject(sel.id)} className="h-[24px] flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Plus size={12} /> New project</button>
                <button onClick={() => onOpenCustomer(sel.id)} className="h-[24px] flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 text-[11px] font-semibold">Open customer <ArrowUpRight size={12} /></button>
                <button onClick={() => setSelId(null)} className="text-slate-400 hover:text-slate-600 ml-1"><X size={15} /></button>
              </div>
            </div>
            <div className="overflow-y-auto px-1.5 py-1">
              {sel.projs.length === 0 && <div className="text-[12px] text-slate-400 px-2.5 py-1.5">No projects yet</div>}
              {sel.projs.map((p) => (
                <button key={p.id} onClick={() => onOpenProject(p.id)}
                  className="w-full text-left rounded-md px-2 py-1 flex items-center gap-2 border border-transparent hover:bg-slate-50 group">
                  <FileText size={13} className="text-slate-300 shrink-0" />
                  <span className="ft-item-name text-[12.5px] truncate">{p.name || "Untitled project"}</span>
                  {salesNameOf(p) && <span className="text-[10.5px] text-slate-400 truncate">{salesNameOf(p)}</span>}
                  <span className="ml-auto ft-mono text-[11px] text-slate-400 whitespace-nowrap">{shortDate(p.createdAt)} · {shortDate(p.updatedAt)}</span>
                  <ChevronRight size={13} className="text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// One salesperson band + its customer rows (band suppressed for the flat,
// unfiltered list — group.sales is null there).
function FragmentRows({ group, rowEl }) {
  return (
    <>
      {group.sales != null && (
        <tr>
          {/* 11 ≥ the widest layout (incl. filler); browsers clamp the span */}
          <td colSpan={11} className="px-2 py-1" style={{ background: "var(--ft-band)" }}>
            <span className="ft-eyebrow text-[9.5px] flex items-center gap-1.5">
              <Users size={11} className={group.sales === NO_SALES ? "text-slate-400" : "text-indigo-500"} />
              {group.sales}
              <span className="normal-case tracking-normal font-normal text-slate-400">· {group.rows.length}</span>
            </span>
          </td>
        </tr>
      )}
      {group.rows.map(rowEl)}
    </>
  );
}
