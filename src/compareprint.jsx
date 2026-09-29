// The Compare tab's customer print sheet. It only exists in the DOM while a
// print is in flight (CompareTab portals it into body, prints, unmounts on
// afterprint), so hiding every other body child is scoped to that instant.
// LAZY-CHUNK-ONLY (ADR 0026): imported by CompareTab.jsx alone.
import { Fragment } from "react";
import { BRAND } from "./comparegrid.js";
import { kitLabel, cleanKitName } from "./kitlabel.js";
import { fm } from "./compareprintcols.js";

const PRINT_CSS = `
.cmp-printsheet{display:none}
@media print{
  body > *:not(.cmp-printsheet){display:none !important}
  .cmp-printsheet{display:block;color:#111;background:#fff;font-family:var(--ft-ui)}
  .cmp-printsheet .ps-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}
  .cmp-printsheet .ps-head .t{font-size:18px;font-weight:800}
  .cmp-printsheet .ps-head .sub{font-size:13px;font-weight:700;color:#333}
  .cmp-printsheet .ps-head .meta{width:100%;font-size:11px;font-weight:600;color:#555}
  .cmp-printsheet .ps-head .dt{margin-left:auto;font-size:11px;color:#555}
  .cmp-printsheet table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
  .cmp-printsheet thead{display:table-header-group}
  .cmp-printsheet tr{break-inside:avoid}
  .cmp-printsheet th,.cmp-printsheet td{padding:2px 8px;vertical-align:top;text-align:left;font-weight:400}
  .cmp-printsheet .lab{width:62px;padding-left:0;font-size:10px;font-weight:700;color:#555}
  .cmp-printsheet thead th{border-bottom:1.5px solid #111;padding-top:2px;padding-bottom:4px}
  .cmp-printsheet .ch .nm{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;line-height:1.2}
  .cmp-printsheet .ch .badge{flex:none;border:1.5px solid #111;border-radius:4px;padding:0 5px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.5}
  .cmp-printsheet .ch .tv{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:2px}
  .cmp-printsheet .lnh{display:flex;gap:6px;margin-top:4px;font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#666}
  .cmp-printsheet .lnh .q{width:20px;text-align:right}
  .cmp-printsheet .lnh .n{flex:1}
  .cmp-printsheet tr.band td{padding:3px 0 2px;font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#555;border-bottom:1px solid #999;break-after:avoid}
  .cmp-printsheet tr.slot td{border-bottom:1px solid #ddd}
  .cmp-printsheet .ln{display:flex;justify-content:space-between;gap:6px;padding:1px 0;line-height:1.25}
  .cmp-printsheet .ln .q{flex:none;width:20px;text-align:right;font-weight:700;color:#444;font-variant-numeric:tabular-nums}
  .cmp-printsheet .ln .n{flex:1;min-width:0}
  .cmp-printsheet .ln .n b{font-weight:800}
  .cmp-printsheet .ln .p{flex:none;font-weight:700;font-variant-numeric:tabular-nums}
  .cmp-printsheet .ln.note .n{color:#555;font-style:italic}
  .cmp-printsheet .ln.dash .n{color:#777}
  .cmp-printsheet tr.tot{break-before:avoid;page-break-before:avoid}
  .cmp-printsheet tr.tot td{border-top:2px solid #111;border-bottom:0;padding-top:5px;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
  .cmp-printsheet tr.tot td.lab{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:#111}
}
`;

const colName = (c) => (c.brand === "schluter" ? cleanKitName(c.label) : c.label);

export function ComparePrintSheet({ cols, projectName, areaName, roomText, tierLabel, layout, amtOf }) {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const total = (c) => fm(amtOf(c.totals));
  const dash = (k) => <div key={k} className="ln dash"><span className="q" /><span className="n">—</span></div>;
  return (
    <div className="cmp-printsheet">
      <style>{PRINT_CSS}</style>
      {cols.length > 2 && <style>{"@page{size:landscape}"}</style>}
      <div className="ps-head">
        <div className="t">{projectName || "Shower comparison"}</div>
        {areaName ? <div className="sub">{areaName}</div> : null}
        <div className="dt">{date}</div>
        <div className="meta">{[roomText, tierLabel].filter(Boolean).join(" · ")}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th className="lab" />
            {cols.map((c) => (
              <th key={c.key} className="ch">
                <div className="nm"><span className="badge">{BRAND[c.brand]}</span><span>{colName(c)}</span></div>
                <div className="tv">{total(c)}</div>
                <div className="lnh"><span className="q">Qty</span><span className="n">Size + item</span><span>Price</span></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.map((g) => (
            <Fragment key={g.key}>
              <tr className="band"><td colSpan={cols.length + 1}>{g.label}</td></tr>
              {g.slots.map((r) => (
                <tr key={r.slot} className="slot">
                  <td className="lab">{r.label}</td>
                  {cols.map((c) => {
                    const rows = r[c.key];
                    const plus = r[c.key + "Plus"];
                    return (
                      <td key={c.key}>
                        {!rows.length && !plus.length && dash("empty")}
                        {rows.map((x, i) => {
                          const lb = kitLabel(x.name, x.size);
                          const amt = amtOf(x);
                          return (
                            <div key={i} className={"ln" + (x.noteOnly ? " note" : "")}>
                              <span className="q">{x.noteOnly ? "" : x.qty}</span>
                              <span className="n">{lb.size && <><b>{lb.size}</b>{" "}</>}{lb.name}</span>
                              {!x.noteOnly && <span className="p">{amt ? fm(amt) : "—"}</span>}
                            </div>
                          );
                        })}
                        {plus.map((e) => dash(e.hostKey))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="tot">
            <td className="lab">Total</td>
            {cols.map((c) => <td key={c.key}>{total(c)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
