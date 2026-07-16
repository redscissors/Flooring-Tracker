// Preview harness for the SF/EA column change (piece→carton conversion in the
// selection grid). Rows are built by the REAL pick pipeline — normOrderItem →
// pricedItem → orderPatch (the WOW edge trim exactly as a post-ADR-0013 import
// classifies it) — and quantities/totals come from the REAL getCarton /
// getPieceCarton math. The grid cells reproduce App.jsx's markup for the
// Cov. / SF-EA / Price / Order / Total columns. Served by the vite dev server;
// never shipped.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronUp, ChevronDown } from "lucide-react";
import "../../src/index.css";
import { num, getCarton, cartonExact, getPieceCarton } from "../../src/catalog.js";
import { normOrderItem, pricedItem, orderPatch } from "../../src/orderbook.js";

const settings = { waste: { tile: 10, floor: 10 } };
const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sf1 = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const miscQty = (p) => (p.qtyType === "count" && String(p.qty ?? "").trim() !== "" ? num(p.qty) : 1);

// The WOW edge trim as the import classifier stores it (ADR 0013 amendment:
// piece-priced trim → type null, quotes per piece) and its carton-only sell
// unit; picked through the real orderPatch against a 40% book markup.
const wowEdge = normOrderItem({
  sku: "WOWCRWHEDGE6G", bookId: "vtc", description: "Crafted White Edge Glossy", size: '0.43x6',
  type: null, trim: true, trimSignal: "lexicon", priceUnit: "PC", orderUnit: "CT", pcPerUnit: 10, cost: 9.24,
});
const wowPicked = orderPatch(pricedItem(wowEdge, { default: 40 }), { id: "vtc", data: { markups: { default: 40 } } }, {});

const base = { qtyType: "sqft", qty: "", cartonSf: "", cartonPc: "", cartonUnit: "CT", cartonManual: "", priceSqft: "", sku: "", brandColor: "", sizeText: "" };
const START = [
  { ...base, id: "r1", type: "tile", sizeText: "12×24", brandColor: "Earth Ash Gray", sku: "ANDEARAG1224", cartonSf: "15.5", priceSqft: "4.61", qty: "200" },
  { ...base, id: "r2", ...wowPicked, type: "misc", qtyType: "count", qty: "14" },
  { ...base, id: "r3", type: "misc", brandColor: "Custom threshold — solid oak", sku: "", priceSqft: "45", qtyType: "count", qty: "2" },
];

const GRID_COLS = "0.85fr 2.75fr 1fr 0.55fr 0.5fr 0.55fr 0.7fr 0.8fr 44px";
const gridCell = { borderRight: "1px solid var(--ft-row-line)", minWidth: 0, display: "flex", alignItems: "center" };
const head = { padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" };

function Grid() {
  const [rows, setRows] = useState(START);
  const updProduct = (_a, id, patch) => setRows((rs) => rs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const a = { id: "a1" };
  return (
    <div className="max-w-5xl mx-auto my-10 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 text-sm font-bold text-slate-700">Main Floor — selections</div>
      <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, background: "var(--ft-area-head)", borderTop: "1px solid var(--ft-border)", borderBottom: "1px solid var(--ft-border)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-muted)" }}>
        <div style={{ ...head, padding: "5px 10px" }}>Size / Type ▾</div>
        <div style={head}>Product / Color ▾</div>
        <div style={head}>SKU</div>
        <div style={head}>Cov.</div>
        <div style={{ ...head, textAlign: "right" }}>SF/EA</div>
        <div style={{ ...head, textAlign: "right" }}>Price</div>
        <div style={{ ...head, textAlign: "right" }}>Order</div>
        <div style={{ ...head, textAlign: "right" }}>Total</div>
        <div />
      </div>
      {rows.map((p) => {
        const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
        const qtyMissing = p.type !== "misc" && !(num(p.qty) > 0) && !!(p.sku || p.brandColor || num(p.priceSqft) > 0);
        const C = getCarton(p, settings), cEx = cartonExact(p, settings), PC = getPieceCarton(p);
        const line = p.type === "misc" ? num(p.priceSqft) * (PC ? PC.pieces : miscQty(p)) : C ? C.order * C.sf * num(p.priceSqft) : sf * num(p.priceSqft);
        return (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: GRID_COLS, fontSize: 11, fontWeight: 600, borderBottom: "1px solid var(--ft-row-line)" }}>
            <div style={{ ...gridCell, padding: "0 6px", gap: 4 }}>
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{p.type}</span>
              <span>{p.sizeText}</span>
            </div>
            <div style={{ ...gridCell, padding: "0 8px" }}>{p.brandColor}</div>
            <div style={{ ...gridCell, padding: "0 8px", fontSize: 9.5 }} className="ft-mono">{p.sku}</div>
            <div style={{ ...gridCell, fontSize: 9.5 }} className="ft-mono">
              {p.type !== "misc" && p.qtyType === "sqft" ? (<>
                <input tabIndex={p.sku ? -1 : 0} type="number" value={p.cartonSf} onChange={(e) => updProduct(a.id, p.id, { cartonSf: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0, padding: "6px 2px" }} placeholder="—" title="Sq ft per carton/sheet — filled from the price book when the SKU has one. With this set, quantities and totals are figured by whole cartons." />
                {num(p.cartonSf) > 0 && p.cartonUnit && <span className="shrink-0 pr-0.5" style={{ fontSize: 6.5, letterSpacing: "-0.02em", color: "var(--ft-muted)" }}>SF/{String(p.cartonUnit).toUpperCase()}</span>}
              </>) : p.type === "misc" ? (<>
                <input tabIndex={p.sku ? -1 : 0} type="number" value={p.cartonPc} onChange={(e) => updProduct(a.id, p.id, { cartonPc: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0, padding: "6px 2px" }} placeholder="—" title="Pieces per carton — filled from the price book when the SKU is sold by the carton only. With this set, pieces needed round up to whole cartons." />
                {num(p.cartonPc) > 0 && <span className="shrink-0 pr-0.5" style={{ fontSize: 6.5, letterSpacing: "-0.02em", color: "var(--ft-muted)" }}>PC/{String(p.cartonUnit || "CT").toUpperCase()}</span>}
              </>) : <span className="px-2" style={{ color: "var(--ft-faint)" }}>—</span>}
            </div>
            <div style={gridCell}>
              {p.type !== "misc" && p.qtyType === "sqft" ? (
                <input type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })} data-c="sf" className={`ft-cell text-right ${qtyMissing ? "ring-2 ring-inset ring-amber-400 bg-amber-50 rounded" : ""}`} placeholder="0" title={qtyMissing ? "Enter square footage" : "Square feet"} />
              ) : (<>
                <input type="number" value={p.qtyType === "count" ? p.qty : ""} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value, qtyType: "count" })} data-c="sf" className={`ft-cell text-right ${qtyMissing ? "ring-2 ring-inset ring-amber-400 bg-amber-50 rounded" : ""}`} placeholder={p.type === "misc" ? "1" : "0"} title={PC ? `Pieces needed — the order rounds up to whole ${PC.unit.toUpperCase()}s of ${PC.per}` : "Quantity — counted each"} />
                <span className="shrink-0 pr-0.5" style={{ fontSize: 6.5, letterSpacing: "-0.02em", color: "var(--ft-muted)" }}>EA</span>
              </>)}
            </div>
            <div style={gridCell}>
              <input type="number" value={p.priceSqft} onChange={(e) => updProduct(a.id, p.id, { priceSqft: e.target.value })} data-c="price" className="ft-cell text-right" placeholder="0.00" title={p.type === "misc" || p.qtyType === "count" ? "Price each" : "Price per sq ft"} />
            </div>
            <div style={{ ...gridCell, justifyContent: "flex-end", gap: 3 }}>
              {p.type !== "misc" && C ? (<>
                <input tabIndex={-1} type="number" value={String(C.order)} onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })} data-c="order" className="ft-cell text-right" style={{ width: 42, flex: "none", padding: "6px 2px" }} title={`Cartons to order — type to override${cEx != null ? ` (exact ${cEx.toFixed(2)}, ${sf1(C.order * C.sf)} sf ordered)` : ""}`} />
                <span className="shrink-0" style={{ fontSize: 9.5 }}>{C.unit}</span>
                <span className="flex flex-col shrink-0 pr-1">
                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(C.order + 1) })} className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronUp size={9} /></button>
                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(Math.max(0, C.order - 1)) })} className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronDown size={9} /></button>
                </span>
              </>) : PC ? (<>
                <input tabIndex={-1} type="number" value={String(PC.cartons)} onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })} data-c="order" className="ft-cell text-right" style={{ width: 42, flex: "none", padding: "6px 2px" }} title={`Cartons to order — type to override (${PC.need} pcs needed, ${PC.pieces} billed at ${PC.per}/${PC.unit.toUpperCase()})`} />
                <span className="shrink-0" style={{ fontSize: 9.5 }}>{PC.unit}</span>
                <span className="flex flex-col shrink-0 pr-1">
                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(PC.cartons + 1) })} className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronUp size={9} /></button>
                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(Math.max(0, PC.cartons - 1)) })} className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronDown size={9} /></button>
                </span>
              </>) : p.type === "misc" || p.qtyType === "count" ? (<>
                <span className="text-slate-500">{p.type === "misc" ? miscQty(p) : num(p.qty) > 0 ? sf1(num(p.qty)) : ""}</span>
                <span className="shrink-0 pr-1.5" style={{ fontSize: 9.5 }}>EA</span>
              </>) : (<>
                <span className="text-slate-500">{num(p.qty) > 0 ? sf1(num(p.qty)) : ""}</span>
                <span className="shrink-0 pr-1.5 font-semibold" style={{ fontSize: 9.5 }}>sf</span>
              </>)}
            </div>
            <div style={{ ...gridCell, justifyContent: "flex-end", padding: "6px 8px", fontWeight: 700 }}>{line > 0 ? money(line) : "—"}</div>
            <div />
          </div>
        );
      })}
      <div className="px-4 py-3 text-[11px] text-slate-500 leading-relaxed">
        Row 2 is <span className="ft-mono">WOWCRWHEDGE6G</span> picked through the real order-book pipeline: priced $12.94/pc
        (cost $9.24 + 40%), sold only by the carton of 10. Typing <b>14</b> pieces in the SF/EA column orders <b>2 CT</b> and
        bills the 20 pieces in them — 20 × $12.94 = $258.80.
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Grid />);
