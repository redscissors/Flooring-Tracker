// Preview harness for ADR 0028: one-press Escape from inside a text box, and
// the ft-open-layer refresh restore — driven by the REAL escstack.js ladder,
// the REAL Modal (widgets.jsx registers it on the ladder), and the REAL
// SheogaConfigurator wired exactly like App.jsx wires it (onConfigChange
// writes ft-open-layer; mount reads it back and reopens mid-configuration).
// Served by vite; never shipped.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { Modal } from "../../src/widgets.jsx";
import SheogaConfigurator from "../../src/SheogaConfigurator.jsx";

const KEY = "ft-open-layer";
const readLayer = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const writeLayer = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { } };

function Preview() {
  const [log, setLog] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  // Refresh restore, mirroring App.jsx: a stored sheoga layer reopens the
  // configurator on its stored live seed.
  const [sheoga, setSheoga] = useState(() => { const l = readLayer(); return l?.kind === "sheoga" ? { seed: l.seed || null, restored: true } : null; });
  const note = (s) => setLog((x) => [...x, s]);
  useEffect(() => {
    if (sheoga?.restored) note("RELOAD → ft-open-layer restored the Sheoga configurator mid-configuration");
    const on = (e) => { if (e.key === "Escape" && !e.repeat) note(`Escape press (focus: ${document.activeElement?.tagName || "none"})`); };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="min-h-screen p-6 space-y-4" style={{ background: "var(--ft-cream)" }}>
      <h1 className="text-lg font-extrabold">Popup persistence + one-press Escape</h1>
      <div className="flex gap-2">
        <button data-t="open-modal" onClick={() => { setModalOpen(true); note("popup opened"); }} className="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-sm font-semibold">Open popup (Modal + text box)</button>
        <button data-t="open-sheoga" onClick={() => setSheoga({ seed: null })} className="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-sm font-semibold">Open Sheoga configurator</button>
      </div>
      <div data-t="log" className="rounded-md border border-slate-200 bg-white p-3 text-xs font-mono space-y-0.5">
        {log.length === 0 ? <div className="text-slate-400">event log…</div> : log.map((s, i) => <div key={i}>{s}</div>)}
      </div>
      <div className="text-xs text-slate-500 font-mono">ft-open-layer: <span data-t="stored">{JSON.stringify(readLayer())}</span></div>
      {modalOpen && (
        <Modal onClose={() => { setModalOpen(false); note("→ popup closed"); }} title="Demo popup">
          <p className="text-sm text-slate-500 mb-3">The cursor is in the text box below. ONE Escape press should close this popup — no blur-first step.</p>
          <input autoFocus placeholder="focus lives here" className="ft-field w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
        </Modal>
      )}
      {sheoga && (
        <SheogaConfigurator seed={sheoga.seed} initialSf={120} markupDefault={40} ventMarkupDefault={50}
          basket={[]} onBasketChange={() => { }} onMove={() => { }} onMoveEntries={() => { }}
          onAdd={() => { }} areaName="Kitchen"
          onConfigChange={(live) => { writeLayer({ kind: "sheoga", seed: live }); }}
          onClose={() => { setSheoga(null); writeLayer(null); note("→ Sheoga configurator closed"); }} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
