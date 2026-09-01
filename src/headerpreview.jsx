// Preview harness for the compact headers (2026-08-14): the REAL
// ProjectHeaderBar and PriceBookLibrary over local mock state, no Supabase.
// Dev-only entry (header-preview.html); not part of the app build.
import { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ProjectHeaderBar } from "./projectheader.jsx";
import { PriceBookLibrary } from "./pricebooklib.jsx";
import { normOrderItem } from "./orderbook.js";
import { TYPES, TLBL } from "./uiconst.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const noop = () => {};
const DAY = 86400000;

function ProjectHeaderDemo() {
  const nameRef = useRef(null), nameTabRef = useRef(null), orderEntryRef = useRef(null), attRef = useRef(null);
  const [proj, setProj] = useState({
    id: "p1", projectNo: 214, name: "Marsh — whole first floor", address: "214 Old Mill Rd, Chagrin Falls",
    notes: "Tear-out week of the 24th. Owner wants the herringbone quote separate.",
    salesperson: { name: "Danny", phone: "(555) 210-0114" },
    priceTier: "retail", customPct: "", printPricing: "full", freight: true, attachments: [], versions: [],
  });
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const waste = { tile: proj.waste?.tile ?? 15, floor: proj.waste?.floor ?? 10, tileOn: proj.waste?.tileOn ?? true, floorOn: proj.waste?.floorOn ?? false };
  return (
    <ProjectHeaderBar
      sel={proj} cust={{ name: "Kathy Marsh", address: "214 Old Mill Rd" }} builderName="Meridian Homes"
      profile={{ name: "Danny", phone: "(555) 210-0114" }}
      tv={{ tier: proj.priceTier, pct: proj.priceTier === "builder" ? 8 : proj.priceTier === "sale" ? 15 : proj.priceTier === "custom" ? Number(proj.customPct) || 0 : 0 }} grandTotal={12847.2}
      freightCost={214} saveOk settings={{ pricing: {}, waste: { tile: 15, floor: 10 } }} jobWasteUI={waste}
      updateProject={(id, patch) => setProj((p) => ({ ...p, ...patch }))}
      onOpenCustomer={noop} onPromote={noop}
      nameRef={nameRef} nameTabRef={nameTabRef} orderEntryRef={orderEntryRef} attRef={attRef}
      focusName={false} namingVersion={namingVersion} setNamingVersion={setNamingVersion}
      versionName={versionName} setVersionName={setVersionName}
      startVersionName={() => setNamingVersion(true)} confirmVersion={() => setNamingVersion(false)}
      openAttachment={noop} delAttachment={noop} addAttachment={noop}
      setShowVersions={noop} setPrintMode={noop} setConfirm={noop} setShowOrderCopy={noop}
      samples={{ need: 2, ordered: 1, total: 3 }} onOpenSamples={noop}
    />
  );
}

const BOOKS = [
  { id: "vtc", kind: "order", name: "Virginia Tile — Anatolia", active: true, data: { markups: { default: 45 }, lastImport: { at: Date.now() - 12 * DAY, by: "Sam", count: 812 } } },
  { id: "erp", kind: "stock", name: "ERP stock", active: true, data: { lastImport: { at: Date.now() - 3 * DAY, by: "Sam", count: 1400 } } },
  // The brand-box demo (2026-08-18): an order book whose sheet carries no brand
  // column, a few real-shaped items, so the Brand tab and the table's landed
  // names can be exercised live.
  { id: "glz", kind: "order", name: "Glazzio Tile", active: true, data: { markups: { default: 50 }, rep: { name: "Jeff Krejci", email: "jeff@glazzio.example" }, sampleContact: { name: "Glazzio samples desk", email: "samples@glazzio.example" }, lastImport: { at: Date.now() - 20 * DAY, by: "Sam", count: 4 } } },
  // Past the 120-day default, so the stale flag + the Confirm-current card
  // (Source drawer) can be exercised live.
  { id: "old", kind: "order", name: "Emser — West", active: true, data: { markups: { default: 45 }, lastImport: { at: Date.now() - 140 * DAY, by: "Sam", count: 96 } } },
];

const GLZ_ITEMS = [
  { sku: "CS-108", type: "tile", size: "2x8", description: "CRYSTAL SERIES ICE BLUE", cost: 8.4, sfPerUnit: 5.4, unit: "SF", orderUnit: "CT" },
  { sku: "AR-214", type: "tile", size: "12x24", description: "ARVORA GLACIER MATTE", cost: 4.1, sfPerUnit: 15.5, unit: "SF", orderUnit: "CT" },
  { sku: "PC-77", size: "", description: "PENCIL LINER SILVER", cost: 11.2, unit: "PC" },
  // The RYM5532 report (2026-08-18): a stored name that doubled the series
  // around the heading's "Collection" — normOrderItem's load-time clean
  // renders it "Rythmique Fandango".
  { sku: "RYM5532", type: "tile", size: "2.5x9", description: "RYTHMIQUE COLLECTION RYTHMIQUE FANDANGO", cost: 78.35, sfPerUnit: 8.61, unit: "BX", orderUnit: "BX" },
].map((it) => normOrderItem({ ...it, bookId: "glz" }));

function LibraryDemo() {
  const [settings, setSettings] = useState({ pricing: {}, ops: {} });
  // Stateful books + updateBook so the book page's config drawers (markup,
  // freight, brand) actually save-and-rerender in the harness.
  const [books, setBooks] = useState(BOOKS);
  const updateBook = (id, { name, active, dataPatch } = {}) => setBooks((bs) => bs.map((b) => b.id === id
    ? { ...b, ...(name != null ? { name } : {}), ...(active != null ? { active } : {}), data: dataPatch ? { ...b.data, ...dataPatch } : b.data }
    : b));
  return (
    <div className="flex" style={{ minHeight: 420 }}>
      <PriceBookLibrary
        books={books} addBook={async () => "new"} updateBook={updateBook} delBook={noop}
        confirmBook={(id) => updateBook(id, { dataPatch: { confirmed: { at: Date.now(), by: "You" } } })}
        loadBookItems={async (id) => (id === "glz" ? GLZ_ITEMS : [])} applyBookImport={async () => {}} loadBookVersions={async () => []}
        loadBookVersionSnapshot={async () => null} pinBookVersion={noop} updateBookItem={noop}
        setBookItemsDisabled={noop} reviewBookItemFlags={noop} setBookItemIssue={noop} addClaudeIssue={noop}
        settings={settings} setSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL}
      />
    </div>
  );
}

function Page() {
  return (
    <div className="p-5" style={{ background: "var(--ft-cream)", minHeight: "100vh" }}>
      <div className="ft-eyebrow text-[10px] mb-2">Project header — one-bar, compact</div>
      <div id="proj-header" style={{ maxWidth: 1120 }}><ProjectHeaderDemo /></div>
      <div className="ft-eyebrow text-[10px] mt-6 mb-2">Price books — landing header, compact</div>
      <div id="pb-header" className="rounded-lg border border-slate-200 bg-white"><LibraryDemo /></div>
    </div>
  );
}

createRoot(document.getElementById("header-preview")).render(<Page />);
