// Preview harness for task 11 (2026-09-01 plan, fix round 1, Finding 3): the
// REAL SettingsWorkspace, mounted on its General section, with only
// `window.fetch` for /.netlify/functions/maps stubbed — the "Test address
// lookup" button, `runProbe`, and `probeText` are all the real shipped code.
//
// Session stub: same reason and shape as preview.jsx in this folder —
// `useAddressSuggest`/`probeMaps` (usemapslookup.js) both call
// `supabase.auth.getSession()` before every relay call. Run with the real
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY so `supabase` is a real client,
// then its `getSession` is stubbed to a fake token — only that one call's
// own network round trip is faked. No real credential lives here.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import SettingsWorkspace from "../../src/SettingsWorkspace.jsx";
import { normalizeSettings, withDerived } from "../../src/catalog.js";
import { TYPES, TLBL } from "../../src/uiconst.js";
import { useToast } from "../../src/usetoast.js";
import { supabase } from "../../src/lib/supabase.js";

if (supabase) {
  supabase.auth.getSession = async () => ({ data: { session: { access_token: "preview-fake-token" } } });
}

// The relay, faked at the fetch boundary — everything above it (runProbe,
// probeMaps, probeText) is the real code the app ships. Modes mirror the
// task's four reporting cases.
let probeMode = "ok"; // "ok" | "not-configured" | "places-403" | "both-403" | "unauthorized"
const PROBE_REPLY = {
  ok: { status: 200, body: { ok: true, keyPresent: true, places: 200, routes: 200 } },
  "not-configured": { status: 503, body: { error: "not-configured" } },
  "places-403": { status: 200, body: { ok: false, keyPresent: true, places: 403, routes: 200 } },
  "both-403": { status: 200, body: { ok: false, keyPresent: true, places: 403, routes: 403 } },
  unauthorized: { status: 401, body: { error: "unauthorized" } },
};

window.fetch = async (url, opts) => {
  if (!String(url).includes("/.netlify/functions/maps")) throw new Error("unexpected fetch: " + url);
  const { op } = JSON.parse(opts.body);
  if (op !== "probe") throw new Error("unexpected op: " + op);
  await new Promise((r) => setTimeout(r, 120)); // so "Checking…" is shootable
  const { status, body } = PROBE_REPLY[probeMode];
  return { ok: status >= 200 && status < 300, json: async () => body };
};

const noop = () => {};

function Preview() {
  const { ping } = useToast();
  const [settings, setSettingsState] = useState(() => normalizeSettings({ shop: { address: "1 Shop St, Akron, OH" } }));
  const setSettings = (patch) => setSettingsState((s) => withDerived({ ...s, ...patch }));
  const [theme, setTheme] = useState("light");
  const [headerLayout, setHeaderLayout] = useState("bar");
  const [uiMode, setUiMode] = useState("ok");
  const setMode = (m) => { probeMode = m; setUiMode(m); };

  return (
    <div className="min-h-screen" style={{ background: "var(--ft-cream)" }}>
      <div className="fixed top-2 left-2 z-[60] flex items-center gap-2 text-[12px] flex-wrap bg-white rounded-md border border-slate-200 p-2">
        <span className="text-slate-500">Probe reply:</span>
        {["ok", "not-configured", "places-403", "both-403", "unauthorized"].map((m) => (
          <button key={m} onClick={() => setMode(m)} data-mode={m}
            className={"rounded-md border px-2.5 py-1 font-semibold " + (uiMode === m ? "border-indigo-300 text-indigo-700 bg-white" : "border-slate-200 text-slate-500")}>
            {m}
          </button>
        ))}
      </div>
      <SettingsWorkspace
        onClose={noop} settings={settings} setSettings={setSettings} gFamilies={[]}
        exportBackup={noop} importBackup={noop} fileRef={{ current: null }}
        inp="ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        lbl="ft-eyebrow text-[10px] mb-1 block" types={TYPES} typeLabels={TLBL}
        theme={theme} setTheme={setTheme} headerLayout={headerLayout} setHeaderLayout={setHeaderLayout}
        profile={{ name: "Danny" }} saveProfile={noop} user={{ email: "demo@example.com" }}
        books={[]} addBook={noop} updateBook={noop} confirmBook={noop} delBook={noop}
        loadBookItems={noop} applyBookImport={noop} loadBookVersions={noop} loadBookVersionSnapshot={noop} pinBookVersion={noop}
        updateBookItem={noop} setBookItemsDisabled={noop} reviewBookItemFlags={noop} setBookItemIssue={noop} addClaudeIssue={noop}
        bookStock={{}} bookStockReady initialSection="general" onSectionChange={noop} ping={ping}
      />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Preview />);
