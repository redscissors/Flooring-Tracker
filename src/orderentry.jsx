// "Copy for order entry" panel — a read-only view over the current project that
// formats its lines for pasting into the vendor order-entry program.
//
// The panel opens on a HEADER BAR (owner, rounds 3–5): a band of bordered
// columns with nothing above it — Deliver to, the ERP 1 order column, and the
// project box over the view switch — replacing the old title row and the
// Deliver to section beneath it. Deliver to reads as a mailing label
// (deliverto.js splits the project's one-line address into ERP 1's fields):
// name · street · apt · "City, ST ZIP" · phone, each line — and the city, state
// and ZIP each on their own, since ERP 1 keys them as three fields — a
// click-to-copy `Seg` that latches green, plus one latching copy-all
// (deliverToSequence written entry by entry through clipseq.js).
//
// ERP order numbers: the desk keys a job under one or more ERP 1 orders, and
// every copy STAMPS the lines it copied on the active one. The stamps persist —
// App.jsx owns the writes (erpOrders/erpKeyed on the project), this panel only
// calls back through onAddOrder/onRemoveOrder/onStamp/onClearStamp — so a green
// check survives a reload and says WHICH order the line was keyed on. A
// numbered project with no order yet is GATED: the line copies are disabled
// until the order number is entered (gated, erporders.js); a quick price or an
// unnumbered draft is never gated and never stamped.
//
// Special-order lines come first: each is a two-line item (size + color / SKU +
// coverage) with CT tagged at the front for carton lines (the one unit start
// kept — Marcus 2026-08-20), the ordered qty, and per-unit cost & sell priced
// in the sell unit.
// Special covers both price-book order items and Sheoga-configurator lines
// (floors and their at-cost fee lines). Sheoga sells by description, not SKU,
// so those rows say so where the SKU would sit and copy the qty inline — the
// copied text is the whole order, since there's no SKU for the desk to key.
// Freight rides this list too — one line per vendor, keyed as 1 EA at that
// vendor's whole charge (freightOrderRow). Stock lines follow with per-line
// checkboxes plus "Copy remaining" / "Copy selected", each line as SKU⇥quantity
// (the order desk's Cut & Order format). The estimated materials (mortar,
// grout, grout base, caulk, underlayment) are stock items too, so they ride the
// same list — labeled with their kind. A line with no SKU can't be keyed, so it
// shows red and is left out of the copies. A line with no QUANTITY is keyed as
// 1 (orderQty) — the ERP takes no zero-quantity line and a zero qty blanks the
// per-unit pricing — and the whole row turns amber so the salesperson can see
// the panel supplied that number, not the estimate.
//
// Three views (owner 2026-09-17, replacing the 2026-09-14 vendor-first
// "Merged & sorted"): the panel opens on AREA + VENDOR — areas in sheet order,
// tile before trims inside each, a SKU combining only within its own area,
// with the configurator wedi and Schluter lines pulled into the desk's vendor
// bands beneath (areaVendorBands). COMPACT combines every SKU across the whole
// job into one run, tile then trims (compactBands) — because ERP One keeps
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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, X, Plus } from "lucide-react";
import { CopyBtn, DONE_MOSS, writeClipboard } from "./copybtn.jsx";
import { HelpTip, useAnchoredPanel, vPos, useEscClose } from "./widgets.jsx";
import { compactBands, areaVendorBands, sheetBands } from "./orderlines.js";
import { deliverToRows, deliverToSequence, splitAddress } from "./deliverto.js";
import { writeSequence } from "./clipseq.js";
import { gated, normErpNo, orderCounts, lineIds, lineStamp, keyedNo, remainingRows, keyedNote } from "./erporders.js";

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

const LOCK_TITLE = "Enter the ERP 1 order number first";
const BOX = { border: "1px solid var(--ft-border-strong)", borderRadius: 6, padding: "4px 8px 6px", minWidth: 0 };
const EYE = "ft-eyebrow text-[8px] flex items-center justify-between gap-1.5 min-h-[18px]";
const STAMP_NO = { fontSize: 7.5, fontWeight: 800, letterSpacing: ".02em", lineHeight: 1, marginTop: 2, color: "var(--ft-brand-deep)", fontVariantNumeric: "tabular-nums" };
const when = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const stampTitle = (st) => (st ? `Keyed on ERP ${st.no}${st.at ? ` — ${when(st.at)}` : ""}${st.by ? ` by ${st.by}` : ""}. Click for options.` : undefined);

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

// One click-to-copy piece of the label — a whole line, or one word of the
// city line, since ERP 1 keys city, state and ZIP as three fields.
function Seg({ value, label, bold, className = "", style, title }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button type="button" title={title || `Copy ${label}`} onClick={async () => { await writeClipboard(value); setCopied(true); }}
      className={"rounded px-0.5 -mx-0.5 text-left transition-colors hover:bg-slate-100 " + (bold ? "font-bold " : "") + (copied ? "font-semibold " : "") + className}
      style={{ ...(copied ? { color: "var(--ft-brand-deep)", background: "var(--ft-brand-soft)" } : null), ...style }}>
      {value}
    </button>
  );
}

// The options behind a persisted stamp: today's latch was one-way and reset
// on reopen; a stored one needs a way back that a mis-click can't take.
function KeyedPop({ stamp, active, onCopyAgain, onClear, render }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  const W = 252;
  const btn = "rounded-md px-2 py-1 text-[11.5px] font-semibold border transition-colors disabled:opacity-40";
  return (
    <>
      {render({ ref: anchorRef, onClick: () => setOpen((o) => !o) })}
      {open && pos && stamp && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), left: Math.max(8, Math.min(pos.left, window.innerWidth - W - 8)), width: W }}
          className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-[12px]">
          <div className="font-semibold">Keyed on ERP {stamp.no}</div>
          <div className="text-slate-500">{[when(stamp.at), stamp.by].filter(Boolean).join(" · ")}</div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <button onClick={() => { onCopyAgain(); setOpen(false); }} disabled={!active} title={active ? `Copies the line again and moves it to ERP ${active}` : "No active order"} className={btn + " border-slate-200 hover:bg-slate-50"}>Copy again</button>
            <button onClick={() => { onClear(); setOpen(false); }} className={btn} style={{ background: "var(--ft-accent)", color: "var(--ft-accent-ink)", borderColor: "var(--ft-accent)" }}>Clear</button>
            <button onClick={() => setOpen(false)} className={btn + " border-transparent text-slate-500 hover:bg-slate-50"}>Keep</button>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">Clearing changes NED only — the ERP order is untouched.</div>
        </div>, document.body)}
    </>
  );
}

// One copy button that latches to a green check — the SpecialRow affordance,
// shared with the Deliver to block. `texts` (an array) writes each entry in
// turn (clipseq.js — spaced so Windows clipboard history holds every one),
// counting up on the button while it runs so the desk waits for the check
// before Win+V; the whole run stays inside the browser's activation window.
function LatchCopy({ text, texts, title, small }) {
  const [copied, setCopied] = useState(false);
  const [at, setAt] = useState(0);
  const list = texts || [text];
  const copy = async () => {
    await writeSequence(list, { write: writeClipboard, onProgress: setAt });
    setAt(0); setCopied(true);
  };
  return (
    <button onClick={copy} disabled={!list.some(Boolean) || at > 0} title={title} style={copied ? DONE_MOSS : undefined}
      className={"grid place-items-center rounded-md border transition-colors disabled:opacity-30 disabled:cursor-default " +
        (small ? "w-5 h-5 " : "w-[26px] h-[26px] ") +
        (copied ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
      {at > 0 ? <span className="text-[9px] font-semibold tabular-nums text-slate-600">{at}/{list.length}</span>
        : copied ? <Check size={small ? 12 : 15} /> : <Copy size={small ? 12 : 14} />}
    </button>
  );
}

const DELIVER_TIP = <>The customer's delivery details as a mailing label. Click any line — or the city, state or ZIP on its own — to copy just that; it turns green so you can track your place. The button at the left copies every field one after another (a few seconds — it counts up, then shows a check) and the whole label last: <b>Ctrl+V</b> pastes the label, <b>Win+V</b> lists each field so you can pick the one an ERP 1 box wants. The address is the project's (the customer's mailing address when the project has none).</>;

// The Deliver to COLUMN of the header bar (owner, rounds 3–5): the same label
// and click-to-copy pieces, the copy-all latch in the eyebrow row. A quick
// price shows the eyebrow alone — its auto-name is no deliver-to.
function DeliverBox({ custInfo, quick }) {
  const rows = useMemo(() => deliverToRows(custInfo), [custInfo]);
  const f = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const split = splitAddress(custInfo?.address);
  const any = !quick && rows.some((r) => r.value);
  return (
    <div style={BOX} className="basis-full lg:basis-auto lg:flex-1">
      <div className={EYE}>
        <span className="inline-flex items-center gap-1">Deliver to{!quick && <HelpTip className="align-middle" w={280} tip={DELIVER_TIP} />}</span>
        {any && <LatchCopy small texts={deliverToSequence(rows)} title={"Copy every field, then the whole label.\nCtrl+V pastes the label; Win+V lists each field for the delivery form."} />}
      </div>
      {any && (
        <div className="text-[11.5px] leading-[1.35]">
          <div><Seg value={f.name} label="delivery name" bold /></div>
          <div><Seg value={f.street} label="street" /></div>
          {f.apt && <div><Seg value={f.apt} label="apt/suite" /></div>}
          {(f.city || f.state || f.zip) && <div><Seg value={f.city} label="city" />{f.city && f.state && ","} <Seg value={f.state} label="state" /> <Seg value={f.zip} label="ZIP code" /></div>}
          <div><Seg value={f.phone} label="phone number" /></div>
          {!split.ok && <div className="mt-1 text-[10.5px] leading-tight" style={{ color: ASSUMED_INK }}>Address couldn't be split into fields — shown as one line.</div>}
        </div>
      )}
      {!quick && !any && <div className="text-[11px] text-slate-400">No customer name, address or phone on this project.</div>}
    </div>
  );
}

// The ERP 1 order column: the entry field on top, each order a chip stacked
// under it (newest on top, the active one filled), fine print for state.
function ErpBox({ erpOrders, erpKeyed, active, setActive, locked, optional, onAdd, onRemove, note }) {
  const [draft, setDraft] = useState("");
  const [confirmNo, setConfirmNo] = useState(null);
  const per = orderCounts(erpKeyed);
  const submit = () => { const n = normErpNo(draft); if (!n) return; onAdd(n); setDraft(""); };
  const askRemove = (no) => { if (per[no]) setConfirmNo(no); else onRemove(no); };
  const chips = [...erpOrders].reverse();
  const field = "flex items-center gap-1 rounded-[5px] border bg-white h-6 pl-1.5 pr-[3px] " + (locked ? "" : "border-slate-300");
  return (
    <div style={BOX} className="w-[152px] shrink-0 flex flex-col gap-[3px]">
      <div className={EYE}><span>ERP 1 order</span></div>
      <div className={field} style={locked ? { borderColor: "#f59e0b", background: ASSUMED_BG } : undefined}>
        <span className="ft-eyebrow text-[9px] shrink-0" style={{ letterSpacing: ".06em" }}>ERP #</span>
        <input value={draft} inputMode="numeric" aria-label="ERP 1 order number" placeholder={erpOrders.length ? "another…" : optional ? "optional" : "required"}
          onChange={(e) => setDraft(normErpNo(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="min-w-0 w-full bg-transparent text-[12.5px] font-bold outline-none ft-mono placeholder:font-medium placeholder:text-slate-400" />
        <button onClick={submit} title="Add this order number" className="grid place-items-center w-[18px] h-[18px] rounded shrink-0" style={{ background: "var(--ft-accent)", color: "var(--ft-accent-ink)" }}><Plus size={13} /></button>
      </div>
      {chips.map((o) => o.no === confirmNo ? (
        <div key={o.no} className="rounded-[5px] border border-slate-300 bg-white px-1.5 py-1 text-[10.5px] leading-tight">
          Remove order {o.no}? Its {per[o.no]} stamped {per[o.no] === 1 ? "line goes" : "lines go"} back to unkeyed.
          <div className="mt-1 flex gap-1">
            <button onClick={() => { setConfirmNo(null); onRemove(o.no); }} className="rounded px-1.5 py-px font-semibold" style={{ background: "var(--ft-accent)", color: "var(--ft-accent-ink)" }}>Remove</button>
            <button onClick={() => setConfirmNo(null)} className="rounded px-1.5 py-px font-semibold text-slate-500 hover:bg-slate-100">Keep</button>
          </div>
        </div>
      ) : (
        <div key={o.no} role="button" tabIndex={0} aria-pressed={o.no === active} onClick={() => setActive(o.no)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(o.no); } }}
          title={(o.no === active ? "Active — copies stamp this order. " : "Click to make this the active order. ") + (o.addedBy ? `Added by ${o.addedBy}` : "Added") + (o.addedAt ? ` ${when(o.addedAt)}` : "")}
          className="flex items-center gap-1 rounded-[5px] border px-1.5 py-[2px] text-[12px] font-bold ft-mono cursor-pointer"
          style={o.no === active ? DONE_MOSS : { borderColor: "var(--ft-border-strong)", background: "var(--ft-card)" }}>
          <span>{o.no}</span>
          {per[o.no] > 0 && <span className="ml-auto text-[10px] font-semibold" style={{ opacity: .8 }}>{per[o.no]} {per[o.no] === 1 ? "line" : "lines"}</span>}
          <button onClick={(e) => { e.stopPropagation(); askRemove(o.no); }} title={`Remove order ${o.no}`} className={"text-[11px] leading-none " + (per[o.no] > 0 ? "" : "ml-auto")} style={{ opacity: .8 }}>×</button>
        </div>
      ))}
      <div className="text-[9.5px] leading-[1.3] ft-mono" style={{ color: locked ? ASSUMED_INK : "var(--ft-faint)" }}>{note}</div>
    </div>
  );
}

function ProjectBox({ name, projectNo, onClose }) {
  return (
    <div style={BOX}>
      <div className={EYE}>
        {projectNo ? <Seg value={`N${projectNo}`} label="project number" className="ft-mono text-[10px] font-extrabold" style={{ letterSpacing: ".06em" }} /> : <span />}
        <button onClick={onClose} title="Close" className="text-slate-400 hover:text-slate-600 -mr-1"><X size={14} /></button>
      </div>
      <Seg value={name} label="project name" bold className="block w-full text-[12px] leading-[1.2]" title={`Copy the project name\n${name}`}
        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} />
    </div>
  );
}

const VIEWS = [["compact", "Compact"], ["area", "Area + vendor"], ["sheet", "Sheet order"]];
function ViewBox({ view, setView }) {
  return (
    <div style={{ ...BOX, padding: "3px 4px 4px" }} role="group" aria-label="List view" className="flex flex-col gap-px"
      title="Compact combines every line that shares a SKU into one, tile before trims. Area + vendor keeps each area together and pulls the wedi and Schluter shower lines into vendor groups below. Sheet order is the list exactly as the estimate reads.">
      {VIEWS.map(([v, l]) => (
        <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
          className={"block w-full text-left rounded px-1.5 py-[2px] text-[11px] font-semibold leading-[1.25] transition-colors " + (view === v ? "" : "text-slate-500 hover:bg-white/60")}
          style={view === v ? DONE_MOSS : undefined}>{l}</button>
      ))}
    </div>
  );
}

// One special-order line. The copy button copies the whole item (with tag) and
// stays a green check with the ERP order it was keyed on under it.
function SpecialRow({ r, alt, descLimit, locked, active, erpKeyed, onStamp, onClear }) {
  const [copied, setCopied] = useState(false);
  const [copiedExt, setCopiedExt] = useState(false);
  const [showFrom, setShowFrom] = useState(false);
  const no = keyedNo(r, erpKeyed);
  const stamp = lineStamp(r, erpKeyed);
  const done = !!no || copied;
  const copy = async () => { await writeClipboard(r.copy); setCopied(true); onStamp(r); };
  const copyExt = async () => { await writeClipboard(r.desc.ext); setCopiedExt(true); };
  const d = r.desc;
  const check = (extra) => (
    <div className="flex flex-col items-center">
      <button {...extra} style={done ? DONE_MOSS : undefined}
        className={"grid place-items-center w-[26px] h-[26px] rounded-md border transition-colors disabled:opacity-30 disabled:cursor-default " +
          (done ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
        {done ? <Check size={15} /> : <Copy size={14} />}
      </button>
      {no && <div style={STAMP_NO}>{no}</div>}
    </div>
  );
  return (
    <div style={{ ...GRID, padding: "6px 10px", background: alt ? "var(--ft-prod)" : "transparent", ...(r.qtyAssumed ? ASSUMED_ROW : null) }}
      title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      className="border-t border-slate-100">
      {no
        ? <KeyedPop stamp={stamp} active={active} onCopyAgain={copy} onClear={() => { setCopied(false); onClear(r); }} render={(p) => check({ ...p, title: stampTitle(stamp) })} />
        : check({ onClick: copy, disabled: locked, title: locked ? LOCK_TITLE : "Copy the description field" })}

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
              <button onClick={copyExt} disabled={locked} title={locked ? LOCK_TITLE : "Copy the full description for the extended-text field:\n\n" + d.ext}
                style={copiedExt ? DONE_MOSS : undefined}
                className={"inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold border transition-colors disabled:opacity-30 " +
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

// A band heading inside a list: an area (quiet) or a vendor / materials group.
function Band({ label, area, first }) {
  return (
    <div className={"px-3 py-1 ft-eyebrow text-[9.5px] tracking-[.12em] border-slate-100 " + (first ? "" : "border-t ") + (area ? "bg-slate-50 text-slate-400" : "bg-slate-100 text-slate-500")}>
      {label}
    </div>
  );
}

// One stock line: SKU, quantity, name — plus the merged pill / kept note and
// the breakdown the pill opens. A keyed line's checkbox becomes the moss badge
// with its order number, and only the popover behind it can clear the stamp.
function StockRow({ r, sel, onToggle, unit, locked, active, erpKeyed, onStamp, onClear }) {
  const [showFrom, setShowFrom] = useState(false);
  const no = keyedNo(r, erpKeyed);
  const stamp = lineStamp(r, erpKeyed);
  const copyAgain = async () => { await writeClipboard(`${r.sku}\t${r.qty}`); onStamp(r); };
  const badge = (extra) => (
    <div className="flex flex-col items-center shrink-0">
      <button {...extra} className="grid place-items-center w-[17px] h-[17px] rounded-[3px]" style={DONE_MOSS}><Check size={12} /></button>
      <div style={STAMP_NO}>{no}</div>
    </div>
  );
  return (
    <label title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      style={r.qtyAssumed ? ASSUMED_ROW : undefined}
      className={"flex items-center gap-2 px-2.5 py-[5px] text-[12.5px] border-t border-slate-100 " + (r.sku && !no ? "cursor-pointer hover:bg-slate-50" : "cursor-default")}>
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
      {no
        ? <KeyedPop stamp={stamp} active={active} onCopyAgain={copyAgain} onClear={() => onClear(r)} render={(p) => badge({ ...p, title: stampTitle(stamp), onClick: (e) => { e.preventDefault(); p.onClick(); } })} />
        : <input type="checkbox" checked={sel} onChange={onToggle} disabled={!r.sku || locked} title={locked ? LOCK_TITLE : undefined}
            className="w-[17px] h-[17px] shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default" style={{ accentColor: "var(--ft-brand)" }} />}
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

// Checkbox list with "Copy remaining" / "Copy selected": one line per item, SKU
// then a tab then the bare order quantity — the format the shop's order desk
// pastes (SKU⇥qty), matching Cut & Order. A row with no SKU shows red and stays
// out of the copies — a pasted blank would key the wrong thing silently. Each
// copy stamps the lines it took on the active order, in ONE call. `bands` is
// the list in the order it copies, already merged or as entered.
function CopySection({ title, bands, count, emptyText, tip, note, locked, active, erpKeyed, onStampRows, onClear }) {
  const [sel, setSel] = useState(() => new Set());
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const rows = bands.flatMap((b) => b.rows);
  const line = (r) => `${r.sku}\t${r.qty}`;
  const copyableRows = rows.filter((r) => r.sku);
  const remaining = remainingRows(rows, erpKeyed).filter((r) => r.sku);
  const assumed = rows.filter((r) => r.qtyAssumed).length;
  const picked = copyableRows.filter((r) => sel.has(r.id) && !keyedNo(r, erpKeyed));
  const keyed = keyedNote(rows, erpKeyed);
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <Heading tip={tip}>{title} · {count}</Heading>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <CopyBtn text={remaining.map(line).join("\n")} disabled={locked || remaining.length === 0} onCopied={() => onStampRows(remaining)}
              title={locked ? LOCK_TITLE : remaining.length === 0 ? "Everything is keyed" : undefined}
              label={active ? `Copy remaining (${remaining.length})` : "Copy all"} />
            <CopyBtn text={picked.map(line).join("\n")} disabled={locked || picked.length === 0} onCopied={() => onStampRows(picked)}
              title={locked ? LOCK_TITLE : undefined} label={picked.length ? `Copy selected (${picked.length})` : "Copy selected"} />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">{emptyText}</p>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          {bands.map((b, bi) => (
            <div key={b.label} className="contents">
              <Band label={b.label} area={b.area} first={bi === 0} />
              {b.rows.map((r) => <StockRow key={r.id} r={r} sel={sel.has(r.id)} onToggle={() => toggle(r.id)} unit={r.unitCode || ""} locked={locked} active={active} erpKeyed={erpKeyed} onStamp={(row) => onStampRows([row])} onClear={onClear} />)}
            </div>
          ))}
          {(note || keyed || assumed > 0 || copyableRows.length < rows.length) && (
            <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 space-x-1">
              {keyed && <span className="font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{keyed}.</span>}
              {note}
              {assumed > 0 && <span className="text-amber-700">{assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — copied as 1.</span>}
              {copyableRows.length < rows.length && <span className="text-red-600">Red lines have no SKU and are not copied.</span>}
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

// The three views of one list, keyed off the panel's switch. Computed once per
// row set — the rows are rebuilt by App.jsx only when the project changes.
const asView = (bands) => ({ bands, rows: bands.flatMap((b) => b.rows) });
const useViews = (rows) => useMemo(() => ({
  compact: asView(compactBands(rows)),
  area: asView(areaVendorBands(rows)),
  sheet: asView(sheetBands(rows).map((b) => ({ ...b, area: true }))),
}), [rows]);

export function OrderEntryPanel({ name, projectNo = null, quick = false, custInfo, special = [], stock = [], descLimit = 0, erpOrders = [], erpKeyed = {}, onAddOrder = () => {}, onRemoveOrder = () => {}, onStamp = () => {}, onClearStamp = () => {}, onClose }) {
  const [view, setView] = useState("area");
  const [active, setActive] = useState(() => erpOrders[erpOrders.length - 1]?.no || "");
  // A removed order can't stay active; a freshly added one becomes active.
  useEffect(() => { if (!erpOrders.some((o) => o.no === active)) setActive(erpOrders[erpOrders.length - 1]?.no || ""); }, [erpOrders]);
  const locked = gated({ projectNo, erpOrders });
  const sp = useViews(special), st = useViews(stock);
  const spv = sp[view], stv = st[view];
  const specialRows = spv.bands.flatMap((b) => b.rows);
  // Only MARKED splits count — a line whose sole losses are soft parts (brand,
  // "Collection") pastes a whole spec and needs no amber warning.
  const splits = specialRows.filter((r) => r.desc && r.desc.cut).length;
  const assumed = specialRows.filter((r) => r.qtyAssumed).length;
  const isMerged = view !== "sheet";
  const specialNote = isMerged ? mergeNote(specialRows) : null;
  const specialKeyed = keyedNote(specialRows, erpKeyed);
  const stamp = (rows) => { if (active) onStamp(rows.flatMap(lineIds), active); };
  const clear = (row) => onClearStamp(lineIds(row));
  const addOrder = (no) => { onAddOrder(no); setActive(no); };
  const allRows = [...specialRows, ...stv.rows];
  const left = remainingRows(allRows, erpKeyed).length;
  const total = allRows.filter((r) => r.special || r.sku).length;
  const note = locked ? "Enter the order number to unlock the line copies."
    : !erpOrders.length ? "Optional — so this job can be found by its order number later."
    : left === 0 ? `Copies stamp ${active} · every line is keyed`
    : `Copies stamp ${active} · ${total - left} of ${total} keyed · ${left} to go`;
  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[560px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* The header bar (owner, rounds 3–5): the project header's idiom — a
            band of bordered columns, nothing above it. */}
        <div className="shrink-0 m-2 mb-0 rounded-lg border flex flex-wrap lg:flex-nowrap gap-1.5 p-[7px]" style={{ background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
          <DeliverBox custInfo={custInfo} quick={quick} />
          <ErpBox erpOrders={erpOrders} erpKeyed={erpKeyed} active={active} setActive={setActive} locked={locked} optional={!projectNo} onAdd={addOrder} onRemove={onRemoveOrder} note={note} />
          <div className="w-[150px] shrink-0 flex flex-col gap-1.5">
            <ProjectBox name={name} projectNo={projectNo} onClose={onClose} />
            <ViewBox view={view} setView={setView} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <Heading tip={<>A copied line stays a green check with the ERP order it was keyed on under it; click the check to copy it again or clear it. Copies stamp the active order. Cost &amp; Sell are per the buy/sell unit.{descLimit > 0 && <> Descriptions are fitted to {descLimit} characters; a “+” means the rest goes in the extended-text field.</>}</>}>
                Special order · {specialRows.length}
              </Heading>
            </div>
            {specialRows.length === 0 ? (
              <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">No special-order items in this project.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div style={{ ...GRID, padding: "5px 10px" }} className="bg-slate-100">
                  <span />
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500">Item</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Qty</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Cost</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Sell</span>
                </div>
                {(() => { let i = 0; return spv.bands.map((b) => (
                  <div key={b.label} className="contents">
                    <Band label={b.label} area={b.area} />
                    {b.rows.map((r) => <SpecialRow key={r.id} r={r} alt={i++ % 2 === 1} descLimit={descLimit} locked={locked} active={active} erpKeyed={erpKeyed} onStamp={(row) => stamp([row])} onClear={clear} />)}
                  </div>
                )); })()}
                {(specialKeyed || specialNote || assumed > 0 || splits > 0) && (
                  <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 space-x-1">
                    {specialKeyed && <span className="font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{specialKeyed}.</span>}
                    {specialNote}
                    {assumed > 0 && <span className="text-amber-700">{assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — priced and keyed as <b>1</b>.</span>}
                    {splits > 0 && <span className="text-amber-700">{splits === 1 ? "One line is" : `${splits} lines are`} too long to fit — the “+” means the rest is in <b>Ext</b>.</span>}
                  </div>
                )}
              </div>
            )}
          </section>

          <CopySection key={view} title="Stock" bands={stv.bands} count={stv.rows.length}
            emptyText="No stock items in this project."
            tip="Each line copies as SKU + tab + quantity, ready to paste. Copy remaining takes every unkeyed line with a SKU and stamps it on the active ERP order; check lines for Copy selected. Click a keyed line's badge to copy it again or clear it."
            note={isMerged ? mergeNote(stv.rows) : null}
            locked={locked} active={active} erpKeyed={erpKeyed} onStampRows={stamp} onClear={clear} />
        </div>
      </div>
    </div>
  );
}
