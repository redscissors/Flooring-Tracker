// Sheoga Hardwood vendor configurator — data module + pure pricing engine
// (production path in .scratch/023_sheoga-configurator-prototype/README.md).
//
// Sheoga sells by DESCRIPTION, not SKU: species × grade × width ×
// solid/engineered plus texture, lengths, edge, sap and finishing options, a
// stocked-prefinished color program, herringbone/chevron, and a separate
// wood-vent & damper program. The generated description IS the order — it's
// what you read to Sheoga on the phone and what snapshots onto the job line.
//
// All table numbers are distributor COST, transcribed by hand from the three
// vendor sheets (the vent sheet is a scan, so there is no mapped import):
//   · Sheoga Pricing (Distributors) eff. 2/1/2025 — flooring
//   · Stocking Vent Prices, Feb 2022              — vents
//   · Damper cost sheet 1/9/2023                  — dampers
// A sheet update is a re-transcription of this one file.

const N = null;
const round2 = (n) => Math.round(n * 100) / 100;
const fm = (n) => "$" + n.toFixed(2);

export const SHEET_NOTE = "priced from Sheoga sheets · Feb ’25 / Feb ’22";
export const DEFAULT_MARKUP = 40;
// Wood vents & dampers carry their own markup (Settings → Price book), separate
// from flooring's — the shop marks grilles up more than material.
export const DEFAULT_VENT_MARKUP = 50;

// --- widths & cartons ---------------------------------------------------------

export const WIDTHS = [2.25, 3.25, 4.25, 5.25, 6.25, 7.25, 8.25];
export const WIDTH_LABEL = { 2.25: '2¼"', 3.25: '3¼"', 4.25: '4¼"', 5.25: '5¼"', 6.25: '6¼"', 7.25: '7¼"', 8.25: '8¼"', 9.25: '9¼"', 11.25: '11¼"' };
// sf per full carton by width (per shop, 2026-07-17). Live Sawn 9¼"/11¼" have
// no carton figure — call Sheoga.
export const CARTON_SF = { 2.25: 22, 3.25: 21, 4.25: 22, 5.25: 20.5, 6.25: 20, 7.25: 23.5, 8.25: 21.5 };

// --- unfinished flooring grid -------------------------------------------------
// clear/char = solid; eClear/eChar = engineered; each array indexes WIDTHS.

export const UNFINISHED = {
  "White Oak":     { clear: [5.65, 5.95, 6.25, 6.65, 7.15, 7.70, 8.40], char: [3.60, 3.80, 4.05, 4.35, 4.65, 4.95, 5.25], eClear: [N, 6.00, 6.40, 6.85, 7.30, 7.80, 8.30], eChar: [N, 5.00, 5.35, 5.70, 6.05, 6.45, 6.90] },
  "Red Oak":       { clear: [3.40, 3.60, 3.80, 4.05, 4.35, 4.65, 4.95], char: [3.00, 3.15, 3.35, 3.60, 3.80, 4.05, 4.30], eClear: [N, 5.05, 5.35, 5.70, 6.10, 6.50, 6.90], eChar: [N, 4.75, 5.05, 5.40, 5.75, 6.10, 6.50] },
  "Hickory":       { clear: [3.55, 3.80, 4.00, 4.25, 4.55, 4.85, 5.15], char: [3.15, 3.35, 3.55, 3.75, 4.00, 4.25, 4.55], eClear: [N, 5.05, 5.40, 5.75, 6.10, 6.50, 6.95], eChar: [N, 4.80, 5.10, 5.45, 5.80, 6.20, 6.60] },
  "Maple":         { clear: [4.25, 4.55, 4.85, 5.15, 5.45, 5.85, 6.25], char: [3.30, 3.55, 3.75, 4.00, 4.25, 4.55, 4.80], eClear: [N, 5.35, 5.70, 6.05, 6.45, 6.90, 7.35], eChar: [N, 4.85, 5.15, 5.50, 5.85, 6.25, 6.70] },
  "Cherry":        { clear: [3.45, 3.65, 3.90, 4.15, 4.40, 4.70, 5.00], char: [3.35, 3.55, 3.80, 4.05, 4.30, 4.60, 4.85], eClear: [N, 5.00, 5.35, 5.70, 6.05, 6.45, 6.90], eChar: [N, 4.85, 5.20, 5.50, 5.90, 6.30, 6.70] },
  "Walnut":        { clear: [6.90, 7.35, 7.85, 8.35, 8.90, 9.50, 10.15], char: [4.90, 5.20, 5.55, 5.95, 6.35, 6.75, 7.20], eClear: [N, 6.90, 7.35, 7.85, 8.40, 8.95, 9.55], eChar: [N, 5.40, 5.75, 6.10, 6.50, 6.95, 7.40] },
  "Beech":         { clear: [3.70, 3.90, 4.15, 4.40, N, N, N], char: [3.35, 3.60, 3.80, 4.05, N, N, N], eClear: [N, 5.20, 5.55, 5.90, N, N, N], eChar: [N, 5.00, 5.30, 5.65, N, N, N] },
  "Q/R White Oak": { clear: [7.45, 7.95, 8.50, 9.05, 9.65, 10.35, 11.05], char: [4.70, 5.05, 5.35, 5.70, 6.10, 6.50, 6.90], eClear: [N, 7.35, 7.85, 8.40, 8.95, 9.55, 10.20], eChar: [N, 5.30, 5.65, 6.05, 6.45, 6.85, 7.35] },
};
// Live Sawn White Oak — one grade, its own width run.
export const LIVE_SAWN = { ws: [5.25, 6.25, 7.25, 8.25, 9.25, 11.25], solid: [3.80, 4.15, 4.55, 4.95, 5.40, 6.50], eng: [5.25, 5.55, 5.95, 6.35, 6.75, N] };
export const LIVE_SAWN_SP = "Live Sawn White Oak";
export const SPECIES = Object.keys(UNFINISHED).concat([LIVE_SAWN_SP]);

export const TEXTURES = [
  { id: "smooth", name: "Smooth (standard)", add: 0, deep: false },
  { id: "aged", name: "Aged Brush", add: 1.00, deep: true },
  { id: "sawcut", name: "Saw Cut", add: 1.50, deep: true },
  { id: "bandsawn", name: "Band Sawn", add: 1.50, deep: true },
  { id: "country", name: "Country Worn", add: 1.50, deep: false },
  { id: "vintage", name: "Vintage Charm", add: 1.50, deep: false },
  { id: "oldmill", name: "Old Mill", add: 2.50, deep: false },
];
export const EDGES = [
  { id: "square", name: "Square edge", add: 0 },
  { id: "bevel", name: "Micro bevel", add: 0 },
  { id: "pillow", name: "Hand pillowed", add: 1.00 },
  { id: "vgroove", name: "Custom V-groove", add: 1.50 },
];
export const LENGTHS = [
  { id: "1-8", name: "1'–8' (standard)", pct: 0 },
  { id: "1-10", name: "1'–10'", pct: 5 },
  { id: "2-8", name: "2'–8'", pct: 15 },
  { id: "2-10", name: "2'–10'", pct: 20 },
  { id: "3-8", name: "3'–8'", pct: 25 },
  { id: "3-10", name: "3'–10'", pct: 30 },
];
// Established stain picks $1.95 or $2.85 from the selected texture (deep
// scrapes — sawcut/bandsawn/aged — take the higher rate per the finishing sheet).
export const FINISHES = [
  { id: "unf", name: "Unfinished", sub: "finish on site", add: () => 0 },
  { id: "nat", name: "Prefinished — Natural", sub: "clear ceramic", add: () => 1.65 },
  { id: "est", name: "Prefinished — Established stain", sub: "$1.95 smooth/OM/CW/VC · $2.85 sawcut/bandsawn/aged", add: (c) => (TEXTURES.find((t) => t.id === c.tex)?.deep ? 2.85 : 1.95) },
  { id: "t1", name: "Custom color T-1", sub: "to unfinished price", add: () => 3.05 },
  { id: "t2", name: "Custom color T-2", sub: "to unfinished price", add: () => 3.65 },
  { id: "t3", name: "Custom color T-3", sub: "to unfinished price", add: () => 3.85 },
];
export const NO_SAP = { Cherry: 1.00, Walnut: 2.00 };
export const SAMPLE_FEE = 750;
export const CUSTOM_FINISHES = ["t1", "t2", "t3"];

// Prefinished stain-color picks (the stocked program's standard colors) + a
// custom entry, and the sheen scale. Sheen is descriptive on the custom/floor
// tab (free); on the STOCKED tab, moving a product off its standard sheen adds
// a flat SHEEN_FEE line (made-to-order setup).
export const STAIN_COLORS = ["Natural", "Cattail", "Caramel", "Fresh Cut", "Toasted Acorn", "Nutmeg", "Buckeye", "Hickory Nut", "Frost"];
export const SHEENS = ["30", "20", "15", "10", "5"];
export const SHEEN_FEE = 250;

// --- stocked prefinished ------------------------------------------------------
// Solid, micro bevel; clear widths 2¼–5¼, char widths 2¼–6¼ (STOCKED_WIDTHS).

export const STOCKED = [
  { sp: "Cherry", color: "Natural", sheen: 30, clear: [N, 5.30, 5.55, 5.80], char: [N, 5.25, 5.50, 5.75, 6.00] },
  { sp: "Maple", color: "Natural", sheen: 30, clear: [N, 6.20, 6.50, 6.80], char: [4.95, 5.20, 5.40, 5.65, 5.90] },
  { sp: "Maple", color: "Frost", sheen: 5, clear: N, char: [N, 5.50, 5.70, 5.95, N] },
  { sp: "Hickory", color: "Natural", sheen: 30, clear: [5.20, 5.45, 5.65, 5.90], char: [4.80, 5.00, 5.20, 5.40, 5.65] },
  { sp: "Hickory", color: "Buckeye", sheen: 30, clear: [N, 5.75, 5.95, 6.20], char: N },
  { sp: "Hickory", color: "Hickory Nut", sheen: 30, clear: N, char: [N, 5.30, 5.50, 5.70, 5.95] },
  { sp: "Hickory", color: "Toasted Acorn", sheen: 30, clear: N, char: [N, 5.30, 5.50, 5.70, 5.95] },
  { sp: "Red Oak", color: "Natural", sheen: 30, clear: [5.05, 5.25, 5.45, 5.70], char: [4.65, 4.80, 5.00, 5.25, N] },
  { sp: "Red Oak", color: "Toasted Acorn", sheen: 30, clear: [N, 5.55, 5.75, 6.00], char: [N, 5.10, 5.30, 5.55, N] },
  { sp: "Red Oak", color: "Nutmeg", sheen: 20, clear: N, char: [N, 5.10, 5.30, 5.55, N] },
  { sp: "Walnut", color: "Natural", sheen: 30, clear: [N, 9.00, 9.50, N], char: [N, 6.85, 7.20, 7.60, 8.00] },
  { sp: "White Oak", color: "Natural", sheen: 30, clear: [N, 7.60, 7.90, 8.30], char: [5.25, 5.45, 5.70, 6.00, 6.30] },
  { sp: "White Oak", color: "Cattail", sheen: 30, clear: N, char: [N, 5.75, 6.00, 6.30, 6.60] },
  { sp: "White Oak", color: "Caramel", sheen: 20, clear: N, char: [N, 5.75, 6.00, 6.30, 6.60] },
  { sp: "White Oak", color: "Fresh Cut", sheen: 5, clear: N, char: [N, 5.75, 6.00, 6.30, 6.60] },
  { sp: "Red Oak", color: "Cattail · Sawcut", sheen: 20, tex: true, clear: N, char: [N, N, 7.90, 8.10, 8.35] },
  { sp: "Hickory", color: "Hickory Nut · Vintage Charm", sheen: 20, tex: true, clear: N, char: [N, N, 7.00, 7.20, 7.45] },
];
export const STOCKED_WIDTHS = { clear: [2.25, 3.25, 4.25, 5.25], char: [2.25, 3.25, 4.25, 5.25, 6.25] };
// Stocked colors are looked up by species + color name, never by table index —
// a re-transcription that reorders rows must not repoint saved configurations.
export const stockedItem = (k) => STOCKED.find((x) => x.sp === k.sp && x.color === k.color) || null;

// --- herringbone --------------------------------------------------------------
// 4 slat-length bands × widths per species. Made to order, no carton rounding.

export const HERRINGBONE = {
  bands: ['9"–18" slats', '18¼"–28" slats', '28¼"–38" slats', '38¼"–48" slats'],
  solid: {
    Beech: { ws: [2.25, 3.25, 4.25, 5.25], p: [[5.50, 5.70, 5.95, 6.20], [5.85, 6.05, 6.30, 6.55], [6.30, 6.50, 6.75, 7.00], [6.80, 7.00, 7.25, 7.50]] },
    Cherry: { ws: [2.25, 3.25, 4.25, 5.25, 6.25], p: [[5.25, 5.45, 5.70, 5.95, 6.20], [5.60, 5.80, 6.05, 6.30, 6.55], [6.05, 6.25, 6.50, 6.75, 7.00], [6.55, 6.75, 7.00, 7.25, 7.50]] },
    Maple: { ws: [2.25, 3.25, 4.25, 5.25, 6.25, 7.25], p: [[6.05, 6.35, 6.65, 6.95, 7.25, 7.65], [6.40, 6.70, 7.00, 7.30, 7.60, 8.00], [6.85, 7.15, 7.45, 7.75, 8.05, 8.45], [7.35, 7.65, 7.95, 8.25, 8.55, 8.95]] },
    Hickory: { ws: [2.25, 3.25, 4.25, 5.25, 6.25, 7.25], p: [[5.35, 5.60, 5.80, 6.05, 6.35, 6.65], [5.70, 5.95, 6.15, 6.40, 6.70, 7.00], [6.15, 6.40, 6.60, 6.85, 7.15, 7.45], [6.65, 6.90, 7.10, 7.35, 7.65, 7.95]] },
    "Red Oak": { ws: [2.25, 3.25, 4.25, 5.25, 6.25, 7.25], p: [[5.20, 5.40, 5.60, 5.85, 6.15, 6.45], [5.55, 5.75, 5.95, 6.20, 6.50, 6.80], [6.00, 6.20, 6.40, 6.65, 6.95, 7.25], [6.50, 6.70, 6.90, 7.15, 7.45, 7.75]] },
    Walnut: { ws: [2.25, 3.25, 4.25, 5.25, 6.25, 7.25], p: [[8.70, 9.15, 9.65, 10.15, 10.70, 11.30], [9.05, 9.50, 10.00, 10.50, 11.05, 11.65], [9.50, 9.95, 10.45, 10.95, 11.50, 12.10], [10.00, 10.45, 10.95, 11.45, 12.00, 12.60]] },
    "White Oak": { ws: [2.25, 3.25, 4.25, 5.25, 6.25, 7.25], p: [[7.45, 7.75, 8.05, 8.45, 8.95, 9.50], [7.80, 8.10, 8.40, 8.80, 9.30, 9.85], [8.25, 8.55, 8.85, 9.25, 9.75, 10.30], [8.75, 9.05, 9.35, 9.75, 10.25, 10.80]] },
    "Q/R White Oak": { ws: [2.25, 3.25, 4.25, 5.25, 6.25, 7.25], p: [[9.25, 9.75, 10.30, 10.85, 11.45, 12.15], [9.60, 10.10, 10.65, 11.20, 11.80, 12.50], [10.05, 10.55, 11.10, 11.65, 12.25, 12.95], [10.55, 11.05, 11.60, 12.15, 12.75, 13.45]] },
  },
  eng: {
    Beech: { ws: [3.25, 4.25, 5.25], p: [[7.00, 7.35, 7.70], [7.35, 7.70, 8.05], [7.80, 8.15, 8.50], [8.30, 8.65, 9.00]] },
    Cherry: { ws: [3.25, 4.25, 5.25, 6.25], p: [[6.80, 7.15, 7.50, 7.85], [7.15, 7.50, 7.85, 8.20], [7.60, 7.95, 8.30, 8.65], [8.10, 8.45, 8.80, 9.15]] },
    Maple: { ws: [3.25, 4.25, 5.25, 6.25, 7.25], p: [[7.15, 7.50, 7.85, 8.25, 8.70], [7.50, 7.85, 8.20, 8.60, 9.05], [7.95, 8.30, 8.65, 9.05, 9.50], [8.45, 8.80, 9.15, 9.55, 10.00]] },
    Hickory: { ws: [3.25, 4.25, 5.25, 6.25, 7.25], p: [[6.85, 7.20, 7.55, 7.90, 8.30], [7.20, 7.55, 7.90, 8.25, 8.65], [7.65, 8.00, 8.35, 8.70, 9.10], [8.15, 8.50, 8.85, 9.20, 9.60]] },
    "Red Oak": { ws: [3.25, 4.25, 5.25, 6.25, 7.25], p: [[6.85, 7.15, 7.50, 7.90, 8.30], [7.20, 7.50, 7.85, 8.25, 8.65], [7.65, 7.95, 8.30, 8.70, 9.10], [8.15, 8.45, 8.80, 9.20, 9.60]] },
    Walnut: { ws: [3.25, 4.25, 5.25, 6.25, 7.25], p: [[8.70, 9.15, 9.65, 10.15, 10.70], [9.05, 9.50, 10.00, 10.50, 11.05], [9.50, 9.95, 10.45, 10.95, 11.50], [10.00, 10.45, 10.95, 11.45, 12.00]] },
    "White Oak": { ws: [3.25, 4.25, 5.25, 6.25, 7.25], p: [[7.80, 8.20, 8.65, 9.10, 9.60], [8.15, 8.55, 9.00, 9.45, 9.95], [8.60, 9.00, 9.45, 9.90, 10.40], [9.10, 9.50, 9.95, 10.40, 10.90]] },
    "Q/R White Oak": { ws: [3.25, 4.25, 5.25, 6.25, 7.25], p: [[9.15, 9.65, 10.20, 10.75, 11.35], [9.50, 10.00, 10.55, 11.10, 11.70], [9.95, 10.45, 11.00, 11.55, 12.15], [10.45, 10.95, 11.50, 12.05, 12.65]] },
  },
};
export const CHEVRON_ADD = 3.00;
// Herringbone is priced in four slat-length tiers, but the salesperson enters
// the exact slat length; it snaps to the tier it falls in (upper bounds 18 / 28
// / 38 / 48 inches) for pricing and prints the real length on the order. The
// tiers themselves aren't selectable in the UI — `band` survives only as a
// legacy fallback so configs saved before the length-entry change still price.
export const HB_SLAT_MIN = 9;
export const HB_SLAT_MAX = 48;
export const hbBandForLen = (len) => (len <= 18 ? 0 : len <= 28 ? 1 : len <= 38 ? 2 : 3);
// The exact slat length as a number, or null when none is entered (tier mode).
export const hbSlatLen = (h) => {
  if (h == null || h.slatLen == null || h.slatLen === "") return null;
  const n = Number(h.slatLen);
  return Number.isFinite(n) ? n : null;
};

// Default multi-width split: each width's share ∝ its plank width (wider plank →
// bigger share, i.e. the 3-4-5 repeating look with equal plank counts). Whole
// percentages; the rounding remainder lands on the widest width so it sums to 100.
export function redistributeShares(widthVals) {
  const sum = widthVals.reduce((a, w) => a + w, 0) || 1;
  const out = {}; let acc = 0;
  widthVals.forEach((w) => { out[w] = Math.round((w / sum) * 100); acc += out[w]; });
  if (widthVals.length) { const big = [...widthVals].sort((a, b) => b - a)[0]; out[big] += 100 - acc; }
  return out;
}

// --- wood vents & dampers -----------------------------------------------------
// Two species price groups; sizes are duct W × L in inches ('2¼' = 2.25).

export const VENT_GROUP = { Cherry: "A", Hickory: "A", Beech: "A", "Red Oak": "A", "Hard Maple": "B", "White Oak": "B", "Q/R White Oak": "B", Walnut: "B" };
// [size, selfRim-A, flush-A, selfRim-B, flush-B]
export const VENT_STD = [
  ["2¼×6", 21.88, 18.13, 25.16, 20.85], ["2¼×8", 21.88, 18.13, 25.16, 20.85], ["2¼×10", 21.88, 18.13, 25.16, 20.85], ["2¼×12", 21.88, 18.13, 25.16, 20.85],
  ["2¼×14", 25.63, 21.25, 29.48, 24.44], ["2¼×16", 29.38, 25.00, 33.79, 28.75], ["2¼×18", 31.25, 27.50, 35.94, 31.63], ["2¼×20", 36.25, 30.63, 41.69, 35.23],
  ["4×6", 21.88, 18.13, 25.16, 20.85], ["4×8", 21.88, 18.13, 25.16, 20.85], ["4×10", 21.88, 18.13, 25.16, 20.85], ["4×12", 21.88, 18.13, 25.16, 20.85],
  ["4×14", 25.63, 21.25, 29.48, 24.44], ["4×16", 29.38, 25.00, 33.79, 28.75], ["4×18", 32.50, 27.50, 37.38, 31.63], ["4×20", 36.25, 27.50, 41.69, 28.75],
  ["6×8", 21.88, 18.13, 25.16, 20.85], ["6×10", 21.88, 18.13, 25.16, 20.85], ["6×12", 23.75, 20.00, 27.31, 23.00], ["6×14", 36.25, 25.00, 41.69, 28.75],
  ["6×16", 36.25, 25.00, 41.69, 28.75], ["6×18", 39.38, 34.38, 45.29, 39.54], ["6×20", 43.13, 37.50, 49.60, 43.13], ["6×22", 46.88, 38.75, 53.91, 44.56],
  ["6×24", 54.38, 46.88, 62.54, 53.91], ["6×26", 58.75, 50.00, 67.56, 57.50], ["6×28", 61.88, 47.50, 71.16, 54.63], ["6×30", 65.63, 56.25, 75.48, 64.69], ["6×32", 69.38, 59.38, 79.79, 68.29],
  ["8×10", 36.25, 25.00, 41.69, 28.75], ["8×12", 36.25, 25.00, 41.69, 28.75], ["8×14", 41.25, 36.88, 47.44, 42.41], ["8×16", 46.88, 39.38, 53.91, 45.29],
  ["8×18", 54.38, 46.88, 62.54, 53.91], ["8×20", 59.38, 51.25, 68.29, 58.94], ["8×22", 64.38, 55.63, 74.04, 63.98], ["8×24", 69.38, 59.38, 79.79, 68.29],
  ["8×26", 78.75, 68.75, 90.56, 79.06], ["8×28", 83.75, 72.50, 96.31, 83.38], ["8×30", 88.75, 76.25, 102.06, 87.69], ["8×32", 93.75, 80.63, 107.81, 92.73],
  ["10×12", 43.13, 37.50, 49.60, 43.13], ["10×14", 53.75, 46.25, 61.81, 53.19], ["10×16", 59.38, 51.25, 68.29, 58.94], ["10×18", 65.63, 56.25, 75.48, 64.69],
  ["10×20", 76.25, 67.50, 87.69, 77.63], ["10×22", 82.50, 71.25, 94.88, 81.94], ["10×24", 88.75, 76.25, 102.06, 87.69], ["10×26", 94.38, 81.25, 108.54, 93.44],
  ["10×28", 100.63, 86.25, 115.73, 99.19], ["10×30", 106.88, 91.25, 122.91, 104.94], ["10×32", 112.50, 96.88, 129.38, 111.41],
];
// flush vents with frame: [size, A, B]
export const VENT_FRAMED = [
  ["2¼×10", 24.38, 28.04], ["2¼×12", 24.38, 28.04], ["2¼×14", 28.75, 33.06], ["4×10", 24.38, 28.04], ["4×12", 25.63, 29.48], ["4×14", 30.63, 35.23],
  ["4×16", 34.38, 39.54], ["6×10", 25.63, 29.48], ["6×12", 28.75, 33.06], ["6×14", 30.63, 35.23], ["6×24", 62.50, 71.88], ["6×30", 72.50, 83.38],
];
// cold air returns: [size, selfRim-A, flush-A, selfRim-B, flush-B]
export const VENT_CAR = [
  ["8×14", 48.13, 41.88, 55.35, 48.16], ["8×16", 52.50, 46.25, 60.38, 53.19], ["8×18", 56.88, 50.63, 65.41, 58.23], ["8×20", 61.25, 55.00, 70.44, 63.25],
  ["8×22", 66.25, 60.00, 76.19, 69.00], ["8×24", 72.50, 66.25, 83.38, 76.19], ["8×26", 75.00, 68.75, 86.25, 79.06], ["8×28", 79.38, 73.13, 91.29, 84.10],
  ["8×30", 81.25, 76.25, 93.44, 87.69], ["8×32", 85.00, 78.75, 97.75, 90.56],
  ["10×14", 56.25, 50.00, 64.69, 57.50], ["10×16", 61.25, 55.00, 70.44, 63.25], ["10×18", 66.88, 60.63, 76.91, 69.73], ["10×20", 72.50, 66.25, 83.38, 76.19],
  ["10×22", 78.13, 71.88, 89.85, 82.66], ["10×24", 86.25, 80.00, 99.19, 92.00], ["10×26", 88.13, 81.88, 101.35, 94.16], ["10×28", 93.75, 87.50, 107.81, 100.63],
  ["10×30", 97.50, 92.50, 112.13, 106.38], ["10×32", 103.75, 97.50, 119.31, 112.13],
  ["12×14", 66.25, 60.00, 76.19, 69.00], ["12×16", 72.50, 66.25, 83.38, 76.19], ["12×18", 79.38, 73.13, 91.29, 84.10], ["12×20", 81.25, 76.25, 93.44, 87.69],
  ["12×22", 89.38, 83.13, 102.79, 95.60], ["12×24", 95.63, 89.38, 109.98, 102.79], ["12×26", 101.88, 95.63, 117.16, 109.98], ["12×28", 108.13, 101.88, 124.35, 117.16],
  ["12×30", 114.38, 108.13, 131.54, 124.35], ["12×32", 116.25, 110.00, 133.69, 126.50],
];
// 3-dimensional (baseboard): [size, A, B]
export const VENT_3D = [
  ["4×12", 47.50, 54.63], ["4×14", 50.63, 58.23], ["4×16", 53.75, 61.81], ["4×18", 56.88, 65.41], ["4×20", 60.00, 69.00], ["4×22", 61.88, 71.16], ["4×24", 73.75, 84.81], ["4×32", 96.25, 110.69],
];
export const VENT_CATS = [
  { id: "std-sr", name: "Self-rimming", list: () => VENT_STD, col: (g) => (g === "A" ? 1 : 3), cubed: true },
  { id: "std-fl", name: "Flush", list: () => VENT_STD, col: (g) => (g === "A" ? 2 : 4), cubed: true, frame: true },
  { id: "framed", name: "Flush w/ frame", list: () => VENT_FRAMED, col: (g) => (g === "A" ? 1 : 2) },
  { id: "car-sr", name: "Cold air return · self-rim", list: () => VENT_CAR, col: (g) => (g === "A" ? 1 : 3), cubed: true },
  { id: "car-fl", name: "Cold air return · flush", list: () => VENT_CAR, col: (g) => (g === "A" ? 2 : 4), cubed: true },
  { id: "d3", name: "3-Dimensional (baseboard)", list: () => VENT_3D, col: (g) => (g === "A" ? 1 : 2) },
];
export const VENT_PREFIN = 28.25;
export const VENT_TEX = 8.00;
export const VENT_CUBED = 10.00;
export const DAMPER_ATTACH = 5.00;
// [Sheoga cost, stocking (our cost as a Keim stocking dealer), builder, retail]
export const DAMPERS = {
  "4×10": [16.00, 20.00, 23.20, 25.60], "4×12": [17.50, 21.88, 25.38, 28.00], "4×14": [19.50, 24.38, 28.28, 31.20],
  "6×10": [17.50, 21.88, 25.38, 28.00], "6×12": [19.50, 24.38, 28.28, 31.20], "6×14": [22.50, 28.13, 32.63, 36.00], "8×12": [21.50, 26.88, 31.18, 34.40],
};

// --- configurations -----------------------------------------------------------
// One configuration = { mode, cfg }. The cfg shape is per-mode; it's what a job
// row keeps (product.sheoga) so "Reconfigure" reopens the popup pre-filled.

export const MODES = [
  { id: "floor", label: "Unfinished & custom" },
  { id: "stocked", label: "Stocked prefinished" },
  { id: "hb", label: "Herringbone" },
  { id: "vent", label: "Wood vents" },
  { id: "damper", label: "Dampers" },
];

export function defaultConfig(mode) {
  if (mode === "stocked") return { sp: "White Oak", color: "Natural", grade: "char", w: 5.25, sheen: "30", sheenCustom: false };
  if (mode === "hb") return { sp: "White Oak", cons: "solid", grade: "char", w: 4.25, band: null, slatLen: "", chevron: false, tex: "smooth", edge: "square", finish: "unf", stain: "", stainCustom: false, sheen: "30", sheenCustom: false, sample: false };
  if (mode === "vent") return { sp: "White Oak", cat: "std-fl", size: "4×12", cubed: false, prefin: false, stain: "", stainCustom: false, tex: false, scrape: "", damper: false, frame: false, qty: 1 };
  if (mode === "damper") return { size: "4×10", qty: 1 };
  return { sp: "White Oak", grade: "char", cons: "solid", w: 5.25, tex: "smooth", edge: "square", len: "1-8", noSap: false, finish: "unf", stain: "", stainCustom: false, sheen: "30", sheenCustom: false, sample: false };
}

// --- pricing engine -----------------------------------------------------------
// Every calc returns null for a combination the sheets don't offer, else
// { desc, size?, rest?, name, rows, cost, per: 'sf'|'ea', qty?, cartonSf?,
//   warn, fees } — desc is the canonical order description (size-first),
// rows the printable cost breakdown, fees flat $ lines that import separately.

export const floorWidths = (f) => (f.sp === LIVE_SAWN_SP ? LIVE_SAWN.ws : WIDTHS);

// Unfinished $/sf for species/grade/construction/width, or null.
export function floorBase(f) {
  if (f.sp === LIVE_SAWN_SP) {
    const i = LIVE_SAWN.ws.indexOf(f.w);
    return i < 0 ? N : (f.cons === "solid" ? LIVE_SAWN.solid : LIVE_SAWN.eng)[i];
  }
  const t = UNFINISHED[f.sp];
  if (!t) return N;
  const i = WIDTHS.indexOf(f.w);
  if (i < 0) return N;
  return t[f.cons === "eng" ? (f.grade === "clear" ? "eClear" : "eChar") : f.grade === "clear" ? "clear" : "char"][i];
}

export const gradeName = (f) => (f.sp === LIVE_SAWN_SP ? "Live Sawn" : f.grade === "clear" ? "Clear" : "Character");

export function finishName(f) {
  const x = FINISHES.find((z) => z.id === f.finish);
  if (f.finish === "unf") return "Unfinished";
  if (f.finish === "est") return `Prefinished ${f.stain || "(pick stain)"} stain`;
  if (f.finish === "nat") return "Prefinished Natural";
  return `${x.name}${f.stain ? ` “${f.stain}”` : ""}`;
}

// Length upcharges (%) apply to the unfinished base incl. no-sap, BEFORE the
// flat $/sf adders (assumption 1 of the design README — sheet just says "Add
// 15%"). Small-order fees apply whenever a finish is selected and are never
// folded into the $/sf — they import as their own flat lines at cost.
export function calcFloor(f, sf) {
  const base = floorBase(f);
  if (base == N) return null;
  const tex = TEXTURES.find((t) => t.id === f.tex);
  const edge = EDGES.find((e) => e.id === f.edge);
  const len = LENGTHS.find((l) => l.id === f.len);
  const fin = FINISHES.find((x) => x.id === f.finish);
  if (!tex || !edge || !len || !fin) return null;
  const sap = f.noSap ? NO_SAP[f.sp] || 0 : 0;
  const lenAdd = ((base + sap) * len.pct) / 100;
  const finAdd = fin.add(f);
  const fee = f.finish !== "unf" ? (sf < 250 ? 600 : sf < 500 ? 300 : 0) : 0;
  const cost = base + sap + lenAdd + tex.add + edge.add + finAdd;
  const rows = [[`Unfinished base — ${f.sp}, ${gradeName(f)}, ${f.cons === "solid" ? "solid" : "engineered"} ${WIDTH_LABEL[f.w]}`, fm(base) + "/sf"]];
  if (sap) rows.push(["No-sap upcharge", `+${fm(sap)}/sf`]);
  if (len.pct) rows.push([`${len.name} lengths (+${len.pct}% of base)`, `+${fm(lenAdd)}/sf`]);
  if (tex.add) rows.push([`Texture — ${tex.name}`, `+${fm(tex.add)}/sf`]);
  if (edge.add) rows.push([`Edge — ${edge.name}`, `+${fm(edge.add)}/sf`]);
  if (finAdd) rows.push([`Finishing — ${fin.name.replace("Prefinished — ", "")}`, `+${fm(finAdd)}/sf`]);
  const fees = [];
  if (fee) fees.push({ label: `Small-order fee — prefinished job under ${sf < 250 ? 250 : 500} sf`, amt: fee });
  const custom = CUSTOM_FINISHES.includes(f.finish);
  const established = f.finish === "est";
  // A custom color (T-1/T-2/T-3) can't be ordered without an approved match, so
  // the sample is always charged; on an established stain it's optional (toggle).
  const sampleOn = custom || (established && f.sample);
  if (sampleOn) fees.push({ label: "Custom color-match sample — approval bundle shipped", amt: SAMPLE_FEE });
  fees.forEach((x) => rows.push([`${x.label} → imports as its own line`, `+${fm(x.amt)} flat`]));
  const warn = [];
  warn.push("Made to order · 5–10% overrun · non-returnable");
  const size = WIDTH_LABEL[f.w];
  // Description = plain spaces, no separators; the size lives in the row's own
  // size field so it's left out of `rest`. Standard texture (Smooth), edge
  // (Square) and lengths (1'–8') are the defaults, so they're omitted; length
  // shows only when it's not the standard run. The finish is always stated —
  // "Unfinished" for the base, otherwise the prefinished name + its sheen.
  const parts = [f.sp, gradeName(f), f.cons === "solid" ? "Solid" : "Engineered"];
  if (f.noSap && sap) parts.push("No sap");
  if (tex.id !== "smooth") parts.push(tex.name.replace(" (standard)", ""));
  if (edge.id !== "square") parts.push(edge.name);
  if (len.pct) parts.push(len.name.replace(" (standard)", "") + " lengths");
  parts.push(f.finish === "unf" ? "Unfinished" : `${finishName(f)} ${f.sheen || "30"} sheen`);
  const rest = parts.join(" ");
  return { desc: `${size} ${rest}`, size, rest, cartonSf: CARTON_SF[f.w] || null, name: `Sheoga ${size} ${f.sp}`, rows, cost, per: "sf", warn, fees };
}

export function calcStocked(k) {
  const it = stockedItem(k);
  if (!it) return null;
  const arr = it[k.grade];
  if (!arr) return null;
  const ws = STOCKED_WIDTHS[k.grade];
  if (!ws) return null;
  const i = ws.indexOf(k.w);
  const p = i < 0 ? N : arr[i];
  if (p == N) return null;
  const std = it.sheen;
  const sheen = k.sheen != null && k.sheen !== "" ? String(k.sheen) : String(std);
  const changed = Number(sheen) !== std;
  const rows = [[`Stocked prefinished — micro bevel, ${sheen}-sheen clear ceramic`, fm(p) + "/sf"]];
  // Off-standard sheen turns a stock item into a made-to-order run: a flat
  // $250 line at cost (never folded into the $/sf), like the other fees.
  const fees = changed ? [{ label: `Non-standard sheen — ${sheen}-sheen (standard ${std})`, amt: SHEEN_FEE }] : [];
  fees.forEach((x) => rows.push([`${x.label} → imports as its own line`, `+${fm(x.amt)} flat`]));
  const size = WIDTH_LABEL[k.w];
  const color = it.color.replace(/ · /g, " ");
  const rest = `${it.sp} ${color} ${k.grade === "clear" ? "Clear" : "Character"} Stocked prefinished ${sheen} sheen`;
  const warn = changed ? ["Non-standard sheen — made to order, not a stock item"] : ["Stocked item — ships from Sheoga stock"];
  return { desc: `${size} ${rest}`, size, rest, cartonSf: CARTON_SF[k.w] || null, name: `Sheoga ${size} ${it.sp} ${it.color}`, rows, cost: p, per: "sf", warn, fees };
}

export function calcHerringbone(h, sf) {
  const t = HERRINGBONE[h.cons === "solid" ? "solid" : "eng"][h.sp];
  if (!t) return null;
  const i = t.ws.indexOf(h.w);
  if (i < 0) return null;
  const len = hbSlatLen(h);
  const band = len != null ? hbBandForLen(len) : (Number.isFinite(h.band) ? h.band : null);
  if (band == null) return null; // no length entered (and no legacy tier) — nothing to price
  const base = t.p[band]?.[i];
  if (base == N) return null;
  // Exact length prints its own "24\" slats" label; tier mode prints the range.
  const slatLabel = len != null ? `${h.slatLen}" slats` : HERRINGBONE.bands[band];
  const rowLabel = len != null ? `${slatLabel} (${HERRINGBONE.bands[band]} tier)` : slatLabel;
  const rows = [[`Herringbone — ${h.sp} ${h.cons === "solid" ? "solid" : "engineered"} ${WIDTH_LABEL[h.w]}, ${rowLabel}`, fm(base) + "/sf"]];
  let cost = base;
  if (h.chevron) {
    cost += CHEVRON_ADD;
    rows.push(["Chevron pattern (slip tongue included)", "+$3.00/sf"]);
  }
  // Finishing mirrors the custom floor tab: the scrape (texture), edge and the
  // prefinished/stain program add the same $/sf as straight flooring, and the
  // small-order / color-match sample fees import as their own flat lines.
  // Missing fields (pre-edge/finishing saved configs) read as smooth + square
  // edge + unfinished.
  const tex = TEXTURES.find((x) => x.id === h.tex) || TEXTURES[0];
  const edge = EDGES.find((x) => x.id === h.edge) || EDGES[0];
  const fin = FINISHES.find((x) => x.id === h.finish) || FINISHES[0];
  const prefin = fin.id !== "unf";
  if (tex.add) { cost += tex.add; rows.push([`Texture — ${tex.name}`, `+${fm(tex.add)}/sf`]); }
  if (edge.add) { cost += edge.add; rows.push([`Edge — ${edge.name}`, `+${fm(edge.add)}/sf`]); }
  const finAdd = fin.add(h);
  if (finAdd) { cost += finAdd; rows.push([`Finishing — ${fin.name.replace("Prefinished — ", "")}`, `+${fm(finAdd)}/sf`]); }
  const fees = [];
  if (prefin) { const fee = sf < 250 ? 600 : sf < 500 ? 300 : 0; if (fee) fees.push({ label: `Small-order fee — prefinished job under ${sf < 250 ? 250 : 500} sf`, amt: fee }); }
  const custom = CUSTOM_FINISHES.includes(fin.id);
  const established = fin.id === "est";
  if (custom || (established && h.sample)) fees.push({ label: "Custom color-match sample — approval bundle shipped", amt: SAMPLE_FEE });
  fees.forEach((x) => rows.push([`${x.label} → imports as its own line`, `+${fm(x.amt)} flat`]));
  const size = WIDTH_LABEL[h.w];
  // Herringbone descriptions already use " · " separators; the finish (scrape,
  // then the prefinished name + sheen) appends the same way. Unfinished/smooth
  // add nothing, so plain-herringbone descriptions are unchanged.
  const finBits = [];
  if (tex.id !== "smooth") finBits.push(tex.name.replace(" (standard)", ""));
  if (edge.id !== "square") finBits.push(edge.name);
  if (prefin) finBits.push(`${finishName(h)} ${h.sheen || "30"} sheen`);
  // Grade (clear/character) is descriptive order text — the herringbone sheet has
  // no clear/char price split, so it never changes cost, only what's read to Sheoga.
  const grade = h.grade === "clear" ? "Clear" : "Character";
  const rest = `${h.sp} ${grade} · ${h.cons === "solid" ? "Solid" : "Engineered"} ${h.chevron ? "Chevron" : "Herringbone"} · ${slatLabel}${finBits.length ? " · " + finBits.join(" · ") : ""}`;
  const warn = ["Deposit required · subject to 10% overrun · no returns · made to order, no carton rounding"];
  if (len != null && (len < HB_SLAT_MIN || len > HB_SLAT_MAX)) warn.unshift(`Slat length ${h.slatLen}" is outside the standard ${HB_SLAT_MIN}–${HB_SLAT_MAX}" range — confirm with Sheoga`);
  return {
    desc: `${size} ${rest}`, size, rest, name: `Sheoga ${size} ${h.chevron ? "Chevron" : "Herringbone"} ${h.sp}`, rows, cost, per: "sf",
    warn, fees,
  };
}

export const ventDims = (sz) => sz.split("×").map((x) => (x === "2¼" ? 2.25 : parseFloat(x)));
// Frame lineal inches = L + 2W per the vent sheet's note.
export const frameLineal = (sz) => { const [a, b] = ventDims(sz); return Math.max(a, b) + 2 * Math.min(a, b); };

// The vent sheet's option adders are flat regardless of which scrape or stain —
// `scrape` (a TEXTURES id) and `stain` only name the choice on the order.
export const ventScrape = (v) => (v.tex ? TEXTURES.find((t) => t.id === v.scrape && t.id !== "smooth") || null : null);

export function calcVent(v) {
  const cat = VENT_CATS.find((c) => c.id === v.cat);
  const g = VENT_GROUP[v.sp];
  if (!cat || !g) return null;
  const row = cat.list().find((r) => r[0] === v.size);
  if (!row) return null;
  const base = row[cat.col(g)];
  const scrape = ventScrape(v);
  const scrapeName = scrape ? scrape.name.replace(" (standard)", "") : null;
  const stain = v.prefin && v.stain ? String(v.stain).trim() : "";
  const rows = [[`${cat.name} vent ${v.size}" — group ${g} (${v.sp})`, fm(base) + " ea"]];
  let cost = base;
  if (v.cubed && cat.cubed) { cost += VENT_CUBED; rows.push(["Cubed grille", "+$10.00"]); }
  if (v.prefin) { cost += VENT_PREFIN; rows.push([`Prefinished${stain ? ` — ${stain}` : ""}`, "+$28.25"]); }
  if (v.tex) { cost += VENT_TEX; rows.push([`Textured${scrapeName ? ` — ${scrapeName}` : ""}`, "+$8.00"]); }
  if (v.damper && DAMPERS[v.size]) {
    const d = DAMPERS[v.size][1] + DAMPER_ATTACH;
    cost += d;
    rows.push([`Damper ${v.size} + $5.00 attach`, `+${fm(d)}`]);
  }
  if (v.frame && cat.frame) {
    const li = frameLineal(v.size);
    const fc = 0.4 * li;
    cost += fc;
    rows.push([`Frame — ${li}" lineal @ $0.40`, `+${fm(fc)}`]);
  }
  const prefinTxt = v.prefin ? ` · Prefinished${stain ? (stain === "Natural" ? " Natural" : ` ${stain} stain`) : ""}` : "";
  const rest = `${cat.name} vent · ${v.sp}${v.cubed && cat.cubed ? " · Cubed" : ""}${prefinTxt}${v.tex ? ` · ${scrapeName || "Textured"}` : ""}${v.damper && DAMPERS[v.size] ? " · w/ damper" : ""}${v.frame && cat.frame ? " · w/ frame" : ""}`;
  return {
    desc: `${v.size}" ${rest}`, size: `${v.size}"`, rest, name: `Sheoga vent ${v.size}" ${v.sp}`, rows, cost, per: "ea", qty: v.qty || 1,
    warn: cat.id === "framed" ? ['Overall size adds 2¾" all around the duct size'] : [], fees: [],
  };
}

export function calcDamper(d) {
  const t = DAMPERS[d.size];
  if (!t) return null;
  const rows = [
    [`Damper ${d.size}" — stocking price (our cost)`, fm(t[1]) + " ea"],
    ["Sheoga list: builder " + fm(t[2]) + " · retail " + fm(t[3]), ""],
  ];
  return {
    desc: `${d.size}" vent damper (loose)`, size: `${d.size}"`, rest: "vent damper (loose)", name: `Sheoga damper ${d.size}"`, rows, cost: t[1], per: "ea", qty: d.qty || 1,
    warn: ["Attached-to-vent price is damper + $5.00 (use the vent tab)"], fees: [],
  };
}

// "Copy floor" — the vent options that make a grille match the floor being
// quoted (species, scrape, prefinish stain), mapped from a floor / stocked /
// herringbone configuration. The vent sheet sells eight species: Maple is
// listed as Hard Maple and Live Sawn is plain White Oak; a species with no
// vent twin leaves the vent's species untouched. Returns a vent-cfg patch.
const VENT_SP_MAP = { Maple: "Hard Maple", [LIVE_SAWN_SP]: "White Oak" };
export function ventFromFloor(snap) {
  if (!snap || !snap.cfg) return null;
  const f = snap.cfg;
  const mapped = VENT_SP_MAP[f.sp] || f.sp;
  const out = VENT_GROUP[mapped] ? { sp: mapped } : {};
  if (snap.mode === "stocked") {
    // A stocked color can pair a stain with a texture ("Cattail · Sawcut").
    const [color, texName] = String(f.color || "").split(" · ");
    const tex = texName ? TEXTURES.find((t) => t.name.replace(/\s+/g, "").toLowerCase() === texName.replace(/\s+/g, "").toLowerCase()) : null;
    return { ...out, prefin: true, stain: color || "", stainCustom: false, tex: !!tex, scrape: tex ? tex.id : "" };
  }
  // Floor and herringbone share the same tex/finish/stain shape, so a grille
  // matches either one the same way.
  if (snap.mode !== "floor" && snap.mode !== "hb") return null;
  const scraped = !!f.tex && f.tex !== "smooth";
  const prefin = !!f.finish && f.finish !== "unf";
  const stain = !prefin ? "" : f.finish === "nat" ? "Natural" : String(f.stain || "").trim();
  return { ...out, prefin, stain, stainCustom: !!stain && !STAIN_COLORS.includes(stain), tex: scraped, scrape: scraped ? f.tex : "" };
}

// "Copy floor" for the herringbone tab — mirror the vent copy, but land on the
// herringbone's floor-style finishing fields (tex/edge/finish/stain/sheen). Pulls
// species + grade + construction + width + scrape + edge + prefinished stain from the
// last-open unfinished/custom or stocked tab. Herringbone sells the same eight
// base species as unfinished flooring except Live Sawn (→ plain White Oak); a
// species with no herringbone twin leaves it untouched. Width is carried through
// too — the popup snaps it into the new species/construction run when the run
// doesn't offer it. Stocked prefinished is always solid.
const HB_SP_MAP = { [LIVE_SAWN_SP]: "White Oak" };
export function hbFromFloor(snap) {
  if (!snap || !snap.cfg) return null;
  const f = snap.cfg;
  const mapped = HB_SP_MAP[f.sp] || f.sp;
  const out = HERRINGBONE.solid[mapped] ? { sp: mapped } : {};
  if (snap.mode === "hb") return out;
  if (snap.mode === "stocked") {
    // A stocked color can pair a stain with a texture ("Cattail · Sawcut").
    const [color, texName] = String(f.color || "").split(" · ");
    const tex = texName ? TEXTURES.find((t) => t.name.replace(/\s+/g, "").toLowerCase() === texName.replace(/\s+/g, "").toLowerCase()) : null;
    const natural = color === "Natural";
    // Stocked prefinished is always micro bevel (its program's one edge).
    return { ...out, cons: "solid", grade: f.grade === "clear" ? "clear" : "char", w: f.w, tex: tex ? tex.id : "smooth", edge: "bevel", finish: natural ? "nat" : "est", stain: natural ? "" : (color || ""), stainCustom: false, sheen: String(f.sheen ?? "30"), sheenCustom: false, sample: false };
  }
  if (snap.mode !== "floor") return null;
  return { ...out, cons: f.cons === "eng" ? "eng" : "solid", grade: f.grade === "clear" ? "clear" : "char", w: f.w, tex: f.tex || "smooth", edge: f.edge || "square", finish: f.finish || "unf", stain: f.stain || "", stainCustom: !!f.stainCustom, sheen: String(f.sheen ?? "30"), sheenCustom: !!f.sheenCustom, sample: !!f.sample };
}

// One configuration snapshot { mode, cfg } → its build, or null.
export function calcConfig(snap, sf) {
  if (!snap || !snap.cfg) return null;
  if (snap.mode === "floor") return calcFloor(snap.cfg, sf);
  if (snap.mode === "stocked") return calcStocked(snap.cfg);
  if (snap.mode === "hb") return calcHerringbone(snap.cfg, sf);
  if (snap.mode === "vent") return calcVent(snap.cfg);
  if (snap.mode === "damper") return calcDamper(snap.cfg);
  return null;
}

// A multi-width floor: one build per width sharing every other option, the job
// size split by share (∝ width by default), and the per-build setup fees pooled
// to ONCE per bundle. Per-width `lines` carry no fees; `fees` are the pooled set.
export function multiWidthBuild(base, widths, sf) {
  const stocked = base.mode === "stocked";
  const sum = widths.reduce((a, x) => a + (x.share || 0), 0) || 1;
  const lines = widths.map((x) => {
    const cfg = { ...base.cfg, w: x.w };
    const c = stocked ? calcStocked(cfg) : calcFloor(cfg, Math.round((sf * (x.share || 0)) / sum));
    return {
      w: x.w, share: x.share || 0, sf: Math.round((sf * (x.share || 0)) / sum),
      cost: c ? c.cost : null, size: c ? c.size : null, rest: c ? c.rest : null,
      cartonSf: c ? c.cartonSf : null, ok: !!c,
    };
  });
  const diff = sf - lines.reduce((a, l) => a + l.sf, 0);
  const okIdx = lines.map((l, i) => (l.ok ? i : -1)).filter((i) => i >= 0);
  if (okIdx.length) { let bi = okIdx[0]; for (const i of okIdx) if (lines[i].sf > lines[bi].sf) bi = i; lines[bi].sf += diff; }
  const fees = [];
  if (stocked) {
    const it = stockedItem(base.cfg);
    const std = it ? it.sheen : null;
    const sheen = base.cfg.sheen != null && base.cfg.sheen !== "" ? String(base.cfg.sheen) : String(std);
    if (std != null && Number(sheen) !== std) fees.push({ label: `Non-standard sheen — ${sheen}-sheen (standard ${std})`, amt: SHEEN_FEE });
  } else {
    const f = base.cfg;
    if (f.finish !== "unf") { const fee = sf < 250 ? 600 : sf < 500 ? 300 : 0; if (fee) fees.push({ label: `Small-order fee — prefinished job under ${sf < 250 ? 250 : 500} sf`, amt: fee }); }
    if (CUSTOM_FINISHES.includes(f.finish) || (f.finish === "est" && f.sample)) fees.push({ label: "Custom color-match sample — approval bundle shipped", amt: SAMPLE_FEE });
  }
  return { lines, fees, sf };
}

// Multi-width → row payloads: a hardwood row per shippable width + pooled fee
// misc rows. Same shape as lineItems() so addSheogaLines consumes it unchanged.
export function multiWidthLineItems(base, widths, sf, markupPct = DEFAULT_MARKUP) {
  const b = multiWidthBuild(base, widths, sf);
  const rows = b.lines.filter((l) => l.ok).map((l) => ({
    type: "hardwood", sku: "", sizeText: l.size || "", brandColor: `Sheoga — ${l.rest}`,
    qtyType: "sqft", qty: l.sf > 0 ? String(l.sf) : "",
    priceSqft: String(sellOf(l.cost, markupPct)), costSqft: String(round2(l.cost)), markupPct: String(markupPct),
    ...(l.cartonSf ? { cartonSf: String(l.cartonSf) } : {}),
    sheoga: { mode: base.mode, cfg: JSON.parse(JSON.stringify({ ...base.cfg, w: l.w })), multiWidth: true },
  }));
  const fees = b.fees.map((x) => ({
    type: "misc", sku: "", sizeText: "", brandColor: `Sheoga — ${x.label}`, qtyType: "count", qty: "1",
    priceSqft: String(x.amt), costSqft: String(x.amt), markupPct: "0",
    sheoga: FEE_MARK,
  }));
  return [...rows, ...fees];
}

// Sell $/unit from distributor cost — same rounding as every other price.
export const sellOf = (cost, markupPct) => round2(cost * (1 + (markupPct ?? DEFAULT_MARKUP) / 100));

// Whole-carton preview for a sq-ft build (ADR 0013 math: exact always shown,
// order rounds up). The app row redoes this itself off cartonSf — with waste —
// so this is display-only for the popup.
export function cartonize(sf, cartonSf) {
  if (!(cartonSf > 0) || !(sf > 0)) return null;
  const exact = sf / cartonSf;
  const cartons = Math.ceil(exact);
  return { sf: cartonSf, exact, cartons, billedSf: +(cartons * cartonSf).toFixed(1) };
}

// --- add-to-line payloads -----------------------------------------------------
// The Product-row lines one configuration lands on the job (snapshot rule,
// ADR 0003 — nothing reprices later). Main line: type 'hardwood', description →
// brandColor (size-first via sizeText like every other row), sell → priceSqft,
// cost/markup carried per ADR 0011/0018 so tiers and margin read honestly, and
// the raw configuration kept on the row (product.sheoga) for "Reconfigure".
// Fees are flat misc lines passed through at cost — never folded into the $/sf.
//
// A fee line carries `sheoga` too, but with no `cfg`: it is a Sheoga-sourced row
// (so the order-entry panel files it under Special order with the floor it came
// from) that has no configuration of its own to reopen. Read `sheoga.cfg`, not
// `sheoga`, wherever the question is "can this row be reconfigured".
const FEE_MARK = Object.freeze({ fee: true });

export function lineItems(snap, { sf, markupPct = DEFAULT_MARKUP } = {}) {
  const c = calcConfig(snap, sf);
  if (!c) return [];
  const sell = sellOf(c.cost, markupPct);
  const sheoga = { mode: snap.mode, cfg: JSON.parse(JSON.stringify(snap.cfg)) };
  const main =
    c.per === "ea"
      ? {
          type: "hardwood", sku: "", sizeText: c.size || "", brandColor: `Sheoga — ${c.rest || c.desc}`, qtyType: "count", qty: String(c.qty || 1),
          priceSqft: String(sell), costSqft: String(round2(c.cost)), markupPct: String(markupPct),
          sheoga,
        }
      : {
          type: "hardwood", sku: "", sizeText: c.size || "", brandColor: `Sheoga — ${c.rest || c.desc}`, qtyType: "sqft", qty: sf > 0 ? String(sf) : "",
          priceSqft: String(sell), costSqft: String(round2(c.cost)), markupPct: String(markupPct),
          ...(c.cartonSf ? { cartonSf: String(c.cartonSf) } : {}),
          sheoga,
        };
  const fees = (c.fees || []).map((x) => ({
    type: "misc", sku: "", sizeText: "", brandColor: `Sheoga — ${x.label}`, qtyType: "count", qty: "1",
    priceSqft: String(x.amt), costSqft: String(x.amt), markupPct: "0",
    sheoga: FEE_MARK,
  }));
  return [main, ...fees];
}

// --- short forms for a narrow ERP description field ---------------------------
// Sheoga descriptions are assembled from known enums, so they abbreviate
// LOSSLESSLY: every category keeps a slot, it just gets a shorter label. That's
// the whole reason the "short" rung of descfit.js exists — nothing here is a
// truncation, and no two values in a category share a short form.
//
// These are ORDER TEXT read by the desk (and, on a printed PO, by Sheoga), so
// keep them unambiguous over merely brief. Widths already print short ('5¼"').

const SP_SHORT = {
  "White Oak": "WO", "Red Oak": "RO", Hickory: "Hick", Maple: "Mpl", Cherry: "Chry",
  Walnut: "Wal", Beech: "Bch", "Q/R White Oak": "QRWO", [LIVE_SAWN_SP]: "LSWO",
};
const GRADE_SHORT = { Clear: "Clr", Character: "Char", "Live Sawn": "LS" };
const TEX_SHORT = { smooth: "Smth", aged: "AgdBr", sawcut: "SawCut", bandsawn: "BndSwn", country: "CtryWrn", vintage: "VntChrm", oldmill: "OldMill" };
const EDGE_SHORT = { square: "Sq", bevel: "MBvl", pillow: "HndPlw", vgroove: "VGrv" };
const LEN_SHORT = { "1-8": "1-8'", "1-10": "1-10'", "2-8": "2-8'", "2-10": "2-10'", "3-8": "3-8'", "3-10": "3-10'" };
const FIN_SHORT = { unf: "Unf", nat: "Nat", t1: "T-1", t2: "T-2", t3: "T-3" };
const STAIN_SHORT = {
  Natural: "Nat", Cattail: "Cattail", Caramel: "Caramel", "Fresh Cut": "FrshCut",
  "Toasted Acorn": "TstdAcrn", Nutmeg: "Nutmeg", Buckeye: "Buckeye", "Hickory Nut": "HickNut", Frost: "Frost",
};

const shortFinish = (f) => {
  if (f.finish === "est") return f.stain ? STAIN_SHORT[f.stain] || f.stain : "Est";
  return FIN_SHORT[f.finish] || finishName(f);
};

// A configuration → the description's categories, in print order, each with its
// drop priority. Rank 0 is identity — width, species, grade, construction and
// finish all name a different product, so none of them may be dropped. Sheen
// and no-sap are rank 1; the appearance options that only appear when they're
// already non-standard are rank 2.
//
// The `full` strings MUST match what calcFloor/calcStocked put in `rest` (the
// snapshotted description) — orderentry.test.js asserts the join across a
// matrix of configurations, so a change to one side fails until both agree.
// Returns null for herringbone/vents/dampers, whose descriptions aren't a flat
// enum join; those fall back to the unstructured single-part path.
export function descParts(snap) {
  if (!snap || !snap.cfg) return null;
  if (snap.mode === "floor") return floorParts(snap.cfg);
  if (snap.mode === "stocked") return stockedParts(snap.cfg);
  return null;
}

function floorParts(f) {
  const tex = TEXTURES.find((t) => t.id === f.tex);
  const edge = EDGES.find((e) => e.id === f.edge);
  const len = LENGTHS.find((l) => l.id === f.len);
  if (!tex || !edge || !len || !FINISHES.find((x) => x.id === f.finish)) return null;
  const sap = f.noSap ? NO_SAP[f.sp] || 0 : 0;
  const grade = gradeName(f);
  const out = [
    { full: WIDTH_LABEL[f.w], rank: 0 },
    { full: f.sp, short: SP_SHORT[f.sp] || f.sp, rank: 0 },
    { full: grade, short: GRADE_SHORT[grade] || grade, rank: 0 },
    { full: f.cons === "solid" ? "Solid" : "Engineered", short: f.cons === "solid" ? "Sol" : "Eng", rank: 0 },
  ];
  if (f.noSap && sap) out.push({ full: "No sap", short: "NoSap", rank: 1 });
  if (tex.id !== "smooth") out.push({ full: tex.name.replace(" (standard)", ""), short: TEX_SHORT[tex.id], rank: 2 });
  if (edge.id !== "square") out.push({ full: edge.name, short: EDGE_SHORT[edge.id], rank: 2 });
  if (len.pct) out.push({ full: len.name.replace(" (standard)", "") + " lengths", short: LEN_SHORT[len.id], rank: 2 });
  if (f.finish === "unf") out.push({ full: "Unfinished", short: "Unf", rank: 0 });
  else {
    out.push({ full: finishName(f), short: shortFinish(f), rank: 0 });
    out.push({ full: `${f.sheen || "30"} sheen`, short: `${f.sheen || "30"}sh`, rank: 1 });
  }
  return out;
}

function stockedParts(k) {
  const it = stockedItem(k);
  if (!it) return null;
  const sheen = k.sheen != null && k.sheen !== "" ? String(k.sheen) : String(it.sheen);
  const grade = k.grade === "clear" ? "Clear" : "Character";
  const color = it.color.replace(/ · /g, " ");
  return [
    { full: WIDTH_LABEL[k.w], rank: 0 },
    { full: it.sp, short: SP_SHORT[it.sp] || it.sp, rank: 0 },
    // "Fresh Cut" abbreviates whole; "Cattail · Sawcut" pairs a colour with a
    // texture, so fall back to shortening each word it knows.
    { full: color, short: STAIN_SHORT[color] || color.split(" ").map((w) => STAIN_SHORT[w] || w).join(" "), rank: 0 },
    { full: grade, short: GRADE_SHORT[grade], rank: 0 },
    { full: "Stocked prefinished", short: "Stk", rank: 2 },
    { full: `${sheen} sheen`, short: `${sheen}sh`, rank: 1 },
  ];
}

// --- SKU-search entry point ---------------------------------------------------
// Sheoga has no SKUs, so it can never be a book match. The SKU dropdown pins a
// "Vendor configurators" row when the query starts spelling the vendor (any
// ≥3-letter prefix of "sheoga") or hits its trade words; the parsed query seeds
// the popup pre-filled.

export function parseQuery(q) {
  q = " " + String(q || "").toLowerCase().replace(/[",]/g, "") + " ";
  const out = {};
  if (/\bvent|damper|register\b/.test(q)) out.mode = /damper/.test(q) && !/vent/.test(q) ? "damper" : "vent";
  if (/herringbone|chevron/.test(q)) { out.mode = "hb"; out.chevron = /chevron/.test(q); }
  const SPP = [
    ["live sawn", LIVE_SAWN_SP], ["q/r", "Q/R White Oak"], ["qr ", "Q/R White Oak"], ["quarter", "Q/R White Oak"],
    ["white oak", "White Oak"], ["wht oak", "White Oak"], ["red oak", "Red Oak"], ["hickory", "Hickory"], ["maple", "Maple"],
    ["cherry", "Cherry"], ["walnut", "Walnut"], ["beech", "Beech"], [" oak", "White Oak"],
  ];
  for (const [k, v] of SPP) if (q.includes(k)) { out.sp = v; break; }
  if (/\bclear\b/.test(q)) out.grade = "clear";
  else if (/\bchar/.test(q)) out.grade = "char";
  if (/\beng/.test(q)) out.cons = "eng";
  else if (/\bsolid\b/.test(q)) out.cons = "solid";
  const wm = q.match(/(\d{1,2})\s*(?:1\/4|¼|\.25)/);
  if (wm) { const w = +wm[1] + 0.25; if (WIDTH_LABEL[w]) out.w = w; }
  const tx = TEXTURES.find((t) => t.id !== "smooth" && q.includes(t.name.toLowerCase().split(" ")[0]));
  if (tx) out.tex = tx.id;
  return out;
}

export function queryHit(q) {
  const toks = String(q || "").toLowerCase().split(/[^a-z¼/0-9]+/).filter(Boolean);
  if (toks.some((t) => t.length >= 3 && "sheoga".startsWith(t))) return true;
  const p = parseQuery(q);
  return !!(p.sp || p.mode);
}

// One-line summary of what the pinned row will open ("opens pre-filled: …").
export function querySummary(p) {
  if (p.mode === "vent") return "opens on Wood vents" + (p.sp ? ` · ${p.sp}` : "");
  if (p.mode === "damper") return "opens on Dampers";
  if (p.mode === "hb") return `opens on Herringbone${p.chevron ? " (chevron)" : ""}${p.sp ? ` · ${p.sp}` : ""}${p.w ? ` · ${WIDTH_LABEL[p.w]}` : ""}`;
  if (!p.sp && !p.grade && !p.cons && !p.w && !p.tex) return "no SKUs — priced by description · opens the configurator";
  const bits = [
    p.sp || "…species",
    p.grade ? (p.grade === "clear" ? "Clear" : "Character") : null,
    p.cons ? (p.cons === "eng" ? "Engineered" : "Solid") : null,
    p.w ? WIDTH_LABEL[p.w] : null,
    p.tex ? TEXTURES.find((t) => t.id === p.tex).name : null,
  ].filter(Boolean);
  return "opens pre-filled: " + bits.join(" · ");
}

// A parsed query → the { mode, cfg } the popup opens with. Unavailable widths
// snap to the first offered one so the popup never opens on a dead combo.
export function seedFromQuery(q) {
  const p = parseQuery(q);
  if (p.mode === "vent") {
    const cfg = defaultConfig("vent");
    if (p.sp && VENT_GROUP[p.sp]) cfg.sp = p.sp;
    return { mode: "vent", cfg };
  }
  if (p.mode === "damper") return { mode: "damper", cfg: defaultConfig("damper") };
  if (p.mode === "hb") {
    const cfg = defaultConfig("hb");
    if (p.sp && HERRINGBONE.solid[p.sp]) cfg.sp = p.sp;
    if (p.cons) cfg.cons = p.cons;
    if (p.chevron) cfg.chevron = true;
    const t = HERRINGBONE[cfg.cons === "solid" ? "solid" : "eng"][cfg.sp];
    if (p.w && t.ws.includes(p.w)) cfg.w = p.w;
    else if (!t.ws.includes(cfg.w)) cfg.w = t.ws[0];
    return { mode: "hb", cfg };
  }
  const cfg = defaultConfig("floor");
  if (p.sp) cfg.sp = p.sp;
  if (p.grade) cfg.grade = p.grade;
  if (p.cons) cfg.cons = p.cons;
  if (p.w) cfg.w = p.w;
  if (p.tex) cfg.tex = p.tex;
  if (floorBase(cfg) == N) {
    const w2 = floorWidths(cfg).find((w) => floorBase({ ...cfg, w }) != N);
    if (w2 != null) cfg.w = w2;
  }
  return { mode: "floor", cfg };
}

// --- basket persistence normalizer -----------------------------------------------

const bkId = () => "bk" + Math.random().toString(36).slice(2, 9);

// Normalize one persisted basket entry; returns null for junk so a bad record
// can't crash the drawer. Called by App.jsx normC over sheogaBasket.
export function normBasketEntry(e) {
  if (!e || typeof e !== "object") return null;
  const head = { id: e.id || bkId(), addedAt: e.addedAt || Date.now(), markupPct: Number.isFinite(Number(e.markupPct)) ? Number(e.markupPct) : DEFAULT_MARKUP };
  if (e.kind === "bundle") {
    if (!e.base || !e.base.cfg) return null;
    const widths = (Array.isArray(e.widths) ? e.widths : [])
      .filter((w) => w && Number.isFinite(+w.w))
      .map((w) => ({ w: +w.w, share: Number(w.share) || 0 }));
    if (widths.length < 2) return null;
    return { ...head, kind: "bundle", base: { mode: e.base.mode === "stocked" ? "stocked" : "floor", cfg: e.base.cfg }, widths, sf: Number(e.sf) || 0 };
  }
  if (!e.snap || !e.snap.cfg) return null;
  return { ...head, kind: "single", snap: { mode: e.snap.mode || "floor", cfg: e.snap.cfg }, sf: Number(e.sf) || 0 };
}
