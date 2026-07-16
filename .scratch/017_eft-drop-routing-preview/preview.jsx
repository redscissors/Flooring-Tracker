// Preview harness for the EFT drop-routing fix + sidebar drop area move.
// Reproduces the REAL PriceBookLibrary sidebar markup (drop tile now at the top
// of the book list) and the REAL ImportRouter route-phase modal, with the three
// file rows routed by the REAL dropimport.js code over miniature EFT sheets
// carrying the actual brand-title lines ("Virginia Tile Core" / "Anatolia
// Tile" / "VTC Home Collection"). Served by the vite dev server; never shipped.
import React from "react";
import { createRoot } from "react-dom/client";
import { Upload, BookOpen, Database, FileText, X, Plus } from "lucide-react";
import "../../src/index.css";
import { computeFingerprint, routeFile } from "../../src/dropimport.js";

// Miniature EFT files: same template, only the title line differs — exactly
// Virginia Tile's real layout (title two rows above the signature header).
const eft = (title) => [{ name: "MFG Data", rows: [
  ["Account Name:  KEIM LUMBER CO"], [],
  [title], [],
  ["Item Code", "VTC Mfg", "Description", "Dealer Price"],
  ["ABC123", "ANA", "Oak 12X24", 3.29],
] }];

const books = [
  { id: "core", name: "Virginia Tile Core", kind: "order", data: { importFingerprint: { format: "vtc-eft", titleSig: "virginia tile core" } } },
  { id: "ana", name: "Anatolia (VTC)", kind: "order", data: { importFingerprint: { format: "vtc-eft", titleSig: "anatolia tile" } } },
  { id: "hc", name: "Home Collection (VTC)", kind: "order", data: { importFingerprint: { format: "vtc-eft", titleSig: "vtc home collection" } } },
];

const files = [
  { name: "VTC_EFT_25_07_28.xls", sheets: eft("Virginia Tile Core") },
  { name: "ANA_EFT_25_06_04.xls", sheets: eft("Anatolia Tile") },
  { name: "Home_Collection_EFT_26_02_19.xls", sheets: eft("VTC Home Collection") },
];
const rows = files.map((f) => {
  const fp = computeFingerprint({ sheets: f.sheets });
  return { file: f, ...routeFile({ ...fp, sheets: f.sheets }, books) };
});

const inp = "ft-field w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400";
const rowCls = (on) => `w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left ${on ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;

function Sidebar() {
  return (
    <div className="w-56 shrink-0 border-r border-slate-100 overflow-y-auto p-3 space-y-3 bg-white">
      <div className="rounded-lg border-2 border-dashed px-2 py-3 text-center text-xs cursor-pointer border-slate-200 text-slate-500 hover:bg-slate-50">
        <Upload size={15} className="mx-auto mb-1 text-slate-400" />
        Drop vendor sheets or the shop workbook — <span className="underline text-indigo-600">browse…</span>
        <div className="text-[10px] text-slate-400 mt-1">.xlsx · .xls · .pdf — one or many; each routes to its book</div>
      </div>
      <div>
        <div className="ft-eyebrow text-[10px] text-slate-400 px-1 mb-1">Stock</div>
        <button className={rowCls(true)}>
          <BookOpen size={14} />
          <span className="flex-1 truncate">Shop workbook</span>
          <span className="text-[10px] text-white/70">2841</span>
        </button>
      </div>
      <div>
        <div className="ft-eyebrow text-[10px] text-slate-400 px-1 mb-1">Special order</div>
        {books.map((b) => (
          <button key={b.id} className={rowCls(false)}>
            <Database size={14} className="text-slate-400" />
            <span className="flex-1 truncate">{b.name}</span>
          </button>
        ))}
      </div>
      <button className="w-full flex items-center gap-1.5 text-sm rounded-md border border-dashed border-slate-300 px-2.5 py-2 text-slate-500 hover:bg-slate-50"><Plus size={14} /> New book</button>
    </div>
  );
}

function RouteModal() {
  const bookOpts = [["skip", "Skip this file"], ["stock", "Shop workbook (stock)"], ...books.map((b) => [b.id, b.name])];
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 border border-slate-200">
        <div className="flex items-center justify-between mb-1"><h3 className="ft-serif text-2xl">Route 3 files</h3><button className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        <p className="text-xs text-slate-400 mb-3">Each file is sent to its own book's import preview, one at a time. Unfamiliar files need a book picked.</p>
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <FileText size={15} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{r.file.name}</div>
                <div className={`text-[11px] ${r.target && r.target !== "skip" ? "text-slate-400" : "text-amber-600"}`}>{r.reason}</div>
              </div>
              <select className={`${inp} !w-auto shrink-0 text-xs`} defaultValue={r.target || "skip"}>
                {bookOpts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4">
          <button className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
          <button className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Review 3 files →</button>
        </div>
      </div>
    </div>
  );
}

function Preview() {
  return (
    <div className="h-full flex overflow-hidden" style={{ background: "var(--ft-cream)" }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="ft-serif text-3xl">Price book</h2>
        <p className="text-xs text-slate-400 mt-3 max-w-xl">Sidebar drop area (top of the book list) behind the route modal — the three sibling Virginia Tile EFT files each auto-route to their own book by the brand-title line.</p>
      </div>
      <RouteModal />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
