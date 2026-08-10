// Preview proof for the mono-ink print pass: the REAL EstimatePaper over
// fixture jobs built through the REAL math (jobTotals / bucketCats), mirroring
// App.jsx's optionPrint/paperProps construction. No Supabase. Shot twice by
// shot.mjs: screen media (the on-screen Print preview, unchanged) and print
// media (what the sheet sends to the printer).
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

const makeJob = (withOptions) => ({
  ...newProject(null, "Miller — main floor"), _full: true,
  waste: { tile: 10, floor: 5, tileOn: true, floorOn: true },
  categories: withOptions ? [
    area("Hallway", "", [vinyl({ qty: "240" })]),
    area("Kitchen", "A", [tile()]),
    area("Mudroom", "A", [vinyl()]),
    area("Kitchen", "B", [tile({ brandColor: "Daltile Keystones - Uptown Taupe", sku: "1498221", priceSqft: "8.64" })]),
    area("Mudroom", "B", [vinyl({ brandColor: "Mannington AduraMax MPB801 Sundance Gunstock", sku: "1508833", priceSqft: "5.15" })]),
  ] : [
    area("Kitchen", "", [tile({ note: "Lay on the diagonal — confirm layout with installer." })]),
    area("Hallway", "", [vinyl({ qty: "240" })]),
  ],
});

function Paper({ withOptions }) {
  const sel = makeJob(withOptions);
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const optsUsed = optionsUsed(sel.categories);
  const run = (scope) => jobTotals({ ...tv.proj, categories: bucketCats(tv.proj.categories, scope) }, { ...sel, categories: bucketCats(sel.categories, scope) }, tSet, wSet, settings, []);
  let paperProps;
  if (withOptions) {
    const buckets = { shared: run("shared") };
    optsUsed.forEach((s) => { buckets[s] = run(s); });
    const optionPrint = {
      sharedT: buckets.shared,
      sections: optsUsed.map((s) => ({ slot: s, title: optionTitle(sel, s), color: OPTION_COLOR[s], cats: bucketCats(tv.proj.categories, s), t: buckets[s], whole: buckets.shared.grandTotal + buckets[s].grandTotal })),
    };
    paperProps = { pMats: buckets.shared.pMats, materialsCost: buckets.shared.materialsCost, freightCost: buckets.shared.freightCost, flooringPrice: buckets.shared.flooringPrice, miscCost: buckets.shared.miscCost, totalSqft: buckets.shared.totalSqft, orderedSqft: buckets.shared.orderedSqft, grandTotal: buckets.shared.grandTotal, optionPrint };
  } else {
    const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
    paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
  }
  return (
    <div className="ft-light bg-white text-black rounded-sm shadow-lg" style={{ padding: 30, width: 820 }}>
      <EstimatePaper sel={sel} people={[]} profile={{ name: "Sam Weaver", phone: "", email: "" }} tv={tv}
        jobWaste={wSet.waste} tSet={tSet} {...paperProps} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(
  <div className="min-h-screen" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, background: "#fff" }}>
    <div data-shot="plain">
      <Paper withOptions={false} />
    </div>
    <div data-shot="options">
      <Paper withOptions={true} />
    </div>
  </div>
);
