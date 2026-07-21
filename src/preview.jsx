// Preview harness for the project-header split (projectheader.jsx): the REAL
// ProjectHeaderBar (one-bar, 2026-07-21) and ProjectHeaderClassic rendered over
// fake job data — every control is live (tier rows, waste card, save-version
// popover, hover tips) without touching Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ProjectHeaderBar, ProjectHeaderClassic } from "./projectheader.jsx";

const SEL = {
  id: "p1", name: "New House", address: "", notes: "", quick: false, customerId: "c1",
  priceTier: "retail", customPct: "", printPricing: "none",
  salesperson: { name: "Marcus", phone: "330 893 1292", email: "" },
  attachments: [{ id: "a1", name: "kitchen-photo.jpg", type: "image/jpeg", size: 230000 }, { id: "a2", name: "measure-sheet.pdf", type: "application/pdf", size: 90000 }],
  versions: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
  categories: [], waste: null, _full: true,
};
const CUST = { id: "c1", name: "Test Man", address: "", builderId: "b1" };
const SETTINGS = { pricing: {}, waste: { tile: 10, floor: 5 } };
const PROFILE = { name: "Marcus", phone: "330 893 1292", email: "" };

function Harness() {
  const [sel, setSel] = useState(SEL);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [log, setLog] = useState("—");
  const nameRef = useRef(null);
  const addAreaRef = useRef(null);
  const attRef = useRef(null);
  const updateProject = (id, patch) => setSel((s) => ({ ...s, ...patch }));
  const say = (m) => () => setLog(m);
  const tv = { tier: sel.priceTier || "retail", pct: sel.priceTier === "builder" ? 8 : sel.priceTier === "sale" ? 10 : sel.priceTier === "custom" ? Number(sel.customPct) || 0 : 0 };
  const props = {
    sel, cust: CUST, builderName: "P&L Builders", profile: PROFILE, tv, grandTotal: 27250.54, saveOk: false,
    settings: SETTINGS, jobWasteUI: sel.waste || { tile: 10, floor: 5, tileOn: true, floorOn: true }, updateProject,
    onOpenCustomer: say("open customer modal"), onPromote: say("promote"),
    nameRef, addAreaRef, focusName: false, tabTo: () => () => {},
    namingVersion, setNamingVersion, versionName, setVersionName,
    startVersionName: () => { setVersionName(""); setNamingVersion(true); },
    confirmVersion: () => { setLog(`saved version "${versionName || "Untitled"}"`); setNamingVersion(false); },
    openAttachment: say("open file"), delAttachment: say("delete file"), attRef, addAttachment: say("add file"),
    setShowVersions: say("open version history"), setPrintMode: (m) => setLog(`print mode: ${m}`),
    setConfirm: say("confirm delete project"), setShowOrderCopy: say("open Order entry panel"), addArea: say("add area"),
  };
  return (
    <div className="min-h-screen p-6" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div style={{ maxWidth: 1160 }}>
        <h1 className="text-lg font-bold mb-0.5">Project header — real components, fake data</h1>
        <p className="text-xs mb-1" style={{ color: "var(--ft-faint)" }}>Everything is live: tier rows, waste card lock, save-version popover, file popover, hover tips. Last action: <b style={{ color: "var(--ft-brand-deep)" }}>{log}</b></p>
        <div className="ft-eyebrow text-[9px] mt-4 mb-2">One-bar (default)</div>
        <ProjectHeaderBar {...props} />
        <div className="ft-eyebrow text-[9px] mt-8 mb-2">Classic (Settings → General → Project header)</div>
        <ProjectHeaderClassic {...props} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
