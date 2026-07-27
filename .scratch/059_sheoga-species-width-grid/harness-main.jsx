// Preview harness for the species/width grid (run `npm run dev`, open
// /.scratch/059_sheoga-species-width-grid/harness.html): mounts the REAL
// SheogaConfigurator, no Supabase and no stock involved. This is the
// preview-proof surface for the non-negotiable "no UI change without preview".
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "/src/index.css";
import SheogaConfigurator from "/src/SheogaConfigurator.jsx";

function Harness() {
  const [open, setOpen] = useState(true);
  const [basket, setBasket] = useState([]);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <div className="ft-eyebrow text-[10px] mb-1">species &amp; width grid · production preview harness</div>
      <h1 className="text-2xl font-extrabold mb-4">Sheoga configurator — real component</h1>
      <button onClick={() => setOpen(true)} className="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold">Open configurator</button>
      {open && (
        <SheogaConfigurator initialSf={1} basket={basket} onBasketChange={setBasket}
          onMove={() => setOpen(false)} onMoveEntries={() => setOpen(false)}
          onAdd={() => setOpen(false)} onClose={() => setOpen(false)} areaName="Kitchen" />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><Harness /></StrictMode>);
