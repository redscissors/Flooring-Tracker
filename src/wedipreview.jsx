// Preview harness for the wedi configurator (issue 066): the REAL
// WediConfigurator over the real engine, mounted with no Supabase and no App
// shell — the change-control preview shots drive this page.
// Dev-only entry (wedi-preview.html); not part of the app build.
//
// The Schluter registry bag mirrors schluterpreview.jsx exactly — the
// 2026-08-20 fixture pushed BACKWARDS through normOrderItem into live
// registry shape — so the Compare tab (phase 5) prices its Schluter column
// off the same adapter path production runs.
//
// Stateful cats/basket so the ADR 0035 step 3 drawer exercises the real
// landKitLines/placedKits/removeKitLines paths.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WediConfigurator from "./WediConfigurator.jsx";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { normOrderItem, bookItemData, normBookItem } from "./orderbook.js";
import { newProduct, newArea, landKitLines, appendKitLines, moveKitEntries, placedKits, removeKitLines, kitRows } from "./model.js";
import { FIXTURE_ROWS as WEDI_STOCK_ROWS } from "./wedifixture.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";
import { parseMapped } from "./pricebook.js";
import { useMergedResults, Hit } from "./search.jsx";
import { pricedItem } from "./orderbook.js";

const stockRows = FIXTURE_ITEMS.filter((i) => i.stock).map((i) => normOrderItem({
  sku: i.erp || i.sku, bookId: "bk_stock", description: i.name, vendorSkus: i.erp ? [i.sku] : [],
  size: i.size || "", unit: i.unit, price: i.price, cost: i.cost, leadTime: i.lead || "",
}));
const eftRows = FIXTURE_ITEMS.filter((i) => !i.stock).map((i) => normOrderItem({
  sku: i.sku, bookId: "bk_eft", description: i.name, size: i.size || "", unit: i.unit,
  cost: i.cost, price: i.price, leadTime: i.lead || "",
}));

// ?mode=none|stock|so|both|floor — which wedi books exist, for the Browse
// caption's five states (spec 2026-09-02 decision 5/6). `floor` is a
// pricelist book missing the one SKU.* the stock table lacks, so the hook
// refuses it and names it.
const MODE = new URLSearchParams(location.search).get("mode") || "both";
const wediStockRows = WEDI_STOCK_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const wediSoRows = (() => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  const rows = items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
  return MODE === "floor" ? rows.filter((r) => r.sku !== "US5000088") : rows;
})();
const wediBooks = [
  ...(MODE === "stock" || MODE === "both" || MODE === "floor" ? [{ id: "bk_wedi", kind: "stock", active: true, name: "wedi" }] : []),
  ...(MODE === "so" || MODE === "both" || MODE === "floor" ? [{ id: "bk_wedi_so", kind: "order", active: true, name: "wedi" }] : []),
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

// ?search=1 — the selection-row search over the harness's two wedi books
// (the real useMergedResults + Hit rows; the order-book query runs client-side
// as the same every-word ILIKE the server does), to prove a pricelist hit
// whose stocked twin the typed words missed still lands as stock.
const SEARCH = new URLSearchParams(location.search).get("search") === "1";
const soFields = ["sku", "description", "product", "brand", "mfg", "color", "size"];
const searchOrderLocal = async (q) => {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return wediSoRows.filter((it) => !it.disabled && words.every((w) => soFields.some((f) => String(it[f] || "").toLowerCase().includes(w)))).map((it) => pricedItem(it, undefined));
};
function SearchStrip() {
  const [q, setQ] = useState("");
  const stock = wediStockRows.map((it) => ({ ...it, stockKind: true }));
  const { results, total } = useMergedResults(q.length >= 2, stock, q, searchOrderLocal, 0.5, 0.35);
  return (
    <div data-search-strip className="p-4 max-w-[640px]">
      <div className="ft-eyebrow text-[10px] mb-1">Selection-row search (harness) — wedi stock book + wedi pricelist</div>
      <input data-search-q value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the price books…" className="ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
      <div className="mt-1 text-[10.5px]" style={{ color: "#888" }}>{q ? total + " match" + (total === 1 ? "" : "es") : ""}</div>
      <div className="mt-1 rounded-md border border-slate-200 divide-y divide-slate-100">
        {results.map((it) => <div key={(it.bookId || "s") + it.sku} data-hit={it.sku} data-hit-kind={it.stockKind ? "stock" : "order"} className="px-2 py-1 flex items-center gap-2 text-xs"><Hit it={it} bookName={(id) => (id === "bk_wedi" ? "wedi stock" : id === "bk_wedi_so" ? "wedi pricelist" : "book")} /></div>)}
      </div>
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
    <Sheet cats={cats} setCats={setCats} vendor="wedi" onReconfig={(a, p) => setPop((o) => ({ aid: a.id, pid: p.id, seed: p.wedi, n: o.n + 1 }))} />
    <WediConfigurator key={pid + ":" + pop.n} seed={pop.seed}
      wediBuilderPct={18}
      schluterBuilderPct={8}
      areaName="Master bath"
      projectName="Harper — 214 Ridgeway"
      stockRows={stockRows}
      bookStockReady
      books={[{ id: "bk_eft", kind: "order", active: true, name: "Schluter EFT" }, ...wediBooks]}
      loadBookItems={async (id) => (id === "bk_wedi" ? wediStockRows : id === "bk_wedi_so" ? wediSoRows : eftRows)}
      mortars={{ "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 39.21 }, "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 32.5 } }}
      mortarDefault="Schluter All Set"
      basket={basket} onBasketChange={setBasket}
      placed={placedKits(cats, "wedi")}
      onOpenPlaced={(k) => setPop((p) => ({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: p.n + 1 }))}
      onDeleteKit={(k) => setCats((c) => removeKitLines(c, k.areaId, k.rowId) || c)}
      onAdd={(lines) => setCats((c) => { const withRow = c.map((a) => (a.id === aid && !a.products.some((x) => x.id === pid) ? { ...a, products: [...a.products, { ...newProduct(), id: pid }] } : a)); return landKitLines(withRow, aid, pid, lines) || withRow; })}
      editing={row?.wedi?.cfg && !row.wedi.part ? { areaId: aid, rowId: pid, kitId: row.kitId || "" } : null}
      editRows={row?.wedi?.cfg && !row.wedi.part ? kitRows(cats, aid, pid) : null}
      onAddNew={(lines) => setCats((c) => appendKitLines(c, aid, lines))}
      onMoveEntries={(groups, nextBasket) => { setCats((c) => moveKitEntries(c, aid, groups).categories); setBasket(nextBasket); }}
      onQuoteOptions={(p) => console.log("onQuoteOptions", p)}
      onClose={() => console.log("close")} onConfigChange={() => {}}
    />
  </>);
}

createRoot(document.getElementById("preview")).render(SEARCH ? <SearchStrip /> : <Harness />);
