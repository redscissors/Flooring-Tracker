// Preview harness for the materials "not calculating" warning chip
// (spec 2026-07-14). Renders the collapsed materials strip with the REAL
// markup from App.jsx and the real index.css, in the three states the
// change-control proof needs, light and dark side by side. Served by the
// vite dev server; never shipped (lives in .scratch).
import React from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle } from "lucide-react";
import "../../src/index.css";

const accent = "var(--ft-type-tile)";
const rowTint = "var(--ft-area-row)";
const KSHORT = { Grout: "Grout", Caulk: "Caulk", Mortar: "Mortar", Underlayment: "Underlay" };

function Strip({ mats, warns, cost }) {
  return (
    <div style={{ background: rowTint, padding: "4px 8px 7px 26px" }}>
      <button className="flex items-center flex-wrap text-left" style={{ width: "100%", padding: "4px 7px", columnGap: 12, rowGap: 3, fontSize: 9.5, color: "var(--ft-muted)", background: rowTint, border: "1px solid var(--ft-border)" }} title="Materials — click to edit">
        {mats.map((m, i) => (
          <span key={i} className="inline-flex items-center" style={{ gap: 4 }}>
            <span style={{ fontWeight: 700, color: accent }}>{KSHORT[m.kind]}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.name}{m.spec ? <> — <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 999, background: "#C9B79D", border: "1px solid #B3A38D", display: m.kind === "Grout" ? "inline-block" : "none" }} /> {m.spec}</> : ""}{m.detail ? <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span> : ""}
          </span>
        ))}
        {warns.map((w) => (
          <span key={w} className="ft-warn-orange inline-flex items-center font-semibold" style={{ gap: 4 }}>
            <AlertTriangle size={10} /> {w} — not calculating
          </span>
        ))}
        <span className="flex-1" />
        {cost > 0 && <span className="ft-mono" style={{ fontSize: 9, color: "var(--ft-muted)" }}>+ ${cost.toFixed(2)}</span>}
      </button>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="ft-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ border: "1px solid var(--ft-border)", background: "var(--ft-card)" }}>
        <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--ft-text)" }}>
          Moroccan Conc Off White Mos&nbsp;&nbsp;<span style={{ color: "var(--ft-muted)", fontSize: 11 }}>1-1/2" Hex · 120 sf · $5.55/sf</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({ title }) {
  return (
    <div style={{ flex: 1, minWidth: 440, background: "var(--ft-cream)", padding: 18 }}>
      <div className="ft-serif" style={{ fontSize: 15, color: "var(--ft-text)", marginBottom: 12 }}>{title}</div>
      <Row label="All materials computing — no warnings">
        <Strip cost={94.17} warns={[]} mats={[
          { kind: "Grout", order: 6, name: "PermaColor Select", spec: "Silver Shadow", detail: '1/8" joint' },
          { kind: "Mortar", order: 2, name: "ProLite" },
        ]} />
      </Row>
      <Row label="One failing — mortar computes, grout can't (no L×W)">
        <Strip cost={27.98} warns={["Grout"]} mats={[
          { kind: "Mortar", order: 2, name: "ProLite" },
        ]} />
      </Row>
      <Row label="All failing — nothing computes, strip still renders">
        <Strip cost={0} warns={["Grout", "Mortar"]} mats={[]} />
      </Row>
      <Row label="Underlayment failing on a vinyl row">
        <Strip cost={0} warns={["Underlayment"]} mats={[]} />
      </Row>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <div style={{ display: "flex", gap: 0, alignItems: "stretch", minHeight: "100vh" }}>
    <Panel title="Light" />
    <div className="ned-dark" style={{ display: "contents" }}>
      <div style={{ flex: 1, minWidth: 440, background: "var(--ft-cream)" }}>
        <div style={{ padding: 18 }}>
          <div className="ft-serif" style={{ fontSize: 15, color: "var(--ft-text)", marginBottom: 12 }}>Dark (.ned-dark)</div>
          <Row label="All materials computing — no warnings">
            <Strip cost={94.17} warns={[]} mats={[
              { kind: "Grout", order: 6, name: "PermaColor Select", spec: "Silver Shadow", detail: '1/8" joint' },
              { kind: "Mortar", order: 2, name: "ProLite" },
            ]} />
          </Row>
          <Row label="One failing — mortar computes, grout can't (no L×W)">
            <Strip cost={27.98} warns={["Grout"]} mats={[
              { kind: "Mortar", order: 2, name: "ProLite" },
            ]} />
          </Row>
          <Row label="All failing — nothing computes, strip still renders">
            <Strip cost={0} warns={["Grout", "Mortar"]} mats={[]} />
          </Row>
          <Row label="Underlayment failing on a vinyl row">
            <Strip cost={0} warns={["Underlayment"]} mats={[]} />
          </Row>
        </div>
      </div>
    </div>
  </div>
);
