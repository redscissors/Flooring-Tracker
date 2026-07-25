// Preview proof (2026-07-25): the printed estimate's price column naming its
// unit, and RL/rolls as a real unit of measure. The two Schluter rows are
// carried through the LIVE ERP stock import so the sheet's "RL" is what reaches
// the paper. Built by proof-vite.config.mjs, never shipped with the app.
import { createRoot } from "react-dom/client";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { normalizeSettings, withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { printMatList, printProduct, orderEntryRow } from "../../src/print.js";
import { normC, newProject, newArea, newProduct, money } from "../../src/model.js";
import { parseMapped, detectVendorSkuAnalysis } from "../../src/pricebook.js";
import { stockPatch } from "../../src/stock.js";
import "../../src/index.css";

// A slice of a real ERP "Vendor SKU Analysis" export, Schluter's rolls included.
const SHEET = [{ name: "Vendor SKU Analysis", rows: [
  ["Product Code", "Full Description", "Base Price (Cost)", "Retail Price", "Unit of Stock"],
  ["23015", "Schluter Kerdi-Band 5\" x 33' Waterproofing Strip", 50.5, 84.2, "RL"],
  ["23031", "Schluter Ditra-Heat Uncoupling Membrane - 134.5sf/roll", 480.0, 720.0, "RL"],
  ["29965", "Stauf #5 Notched Trowel for Eng Flr", 9.54, 15.49, "EA"],
  ["22974", "2x2 Atlas Concorde Mosaic - Ridge Beige .969sf/sh", 12.15, 18.22, "SH"],
] }];
const items = parseMapped(SHEET[0].rows, detectVendorSkuAnalysis(SHEET)).items;
const stockRow = (sku, qty) => ({ ...newProduct(), ...stockPatch(items.find((i) => i.sku === sku), {}), qty: String(qty), qtyType: "count" });

const settings = normalizeSettings();

const tile = { ...newProduct(), sku: "1517410", brandColor: "Mannington AduraMax Preservation Fossil", L: "7", W: "60", thickness: "", type: "vinyl", priceSqft: "5.95", qty: "240", cartonSf: "23.76", cartonUnit: "CT" };
const wood = { ...newProduct(), type: "hardwood", sku: "AV75OBALC", brandColor: "Hallmark Alta Vista European White Oak Balboa", sizeText: '5/8" x 7 1/2"', priceSqft: "9.84", qty: "420" };
const mosaic = { ...newProduct(), sku: "22974", brandColor: "Atlas Concorde Mosaic Ridge Beige", L: "2", W: "2", priceSqft: "18.80", qty: "40", cartonSf: "0.969", cartonUnit: "SH" };

const ROWS = [
  ["Hardwood — plain sq-ft line", "SF", wood],
  ["Vinyl plank — carton-billed", "CT", tile],
  ["Mosaic — sheet-billed", "SH", mosaic],
  ["Schluter Kerdi-Band — roll", "RL", stockRow("23015", 3)],
  ["Schluter Ditra-Heat — roll", "RL", stockRow("23031", 2)],
  ["Stauf trowel — each", "EA", stockRow("29965", 1)],
];

const proj = normC({
  ...newProject("c1", "Whole-house selections"),
  categories: [
    { ...newArea(), name: "Master Bath", products: [tile, mosaic, stockRow("23015", 3), stockRow("23031", 2)] },
    { ...newArea(), name: "Living Room", products: [wood, stockRow("29965", 1)] },
  ],
});
proj._full = true;

const wSet = withProjWaste(settings, proj);
const tv = tierView(proj, wSet);
const tSet = tv.settings;
const pMats = printMatList(tv.proj, tSet);
const materialsCost = pMats.reduce((t, m) => t + m.cost, 0);
const flooringPrice = tv.proj.categories.reduce((t, a) => t + a.products.reduce((x, p) => x + printProduct(p, tSet).line, 0), 0);
const orderedSqft = tv.proj.categories.reduce((t, a) => t + a.products.reduce((x, p) => x + printProduct(p, tSet).orderedSf, 0), 0);

createRoot(document.getElementById("paper")).render(
  <EstimatePaper sel={proj} people={[{ id: "c1", name: "Jane Householder", address: "123 Main St, Millersburg OH" }]}
    profile={{ name: "Marcus", phone: "", email: "" }} tv={tv} jobWaste={wSet.waste} pMats={pMats} tSet={tSet}
    materialsCost={materialsCost} flooringPrice={flooringPrice} miscCost={0}
    totalSqft={660} orderedSqft={orderedSqft} grandTotal={flooringPrice + materialsCost} />
);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// What the code did BEFORE this change, reproduced from the old expressions so
// the comparison is the real prior output, not a remembered one.
const wasText = (p, c) => {
  const price = Number(p.priceSqft) > 0
    ? (p.type === "misc"
        ? money(Number(p.priceSqft)) + ((c.PC ? c.PC.pieces : Number(p.qty) || 1) !== 1 ? "/ea" : "")
        : `${money(Number(p.priceSqft))}/${p.qtyType === "count" ? "ea" : "sf"}`)
    : "";
  const qty = p.type === "misc" ? `${Number(p.qty) || 1} EA`
    : c.C ? `${c.C.order} ${c.C.unit}`
      : Number(p.qty) > 0 ? `${p.qty} ${p.qtyType === "sqft" ? "sf" : "units"}` : "";
  return `${price} · ${qty}`;
};

document.getElementById("units").innerHTML = ROWS.map(([label, um, p]) => {
  const c = printProduct(p, tSet);
  return `<tr><td>${esc(label)}</td><td><code>${um}</code></td>` +
    `<td class="was">${esc(wasText(p, c))}</td>` +
    `<td class="now">${esc(`${c.priceText} · ${c.qtyText}`)}</td></tr>`;
}).join("");

document.getElementById("order").innerHTML = ROWS.map(([label, , p]) => {
  const r = orderEntryRow(p, tSet, "Master Bath", 0, []);
  return `<tr><td>${esc(label)}</td><td><code>${esc(r.tag || "—")}</code></td>` +
    `<td class="now">${esc(r.qtyText)}</td><td>${esc(money(r.perSell))}/${esc(r.unitCode.toLowerCase())}</td></tr>`;
}).join("");
