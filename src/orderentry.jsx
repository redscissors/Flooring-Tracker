// "Copy for order entry" panel — a read-only view over the current project that
// formats its lines for pasting into the vendor order-entry program.
//
// Special-order lines come first: each is a two-line item (size + color / SKU +
// coverage) with CT tagged at the front for carton lines (the one unit start
// kept — Marcus 2026-08-20), the ordered qty, and per-unit cost & sell priced
// in the sell unit.
// Special covers both price-book order items and Sheoga-configurator lines
// (floors and their at-cost fee lines). Sheoga sells by description, not SKU,
// so those rows say so where the SKU would sit and copy the qty inline — the
// copied text is the whole order, since there's no SKU for the desk to key.
// Each special line carries two copy buttons that latch to a green check so
// you can track which specials you've already keyed: the entry-line button
// (orderEntryLine — SKU ⇥ description ⇥ qty ⇥ cost ⇥ sell, for the desk's
// AutoHotkey paste macro, issue 112) and the description-field copy (the unit
// tag leads it, as on screen). Freight rides this list too — one line per vendor, keyed
// as 1 EA at that vendor's whole charge (freightOrderRow). Stock
// lines follow with per-line checkboxes plus "Copy all" / "Copy selected",
// each line as SKU⇥quantity (the order desk's Cut & Order format). The
// estimated materials (mortar, grout, grout base, caulk, underlayment) are
// stock items too, so they ride the same list — labeled with their kind —
// and one "Copy all" pastes the whole order. A line with no SKU can't be
// keyed, so it shows red and is left out of the copies. A line with no
// QUANTITY is keyed as 1 (orderQty) — the ERP takes no zero-quantity line and
// a zero qty blanks the per-unit pricing — and the whole row turns amber so the
// salesperson can see the panel supplied that number, not the estimate.
//
// Pure presentation: App.jsx builds the row objects (orderEntryRow) from the
// snapshotted product rows and passes them in. Nothing here mutates state,
// touches Supabase, or prints — so it can be mounted in isolation for preview.
// Docks as a right sidebar on wide screens, becomes a full-screen module below.

import { useState } from "react";
import { Copy, Check, ClipboardList, X } from "lucide-react";
import { orderEntryLine } from "./orderentry.js";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// "Copied / done" affordance — a filled moss chip matching the stock rows'
// checkboxes (accent-color: --ft-brand), white check on moss. Set inline rather
// than via Tailwind's emerald utilities, which this theme's build does not render.
const DONE_MOSS = { color: "#fff", background: "var(--ft-brand)", borderColor: "var(--ft-brand)" };
// A line whose quantity the panel supplied itself (orderQty — no qty on the
// row, so it keys as 1). Amber is already this app's "we changed this, look at
// it" signal: the grid rings a missing Sq Ft cell in the same amber, and the
// split-description Ext button below is amber too. Inline, like DONE_MOSS,
// because the row's zebra background is inline and would otherwise win.
const ASSUMED_BG = "#fef6e2";
const ASSUMED_INK = "#b45309";
// A tinted row alone is easy to skim past on a long order; the edge bar is what
// makes the flagged lines countable down the side of the list.
const ASSUMED_ROW = { background: ASSUMED_BG, boxShadow: "inset 3px 0 0 #f59e0b" };
const ASSUMED_TITLE = "No quantity on this line — the panel keyed it as 1. Set the real quantity when you enter the order.";
// Cost/sell read in the sell unit; "SF" shows lowercase to match the estimate's
// "/sf", the rest stay uppercase codes (CT/SH/PC/EA).
const perUnit = (code) => "/" + (code === "SF" ? "sf" : code);

// Text copy button with a brief "Copied" confirmation (used for the stock bulk
// copies). Falls back to execCommand when the async clipboard API is
// unavailable (older/insecure context).
export function CopyBtn({ text, label = "Copy", disabled = false, className = "" }) {
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
    <button onClick={copy} disabled={disabled || !text} style={done ? DONE_MOSS : undefined}
      className={"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-default " + (done ? "" : "border-slate-200 hover:bg-slate-50 ") + className}>
      {done ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}

const GRID = { display: "grid", gridTemplateColumns: "54px minmax(0,1fr) 42px 76px 76px", alignItems: "center", gap: "8px" };

// One special-order line. The copy button copies the whole item (with tag) and
// latches to a green check so the salesperson can see what's already entered.
const writeClipboard = async (text) => {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  }
};

function SpecialRow({ r, alt, descLimit }) {
  const [copied, setCopied] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  const [copiedExt, setCopiedExt] = useState(false);
  const copy = async () => { await writeClipboard(r.copy); setCopied(true); };
  const copyLine = async () => { await writeClipboard(orderEntryLine(r)); setCopiedLine(true); };
  const copyExt = async () => { await writeClipboard(r.desc.ext); setCopiedExt(true); };
  const d = r.desc;
  return (
    <div style={{ ...GRID, padding: "9px 12px", background: alt ? "var(--ft-prod)" : "transparent", ...(r.qtyAssumed ? ASSUMED_ROW : null) }}
      title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      className="border-t border-slate-100 first:border-t-0">
      <div className="flex items-center gap-0.5">
        <button onClick={copyLine} style={copiedLine ? DONE_MOSS : undefined}
          title={"Copy the whole entry line for the desk paste macro:\nSKU ⇥ description ⇥ qty ⇥ cost ⇥ sell (real tabs between fields)"}
          className={"grid place-items-center w-[26px] h-[26px] rounded-md border transition-colors " +
            (copiedLine ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
          {copiedLine ? <Check size={15} /> : <ClipboardList size={15} />}
        </button>
        <button onClick={copy} title="Copy the description field only" style={copied ? DONE_MOSS : undefined}
          className={"grid place-items-center w-[26px] h-[26px] rounded-md border transition-colors " +
            (copied ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
          {copied ? <Check size={15} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[12.5px] leading-tight">
          {r.tag && <span className="ft-eyebrow text-[9px] font-extrabold tracking-[.06em] rounded px-1 py-px mr-1.5 align-[1px]"
            style={{ color: "var(--ft-brand-deep)", background: "var(--ft-brand-soft)" }}>{r.tag}</span>}
          {/* A nominal sheet size (12x12") keeps the vendor's exact dims on hover. */}
          <span className="ft-mono text-slate-500" title={r.sizeTrue || undefined}>{r.sizePlain}</span>
          {r.name && <> <span className="font-bold">{r.name}</span></>}
        </div>
        <div className="truncate text-[11px] leading-tight text-slate-400 ft-mono">
          <span className="font-semibold text-slate-500">{r.byDesc ? "by description — no SKU" : r.sku || "—"}</span>{r.coverage && ` ${r.coverage}`}
        </div>

        {/* What will actually land in the description field, shown only once it
            stops being the plain description — so an abbreviation is never a
            surprise after pasting, and a split announces its second half.
            Hovering the chip (or Ext) shows the full written-out description. */}
        {d && d.tier !== "full" && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="ft-mono text-[11px] leading-tight rounded px-1 py-px break-all" title={d.full}
              style={{ background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" }}>{d.main}</span>
            <span className={"text-[10px] leading-tight " + (d.over > 0 ? "text-red-600 font-semibold" : "text-slate-400")}>
              {d.main.length}/{descLimit}
            </span>
            {d.ext && (
              <button onClick={copyExt} title={"Copy the full description for the extended-text field:\n\n" + d.ext}
                style={copiedExt ? DONE_MOSS : undefined}
                className={"inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold border transition-colors " +
                  (copiedExt ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50")}>
                {copiedExt ? <Check size={11} /> : <Copy size={11} />} Ext
              </button>
            )}
          </div>
        )}
      </div>

      <div className="text-right ft-mono font-bold text-[13px] whitespace-nowrap" style={r.qtyAssumed ? { color: ASSUMED_INK } : undefined}>
        {r.qty > 0 ? <>{r.qty} <span className={"text-[9px] font-semibold " + (r.qtyAssumed ? "" : "text-slate-400")}>{r.unitCode}</span></> : "—"}
        {r.qtyAssumed && <div className="ft-eyebrow text-[8px] font-extrabold tracking-[.06em] leading-tight">assumed</div>}
      </div>
      <div className="text-right ft-mono font-semibold text-[12.5px] whitespace-nowrap">{money(r.perCost)}<span className="text-[9px] font-semibold text-slate-400">{perUnit(r.unitCode)}</span></div>
      <div className="text-right ft-mono font-bold text-[12.5px] whitespace-nowrap" style={{ color: "var(--ft-brand-deep)" }}>{money(r.perSell)}<span className="text-[9px] font-semibold text-slate-400">{perUnit(r.unitCode)}</span></div>
    </div>
  );
}

// Checkbox list with "Copy all" / "Copy selected": one line per item, SKU then
// a tab then the bare order quantity — the format the shop's order desk pastes
// (SKU⇥qty), matching Cut & Order. A row with no SKU shows red and stays out
// of the copies — a pasted blank would key the wrong thing silently.
function CopySection({ title, rows, emptyText, hint }) {
  const [sel, setSel] = useState(() => new Set());
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const line = (r) => `${r.sku}\t${r.qty}`;
  const copyable = rows.filter((r) => r.sku);
  const assumed = rows.filter((r) => r.qtyAssumed).length;
  const bulk = copyable.map(line).join("\n");
  const selected = copyable.filter((r) => sel.has(r.id)).map(line).join("\n");
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500">{title} · {rows.length}</h4>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <CopyBtn text={bulk} label="Copy all" />
            <CopyBtn text={selected} disabled={sel.size === 0} label={sel.size ? `Copy selected (${sel.size})` : "Copy selected"} />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">{emptyText}</p>
      ) : (
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {rows.map((r) => (
            <label key={r.id} title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
              style={r.qtyAssumed ? ASSUMED_ROW : undefined}
              className={"flex items-center gap-2 px-3 py-2 text-[12.5px] " + (r.sku ? "cursor-pointer hover:bg-slate-50" : "cursor-default")}>
              <span className={"ft-mono shrink-0 w-24 truncate " + (r.sku ? "text-slate-400" : "font-semibold text-red-600")} title={r.sku}>{r.sku || "no SKU"}</span>
              <span className={"ft-mono font-semibold shrink-0 min-w-[56px] whitespace-nowrap" + (r.sku ? "" : " text-red-600")}
                style={r.qtyAssumed ? { color: ASSUMED_INK } : undefined}>{r.qtyText}{r.qtyAssumed && <span className="ft-eyebrow text-[8px] font-extrabold tracking-[.06em] ml-1">assumed</span>}</span>
              <span className={"truncate flex-1" + (r.sku ? "" : " text-red-600")}>{r.name}{r.kind && <span className={"text-[11px] " + (r.sku ? "text-slate-400" : "text-red-400")}> {r.kind}</span>}</span>
              <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} disabled={!r.sku}
                className="w-[17px] h-[17px] shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default" style={{ accentColor: "var(--ft-brand)" }} />
            </label>
          ))}
          <div className="px-3 py-1.5 text-[11px] text-slate-400">
            {hint}
            {assumed > 0 && <span className="text-amber-700"> {assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — copied as 1.</span>}
            {copyable.length < rows.length && <span className="text-red-600"> Red lines have no SKU and are not copied.</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export function OrderEntryPanel({ name, special = [], stock = [], descLimit = 0, onClose }) {
  const splits = special.filter((r) => r.desc && r.desc.ext).length;
  const assumed = special.filter((r) => r.qtyAssumed).length;
  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[560px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <div className="ft-serif text-xl leading-tight">Copy for order entry</div>
            <div className="text-[12px] text-slate-400 truncate">{name}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Special order — two-line items, copied one at a time (no bulk copy) */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500">Special order · {special.length}</h4>
            </div>
            {special.length === 0 ? (
              <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">No special-order items in this project.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div style={{ ...GRID, padding: "6px 12px" }} className="bg-slate-100">
                  <span />
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500">Item</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Qty</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Cost</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Sell</span>
                </div>
                {special.map((r, i) => <SpecialRow key={r.id} r={r} alt={i % 2 === 1} descLimit={descLimit} />)}
                <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100">
                  <ClipboardList size={11} className="inline align-[-1px]" /> copies the whole entry line (SKU ⇥ description ⇥ qty ⇥ cost ⇥ sell) for the desk paste macro · <Copy size={11} className="inline align-[-1px]" /> copies the description field alone · A copied line stays a green check so you can track your place · Cost &amp; Sell are per the buy/sell unit.
                  {descLimit > 0 && <> · Descriptions are fitted to {descLimit} characters.</>}
                  {assumed > 0 && (
                    <span className="text-amber-700">
                      {" "}{assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — priced and keyed as <b>1</b>.
                    </span>
                  )}
                  {splits > 0 && (
                    <span className="text-amber-700">
                      {" "}{splits === 1 ? "One line is" : `${splits} lines are`} too long to fit — the “+” means the rest is in <b>Ext</b>.
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Stock — products + estimated materials; check lines, then Copy all / Copy selected */}
          <CopySection title="Stock" rows={stock} emptyText="No stock items in this project."
            hint="Each line copies as SKU + tab + quantity, ready to paste." />
        </div>
      </div>
    </div>
  );
}
