// Measurement harness for the "fit a big job on one page" question: the REAL
// EstimatePaper (src/EstimatePrint.jsx) over an n167-scale fixture job built
// through the REAL math (jobTotals), rendered at the true printable content
// width so measure.mjs can read block heights and shoot a page-accurate PDF.
// No Supabase. Dev-only; not part of the app build.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { makeJob, settings, PROFILE } from "./fixture.js";

function Paper() {
  const sel = makeJob();
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
  const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
  return (
    <EstimatePaper sel={sel} people={[]} profile={PROFILE} tv={tv}
      jobWaste={wSet.waste} tSet={tSet} {...paperProps} />
  );
}

// Mirrors App.jsx's print wrapper exactly: <div className="ft-light ... p-2">.
createRoot(document.getElementById("preview")).render(
  <div className="ft-light bg-white text-black p-2" data-shot="paper"><Paper /></div>
);
