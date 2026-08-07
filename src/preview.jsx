// Preview harness for the price-book item table redo + the Claude issue bucket:
// the REAL BookDetail over mocked items — every Size / Cov. / Price cell derives
// through the real pick path (bookRowPreview → stockPatch), nothing typed into
// this page. No Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BookDetail } from "./pricebooklib.jsx";
import { normOrderItem } from "./orderbook.js";
import { TYPES, TLBL } from "./uiconst.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

const DAY = 86400000;
const BOOK = {
  id: "vtc", kind: "order", name: "Virginia Tile — Anatolia", active: true,
  data: { markups: { default: 45, groupBy: "mfg" }, lastImport: { at: Date.now() - 12 * DAY, by: "Sam", count: 9 } },
};

const it = (f) => normOrderItem({ bookId: "vtc", ...f });
// One row per import shape worth troubleshooting: a clean carton tile, a mosaic
// sheet (coverage divided down), an unparsed size (amber), a trim missing its
// PC/CT (hazard flag), a roll accessory, an unpriced row, a disabled retiree,
// and a hand-edited row parked in the Claude bucket.
const ITEMS = [
  it({ sku: "ANA1224P", type: "tile", description: "Mayfair Statuario 12X24 Polished", brand: "Anatolia", mfg: "ANATOLIA", productLine: "Mayfair", color: "Statuario", style: "Polished", size: '12"X24"', thickness: "10mm", priceUnit: "SF", orderUnit: "CT", cost: 3.19, sfPerUnit: 15.5, pcPerUnit: 8, leadTime: "3-5 days", section: "Porcelain" }),
  it({ sku: "ANAHEX2M", type: "tile", description: "Carrara 2\" Hex Mosaic Matte", mfg: "ANATOLIA", size: '2" Hex', sheetSize: "10x12", unit: "SH", cost: 14.25, sfPerUnit: 5.38, pcPerUnit: 6, msrp: 24.99, leadTime: "1 wk" }),
  it({ sku: "ANADECO", type: "tile", description: "Fresco Deco Panel", mfg: "ANATOLIA", size: "Random Deco", cost: 89, sfPerUnit: 10, unit: "CT", note: "special order only" }),
  it({ sku: "ANABN312", description: "Bullnose 3X12 Statuario", mfg: "ANATOLIA", size: "3X12", cost: 27.99, priceUnit: "PC", orderUnit: "CT", trim: true, trimSignal: "lexicon", fits: "ANA1224P", sfPerUnit: 10.76, claudeIssue: { by: "Sam", at: Date.now() - DAY } }),
  it({ sku: "SCHKERDI108", description: "KERDI Waterproofing Membrane 108 sqft", mfg: "SCHLUTER", unit: "RL", cost: 56.13, leadTime: "stock" }),
  it({ sku: "ANAPG2448", type: "tile", description: "Pietra Grey 24X48", mfg: "ANATOLIA", size: "24X48", unit: "CT", sfPerUnit: 15.5 }),
  it({ sku: "ANAOLD18", type: "tile", description: "Retired Beige 18X18", mfg: "ANATOLIA", size: "18X18", cost: 1.99, sfPerUnit: 17.6, unit: "CT", disabled: true, discontinued: true }),
  it({ sku: "ANACAM12", type: "tile", description: "Camden White 12X24 Matte", mfg: "ANATOLIA", size: "12X24", cost: 2.44, sfPerUnit: 15.5, priceUnit: "SF", orderUnit: "CT", editedBy: "Sam", editedAt: Date.now() - 3 * DAY, claudeIssue: { by: "Sam", at: Date.now() - 2 * DAY } }),
];

function Harness() {
  // Local "DB": the harness answers the write paths so the buttons really work.
  const [rows, setRows] = useState(ITEMS);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-6xl">
        <h1 className="ft-serif" style={{ fontSize: 24 }}>Price book — items in project-line order + Claude issue bucket</h1>
        <p className="text-[12.5px] text-slate-500 mt-1 max-w-3xl">
          Columns read like the estimate grid (Size/Type · Product/Color · SKU · Cov. · Price) and the Size, Cov. and Price
          cells show what a pick <em>lands</em> — an unparsed size or a missing price reads amber, exactly the hole the job
          would get. The muted line under each product carries every other stored field. The <span style={{ color: "#D97757" }}>✳</span> button
          parks a SKU in the Claude issue bucket; the Claude filter shows the bucket and copies a paste-ready report.
        </p>
        <BookDetail key="vtc" book={BOOK}
          updateBook={() => {}} delBook={() => {}} onDeleted={() => {}}
          loadBookItems={async () => rows}
          applyBookImport={async () => {}}
          loadBookVersions={async () => []}
          loadBookVersionSnapshot={async () => []}
          pinBookVersion={async () => {}}
          updateBookItem={async (id, item) => item}
          setBookItemsDisabled={async (id, skus, disabled) => setRows((rs) => rs.map((r) => (skus.includes(r.sku) ? { ...r, disabled } : r)))}
          reviewBookItemFlags={async (id, ops) => ops.map(({ item }) => ({ sku: item.sku, flagReview: item.flagReview }))}
          setBookItemIssue={async (id, item, on) => (on ? { by: "Sam", at: Date.now() } : null)}
          hideCosts={false} staleDays={120}
          source={[]} sourcePendingOf={() => null} sourceLiveOf={() => null}
          onRefreshSheet={() => {}} onReviewSheet={() => {}}
          inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
