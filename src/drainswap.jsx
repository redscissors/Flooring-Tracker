// The stepped drain swap (ticket 158 Phase 1a, mockup layout A): rows of chips
// and a summary strip. Both shower popups mount it; each owns what a chip means.
import { PopMenu } from "./widgets.jsx";

export function DrainSwapPop({ at, className = "", title, rows, summary, onUse, onClose }) {
  return (
    <PopMenu at={at} width={460} pad={10} z={90} onClose={onClose}>
      <div className={className + " text-[12px] px-2.5 py-2"} onClick={(e) => e.stopPropagation()} data-drain-swap>
        <div className="font-extrabold text-[13px] mb-2">{title}</div>
        {rows.filter((r) => r.chips.length).map((r) => (
          <div key={r.label} className="flex items-center gap-2 my-1.5 flex-wrap">
            <span className="w-[64px] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{r.label}</span>
            {r.chips.map((c) => (
              <button key={c.key} type="button" title={c.title || ""} disabled={!c.ok}
                onClick={() => c.ok && c.onPick()}
                className={"rounded-full px-2.5 py-0.5 font-bold border "
                  + (c.on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white"
                    : c.ok ? "border-slate-400 bg-white" : "border-dashed border-slate-300 text-slate-400 cursor-not-allowed")}
                data-drain-chip={r.label + ":" + c.key}>
                {c.label}
              </button>
            ))}
          </div>
        ))}
        <div className="mt-2 rounded-lg border border-slate-200 bg-[color:var(--ft-tint)] px-2.5 py-2 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <b>{summary.what}</b>
            <span className="block text-[11px] text-slate-500 font-semibold">{summary.why}</span>
          </div>
          <span className={"font-extrabold tabular-nums " + (summary.up ? "text-[color:var(--s-rust,#B4552D)]" : "")}>{summary.delta} · {summary.total}</span>
          <button type="button" onClick={onUse} className="rounded-md bg-[color:var(--ft-brand)] text-white font-extrabold px-3 py-1" data-drain-use>Use this</button>
        </div>
      </div>
    </PopMenu>
  );
}
