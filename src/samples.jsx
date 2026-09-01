// The Samples panel — this project's sample requests, grouped by vendor,
// ordered by EMAILING each vendor's sample contact — its rep, or the separate
// samples address when it has one (owner call: samples ship direct to
// the customer; the email body carries the item list + the customer ship-to
// and NO salesperson info). Presentation only: writes go back through
// onOrdered/onRemove into useSamples. Same right-dock shell as order entry.

import { X, Layers, Mail } from "lucide-react";
import { CopyBtn } from "./orderentry.jsx";
import { sampleGroups, repEmail, mailtoHref, contactLabel, SAMPLE_LABEL, SAMPLE_CHIP, SAMPLE_COLOR, SAMPLE_STATUSES } from "./samples.js";

const dateShort = (at) => (at ? new Date(at).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : "");

function StatusSeg({ status, onPick }) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden shrink-0">
      {SAMPLE_STATUSES.map((s) => (
        <button key={s} onClick={() => onPick(s === "ordered")}
          className={"px-1.5 py-1 text-[10px] font-semibold border-r last:border-r-0 border-slate-200 " + (status === s ? "" : "text-slate-400 hover:bg-slate-50")}
          style={status === s ? SAMPLE_CHIP[s] : undefined}>
          {SAMPLE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

function VendorGroup({ g, custInfo, contact, onOrdered, onRemove }) {
  const need = g.rows.filter((r) => r.status === "need");
  const mail = repEmail({ rows: g.rows, ...custInfo, repName: contact?.name || "" });
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500 truncate">{g.name} · {g.rows.length}</h4>
        <div className="flex items-center gap-2 shrink-0">
          {need.length > 0 && (
            <button onClick={() => onOrdered(need.map((r) => r.id), true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border border-slate-200 hover:bg-slate-50"
              title="The order's placed — move every To-order line in this group to Ordered">
              Mark all ordered
            </button>
          )}
          {contact?.email && (
            <a href={mailtoHref(contact.email, mail.subject, mail.body)}
              title={`Opens your mail program addressed to ${contact.email}:\n\n${mail.body}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
              <Mail size={13} /> {contactLabel(contact)}
            </a>
          )}
          <CopyBtn text={mail.body} label="Copy email" />
        </div>
      </div>
      {!contact?.email && g.bookId && (
        <p className="text-[10.5px] text-slate-400 -mt-1 mb-1.5">No sample contact on file — add a rep or samples email on this vendor's book page (Contacts tab) to send with one click.</p>
      )}
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
        {g.rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2.5 px-3 py-2" style={{ background: i % 2 === 1 ? "var(--ft-prod)" : "transparent" }}>
            <StatusSeg status={r.status} onPick={(ordered) => onOrdered([r.id], ordered)} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] leading-tight">
                {r.item.size && <span className="ft-mono text-slate-500">{r.item.size} </span>}
                <span className="font-bold">{r.item.name}</span>
              </div>
              <div className="truncate text-[11px] leading-tight text-slate-400">
                {r.item.sku && <span className="ft-mono font-semibold text-slate-500">{r.item.sku} · </span>}{r.areaName}
                {r.status === "ordered" && r.orderedAt && <span style={{ color: SAMPLE_COLOR.ordered }}> · ordered {dateShort(r.orderedAt)}{r.orderedBy ? ` · ${r.orderedBy}` : ""}</span>}
              </div>
            </div>
            <button onClick={() => onRemove(r.id)} title="Remove this sample request" className="shrink-0 text-slate-300 hover:text-red-500"><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SamplesPanel({ name, requests, custInfo, contactFor, onOrdered, onRemove, onClose }) {
  const groups = sampleGroups(requests);
  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[560px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <div className="ft-serif text-xl leading-tight flex items-center gap-2"><Layers size={17} className="text-slate-400" /> Samples</div>
            <div className="text-[12px] text-slate-400 truncate">{name}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {groups.length === 0 ? (
            <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">
              No sample requests on this project yet. Mark a line from its ⋯ menu — <b>Request sample</b> — and it collects here, grouped by vendor and ready to email.
            </p>
          ) : (
            <>
              {!custInfo.address && (
                <p className="text-[11px]" style={{ color: "#b45309" }}>No ship-to address on this project — the sample email will have nowhere to send the samples. Add the project (or customer) address first.</p>
              )}
              {groups.map((g) => <VendorGroup key={g.key} g={g} custInfo={custInfo} contact={contactFor(g)} onOrdered={onOrdered} onRemove={onRemove} />)}
              <p className="text-[11px] text-slate-400">
                Samples ship straight to the customer — the email carries their name and the project address. After sending, <b>Mark all ordered</b>; statuses are shared, so the whole team sees what's in flight.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
