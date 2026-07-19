import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHallmark, isHallmarkWood, parseTarkett, isTarkettLvt, parseOvf } from "./ovfbook.js";

// A compact slice of the real OVF Hallmark sheet exercising every quirk: the
// NEW/OLD header layout, a shared species price row, trim fan-out, a collection
// whose NAME contains a construction keyword ("Organic Solid"), a "SOLID —…"
// prose line that must NOT read as a banner, the single-Item# header layout, a
// "dropped" color, and an N/A-priced species sub-block.
const HALLMARK = [
  ["Prepared especially for KEIM LUMBER CO           @(70) (035360)"],
  ["Alta Vista Collection"],
  ["5/8\" x 7 1/2\" x RL- 74 3/4\" Handcrafted Bevel"],
  ["NEW: 27 SF/CT ~ 30 CT/PA ~ 59 LB/CT  - OLD: 23.31 SF/CT ~ 50 CT/PA ~ 50 LB/CT"],
  ["SPECIES / COLOR", "NEW ITEM #", "", "OLD ITEM #", "STAIR NOSING 82\"", "T-MOLD 82\"", "REDUCER 82\"", "THRESHOLD 82\""],
  ["EUROPEAN WHITE OAK", "$7.29", "", "$7.29", "$111.49", "$73.59", "$73.59", "$73.59"],
  ["Balboa", "AV75OBALC", "", "AV75OBAL", "AV75OBALSN", "AV75OBALTM", "AV75OBALRD", "AV75OBALTH"],
  ["Big Sur", "AV75OBIGC", "", "AV75OBIG", "AV75OBIGSN", "AV75OBIGTM", "AV75OBIGRD", "AV75OBIGTH"],
  ["Organic Solid Collection"],
  ["3/4\" x3 1/4\", 4\" x RL — 6' or 7' Hand Crafted Edge"],
  ["SOLID —NuOil Hybrid Oil Finishing System"],
  ["16.7 SF/CT ~ 55 CT/PA ~ 60 LB/CT"],
  ["SPECIES / COLOR", "ITEM #", "", "STAIR NOSING 82\"", "T-MOLD 82\"", "REDUCER 82\"", "THRESHOLD 82\"", "Touch Up Kits"],
  ["AMERICAN HICKORY", "$8.79", "", "$111.49", "$73.59", "$73.59", "$73.59", "$34.49"],
  ["Moroccan dropped", "SOR34MORH", "", "SOR34MORHSNR", "SOR34MORHTM", "SOR34MORHRD", "SOR34MORHTH", "KIT37"],
  ["OAK", "N/A", "", "N/A", "N/A", "N/A", "N/A", "N/A"],
  ["Bay Leaf *NEW*", "SOR34BAYO-25", "", "SOR34BAYOSN", "SOR34BAYOTM", "SOR34BAYORD", "SOR34BAYOTH"],
];

const parse = () => parseHallmark(HALLMARK);
const floors = (res) => res.rows.slice(1).filter((r) => r[9] !== "trim");
const trims = (res) => res.rows.slice(1).filter((r) => r[9] === "trim");
const bySku = (res, sku) => res.rows.find((r) => r[0] === sku);

test("detects the OVF Hallmark sheet", () => {
  assert.equal(isHallmarkWood([{ name: "Hallmark", rows: HALLMARK }]), true);
  assert.equal(isHallmarkWood([{ name: "x", rows: [["something else"]] }]), false);
});

test("emits one floor per color plus its trims", () => {
  const res = parse();
  // 4 colors (Balboa, Big Sur, Moroccan, Bay Leaf) as floors.
  assert.equal(floors(res).length, 4);
  // Balboa + Big Sur × 4 trims + Moroccan × 4 + Bay Leaf × 4 = 16 unique trim SKUs.
  assert.equal(trims(res).length, 16);
});

test("floor inherits the species price row and carton coverage", () => {
  const balboa = bySku(parse(), "AV75OBALC");
  assert.equal(balboa[2], "Alta Vista Collection"); // productLine / markup group
  assert.equal(balboa[5], "27");    // SF/Carton (NEW value, not the OLD 23.31)
  assert.equal(balboa[6], "7.29");  // cost = floor $/SF
  assert.equal(balboa[7], "SF");
  assert.equal(balboa[8], "hardwood");
  assert.match(balboa[4], /old #AV75OBAL/); // OLD item # kept as a search alias
});

test("trims fan out priced per piece and stamped with the parent floor", () => {
  const sn = bySku(parse(), "AV75OBALSN");
  assert.equal(sn[9], "trim");
  assert.equal(sn[6], "111.49");
  assert.equal(sn[7], "EA");
  assert.match(sn[1], /Stair Nose/);
  assert.match(sn[1], /fits AV75OBALC/);
});

test("a collection name containing a construction keyword still starts a collection", () => {
  const res = parse();
  const colls = new Set(floors(res).map((r) => r[2]));
  assert.ok(colls.has("Organic Solid Collection"), [...colls].join(","));
  // The "SOLID —NuOil …" prose line must NOT have become its own collection.
  assert.ok(![...colls].some((c) => /NuOil/.test(c)));
});

test("'dropped' flags the color and is stripped from the name; '*NEW*' is stripped", () => {
  const moroccan = bySku(parse(), "SOR34MORH");
  assert.match(moroccan[1], /Moroccan/);
  assert.doesNotMatch(moroccan[1], /dropped/i);
  assert.match(moroccan[4], /dropped/); // recorded in the note instead

  const bay = bySku(parse(), "SOR34BAYO-25");
  assert.match(bay[1], /Bay Leaf/);
  assert.doesNotMatch(bay[1], /\*NEW\*/);
});

test("an N/A species sub-block imports floors with no cost (honest, not dropped)", () => {
  const bay = bySku(parse(), "SOR34BAYO-25");
  assert.equal(bay[6], ""); // cost blank — the sheet says N/A
  assert.equal(bay[2], "Organic Solid Collection");
});

// --- Tarkett -----------------------------------------------------------------

// A compact slice of the real OVF "Tarkett LVT" sheet exercising: two size
// blocks in one collection, the "$…/SF" price row with per-piece molding
// prices, a FlexGen-style block with N/A moldings and floor-only rows, a
// ProGen-style sub-banner carrying its size prose in a far column, and an
// accessory table headed "Product" whose sell unit is Price/RL.
const TARKETT = [
  ["Prepared especially for KEIM LUMBER CO           @(70) (035360)"],
  ["Tarkett EverGen™", "", "", "", "", "Lifetime Residential Warranty\n10 Year Light Commercial Warranty"],
  ["20 mil Wear Layer  •  Pressed Bevel  •  Click"],
  ["Plank Size 7\" x 60\"  •  9 PC/CT  •  26.25 SF/CT  •  35 CT/PA  •  45.4 LB/CT"],
  ["Design", "Item #", "Quarter Round (94\")", "Slim Trim - P29 (94\")", "VersaEdge (94\")", "RSN (94\")", "Slim Cap - P29 (94\")"],
  ["$3.97/SF", "$104.15/CT", "$15.18/EA", "$41.67/EA", "$56.01/EA", "$69.16/EA", "$47.65/EA"],
  ["Endless Maple Bourbon", "270311021", "335013221", "335015221", "335016221", "335017221", "335018221"],
  ["Plank Size 9\" x 72\"  •  6 PC/CT  •  27 SF/CT  •  36 CT/PA  •  46.67 LB/CT"],
  ["Design", "Item #", "Quarter Round (94\")", "Slim Trim - P29 (94\")", "VersaEdge (94\")", "RSN (94\")", "Slim Cap - P29 (94\")"],
  ["$3.97/SF", "$107.13/CT", "$15.18/EA", "$41.67/EA", "$56.01/EA", "$69.16/EA", "$47.65/EA"],
  ["Enduring Crush", "270313101", "335013301", "335015301", "335016301", "335017301", "335018301"],
  ["Tarkett FlexGen™", "", "", "", "30 YR LIMITED Residential Warranty"],
  ["Plank Size 7\" x 48\"  •  10 PC/CT  •  23.33 SF/CT  •  60 CT/PA  •  41.2 LB/CT"],
  ["Design", "Item #", "Quarter Round (94\")", "Slim Trim - P29 (94\")", "VersaEdge (94\")", "RSN (94\")", "Slim Cap - P29 (94\")"],
  ["$2.64/SF", "$61.63/CT", "N/A/EA", "N/A/EA", "N/A/EA", "N/A/EA", "N/A/EA"],
  ["Countryside Oak Grain", "270314021"],
  ["Tarkett ProGen 9\" x 60\" Planks", "", "", "", "", "", "9\" x 60\" Planks  •  8 PC/CT  •  29.82 SF/CT  •  44 CT/PA"],
  ["Design/Color", "Item#", "Quarter Round (94\")", "Slim Trim - P29 (94\")", "VersaEdge (94\")", "RSN (94\")", "Slim Cap - P29 (94\")"],
  ["$2.83/SF", "$84.28/CT", "$15.18/EA", "$49.59/EA", "$56.01/EA", "$69.16/EA", "$47.65/EA"],
  ["Elmore XL Ridge", "270304001", "335013025", "335015025", "335016025", "335017025", "335018025"],
  ["Tarkett Residential Underlayment"],
  ["Product", "Item#", "", "", "Roll Size", "Price/SF", "Price/RL"],
  ["SureStart", "500033006", "", "", "3' x 33.3' (100 SF)", "0.714", "$71.40"],
];

const tkParse = () => parseTarkett(TARKETT);
const tkFloors = (res) => res.rows.slice(1).filter((r) => r[9] !== "trim" && r[8] === "vinyl");
const tkTrims = (res) => res.rows.slice(1).filter((r) => r[9] === "trim");

test("detects the OVF Tarkett LVT sheet, and the two detectors stay disjoint", () => {
  assert.equal(isTarkettLvt([{ name: "Tarkett LVT", rows: TARKETT }]), true);
  assert.equal(isTarkettLvt([{ name: "Hallmark", rows: HALLMARK }]), false);
  assert.equal(isHallmarkWood([{ name: "Tarkett LVT", rows: TARKETT }]), false);
});

test("parseOvf routes a workbook to its parser and skips a hidden reference tab", () => {
  // The real Tarkett file: the product sheet sits among hidden tabs and Terms.
  const file = [
    { name: "All", rows: [["Product", "DESIGN", "COLOR"], ["Transcend"]] },
    { name: "Tarkett LVT", rows: TARKETT },
    { name: "Terms of Sale", rows: [["TERMS & CONDITIONS OF SALE"]] },
  ];
  const res = parseOvf(file, "ovf-tarkett-home-lvt");
  assert.equal(res.name, "ovf-tarkett-home-lvt");
  assert.equal(res.meta.flooring, 4);
  assert.equal(parseOvf([{ name: "Hallmark", rows: HALLMARK }]).meta.flooring, 4);
  // A flat OVF sheet (Sika/Stauf carry the KEIM line but no banded grid) is NOT
  // claimed — it belongs to the generic mapped wizard.
  assert.equal(parseOvf([{ name: "DriTac", rows: [["Prepared especially for KEIM LUMBER CO"], ["Adhesive", "Size", "SF", "W", "Item #", "Price"]] }]), null);
});

test("each size block binds its own coverage; the collection is shared", () => {
  const res = tkParse();
  const bourbon = bySku(res, "270311021");
  const crush = bySku(res, "270313101");
  assert.equal(bourbon[4], '7" x 60"'); assert.equal(bourbon[5], "26.25");
  assert.equal(crush[4], '9" x 72"'); assert.equal(crush[5], "27");
  assert.equal(bourbon[2], "Tarkett EverGen"); // ™ stripped
  assert.equal(crush[2], "Tarkett EverGen");
  assert.equal(bourbon[6], "3.97"); assert.equal(bourbon[7], "SF");
  assert.equal(bourbon[8], "vinyl");
});

test("moldings fan out per design row, priced per piece, stamped with the floor", () => {
  const res = tkParse();
  const qr = bySku(res, "335013221");
  assert.equal(qr[9], "trim");
  assert.equal(qr[6], "15.18"); assert.equal(qr[7], "EA");
  assert.match(qr[1], /Quarter Round/);
  assert.match(qr[1], /fits 270311021/);
  assert.equal(tkTrims(res).length, 15); // 5 per priced design row × 3 (FlexGen has none)
});

test("a FlexGen-style block emits floor-only rows; N/A moldings price null", () => {
  const oak = bySku(tkParse(), "270314021");
  assert.equal(oak[6], "2.64");
  assert.equal(tkTrims(tkParse()).some((r) => /fits 270314021/.test(r[1])), false);
});

test("a ProGen sub-banner keeps the collection name and reads its far-column size prose", () => {
  const elmore = bySku(tkParse(), "270304001");
  assert.equal(elmore[2], "Tarkett ProGen"); // size half stripped from the banner
  assert.equal(elmore[4], '9" x 60"');
  assert.equal(elmore[5], "29.82");
  assert.equal(elmore[6], "2.83");
});

test("accessory tables import per their sell unit (Price/RL beats Price/SF)", () => {
  const roll = bySku(tkParse(), "500033006");
  assert.match(roll[1], /SureStart/);
  assert.match(roll[1], /3' x 33.3' \(100 SF\)/); // roll size folded into the name
  assert.equal(roll[6], "71.4");
  assert.equal(roll[7], "RL");
  assert.equal(roll[9], ""); // an accessory, not a trim
});

test("floor and trim counts survive the full fixture", () => {
  const res = tkParse();
  assert.equal(res.meta.flooring, 4);
  assert.equal(res.meta.accessories, 1);
  assert.equal(tkFloors(res).length, 4);
});
