// Harness (issue 165): the REAL EstimatePaper over the 090 fixture job plus one
// wedi shower and one Schluter shower, each built by the real engine off
// registry-shaped stock rows — so the sheet shows whatever the engines land
// today. `?names=stock` swaps every configurator line's name/size for what a
// stock-book search pick of the SAME sku lands (stockPatch); that variant was
// the owner's 2026-10-01 question, kept for the record. No Supabase.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { newProduct, newArea } from "../../src/model.js";
import { normBookItem, normOrderItem } from "../../src/orderbook.js";
import { stockPatch } from "../../src/stock.js";
import { FIXTURE_ROWS } from "../../src/wedifixture.js";
import { adaptBookRows } from "../../src/wediadapter.js";
import { setStockSource, kitFor, lineItems } from "../../src/wedi.js";
import { adaptBookRows as sAdapt } from "../../src/schluteradapter.js";
import { catalogOf, buildKit, lineItems as sLineItems } from "../../src/schluter.js";
import { makeJob, settings, PROFILE, PEOPLE } from "../090_print-fit-one-page/fixture.js";

const STOCK = new URLSearchParams(location.search).get("names") === "stock";
const pick = (it) => stockPatch({ ...it, stockKind: true }, {});

// wedi: the 2026-09-01 stock export through the live adapter, 36×60 kit
const wediLive = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const wediBySku = new Map(wediLive.map((it) => [String(it.sku), it]));
setStockSource(adaptBookRows(wediLive));
const wediRows = lineItems(kitFor("US9100004")).map((r) => ({ ...newProduct(), ...r, sellUnit: "EA" }));

// Schluter: stock-export shaped rows (the shapes schluteradapter.test.js pins)
const srows = [
  { sku: "1509821", description: "KERDI-SHOWER-T TRAY 38 X 60 PVC", vendorSkus: ["KST965/1525"], unit: "EA", price: 121.91, cost: 81.27 },
  { sku: "1509783", description: "KERDI MEMBRANE ROLL", vendorSkus: ["KERDI200/10M"], size: "3'3\"×33' = 108 sf", unit: "RL", price: 207.65, cost: 138.43 },
  { sku: "1509790", description: "90 Kerdi Kereck F Inside - KERECK/FI10 10/pk", vendorSkus: ["KERECK/FI10"], unit: "PK", cost: 48.61, price: 72.92 },
  { sku: "1509800", description: "Kerdi Drain Flange Kit - KD3FLKE Stainless", vendorSkus: ["KD3FLKE"], unit: "EA", price: 95.2, cost: 63.5 },
  { sku: "1509810", description: "Kerdi Board SC Curb - KBSC115150152 60x6x4-1/2", vendorSkus: ["KBSC1151501524"], size: '60"x6"x4-1/2"', unit: "EA", price: 88.1, cost: 58.7 },
  { sku: "1509830", description: "Kerdi Band - KEBA100/125 5in x 33ft", vendorSkus: ["KEBA100/125/10M"], unit: "RL", price: 44.2, cost: 29.5 },
].map((r) => normOrderItem({ bookId: "bk_stock", ...r }));
const sBySku = new Map(srows.map((it) => [String(it.sku), it]));
const cfg = { w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane", walls: [{ on: true, len: 60, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }] };
const sBuild = buildKit(cfg, catalogOf(sAdapt(srows, { stock: true })), { source: "all" });
const schRows = sLineItems({ ...sBuild, mode: "kit", cfg }).map((r) => ({ ...newProduct(), ...r, sellUnit: "EA" }));

const asStock = (rows, bySku) => rows.map((r) => {
  const it = bySku.get(String(r.sku));
  if (!it) return r;
  const sp = pick(it);
  return { ...r, brandColor: sp.brandColor, sizeText: sp.sizeText || "" };
});

function Paper() {
  const sel = makeJob();
  sel.name = STOCK ? "Shower lines — stock-book descriptions" : "Shower lines — size · name · SKU";
  sel.categories = sel.categories.slice(0, 2);
  sel.categories.push({ ...newArea(), name: "Master shower — wedi", option: "", products: STOCK ? asStock(wediRows, wediBySku) : wediRows });
  sel.categories.push({ ...newArea(), name: "Hall shower — Schluter", option: "", products: STOCK ? asStock(schRows, sBySku) : schRows });
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
  const skus = new Set([...wediBySku.keys(), ...sBySku.keys()]);
  const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null, stockBookIds: new Set(["bk_wedi", "bk_stock"]), stockSkus: skus };
  return (
    <EstimatePaper sel={sel} people={PEOPLE} profile={PROFILE} tv={tv}
      jobWaste={wSet.waste} tSet={tSet} {...paperProps} printSheet />
  );
}

createRoot(document.getElementById("preview")).render(
  <div className="ft-light bg-white text-black p-2" data-shot="paper"><Paper /></div>
);
