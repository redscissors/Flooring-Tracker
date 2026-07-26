// Preview proof (2026-07-26): cost + common-markup popup off the price cell.
// Every row below is the REAL GridPriceCell / MobileRowSheet holding real state
// through the real editCost / editMarkup / editPrice patches — Playwright
// clicks and types into them for the screenshots. Built by
// proof-vite.config.mjs, never shipped with the app.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { GridPriceCell, GRID_COLS } from "../../src/grid.jsx";
import { MobileRowSheet } from "../../src/mobile.jsx";
import { normalizeSettings } from "../../src/catalog.js";
import { tierView, tierUnitPrice, employeeNoCost } from "../../src/pricing.js";
import { lineTotal } from "../../src/print.js";
import { specialOrderMargin } from "../../src/orderbook.js";
import { newProduct, newProject, newArea, money } from "../../src/model.js";
import { num } from "../../src/catalog.js";
import "../../src/index.css";

const settings = normalizeSettings();

const row = (over) => ({ ...newProduct(), ...over });
const MANUAL = row({ type: "tile", L: "12", W: "24", brandColor: "Emser Fixture Matte Grey", qty: "180", priceSqft: "" });
const MISC = row({ type: "misc", qtyType: "count", brandColor: "Stair nose, site finished", qty: "6", priceSqft: "", sellUnit: "" });
const BOOKED = row({ type: "vinyl", sku: "1517410", bookId: "bk1", brandColor: "Mannington AduraMax Fossil", qty: "240", cartonSf: "23.76", cartonUnit: "CT", priceSqft: "5.95", costSqft: "3.97", markupPct: "50" });

// One live grid row's price cell, in the real 9-column frame so the popup lands
// where it lands in the app.
function PriceRow({ init, tier = "retail", unit = "sf", label, note, testid }) {
  const [p, setP] = useState(init);
  const proj = { ...newProject(), priceTier: tier, categories: [] };
  const { pct } = tierView(proj, settings);
  const tPrice = tier !== "retail" ? tierUnitPrice(p, tier, pct) : null;
  const noCost = tier === "employee" && employeeNoCost(p);
  const line = lineTotal(p, null, null, num(tPrice ?? p.priceSqft));
  return (
    <div className="card">
      <div className="cap">{label}</div>
      {note && <div className="note">{note}</div>}
      <div className="rowframe" style={{ display: "grid", gridTemplateColumns: GRID_COLS, fontSize: 11, fontWeight: 600 }}>
        <div className="gc">{p.L ? `${p.L}×${p.W}` : "—"}</div>
        <div className="gc">{p.brandColor}</div>
        <div className="gc mono">{p.sku || ""}</div>
        <div className="gc mono r">{p.cartonSf || "—"}</div>
        <div className="gc r">{p.qty}</div>
        <div className="gc" data-testid={testid}>
          <GridPriceCell p={p} tier={tier} tierPrice={tPrice} noCost={noCost} unit={unit} tabIndex={0}
            onPatch={(patch) => setP((cur) => ({ ...cur, ...patch }))}
            title={unit === "sf" ? "Price per sq ft" : `Price per ${unit}`} />
        </div>
        <div className="gc r">{p.qty} {unit}</div>
        <div className="gc r b">{line > 0 ? money(line) : "—"}</div>
        <div className="gc" />
      </div>
      <div className="stored">
        stored on the row → <code>priceSqft {p.priceSqft || '""'}</code> · <code>costSqft {p.costSqft || '""'}</code> · <code>markupPct {p.markupPct || '""'}</code>
        {num(p.costSqft) > 0 && num(p.priceSqft) > 0 && (
          <> · job margin line reads <b>{money(specialOrderMargin([{ sell: line, cost: lineTotal(p, null, null, num(p.costSqft)), markupPct: num(p.markupPct) }]).margin)}</b></>
        )}
      </div>
    </div>
  );
}

// The row sheet renders as a full-screen portal, so the phone gets its own
// page load (?phone) — otherwise its scrim sits over the desktop rows.
function Phone() {
  const [p, setP] = useState(row({ type: "tile", L: "12", W: "24", brandColor: "Emser Fixture Matte Grey", qty: "180", priceSqft: "8.50", costSqft: "5.10", markupPct: "" }));
  const proj = { ...newProject(), categories: [{ ...newArea(), products: [p] }] };
  return (
    <div className="phone">
      <MobileRowSheet p={p} areaName="Kitchen" canDelete settings={settings} stock={[]} groutStock={[]}
        stockReady bookStockReady isBookFam={() => false} gFamilies={[]} searchOrder={null} bookName={() => ""}
        tv={tierView(proj, settings)} onPatch={(patch) => setP((cur) => ({ ...cur, ...patch }))}
        onPickStock={() => {}} onOpenSheoga={() => {}} onDelete={() => {}} onClose={() => {}} notify={() => {}} />
    </div>
  );
}

const phoneOnly = location.search.includes("phone");
if (phoneOnly) createRoot(document.getElementById("mobile")).render(<Phone />);
else createRoot(document.getElementById("desktop")).render(<>
  <PriceRow testid="manual" label="1 · Manual line — nothing but a type and a description" unit="sf"
    init={MANUAL} note="The price cell is the only place the grid prices a line. Clicking (or tabbing into) it opens cost → markup → price." />
  <PriceRow testid="misc" label="2 · Misc count line — the popup follows the row's own sell unit" unit="ea"
    init={MISC} note="A count line reads “per ea”, a roll line “per rl” — the same unit vocabulary the print and order panel use." />
  <PriceRow testid="employee" label="3 · Employee tier, a line the tier can't price" unit="sf" tier="employee"
    init={{ ...MANUAL, priceSqft: "8.50" }} note="Employee is cost × 1.06, so a costless line falls back to retail and says so in red. Typing a cost in the popup is what fixes it — nothing else in the app could." />
  <PriceRow testid="booked" label="4 · Price-book line — the popup shows what the pick already snapshotted" unit="sf"
    init={BOOKED} note="Nothing changed for picked rows: the same costSqft/markupPct a pick writes is what the popup edits, so a book row opens filled in." />
</>);
