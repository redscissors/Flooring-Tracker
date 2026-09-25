// Snapshot of TODAY's label maker (before the overhaul): the REAL AppsWorkspace
// over in-memory labels, one with a long wrapping name and grout pushed to the
// bottom with a filler — the case the owner reported. Dev-only.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AppsWorkspace } from "../../src/AppsWorkspace.jsx";
import { normLabelPresets, normLabel, labelCardHTML } from "../../src/labels.js";
import keimLogo from "../../src/assets/keim-logo-ink.png";

const presets = normLabelPresets([]);
const stock = [
  { sku: "AL-CHR-1224", description: "Alpine Charcoal Matte 12x24", product: "Alpine", brand: "Emser", size: "12x24", thickness: "3/8\"", priceSqft: 4.85, active: true },
];
const withSpacer = (base, h) => {
  const ls = base.map((l) => ({ ...l }));
  ls.splice(ls.findIndex((l) => l.key === "price") + 1, 0, { key: "sp_demo1", show: true, size: h });
  return ls;
};
const seed = [
  normLabel({ id: "a", presetId: "sample-tag", w: 1.5, h: 2.5, header: "Keim", createdAt: 2, lines: withSpacer(presets[0].lines, 34),
    fields: { name: "Alpine Charcoal", sku: "AL-CHR-1224", size: "12x24", price: "$4.85/sq ft", grout: "Smoke Grey" } }),
  normLabel({ id: "b", presetId: "sample-tag", w: 1.5, h: 2.5, header: "Keim", createdAt: 1, lines: withSpacer(presets[0].lines, 34),
    fields: { name: "Calacatta Gold Polished Porcelain", sku: "CG-POL-2448", size: "24x48", price: "$7.25/sq ft", grout: "Bright White" } }),
];

function Harness() {
  const [labels, setLabels] = useState(seed);
  const logoSrc = new URL(keimLogo, window.location.href).href;
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AppsWorkspace app="labels" onClose={() => {}} stock={stock} labels={labels} presets={presets}
          onAddLabel={(d) => setLabels((ls) => [...ls, normLabel({ ...d, id: "n" + ls.length, createdAt: Date.now() })])}
          onAddLabelsBulk={() => {}} onUpdateLabel={(id, p) => setLabels((ls) => ls.map((l) => (l.id === id ? normLabel({ ...l, ...p }) : l)))}
          onDeleteLabel={() => {}} onSavePreset={() => {}} />
      </div>
      <div style={{ background: "#fff", borderTop: "2px solid #ccc", padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#888", marginBottom: 8 }}>Print output (labelCardHTML)</div>
        <div style={{ display: "flex", gap: "0.15in" }} dangerouslySetInnerHTML={{ __html: seed.map((l) => labelCardHTML(l, { logoSrc })).join("") }} />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
