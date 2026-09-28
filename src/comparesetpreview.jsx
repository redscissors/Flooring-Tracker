// Preview harness for the Compare set (ticket 158 Phase 4, ADR 0052): BOTH
// real configurators mounted the way App.jsx mounts them — one open at a
// time, a per-shower compare set, the cross-brand hand-off and the resume
// re-seed — over local state, no Supabase. Dev-only entry
// (compare-set-preview.html); not part of the app build.
//
// ?host=wedi|schluter — which popup opens first (on a 60″×38″ marker).
// ?kept=1 — the set starts with a Schluter KERDI-BOARD build kept for a
// 60″×36″ room with a hand-picked grate, so Your build, the room chip and
// Sync have something to show.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WediConfigurator from "./WediConfigurator.jsx";
import SchluterConfigurator from "./SchluterConfigurator.jsx";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
import { normOrderItem, bookItemData, normBookItem } from "./orderbook.js";
import { newProduct, newArea, landKitLines, appendKitLines } from "./model.js";
import { FIXTURE_ROWS as WEDI_STOCK_ROWS } from "./wedifixture.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";
import { parseMapped } from "./pricebook.js";
import { wediBuildFor, schluterBuildFor } from "./comparekit.js";
import { entryOf } from "./compareset.js";

const lead = (name) => (/^schluter/i.test(name) ? name : `Schluter ${name}`);
const stockRows = FIXTURE_ITEMS.filter((i) => i.stock).map((i) => normOrderItem({
  sku: i.erp || i.sku, bookId: "bk_stock", description: lead(i.name), vendorSkus: i.erp ? [i.sku] : [],
  size: i.size || "", unit: i.unit, price: i.price, cost: i.cost, leadTime: i.lead || "",
}));
const eftRows = FIXTURE_ITEMS.filter((i) => !i.stock).map((i) => normOrderItem({
  sku: i.sku, bookId: "bk_eft", description: lead(i.name), size: i.size || "", unit: i.unit,
  cost: i.cost, price: i.price, leadTime: i.lead || "",
}));
const wediStockRows = WEDI_STOCK_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const wediSoRows = (() => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
})();
const books = [
  { id: "bk_eft", kind: "order", active: true, name: "Schluter EFT" },
  { id: "bk_wedi", kind: "stock", active: true, name: "wedi" },
  { id: "bk_wedi_so", kind: "order", active: true, name: "wedi" },
];
const loadBookItems = async (id) => (id === "bk_wedi" ? wediStockRows : id === "bk_wedi_so" ? wediSoRows : eftRows);
const mortars = { "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 39.21 } };

const Q = new URLSearchParams(location.search);
const HOST = Q.get("host") === "schluter" ? "schluter" : "wedi";
const room = (w, d) => ({ w, d, curbed: true, drain: "point", benches: [],
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })) });
const R60 = room(60, 38);
const CAT = catalogOf(FIXTURE_ITEMS);
const hostSeed = HOST === "wedi"
  ? { mode: "custom", cfg: { ...wediBuildFor(R60, { source: "all" }).cfg, source: "all" } }
  : { mode: "custom", cfg: { ...schluterBuildFor(R60, CAT, { source: "all" }).cfg, source: "all" } };
// the kept KERDI-BOARD build: a smaller room and a hand-picked grate
const KEPT = (() => {
  if (Q.get("kept") !== "1") return {};
  const r = room(60, 36);
  const { cfg, build } = schluterBuildFor(r, CAT, { source: "all", wallSys: "board" });
  const house = build.lines.find((l) => l.item.part === "grate").item.sku;
  const grate = CAT.find((i) => i.g === "drain" && i.part === "grate" && i.sku !== house);
  return { "schluter:board": entryOf({ snap: { mode: "custom", cfg: { ...cfg, source: "all", swaps: { grate: grate.sku } } }, room: r, savedBy: "Dana", now: Date.now() - 2 * 3600000 }) };
})();

function Harness() {
  const [cats, setCats] = useState([{ ...newArea(), name: "Master bath", products: [newProduct()] }]);
  const aid = cats[0].id;
  const [sets, setSets] = useState(() => ({ [aid]: KEPT }));
  const [pop, setPop] = useState({ kind: HOST, pid: null, seed: hostSeed, n: 0, detached: false });
  const pid = pop.pid || cats[0].products.at(-1).id;
  const set = sets[aid] || {};
  const onCompareSet = (next) => setSets((s) => ({ ...s, [aid]: next }));
  // App.jsx's openCompareCell/kitPop, minus rows: the harness has one shower
  const openCell = (key, seed) => setPop((p) => ({ kind: key.split(":")[0], pid: p.pid, seed, n: p.n + 1, detached: true }));
  const onResume = (entry) => setPop((p) => ({ ...p, seed: entry.snap, n: p.n + 1 }));
  const common = {
    seed: pop.seed, wediBuilderPct: 18, schluterBuilderPct: 8,
    areaName: "Master bath", projectName: "Harper — 214 Ridgeway",
    stockRows, bookStockReady: true, books, loadBookItems, mortars, mortarDefault: "Schluter All Set",
    basket: [], onBasketChange: () => {}, placed: [], onOpenPlaced: () => {}, onDeleteKit: () => {},
    onAdd: (lines) => { setCats((c) => landKitLines(c, aid, pid, lines) || c); setPop((p) => ({ ...p, kind: null })); },
    onAddNew: (lines) => { setCats((c) => appendKitLines(c, aid, lines)); setPop((p) => ({ ...p, kind: null })); },
    onMoveEntries: () => {}, onConfigChange: () => {},
    onQuoteOptions: (p) => console.log("onQuoteOptions", p),
    onClose: () => setPop((p) => ({ ...p, kind: null })),
    compareSet: set, onCompareSet, onOpenCell: openCell, onResume, savedBy: "Dana", startDetached: pop.detached,
  };
  return (<>
    <div data-h-panel className="fixed bottom-2 left-2 z-[90] border rounded-md bg-white text-[11px] px-2 py-1.5 flex items-center gap-2" style={{ borderColor: "#c8c8c0" }}>
      <b>Harness</b>
      <span data-h-set>set: {Object.keys(set).join(", ") || "empty"}</span>
      <button data-h-close className="border rounded px-2" onClick={() => setPop((p) => ({ ...p, kind: null }))}>Close popup</button>
      <button data-h-fresh-wedi className="border rounded px-2" onClick={() => setPop((p) => ({ kind: "wedi", pid: p.pid, seed: null, n: p.n + 1, detached: false }))}>Fresh wedi</button>
      <button data-h-fresh-wedi-sized className="border rounded px-2" onClick={() => setPop((p) => ({ kind: "wedi", pid: p.pid, seed: { tab: "custom", input: { w: 48, d: 36, curb: "curbed", drain: "any" } }, n: p.n + 1, detached: false }))}>Fresh wedi 48×36</button>
      <span data-h-set-json hidden>{JSON.stringify(set)}</span>
      <button data-h-fresh-schluter className="border rounded px-2" onClick={() => setPop((p) => ({ kind: "schluter", pid: p.pid, seed: null, n: p.n + 1, detached: false }))}>Fresh Schluter</button>
    </div>
    {pop.kind === "wedi" && <WediConfigurator key={"wedi:" + pop.n} {...common} />}
    {pop.kind === "schluter" && <SchluterConfigurator key={"schluter:" + pop.n} {...common} />}
  </>);
}

createRoot(document.getElementById("preview")).render(<Harness />);
