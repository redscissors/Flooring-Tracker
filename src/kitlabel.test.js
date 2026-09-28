import test from "node:test";
import assert from "node:assert/strict";
import { tightSize, kitLabel, cleanKitName } from "./kitlabel.js";

test("tightSize drops the spaces around × and marks inches once", () => {
  assert.equal(tightSize('4" x 4"'), "4×4″");
  assert.equal(tightSize('48" x 96" x 1/2"'), "48×96×½″");
  assert.equal(tightSize('6"×4½"×60"'), "6×4½×60″");
  assert.equal(tightSize('60"'), "60″");
  assert.equal(tightSize("24x48"), "24×48″");
  assert.equal(tightSize("38 X 60"), "38×60″");
  assert.equal(tightSize('32"x5-3/4"'), "32×5¾″");
});

test("tightSize keeps feet where a part runs past 8 ft", () => {
  assert.equal(tightSize(`3'3"×33'`), "3′3″×33′");
  assert.equal(tightSize(`32'10"`), "32′10″");
});

test("tightSize reads a foot-led trade size in inches when every part fits a sheet", () => {
  assert.equal(tightSize(`3'6"x5'`), "42×60″");
  assert.equal(tightSize(`4'x8'x1/2"`), "48×96×½″");
  assert.equal(tightSize(`3'2"x5'4"`), "38×64″");
});

test("cleanKitName drops the brand words but keeps S-Dry and product names", () => {
  assert.equal(cleanKitName("wedi® Fastener Kit"), "Fastener Kit");
  assert.equal(cleanKitName("wedi®PRO-SET™ Tile Adhesive"), "PRO-SET Tile Adhesive");
  assert.equal(cleanKitName("wedi® Subliner Dry Mixing Valve Seal"), "Mixing Valve Seal");
  assert.equal(cleanKitName("S-Dry Shower Base"), "S-Dry Shower Base");
  assert.equal(cleanKitName("Schluter ALL-SET modified thin-set"), "ALL-SET modified thin-set");
  assert.equal(cleanKitName("KERDI membrane roll"), "Membrane roll");
  assert.equal(cleanKitName("KERDI-DRAIN grate stainless"), "Drain grate stainless");
  assert.equal(cleanKitName("KERDI-BOARD-SC curb"), "Board curb");
  assert.equal(cleanKitName("KERDI-BOARD panel"), "Board panel");
  assert.equal(cleanKitName("KERDI-BAND seam band"), "Seam band");
  assert.equal(cleanKitName("KERDI-SEAL-MV mixing-valve seal"), "Mixing-valve seal");
  assert.equal(cleanKitName("KERECK-F inside corners"), "Inside corners");
  assert.equal(cleanKitName("KERDI-SHOWER-T Tray"), "Shower tray");
  assert.equal(cleanKitName("KERDI-SHOWER-TT Tray"), "Curbless shower tray");
  assert.equal(cleanKitName("Kerdi-Shower-LTS Tray"), "Linear drain shower tray");
  assert.equal(cleanKitName("Kerdi-Line Frame Solid Grate"), "Linear drain Frame Solid Grate");
});

test("kitLabel leads with the size a name carries", () => {
  assert.deepEqual(kitLabel(`3'6"x5' Shower Base`, '42" x 60" x 1 37/64"'), { size: "42×60″", name: "Shower Base", fromHint: false });
  assert.deepEqual(kitLabel('4"x4" Drain Cover — Stainless'), { size: "4×4″", name: "Drain Cover — Stainless", fromHint: false });
  assert.deepEqual(kitLabel('60" Lean Curb'), { size: "60″", name: "Lean Curb", fromHint: false });
  assert.deepEqual(kitLabel('Schluter KERDI-SHOWER-T Tray 38"×60"'), { size: "38×60″", name: "Shower tray", fromHint: false });
  assert.deepEqual(kitLabel('KERDI-DRAIN flange kit 2" PVC'), { size: "2″", name: "Drain flange kit PVC", fromHint: false });
  assert.deepEqual(kitLabel("24x48 Wedi S-Dry Extension", '24" x 48"'), { size: "24×48″", name: "S-Dry Extension", fromHint: false });
});

test("kitLabel falls back to the item's own size text", () => {
  assert.deepEqual(kitLabel("wedi® Fastener Kit", '100 ct 1 5/8" Screws & 100 ct. Washers with Tabs'), { size: "100 ct", name: "Fastener Kit", fromHint: true });
  assert.deepEqual(kitLabel("wedi® Joint Sealant Sausage", "20 oz foil sausage"), { size: "20 oz", name: "Joint Sealant Sausage", fromHint: true });
  assert.deepEqual(kitLabel("wedi®PRO-SET™ Tile Adhesive", "25 lbs. Bag"), { size: "25 lb", name: "PRO-SET Tile Adhesive", fromHint: true });
  assert.deepEqual(kitLabel("KERDI membrane roll", `3'3"×33' = 108 sf`), { size: "3′3″×33′", name: "Membrane roll", fromHint: true, rest: "108 sf" });
  assert.deepEqual(kitLabel("Schluter ALL-SET modified thin-set", "50 lb bag"), { size: "50 lb", name: "ALL-SET modified thin-set", fromHint: true });
  assert.deepEqual(kitLabel("KERECK-F inside corners", "2 per pack"), { size: "2 pc", name: "Inside corners", fromHint: true });
  assert.deepEqual(kitLabel("wedi Fundo® Curbless Shower Kit", '36" x 48"'), { size: "36×48″", name: "Fundo Curbless Shower Kit", fromHint: true });
});

test("kitLabel joins a name's single measure with the sheet's", () => {
  // the name carries the thickness, the size text the sheet
  assert.deepEqual(kitLabel('KERDI-BOARD 1/2" panel', '48"×96" = 32 sf'), { size: "48×96×½″", name: "Board panel", fromHint: true, rest: "32 sf" });
  // the name carries the width, the size text the roll length
  assert.deepEqual(kitLabel('KERDI-BAND 5" seam band', `32'10" roll`), { size: "5″×32′10″", name: "Seam band", fromHint: true });
  // the size text already holds the name's length — it is the fuller size
  assert.deepEqual(kitLabel('KERDI-BOARD-SC curb 60"', '6"×4½"×60"'), { size: "6×4½×60″", name: "Board curb", fromHint: true });
});

test("kitLabel with no size anywhere is just the clean name", () => {
  assert.deepEqual(kitLabel("wedi® Subliner Dry Pipe Seal", ""), { size: "", name: "Pipe Seal", fromHint: false });
  assert.deepEqual(kitLabel("wedi® Sealant 620 Cartridge", ""), { size: "", name: "Sealant 620 Cartridge", fromHint: false });
  assert.deepEqual(kitLabel("Cement board / drywall substrate"), { size: "", name: "Cement board / drywall substrate", fromHint: false });
});

test("kitLabel only joins a roll length, never another single measure", () => {
  assert.deepEqual(kitLabel('28" Wedi Linear Channel Frame', '27" channel'), { size: "28″", name: "Linear Channel Frame", fromHint: false });
});

test("Subliner Dry stays when it is the product itself", () => {
  assert.equal(cleanKitName("wedi® Subliner Dry 323 ft2"), "Subliner Dry 323 ft2");
  assert.equal(cleanKitName("wedi® Subliner Dry Inside Corner"), "Inside Corner");
});

test("a length past 8 ft reads in feet even when the sheet wrote inches", () => {
  assert.equal(tightSize('80" x 192"'), "80″×16′");
  assert.equal(tightSize('5" x 384"'), "5″×32′");
});

test("a count of packs is not a size, and a garbled measure stops at its last clean part", () => {
  assert.deepEqual(kitLabel("Wedi S-Dry Seal", "2 x 16 oz bags"), { size: "", name: "S-Dry Seal", fromHint: false });
  assert.equal(kitLabel("Wedi S-Dry DCSS", '3 3/4" x 3/3/4" x 3/16"').size, "3¾″");
});

