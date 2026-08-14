// Preview harness for the compact headers (2026-08-14): the REAL
// ProjectHeaderBar and PriceBookLibrary over local mock state, no Supabase.
// Dev-only entry (header-preview.html); not part of the app build.
import { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ProjectHeaderBar } from "./projectheader.jsx";
import { PriceBookLibrary } from "./pricebooklib.jsx";
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
    />
  );
}

const BOOKS = [
  { id: "vtc", kind: "order", name: "Virginia Tile — Anatolia", active: true, data: { markups: { default: 45 }, lastImport: { at: Date.now() - 12 * DAY, by: "Sam", count: 812 } } },
  { id: "erp", kind: "stock", name: "ERP stock", active: true, data: { lastImport: { at: Date.now() - 3 * DAY, by: "Sam", count: 1400 } } },
];

function LibraryDemo() {
  const [settings, setSettings] = useState({ pricing: {}, ops: {} });
  return (
    <div className="flex" style={{ minHeight: 420 }}>
      <PriceBookLibrary
        books={BOOKS} addBook={async () => "new"} updateBook={noop} delBook={noop}
        loadBookItems={async () => []} applyBookImport={async () => {}} loadBookVersions={async () => []}
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
