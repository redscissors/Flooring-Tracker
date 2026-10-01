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
// header printed (the 8/31 Slim Trim flag), and a mosaic whose bare L×W is its
// sheet (the 9/16 Tuscany flag).
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
  // The 9/16 Tuscany flag: a mosaic whose only printed L×W is its backing sheet
  // ("HEXAGON MOSAIC 10X12", 4.09 SF/CT ÷ 5 PC) — the import now files it as
  // sheetSize, so the pick reads "10x12 sheet" with the chip left to the row.
  it({ sku: "VTCTUWHMOSHEX", type: "tile", description: "Tuscany White Hexagon Mosaic", mfg: "VTC", productLine: "TUSCANY", sheetSize: "10x12", unit: "PC", orderUnit: "PC", cost: 23.44, sfPerUnit: 4.09, pcPerUnit: 5, leadTime: "READY SHIP", claudeIssue: { by: "Marcus", at: Date.now() - DAY } }),
  it({ sku: "ANACAM12", type: "tile", description: "Camden White 12X24 Matte", mfg: "ANATOLIA", size: "12X24", cost: 2.44, sfPerUnit: 15.5, priceUnit: "SF", orderUnit: "CT", editedBy: "Sam", editedAt: Date.now() - 3 * DAY, claudeIssue: { by: "Sam", at: Date.now() - 2 * DAY } }),
];

// The ERP stock export (VIRTI rows as the real import stores them, 2026-10-01): a stock book's pick lands
// without the item's own manufacturer codes; the muted line under Product
// still shows the full stored description.
const STOCK_BOOK = { id: "virti", kind: "stock", name: "VIRTI — stock", active: true, data: { lastImport: BOOK.data.lastImport } };
const sit = (f) => normOrderItem({ bookId: "virti", ...f });
const STOCK_ITEMS = [
  sit({ sku: "22969", description: "Mayfair Polished - 4500-0413-1 Vol Grig", size: "12x24", vendorSkus: ["4500-0413-1", "ANAMYVO1224PN"], type: "tile", unit: "CT", cost: 54.25, price: 93.23, sfPerUnit: 15.5 }),
  sit({ sku: "29139", description: "AO Profiles Tile - 006136MODSP4 Des Wh", size: "3x6", vendorSkus: ["006136MODSP4", "AOT6136"], type: "tile", unit: "CT", cost: 31.25, price: 52.31, sfPerUnit: 12.5 }),
  sit({ sku: "29574", description: "Schluter Rondec - RO100AT Satin Nickel", size: "3/8\"x8'", vendorSkus: ["SLRRO100AT"], unit: "EA", cost: 11.77, price: 17.65 }),
  sit({ sku: "1509790", description: "90 Kerdi Kereck F Inside - KERECK/FI10 10/pk", vendorSkus: ["KERECK/FI10"], unit: "PK", cost: 48.61, price: 72.92 }),
  sit({ sku: "1509791", description: "90 Kerdi Kereck F Inside - KERECK/FI2 2/pk", vendorSkus: ["KERECK/FI2"], unit: "PK", cost: 10.21, price: 15.32 }),
  sit({ sku: "1518114", description: "Marazzi Terramater Moss - TM22RCT415AGL", size: "4x15", vendorSkus: ["MRZTM22415G"], type: "tile", unit: "CT", cost: 59.07, price: 102.79, sfPerUnit: 10.29 }),
  sit({ sku: "1518129", type: "tile", description: "VT Quartz Essence Nest - U4P4E3C2", size: "12x24", vendorSkus: ["CAEQENS1224R"], unit: "CT", cost: 50.85, price: 90.85, sfPerUnit: 13.56 }),
  sit({ sku: "29498", description: "Durock Seam Tape", size: "250'", vendorSkus: ["DURROCKTAPE250"], unit: "RL", cost: 9.5, price: 14.25 }),
];

// A remembered portal sheet feeding the book (shapes vendorfetch expects).
const SHEET = {
  group: { name: "Virginia Tile connect24" },
  sheet: { vendor: "vt", host: "connect24.virginiatile.com", uid: "C28895MM", user: "marcus", filename: "Home Collection EFT 26 02 19.xls", lastFetched: Date.now() - 12 * DAY },
};

// One BookDetail over the local mock "DB", with the write paths answered so
// the buttons really work. `pending` fakes a fetched sheet awaiting review.
function Case({ label, book, source, pending, items = ITEMS }) {
  const [rows, setRows] = useState(items);
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
        <Case label="a stock book (ERP export) — picks land without the item's own manufacturer codes" book={STOCK_BOOK} items={STOCK_ITEMS} />
        <Case label="tabs folded — a healthy book (the default)" book={BOOK} source={[SHEET]} />
        <Case label="a fetched sheet awaiting review — opens on Source" book={{ ...BOOK, id: "vtc2" }} source={[SHEET]} pending />
        <Case label="no markup set — opens on Markup, selling at cost" book={{ ...BOOK, id: "vtc3", name: "Virginia Tile — Anatolia (new)", data: { lastImport: BOOK.data.lastImport } }} />
        <Case label="a book that publishes its own retail (wedi, ADR 0038) — no markup, not flagged" book={{ ...BOOK, id: "wedi", name: "wedi", data: { lastImport: BOOK.data.lastImport, mapping: { columns: { 0: "sku", 1: "description", 2: "size", 3: "note", 4: "price", 5: "cost", 6: "section", 7: "vendorSku" }, groupBy: "section" } } }} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
