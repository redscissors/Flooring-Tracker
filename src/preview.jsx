// Preview harness for the import wizard's zero-row parse guard: the REAL
// BookImportWizard, fed the portal's "still building" placeholder page as a
// parsed sheet, over a fake 1,873-item book — no Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { createRoot } from "react-dom/client";
import "./index.css";
import { BookImportWizard } from "./pricebooklib.jsx";
import { TYPES, TLBL } from "./uiconst.js";

const existingItems = Array.from({ length: 1873 }, (_, i) => ({
  sku: `CAE${String(10000 + i)}`,
  description: `CAESAR PORCELAIN ${12 + (i % 3) * 12}X24 FIELD ${i}`,
  cost: 2.5 + (i % 40) / 10, unit: "SF", active: true,
}));

// What SheetJS makes of the placeholder HTML page the relay passed through:
// a sheet with a few words and no SKU column anywhere.
const placeholderSheet = {
  name: "Sheet1",
  rows: [["One moment please"], ["Your price list is being prepared."], [""], ["Virginia Tile"]],
};

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

function Harness() {
  return (
    <div className="h-screen" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <BookImportWizard
        book={{ id: "bk1", kind: "order", name: "Virginia Tile — Caesar (EFT)", data: {} }}
        existingItems={existingItems}
        preParsed={{ file: { name: "CAE_EFT_25_06_23.xls" }, sheets: [placeholderSheet] }}
        onClose={() => {}}
        onApply={() => window.alert("apply fired — it must be blocked!")}
        saveMapping={() => {}}
        types={TYPES} typeLabels={TLBL} inp={inp} lbl={lbl}
      />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
