// Preview harness for the order-entry panel (the 2026-08 job-line flag batch):
// the REAL OrderEntryPanel over rows built through the REAL orderEntryRow — no
// Supabase, no App shell. Dev-only entry (order-entry-preview.html); not part
// of the app build. The mock lines replay the flagged cases: a Sheoga stocked
// floor (brand kept, "Stocked" dropped), a custom Sheoga floor, a hand-entered
// vendor line with no book (files as special order against the mock stock
// cache), a Glazzio book line, a PC-sold primer and an RL-sold roll (no unit
// start — only CT leads), and a plain stocked SKU line. The 8/26 batch adds
// the Glazzio CLNL289 sheet mosaic: SH unit, nominal size (true size on
// hover), exact SF/SH coverage, and the pinned SKU + coverage tail. Open with
// ?wide=1 for the soft-drop panel (owner 2026-08-26): the same lines at a
// 68-char field, where CLNL289's only loss is "Collection" (soft) so it
// pastes with NO "+", while the hand-entered Uptown line still cuts identity
// and keeps the marker + the footer's amber note.
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrderEntryPanel } from "./orderentry.jsx";
import { orderEntryRow } from "./print.js";
import { normalizeSettings } from "./catalog.js";
import { newProduct, uid } from "./model.js";
import { lineItems, defaultConfig } from "./sheoga.js";
import { skuKeys } from "./orderbook.js";

const s = normalizeSettings();
const DESC_LIMIT = 30;

const stockBookIds = new Set(["bkStock"]);
const bookBrands = new Map([["bkGlz", "Glazzio"]]);
// The mock ERP stock cache: only these SKUs are shop stock.
const stockSkus = new Set(["05153", "23015"].flatMap(skuKeys));

const sheogaStocked = lineItems(
  { mode: "stocked", cfg: { sp: "Hickory", color: "Toasted Acorn", grade: "char", w: 3.25, sheen: "" } },
  { sf: 320 },
).map((l) => ({ ...newProduct(), ...l, id: uid() }));

const sheogaFloor = lineItems(
  { mode: "floor", cfg: { ...defaultConfig("floor"), sp: "White Oak", w: 4.25, finish: "nat", sheen: "10" } },
  { sf: 1720 },
).map((l) => ({ ...newProduct(), ...l, id: uid() }));

const rows = [
  // hand-entered vendor tile — no bookId, SKU the shop doesn't stock → special
  { ...newProduct(), id: uid(), type: "tile", sku: "STIPEHW1212PEBF", brandColor: "Uptown Pebbles Harmony Warm Blend", L: "12", W: "12", qty: "14", priceSqft: "13.93", cartonSf: "10.76" },
  ...sheogaStocked,
  ...sheogaFloor,
  // Glazzio book line — brand rides as its own droppable part (issue 092)
  { ...newProduct(), id: uid(), type: "tile", bookId: "bkGlz", sku: "KES6301", brandColor: "Glazzio Kessel Collection Ovo Glossy", L: "3", W: "12", qty: "35", priceSqft: "3.6", costSqft: "2.4", cartonSf: "12.16", cartonUnit: "CT" },
  // Glazzio sheet mosaic as a pick now lands it (the 8/26 CLNL289 flags):
  // SH unit (no CT tag), nominal 12x12" with the exact dims on hover, 1.06 SF/SH
  { ...newProduct(), id: uid(), type: "tile", bookId: "bkGlz", sku: "CLNL289", brandColor: "Glazzio Colonial Collection Long Hex Village Square", sizeText: "12.375x12.375 sheet", L: "1", W: "2", qty: "35", priceSqft: "28.72", costSqft: "19.15", cartonSf: "1.06", cartonUnit: "SH" },
  // PC-sold primer off an order book — no unit start any more (only CT leads)
  { ...newProduct(), id: uid(), type: "misc", qtyType: "count", bookId: "bkSlr", sku: "SLRPRMU1", brandColor: "Primer-U Universal Primer 1 Gal (3.78 L)", qty: "2", priceSqft: "65.61", costSqft: "43.74", sellUnit: "PC" },
  // RL-sold membrane, stocked at the shop → keys as stock, in rolls, untagged
  { ...newProduct(), id: uid(), type: "misc", qtyType: "count", sku: "23015", brandColor: "Kerdi-Band 33' Roll", qty: "3", priceSqft: "84.2", sellUnit: "RL" },
  // plain stocked SKU line
  { ...newProduct(), id: uid(), type: "tile", sku: "05153", brandColor: "Hanoi White Matte", L: "12", W: "24", qty: "140", priceSqft: "4.79", cartonSf: "15.5", cartonUnit: "CT" },
];

const WIDE_LIMIT = 68;
const wideView = new URLSearchParams(window.location.search).has("wide");
const limit = wideView ? WIDE_LIMIT : DESC_LIMIT;
const built = rows.map((p) => orderEntryRow(p, s, "Area 1", limit, stockBookIds, bookBrands, stockSkus));

createRoot(document.getElementById("preview")).render(
  <OrderEntryPanel
    name={wideView
      ? 'Soft drops at a 68-char field — "Collection" alone lost pastes with no +'
      : "Order entry preview — job-line flag batch"}
    special={built.filter((r) => r.special)}
    stock={built.filter((r) => !r.special)}
    descLimit={limit}
    onClose={() => {}}
  />,
);
