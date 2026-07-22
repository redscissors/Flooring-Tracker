// Preview harness for the ERP "Vendor SKU Analysis" drop routing: the seven
// supplier exports dropped at once, routed by the REAL dropimport.js code over
// miniature VSA sheets. DOIT and SHEOG already have stamped books (their
// filename stems), so they auto-route; the other five are unclaimed and sit on
// the new "➕ New book from this file" choice, which creates a stock-kind book
// named after each file when Review is clicked. Served by vite; never shipped.
import React from "react";
import { createRoot } from "react-dom/client";
import { FileText, X } from "lucide-react";
import "../../src/index.css";
import { computeFingerprint, routeFile } from "../../src/dropimport.js";

// Miniature export: the real template — one "Vendor SKU Analysis" sheet,
// header on row 1, no title line. Only the FILENAME tells siblings apart.
const vsa = () => [{ name: "Vendor SKU Analysis", rows: [
  ["Product Code", "Full Description", "Base Price (Cost)", "Retail Price", "Unit of Stock"],
  ["1517410", "7x60 Mannington AduraMax - Preservation Fossil 23.76 sf", 85.34, 141.45, "CT"],
] }];

const books = [
  { id: "doit", name: "DOIT", kind: "stock", data: { importFingerprint: { format: "vendor-sku", titleSig: "doit" } } },
  { id: "sheog", name: "SHEOG", kind: "stock", data: { importFingerprint: { format: "vendor-sku", titleSig: "sheog" } } },
  { id: "vtc", name: "Virginia Tile Core", kind: "order", data: { importFingerprint: { format: "vtc-eft", titleSig: "virginia tile core" } } },
];

const files = ["DOIT.xlsx", "SHEOG.xlsx", "MANMI.xlsx", "OHIVA.xlsx", "GUNDL.xlsx", "GLATI.xlsx", "Sheet1.xlsx"];
const rows = files.map((name) => {
  const sheets = vsa();
  const fp = computeFingerprint({ sheets, name });
  return { name, ...routeFile({ ...fp, sheets }, books) };
});

const inp = "ft-field w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400";
const bookOpts = [["skip", "Skip this file"], ["__new__", "➕ New book from this file"], ["stock", "Shop workbook (stock)"], ...books.map((b) => [b.id, b.name])];

function Preview() {
  return (
    <div className="h-full" style={{ background: "var(--ft-cream)" }}>
      <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }}>
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="ft-serif text-2xl">Route 7 files</h3>
            <button className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <p className="text-xs text-slate-400 mb-3">Files heading for the same book are reviewed together, one book at a time. Unfamiliar files need a book picked.</p>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <FileText size={15} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{r.name}</div>
                  <div className={`text-[11px] ${r.target && r.target !== "skip" ? "text-slate-400" : "text-amber-600"}`}>{r.reason}</div>
                </div>
                <select className={`${inp} !w-auto shrink-0 text-xs`} defaultValue={r.target || "__new__"}>
                  {bookOpts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4">
            <button className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Review 7 files →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
