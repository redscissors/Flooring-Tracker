// Preview harness for the Sheoga vent scrape / stain options + "Copy floor"
// (issue 038): the REAL SheogaConfigurator, embedded, over fake state — no
// Supabase. Opens on the unfinished-floor tab seeded with a scraped, stained
// Maple so the vent tab's Copy floor button has something real to copy.
// Dev-only entry (preview.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SheogaConfigurator from "./SheogaConfigurator.jsx";

function Harness() {
  const [basket, setBasket] = useState([]);
  const [log, setLog] = useState("—");
  return (
    <div className="h-screen flex flex-col p-4" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <p className="text-xs mb-2" style={{ color: "var(--ft-faint)" }}>
        Sheoga configurator — real component, fake job. Last action: <b style={{ color: "var(--ft-brand-deep)" }}>{log}</b>
      </p>
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-300 bg-white overflow-hidden shadow-xl">
        <SheogaConfigurator embedded
          seed={{ mode: "floor", cfg: { sp: "Maple", tex: "sawcut", finish: "est", stain: "Cattail" } }}
          initialSf={400} basket={basket} onBasketChange={setBasket}
          onAdd={(lines) => setLog(`add ${lines.length} line(s): ${lines.map((l) => l.brandColor).join(" | ")}`)}
          onMove={(lines) => setLog(`move ${lines.length} line(s)`)}
          onMoveEntries={(lines, next) => { setBasket(next); setLog(`move ${lines.length} line(s)`); }}
          onClose={() => setLog("close")} areaName="Kitchen" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
