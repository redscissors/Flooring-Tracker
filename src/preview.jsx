// Preview harness for the multi-sheet-per-book change. Renders the REAL
// SourceSheetStrip and VendorBookRow against fake props, so the change can be
// shown working without touching the live Supabase project or signing in.
// Dev-only entry (preview.html); not part of the app build.
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SourceSheetStrip, VendorBookRow, GateGap } from "./App.jsx";
import { sourceSlot, mergeSources, missingSources } from "./dropimport.js";

const sheet = (uid, filename, opts = {}) => ({
  vendor: "dancik", host: "connect24.virginiatile.com", uid, filename, user: "KEIM",
  bookId: "bkMirage", lastFetched: Date.parse("2026-07-18T12:00:00Z"), ...opts,
});

const group = { id: "g1", name: "Ohio Valley Flooring · KEIM", loginUrl: "", portal: null, sheets: [] };
const mirage = [
  { group, sheet: sheet("1", "OVF-Mirage-Hardwood.xls") },
  { group, sheet: sheet("2", "OVF-Mirage-Value-Tower.xls") },
  { group, sheet: sheet("3", "OVF-Mirage-Trim.xls") },
  { group, sheet: sheet("4", "Mirage_Product_Chart.pdf") },
];
const single = [{ group, sheet: sheet("9", "OVF-Hallmark.xls") }];

const fresh = { stale: false, days: 3 };
const book = { id: "bkMirage", name: "Mirage (OVF)", data: { lastImport: { at: Date.parse("2026-07-14T12:00:00Z"), skus: 858 } } };
const hallmark = { id: "bkH", name: "Hallmark (OVF)", data: { lastImport: { at: Date.now(), skus: 412 } } };

const noop = () => {};
const rowProps = {
  group, groups: [group], books: [book], prog: null, locked: false, mismatch: false, running: false,
  stale: fresh, pending: null, checked: false, onToggle: noop, onRedownload: noop, onReview: noop,
  onRemove: noop, onMove: noop, onLinkBook: noop, onUnlinkBook: noop, onOpenBook: noop,
};

const Case = ({ title, note, children }) => (
  <section className="mb-8">
    <h2 className="text-sm font-semibold mb-1">{title}</h2>
    <p className="text-xs text-slate-500 mb-2">{note}</p>
    <div className="rounded-xl border border-slate-200 bg-white p-3">{children}</div>
  </section>
);

function Preview() {
  const [pending, setPending] = React.useState(false);
  const pendingOf = (s) => (pending && (s.uid === "2" || s.uid === "3") ? { sheet: s, file: {} } : null);
  const pendingSources = mirage.filter(({ sheet }) => pendingOf(sheet));
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold mb-1">A book fed by several files</h1>
        <p className="text-xs text-slate-500 mb-6">
          Preview harness for the multi-file price-book work (ADR 0025). Renders the real
          components against fake props — nothing here touches Supabase.
        </p>

        <label className="flex items-center gap-2 text-xs mb-6">
          <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
          Simulate 2 of the 4 sheets downloaded and waiting for review
        </label>

        <Case title="Book page — source-sheet strip (4 sheets)" note="Each sheet gets its own Refresh/Review; the header acts on all of them.">
          <SourceSheetStrip sources={mirage} pendingSources={pendingSources} stale={fresh}
            lastImportAt={book.data.lastImport.at} pendingOf={pendingOf} liveOf={() => true}
            onRefresh={noop} onReview={noop} />
        </Case>

        <Case title="Book page — a stale book (amber)" note="The amber surface stays light in dark mode, so its text has to state an amber ink rather than inherit.">
          <SourceSheetStrip sources={single} pendingSources={[]} stale={{ stale: true, days: 91 }}
            lastImportAt={hallmark.data.lastImport.at} pendingOf={() => null} liveOf={() => false}
            onRefresh={noop} onReview={noop} />
        </Case>

        <Case title="Book page — a single-sheet book is unchanged" note="No header row, same one-line strip as before.">
          <SourceSheetStrip sources={single} pendingSources={[]} stale={fresh}
            lastImportAt={hallmark.data.lastImport.at} pendingOf={() => null} liveOf={() => false}
            onRefresh={noop} onReview={noop} />
        </Case>

        <Case title="Library board — one row per book, not per sheet" note="The Mirage row reports “4 sheets”; its checkbox and Refresh cover all four.">
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-w-md">
            <VendorBookRow {...rowProps} sheet={mirage[0].sheet} siblings={mirage.slice(1).map((m) => m.sheet)} book={book} />
            <VendorBookRow {...rowProps} sheet={single[0].sheet} book={hallmark} />
          </div>
        </Case>

        <GateCase />
      </div>
    </div>
  );
}

// The completeness gate (ADR 0025), driven by the real manifest helpers rather
// than hand-written props, so what renders is what an import would actually see.
const slots = {
  hardwood: sourceSlot({ recordKey: "dancik:ovf:101:KEIM", name: "OVF-Mirage-Hardwood.xls" }),
  tower: sourceSlot({ recordKey: "dancik:ovf:102:KEIM", name: "OVF-Mirage-Value-Tower.xls" }),
  trim: sourceSlot({ recordKey: "dancik:ovf:103:KEIM", name: "OVF-Mirage-Trim.xls" }),
  chart: sourceSlot({ fingerprint: { format: "mirage-chart" }, name: "Mirage_Product_Chart.pdf" }),
};
const manifest = mergeSources([], Object.values(slots), Date.parse("2026-04-01"));
const mirageBook = { id: "bkMirage", name: "Mirage (OVF)", data: { sources: manifest } };

function GateCase() {
  const [have, setHave] = React.useState(["hardwood", "tower", "trim"]);
  const present = have.map((k) => slots[k]);
  const missing = missingSources(manifest, present);
  const toggle = (k) => setHave((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-1">Import routing — completeness gate</h2>
      <p className="text-xs text-slate-500 mb-2">
        Three of Mirage's four files fetch from the portal; the Product Chart is supplied by hand.
        The gate names what is short and takes it on the spot. Filenames are never the match key —
        slots key on recordKey (fetched) or content fingerprint (manual).
      </p>
      <div className="flex flex-wrap gap-3 mb-2 text-[11px]">
        {Object.keys(slots).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="checkbox" checked={have.includes(k)} onChange={() => toggle(k)} />
            {slots[k].label}
          </label>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {missing.length === 0
          ? <p className="text-xs text-slate-500 py-2">All four present — no gate. This is also what a one-file book always sees.</p>
          : <GateGap book={mirageBook} have={present.length} total={manifest.length} missing={missing} onAdd={() => {}} />}
      </div>
    </section>
  );
}

const el = document.getElementById("preview");
const root = (window.__previewRoot ||= createRoot(el));
root.render(<Preview />);
