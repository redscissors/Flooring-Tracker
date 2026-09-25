import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { stampKit } from "./model.js";
import { PaneBack, PaneClose } from "./raildrawer.jsx";
import SheogaConfigurator from "./SheogaConfigurator.jsx";
import { LabelMaker } from "./LabelMaker.jsx";

// Lazy so the wedi tables stay in their own chunk (ADR 0026) — opening the hub
// for labels must not pay for ~2 000 catalog rows.
const WediConfigurator = lazy(() => import("./WediConfigurator.jsx"));
const SchluterConfigurator = lazy(() => import("./SchluterConfigurator.jsx"));

const CONFIG_NAME = { sheoga: "Sheoga", wedi: "wedi", schluter: "Schluter" };

export function AppsWorkspace({ app, visible = true, onClose, resume = false, onResume, progressRef, stock, bookStockReady, labels, labelGrouts, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onUpdateLabelsBulk, onDeleteLabel, onDeleteLabels, onSavePreset, sheoga, wedi, schluter }) {
  // Configurators (Apps hub): builds stage locally — nothing touches a real
  // project until the salesperson picks a destination. A commit request parks
  // its lines in `pending` (with the configurator's own commit handlers as
  // `dest`, so Sheoga and wedi share one prompt) and raises the destination
  // prompt when an order is open (accidental wrong-order guard); with nothing
  // open there's no ambiguity, so it goes straight to a new quick price.
  // pendingRef lets onClose ignore the popup's own auto-close
  // (SheogaConfigurator closes itself after a bundle move) so a pending choice
  // never unmounts the configurator and loses the build.
  const [sheogaBasket, setSheogaBasket] = useState([]);
  const [wediBasket, setWediBasket] = useState([]);
  const [schluterBasket, setSchluterBasket] = useState([]);
  const [pending, setPendingState] = useState(null);
  const pendingRef = useRef(null);
  const setPending = (v) => { pendingRef.current = v; setPendingState(v); };
  // Keyed by a STABLE string, never the `dest` bag — App.jsx rebuilds those
  // literals every render, so an identity test misses after a re-render and a
  // moved entry stays staged.
  const setBasketFor = { sheoga: setSheogaBasket, wedi: setWediBasket, schluter: setSchluterBasket };
  // In progress = staged basket entries, or any option changed since the
  // configurator mounted (spec 2026-09-24). The first report is its opening
  // state; StrictMode's repeat of it compares equal.
  const firstCfg = useRef({});
  const lastCfg = useRef({});
  const [touched, setTouched] = useState({});
  const cfgSeen = (k) => (cfg) => {
    const j = JSON.stringify(cfg);
    lastCfg.current[k] = j;
    if (firstCfg.current[k] === undefined) firstCfg.current[k] = j;
    else if (j !== firstCfg.current[k]) setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  };
  const basketOf = { sheoga: sheogaBasket, wedi: wediBasket, schluter: schluterBasket };
  const inProgress = (k) => !!touched[k] || (basketOf[k]?.length || 0) > 0;
  useEffect(() => { if (progressRef) progressRef.current = inProgress; });
  // Configurators stay mounted once opened so a build survives a trip away;
  // Start new remounts just that one by bumping its generation key.
  const [visited, setVisited] = useState(() => new Set([app]));
  const mounted = visited.has(app) ? visited : new Set(visited).add(app);
  useEffect(() => { if (mounted !== visited) setVisited(mounted); });
  const [gen, setGen] = useState({});
  const startNew = (k) => {
    setBasketFor[k]([]);
    firstCfg.current[k] = undefined;
    lastCfg.current[k] = undefined;
    setTouched((t) => ({ ...t, [k]: false }));
    setGen((g) => ({ ...g, [k]: (g[k] || 0) + 1 }));
    onResume?.();
  };
  const shown = (k) => app === k && !resume;
  const slot = (k) => (shown(k) ? "flex-1 min-h-0 flex flex-col" : "hidden");
  const requestCommit = (destKey, dest, lines, nextBasket) => {
    if (!lines || !lines.length) return;
    if (dest?.currentName) setPending({ destKey, dest, lines, nextBasket });
    else commitTo("new", { destKey, dest, lines, nextBasket });
  };
  const commitTo = (where, p) => {
    if (where === "current") p.dest.addToCurrent(p.lines); else p.dest.addToNew(p.lines);
    firstCfg.current[p.destKey] = lastCfg.current[p.destKey];
    setTouched((t) => (t[p.destKey] ? { ...t, [p.destKey]: false } : t));
    // Only a MOVE hands over a next basket (`[]` when it emptied it). A plain
    // Add passes nothing and must leave every staged entry standing.
    if (p.nextBasket && setBasketFor[p.destKey]) setBasketFor[p.destKey](p.nextBasket);
    setPending(null);
  };
  return (
    <div className="print:hidden relative h-full flex flex-col min-w-0 bg-white">
      <div className="flex-1 min-h-0 flex flex-col">
          {resume && CONFIG_NAME[app] && (
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
              <div className="flex items-center">
                <PaneBack onClick={onClose} />
                <PaneClose onClick={onClose} className="ml-auto" />
              </div>
              <div data-resume-prompt className="max-w-md mx-auto mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_16px_36px_-20px_var(--ft-shadow)]">
                <h3 className="ft-serif text-xl">Pick up your {CONFIG_NAME[app]} build?</h3>
                <p className="text-sm text-slate-500 mt-1">You left one in progress when you clicked away.</p>
                <div className="mt-3 rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--ft-brand-soft)" }}>
                  {basketOf[app]?.length
                    ? `${basketOf[app].length} build${basketOf[app].length === 1 ? "" : "s"} staged`
                    : "Options changed, nothing staged yet"}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => onResume?.()} className="text-sm font-semibold rounded-md bg-indigo-600 text-white px-3.5 py-1.5">Continue build</button>
                  <button onClick={() => startNew(app)} className="text-sm font-semibold rounded-md border border-slate-200 px-3.5 py-1.5 hover:bg-slate-50">Start new</button>
                </div>
              </div>
            </div>
          )}
          {app === "labels" && (
            <LabelMaker stock={stock} bookStockReady={bookStockReady} labels={labels} grouts={labelGrouts} presets={presets}
              onAddLabel={onAddLabel} onAddLabelsBulk={onAddLabelsBulk} onUpdateLabel={onUpdateLabel} onUpdateLabelsBulk={onUpdateLabelsBulk}
              onDeleteLabel={onDeleteLabel} onDeleteLabels={onDeleteLabels} onSavePreset={onSavePreset} />
          )}
          {mounted.has("sheoga") && sheoga && (
            <div key={`sheoga-${gen.sheoga || 0}`} className={slot("sheoga")}>
              <SheogaConfigurator
                embedded
                markupDefault={sheoga.markupDefault}
                ventMarkupDefault={sheoga.ventMarkupDefault}
                basket={sheogaBasket}
                onBasketChange={setSheogaBasket}
                areaName={sheoga.currentName || "a new quick price"}
                onAdd={(lines) => requestCommit("sheoga", sheoga, lines, null)}
                onMove={(lines) => requestCommit("sheoga", sheoga, lines, null)}
                onMoveEntries={(lines, nextBasket) => requestCommit("sheoga", sheoga, lines, nextBasket)}
                onConfigChange={cfgSeen("sheoga")}
                escActive={visible && shown("sheoga")}
                onClose={() => { if (!pendingRef.current) onClose?.(); }}
              />
            </div>
          )}
          {mounted.has("wedi") && wedi && (
            <div key={`wedi-${gen.wedi || 0}`} className={slot("wedi")}>
              <Suspense fallback={null}>
                <WediConfigurator
                  embedded
                  wediBuilderPct={wedi.builderPct}
                  schluterBuilderPct={wedi.schluterBuilderPct}
                  areaName={wedi.currentName || "a new quick price"}
                  projectName={wedi.currentName || ""}
                  stockRows={wedi.stockRows} bookStockReady={wedi.bookStockReady}
                  books={wedi.books} loadBookItems={wedi.loadBookItems}
                  mortars={wedi.mortars} mortarDefault={wedi.mortarDefault}
                  basket={wediBasket}
                  onBasketChange={setWediBasket}
                  onMoveEntries={(groups, nextBasket) => requestCommit("wedi", wedi, groups.flatMap((g) => stampKit(g.lines)), nextBasket)}
                  onAdd={(lines) => requestCommit("wedi", wedi, lines, null)}
                  onConfigChange={cfgSeen("wedi")}
                  escActive={visible && shown("wedi")}
                  onClose={() => { if (!pendingRef.current) onClose?.(); }}
                />
              </Suspense>
            </div>
          )}
          {mounted.has("schluter") && schluter && (
            <div key={`schluter-${gen.schluter || 0}`} className={slot("schluter")}>
              <Suspense fallback={null}>
                <SchluterConfigurator
                  embedded
                  schluterBuilderPct={schluter.builderPct}
                  wediBuilderPct={schluter.wediBuilderPct}
                  areaName={schluter.currentName || "a new quick price"}
                  projectName={schluter.currentName || ""}
                  stockRows={schluter.stockRows} bookStockReady={schluter.bookStockReady}
                  books={schluter.books} loadBookItems={schluter.loadBookItems}
                  mortars={schluter.mortars} mortarDefault={schluter.mortarDefault}
                  basket={schluterBasket}
                  onBasketChange={setSchluterBasket}
                  onMoveEntries={(groups, nextBasket) => requestCommit("schluter", schluter, groups.flatMap((g) => stampKit(g.lines)), nextBasket)}
                  onAdd={(lines) => requestCommit("schluter", schluter, lines, null)}
                  onConfigChange={cfgSeen("schluter")}
                  escActive={visible && shown("schluter")}
                  onClose={() => { if (!pendingRef.current) onClose?.(); }}
                />
              </Suspense>
            </div>
          )}
      </div>
      {pending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(20,15,10,.5)" }} onClick={(e) => { e.stopPropagation(); setPending(null); }}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="ft-serif text-xl mb-1">Add to which project?</h3>
            <p className="text-sm text-slate-500 mb-4">{pending.lines.length} product line{pending.lines.length > 1 ? "s" : ""} ready to place.</p>
            <div className="space-y-2">
              <button onClick={() => commitTo("current", pending)} className="w-full text-left rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 px-3.5 py-2.5">
                <div className="text-sm font-semibold text-slate-800">Current project</div>
                <div className="text-xs text-slate-500 truncate">{pending.dest.currentName}</div>
              </button>
              <button onClick={() => commitTo("new", pending)} className="w-full text-left rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 px-3.5 py-2.5">
                <div className="text-sm font-semibold text-slate-800">New quick price</div>
                <div className="text-xs text-slate-500">Start a fresh unnamed order</div>
              </button>
            </div>
            <button onClick={() => setPending(null)} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
