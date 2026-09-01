// Preview harness for the address Maps/paste buttons: the REAL AddressField in
// the three contexts it ships to, over local state. The clipboard is stubbed
// per-card (a two-line Maps copy, and a refusing browser) so the paste path and
// its fallback can be shot without a real clipboard permission.
// Dev-only entry (preview.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AddressField } from "../../src/widgets.jsx";
import { useToast } from "../../src/usetoast.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

// What Google Maps actually puts on the clipboard for a named place: the place
// name, then the street line.
const MAPS_COPY = "Cleveland Clinic\n9500 Euclid Ave, Cleveland, OH 44195";

const stubClipboard = (mode) => {
  navigator.clipboard
    ? Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: async () => { if (mode === "blocked") throw new Error("NotAllowedError"); return MAPS_COPY; } } })
    : null;
};

function Card({ title, label, start, placeholder, ping }) {
  const [v, setV] = useState(start);
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="ft-eyebrow text-[9px] mb-3" style={{ color: "var(--ft-faint)" }}>{title}</div>
      <label className={lbl}>{label}</label>
      <AddressField value={v} onChange={setV} inp={inp} placeholder={placeholder} ping={ping} />
    </div>
  );
}

function Preview() {
  const { toast, ping } = useToast();
  const [mode, setMode] = useState("ok");
  stubClipboard(mode);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="ft-serif" style={{ fontSize: 28, lineHeight: 1 }}>Address field — Maps + paste</h1>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-slate-500">Clipboard:</span>
          {["ok", "blocked"].map((m) => (
            <button key={m} onClick={() => setMode(m)} data-mode={m}
              className={"rounded-md border px-2.5 py-1 font-semibold " + (mode === m ? "border-indigo-300 text-indigo-700 bg-white" : "border-slate-200 text-slate-500")}>
              {m === "ok" ? "holds a Maps copy" : "browser refuses the read"}
            </button>
          ))}
        </div>
        <Card title="Project sheet" label="Project address" start="" placeholder="Project address…" ping={ping} />
        <Card title="Customer chip editor" label="Mailing address" start="4905 Harris Rd" ping={ping} />
        <Card title="Customer modal" label="Mailing address" start="" ping={ping} />
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Preview />);
