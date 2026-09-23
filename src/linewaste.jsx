import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { num, lineWastePct, ownWaste, wastePatch, getCarton } from "./catalog.js";
import { sf1 } from "./model.js";
import { useEscClose } from "./widgets.jsx";

export const POP_W = 236;

export const takesWaste = (p) => p.type !== "misc" && p.type !== "underlayment" && p.qtyType === "sqft";
const famLabel = (p) => (p.type === "tile" ? "tile" : "flooring");

// The small second line under a carton count (owner, option B 2026-09-23):
// grey when the line follows the job, moss when it carries its own rate — the
// color alone tells them apart (owner dropped the "line" suffix). Null
// when the line orders no waste and has no rate of its own, so the cell stays
// a plain count.
export function wasteTag(p, s) {
  if (!takesWaste(p)) return null;
  const pct = lineWastePct(p, s), own = ownWaste(p);
  if (!own && !pct) return null;
  return { pct, own, text: `${pct ? "+" : ""}${pct}%` };
}

export function wasteTagTitle(p, s, C) {
  const pct = lineWastePct(p, s), sqft = num(p.qty);
  const why = ownWaste(p) ? "this line's own rate" : `job ${famLabel(p)} rate`;
  return `${pct}% waste (${why}) — ${sf1(sqft)} sf measured${C ? `, ${sf1(C.order * C.sf)} sf ordered` : ""}. Click to change for this line.`;
}

// Job rate / None / Custom for one line. Blank `waste` follows the job; "0"
// is a deliberate none. `dflt` seeds Custom when the job has no rate to copy.
export function LineWasteControl({ p, s, dflt, onPatch, onDone }) {
  const own = ownWaste(p);
  const [mode, setMode] = useState(!own ? "job" : num(p.waste) === 0 ? "none" : "custom");
  const inRef = useRef(null);
  const jobPct = lineWastePct({ ...p, waste: "" }, s);
  const pick = (m) => {
    if (m === mode) return;
    setMode(m);
    if (m === "job") onPatch(wastePatch(p, s, ""));
    else if (m === "none") onPatch(wastePatch(p, s, "0"));
    else {
      onPatch(wastePatch(p, s, String(jobPct || num(dflt) || 10)));
      setTimeout(() => inRef.current?.select(), 0);
    }
  };
  const C = getCarton(p, s);
  const sqft = num(p.qty), pct = lineWastePct(p, s);
  const hand = p.cartonManual !== "" && p.cartonManual != null;
  const row = (m) => "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] " + (mode === m ? "font-bold" : "font-medium hover:bg-slate-50");
  const on = (m) => (mode === m ? { background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" } : undefined);
  const dot = (m) => (
    <span className="shrink-0 rounded-full flex items-center justify-center" style={{ width: 11, height: 11, border: `1.5px solid ${mode === m ? "var(--ft-brand)" : "var(--ft-border-strong)"}` }}>
      {mode === m && <span className="rounded-full" style={{ width: 5, height: 5, background: "var(--ft-brand)" }} />}
    </span>
  );
  return (
    <div onKeyDown={(e) => { if (e.key === "Enter") onDone?.(); }}>
      <button type="button" className={row("job")} style={on("job")} onClick={() => pick("job")}>
        {dot("job")} Job rate
        <span className="ml-auto font-medium" style={{ color: "var(--ft-faint)" }}>{jobPct ? `${famLabel(p)} ${jobPct}%` : `${famLabel(p)} off`}</span>
      </button>
      <button type="button" className={row("none")} style={on("none")} onClick={() => pick("none")}>{dot("none")} None</button>
      <div role="button" tabIndex={-1} className={row("custom") + " cursor-pointer"} style={on("custom")} onClick={() => pick("custom")}>
        {dot("custom")} Custom
        <span className="ml-auto flex items-baseline gap-0.5">
          <input ref={inRef} value={mode === "custom" ? p.waste : ""} inputMode="decimal" readOnly={mode !== "custom"} tabIndex={mode === "custom" ? 0 : -1}
            onChange={(e) => onPatch(wastePatch(p, s, e.target.value.replace(/[^\d.]/g, "")))}
            className={"w-9 bg-transparent text-right font-semibold focus:outline-none" + (mode === "custom" ? "" : " opacity-40 pointer-events-none")}
            style={{ borderBottom: "1px solid var(--ft-brand)", color: "var(--ft-text)" }} aria-label="Waste percent for this line" />
          <span className="text-[10.5px]" style={{ color: "var(--ft-faint)" }}>%</span>
        </span>
      </div>
      <div className="mt-1.5 pt-1.5 px-2 text-[10.5px] leading-snug" style={{ borderTop: "1px solid var(--ft-row-line)", color: "var(--ft-faint)" }}>
        {C
          ? `${sf1(sqft)} sf measured → ${sf1(sqft * (1 + pct / 100))} sf with waste · ${C.order} ${C.unit}${hand ? " (count set by hand)" : ""}`
          : "No carton size on this line — it bills the measured sq ft; waste applies to its grout, mortar and add-ons."}
      </div>
    </div>
  );
}

// Anchored at a point (the tag's corner or the line menu's), clamped to the
// viewport like the line menu; outside press, Esc or Enter closes it.
export function LineWastePop({ pop, p, s, dflt, onPatch, onClose }) {
  const ref = useRef(null);
  useEscClose(!!pop, onClose);
  useEffect(() => {
    if (!pop) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [pop, onClose]);
  if (!pop || !p) return null;
  const left = Math.max(8, Math.min(pop.x, window.innerWidth - POP_W - 8));
  const top = Math.max(8, Math.min(pop.y, window.innerHeight - 190));
  return createPortal(
    <div ref={ref} data-line-waste-pop style={{ left, top, width: POP_W }} className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg p-2">
      <div className="px-2 pb-1.5 uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".14em", color: "var(--ft-muted)" }}>Waste — this line</div>
      <LineWasteControl key={p.id} p={p} s={s} dflt={dflt} onPatch={onPatch} onDone={onClose} />
    </div>, document.body);
}

