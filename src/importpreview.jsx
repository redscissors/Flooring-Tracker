// Preview harness for the import wizard's diff review (2026-08-17): the REAL
// BookImportWizard over local mock state, no Supabase — the diff count buttons
// unfold their new / changed / retiring rows, a changed row says what moved,
// and every line can be flagged for Claude. Dev-only entry (import-preview.html);
// not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BookImportWizard } from "./pricebooklib.jsx";
import { parseMapped } from "./pricebook.js";
import { TYPES, TLBL } from "./uiconst.js";
import { issueRef } from "./claudeissues.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

const HEADER = ["SKU", "Description", "Mfg", "U/M", "Size", "SF/CT", "Cost", "Lead"];
// The book's previous edition — parsed through the SAME mapping so the
// existing items compare shape-for-shape with the incoming sheet's.
const PREV_ROWS = [
  HEADER,
  ["VT1001", "CARRARA WHITE MATTE", "ANATOLIA", "CT", "12X24", 15.5, 32.55, "2 wk"],
  ["VT1002", "SOHO GREIGE MATTE", "ANATOLIA", "CT", "12X24", 15.5, 32.55, "2 wk"],
  ["VT1003", "LEDGER PANEL SILVER", "ANATOLIA", "CT", "6X24", 8, 51.2, "1 wk"],
  ["VT1004", "PENCIL LINER PEWTER", "ANATOLIA", "PC", "", "", 4.85, "2 wk"],
  ["VT1005", "HEX MOSAIC MIDNIGHT", "ANATOLIA", "CT", "10X12", 8.3, 92, "3 wk"],
  ["VT1006", "QUARTZ SAND POLISHED", "ANATOLIA", "CT", "24X24", 15.6, 47.58, "2 wk"],
];
// This quarter's sheet: VT1002 costs more and slips to 4 wk, VT1003 re-sizes,
// VT1004/VT1005 are gone (retiring), VT1006 comes back (it was retired), and
// two SKUs are new.
const NEXT_ROWS = [
  HEADER,
  ["VT1001", "CARRARA WHITE MATTE", "ANATOLIA", "CT", "12X24", 15.5, 32.55, "2 wk"],
  ["VT1002", "SOHO GREIGE MATTE", "ANATOLIA", "CT", "12X24", 15.5, 36.43, "4 wk"],
  ["VT1003", "LEDGER PANEL SILVER", "ANATOLIA", "CT", "6X22", 7.4, 51.2, "1 wk"],
  ["VT1006", "QUARTZ SAND POLISHED", "ANATOLIA", "CT", "24X24", 15.6, 47.58, "2 wk"],
  ["VT2001", "CARRARA WHITE HONED", "ANATOLIA", "CT", "12X24", 15.5, 35.34, "2 wk"],
  ["VT2002", "BULLNOSE CARRARA WHITE", "ANATOLIA", "PC", "3X24", "", 3.9, "2 wk"],
];
// ?big appends 350 generated new SKUs, pushing the "new" bucket past the
// 300-row display cap so its "show all" footer can be exercised.
if (new URLSearchParams(location.search).has("big")) {
  for (let i = 0; i < 350; i++) {
    NEXT_ROWS.push([`VT3${String(i).padStart(3, "0")}`, `FIELD TILE COLOR ${i}`, "ANATOLIA", "CT", "12X24", 15.5, 30 + (i % 20), "2 wk"]);
  }
}

const MAPPING = {
  sheet: "Price list",
  headerRow: 0,
  columns: { 0: "sku", 1: "description", 2: "mfg", 3: "unit", 4: "size", 5: "sfPerUnit", 6: "cost", 7: "leadTime" },
  groupBy: "mfg",
  defaultType: "tile",
};

const BOOK = { id: "vt", kind: "order", name: "Virginia Tile — Anatolia", active: true, data: { mapping: MAPPING, markups: { default: 45 } } };

const { items: prevItems } = parseMapped(PREV_ROWS, MAPPING);
const EXISTING = prevItems.map((it) =>
  it.sku === "VT1006" ? { ...it, active: false }
    : it.sku === "VT1005" ? { ...it, claudeIssue: { by: "Dana", at: Date.now() - 6 * 86400000 } }
      : it);

function App() {
  const [issues, setIssues] = useState([]);
  const [applied, setApplied] = useState(null);
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-xl mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Central Claude issues landed from this review: {issues.length === 0 ? "none yet" : ""}
        {issues.map((i, n) => <span key={n} className="block font-medium text-slate-700">{issueRef(i)} — {i.text || "(context only)"}</span>)}
        {applied && <span className="block mt-1 text-emerald-700">Applied · claudeSkus: [{applied.opts.claudeSkus.join(", ")}]</span>}
      </div>
      <BookImportWizard
        book={BOOK} existingItems={EXISTING}
        preParsed={{ sheets: [{ name: "Price list", rows: NEXT_ROWS }] }}
        onClose={() => {}}
        onApply={(diff, opts) => setApplied({ diff, opts })}
        saveMapping={() => {}}
        addClaudeIssue={(text, source) => setIssues((c) => [...c, { text, source }])}
        types={TYPES} typeLabels={TLBL} inp={inp} lbl={lbl} hideCosts={false}
      />
    </div>
  );
}

createRoot(document.getElementById("import-preview")).render(<App />);
