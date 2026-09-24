// Dev-only harness (rail-preview.html): the REAL rail drawers, railnav
// reducer, pane header, AppsWorkspace and SettingsWorkspace over mock state,
// no Supabase — preview proof for the 2026-09-24 rail drawers. The rail
// column around them mirrors App.jsx's markup. Not part of the app build.
import { lazy, Suspense, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Settings, LayoutGrid, LogOut, Search, Zap, Folder, Plus, ShowerHead, TreePine, ClipboardList } from "lucide-react";
import "./index.css";
import NedLogo from "./NedLogo.jsx";
import { railReducer, initialRail } from "./railnav.js";
import { RailSlide, DrawerList, APP_ITEMS, SETTINGS_ITEMS, PaneHeader } from "./raildrawer.jsx";
import { AppsWorkspace } from "./AppsWorkspace.jsx";
import { normalizeSettings } from "./catalog.js";
import { TYPES, TLBL } from "./uiconst.js";

const SettingsWorkspace = lazy(() => import("./SettingsWorkspace.jsx"));
const RAIL_W = 205;
const noop = () => {};
const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const railItem = "w-full flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold text-slate-600 hover:bg-slate-50";
const PEOPLE = [{ id: "p1", name: "Hendricks" }, { id: "p2", name: "Okafor" }, { id: "p3", name: "Ruiz Builders" }, { id: "p4", name: "Patel" }];

function Harness() {
  const [nav, dispatch] = useReducer(railReducer, initialRail);
  const [person, setPerson] = useState("p1");
  const progress = useRef(() => false);
  const [settings, setSettingsState] = useState(() => normalizeSettings({}));
  const pick = (kind, id) => dispatch({ type: "pick", kind, id, inProgress: kind === "app" ? progress.current(id) : false });
  const cur = PEOPLE.find((p) => p.id === person);
  const bag = { currentName: cur.name, addToCurrent: (l) => { console.log("current", l); dispatch({ type: "closePane" }); }, addToNew: (l) => { console.log("new", l); dispatch({ type: "closePane" }); } };
  return (
    <div className="ft-vh bg-slate-50 text-slate-800 flex" style={{ fontFamily: "var(--ft-ui)", height: "100vh" }}>
      <aside style={{ width: RAIL_W }} className="ft-rail border-r border-slate-200 flex flex-col shrink-0">
        <div className="relative px-4 py-3.5 border-b border-slate-100">
          <NedLogo height={27} /><div className="ft-eyebrow text-[9.5px] mt-1">Selection Manager</div>
          <div className="absolute top-3 right-3 flex items-center">
            <button data-gear onClick={() => dispatch({ type: "toggleDrawer", which: "settings" })} aria-label="Settings" aria-expanded={nav.drawer === "settings"}
              className={`p-1 rounded-md ${nav.drawer === "settings" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}>
              <Settings size={16} className={`transition-transform duration-500 ${nav.drawer === "settings" ? "rotate-[60deg]" : ""}`} />
            </button>
          </div>
        </div>
        <RailSlide open={nav.drawer === "settings"} anchor="bottom">
          <DrawerList title="Settings" items={SETTINGS_ITEMS} activeId={nav.pane?.kind === "settings" ? nav.pane.id : null}
            onPick={(id) => pick("settings", id)} itemClass={railItem} className="px-2.5 pt-2.5 pb-2.5" divider />
        </RailSlide>
        <div className="p-2.5 pb-8 space-y-2">
          <div className="relative"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input placeholder="Search" className={inp + " pl-8"} /></div>
          <button className="ft-spark-btn w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2"><Zap size={16} className="-ml-1" /> Quick Price</button>
          <div>
            <button className={railItem}><Folder size={15} fill="currentColor" className="w-4 shrink-0 text-indigo-500" /> Customers</button>
            <button className={railItem}><Plus size={15} className="w-4 shrink-0" /> New Customer</button>
            <button onClick={() => pick("app", "wedi")} className={railItem}><ShowerHead size={15} className="w-4 shrink-0" /> wedi</button>
            <button onClick={() => pick("app", "sheoga")} className={railItem}><TreePine size={15} className="w-4 shrink-0" /> Sheoga</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          <div className="mt-1 mb-1 px-3.5 ft-eyebrow text-[9px]">Recent</div>
          {PEOPLE.map((p) => (
            <button key={p.id} data-person={p.id} onClick={() => { if (p.id !== person) { setPerson(p.id); dispatch({ type: "projectChanged" }); } else dispatch({ type: "closePane" }); }}
              className="w-full text-left rounded-md py-2 pl-[13px] text-[12.5px] font-semibold hover:bg-slate-100">{p.name}</button>
          ))}
        </div>
        <RailSlide open={nav.drawer === "apps"} anchor="top">
          <DrawerList title="Apps" items={APP_ITEMS} activeId={nav.pane?.kind === "app" ? nav.pane.id : null}
            onPick={(id) => pick("app", id)} itemClass={railItem} className="px-2.5 pt-1 pb-1.5" />
        </RailSlide>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
          <button className="flex items-center justify-center rounded-md hover:bg-slate-50 p-1.5 text-slate-500"><LogOut size={16} /></button>
          <button data-apps onClick={() => dispatch({ type: "toggleDrawer", which: "apps" })} aria-label="Apps" aria-expanded={nav.drawer === "apps"}
            className={`flex items-center justify-center rounded-md p-1.5 ${nav.drawer === "apps" ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-500"}`}><LayoutGrid size={16} /></button>
          <button className="flex items-center justify-center rounded-md hover:bg-slate-50 p-1.5 text-slate-500"><ClipboardList size={16} /></button>
        </div>
      </aside>
      <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
        <main className="flex-1 overflow-y-auto p-5" style={{ visibility: nav.pane ? "hidden" : undefined }}>
          <div className="bg-white rounded-lg border border-slate-200 p-4"><div className="ft-eyebrow-accent text-[10px]">Customer</div><div className="ft-serif text-3xl">{cur.name}</div></div>
        </main>
        <div className={nav.pane ? "absolute inset-0 z-20 flex flex-col bg-white" : "hidden"}>
          {nav.pane && <PaneHeader backLabel={cur.name} group={nav.pane.kind === "app" ? "Apps" : "Settings"}
            title={(nav.pane.kind === "app" ? APP_ITEMS : SETTINGS_ITEMS).find((x) => x.id === nav.pane.id).label}
            onBack={() => dispatch({ type: "closePane" })} onClose={() => dispatch({ type: "closePane" })} />}
          {nav.pane?.kind === "settings" && (
            <div className="flex-1 min-h-0">
              <Suspense fallback={null}>
                <SettingsWorkspace key={nav.pane.id} section={nav.pane.id} settings={settings} setSettings={(p) => setSettingsState((s) => ({ ...s, ...p }))}
                  gFamilies={[]} ping={noop} exportBackup={noop} importBackup={noop} fileRef={{ current: null }}
                  inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} theme="system" setTheme={noop} headerLayout="bar" setHeaderLayout={noop}
                  profile={{ name: "Dana Whitaker", phone: "(614) 555-0142", email: "dana@example.com" }} saveProfile={noop} user={{ email: "dana@example.com" }}
                  books={[]} addBook={noop} updateBook={noop} confirmBook={noop} delBook={noop} loadBookItems={async () => []} applyBookImport={noop}
                  bookStock={{}} orderBookStock={{}} loadFamilyBook={noop} bookStockReady refreshBookStock={noop}
                  loadBookVersions={async () => []} loadBookVersionSnapshot={async () => null} pinBookVersion={noop} updateBookItem={noop}
                  setBookItemsDisabled={noop} reviewBookItemFlags={noop} setBookItemIssue={noop} addClaudeIssue={noop} />
              </Suspense>
            </div>
          )}
          {nav.lastApp && (
            <div className={nav.pane?.kind === "app" ? "flex-1 min-h-0 flex flex-col" : "hidden"}>
              <AppsWorkspace app={nav.lastApp} visible={nav.pane?.kind === "app"} onClose={() => dispatch({ type: "closePane" })}
                resume={nav.pane?.kind === "app" && !!nav.pane.resume} onResume={() => dispatch({ type: "resolveResume" })} progressRef={progress}
                stock={[]} labels={[]} presets={[]} onAddLabel={noop} onAddLabelsBulk={noop} onUpdateLabel={noop} onDeleteLabel={noop} onSavePreset={noop}
                sheoga={{ markupDefault: 40, ventMarkupDefault: 50, ...bag }}
                wedi={{ builderPct: 0, schluterBuilderPct: 0, stockRows: [], bookStockReady: true, books: [], loadBookItems: async () => [], mortars: [], mortarDefault: "", ...bag }}
                schluter={{ builderPct: 0, wediBuilderPct: 0, stockRows: [], bookStockReady: true, books: [], loadBookItems: async () => [], mortars: [], mortarDefault: "", ...bag }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
