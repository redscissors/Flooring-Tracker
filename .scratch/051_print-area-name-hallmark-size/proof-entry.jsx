// Preview proof (2026-07-25): renders the REAL EstimatePaper so the area-name
// heading and the dropped area count can be seen, with one product row carried
// end to end through the LIVE Hallmark import so its plank size on the paper is
// the size the OVF sheet states. Built by proof-vite.config.mjs, never shipped.
import { createRoot } from "react-dom/client";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { normalizeSettings, withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { printMatList, printProduct } from "../../src/print.js";
import { normC, newProject, newArea, newProduct } from "../../src/model.js";
import { parseHallmark, findHallmarkSheet } from "../../src/ovfbook.js";
import { parseMapped } from "../../src/pricebook.js";
import { orderPatch } from "../../src/orderbook.js";
import { HALLMARK_SHEETS } from "../025_ovf-vendor-books/data.js";
import "../../src/index.css";

// The real OVF Hallmark sheet, through the real import path.
const parsed = parseHallmark(findHallmarkSheet(HALLMARK_SHEETS).rows);
const book = { id: "hallmark", data: { markups: { default: 35 } } };
const items = parseMapped(parsed.rows, parsed.mapping).items;
const hallmarkRow = (sku, qty) => ({
  ...newProduct(),
  ...orderPatch(items.find((i) => i.sku === sku), book),
  qty: String(qty),
});

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

const proj = normC({
  ...newProject("c1", "Whole-house selections"),
  categories: [
    { ...newArea(), name: "Master Bath", products: [tile] },
    { ...newArea(), name: "Living Room", products: [hallmarkRow("AV75OBALC", 420)] },
    { ...newArea(), name: "", products: [hallmarkRow("SOR34MORH", 160)] },
  ],
});
proj._full = true;

const wSet = withProjWaste(settings, proj);
const tv = tierView(proj, wSet);
const tSet = tv.settings;
const pMats = printMatList(tv.proj, tSet);
const materialsCost = pMats.reduce((t, m) => t + m.cost, 0);
const flooringPrice = tv.proj.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + printProduct(p, tSet).line, 0), 0);
const orderedSqft = tv.proj.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + printProduct(p, tSet).orderedSf, 0), 0);

createRoot(document.getElementById("paper")).render(
  <EstimatePaper sel={proj} people={[{ id: "c1", name: "Jane Householder", address: "123 Main St, Millersburg OH" }]}
    profile={{ name: "Marcus", phone: "", email: "" }} tv={tv} jobWaste={wSet.waste} pMats={pMats} tSet={tSet}
    materialsCost={materialsCost} flooringPrice={flooringPrice} miscCost={0}
    totalSqft={760} orderedSqft={orderedSqft} grandTotal={flooringPrice + materialsCost} />
);

// Every collection's size, straight off the sheet, beside the prose it came from.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const byCollection = new Map();
for (const r of parsed.rows.slice(1)) {
  if (r[9] === "trim" || byCollection.has(r[2])) continue;
  byCollection.set(r[2], r[4]);
}
// One walk of the sheet: the first size-shaped prose line under each banner —
// scoped to that banner, so a collection stating no size shows none rather than
// borrowing the next collection's.
const prose = new Map();
let current = "";
for (const row of findHallmarkSheet(HALLMARK_SHEETS).rows) {
  const c0 = row?.[0] == null ? "" : String(row[0]).trim();
  if (!c0 || row.slice(1).some((c) => c != null && String(c).trim())) continue;
  if (byCollection.has(c0)) { current = c0; continue; }
  if (current && !prose.has(current) && /["'”’]/.test(c0) && /[x×]/i.test(c0)) prose.set(current, c0);
}
document.getElementById("sizes").innerHTML = [...byCollection].map(([coll, size]) =>
  `<tr><td>${esc(coll)}</td><td>${esc(prose.get(coll) || "— no size stated —")}</td>` +
  `<td>${size ? `<b>${esc(size)}</b>` : '<i class="was">none — the sheet states no size</i>'}</td></tr>`
).join("");
