// Preview harness for the routing screen's always-on "Add a file" row.
//
// This renders the REAL ImportRouter, not a mock of it: the files it starts with
// and the ones added through the new row both go through the real readRow ->
// computeFingerprint -> routeFile path, and the real bundleByBook decides how
// they group. Nothing touches Supabase; the run phase is stubbed, because the
// change under test is entirely in the route phase.
//
// `window.__drop(name)` builds a real .xlsx File and fires a real drop event at
// the Add-a-file row — that is how the interaction gets exercised from the
// browser tools, which cannot drive an OS file picker.
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import "../../src/index.css";
import { ImportRouter } from "../../src/App.jsx";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const types = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
const typeLabels = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };

// Two registry books to pick between, so the chooser on an unfamiliar file is
// a real choice. Neither carries an importFingerprint — the bootstrap case,
// where nothing auto-routes and no manifest exists for GateGap to read.
const books = [
  { id: "bkMirage", name: "Mirage (OVF)", kind: "order", data: {} },
  { id: "bkVTC", name: "Virginia Tile Core", kind: "order", data: {} },
];

const sheetFile = (name, rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new File([buf], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

// These carry the real detector marks (TruBalance + the sheet's own banner), so
// fileFormat tags them mirage-flooring / mirage-trim for real and bundleByBook
// sees a joined family. Their CONTENTS are token — this harness is about how
// many payloads reach the parser, not what it makes of them.
const SAMPLES = {
  "OVF-Mirage-Hardwood.xls": [["Mirage TruBalance Flooring Price List"], ["Species", "Grades", "Width", "Price"], ["Red Oak", "Character", '5"', 8.42]],
  "OVF-Mirage-Trim.xls": [["Mirage TruBalance Mouldings & Stair Parts"], ["Catalog #", "Type", "Species", "Price"], ["MTR-4212", "Stair Nose", "Red Oak", 96.5]],
};
// Only .xlsx samples here: this harness synthesizes its files, and a real PDF
// cannot be faked with spreadsheet bytes. The hand-supplied chart is exercised
// by dropping the actual file from disk onto the row.

// The file that starts the pass — as if one sheet had been fetched and sent to
// review, which is the exact situation the Add row exists to rescue.
const startFiles = [sheetFile("OVF-Mirage-Value-Tower.xls", [["Mirage TruBalance Value Tower Flooring Price List"], ["Collection", "Grade", "Width", "Price"], ["Value Tower", "Classic", '3.25"', 5.11]])];

window.__drop = (name) => {
  const rows = SAMPLES[name] || [["A", "B"], [1, 2]];
  const file = sheetFile(name, rows);
  const dt = new DataTransfer();
  dt.items.add(file);
  const el = [...document.querySelectorAll("div")].find((d) => d.textContent.trim().startsWith("Add a file — drop here"));
  if (!el) return "add-row not found";
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  return `dropped ${name}`;
};

function Harness() {
  return (
    <div className="p-4">
      <h1 className="ft-serif text-xl mb-1">Import routing — always-on “Add a file”</h1>
      <p className="text-xs text-slate-500 mb-3">
        Real ImportRouter, real routing. Started with one file, as a fetched-sheet review would.
        No book here has a fingerprint or a manifest — the bootstrap case, where GateGap cannot appear.
      </p>
      <ImportRouter
        files={startFiles}
        books={books}
        onClose={() => {}}
        onFileDone={() => {}}
        applyBookImport={async () => {}}
        updateBook={async () => {}}
        loadBookItems={async () => []}
        importStockFile={() => {}}
        types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={false}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
