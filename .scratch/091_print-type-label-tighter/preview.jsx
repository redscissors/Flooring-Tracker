// Harness for issue 091 (drop the type label on printed product lines + tighten
// card padding): the REAL EstimatePaper over the 090 fixture job, with a
// wedi-style "Shower waterproofing" area of misc component lines appended — the
// shape the owner's screenshot complained about. No Supabase; dev-only.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { withProjWaste } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { newProduct, newArea } from "../../src/model.js";
import { makeJob, settings, PROFILE, PEOPLE } from "../090_print-fit-one-page/fixture.js";

const wedi = (name, sizeText, sku, price, qty) => ({
  ...newProduct(), type: "misc", brandColor: name, sizeText, sku,
  priceSqft: String(price), qtyType: "count", qty: String(qty), sellUnit: "EA",
});

function Paper() {
  const sel = makeJob();
  sel.categories.push({
    ...newArea(), name: "Shower waterproofing", option: "", products: [
      wedi("wedi — 3'x5' Shower Base", '36" x 60" x 1 37/64"', "1504156", 566.01, 1),
      wedi("wedi — 60\" Lean Curb", "", "29118", 53.99, 1),
      wedi("wedi — 4\"x4\" Drain Cover — Stainless", "", "1504181", 67.3, 1),
      wedi("wedi® Fastener Kit", '100 ct 1 5/8" Screws & 100 ct. Washers with Tabs', "28960", 32.83, 1),
      wedi("wedi® Joint Sealant Tube", "10.5 oz cartridge", "47735", 19.22, 11),
      wedi("wedi® Subliner Dry Mixing Valve Seal", "", "26897", 13.82, 1),
      wedi("wedi® Corner Putty Knife", "", "47822", 3.23, 1),
      wedi("wedi — 4'x5'x1/2\" Building Panel", '48" x 60" x 1/2"', "28862", 72.74, 2),
      wedi("wedi — 4'x8'x1/2\" Building Panel", '48" x 96" x 1/2"', "47828", 117.75, 2),
    ],
  });
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
  const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
  return (
    <EstimatePaper sel={sel} people={PEOPLE} profile={PROFILE} tv={tv}
      jobWaste={wSet.waste} tSet={tSet} {...paperProps} />
  );
}

createRoot(document.getElementById("preview")).render(
  <div className="ft-light bg-white text-black p-2" data-shot="paper"><Paper /></div>
);
