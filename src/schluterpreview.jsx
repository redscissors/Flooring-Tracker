// Preview harness for the Schluter configurator (issue 097 phase 3): the REAL
// SchluterConfigurator over the real engine + adapter, mounted with no
// Supabase and no App shell — the change-control preview shots drive this
// page. Dev-only entry (schluter-preview.html); not part of the app build.
//
// The catalog is the 2026-08-20 fixture pushed BACKWARDS through
// normOrderItem into live registry shape — a stocked row carries the shop
// code in sku with the mfg code in vendorSkus (the ERP stock export), a
// special-order row is EFT-shaped (mfg code as its own sku) — so the preview
// exercises the adapter path end to end, exactly what production runs.
//
// Stateful cats/basket so the ADR 0035 step 3 drawer exercises the real
// landKitLines/placedKits/removeKitLines paths. The basket is the shared
// wedi+Schluter one, so the bag also carries wedipreview.jsx's two wedi books
// (the drawer prices wedi entries off them); `?mixed=1` seeds a wedi entry.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SchluterConfigurator from "./SchluterConfigurator.jsx";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { normOrderItem, normBookItem, bookItemData } from "./orderbook.js";
import { newProduct, newArea, landKitLines, appendKitLines, moveKitEntries, placedKits, removeKitLines, kitRows, OPTION_SLOTS } from "./model.js";
import { compareOptionsPatch, optionsUsed } from "./options.js";
import { FIXTURE_ROWS as WEDI_STOCK_ROWS } from "./wedifixture.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";
import { parseMapped } from "./pricebook.js";
import { kitFor } from "./wedi.js";

// Live rows lead with "Schluter" since ADR 0041 (the EFT import stamps it; the
// ERP export already spells it), so the harness names carry the lead too —
// the popup strips it for display and the shots must prove that.
const lead = (name) => (/^schluter/i.test(name) ? name : `Schluter ${name}`);
// The live stock book's 2" ABS flange kit (owner screenshot 2026-09-30):
// stocked and cheaper than the PVC kit, listed first so the shots prove PVC
// still bills by default and the flange ⇄ offers ABS.
const ABS_FLANGE = { sku: "SLRKD2FLKABS", name: "Kerdi Drain Flange Kit 2\" ABS - KD2FLKABS", unit: "EA", price: 73.38, cost: 48.92, stock: true };
const stockRows = [ABS_FLANGE, ...FIXTURE_ITEMS].filter((i) => i.stock).map((i) => normOrderItem({
  sku: i.erp || i.sku, bookId: "bk_stock", description: lead(i.name), vendorSkus: i.erp ? [i.sku] : [],
  size: i.size || "", unit: i.unit, price: i.price, cost: i.cost, leadTime: i.lead || "",
}));
const eftRows = FIXTURE_ITEMS.filter((i) => !i.stock).map((i) => normOrderItem({
  sku: i.sku, bookId: "bk_eft", description: lead(i.name), size: i.size || "", unit: i.unit,
  cost: i.cost, price: i.price, leadTime: i.lead || "",
}));
// The live stock book's garbled ½" board (a markless "0.5 X 48 X 96"
// description the pre-fix import stored as size "0.5x48" with "X96" left in
// the name) — carried in that stored shape, on the LARGEST panel so it owns
// the wall pick, keeping the engine's KB-code dims fallback visibly
// exercised: a wall line reading "0.5x48" or a fractional-sf panel count
// (the 618-panel bill) is a regression. The 64" board beside it stays clean,
// pinning the sheet-text-preferred path.
const badBoard = stockRows.findIndex((r) => (r.vendorSkus || [])[0] === "KB1212202440");
stockRows[badBoard] = normOrderItem({ ...stockRows[badBoard], description: "X96 KERDI-BOARD PANEL", size: "0.5x48" });

// The live EFT book's re-lettered twin of a stocked tray (the dealer sheet
// writes SLRKST965810BF for the stocked KST965/810BF) — carried here so the
// catalog's stock-wins dedup stays visibly exercised: a second 38"×32" row on
// the Kits tab is a regression.
eftRows.push(normOrderItem({
  sku: "SLRKST965810BF", bookId: "bk_eft", unit: "EA", cost: 84.52,
  description: "Schluter Kerdi-Shower-Kit Kerdi-Shower TT 38 X 32", leadTime: "READY SHIP",
}));

// The 76"-side twin of the stocked KSLT965/1930S (38" side) from the
// 2025-10-01 EFT — same price, channel on the other edge. With both in the
// catalog the Kits tab must show two distinct linear rows, and the Walls ⇄
// rotate must swap one for the other.
eftRows.push(normOrderItem({
  sku: "SLRKSLT1930965S", bookId: "bk_eft", unit: "PC", cost: 211.74, price: 317.61, size: "76x38",
  description: 'Schluter Kerdi-Shower-LTS Tray Perimeter Drain 76" Side', leadTime: "READY SHIP",
}));

// A slice of the EFT's fixed KERDI-LINE range (ticket 158 P0-2) — every
// straight channel length, one grate family, a few frameless grates, an FC
// cover, a sloping profile and the adaptor ring — so Browse shows the new
// KERDI-LINE section over real codes and costs. [sku, description, size, cost]
[
  ["SLRKL1AR19EB50","Kerdi-Line 3/4\" Frame Solid Grate","20\"",199.69],
  ["SLRKL1AR19EB60","Kerdi-Line 3/4\" Frame Solid Grate","24\"",205.42],
  ["SLRKL1AR19EB70","Kerdi-Line 3/4\" Frame Solid Grate","28\"",213.85],
  ["SLRKL1AR19EB80","Kerdi-Line 3/4\" Frame Solid Grate","32\"",219.37],
  ["SLRKL1AR19EB90","Kerdi-Line 3/4\" Frame Solid Grate","36\"",229.7],
  ["SLRKL1AR19EB100","Kerdi-Line 3/4\" Frame Solid Grate","40\"",243.43],
  ["SLRKL1AR19EB110","Kerdi-Line 3/4\" Frame Solid Grate","44\"",249.42],
  ["SLRKL1AR19EB120","Kerdi-Line 3/4\" Frame Solid Grate","48\"",253.92],
  ["SLRKL1AR19EB130","Kerdi-Line 3/4\" Frame Solid Grate","52\"",331.06],
  // Illustrative finish rows (harness only, not EFT costs) so the finish chips show Schluter's names.
  ["SLRKL1AR19MBW130","Kerdi-Line 3/4\" Frame Solid Grate Matte White","52\"",383.18],
  ["SLRKL1AR19MGS130","Kerdi-Line 3/4\" Frame Solid Grate Matte Black","52\"",383.18],
  ["SLRKL1AR19TSG130","Kerdi-Line 3/4\" Frame Solid Grate Textured Pewter","52\"",398.40],
  ["SLRKL1AR19EB140","Kerdi-Line 3/4\" Frame Solid Grate","56\"",347.66],
  ["SLRKL1AR19EB150","Kerdi-Line 3/4\" Frame Solid Grate","60\"",365.88],
  ["SLRKL1AR19EB160","Kerdi-Line 3/4\" Frame Solid Grate","64\"",389.54],
  ["SLRKL1AR19EB170","Kerdi-Line 3/4\" Frame Solid Grate","68\"",406.12],
  ["SLRKL1AR19EB180","Kerdi-Line 3/4\" Frame Solid Grate","72\"",429.39],
  ["SLRKL1DRE100","Kerdi-Line Frameless Tileable Grate","40\"",126.33],
  ["SLRKL1DRE120","Kerdi-Line Frameless Tileable Grate","48\"",135.27],
  ["SLRKL1DRE130","Kerdi-Line Frameless Tileable Grate","52\"",163.10],
  ["SLRKL1DRE150","Kerdi-Line Frameless Tileable Grate","60\"",166.19],
  ["SLRKL1DROE120","Kerdi-Line Frameless Tileable Grate Offset","48\"",135.27],
  ["SLRKL1IFE23EB120","Kerdi-Line 29/32\" Frame Floral Grate","48\"",312.35],
  ["SLRKL1VO60E120","Kerdi-Line Offset Channel Body","48\"",298.54],
  ["SLRKL1V60E50","Kerdi-Line Channel Body","20\"",214.8],
  ["SLRKL1V60E60","Kerdi-Line Channel Body","24\"",221.62],
  ["SLRKL1V60E70","Kerdi-Line Channel Body","28\"",240.72],
  ["SLRKL1V60E80","Kerdi-Line Channel Body","32\"",243.05],
  ["SLRKL1V60E90","Kerdi-Line Channel Body","36\"",253.84],
  ["SLRKL1V60E100","Kerdi-Line Channel Body","40\"",260.92],
  ["SLRKL1V60E110","Kerdi-Line Channel Body","44\"",266.37],
  ["SLRKL1V60E120","Kerdi-Line Channel Body","48\"",278.78],
  ["SLRKL1V60E130","Kerdi-Line Channel Body","52\"",337.81],
  ["SLRKL1V60E140","Kerdi-Line Channel Body","56\"",346.39],
  ["SLRKL1V60E150","Kerdi-Line Channel Body","60\"",354.68],
  ["SLRKL1V60E160","Kerdi-Line Channel Body","64\"",361.56],
  ["SLRKL1V60E170","Kerdi-Line Channel Body","68\"",367.21],
  ["SLRKL1V60E180","Kerdi-Line Channel Body","72\"",373.55],
  ["SLRKLAM5K","Kerdi-Line-A 5-1/2\" Adaptor Ring","",26.82],
  ["SLRSPSA50EB120","Kerdi-Line Sloping Shower Profile H=3/16\" L=47-1/4\"","",45.36],
  ["SLRVKLEB35","Kerdi-Line-FC Grate Connector Brushed Stainless Steel","",10.75],
].forEach(([sku, description, size, cost]) => eftRows.push(normOrderItem({
  sku, bookId: "bk_eft", unit: "PC", cost, size, description: lead(description), leadTime: "READY SHIP",
})));

// A second KERDI-BAND width (ticket 158 Phase 1b) so the band ⇄ shows a Width
// row: the 7-1/4" full roll, special order. Illustrative cost, not an EFT figure.
eftRows.push(normOrderItem({
  sku: "SLRKEBA100/185", bookId: "bk_eft", unit: "RL", cost: 93.2, size: "98'5\" roll",
  description: lead('Kerdi-Band 7-1/4" Seam Band'), leadTime: "READY SHIP",
}));
// ...and a stocked 10" width after it, so under Stock only the Width row
// shows the stocked-first order (10" ahead of the special-order 7-1/4").
// Illustrative stock row, not a real shelf item.
stockRows.push(normOrderItem({
  sku: "1509799", bookId: "bk_stock", vendorSkus: ["KEBA100/250/5M"], unit: "RL", cost: 24.1, price: 36.15,
  size: "16'5\" roll", description: lead('KERDI-BAND 10" seam band'), leadTime: "READY SHIP",
}));

const wediStockRows = WEDI_STOCK_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const wediSoRows = (() => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
})();
const BOOKS = [
  { id: "bk_eft", kind: "order", active: true, name: "Schluter EFT" },
  { id: "bk_wedi", kind: "stock", active: true, name: "wedi" },
  { id: "bk_wedi_so", kind: "order", active: true, name: "wedi" },
];
// ?slow=1 holds the wedi books back 5s, so the drawer's still-loading path shows.
const SLOW = new URLSearchParams(location.search).get("slow") === "1";
const loadBookItems = async (id) => {
  if (SLOW && id.startsWith("bk_wedi")) await new Promise((r) => setTimeout(r, 5000));
  return id === "bk_wedi" ? wediStockRows : id === "bk_wedi_so" ? wediSoRows : eftRows;
};

const MIXED = new URLSearchParams(location.search).get("mixed") === "1";
const wediKit = kitFor("US9100001", {});
const WEDI_ENTRY = { id: "seed-wedi", kind: "kit", brand: "wedi", addedAt: 1, snap: { mode: wediKit.mode, cfg: wediKit.cfg } };
const tagged = (cats) => [
  ...placedKits(cats, "wedi").map((k) => ({ ...k, brand: "wedi" })),
  ...placedKits(cats, "schluter").map((k) => ({ ...k, brand: "schluter" })),
];

// The harness "sheet" — the placed rows as the job sheet holds them, with a
// qty box per row and Reconfigure on each anchor, so the drive can prove a
// sheet-edited quantity reopens as the popup's override (owner 2026-09-02).
function Sheet({ cats, setCats, vendor, onReconfig }) {
  const rows = cats.flatMap((a) => a.products.filter((p) => p[vendor]).map((p) => ({ a, p })));
  if (!rows.length) return null;
  const setQty = (a, p, qty) => setCats((c) => c.map((x) => (x.id !== a.id ? x : { ...x, products: x.products.map((r) => (r.id === p.id ? { ...r, qty } : r)) })));
  return (
    <div data-sheet className="fixed top-2 left-2 z-[80] border rounded-md bg-white text-[11px]" style={{ width: 330, maxHeight: "90vh", overflow: "auto", borderColor: "#c8c8c0" }}>
      <div className="px-2 py-1 font-extrabold uppercase tracking-wider text-[9.5px]" style={{ color: "#777" }}>Job sheet (harness) — {rows.length} rows</div>
      {rows.map(({ a, p }) => (
        <div key={p.id} className="flex items-center gap-2 px-2 py-0.5 border-t" style={{ borderColor: "#eee" }} data-sheet-row={p.id}>
          <span className="ft-mono w-16 shrink-0" style={{ color: "#888" }}>{p.sku || "—"}</span>
          <span className="truncate flex-1">{p.brandColor}</span>
          <input data-sheet-qty={p.id} type="number" value={p.qty} onChange={(e) => setQty(a, p, e.target.value)} className="ft-cell w-14 text-right border rounded px-1" style={{ borderColor: "#ccc" }} />
          {p[vendor].cfg && !p[vendor].part && <button data-sheet-reconfig={p.id} className="rounded-full border px-2 font-medium" style={{ borderColor: "#3f6b45", color: "#3f6b45" }} onClick={() => onReconfig(a, p)}>{vendor} — reconfigure</button>}
        </div>
      ))}
    </div>
  );
}

function Harness() {
  const [cats, setCats] = useState([{ ...newArea(), name: "Master bath", products: [newProduct()] }]);
  const [basket, setBasket] = useState(MIXED ? [WEDI_ENTRY] : []);
  const [pop, setPop] = useState({ aid: null, pid: null, seed: null, n: 0 });
  const aid = pop.aid || cats[0].id, pid = pop.pid || cats[0].products.at(-1).id;
  const row = cats.find((a) => a.id === aid)?.products.find((p2) => p2.id === pid);
  return (<>
    <Sheet cats={cats} setCats={setCats} vendor="schluter" onReconfig={(a, p) => setPop((o) => ({ aid: a.id, pid: p.id, seed: p.schluter, n: o.n + 1 }))} />
    <SchluterConfigurator key={pid + ":" + pop.n} seed={pop.seed}
      schluterBuilderPct={8}
      wediBuilderPct={18}
      areaName="Master bath"
      projectName="Harper — 214 Ridgeway"
      stockRows={stockRows}
      bookStockReady
      books={BOOKS}
      loadBookItems={loadBookItems}
      mortars={{ "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 39.21 }, "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 32.5 } }}
      mortarDefault="Schluter All Set"
      basket={basket} onBasketChange={setBasket}
      placed={tagged(cats)}
      freeSlots={OPTION_SLOTS.filter((s) => !optionsUsed(cats).includes(s))}
      onAddOptions={(options, nextBasket) => { const patch = compareOptionsPatch({ categories: cats }, aid, { options, label: "Master bath" }); if (!patch) return false; setCats(patch.categories); setBasket(nextBasket); return true; }}
      onOpenPlaced={(k) => setPop((p) => ({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: p.n + 1 }))}
      onDeleteKit={(k) => setCats((c) => removeKitLines(c, k.areaId, k.rowId) || c)}
      onAdd={(lines) => setCats((c) => { const withRow = c.map((a) => (a.id === aid && !a.products.some((x) => x.id === pid) ? { ...a, products: [...a.products, { ...newProduct(), id: pid }] } : a)); return landKitLines(withRow, aid, pid, lines) || withRow; })}
      editing={row?.schluter?.cfg && !row.schluter.part ? { areaId: aid, rowId: pid, kitId: row.kitId || "" } : null}
      editRows={row?.schluter?.cfg && !row.schluter.part ? kitRows(cats, aid, pid) : null}
      onAddNew={(lines) => setCats((c) => appendKitLines(c, aid, lines))}
      onMoveEntries={(groups, nextBasket) => { setCats((c) => moveKitEntries(c, aid, groups).categories); setBasket(nextBasket); }}
      onQuoteOptions={(p) => console.log("onQuoteOptions", p)}
      onClose={() => console.log("close")} onConfigChange={() => {}}
    />
  </>);
}

createRoot(document.getElementById("preview")).render(<Harness />);
