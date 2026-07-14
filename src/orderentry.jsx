// "Copy for order entry" panel — a read-only view over the current project that
// formats its lines for pasting into the vendor order-entry program.
//
// Special-order lines come first: each has a single copyable summary field
// (size · product/color · SKU · coverage) the salesperson pastes, plus the
// order quantity and the cost/sell amounts (per-unit and extended) keyed by
// hand. Stock lines follow with one bulk copy for the whole list.
//
// Pure presentation: App.jsx builds the row objects (orderEntryRow) from the
// snapshotted product rows and passes them in. Nothing here mutates state,
// touches Supabase, or prints — so it can be mounted in isolation for preview.
// Docks as a right sidebar on wide screens, becomes a full-screen module below.

import { useState } from "react";
import { Copy, ClipboardCheck, X } from "lucide-react";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Copy-to-clipboard button with a brief "Copied" confirmation. Falls back to
// execCommand when the async clipboard API is unavailable (older/insecure ctx).
export function CopyBtn({ text, label = "Copy", className = "" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setDone(true); setTimeout(() => setDone(false), 1400);
  };
  return (
    <button onClick={copy} disabled={!text}
      className={"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border transition-colors disabled:opacity-40 " + (done ? "border-emerald-300 bg-emerald-50 text-emerald-700 " : "border-slate-200 hover:bg-slate-50 ") + className}>
      {done ? <><ClipboardCheck size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}

const Amount = ({ per, ext, unit }) => (
  <span className="ft-mono whitespace-nowrap">{money(per)}<span className="text-slate-400">/{unit}</span> · <b>{money(ext)}</b><span className="text-slate-400"> total</span></span>
);

export function OrderEntryPanel({ name, special = [], stock = [], onClose }) {
  // Provisional bulk format for stock (final column spec pending): one
  // tab-separated line per item — SKU · qty · description.
  const stockBulk = stock.map((r) => [r.sku, r.qtyText, r.name].map((x) => String(x || "").trim()).join("\t")).join("\n");

  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[540px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <div className="ft-serif text-xl leading-tight">Copy for order entry</div>
            <div className="text-[12px] text-slate-400 truncate">{name}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Special order — one copyable field per line, amounts keyed by hand */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500">Special order · {special.length}</h4>
            </div>
            {special.length === 0 ? (
              <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">No special-order items in this project.</p>
            ) : (
              <div className="space-y-2.5">
                {special.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="ft-eyebrow text-[9px] tracking-[.1em] text-slate-400 pt-0.5">{r.area}</span>
                      <CopyBtn text={r.copy} />
                    </div>
                    <div className="ft-mono text-[12.5px] leading-snug bg-slate-50 rounded-md px-2.5 py-2 border border-slate-100 break-words">{r.copy || <span className="text-slate-300">—</span>}</div>
                    <div className="mt-2.5 space-y-1 text-[12.5px]">
                      <div className="flex items-baseline gap-2"><span className="w-11 shrink-0 text-slate-400">Order</span><span className="ft-mono font-bold">{r.qtyText}</span></div>
                      <div className="flex items-baseline gap-2"><span className="w-11 shrink-0 text-slate-400">Cost</span><Amount per={r.perCost} ext={r.extCost} unit={r.unit} /></div>
                      <div className="flex items-baseline gap-2"><span className="w-11 shrink-0 text-slate-400">Sell</span><Amount per={r.perSell} ext={r.extSell} unit={r.unit} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Stock — one bulk copy for the whole list (final format TBD) */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500">Stock · {stock.length}</h4>
              {stock.length > 0 && <CopyBtn text={stockBulk} label="Copy all" />}
            </div>
            {stock.length === 0 ? (
              <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">No stock items in this project.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {stock.map((r) => (
                  <div key={r.id} className="flex items-baseline gap-2 px-3 py-2 text-[12.5px]">
                    <span className="ft-mono text-slate-400 shrink-0 w-24 truncate" title={r.sku}>{r.sku || "—"}</span>
                    <span className="ft-mono font-semibold shrink-0 w-16">{r.qtyText}</span>
                    <span className="truncate flex-1">{r.name}</span>
                  </div>
                ))}
                <div className="px-3 py-1.5 text-[11px] text-slate-400">Bulk copy format is provisional — final column layout pending.</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
