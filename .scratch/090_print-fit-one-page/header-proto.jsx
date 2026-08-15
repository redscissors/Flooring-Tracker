// Masthead prototypes for issue 090 — "the header takes up so so much space".
// Renders the CURRENT header (the real EstimatePaper, so the reference can't
// drift) beside three merged variants, all at the true printable width and
// through the real print tokens (.ft-pbadge / .ft-pband pick up the mono-ink
// remap in print media). Each box prints its own measured height.
// Dev-only entry (header-proto.html); not part of the app build.
import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { wasteMeta } from "../../src/model.js";
import keimLogo from "../../src/assets/keim-logo-ink.png";
import { makeJob, settings, PROFILE } from "./fixture.js";

const PAPER_W = 710; // Letter minus @page{margin:1.4cm}

const sel = makeJob();
const wSet = withProjWaste(settings, sel);
const tv = tierView(sel, wSet);
const T = jobTotals(tv.proj, sel, tv.settings, wSet, settings, []);
const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };

const DATE = "8/15/2026";
const CUSTOMER = sel.name;
const ADDRESS = sel.address;
const WASTE = wasteMeta(wSet.waste);
const DISCLAIMER = "For planning purposes only · pricing subject to change on final order";

// The small-caps run label the sheet already uses everywhere else.
const L = ({ children }) => (
  <span className="uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".16em", color: "var(--ft-faint)", marginRight: 5 }}>{children}</span>
);

// ---------------------------------------------------------------- variant A --
// One bar. Masthead collapses to a single 24px row; the three stacked columns
// collapse to one wrapping line of labelled runs. The Project run only prints
// when the project is named something other than the customer — on this job
// they're identical, and today's sheet prints that name three times.
function OneBar() {
  return (
    <div>
      <div className="flex items-center" style={{ gap: 12, borderBottom: "2px solid var(--ft-text)", paddingBottom: 6 }}>
        <img src={keimLogo} alt="Keim" style={{ height: 24, width: "auto", display: "block", flexShrink: 0 }} />
        <div className="uppercase" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".16em", color: "var(--ft-brand-deep)", whiteSpace: "nowrap" }}>Flooring &amp; Tile Selections</div>
        <div className="ft-pbadge uppercase" style={{ marginLeft: "auto", background: "#f4ebd6", border: "1px solid #d8c48c", borderRadius: 4, padding: "0 8px", fontSize: 9, fontWeight: 800, letterSpacing: ".06em", color: "#7a5a1c", whiteSpace: "nowrap" }}>Rough Estimate</div>
        <div className="flex items-baseline" style={{ gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>N{sel.projectNo}</span>
          <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{DATE}</span>
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: "1px 20px", paddingTop: 5, fontSize: 10.5 }}>
        <span><L>Customer</L><b style={{ fontWeight: 800 }}>{CUSTOMER}</b> <span style={{ color: "var(--ft-muted)" }}>· {ADDRESS}</span></span>
        <span><L>Salesperson</L>{PROFILE.name} <span style={{ color: "var(--ft-muted)" }}>· {PROFILE.phone} · {PROFILE.email}</span></span>
        <span><L>Waste</L><span style={{ color: "var(--ft-muted)" }}>{WASTE}</span></span>
      </div>
      <div style={{ fontSize: 8, color: "var(--ft-muted)", paddingTop: 2 }}>{DISCLAIMER}</div>
    </div>
  );
}

// ---------------------------------------------------------------- variant B --
// Keeps the masthead's presence — a 32px mark and the two-line title block on
// the right, as today — but the customer columns become one ruled run line.
// The compromise option: half the saving, none of the "did the letterhead
// shrink?" feeling.
function Masthead() {
  return (
    <div>
      <div className="flex items-center justify-between" style={{ gap: 14, borderBottom: "2px solid var(--ft-text)", paddingBottom: 7 }}>
        <img src={keimLogo} alt="Keim" style={{ height: 32, width: "auto", display: "block", flexShrink: 0 }} />
        <div className="ft-pbadge" style={{ flex: "0 1 auto", maxWidth: 300, textAlign: "center", background: "#f4ebd6", border: "1px solid #d8c48c", borderRadius: 5, padding: "2px 12px", lineHeight: 1.25 }}>
          <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: "#7a5a1c" }}>Rough Estimate</div>
          <div style={{ fontSize: 8, color: "var(--ft-muted)" }}>{DISCLAIMER}</div>
        </div>
        <div className="flex flex-col items-end" style={{ gap: 1, flexShrink: 0 }}>
          <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: "var(--ft-brand-deep)" }}>Flooring &amp; Tile Selections</div>
          <div className="flex items-baseline" style={{ gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>N{sel.projectNo}</span>
            <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{DATE}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: "1px 20px", padding: "5px 0 6px", borderBottom: "1px solid var(--ft-paper-rule)", fontSize: 10.5 }}>
        <span><L>Customer</L><b style={{ fontWeight: 800 }}>{CUSTOMER}</b> <span style={{ color: "var(--ft-muted)" }}>· {ADDRESS}</span></span>
        <span><L>Salesperson</L>{PROFILE.name} <span style={{ color: "var(--ft-muted)" }}>· {PROFILE.phone} · {PROFILE.email}</span></span>
        <span><L>Waste</L><span style={{ color: "var(--ft-muted)" }}>{WASTE}</span></span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- variant C --
// Ink band. The masthead becomes the same solid black band the area headers
// already use, with the job facts as a single line beneath it. Tightest of the
// three, and it makes the top of the sheet read like the rest of the sheet —
// but the Keim mark has to invert to sit on ink.
function InkBand() {
  return (
    <div>
      <div className="ft-pband flex items-center" style={{ gap: 12, background: "var(--ft-text)", borderRadius: 4, padding: "5px 11px" }}>
        <img src={keimLogo} alt="Keim" style={{ height: 19, width: "auto", display: "block", flexShrink: 0, filter: "invert(1)" }} />
        <div className="uppercase" style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".18em", color: "#fff" }}>Flooring &amp; Tile Selections</div>
        <div className="uppercase" style={{ marginLeft: "auto", fontSize: 8.5, fontWeight: 800, letterSpacing: ".1em", color: "#fff", border: "1px solid rgba(255,255,255,.55)", borderRadius: 3, padding: "0 6px", whiteSpace: "nowrap" }}>Rough Estimate</div>
        <div className="flex items-baseline" style={{ gap: 8, flexShrink: 0, color: "#fff" }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>N{sel.projectNo}</span>
          <span className="ft-mono" style={{ fontSize: 9 }}>{DATE}</span>
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: "1px 20px", padding: "5px 1px 0", fontSize: 10.5 }}>
        <span><L>Customer</L><b style={{ fontWeight: 800 }}>{CUSTOMER}</b> <span style={{ color: "var(--ft-muted)" }}>· {ADDRESS}</span></span>
        <span><L>Salesperson</L>{PROFILE.name} <span style={{ color: "var(--ft-muted)" }}>· {PROFILE.phone} · {PROFILE.email}</span></span>
        <span><L>Waste</L><span style={{ color: "var(--ft-muted)" }}>{WASTE}</span></span>
      </div>
      <div style={{ fontSize: 8, color: "var(--ft-muted)", paddingTop: 2 }}>{DISCLAIMER}</div>
    </div>
  );
}

// Each variant in its own paper box, captioned with its measured height.
function Box({ tag, title, note, children }) {
  const ref = useRef(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => { setH(Math.round(ref.current.getBoundingClientRect().height)); }, []);
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="ft-noprint" style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 800, marginBottom: 5, color: "#333" }}>
        {title} <span style={{ fontWeight: 500, color: "#777" }}>— {h}px{note ? ` · ${note}` : ""}</span>
      </div>
      <div className="ft-light bg-white text-black" style={{ width: PAPER_W, boxShadow: "0 1px 6px rgba(0,0,0,.18)" }}>
        <div ref={ref} data-shot={tag} style={{ fontSize: 11, color: "var(--ft-text)", padding: 8 }}>{children}</div>
      </div>
    </div>
  );
}

// The reference: the REAL sheet, measured live so the comparison can never
// quote a stale number. shot.mjs clips its first two children.
function Today() {
  const ref = useRef(null);
  const [h, setH] = useState("");
  useLayoutEffect(() => {
    const kids = [...ref.current.firstElementChild.children].slice(0, 2);
    const [a, b] = kids.map((el) => Math.round(el.getBoundingClientRect().height));
    setH(`${a + b}px (masthead ${a} + customer grid ${b})`);
  }, []);
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="ft-noprint" style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 800, marginBottom: 5, color: "#333" }}>
        Today <span style={{ fontWeight: 500, color: "#777" }}>— {h}</span>
      </div>
      <div ref={ref} className="ft-light bg-white text-black p-2" data-shot="today" style={{ width: PAPER_W, boxShadow: "0 1px 6px rgba(0,0,0,.18)" }}>
      <EstimatePaper sel={sel} people={[]} profile={PROFILE} tv={tv} jobWaste={wSet.waste} tSet={tv.settings} {...paperProps} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(
  <div style={{ padding: 22, background: "#fff", display: "flex", flexDirection: "column" }}>
    <Today />
    <Box tag="v-a" title="A · One bar" note="one 24px masthead row + one run line" ><OneBar /></Box>
    <Box tag="v-b" title="B · Masthead kept, columns merged" note="32px mark, two-line title, ruled run line"><Masthead /></Box>
    <Box tag="v-c" title="C · Ink band" note="masthead becomes the sheet's own black band"><InkBand /></Box>
  </div>
);
