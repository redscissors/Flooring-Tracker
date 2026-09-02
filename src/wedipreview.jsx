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
import { newProduct, newArea, landKitLines, appendKitLines, moveKitEntries, placedKits, removeKitLines } from "./model.js";
import { FIXTURE_ROWS as WEDI_STOCK_ROWS } from "./wedifixture.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";
import { parseMapped } from "./pricebook.js";

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

function Harness() {
  const [cats, setCats] = useState([{ ...newArea(), name: "Master bath", products: [newProduct()] }]);
  const [basket, setBasket] = useState([]);
  const [pop, setPop] = useState({ aid: null, pid: null, seed: null, n: 0 });
  const aid = pop.aid || cats[0].id, pid = pop.pid || cats[0].products.at(-1).id;
  const row = cats.find((a) => a.id === aid)?.products.find((p2) => p2.id === pid);
  return (
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
      onAddNew={(lines) => setCats((c) => appendKitLines(c, aid, lines))}
      onMoveEntries={(groups, nextBasket) => { setCats((c) => moveKitEntries(c, aid, groups).categories); setBasket(nextBasket); }}
      onQuoteOptions={(p) => console.log("onQuoteOptions", p)}
      onClose={() => console.log("close")} onConfigChange={() => {}}
    />
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
