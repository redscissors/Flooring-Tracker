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
// landKitLines/placedKits/removeKitLines paths.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SchluterConfigurator from "./SchluterConfigurator.jsx";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { normOrderItem } from "./orderbook.js";
import { newProduct, newArea, landKitLines, appendKitLines, moveKitEntries, placedKits, removeKitLines, kitRows } from "./model.js";

// Live rows lead with "Schluter" since ADR 0041 (the EFT import stamps it; the
// ERP export already spells it), so the harness names carry the lead too —
// the popup strips it for display and the shots must prove that.
const lead = (name) => (/^schluter/i.test(name) ? name : `Schluter ${name}`);
const stockRows = FIXTURE_ITEMS.filter((i) => i.stock).map((i) => normOrderItem({
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
  ["SLRKL1AR19EB140","Kerdi-Line 3/4\" Frame Solid Grate","56\"",347.66],
  ["SLRKL1AR19EB150","Kerdi-Line 3/4\" Frame Solid Grate","60\"",365.88],
  ["SLRKL1AR19EB160","Kerdi-Line 3/4\" Frame Solid Grate","64\"",389.54],
  ["SLRKL1AR19EB170","Kerdi-Line 3/4\" Frame Solid Grate","68\"",406.12],
  ["SLRKL1AR19EB180","Kerdi-Line 3/4\" Frame Solid Grate","72\"",429.39],
  ["SLRKL1DRE100","Kerdi-Line Frameless Tileable Grate","40\"",126.33],
  ["SLRKL1DRE120","Kerdi-Line Frameless Tileable Grate","48\"",135.27],
  ["SLRKL1DRE150","Kerdi-Line Frameless Tileable Grate","60\"",166.19],
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
  const [basket, setBasket] = useState([]);
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
      books={[{ id: "bk_eft", kind: "order", active: true, name: "Schluter EFT" }]}
      loadBookItems={async () => eftRows}
      mortars={{ "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 39.21 }, "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 32.5 } }}
      mortarDefault="Schluter All Set"
      basket={basket} onBasketChange={setBasket}
      placed={placedKits(cats, "schluter")}
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
