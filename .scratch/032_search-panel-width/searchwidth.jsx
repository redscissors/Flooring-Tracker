// Preview harness for the wider search panel + wrapping description
// (2026-07-20). Renders the REAL GridOmniSearch and MobileSearchSheet from
// src/App.jsx over a fake in-memory stock list and a fake order book, so the
// panel width and the description wrapping shown here are the app's own code
// paths — no Supabase, no sign-in. Served by the vite dev server; never
// shipped (lives in .scratch).
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GridOmniSearch, MobileSearchSheet } from "../../src/App.jsx";
import "../../src/index.css";

const STOCK = [
  { sku: "ANA-CAR-1224", description: "Anatolia Carrara Bianco Polished Rectified Porcelain Wall & Floor Tile", section: "Porcelain Tile", brand: "Anatolia", size: '12" x 24" x 3/8"', priceSqft: 7.2, active: true },
  { sku: "MSI-CAL-2448", description: "MSI Calacatta Laza Gold Matte Large Format Rectified Porcelain Slab Look", section: "Porcelain Tile", brand: "MSI", size: '24" x 48"', priceSqft: 9.85, active: true },
  { sku: "DAL-CAR-0303", description: "Daltile Carrara White Hexagon Mosaic on 12x12 Mesh Sheet, Honed", section: "Mosaics", brand: "Daltile", size: '12" x 12"', priceSqft: 13.4, active: true },
  { sku: "SCH-CAR-TRM", description: "Schluter Jolly Anodized Aluminum Edge Trim 3/8in x 8ft 2-1/2in, Satin", section: "Trim & Transitions", brand: "Schluter", price: 22.5, active: true },
];

const ORDER = [
  { bookId: "bkVTC", sku: "VTC-88213", description: "Virginia Tile — Anatolia Marfil Beige Rectified Glazed Porcelain, Matte Finish, Carrara Vein Cut, Frost Resistant", section: "Porcelain", brand: "Anatolia", size: '12" x 24"', priceSqft: 6.44, leadTime: "3–4 weeks", freightFlag: true },
  { bookId: "bkMAN", sku: "MAN-CARRW-5", description: "Mannington Adura Max Apex Carrara White Luxury Vinyl Plank with Attached Cork Underlayment", section: "LVP", brand: "Mannington", size: '12" x 24"', priceSqft: 5.1, leadTime: "2 weeks" },
];

const bookName = (id) => (id === "bkVTC" ? "Virginia Tile" : id === "bkMAN" ? "Mannington" : "special order");
const searchOrder = async (q) => {
  const w = q.toLowerCase().split(/\s+/).filter(Boolean);
  return ORDER.filter((it) => w.every((t) => (it.description + " " + it.sku).toLowerCase().includes(t)));
};

function Row({ label, width }) {
  const [q, setQ] = useState("carrara");
  return (
    <div className="mb-10">
      <div className="ft-eyebrow text-[10px] mb-1.5 text-slate-400">{label}</div>
      <div className="flex items-stretch h-9 rounded-md border border-slate-200 bg-white" style={{ width }}>
        <div className="shrink-0 w-16 border-r border-slate-200 flex items-center px-2 text-[11px] text-slate-400">Tile</div>
        <GridOmniSearch stock={STOCK} query={q} onQuery={setQ} onPick={() => {}} onPickMany={() => {}}
          onManual={() => {}} searchOrder={searchOrder} bookName={bookName} />
      </div>
    </div>
  );
}

function Harness() {
  const [sheet, setSheet] = useState(false);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <h1 className="text-lg font-extrabold mb-6">Search panel width & description wrap</h1>
      <Row label="Full-width row — panel matches the field" width="100%" />
      <Row label="Narrow row (320px) — panel holds its 416px floor" width="320px" />
      <button onClick={() => setSheet(true)} className="rounded-md bg-indigo-600 text-white px-3 h-9 text-xs font-bold">Open mobile sheet</button>
      {sheet && <MobileSearchSheet stock={STOCK} searchOrder={searchOrder} bookName={bookName} initial="carrara"
        onPick={() => setSheet(false)} onPickMany={() => setSheet(false)} onManual={() => setSheet(false)} onClose={() => setSheet(false)} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
