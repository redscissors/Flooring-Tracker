// Preview harness for the order-entry panel (the 2026-08 job-line flag batch):
// the REAL OrderEntryPanel over rows built through the REAL orderEntryRow — no
// Supabase, no App shell. Dev-only entry (order-entry-preview.html); not part
// of the app build. The mock lines replay the flagged cases: a Sheoga stocked
// floor (brand kept, "Stocked" dropped), a custom Sheoga floor, a hand-entered
// vendor line with no book (files as special order against the mock stock
// cache), a Glazzio book line, a PC-sold primer and an RL-sold roll (no unit
// start — only CT leads), and a plain stocked SKU line. The 8/26 batch adds
// the Glazzio CLNL289 sheet mosaic: SH unit, nominal size (true size on
// hover), exact SF/SH coverage, and the pinned SKU + coverage tail. The 8/27
// batch corrected the field to its real 70 characters (the old 30 default and
// this file's ?wide=1 68-char view are both gone — the one view IS the field
// now): CLNL289's soft "Collection" drop and Uptown's marked cut, the 8/26
// proofs, show at 70 unchanged. It also adds the plank-size lines (the
// Hallmark NO6EMEO-19 example): Emerson and the Tarkett vinyl fit written out
// whole, Alta Vista Balboa gives up only its 5/8" thickness, and Santa Monica
// degrades to the width alone — all without a "+", the full dimensions riding
// the Ext copy. The 8/31 batch adds the two flagged rows: the Catch Ivory
// Glossy tile EXACTLY as it is stored (cartonUnit "SF", the book's price basis)
// — healed on read, so it keys cartons and wears the CT tag instead of reading
// "13 SF · 12.15 SF/SF" — and the Tarkett Slim Trim as a pick lands it now,
// leading with the 94" its column header prints.
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrderEntryPanel } from "./orderentry.jsx";
import { orderEntryRow } from "./print.js";
import { normalizeSettings } from "./catalog.js";
import { newProduct, uid } from "./model.js";
import { lineItems, defaultConfig } from "./sheoga.js";
import { skuKeys } from "./orderbook.js";

const s = normalizeSettings();
const DESC_LIMIT = 70;

const stockBookIds = new Set(["bkStock"]);
const bookBrands = new Map([["bkGlz", "Glazzio"], ["bkOvfHm", "Hallmark"], ["bkOvfTk", "Tarkett"]]);
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
  // Hallmark hardwood planks (owner 2026-08-27, the NO6EMEO-19 example): the
  // size degrades thickness-first, length-next — the width never leaves.
  // Emerson fits the 70 field whole; Alta Vista's 25-character dimensions
  // crowd it, so Balboa drops its thickness and Santa Monica keeps width only
  { ...newProduct(), id: uid(), type: "hardwood", bookId: "bkOvfHm", sku: "NO6EMEO-19", brandColor: "Oak Emerson", sizeText: '7/16" x 6"x RL-74"', qty: "230", priceSqft: "8.99", costSqft: "4.69", cartonSf: "24.93", cartonUnit: "CT" },
  { ...newProduct(), id: uid(), type: "hardwood", bookId: "bkOvfHm", sku: "AV75OBALC", brandColor: "European White Oak Balboa", sizeText: '5/8" x 7 1/2" x RL- 74 3/4"', qty: "410", priceSqft: "13.99", costSqft: "7.29", cartonSf: "27", cartonUnit: "CT" },
  { ...newProduct(), id: uid(), type: "hardwood", bookId: "bkOvfHm", sku: "AV75OSANC", brandColor: "European White Oak Santa Monica", sizeText: '5/8" x 7 1/2" x RL- 74 3/4"', qty: "185", priceSqft: "13.99", costSqft: "7.29", cartonSf: "27", cartonUnit: "CT" },
  // Tarkett vinyl plank — a width × length size keeps the width the same way
  { ...newProduct(), id: uid(), type: "vinyl", bookId: "bkOvfTk", sku: "270311021", brandColor: "ProGen Sagebrush", sizeText: '7" x 60"', qty: "350", priceSqft: "6.49", costSqft: "3.97", cartonSf: "26.25", cartonUnit: "CT" },
  // PC-sold primer off an order book — no unit start any more (only CT leads)
  { ...newProduct(), id: uid(), type: "misc", qtyType: "count", bookId: "bkSlr", sku: "SLRPRMU1", brandColor: "Primer-U Universal Primer 1 Gal (3.78 L)", qty: "2", priceSqft: "65.61", costSqft: "43.74", sellUnit: "PC" },
  // RL-sold membrane, stocked at the shop → keys as stock, in rolls, untagged
  { ...newProduct(), id: uid(), type: "misc", qtyType: "count", sku: "23015", brandColor: "Kerdi-Band 33' Roll", qty: "3", priceSqft: "84.2", sellUnit: "RL" },
  // The 8/31 flag: stored with cartonUnit "SF" (the book's only U/M column is
  // its price basis) — 13 CARTONS used to key as "13 SF", coverage "12.15 SF/SF"
  { ...newProduct(), id: uid(), type: "tile", bookId: "bkVtc", sku: "F14CATCIV0312P", brandColor: "Catch Ivory Glossy", L: "3", W: "12", qty: "140", priceSqft: "5.2", costSqft: "3.47", cartonSf: "12.15", cartonUnit: "SF" },
  // The 8/31 flag: an OVF Tarkett molding, its 94" now read off the column header
  { ...newProduct(), id: uid(), type: "misc", qtyType: "count", bookId: "bkOvfTk", sku: "335015047", brandColor: "Tarkett Milled Oak—Copper — Slim Trim - P29 · fits 270266018", sizeText: '94"', qty: "4", priceSqft: "71.91", costSqft: "47.94" },
  // plain stocked SKU line
  { ...newProduct(), id: uid(), type: "tile", sku: "05153", brandColor: "Hanoi White Matte", L: "12", W: "24", qty: "140", priceSqft: "4.79", cartonSf: "15.5", cartonUnit: "CT" },
];

const built = rows.map((p) => orderEntryRow(p, s, "Area 1", DESC_LIMIT, stockBookIds, bookBrands, stockSkus));

createRoot(document.getElementById("preview")).render(
  <OrderEntryPanel
    name="Order entry preview — cartons keyed as cartons, moldings with their length"
    special={built.filter((r) => r.special)}
    stock={built.filter((r) => !r.special)}
    descLimit={DESC_LIMIT}
    onClose={() => {}}
  />,
);
