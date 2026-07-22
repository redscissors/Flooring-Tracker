// Preview proof (2026-07-22 four fixes): renders the REAL EstimatePaper with a
// sample job so the grout-puck joint move can be seen, plus the live output of
// normOrderItem's description cleaning. Built by proof-vite.config.mjs, never
// shipped with the app.
import { createRoot } from "react-dom/client";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { normalizeSettings, withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { printMatList, printProduct } from "../../src/print.js";
import { normC, newProject, newArea, newProduct } from "../../src/model.js";
import { normOrderItem } from "../../src/orderbook.js";
import "../../src/index.css";

const settings = normalizeSettings({
  grouts: { "PermaColor Select": { coverage: 110, unit: "bags", price: 34.5, sku: "05123" } },
  mortars: { "254 Platinum": { small: 90, medium: 70, large: 50, unit: "bags", price: 42.0, sku: "05077" } },
});

const tile = {
  ...newProduct(),
  sku: "12480", brandColor: "Earth Ash Gray Matte", L: "12", W: "24", thickness: "0.375",
  priceSqft: "4.85", qty: "180", cartonSf: "15.5",
  grout: { checked: true, product: "PermaColor Select", color: "Silverado", sku: "05153", joint: 0.125, manual: "", caulk: "2", caulkSku: "05161", caulkPrice: "11.40" },
  mortar: { checked: true, product: "254 Platinum", manual: "" },
};
const wood = {
  ...newProduct(),
  type: "hardwood", sku: "29513", brandColor: "Sheoga Red Oak Natural 4\"", sizeText: "4\"",
  priceSqft: "8.90", qty: "320", cartonSf: "21.5",
  grout: { ...newProduct().grout }, mortar: { ...newProduct().mortar },
};

const proj = normC({
  ...newProject("c1", "Whole-house selections"),
  categories: [
    { ...newArea(), name: "Master Bath", products: [tile] },
    { ...newArea(), name: "Living Room", products: [wood] },
  ],
});
proj._full = true;

const wSet = withProjWaste(settings, proj);
const tv = tierView(proj, wSet);
const tSet = tv.settings;
const pMats = printMatList(tv.proj, tSet);
const materialsCost = pMats.reduce((t, m) => t + m.cost, 0);
const flooringPrice = tv.proj.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + printProduct(p, tSet).line, 0), 0);
const totalSqft = 500, orderedSqft = tv.proj.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + printProduct(p, tSet).orderedSf, 0), 0);

createRoot(document.getElementById("paper")).render(
  <EstimatePaper sel={proj} people={[{ id: "c1", name: "Jane Householder", address: "123 Main St, Millersburg OH" }]}
    profile={{ name: "Marcus", phone: "", email: "" }} tv={tv} jobWaste={wSet.waste} pMats={pMats} tSet={tSet}
    materialsCost={materialsCost} flooringPrice={flooringPrice} miscCost={0}
    totalSqft={totalSqft} orderedSqft={orderedSqft} grandTotal={flooringPrice + materialsCost} />
);

const SAMPLES = [
  "BRIGHT WHITE 4X4 NOMINAL WALL TILE",
  "Silverado Sanded Grout NEW PACKAGE 25LB",
  "Snow White (Nominal)",
  "New Packaging Hex Mosaic Sheet",
  "Phenominally Blue", // guard: never inside a word
];
document.getElementById("desc").innerHTML = SAMPLES.map((s) => {
  const out = normOrderItem({ sku: "X", description: s }).description;
  return `<tr><td>${s}</td><td>${out}</td></tr>`;
}).join("");
