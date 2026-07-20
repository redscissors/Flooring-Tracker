// Preview harness: a pass holding ONE of a book's three linked portal sheets.
//
// This is the case that shipped broken. Reviewing a single pooled sheet started
// a pass containing only that file; the gate then counted the declared chart as
// the only thing missing, so a book made of four documents imported as two.
//
// The book here has THREE linked sheets and one declared hand-supplied file, and
// has never been imported — its manifest holds nothing but the declaration. The
// gate must therefore learn the three from the live sheet links, not from
// import history. Real ImportRouter, real gate, real sourceSlot/mergeSources.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import "../../src/index.css";
import { ImportRouter } from "../../src/App.jsx";
import { declareManualSource, sourceSlot } from "../../src/dropimport.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const types = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
const typeLabels = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };

const sheetFile = (name, rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return new File([XLSX.write(wb, { bookType: "xlsx", type: "array" })], name, { type: "application/vnd.ms-excel" });
};

// The three sheets the Mirage sign-in group fetches, as the library has them
// linked to the book. Only the trim one has been pooled for review.
const LINKED = [
  { key: "ovf:portal:hardwood:keim", name: "OVF-Mirage-Hardwood.xls" },
  { key: "ovf:portal:valuetower:keim", name: "OVF-Mirage-Value-Tower.xls" },
  { key: "ovf:portal:trim:keim", name: "OVF-Mirage-Trim.xls" },
];
const pooled = sheetFile("OVF-Mirage-Trim.xls", [["Mirage TruBalance Mouldings & Stair Parts"], ["Catalog #", "Type", "Species", "Price"], ["MTR-4212", "Stair Nose", "Red Oak", 96.5]]);

// What App.bookFetchSlots builds from the live sheet links.
const linkedSlots = () => LINKED.map((s) => sourceSlot({ recordKey: s.key, name: s.name }));

// Never imported: nothing recorded but the declaration.
const sources = declareManualSource([], "Product Chart");
const book = { id: "bkMirage", name: "Mirage (OVF)", kind: "order", data: { sources } };

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4 space-y-3">
      <h1 className="ft-serif text-xl">One sheet pooled, three linked, one declared by hand</h1>
      <p className="text-xs text-slate-500 max-w-2xl">
        The book has never been imported. Its manifest knows only “Product Chart”. The other three
        are known solely because sheets are <i>linked</i> to the book right now — which is what the
        gate has to read to say this pass is three files short, not one.
      </p>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700">
        {open ? "Close" : "Open the review pass"}
      </button>
      {open && (
        <ImportRouter
          files={[pooled]}
          targets={new Map([[pooled, "bkMirage"]])}
          sourceKeys={new Map([[pooled, "ovf:portal:trim:keim"]])}
          linkedSlots={linkedSlots}
          books={[book]}
          onClose={() => setOpen(false)}
          onFileDone={() => {}}
          applyBookImport={async () => {}}
          updateBook={async () => {}}
          loadBookItems={async () => []}
          importStockFile={() => {}}
          types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={false}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
