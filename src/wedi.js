// wedi shower-system configurator — data module + pure engine (issue 066).
//
// HEAVY MODULE (ADR 0026): the two tables below are ~2 000 catalog rows. Only
// the lazy `WediConfigurator` chunk and these tests may import this file —
// never the boot chunk, never App.jsx, never a shared widget. The row search's
// pinned configurator entry imports `wediquery.js` instead (a few hundred bytes
// of word lists), which is the whole reason that module exists; wedi.js
// re-exports its four recognizer functions so a caller that already pays for
// the tables has one import.
//
// wedi is the opposite of Sheoga on both axes: every piece has a part number,
// and wedi publishes suggested retail while the shop buys at distributor net —
// so there is no markup knob here. Sell = book retail, cost = ERP/net, and the
// tiers are display lenses (ADR 0018), with the one wedi rule that Builder is
// retail × 0.82 rather than the flat 8% off.
//
// What replaces a description builder is a SYSTEM SOLVER: a shower is a pan +
// extensions + panels + curb + drain finish + consumables that all have to
// agree with each other. The install rules encoded below come from the wedi
// Technical Handbook and the Illustrated Price List 2026 — see
// .scratch/066_wedi-configurator/ticket.md, the design record.
//
// Prices are the Jan 1 2026 distribution pricelist and the shop's ERP export.
// The tables are GENERATED from WEDI_1.xlsx (ERP Vendor SKU Analysis) and
// USA_wedi_Distribution_Pricelist_JAN_1_2026.xlsx (wedi Fundo sheet):
// stock {erp, desc, cost, retail, unit, us}; so {us, name, size, details,
// retail, net, section, discount, erp} (+ {kitNote, section} rows).

import { queryHit, parseQuery, querySummary, seedFromQuery } from "./wediquery.js";

export { queryHit, parseQuery, querySummary, seedFromQuery };

const WEDI_STOCK = [
 {
  "erp": "1518658",
  "desc": "20oz Wedi Joint Sealant 620 Sausage US5000083",
  "cost": 25.13,
  "retail": 41.46,
  "unit": "EA",
  "us": "US5000083"
 },
 {
  "erp": "47832",
  "desc": "1000ct Wedi Metal Washer w/Tab - US5000009",
  "cost": 93.42,
  "retail": 154.14,
  "unit": "BX",
  "us": "US5000009"
 },
 {
  "erp": "47833",
  "desc": "1000ct Wedi Screw NonCorrosive - US5000012",
  "cost": 61.14,
  "retail": 100.89,
  "unit": "BX",
  "us": "US5000012"
 },
 {
  "erp": "47735",
  "desc": "10oz Wedi Joint Sealant - US5000013",
  "cost": 11.65,
  "retail": 19.22,
  "unit": "EA",
  "us": "US5000013"
 },
 {
  "erp": "47822",
  "desc": "Wedi Corner Putty Trowel - US5000044",
  "cost": 1.96,
  "retail": 3.23,
  "unit": "EA",
  "us": "US5000044"
 },
 {
  "erp": "47815",
  "desc": "5\"x82' Wedi Mesh Tape - Self-Adhesvie Fiberglass",
  "cost": 15.22,
  "retail": 25.11,
  "unit": "RL",
  "us": "095225053"
 },
 {
  "erp": "29646",
  "desc": "Wedi Sausage Gun - US5000019",
  "cost": 39.07,
  "retail": 64.46,
  "unit": "EA",
  "us": "US5000019"
 },
 {
  "erp": "29647",
  "desc": "20oz Wedi Sausage - US5000010",
  "cost": 17.47,
  "retail": 28.83,
  "unit": "EA",
  "us": "US5000010"
 },
 {
  "erp": "29648",
  "desc": "Wedi Sausage Gun Replace Tip - US5000020",
  "cost": 1.96,
  "retail": 3.24,
  "unit": "EA",
  "us": "US5000020"
 },
 {
  "erp": "26894",
  "desc": "Wedi Heavy Duty Drain Wrench - US5000032",
  "cost": 8.03,
  "retail": 12.85,
  "unit": "EA",
  "us": "US5000032"
 },
 {
  "erp": "26896",
  "desc": "Wedi Sealing Collar - For 1/2\" to 3/4\" Pipe",
  "cost": 7.5,
  "retail": 12.38,
  "unit": "EA",
  "us": "US5000033"
 },
 {
  "erp": "26897",
  "desc": "Wedi Mixing Valve Flexi Collar - US5000000 5\" Diameter",
  "cost": 8.38,
  "retail": 13.82,
  "unit": "EA",
  "us": "US5000000"
 },
 {
  "erp": "28952",
  "desc": "2\" Wedi Subliner Dry Drain - Bonding Flange Drain for PVC",
  "cost": 63.86,
  "retail": 141.91,
  "unit": "EA",
  "us": "US5000022"
 },
 {
  "erp": "28954",
  "desc": "39\"x98' Wedi Subliner Dry - US50000005 322 SF/RL",
  "cost": 299.41,
  "retail": 494.02,
  "unit": "EA",
  "us": "US50000005"
 },
 {
  "erp": "28955",
  "desc": "27\" Wedi Riolito SS - 676797048 Cover Plate",
  "cost": 87.93,
  "retail": 145.09,
  "unit": "EA",
  "us": "676797048"
 },
 {
  "erp": "28960",
  "desc": "Wedi Fastener Kit 100ct - US5000070 Washers & Screws",
  "cost": 19.9,
  "retail": 32.83,
  "unit": "EA",
  "us": "US5000070"
 },
 {
  "erp": "29999",
  "desc": "Wedi Tabless Washer Kit - US5000086 Washers & Screws",
  "cost": 22.33,
  "retail": 36.84,
  "unit": "EA",
  "us": "US5000086"
 },
 {
  "erp": "1509966",
  "desc": "Wedi Bucket US7000058",
  "cost": 5.61,
  "retail": 7,
  "unit": "EA",
  "us": "US7000058"
 },
 {
  "erp": "47730",
  "desc": "5' Wedi Curb Full Foam - US3000039",
  "cost": 62.02,
  "retail": 102.34,
  "unit": "EA",
  "us": "US3000039"
 },
 {
  "erp": "47729",
  "desc": "5' Wedi Curb Over - US3000008",
  "cost": 58.1,
  "retail": 95.86,
  "unit": "EA",
  "us": "US3000008"
 },
 {
  "erp": "47733",
  "desc": "5'x16\" Wedi Fundo Ramp - 073736517",
  "cost": 152.63,
  "retail": 251.84,
  "unit": "EA",
  "us": "073736517"
 },
 {
  "erp": "29244",
  "desc": "24\"x 48\" Wedi Pan Extension - 073783528 1-1/2\" to 2\" slope",
  "cost": 135.28,
  "retail": 223.21,
  "unit": "EA",
  "us": "073783528"
 },
 {
  "erp": "29541",
  "desc": "8' Wedi Curb Full Foam - US3000041",
  "cost": 91.79,
  "retail": 151.45,
  "unit": "EA",
  "us": "US3000041"
 },
 {
  "erp": "29266",
  "desc": "72\"x12\" Wedi Lean Extension - US3000036",
  "cost": 120.09,
  "retail": 198.15,
  "unit": "EA",
  "us": "US3000036"
 },
 {
  "erp": "29118",
  "desc": "5' Wedi Lean Full Foam Curb - US3000038",
  "cost": 32.73,
  "retail": 53.99,
  "unit": "EA",
  "us": "US3000038"
 },
 {
  "erp": "29145",
  "desc": "12\"x60\" Wedi Ligno Extension - US3000035",
  "cost": 114.86,
  "retail": 189.52,
  "unit": "EA",
  "us": "US3000035"
 },
 {
  "erp": "28795",
  "desc": "8' Wedi Lean Full Foam Curb - US3000040",
  "cost": 52.73,
  "retail": 86.99,
  "unit": "EA",
  "us": "US3000040"
 },
 {
  "erp": "28776",
  "desc": "5' Wedi Curb AT  - Integrated PVC Core Anchor",
  "cost": 84.49,
  "retail": 139.4,
  "unit": "EA",
  "us": "US3000048"
 },
 {
  "erp": "28777",
  "desc": "5' Wedi Curb AT Lean  - Integrated PVC Core Anchor",
  "cost": 62.51,
  "retail": 103.14,
  "unit": "EA",
  "us": "US3000049"
 },
 {
  "erp": "1508544",
  "desc": "Wedi Fundo Corner Extension - US3000053",
  "cost": 112.31,
  "retail": 185.3,
  "unit": "EA",
  "us": "US3000053"
 },
 {
  "erp": "1508545",
  "desc": "Wedi Curbless Corner Extension - US3000052",
  "cost": 107.38,
  "retail": 177.18,
  "unit": "EA",
  "us": "US3000052"
 },
 {
  "erp": "1518110",
  "desc": "4x4 Wedi Fundo Drain Cover Champagne US1000124",
  "cost": 90.09,
  "retail": 149,
  "unit": "EA",
  "us": "US1000124"
 },
 {
  "erp": "47725",
  "desc": "Wedi Standard Drain Kit - US1000003 Old Style",
  "cost": 52.2,
  "retail": 83.52,
  "unit": "EA",
  "us": "US1000003"
 },
 {
  "erp": "47812",
  "desc": "4x4 Wedi Oil Rubbed Bronze - US1000056",
  "cost": 90.3,
  "retail": 149,
  "unit": "EA",
  "us": "US1000056"
 },
 {
  "erp": "47814",
  "desc": "43\" Wedi Linear Stainless - US1000085 Cover Plate",
  "cost": 112.28,
  "retail": 185.26,
  "unit": "EA",
  "us": "US1000085"
 },
 {
  "erp": "47721",
  "desc": "43\" Wedi Linear Tileable Cover - US1000087",
  "cost": 122,
  "retail": 201.3,
  "unit": "EA",
  "us": "US1000087"
 },
 {
  "erp": "29480",
  "desc": "Wedi Brass Fundo Drain Kit - US1000004 Old Style",
  "cost": 53.55,
  "retail": 85.68,
  "unit": "EA",
  "us": "US1000004"
 },
 {
  "erp": "29644",
  "desc": "Wedi Glue In Drain - Assembly Strainer and Collar",
  "cost": 45,
  "retail": 72,
  "unit": "EA",
  "us": "US1000035"
 },
 {
  "erp": "28872",
  "desc": "Wedi Curbless Recess Kit - US5000085 Installation Kit",
  "cost": 307.88,
  "retail": 508,
  "unit": "EA",
  "us": "US5000085"
 },
 {
  "erp": "28873",
  "desc": "28\" Wedi Linear Channel Frame - 676800061 -Stainless",
  "cost": 99.04,
  "retail": 163.41,
  "unit": "EA",
  "us": "676800061"
 },
 {
  "erp": "28874",
  "desc": "43\" Wedi Linear Channel Frame - 676800064 -Stainless",
  "cost": 101.08,
  "retail": 166.77,
  "unit": "EA",
  "us": "676800064"
 },
 {
  "erp": "28875",
  "desc": "Wedi Tub Sealing Tape - w/Waterproof Butyl Strip",
  "cost": 29.99,
  "retail": 49.49,
  "unit": "RL",
  "us": "US5000084"
 },
 {
  "erp": "28796",
  "desc": "3/8\" Wedi Tileable Cover - US1000047",
  "cost": 68.41,
  "retail": 112.87,
  "unit": "EA",
  "us": "US1000047"
 },
 {
  "erp": "28772",
  "desc": "4x4 Wedi Gold Cover - US1000055",
  "cost": 90.31,
  "retail": 149,
  "unit": "EA",
  "us": "US1000055"
 },
 {
  "erp": "28773",
  "desc": "4x4 Wedi Chrome Cover - US1000054",
  "cost": 90.31,
  "retail": 149,
  "unit": "EA",
  "us": "US1000054"
 },
 {
  "erp": "28774",
  "desc": "4x4 Wedi Matte Black Cover - US1000058",
  "cost": 81.17,
  "retail": 133.93,
  "unit": "EA",
  "us": "US1000058"
 },
 {
  "erp": "28775",
  "desc": "Wedi Fundo Slotted Drain  - 4\"x4\" Square Stainless",
  "cost": 101.08,
  "retail": 166.77,
  "unit": "EA",
  "us": "US1000053"
 },
 {
  "erp": "1504181",
  "desc": "4x4 Wedi Stainless Steel Cover - US1000057",
  "cost": 40.79,
  "retail": 67.3,
  "unit": "EA",
  "us": "US1000057"
 },
 {
  "erp": "1504182",
  "desc": "1/4\" Wedi Tileable Cover - US1000060",
  "cost": 68.41,
  "retail": 112.87,
  "unit": "EA",
  "us": "US1000060"
 },
 {
  "erp": "1504183",
  "desc": "27\" Wedi Linear Tileable Cover - US1000086 Cover Plate",
  "cost": 97.63,
  "retail": 161.09,
  "unit": "EA",
  "us": "US1000086"
 },
 {
  "erp": "1504184",
  "desc": "27\" Wedi Linear Matte Black - US1000082 Cover Plate",
  "cost": 146.5,
  "retail": 241.73,
  "unit": "EA",
  "us": "US1000082"
 },
 {
  "erp": "1504185",
  "desc": "43\" Wedi Linear Matte Black - US1000083 Cover Plate",
  "cost": 171.01,
  "retail": 282.16,
  "unit": "EA",
  "us": "US1000083"
 },
 {
  "erp": "1509466",
  "desc": "Wedi Riolito Neo Channel Frame - US1000088 -28\" Drain- MB",
  "cost": 134.25,
  "retail": 221.52,
  "unit": "EA",
  "us": "US1000088"
 },
 {
  "erp": "1509467",
  "desc": "Wedi Riolito Neo Channel Frame - US1000089 -43.75\" Drain- MB",
  "cost": 146.5,
  "retail": 241.73,
  "unit": "EA",
  "us": "US1000089"
 },
 {
  "erp": "1514588",
  "desc": "4x4 Wedi Brass Cover - US1000062",
  "cost": 90.31,
  "retail": 149,
  "unit": "EA",
  "us": "US1000062"
 },
 {
  "erp": "29356",
  "desc": "16x12\" Wedi Niche - US3000004",
  "cost": 44.56,
  "retail": 73.53,
  "unit": "EA",
  "us": "US3000004"
 },
 {
  "erp": "47731",
  "desc": "16x16\" Wedi Niche - US3000005",
  "cost": 46,
  "retail": 75.89,
  "unit": "EA",
  "us": "US3000005"
 },
 {
  "erp": "47732",
  "desc": "16x22\" Wedi Niche - US3000007",
  "cost": 57.64,
  "retail": 95.11,
  "unit": "EA",
  "us": "US3000007"
 },
 {
  "erp": "29410",
  "desc": "16x42\" Wedi Niche - US3000024",
  "cost": 103.3,
  "retail": 170.43,
  "unit": "EA",
  "us": "US3000024"
 },
 {
  "erp": "29380",
  "desc": "16x8\" Wedi Niche - US3000003",
  "cost": 44.56,
  "retail": 73.53,
  "unit": "EA",
  "us": "US3000003"
 },
 {
  "erp": "29970",
  "desc": "16\"x30\" Wedi Cathedral Niche - US3000016",
  "cost": 66.07,
  "retail": 109.02,
  "unit": "EA",
  "us": "US3000016"
 },
 {
  "erp": "1503638",
  "desc": "12\" Wedi Glass Niche Shelf - US3000050",
  "cost": 22.46,
  "retail": 37.06,
  "unit": "EA",
  "us": "US3000050"
 },
 {
  "erp": "1504186",
  "desc": "16\"x28\" Wedi Niche - US3000248",
  "cost": 73.65,
  "retail": 121.52,
  "unit": "EA",
  "us": "US3000248"
 },
 {
  "erp": "1510308",
  "desc": "16x32\" Wedi Niche - US3000051",
  "cost": 76.02,
  "retail": 125.42,
  "unit": "EA",
  "us": "US3000051"
 },
 {
  "erp": "47700",
  "desc": "3'x5'x1/2\" Wedi Building Panel - US8000017",
  "cost": 33.13,
  "retail": 54.66,
  "unit": "EA",
  "us": "US8000017"
 },
 {
  "erp": "47828",
  "desc": "4'x8'x1/2\" Wedi Building Panel - US8000015",
  "cost": 71.36,
  "retail": 117.75,
  "unit": "EA",
  "us": "US8000015"
 },
 {
  "erp": "29952",
  "desc": "1/8\"x2'x4' Wedi Building Panel - US8000006",
  "cost": 21.22,
  "retail": 35.01,
  "unit": "EA",
  "us": "US8000006"
 },
 {
  "erp": "26895",
  "desc": "4'x8'x2\" Wedi Building Panel - US8000016",
  "cost": 128.41,
  "retail": 211.88,
  "unit": "EA",
  "us": "US8000016"
 },
 {
  "erp": "28862",
  "desc": "4'x5'x1/2\" Wedi Building Panel - US8000014",
  "cost": 44.09,
  "retail": 72.74,
  "unit": "EA",
  "us": "US8000014"
 },
 {
  "erp": "28864",
  "desc": "4'x5'x1/4\" Wedi Building Panel - US8000013",
  "cost": 46.21,
  "retail": 76.25,
  "unit": "EA",
  "us": "US8000013"
 },
 {
  "erp": "1002845",
  "desc": "4'x5'x2\" Wedi Building Panel - US8000020",
  "cost": 77.47,
  "retail": 127.83,
  "unit": "EA",
  "us": "US8000020"
 },
 {
  "erp": "1508540",
  "desc": "4x8 Wedi Vapor 85 - Vaporproof Building Panel",
  "cost": 134.46,
  "retail": 221.86,
  "unit": "EA",
  "us": "US8000026"
 },
 {
  "erp": "1508546",
  "desc": "1\"x4'x5' Wedi Building Panel - US8000022",
  "cost": 61.29,
  "retail": 101.12,
  "unit": "EA",
  "us": "US8000022"
 },
 {
  "erp": "29073",
  "desc": "32\"x5-3/4\" Wedi Riolito Neo - Drain Channel 27-1/2\"",
  "cost": 169.2,
  "retail": 270.72,
  "unit": "EA",
  "us": "075100052"
 },
 {
  "erp": "29075",
  "desc": "32\" Wedi Linear Neo Extension - US9330001",
  "cost": 301.05,
  "retail": 407.32,
  "unit": "EA",
  "us": "US9330001"
 },
 {
  "erp": "29076",
  "desc": "48\" Wedi Linear Neo Extension - US9330002",
  "cost": 404.1,
  "retail": 546.75,
  "unit": "EA",
  "us": "US9330002"
 },
 {
  "erp": "1504153",
  "desc": "3'x3' Wedi Fundo Pan - US9100001 CS Center Drain",
  "cost": 229.21,
  "retail": 378.19,
  "unit": "EA",
  "us": "US9100001"
 },
 {
  "erp": "1504154",
  "desc": "3'x4' Wedi Fundo Pan - US9100002 CS Center Drain",
  "cost": 305.78,
  "retail": 504.53,
  "unit": "EA",
  "us": "US9100002"
 },
 {
  "erp": "1504155",
  "desc": "4'x4' Wedi Fundo Pan - US9100003 CS Center Drain",
  "cost": 407.36,
  "retail": 672.14,
  "unit": "EA",
  "us": "US9100003"
 },
 {
  "erp": "1504156",
  "desc": "3'x5' Wedi Fundo Pan - US9100004 CS Center Drain",
  "cost": 343.04,
  "retail": 566.01,
  "unit": "EA",
  "us": "US9100004"
 },
 {
  "erp": "1504157",
  "desc": "3'x6' Wedi Fundo Pan - US9100005 CS Offset Drain",
  "cost": 439.52,
  "retail": 725.2,
  "unit": "EA",
  "us": "US9100005"
 },
 {
  "erp": "1504158",
  "desc": "3'x6' Wedi Fundo Pan - US9100006 CS Center Drain",
  "cost": 439.52,
  "retail": 725.2,
  "unit": "EA",
  "us": "US9100006"
 },
 {
  "erp": "1504159",
  "desc": "3.5'x3.5' Wedi Fundo Pan - US9100017 CS Center Drain",
  "cost": 299.14,
  "retail": 493.58,
  "unit": "EA",
  "us": "US9100017"
 },
 {
  "erp": "1504160",
  "desc": "3.5'x5' Wedi Fundo Pan - US9100007 CS Center Drain",
  "cost": 427.27,
  "retail": 704.99,
  "unit": "EA",
  "us": "US9100007"
 },
 {
  "erp": "1504161",
  "desc": "3.5'x6' Wedi Fundo Pan - US9100008 CS Center Drain",
  "cost": 509.96,
  "retail": 841.43,
  "unit": "EA",
  "us": "US9100008"
 },
 {
  "erp": "1504162",
  "desc": "4'x5' Wedi Fundo Pan - US9100009 CS Center Drain",
  "cost": 488.52,
  "retail": 806.06,
  "unit": "EA",
  "us": "US9100009"
 },
 {
  "erp": "1504163",
  "desc": "4'x6' Wedi Fundo Pan - US9100010 CS Center Drain",
  "cost": 586.02,
  "retail": 966.93,
  "unit": "EA",
  "us": "US9100010"
 },
 {
  "erp": "1504164",
  "desc": "5'x5' Wedi Fundo Pan - US9100011 CS Center Drain",
  "cost": 610.52,
  "retail": 1007.36,
  "unit": "EA",
  "us": "US9100011"
 },
 {
  "erp": "1504165",
  "desc": "5'x6' Wedi Fundo Pan - US9100012 CS Center Drain",
  "cost": 732.53,
  "retail": 1208.67,
  "unit": "EA",
  "us": "US9100012"
 },
 {
  "erp": "1504166",
  "desc": "5'x6' Wedi Primo Pan CS Corner/Offset Drain US9100013",
  "cost": 732.53,
  "retail": 1208.67,
  "unit": "EA",
  "us": "US9100013"
 },
 {
  "erp": "1504167",
  "desc": "4'x7' Wedi Fundo Pan - US9100014 CS Center Drain",
  "cost": 683.52,
  "retail": 1127.81,
  "unit": "EA",
  "us": "US9100014"
 },
 {
  "erp": "1504168",
  "desc": "5'x7' Wedi Fundo Pan - US9100015 CS Center Drain",
  "cost": 854.53,
  "retail": 1409.97,
  "unit": "EA",
  "us": "US9100015"
 },
 {
  "erp": "1504169",
  "desc": "6'x6' Wedi Fundo Pan - US9100016 CS Center Drain",
  "cost": 879.03,
  "retail": 1450.4,
  "unit": "EA",
  "us": "US9100016"
 },
 {
  "erp": "1504170",
  "desc": "3'x4' Wedi Curbless Pan - US9200001 CS Center Drain",
  "cost": 363.46,
  "retail": 599.7,
  "unit": "EA",
  "us": "US9200001"
 },
 {
  "erp": "1504171",
  "desc": "3.5'x3.5' Wedi Curbless Pan - US9200006 CS Center Drain",
  "cost": 371.12,
  "retail": 612.34,
  "unit": "EA",
  "us": "US9200006"
 },
 {
  "erp": "1504172",
  "desc": "4'x4' Wedi Curbless Pan - US9200002 CS Center Drain",
  "cost": 484.44,
  "retail": 799.32,
  "unit": "EA",
  "us": "US9200002"
 },
 {
  "erp": "1504173",
  "desc": "3'x5' Wedi Curbless Pan - US9200003 CS Center Drain",
  "cost": 433.9,
  "retail": 715.94,
  "unit": "EA",
  "us": "US9200003"
 },
 {
  "erp": "1504174",
  "desc": "4'x5' Wedi Curbless Pan - US9200004 CS Center Drain",
  "cost": 606.44,
  "retail": 1000.62,
  "unit": "EA",
  "us": "US9200004"
 },
 {
  "erp": "1504175",
  "desc": "5'x5' Wedi Curbless Pan - US9200005 CS Center Drain",
  "cost": 758.05,
  "retail": 1250.78,
  "unit": "EA",
  "us": "US9200005"
 },
 {
  "erp": "1504176",
  "desc": "3'x5' Wedi Linear Pan - US9310001 CS 4 Sided Slope",
  "cost": 454.32,
  "retail": 749.63,
  "unit": "EA",
  "us": "US9310001"
 },
 {
  "erp": "1504177",
  "desc": "4'x5' Wedi Linear Pan - US9310002 CS 4 Sided Slope",
  "cost": 606.95,
  "retail": 1001.47,
  "unit": "EA",
  "us": "US9310002"
 },
 {
  "erp": "1504178",
  "desc": "4'x6' Wedi Linear Pan - US9310003 CS 4 Sided Slope",
  "cost": 728.44,
  "retail": 1201.93,
  "unit": "EA",
  "us": "US9310003"
 },
 {
  "erp": "1504179",
  "desc": "32\" x 5-3/4\" Wedi Riolito Neo - CS Drain Channel 27-1/2\"",
  "cost": 183.26,
  "retail": 302.38,
  "unit": "EA",
  "us": "US9320001"
 },
 {
  "erp": "1504180",
  "desc": "48\" x 5-3/4\" Wedi Riolito Neo - CS Drain Channel 43-5/16\"",
  "cost": 229.2,
  "retail": 378.18,
  "unit": "EA",
  "us": "US9320002"
 },
 {
  "erp": "1508541",
  "desc": "4'x6' Wedi Curbless Pan - US9200008 CS Center Drain",
  "cost": 727.42,
  "retail": 1200.24,
  "unit": "EA",
  "us": "US9200008"
 },
 {
  "erp": "1508542",
  "desc": "5'x6' Wedi Curbless Pan - US9200009 CS Center Drain",
  "cost": 909.66,
  "retail": 1500.93,
  "unit": "EA",
  "us": "US9200009"
 },
 {
  "erp": "1508543",
  "desc": "6'x6' Wedi Curbless Pan - US9200010 CS Center Drain",
  "cost": 1091.39,
  "retail": 1800.78,
  "unit": "EA",
  "us": "US9200010"
 },
 {
  "erp": "1512228",
  "desc": "3'x5' Wedi Curbless Pan - US9200007 Offset Drain",
  "cost": 433.9,
  "retail": 715.94,
  "unit": "EA",
  "us": "US9200007"
 },
 {
  "erp": "1518089",
  "desc": "Wedi S-Dry 90° Inside Corner 2 per/bg US5076002",
  "cost": 7.8,
  "retail": 16.25,
  "unit": "BG",
  "us": "US5076002"
 },
 {
  "erp": "1518107",
  "desc": "Wedi S-Dry Fundo Drain Cover Support US9476016",
  "cost": 9.6,
  "retail": 20,
  "unit": "EA",
  "us": "US9476016"
 },
 {
  "erp": "1518106",
  "desc": "Wedi S-Dry Drain Parts Replacement Kit US9476012",
  "cost": 11.76,
  "retail": 24.5,
  "unit": "EA",
  "us": "US9476012"
 },
 {
  "erp": "1518109",
  "desc": "25# Wedi Pro-Set US5076012",
  "cost": 12.76,
  "retail": 22,
  "unit": "BG",
  "us": "US5076012"
 },
 {
  "erp": "1518075",
  "desc": "38x64 Wedi S-DRY Shower Base US9176001",
  "cost": 84,
  "retail": 175,
  "unit": "EA",
  "us": "US9176001"
 },
 {
  "erp": "1518076",
  "desc": "38x64 Wedi S-DRY Offset Shower Base US9176002",
  "cost": 84,
  "retail": 175,
  "unit": "EA",
  "us": "US9176002"
 },
 {
  "erp": "1518077",
  "desc": "48x72 Wedi S-Dry Shower Base US9176003",
  "cost": 124.8,
  "retail": 260,
  "unit": "EA",
  "us": "US9176003"
 },
 {
  "erp": "1518078",
  "desc": "72x72 Wedi S-Dry Shower Base US9176004",
  "cost": 162.72,
  "retail": 339,
  "unit": "EA",
  "us": "US9176004"
 },
 {
  "erp": "1518079",
  "desc": "Wedi S-Dry Bonding Flange Drain US9476006",
  "cost": 23.52,
  "retail": 49,
  "unit": "EA",
  "us": "US9476006"
 },
 {
  "erp": "1518080",
  "desc": "Wedi S-Dry Stainless Steel Drain Cover US1076002",
  "cost": 28.32,
  "retail": 59,
  "unit": "EA",
  "us": "US1076002"
 },
 {
  "erp": "1518081",
  "desc": "Wedi S-Dry Chrome Drain Cover US1076006",
  "cost": 47.52,
  "retail": 99,
  "unit": "EA",
  "us": "US1076006"
 },
 {
  "erp": "1518082",
  "desc": "Wedi S-Dry Oil Rubbed Bronze Drain Cover US1076006",
  "cost": 47.52,
  "retail": 99,
  "unit": "EA",
  "us": "US1076001"
 },
 {
  "erp": "1518083",
  "desc": "Wedi S-Dry Matte Black Drain Cover US1076003",
  "cost": 47.52,
  "retail": 99,
  "unit": "EA",
  "us": "US1076003"
 },
 {
  "erp": "1518084",
  "desc": "Wedi S-Dry Gold Drain Cover US1076005",
  "cost": 47.52,
  "retail": 99,
  "unit": "EA",
  "us": "US1076005"
 },
 {
  "erp": "1518085",
  "desc": "Wedi S-Dry Brass Drain Cover US1076007",
  "cost": 47.52,
  "retail": 99,
  "unit": "EA",
  "us": "US1076007"
 },
 {
  "erp": "1518086",
  "desc": "Wedi S-Dry Tileable Drain Cover US1076004",
  "cost": 29.76,
  "retail": 62,
  "unit": "EA",
  "us": "US1076004"
 },
 {
  "erp": "1518087",
  "desc": "72\" Wedi S-Dry Curb Full US3076001",
  "cost": 47.52,
  "retail": 99,
  "unit": "EA",
  "us": "US3076001"
 },
 {
  "erp": "1518088",
  "desc": "72\" Wedi S-Dry Curb Lean US3076002",
  "cost": 42.72,
  "retail": 89,
  "unit": "EA",
  "us": "US3076002"
 },
 {
  "erp": "1518108",
  "desc": "Wedi S-Dry Height Adjustment Kit US9476011",
  "cost": 7.32,
  "retail": 15.26,
  "unit": "EA",
  "us": "US9476011"
 },
 {
  "erp": "1518090",
  "desc": "Wedi S-Dry 135° Inside Corner 2 per/bg US5076001",
  "cost": 8.16,
  "retail": 17,
  "unit": "BG",
  "us": "US5076001"
 },
 {
  "erp": "1518091",
  "desc": "Wedi S-Dry 90° Outside Corner 2 per/bg US5076005",
  "cost": 7.8,
  "retail": 16.25,
  "unit": "BG",
  "us": "US5076005"
 },
 {
  "erp": "1518092",
  "desc": "Wedi S-Dry 135° Outside Corner 2 per/bg US5076004",
  "cost": 8.16,
  "retail": 17,
  "unit": "BG",
  "us": "US5076004"
 },
 {
  "erp": "1518093",
  "desc": "Wedi S-Dry Mixing Valve Collar US5076003",
  "cost": 6.84,
  "retail": 14.25,
  "unit": "EA",
  "us": "US5076003"
 },
 {
  "erp": "1518094",
  "desc": "Wedi S-Dry Shower Pipe Collar US5076006",
  "cost": 5.04,
  "retail": 10.5,
  "unit": "EA",
  "us": "US5076006"
 },
 {
  "erp": "1518095",
  "desc": "5\"x32' Wedi S-Dry Tape US5076007",
  "cost": 19.15,
  "retail": 39.8,
  "unit": "RL",
  "us": "US5076007"
 },
 {
  "erp": "1518096",
  "desc": "50\"x25' Wedi S-Dry Membrane 104sf US5076009",
  "cost": 99.84,
  "retail": 208,
  "unit": "RL",
  "us": "US5076009"
 },
 {
  "erp": "1518097",
  "desc": "80\"x16' Wedi S-Dry XL Membrane 106sf US5076008",
  "cost": 90.72,
  "retail": 189,
  "unit": "RL",
  "us": "US5076008"
 },
 {
  "erp": "1518098",
  "desc": "Wedi S-Dry Seal US5076011",
  "cost": 23.52,
  "retail": 49,
  "unit": "EA",
  "us": "US5076011"
 },
 {
  "erp": "1518099",
  "desc": "3/16\"x5/32\" Wedi S-Dry Seal Trowel US5076010",
  "cost": 1.92,
  "retail": 4,
  "unit": "EA",
  "us": "US5076010"
 },
 {
  "erp": "1518100",
  "desc": "38x64 Wedi S-Dry Shower Kit US2076001",
  "cost": 277.92,
  "retail": 579,
  "unit": "EA",
  "us": "US2076001"
 },
 {
  "erp": "1518101",
  "desc": "38x64 Offset Wedi S-Dry Shower Kit US2076002",
  "cost": 277.92,
  "retail": 579,
  "unit": "EA",
  "us": "US2076002"
 },
 {
  "erp": "1518102",
  "desc": "24x48 Wedi S-Dry Extension US3076003",
  "cost": 52.8,
  "retail": 110,
  "unit": "EA",
  "us": "US3076003"
 },
 {
  "erp": "1518103",
  "desc": "Wedi S-Dry Drain Cover Stainless Steel US1076008",
  "cost": 32.16,
  "retail": 67,
  "unit": "EA",
  "us": "US1076008"
 },
 {
  "erp": "1518104",
  "desc": "Wedi S-Dry Mini Shower Base Sample US7076001",
  "cost": 0,
  "retail": 100,
  "unit": "EA",
  "us": "US7076001"
 },
 {
  "erp": "1518105",
  "desc": "Wedi S-Dry Sample US7076002",
  "cost": 0,
  "retail": 100,
  "unit": "EA",
  "us": "US7076002"
 },
 {
  "erp": "47824",
  "desc": "24\" Wedi Large Corner Seat - US3000002",
  "cost": 134.53,
  "retail": 221.97,
  "unit": "EA",
  "us": "US3000002"
 },
 {
  "erp": "26889",
  "desc": "47x18x15 Wedi Sanoasa Bench  - Shower Bench 1L Straight",
  "cost": 445.64,
  "retail": 735.31,
  "unit": "EA",
  "us": "US3000043"
 },
 {
  "erp": "1511321",
  "desc": "19\" Wedi Medium Corner Seat - US3000001",
  "cost": 119.65,
  "retail": 197.41,
  "unit": "EA",
  "us": "US3000001"
 },
 {
  "erp": "29264",
  "desc": "Wedi Subliner Dry Sealing Tape - Inside Corner 2 Pcs Per Bag",
  "cost": 9,
  "retail": 14.85,
  "unit": "BG",
  "us": "US5000007"
 },
 {
  "erp": "29265",
  "desc": "Wedi Subliner Dry Sealing Tape - Outside Corner 2 Pcs Per Bag",
  "cost": 9,
  "retail": 14.85,
  "unit": "BG",
  "us": "US5000008"
 },
 {
  "erp": "29542",
  "desc": "39\"x16' Wedi Subliner Dry Mat - US5000001 53 sf",
  "cost": 55.99,
  "retail": 92.37,
  "unit": "RL",
  "us": "US5000001"
 },
 {
  "erp": "29543",
  "desc": "5\"x32.8' Subliner Sealing Tape - US5000002",
  "cost": 25.5,
  "retail": 42.07,
  "unit": "RL",
  "us": "US5000002"
 },
 {
  "erp": "28790",
  "desc": "3\"x3\" Wedi Vapor 85 Patch Kit - Fastener Patch Kit 100pcs/bg",
  "cost": 12.13,
  "retail": 20,
  "unit": "BG",
  "us": "US5000089"
 }
];

const WEDI_SO = [
 {
  "us": "US8000006",
  "name": "wedi® Building Panel 24\"x48\"x1/8\"",
  "size": "Waterproof Tile Backer Board",
  "details": "10 sheets/box",
  "retail": 35.01,
  "net": 21.22,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "29952"
 },
 {
  "us": "US8000032",
  "name": "wedi® Building Panel 32\"x48\"x1/2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "5 sheets/box",
  "retail": 38.33,
  "net": 23.23,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US8000013",
  "name": "wedi® Building Panel 48\"x60\"x1/4\"",
  "size": "Waterproof Tile Backer Board",
  "details": "25 sheets/pallet",
  "retail": 76.24,
  "net": 46.21,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "28864"
 },
 {
  "us": "US8000017",
  "name": "wedi® Building Panel 36\"x60\"x1/2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "50 sheets/pallet",
  "retail": 54.66,
  "net": 33.13,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "47700"
 },
 {
  "us": "US8000014",
  "name": "wedi® Building Panel 48\"x60\"x1/2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "50 sheets/pallet",
  "retail": 72.73,
  "net": 44.08,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "28862"
 },
 {
  "us": "US8000011",
  "name": "wedi® Building Panel 48\"x60\"x5/8\"",
  "size": "Waterproof Tile Backer Board",
  "details": "4 sheets/box",
  "retail": 86.5,
  "net": 52.42,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US8000021",
  "name": "wedi® Building Panel 48\"x60\"x5/8\"",
  "size": "Waterproof Tile Backer Board",
  "details": "50 sheets/pallet",
  "retail": 86.5,
  "net": 52.42,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US8000018",
  "name": "wedi® Building Panel 48\"x60\"x3/4\"",
  "size": "Waterproof Tile Backer Board",
  "details": "4 sheets/box",
  "retail": 92.11,
  "net": 55.83,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US8000022",
  "name": "wedi® Building Panel 48\"x60\"x1\"",
  "size": "Waterproof Tile Backer Board",
  "details": "4 sheets/box",
  "retail": 101.12,
  "net": 61.28,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "1508546"
 },
 {
  "us": "US8000019",
  "name": "wedi® Building Panel 48\"x60\"x1 1/2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "2 sheets/box",
  "retail": 118.05,
  "net": 71.55,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US8000020",
  "name": "wedi® Building Panel 48\"x60\"x2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "2 sheets/box",
  "retail": 127.82,
  "net": 77.47,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "1002845"
 },
 {
  "us": "US8000010",
  "name": "wedi® Building Panel 48\"x96\"x1/2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "4 sheets/box",
  "retail": 120.37,
  "net": 72.95,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US8000015",
  "name": "wedi® Building Panel 48\"x96\"x1/2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "50 sheets/pallet",
  "retail": 117.74,
  "net": 71.36,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": "47828"
 },
 {
  "us": "US8000016",
  "name": "wedi® Building Panel 48\"x96\"x2\"",
  "size": "Waterproof Tile Backer Board",
  "details": "12 sheets/pallet",
  "retail": 211.88,
  "net": 128.41,
  "section": "WEDI BUILDING PANELS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US4000001",
  "name": "wedi® Tub & Shower Wall Kit",
  "size": "5 sheets 36 in. x 60 in. x 1/2 in.",
  "details": "For 3x5 ft Tub to Tiled Shower Conversions",
  "retail": 479.49,
  "net": 290.6,
  "section": "WEDI UNDERLAYMENT & TUB SURROUND KITS - prepackaged in box with installation accessories",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US4000002",
  "name": "wedi® Flooring Panel Kit",
  "size": "5 sheets 24 in. x 48 in. x 1/4 in.",
  "details": "40 sqft Tile Underlayment Kit for waterproof flooring installations",
  "retail": 192.44,
  "net": 116.63,
  "section": "WEDI UNDERLAYMENT & TUB SURROUND KITS - prepackaged in box with installation accessories",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US8000026",
  "name": "wedi® Vapor 85 48\"x96\"x1/2\"",
  "size": "Vaporproof Tile Backer Board",
  "details": "minimum 12 sheets/ 50 ct. pallet",
  "retail": 221.85,
  "net": 134.46,
  "section": "WEDI VAPOR 85 - Building Panel for Steam Rooms/Showers",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US5000089",
  "name": "wedi® Vapor 85 Fastener Patch Kit",
  "size": "3 in. x 3 in. squares",
  "details": "100 pieces/bag",
  "retail": 20,
  "net": 12.12,
  "section": "WEDI VAPOR 85 - Building Panel for Steam Rooms/Showers",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US9100001",
  "name": "wedi Fundo® Shower Base",
  "size": "36 in. x 36 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 378.18,
  "net": 229.2,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504153"
 },
 {
  "us": "US9100002",
  "name": "wedi Fundo® Shower Base",
  "size": "36 in. x 48 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 504.52,
  "net": 305.77,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504154"
 },
 {
  "us": "US9100003",
  "name": "wedi Fundo® Shower Base",
  "size": "48 in. x 48 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 672.13,
  "net": 407.35,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504155"
 },
 {
  "us": "US9100004",
  "name": "wedi Fundo® Shower Base",
  "size": "36 in. x 60 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 566.01,
  "net": 343.03,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504156"
 },
 {
  "us": "US9100005",
  "name": "wedi Fundo® Shower Base",
  "size": "36 in. x 72 in. x 2 in.",
  "details": "Offset Drain",
  "retail": 725.2,
  "net": 439.51,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504157"
 },
 {
  "us": "US9100006",
  "name": "wedi Fundo® Shower Base",
  "size": "36 in. x 72 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 725.2,
  "net": 439.51,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504158"
 },
 {
  "us": "US9100017",
  "name": "wedi Fundo® Shower Base",
  "size": "42 in. x 42 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 493.57,
  "net": 299.13,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504159"
 },
 {
  "us": "US9100007",
  "name": "wedi Fundo® Shower Base",
  "size": "42 in. x 60 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 704.98,
  "net": 427.26,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504160"
 },
 {
  "us": "US9100008",
  "name": "wedi Fundo® Shower Base",
  "size": "42 in. x 72 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 841.43,
  "net": 509.96,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504161"
 },
 {
  "us": "US9100009",
  "name": "wedi Fundo® Shower Base",
  "size": "48 in. x 60 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 806.05,
  "net": 488.52,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504162"
 },
 {
  "us": "US9100010",
  "name": "wedi Fundo® Shower Base",
  "size": "48 in. x 72 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 966.93,
  "net": 586.02,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504163"
 },
 {
  "us": "US9100011",
  "name": "wedi Fundo® Shower Base",
  "size": "60 in. x 60 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 1007.36,
  "net": 610.52,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504164"
 },
 {
  "us": "US9100012",
  "name": "wedi Fundo® Shower Base",
  "size": "60 in. x 72 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 1208.66,
  "net": 732.52,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504165"
 },
 {
  "us": "US9100014",
  "name": "wedi Fundo® Shower Base",
  "size": "48 in. x 84 in. x 2 in.",
  "details": "Center Drain",
  "retail": 1127.8,
  "net": 683.52,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504167"
 },
 {
  "us": "US9100015",
  "name": "wedi Fundo® Shower Base",
  "size": "60 in. x 84 in. x 2 in.",
  "details": "Center Drain",
  "retail": 1409.96,
  "net": 854.52,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504168"
 },
 {
  "us": "US9100016",
  "name": "wedi Fundo® Shower Base",
  "size": "72 in. x 72 in. x 1 37/64 in.",
  "details": "Center Drain",
  "retail": 1450.39,
  "net": 879.03,
  "section": "WEDI FUNDO® SHOWER BASES",
  "discount": 52,
  "erp": "1504169"
 },
 {
  "us": "US2000002",
  "name": "wedi Fundo® Shower Kit",
  "size": "36 in. x 36 in.",
  "details": "Center Drain",
  "retail": 855.95,
  "net": 518.76,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000009",
  "name": "wedi Fundo® Shower Kit",
  "size": "36 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1072.14,
  "net": 649.78,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000010",
  "name": "wedi Fundo® Shower Kit",
  "size": "48 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1232.28,
  "net": 746.84,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000003",
  "name": "wedi Fundo® Shower Kit",
  "size": "36 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1152.21,
  "net": 698.31,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000015",
  "name": "wedi Fundo® Shower Kit",
  "size": "42 in. x 42 in.",
  "details": "Center Drain",
  "retail": 1064.14,
  "net": 644.93,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000013",
  "name": "wedi Fundo® Shower Kit",
  "size": "42 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1352.39,
  "net": 819.63,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000011",
  "name": "wedi Fundo® Shower Kit",
  "size": "48 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1440.47,
  "net": 873.01,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000014",
  "name": "wedi Fundo® Shower Kit",
  "size": "42 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1512.53,
  "net": 916.68,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000012",
  "name": "wedi Fundo® Shower Kit",
  "size": "48 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1632.63,
  "net": 989.48,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000008",
  "name": "wedi Fundo® Shower Kit",
  "size": "36 in. x 72 in.",
  "details": "Offset Drain",
  "retail": 1336.37,
  "net": 809.92,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000001",
  "name": "wedi Fundo® Shower Kit",
  "size": "36 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1336.37,
  "net": 809.92,
  "section": "WEDI FUNDO® SHOWER KITS - (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "kitNote": "*Contains Fundo® Shower Base, Click and Seal™ Drain Assembly,wedi Fundo® Drain Cover Set Stainless Steel, 1/2 in. wedi Building Panels (for 3 walls 80\" high), Full Foam Curb Lean, Fasteners, wedi Joint Sealant, and Corner Putty Knife, Flexi Collar and Mixing Valve Flexi Collar",
  "section": "WEDI FUNDO® SHOWER KITS - (complete)"
 },
 {
  "us": "US2100001",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "36 in. x 36 in.",
  "details": "Center Drain",
  "retail": 721.43,
  "net": 437.23,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100002",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "36 in. x 48 in.",
  "details": "Center Drain",
  "retail": 918.41,
  "net": 556.61,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100003",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "48 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1078.55,
  "net": 653.67,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100004",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "36 in. x 60 in.",
  "details": "Center Drain",
  "retail": 998.48,
  "net": 605.14,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100005",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "42 in. x 42 in.",
  "details": "Center Drain",
  "retail": 910.4,
  "net": 551.76,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100006",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "42 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1179.44,
  "net": 714.81,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100011",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "48 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1267.51,
  "net": 768.19,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100008",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "42 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1339.58,
  "net": 811.87,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100009",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "48 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1459.68,
  "net": 884.66,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100010",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "36 in. x 72 in.",
  "details": "Offset Drain",
  "retail": 1182.64,
  "net": 716.75,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100007",
  "name": "wedi Fundo® Shower Kit NOJS",
  "size": "36 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1182.64,
  "net": 716.75,
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "kitNote": "*Contains Fundo® Shower Base, Click and Seal™ Drain Assembly,wedi Fundo® Drain Cover Set Stainless Steel, 1/2 in. wedi Building Panels (for 3 walls 80\" high), Full Foam Curb Lean, Fasteners, and Corner Putty Knife, Flexi Collar and Mixing Valve Flexi Collar. Joint Sealant sold separately.",
  "section": "WEDI FUNDO® SHOWER KITS - NOJS (wedi Joint Sealant sold separately)"
 },
 {
  "us": "US9310001",
  "name": "wedi Fundo® Linear Shower Base",
  "size": "36 in. x 60 in. x 2 in.",
  "details": "4 Sided Slope / 43 19/64 in. Channel Length",
  "retail": 749.62,
  "net": 454.32,
  "section": "WEDI FUNDO® LINEAR SHOWER BASE",
  "discount": 52,
  "erp": "1504176"
 },
 {
  "us": "US9310002",
  "name": "wedi Fundo® Linear Shower Base",
  "size": "48 in. x 60 in. x 2 1/2 in.",
  "details": "4 Sided Slope / 27 19/32 in. Channel Length",
  "retail": 1001.46,
  "net": 606.95,
  "section": "WEDI FUNDO® LINEAR SHOWER BASE",
  "discount": 52,
  "erp": "1504177"
 },
 {
  "us": "US9310003",
  "name": "wedi Fundo® Linear Shower Base",
  "size": "48 in. x 72 in. x 2 3/8 in.",
  "details": "4 Sided Slope / 43 19/64 in. Channel Length",
  "retail": 1201.92,
  "net": 728.44,
  "section": "WEDI FUNDO® LINEAR SHOWER BASE",
  "discount": 52,
  "erp": "1504178"
 },
 {
  "us": "US9320001",
  "name": "wedi Fundo® Linear Shower Module 32\"",
  "size": "32 in. x 5 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 302.38,
  "net": 183.26,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9320003",
  "name": "wedi Fundo® Linear Shower Module 36\"",
  "size": "36 in. x 5 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 336.07,
  "net": 203.68,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9320004",
  "name": "wedi Fundo® Linear Shower Module 42\"",
  "size": "42 in. x 5 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 357.97,
  "net": 216.95,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9320002",
  "name": "wedi Fundo® Linear Shower Module 48\"",
  "size": "48 in. x 5 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 378.18,
  "net": 229.2,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9320005",
  "name": "wedi Fundo® Linear Shower Module 54\"",
  "size": "54 in. x 5 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 420.29,
  "net": 254.72,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9330001",
  "name": "wedi Fundo® Linear Shower Extension 32\"",
  "size": "32 in. x 66 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 529.79,
  "net": 321.08,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9330003",
  "name": "wedi Fundo® Linear Shower Extension 36\"",
  "size": "36 in. x 66 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 546.63,
  "net": 331.29,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9330004",
  "name": "wedi Fundo® Linear Shower Extension 42\"",
  "size": "42 in. x 66 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 622.44,
  "net": 377.24,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9330002",
  "name": "wedi Fundo® Linear Shower Extension 48\"",
  "size": "48 in. x 66 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 715.09,
  "net": 433.39,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9330005",
  "name": "wedi Fundo® Linear Shower Extension 54\"",
  "size": "54 in. x 66 3/4 in.",
  "details": "Waterproofing System for tiled shower floors with linear drain",
  "retail": 799.32,
  "net": 484.43,
  "section": "WEDI FUNDO® LINEAR MODULAR SHOWER SYSTEM (click and seal drain assembly included with line module)",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US2000062",
  "name": "wedi Fundo® Linear Shower Kit",
  "size": "32 in. x 72 in.",
  "details": "Fundo® Linear neo Line & Extenstion Module",
  "retail": 1512.53,
  "net": 916.68,
  "section": "WEDI FUNDO® LINEAR SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "kitNote": "*Contains Fundo® Linear Shower base , Click and Seal™ Drain Assembly, Standard Linear Cover Plate, 3x5x1/2\" wedi Building Panels (for 3 walls 80\" high), Full Foam Curb Lean, Fasteners, wedi Joint Sealant, Flexi Collar and Mixing Valve Flexi Collar",
  "section": "WEDI FUNDO® LINEAR SHOWER KIT (complete)"
 },
 {
  "us": "US2100015",
  "name": "wedi Fundo® Linear Shower Kit NOJS",
  "size": "32 in. x 72 in.",
  "details": "Fundo® Linear neo Line & Extenstion Module",
  "retail": 1358.79,
  "net": 823.51,
  "section": "WEDI FUNDO® LINEAR SHOWER KIT - NOJS (wedi Joint Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "kitNote": "*Contains Fundo® Linear Shower base , Click and Seal™ Drain Assembly, Standard Linear Cover Plate, 3x5x1/2\" wedi Building Panels (for 3 walls 80\" high), Full Foam Curb Lean, Fasteners, Flexi Collar and Mixing Valve Flexi Collar. wedi Joint Sealant sold separately.",
  "section": "WEDI FUNDO® LINEAR SHOWER KIT - NOJS (wedi Joint Sealant sold separately)"
 },
 {
  "us": "US9200001",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "36 in. x 48 in. x 3/4 in.",
  "details": "Center Drain",
  "retail": 599.7,
  "net": 363.45,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1504170"
 },
 {
  "us": "US9200006",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "42 in. x 42 in. x 3/4 in.",
  "details": "Center Drain",
  "retail": 612.33,
  "net": 371.11,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1504171"
 },
 {
  "us": "US9200002",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "48 in. x 48 in. x 3/4 in.",
  "details": "Center Drain",
  "retail": 799.32,
  "net": 484.43,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1504172"
 },
 {
  "us": "US9200008",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "48 in. x 72 in. x 1 1/8 in.",
  "details": "Center Drain",
  "retail": 1200.24,
  "net": 727.42,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1508541"
 },
 {
  "us": "US9200003",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "36 in. x 60 in. x 3/4 in.",
  "details": "Center Drain",
  "retail": 715.93,
  "net": 433.9,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1504173"
 },
 {
  "us": "US9200007",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "36 in. x 60 in. x 1 1/8 in.",
  "details": "Offset Drain",
  "retail": 715.93,
  "net": 433.9,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1512228"
 },
 {
  "us": "US9200004",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "48 in. x 60 in. x 3/4 in.",
  "details": "Center Drain",
  "retail": 1000.62,
  "net": 606.44,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1504174"
 },
 {
  "us": "US9200005",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "60 in. x 60 in. x 3/4 in.",
  "details": "Center Drain",
  "retail": 1250.77,
  "net": 758.04,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1504175"
 },
 {
  "us": "US9200009",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "60 in. x 72 in. x 1 1/8 in.",
  "details": "Center Drain",
  "retail": 1500.93,
  "net": 909.65,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1508542"
 },
 {
  "us": "US9200010",
  "name": "wedi Fundo® Curbless Shower Base",
  "size": "72 in. x 72 in. x 1 1/8 in.",
  "details": "Center Drain",
  "retail": 1800.78,
  "net": 1091.38,
  "section": "WEDI FUNDO® CURBLESS SHOWER BASE",
  "discount": 52,
  "erp": "1508543"
 },
 {
  "us": "US2000065",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "36 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1288.33,
  "net": 780.81,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000060",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "36 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1413.24,
  "net": 856.51,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000066",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "36 in. x 60 in.",
  "details": "Offset Drain",
  "retail": 1413.24,
  "net": 856.51,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000063",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "42 in. x 42 in.",
  "details": "Center Drain",
  "retail": 1288.33,
  "net": 780.81,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000067",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "48 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1464.49,
  "net": 887.57,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000061",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "48 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1744.73,
  "net": 1057.41,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2000064",
  "name": "wedi Fundo® Curbless Shower Kit",
  "size": "48 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1926.1,
  "net": 1167.33,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)",
  "discount": 53,
  "erp": ""
 },
 {
  "kitNote": "*Contains wedi Fundo® Curbless Shower Base, Click and Seal™ Drain Assembly,wedi Fundo® Drain Cover Set Stainless Steel, 1/2 in. wedi Building Panels (for 3 walls 80 in. high), wedi Subliner Dry 5 m, wedi Sealant 620, Fasteners, wedi Joint Sealant, and Corner Putty Knife, Flexi Collar and Mixing Valve Flexi Collar and Subliner Dry Corner Seals.",
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT (complete)"
 },
 {
  "us": "US2100017",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "36 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1085.61,
  "net": 657.95,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100012",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "36 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1200.03,
  "net": 727.29,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100018",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "36 in. x 60 in.",
  "details": "Offset Drain",
  "retail": 1200.03,
  "net": 727.29,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100013",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "42 in. x 42 in.",
  "details": "Center Drain",
  "retail": 1075.12,
  "net": 651.59,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100019",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "48 in. x 48 in.",
  "details": "Center Drain",
  "retail": 1253.53,
  "net": 759.72,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100014",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "48 in. x 60 in.",
  "details": "Center Drain",
  "retail": 1512.31,
  "net": 916.55,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US2100016",
  "name": "wedi Fundo® Curbless Shower Kit NOJS",
  "size": "48 in. x 72 in.",
  "details": "Center Drain",
  "retail": 1700.64,
  "net": 1030.69,
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)",
  "discount": 53,
  "erp": ""
 },
 {
  "kitNote": "*Contains wedi Fundo® Curbless Shower Base, Click and Seal™ Drain Assembly,wedi Fundo® Drain Cover Set Stainless Steel, 1/2 in. wedi Building Panels (for 3 walls 80 in. high), wedi Subliner Dry 5 m, Fasteners, wedi Joint Sealant, and Corner Putty Knife, Flexi Collar and Mixing Valve Flexi Collar and Subliner Dry Corner Seals. wedi Joint Sealant and wedi Sealant 620 sold separately",
  "section": "WEDI FUNDO® CURBLESS SHOWER KIT - NOJS (wedi Joint Sealant/620 Sealant sold separately)"
 },
 {
  "us": "US5000085",
  "name": "wedi® Curbless Shower Recess Kit",
  "size": "Bracket system to recess shower areas up to 5x5 ft. in size in 3/4 plywood subfloors",
  "details": "",
  "retail": 508,
  "net": 307.88,
  "section": "FUNDO® CURBLESS RECESS INSTALLATION KIT",
  "discount": 50,
  "erp": "28872"
 },
 {
  "us": "073783528",
  "name": "wedi Fundo® Shower Extension 24\"x48\"",
  "size": "48 in. x 24 in. sloped 1/4 in./ft",
  "details": "Sloped extensions for use with wedi Shower Base adding 24 inches of sloped surfaces along one 48 inch long side",
  "retail": 223.2,
  "net": 135.27,
  "section": "FUNDO SHOWER BASE EXTENSIONS",
  "discount": 52,
  "erp": "29244"
 },
 {
  "us": "US3000036",
  "name": "wedi Fundo® Shower Extension 12\"x72\"",
  "size": "72 in. x 12 in. sloped 1/4 in./ft",
  "details": "Sloped extensions for use with wedi Shower Base adding 12 inches of sloped surfaces along one 72 inch long side",
  "retail": 198.14,
  "net": 120.09,
  "section": "FUNDO SHOWER BASE EXTENSIONS",
  "discount": 52,
  "erp": "29266"
 },
 {
  "us": "US3000035",
  "name": "wedi Fundo® Curbless Shower Extension 12\"x60\"",
  "size": "12 in. x 60 in. sloped 1/4 in./ft",
  "details": "Sloped extensions for use with wedi Curbless Shower Base adding 12 inches of sloped surfaces along one 60 inch long side",
  "retail": 189.51,
  "net": 114.86,
  "section": "FUNDO SHOWER BASE EXTENSIONS",
  "discount": 52,
  "erp": "29145"
 },
 {
  "us": "US3000053",
  "name": "wedi Fundo® Shower Corner Extension",
  "size": "16 1/2 in. x 16 1/2 in. x 1 13/16 in.",
  "details": "Sloped corner extension for use with wedi Shower Base adding 12 inches of sloped surface on two sides (total square size 16 1/2 in. x 16 1/2 in.)",
  "retail": 185.3,
  "net": 112.3,
  "section": "FUNDO SHOWER BASE EXTENSIONS",
  "discount": 52,
  "erp": "1508544"
 },
 {
  "us": "US3000052",
  "name": "wedi Fundo® Curbless Shower Corner Extension",
  "size": "16 1/2 in. x 16 1/2 in. x 1 1/16 in.",
  "details": "Sloped corner extension for use with wedi Curbless Shower Base adding 12 inches of sloped surface on two sides (total square size 16 1/2 in. x 16 1/2 in.)",
  "retail": 177.17,
  "net": 107.38,
  "section": "FUNDO SHOWER BASE EXTENSIONS",
  "discount": 52,
  "erp": "1508545"
 },
 {
  "us": "073736517",
  "name": "wedi Fundo® Shower Ramp 16\"x60\"",
  "size": "16 in. x 60 in.",
  "details": "Sloped and waterproof ADA compliant tileable Ramp providing 16 inches of sloped surface along a 60 inch width of a shower entry ramp design",
  "retail": 251.84,
  "net": 152.63,
  "section": "SHOWER RAMPS",
  "discount": 52,
  "erp": "47733"
 },
 {
  "us": "US3000008",
  "name": "wedi Fundo® Shower Curb Cap 60\"",
  "size": "5 in. x 4 5/8 in. x 60 in.",
  "details": "Curb cap with exterior dimensions 5 in. x 4 5/8 in. x 60 in. (H x W X L) to finish and waterproof over wooden 2 x 4 curb constructions",
  "retail": 95.85,
  "net": 58.09,
  "section": "CURBS",
  "discount": 52,
  "erp": "47729"
 },
 {
  "us": "US3000010",
  "name": "wedi Fundo® Shower Curb Cap 96\"",
  "size": "5 in. x 4 5/8 in. x 96 in.",
  "details": "Curb cap with exterior dimensions 5 in. x 4 5/8 in. x 96 in. (H x W X L) to finish and waterproof over wooden 2 x 4 curb constructions",
  "retail": 134.55,
  "net": 81.55,
  "section": "CURBS",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000039",
  "name": "wedi Fundo® Shower Curb 60\"",
  "size": "5 1/8 in. x 4 1/2 in. x 60 in.",
  "details": "Sloped and pre-made curb with dimensions of 5 1/8 in. x 4 1/2 in. x 60 in. (HxWxL) for use with wedi Shower Bases",
  "retail": 102.34,
  "net": 62.02,
  "section": "CURBS",
  "discount": 52,
  "erp": "47730"
 },
 {
  "us": "US3000038",
  "name": "wedi Fundo® Shower Curb Lean 60\"",
  "size": "3 1/2 in. x 2 in. x 60 in.",
  "details": "Sloped and pre-made curb with dimensions of 3 1/2 in. x 2 in. x 60 in. (HxWxL) for use with wedi Shower Bases",
  "retail": 53.99,
  "net": 32.72,
  "section": "CURBS",
  "discount": 52,
  "erp": "29118"
 },
 {
  "us": "US3000041",
  "name": "wedi Fundo® Shower Curb 96\"",
  "size": "5 1/8 in. x 4 1/2 in. x 96 in.",
  "details": "Sloped and pre-made curb with dimensions of 5 1/8 in. x 4 1/2 in. x 96 in. (HxWxL) for use with wedi Shower Bases",
  "retail": 151.44,
  "net": 91.78,
  "section": "CURBS",
  "discount": 52,
  "erp": "29541"
 },
 {
  "us": "US3000040",
  "name": "wedi Fundo® Shower Curb Lean 96\"",
  "size": "3 1/2 in. x 2 in. x 96 in.",
  "details": "Sloped and pre-made curb with dimensions of 3 1/2 in. x 2 in. x 96 in. ( HxWxL) for use with wedi Shower Bases",
  "retail": 86.99,
  "net": 52.72,
  "section": "CURBS",
  "discount": 52,
  "erp": "28795"
 },
 {
  "us": "US3000048",
  "name": "wedi Fundo® Shower Curb AT 60\"",
  "size": "5 1/8 in. x 4 1/2 in. x 60 in.",
  "details": "Sloped and pre-made curb with integrated glass door anchor track in dimensions 5 1/8 in. x 4 1/2 in. x 60 in. (HxWxL)",
  "retail": 139.4,
  "net": 84.48,
  "section": "CURBS",
  "discount": 52,
  "erp": "28776"
 },
 {
  "us": "US3000049",
  "name": "wedi Fundo® Shower Curb Lean AT 60\"",
  "size": "3 1/2 in. x 2 in. x 60 in.",
  "details": "Sloped and pre-made curb with integrated glass door anchor track in dimensions 3 1/2 in. x 2 in. x 60 in. (HxWxL)",
  "retail": 103.14,
  "net": 62.51,
  "section": "CURBS",
  "discount": 52,
  "erp": "28777"
 },
 {
  "us": "US3000004",
  "name": "wedi® Shower Niche 12\"x8\"",
  "size": "16 in. x 12 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 8 x 3 1/2 in. (WxHxD)",
  "retail": 73.52,
  "net": 44.56,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "29356"
 },
 {
  "us": "US3000005",
  "name": "wedi® Shower Niche 12\"x12\"",
  "size": "16 in. x 16 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 12 x 3 1/2 in. (WxHxD)",
  "retail": 75.89,
  "net": 46,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "47731"
 },
 {
  "us": "US3000007",
  "name": "wedi® Shower Niche 12\"x18\"",
  "size": "16 in. x 22 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 18 x 3 1/2 in. (WxHxD) and with removable and tileable 2 inch shelf",
  "retail": 95.11,
  "net": 57.64,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "47732"
 },
 {
  "us": "US3000248",
  "name": "wedi® Shower Niche 12\"x24\"",
  "size": "16 in. x 28 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 24 x 3 1/2 in. (WxHxD) and with one removable and tileable 2 inch shelf",
  "retail": 121.52,
  "net": 73.65,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "1504186"
 },
 {
  "us": "US3000016",
  "name": "wedi® Shower Niche 12\"x26\"CAT",
  "size": "16 in. x 30 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 26 x 3 1/2 in. (WxHxD) and cathedral peaked top and with removable and tileable 2 inch shelf",
  "retail": 109.01,
  "net": 66.07,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "29970"
 },
 {
  "us": "US3000051",
  "name": "wedi® Shower Niche 12\"x28\"",
  "size": "16 in. x 32 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 28 x 3 1/2 in. (WxHxD) and with one removable and tileable 2 inch shelf",
  "retail": 125.42,
  "net": 76.01,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "1510308"
 },
 {
  "us": "US3000024",
  "name": "wedi® Shower Niche 12\"x38\"",
  "size": "16 in. x 42 in.",
  "details": "Tileable Niches for recess into shower walls with interior niche dimensions of 12 x 38 1/4 x 3 1/2 in. (WxHxD) and with two removable and tileable 2 inch shelves",
  "retail": 170.43,
  "net": 103.29,
  "section": "RECESSED NICHES",
  "discount": 50,
  "erp": "29410"
 },
 {
  "us": "US3000050",
  "name": "wedi® Shower Niche Shelf Glass",
  "size": "11 7/8 in. x 3 1/2 in. x 3/8 in.",
  "details": "Solid Niche Shelf made from low iron, clear safety glass with pencil polish finish front in 11 7/8 x 3 1/2 x 3/8 inch (L x D x H)",
  "retail": 37.06,
  "net": 22.46,
  "section": "SHOWER NICHE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000245",
  "name": "wedi® Shower Niche Shelf Stainless Steel",
  "size": "11 7/8 in. x 3 1/2 in. x 1/8 in.",
  "details": "Slotted Niche Shelf with made from stainless steel with brushed finish in 11 7/8 x 3 1/2 x 1/8 inch ( L x D x H)",
  "retail": 99.09,
  "net": 60.06,
  "section": "SHOWER NICHE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000246",
  "name": "wedi® Shower Niche Shelf Matte Black",
  "size": "11 7/8 in. x 3 1/2 in. x 1/8 in.",
  "details": "Slotted Niche Shelf made from aluminum with Matte Black finish in 11 7/8 x 3 1/2 x 1/8 inch (L x D x H)",
  "retail": 91.05,
  "net": 55.18,
  "section": "SHOWER NICHE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000001",
  "name": "wedi Shower Seat M",
  "size": "19 in. x 19 in. (wall sides) x 4 in.",
  "details": "Suspended Corner Seat",
  "retail": 197.41,
  "net": 119.64,
  "section": "OTHER SHOWER SEATS",
  "discount": 50,
  "erp": "1511321"
 },
 {
  "us": "US3000002",
  "name": "wedi Shower Seat L",
  "size": "24 in. x 24 in. (wall sides) x 4 in.",
  "details": "Suspended Corner Seat",
  "retail": 221.97,
  "net": 134.53,
  "section": "OTHER SHOWER SEATS",
  "discount": 50,
  "erp": "47824"
 },
 {
  "us": "US3000054",
  "name": "wedi® Shower Corner Bench Kit 16\"",
  "size": "16 in. x 16 in. (sides) x 20 in.",
  "details": "Floor-mounted Triangular Corner Shower Bench Kit. Includes wedi Joint Sealant.",
  "retail": 136.29,
  "net": 82.6,
  "section": "BENCH KITS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US3000055",
  "name": "wedi® Shower Corner Bench Kit 24\"",
  "size": "24 in. x 24 in. (sides) x 20 in.",
  "details": "Floor-mounted Triangular Corner Shower Bench Kit. Includes wedi Joint Sealant.",
  "retail": 178.88,
  "net": 108.41,
  "section": "BENCH KITS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US3000056",
  "name": "wedi® Shower Bench Kit 48\"",
  "size": "48 in. x 16 in. x 20 in.",
  "details": "Floor-mounted Rectangular Shower Bench Kit. Includes wedi Joint Sealant.",
  "retail": 238.51,
  "net": 144.55,
  "section": "BENCH KITS",
  "discount": 50,
  "erp": ""
 },
 {
  "us": "US3000042",
  "name": "wedi Sanoasa® Shower Bench 1 M",
  "size": "≈35 in. x 18 in. x 15 in.",
  "details": "Wall-Floor Adhered. To be discontinued, limited quantities available while supplies last.",
  "retail": 621.6,
  "net": 376.73,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000043",
  "name": "wedi Sanoasa® Shower Bench 1 L",
  "size": "≈47 in. x 18 in. x 15 in.",
  "details": "Wall-Floor Adhered. To be discontinued, limited quantities available while supplies last.",
  "retail": 735.3,
  "net": 445.64,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": "26889"
 },
 {
  "us": "US3000044",
  "name": "wedi Sanoasa® Shower Bench 2 M",
  "size": "≈35 in. x 18 in. x 15 in.",
  "details": "Wall-Floor Adhered",
  "retail": 621.6,
  "net": 376.73,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000045",
  "name": "wedi Sanoasa® Shower Bench 2 L",
  "size": "≈47 in. x 18 in. x 15 in.",
  "details": "Wall-Floor Adhered",
  "retail": 735.3,
  "net": 445.64,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000046",
  "name": "wedi Sanoasa® Shower Bench 3 M",
  "size": "≈35 in. x 18 in. x 15 in.",
  "details": "Wall-Floor Adhered",
  "retail": 621.6,
  "net": 376.73,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000047",
  "name": "wedi Sanoasa® Shower Bench 3 L",
  "size": "≈47 in. x 18 in. x 15 in.",
  "details": "Wall-Floor Adhered",
  "retail": 735.3,
  "net": 445.64,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US3000000",
  "name": "wedi Sanoasa® Shower Bench 4",
  "size": "47 1/4 in. x 15 in. x 3 1/8 in.",
  "details": "Suspended Bench",
  "retail": 406.82,
  "net": 246.56,
  "section": "Sanoasa® SHOWER BENCHES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000057",
  "name": "wedi Fundo® Drain Cover SS",
  "size": "Drain cover and frame made from stainless steel with brushed Natural finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "",
  "retail": 67.3,
  "net": 40.79,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000056",
  "name": "wedi Fundo® Drain Cover ORB",
  "size": "Drain cover and frame made from stainless steel with Oil-Rubbed-Bronze finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with Oil-Rubbed-Bronze finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 149,
  "net": 90.3,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000055",
  "name": "wedi Fundo® Drain Cover G",
  "size": "Drain cover and frame made from stainless steel with polished Gold finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with polished Gold finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 149,
  "net": 90.3,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000054",
  "name": "wedi Fundo® Drain Cover C",
  "size": "Drain cover and frame made from stainless steel with polished Chrome finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with polished Chrome finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 149,
  "net": 90.3,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000058",
  "name": "wedi Fundo® Drain Cover MB",
  "size": "Drain cover and frame made from stainless steel with Matte Black finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with Matte Black finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 133.92,
  "net": 81.16,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000047",
  "name": "wedi Fundo® Drain Cover T38",
  "size": "Drain cover with tile-in grate and frame made from stainless steel for use with 3/8 inch tile (3 3/4 in. x 3 3/4 in. x 3/8 in. LxWxT)",
  "details": "Drain cover with tile-in grate and frame made from stainless steel for use with 3/8 inch tile (3 3/4 in. x 3 3/4 in. x 3/8 in. LxWxT)",
  "retail": 112.86,
  "net": 68.4,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000060",
  "name": "wedi Fundo® Drain Cover T14",
  "size": "Drain cover with tile-in grate and frame made from stainless steel for use with 1/4 inch tile (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover with tile-in grate and frame made from stainless steel for use with 1/4 inch tile (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 112.86,
  "net": 68.4,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000062",
  "name": "wedi Fundo® Drain Cover B",
  "size": "Drain cover and frame made from stainless steel with Brushed Brass finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with Brushed Brass finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 149,
  "net": 90.3,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000053",
  "name": "wedi Fundo® Drain Cover CSL",
  "size": "Drain cover and frame made from stainless steel with polished slotted Chrome finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with polished slotted Chrome finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 166.77,
  "net": 101.07,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000124",
  "name": "wedi Fundo® Drain Cover CHA",
  "size": "Drain cover and frame made from stainless steel with Champagne finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with Champagne finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 148.64,
  "net": 90.09,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000125",
  "name": "wedi Fundo® Drain Cover WHT",
  "size": "Drain cover and frame made from stainless steel with White Matte finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "details": "Drain cover and frame made from stainless steel with White Matte finish (3 3/4 in. x 3 3/4 in. x 1/4 in. LxWxT)",
  "retail": 148.64,
  "net": 90.09,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "077000054",
  "name": "Fundo Click and Seal ™ Height Adjustment Kit",
  "size": "Drain cover height adjustment kit to increase drain covers by up to 1 1/4 in., allows it to rotate, and allows it to move laterally by 3/16 inch in all directions to adjust to the tile and grout layout.",
  "details": "",
  "retail": 12.09,
  "net": 7.33,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9400100",
  "name": "Fundo Click and Seal ™ Replacement Kit Copper Pipe",
  "size": "For sealing gasket connections to copper waste pipe",
  "details": "",
  "retail": 19.34,
  "net": 11.72,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9400105",
  "name": "wedi® Fundo Click and Seal® 1 1/2 in. Pipe Kit",
  "size": "For connections to 1 1/2 in. waste pipe",
  "details": "",
  "retail": 31.89,
  "net": 19.33,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9400101",
  "name": "Fundo Click and Seal ™ Drain Kit 2\"",
  "size": "Drain unit kit for wedi Shower Bases",
  "details": "",
  "retail": 28.19,
  "net": 17.09,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US9400001",
  "name": "wedi® Fundo Click and Seal® Lube Kit",
  "size": "20 units of silicone based, synthetic wedi lubricant for Click and Seal drain installations",
  "details": "",
  "retail": 21.75,
  "net": 13.18,
  "section": "FUNDO® SHOWER BASE ACCESSORIES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000082",
  "name": "wedi Fundo® Linear Drain Cover MB27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 241.73,
  "net": 146.5,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000095",
  "name": "wedi Fundo® Linear Drain Cover MB31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 260.26,
  "net": 157.73,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000102",
  "name": "wedi Fundo® Linear Drain Cover MB35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish in 35 3/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 268.68,
  "net": 162.84,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000083",
  "name": "wedi Fundo® Linear Drain Cover MB43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 282.16,
  "net": 171.01,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000084",
  "name": "wedi Fundo® Linear Drain Cover SS27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Natural finish in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 145.08,
  "net": 87.93,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000094",
  "name": "wedi Fundo® Linear Drain Cover SS31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Natural finish in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 167.61,
  "net": 101.58,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000101",
  "name": "wedi Fundo® Linear Drain Cover SS35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Natural finish in 35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "retail": 176.03,
  "net": 106.69,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000085",
  "name": "wedi Fundo® Linear Drain Cover SS43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Natural finish in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 185.26,
  "net": 112.28,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000090",
  "name": "wedi Fundo® Linear Drain Cover B27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 265.32,
  "net": 160.8,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000096",
  "name": "wedi Fundo® Linear Drain Cover B31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 310.8,
  "net": 188.36,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000103",
  "name": "wedi Fundo® Linear Drain Cover B35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish in 35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "retail": 327.64,
  "net": 198.57,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000091",
  "name": "wedi Fundo® Linear Drain Cover B43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 341.12,
  "net": 206.74,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000126",
  "name": "wedi Fundo® Linear Drain Cover C27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 256.96,
  "net": 155.74,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000127",
  "name": "wedi Fundo® Linear Drain Cover C31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 301.02,
  "net": 182.43,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000128",
  "name": "wedi Fundo® Linear Drain Cover C35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish in 35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "retail": 317.33,
  "net": 192.32,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000129",
  "name": "wedi Fundo® Linear Drain Cover C43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 330.38,
  "net": 200.23,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000086",
  "name": "wedi Fundo® Linear Drain Cover T27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with tileable finish in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 161.08,
  "net": 97.63,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000097",
  "name": "wedi Fundo® Linear Drain Cover T31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with tileable finish in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 176.03,
  "net": 106.69,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000104",
  "name": "wedi Fundo® Linear Drain Cover T35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with tileable finish in 35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "retail": 184.46,
  "net": 111.79,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000087",
  "name": "wedi Fundo® Linear Drain Cover T43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with tileable finish in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 201.3,
  "net": 122,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000108",
  "name": "wedi Fundo® Linear Drain Cover CP27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish, perforated design in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 256.96,
  "net": 155.74,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000112",
  "name": "wedi Fundo® Linear Drain Cover CP31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish, perforated design, perforated design in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 301.02,
  "net": 182.43,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000116",
  "name": "wedi Fundo® Linear Drain Cover CP35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish, perforated design, perforated design in 35 3/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 317.33,
  "net": 192.32,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000120",
  "name": "wedi Fundo® Linear Drain Cover CP43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with polished Chrome finish, perforated design, perforated design in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 330.38,
  "net": 200.23,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000109",
  "name": "wedi Fundo® Linear Drain Cover MBP27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish, perforated design perforated design in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 234.12,
  "net": 141.89,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000113",
  "name": "wedi Fundo® Linear Drain Cover MBP31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish, perforated design perforated design in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 252.07,
  "net": 152.77,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000117",
  "name": "wedi Fundo® Linear Drain Cover MBP35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish, perforated design perforated design in 35 3/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 260.23,
  "net": 157.71,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000121",
  "name": "wedi Fundo® Linear Drain Cover MBP43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Matte Black finish, perforated design perforated design in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 273.27,
  "net": 165.62,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000110",
  "name": "wedi Fundo® Linear Drain Cover SSP27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Natural finish, perforated design perforated design in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 140.52,
  "net": 85.16,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000114",
  "name": "wedi Fundo® Linear Drain Cover SSP31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Natural finish, perforated design perforated design in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 162.34,
  "net": 98.39,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000118",
  "name": "wedi Fundo® Linear Drain Cover SSP35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Natural finish, perforated design perforated design in 35 3/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 170.49,
  "net": 103.33,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000122",
  "name": "wedi Fundo® Linear Drain Cover SSP43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with Natural finish finish, perforated design perforated design in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 179.4,
  "net": 108.73,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000111",
  "name": "wedi Fundo® Linear Drain Cover BP27",
  "size": "27 11/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish, perforated design perforated design in 27 11/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 256.96,
  "net": 155.74,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000115",
  "name": "wedi Fundo® Linear Drain Cover BP31",
  "size": "31 7/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish, perforated design perforated design in 31 7/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 301.02,
  "net": 182.43,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000119",
  "name": "wedi Fundo® Linear Drain Cover BP35",
  "size": "35 3/64 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish, perforated design perforated design in 35 3/64 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 317.33,
  "net": 192.32,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000123",
  "name": "wedi Fundo® Linear Drain Cover BP43",
  "size": "42 29/32 in. x 1 49/64 in.× 33/64 in.",
  "details": "Drain cover made from Stainless Steel with brushed Brass finish, perforated design perforated design in 42 29/32 in. x 1 49/64 in.× 33/64 in. (LxWxH)",
  "retail": 330.38,
  "net": 200.23,
  "section": "FUNDO® LINEAR COVER PLATES",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000098",
  "name": "wedi Fundo® Linear Drain Cover Frame SS31",
  "size": "32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with polished Natural finish in 32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 31 inch length.",
  "retail": 164.24,
  "net": 99.54,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000105",
  "name": "wedi Fundo® Linear Drain Cover Frame SS35",
  "size": "35 29/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with polished Natural finish in 35 29/32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 35 inch length.",
  "retail": 165.09,
  "net": 100.05,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000092",
  "name": "wedi Fundo® Linear Drain Cover Frame B27",
  "size": "28 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with brushed Brass finish in 28 in. x 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 27 inch length.",
  "retail": 252.68,
  "net": 153.14,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000100",
  "name": "wedi Fundo® Linear Drain Cover Frame B31",
  "size": "32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with brushed Brass finish in 32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 31 inch length.",
  "retail": 260.26,
  "net": 157.73,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000107",
  "name": "wedi Fundo® Linear Drain Cover Frame B35",
  "size": "35 29/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with brushed Brass finish in 35 29/32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 35 inch length.",
  "retail": 268.68,
  "net": 162.84,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000093",
  "name": "wedi Fundo® Linear Drain Cover Frame B43",
  "size": "43 25/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with brushed Brass finish in 43 25/32 in. x 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 43 inch length.",
  "retail": 273.74,
  "net": 165.9,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000088",
  "name": "wedi Fundo® Linear Drain Cover Frame 27MB",
  "size": "28 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with Matte Black finish in 28 in. x 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 27 inch length.",
  "retail": 221.52,
  "net": 134.25,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000099",
  "name": "wedi Fundo® Linear Drain Cover Frame 31MB",
  "size": "32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with Matte Black finish in 32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 31 inch length.",
  "retail": 226.57,
  "net": 137.32,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000106",
  "name": "wedi Fundo® Linear Drain Cover Frame 35MB",
  "size": "35 29/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with Matte Black finish in 35 29/32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 35 inch length.",
  "retail": 234.99,
  "net": 142.42,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000089",
  "name": "wedi Fundo® Linear Drain Cover Frame 43MB",
  "size": "43 25/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with Matte Black finish in 43 25/32 in. x 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 43 inch length.",
  "retail": 241.73,
  "net": 146.5,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000130",
  "name": "wedi Fundo® Linear Drain Cover Frame C27",
  "size": "28 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with polished Chrome finish in 28 in. x 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 27 inch length.",
  "retail": 244.73,
  "net": 148.32,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000131",
  "name": "wedi Fundo® Linear Drain Cover Frame C31",
  "size": "32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with polished Chrome finish in 32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 31 inch length.",
  "retail": 252.07,
  "net": 152.77,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000132",
  "name": "wedi Fundo® Linear Drain Cover Frame C35",
  "size": "35 29/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with polished Chrome finish in 35 29/32 in. × 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 35 inch length.",
  "retail": 268.69,
  "net": 162.84,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US1000133",
  "name": "wedi Fundo® Linear Drain Cover Frame C43",
  "size": "43 25/32 in. × 2 9/16 in. x 1/4 in.",
  "details": "Cover Frame trim made from Stainless Steel with polished Chrome finish in 43 25/32 in. x 2 9/16 in. x 1/4 in. (LxWxH) to match with wedi Linear drain covers in nom. 43 inch length.",
  "retail": 273.74,
  "net": 165.9,
  "section": "FUNDO® LINEAR CHANNEL FRAME",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "073738206",
  "name": "wedi Fundo® Discreto Component",
  "size": "35 2/5 in. × 72 in. × 3 1/15 in.",
  "details": "Channel Length 26.8\" use with 48 x 60\"/32\" x 72\" Linear",
  "retail": 1037.41,
  "net": 628.73,
  "section": "FUNDO® DISCRETO",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "073738209",
  "name": "wedi Fundo® Discreto Component",
  "size": "47 1/4 in. × 72 in. × 3 1/15 in.",
  "details": "Channel Length 42.5\" use with 36 x 60\"/48 x 72\" Linear",
  "retail": 1130.4,
  "net": 685.09,
  "section": "FUNDO® DISCRETO",
  "discount": 52,
  "erp": ""
 },
 {
  "us": "US5000013",
  "name": "wedi® Joint Sealant Tube",
  "size": "10.5 oz cartridge of SMP hybrid sealant to waterproof and connect wedi assemblies",
  "details": "",
  "retail": 19.22,
  "net": 11.65,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "47735"
 },
 {
  "us": "US5000010",
  "name": "wedi® Joint Sealant Sausage",
  "size": "20 oz foil sausage of SMP hybrid sealant to waterproof and connect wedi assemblies",
  "details": "",
  "retail": 28.83,
  "net": 17.47,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "29647"
 },
 {
  "us": "US5000083",
  "name": "wedi® Sealant 620 Sausage",
  "size": "20 oz foil sausage of SMP hybrid sealant to waterproof and vaporproof wedi assemblies in steam rooms",
  "details": "",
  "retail": 41.46,
  "net": 25.13,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US5000088",
  "name": "wedi® Sealant 620 Cartridge",
  "size": "10.5 oz cartridge of SMP hybrid sealant to waterproof and vaporproof wedi assemblies in steam rooms",
  "details": "",
  "retail": 29.74,
  "net": 18.02,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "28866"
 },
 {
  "us": "US5000019",
  "name": "wedi® Sealant Gun",
  "size": "designed to work with both sizes of wedi joint sealant",
  "details": "",
  "retail": 64.45,
  "net": 39.06,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "29646"
 },
 {
  "us": "US5000020",
  "name": "wedi® Sealant Gun Tip",
  "size": "Replacement nozzle tips ( hard-plastic)",
  "details": "",
  "retail": 3.23,
  "net": 1.96,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "29648"
 },
 {
  "us": "US5000044",
  "name": "wedi® Corner Putty Knife",
  "size": "For application of wedi sealants over corner seams",
  "details": "",
  "retail": 3.23,
  "net": 1.96,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "US5000070",
  "name": "wedi® Fastener Kit",
  "size": "100 ct wedi 1 5/8\" Screws & 100 ct. wedi Washers with Tabs",
  "details": "*count determined by weight, actual count may vary",
  "retail": 32.83,
  "net": 19.9,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "28960"
 },
 {
  "us": "US5000086",
  "name": "wedi® Tabless Fastener Kit",
  "size": "100 ct wedi Tabless washers and screws",
  "details": "*count determined by weight, actual count may vary",
  "retail": 36.83,
  "net": 22.32,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "29999"
 },
 {
  "us": "US5000009",
  "name": "wedi® Washer Master Pack",
  "size": "1000 ct wedi washers with tabs",
  "details": "*count determined by weight, actual count may vary",
  "retail": 154.14,
  "net": 93.42,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "47832"
 },
 {
  "us": "US5000012",
  "name": "wedi® Screws Master Pack",
  "size": "1000 ct wedi Screws",
  "details": "*count determined by weight, actual count may vary",
  "retail": 100.89,
  "net": 61.14,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "47833"
 },
 {
  "us": "US5000018",
  "name": "wedi® Selftapping Screws",
  "size": "100 ct wedi selftapping screws",
  "details": "*count determined by weight, actual count may vary",
  "retail": 24.95,
  "net": 15.12,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "095215052",
  "name": "Self-adhesive Fiberglass Mesh Tape",
  "size": "24 in. x 164'",
  "details": "Alkali Resistant",
  "retail": 233.84,
  "net": 141.72,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": ""
 },
 {
  "us": "095225053",
  "name": "Self-adhesive Fiberglass Mesh Tape",
  "size": "5 in. x 82'",
  "details": "Alkali Resistant",
  "retail": 25.11,
  "net": 15.22,
  "section": "JOINT SEALANT, VAPOR BARRIERS & FASTENER SYSTEMS",
  "discount": 53,
  "erp": "47815"
 },
 {
  "us": "US5000001",
  "name": "wedi® Subliner Dry 53 ft2",
  "size": "Tileable waterproof sheet membrane (53 sft roll)",
  "details": "waterproofing",
  "retail": 92.37,
  "net": 55.98,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "29542"
 },
 {
  "us": "US5000005",
  "name": "wedi® Subliner Dry 323 ft2",
  "size": "Tileable waterproof sheet membrane (323 sft roll)",
  "details": "waterproofing",
  "retail": 494.01,
  "net": 299.4,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "28954"
 },
 {
  "us": "US5000002",
  "name": "wedi® Subliner Dry Sealing Tape",
  "size": "Tileable waterproof sheet membrane tape (32 ft roll)",
  "details": "fleece laminated",
  "retail": 42.06,
  "net": 25.49,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "29543"
 },
 {
  "us": "US5000000",
  "name": "wedi® Subliner Dry Mixing Valve Seal",
  "size": "To waterproof shower mixing valve openings in walls",
  "details": "per piece",
  "retail": 13.81,
  "net": 8.37,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "26897"
 },
 {
  "us": "US5000033",
  "name": "wedi® Subliner Dry Pipe Seal",
  "size": "To waterproof shower head protrusions in shower walls",
  "details": "per piece",
  "retail": 12.37,
  "net": 7.5,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "26896"
 },
 {
  "us": "US5000007",
  "name": "wedi® Subliner Dry Inside Corner",
  "size": "Tileable waterproof sheet membrane tape details for construction corner areas",
  "details": "per 2 pieces/bag",
  "retail": 14.85,
  "net": 9,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "29264"
 },
 {
  "us": "US5000008",
  "name": "wedi® Subliner Dry Outside Corner",
  "size": "Tileable waterproof sheet membrane tape details for construction corner areas",
  "details": "per 2 pieces/bag",
  "retail": 14.85,
  "net": 9,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "29265"
 },
 {
  "us": "US5000084",
  "name": "wedi® Subliner Dry Tub Tape",
  "size": "Waterproofing sheet membrane tape for tub to wall transition waterproofing",
  "details": "per roll",
  "retail": 49.48,
  "net": 29.99,
  "section": "SUBLINER DRY SHEET MEMBRANE SYSTEM",
  "discount": 53,
  "erp": "28875"
 },
 {
  "us": "US5076012",
  "name": "wedi®PRO-SET™ Tile Adhesive",
  "size": "25 lbs. Bag - 100 bags per pallet - Full Pallets Only",
  "details": "Modiﬁed tile adhesive optimized for adhesion with wedi® brand product surfaces in interior, wet area applications. For use with wedi® S-DRY™ Shower Systems.",
  "retail": 21.05,
  "net": 12.76,
  "section": "wedi® Preparation and Installation Pro-Systems",
  "discount": 42,
  "erp": ""
 }
];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// --- wedi's own planning figures (Illustrated PL pp.19–21) -------------------
export const CONSUMABLES = {
  sealantOzPerSf: 1.2,   // "covers shower wall, base and curb installation"
  fastenersPerSf: 1,     // 1 screw + washer per ft² of building panel
  fastenerKitCt: 100,
  // A curbless field seal is 620 sealant, quoted as an allowance rather than
  // per-foot: the perimeter, the Subliner laps and the recess all draw on it.
  curbless620Oz: 40,
  sausageOz: 20,
  tubeOz: 10.5,
};

export const TIERS = ["retail", "builder", "employee", "sale", "custom"];
export const BUILDER_MULT = 0.82;   // owner rule 2026-07-29, not the flat 8% off
const BUILDER_PCT = 18;             // the same rule as a percent off retail
export const SO_MIN_NET = 500;      // wedi small-order handling threshold

// The Builder stamp is tunable from Settings (a percent off retail beside the
// Sheoga markups). The canonical 18 resolves to the 0.82 constant rather than
// 1 − 18/100, which is 0.8200000000000001 in binary floating point.
const builderMult = (pct) => (pct == null || pct === BUILDER_PCT ? BUILDER_MULT : 1 - pct / 100);

// --- part numbers the recipes name ------------------------------------------
export const SKU = {
  panelDefault: "US8000017",    // 3×5×½ — the shop's bread-and-butter sheet
  curbLean60: "US3000038",
  curbLean96: "US3000040",
  coverSS: "US1000057",
  fastenerKit: "US5000070",
  sealantSausage: "US5000010",
  sealantTube: "US5000013",
  sealant620Sausage: "US5000083",
  sealant620Tube: "US5000088",
  gun: "US5000019",
  trowel: "US5000044",
  collarValve: "US5000000",
  collarPipe: "US5000033",
  subliner53: "US5000001",
  subCornerIn: "US5000007",
  sdrySeal: "US5076011",
  sdrySealTrowel: "US5076010",
  recessKit: "US5000085",
  ramp: "073736517",
  extFundo24: "073783528",
  extFundo12: "US3000036",
  extCurbless12: "US3000035",
  cornerFundo: "US3000053",
  cornerCurbless: "US3000052",
};

// Extension geometry. A straight adds 12" or 24" of pre-sloped depth along a
// side; it is cuttable in length and in depth (the trimmed edge is the high,
// thick one — the slope still lands on the pan), and stackable in depth.
// Curbless has only the 12" piece, so 24" is its ceiling.
const EXT = {
  fundo: { depths: [24, 12], max: 36, items: { 24: SKU.extFundo24, 12: SKU.extFundo12 }, corner: SKU.cornerFundo },
  curbless: { depths: [12], max: 24, items: { 12: SKU.extCurbless12 }, corner: SKU.cornerCurbless },
};
const MIN_GAP = 6;         // below this, cut the pan rather than shim a strip
const CORNER_MAX = 12;     // the 16½" corner piece wraps 12" of two straights
const TRIM_MAX = 6;        // the PREFERRED cut — up to 6" off an edge fits without comment (owner rule 2026-07-29)
const TRIM_HARD = 12;      // the ceiling: the offset bases are designed to cut up to a foot off to
                           // meet an existing waste line, so 6" is a soft rule (owner, 2026-07-31) —
                           // past it a placement is a separate "Deep cut" card the salesman chooses,
                           // never the only answer. Pinned-drain search only; the plain fit keeps 6".

// Riolito neo modules, off the 2026 illustrated price list's Channel Length
// column (p9). The ERP prints the 32"'s channel as 27-1/2 where the pricelist
// prints 27 19/32, so the table wins over either description — and the 54"
// module takes the same 43 19/64 channel as the 48", which is why both "fit
// with" the 43" covers.
const MODULE_LENGTHS = [32, 36, 42, 48, 54];
export const MODULE_CHANNEL = { 32: 27.59, 36: 31.5, 42: 35.44, 48: 43.31, 54: 43.31 };
export const MODULE_DEPTH = 5.75;
export const MODEXT_DEPTH = 66.75;
const COVER_NOMINALS = [27, 31, 35, 43];
// A module may be shortened at its ENDS only — wedi's cut rule keeps the line
// 1" clear of the drain channel's installation panel — so the margin outside
// the channel, less that inch, is all a module gives per end.
function moduleEndTrim(len) {
  const ch = MODULE_CHANNEL[len];
  return ch ? Math.max(0, round2((len - ch) / 2 - 1)) : 0;
}

export const FINISHES = {
  SS: "Stainless, brushed natural", T14: 'Tileable — ¼" tile', T38: 'Tileable — ⅜" tile',
  T: "Tileable", C: "Chrome, polished", B: "Brass, brushed", G: "Gold, polished",
  ORB: "Oil-rubbed bronze", MB: "Matte black", CHA: "Champagne", WHT: "White matte",
  CSL: "Chrome, polished slotted", SSP: "Stainless, perforated", MBP: "Matte black, perforated",
  BP: "Brass, perforated", CP: "Chrome, perforated",
};
// The finish word a cover's NAME carries (owner ask 2026-08-06); the fuller
// FINISHES text stays on the second line.
const FIN_SHORT = {
  SS: "Stainless", T14: 'Tileable ¼"', T38: 'Tileable ⅜"', T: "Tileable",
  C: "Chrome", B: "Brass", G: "Gold", ORB: "Oil-Rubbed Bronze", MB: "Matte Black",
  CHA: "Champagne", WHT: "White", CSL: "Chrome Slotted", SSP: "Stainless Perforated",
  MBP: "Matte Black Perforated", BP: "Brass Perforated", CP: "Chrome Perforated",
};

export const GROUP_LABEL = {
  pan: "Pans", module: "Linear modules", modExt: "Module extensions",
  extension: "Pan extensions", cornerExt: "Corner extensions", ramp: "Ramps",
  curb: "Curbs", panel: "Building panels", cover: "Drain covers",
  coverFrame: "Cover frames", drainKit: "Drain kits", recess: "Recess kits",
  niche: "Niches", shelf: "Niche shelves", seat: "Seats", bench: "Benches",
  fastener: "Fasteners", sealant: "Sealant", tool: "Tools", collar: "Collars & seals",
  subliner: "Subliner & tapes", kit: "Factory kits", sdry: "S-DRY system", misc: "Other",
};

// The Browse tab's taxonomy (owner sketch 2026-07-30): four labeled sections
// with sub-filters, plus Kits and S-Dry as their own quick filters. Every
// catalog entry lands in at least one section (wedi.test.js pins it).
export const BROWSE_SECTIONS = [
  { key: "pans", label: "Pans", subs: [
    { key: "standard", label: "Standard", hit: (e) => e.group === "pan" && e.sub === "fundo" },
    { key: "curbless", label: "Curbless", hit: (e) => e.group === "pan" && e.sub === "curbless" },
    { key: "linear", label: "Linear", hit: (e) => (e.group === "pan" && e.sub === "linear") || e.group === "module" },
    { key: "sdry", label: "S-Dry", hit: (e) => e.group === "pan" && e.sub === "sdry" },
  ] },
  { key: "covers", label: "Covers", subs: [
    { key: "square", label: "Square", hit: (e) => e.group === "cover" && e.sub === "point" },
    { key: "linear", label: "Linear", hit: (e) => e.group === "cover" && e.sub === "linear" },
    { key: "frames", label: "Frames", hit: (e) => e.group === "coverFrame" },
    { key: "drains", label: "Drains", hit: (e) => e.group === "drainKit" },
  ] },
  { key: "addons", label: "Add-ons", subs: [
    { key: "curbs", label: "Curbs", hit: (e) => e.group === "curb" },
    { key: "extensions", label: "Extensions", hit: (e) => e.group === "extension" || e.group === "cornerExt" || e.group === "modExt" || e.group === "ramp" },
    { key: "niches", label: "Niches", hit: (e) => e.group === "niche" || e.group === "shelf" },
    { key: "benches", label: "Benches", hit: (e) => e.group === "bench" || e.group === "seat" },
    { key: "panel", label: "Building panels", hit: (e) => e.group === "panel" },
  ] },
  { key: "misc", label: "Misc", subs: [
    { key: "sealant", label: "Sealant", hit: (e) => e.group === "sealant" },
    { key: "fasteners", label: "Fasteners", hit: (e) => e.group === "fastener" },
    { key: "tapes", label: "Tapes", hit: (e) => e.group === "subliner" },
    { key: "tools", label: "Tools", hit: (e) => e.group === "tool" || e.group === "recess" },
    { key: "collars", label: "Collars", hit: (e) => e.group === "collar" },
  ] },
  { key: "kits", label: "Kits", hit: (e) => e.group === "kit" },
  { key: "sdry", label: "S-Dry", hit: (e) => e.group === "sdry" || (e.group === "pan" && e.sub === "sdry") },
];
export const sectionHit = (sec, e) => (sec.hit ? sec.hit(e) : sec.subs.some((s) => s.hit(e)));

// ============================================================================
// number + dimension parsing
// ============================================================================

// "1 37/64", "27-1/2", "5 3/4", "3/8", "42.5" → inches.
function frac(s) {
  const t = String(s == null ? "" : s).trim().replace(/[–—]/g, "-");
  let m = t.match(/^(\d+(?:\.\d+)?)[\s-]+(\d+)\s*\/\s*(\d+)$/);
  if (m) return +m[1] + +m[2] / +m[3];
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return +m[1] / +m[2];
  m = t.match(/^(\d+(?:\.\d+)?)$/);
  return m ? +m[1] : null;
}

// Bare fractions first — "1/2" must not read as the "1" of a mixed number.
const NUM = "\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?(?:[\\s-]+\\d+\\s*\\/\\s*\\d+)?";
const UNIT = "(?:''|\"|in\\.?|inch(?:es)?|'|ft\\.?|feet)";
const DIM_RE = new RegExp(
  "(" + NUM + ")\\s*(" + UNIT + ")?\\s*[x×]\\s*(" + NUM + ")\\s*(" + UNIT + ")?" +
  "(?:\\s*[x×]\\s*(" + NUM + ")\\s*(" + UNIT + ")?)?", "i");

function isFeet(u) { return !!u && /^(?:'|ft\.?|feet)$/i.test(u.trim()); }

// Every dimension the two sheets print, in inches. Handles the pricelist's
// "36 in. x 60 in. x 1 37/64 in." and the ERP's "3'x5'", "4'x8'x1/2\"",
// "38x64", "32\"x5-3/4\"". Unit-less groups are read as FEET only when every
// value is ≤ 12 — "4x8" is a sheet, "38x64" is an S-DRY base. A digit-free
// parenthetical splits a group — "19 in. x 19 in. (wall sides) x 4 in." —
// so those drop first; parens carrying digits ARE the dims and stay.
export function dims(text) {
  const m = String(text == null ? "" : text).replace(/≈/g, "").replace(/\([^)\d]*\)/g, " ").match(DIM_RE);
  if (!m) return null;
  const raw = [], units = [];
  for (let i = 1; i < 7; i += 2) {
    if (m[i] == null) continue;
    const v = frac(m[i]);
    if (v == null) return null;
    raw.push(v); units.push(m[i + 1] || "");
  }
  if (raw.length < 2) return null;
  // A unit-less value is inches, except when the whole group is unit-less and
  // every value is ≤ 12 — "4x8" is a sheet in feet, "38x64" a base in inches.
  const bareFeet = units.every((u) => !u) && raw.every((v) => v <= 12);
  return raw.map((v, k) => (isFeet(units[k]) || (bareFeet && !units[k]) ? v * 12 : v));
}

// A flat board's W × D × T. The thinnest value is the thickness whenever it
// reads like one; the other two keep source order.
function board(vals) {
  if (!vals) return {};
  if (vals.length < 3) return { w: vals[0], d: vals[1] };
  const min = Math.min.apply(null, vals);
  if (min >= 4) return { w: vals[0], d: vals[1], t: vals[2] };
  const rest = [];
  let t = null;
  for (let i = 0; i < vals.length; i++) {
    if (t == null && vals[i] === min) t = vals[i];
    else rest.push(vals[i]);
  }
  return { w: rest[0], d: rest[1], t: t };
}

function nominalLen(actual) {
  if (actual == null) return null;
  let best = null, bd = 2.01;
  COVER_NOMINALS.forEach((n) => {
    const dd = Math.abs(n - actual);
    if (dd < bd) { bd = dd; best = n; }
  });
  return best;
}

// Back to the sheets' own fractions — a pan is 1 37/64" thick, not 1.58".
export function inch(n) {
  const whole = Math.floor(n + 1e-9), rem = n - whole;
  if (rem < 1e-6) return String(whole);
  let den = 64, num = Math.round(rem * den);
  if (num === den) return String(whole + 1);
  while (num % 2 === 0 && den % 2 === 0) { num /= 2; den /= 2; }
  return (whole ? whole + " " : "") + num + "/" + den;
}

function sizeTextOf(w, d, t) {
  if (w == null || d == null) return "";
  return inch(w) + '" x ' + inch(d) + '"' + (t != null ? " x " + inch(t) + '"' : "");
}

// 36 → 3', 38 → 3'2" — how the trade says a base size (owner 2026-08-06),
// matching the Kits tab's foot-led cards (issue 075).
function ftLbl(n) {
  if (!(n >= 12)) return inch(n) + '"';
  const f = Math.floor(n / 12), r = round2(n - f * 12);
  return f + "'" + (r ? inch(r) + '"' : "");
}

function cleanDesc(desc, us) {
  let s = String(desc || "");
  if (us) s = s.split(us).join(" ");
  return s.replace(/\s+-\s*$/, "").replace(/\s+-\s+/g, " — ").replace(/\s{2,}/g, " ").trim();
}

// The pricelist prints a non-dimensional item's CONTENTS in its size column,
// mixed into prose — "100 ct wedi 1 5/8" Screws & 100 ct. wedi Washers with
// Tabs", "20 oz foil sausage of SMP hybrid sealant to waterproof…" — and a
// bag count in details ("per 2 pieces/bag"). Keep the quantity statement and
// drop the prose: a Fastener Kit row that doesn't say 100 ct reads as one
// screw at the order desk.
function contentOf(s) {
  const t = String(s || "").replace(/\bwedi\b\s*®?\s*/gi, " ").replace(/\s{2,}/g, " ").trim();
  const per = t.match(/\bper\s+(\d+)\s*(?:pieces?|pcs?\.?)?\s*\/\s*(?:bag|bg)\b/i);
  if (per) return per[1] + " per bag";
  if (!/^\d/.test(t)) {
    const par = t.match(/\((\d[^)]*)\)/);
    return par ? par[1].trim() : "";
  }
  return t.split(/\s+-\s+/)[0].replace(/\s+(?:of|to|for)\s.*$/i, "").trim();
}

// ============================================================================
// classification
// ============================================================================

const SET = (list) => {
  const o = {};
  list.forEach((k) => { o[k] = true; });
  return o;
};
const POINT_COVERS = SET(["US1000047", "US1000053", "US1000054", "US1000055", "US1000056",
  "US1000057", "US1000058", "US1000060", "US1000062", "US1000124", "US1000125"]);
const DRAIN_KITS = SET(["077000054", "US1000003", "US1000004", "US1000035", "US5000022"]);
const FASTENERS = SET(["US5000070", "US5000086", "US5000009", "US5000012", "US5000018", "US5000089"]);
const SEALANTS = SET(["US5000013", "US5000010", "US5000083", "US5000088"]);
const TOOLS = SET(["US5000019", "US5000020", "US5000044", "US5000032", "US7000058"]);
const COLLARS = SET(["US5000000", "US5000033"]);
const SUBLINER = SET(["US5000001", "US5000005", "US50000005", "US5000002", "US5000007",
  "US5000008", "US5000084", "095225053", "095215052"]);
const NICHES = SET(["US3000003", "US3000004", "US3000005", "US3000007", "US3000016",
  "US3000024", "US3000051", "US3000248"]);
const SHELVES = SET(["US3000050", "US3000245", "US3000246"]);
const SEATS = SET(["US3000001", "US3000002"]);
const BENCHES = SET(["US3000000", "US3000042", "US3000043", "US3000044", "US3000045",
  "US3000046", "US3000047", "US3000054", "US3000055", "US3000056"]);
const CURBS = {
  US3000039: "full", US3000041: "full", US3000038: "lean", US3000040: "lean",
  US3000008: "cap", US3000010: "cap", US3000048: "at", US3000049: "at",
};
// The pricelist's curb names ("wedi Fundo® Shower Curb Lean AT 60"") read as
// one confusing string at the desk (owner ask 2026-08-06) — every curb shows
// as <length>" <profile> Curb instead, everywhere a name renders.
const CURB_NAMES = {
  US3000039: '60" Full Foam Curb', US3000041: '96" Full Foam Curb',
  US3000038: '60" Lean Curb', US3000040: '96" Lean Curb',
  US3000048: '60" Full Foam AT Curb', US3000049: '60" Lean AT Curb',
  US3000008: '60" Curb Cap', US3000010: '96" Curb Cap',
};
const EXT_SUBS = {
  "073783528": ["extension", "fundo"], US3000036: ["extension", "fundo"],
  US3000035: ["extension", "curbless"], US3000053: ["cornerExt", "fundo"],
  US3000052: ["cornerExt", "curbless"], "073736517": ["ramp", "fundo"],
};
// The ERP still carries wedi's pre-US part numbers for three linear pieces the
// pricelist only prints under a US sku (or, for the SS frames, not at all).
const LEGACY = {
  "676797048": ["cover", "linear"], "676800061": ["coverFrame", "linear"],
  "676800064": ["coverFrame", "linear"], "075100052": ["module", "legacy"],
  "073738206": ["module", "discreto"], "073738209": ["module", "discreto"],
};

function classify(us, name) {
  const u = String(us || ""), n = String(name || "");
  if (/^US\d\d76\d{3}$/.test(u)) return /^US9176/.test(u) ? ["pan", "sdry"] : ["sdry", ""];
  if (LEGACY[u]) return LEGACY[u];
  if (/^US9100/.test(u)) return ["pan", "fundo"];
  if (/^US9200/.test(u)) return ["pan", "curbless"];
  if (/^US9310/.test(u)) return ["pan", "linear"];
  if (/^US9320/.test(u)) return ["module", "neo"];
  if (/^US9330/.test(u)) return ["modExt", "neo"];
  if (/^US9400/.test(u) || DRAIN_KITS[u]) return ["drainKit", /subliner/i.test(n) ? "subliner" : ""];
  if (/^US2[01]00/.test(u)) return ["kit", /nojs/i.test(n) ? "nojs" : "complete"];
  if (/^US4000/.test(u)) return ["panel", "kit"];
  if (/^US8000/.test(u)) return ["panel", /vapor/i.test(n) ? "vapor" : "board"];
  if (EXT_SUBS[u]) return EXT_SUBS[u];
  if (CURBS[u]) return ["curb", CURBS[u]];
  if (NICHES[u]) return ["niche", ""];
  if (SHELVES[u]) return ["shelf", ""];
  if (SEATS[u]) return ["seat", ""];
  if (BENCHES[u]) return ["bench", /bench kit/i.test(n) ? "kit" : "sanoasa"];
  if (/^US1000/.test(u)) {
    if (/frame/i.test(n)) return ["coverFrame", "linear"];
    return ["cover", POINT_COVERS[u] ? "point" : "linear"];
  }
  if (u === "US5000085") return ["recess", ""];
  if (FASTENERS[u]) return ["fastener", /vapor/i.test(n) ? "vapor" : ""];
  if (SEALANTS[u]) return ["sealant", /620/.test(u + " " + n) ? "620" : "joint"];
  if (TOOLS[u]) return ["tool", ""];
  if (COLLARS[u]) return ["collar", ""];
  if (SUBLINER[u]) return ["subliner", /mesh|fiberglass/i.test(n) ? "mesh" : ""];
  return ["misc", ""];
}

// ============================================================================
// catalog
// ============================================================================

let CAT = null, INDEX = null;

function unitOf(stockRow, soRow) {
  if (stockRow && stockRow.unit) return stockRow.unit;
  const d = soRow ? String(soRow.details || "") : "";
  if (/per roll|\/roll|\broll\b/i.test(d)) return "RL";
  if (/\/bag|per bag|\bbag\b/i.test(d)) return "BG";
  if (/\/box|per box/i.test(d)) return "BX";
  return "EA";
}

// Where wedi puts an off-centre drain, base by base — read off the dimensioned
// drawings in the 2026 illustrated price list (pp. 5, 7, 32). It is no fixed
// fraction of the base: the drain is centred ACROSS the width and this far
// along from the near end. A base the pricelist doesn't draw keeps the
// quarter-length estimate below and says so on the card.
const OFFSET_DRAIN = {
  US9100005: { x: 18, y: 13.75 },   // fundo 36 x 72
  US9200007: { x: 18, y: 11.25 },   // curbless 36 x 60
  US9176002: { x: 19, y: 12 },      // S-DRY 38 x 64
};

// And where the linear bases put their channel (same drawings, p9). There is
// no rule to derive: the 48x60 runs its channel along the SHORT wall while its
// two siblings run theirs along the long one, and the inset off that wall is
// 6" on one and 8" on the others. `along` is the side the channel is parallel
// to, `inset` its distance from that wall; the outlet is the channel's centre.
const LINEAR_DRAIN = {
  US9310001: { along: 60, inset: 6 },
  US9310002: { along: 48, inset: 8 },
  US9310003: { along: 72, inset: 8 },
};

function drainOf(entry, text) {
  const t = String(text || "").toLowerCase();
  let type = /linear|4 sided slope|channel/.test(t) ? "linear"
    : /offset|corner/.test(t) ? "offset" : "center";
  if (entry.sub === "linear") type = "linear";
  const w = entry.w, d = entry.d;
  if (type === "linear") {
    const ch = entry.channel || 0;
    const spec = LINEAR_DRAIN[entry.us];
    const alongD = spec ? spec.along === d : d >= w;
    const inset = spec ? spec.inset : 6;
    return alongD
      ? { type: type, x: inset, y: round2(d / 2), len: ch, axis: "d", note: "" }
      : { type: type, x: round2(w / 2), y: inset, len: ch, axis: "w", note: "" };
  }
  if (type === "offset") {
    const known = OFFSET_DRAIN[entry.us];
    if (known) return { type: type, x: known.x, y: known.y, len: 0, axis: null, note: "" };
    return {
      type: type, x: round2(w / 2), y: round2(d * 0.25), len: 0, axis: null,
      note: "offset drain — estimated position; read the exact one off the wedi spec sheet at install",
    };
  }
  return { type: type, x: round2(w / 2), y: round2(d / 2), len: 0, axis: null, note: "" };
}

// The neo line module's own drain (p9 drawings): the channel runs the module's
// length, and both the channel and the click-and-seal outlet sit dead centre —
// the half/half length marks and the 2 7/8" off a 5 3/4" depth.
function moduleDrain(e) {
  if (!e.channel || !(e.len > 0)) return null;
  return { type: "linear", x: round2(e.len / 2), y: round2((e.d || MODULE_DEPTH) / 2), len: e.channel, axis: "w", note: "" };
}

function finishOf(name, desc) {
  const tail = (String(name || "").trim().split(/\s+/).pop() || "").toUpperCase();
  // "T38" and "T14" are whole finish codes; "MB27"/"27MB" are a finish plus a
  // cover length, printed in either order.
  if (FINISHES[tail]) return { finish: tail, len: null };
  const letters = tail.replace(/[^A-Z]/g, "");
  const digits = tail.replace(/\D/g, "");
  if (letters && digits && FINISHES[letters]) return { finish: letters, len: nominalLen(+digits) };
  const d = String(desc || "");
  const fin = /stainless|\bss\b/i.test(d) ? "SS" : /matte black|\bmb\b/i.test(d) ? "MB"
    : /tileable/i.test(d) ? "T" : /chrome/i.test(d) ? "C" : /brass/i.test(d) ? "B" : null;
  const lead = d.match(/(\d+(?:\.\d+)?)\s*"/);
  return { finish: fin, len: lead ? nominalLen(+lead[1]) : null };
}

function makeEntry(stockRow, soRow) {
  const us = (soRow && soRow.us) || (stockRow && stockRow.us) || "";
  const name = soRow ? String(soRow.name || "") : cleanDesc(stockRow.desc, stockRow.us);
  // Classify off the NAME only: a point cover's size text reads "cover and
  // frame made from stainless steel…", which would file it as a cover frame.
  const g = classify(us, name);
  const e = {
    key: us || (stockRow && stockRow.erp) || "",
    us: us,
    erp: (stockRow && stockRow.erp) || (soRow && soRow.erp) || "",
    stock: !!stockRow,
    name: name,
    group: g[0],
    sub: g[1] || "",
    w: null, d: null, t: null, sf: null, len: null,
    finish: null, drain: null, channel: null,
    cost: stockRow ? stockRow.cost : (soRow ? soRow.net : 0),
    retail: stockRow ? stockRow.retail : (soRow ? soRow.retail : 0),
    unit: unitOf(stockRow, soRow),
    section: (soRow && soRow.section) || "",
    details: (soRow && soRow.details) || "",
    size: (soRow && soRow.size) || "",
    sizeText: "",
    soRetail: soRow ? soRow.retail : null,
    soNet: soRow ? soRow.net : null,
    desc: (stockRow && stockRow.desc) || "",
  };

  // Size text: the pricelist's own words where they exist (they carry the
  // thickness), otherwise the ERP description.
  const srcs = [];
  if (soRow) { srcs.push(soRow.size); srcs.push(soRow.name); }
  if (stockRow) srcs.push(stockRow.desc);
  let vals = null;
  for (let i = 0; i < srcs.length && !vals; i++) vals = dims(srcs[i]);
  const b = board(vals);
  e.w = b.w != null ? b.w : null;
  e.d = b.d != null ? b.d : null;
  e.t = b.t != null ? b.t : null;

  const text = (soRow ? soRow.name + " " + soRow.size + " " + soRow.details : "") + " " + (stockRow ? stockRow.desc : "");

  if (e.group === "pan") {
    if (e.sub === "linear") {
      const ch = String(text).match(new RegExp("(" + NUM + ")\\s*in\\.?\\s*channel", "i"));
      const chv = ch ? frac(ch[1].trim()) : null;
      e.channel = chv == null ? null : round2(chv);
    }
    e.drain = drainOf(e, text);
    e.sizeText = sizeTextOf(e.w, e.d, e.t);
    // Bases read size-first BY THE FOOT, inches on the second line (owner
    // asks 2026-08-06); an offset drain is named because two same-size bases
    // can differ only there. Derived, so a pricelist re-transcription keeps
    // the treatment.
    if (e.w && e.d) {
      const fam = e.sub === "curbless" ? "Curbless Shower Base"
        : e.sub === "linear" ? "Linear Shower Base"
          : e.sub === "sdry" ? "S-Dry Shower Base" : "Shower Base";
      e.name = ftLbl(e.w) + "x" + ftLbl(e.d) + " " + fam
        + (e.drain && e.drain.type === "offset" ? " — Offset Drain" : "");
    }
  } else if (e.group === "module") {
    e.len = Math.max(e.w || 0, e.d || 0) || null;
    if (e.sub !== "discreto") { e.w = e.len; e.d = MODULE_DEPTH; e.channel = MODULE_CHANNEL[e.len] || null; }
    else {
      const dc = String(text).match(/channel length\s*([\d.]+)/i);
      e.channel = dc ? +dc[1] : null;
    }
    e.drain = moduleDrain(e);
    e.sizeText = sizeTextOf(e.w, e.d, null);
  } else if (e.group === "modExt") {
    // Every module extension is 66¾" deep, so the module length is the other
    // number whichever way round the sheet printed it.
    e.len = Math.min(e.w || 0, e.d || 0) || null;
    e.w = e.len; e.d = MODEXT_DEPTH;
    e.sizeText = sizeTextOf(e.w, e.d, null);
  } else if (e.group === "extension" || e.group === "cornerExt" || e.group === "ramp") {
    // The two sheets print these both ways round ("48 x 24", "12 x 60"), so
    // normalize: w is the run, d the depth it adds.
    const lo = Math.min(e.w, e.d), hi = Math.max(e.w, e.d);
    e.w = hi; e.d = lo; e.len = hi;
    e.sizeText = sizeTextOf(e.w, e.d, e.t);
  } else if (e.group === "curb") {
    const all = (vals || []).slice().sort((a, c) => c - a);
    e.len = all[0] || null;
    e.w = all[1] != null ? all[1] : null;   // profile height
    e.d = all[2] != null ? all[2] : null;   // profile width
    // The length lives in the display name, so the size line stays empty and
    // a curb's second line reads as just the SKU (owner ask 2026-08-06).
    e.sizeText = "";
    if (CURB_NAMES[e.us]) e.name = CURB_NAMES[e.us];
  } else if (e.group === "panel") {
    if (e.w && e.d) e.sf = round2(e.w * e.d / 144);
    e.sizeText = sizeTextOf(e.w, e.d, e.t);
    // Panels read by the foot — 4'x5'x1/2" Building Panel — with the SKU and
    // the inches on the second line (owner ask 2026-08-06). Derived from the
    // parsed dims, so a pricelist re-transcription keeps the treatment.
    if (e.sub !== "kit" && e.w && e.d && e.t) {
      const ft = (n) => (n % 12 === 0 ? n / 12 + "'" : inch(n) + '"');
      e.name = ft(Math.min(e.w, e.d)) + "x" + ft(Math.max(e.w, e.d)) + "x" + inch(e.t) + '" '
        + (e.sub === "vapor" ? "Vapor 85 Building Panel" : "Building Panel");
    }
  } else if (e.group === "cover" || e.group === "coverFrame") {
    const f = finishOf(name, e.desc);
    e.finish = f.finish;
    if (e.sub === "linear") { e.len = f.len; e.channel = f.len; }
    e.sizeText = e.sub === "linear" ? (e.len ? e.len + '" channel' : "") : '4" x 4"';
    // Covers drop the vendor's finish CODES (SS/MB/T38) for words (owner ask
    // 2026-08-06). Size and finish both live in the name, so the size line
    // stays empty and a cover's second line is just the SKU — the fuller
    // finish text survives as the swatch dot's tooltip.
    if (e.group === "cover" && e.finish) {
      e.name = (e.sub === "linear" ? (e.len ? e.len + '" ' : "") + "Linear Drain Cover" : '4"x4" Drain Cover')
        + " — " + (FIN_SHORT[e.finish] || FINISHES[e.finish] || e.finish);
      e.sizeText = "";
    }
  } else if (e.group === "niche") {
    // The pricelist names a niche by its INTERIOR and sizes it by the
    // EXTERIOR with nothing saying which is which. The exterior leads the
    // name — it's the wall opening — and the interior is spelled out on the
    // second line (owner ask 2026-08-06). Interior parses off the vendor
    // name, falling back to the 4" flange rule the whole line follows.
    if (e.w && e.d) {
      const im = String(name).match(/(\d+)\s*"\s*x\s*(\d+)\s*"/);
      const iw = im ? +im[1] : e.w - 4, id = im ? +im[2] : e.d - 4;
      e.name = inch(e.w) + '"x' + inch(e.d) + '" '
        + (/cathedral|"CAT/i.test(name + " " + e.desc) ? "Cathedral Shower Niche" : "Shower Niche");
      e.sizeText = iw > 0 && id > 0 ? "interior " + inch(iw) + '" x ' + inch(id) + '"' : "";
    } else {
      e.sizeText = contentOf(e.size) || contentOf(e.details);
    }
  } else if (e.group === "kit") {
    e.sizeText = sizeTextOf(e.w, e.d, null);
    e.drain = { type: /offset/i.test(text) ? "offset" : /linear|module/i.test(text) ? "linear" : "center" };
    e.sub = /nojs/i.test(name) ? "nojs" : "complete";
    e.family = /curbless/i.test(text) ? "curbless" : /linear/i.test(text) ? "linear" : "fundo";
  } else if (e.group === "subliner") {
    const sfm = String(text).match(/(\d+)\s*(?:sft|sf|ft2)\b/i);
    if (sfm) e.sf = +sfm[1];
    e.sizeText = contentOf(e.size) || contentOf(e.details);
  } else {
    e.sizeText = e.w && e.d ? sizeTextOf(e.w, e.d, e.t) : (contentOf(e.size) || contentOf(e.details));
  }
  return e;
}

function buildCatalog() {
  const soRows = WEDI_SO.filter((r) => !r.kitNote);
  const byErp = {}, byUs = {};
  soRows.forEach((r) => {
    if (r.erp) byErp[r.erp] = r;
    if (r.us) byUs[r.us] = r;
  });
  const used = {}, out = [];
  // Stock outranks a matching pricelist row: one entry, stock:true, cost and
  // retail off the ERP (the pricelist figures ride along as soRetail/soNet —
  // the two linear extensions are the only pair that disagree).
  WEDI_STOCK.forEach((row) => {
    const so = (row.erp && byErp[row.erp]) || (row.us && byUs[row.us]) || null;
    if (so) used[so.us] = true;
    out.push(makeEntry(row, so));
  });
  soRows.forEach((row) => {
    if (used[row.us]) return;
    out.push(makeEntry(null, row));
  });
  INDEX = {};
  out.forEach((e) => {
    if (!INDEX[e.key]) INDEX[e.key] = e;
    if (e.erp && !INDEX[e.erp]) INDEX[e.erp] = e;
  });
  // The ERP mis-keys one Subliner roll as US50000005; keep it findable.
  WEDI_STOCK.forEach((row) => { if (row.us && !INDEX[row.us] && INDEX[row.erp]) INDEX[row.us] = INDEX[row.erp]; });
  return out;
}

export function catalog() {
  if (!CAT) CAT = buildCatalog();
  return CAT;
}
export function item(key) {
  catalog();
  return INDEX[key] || null;
}
export function group(g) {
  return catalog().filter((e) => e.group === g);
}

// Every pan the configurator will build on. S-DRY bases are stocked and
// searchable but are a separate system — they stay out of the kit/solver tabs.
export function pans(opts) {
  opts = opts || {};
  const list = group("pan").filter((p) => {
    if (p.sub === "sdry" && !opts.sdry) return false;
    if (opts.family && p.sub !== opts.family) return false;
    if (opts.drain && opts.drain !== "any" && (!p.drain || p.drain.type !== opts.drain)) return false;
    return true;
  });
  const order = { fundo: 0, curbless: 1, linear: 2, sdry: 3 };
  return list.sort((a, b) => (order[a.sub] - order[b.sub]) || (a.w * a.d - b.w * b.d) || (a.w - b.w));
}

// The curb list in profile order (owner ask 2026-08-06): full foam, then
// lean, then AT (full AT before lean AT), caps last; 60" before 96".
const CURB_ORDER = { full: 0, lean: 1, at: 2, cap: 3 };
export function curbs() {
  return group("curb").slice().sort((a, b) => (CURB_ORDER[a.sub] - CURB_ORDER[b.sub])
    || ((/lean/i.test(a.name) ? 1 : 0) - (/lean/i.test(b.name) ? 1 : 0))
    || ((a.len || 0) - (b.len || 0)));
}

// ============================================================================
// tiers
// ============================================================================

export function tierPrice(entry, tier, pct) {
  if (!entry) return 0;
  const retail = +entry.retail || 0, cost = +entry.cost || 0;
  switch (tier) {
    case "builder": return round2(retail * builderMult(pct));
    case "employee": return round2(cost * 1.06);
    case "sale": return round2(retail * (1 - (pct == null ? 10 : pct) / 100));
    case "custom": return round2(retail * (1 - (pct == null ? 0 : pct) / 100));
    default: return round2(retail);
  }
}

// ============================================================================
// consumables
// ============================================================================

function sealantItem(form, six20) {
  if (six20) return item(form === "tube" ? SKU.sealant620Tube : SKU.sealant620Sausage);
  return item(form === "tube" ? SKU.sealantTube : SKU.sealantSausage);
}

export function figureConsumables(panelSf, form) {
  const sf = Math.max(0, +panelSf || 0);
  form = form === "tube" ? "tube" : "sausage";
  const oz = round2(sf * CONSUMABLES.sealantOzPerSf);
  const per = form === "tube" ? CONSUMABLES.tubeOz : CONSUMABLES.sausageOz;
  const fastenerCount = Math.ceil(sf * CONSUMABLES.fastenersPerSf);
  const lines = [];
  if (sf > 0) {
    // No per-ft² note (owner ask 2026-07-30): the line reads the kit's own
    // contents — "100 ct … Screws & … Washers with Tabs" — nothing else.
    lines.push({
      item: item(SKU.fastenerKit), qty: Math.ceil(fastenerCount / CONSUMABLES.fastenerKitCt),
      group: "install", auto: true, note: "",
    });
    lines.push({
      item: sealantItem(form, false), qty: Math.ceil(oz / per),
      group: "install", auto: true,
      note: CONSUMABLES.sealantOzPerSf + " oz per ft² — " + oz + " oz",
    });
  }
  return { panelSf: round2(sf), sealantOz: oz, fastenerCount: fastenerCount, form: form, lines: lines };
}

// ============================================================================
// kit builder
// ============================================================================

function defaultWalls(pan, room, h) {
  h = h || 80;
  let lo, hi;
  if (room && room.w && room.d) { hi = room.w; lo = room.d; }
  else if (pan.group === "module") { hi = pan.len; lo = MODULE_DEPTH + MODEXT_DEPTH; }
  else { hi = Math.max(pan.w, pan.d); lo = Math.min(pan.w, pan.d); }
  return [{ len: hi, h: h, side: "back" }, { len: lo, h: h, side: "left" }, { len: lo, h: h, side: "right" }];
}

function wallSf(walls) {
  return round2((walls || []).reduce((s, w) => s + (+w.len || 0) * (+w.h || 0) / 144, 0));
}

// A wall's wedi coverage (owner, round 6): "in" — the inside face only, the
// default — "both" sides, or "in-end" — inside plus the exposed 4" end of a
// partial wall. The planner sees each extra face as its own wall: the outside
// face at full length, the end as a WALL_THICK-wide strip, appended AFTER the
// base list so callers indexing the plan's detail by wall still line up.
export const WALL_THICK = 4;     // framing depth — the drawings draw it true
export function expandWallFaces(walls) {
  const out = (walls || []).slice();
  (walls || []).forEach((w) => {
    if (w.faces === "both") out.push({ len: w.len, h: w.h, side: w.side, face: "out" });
    else if (w.faces === "in-end") out.push({ len: WALL_THICK, h: w.h, side: w.side, face: "end" });
  });
  return out;
}

// The room's open perimeter — the edge runs no wall covers. Walls anchor at
// the drawing's origin corner of their side (back/entry at the left end,
// left/right at the back end), so each edge's covered run starts there and
// the open run is whatever remains toward the far corner. Curbs sit on these
// runs, and a 45° corner cut only makes sense where they meet.
// WHERE each wall sits along its edge, as merged covered intervals. A run is
// anchored at the LOW end of its side by default — x = 0 on the back and entry,
// y = 0 (the back) on a side wall — which is what every wall was before
// 2026-08-03; `at: "hi"` puts it at the other end, so a half wall can return
// from the right side wall instead of the left (owner ask). Two returns with a
// walk-in gap between them are simply two walls, one at each end.
const EDGE_MAX = (side, rw, rd) => (side === "left" || side === "right" ? rd : rw);
function mergeSpans(list) {
  const out = [];
  list.slice().sort((a, b) => a[0] - b[0]).forEach((v) => {
    const last = out[out.length - 1];
    if (last && v[0] <= last[1] + 0.01) last[1] = Math.max(last[1], v[1]);
    else out.push([v[0], v[1]]);
  });
  return out;
}
// The open complement of a side's covered intervals. Slivers under ½" are not
// runs — the same tolerance the rest of the ring math uses.
function gapSpans(spans, max) {
  const out = [];
  let u = 0;
  spans.forEach((sp) => { if (sp[0] - u > 0.5) out.push([round2(u), round2(sp[0])]); u = Math.max(u, sp[1]); });
  if (max - u > 0.5) out.push([round2(u), round2(max)]);
  return out;
}
export function wallSpans(dims, walls) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  const out = { back: [], left: [], right: [], entry: [] };
  (walls || []).forEach((w) => {
    const max = EDGE_MAX(w.side, rw, rd);
    if (!out[w.side] || !(max > 0)) return;
    const len = Math.min(+w.len || 0, max);
    if (!(len > 0.01)) return;
    const from = w.at === "hi" ? round2(max - len) : 0;
    out[w.side].push([from, round2(from + len)]);
  });
  Object.keys(out).forEach((k) => { out[k] = mergeSpans(out[k]); });
  return out;
}
// Does a side carry wall right AT one of its ends? The corner tests used to
// read this off `cov` alone, which only worked while every wall started at 0.
export const spanAtLo = (spans) => !!(spans[0] && spans[0][0] <= 0.5);
export const spanAtHi = (spans, max) => !!(spans.length && spans[spans.length - 1][1] >= max - 0.5);

export function openEdges(dims, walls) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  const spans = wallSpans(dims, walls);
  const cov = { back: 0, left: 0, right: 0, entry: 0 };
  Object.keys(cov).forEach((k) => { cov[k] = round2(spans[k].reduce((t, sp) => t + (sp[1] - sp[0]), 0)); });
  const edges = [];
  [["back", rw], ["left", rd], ["right", rd], ["entry", rw]].forEach((e) => {
    gapSpans(spans[e[0]], e[1]).forEach((g) => edges.push({ side: e[0], from: g[0], len: round2(g[1] - g[0]) }));
  });
  return { edges: edges, openLen: round2(edges.reduce((s, e) => s + e.len, 0)), cov: cov, spans: spans };
}

// Where the curb actually runs (owner sketches 2026-07-30): the open edge
// runs, with a corner cut re-routing it as ONE straight line — never a
// dogleg. Each cut carries a leg along each adjacent edge: when that edge
// HAS a wall, the leg spans the whole open run so the line lands on the
// wall's end (the owner's "always a straight line from one wall to
// another", however far that is); an edge with no wall at all — or walled
// clear to the corner — takes the standard CORNER_CUT leg (the classic
// neo-angle chamfer / a cut against the wall face). The straight runs give
// up exactly those legs, so nothing is stranded behind the cut.
export const CORNER_CUT = 12;    // the cut's default leg along each edge
export const CURB_W = 3.5;       // the curb's plan width — ring fills + longest-point math

// Real curb cross-sections (owner, 2026-07-30): every curb is notched on
// its back edge to lap ½" onto the pan, so it ADDS (width − ½") of floor.
// The standard/full-foam/AT curbs are 4½" across the top (price list
// agrees: 5⅛ × 4½ H×W) — they add 4". The lean is 2" across the top
// (owner measured a physical piece 2026-07-31, matching the price list's
// 3½ × 2 H×W) — adds 1½". These drive the "overall max" solver
// mode, where the stated dimensions INCLUDE the curb: each fully open edge
// gives up (width − lap) of pan space and the curb draws inside the line.
export const CURB_LAP = 0.5;
export function curbWidth(key) {
  const it = typeof key === "string" ? item(key) : key;
  return it && /lean/i.test(it.name || "") ? 2 : 4.5;
}

// Per-edge inset when the stated dims are the overall footprint. Only an
// edge with NO wall at all pulls its curb in (a partially walled edge keeps
// the curb in the ring — v1); curbless builds inset nothing.
//
// `tile` is the finish thickness that lands on the curb's outer face (owner,
// 2026-08-03). The stated footprint is what the shower may not exceed, so the
// tile has to come out of it too: the curb steps that much further inside the
// line and the pan gives it up along with the curb's own width. It rides on
// the returned object so the drawings can hold the curb off the line by the
// same amount.
export function curbInsets(dims, walls, curbKey, tile) {
  if (!curbKey) return null;
  const cov = openEdges(dims, walls).cov;
  const t = Math.max(0, +tile || 0);
  // 1/1000", not round2: tile arrives in odd eighths (⅜ = .375) and rounding
  // those to the hundredth is a rounding no tape measure asked for.
  const ins = Math.round((curbWidth(curbKey) - CURB_LAP + t) * 1000) / 1000;
  const at = (side) => (cov[side] < 0.5 ? ins : 0);
  const o = { back: at("back"), left: at("left"), right: at("right"), entry: at("entry"), cw: curbWidth(curbKey), tile: t };
  return o.back || o.left || o.right || o.entry ? o : null;
}

// Re-base a solved option (solved on the inset dims) into the full shower:
// pieces and drain shift past the left/back insets, the room reads the full
// stated size — walls and curb runs keep figuring on it — and `inset` rides
// along so the drawings pull the curb inside the line.
export function applyCurbInset(o, insets, dims) {
  const ox = insets.left, oy = insets.back;
  return {
    ...o,
    pieces: o.pieces.map((p) => ({ ...p, x: round2(p.x + ox), y: round2(p.y + oy) })),
    drain: o.drain ? { ...o.drain, x: round2(o.drain.x + ox), y: round2(o.drain.y + oy) } : null,
    room: { w: round2(+dims.w || 0), d: round2(+dims.d || 0) },
    inset: insets,
  };
}
export function curbRuns(dims, walls, corners, benches) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  const open = openEdges(dims, walls);
  const cov = open.cov;
  const cut = {};
  (corners || []).forEach((k) => { cut[k] = true; });
  // Does a perpendicular wall band occupy the ring corner? Vertical bands
  // reach the back corners whenever the wall exists at all, the entry
  // corners only when the wall runs the full depth.
  const sp = open.spans;
  const wallFills = (corner) =>
    corner === "bl" ? spanAtLo(sp.left) : corner === "br" ? spanAtLo(sp.right)
      : corner === "fl" ? spanAtHi(sp.left, rd) : spanAtHi(sp.right, rd);
  // Per adjacent edge of each corner (h = along the back/entry edge, v =
  // along the left/right edge): the open run touching the corner (0 = walled
  // to it) and how much wall the edge carries.
  const openAt = (side, end) => {
    const max = side === "left" || side === "right" ? rd : rw;
    const runs = open.edges.filter((e) => e.side === side);
    const hit = end === "lo" ? runs.find((r) => r.from <= 0.5) : runs.find((r) => r.from + r.len >= max - 0.5);
    return hit ? hit.len : 0;
  };
  const touch = {
    bl: { h: openAt("back", "lo"), v: openAt("left", "lo"), ch: cov.back, cv: cov.left },
    br: { h: openAt("back", "hi"), v: openAt("right", "lo"), ch: cov.back, cv: cov.right },
    fl: { h: openAt("entry", "lo"), v: openAt("left", "hi"), ch: cov.entry, cv: cov.left },
    fr: { h: openAt("entry", "hi"), v: openAt("right", "hi"), ch: cov.entry, cv: cov.right },
  };
  const leg = (run, covered, max) => Math.min(max, run > 0.5 && covered > 0.5 ? run : CORNER_CUT);
  // A diagonal's ends are squared to the edges (owner sketch 2026-07-30), so
  // the band butts the wall/run faces with no gap — `cut` is its OUTER edge,
  // the longest point the piece is figured and cut at.
  const diags = Object.keys(cut).sort().map((k) => {
    const h = leg(touch[k].h, touch[k].ch, rw), v = leg(touch[k].v, touch[k].cv, rd);
    return {
      corner: k, h: round2(h), v: round2(v), len: round2(Math.sqrt(h * h + v * v)),
      cut: round2(Math.hypot(h + CURB_W, v + CURB_W)),
    };
  });
  const diagOf = {};
  diags.forEach((d) => { diagOf[d.corner] = d; });
  // Corner at each run's anchored end (touches only when the run starts at 0)
  // and far end (a run always reaches it).
  const ENDS = { back: ["bl", "br"], left: ["bl", "fl"], right: ["br", "fr"], entry: ["fl", "fr"] };
  const segs = [];
  open.edges.forEach((e) => {
    let from = e.from, len = e.len;
    const horiz = e.side === "back" || e.side === "entry";
    const ends = ENDS[e.side];
    const legAt = (k) => (horiz ? diagOf[k].h : diagOf[k].v);
    const eMax = horiz ? rw : rd;
    if (cut[ends[0]] && from <= 0.5) { const t = Math.min(legAt(ends[0]), len); from += t; len -= t; }
    if (cut[ends[1]] && from + len >= eMax - 0.5) len -= Math.min(legAt(ends[1]), len);
    if (len > 0.5) {
      // A horizontal run reaching an open ring corner extends CURB_W into it
      // (owner sketch): the curb butts the perpendicular run/wall square with
      // no gap, and the piece is figured at this longest point. Vertical runs
      // butt whatever fills the corner.
      let ext0 = 0, ext1 = 0;
      if (horiz) {
        if (!cut[ends[0]] && from <= 0.5 && !wallFills(ends[0])) ext0 = CURB_W;
        if (!cut[ends[1]] && from + len >= rw - 0.5 && !wallFills(ends[1])) ext1 = CURB_W;
      }
      segs.push({ side: e.side, from: round2(from), len: round2(len), ext0: ext0, ext1: ext1 });
    }
  });
  // A bench "comes all the way out" over the curb line, so the curb gives up
  // the edge intervals its footprint sits on and butts the bench's face — a
  // trimmed end loses its ring-corner extension, it's a butt now.
  let outSegs = segs;
  if (benches && benches.length) {
    const spans = benchEdgeSpans(benches, dims);
    outSegs = [];
    segs.forEach((s) => {
      subSpans(s.from, s.len, spans[s.side]).forEach((p) => {
        outSegs.push({
          side: s.side, from: round2(p[0]), len: round2(p[1] - p[0]),
          ext0: p[2] ? s.ext0 : 0, ext1: p[3] ? s.ext1 : 0,
        });
      });
    });
  }
  return {
    segs: outSegs, diags: diags,
    openLen: round2(outSegs.reduce((s, x) => s + x.len + x.ext0 + x.ext1, 0) + diags.reduce((s, d) => s + d.cut, 0)),
  };
}

// Which corners are cuttable: a corner boxed in by two walls can't take a 45°
// cut — the walls are standing on it. bl/br sit on the back, fl/fr on the entry.
export function openCorners(dims, walls) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  const sp = openEdges(dims, walls).spans;
  const lo = spanAtLo, hi = spanAtHi;
  return {
    bl: !(lo(sp.back) && lo(sp.left)),
    br: !(hi(sp.back, rw) && lo(sp.right)),
    fl: !(lo(sp.entry) && hi(sp.left, rd)),
    fr: !(hi(sp.entry, rw) && hi(sp.right, rd)),
  };
}

// ============================================================================
// benches (issue 069 — owner spec 2026-07-31)
// ============================================================================
//
// Placed on the top-down drawing: along a wall or across a corner. Three
// constructions:
//   premade — a catalog bench kit / Sanoasa piece, one line.
//   site    — wedi 2" building panel with the pan running UNDERNEATH: a 2"
//             slab on the top, a 2" slab on the face, and a 2" support
//             closing each open end plus one about every foot inside.
//   framed  — the installer frames it in and the pan butts AGAINST it, the
//             framing wrapped with the build's ½" wall panel; the pan is cut
//             down or swapped smaller to make room (panFit "cut"|"smaller").
// The shower is always completed first and the bench built ON it (owner
// rule 2026-07-31): a 2" build-up or premade bench sits on the finished pan
// and curb, so the curb runs across beneath it untouched. Only the
// installer-FRAMED bench interrupts the envelope — the pan butts its face
// and curbRuns subtracts its footprint from the open-edge runs. Corner
// benches are measured from the corner out along each wall with a triangle
// across the front, always 18" to the top by default, and never framed.
// A premade whose details read "Suspended" (the corner seats, Sanoasa 4)
// hangs on the walls instead: the top still sits at seat height but only
// its slab is there (`thick` — 4" seats, 3 1/8" bench), the floor stays
// clear beneath it, and the curb runs under it untouched.

export const BENCH_H = 18;
export const BENCH_DEPTH = 14;     // default seat depth along a wall (owner, 2026-07-31)
export const BENCH_CORNER_LEG = 24;
const BENCH_SUPPORT_EVERY = 12;
const BENCH_THICK = 2;
const BENCH_SHEETS_2IN = ["US8000016", "US8000020"];   // 4×8×2" then 4×5×2" — both stocked
export const BENCH_CORNER_LBL = { bl: "back-left", br: "back-right", fl: "entry-left", fr: "entry-right" };

export function benchPremades(kind) {
  // The suspended corner seats file as group "seat" but place like any
  // corner bench — their "(wall sides)" legs are the corner legs.
  return group("bench").concat(group("seat"))
    .filter((e) => (kind === "corner") === (e.group === "seat" || /corner/i.test(e.name)))
    .sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail);
}

export function normBench(b, dims) {
  b = b || {};
  const part = b.part ? item(b.part) : null;
  // Suspended: the part's thickness is its SLAB, not its height off the floor.
  const susp = !!part && /suspended/i.test(part.details || "");
  if (b.kind === "corner") {
    const o = {
      kind: "corner",
      corner: BENCH_CORNER_LBL[b.corner] ? b.corner : "bl",
      build: part ? "premade" : "site", part: part ? part.key : null,
      size: round2(+b.size || (part && part.w) || BENCH_CORNER_LEG),
      // Always 18" to the top (owner's floating-bench rule) — the corner
      // kits' sheet prints a 20" third figure, but it isn't the installed
      // height, and a suspended seat's 4" is its slab.
      h: round2(+b.h || BENCH_H),
    };
    if (susp) { o.suspended = true; o.thick = part.t || 4; }   // 3 1/8 must not round to 3.13
    return o;
  }
  const side = ["left", "right", "back"].indexOf(b.side) >= 0 ? b.side : "left";
  const run = dims ? (side === "back" ? +dims.w || 0 : +dims.d || 0) : 0;
  const build = part ? "premade" : b.build === "framed" ? "framed" : "site";
  const len = +b.len || (part && part.w) || run || 48;
  const o = {
    kind: "wall", side: side, build: build, part: part ? part.key : null,
    len: round2(run ? Math.min(len, run) : len),
    depth: round2(+b.depth || (part && part.d) || BENCH_DEPTH),
    h: round2(+b.h || (!susp && part && part.t) || BENCH_H),
  };
  if (susp) { o.suspended = true; o.thick = part.t || 4; }   // 3 1/8 must not round to 3.13
  if (build === "framed") o.panFit = b.panFit === "smaller" ? "smaller" : "cut";
  return o;
}

// Plan-view footprint in room coords (origin back-left). Wall benches anchor
// at the back (a back bench at the left wall), corners wrap their corner.
export function benchFootprint(b, dims) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  if (b.kind === "corner") return { kind: "corner", corner: b.corner, a: Math.min(b.size, rw || b.size, rd || b.size) };
  if (b.side === "left") return { kind: "rect", x: 0, y: 0, w: Math.min(b.depth, rw), d: Math.min(b.len, rd) };
  if (b.side === "right") return { kind: "rect", x: Math.max(0, rw - b.depth), y: 0, w: Math.min(b.depth, rw), d: Math.min(b.len, rd) };
  return { kind: "rect", x: 0, y: 0, w: Math.min(b.len, rw), d: Math.min(b.depth, rd) };
}

// The intervals of each room edge a bench sits on — what the curb gives up.
// Only framed benches register: everything else goes on after the shower is
// complete, curb and all.
function benchEdgeSpans(benches, dims) {
  const rw = +dims.w || 0, rd = +dims.d || 0;
  const spans = { back: [], left: [], right: [], entry: [] };
  (benches || []).forEach((b) => {
    if (b.build !== "framed") return;
    const f = benchFootprint(b, dims);
    if (f.kind === "corner") {
      const a = f.a;
      if (f.corner === "bl") { spans.back.push([0, a]); spans.left.push([0, a]); }
      else if (f.corner === "br") { spans.back.push([rw - a, rw]); spans.right.push([0, a]); }
      else if (f.corner === "fl") { spans.entry.push([0, a]); spans.left.push([rd - a, rd]); }
      else { spans.entry.push([rw - a, rw]); spans.right.push([rd - a, rd]); }
      return;
    }
    if (f.y <= 0.5) spans.back.push([f.x, f.x + f.w]);
    if (f.y + f.d >= rd - 0.5) spans.entry.push([f.x, f.x + f.w]);
    if (f.x <= 0.5) spans.left.push([f.y, f.y + f.d]);
    if (f.x + f.w >= rw - 0.5) spans.right.push([f.y, f.y + f.d]);
  });
  return spans;
}

// Interval subtraction for the curb runs. Returns [a, b, startKept, endKept]
// parts — the kept flags say whether that end is still the run's original
// end (its ext into a ring corner survives) or a fresh butt against a bench.
function subSpans(from, len, spans) {
  let parts = [[from, from + len, true, true]];
  (spans || []).forEach((sp) => {
    const a = sp[0], b = sp[1], next = [];
    parts.forEach((p) => {
      if (b <= p[0] + 0.5 || a >= p[1] - 0.5) { next.push(p); return; }
      if (a > p[0] + 0.5) next.push([p[0], a, p[2], false]);
      if (b < p[1] - 0.5) next.push([b, p[1], false, p[3]]);
    });
    parts = next;
  });
  return parts.filter((p) => p[1] - p[0] > 0.5);
}

// The room a framed bench leaves for the pan.
export function benchPanRoom(benches, dims) {
  let w = +dims.w || 0, d = +dims.d || 0;
  (benches || []).forEach((b) => {
    if (b.kind !== "wall" || b.build !== "framed") return;
    if (b.side === "back") d -= b.depth; else w -= b.depth;
  });
  return { w: round2(Math.max(0, w)), d: round2(Math.max(0, d)) };
}

// The largest same-family catalog pan that fits the reduced footprint (either
// orientation, stock outranks at equal area). Null when nothing fits.
export function smallerPanFor(pan, w, d) {
  const fits = pans({ family: familyOf(pan) }).filter((p) => p.key !== pan.key)
    .map((p) => {
      const o = p.w <= w + 0.01 && p.d <= d + 0.01 ? p.w * p.d
        : p.d <= w + 0.01 && p.w <= d + 0.01 ? p.w * p.d : null;
      return o == null ? null : { p: p, area: o };
    }).filter(Boolean);
  if (!fits.length) return null;
  fits.sort((a, b) => b.area - a.area || (b.p.stock ? 1 : 0) - (a.p.stock ? 1 : 0) || a.p.retail - b.p.retail);
  return fits[0].p;
}

// Framed bench, "smaller" fit (owner ask 2026-07-30): don't just grab the
// largest pan that fits beside the bench — RE-SOLVE the clear space with the
// drain pinned at its center, so the standard solver places the pan (floating
// it, trimming up to 6" a side, filling with extensions) exactly as it would
// any room. The shower keeps its full size — walls, curb ring and bench all
// figure on `dims`; only the floor moves into the clear space. Returns
// { option, offset, clear } — the option's pieces live in clear-space coords,
// offset is where that space starts in the shower (a left/back framed bench
// shifts it by its depth). Null when no framed bench shrinks the room, none
// asks for "smaller", the family can't re-solve (modules/sdry), or nothing
// lands the drain — callers fall back to the plain smallerPanFor swap.
export function benchPanPlan(pan, benches, dims) {
  const panRoom = benchPanRoom(benches, dims);
  if (!(panRoom.w > 0 && panRoom.d > 0)) return null;
  if (panRoom.w >= dims.w - 0.01 && panRoom.d >= dims.d - 0.01) return null;
  if (!(benches || []).some((b) => b.build === "framed" && b.panFit === "smaller")) return null;
  if (pan.sub !== "fundo" && pan.sub !== "curbless") return null;
  const sub = solve({
    w: panRoom.w, d: panRoom.d,
    curb: pan.sub === "curbless" ? "curbless" : "curbed",
    drainX: round2(panRoom.w / 2), drainY: round2(panRoom.d / 2),
  });
  if (!sub.length) return null;
  let ox = 0, oy = 0;
  (benches || []).forEach((b) => {
    if (b.kind !== "wall" || b.build !== "framed") return;
    if (b.side === "left") ox = round2(ox + b.depth);
    else if (b.side === "back") oy = round2(oy + b.depth);
  });
  return { option: sub[0], offset: { x: ox, y: oy }, clear: panRoom };
}

// Bench BOM. Site-built 2" material aggregates across benches and fills
// sheets greedily (4×8s, then one 4×5 when the remainder fits it); framed
// wraps figure in the build's wall panel. surfSf is what feeds the sealant/
// fastener consumables — a premade whose details say the sealant is included
// contributes nothing.
export function benchLines(benches, dims, panel) {
  const lines = [];
  let sf2 = 0, wrapSf = 0, surfSf = 0;
  const notes2 = [];
  (benches || []).forEach((b) => {
    const where = b.kind === "corner" ? BENCH_CORNER_LBL[b.corner] + " corner" : b.side + " wall";
    if (b.build === "premade") {
      const it = item(b.part);
      if (!it) return;
      push(lines, it, 1, "bench", where + (it.sizeText ? " — " + it.sizeText : ""), false);
      if (!/includes wedi joint sealant/i.test(it.details || ""))
        surfSf += ((it.w || 0) * ((it.d || 0) + (it.t || 0))) / 144;
      return;
    }
    if (b.build === "framed") {
      const wrap = (b.len * b.depth + b.len * b.h + b.depth * b.h) / 144;
      wrapSf += wrap;
      surfSf += wrap;
      return;
    }
    let top, face, n, deep, label;
    if (b.kind === "corner") {
      const a = Math.min(b.size, +dims.w || b.size, +dims.d || b.size);
      const hyp = a * Math.SQRT2;
      top = a * a / 2; face = hyp * b.h;
      n = Math.floor(hyp / BENCH_SUPPORT_EVERY) + 1;
      deep = a / 2;
      label = inch(a) + '" ' + where;
    } else {
      top = b.len * b.depth; face = b.len * b.h;
      n = Math.floor(b.len / BENCH_SUPPORT_EVERY) + 1;
      deep = b.depth;
      label = inch(b.len) + "×" + inch(b.depth) + "×" + inch(b.h) + '" ' + where;
    }
    const supports = n * Math.max(0, deep - BENCH_THICK) * Math.max(0, b.h - BENCH_THICK);
    sf2 += (top + face + supports) / 144;
    surfSf += (top + face) / 144;
    notes2.push(label + " — top + face + " + n + " supports");
  });
  if (sf2 > 0.01) {
    const big = item(BENCH_SHEETS_2IN[0]), small = item(BENCH_SHEETS_2IN[1]);
    const note = round2(sf2) + ' sf of 2" build-up — ' + notes2.join(" · ");
    if (big && big.sf && small && small.sf) {
      const nBig = Math.max(0, Math.ceil((sf2 - small.sf) / big.sf));
      const rem = sf2 - nBig * big.sf;
      if (nBig > 0) push(lines, big, nBig, "bench", note, true);
      if (rem > 0.01) push(lines, small, 1, "bench", nBig > 0 ? "the remainder" : note, true);
    } else if (big && big.sf) {
      push(lines, big, Math.ceil(sf2 / big.sf), "bench", note, true);
    }
  }
  if (wrapSf > 0.01 && panel && panel.sf) {
    push(lines, panel, Math.ceil(wrapSf / panel.sf), "bench",
      round2(wrapSf) + ' sf — ½" wrap over the installer-framed bench', true);
  }
  return { lines: lines, surfSf: round2(surfSf), sf2: round2(sf2), wrapSf: round2(wrapSf) };
}

// The wall panel a framed bench's framing shadows out (owner, 2026-07-30):
// the wedi stops at the bench top on that wall and the bench's own ½" wrap
// takes over, so the shadowed rectangle leaves the wall figure. Site-built
// and premade benches sit against a fully paneled wall and shadow nothing.
export function benchWallShadowSf(benches, walls) {
  let sf = 0;
  (benches || []).forEach((b) => {
    if (b.kind !== "wall" || b.build !== "framed") return;
    const wl = (walls || []).filter((w) => w.side === b.side && !w.face)
      .sort((a, c) => (+c.len || 0) - (+a.len || 0))[0];
    if (!wl) return;
    sf += (Math.min(b.len, +wl.len || 0) * Math.min(b.h, +wl.h || 0)) / 144;
  });
  return round2(sf);
}

function familyOf(pan) {
  if (pan.group === "module" || pan.group === "modExt") return "linear";
  return pan.sub === "sdry" ? "sdry" : pan.sub;
}

// A pan's thickness off its size text ('… x 2"' / '… x 1 37/64"'). The deep
// 2" pans pair with 1 37/64" extensions, which the shop shims flush with
// ½" building-panel strips underneath (owner practice 2026-07-30).
export function panThick(p) {
  const m = /x\s*(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)"\s*$/.exec((p && p.sizeText) || "");
  if (!m) return 0;
  let v = 0;
  m[1].trim().split(/\s+/).forEach((s) => {
    const f = s.split("/");
    v += f.length === 2 ? +f[0] / +f[1] : +s;
  });
  return round2(v);
}
const BUILDUP_NOTE = 'the 2" pan runs deeper than the 1 37/64" extensions — build the extensions up flush with ½" building-panel strips underneath';
const BUILDUP_SHEET = "US8000015";   // ½" 4×8 building panel — ripped into strips
function extensionSf(option) {
  return round2((option && option.pieces ? option.pieces : [])
    .reduce((s, p) => s + (p.kind === "pan" || p.kind === "module" ? 0 : p.w * p.d / 144), 0));
}

export function factoryKit(w, d, family, drainType) {
  const fam = family === "curbless" ? "curbless" : family === "linear" ? "linear" : "fundo";
  const hits = group("kit").filter((k) => {
    if (k.family !== fam) return false;
    const fit = (k.w === w && k.d === d) || (k.w === d && k.d === w);
    if (!fit) return false;
    if (fam === "linear") return true;
    return !drainType || !k.drain || k.drain.type === drainType;
  });
  const complete = hits.filter((k) => k.sub === "complete")[0] || null;
  const nojs = hits.filter((k) => k.sub === "nojs")[0] || null;
  return complete || nojs ? { kit: complete, nojs: nojs } : null;
}

export function linearCoverFor(channel, finish) {
  const nom = nominalLen(channel);
  if (!nom) return null;
  const hits = group("cover").filter((c) => c.sub === "linear" && c.len === nom && c.finish === (finish || "SS"));
  hits.sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail);
  return hits[0] || null;
}

// wedi's channel frame is a trim ring the linear cover drops into — a design
// pick, never part of the house kit, so it rides in as an add-on. wedi lists
// no perforated frame: a perforated cover wears the plain frame of its own
// metal, and a tileable cover can take any of the four.
const FRAME_FINISH = { SS: "SS", SSP: "SS", MB: "MB", MBP: "MB", B: "B", BP: "B", C: "C", CP: "C" };
const byStockThenPrice = (a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail;
export function coverFrames(cover) {
  const c = typeof cover === "string" ? item(cover) : cover;
  if (!c || c.sub !== "linear" || !c.len) return [];
  const want = FRAME_FINISH[c.finish] || null;
  return group("coverFrame")
    .filter((f) => f.len === c.len && (!want || f.finish === want))
    .sort(byStockThenPrice);
}
// What's stored is a FINISH, not a part number: the length always follows the
// cover, so re-sizing the drain re-sizes the frame. A finish picked by hand is
// honored even when it isn't the cover's own metal — the frame is a design
// choice — and falls back to the matching one only if that length lacks it.
export function coverFrameFor(cover, finish) {
  const c = typeof cover === "string" ? item(cover) : cover;
  const match = coverFrames(c);
  if (finish && c && c.len) {
    const hit = group("coverFrame").filter((f) => f.len === c.len && f.finish === finish).sort(byStockThenPrice)[0];
    if (hit) return hit;
  }
  return match[0] || null;
}

function push(lines, key, qty, grp, note, auto) {
  const it = typeof key === "string" ? item(key) : key;
  if (!it || !(qty > 0)) return;
  lines.push({ item: it, qty: qty, group: grp, auto: auto !== false, note: note || "" });
}

export function kitFor(panKey, opts) {
  opts = opts || {};
  const pan = typeof panKey === "string" ? item(panKey) : panKey;
  if (!pan) return null;
  const fam = familyOf(pan);
  const option = opts.option || null;
  const room = opts.room || (option ? { w: option.room.w, d: option.room.d } : null);
  const walls = opts.walls || defaultWalls(pan, room, opts.wallHeight);
  const form = opts.sealantForm === "tube" ? "tube" : "sausage";
  const panel = item(opts.panelKey || SKU.panelDefault) || item(SKU.panelDefault);
  const lines = [], hints = [];
  const roomDims = room
    || (pan.group === "module" ? { w: pan.len, d: MODULE_DEPTH + MODEXT_DEPTH }
      : { w: Math.max(pan.w, pan.d), d: Math.min(pan.w, pan.d) });
  const benches = (opts.benches || []).map((x) => normBench(x, roomDims));
  // A framed bench's framing shadow leaves the wall figure — no wedi runs
  // behind it (its wrap files under the bench group instead).
  const panelSf = Math.max(0, round2(wallSf(expandWallFaces(walls)) - benchWallShadowSf(benches, walls)));

  // --- floor -----------------------------------------------------------------
  // A framed bench sits on the subfloor, so the pan stops at its face. "Cut"
  // keeps the pan and notes the cut; "smaller" re-solves the CLEAR space with
  // the drain pinned at its center (benchPanPlan) — its floor lines replace
  // the pan AND, in custom mode, the outer option's extensions, which were
  // sized for the full room the bench now takes a bite of. Only when nothing
  // solves does "smaller" fall back to the plain largest-fitting-pan swap.
  // With "overall max" on, the option arrived inset (applyCurbInset): the
  // pan's space already gave up the curb, so benches subtract from THAT.
  const inset = option && option.inset ? option.inset : null;
  const panDims = inset
    ? { w: round2(roomDims.w - inset.left - inset.right), d: round2(roomDims.d - inset.back - inset.entry) }
    : roomDims;
  const panRoom = benchPanRoom(benches, panDims);
  const framedIn = panRoom.w < panDims.w - 0.01 || panRoom.d < panDims.d - 0.01;
  const panPlan = benchPanPlan(pan, benches, panDims);
  let floorPan = pan;
  if (panPlan) {
    floorPan = panPlan.option.pan;
    const pp = panPlan.option.pieces[0];
    const cutTxt = pp.cut ? ", cut to " + inch(pp.w) + "×" + inch(pp.d) + '"' : "";
    panPlan.option.floorLines.forEach((fl, i) => {
      push(lines, fl.item, fl.qty, "floor", i === 0
        ? "beside the framed bench" + cutTxt
          + ", drain centered in the " + inch(panRoom.w) + "×" + inch(panRoom.d) + '" clear space'
        : "", true);
    });
  } else {
    let floorNote = "";
    if (framedIn) {
      const sw = benches.some((b) => b.build === "framed" && b.panFit === "smaller")
        ? smallerPanFor(pan, panRoom.w, panRoom.d) : null;
      if (sw) {
        floorPan = sw;
        floorNote = "sized beside the framed bench (" + inch(panRoom.w) + "×" + inch(panRoom.d) + '" clear)';
      } else floorNote = "cut to " + inch(panRoom.w) + "×" + inch(panRoom.d) + '" against the framed bench';
    }
    push(lines, floorPan, 1, "floor", floorNote, true);
    if (option) {
      option.floorLines.forEach((fl) => {
        if (fl.item.key === pan.key) return;
        push(lines, fl.item, fl.qty, "floor", fl.note || "", true);
      });
    } else if (floorPan.group === "module") {
      // A line module is 5¾" of channel, not a floor: on its own it takes the
      // extension module of its own length to become one.
      push(lines, group("modExt").filter((m) => m.len === floorPan.len)[0], 1, "floor",
        inch(MODEXT_DEPTH) + '" of pre-sloped floor — the module\'s own extension', true);
    }
  }
  (opts.floorExtra || []).forEach((x) => {
    push(lines, x.key || x.item, x.qty || 1, "floor", x.note || "", false);
  });
  // A 2"-deep pan's extensions sit low — the kit carries the ½" sheet the
  // shop rips into build-up strips underneath them (owner practice).
  const floorOpt = panPlan ? panPlan.option : option;
  if (floorOpt && floorPan.group !== "module" && panThick(floorPan) >= 1.9) {
    const extSf = extensionSf(floorOpt);
    const sheet = item(BUILDUP_SHEET);
    if (extSf > 0 && sheet && sheet.sf) {
      push(lines, sheet, Math.ceil(extSf / sheet.sf), "floor",
        extSf + ' sf of build-up strips — shims the extensions flush with the 2" pan', true);
    }
  }

  // --- walls -----------------------------------------------------------------
  const sheets = panel && panel.sf ? Math.ceil(panelSf / panel.sf) : 0;
  push(lines, panel, sheets, "walls",
    round2(panelSf) + " sf of wall — " + (panel.sf || 0) + " sf/sheet", true);

  // --- benches ---------------------------------------------------------------
  const bl = benchLines(benches, roomDims, panel);
  bl.lines.forEach((l) => { lines.push(l); });

  // --- curb ------------------------------------------------------------------
  // The curb runs the room's OPEN perimeter — every edge run no wall covers —
  // minus what the benches take, so turning a wall off (or shortening it)
  // grows the curb to match and a bench shrinks it.
  const openLen = curbRuns(roomDims, walls, opts.corners, benches).openLen
    || (benches.length ? 0 : roomDims.w);
  let curbKey = opts.curbKey;
  if (curbKey === undefined && fam === "fundo") curbKey = openLen > 60 ? SKU.curbLean96 : SKU.curbLean60;
  if (curbKey === undefined && fam === "linear") curbKey = SKU.curbLean60;
  if (curbKey && openLen > 0) {
    const curb = item(curbKey);
    const per = curb && curb.len ? curb.len : 0;
    const n = per ? Math.max(1, Math.ceil((openLen - 0.01) / per)) : 1;
    push(lines, curb, n, "floor",
      n > 1 ? round2(openLen) + '" of open edge — cut to fit'
        : per > openLen ? "cut to " + round2(openLen) + '"' : "", true);
  }

  // --- drain finish ----------------------------------------------------------
  const coverKey = opts.coverKey;
  let cover = null;
  if (coverKey) cover = item(coverKey);
  else if (fam === "linear") {
    const ch = pan.channel || (option && option.drain && option.drain.len) || 0;
    cover = linearCoverFor(ch, opts.coverFinish || "SS");
  } else cover = item(SKU.coverSS);
  push(lines, cover, 1, "drain", "", true);
  const frame = opts.coverFrame ? coverFrameFor(cover, opts.coverFrame === true ? null : opts.coverFrame) : null;
  if (frame) push(lines, frame, 1, "drain", "trim ring around the cover", true);

  // --- curbless waterproofing ------------------------------------------------
  // The bracket kit / ramp is an add-on PICK, not part of the curbless house
  // kit (owner ask 2026-07-30) — the Recess chip sets opts.recess "kit"/"ramp".
  const recess = opts.recess === undefined ? "none" : opts.recess;
  if (fam === "curbless") {
    push(lines, SKU.subliner53, 1, "install", "53 sf roll — field seal at the pan perimeter", true);
    push(lines, SKU.subCornerIn, 1, "install", "2 pcs/bag", true);
    // Owner rule 2026-07-29: the field seal is wedi S-Dry Seal (trowel-
    // applied, stocked), not 620 sealant — 620 stays in the catalog for
    // steam/Subliner work.
    push(lines, SKU.sdrySeal, 1, "install", "field seal — Subliner laps & perimeter", true);
    push(lines, SKU.sdrySealTrowel, 1, "install", '3/16" x 5/32" notch', true);
  }
  if (recess === "kit") push(lines, SKU.recessKit, 1, "install", "recess up to 5×5 ft in ¾ ply", true);
  if (recess === "ramp") push(lines, SKU.ramp, 1, "install", "surface mount — ADA slope", true);

  // --- consumables + install -------------------------------------------------
  // Bench surfaces (tops + faces, framed wraps) seal and fasten like wall
  // panel; premades whose kit already includes the sealant contribute nothing.
  const con = figureConsumables(panelSf + bl.surfSf, form);
  con.lines.forEach((l) => { lines.push(l); });
  push(lines, SKU.collarValve, 1, "install", "mixing valve", true);
  push(lines, SKU.collarPipe, 1, "install", "shower arm / pipe", true);
  push(lines, SKU.trowel, 1, "install", "", true);

  // --- add-ons ---------------------------------------------------------------
  (opts.addons || []).forEach((a) => {
    const key = typeof a === "string" ? a : a.key;
    push(lines, key, (a && a.qty) || 1, "addon", (a && a.note) || "", false);
  });

  const hasGun = lines.some((l) => l.item.key === SKU.gun);
  const hasSausage = lines.some((l) => l.item.group === "sealant" && /sausage/i.test(l.item.name));
  if (hasSausage && !hasGun) hints.push("sausage-gun");
  const soNet = lines.reduce((s, l) => s + (l.item.stock ? 0 : (l.item.soNet || l.item.cost || 0) * l.qty), 0);
  if (soNet > 0 && soNet < SO_MIN_NET) hints.push("small-order");

  const fw = room ? room.w : pan.w, fd = room ? room.d : pan.d;
  const factory = factoryKit(fw, fd, fam, pan.drain ? pan.drain.type : null);

  const cfgWalls = walls.map((w) => {
    const o = { len: w.len, h: w.h, side: w.side };
    if (w.extra) o.extra = true;
    if (w.at === "hi") o.at = "hi";
    if (w.faces && w.faces !== "in") o.faces = w.faces;
    return o;
  });
  const cfg = {
    panKey: pan.key, walls: cfgWalls, panelKey: panel ? panel.key : null,
    curbKey: curbKey || null, coverKey: cover ? cover.key : null,
    coverFrame: frame ? frame.finish : null,
    sealantForm: form, recess: recess,
    addons: (opts.addons || []).map((a) => (typeof a === "string" ? a : a.key)),
    benches: benches.map((b) => ({ ...b })),
    corners: (opts.corners || []).slice(),
    room: room || null, solve: option ? { id: option.id, input: option.input } : null,
    maxIn: !!opts.maxIn, tileT: Math.max(0, +opts.tileT || 0),
    tier: opts.tier || "retail",
  };

  return {
    pan: pan, lines: lines, panelSf: round2(panelSf), factory: factory, hints: hints,
    mode: opts.mode || (option ? "custom" : "kit"), cfg: cfg,
    consumables: con, soNet: round2(soNet), benches: benches, panPlan: panPlan,
  };
}

// ============================================================================
// solver
// ============================================================================
//
// Room coords: origin at the back-left corner, x rightward along the back
// wall, y increasing toward the entry. A pan sits at (0,0) and any extensions
// fill the +x and +y sides, so every piece stays against a wall.

function orientations(p) {
  const o = [{ w: p.w, d: p.d, rot: false }];
  if (p.w !== p.d) o.push({ w: p.d, d: p.w, rot: true });
  return o;
}

function mapDrain(pan, rot, x0, y0) {
  const dr = pan.drain;
  if (!dr) return null;
  const x = rot ? dr.y : dr.x, y = rot ? dr.x : dr.y;
  const axis = dr.axis ? (rot ? (dr.axis === "w" ? "d" : "w") : dr.axis) : null;
  return {
    type: dr.type, x: round2(x0 + x), y: round2(y0 + y),
    len: dr.len || 0, axis: axis, note: dr.note || "",
  };
}

// A gap → the stacked extension layers that fill it, deepest against the pan.
// Seams lie HORIZONTAL by preference (owner rule 2026-07-30): a stack of
// 12"-deep extensions that span the side in ONE piece beats a deeper layer
// that has to butt mid-run (vertical seam), and a layer thinner than MIN_GAP
// is the last resort. `sideLen` is the run the band has to cover.
function layers(gap, fam, sideLen) {
  const spec = EXT[fam === "curbless" ? "curbless" : "fundo"];
  if (gap <= 0) return [];
  if (gap > spec.max + 0.01) return null;
  const L = +sideLen > 0 ? +sideLen : 0;
  // every tight stack of nominal depths (none removable), deepest first
  const stacks = [];
  const walk = (stack, total) => {
    if (total >= gap - 0.01) { stacks.push(stack.slice().sort((a, b) => b - a)); return; }
    if (stack.length >= 3) return;
    spec.depths.forEach((d) => walk(stack.concat([d]), total + d));
  };
  walk([], 0);
  const seen = {};
  let best = null;
  stacks.forEach((st) => {
    const key = st.join("+");
    if (seen[key]) return;
    seen[key] = true;
    const tot = st.reduce((s, d) => s + d, 0);
    if (st.length > 1 && st.some((d) => tot - d >= gap - 0.01)) return;   // a layer is superfluous
    let rem = gap;
    const lay = st.map((d, i) => {
      const depth = i === st.length - 1 ? round2(rem) : Math.min(d, rem);
      rem = round2(rem - depth);
      return { depth: depth, nominal: d, key: spec.items[d] };
    }).filter((l) => l.depth > 0.01);
    const per = lay.map((l) => {
      const it = item(l.key);
      return { n: L ? (Math.ceil(round2(L / it.len - 0.0001)) || 1) : 1, retail: it.retail };
    });
    const cand = {
      lay: lay,
      sliver: lay.some((l) => l.depth < MIN_GAP - 0.01) ? 1 : 0,
      vSeams: per.reduce((s, x) => s + x.n - 1, 0),
      pieces: per.reduce((s, x) => s + x.n, 0),
      cost: per.reduce((s, x) => s + x.n * x.retail, 0),
    };
    if (!best
      || cand.sliver < best.sliver
      || (cand.sliver === best.sliver && (cand.vSeams < best.vSeams
        || (cand.vSeams === best.vSeams && (cand.pieces < best.pieces
          || (cand.pieces === best.pieces && cand.cost < best.cost - 0.001)))))) best = cand;
  });
  return best ? best.lay : null;
}

// A gapped side → its pieces. Each layer is a band `depth` deep laid across
// the side; a side longer than the extension takes several runs, the last cut.
function runPieces(kind, lay, x0, y0, sideLen, horizontal) {
  const pieces = [];
  let off = 0;
  lay.forEach((L) => {
    const it = item(L.key);
    const n = Math.ceil(round2(sideLen / it.len - 0.0001)) || 1;
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const runLen = Math.min(it.len, round2(sideLen - placed));
      const pw = horizontal ? L.depth : runLen;
      const pd = horizontal ? runLen : L.depth;
      const nomW = horizontal ? L.nominal : it.len;
      const nomD = horizontal ? it.len : L.nominal;
      pieces.push({
        kind: kind, item: it,
        x: round2(horizontal ? x0 + off : x0 + placed),
        y: round2(horizontal ? y0 + placed : y0 + off),
        w: round2(pw), d: round2(pd),
        cut: (pw < nomW - 0.01 || pd < nomD - 0.01) ? { w: nomW, d: nomD } : null,
      });
      placed = round2(placed + runLen);
    }
    off = round2(off + L.depth);
  });
  return pieces;
}

function aggregate(pieces) {
  const by = {}, order = [];
  pieces.forEach((p) => {
    if (!by[p.item.key]) { by[p.item.key] = { item: p.item, qty: 0 }; order.push(p.item.key); }
    by[p.item.key].qty += 1;
  });
  return order.map((k) => by[k]);
}

function priceOf(lines) {
  return round2(lines.reduce((s, l) => s + l.item.retail * l.qty, 0));
}

function seamWarning(n) {
  return n + " seam" + (n === 1 ? "" : "s") + " — set every joint in wedi Joint Sealant";
}

function exactOption(input, list) {
  const tol = input.tolerance || 0;
  let best = null;
  list.forEach((p) => {
    orientations(p).forEach((o) => {
      if (Math.abs(o.w - input.w) > tol || Math.abs(o.d - input.d) > tol) return;
      if (!best || p.retail < best.pan.retail) best = { pan: p, o: o };
    });
  });
  if (!best) return null;
  const pieces = [{ kind: "pan", item: best.pan, x: 0, y: 0, w: best.o.w, d: best.o.d, cut: null }];
  const lines = aggregate(pieces);
  return {
    id: "exact", kind: "exact", title: best.pan.name,
    badges: ["Perfect fit — no cutting"], pieces: pieces,
    drain: mapDrain(best.pan, best.o.rot, 0, 0), warnings: [],
    floorLines: lines, floorPrice: priceOf(lines), input: input,
    room: { w: input.w, d: input.d }, pan: best.pan,
  };
}

function trimWarning(fam) {
  return fam === "curbless"
    ? "trimmed edge — the ¾\" perimeter has to be re-formed along the cut"
    : "trimmed edge — re-create the ½\" channel along the cut";
}

// Extensions fill the gaps; a pan side may also be TRIMMED up to 6" (owner
// rule) when the pan runs a touch long in one direction. Returns the best
// untrimmed candidate plus, when it saves pieces, the best trimmed one.
function extendOption(input, list, fam) {
  let best = null, bestTrim = null;
  list.forEach((p) => {
    orientations(p).forEach((o) => {
      const gw = round2(input.w - o.w), gd = round2(input.d - o.d);
      if (gw < -TRIM_MAX - 0.01 || gd < -TRIM_MAX - 0.01) return;
      if (gw <= 0 && gd <= 0) return;   // cutdown territory
      if ((gw > 0 && gw < MIN_GAP) || (gd > 0 && gd < MIN_GAP)) return;
      const pw = Math.min(o.w, input.w), pd = Math.min(o.d, input.d);
      const lw = gw > 0 ? layers(gw, fam, pd) : [];
      const ld = gd > 0 ? layers(gd, fam, pw) : [];
      if (!lw || !ld) return;
      const trims = (gw < 0 ? 1 : 0) + (gd < 0 ? 1 : 0);
      let pieces = [{ kind: "pan", item: p, x: 0, y: 0, w: pw, d: pd, cut: trims ? { w: o.w, d: o.d } : null }];
      const warn = [];
      if (gw > 0) pieces = pieces.concat(runPieces("ext", lw, pw, 0, pd, true));
      if (gd > 0) pieces = pieces.concat(runPieces("ext", ld, 0, pd, pw, false));
      if (gw > 0 && gd > 0) {
        if (gw <= CORNER_MAX && gd <= CORNER_MAX) {
          const ce = item(EXT[fam === "curbless" ? "curbless" : "fundo"].corner);
          pieces.push({
            kind: "cornerExt", item: ce, x: pw, y: pd, w: gw, d: gd,
            cut: (gw < ce.w - 0.01 || gd < ce.d - 0.01) ? { w: ce.w, d: ce.d } : null,
          });
        } else {
          warn.push("corner over 12\" — mitre two straights at 45° instead of a corner extension");
          const cw = gw > 0 ? layers(gw, fam, gd) : [];
          pieces = pieces.concat(runPieces("ext", cw, pw, pd, gd, true));
        }
      }
      const lines = aggregate(pieces);
      const cuts = pieces.filter((x) => !!x.cut).length;
      warn.unshift(seamWarning(pieces.length - 1));
      if (trims) warn.push(trimWarning(fam));
      const cand = {
        id: trims ? "trimfit" : "extend", kind: trims ? "trimfit" : "extend",
        title: trims
          ? p.sizeText + " base trimmed to fit + " + (pieces.length - 1) + " extension piece" + (pieces.length === 2 ? "" : "s")
          : p.sizeText + " base + " + (pieces.length - 1) + " extension piece" + (pieces.length === 2 ? "" : "s"),
        badges: (trims ? ["Trim to fit"] : ["Extensions"]).concat(cuts ? [] : ["No cutting"]),
        pieces: pieces, drain: mapDrain(p, o.rot, 0, 0), warnings: warn,
        floorLines: lines, floorPrice: priceOf(lines), input: input,
        room: { w: input.w, d: input.d }, pan: p, cuts: cuts, trims: trims,
      };
      const better = (a, b) => {
        if (!b) return true;
        if (a.pieces.length !== b.pieces.length) return a.pieces.length < b.pieces.length;
        if (a.cuts !== b.cuts) return a.cuts < b.cuts;
        return a.floorPrice < b.floorPrice;
      };
      if (trims) { if (better(cand, bestTrim)) bestTrim = cand; }
      else if (better(cand, best)) best = cand;
    });
  });
  const out = [];
  if (best) out.push(best);
  // A trimmed pan only earns its card when it genuinely simplifies the floor.
  if (bestTrim && (!best || bestTrim.pieces.length < best.pieces.length)) out.push(bestTrim);
  return out;
}

// Where a pan edge may sit on one axis: each side of it has to read either as
// a gap the extensions can fill ({0} ∪ [MIN_GAP, spec.max]) or as an overhang
// the trim allowance can cut off. Two intervals per side, so at most four
// spans of valid offset.
function offsetSpans(room, len, spec, trimMax) {
  const slack = round2(room - len);
  const side = [[-(trimMax || TRIM_MAX), 0], [MIN_GAP, spec.max]];
  const out = [];
  side.forEach((a) => side.forEach((b) => {
    const lo = Math.max(a[0], slack - b[1]), hi = Math.min(a[1], slack - b[0]);
    if (hi >= lo - 0.001) out.push([lo, hi]);
  }));
  return out;
}

// The offset closest to where the drain WANTS the pan, and how far it misses.
function nearestOffset(ideal, room, len, spec, trimMax) {
  let best = null;
  offsetSpans(room, len, spec, trimMax).forEach((s) => {
    const t = Math.min(Math.max(ideal, s[0]), s[1]);
    const miss = Math.abs(t - ideal);
    if (!best || miss < best.miss - 0.001) best = { t: round2(t), miss: round2(miss) };
  });
  return best;
}

// Every way a pan can be TURNED, drain and all: 90° swaps its sides, 180°
// swings its drain to the opposite end. A centred drain reads the same all
// four ways, but an off-centre one has a near end and a far one, and which
// way round the pan goes in is the installer's choice.
function placements(p) {
  const out = [];
  orientations(p).forEach((o) => {
    const dx = o.rot ? p.drain.y : p.drain.x, dy = o.rot ? p.drain.x : p.drain.y;
    out.push({ w: o.w, d: o.d, rot: o.rot, dx: dx, dy: dy });
    const bx = round2(o.w - dx), by = round2(o.d - dy);
    if (Math.abs(bx - dx) > 0.01 || Math.abs(by - dy) > 0.01) {
      out.push({ w: o.w, d: o.d, rot: o.rot, dx: bx, dy: by });
    }
  });
  return out;
}

// The drain lands where the plumbing is: the pan floats to put its drain at
// (drainX, drainY) — measured off the left and back walls — trims soak the
// overhang per side (6" freely, up to the 12" ceiling as a labeled "Deep cut"
// card — the bases are designed to cut down to meet a waste line, owner
// 2026-07-31), and extensions fill whatever gaps remain. When nothing reaches
// the pin, the same search returns its CLOSEST placements instead of nothing
// (owner report 2026-07-31): the seller moves the waste line or accepts the
// miss, but never faces a blank tab.
function drainAtOptions(input, list, fam) {
  const tx = input.drainX, ty = input.drainY;
  const spec = EXT[fam === "curbless" ? "curbless" : "fundo"];
  const cands = [];
  list.forEach((p) => {
    if (!p.drain || p.drain.type === "linear") return;
    placements(p).forEach((o) => [TRIM_MAX, TRIM_HARD].forEach((allow) => {
      const drx = o.dx, dry = o.dy;
      const fx = nearestOffset(round2(tx - drx), input.w, o.w, spec, allow);
      const fy = nearestOffset(round2(ty - dry), input.d, o.d, spec, allow);
      if (!fx || !fy) return;
      const miss = round2(Math.hypot(fx.miss, fy.miss));
      const ox = fx.t, oy = fy.t;
      const dx = round2(ox + drx), dy = round2(oy + dry);
      const tL = ox < 0 ? -ox : 0, tB = oy < 0 ? -oy : 0;
      const pr = round2(ox + o.w), pf = round2(oy + o.d);
      const tR = pr > input.w ? round2(pr - input.w) : 0, tF = pf > input.d ? round2(pf - input.d) : 0;
      if ([tL, tB, tR, tF].some((t) => t > allow + 0.01)) return;
      // The hard pass only contributes placements the soft one couldn't reach
      // — a deep-allowance search that settled on ≤6" cuts is the same card.
      const deepT = round2(Math.max(tL, tB, tR, tF));
      const deep = deepT > TRIM_MAX + 0.01;
      if (allow > TRIM_MAX && !deep) return;
      const px = round2(Math.max(ox, 0)), py = round2(Math.max(oy, 0));
      const pw = round2(Math.min(pr, input.w) - px), pd = round2(Math.min(pf, input.d) - py);
      if (pw <= 0 || pd <= 0) return;
      const gL = px, gB = py, gR = round2(input.w - px - pw), gF = round2(input.d - py - pd);
      const gaps = [gL, gB, gR, gF];
      if (gaps.some((g) => g > 0 && g < MIN_GAP)) return;
      if (gaps.some((g) => g > spec.max + 0.01)) return;
      const trims = (tL ? 1 : 0) + (tB ? 1 : 0) + (tR ? 1 : 0) + (tF ? 1 : 0);
      let pieces = [{ kind: "pan", item: p, x: px, y: py, w: pw, d: pd, cut: trims ? { w: o.w, d: o.d } : null }];
      const warn = [];
      let dead = false;
      const fill = (g, x0, y0, sideLen, horizontal) => {
        if (!(g > 0) || dead) return;
        const lay = layers(g, fam, sideLen);
        if (!lay) { dead = true; return; }
        pieces = pieces.concat(runPieces("ext", lay, x0, y0, sideLen, horizontal));
      };
      // Corner cells: up to 12×12 the 16½" L-shaped corner extension wraps
      // the corner; past that the straight bands RUN THROUGH the corner and
      // mitre at 45° — each stick bought at its full longest-point length —
      // so a corner is always filled and figured, never left blank (owner
      // rule 2026-07-30).
      const cells = [
        { k: "bl", gx: gL, gy: gB, x: 0, y: 0 },
        { k: "br", gx: gR, gy: gB, x: px + pw, y: 0 },
        { k: "fl", gx: gL, gy: gF, x: 0, y: py + pd },
        { k: "fr", gx: gR, gy: gF, x: px + pw, y: py + pd },
      ];
      const mit = {};
      cells.forEach((c) => {
        if (!(c.gx > 0 && c.gy > 0)) return;
        if (c.gx <= CORNER_MAX && c.gy <= CORNER_MAX) c.ext = true;
        else { mit[c.k] = true; warn.push("corner over 12\" — the straights run through it, mitred at 45°"); }
      });
      fill(gL, 0, mit.bl ? 0 : py, (mit.bl ? gB : 0) + pd + (mit.fl ? gF : 0), true);
      fill(gR, px + pw, mit.br ? 0 : py, (mit.br ? gB : 0) + pd + (mit.fr ? gF : 0), true);
      fill(gB, mit.bl ? 0 : px, 0, (mit.bl ? gL : 0) + pw + (mit.br ? gR : 0), false);
      fill(gF, mit.fl ? 0 : px, py + pd, (mit.fl ? gL : 0) + pw + (mit.fr ? gR : 0), false);
      if (dead) return;
      cells.forEach((c) => {
        if (!c.ext) return;
        const ce = item(spec.corner);
        pieces.push({
          kind: "cornerExt", item: ce, x: c.x, y: c.y, w: c.gx, d: c.gy,
          cut: (c.gx < ce.w - 0.01 || c.gy < ce.d - 0.01) ? { w: ce.w, d: ce.d } : null,
        });
      });
      const lines = aggregate(pieces);
      const cuts = pieces.filter((x) => !!x.cut).length;
      const off = miss > 0.01;
      warn.unshift(seamWarning(pieces.length - 1));
      if (trims) warn.push(trimWarning(fam));
      if (deep) {
        warn.push("deep cut — " + inch(deepT) + '" comes off a side to land the drain; past the usual 6", '
          + "but the bases are designed to cut down to meet an existing waste line");
      }
      if (off) {
        warn.unshift("drain lands at " + inch(dx) + '", ' + inch(dy) + '" — ' + inch(miss)
          + '" off the requested spot; move the waste line or accept');
      }
      cands.push({
        id: off ? "drainnear" : "drainat", kind: "drainat",
        title: p.sizeText + " base — drain " + (off ? "lands" : "set") + " at " + inch(dx) + '", ' + inch(dy) + '"',
        badges: (off ? ["Closest fit"] : ["Drain right there"])
          .concat(deep ? ["Deep cut"] : trims ? ["Trim to fit"] : cuts ? [] : ["No cutting"]),
        pieces: pieces,
        drain: { type: p.drain.type, x: dx, y: dy, len: 0, axis: null, note: p.drain.note || "" },
        warnings: warn, floorLines: lines, floorPrice: priceOf(lines), input: input,
        room: { w: input.w, d: input.d }, pan: p, cuts: cuts, trims: trims, miss: miss, deep: deep,
      });
    }));
  });
  // Nearest-fit cards are a compromise, not an answer: they only show when
  // nothing lands on the pin at all.
  const hits = cands.filter((c) => c.miss <= 0.01);
  const pool = hits.length ? hits : cands;
  // Closest first — a shallow cut outranks a deep one at the same miss — then
  // fewest pieces: "cut the pan to fit" beats a patchwork of strips.
  const rank = (a, b) => a.miss - b.miss || (a.deep ? 1 : 0) - (b.deep ? 1 : 0)
    || a.pieces.length - b.pieces.length || a.trims - b.trims || a.floorPrice - b.floorPrice;
  pool.sort(rank);
  const seen = {}, out = [];
  pool.forEach((c) => {
    // a pan may hold two cards when one is its deep-cut placement — the
    // salesman picks between "lands exact, cut deep" and "shallow cut, off"
    const k = c.pan.key + (c.deep ? "|deep" : "");
    if (out.length >= 3 || seen[k]) return;
    seen[k] = true;
    out.push(c);
  });
  // A pin that only lands with a deep cut keeps the closest SHALLOW placement
  // on the board too (owner rule 2026-07-31: 6" is soft — offer the options,
  // the salesman chooses).
  if (out.length && out.every((c) => c.deep)) {
    const soft = cands.filter((c) => !c.deep).sort(rank)[0];
    if (soft) out.push(soft);
  }
  // The biggest pan always earns a card (owner rule 2026-07-30): most of the
  // floor in one piece even when the parts run dearer — the seller decides.
  const big = pool.slice().sort((a, b) => (b.pan.w * b.pan.d) - (a.pan.w * a.pan.d)
    || a.miss - b.miss || a.pieces.length - b.pieces.length || a.floorPrice - b.floorPrice)[0];
  // …but not when the extra floor costs the plumber another foot of travel.
  if (big && !seen[big.pan.key + (big.deep ? "|deep" : "")] && out.length && big.miss <= out[0].miss + 0.01) {
    big.badges = ["Biggest pan"].concat(big.badges);
    out.push(big);
  }
  return out;
}

function cutdownOption(input, list, fam) {
  let best = null;
  list.forEach((p) => {
    orientations(p).forEach((o) => {
      if (o.w < input.w - 0.01 || o.d < input.d - 0.01) return;
      if (o.w === input.w && o.d === input.d) return;
      const area = o.w * o.d;
      if (!best || area < best.area || (area === best.area && p.retail < best.pan.retail)) best = { pan: p, o: o, area: area };
    });
  });
  if (!best) return null;
  const p = best.pan, o = best.o;
  const pieces = [{ kind: "pan", item: p, x: 0, y: 0, w: input.w, d: input.d, cut: { w: o.w, d: o.d } }];
  const lines = aggregate(pieces);
  const waste = round2((o.w * o.d - input.w * input.d) / 144);
  const warn = [fam === "curbless"
    ? "trim the perimeter to size — the ¾\" edge has to be re-formed"
    : "cut to size and re-create the ½\" channel around every cut edge"];
  const drain = mapDrain(p, o.rot, 0, 0);
  const offX = round2(Math.abs(drain.x - input.w / 2)), offY = round2(Math.abs(drain.y - input.d / 2));
  if (offX > 1 || offY > 1) warn.push("cut off the far sides — the drain lands " + Math.max(offX, offY) + "\" off the room centre");
  return {
    id: "cutdown", kind: "cutdown", title: p.sizeText + " base cut to " + sizeTextOf(input.w, input.d),
    badges: ["Cut to size"], pieces: pieces, drain: drain, warnings: warn,
    floorLines: lines, floorPrice: priceOf(lines), waste: waste, input: input,
    room: { w: input.w, d: input.d }, pan: p,
  };
}

function linearOption(input) {
  const tol = input.tolerance || 0;
  let base = null;
  group("pan").filter((p) => p.sub === "linear").forEach((p) => {
    orientations(p).forEach((o) => {
      if (Math.abs(o.w - input.w) > tol || Math.abs(o.d - input.d) > tol) return;
      if (!base || p.retail < base.pan.retail) base = { pan: p, o: o };
    });
  });
  if (!base) return null;
  const pieces = [{ kind: "pan", item: base.pan, x: 0, y: 0, w: base.o.w, d: base.o.d, cut: null }];
  const lines = aggregate(pieces);
  return {
    id: "linear", kind: "linear", title: base.pan.name,
    badges: ["Drain at wall", "Perfect fit — no cutting"], pieces: pieces,
    drain: mapDrain(base.pan, base.o.rot, 0, 0), warnings: [],
    floorLines: lines, floorPrice: priceOf(lines), input: input,
    room: { w: input.w, d: input.d }, pan: base.pan,
  };
}

// Riolito neo modular: a line module carrying the channel plus extension
// modules of the SAME length, pre-sloped ¼"/ft toward it. wedi builds it two
// ways — "drainage close to the wall, or two extension modules each leading
// away from either side with a centered drain module" — and both are here.
// The module's length has to span the run: it pairs with an extension of its
// own length and may only lose moduleEndTrim() an end, so nothing else fills a
// short-fall.
function modulePair(len) {
  const mod = group("module").filter((m) => m.sub === "neo" && m.len === len)
    .sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0))[0];
  const ext = group("modExt").filter((m) => m.len === len)[0];
  return mod && ext ? { mod: mod, ext: ext, len: len } : null;
}

function moduleSpans(span, tol) {
  const out = [];
  MODULE_LENGTHS.forEach((L) => {
    const pr = modulePair(L);
    if (!pr) return;
    const over = round2(L - span);
    if (over < -(tol || 0) - 0.01) return;
    if (over > 2 * moduleEndTrim(L) + 0.01) return;
    out.push(Object.assign({ over: Math.max(over, 0) }, pr));
  });
  return out.sort((a, b) => a.over - b.over || a.len - b.len);
}

// One layout: the module band `across` in from the back (or left) wall, an
// extension leading away on each side that has depth. `axis` "w" runs the
// module along the room's width, "d" along its depth.
function moduleLayout(input, fit, axis, across) {
  const along = axis === "w" ? input.w : input.d;
  const run = axis === "w" ? input.d : input.w;
  // `across` stays unrounded so the channel line lands on a whole inch — the
  // rough-in callout reads "36", not "36 1/64".
  const before = round2(across), after = round2(run - before - MODULE_DEPTH);
  if (before < -0.01 || after < -0.01) return null;
  if (before > 0.01 && (before < MIN_GAP || before > MODEXT_DEPTH + 0.01)) return null;
  if (after > 0.01 && (after < MIN_GAP || after > MODEXT_DEPTH + 0.01)) return null;
  if (before <= 0.01 && after <= 0.01) return null;
  const cutLen = fit.over > 0.01;
  const pieces = [];
  const band = (item_, kind, from, depth) => {
    const w = axis === "w" ? along : depth, d = axis === "w" ? depth : along;
    pieces.push({
      kind: kind, item: item_,
      x: axis === "w" ? 0 : round2(from), y: axis === "w" ? round2(from) : 0,
      w: round2(w), d: round2(d),
      cut: (kind === "module" ? cutLen : cutLen || depth < MODEXT_DEPTH - 0.01)
        ? (axis === "w" ? { w: fit.len, d: kind === "module" ? MODULE_DEPTH : MODEXT_DEPTH }
          : { w: kind === "module" ? MODULE_DEPTH : MODEXT_DEPTH, d: fit.len })
        : null,
    });
  };
  if (before > 0.01) band(fit.ext, "modExt", 0, before);
  band(fit.mod, "module", before, MODULE_DEPTH);
  if (after > 0.01) band(fit.ext, "modExt", round2(before + MODULE_DEPTH), after);
  const lines = aggregate(pieces);
  const mid = before > 0.01 && after > 0.01;
  const chan = round2(across + MODULE_DEPTH / 2);
  const warn = [seamWarning(pieces.length - 1)];
  const deep = pieces.filter((p) => p.kind === "modExt" && p.cut)
    .map((p) => inch(axis === "w" ? p.d : p.w));
  if (deep.length) {
    warn.push("extension cut to " + deep.join('" and ') + '" deep — trim the high edge; the fall still lands in the channel');
  }
  if (cutLen) warn.push('module trimmed ' + inch(fit.over) + '" — take it off the ENDS, keeping 1" clear of the channel');
  return {
    id: mid ? "linearmid" : "linear", kind: "linear",
    title: fit.len + '" linear module ' + (mid ? "centred + 2 extensions" : "+ extension"),
    badges: [mid ? "Drain mid-floor" : "Drain at wall"], pieces: pieces,
    drain: {
      type: "linear", len: fit.mod.channel, axis: axis, note: "",
      x: axis === "w" ? round2(along / 2) : chan,
      y: axis === "w" ? chan : round2(along / 2),
    },
    warnings: warn, floorLines: lines, floorPrice: priceOf(lines), input: input,
    room: { w: input.w, d: input.d }, pan: fit.mod,
  };
}

// Every neo layout the room allows. With a pinned drain the channel has to
// land ON it: the module slides across the room to meet the pin, and the pin's
// other coordinate has to be the channel's own centre (the outlet sits at the
// middle of the channel, which is the middle of the module).
function moduleOptions(input, pin) {
  const tol = input.tolerance || 0;
  const out = [];
  ["w", "d"].forEach((axis) => {
    if (axis === "d" && Math.abs(input.w - input.d) < 0.01) return;   // square room: the same layout turned
    const along = axis === "w" ? input.w : input.d;
    const run = axis === "w" ? input.d : input.w;
    // Only the tightest-fitting module earns a card: a longer one sawn down to
    // the same run is the same layout with more cutting.
    moduleSpans(along, tol).slice(0, 1).forEach((fit) => {
      if (pin) {
        const at = axis === "w" ? pin.x : pin.y;
        if (Math.abs(at - along / 2) > 1) return;
        const o = moduleLayout(input, fit, axis, (axis === "w" ? pin.y : pin.x) - MODULE_DEPTH / 2);
        if (o) out.push(o);
        return;
      }
      const wall = moduleLayout(input, fit, axis, 0);
      if (wall) out.push(wall);
      const mid = moduleLayout(input, fit, axis, (run - MODULE_DEPTH) / 2);
      if (mid) out.push(mid);
    });
  });
  return out;
}

function mirrorOption(o) {
  const W_ = o.room.w;
  const pieces = o.pieces.map((p) => Object.assign({}, p, { x: round2(W_ - p.x - p.w) }));
  const drain = o.drain ? Object.assign({}, o.drain, { x: round2(W_ - o.drain.x) }) : null;
  return Object.assign({}, o, { pieces: pieces, drain: drain, mirrored: true });
}

export function solve(input) {
  input = {
    w: +(input && input.w) || 0, d: +(input && input.d) || 0,
    curb: (input && input.curb) === "curbless" ? "curbless" : "curbed",
    drain: (input && input.drain) || "any",
    tolerance: +(input && input.tolerance) || 0,
    drainX: +(input && input.drainX) || 0,
    drainY: +(input && input.drainY) || 0,
    anchor: (input && input.anchor) === "right" ? "right" : "left",
  };
  if (!(input.w > 0) || !(input.d > 0)) return [];
  const explicitTarget = input.drainX > 0 && input.drainY > 0;
  // Center clicked with no position given = the drain sits at the centre of
  // the ROOM, and the pan is cut to make that true (owner rule 2026-07-29).
  if (input.drain === "center" && !explicitTarget) {
    input.drainX = round2(input.w / 2);
    input.drainY = round2(input.d / 2);
  }
  const fam = input.curb === "curbless" ? "curbless" : "fundo";
  const list = group("pan").filter((p) => {
    if (p.sub !== fam) return false;
    if (input.drain !== "any" && p.drain.type !== input.drain) return false;
    return true;
  });

  // Only a PAN can be the deep one — a module's "thickness" reads off its 5¾"
  // depth, and the neo modules and their extensions are flush by design.
  const buildupWarn = (opts_) => opts_.forEach((o) => {
    if (o.pan.group === "module") return;
    if (panThick(o.pan) >= 1.9 && o.pieces.some((p) => p.kind !== "pan" && p.kind !== "module"))
      o.warnings.push(BUILDUP_NOTE);
  });
  const linearOk = input.curb === "curbed" && (input.drain === "any" || input.drain === "linear");
  const looseFit = () => {
    const o2 = [];
    if (input.drain !== "linear") {
      [exactOption(input, list)].concat(extendOption(input, list, fam))
        .concat([cutdownOption(input, list, fam)])
        .forEach((o) => { if (o) o2.push(o); });
    }
    if (linearOk) {
      const lin = linearOption(input);
      if (lin) o2.push(lin);
      moduleOptions(input, null).forEach((o) => o2.push(o));
    }
    buildupWarn(o2);
    o2.sort((a, b) => a.warnings.length - b.warnings.length || a.floorPrice - b.floorPrice);
    return o2;
  };
  let out = [];
  if (input.drainX > 0 && input.drainY > 0) {
    // The drain position is the constraint — every option honors it, and
    // the list arrives pre-ranked (miss, pieces, trims, price): keep that order.
    out = drainAtOptions(input, list, fam);
    // A pinned drain must never dead-end (owner report 2026-07-31). When no
    // base of the requested TYPE reaches it, the whole family gets a look —
    // with a pin the factory drain position only decides how the base sits —
    // and failing that the plain layouts stand in, saying the pin can't be met.
    if (!out.length && input.drain !== "any") {
      out = drainAtOptions(input, group("pan").filter((p) => p.sub === fam), fam);
      out.forEach((o) => o.warnings.unshift("no " + input.drain + "-drain base fits this room — this is a "
        + o.drain.type + "-drain base floated to the plumbing"));
    }
    // A deep cut never stands alone (owner rule 2026-07-31): when every card
    // of the requested type cuts past 6", the whole family's closest SHALLOW
    // placements ride along so the salesman chooses.
    if (out.length && out.every((o) => o.deep) && input.drain !== "any") {
      drainAtOptions(input, group("pan").filter((p) => p.sub === fam), fam)
        .filter((o) => !o.deep).slice(0, 2).forEach((o) => {
          o.warnings.unshift('shallow alternative — cuts stay under 6"; a ' + o.drain.type
            + "-drain base floated toward the plumbing");
          out.push(o);
        });
    }
    if (linearOk) moduleOptions(input, { x: input.drainX, y: input.drainY }).forEach((o) => out.push(o));
    buildupWarn(out);
    if (!out.length) {
      out = looseFit();
      out.forEach((o) => o.warnings.unshift('no base reaches ' + inch(input.drainX) + '", ' + inch(input.drainY)
        + '" — this layout drains where its own base does'));
    }
  } else {
    out = looseFit();
  }
  if (out.length) {
    const cheap = out.slice().sort((a, b) => a.floorPrice - b.floorPrice)[0];
    cheap.badges = ["Cheapest"].concat(cheap.badges);
    const few = out.slice().sort((a, b) => a.pieces.length - b.pieces.length)[0];
    if (few !== cheap && few.pieces.length < cheap.pieces.length) few.badges = few.badges.concat(["Fewest pieces"]);
  }
  // Anchor the pan against the right wall instead: mirror the layout. A
  // hand-entered drain position wins over the anchor — it names a spot.
  if (input.anchor === "right" && !explicitTarget) out = out.map(mirrorOption);
  return out;
}

// ============================================================================
// wall panel planner
// ============================================================================
//
// Sheets laid HORIZONTAL, stacked in level courses, mixing the three stocked
// ½" sizes — so the joints run level and vertical seams stay rare (owner
// rule 2026-07-29). A course is 48" tall (4×8 / 4×5 sheets) or 36" tall
// (3×5); a long course prefers one 4×8 cut down over two butted 4×5s.

const PANEL_SHEETS = [
  { key: "US8000015", w: 48, len: 96 },
  { key: "US8000014", w: 48, len: 60 },
  { key: "US8000017", w: 36, len: 60 },
];

function coursesFor(h) {
  let best = null;
  for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) {
    const tot = a * 48 + b * 36;
    if (tot < h - 0.01 || (a === 0 && b === 0)) continue;
    const cand = { n: a + b, over: round2(tot - h), a: a, b: b };
    if (!best || cand.n < best.n || (cand.n === best.n && cand.over < best.over)) best = cand;
  }
  if (!best) return [];
  const stack = [];
  for (let i = 0; i < best.a; i++) stack.push(48);
  for (let j = 0; j < best.b; j++) stack.push(36);
  return stack;
}

function courseFill(ch, L) {
  const long_ = PANEL_SHEETS.filter((s) => s.w === ch && s.len === 96)[0];
  const short_ = PANEL_SHEETS.filter((s) => s.w === ch && s.len === 60)[0];
  let best = null;
  for (let n = 0; n <= Math.ceil(L / 96); n++) {
    if (n > 0 && !long_) break;
    const rem = round2(L - n * 96);
    const m = rem > 0.01 ? Math.ceil(rem / 60) : 0;
    if (m > 0 && !short_) continue;
    const cand = { n96: n, n60: m, n: n + m, waste: round2(n * 96 + m * 60 - L) };
    if (cand.n === 0) continue;
    if (!best || cand.n < best.n || (cand.n === best.n && cand.waste < best.waste)) best = cand;
  }
  if (!best) return null;
  const out = [], lens = [];
  let left = L;
  for (let i = 0; i < best.n96; i++) {
    out.push(long_.key);
    const t96 = Math.min(96, left); lens.push(round2(t96)); left = round2(left - t96);
  }
  for (let j = 0; j < best.n60; j++) {
    out.push(short_.key);
    const t60 = Math.min(60, left); lens.push(round2(t60)); left = round2(left - t60);
  }
  return { sheets: out, lens: lens, vSeams: best.n - 1 };
}

// One sheet stood on end covering the whole wall. Vertical is allowed only
// when it leaves NO vertical seam (owner rule 2026-07-29) — so exactly one
// column, one piece: a 48"-wide wall takes a 4×8 standing up, uncut.
function verticalSheet(L, H) {
  let best = null;
  PANEL_SHEETS.forEach((s) => {
    if (s.w < L - 0.01 || s.len < H - 0.01) return;
    const waste = round2(s.w * s.len - L * H);
    if (!best || waste < best.waste) best = { key: s.key, waste: waste };
  });
  return best;
}

export function panelPlan(walls) {
  const byKey = {}, order = [], detail = [];
  let vSeams = 0, courses = 0;
  const take = (k) => {
    if (!byKey[k]) { byKey[k] = 0; order.push(k); }
    byKey[k]++;
  };
  (walls || []).forEach((wall) => {
    const L = +wall.len || 0, H = +wall.h || 0;
    const d = { len: L, h: H, side: wall.side || "", courses: [], vertical: false };
    detail.push(d);
    if (!(L > 0) || !(H > 0)) return;
    const horiz = [];
    let y0 = 0, hSheets = 0;
    coursesFor(H).forEach((ch) => {
      const c = courseFill(ch, L);
      if (!c) return;
      horiz.push({ y0: y0, ch: Math.min(ch, round2(H - y0)), lens: c.lens, sheets: c.sheets });
      y0 = round2(y0 + ch);
      hSheets += c.sheets.length;
    });
    const vert = verticalSheet(L, H);
    if (vert && hSheets > 1) {
      d.vertical = true;
      d.courses.push({ y0: 0, ch: H, lens: [L], vertical: true });
      courses++;
      take(vert.key);
    } else {
      horiz.forEach((c) => {
        courses++;
        vSeams += c.lens.length - 1;
        d.courses.push({ y0: c.y0, ch: c.ch, lens: c.lens });
        c.sheets.forEach(take);
      });
    }
  });
  return {
    lines: order.map((k) => ({ key: k, qty: byKey[k] })),
    vSeams: vSeams, courses: courses, detail: detail,
  };
}

// ============================================================================
// product-row payloads (requirement 12)
// ============================================================================

export function lineItems(build, opts) {
  if (!build || !build.lines) return [];
  opts = opts || {};
  const mult = builderMult(opts.builderPct);
  const mark = { mode: build.mode || "kit", cfg: JSON.parse(JSON.stringify(build.cfg || {})) };
  if (opts.tier) mark.cfg.tier = opts.tier;
  return build.lines.map((l, i) => {
    const e = l.item;
    const anchor = i === 0;
    const lead = e.stock ? (/^\s*wedi/i.test(e.name) ? "" : "wedi — ") : "wedi " + e.us + " — ";
    return {
      type: "misc",
      sku: e.stock ? e.erp || "" : "",
      sizeText: e.sizeText || "",
      brandColor: lead + e.name,
      qtyType: "count",
      qty: String(l.qty),
      priceSqft: String(round2(e.retail)),
      costSqft: String(round2(e.cost)),
      markupPct: "",
      tierPrice: String(round2(e.retail * mult)),
      wedi: anchor ? mark : { part: true },
    };
  });
}
