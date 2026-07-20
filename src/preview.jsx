// Preview harness for "Sheoga lines file under Special order". Renders the REAL
// OrderEntryPanel over rows built from the REAL sheoga.lineItems() payloads and
// classified by the REAL isSpecialOrder / orderCopyText — so what shows here is
// the code path the app runs, without touching Supabase or signing in.
// Dev-only entry (preview.html); not part of the app build.
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrderEntryPanel } from "./orderentry.jsx";
import { isSpecialOrder, orderCopyText } from "./orderentry.js";
import { lineItems, defaultConfig } from "./sheoga.js";

// A configured prefinished floor with a custom color — a main floor line plus
// the two fees it drags along (small-order + color-match sample), which is the
// case that used to scatter three red "no SKU" rows through the Stock list.
const floorCfg = { ...defaultConfig("floor"), sp: "White Oak", w: 5.25, finish: "t1", sample: true };
const sheogaLines = lineItems({ mode: "floor", cfg: floorCfg }, { sf: 240, markupPct: 40 });
const ventLines = lineItems({ mode: "vent", cfg: { ...defaultConfig("vent"), sp: "Walnut", size: "4×12", qty: 6 } }, { sf: 0 });

// Stand-ins for the two row kinds that already worked, so the change can be read
// against them: a price-book special (has a SKU) and a plain stock row.
const bookRow = {
  id: "bk1", bookId: "bkVTC", sku: "ANA-CAR-1224", brandColor: "Anatolia Carrara Bianco",
  sizeText: '12" × 24"', qtyType: "sqft", qty: "310", cartonSf: "15.5",
  priceSqft: "7.20", costSqft: "4.10",
};
const stockRow = { id: "st1", sku: "SCH-DIL-8MM", brandColor: "Schluter Ditra 8mm", qtyType: "count", qty: "4" };

// The display fields orderEntryRow() derives from the snapshotted row. The
// quantity/price math it does (printProduct, orderLineCost) needs App.jsx's
// whole calc chain, so the harness states plausible numbers directly — the
// SECTION SPLIT and the COPIED TEXT, which is what changed, come from the real
// exported helpers below.
const ROW_NUMBERS = {
  bk1: { qty: 20, unitCode: "CT", tag: "CT", coverage: "15.5 SF/CT", perCost: 63.55, perSell: 111.6 },
  st1: { qty: 4, unitCode: "EA", tag: "", coverage: "", perCost: 0, perSell: 0 },
};
const sheogaNumbers = [
  { qty: 12, unitCode: "CT", tag: "CT", coverage: "20.5 SF/CT" },
  { qty: 1, unitCode: "EA", tag: "", coverage: "" },
  { qty: 1, unitCode: "EA", tag: "", coverage: "" },
];

const toRow = (p, nums) => {
  const byDesc = !!p.sheoga && !p.sku;
  const sell = Number(p.priceSqft || 0);
  const cost = Number(p.costSqft || 0);
  const r = {
    id: p.id, special: isSpecialOrder(p), byDesc, area: "Kitchen",
    tag: nums.tag, sizePlain: p.sizeText || "", name: String(p.brandColor || ""), sku: p.sku || "",
    coverage: nums.coverage, qty: nums.qty, unitCode: nums.unitCode,
    qtyText: nums.qty > 0 ? `${nums.qty} ${nums.unitCode}` : "—",
    perCost: nums.perCost ?? (nums.unitCode === "CT" ? cost * 20.5 : cost),
    perSell: nums.perSell ?? (nums.unitCode === "CT" ? sell * 20.5 : sell),
  };
  return { ...r, copy: orderCopyText(r) };
};

const rows = [
  toRow({ ...bookRow }, ROW_NUMBERS.bk1),
  ...sheogaLines.map((p, i) => toRow({ ...p, id: `sh${i}` }, sheogaNumbers[i] || sheogaNumbers[1])),
  toRow({ ...ventLines[0], id: "shv" }, { qty: 6, unitCode: "PC", tag: "", coverage: "" }),
  toRow({ ...stockRow }, ROW_NUMBERS.st1),
];

function Preview() {
  const [before, setBefore] = React.useState(false);
  // "Before" reproduces the old predicate (bookId only) so the fix is visible as
  // a change, not just as a screenshot of the current state.
  const special = rows.filter((r) => (before ? r.sku && r.id.startsWith("bk") : r.special));
  const stock = rows.filter((r) => !special.includes(r));
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      {/* The panel is a fixed inset-0 overlay, so the harness controls have to
          sit above it to stay clickable. */}
      <div className="max-w-3xl relative z-[60]">
        <h1 className="text-lg font-semibold mb-1">Sheoga lines belong to Special order</h1>
        <p className="text-xs text-slate-500 mb-4 max-w-xl">
          A configured Sheoga floor (5¼" White Oak, custom T-1 color, 240 sf) plus the two fees it
          carries, and a vent line. Rows come from the real <code>lineItems()</code>; the section
          split is the real <code>isSpecialOrder()</code> and the copy text the real{" "}
          <code>orderCopyText()</code>.
        </p>
        <label className="flex items-center gap-2 text-xs mb-4">
          <input type="checkbox" checked={before} onChange={(e) => setBefore(e.target.checked)} />
          Show the old behaviour (classify on <code>bookId</code> alone)
        </label>
        <p className="text-xs mb-6" style={{ color: before ? "#b45309" : "var(--ft-brand-deep)" }}>
          {before
            ? "Before — the 4 Sheoga rows fall into Stock, where they read as red “no SKU” lines and are left out of Copy all."
            : "After — all 4 Sheoga rows sit under Special order, each copying its full description."}
        </p>
      </div>
      <OrderEntryPanel name="Preview — 1421 Maple Ave" special={special} stock={stock} onClose={() => {}} />
    </div>
  );
}

const el = document.getElementById("preview");
const root = (window.__previewRoot ||= createRoot(el));
root.render(<Preview />);
