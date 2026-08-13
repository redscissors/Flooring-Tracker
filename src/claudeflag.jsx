import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEscClose } from "./widgets.jsx";
import { QUICK_REASONS, sourceLines } from "./claudeissues.js";

// Anthropic's clay — the one non-theme color, marking everything Claude across
// the app (the price book's bucket button already wore it).
export const CLAUDE_CLAY = "#D97757";
export const CLAUDE_CLAY_DEEP = "#B85C3F";

const CLAUDE_RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const r = i % 2 ? 8.2 : 10.6;
  const c = Math.cos(a), s = Math.sin(a);
  return [12 + 4.4 * c, 12 + 4.4 * s, 12 + r * c, 12 + r * s].map((n) => Math.round(n * 10) / 10);
});
export function ClaudeMark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      {CLAUDE_RAYS.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
    </svg>
  );
}

// The shared "Flag for Claude" popover (issue 087): every flag point opens it
// with a prebuilt source (claudeissues.js jobSource/bookSource/general) and Add
// lands ONE central issue — the note is optional, the context is captured.
// ctx = { source } | null; onAdd(text, source).
export function FlagForClaude({ ctx, onAdd, onClose }) {
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState([]);
  useEscClose(!!ctx, onClose);
  useEffect(() => { setNote(""); setPicked([]); }, [ctx]);
  if (!ctx) return null;
  const lines = sourceLines(ctx.source);
  const toggle = (r) => setPicked((c) => (c.includes(r) ? c.filter((x) => x !== r) : [...c, r]));
  const add = () => { onAdd([picked.join("; "), note.trim()].filter(Boolean).join(" — "), ctx.source); onClose(); };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(20,15,10,.4)" }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[390px] max-w-full rounded-xl border border-slate-200 bg-white shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-2.5" style={{ color: CLAUDE_CLAY }}>
          <ClaudeMark size={15} />
          <h3 className="text-sm font-bold" style={{ color: "var(--ft-text, #1C1A17)" }}>Flag for Claude</h3>
        </div>
        {lines.length > 0 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 mb-2.5">
            <div className="ft-eyebrow text-[8.5px] mb-1">Captured automatically</div>
            {lines.map((l, i) => <div key={i} className={`text-xs font-semibold leading-snug ${i ? "text-slate-500 font-medium" : ""}`}>{l}</div>)}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_REASONS.map((r) => (
            <button key={r} onClick={() => toggle(r)}
              className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${picked.includes(r) ? "" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
              style={picked.includes(r) ? { borderColor: CLAUDE_CLAY, color: CLAUDE_CLAY_DEEP, background: "color-mix(in oklab, #D97757 12%, transparent)" } : undefined}>
              {r}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus rows={3}
          placeholder="What's wrong? Optional — a sentence helps Claude start in the right place."
          className="ft-field w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y" />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="text-xs font-semibold rounded-md border border-slate-200 px-3 py-1.5 text-slate-500 hover:bg-slate-50">Cancel</button>
          <button onClick={add} className="flex items-center gap-1.5 text-xs font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5">
            <span style={{ color: CLAUDE_CLAY }}><ClaudeMark size={12} /></span> Add to Claude issues
          </button>
        </div>
      </div>
    </div>, document.body);
}
