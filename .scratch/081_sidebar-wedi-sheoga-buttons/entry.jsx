import React from "react";
import { createRoot } from "react-dom/client";
import { Search, Plus, Settings, X, Menu, LogOut, ChevronRight, ListTodo, Zap, Folder, LayoutGrid, MoreHorizontal, ShowerHead, TreePine } from "lucide-react";
import { ThemeSwitch } from "../../src/widgets.jsx";
import { AppsWorkspace } from "../../src/AppsWorkspace.jsx";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none";

// The rail, verbatim classes from App.jsx, with static data — the footer is the
// part under review: wedi | Sheoga side by side below the customer list.
function SidebarMock() {
  const people = [
    { name: "Sarah Jones", sub: "Peak Custom Homes · 2 projects" },
    { name: "Troy Sutton", sub: "1 project" },
    { name: "Amy Adams", sub: "Peak Custom Homes · 1 project" },
  ];
  return (
    <aside style={{ width: 248 }} className="ft-rail border-r border-slate-200 flex flex-col shrink-0 h-full">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="ft-serif text-2xl leading-none">the ned</div>
          <div className="ft-eyebrow text-[9.5px] mt-1">Selection Manager</div>
        </div>
      </div>
      <div className="p-2.5 space-y-2">
        <div className="relative"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input placeholder="Search" className={inp + " pl-8"} readOnly /></div>
        <button className="ft-spark-btn w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2"><Plus size={16} className="-ml-1" /> New Customer</button>
        <button className="w-full flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm font-semibold py-1.5 text-slate-600"><Zap size={15} className="text-indigo-500" /> Quick Price</button>
        <button className="w-full flex items-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 px-2.5 text-slate-600">
          <Folder size={15} className="text-indigo-500 shrink-0" />
          <span className="ft-item-name text-[12.5px] font-semibold truncate flex-1 text-left">Customers</span>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 leading-5 shrink-0">3</span>
          <ChevronRight size={13} className="text-slate-300 shrink-0" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        <div className="mt-1 mb-1 px-2.5 ft-eyebrow text-[9px]">Customers (3)</div>
        {people.map((c) => (
          <div key={c.name} className="mb-0.5">
            <div className="w-full rounded-md flex items-center gap-0.5 border border-transparent hover:bg-slate-50">
              <button className="flex items-center gap-1.5 min-w-0 flex-1 py-1.5 pl-1.5 pr-1 text-left">
                <ChevronRight size={13} className="text-slate-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="ft-item-name text-[13.5px] font-semibold truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-px">{c.sub}</div>
                </div>
              </button>
              <button className="shrink-0 mr-1.5 rounded border border-slate-200 p-1 text-slate-400"><MoreHorizontal size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2.5 border-t border-slate-100">
        <div className="flex mb-2">
          <ThemeSwitch theme="light" setTheme={() => {}} />
        </div>
        <div className="flex gap-2 mb-2">
          <button title="wedi shower configurator" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><ShowerHead size={15} /> wedi</button>
          <button title="Sheoga hardwood configurator" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><TreePine size={15} /> Sheoga</button>
        </div>
        <div className="flex gap-2 mb-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><LayoutGrid size={15} /> Apps</button>
          <button className="shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 text-slate-500"><LogOut size={15} /></button>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><Settings size={15} /> Settings</button>
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><ListTodo size={15} /> Issues</button>
        </div>
      </div>
    </aside>
  );
}

const mode = (location.hash || "").replace("#", "") || "sidebar";
const noop = () => {};
const root = createRoot(document.getElementById("root"));

if (mode === "sidebar") {
  root.render(<div className="ft-vh bg-slate-50 text-slate-800 flex" style={{ fontFamily: "var(--ft-ui)", height: "100vh" }}><SidebarMock /><div className="flex-1" /></div>);
} else {
  // The REAL AppsWorkspace opened with initialApp — proves the shortcut lands
  // on the configurator, not the Label Generator default.
  root.render(
    <AppsWorkspace
      onClose={noop}
      initialApp={mode}
      stock={[]}
      labels={[]}
      presets={[]}
      onAddLabel={noop} onAddLabelsBulk={noop} onUpdateLabel={noop} onDeleteLabel={noop} onSavePreset={noop}
      sheoga={{ markupDefault: 40, ventMarkupDefault: 50, currentName: null, addToCurrent: noop, addToNew: noop }}
      wedi={{ builderPct: 82, currentName: null, addToCurrent: noop, addToNew: noop }}
    />
  );
}
