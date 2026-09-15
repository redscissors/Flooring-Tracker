// Preview harness for the order-entry panel: the REAL OrderEntryPanel over rows
// built through the REAL orderEntryRow — no Supabase, no App shell. Dev-only
// entry (order-entry-preview.html); not part of the app build.
//
// The 2026-09-14 fixture (merge & sort, .scratch/137) is a three-area job that
// repeats SKUs the way real orders do: two wedi showers (Master bath, Hall
// bath) built off the live catalog's stocked pan / drain cover / curb / panel /
// sealant / fastener rows, a Schluter niche in the hall, a Daltile special-
// order tile in all three rooms — the Kitchen's sell hand-edited, so that
// line is the kept-apart case — a Ragno stock tile with a quantity-less
// mosaic (the assumed-1 case), a hand-typed stocked SKU (files under Other
// items), a Sheoga stocked floor (never merges — by description), the
// estimated materials as App.jsx shapes them, and one Daltile freight line.
// Earlier batches' cases (the 8/19–8/31 job-line flags, plank sizes, sheet
// mosaics) are covered by orderentry.test.js / print.test.js and were dropped
// from this fixture so the merge shots stay readable.
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrderEntryPanel } from "./orderentry.jsx";
import { orderEntryRow } from "./print.js";
import { freightOrderRow } from "./freight.js";
import { normalizeSettings } from "./catalog.js";
import { newProduct, uid } from "./model.js";
import { lineItems } from "./sheoga.js";
import { skuKeys } from "./orderbook.js";
import { group as wediGroup } from "./wedi.js";

const s = normalizeSettings();
const DESC_LIMIT = 70;

const stockBookIds = new Set(["bkRagno"]);
const bookBrands = new Map([["bkDal", "Daltile"], ["bkRagno", "Ragno"]]);
// The mock ERP stock cache: only these SKUs are shop stock.
const stockSkus = new Set(["05153", "1517410", "1517412", "1509870"].flatMap(skuKeys));

// A stocked wedi catalog row as wedi.js lineItems lands it on the sheet.
const wediPick = (g) => wediGroup(g).filter((e) => e.stock && e.erp)[0];
const wediRow = (g, qty) => {
  const e = wediPick(g);
  return { ...newProduct(), id: uid(), type: "misc", qtyType: "count", sku: e.erp, sizeText: e.sizeText || "",
    brandColor: (/^\s*wedi/i.test(e.name) ? "" : "wedi — ") + e.name, qty: String(qty),
    priceSqft: String(e.retail), costSqft: String(e.cost), wedi: { part: e.key } };
};
const daltile = (sqft, price) => ({ ...newProduct(), id: uid(), type: "tile", bookId: "bkDal", sku: "EW03", brandColor: "Daltile Emerson Wood Brazilian Walnut",
  L: "12", W: "24", qty: String(sqft), priceSqft: price, costSqft: "2.45", cartonSf: "15.6", cartonUnit: "CT" });

const sheogaStocked = lineItems(
  { mode: "stocked", cfg: { sp: "Hickory", color: "Toasted Acorn", grade: "char", w: 3.25, sheen: "" } },
  { sf: 320 },
).map((l) => ({ ...newProduct(), ...l, id: uid() }));

const areas = [
  ["Master bath", [
    wediRow("pan", 1), wediRow("cover", 1), wediRow("sealant", 2), wediRow("panel", 6), wediRow("curb", 1), wediRow("fastener", 1),
    daltile(218, "3.92"),
    ...sheogaStocked,
  ]],
  ["Hall bath", [
    wediRow("pan", 1), wediRow("cover", 1), wediRow("panel", 4), wediRow("curb", 1), wediRow("sealant", 1),
    { ...newProduct(), id: uid(), type: "misc", qtyType: "count", sku: "1509870", brandColor: "Schluter KERDI-BOARD-SN Niche 12\"x28\"", qty: "1", priceSqft: "89", costSqft: "59.33", schluter: { part: "KB12SN305711" } },
    daltile(140, "3.92"),
  ]],
  ["Kitchen", [
    // the same tile with a hand-edited sell — kept apart, not merged
    daltile(93, "3.72"),
    { ...newProduct(), id: uid(), type: "tile", bookId: "bkRagno", sku: "1517410", brandColor: "Ragno Bianco Subway Matte", L: "3", W: "12", qty: "140", priceSqft: "4.79", costSqft: "3.1", cartonSf: "10.76", cartonUnit: "CT" },
    // no square footage yet → keyed as 1 carton, amber
    { ...newProduct(), id: uid(), type: "tile", bookId: "bkRagno", sku: "1517412", brandColor: "Ragno Bianco Hex Mosaic Matte", L: "12", W: "12", qty: "", priceSqft: "9.4", costSqft: "6.1", cartonSf: "10", cartonUnit: "CT" },
    // hand-typed stocked SKU — no book, no brand
    { ...newProduct(), id: uid(), type: "tile", sku: "05153", brandColor: "Hanoi White Matte", L: "12", W: "24", qty: "140", priceSqft: "4.79", cartonSf: "15.5", cartonUnit: "CT" },
  ]],
];

const built = areas.flatMap(([area, rows]) => rows.map((p) => orderEntryRow(p, s, area, DESC_LIMIT, stockBookIds, bookBrands, stockSkus)));

// The estimated materials, shaped as App.jsx shapes matAll for the panel.
const mats = [
  { id: "mat0", sku: "1509901", qty: 4, qtyAssumed: false, unitCode: "EA", qtyText: "4 bags", name: "Mapei Ultraflex 2 Gray 50lb", kind: "Mortar", area: "" },
  { id: "mat1", sku: "1509955", qty: 2, qtyAssumed: false, unitCode: "EA", qtyText: "2 bags", name: "Mapei Keracolor U Warm Gray 10lb", kind: "Grout", area: "" },
  { id: "mat2", sku: "1509960", qty: 1, qtyAssumed: false, unitCode: "EA", qtyText: "1 tube", name: "Mapei Keracaulk U Warm Gray", kind: "Caulk", area: "" },
];
const freight = [freightOrderRow({ bookId: "bkDal", book: "Daltile", cost: 185 }, DESC_LIMIT)];

createRoot(document.getElementById("preview")).render(
  <OrderEntryPanel
    name="Hendricks Residence — N142"
    custInfo={{ custName: "Pat Hendricks", address: "224 Hammersley Dr, PO Box 288, Tuscarawas, OH 44682", phone: "330-432-7374" }}
    special={[...built.filter((r) => r.special), ...freight]}
    stock={[...built.filter((r) => !r.special), ...mats]}
    descLimit={DESC_LIMIT}
    onClose={() => {}}
  />,
);
