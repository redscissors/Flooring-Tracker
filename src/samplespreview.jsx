// Preview harness for the Samples panel (spec 2026-08-28): the REAL
// SamplesPanel over request rows built through the REAL requestFrom/
// normSampleRequest — no Supabase, no App shell. Stateful, so status chips,
// Mark all ordered, the mailto button and remove all exercise the App
// contract (onOrdered takes an ID LIST). Dev-only entry (samples-preview.html).
// ?empty=1 shows the empty state; ?browser=1 mounts the customer browser with
// the samples column + filter instead (Task 8).
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SamplesPanel } from "./samples.jsx";
import { requestFrom } from "./samples.js";
import { normA } from "./model.js";

const BOOKS = [
  { id: "bkGlz", kind: "order", name: "Glazzio EFT", data: { brandLabel: "Glazzio", rep: { name: "Jeff Krejci", email: "jeff@glazzio.example" } } },
  { id: "bkGlati", kind: "stock", name: "GLATI stock", data: {} },
];
const PROJECT = { id: "c1", name: "Marsh — whole first floor", address: "214 Old Mill Rd, Chagrin Falls", phone: "(555) 210-0114" };
const area = (id, name) => normA({ id, name, products: [{}] });
const mk = (a, p, over = {}) => ({ ...requestFrom({ project: PROJECT, custName: "Kathy Marsh", area: a, areaIndex: 0, product: p, books: BOOKS, by: "Dana" }), ...over });

const kitchen = area("a1", "Kitchen"), bath = area("a2", "Master bath");
const SEED = [
  mk(kitchen, { id: "p1", type: "tile", bookId: "bkGlz", sku: "KES6301", brandColor: "Kessel Collection Ovo Glossy", L: "3", W: "12" }),
  mk(kitchen, { id: "p2", type: "tile", bookId: "bkGlz", sku: "CLNL289", brandColor: "Colonial Long Hex Village Square", sizeText: "12x12 sheet" }, { status: "ordered", orderedBy: "Marcus", orderedAt: Date.now() - 4 * 86400000 }),
  mk(kitchen, { id: "p3", type: "tile", bookId: "bkGlati", sku: "05153", brandColor: "Hanoi White Matte", L: "12", W: "24" }),
  mk(bath, { id: "p4", type: "hardwood", brandColor: "White Oak 5\" Character", sheoga: { mode: "floor", cfg: {} } }),
  mk(bath, { id: "p5", type: "vinyl", sku: "STIPEHW1212PEBF", brandColor: "Uptown Pebbles Harmony Warm Blend", sizeText: "12x12" }),
];

function Harness() {
  const empty = new URLSearchParams(location.search).has("empty");
  const [reqs, setReqs] = useState(empty ? [] : SEED);
  return (
    <SamplesPanel name={PROJECT.name} requests={reqs}
      custInfo={{ custName: "Kathy Marsh", address: PROJECT.address, phone: PROJECT.phone }}
      repFor={(g) => BOOKS.find((b) => b.id === g.bookId)?.data?.rep || null}
      onOrdered={(ids, ordered) => setReqs((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: ordered ? "ordered" : "need", orderedBy: ordered ? "Dana" : "", orderedAt: ordered ? Date.now() : null } : r))}
      onRemove={(id) => setReqs((prev) => prev.filter((r) => r.id !== id))}
      onClose={() => {}} />
  );
}
createRoot(document.getElementById("preview")).render(<Harness />);
