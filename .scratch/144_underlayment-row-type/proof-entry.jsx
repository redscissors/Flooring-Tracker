// Preview proof (2026-09-18): the underlayment row type. Real components over
// fixed rows; Playwright clicks the switch chip. Built by proof-vite.config.mjs,
// never shipped with the app.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UnitPick } from "../../src/grid.jsx";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { normalizeSettings, getCarton, getUnderlayInstall, num, withProjWaste } from "../../src/catalog.js";
import { switchToSqftPatch, switchChipText } from "../../src/stock.js";
import { printProduct } from "../../src/print.js";
import { jobTotals } from "../../src/jobtotals.js";
import { tierView } from "../../src/pricing.js";
import { newProduct, newProject, newArea, normC } from "../../src/model.js";
import { bundleUnit, BUNDLE_UNITS } from "../../src/units.js";
import "../../src/index.css";

const settings = normalizeSettings({ catalog: { companies: [{ name: "Schluter", enabled: true, grouts: [], mortars: [{ name: "Schluter All Set", coverage: 60, tier1: 60, tier2: 60, tier3: 60, unit: "bags", price: 32.5 }], underlayments: [
  { name: "Ditra Heat Membrane Sheet", coverage: 8.4, unit: "sheets", price: 0, sku: "23031", types: [], install: [{ id: "m1", kind: "mortar", product: "Schluter All Set", coverage: 50 }] },
] }] } });
const row = (over) => ({ ...newProduct(), ...over });
const SHEET = row({ type: "underlayment", sku: "23031", brandColor: "Schluter Ditra Heat - Membrane Sheet", sizeText: "3'3\"x2'7\"", qty: "42", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH",
  underlay: { checked: true, product: "Ditra Heat Membrane Sheet", manual: "", install: true, installMortars: {}, installSkip: {} } });
const OLD = row({ type: "misc", qtyType: "count", sku: "23031", brandColor: "Schluter Ditra Heat - Membrane Sheet", qty: "5", sellUnit: "SH", priceSqft: "21.49" });
const LANDED = { sku: "23031", type: "underlayment", qtyType: "sqft", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH", sizeText: "3'3\"x2'7\"", brandColor: "Schluter Ditra Heat - Membrane Sheet" };
const TILE = row({ type: "tile", brandColor: "Daltile Arctic White 12x24", L: "12", W: "24", qty: "42", priceSqft: "4.79", cartonSf: "15.5" });

function GridCard({ init, testid, label, note }) {
  const [p, setP] = useState(init);
  const upd = (patch) => setP((c) => ({ ...c, ...patch }));
  const C = getCarton(p, settings);
  const sw = p.type === "misc" ? switchToSqftPatch(p, LANDED) : null;
  const pr = printProduct(p, settings);
  return (
    <div className="card" data-testid={testid}>
      <div className="cap">{label}</div>
      <div className="note">{note}</div>
      <div className="rowframe" style={{ display: "grid", gridTemplateColumns: "3fr 0.9fr 0.9fr 1.1fr", fontSize: 11, fontWeight: 600 }}>
        <div className="gc">{p.brandColor}</div>
        <div className="gc ft-mono" style={{ fontSize: 9.5 }}>
          {p.qtyType === "sqft" ? (<><input type="number" value={p.cartonSf} onChange={(e) => upd({ cartonSf: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0 }} />{num(p.cartonSf) > 0 && <UnitPick prefix="SF/" value={bundleUnit(p.cartonUnit)} options={BUNDLE_UNITS} onChange={(v) => upd({ cartonUnit: v })} title="What the coverage is sold in" />}</>) : <span style={{ color: "var(--ft-faint)" }}>—</span>}
        </div>
        <div className="gc"><input type="number" value={p.qty} onChange={(e) => upd({ qty: e.target.value })} data-c="sf" className="ft-cell text-right" /><span style={{ fontSize: 9 }}>{p.qtyType === "sqft" ? "sf" : p.sellUnit.toLowerCase()}</span></div>
        <div className="gc r b ft-mono" data-c="order">{C ? `${C.order} ${C.unit.toUpperCase()} (${C.exact.toFixed(2)})` : `${p.qty} ${p.sellUnit}`}</div>
      </div>
      {sw && <div className="ft-noprint flex items-center gap-2 text-xs" style={{ padding: "6px 2px 2px" }}><span className="text-amber-600">{switchChipText(sw)}</span><button data-c="switch" onClick={() => upd(sw)} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 font-medium">Switch to sq ft</button></div>}
      <div className="stored">stored: <code>type: "{p.type}"</code> <code>qtyType: "{p.qtyType}"</code> <code>qty: "{p.qty}"</code> <code>cartonSf: "{p.cartonSf}"</code> · prints as <code>{pr.qtyText || "—"}</code> · <code>{pr.priceText}</code></div>
    </div>
  );
}

function DrawerCard() {
  const IN = getUnderlayInstall(SHEET, settings) || [];
  return (
    <div className="card" data-testid="drawer">
      <div className="cap">Install materials on the underlayment row (real getUnderlayInstall)</div>
      <div className="note">Entry: Ditra Heat Membrane Sheet (SKU 23031, auto-linked) · install: Schluter All Set @ 50 sf/bag off the row's 42 sf. The row IS the underlayment, so it never orders an underlayment of its own — only these.</div>
      {IN.map((m) => <div key={m.defId} className="text-xs" style={{ color: "#3B3934", fontWeight: 700 }}>{m.name} — {m.order} {m.unit} (exact {m.exact.toFixed(2)})</div>)}
    </div>
  );
}

const printProj = normC({ ...newProject(), id: "p1", name: "Q-Ditra Heat proof", categories: [{ ...newArea(), name: "Bath", products: [TILE, SHEET] }] });
const printWSet = withProjWaste(settings, printProj);
const printTv = tierView(printProj, settings);
const printT = jobTotals(printTv.proj, printProj, printWSet, printWSet, settings, []);

function PrintCard() {
  return (
    <>
      <div className="card" data-testid="print" style={{ background: "#fff", maxWidth: 820 }}>
        <EstimatePaper sel={printProj} people={[]} profile={{ name: "Proof", phone: "", email: "" }} tv={printTv} jobWaste={printWSet.waste} pMats={printT.pMats} tSet={printWSet} materialsCost={printT.materialsCost} freightCost={printT.freightCost} flooringPrice={printT.flooringPrice} miscCost={printT.miscCost} totalSqft={printT.totalSqft} orderedSqft={printT.orderedSqft} grandTotal={printT.grandTotal} />
      </div>
      {/* The live estimate layout ("cards", src/print.js ESTIMATE_PRINT_LAYOUT)
          shows no measured-SF meta line — only the retired "classic" sheet did —
          so the floor-counted-once number is read straight off jobTotals here. */}
      <div className="card" data-testid="jobtotals">
        <div className="cap">Harness readout — the same jobTotals() that fed the sheet above (not printed markup)</div>
        <div className="stored" style={{ fontSize: 12 }}>
          <code>totalSqft: {printT.totalSqft}</code> <code>orderedSqft: {printT.orderedSqft}</code> — the tile's 42 SF measured once; the membrane's own 42 SF never re-counts.
        </div>
      </div>
    </>
  );
}

const url = new URL(location.href);
createRoot(document.getElementById("desktop")).render(url.searchParams.has("print") ? <PrintCard /> : (<>
  <GridCard init={SHEET} testid="grid" label="Picked today: Ditra Heat sheet, 42 sf typed → 5 SH"
    note="A sq ft row that orders whole sheets off the 8.4 SF/SH coverage tag, with no waste factor — the exact 5.00 sits beside the rounded order." />
  <GridCard init={OLD} testid="old" label="Saved before: the count line Marcus flagged — the switch chip"
    note="The same SKU saved as 5 SH of a misc count line. The chip says what the book sells it by; one click converts the line to the sq ft it always covered." />
  <DrawerCard />
</>));
