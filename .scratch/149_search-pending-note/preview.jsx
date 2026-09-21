// Preview proof (issue 149): the REAL selection-row pickers (GridOmniSearch,
// GridProductBox, MobileSearchSheet) over a stubbed special-order search whose
// timing the URL controls. Vite on :5199, then node .scratch/149_search-pending-note/shoot.mjs
//   ?state=pending        the order query never answers — bar + "Searching…", no amber note
//   ?state=pending-stock  same, but stock has exact hits — they list under the bar
//   ?state=settled        the order query answers with the Hanoi rows — exact, no bar
//   ?state=near           the order query answers empty — near-misses + the amber note
//   ?state=cell           the filled-row product cell picker, pending
//   ?state=mobile         the phone search sheet, pending
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GridOmniSearch, GridProductBox } from "../../src/grid.jsx";
import { MobileSearchSheet } from "../../src/mobile.jsx";
import "../../src/index.css";

const ST = new URLSearchParams(location.search).get("state") || "pending";
const NAMES = { ohiva: "OHIVA", sheog: "SHEOG", doit: "DOIT", vtc: "Virginia Tile" };
const bookName = (id) => NAMES[id] || "special order";

// Stock rows that are 0.333 trigram near-misses on "hanoi" (issue 056's fixture).
const STOCK = [
  { sku: "28904", bookId: "ohiva", stockKind: true, description: "Mirage Red Oak Classic - New Haven W Brushed", priceSqft: 7.99, type: "hardwood" },
  { sku: "29490", bookId: "ohiva", stockKind: true, description: "Aquamix Cement Grout Haze Rmvr", price: 14.24 },
  { sku: "93790", bookId: "ohiva", stockKind: true, description: "Custom 380 Haystack Part A - Ceg-Lite Colorant", price: 33.29 },
  { sku: "93791", bookId: "ohiva", stockKind: true, description: "10.5oz Custom 380 Haystack - 100% Silicone Caulk", price: 19.19 },
  { sku: "26922", bookId: "sheog", stockKind: true, description: "4x10 Flush w/Frm Hard Maple - Wood Vent", price: 39.69, size: "4x10" },
].map((it) => ({ ...it, active: true }));

const ORDER = [
  { sku: "TL-4471", bookId: "vtc", description: "Hanoi Collection Hanoi White 2.5x8", priceSqft: 8.4, type: "tile", size: "2.5x8", leadTime: "2-3 weeks" },
  { sku: "TL-4472", bookId: "vtc", description: "Hanoi Collection Hanoi Sage 2.5x8", priceSqft: 8.4, type: "tile", size: "2.5x8", leadTime: "2-3 weeks" },
  { sku: "TL-4480", bookId: "vtc", description: "Hanoi Collection Bullnose White", price: 12.9, trim: true, leadTime: "2-3 weeks" },
].map((it) => ({ ...it, active: true }));

const HANGS = ST === "pending" || ST === "pending-stock" || ST === "cell" || ST === "mobile";
const searchOrder = async (q, thr) => {
  if (HANGS) return new Promise(() => {});
  await new Promise((r) => setTimeout(r, 80));
  if (ST === "near" || thr != null) return [];
  const w = q.toLowerCase().trim();
  return ORDER.filter((it) => it.description.toLowerCase().includes(w));
};
const noop = () => {};
const common = { stock: STOCK, stockReady: true, searchOrder, bookName, strictness: 0.3, fallback: 0.9 };

function Omni() {
  const [query, setQuery] = useState("");
  return (
    <div className="flex border border-slate-200 rounded-md bg-white" style={{ width: 640, height: 34 }}>
      <GridOmniSearch {...common} query={query} onQuery={setQuery} onPick={noop} onPickMany={noop} onManual={noop} />
    </div>
  );
}
function Cell() {
  const [value, setValue] = useState("");
  return (
    <div className="flex border border-slate-200 rounded-md bg-white" style={{ width: 280, height: 34 }}>
      <GridProductBox {...common} value={value} onChange={setValue} onPick={noop} />
    </div>
  );
}

function App() {
  if (ST === "mobile") return <MobileSearchSheet {...common} initial="hanoi" onPick={noop} onPickMany={noop} onManual={noop} onClose={noop} />;
  return (
    <div className="p-6 min-h-screen" style={{ background: "var(--ft-cream)" }}>
      <div className="ft-eyebrow text-[10px] mb-2">Selection-row search — state: {ST}</div>
      {ST === "cell" ? <Cell /> : <Omni />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
