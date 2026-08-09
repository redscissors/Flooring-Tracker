// Preview harness for the Settings workspace's shrink-to-fit zoom (issue 084):
// mounts the REAL SettingsWorkspace from src/ with fixture settings — no
// Supabase reads or writes. ?section=<id> picks the open section so the shoot
// script can walk them. Served by the vite dev server at
// /.scratch/084_settings-mobile-shrink/preview.html; never shipped.
import { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { normalizeSettings } from "../../src/catalog.js";
import { TYPES, TLBL } from "../../src/uiconst.js";
import SettingsWorkspace from "../../src/SettingsWorkspace.jsx";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const section = new URLSearchParams(location.search).get("section") || "materials";

function Harness() {
  const [settings, setSettingsState] = useState(() => normalizeSettings(null));
  const fileRef = useRef(null);
  const noop = () => {};
  const noopAsync = async () => [];
  return (
    <SettingsWorkspace onClose={noop}
      initialSection={section}
      settings={settings} setSettings={(patch) => setSettingsState((s) => normalizeSettings({ ...s, ...patch }))}
      gFamilies={[]}
      exportBackup={noop} importBackup={noop} fileRef={fileRef}
      inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL}
      theme="light" setTheme={noop} headerLayout="bar" setHeaderLayout={noop}
      profile={{ name: "Marcus", phone: "330 893 1292", email: "marcus@example.com" }} saveProfile={noop}
      user={{ id: "u1", email: "marcus@example.com" }}
      books={[]} addBook={noop} updateBook={noop} delBook={noop}
      loadBookItems={noopAsync} applyBookImport={noopAsync}
      loadBookVersions={noopAsync} loadBookVersionSnapshot={noopAsync} pinBookVersion={noop}
      updateBookItem={noop} setBookItemsDisabled={noop} reviewBookItemFlags={noop} setBookItemIssue={noop}
      bookStock={{}} bookStockReady={true} refreshBookStock={noop} />
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
