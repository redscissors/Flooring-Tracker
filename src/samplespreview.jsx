// Preview harness for the Samples panel (sample-ordering workflow, 2026-08-28):
// the REAL SamplesPanel over mock project state, run through the REAL normA and
// sampleGroups — no Supabase, no App shell. Stateful, so the status chips,
// "Mark all ordered", and the remove × all exercise the same one-batch onSet
// contract App.jsx wires (setSamples). Dev-only entry (samples-preview.html);
// not part of the app build. ?empty=1 shows the panel's empty state.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SamplesPanel } from "./samples.jsx";
import { sampleGroups } from "./samples.js";
import { normA } from "./model.js";

const BOOKS = [
  { id: "bkGlz", kind: "order", name: "Glazzio EFT", data: { brandLabel: "Glazzio" } },
  { id: "bkGlati", kind: "stock", name: "GLATI stock", data: {} },
];

const mark = (status, daysAgo) => ({ status, at: Date.now() - daysAgo * 86400000 });

const CATS = [
  normA({
    id: "a1", name: "Kitchen", products: [
      { id: "p1", type: "tile", bookId: "bkGlz", sku: "KES6301", brandColor: "Kessel Collection Ovo Glossy", L: "3", W: "12", sample: mark("need", 0) },
      { id: "p2", type: "tile", bookId: "bkGlz", sku: "CLNL289", brandColor: "Colonial Long Hex Village Square", sizeText: "12x12 sheet", sample: mark("ordered", 4) },
      { id: "p3", type: "tile", bookId: "bkGlati", sku: "05153", brandColor: "Hanoi White Matte", L: "12", W: "24", sample: mark("in", 9) },
    ],
  }),
  normA({
    id: "a2", name: "Master bath", products: [
      { id: "p4", type: "tile", bookId: "bkGlz", sku: "CM1224", brandColor: "Calacatta Gold Polished", L: "12", W: "24", sample: mark("need", 1) },
      { id: "p5", type: "hardwood", brandColor: "White Oak 5\" Character", sheoga: { mode: "floor", cfg: {} }, sample: mark("ordered", 6) },
      { id: "p6", type: "vinyl", sku: "STIPEHW1212PEBF", brandColor: "Uptown Pebbles Harmony Warm Blend", sizeText: "12x12", sample: mark("need", 0) },
    ],
  }),
];

function Harness() {
  const empty = new URLSearchParams(location.search).has("empty");
  const [cats, setCats] = useState(empty ? [normA({ id: "a1", name: "Kitchen", products: [{ id: "p1" }] })] : CATS);
  const onSet = (list) => {
    const by = new Map(list.map((m) => [m.aid + "/" + m.pid, m.sample]));
    setCats((prev) => prev.map((a) => ({ ...a, products: a.products.map((p) => by.has(a.id + "/" + p.id) ? { ...p, sample: by.get(a.id + "/" + p.id) } : p) })));
  };
  return <SamplesPanel name="Jones residence — main floor" groups={sampleGroups(cats, BOOKS)} onSet={onSet} onClose={() => {}} />;
}

createRoot(document.getElementById("preview")).render(<Harness />);
