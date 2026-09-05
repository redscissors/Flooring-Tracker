// Dev-only harness (vendor-book-preview.html): the REAL VendorBookPage over
// local mock state beside the REAL SamplesPanel, so the spec 2026-09-05
// contract can be seen end to end — edit a contact on the book, the Sheoga
// group's email button follows. No Supabase, no App shell. `?book=1` mounts
// the book page alone (the panel is a full-page drawer; the tabs sit under
// its backdrop otherwise).
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { VendorBookPage } from "./vendorbook.jsx";
import { SamplesPanel } from "./samples.jsx";
import { requestFrom, sampleContactFor, sampleBookFor } from "./samples.js";
import { vendorBookSeed } from "./vendorbook.js";
import { normA } from "./model.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

const seed = vendorBookSeed("sheoga", { pricing: { sheogaMarkupPct: 40, sheogaVentMarkupPct: 50 } });
const SHEOGA = { id: "vb1", kind: "vendor", active: true, name: seed.name, data: { ...seed.data, rep: { name: "Dan Miller", email: "dan@sheoga.example", phone: "(440) 555-0140" } } };
const GLAZZIO = { id: "bkGlz", kind: "order", active: true, name: "Glazzio EFT", data: { brandLabel: "Glazzio", rep: { name: "Jeff Krejci", email: "jeff@glazzio.example" } } };
const PROJECT = { id: "c1", name: "Hendricks residence", address: "88 Ridge Rd, Chagrin Falls", phone: "(555) 210-0114" };
const area = (id, name) => normA({ id, name, products: [{}] });
const great = area("a1", "Great room"), kitchen = area("a2", "Kitchen"), bath = area("a3", "Master bath");
const mk = (a, p, books, over = {}) => ({ ...requestFrom({ project: PROJECT, custName: "Pat Hendricks", area: a, areaIndex: 0, product: p, books, by: "Dana" }), ...over });

function Preview() {
  const [books, setBooks] = useState([GLAZZIO, SHEOGA]);
  const [requests, setRequests] = useState(() => [
    mk(bath, { id: "p1", type: "tile", sku: "GLZ-BC1224", brandColor: "Bianco Carrara", sizeText: "12×24", bookId: "bkGlz" }, [GLAZZIO, SHEOGA]),
    // Saved before the vendor book existed: no id, name only.
    mk(great, { id: "p2", type: "hardwood", brandColor: 'Sheoga — White Oak Character 5¼" solid, Natural', sheoga: { mode: "floor", cfg: {} } }, [GLAZZIO], { id: "old1" }),
    mk(kitchen, { id: "p3", type: "hardwood", brandColor: 'Sheoga — Hickory Clear 4¼" engineered, wire-brushed', sheoga: { mode: "floor", cfg: {} } }, [GLAZZIO, SHEOGA]),
  ]);
  const book = books.find((b) => b.id === "vb1");
  const bookOnly = new URLSearchParams(location.search).get("book") === "1";
  const updateBook = (id, { name, active, dataPatch } = {}) => setBooks((bs) => bs.map((b) => b.id === id ? { ...b, ...(name != null ? { name } : {}), ...(active != null ? { active } : {}), data: dataPatch ? { ...b.data, ...dataPatch } : b.data } : b));
  return (
    <div className="p-4 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)] items-start" style={{ background: "var(--ft-cream)", minHeight: "100vh" }}>
      <div className="rounded-xl border border-slate-200 bg-white px-4 pb-4">
        {book ? <VendorBookPage book={book} updateBook={updateBook} delBook={(id) => setBooks((bs) => bs.filter((b) => b.id !== id))} inp={inp} lbl={lbl} />
          : <p className="text-xs text-slate-400 mt-3">Book deleted — reload to start over.</p>}
      </div>
      {!bookOnly && <div className="rounded-xl border border-slate-200 bg-white">
        <SamplesPanel name={PROJECT.name} requests={requests}
          custInfo={{ custName: "Pat Hendricks", address: PROJECT.address, phone: PROJECT.phone }}
          contactFor={(g) => sampleContactFor(sampleBookFor(g, books)?.data)}
          onOrdered={(ids, on) => setRequests((rs) => rs.map((r) => ids.includes(r.id) ? { ...r, status: on ? "ordered" : "need" } : r))}
          onRemove={(id) => setRequests((rs) => rs.filter((r) => r.id !== id))}
          onClose={() => {}} />
      </div>}
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Preview />);
