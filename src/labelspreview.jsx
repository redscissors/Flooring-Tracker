// Preview harness for the label maker: the REAL LabelMaker over stock-shaped
// items built through the REAL normOrderItem, with stateful saved labels so
// fill-from-stock, edit and save all exercise the App contract. No Supabase.
// Dev-only entry (label-preview.html).
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { LabelMaker } from "./LabelMaker.jsx";
import { normOrderItem } from "./orderbook.js";
import { normLabelPresets } from "./labels.js";

const it = (f) => normOrderItem({ bookId: "stock", type: "tile", unit: "CT", ...f });
const STOCK = [
  it({ sku: "15042.07", description: "Marazzi Rice Tile - RC03 Natural", brand: "Marazzi", mfg: "RC03", size: "12x24", thickness: "9mm", priceSqft: 6.49 }),
  it({ sku: "15042.08", description: "Marazzi Rice Tile - RC04 Natural", brand: "Marazzi", mfg: "RC04", size: "3x12", priceSqft: 8.25 }),
  it({ sku: "31877.02", description: "Wow Skin Biscuit Matte 135296", brand: "Wow", size: "2.5x10", priceSqft: 14.75 }),
  it({ sku: "20110.01", description: "Daltile Tiles – ULRA1224 Meadow Hex 2in", brand: "Daltile", size: '2" Hex', priceSqft: 12.9 }),
];

let n = 0;
function Harness() {
  const [labels, setLabels] = useState([]);
  const [presets, setPresets] = useState(() => normLabelPresets([]));
  const add = (l) => setLabels((ls) => [...ls, { ...l, id: `l${++n}` }]);
  return (
    <div style={{ height: "100vh" }}>
      <LabelMaker stock={STOCK} bookStockReady labels={labels} presets={presets}
        onAddLabel={add} onAddLabelsBulk={(ls) => ls.forEach(add)}
        onUpdateLabel={(id, l) => setLabels((ls) => ls.map((x) => (x.id === id ? { ...l, id } : x)))}
        onUpdateLabelsBulk={(ups) => setLabels((ls) => ls.map((x) => { const u = ups.find((y) => y.id === x.id); return u ? { ...x, ...u.patch, ...u } : x; }))}
        onDeleteLabel={(id) => setLabels((ls) => ls.filter((x) => x.id !== id))}
        onDeleteLabels={(ids) => setLabels((ls) => ls.filter((x) => !ids.includes(x.id)))}
        onSavePreset={(p) => setPresets((ps) => normLabelPresets([...ps.filter((x) => x.id !== p.id), p]))} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
