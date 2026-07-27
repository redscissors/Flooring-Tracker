// The two small surfaces that switch freight on and off (ADR 0030): the
// materials-drawer row on a product and the project header's master. Both are
// pure presentation — the caller owns the state and the write — so the preview
// harness can mount the real components rather than a drawing of them.

import { Check } from "lucide-react";
import { money } from "./model.js";
import { freightSummary } from "./freight.js";

// The drawer row. It is an opt-IN switch, not a calculation: the vendor's
// minimum and pallet threshold are scoped to the ORDER, so the amount is figured
// once per book over every row that rides along. What shows here is therefore
// the JOB's charge from this vendor, not the row's share — that number doesn't
// exist, and inventing one by division would be a lie about what the sheet
// charges.
export function FreightMatRow({ book, on, jobOff, line, accent, rowTint, onToggle }) {
  const live = on && !jobOff;
  const detail = jobOff ? "freight is off for this job"
    : on && line ? [freightSummary(line), line.destination].filter(Boolean).join(" · ")
      : "not on this order";
  return (
    <div className={"px-2.5 " + (live ? "py-1.5" : "py-1")} style={live ? { background: rowTint } : undefined}>
      <div className="flex items-center gap-2">
        <button tabIndex={-1} disabled={jobOff} onClick={onToggle}
          title={jobOff ? "Freight is switched off for this project — turn it back on in the header"
            : on ? `Remove this row from the ${book.name} freight` : `Ship this row on the ${book.name} order`}
          className={"ft-mat-toggle w-5 h-5 rounded shrink-0 flex items-center justify-center " + (live ? "" : "border border-slate-300 ft-field hover:border-indigo-500 disabled:opacity-40")}
          style={live ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>
          {live && <Check size={12} />}
        </button>
        <span className={"text-sm " + (live ? "font-medium" : "text-slate-500")}>Freight</span>
        <span className="text-xs text-slate-400 truncate">{book.name} · {detail}</span>
        {live && line && (
          <span className="ml-auto text-sm font-semibold shrink-0" style={{ color: accent }}
            title="The whole job's freight from this vendor — one charge, however many rows ride on it">{money(line.cost)}</span>
        )}
      </div>
    </div>
  );
}

// The job's master switch, as a card of its own — the same
// header-over-pressed-options shape as Estimate shows and Price level. It sits
// under Estimate shows in the header's third column but carries its own border
// and heading, because a row tacked onto the end of that card reads as a
// footnote to printed pricing, which it has nothing to do with. Two options
// rather than one toggle for the same reason: the card states both positions, so
// "None" is a choice someone made, not the absence of a press.
//
// Freight is on by default and the per-row rows do the fine-grained waiving, so
// this is the one press for "we're not charging shipping on this job" — and the
// place to look to find out whether the total already includes it.
// `width` is optional: with none it stretches to whatever column it's dropped in.
export function FreightColumn({ on, amount, onSet, width }) {
  const opt = (active) => "ft-hopt gap-1 " + (active ? "on bg-indigo-600" : "");
  return (
    <div className="ft-hcol shrink-0" style={width ? { width } : undefined}>
      <div className="ft-hhead">Freight</div>
      <button onClick={() => onSet(true)} className={opt(on)}
        title="Vendor shipping is added to this job's special orders, at cost — the price level never discounts it">
        <span>Include</span>
        {/* Whole dollars: this is a glance figure, and the cents are in the
            order summary two clicks away. */}
        {on && amount && <span className="ml-auto text-[10px] shrink-0" style={{ opacity: 0.85 }}>{amount}</span>}
      </button>
      <button onClick={() => onSet(false)} className={opt(!on)}
        title="No freight on this job, whatever the rows say">
        <span>None</span>
      </button>
    </div>
  );
}
