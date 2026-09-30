import { normPrintPricing, tierTag } from "./pricing.js";
import { quickPrintName } from "./model.js";
import keimLogo from "./assets/keim-logo-ink.png";

const DASH = <span style={{ color: "var(--ft-faint)" }}>—</span>;

// Selection-sheet masthead (owner pick 2026-09-08, .scratch/126) + the people
// row + the job notes — shared by every estimate layout. The document's name is
// the hero, the Keim mark steps to the right with the number + date; the people
// row prints without run labels — the names speak for themselves.
export function SheetHead({ sel, people, profile, tv, scopeNote = "", areaCount = "" }) {
  const tag = normPrintPricing(sel.printPricing) !== "none" ? tierTag(tv.tier, tv.pct) : "";
  const cust = people.find((c) => c.id === sel.customerId);
  const sp = sel.salesperson || profile;
  const pname = sp.name || sp.email;
  const printName = sel.quick ? quickPrintName(sel) : sel.name;
  const stackLine = { fontSize: 9.5, lineHeight: 1.35, color: "var(--ft-muted)" };
  return (
    <>
      <div className="flex justify-between items-end" style={{ gap: 16, borderBottom: "2px solid var(--ft-text)", paddingBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".3em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>Flooring &amp; Tile</div>
          <div className="uppercase" style={{ fontSize: 28, fontWeight: 800, letterSpacing: ".12em", lineHeight: 1 }}>Selection Sheet</div>
          <div style={{ fontSize: 9, color: "var(--ft-muted)", marginTop: 5 }}>Rough pricing and quantities for planning purposes only</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <img src={keimLogo} alt="Keim" style={{ height: 24, width: "auto", display: "inline-block" }} />
          <div className="flex items-baseline justify-end" style={{ gap: 8, marginTop: 4, whiteSpace: "nowrap" }}>
            {sel.projectNo && <span style={{ fontSize: 12, fontWeight: 800 }}>N{sel.projectNo}</span>}
            <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</span>
          </div>
          {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 18, padding: "6px 0 7px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8 }}>
        {/* No customer record → no name fallback here: the project name in
            the next cell already identifies the job. */}
        <div>
          {cust?.name && <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{cust.name}</div>}
          {(sel.address || cust?.address) && <div style={stackLine}>{sel.address || cust?.address}</div>}
          {(cust?.phone || sel.phone) && <div style={stackLine}>{cust?.phone || sel.phone}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{printName || DASH}</div>
          {(scopeNote || areaCount) && <div style={stackLine}>{scopeNote || areaCount}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{pname || DASH}</div>
          {[sp.phone, sp.email].filter((x) => x && x !== pname).map((d, j) => <div key={j} style={stackLine}>{d}</div>)}
        </div>
      </div>
      {sel.notes && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ft-muted)", margin: "0 0 8px" }}>{sel.notes}</div>}
    </>
  );
}
