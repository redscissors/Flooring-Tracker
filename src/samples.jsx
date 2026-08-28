// The Samples panel — the project's sample requests collected for ordering.
// Lines are marked from the row's ⋯ menu (or the mobile row sheet); this panel
// groups the marked lines by vendor, steps each request through
// To order → Ordered → Received, and copies a per-vendor list for placing the
// order. Same right-dock shell as the order-entry panel, and the same
// presentation-only contract: every write goes back through onSet as ONE
// batch — usedirectory's setter is built off a stale closure, so two
// updateProject calls in one tick would clobber each other (options.js rule).

import { X, Layers } from "lucide-react";
import { CopyBtn } from "./orderentry.jsx";
import { SAMPLE_LABEL, SAMPLE_STATUSES, SAMPLE_COLOR, SAMPLE_CHIP, sampleCopyText } from "./samples.js";

const dateShort = (at) => (at ? new Date(at).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : "");

function StatusSeg({ status, onPick }) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden shrink-0">
      {SAMPLE_STATUSES.map((s) => (
        <button key={s} onClick={() => onPick(s)}
          className={"px-1.5 py-1 text-[10px] font-semibold border-r last:border-r-0 border-slate-200 " + (status === s ? "" : "text-slate-400 hover:bg-slate-50")}
          style={status === s ? SAMPLE_CHIP[s] : undefined}>
          {SAMPLE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

function SampleGroup({ g, onSet }) {
  const need = g.rows.filter((r) => r.status === "need");
  const now = Date.now();
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500 truncate">{g.name} · {g.rows.length}</h4>
        <div className="flex items-center gap-2 shrink-0">
          {need.length > 0 && (
            <button onClick={() => onSet(need.map((r) => ({ aid: r.aid, pid: r.pid, sample: { status: "ordered", at: now } })))}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border border-slate-200 hover:bg-slate-50"
              title="The order's placed — move every To-order line in this group to Ordered">
              Mark all ordered
            </button>
          )}
          <CopyBtn text={sampleCopyText(g.rows)} label="Copy list" />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
        {g.rows.map((r, i) => (
          <div key={r.pid} className="flex items-center gap-2.5 px-3 py-2" style={{ background: i % 2 === 1 ? "var(--ft-prod)" : "transparent" }}>
            <StatusSeg status={r.status} onPick={(s) => onSet([{ aid: r.aid, pid: r.pid, sample: { status: s, at: Date.now() } }])} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] leading-tight">
                {r.size && <span className="ft-mono text-slate-500">{r.size} </span>}
                <span className="font-bold">{r.name}</span>
              </div>
              <div className="truncate text-[11px] leading-tight text-slate-400">
                {r.sku && <span className="ft-mono font-semibold text-slate-500">{r.sku} · </span>}{r.areaName}
                {r.at && <span style={{ color: SAMPLE_COLOR[r.status] }}> · {SAMPLE_LABEL[r.status].toLowerCase()} {dateShort(r.at)}</span>}
              </div>
            </div>
            <button onClick={() => onSet([{ aid: r.aid, pid: r.pid, sample: null }])} title="Remove this sample request"
              className="shrink-0 text-slate-300 hover:text-red-500"><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SamplesPanel({ name, groups, onSet, onClose }) {
  const total = groups.reduce((t, g) => t + g.rows.length, 0);
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
          {total === 0 ? (
            <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">
              No sample requests on this project yet. Mark a line from its ⋯ menu — <b>Request sample</b> — and it collects here, grouped by vendor and ready to order.
            </p>
          ) : (
            <>
              {groups.map((g) => <SampleGroup key={g.key} g={g} onSet={onSet} />)}
              <p className="text-[11px] text-slate-400">
                Copy a vendor's list into their portal or an email, then <b>Mark all ordered</b> — the statuses are shared, so the whole team sees what's in flight and what's arrived.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
