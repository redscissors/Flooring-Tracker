// Preview harness (2026-07-23): three fixes in one PR —
//   1. the herringbone tab's new Edge dropdown (real SheogaConfigurator),
//   2. Sheoga lines no longer pre-fill the row note (shown in the console log),
//   3. the MPB770 Trims popup fed by the REAL mergeTrimOptions over rows
//      transcribed from the MANMI export Marcus attached.
// Served by the vite dev server at
// /.scratch/047_sheoga-hb-edge-notes-mpb770/preview.html; never shipped.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import SheogaConfigurator from "../../src/SheogaConfigurator.jsx";
import { defaultConfig, lineItems } from "../../src/sheoga.js";
import { mergeTrimOptions, seedTrimPlan } from "../../src/trims.js";
import TrimsPopup from "../../src/TrimsPopup.jsx";

// The MPB770 floor + its shelf, straight from the attached MANMI export.
const fossilFloor = { sku: "1509245", bookId: "manmi", active: true, type: "vinyl", vendorSkus: ["MPB770VN1"], description: "7x48 Mann Aduramax MPB770 - Preservation Fossil 23.76 sf" };
const shelf = [
  { sku: "1510330", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["531996"], price: 46.8, description: '94" Mann Aduramax Reducer - 531996 Preservation Fossil' },
  { sku: "1510331", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["532002"], price: 46.8, description: '94" Mann Aduramax T-Mold - 532002 Preservation Fossil' },
  { sku: "1510332", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["532014"], price: 46.8, description: '94" Mann Aduramax Endcap - 532014 Preservation Fossil' },
  { sku: "1510333", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["532008"], price: 59.99, description: '94" Mann Aduramax Stairnose - 532008 Preservation Fossil' },
  { sku: "1518735", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["592410"], price: 94.99, description: '94" Mannington OneNose - Preservation Fossil' },
  { sku: "1510334", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["531997"], price: 46.8, description: '94" Mann Aduramax Reducer - 531997 Preservation Relic' }, // sibling color — must stay out
  fossilFloor,
];

function Harness() {
  // Pane picked by URL (?pane=trims) — the configurator is a full-screen
  // overlay, so in-page switch buttons would sit underneath it.
  const [pane] = useState(() => (new URLSearchParams(location.search).get("pane") === "trims" ? "trims" : "hb"));
  const trims = mergeTrimOptions([], fossilFloor, shelf);
  const seed = seedTrimPlan([{ id: "f", ...fossilFloor, qty: "200" }], { id: "f" }, trims);
  return (
    <div className="min-h-screen" style={{ background: "var(--ft-cream)" }}>
      {pane === "hb" && (
        <SheogaConfigurator
          seed={{ mode: "hb", cfg: { ...defaultConfig("hb"), slatLen: "24" } }}
          initialSf={600} basket={[]} onBasketChange={() => {}} areaName="Kitchen"
          onMove={() => {}} onMoveEntries={() => {}}
          onAdd={(lines) => console.log("ADD LINES:", JSON.stringify(lines, null, 1))}
          onClose={() => {}} />
      )}
      {pane === "trims" && (
        <TrimsPopup floorName="Mannington AduraMax Preservation Fossil (MPB770)" trims={trims} seed={seed}
          onApply={(q) => console.log("APPLY:", q)} onClose={() => {}} />
      )}
    </div>
  );
}

// Note-removal proof rides the console: a floor payload has no `note` key.
console.log("lineItems note fields:", lineItems({ mode: "floor", cfg: defaultConfig("floor") }, { sf: 600 }).map((l) => l.note));

createRoot(document.getElementById("root")).render(<Harness />);
