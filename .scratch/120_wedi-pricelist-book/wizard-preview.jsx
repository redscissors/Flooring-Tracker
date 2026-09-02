// Preview harness: the REAL BookImportWizard fed the committed pricelist
// snapshot as a pre-parsed drop, so the recognition, the parser warnings and
// the diff preview can be shot with no Supabase and no workbook. Dev-only.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { BookImportWizard } from "../../src/pricebooklib.jsx";
import { PRICELIST_SHEETS } from "../../src/wedipricelistfixture.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const book = { id: "bk_wedi_so", kind: "order", name: "wedi", active: true, data: {} };

createRoot(document.getElementById("preview")).render(
  <div className="p-4" style={{ background: "var(--ft-bg)", minHeight: "100vh" }}>
    <BookImportWizard book={book} existingItems={[]} preParsed={{ sheets: PRICELIST_SHEETS, format: "wedi-pricelist" }}
      onClose={() => {}} onApply={(items) => console.log("apply", items.length)} saveMapping={() => {}}
      types={["tile", "floor"]} typeLabels={{ tile: "Tile", floor: "Floor" }} inp={inp} lbl={lbl} hideCosts={false}
      addClaudeIssue={() => {}} />
  </div>,
);
