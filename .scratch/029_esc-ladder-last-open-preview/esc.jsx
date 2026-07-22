// Preview harness for the Escape ladder + last-open spot (issue: page refresh
// loses your place). The ladder is the REAL escstack.js stack driven through
// the REAL useEscClose/Modal/DotMenu from widgets.jsx — the registrations
// below mirror App.jsx's (navigation at the bottom, overlays above). The
// last-open card uses the same read/validate/write logic App runs, against a
// preview-scoped localStorage key. Nothing here touches Supabase or signs in.
import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { Modal, DotMenu, useEscClose } from "../../src/widgets.jsx";

const SPOT_KEY = "ft-last-open-preview";

const projects = [{ id: "p1", name: "Jones — Master Bath", customerId: "c1" }];
const people = [{ id: "c1", name: "Sarah Jones" }];

function Demo() {
  // Mirrors App: selId = open project, selCustId = open customer.
  const [selId, setSelId] = useState(null);
  const [selCustId, setSelCustId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [log, setLog] = useState([]);
  const menuBtn = useRef(null);
  const note = (m) => setLog((l) => [...l.slice(-5), m]);

  // --- the same restore/persist pair App.jsx runs around boot ---
  const [restoreSpot, setRestoreSpot] = useState(() => { try { return JSON.parse(localStorage.getItem(SPOT_KEY) || "null"); } catch { return null; } });
  useEffect(() => {
    if (!restoreSpot) return;
    setRestoreSpot(null);
    if (selId || selCustId) return;
    if (restoreSpot.projectId && projects.some((p) => p.id === restoreSpot.projectId)) { setSelId(restoreSpot.projectId); setSelCustId("c1"); note("↻ reloaded — reopened the project"); return; }
    if (restoreSpot.customerId && people.some((c) => c.id === restoreSpot.customerId)) { setSelCustId(restoreSpot.customerId); note("↻ reloaded — reopened the customer"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSpot]);
  useEffect(() => {
    if (restoreSpot) return;
    try { localStorage.setItem(SPOT_KEY, JSON.stringify({ projectId: selId, customerId: selCustId })); } catch (x) { }
  }, [selId, selCustId, restoreSpot]);

  // --- the same Escape-ladder registrations App.jsx makes ---
  useEscClose(true, () => {
    if (selId) { setSelId(null); note("Esc → closed the project (customer view)"); return; }
    if (selCustId) { setSelCustId(null); note("Esc → closed the customer (home)"); }
  });
  useEscClose(showSettings, () => { setShowSettings(false); note("Esc → closed Settings"); });

  const sel = projects.find((p) => p.id === selId);
  const cust = people.find((c) => c.id === selCustId);
  const chip = "rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50";
  const screen = sel ? `Project — ${sel.name}` : cust ? `Customer — ${cust.name}` : "Home (landing screen)";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5" style={{ color: "var(--ft-text)" }}>
      <h1 className="ft-serif text-2xl">Esc ladder &amp; last-open spot</h1>

      <section className="rounded-lg border border-slate-200 p-4" style={{ background: "var(--ft-card)" }}>
        <div className="ft-eyebrow text-[9px] mb-2">Current screen</div>
        <div data-screen className="text-lg font-semibold mb-3">{screen}</div>
        <div className="flex flex-wrap gap-2">
          {!cust && <button className={chip} onClick={() => setSelCustId("c1")}>Open customer</button>}
          {cust && !sel && <button className={chip} onClick={() => setSelId("p1")}>Open project</button>}
          <button className={chip} onClick={() => setShowSettings(true)}>Open Settings overlay</button>
          <button className={chip} onClick={() => setShowModal(true)}>Open a Modal</button>
          <button ref={menuBtn} className={chip} onClick={() => setMenuOpen(true)}>Open a ⋯ menu</button>
          <button className={chip} onClick={() => location.reload()}>Reload page (spot survives)</button>
        </div>
        <input placeholder="Focus me, then press Esc — it only blurs (field-local Escape stays field-local)" className="ft-field mt-3 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <div className="ft-eyebrow text-[9px] mb-2">What Esc did</div>
        {log.length === 0 ? <div className="text-sm text-slate-400">Nothing yet — open layers, then press Esc repeatedly.</div> :
          <ol data-log className="text-sm space-y-1">{log.map((m, i) => <li key={i}>{m}</li>)}</ol>}
      </section>

      <DotMenu open={menuOpen} onClose={() => { setMenuOpen(false); note("Esc → closed the ⋯ menu"); }} anchorRef={menuBtn}>
        <div className="px-3 py-2">A real DotMenu — Esc closes just this.</div>
      </DotMenu>

      {showModal && (
        <Modal title="A real Modal" onClose={() => { setShowModal(false); note("Esc → closed the Modal"); }}>
          <p className="text-sm text-slate-500">Every Modal in the app now closes on Esc — this registration lives in the shared component. With this open above Settings, Esc closes this first, Settings next.</p>
        </Modal>
      )}

      {showSettings && (
        <div className="print:hidden fixed inset-0 z-40 p-8" style={{ background: "rgba(20,15,10,.4)" }}>
          <div className="h-full rounded-xl border border-slate-200 p-5" style={{ background: "var(--ft-card)" }}>
            <div className="flex items-center justify-between">
              <h2 className="ft-serif text-xl">Settings-style workspace</h2>
              <button className={chip} onClick={() => setShowSettings(false)}>Close</button>
            </div>
            <p className="text-sm text-slate-500 mt-2">Registered like App's Settings/Apps overlays. Try opening the Modal on top of it, then Esc twice.</p>
            <button className={chip + " mt-3"} onClick={() => setShowModal(true)}>Open a Modal above this</button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Demo />);
