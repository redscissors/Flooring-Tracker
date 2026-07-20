// Preview harness for the Vendor sheets page (ADR 0020 sign-in groups; ADR
// 0021 board layout + selection). This is the REAL VendorFetchPage exported
// from App.jsx, driven by a local fixture settings blob
// (settings.ops.vendorGroups) with a stubbed network so the board columns,
// checkbox selection + batch download bar, always-live buttons (OVF has no
// live session — its downloads fail with the sign-in note), progress bars,
// checks, mismatch/stale icons, row ⋯ menu (create book / move / forget), and
// mobile stacking can be exercised without Supabase or a live portal.
//
// The network is stubbed (production code untouched): window.fetch is replaced
// with a fake relay that STREAMS bytes with a Content-Length so the real
// readSheetBytes/runFetch path drives a determinate bar; one filename ("ANA")
// fails, to show the error + partial-import banner. The dev server runs with
// dummy VITE_SUPABASE_* env vars so the client constructs offline (getSession
// returns no session — the fake fetch ignores the token).
// Served by the vite dev server at /.scratch/022_vendor-groups-preview/preview.html; never shipped.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { VendorFetchPage } from "../../src/vendorpanel.jsx";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.fetch = async (url, opts) => {
  const entry = JSON.parse(opts.body);
  // One sheet fails fast (non-retryable 4xx), to demo the error row + the
  // "import the N that worked" partial-success banner.
  if (/ANA/i.test(entry.filename)) {
    await sleep(500);
    return { ok: false, status: 404, json: async () => ({ error: "this sheet is no longer on the portal — download it by hand and drop it in" }) };
  }
  // A streamed body with a known length → determinate progress in readSheetBytes.
  const total = 240 * 1024;
  const chunk = new Uint8Array(16 * 1024);
  let sent = 0;
  const body = {
    getReader() {
      return {
        async read() {
          if (sent >= total) return { done: true, value: undefined };
          await sleep(90);
          sent += chunk.length;
          return { done: false, value: chunk };
        },
      };
    },
  };
  return { ok: true, status: 200, headers: { get: (k) => (k === "content-length" ? String(total) : null) }, body };
};

// --- fixture data ----------------------------------------------------------
const VT = "connect24.virginiatile.com", VTU = "C00000XX";
const OVF = "ovf400.ovf.com", OVFU = "OVF00000XX";
const sheet = (host, user, uid, filename) => ({ vendor: "dancik", host, uid, user, filename });

const DAY = 86400000;
// Two linked books: one imported long ago (stale → amber "book Nd old" on its
// sheet) and one imported recently (linked, no amber). staleDays default = 120.
const BOOKS0 = [
  { id: "bk-aot", kind: "order", name: "AOT EFT 26 02 19", active: true, data: { lastImport: { at: Date.now() - 200 * DAY, by: "Dave" } } },
  { id: "bk-mar", kind: "order", name: "Marazzi EFT 26 01 30", active: true, data: { lastImport: { at: Date.now() - 12 * DAY, by: "Dave" } } },
];

const SETTINGS0 = {
  ops: {
    vendorGroups: [
      {
        id: "g-vt", name: "Virginia Tile connect24 · C00000XX", loginUrl: "https://connect24.virginiatile.com/",
        portal: { host: VT, user: VTU },
        sheets: [
          { ...sheet(VT, VTU, "1071", "AOT EFT 26 02 19"), bookId: "bk-aot" },   // linked → STALE book (amber)
          sheet(VT, VTU, "1045", "ANA EFT 25 06 04"),                            // unlinked
          { ...sheet(VT, VTU, "1088", "Marazzi EFT 26 01 30"), bookId: "bk-mar" }, // linked → fresh book (no amber)
          // a sheet from a DIFFERENT account, dropped in here → mismatch chip
          sheet(OVF, OVFU, "196", "OVF Tarkett LVT (moved here)"),
        ],
      },
      {
        id: "g-ovf", name: "OVF (ovf400) · OVF00000XX", loginUrl: "",
        portal: { host: OVF, user: OVFU },
        sheets: [
          sheet(OVF, OVFU, "201", "OVF Mohawk carpet"),
          sheet(OVF, OVFU, "205", "OVF Shaw hardwood"),
        ],
      },
      { id: "g-fav", name: "Reorder every quarter", loginUrl: "", portal: null, sheets: [] },
    ],
  },
};

// A live entry (fresh session code) for the Virginia Tile account only — so its
// group is unlocked for "Re-download all" while OVF stays locked, showing both
// states side by side.
const VENDOR_PENDING = [{ vendor: "dancik", host: VT, uid: "1071", user: VTU, filename: "AOT EFT 26 02 19", sesid: "PreviewFreshToken1" }];

let _n = 0;
function Shell() {
  const [settings, setSettings] = useState(SETTINGS0);
  const [books, setBooks] = useState(BOOKS0);
  const [narrow, setNarrow] = useState(false);
  const setSettingsPatch = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const addBook = async ({ kind, name }) => { const id = `bk-new-${++_n}`; setBooks((bs) => [...bs, { id, kind, name, active: true, data: {} }]); return id; };
  return (
    <div style={{ minHeight: "100vh", background: "var(--ft-bg, #f6f5f1)" }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-white/70 text-xs">
        <strong className="ft-serif text-base">Vendor sheets — preview</strong>
        <button onClick={() => setNarrow((v) => !v)} className="rounded border border-slate-300 px-2 py-1">{narrow ? "▢ Desktop width" : "▯ Phone width"}</button>
        <span className="text-slate-400">Board columns. Tick rows → batch bar. AOT links to a 200-day-old book → amber icon; ⋯ menu creates/unlinks a book, moves (collapsible), forgets. VT has a live session; OVF downloads fail with the sign-in note.</span>
      </div>
      <div style={{ maxWidth: narrow ? 390 : "none", margin: narrow ? "0 auto" : 0, borderLeft: narrow ? "1px solid #ddd" : "none", borderRight: narrow ? "1px solid #ddd" : "none" }}>
        <div className="p-4 md:p-6">
          <VendorFetchPage settings={settings} setSettings={setSettingsPatch} onFiles={(files) => alert(`Would route ${files.length} fetched sheet(s) to the import review.`)} onFilesToBook={(files, prefer) => alert(`Would route ${files.length} sheet(s) to book ${prefer} in the import review.`)} vendorPending={VENDOR_PENDING} books={books} staleDays={120} addBook={addBook} inp={inp} lbl={lbl} />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Shell />);
