// Preview harness for the label maker's Keim-logo header. Mounts the REAL
// AppsWorkspace with in-memory data, plus a strip rendering the REAL
// labelCardHTML print markup (with logoSrc) on paper-white so the print-side
// header is provable without a print dialog. Served by vite dev; never shipped.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AppsWorkspace } from "../../src/AppsWorkspace.jsx";
import { normLabelPresets, normLabel, labelCardHTML } from "../../src/labels.js";
import keimLogo from "../../src/assets/keim-logo-ink.png";

const presets = normLabelPresets([]);

const stock = [
  { sku: "AL-CHR-1224", description: "Alpine Charcoal Matte 12x24", product: "Alpine", brand: "Emser", size: "12x24", thickness: "3/8\"", priceSqft: 4.85, active: true },
  { sku: "MW-HEX-2", description: "Meadow White Hex 2in", product: "Meadow", brand: "Anatolia", size: "2x2", thickness: "1/4\"", priceSqft: 9.1, active: true },
];

const seedLabels = [
  normLabel({
    id: "a", presetId: "sample-tag", w: 1.5, h: 2.5, header: "Keim", createdAt: 2,
    lines: presets[0].lines,
    fields: { name: "Alpine Charcoal Matte", surface: "Floor", sku: "AL-CHR-1224", size: "12x24", price: "$4.85/sq ft", grout: "Smoke Grey" },
  }),
  normLabel({
    id: "b", presetId: "spec-card", w: 3, h: 4, header: "Tile Outlet", createdAt: 1,
    lines: presets[1].lines,
    fields: { name: "Meadow White Hex", surface: "Wall", sku: "MW-HEX-2", size: "2x2", price: "$9.10/sq ft", brand: "Anatolia", thickness: "1/4\"", grout: "Bright White" },
  }),
];

function Harness() {
  const [labels, setLabels] = useState(seedLabels);
  const [customPresets, setCustomPresets] = useState([]);
  const printHtml = labels
    .map((l) => labelCardHTML(l, { logoSrc: new URL(keimLogo, window.location.href).href }))
    .join("");
  return (
    <div>
      <AppsWorkspace
        onClose={() => {}}
        stock={stock}
        labels={labels}
        presets={[...presets, ...customPresets]}
        onAddLabel={(d) => setLabels((ls) => [...ls, normLabel({ ...d, id: "n" + ls.length, createdAt: Date.now() })])}
        onAddLabelsBulk={(ds) => setLabels((ls) => [...ls, ...ds.map((d, i) => normLabel({ ...d, id: "n" + ls.length + i, createdAt: Date.now() }))])}
        onUpdateLabel={(id, p) => setLabels((ls) => ls.map((l) => (l.id === id ? normLabel({ ...l, ...p }) : l)))}
        onDeleteLabel={(id) => setLabels((ls) => ls.filter((l) => l.id !== id))}
        onSavePreset={(p) => setCustomPresets((ps) => [...ps, p])}
      />
      <div style={{ position: "fixed", inset: "auto 0 0 0", zIndex: 60, background: "#fff", borderTop: "2px solid #ccc", padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#888", marginBottom: 8 }}>
          Print markup (labelCardHTML with logoSrc) — as the print window renders it
        </div>
        <div style={{ display: "flex", gap: "0.15in", flexWrap: "wrap" }} dangerouslySetInnerHTML={{ __html: printHtml }} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
