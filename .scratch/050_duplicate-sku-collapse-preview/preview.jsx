// Preview harness for collapsing one product carried by two order books
// (2026-07-25). Renders the REAL Hit row from search.jsx over the REAL
// collapseCopies output, so the "before" column is literally the un-collapsed
// list and the "after" column is what mergeSearch now hands the pickers.
// Served by the vite dev server; never shipped (lives in .scratch).
import React from "react";
import { createRoot } from "react-dom/client";
import { Hit } from "../../src/search.jsx";
import { collapseCopies } from "../../src/orderbook.js";
import "../../src/index.css";

const NAMES = { vtc: "Virginia Tile", anatolia: "Anatolia", mann: "Mannington", hall: "Hallmark" };
const bookName = (id) => NAMES[id] || "special order";

// Four cases, each the raw result list the server streams back today.
const CASES = [
  {
    label: "Same product, both books — a real price gap",
    rows: [
      { sku: "AN1234", bookId: "vtc", description: "Carrara White 12x24 Matte Porcelain", size: "12x24", type: "tile", priceSqft: 9.85, leadTime: "2-3 weeks" },
      { sku: "AN1234", bookId: "anatolia", description: "Carrara White 12x24 Matte Rectified Porcelain Tile", size: "12x24", type: "tile", priceSqft: 8.2, leadTime: "3-4 weeks" },
    ],
  },
  {
    label: "Same product, prices within a few cents — collapses quietly",
    rows: [
      { sku: "HW7788", bookId: "hall", description: "Alta Vista Sausalito Oak 7.5in Engineered", size: "7.5", type: "hardwood", priceSqft: 9.8, leadTime: "in stock" },
      { sku: "HW7788", bookId: "vtc", description: "Alta Vista Sausalito Oak 7.5in Engineered Hardwood", size: "7.5", type: "hardwood", priceSqft: 9.95 },
    ],
  },
  {
    label: "Same SKU, different products — both must stay",
    rows: [
      { sku: "1234", bookId: "vtc", description: "Carrara White 12x24 Matte Porcelain", size: "12x24", type: "tile", priceSqft: 9.85 },
      { sku: "1234", bookId: "mann", description: "Oak Reducer 78in Gunstock", price: 42, trim: true },
    ],
  },
  {
    label: "Three books, one product",
    rows: [
      { sku: "GL5501", bookId: "vtc", description: "Glazzio Sunset Glass Mosaic 12x12", size: "12x12", type: "tile", priceSqft: 22.4 },
      { sku: "GL5501", bookId: "anatolia", description: "Glazzio Sunset Glass Mosaic 12x12 Sheet", size: "12x12", type: "tile", priceSqft: 19.75 },
      { sku: "GL5501", bookId: "mann", description: "Glazzio Sunset Glass Mosaic 12x12", size: "12x12", type: "tile", priceSqft: 24.1 },
    ],
  },
];

const Panel = ({ rows }) => (
  <div style={{ border: "1px solid var(--ft-border)", background: "var(--ft-card)" }}>
    {rows.map((it, i) => (
      <div key={i} className="px-2.5 py-1.5" style={{ borderTop: i ? "1px solid var(--ft-border)" : "none" }}>
        <Hit it={it} bookName={bookName} />
      </div>
    ))}
  </div>
);

const Case = ({ label, rows }) => (
  <div style={{ marginBottom: 18 }}>
    <div className="ft-eyebrow" style={{ fontSize: 10, marginBottom: 5 }}>{label}</div>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--ft-faint)", marginBottom: 3 }}>before — {rows.length} rows</div>
        <Panel rows={rows} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--ft-faint)", marginBottom: 3 }}>after — {collapseCopies(rows).length === 1 ? "1 row" : `${collapseCopies(rows).length} rows`}</div>
        <Panel rows={collapseCopies(rows)} />
      </div>
    </div>
  </div>
);

const Board = ({ title }) => (
  <div style={{ flex: 1, minWidth: 620, background: "var(--ft-cream)", padding: 18 }}>
    <div className="ft-serif" style={{ fontSize: 15, color: "var(--ft-text)", marginBottom: 12 }}>{title}</div>
    {CASES.map((c) => <Case key={c.label} {...c} />)}
  </div>
);

createRoot(document.getElementById("root")).render(
  <div style={{ display: "flex", alignItems: "stretch", minHeight: "100vh" }}>
    <Board title="Light" />
    <div className="ned-dark" style={{ display: "contents" }}>
      <Board title="Dark" />
    </div>
  </div>
);
