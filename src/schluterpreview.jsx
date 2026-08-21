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
import { createRoot } from "react-dom/client";
import "./index.css";
import SchluterConfigurator from "./SchluterConfigurator.jsx";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { normOrderItem } from "./orderbook.js";

const stockRows = FIXTURE_ITEMS.filter((i) => i.stock).map((i) => normOrderItem({
  sku: i.erp || i.sku, bookId: "bk_stock", description: i.name, vendorSkus: i.erp ? [i.sku] : [],
  size: i.size || "", unit: i.unit, price: i.price, cost: i.cost, leadTime: i.lead || "",
}));
const eftRows = FIXTURE_ITEMS.filter((i) => !i.stock).map((i) => normOrderItem({
  sku: i.sku, bookId: "bk_eft", description: i.name, size: i.size || "", unit: i.unit,
  cost: i.cost, price: i.price, leadTime: i.lead || "",
}));
// The live EFT book's re-lettered twin of a stocked tray (the dealer sheet
// writes SLRKST965810BF for the stocked KST965/810BF) — carried here so the
// catalog's stock-wins dedup stays visibly exercised: a second 38"×32" row on
// the Kits tab is a regression.
eftRows.push(normOrderItem({
  sku: "SLRKST965810BF", bookId: "bk_eft", unit: "EA", cost: 84.52,
  description: "KERDI-SHOWER-KIT KERDI-SHOWER TT 38 X 32", leadTime: "READY SHIP",
}));

createRoot(document.getElementById("preview")).render(
  <SchluterConfigurator
    seed={null}
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
    onAdd={(rows) => console.log("onAdd", rows)}
    onQuoteOptions={(p) => console.log("onQuoteOptions", p)}
    onClose={() => console.log("onClose")}
    onConfigChange={() => {}}
  />
);
