// Dev-only harness (sheoga-preview.html): the REAL SheogaConfigurator over
// local mock state, no Supabase — preview proof for the ADR 0035 step 2
// drawer (staged basket + derived "In this project" kits). Landing, delete
// and reconfigure run the REAL model.js paths over local state, so the shots
// exercise production behavior end to end. Not part of the app build.
// `?tab=trim` opens on Trim & accessories (Match floor on, a few pieces typed)
// priced off the real accessory-sheet fixture; `&nosheet=1` leaves the sheet
// out for the empty state, `&nobook=1` the whole Sheoga book. The area's rows
// ride `window.__cats` and the last onConfigChange report `window.__live`.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SheogaConfigurator from "./SheogaConfigurator.jsx";
import { AppsWorkspace } from "./AppsWorkspace.jsx";
import { newProduct, newArea, stampKit, landKitLines, removeKitLines, placedKits, uid } from "./model.js";
import { lineItems, multiWidthLineItems, defaultConfig, normBasketEntry } from "./sheoga.js";
import { readXlsxSheets } from "./fileread.js";
import { parseAccessorySheet } from "./sheogatrim.js";

const floorCfg = { ...defaultConfig("floor"), sp: "White Oak", grade: "char", cons: "solid" };
const land = (patches) => patches.map((p) => ({ ...newProduct(), ...p }));
const singleLines = stampKit(lineItems({ mode: "floor", cfg: floorCfg }, { sf: 320, markupPct: 40 }));
const bundleLines = stampKit(multiWidthLineItems({ mode: "floor", cfg: { ...floorCfg, sp: "Hickory" } }, [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }], 240, 40));
const area0 = { ...newArea(), name: "Great room", products: [...land(singleLines), ...land(bundleLines), newProduct()] };
const staged = [normBasketEntry({ id: uid(), kind: "single", addedAt: Date.now(), markupPct: 40, snap: { mode: "floor", cfg: { ...floorCfg, sp: "Maple" } }, sf: 150 })].filter(Boolean);

// `?hub=1` renders the REAL AppsWorkspace on the Sheoga app.
const Q = new URLSearchParams(location.search);
const HUB = Q.get("hub") === "1";
const TRIM = Q.get("tab") === "trim";
const NO_BOOK = Q.get("nobook") === "1";
const NO_SHEET = NO_BOOK || Q.get("nosheet") === "1";
const trimSeed = TRIM ? { mode: "trim", cfg: { ...defaultConfig("trim"), runs: { nose35: [{ n: 2, len: 6 }], nose55: [{ n: 0, len: 8 }], shoe: [{ n: 15, len: 8 }, { n: 5, len: 6 }] }, reducer: 1, tmold: 2 } } : null;

function useTrimBook() {
  const [book, setBook] = useState(null);
  useEffect(() => {
    if (NO_SHEET) return;
    fetch("/src/testdata/sheoga-accessory-20261001.xlsx").then((r) => r.blob())
      .then((b) => readXlsxSheets(new File([b], "Sheoga_Accessory_Pricing_-_Distributor_-_20261001.xlsx")))
      .then((sheets) => { const { sheet } = parseAccessorySheet(sheets); if (sheet) setBook({ sheet }); });
  }, []);
  return book;
}

function Hub() {
  const trimBook = useTrimBook();
  return (
    <div style={{ height: "100vh" }}>
      <AppsWorkspace app="sheoga" onClose={() => console.log("close")} onResume={() => {}} progressRef={{ current: () => false }}
        stock={[]} labels={[]} presets={[]} onAddLabel={() => {}} onAddLabelsBulk={() => {}} onUpdateLabel={() => {}} onDeleteLabel={() => {}} onSavePreset={() => {}}
        sheoga={{ markupDefault: 40, ventMarkupDefault: 50, trimMarkupDefault: 100, trimBook, sheogaBook: !NO_BOOK, currentName: "", addToCurrent: () => {}, addToNew: (l) => console.log("add", l) }} />
    </div>
  );
}

function Harness() {
  const [cats, setCats] = useState([area0]);
  const [basket, setBasket] = useState(staged);
  const [pop, setPop] = useState({ aid: area0.id, pid: area0.products.at(-1).id, seed: trimSeed, n: 0 });
  const trimBook = useTrimBook();
  useEffect(() => { window.__cats = cats; }, [cats]);
  return (
    <SheogaConfigurator key={pop.pid + ":" + pop.n}
      seed={pop.seed} initialSf={200} markupDefault={40} ventMarkupDefault={50} trimMarkupDefault={100} trimBook={trimBook} sheogaBook={!NO_BOOK}
      basket={basket} onBasketChange={setBasket}
      areaName="Great room"
      placed={placedKits(cats, "sheoga")}
      onOpenPlaced={(k) => setPop((p) => ({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: p.n + 1 }))}
      onDeleteKit={(k) => setCats((c) => removeKitLines(c, k.areaId, k.rowId) || c)}
      onAdd={(lines) => setCats((c) => landKitLines(c, pop.aid, pop.pid, lines) || c)}
      onMove={(lines) => setCats((c) => landKitLines(c, pop.aid, pop.pid, lines) || c)}
      onMoveEntries={(lines, nextBasket) => { setCats((c) => c.map((a) => (a.id === pop.aid ? { ...a, products: [...a.products, ...land(lines)] } : a))); setBasket(nextBasket); }}
      onClose={() => console.log("close")}
      onConfigChange={(live) => { window.__live = live; }}
    />
  );
}

createRoot(document.getElementById("preview")).render(HUB ? <Hub /> : <Harness />);
