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
// a hand-edited row parked in the Claude bucket, a sheet whose only U/M column
// is its price basis (the 8/31 Catch Ivory flag — SF bundles nothing, so the
// coverage reads per carton), and a molding carrying the length its column
// header printed (the 8/31 Slim Trim flag).
const ITEMS = [
  it({ sku: "ANA1224P", type: "tile", description: "Mayfair Statuario 12X24 Polished", brand: "Anatolia", mfg: "ANATOLIA", productLine: "Mayfair", color: "Statuario", style: "Polished", size: '12"X24"', thickness: "10mm", priceUnit: "SF", orderUnit: "CT", cost: 3.19, sfPerUnit: 15.5, pcPerUnit: 8, leadTime: "3-5 days", section: "Porcelain" }),
  it({ sku: "ANAHEX2M", type: "tile", description: "Carrara 2\" Hex Mosaic Matte", mfg: "ANATOLIA", size: '2" Hex', sheetSize: "10x12", unit: "SH", cost: 14.25, sfPerUnit: 5.38, pcPerUnit: 6, msrp: 24.99, leadTime: "1 wk" }),
  it({ sku: "ANADECO", type: "tile", description: "Fresco Deco Panel", mfg: "ANATOLIA", size: "Random Deco", cost: 89, sfPerUnit: 10, unit: "CT", note: "special order only" }),
  it({ sku: "ANABN312", description: "Bullnose 3X12 Statuario", mfg: "ANATOLIA", size: "3X12", cost: 27.99, priceUnit: "PC", orderUnit: "CT", trim: true, trimSignal: "lexicon", fits: "ANA1224P", sfPerUnit: 10.76, claudeIssue: { by: "Sam", at: Date.now() - DAY } }),
  it({ sku: "SCHKERDI108", description: "KERDI Waterproofing Membrane 108 sqft", mfg: "SCHLUTER", unit: "RL", cost: 56.13, leadTime: "stock" }),
  it({ sku: "ANAPG2448", type: "tile", description: "Pietra Grey 24X48", mfg: "ANATOLIA", size: "24X48", unit: "CT", sfPerUnit: 15.5 }),
  it({ sku: "ANAOLD18", type: "tile", description: "Retired Beige 18X18", mfg: "ANATOLIA", size: "18X18", cost: 1.99, sfPerUnit: 17.6, unit: "CT", disabled: true, discontinued: true }),
  it({ sku: "F14CATCIV0312P", type: "tile", description: "Catch Ivory Glossy 3X12", mfg: "VTC", size: "3X12", unit: "SF", cost: 3.47, sfPerUnit: 12.15, priceSqft: 5.2 }),
  it({ sku: "335015047", description: "Milled Oak—Copper — Slim Trim - P29 · fits 270266018", mfg: "TARKETT", size: '94"', unit: "EA", cost: 47.94, trim: true, fits: "270266018" }),
  it({ sku: "ANACAM12", type: "tile", description: "Camden White 12X24 Matte", mfg: "ANATOLIA", size: "12X24", cost: 2.44, sfPerUnit: 15.5, priceUnit: "SF", orderUnit: "CT", editedBy: "Sam", editedAt: Date.now() - 3 * DAY, claudeIssue: { by: "Sam", at: Date.now() - 2 * DAY } }),
];

// A remembered portal sheet feeding the book (shapes vendorfetch expects).
const SHEET = {
  group: { name: "Virginia Tile connect24" },
  sheet: { vendor: "vt", host: "connect24.virginiatile.com", uid: "C28895MM", user: "marcus", filename: "Home Collection EFT 26 02 19.xls", lastFetched: Date.now() - 12 * DAY },
};

// One BookDetail over the local mock "DB", with the write paths answered so
// the buttons really work. `pending` fakes a fetched sheet awaiting review.
function Case({ label, book, source, pending }) {
  const [rows, setRows] = useState(ITEMS);
  return (
    <div>
      <p className="ft-eyebrow text-[10px] mt-6 mb-1">{label}</p>
      <div className="rounded-lg px-4 pb-4 pt-1" style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border)" }}>
        <BookDetail key={book.id} book={book}
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
          source={source || []} sourcePendingOf={() => (pending ? {} : null)} sourceLiveOf={() => true}
          onRefreshSheet={() => {}} onReviewSheet={() => {}}
          inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} />
      </div>
    </div>
  );
}

function Harness() {
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-6xl">
        <h1 className="ft-serif" style={{ fontSize: 24 }}>Price book page — folder tabs + project-line table + Claude bucket</h1>
        <p className="text-[12.5px] text-slate-500 mt-1 max-w-3xl">
          The real BookDetail over mocked items. Source / Markup / Freight fold behind tabs carrying their live summaries
          (the owner's sketch); a book that needs attention opens on the right tab. The table's Size / Cov. / Price cells show
          what a pick <em>lands</em>, and the <span style={{ color: "#D97757" }}>✳</span> button parks a SKU in the Claude issue bucket.
        </p>
        <Case label="tabs folded — a healthy book (the default)" book={BOOK} source={[SHEET]} />
        <Case label="a fetched sheet awaiting review — opens on Source" book={{ ...BOOK, id: "vtc2" }} source={[SHEET]} pending />
        <Case label="no markup set — opens on Markup, selling at cost" book={{ ...BOOK, id: "vtc3", name: "Virginia Tile — Anatolia (new)", data: { lastImport: BOOK.data.lastImport } }} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
