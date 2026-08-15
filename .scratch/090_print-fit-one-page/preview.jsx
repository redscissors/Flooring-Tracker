// Measurement harness for the "fit a big job on one page" question: the REAL
// EstimatePaper (src/EstimatePrint.jsx) over an n167-scale fixture job built
// through the REAL math (jobTotals), rendered at the true printable content
// width so measure.mjs can read block heights and shoot a page-accurate PDF.
// No Supabase. Dev-only; not part of the app build.
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
const trim = (over) => ({
  ...newProduct(), type: "misc", brandColor: "Schluter SCHIENE Satin Anodized Aluminum",
  sizeText: '3/8" x 8\'2"', sku: "1489330", priceSqft: "18.40", qtyType: "count", qty: "6",
  sellUnit: "EA", ...over,
});

const area = (name, products) => ({ ...newArea(), name, option: "", products });

// An n167-scale job: 8 areas, 20 product lines, most carrying grout/mortar
// chips, a couple with notes — the shape that currently runs three pages.
const makeJob = () => ({
  ...newProject(null, "Hartzler — Whole house remodel"), _full: true,
  address: "4821 Kidron Rd, Dalton OH 44618",
  waste: { tile: 10, floor: 5, tileOn: true, floorOn: true },
  categories: [
    area("Kitchen", [
      tile({ note: "Lay on the diagonal — confirm layout with installer." }),
      trim({ brandColor: "Schluter RONDEC Brushed Chrome", qty: "4" }),
    ]),
    area("Kitchen backsplash", [
      tile({ brandColor: "Daltile Keystones Uptown Taupe 2\" Hex Mosaic", sizeText: '2" Hex', L: "2", W: "2", sku: "1498221", priceSqft: "14.64", qty: "48", cartonSf: "5.38" }),
    ]),
    area("Master bath floor", [
      tile({ brandColor: "Anatolia Mayfair Statuario Venato 12x24 Polished", L: "12", W: "24", sku: "ANA1224P", priceSqft: "6.19", qty: "112", cartonSf: "15.5" }),
    ]),
    area("Master shower", [
      tile({ brandColor: "Anatolia Mayfair Statuario 3x12 Wall", L: "3", W: "12", sku: "ANA0312W", priceSqft: "7.85", qty: "140", cartonSf: "10.76" }),
      tile({ brandColor: "Anatolia Carrara 2\" Hex Shower Pan", sizeText: '2" Hex', L: "2", W: "2", sku: "ANAHEX2M", priceSqft: "12.25", qty: "16", cartonSf: "5.38" }),
      trim({ brandColor: "Schluter KERDI-BOARD-SN Niche 12x20", qty: "2", priceSqft: "84.50" }),
    ]),
    area("Hall bath", [
      tile({ brandColor: "Daltile Restore Bright White 12x24", L: "12", W: "24", sku: "1479221", priceSqft: "4.29", qty: "64", cartonSf: "15.5" }),
      trim({ brandColor: "Schluter DILEX-EKE Bright White", qty: "3", priceSqft: "22.10" }),
    ]),
    area("Laundry / mudroom", [
      vinyl({ qty: "210" }),
      trim({ brandColor: "Mannington T-Mold MPB822 Noble Oak", qty: "2", priceSqft: "46.00" }),
    ]),
    area("Great room", [
      vinyl({ brandColor: "Mannington AduraMax MPB801 Sundance Gunstock", sku: "1508833", priceSqft: "5.15", qty: "640", note: "Runs continuous into the hallway — no transition at the opening." }),
      trim({ brandColor: "Mannington Stair Nose MPB801 Sundance", qty: "5", priceSqft: "72.00" }),
    ]),
    area("Bedrooms 2 & 3", [
      vinyl({ brandColor: "Mannington AduraMax MPB770 Dockside Boardwalk", sku: "1508811", priceSqft: "5.15", qty: "410" }),
      trim({ brandColor: "Mannington Reducer MPB770 Dockside", qty: "4", priceSqft: "44.00" }),
    ]),
  ],
});

function Paper() {
  const sel = makeJob();
  const wSet = withProjWaste(settings, sel);
  const tv = tierView(sel, wSet);
  const tSet = tv.settings;
  const T = jobTotals(tv.proj, sel, tSet, wSet, settings, []);
  const paperProps = { pMats: T.pMats, materialsCost: T.materialsCost, freightCost: T.freightCost, flooringPrice: T.flooringPrice, miscCost: T.miscCost, totalSqft: T.totalSqft, orderedSqft: T.orderedSqft, grandTotal: T.grandTotal, optionPrint: null };
  return (
    <EstimatePaper sel={sel} people={[]} profile={{ name: "Sam Weaver", phone: "330-555-0142", email: "sam@keimlumber.com" }} tv={tv}
      jobWaste={wSet.waste} tSet={tSet} {...paperProps} />
  );
}

// Mirrors App.jsx's print wrapper exactly: <div className="ft-light ... p-2">.
createRoot(document.getElementById("preview")).render(
  <div className="ft-light bg-white text-black p-2" data-shot="paper"><Paper /></div>
);
