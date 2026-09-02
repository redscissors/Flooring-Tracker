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

const stockRows = FIXTURE_ITEMS.filter((i) => i.stock).map((i) => normOrderItem({
  sku: i.erp || i.sku, bookId: "bk_stock", description: i.name, vendorSkus: i.erp ? [i.sku] : [],
  size: i.size || "", unit: i.unit, price: i.price, cost: i.cost, leadTime: i.lead || "",
}));
const eftRows = FIXTURE_ITEMS.filter((i) => !i.stock).map((i) => normOrderItem({
  sku: i.sku, bookId: "bk_eft", description: i.name, size: i.size || "", unit: i.unit,
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
  description: "KERDI-SHOWER-KIT KERDI-SHOWER TT 38 X 32", leadTime: "READY SHIP",
}));

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
