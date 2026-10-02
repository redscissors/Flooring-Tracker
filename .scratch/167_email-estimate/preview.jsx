// Harness (email estimate, 2026-10-02): the REAL EstimatePaper over the 090
// fixture job, doubled so the PDF needs page breaks, and the REAL
// emailEstimate/estimateMail behind a button. ?share=1 takes the touch path.
// No Supabase.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { estimateMail } from "../../src/estimatemail.js";
import { emailEstimate, mailtoUrl } from "../../src/emailestimate.jsx";
import { makeJob, settings, PROFILE, PEOPLE } from "../090_print-fit-one-page/fixture.js";

const sel = makeJob();
sel.categories = [...sel.categories, ...makeJob().categories.map((a) => ({ ...a, id: a.id + "b", name: a.name + " (2)" }))];
const wSet = withProjWaste(settings, sel);
const tv = tierView(sel, wSet);
const T = jobTotals(tv.proj, sel, tv.settings, wSet, settings, []);
const paperProps = { sel, people: PEOPLE, profile: PROFILE, tv, jobWaste: wSet.waste, tSet: tv.settings, pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
const cust = { ...PEOPLE[0], email: "hartzlers@example.com" };
const m = estimateMail({ cust, project: sel, salesperson: PROFILE });
window.__mail = { ...m, mailto: mailtoUrl(m.to, m.subject, m.body) };

function run() {
  window.__result = "running";
  emailEstimate({ ...m, paper: <EstimatePaper {...paperProps} />, share: location.search.includes("share=1") })
    .then((r) => { window.__result = r; }, (e) => { window.__result = "error: " + e.message; });
}

createRoot(document.getElementById("preview")).render(
  <div className="p-4">
    <button id="go" onClick={run} className="rounded bg-indigo-600 text-white px-3 py-1">Email estimate</button>
    <div className="ft-light ft-ink bg-white text-black mt-4" style={{ width: 710 }} data-shot="paper"><EstimatePaper {...paperProps} /></div>
  </div>
);
