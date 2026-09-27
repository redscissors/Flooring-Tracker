// The stepped swap popover (ticket 158 Phase 1, mockup layout A): rows of
// chips and a summary strip. Both shower popups mount it for the drain and
// every stepped line, and for a group's "+" (Phase 1c: a qty stepper in the
// strip, a list of parts as children); each owns what a chip means and what
// Use this commits.
import { PopMenu } from "./widgets.jsx";

const money = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The summary strip's change against the committed line: "+$12.30", "−$4.00", "±0". */
export const fmDelta = (d) => (d > 0 ? "+" : d < 0 ? "−" : "±") + (d ? money(Math.abs(d)) : "0");

const GLYPH = { "1/8": "⅛", "1/4": "¼", "3/8": "⅜", "1/2": "½", "5/8": "⅝", "3/4": "¾", "7/8": "⅞" };
/** Inch text for a chip: '3/4"' → "¾″", '1-1/8"' → "1⅛″"; other fractions keep their digits. */
export const inchGlyph = (s) => String(s || "")
  .replace(/(?:(\d+)[-\s])?(\d+\/\d+)/g, (m, whole, f) => (GLYPH[f] ? (whole || "") + GLYPH[f] : m))
  .replace(/"/g, "″");

// Under Stock only a row lists its stocked chips first (a stable sort, so
// Auto keeps its place ahead of them).
const stockOrder = (chips) => [...chips].sort((a, b) => (a.so ? 1 : 0) - (b.so ? 1 : 0));

export function SwapPop({ at, className = "", title, rows, summary, onUse, onClose, stockFirst = false, qty, onQty, children, add = false }) {
  return (
    <PopMenu at={at} width={460} pad={10} z={90} onClose={onClose}>
      <div className={className + " text-[12px] px-2.5 py-2"} onClick={(e) => e.stopPropagation()} data-drain-swap {...(add ? { "data-add-pop": "" } : {})}>
        <div className="font-extrabold text-[13px] mb-2">{title}</div>
        {rows.filter((r) => r.chips.length).map((r) => (
          <div key={r.label} className="flex items-center gap-2 my-1.5 flex-wrap">
            <span className="w-[64px] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{r.label}</span>
            {(stockFirst ? stockOrder(r.chips) : r.chips).map((c) => (
              <button key={c.key} type="button" title={c.title || (c.so ? "special order" : "")} disabled={!c.ok}
                onClick={() => c.ok && c.onPick()}
                className={"rounded-full px-2.5 py-0.5 font-bold border "
                  + (c.on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white"
                    : c.ok ? "border-slate-400 bg-white" : "border-dashed border-slate-300 text-slate-400 cursor-not-allowed")}
                data-drain-chip={r.label + ":" + c.key}>
                {c.so && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle bg-[color:var(--s-rust,#B4552D)]" data-so-dot />}
                {c.label}
              </button>
            ))}
          </div>
        ))}
        {children}
        {summary && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-[color:var(--ft-tint)] px-2.5 py-2 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <b>{summary.what}</b>
            <span className="block text-[11px] text-slate-500 font-semibold">{summary.why}</span>
          </div>
          <span className={"font-extrabold tabular-nums " + (summary.up ? "text-[color:var(--s-rust,#B4552D)]" : "")}>{summary.delta} · {summary.total}</span>
          {onQty && (
            <span className="inline-flex items-center rounded-md border border-slate-300 bg-white" data-add-qty>
              <button type="button" className="px-2 font-extrabold" onClick={() => onQty(Math.max(1, qty - 1))} title="one less">−</button>
              <span className="min-w-[18px] text-center font-extrabold tabular-nums">{qty}</span>
              <button type="button" className="px-2 font-extrabold" onClick={() => onQty(qty + 1)} title="one more">+</button>
            </span>
          )}
          <button type="button" onClick={onUse} className="rounded-md bg-[color:var(--ft-brand)] text-white font-extrabold px-3 py-1" data-drain-use>Use this</button>
        </div>
        )}
      </div>
    </PopMenu>
  );
}
