// Preview proof (2026-09-14): unit of measure on a hand-typed row. The cells
// below are the app's own coverage / qty / order markup around the REAL
// UnitPick, and the phone column is the REAL MobileRowSheet — Playwright picks
// from the dropdowns for the screenshots. Built by proof-vite.config.mjs,
// never shipped with the app.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UnitPick } from "../../src/grid.jsx";
import { MobileRowSheet } from "../../src/mobile.jsx";
import { normalizeSettings, getCarton, getPieceCarton, num } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { printProduct } from "../../src/print.js";
import { newProduct, newProject, newArea } from "../../src/model.js";
import { unitCode, unitNoun, bundleUnit, BUNDLE_UNITS, COUNT_UNITS } from "../../src/units.js";
import "../../src/index.css";

const settings = normalizeSettings();
const row = (over) => ({ ...newProduct(), ...over });
const MOSAIC = row({ type: "tile", sizeText: "12x12 sheet", L: "2", W: "2", brandColor: "Carrara 2\" hex mosaic (hand-typed)", qty: "48", cartonSf: "1.06", priceSqft: "18.50" });
const TRIM = row({ type: "misc", qtyType: "count", brandColor: "Bullnose 3x12 (hand-typed)", qty: "14", cartonPc: "6", priceSqft: "9.25" });
const ROLL = row({ type: "tile", qtyType: "count", brandColor: "Kerdi-Band 5\" (hand-typed)", qty: "3", priceSqft: "42.00" });

const cell = { borderRight: "1px solid var(--ft-row-line)", minWidth: 0, display: "flex", alignItems: "center" };
const COLS = "3fr 0.9fr 0.9fr 1.1fr";

function GridRow({ init, testid, label, note }) {
  const [p, setP] = useState(init);
  const upd = (patch) => setP((cur) => ({ ...cur, ...patch }));
  const C = getCarton(p, settings), PC = getPieceCarton(p);
  const countUnit = unitCode(p.sellUnit || "EA");
  const pr = printProduct(p, settings);
  return (
    <div className="card" data-testid={testid}>
      <div className="cap">{label}</div>
      <div className="note">{note}</div>
      <div className="rowframe" style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 11, fontWeight: 600 }}>
        <div style={{ ...cell, padding: "0 8px", minHeight: 34 }}>{p.brandColor}</div>
        <div style={{ ...cell, fontSize: 9.5 }} className="ft-mono">
          {p.type !== "misc" && p.qtyType === "sqft" ? (<>
            <input type="number" value={p.cartonSf} onChange={(e) => upd({ cartonSf: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0, padding: "6px 2px" }} placeholder="—" />
            {num(p.cartonSf) > 0 && <UnitPick prefix="SF/" value={bundleUnit(p.cartonUnit)} options={BUNDLE_UNITS} onChange={(v) => upd({ cartonUnit: v })} title="What the coverage is sold in — carton, sheet, box, bundle, roll, pack" />}
          </>) : p.type === "misc" ? (<>
            <input type="number" value={p.cartonPc} onChange={(e) => upd({ cartonPc: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0, padding: "6px 2px" }} placeholder="—" />
            {num(p.cartonPc) > 0 && <UnitPick prefix="PC/" value={bundleUnit(p.cartonUnit)} options={BUNDLE_UNITS} onChange={(v) => upd({ cartonUnit: v })} title="What the pieces come packed in — carton, sheet, box, bundle, roll, pack" />}
          </>) : <span className="px-2" style={{ color: "var(--ft-faint)" }}>—</span>}
        </div>
        <div style={cell}>
          {p.type !== "misc" && p.qtyType === "sqft" ? (
            <input type="number" value={p.qty} onChange={(e) => upd({ qty: e.target.value })} data-c="sf" className="ft-cell text-right" placeholder="0" />
          ) : (<>
            <input type="number" value={p.qty} onChange={(e) => upd({ qty: e.target.value, qtyType: "count" })} data-c="sf" className="ft-cell text-right" placeholder="0" />
            <UnitPick value={countUnit} options={COUNT_UNITS} onChange={(v) => upd({ sellUnit: v === "EA" ? "" : v })} title="What one of this line is — each, piece, sheet, roll, box…" />
          </>)}
        </div>
        <div style={{ ...cell, justifyContent: "flex-end", padding: "0 8px" }} className="ft-mono" data-c="order">
          {C ? `${C.order} ${unitNoun(C.order, C.unit)}` : PC ? `${PC.pieces} pcs (${PC.cartons} ${unitNoun(PC.cartons, PC.unit)})` : `${p.qty} ${unitNoun(num(p.qty), countUnit)}`}
        </div>
      </div>
      <div className="stored">stored: <code>cartonUnit: "{p.cartonUnit}"</code> <code>sellUnit: "{p.sellUnit}"</code> · prints as: <code>{pr.qtyText || "—"}</code> · <code>{pr.priceText}</code></div>
    </div>
  );
}

function Phone() {
  const [p, setP] = useState(MOSAIC);
  const proj = { ...newProject(), categories: [{ ...newArea(), products: [p] }] };
  return (
    <div className="phone">
      <MobileRowSheet p={p} areaName="Master bath" canDelete settings={settings} stock={[]} groutStock={[]}
        stockReady bookStockReady isBookFam={() => false} gFamilies={[]} searchOrder={null} bookName={() => ""}
        tv={tierView(proj, settings)} onPatch={(patch) => setP((cur) => ({ ...cur, ...patch }))}
        onPickStock={() => {}} onOpenVendor={() => {}} onDelete={() => {}} onClose={() => {}} notify={() => {}} />
    </div>
  );
}

const phoneOnly = location.search.includes("phone");
if (phoneOnly) createRoot(document.getElementById("mobile")).render(<Phone />);
else createRoot(document.getElementById("desktop")).render(<>
  <GridRow testid="mosaic" init={MOSAIC} label="1 · Hand-typed mosaic, 1.06 sq ft per sheet — the coverage tag was stuck on CT"
    note="The SF/CT tag is now a dropdown. Picking SH makes the Order column, the estimate and order entry all read sheets." />
  <GridRow testid="trim" init={TRIM} label="2 · Hand-typed trim, 6 pieces per pack — the PC/CT tag gets the same picker"
    note="Pieces needed still round up to whole packs; only the word changes." />
  <GridRow testid="roll" init={ROLL} label="3 · Hand-typed count line — the EA tag picks what one of the thing is"
    note="EA stays the blank default (nothing stored); any other pick is stored on sellUnit, the same field a price-book pick fills." />
</>);
