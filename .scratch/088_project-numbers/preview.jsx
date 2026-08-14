// Preview proof for project numbers (spec 2026-08-14): the REAL EstimatePaper
// over fixture jobs built through the REAL math, mirroring App.jsx's
// paperProps construction (085's harness, trimmed). No Supabase. Two sheets:
// a numbered project (N214, salesperson with phone + email) and an unnumbered
// one — the corner must show the stacked title + date alone.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { jobTotals } from "../../src/jobtotals.js";
import { normalizeSettings, withProjWaste } from "../../src/catalog.js";
import { newProduct, newArea, newProject } from "../../src/model.js";
import { tierView } from "../../src/pricing.js";

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
const area = (name, products) => ({ ...newArea(), name, option: "", products });

const makeJob = (projectNo) => ({
  ...newProject(null, "Marsh — whole first floor"), _full: true, projectNo,
  salesperson: { name: "Danny", phone: "(555) 210-0114", email: "danny@keimlumber.com" },
  waste: { tile: 10, floor: 5, tileOn: true, floorOn: true },
  categories: [
    area("Kitchen", [tile({ note: "Lay on the diagonal — confirm layout with installer." })]),
    area("Hallway", [vinyl({ qty: "240" })]),
  ],
});

function Paper({ projectNo }) {
  const sel = makeJob(projectNo);
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
  const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
  return (
    <div className="ft-light bg-white text-black rounded-sm shadow-lg" style={{ padding: 30, width: 820 }}>
      <EstimatePaper sel={sel} people={[]} profile={{ name: "Sam Weaver", phone: "", email: "" }} tv={tv}
        jobWaste={wSet.waste} tSet={tSet} {...paperProps} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(
  <div className="min-h-screen" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, background: "#fff" }}>
    <div data-shot="numbered"><Paper projectNo={214} /></div>
    <div data-shot="unnumbered"><Paper projectNo={null} /></div>
  </div>
);
