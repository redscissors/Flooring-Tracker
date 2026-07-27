// Preview harness for "a quantity-less order line keys as 1" (2026-07-27).
// Renders the REAL OrderEntryPanel over the REAL orderEntryRow output, so the
// "after" column is literally what the panel shows now. The "before" column is
// the same rows with the old outcome restored: the old code took the row's own
// quantity, so a blank one gave qty 0 → qtyText "—", and because per-unit
// cost/sell are the extended totals ÷ qty (and the extended totals were
// themselves 0 at qty 0), both priced at $0.00. Served by the vite dev server;
// never shipped (lives in .scratch).
import React from "react";
import { createRoot } from "react-dom/client";
import { OrderEntryPanel } from "../../src/orderentry.jsx";
import { orderEntryRow } from "../../src/print.js";
import { normalizeSettings } from "../../src/catalog.js";
import { newProduct } from "../../src/model.js";
import "../../src/index.css";

const s = normalizeSettings();
const STOCK_BOOKS = new Set(["bkOHIVA"]);
const row = (over) => ({ ...newProduct(), ...over });

// A real morning at the desk: the customer has picked everything, the field
// measure isn't back yet, and the salesperson wants the special order placed.
const PRODUCTS = [
  // ── special order (a vendor book's bookId) ──
  row({ id: "p1", type: "tile", sku: "ANA-1224", brandColor: "Anatolia Marlow Fog", sizeText: "12 × 24", bookId: "bkVTC", priceSqft: "6.50", costSqft: "4.13", markupPct: "57", cartonSf: "15.5", qty: "" }),
  row({ id: "p2", type: "vinyl", sku: "MPB770", brandColor: "Mannington Adura Napa Dry Cork", sizeText: "6 × 48", bookId: "bkVTC", priceSqft: "4.29", costSqft: "2.86", qty: "" }),
  row({ id: "p3", type: "tile", sku: "ANA-3060", brandColor: "Anatolia Marlow Fog", sizeText: "3 × 6", bookId: "bkVTC", priceSqft: "8.40", costSqft: "5.25", cartonSf: "10.76", qty: "96" }),
  // ── stock (a stock-kind book's bookId — the shop's own SKUs) ──
  row({ id: "p4", type: "misc", qtyType: "count", sku: "23015", brandColor: "Schluter Kerdi-Band 5″ × 98′", bookId: "bkOHIVA", sellUnit: "RL", priceSqft: "84.20", qty: "0" }),
  row({ id: "p5", type: "tile", sku: "31180", brandColor: "Halcyon Grey Matte Porcelain", sizeText: "12 × 24", bookId: "bkOHIVA", priceSqft: "3.09", cartonSf: "15.5", qty: "" }),
  row({ id: "p6", type: "misc", qtyType: "count", sku: "29490", brandColor: "Aquamix Grout Haze Remover", bookId: "bkOHIVA", priceSqft: "14.24", qty: "2" }),
];

const AFTER = PRODUCTS.map((p) => orderEntryRow(p, s, "Master Bath", 30, STOCK_BOOKS));
// The old outcome for exactly the rows the change touches.
const BEFORE = AFTER.map((r) => (r.qtyAssumed ? { ...r, qty: 0, qtyText: "—", perCost: 0, perSell: 0, qtyAssumed: false } : r));

const split = (rows) => ({ special: rows.filter((r) => r.special), stock: rows.filter((r) => !r.special) });

// The panel is a fixed inset-0 overlay; a transformed wrapper becomes its
// containing block, so two of them sit side by side instead of stacking.
function Pane({ title, note, rows, tone }) {
  const { special, stock } = split(rows);
  return (
    <div>
      <div className="mb-2">
        <div className="ft-eyebrow text-[11px] tracking-[.12em]" style={{ color: tone }}>{title}</div>
        <div className="text-[12px] text-slate-500">{note}</div>
      </div>
      <div style={{ position: "relative", width: 600, height: 780, transform: "translateZ(0)", overflow: "hidden", borderRadius: 12 }}>
        <OrderEntryPanel name="Whitfield — 4118 Ravenna Rd" special={special} stock={stock} descLimit={30} onClose={() => {}} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <div className="p-6" style={{ background: "var(--ft-paper, #faf8f4)" }}>
    <h1 className="ft-serif text-2xl mb-1">Order entry — a line with no quantity</h1>
    <p className="text-[13px] text-slate-500 mb-5 max-w-[1180px]">
      Four of these six lines have no quantity on the estimate yet. Before, they read “—” with $0.00 cost and sell,
      and the stock lines copied as <span className="ft-mono">SKU⇥0</span>, which the ERP will not take. Now each keys as
      one of its own sell unit — a whole carton where the row is carton-sold — and the row turns amber so the number is
      visibly the panel’s, not the estimate’s.
    </p>
    <div style={{ display: "flex", gap: 24 }}>
      <Pane title="BEFORE" note="Blank quantity → “—”, $0.00/$0.00, copies as SKU⇥0" rows={BEFORE} tone="#b91c1c" />
      <Pane title="AFTER" note="Keyed as 1 in the sell unit, priced, flagged amber" rows={AFTER} tone="#b45309" />
    </div>
  </div>,
);
