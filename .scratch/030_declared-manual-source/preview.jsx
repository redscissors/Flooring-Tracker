// Preview harness for declared hand-supplied sources (ADR 0025 amendment).
//
// Two panels, both running the REAL code:
//
// 1. ManualSourcesCard on the book page — where the declaration is made.
// 2. The REAL ImportRouter, fed the files a refresh of this book's portal sheets
//    would pool. The book has NEVER been imported: its manifest holds only the
//    declaration. That is the case the old `manifest.length < 2` guard silently
//    swallowed, and the whole point of the change — the gate must ask on the
//    FIRST import, not the second.
//
// Nothing touches Supabase; the declaration writes to local state instead of
// updateBook, and the run phase is stubbed.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import "../../src/index.css";
import { ImportRouter, ManualSourcesCard } from "../../src/App.jsx";
import { declareManualSource, undeclareManualSource, sourceSlot } from "../../src/dropimport.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const types = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
const typeLabels = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };

const sheetFile = (name, rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return new File([XLSX.write(wb, { bookType: "xlsx", type: "array" })], name, { type: "application/vnd.ms-excel" });
};

// What a refresh of the Mirage sign-in group pools: the two portal sheets. The
// Product Chart is not fetchable and is exactly what the declaration is for.
const fetched = [
  sheetFile("OVF-Mirage-Hardwood.xls", [["Mirage TruBalance Flooring Price List"], ["Species", "Grades", "Width", "Price"], ["Red Oak", "Character", '5"', 8.42]]),
  sheetFile("OVF-Mirage-Trim.xls", [["Mirage TruBalance Mouldings & Stair Parts"], ["Catalog #", "Type", "Species", "Price"], ["MTR-4212", "Stair Nose", "Red Oak", 96.5]]),
];
// Their recordKeys, as the review-when-ready pool hands them over.
const sourceKeys = new Map([[fetched[0], "ovf:portal:hw:keim"], [fetched[1], "ovf:portal:trim:keim"]]);

function Harness() {
  // A book that has never been imported: no recorded sources at all.
  const [sources, setSources] = useState([]);
  const [open, setOpen] = useState(false);
  const book = { id: "bkMirage", name: "Mirage (OVF)", kind: "order", data: { sources } };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="ft-serif text-xl mb-1">Declaring a file the book is fed by hand</h1>
        <p className="text-xs text-slate-500">
          This book has never been imported — its manifest is empty. Declare “Product Chart” below,
          then look at the routing screen: the gate asks for it on the FIRST refresh.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Book page</div>
        <ManualSourcesCard
          sources={sources}
          inp={inp}
          onDeclare={(label) => setSources((s) => declareManualSource(s, label))}
          onUndeclare={(id) => setSources((s) => undeclareManualSource(s, id))}
        />
        <pre className="mt-2 text-[10.5px] text-slate-400 whitespace-pre-wrap">book.data.sources = {JSON.stringify(sources)}</pre>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Refresh → Review · the two portal sheets, pooled
          </div>
          {/* ImportRouter is a fixed full-screen modal, so it is mounted on
              demand — otherwise it covers the book page behind it. */}
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700">
            {open ? "Close" : "Open the review pass"}
          </button>
        </div>
        {open && <ImportRouter
          key={JSON.stringify(sources)}
          files={fetched}
          targets={new Map(fetched.map((f) => [f, "bkMirage"]))}
          sourceKeys={sourceKeys}
          books={[book]}
          onClose={() => {}}
          onFileDone={() => {}}
          applyBookImport={async () => {}}
          updateBook={async () => {}}
          loadBookItems={async () => []}
          importStockFile={() => {}}
          types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={false}
        />}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
