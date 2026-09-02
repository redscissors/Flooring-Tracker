import { useMemo, useRef, useState } from "react";
import { X, Search, Plus, Users, Folder, FileText, ChevronRight, ChevronDown, ArrowUpRight, Zap, Clock, Check, Layers } from "lucide-react";
import { browserRows, quickRows, draftRows, filterRows, filterBySales, sortRows, groupBySales, salesNameOf, salesRoster, defaultSalesFilter, shortDate, projNos, SORTS, NO_SALES, normColOrder, moveCol, custSamples, filterBySamples, normPanelH, clampPanelH, stripOpenDefault, STRIP_H, LINES_H } from "./custbrowser.js";
import { useEscClose, DotMenu } from "./widgets.jsx";

// The customer browser (issue 040): an ERP-style directory — a dense grid of
// every customer, grouped by salesman, over a bottom panel of the selected
// customer's projects (the order-screen master→lines layout the team already
// reads all day). Replaces the sidebar's expanding age-bucket folders. Pure
// UI over the boot's light rows; opening it fetches nothing, and every action
// routes back through App's existing handlers.
export default function CustomerBrowser({ people, projects, builders, myName, initialCols, onColOrder, initialPanels, onPanels = () => {}, onClose, onOpenCustomer, onOpenProject, onNewCustomer, onNewProject, sampleTally = new Map() }) {
  const [q, setQ] = useState("");
  // Column order: seeded from the salesperson's saved arrangement, edited by
  // dragging the header cells; every change flows up through onColOrder.
  const [cols, setCols] = useState(() => normColOrder(initialCols));
  const [dragCol, setDragCol] = useState(null);
  const [overCol, setOverCol] = useState(null); // { key, after } while a drag hovers
  // The salesperson box (the ERP order screen's Salesperson filter): opens on
  // the signed-in salesman's own customers, since that's whose jobs they came
  // looking for. Typing narrows to any other name; the ▾ picks one off the
  // roster of everyone the shop's jobs carry; Everyone clears back to the
  // whole directory.
  const [salesQ, setSalesQ] = useState(() => defaultSalesFilter(projects, myName));
  const [salesMenu, setSalesMenu] = useState(false);
  const salesMenuRef = useRef(null);
  const roster = useMemo(() => salesRoster(projects), [projects]);
  const [sortKey, setSortKey] = useState("created");
  const [selId, setSelId] = useState(null);
  // Samples filter (spec 2026-08-28): only customers with OPEN (to-order)
  // sample requests, over the same grid + strips the salesperson box narrows.
  const [samplesOnly, setSamplesOnly] = useState(false);
  useEscClose(true, onClose);

  const rows = useMemo(() => browserRows({ people, projects, builders }), [people, projects, builders]);
  const quick = useMemo(() => quickRows(projects, q, salesQ), [projects, q, salesQ]);
  const drafts = useMemo(() => draftRows(projects, q, salesQ), [projects, q, salesQ]);
  const quickShown = useMemo(() => samplesOnly ? quick.filter((p) => (sampleTally.get(p.id)?.need || 0) > 0) : quick, [quick, samplesOnly, sampleTally]);
  const draftsShown = useMemo(() => samplesOnly ? drafts.filter((p) => (sampleTally.get(p.id)?.need || 0) > 0) : drafts, [drafts, samplesOnly, sampleTally]);
  const quickCount = useMemo(() => quickRows(projects).length, [projects]);
  const draftCount = useMemo(() => draftRows(projects).length, [projects]);
  const unfiledCount = quickCount + draftCount;
  // The customer-less projects — quick-price drafts and unassigned estimates —
  // live folded into this folder (they have no customer row). The strip opens
  // WITH the browser, sized to the last few quick prices, because they are
  // what the team comes here to check; the header toggle still hides it, and
  // both that choice and the dragged heights save per user. Both lists narrow
  // with the search box AND the salesperson filter, like the grid.
  const [showQuick, setShowQuick] = useState(() => stripOpenDefault(initialPanels?.strip, unfiledCount));
  const [stripH, setStripH] = useState(() => normPanelH(initialPanels?.stripH));
  const [linesH, setLinesH] = useState(() => normPanelH(initialPanels?.linesH));
  const toggleStrip = () => { const next = !showQuick; setShowQuick(next); onPanels({ strip: next }); };
  const shown = useMemo(() => sortRows(filterBySales(filterRows(samplesOnly ? filterBySamples(rows, sampleTally) : rows, q), salesQ), sortKey), [rows, q, salesQ, sortKey, samplesOnly, sampleTally]);
  // Flat list by default; the salesman bands appear only while the
  // salesperson box narrows the list (they show which salesmen matched).
  const groups = useMemo(() => salesQ.trim() ? groupBySales(shown) : [{ sales: null, rows: shown }], [salesQ, shown]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const sel = flat.find((r) => r.id === selId) || null;
  const projCount = rows.reduce((n, r) => n + r.projs.length, 0);

  // Shared count chips — the samples column, the strips, and the lines panel.
  const sampleChips = (t) => (t.need || t.ordered) ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {t.need > 0 && <span className="text-[10px] font-semibold rounded-full px-1.5 leading-4" style={{ background: "#fef6e2", color: "#b45309" }}>{t.need} to order</span>}
      {t.ordered > 0 && <span className="text-[10px] font-semibold rounded-full px-1.5 leading-4" style={{ background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" }}>{t.ordered} ordered</span>}
    </span>
  ) : null;

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
    projno: { label: "Project #" },
    sales: { label: "Salesman" },
    builder: { label: "Builder" },
    phone: { label: "Phone" },
    address: { label: "Address" },
    email: { label: "Email", cls: "hidden lg:table-cell" },
    jobs: { label: "Jobs", cls: "text-center" },
    samples: { label: "Samples" },
    created: { label: "Created", sort: "created", cls: "text-right" },
    modified: { label: "Modified", sort: "modified", cls: "text-right" },
  };
  const CELL = {
    projno: (r) => {
      const nos = projNos(r.projs).join(" ");
      return <td key="projno" className={`${td} ft-mono max-w-[136px] text-slate-500`} title={nos || undefined}>{nos}</td>;
    },
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
    samples: (r) => <td key="samples" className={td}>{sampleChips(custSamples(sampleTally, r.projs))}</td>,
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

  const unfiledRow = (p, Icon, fallbackName) => (
    <button key={p.id} onClick={() => onOpenProject(p.id)}
      className="w-full text-left rounded-md px-2 py-1 flex items-center gap-2 border border-transparent hover:bg-slate-50 group">
      <Icon size={13} className="text-slate-300 shrink-0" />
      {p.projectNo && <span className="ft-mono text-[11px] text-slate-400 shrink-0">N{p.projectNo}</span>}
      <span className="ft-item-name text-[12.5px] truncate">{p.name || fallbackName}</span>
      {salesNameOf(p) && <span className="text-[10.5px] text-slate-400 truncate">{salesNameOf(p)}</span>}
      {sampleChips(sampleTally.get(p.id) || { need: 0, ordered: 0 })}
      <span className="ml-auto ft-mono text-[11px] text-slate-400 whitespace-nowrap">{shortDate(p.createdAt)} · {shortDate(p.updatedAt)}</span>
      <ChevronRight size={13} className="text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
    </button>
  );

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
            {salesQ && (
              <button onClick={() => setSalesQ("")} title="Show every salesperson" className="px-1.5 flex items-center border-l border-slate-200 text-slate-400 hover:text-slate-600"><X size={12} /></button>
            )}
            <button ref={salesMenuRef} onClick={() => setSalesMenu((o) => !o)} title="Pick a salesperson"
              className="px-1 flex items-center border-l border-slate-200 text-slate-400 hover:text-slate-600"><ChevronDown size={13} /></button>
            <DotMenu open={salesMenu} onClose={() => setSalesMenu(false)} anchorRef={salesMenuRef} width={180}>
              <button onClick={() => { setSalesQ(""); setSalesMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50">
                <Check size={13} className={salesQ ? "opacity-0" : "text-indigo-600"} /> Everyone
              </button>
              {roster.length > 0 && <div className="my-1 border-t border-slate-100" />}
              {roster.map((n) => (
                <button key={n} onClick={() => { setSalesQ(n); setSalesMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50">
                  <Check size={13} className={salesQ === n ? "text-indigo-600" : "opacity-0"} />
                  <span className="truncate flex-1">{n}</span>
                  {myName && n.toLowerCase() === myName.trim().toLowerCase() && <span className="text-[10px] text-slate-400 shrink-0">me</span>}
                </button>
              ))}
            </DotMenu>
          </div>
          <button onClick={() => setSamplesOnly((s) => !s)}
            title={samplesOnly ? "Show every customer" : "Only customers with samples still to order"}
            className={`h-[26px] flex items-center gap-1 rounded-md border px-2 text-xs font-semibold shrink-0 ${samplesOnly ? "ft-seg-on border-slate-200" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <Layers size={13} /> Samples
          </button>
          {unfiledCount > 0 && (
            <button onClick={toggleStrip}
              title={showQuick ? "Hide estimates & drafts" : "Show estimates & drafts"}
              className={`h-[26px] flex items-center gap-1 rounded-md border px-2 text-xs font-semibold shrink-0 ${showQuick ? "ft-seg-on border-slate-200" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <Clock size={13} /> Estimates &amp; drafts
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 leading-4">{unfiledCount}</span>
            </button>
          )}
          <button onClick={onNewCustomer} className="ft-spark-btn h-[26px] flex items-center gap-1 text-xs font-semibold px-2.5 shrink-0"><Plus size={14} className="-ml-0.5" /> New customer</button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 ml-auto"><X size={18} /></button>
        </div>

        {/* Estimates & drafts strip — the customer-less projects: quick-price
            drafts (ADR 0022) and unassigned estimates, shown only on demand so
            they never crowd the directory itself */}
        {showQuick && unfiledCount > 0 && (
          <div className="relative border-b border-slate-200 shrink-0 flex flex-col" style={stripH ? { height: stripH } : { maxHeight: STRIP_H }}>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {quickCount > 0 && (<>
                <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 sticky top-0" style={{ background: "var(--ft-band)" }}>
                  <span className="ft-eyebrow text-[9.5px] flex items-center gap-1.5"><Zap size={11} className="text-indigo-500" /> Quick prices <span className="normal-case tracking-normal font-normal text-slate-400">· {quickShown.length === quickCount ? quickCount : `${quickShown.length} of ${quickCount}`}</span></span>
                  <span className="ml-auto text-[9.5px] text-slate-400 whitespace-nowrap">unfiled drafts clear 30 days after their last edit</span>
                </div>
                <div className="px-1.5 py-1">
                  {quickShown.length === 0 && <div className="text-[12px] text-slate-400 px-2.5 py-1.5">No matches</div>}
                  {quickShown.map((p) => unfiledRow(p, Zap, "Quick price"))}
                </div>
              </>)}
              {draftCount > 0 && (<>
                <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 sticky top-0" style={{ background: "var(--ft-band)" }}>
                  <span className="ft-eyebrow text-[9.5px] flex items-center gap-1.5"><FileText size={11} className="text-indigo-500" /> Unassigned jobs <span className="normal-case tracking-normal font-normal text-slate-400">· {draftsShown.length === draftCount ? draftCount : `${draftsShown.length} of ${draftCount}`}</span></span>
                </div>
                <div className="px-1.5 py-1">
                  {draftsShown.length === 0 && <div className="text-[12px] text-slate-400 px-2.5 py-1.5">No matches</div>}
                  {draftsShown.map((p) => unfiledRow(p, FileText, "Untitled project"))}
                </div>
              </>)}
            </div>
            <ResizeHandle edge="bottom" label="Estimates &amp; drafts height"
              onResize={(h, commit) => { setStripH(h); if (commit) onPanels({ stripH: h }); }}
              onReset={() => { setStripH(null); onPanels({ stripH: null }); }} />
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
          {flat.length === 0 && <div className="text-center text-sm text-slate-400 mt-10">{q || samplesOnly ? "No matches" : "No customers yet"}</div>}
        </div>

        {/* Project lines for the selected customer — the ERP order-lines panel */}
        {sel && (
          <div className="relative border-t border-slate-200 shrink-0 flex flex-col" style={linesH ? { height: linesH } : { maxHeight: LINES_H }}>
            <ResizeHandle edge="top" label="Project lines height"
              onResize={(h, commit) => { setLinesH(h); if (commit) onPanels({ linesH: h }); }}
              onReset={() => { setLinesH(null); onPanels({ linesH: null }); }} />
            <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-2 shrink-0" style={{ background: "var(--ft-band)" }}>
              <span className="ft-item-name font-semibold text-[13px] truncate">{sel.name || "Unnamed customer"}</span>
              <span className="text-[11px] text-slate-500 truncate">{[sel.builderName, sel.phone, sel.address].filter(Boolean).join(" · ")}</span>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <button onClick={() => onNewProject(sel.id)} className="h-[24px] flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Plus size={12} /> New project</button>
                <button onClick={() => onOpenCustomer(sel.id)} className="h-[24px] flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 text-[11px] font-semibold">Open customer <ArrowUpRight size={12} /></button>
                <button onClick={() => setSelId(null)} className="text-slate-400 hover:text-slate-600 ml-1"><X size={15} /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1">
              {sel.projs.length === 0 && <div className="text-[12px] text-slate-400 px-2.5 py-1.5">No projects yet</div>}
              {sel.projs.map((p) => (
                <button key={p.id} onClick={() => onOpenProject(p.id)}
                  className="w-full text-left rounded-md px-2 py-1 flex items-center gap-2 border border-transparent hover:bg-slate-50 group">
                  <FileText size={13} className="text-slate-300 shrink-0" />
                  {p.projectNo && <span className="ft-mono text-[11px] text-slate-400 shrink-0">N{p.projectNo}</span>}
                  <span className="ft-item-name text-[12.5px] truncate">{p.name || "Untitled project"}</span>
                  {salesNameOf(p) && <span className="text-[10.5px] text-slate-400 truncate">{salesNameOf(p)}</span>}
                  {sampleChips(sampleTally.get(p.id) || { need: 0, ordered: 0 })}
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

// The grab bar on a panel's open edge. Pointer capture keeps a fast drag on
// the handle after the cursor has outrun it; the height is measured off the
// live panel at pointer-down, so a panel still sitting at its content-sized
// default resizes from where it actually is. The pref saves once per drag, on
// release, and a double-click hands the panel back to that default — the way
// out of a drag that went wrong.
function ResizeHandle({ edge, onResize, onReset, label }) {
  const drag = useRef(null);
  const down = (e) => {
    if (e.button !== 0) return;
    const panel = e.currentTarget.parentElement;
    drag.current = { y: e.clientY, h: panel.getBoundingClientRect().height, vh: window.innerHeight, last: null };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const delta = edge === "top" ? d.y - e.clientY : e.clientY - d.y;
    d.last = clampPanelH(d.h + delta, d.vh);
    onResize(d.last, false);
  };
  const up = (e) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.last != null) onResize(d.last, true);
  };
  return (
    <div role="separator" aria-orientation="horizontal" aria-label={label} title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={onReset}
      className={`group absolute inset-x-0 ${edge === "top" ? "top-0" : "bottom-0"} h-[7px] z-20 flex items-center justify-center cursor-row-resize touch-none`}>
      <div className="w-10 h-[3px] rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors" />
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
          {/* 12 ≥ the widest layout (incl. filler); browsers clamp the span */}
          <td colSpan={12} className="px-2 py-1" style={{ background: "var(--ft-band)" }}>
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
