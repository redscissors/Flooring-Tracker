// Preview harness for the Mirage bundle wiring (ADR 0025 rule 7).
//
// Everything load-bearing here is the REAL thing: the four payloads are the real
// files frozen by make-payloads.mjs in the exact shape ImportRouter.readRow
// produces, the grouping is the real bundleByBook, and the review UI is the real
// BookImportWizard fed the real preParsed prop the router now builds. Nothing
// touches Supabase, and Apply is stubbed — this is the review step, which is all
// that happens before a human presses the button.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { BookImportWizard } from "../../src/pricebooklib.jsx";
import { bundleByBook, fileFormat } from "../../src/dropimport.js";
import payloads from "./payloads.json";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const types = ["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"];
const typeLabels = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" };

// The router's own rows: each file tagged by the real fileFormat, which is what
// bundleByBook keys the joined family off.
const rows = payloads.map((p) => ({
  file: { name: p.name },
  isPdf: !!p.isPdf,
  pages: p.pages,
  sheets: p.sheets,
  target: "bkMirage",
  format: fileFormat({ sheets: p.sheets, pages: p.pages, isPdf: p.isPdf }),
}));

const steps = bundleByBook(rows);
const step = steps[0];
const payloadOf = (r) => (r.isPdf ? { pages: r.pages, isPdf: true } : { sheets: r.sheets });

const book = { id: "bkMirage", name: "Mirage (OVF)", kind: "order", data: {} };

function Harness() {
  const [applied, setApplied] = useState(null);
  const stepNote = (
    <div className="text-[11px] text-slate-400 mb-2">
      Reviewing {step.files.length} files together for {book.name} — {step.files.map((f) => f.name).join(", ")}
    </div>
  );
  return (
    <div className="p-4">
      <h1 className="ft-serif text-xl mb-1">Mirage bundle — import review</h1>
      <p className="text-xs text-slate-500 mb-3">
        {payloads.length} files dropped · bundleByBook produced <b>{steps.length}</b> step
        {steps.length === 1 ? "" : "s"} · joined family: <b>{String(step.joined)}</b> · tags:{" "}
        {rows.map((r) => r.format).join(", ")}
      </p>
      {applied && (
        <pre className="text-[11px] bg-emerald-50 border border-emerald-200 rounded p-2 mb-3 whitespace-pre-wrap">{applied}</pre>
      )}
      <BookImportWizard
        book={book}
        existingItems={[]}
        preParsed={{ payloads: step.rows.map(payloadOf), format: step.row.format }}
        bundle={step.bundle}
        stepNote={stepNote}
        types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={false}
        saveMapping={() => {}}
        onClose={() => {}}
        onApply={(diff) => setApplied(
          `Apply is stubbed in this harness — nothing was written.\n` +
          `would add ${diff.added.length} · change ${diff.changed.length} · retire ${diff.missing.length}`
        )}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
