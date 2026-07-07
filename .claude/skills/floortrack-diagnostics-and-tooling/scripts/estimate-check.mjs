#!/usr/bin/env node
// Estimate cross-check CLI: computes grout/mortar/carton quantities using the
// REAL functions from src/catalog.js (never a re-implementation), so its
// numbers are exactly what the app would show. Dependency-free.
//
// Usage:
//   node estimate-check.mjs --sqft 120 --L 12 --W 24 [--thickness 0.375]
//     [--joint 0.125] [--type tile] [--waste 10 | --waste-tile 10 --waste-floor 10]
//     [--grout "PermaColor Select"] [--grout-coverage 110] [--grout-price 25]
//     [--mortar "ProLite"] [--mortar-tiers 90,63,45] [--mortar-price 40]
//     [--carton-sf 22] [--price-sqft 3.49]
//
// Grout/mortar only compute for --type tile (same rule as the app). Unknown
// grout/mortar names are allowed if you supply --grout-coverage / --mortar-tiers.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, "../../../../src/catalog.js");
const {
  mergeSettings, wasteFor,
  groutExact, getGrout, mortarExact, getMortar, cartonExact, getCarton, num,
} = await import(pathToFileURL(catalogPath).href);

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const k = a.slice(2);
  const next = argv[i + 1];
  args[k] = next !== undefined && !next.startsWith("--") ? argv[++i] : "true";
}

if (args.help || args.sqft == null) {
  console.log(`estimate-check — recompute a product line's quantities with the app's real math

Required: --sqft <n>
Tile grout/mortar also need: --L <in> --W <in> (thickness defaults 0.375, joint 0.125)
Optional: --type tile|hardwood|vinyl|laminate|carpet (default tile)
          --waste <pct> (both families) or --waste-tile / --waste-floor
          --grout <name> --grout-coverage <sqft/unit at 12x12x3/8", 1/8" joint> --grout-price <$>
          --mortar <name> --mortar-tiers <t1,t2,t3 sqft/unit> --mortar-price <$>
          --carton-sf <sqft per carton> --carton-unit CT|SH --price-sqft <$>

Example:
  node estimate-check.mjs --sqft 120 --L 12 --W 24 --grout "PermaColor Select" --mortar ProLite`);
  process.exit(args.help ? 0 : 1);
}

// Settings: start from the app's defaults (same mergeSettings the app runs on
// load), then apply CLI overrides.
const s = mergeSettings({});
const wTile = args["waste-tile"] ?? args.waste;
const wFloor = args["waste-floor"] ?? args.waste;
if (wTile != null) s.waste.tile = Number(wTile);
if (wFloor != null) s.waste.floor = Number(wFloor);

const groutName = args.grout ?? "PermaColor Select";
if (!s.grouts[groutName]) s.grouts[groutName] = { coverage: 0, unit: "units", price: 0 };
if (args["grout-coverage"] != null) s.grouts[groutName].coverage = Number(args["grout-coverage"]);
if (args["grout-price"] != null) s.grouts[groutName].price = Number(args["grout-price"]);

const mortarName = args.mortar ?? "ProLite";
if (!s.mortars[mortarName]) s.mortars[mortarName] = { tier1: 0, tier2: 0, tier3: 0, unit: "units", price: 0 };
if (args["mortar-tiers"] != null) {
  const [t1, t2, t3] = args["mortar-tiers"].split(",").map(Number);
  Object.assign(s.mortars[mortarName], { tier1: t1, tier2: t2, tier3: t3 });
}
if (args["mortar-price"] != null) s.mortars[mortarName].price = Number(args["mortar-price"]);

// Product row: the minimal shape the catalog.js functions read. Mirrors what
// App.jsx's normP produces for these fields.
const p = {
  type: args.type ?? "tile",
  qtyType: "sqft",
  qty: args.sqft,
  L: args.L ?? "",
  W: args.W ?? "",
  thickness: args.thickness ?? "0.375",
  priceSqft: args["price-sqft"] ?? "",
  cartonSf: args["carton-sf"] ?? "",
  cartonUnit: args["carton-unit"] ?? "CT",
  cartonManual: "",
  grout: { checked: true, product: groutName, color: "", joint: args.joint ?? 0.125, manual: "" },
  mortar: { checked: true, product: mortarName, manual: "" },
  underlay: { checked: false, product: "", manual: "", install: false },
};

const fmt = (n) => (n == null ? "n/a" : Number(n.toFixed(4)));
const waste = wasteFor(p, s);
console.log(`inputs   type=${p.type} sqft=${p.qty} L=${p.L || "-"} W=${p.W || "-"} thickness=${p.thickness} joint=${p.grout.joint} waste=x${fmt(waste)}`);

const g = getGrout(p, s);
if (g) console.log(`grout    ${g.product}: exact=${fmt(groutExact(p, s))} order=${g.order} ${g.unit ?? ""} @ $${g.price} = $${fmt(g.order * g.price)}`);
else console.log(`grout    n/a (${p.type !== "tile" ? "not tile" : "needs sqft, L, W, thickness, joint, and a grout with coverage"})`);

const m = getMortar(p, s);
if (m) console.log(`mortar   ${m.product}: exact=${fmt(mortarExact(p, s))} order=${m.order} ${m.unit ?? ""} @ $${m.price} = $${fmt(m.order * m.price)} (tier by longest side ${Math.max(num(p.L), num(p.W))}")`);
else console.log(`mortar   n/a (${p.type !== "tile" ? "not tile" : "needs sqft, L, W, and a mortar with tier coverages"})`);

const c = getCarton(p, s);
if (c) {
  console.log(`carton   exact=${fmt(cartonExact(p, s))} order=${c.order} ${c.unit} x ${c.sf} sqft`);
  if (num(p.priceSqft)) console.log(`line     ${c.order} ${c.unit} x ${c.sf} sqft x $${num(p.priceSqft)}/sqft = $${fmt(c.order * c.sf * num(p.priceSqft))}`);
} else {
  console.log(`carton   n/a (no --carton-sf; sold by exact sqft)`);
  if (num(p.priceSqft)) console.log(`line     ${num(p.qty)} sqft x $${num(p.priceSqft)}/sqft = $${fmt(num(p.qty) * num(p.priceSqft))}`);
}
