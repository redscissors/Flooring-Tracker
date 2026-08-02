// Kits tab — condensing prototypes (issue 075, owner ask 2026-08-02):
// "the box of text telling what it is does not need to be there… condense the
// actual kit selection boxes as well… aim for about half the size."
//
// These mount the REAL WediConfigurator, so every price on screen is the real
// kit total through the real tier lens — a prototype with invented prices is
// worse than none here. Each variant is a stylesheet layered over the shipped
// markup (?k=<key>), which is honest about cost: everything achieved with CSS
// alone is a CSS-only change to WediConfigurator's own block. The one rule that
// needs component work is called out in the caption and faked with a class.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import WediConfigurator from "../../src/WediConfigurator.jsx";
import { pans, group } from "../../src/wedi.js";

// Shared by every variant: the note box goes, and the card loses the two
// captions that repeat on literally every card in a family — the product name
// ("Fundo® Shower Base", which the family heading above already says) and
// "full kit" (which is what the whole tab prices).
const SHARED = `
.wedi-pop .kitnote{display:none}
.wedi-pop .pancard .nm{display:none}
.wedi-pop .pancard .fk{display:none}
`;

const VARIANTS = {
  today: ["Today", "As shipped — 120px card. Name, drain chip, price and 'full kit' stacked, and a 124px note box above the first family.", ""],

  k1: ["K1 · Two-line card", "Note gone, name and 'full kit' gone. Size + drain chip on one line, price on the next. Keeps the card and keeps the drain visible.", SHARED + `
.wedi-pop .cards{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px}
.wedi-pop .pancard{padding:6px 8px 7px}
.wedi-pop .pancard .sz{font-size:14.5px;display:flex;align-items:center;gap:5px}
.wedi-pop .pancard .sz small{margin-left:0}
.wedi-pop .pancard .drn{margin-top:4px;font-size:8.5px;padding:1px 4px}
.wedi-pop .pancard .pr{font-size:12.5px;margin-top:3px}
.wedi-pop .pancard .dot{top:6px;right:6px;width:6px;height:6px}
`],

  k2: ["K2 · One line", "Size and price on a single line, drain chip dropped too — the family heading already names the drains it carries, and the odd offset pan is the exception. Densest card form.", SHARED + `
.wedi-pop .cards{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px}
.wedi-pop .pancard{padding:5px 8px;display:flex;align-items:baseline;gap:7px}
.wedi-pop .pancard .sz{font-size:13.5px}
.wedi-pop .pancard .sz small{margin-left:2px}
.wedi-pop .pancard .drn{display:none}
.wedi-pop .pancard .pr{font-size:12px;margin-top:0;margin-left:auto}
.wedi-pop .pancard .dot{position:static;margin-right:-2px}
`],

  k3: ["K3 · Rows with an aligned price column", "One row per pan, price right-aligned in its own track so a family compares straight down a column — which is what someone hunting a size is actually doing. Two columns of rows so the width still gets used. Keeps the name and the drain.", SHARED.replace(".wedi-pop .pancard .nm{display:none}", "") + `
.wedi-pop .cards{grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:0 22px}
.wedi-pop .pancard{display:grid;grid-template-columns:66px 1fr 76px;align-items:center;gap:9px;padding:4px 6px;border-radius:0;border-width:0 0 1px 0;border-color:var(--ft-row-line);background:none}
.wedi-pop .pancard:hover{background:var(--ft-hover);border-color:var(--ft-row-line)}
.wedi-pop .pancard.on{outline:none;background:var(--ft-tint);box-shadow:inset 2px 0 0 var(--ft-brand)}
.wedi-pop .pancard .sz{font-size:13px}
.wedi-pop .pancard .nm{display:block;margin-top:0;min-height:0;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wedi-pop .pancard .drn{display:none}
.wedi-pop .pancard .pr{font-size:12.5px;margin-top:0;text-align:right}
.wedi-pop .pancard .dot{top:50%;right:auto;left:-2px;margin-top:-3px}
`],

  k4: ["K4 · Two-line, drain only when it differs", "K1, but the drain chip shows only on the pans that break the family's pattern — every Fundo card saying CENTER DRAIN teaches nothing; the two OFFSET ones are the whole signal. Needs a component change, not just CSS: faked here by hiding the chips that read 'center drain'.", SHARED + `
.wedi-pop .cards{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px}
.wedi-pop .pancard{padding:6px 8px 7px}
.wedi-pop .pancard .sz{font-size:14.5px}
/* the chip rides the size line, so an exception card is the same height as its
   neighbours — a taller one would stretch its whole grid row */
.wedi-pop .pancard .drn{position:absolute;top:6px;right:16px;margin-top:0;font-size:8px;padding:1px 4px}
.wedi-pop .pancard .pr{font-size:12.5px;margin-top:3px}
.wedi-pop .pancard .dot{top:9px;right:6px;width:6px;height:6px}
.wedi-pop .pancard[data-common-drain] .drn{display:none}
`],

  k5: ["K5 · K3 rows, by size, feet over inches", "K3's rows with the product name gone (the family heading says it), the size led by FEET in bold with inches behind it, a tag only where the pan breaks the family's pattern, and the whole family sorted smallest side first — every 3-footer together, then the 4-footers.", SHARED + `
.wedi-pop .cards{gap:0 24px;align-content:flex-start}
.wedi-pop .pancard{display:grid;grid-template-columns:132px 1fr 78px;align-items:center;gap:8px;padding:4px 6px;border-radius:0;border-width:0 0 1px 0;border-color:var(--ft-row-line);background:none}
.wedi-pop .pancard:hover{background:var(--ft-hover);border-color:var(--ft-row-line)}
.wedi-pop .pancard.on{outline:none;background:var(--ft-tint);box-shadow:inset 2px 0 0 var(--ft-brand)}
.wedi-pop .pancard .sz{font-size:11px;font-weight:600;color:var(--ft-faint)}
.wedi-pop .pancard .sz b{font-size:13.5px;font-weight:800;color:var(--ft-text);margin-right:5px}
.wedi-pop .pancard .sz .inch{font-weight:600;color:var(--ft-faint)}
.wedi-pop .pancard .sz small{display:none}
.wedi-pop .pancard .nm{display:block;margin-top:0;min-height:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--w-rust);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wedi-pop .pancard .drn{display:none}
.wedi-pop .pancard .pr{font-size:12.5px;margin-top:0;text-align:right}
.wedi-pop .pancard .dot{top:50%;right:auto;left:-3px;margin-top:-3px}
`],

  k6: ["K6 · K5 tightened", "K5 with the family headings cut to one word and their hint lines dropped, the tags cut to OFFSET / CORNER, and every gap in the tab pulled in — rows, heading spacing, and the space between families. The shorter tag also lets a third column of rows fit.", SHARED + `
.wedi-pop .fam{margin-bottom:9px}
.wedi-pop .fam-h{margin-bottom:2px}
.wedi-pop .fam-h .t{font-size:10px;letter-spacing:.1em}
.wedi-pop .fam-h .hint{display:none}
.wedi-pop .main{padding:10px 12px 14px}
.wedi-pop .cards{gap:0 20px;align-content:flex-start}
.wedi-pop .pancard{display:grid;grid-template-columns:1fr auto 60px;align-items:center;gap:6px;padding:1px 5px;border-radius:0;border-width:0 0 1px 0;border-color:var(--ft-row-line);background:none}
.wedi-pop .pancard:hover{background:var(--ft-hover);border-color:var(--ft-row-line)}
.wedi-pop .pancard.on{outline:none;background:var(--ft-tint);box-shadow:inset 2px 0 0 var(--ft-brand)}
.wedi-pop .pancard .sz{font-size:10px;font-weight:600;color:var(--ft-faint);line-height:1.5;white-space:nowrap}
.wedi-pop .pancard .sz b{font-size:12px;font-weight:800;color:var(--ft-text);margin-right:4px}
.wedi-pop .pancard .sz .inch{font-weight:600;color:var(--ft-faint)}
.wedi-pop .pancard .sz small{display:none}
.wedi-pop .pancard .nm{display:block;margin-top:0;min-height:0;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--w-rust);line-height:1.5;white-space:nowrap;overflow:hidden}
.wedi-pop .pancard .drn{display:none}
.wedi-pop .pancard .pr{font-size:11.5px;margin-top:0;text-align:right;line-height:1.5}
.wedi-pop .pancard .dot{top:50%;right:auto;left:-3px;margin-top:-2.5px;width:5px;height:5px}
`],
  k7: ["K7 · K6 as a single column", "Every pan in one column, full width of the solver pane. The size group hugs the left with its tag beside it, the price sits hard right — one price column for the whole tab instead of one per column of rows. Always the same shape at every width, but always taller than it needs to be.", SHARED + `
.wedi-pop .fam{margin-bottom:9px}
.wedi-pop .fam-h{margin-bottom:2px}
.wedi-pop .fam-h .t{font-size:10px;letter-spacing:.1em}
.wedi-pop .fam-h .hint{display:none}
.wedi-pop .main{padding:10px 12px 14px}
.wedi-pop .cards{align-content:flex-start}
.wedi-pop .pancard{display:flex;align-items:center;gap:10px;padding:1px 5px;border-radius:0;border-width:0 0 1px 0;border-color:var(--ft-row-line);background:none}
.wedi-pop .pancard:hover{background:var(--ft-hover);border-color:var(--ft-row-line)}
.wedi-pop .pancard.on{outline:none;background:var(--ft-tint);box-shadow:inset 2px 0 0 var(--ft-brand)}
.wedi-pop .pancard .sz{font-size:10px;font-weight:600;color:var(--ft-faint);line-height:1.5;white-space:nowrap}
.wedi-pop .pancard .sz b{font-size:12px;font-weight:800;color:var(--ft-text);margin-right:4px}
.wedi-pop .pancard .sz .inch{font-weight:600;color:var(--ft-faint)}
.wedi-pop .pancard .sz small{display:none}
.wedi-pop .pancard .nm{display:block;margin-top:0;min-height:0;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--w-rust);line-height:1.5;white-space:nowrap}
.wedi-pop .pancard .drn{display:none}
.wedi-pop .pancard .pr{font-size:11.5px;margin-top:0;margin-left:auto;line-height:1.5}
/* In a flex row the stock dot is just the first item — absolutely positioning
   it put it outside the row box, where the pane clipped it in half. */
.wedi-pop .pancard .dot{position:static;flex:none;width:5px;height:5px;margin:0}
`],
};

// K8/K9 share K7's rows and only change how the three columns split the width.
// Today `.main` is flex:1 while the build (392px) and drawings (356px) columns
// are fixed, so every extra pixel goes to the selection list — which is the one
// column that needs the least. These pin the list and let the other two grow.
const K7_ROWS = VARIANTS.k7[2];
const narrowMain = (buildGrow, diagGrow) => K7_ROWS + `
.wedi-pop .pop-body .main{flex:0 0 300px}
.wedi-pop .pop-body .buildcol{flex:${buildGrow} 1 392px}
.wedi-pop .pop-body .diagcol{flex:${diagGrow} 1 356px}
`;

VARIANTS.k8 = ["K8 · narrow list, build and drawings share the gain",
  "K7's single column pinned to 300px. The build column and the drawings rail grow equally into everything it gives up, instead of the list taking it all.",
  narrowMain(1, 1)];

VARIANTS.k9 = ["K9 · narrow list, drawings take most of the gain",
  "Same 300px list, but the drawings rail grows twice as fast as the build column — the plan and isometric are the only things here that get genuinely better with pixels; the build column is a line list.",
  narrowMain(1, 2)];

// The family headings the owner wants: the one word that distinguishes them,
// with the descriptive hint dropped.
const FAM_SHORT = [[/curbless|ligno/i, "Curbless"], [/module|riolito/i, "Neo modules"], [/linear/i, "Linear"], [/fundo|curbed/i, "Curbed"]];

// ── K5's three content rules ─────────────────────────────────────────────
// All three live in kitsTab for real; here they run as a post-paint pass so
// the prototype can show the shape over live prices. Nothing is moved in the
// DOM — React owns those nodes, so the sort rides grid `order` instead.
const PAN_BY_KEY = (() => {
  const m = {};
  ["fundo", "curbless", "linear"].forEach((f) => pans({ family: f }).forEach((p) => { m[p.key] = p; }));
  group("module").filter((x) => x.sub === "neo").forEach((p) => { m[p.key] = p; });
  return m;
})();

const ft = (n) => {
  const f = Math.floor(n / 12), i = Math.round(n % 12);
  return i ? `${f}′${i}″` : `${f}′`;
};

// A pan earns a tag only where it breaks its family's pattern: a drain that
// isn't the family's usual one, or a name that isn't the family's usual name
// (which is what singles out the Primo corner pan). Everything else is blank —
// "CENTER DRAIN" on 16 of 18 cards taught nobody anything.
const applyK5 = (opts = {}) => {
  const { shortTags = false, shortHeads = false, maxCols = 2, colMin = 330 } = opts;
  document.querySelectorAll(".wedi-pop .fam").forEach((fam) => {
    if (shortHeads) {
      const t = fam.querySelector(".fam-h .t");
      if (t) {
        const hit = FAM_SHORT.find(([re]) => re.test(t.getAttribute("data-full") || t.textContent));
        if (hit) { t.setAttribute("data-full", t.getAttribute("data-full") || t.textContent); t.textContent = hit[1]; }
      }
    }
    const cards = [...fam.querySelectorAll(".pancard")];
    const rows = cards.map((el) => ({ el, p: PAN_BY_KEY[el.getAttribute("data-wedi-pan")] })).filter((r) => r.p);
    // A "usual" needs at least two pans agreeing — otherwise every module,
    // whose name carries its own length, reads as its own exception.
    const tally = (get) => {
      const c = {};
      rows.forEach((r) => { const k = get(r.p); c[k] = (c[k] || 0) + 1; });
      const [top] = Object.entries(c).sort((a, b) => b[1] - a[1]);
      return top && top[1] > 1 ? top[0] : null;
    };
    const usualDrain = tally((p) => (p.group === "module" ? "module" : p.drain?.type || ""));
    const usualName = tally((p) => p.name);

    // Smallest side first, then the long side — so every 3-footer sits together
    // and a 4-footer is never buried between them. (No pan stores w > d, so
    // leading with the smaller number never misstates an offset drain.)
    const sorted = [...rows].sort((a, b) => {
      const A = a.p, B = b.p;
      if (A.group === "module") return (A.len || 0) - (B.len || 0);
      return (A.w - B.w) || (A.d - B.d);
    });
    sorted.forEach((r, i) => { r.el.style.order = i; });

    // Flow DOWN the first column, then over — a grid's auto-fill runs across,
    // which zig-zags the size order and defeats the point of sorting it. Flex
    // column-wrap honours `order` (a CSS multi-column would not, and reordering
    // the DOM is off the table while React owns these nodes), so the container
    // just needs a height to wrap against.
    const cards2 = fam.querySelector(".cards");
    if (cards2 && rows.length) {
      // offsetHeight, NOT getBoundingClientRect(): the popup carries a `zoom`
      // below ~1160px of frame, so the rect is in device pixels while the
      // height we set here is read in the element's own (zoomed) pixels. Mixing
      // them set the container short and silently wrapped extra columns.
      const rowH = rows[0].el.offsetHeight || 25;
      const cols = Math.max(1, Math.min(maxCols, Math.floor(cards2.clientWidth / colMin)));
      cards2.style.display = "flex";
      cards2.style.flexFlow = "column wrap";
      cards2.style.height = Math.ceil(rows.length / cols) * rowH + "px";
      rows.forEach((r) => { r.el.style.width = `calc(${(100 / cols).toFixed(3)}% - ${cols > 1 ? 12 : 0}px)`; });
    }

    rows.forEach(({ el, p }) => {
      const sz = el.querySelector(".sz");
      if (sz) {
        sz.innerHTML = p.group === "module"
          ? `<b>${ft(p.len)}</b> <span class="inch">${p.len}″${shortHeads ? "" : " module"}</span>`
          : `<b>${ft(p.w)} × ${ft(p.d)}</b> <span class="inch">${p.w} × ${p.d}</span>`;
      }
      const nm = el.querySelector(".nm");
      if (!nm) return;
      const drain = p.group === "module" ? "module" : p.drain?.type || "";
      let tag = "";
      // The corner pan's own name already carries "Corner/Offset Drain", so it
      // never needs the drain appended — and the tag has to stay short enough
      // to read without an ellipsis.
      if (/corner/i.test(p.name)) tag = shortTags ? "Corner" : "Corner pan";
      else if (usualDrain && drain && drain !== usualDrain) {
        const d = drain[0].toUpperCase() + drain.slice(1);
        tag = shortTags ? d : d + " drain";
      } else if (usualName && p.name !== usualName) tag = unwediName(p.name);
      nm.textContent = tag;
    });
  });
};
const unwediName = (s) => (s || "").replace(/\bwedi\b\s*®?\s*/gi, "").trim();

// K4's rule lives in the component in real life; here it is applied after paint
// so the prototype shows the shape without forking WediConfigurator.
const markCommonDrains = () => {
  document.querySelectorAll(".wedi-pop .fam").forEach((fam) => {
    const cards = [...fam.querySelectorAll(".pancard")];
    const counts = {};
    cards.forEach((c) => { const t = c.querySelector(".drn")?.textContent || ""; counts[t] = (counts[t] || 0) + 1; });
    const [common] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
    cards.forEach((c) => {
      const t = c.querySelector(".drn")?.textContent || "";
      if (t === common && counts[common] > 1) c.setAttribute("data-common-drain", "");
      else c.removeAttribute("data-common-drain");
    });
  });
};

// WediConfigurator renders its own <style> from inside its tree, i.e. AFTER
// this one, so a variant rule at equal specificity loses every property the
// base also sets. Doubling the scope class wins the tie without !important.
const bump = (css) => css.replace(/\.wedi-pop /g, ".wedi-pop.wedi-pop ");

function App() {
  const key = new URLSearchParams(location.search).get("k") || "today";
  const [name, note, css] = VARIANTS[key] || VARIANTS.today;
  const [, force] = useState(0);
  // Re-applied on a timer: picking a pan re-renders the cards and React writes
  // the original text back.
  useEffect(() => {
    const pass = key === "k4" ? markCommonDrains
      : key === "k5" ? () => applyK5()
        : key === "k6" ? () => applyK5({ shortTags: true, shortHeads: true, maxCols: 3, colMin: 235 })
          : ["k7", "k8", "k9"].includes(key) ? () => applyK5({ shortTags: true, shortHeads: true, maxCols: 1 })
            : null;
    if (!pass) return;
    const t = setInterval(() => { try { pass(); } catch (x) { /* mid-render */ } }, 400);
    return () => clearInterval(t);
  }, [key]);
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--ft-cream)" }}>
      <style>{bump(css)}</style>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--ft-border)", flex: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 800 }} data-proto-name>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--ft-muted)", maxWidth: 1000, lineHeight: 1.45 }}>{note}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <WediConfigurator embedded tier="retail" onAdd={() => force(1)} onClose={() => {}} areaName="proto" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
