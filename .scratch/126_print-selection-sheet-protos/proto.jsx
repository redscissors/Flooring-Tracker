// Selection-sheet prototypes (2026-09-08): "it needs to feel more like a
// selection sheet and less like a quote or an order — primarily the header,
// plus maybe a watermark in the body". Body content is out of scope (owner):
// the REAL EstimatePaper renders the body over the 090 fixture job, its two
// header rows are hidden by CSS, and a prototype masthead sits in their place.
//   ?v=today|A|B      masthead variant (today = untouched real sheet)
//   ?wm=none|outline|fill   the SELECTIONS watermark rendering
// Dev-only entry (proto.html); not part of the app build. Throwaway.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import keimLogo from "../../src/assets/keim-logo-ink.png";
import { makeJob, settings, PROFILE, PEOPLE } from "../090_print-fit-one-page/fixture.js";

const q = new URLSearchParams(location.search);
const V = q.get("v") || "A";
const WM = q.get("wm") || "outline";
const DATE = "9/8/2026";

const sel = makeJob();
const wSet = withProjWaste(settings, sel);
const tv = tierView(sel, wSet);
const tSet = tv.settings;
const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
const cust = PEOPLE[0];

const CSS = `
  [data-v]:not([data-v="today"]) [data-real] > div > div:nth-child(-n+2) { display:none !important }
  [data-shot] { position:relative; z-index:0; overflow:hidden }
  .wm { position:absolute; left:0; width:100%; height:950px; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:-1; overflow:hidden }
  .wm-print { display:none }
  .wm > span { font-weight:800; font-size:86px; letter-spacing:.12em; line-height:1; white-space:nowrap; transform:rotate(-30deg); text-transform:uppercase; font-family:var(--ft-ui) }
  .wm-fill > span { color:rgba(0,0,0,.06) }
  .wm-outline > span { color:transparent; -webkit-text-stroke:1.1px rgba(0,0,0,.32) }
  @media print {
    .wm-screen { display:none }
    .wm-print { display:flex; position:fixed; top:0; left:0; width:100%; height:100% }
  }
`;

// Small-caps run label the sheet already uses everywhere.
const L = ({ children, style }) => <div className="uppercase" style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: ".22em", color: "var(--ft-faint)", marginBottom: 1, ...style }}>{children}</div>;
const muted = { fontSize: 9.5, lineHeight: 1.35, color: "var(--ft-muted)" };

// -------------------------------------------------------------- variant A --
// Title-led. The document's NAME is the hero — "Selection Sheet" set big — the
// Keim mark steps back to the right, the tan Rough Estimate badge is gone and
// its disclaimer is one quiet line under the title. The people row reads like
// a letter: "Prepared for …" / "Selections by …".
function HeadA() {
  return (
    <div>
      <div className="flex justify-between items-end" style={{ gap: 16, borderBottom: "2px solid var(--ft-text)", paddingBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".3em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>Keim · Flooring &amp; Tile</div>
          <div className="uppercase" style={{ fontSize: 28, fontWeight: 800, letterSpacing: ".12em", lineHeight: 1 }}>Selection Sheet</div>
          <div style={{ fontSize: 9, color: "var(--ft-muted)", marginTop: 5 }}>Selections and planning quantities for this project · not an order · pricing subject to change on final order</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <img src={keimLogo} alt="Keim" style={{ height: 24, width: "auto", display: "inline-block" }} />
          <div className="flex items-baseline justify-end" style={{ gap: 8, marginTop: 4, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>N{sel.projectNo}</span>
            <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{DATE}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 18, padding: "6px 0 7px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8 }}>
        <div>
          <L>Prepared for</L>
          <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{cust.name}</div>
          <div style={muted}>{cust.address}</div>
          <div style={muted}>{cust.phone}</div>
        </div>
        <div>
          <L>Project</L>
          <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{sel.name}</div>
          <div style={muted}>{tv.proj.categories.length} areas selected</div>
        </div>
        <div>
          <L>Selections by</L>
          <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{PROFILE.name}</div>
          <div style={muted}>{PROFILE.phone}</div>
          <div style={muted}>{PROFILE.email}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- variant B --
// Letterhead + stamp. The Keim logo stays the anchor at the left, the project
// name and number are set large at the right like a cover page, and the badge
// becomes a tilted, outlined rubber-stamp "SELECTIONS" set off the grid. The
// people row is a two-column For / By block. .ft-pbadge inks the stamp black
// in print media.
function HeadB() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14, borderBottom: "2px solid var(--ft-text)", paddingBottom: 8 }}>
        <div>
          <img src={keimLogo} alt="Keim" style={{ height: 38, width: "auto", display: "block" }} />
          <div className="uppercase" style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: ".26em", color: "var(--ft-brand-deep)", marginTop: 4 }}>Flooring &amp; Tile</div>
        </div>
        <div className="ft-pbadge uppercase" style={{ transform: "rotate(-5deg)", border: "2px solid var(--ft-brand-deep)", borderRadius: 3, padding: "3px 12px 4px", textAlign: "center", lineHeight: 1.1, color: "var(--ft-brand-deep)", boxShadow: "inset 0 0 0 1.5px #fff, inset 0 0 0 2.5px var(--ft-brand-deep)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".22em" }}>Selections</div>
          <div style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: ".2em" }}>Not an order</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <L style={{ color: "var(--ft-brand-deep)", marginBottom: 2 }}>Selection sheet</L>
          <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.005em" }}>{sel.name}</div>
          <div className="flex items-baseline justify-end" style={{ gap: 8, marginTop: 2, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800 }}>N{sel.projectNo}</span>
            <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{DATE}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "6px 0 7px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8 }}>
        <div className="flex" style={{ gap: 10 }}>
          <L style={{ width: 22, paddingTop: 3 }}>For</L>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{cust.name}</div>
            <div style={muted}>{cust.address} · {cust.phone}</div>
          </div>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          <L style={{ width: 22, paddingTop: 3 }}>By</L>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{PROFILE.name}</div>
            <div style={muted}>{PROFILE.phone} · {PROFILE.email}</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 8.5, color: "var(--ft-faint)", margin: "-3px 0 8px" }}>Planning quantities and pricing are estimates and may change on final order.</div>
    </div>
  );
}

// ---------------------------------------------------------- round 2: A1 --
// Compact. A squeezed back to today's header budget (~108px): the title drops
// to 24px, the disclaimer rides one line under it, the people row tightens to
// two lines a column.
function HeadA1() {
  const line = { fontSize: 9.5, lineHeight: 1.3, color: "var(--ft-muted)" };
  return (
    <div>
      <div className="flex justify-between items-end" style={{ gap: 16, borderBottom: "2px solid var(--ft-text)", paddingBottom: 5 }}>
        <div style={{ minWidth: 0 }}>
          <div className="uppercase" style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: ".3em", color: "var(--ft-brand-deep)", marginBottom: 2 }}>Keim · Flooring &amp; Tile</div>
          <div className="uppercase" style={{ fontSize: 24, fontWeight: 800, letterSpacing: ".12em", lineHeight: 1 }}>Selection Sheet</div>
          <div style={{ fontSize: 8.5, color: "var(--ft-muted)", marginTop: 3 }}>Selections and planning quantities · not an order · pricing subject to change on final order</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <img src={keimLogo} alt="Keim" style={{ height: 22, width: "auto", display: "inline-block" }} />
          <div className="flex items-baseline justify-end" style={{ gap: 8, marginTop: 2, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>N{sel.projectNo}</span>
            <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{DATE}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 18, padding: "4px 0 5px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8 }}>
        <div>
          <L>Prepared for</L>
          <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.3 }}>{cust.name}</div>
          <div style={line}>{cust.address} · {cust.phone}</div>
        </div>
        <div>
          <L>Project</L>
          <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.3 }}>{sel.name}</div>
          <div style={line}>{tv.proj.categories.length} areas selected</div>
        </div>
        <div>
          <L>Selections by</L>
          <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.3 }}>{PROFILE.name}</div>
          <div style={line}>{PROFILE.phone} · {PROFILE.email}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- round 2: A2 --
// Letter. Title and mark as A; the project name + number become the title's
// subtitle, and the people block is two prose lines — "Prepared for …" /
// "Selections by …" — the way a cover letter opens.
function HeadA2() {
  const B = ({ children }) => <b style={{ fontWeight: 800, color: "var(--ft-text)" }}>{children}</b>;
  return (
    <div>
      <div className="flex justify-between items-end" style={{ gap: 16, borderBottom: "2px solid var(--ft-text)", paddingBottom: 7 }}>
        <div style={{ minWidth: 0 }}>
          <div className="uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".3em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>Keim · Flooring &amp; Tile</div>
          <div className="uppercase" style={{ fontSize: 28, fontWeight: 800, letterSpacing: ".12em", lineHeight: 1 }}>Selection Sheet</div>
          <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 5 }}>{sel.name} <span style={{ fontWeight: 500, color: "var(--ft-muted)" }}>· N{sel.projectNo} · {tv.proj.categories.length} areas</span></div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <img src={keimLogo} alt="Keim" style={{ height: 24, width: "auto", display: "inline-block" }} />
          <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)", marginTop: 4 }}>{DATE}</div>
        </div>
      </div>
      <div style={{ padding: "6px 0 7px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8, fontSize: 10.5, lineHeight: 1.5, color: "var(--ft-muted)" }}>
        <div>Prepared for <B>{cust.name}</B> · {cust.address} · {cust.phone}</div>
        <div>Selections by <B>{PROFILE.name}</B> · {PROFILE.phone} · {PROFILE.email}</div>
        <div style={{ fontSize: 8.5, color: "var(--ft-faint)", marginTop: 2 }}>Planning quantities, not an order · pricing subject to change on final order</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- round 2: A3 --
// Band. The title runs in a full-width band — the same treatment the area
// bands already use, so .ft-pband inks it black with white type in print
// media (moss on screen) — with the disclaimer knocked out at its right edge.
// Logo above it left, number + date right; A's people row beneath.
function HeadA3() {
  return (
    <div>
      <div className="flex justify-between items-center" style={{ gap: 16, paddingBottom: 6 }}>
        <img src={keimLogo} alt="Keim" style={{ height: 26, width: "auto", display: "block" }} />
        <div className="flex items-baseline" style={{ gap: 10, whiteSpace: "nowrap" }}>
          <span className="uppercase" style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: ".26em", color: "var(--ft-brand-deep)" }}>Flooring &amp; Tile</span>
          <span style={{ fontSize: 12, fontWeight: 800 }}>N{sel.projectNo}</span>
          <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{DATE}</span>
        </div>
      </div>
      <div className="ft-pband flex justify-between items-center" style={{ gap: 16, background: "var(--ft-brand-deep)", color: "#fff", borderRadius: 4, padding: "6px 12px" }}>
        <div className="uppercase" style={{ fontSize: 20, fontWeight: 800, letterSpacing: ".2em", lineHeight: 1, color: "#fff" }}>Selection Sheet</div>
        <div className="uppercase" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: ".14em", color: "#fff", textAlign: "right", lineHeight: 1.3 }}>Planning quantities · not an order<br />pricing subject to change on final order</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 18, padding: "7px 2px 7px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8 }}>
        <div>
          <L>Prepared for</L>
          <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{cust.name}</div>
          <div style={muted}>{cust.address}</div>
          <div style={muted}>{cust.phone}</div>
        </div>
        <div>
          <L>Project</L>
          <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>{sel.name}</div>
          <div style={muted}>{tv.proj.categories.length} areas selected</div>
        </div>
        <div>
          <L>Selections by</L>
          <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{PROFILE.name}</div>
          <div style={muted}>{PROFILE.phone}</div>
          <div style={muted}>{PROFILE.email}</div>
        </div>
      </div>
    </div>
  );
}

const Watermark = ({ cls, pages }) => WM === "none" ? null : (
  <>
    {Array.from({ length: pages }, (_, i) => <div key={i} className={`wm wm-screen wm-${WM}`} style={{ top: i * 950 }}><span>Selections</span></div>)}
    <div className={`wm wm-print wm-${WM}`}><span>Selections</span></div>
  </>
);

createRoot(document.getElementById("preview")).render(
  <>
    <style>{CSS}</style>
    <div className="ft-light bg-white text-black p-2" data-shot="paper" data-v={V} style={{ width: 710, boxSizing: "content-box" }}>
      <Watermark pages={3} />
      {V === "A" && <HeadA />}
      {V === "B" && <HeadB />}
      {V === "A1" && <HeadA1 />}
      {V === "A2" && <HeadA2 />}
      {V === "A3" && <HeadA3 />}
      <div data-real><EstimatePaper sel={sel} people={PEOPLE} profile={PROFILE} tv={tv} jobWaste={wSet.waste} tSet={tSet} {...paperProps} /></div>
    </div>
  </>
);
