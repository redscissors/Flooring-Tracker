// Preview proof for the option-print declutter: the REAL EstimatePaper over
// fixture jobs built through the REAL math (jobTotals / bucketCats), mirroring
// App.jsx's optionPrint/paperProps construction. No Supabase.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { normalizeSettings, withProjWaste } from "../../src/catalog.js";
import { newProduct, newArea, newProject } from "../../src/model.js";
import { tierView } from "../../src/pricing.js";
import { OPTION_COLOR, optionsUsed, bucketCats, optionTitle } from "../../src/options.js";

const settings = normalizeSettings();
settings.grouts["PermaColor Select"] = { ...settings.grouts["PermaColor Select"], price: 5.39, sku: "1519042" };
settings.mortars["ProLite"] = { ...settings.mortars["ProLite"], price: 39.99, sku: "29438" };

const tile = (over) => ({
  ...newProduct(), brandColor: "Marazzi Rice Tile - RC21RCT38GL Natural", L: "3", W: "8",
  cartonSf: "8.1", sku: "1504207", priceSqft: "11.18", qty: "95",
  grout: { ...newProduct().grout, checked: true, product: "PermaColor Select", color: "Midnight Black" },
  mortar: { checked: true, product: "ProLite", manual: "" },
  ...over,
});
const vinyl = (over) => ({
  ...newProduct(), type: "vinyl", brandColor: "Mannington AduraMax MPB822 Noble Oak Branch",
  sizeText: "7x60", cartonSf: "29.5", sku: "1517409", priceSqft: "4.79", qty: "160", ...over,
});

const area = (name, option, products) => ({ ...newArea(), name, option, products });

// Case 1: unnamed option areas, no shared bucket. Case 2: named areas
// ("Kitchen"/"Mudroom") plus a shared Hallway.
const makeJob = (withShared) => ({
  ...newProject(null, "Miller — main floor"), _full: true,
  waste: { tile: 10, floor: 5, tileOn: true, floorOn: true },
  categories: [
    ...(withShared ? [area("Hallway", "", [vinyl({ qty: "240" })])] : []),
    area(withShared ? "Kitchen" : "", "A", [tile()]),
    area(withShared ? "Mudroom" : "", "A", [vinyl()]),
    area(withShared ? "Kitchen" : "", "B", [tile({ brandColor: "Daltile Keystones - Uptown Taupe", sku: "1498221", priceSqft: "8.64" })]),
    area(withShared ? "Mudroom" : "", "B", [vinyl({ brandColor: "Mannington AduraMax MPB801 Sundance Gunstock", sku: "1508833", priceSqft: "5.15" })]),
  ],
});

function Paper({ withShared }) {
  const sel = makeJob(withShared);
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const optsUsed = optionsUsed(sel.categories);
  const run = (scope) => jobTotals({ ...tv.proj, categories: bucketCats(tv.proj.categories, scope) }, { ...sel, categories: bucketCats(sel.categories, scope) }, tSet, wSet, settings, []);
  const buckets = { shared: run("shared") };
  optsUsed.forEach((s) => { buckets[s] = run(s); });
  const optionPrint = {
    sharedT: buckets.shared,
    sections: optsUsed.map((s) => ({ slot: s, title: optionTitle(sel, s), color: OPTION_COLOR[s], cats: bucketCats(tv.proj.categories, s), t: buckets[s], whole: buckets.shared.grandTotal + buckets[s].grandTotal })),
  };
  return (
    <div className="ft-light bg-white text-black rounded-sm shadow-lg" style={{ padding: 30, width: 820 }}>
      <EstimatePaper sel={sel} people={[]} profile={{ name: "Sam Weaver", phone: "", email: "" }} tv={tv}
        jobWaste={wSet.waste} pMats={buckets.shared.pMats} tSet={tSet}
        materialsCost={buckets.shared.materialsCost} freightCost={buckets.shared.freightCost}
        flooringPrice={buckets.shared.flooringPrice} miscCost={buckets.shared.miscCost}
        totalSqft={buckets.shared.totalSqft} orderedSqft={buckets.shared.orderedSqft}
        grandTotal={buckets.shared.grandTotal} optionPrint={optionPrint} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(
  <div className="min-h-screen bg-slate-100" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
    <div data-shot="no-shared">
      <p className="ft-eyebrow text-[10px] mb-1">options only, unnamed areas, NO shared — no header row, no area list, no footer breakdown, no "whole job"</p>
      <Paper withShared={false} />
    </div>
    <div data-shot="with-shared">
      <p className="ft-eyebrow text-[10px] mb-1">named areas + a shared area — the names print in the band header; "whole job" and "incl. shared areas" return</p>
      <Paper withShared={true} />
    </div>
  </div>
);
