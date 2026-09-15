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
// A per-line copy button grabs the description field (the unit tag leads it, as
// on screen) and then stays a green check, so you can track which specials
// you've already keyed. Freight rides this list too — one line per vendor, keyed
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
// Two views (owner 2026-09-14): the panel opens MERGED & SORTED — lines
// sharing a SKU combine into one (mergeOrderLines), and both lists band by
// vendor group in the desk's order (groupOrderLines) — because ERP One keeps
// two pasted lines with one SKU as two lines. A merged line wears a moss pill
// (×N areas) that opens its per-area breakdown; a line held apart on purpose
// (same SKU, different unit or price) says so in a quiet note. SHEET ORDER is
// the list exactly as the estimate reads it, banded by area (sheetBands).
// The copies follow whichever view is showing.
//
// Pure presentation: App.jsx builds the row objects (orderEntryRow) from the
// snapshotted product rows and passes them in. Nothing here mutates state,
// touches Supabase, or prints — so it can be mounted in isolation for preview.
// Docks as a right sidebar on wide screens, becomes a full-screen module below.
// Loaded lazily by App.jsx: the vendor classifiers orderlines.js leans on pull
// the wedi and Schluter catalogs, which stay out of the boot chunk (ADR 0026).

import { useMemo, useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { CopyBtn, DONE_MOSS, writeClipboard } from "./copybtn.jsx";
import { HelpTip } from "./widgets.jsx";
import { mergeOrderLines, groupOrderLines, sheetBands } from "./orderlines.js";
import { deliverToRows, deliverToSequence, splitAddress } from "./deliverto.js";

export { CopyBtn } from "./copybtn.jsx";

const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const KEPT_TEXT = { unit: "same SKU · unit differs", price: "same SKU · price differs" };
const KEPT_TITLE = {
  unit: "Another line on this order has the same SKU in a different sell unit. They were not combined — a summed quantity would mix units.",
  price: "Another line on this order has the same SKU at a different per-unit cost or sell. They were not combined — a merged line can carry only one price.",
};

// Merged-line pill: how many areas (or lines, when one area repeated a SKU)
// fed the line; click opens the breakdown beneath.
function MergedPill({ r, open, onToggle }) {
  const areas = new Set(r.from.map((f) => f.area)).size;
  const label = areas > 1 ? `×${areas} areas` : `×${r.from.length} lines`;
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }} aria-expanded={open}
      title={open ? "Hide where this line came from" : "Show where this line came from"}
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-px ml-1.5 text-[9.5px] font-extrabold tracking-[.04em] align-[1px] border-0 cursor-pointer whitespace-nowrap"
      style={DONE_MOSS}>{label}</button>
  );
}
function KeptNote({ r }) {
  return (
    <span title={KEPT_TITLE[r.kept]}
      className="inline-block shrink-0 rounded-full px-1.5 py-px ml-1.5 text-[9.5px] font-bold tracking-[.03em] align-[1px] border border-slate-200 bg-slate-100 text-slate-500 whitespace-nowrap">
      {KEPT_TEXT[r.kept]}
    </span>
  );
}
function FromList({ r, unit }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-slate-500 ft-mono">
      {r.from.map((f, i) => (
        <span key={i}>
          <span className="inline-block w-[5px] h-[5px] rounded-full mr-1 align-[1px]" style={{ background: "var(--ft-brand)" }} />
          {f.area || "—"} {f.qty} {unit}{f.qtyAssumed && <span className="ft-eyebrow text-[8px] font-extrabold tracking-[.06em] ml-1" style={{ color: ASSUMED_INK }}>assumed</span>}
        </span>
      ))}
    </div>
  );
}

const GRID = { display: "grid", gridTemplateColumns: "24px minmax(0,1fr) 42px 76px 76px", alignItems: "center", gap: "8px" };

// One special-order line. The copy button copies the whole item (with tag) and
// latches to a green check so the salesperson can see what's already entered.
function SpecialRow({ r, alt, descLimit }) {
  const [copied, setCopied] = useState(false);
  const [copiedExt, setCopiedExt] = useState(false);
  const [showFrom, setShowFrom] = useState(false);
  const copy = async () => { await writeClipboard(r.copy); setCopied(true); };
  const copyExt = async () => { await writeClipboard(r.desc.ext); setCopiedExt(true); };
  const d = r.desc;
  return (
    <div style={{ ...GRID, padding: "9px 12px", background: alt ? "var(--ft-prod)" : "transparent", ...(r.qtyAssumed ? ASSUMED_ROW : null) }}
      title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      className="border-t border-slate-100">
      <button onClick={copy} title="Copy the description field" style={copied ? DONE_MOSS : undefined}
        className={"grid place-items-center w-[26px] h-[26px] rounded-md border transition-colors " +
          (copied ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
        {copied ? <Check size={15} /> : <Copy size={14} />}
      </button>

      <div className="min-w-0">
        <div className="truncate text-[12.5px] leading-tight">
          {r.tag && <span className="ft-eyebrow text-[9px] font-extrabold tracking-[.06em] rounded px-1 py-px mr-1.5 align-[1px]"
            style={{ color: "var(--ft-brand-deep)", background: "var(--ft-brand-soft)" }}>{r.tag}</span>}
          {/* A nominal sheet size (12x12") keeps the vendor's exact dims on hover. */}
          <span className="ft-mono text-slate-500" title={r.sizeTrue || undefined}>{r.sizePlain}</span>
          {r.name && <> <span className="font-bold">{r.name}</span></>}
        </div>
        <div className="truncate text-[11px] leading-tight text-slate-400 ft-mono">
          <span className="font-semibold text-slate-500">{r.byDesc ? (r.freight ? "by vendor — no SKU" : "by description — no SKU") : r.sku || "—"}</span>{r.coverage && ` ${r.coverage}`}
          {r.kept && !r.from && r.area && <span className="text-slate-400"> · {r.area}</span>}
        </div>
        {(r.from || r.kept) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1 [&>*]:ml-0">
            {r.from && <MergedPill r={r} open={showFrom} onToggle={() => setShowFrom((v) => !v)} />}
            {r.kept && <KeptNote r={r} />}
          </div>
        )}
        {r.from && showFrom && <FromList r={r} unit={r.unitCode} />}

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

// A band heading inside a list: a vendor group in the merged view, an area in
// sheet order.
function Band({ label, area, first }) {
  return (
    <div className={"px-3 py-1 ft-eyebrow text-[9.5px] tracking-[.12em] border-slate-100 " + (first ? "" : "border-t ") + (area ? "bg-slate-50 text-slate-400" : "bg-slate-100 text-slate-500")}>
      {label}
    </div>
  );
}

// One stock line: SKU, quantity, name — plus the merged pill / kept note and
// the breakdown the pill opens.
function StockRow({ r, sel, onToggle, unit }) {
  const [showFrom, setShowFrom] = useState(false);
  return (
    <label title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      style={r.qtyAssumed ? ASSUMED_ROW : undefined}
      className={"flex items-center gap-2 px-3 py-2 text-[12.5px] border-t border-slate-100 " + (r.sku ? "cursor-pointer hover:bg-slate-50" : "cursor-default")}>
      <span className={"ft-mono shrink-0 w-24 truncate " + (r.sku ? "text-slate-400" : "font-semibold text-red-600")} title={r.sku}>{r.sku || "no SKU"}</span>
      <span className={"ft-mono font-semibold shrink-0 min-w-[56px] whitespace-nowrap" + (r.sku ? "" : " text-red-600")}
        style={r.qtyAssumed ? { color: ASSUMED_INK } : undefined}>{r.qtyText}{r.qtyAssumed && <span className="ft-eyebrow text-[8px] font-extrabold tracking-[.06em] ml-1">assumed</span>}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center min-w-0">
          <span className={"truncate" + (r.sku ? "" : " text-red-600")}>
            {r.name}{r.kind && <span className={"text-[11px] " + (r.sku ? "text-slate-400" : "text-red-400")}> {r.kind}</span>}
          </span>
          {r.from && <MergedPill r={r} open={showFrom} onToggle={() => setShowFrom((v) => !v)} />}
          {r.kept && <KeptNote r={r} />}
        </span>
        {r.from && showFrom && <FromList r={r} unit={unit} />}
      </span>
      <input type="checkbox" checked={sel} onChange={onToggle} disabled={!r.sku}
        className="w-[17px] h-[17px] shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default" style={{ accentColor: "var(--ft-brand)" }} />
    </label>
  );
}

// Section heading with its standing rules behind a ? — the footer under each
// list keeps only what reports state (merge notes, assumed quantities, splits).
function Heading({ children, tip }) {
  return (
    <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500 inline-flex items-center gap-1.5">
      {children}{tip && <HelpTip className="align-middle" w={280} tip={tip} />}
    </h4>
  );
}

// One copy button that latches to a green check — the SpecialRow affordance,
// shared with the Deliver to block. `texts` (an array) writes each entry in
// turn so Windows clipboard history (Win+V) holds every one; the gap gives
// the history a beat to register each write, and the whole run stays well
// inside the browser's activation window for clipboard access.
const SEQ_GAP_MS = 80;
function LatchCopy({ text, texts, title }) {
  const [copied, setCopied] = useState(false);
  const list = texts || [text];
  const copy = async () => {
    for (let i = 0; i < list.length; i++) {
      if (i) await new Promise((r) => setTimeout(r, SEQ_GAP_MS));
      await writeClipboard(list[i]);
    }
    setCopied(true);
  };
  return (
    <button onClick={copy} disabled={!list.some(Boolean)} title={title} style={copied ? DONE_MOSS : undefined}
      className={"grid place-items-center w-[26px] h-[26px] rounded-md border transition-colors disabled:opacity-30 disabled:cursor-default " +
        (copied ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
      {copied ? <Check size={15} /> : <Copy size={14} />}
    </button>
  );
}

const DELIVER_TIP = <>The customer's delivery details as a mailing label. Click any line — or the city, state or ZIP on its own — to copy just that; it turns green so you can track your place. The button at the left copies every field one after another and the whole label last: <b>Ctrl+V</b> pastes the label, <b>Win+V</b> lists each field so you can pick the one an ERP 1 box wants. The address is the project's (the customer's mailing address when the project has none).</>;

// One click-to-copy piece of the label — a whole line, or one word of the
// city line, since ERP 1 keys city, state and ZIP as three fields.
function Seg({ value, label, bold }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button type="button" title={`Copy ${label}`} onClick={async () => { await writeClipboard(value); setCopied(true); }}
      className={"inline rounded px-0.5 -mx-0.5 text-left transition-colors hover:bg-slate-100 " + (bold ? "font-bold " : "") + (copied ? "font-semibold" : "")}
      style={copied ? { color: "var(--ft-brand-deep)", background: "var(--ft-brand-soft)" } : undefined}>
      {value}
    </button>
  );
}

// The customer / delivery block (owner's layout, 2026-09-15): the project's
// one-line address split into ERP 1's fields (deliverto.js) and read as a
// mailing label — name, street, apt/suite, "City, ST ZIP", phone — each piece
// its own Seg, with one latching copy-all at the left like a special-order
// line's. A line the splitter can't read shows whole with an inline warning:
// a guessed city or ZIP would paste silently.
function DeliverTo({ custInfo }) {
  const rows = useMemo(() => deliverToRows(custInfo), [custInfo]);
  const f = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const split = splitAddress(custInfo?.address);
  const any = rows.some((r) => r.value);
  return (
    <section>
      <Heading tip={DELIVER_TIP}>Deliver to</Heading>
      {!any ? (
        <p className="mt-2 text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">No customer name, address or phone on this project.</p>
      ) : (
        <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-stretch">
            <div className="flex items-center px-2 border-r border-slate-100 bg-slate-50">
              <LatchCopy texts={deliverToSequence(rows)} title={"Copy every field, then the whole label.\nCtrl+V pastes the label; Win+V lists each field for the delivery form."} />
            </div>
            <div className="min-w-0 flex-1 px-3 py-2 text-[12.5px] leading-[1.45]">
              <div><Seg value={f.name} label="delivery name" bold /></div>
              <div><Seg value={f.street} label="street" /></div>
              {f.apt && <div><Seg value={f.apt} label="apt/suite" /></div>}
              {(f.city || f.state || f.zip) && (
                <div>
                  <Seg value={f.city} label="city" />{f.city && f.state && ","} <Seg value={f.state} label="state" /> <Seg value={f.zip} label="ZIP code" />
                </div>
              )}
              <div><Seg value={f.phone} label="phone number" /></div>
            </div>
          </div>
          {!split.ok && (
            <div className="px-3 py-1.5 text-[11px] text-amber-700 border-t border-slate-100">
              This address couldn't be split into fields — it's shown as one line. Check the project address.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Checkbox list with "Copy all" / "Copy selected": one line per item, SKU then
// a tab then the bare order quantity — the format the shop's order desk pastes
// (SKU⇥qty), matching Cut & Order. A row with no SKU shows red and stays out
// of the copies — a pasted blank would key the wrong thing silently. `bands`
// is the list in the order it copies, already merged or as entered.
function CopySection({ title, bands, areaBands, count, emptyText, tip, note }) {
  const [sel, setSel] = useState(() => new Set());
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const rows = bands.flatMap((b) => b.rows);
  const line = (r) => `${r.sku}\t${r.qty}`;
  const copyable = rows.filter((r) => r.sku);
  const assumed = rows.filter((r) => r.qtyAssumed).length;
  const bulk = copyable.map(line).join("\n");
  const picked = copyable.filter((r) => sel.has(r.id));
  const selected = picked.map(line).join("\n");
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <Heading tip={tip}>{title} · {count}</Heading>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <CopyBtn text={bulk} label="Copy all" />
            <CopyBtn text={selected} disabled={picked.length === 0} label={picked.length ? `Copy selected (${picked.length})` : "Copy selected"} />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">{emptyText}</p>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          {bands.map((b, bi) => (
            <div key={b.label} className="contents">
              <Band label={b.label} area={areaBands} first={bi === 0} />
              {b.rows.map((r) => <StockRow key={r.id} r={r} sel={sel.has(r.id)} onToggle={() => toggle(r.id)} unit={r.unitCode || ""} />)}
            </div>
          ))}
          {(note || assumed > 0 || copyable.length < rows.length) && (
            <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 space-x-1">
              {note}
              {assumed > 0 && <span className="text-amber-700">{assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — copied as 1.</span>}
              {copyable.length < rows.length && <span className="text-red-600">Red lines have no SKU and are not copied.</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// "N lines combined into M" / "K kept apart" for a section's footer.
function mergeNote(rows) {
  const merged = rows.filter((r) => r.from);
  const sources = merged.reduce((n, r) => n + r.from.length, 0);
  const kept = rows.filter((r) => r.kept).length;
  if (!merged.length && !kept) return null;
  return (
    <>
      {merged.length > 0 && <span className="font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{sources} lines combined into {merged.length}.</span>}
      {kept > 0 && <span>{kept === 1 ? "One line kept apart" : `${kept} lines kept apart`}: same SKU, different unit or price.</span>}
    </>
  );
}

// Merged-and-sorted vs sheet-order views of one list, keyed off the panel's
// switch. Computed once per row set — the rows are rebuilt by App.jsx only when
// the project changes.
const useViews = (rows) => useMemo(() => {
  const merged = mergeOrderLines(rows);
  return { merged: { rows: merged, bands: groupOrderLines(merged) }, sheet: { rows, bands: sheetBands(rows) } };
}, [rows]);

export function OrderEntryPanel({ name, custInfo, special = [], stock = [], descLimit = 0, onClose }) {
  const [view, setView] = useState("merged");
  const sp = useViews(special), st = useViews(stock);
  const spv = sp[view], stv = st[view];
  const specialRows = spv.bands.flatMap((b) => b.rows);
  // Only MARKED splits count — a line whose sole losses are soft parts (brand,
  // "Collection") pastes a whole spec and needs no amber warning.
  const splits = specialRows.filter((r) => r.desc && r.desc.cut).length;
  const assumed = specialRows.filter((r) => r.qtyAssumed).length;
  const isMerged = view === "merged";
  const specialNote = isMerged ? mergeNote(specialRows) : null;
  const segBtn = (v, label) => (
    <button type="button" onClick={() => setView(v)} aria-pressed={view === v}
      className={"rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors " + (view === v ? "" : "text-slate-500 hover:bg-slate-100")}
      style={view === v ? DONE_MOSS : undefined}>{label}</button>
  );
  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[560px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-4 py-3 border-b border-slate-200 shrink-0 gap-3">
          <div className="min-w-0">
            <div className="ft-serif text-xl leading-tight">Copy for order entry</div>
            <div className="text-[12px] text-slate-400 truncate">{name}</div>
            <div className="inline-flex items-center gap-0.5 mt-2 p-0.5 rounded-lg border border-slate-200 bg-slate-50" role="group" aria-label="List view"
              title="Merged & sorted combines lines that share a SKU and groups them by vendor. Sheet order is the list exactly as the estimate reads.">
              {segBtn("merged", "Merged & sorted")}
              {segBtn("sheet", "Sheet order")}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {custInfo && <DeliverTo custInfo={custInfo} />}

          {/* Special order — two-line items, copied one at a time (no bulk copy) */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <Heading tip={<>A copied line stays a green check so you can track your place. Cost &amp; Sell are per the buy/sell unit.{descLimit > 0 && <> Descriptions are fitted to {descLimit} characters; a “+” means the rest goes in the extended-text field.</>}</>}>
                Special order · {specialRows.length}
              </Heading>
            </div>
            {specialRows.length === 0 ? (
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
                {(() => { let i = 0; return spv.bands.map((b) => (
                  <div key={b.label} className="contents">
                    <Band label={b.label} area={!isMerged} />
                    {b.rows.map((r) => <SpecialRow key={r.id} r={r} alt={i++ % 2 === 1} descLimit={descLimit} />)}
                  </div>
                )); })()}
                {(specialNote || assumed > 0 || splits > 0) && (
                  <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 space-x-1">
                    {specialNote}
                    {assumed > 0 && (
                      <span className="text-amber-700">
                        {assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — priced and keyed as <b>1</b>.
                      </span>
                    )}
                    {splits > 0 && (
                      <span className="text-amber-700">
                        {splits === 1 ? "One line is" : `${splits} lines are`} too long to fit — the “+” means the rest is in <b>Ext</b>.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Stock — products + estimated materials; check lines, then Copy all / Copy selected */}
          <CopySection key={view} title="Stock" bands={stv.bands} areaBands={!isMerged} count={stv.rows.length}
            emptyText="No stock items in this project."
            tip="Each line copies as SKU + tab + quantity, ready to paste. Copy all takes every line with a SKU; check lines for Copy selected." note={isMerged ? mergeNote(stv.rows) : null} />
        </div>
      </div>
    </div>
  );
}
