// Dev-only harness (sheoga-preview.html): the REAL SheogaConfigurator over
// local mock state, no Supabase — preview proof for the ADR 0035 step 2
// drawer (staged basket + derived "In this project" kits). Landing, delete
// and reconfigure run the REAL model.js paths over local state, so the shots
// exercise production behavior end to end. Not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SheogaConfigurator from "./SheogaConfigurator.jsx";
import { newProduct, newArea, stampKit, landKitLines, removeKitLines, placedKits, uid } from "./model.js";
import { lineItems, multiWidthLineItems, defaultConfig, normBasketEntry } from "./sheoga.js";

const floorCfg = { ...defaultConfig("floor"), sp: "White Oak", grade: "char", cons: "solid" };
const land = (patches) => patches.map((p) => ({ ...newProduct(), ...p }));
const singleLines = stampKit(lineItems({ mode: "floor", cfg: floorCfg }, { sf: 320, markupPct: 40 }));
const bundleLines = stampKit(multiWidthLineItems({ mode: "floor", cfg: { ...floorCfg, sp: "Hickory" } }, [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }], 240, 40));
const area0 = { ...newArea(), name: "Great room", products: [...land(singleLines), ...land(bundleLines), newProduct()] };
const staged = [normBasketEntry({ id: uid(), kind: "single", addedAt: Date.now(), markupPct: 40, snap: { mode: "floor", cfg: { ...floorCfg, sp: "Maple" } }, sf: 150 })].filter(Boolean);

// `?hub=1` wraps the configurator in the Apps hub's shell (p-5 gutters + the
// 224px rail) so the embedded width the docked grid has to fit is real.
const HUB = new URLSearchParams(location.search).get("hub") === "1";

function Harness() {
  const [cats, setCats] = useState([area0]);
  const [basket, setBasket] = useState(staged);
  const [pop, setPop] = useState({ aid: area0.id, pid: area0.products.at(-1).id, seed: null });
  const pop_ = (
    <SheogaConfigurator key={pop.pid} embedded={HUB}
      seed={pop.seed} initialSf={200} markupDefault={40} ventMarkupDefault={50}
      basket={basket} onBasketChange={setBasket}
      areaName="Great room"
      placed={placedKits(cats, "sheoga")}
      onOpenPlaced={(k) => setPop({ aid: k.areaId, pid: k.rowId, seed: k.marker })}
      onDeleteKit={(k) => setCats((c) => removeKitLines(c, k.areaId, k.rowId) || c)}
      onAdd={(lines) => setCats((c) => landKitLines(c, pop.aid, pop.pid, lines) || c)}
      onMove={(lines) => setCats((c) => landKitLines(c, pop.aid, pop.pid, lines) || c)}
      onMoveEntries={(lines, nextBasket) => { setCats((c) => c.map((a) => (a.id === pop.aid ? { ...a, products: [...a.products, ...land(lines)] } : a))); setBasket(nextBasket); }}
      onClose={() => console.log("close")}
      onConfigChange={() => {}}
    />
  );
  if (!HUB) return pop_;
  return (
    <div className="fixed inset-0 p-5" style={{ background: "rgba(20,15,10,.4)" }}>
      <div className="relative bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 p-4"><h3 className="ft-serif text-2xl">Apps</h3></aside>
        <div className="flex-1 flex flex-col min-w-0">{pop_}</div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
