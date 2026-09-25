// Preview harness for the label maker overhaul (spec 2026-09-25): the REAL
// LabelMaker over in-memory labels, presets and stock — saves and bulk writes
// round-trip through the same normalizers the app uses (presets through
// customLabelPresets → normLabelPresets, like settings do). Below it, a strip of
// the REAL labelCardHTML print markup, name-fitted by the same rule the print
// popup runs. Served by vite dev; never shipped.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { LabelMaker } from "../../src/LabelMaker.jsx";
import { normLabelPresets, customLabelPresets, normLabel, labelCardHTML, fitNameSize } from "../../src/labels.js";
import keimLogo from "../../src/assets/keim-logo-ink.png";

const live = (o) => ({ active: true, ...o });
const stock = [
  live({ sku: "CG-POL-1224", description: "Calacatta Gold Polished 12x24", size: "12x24", priceSqft: 6.4, brand: "Emser" }),
  live({ sku: "CG-POL-2448", description: "Calacatta Gold Polished 24x48", size: "24x48", priceSqft: 6.95, brand: "Emser" }),
  live({ sku: "CG-MAT-1224", description: "Calacatta Gold Matte 12x24", size: "12x24", priceSqft: 5.1, brand: "Emser" }),
  live({ sku: "AL-CHR-1224", description: "Alpine Charcoal Matte 12x24", size: "12x24", priceSqft: 5.15, brand: "Emser" }),
  live({ sku: "OP-NAT-848", description: "Oak Plank Natural 8x48", size: "8x48", priceSqft: 3.95 }),
  live({ sku: "MW-HEX-2", description: "Meadow White Hex 2in", size: "2x2", priceSqft: 9.1 }),
];

const presets0 = normLabelPresets([]);
const tag = presets0[0];
const mk = (id, t, fields, extra = {}) => normLabel({ id, presetId: tag.id, w: tag.w, h: tag.h, header: "Keim", lines: tag.lines, createdAt: t, fields, ...extra });
const seed = [
  mk("a", 6, { name: "Alpine Charcoal", sku: "AL-CHR-1224", size: "12x24", price: "$4.85/sq ft", grout: "Smoke Grey" }),
  mk("b", 5, { name: "Calacatta Gold Polished Porcelain", sku: "CG-POL-2448", size: "24x48", price: "$7.25/sq ft", grout: "Bright White" }),
  mk("c", 4, { name: "Meadow White Hex", sku: "MW-HEX-2", size: "2x2", price: "$9.10/sq ft", grout: "Bright White" }),
  mk("d", 3, { name: "Oak Plank Natural", sku: "OP-NAT-848", size: "8x48", price: "$3.95/sq ft", grout: "Mocha" }),
  mk("e", 2, { name: "Terra Rustic", sku: "TR-RUS-66", size: "6x6", price: "$2.95/sq ft", grout: "Sand" }),
  // A label saved before the pin divider existed renders as it always did.
  normLabel({ id: "f", presetId: tag.id, w: 1.5, h: 2.5, header: "Keim", createdAt: 1, lines: tag.lines.filter((l) => l.key !== "pin"), fields: { name: "Legacy Slate Black", sku: "SB-HON-1818", size: "18x18", price: "$5.60/sq ft", grout: "Charcoal" } }),
];

function PrintStrip({ labels }) {
  const ref = useRef(null);
  const logoSrc = new URL(keimLogo, window.location.href).href;
  const html = labels.map((l) => labelCardHTML(l, { logoSrc })).join("");
  useEffect(() => {
    const run = () => {
      for (const card of ref.current.querySelectorAll(".lc")) {
        const nm = card.querySelector(".lc-name");
        if (nm) fitNameSize((px) => { nm.style.fontSize = px + "px"; return card.scrollHeight > card.clientHeight + 1; }, parseFloat(nm.style.fontSize) || 13);
      }
    };
    run();
    document.fonts.ready.then(run);
  }, [html]);
  return (
    <div id="print-strip" style={{ background: "#fff", borderTop: "2px solid #ccc", padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#888", marginBottom: 8 }}>Print markup (labelCardHTML + the popup's fit)</div>
      <div ref={ref} style={{ display: "flex", gap: "0.15in", flexWrap: "wrap" }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Harness() {
  const [labels, setLabels] = useState(seed);
  const [presets, setPresets] = useState(presets0);
  const n = useRef(0);
  const add = (d) => normLabel({ ...d, id: "n" + n.current++, createdAt: Date.now() + n.current });
  return (
    <div>
      <div style={{ height: 760, display: "flex", flexDirection: "column", background: "#fff" }}>
        <LabelMaker stock={stock} bookStockReady labels={labels} presets={presets}
          onAddLabel={(d) => setLabels((ls) => [...ls, add(d)])}
          onAddLabelsBulk={(ds) => setLabels((ls) => [...ls, ...ds.map(add)])}
          onUpdateLabel={(id, p) => setLabels((ls) => ls.map((l) => (l.id === id ? normLabel({ ...l, ...p }) : l)))}
          onUpdateLabelsBulk={(ps) => setLabels((ls) => ls.map((l) => { const p = ps.find((x) => x.id === l.id); return p ? normLabel({ ...l, ...p.patch }) : l; }))}
          onDeleteLabel={(id) => setLabels((ls) => ls.filter((l) => l.id !== id))}
          onDeleteLabels={(ids) => setLabels((ls) => ls.filter((l) => !ids.includes(l.id)))}
          onSavePreset={(p) => setPresets((cur) => normLabelPresets(customLabelPresets(cur.some((x) => x.id === p.id) ? cur.map((x) => (x.id === p.id ? p : x)) : [...cur, p])))} />
      </div>
      <PrintStrip labels={labels} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
