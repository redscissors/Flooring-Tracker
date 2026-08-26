import test from "node:test";
import assert from "node:assert/strict";
import { fitDescription, textParts, DEFAULT_DESC_LIMIT } from "./descfit.js";
import { descParts, calcConfig, defaultConfig, SPECIES, WIDTHS, TEXTURES, FINISHES, STOCKED, STOCKED_WIDTHS } from "./sheoga.js";

const P = [
  { full: "White Oak", short: "WO", rank: 0 },
  { full: "Character", short: "Char", rank: 0 },
  { full: "Solid", short: "Sol", rank: 0 },
  { full: "Saw Cut", short: "SawCut", rank: 2 },
  { full: "30 sheen", short: "30sh", rank: 1 },
];

test("full rung: a description inside the limit is left alone", () => {
  const r = fitDescription(P, 200);
  assert.equal(r.tier, "full");
  assert.equal(r.main, "White Oak Character Solid Saw Cut 30 sheen");
  assert.equal(r.ext, null);
});

test("no limit means no fitting", () => {
  for (const lim of [0, null, undefined, ""]) assert.equal(fitDescription(P, lim).tier, "full");
});

test("short rung: every category survives, abbreviated only as far as needed", () => {
  const r = fitDescription(P, 30);
  assert.equal(r.tier, "short");
  // All-short is 23 chars — the 7 spare go to the species, the most important
  // word that fits written out; nothing later fits full.
  assert.equal(r.main, "White Oak Char Sol SawCut 30sh");
  assert.equal(r.ext, null, "nothing spilled, so no extended text");
  assert.ok(r.main.length <= 30);
});

test("headroom goes to the most important words first, in print order", () => {
  const parts = [
    { full: "Character", short: "Char", rank: 0 },
    { full: "30 sheen", short: "30sh", rank: 1 },
  ];
  // Either could fit written out alone; rank 0 claims the room.
  const r = fitDescription(parts, 14);
  assert.equal(r.main, "Character 30sh");
});

test("split rung: drops by rank, marks the overflow, and spills the full text", () => {
  const r = fitDescription(P, 18);
  assert.equal(r.tier, "split");
  assert.ok(r.main.endsWith("+"), "a partial description must announce itself");
  assert.ok(r.main.length <= 18);
  assert.equal(r.ext, "White Oak Character Solid Saw Cut 30 sheen");
  assert.ok(!r.main.includes("SawCut"), "rank 2 drops before rank 1");
  assert.ok(r.main.includes("30sh"), "rank 1 survives while there is room");
});

test("split rung drops one category at a time, not a whole rank", () => {
  // Only the last rank-2 part needs to go. Dropping the rank wholesale would
  // strand the headroom and lose a category for nothing.
  const parts = [
    { full: "White Oak", short: "WO", rank: 0 },
    { full: "Aaaa", short: "Aaaa", rank: 2 },
    { full: "Bbbbbbbb", short: "Bbbbbbbb", rank: 2 },
  ];
  const r = fitDescription(parts, 14);
  assert.equal(r.tier, "split");
  assert.equal(r.main, "WO Aaaa +", "the other rank-2 part stays");
});

test("within a rank the later-printed category drops first", () => {
  // Print order encodes priority: for a floor that's texture, then edge, then
  // lengths — so lengths goes before texture does.
  const parts = [
    { full: "White Oak", short: "WO", rank: 0 },
    { full: "Saw Cut", short: "SawCut", rank: 2 },
    { full: "2'–8' lengths", short: "2-8'", rank: 2 },
  ];
  const r = fitDescription(parts, 12);
  // Lengths dropped; the texture then gets the leftover room written back out.
  assert.equal(r.main, "WO Saw Cut +");
});

test("identity is never dropped — an impossible limit clips to whole words", () => {
  const r = fitDescription(P, 6);
  assert.equal(r.tier, "split");
  assert.equal(r.main, "WO +", "clipped at a word boundary, never mid-word");
  assert.equal(r.ext, "White Oak Character Solid Saw Cut 30 sheen");
});

test("a cut landing after a separator doesn't leave it dangling before the marker", () => {
  const r = fitDescription(textParts("Small-order fee — prefinished job under 250 sf"), 30);
  assert.equal(r.main, "Small-order fee +");
  assert.ok(!/[—–·,;:-] \+$/.test(r.main), "a trailing separator reads as a typo");
});

test("a single word longer than the field overruns rather than being cut apart", () => {
  const r = fitDescription(textParts("Supercalifragilistic"), 10);
  assert.equal(r.main, "Supercalifragilistic +", "a hard cut would fake an abbreviation");
  assert.ok(r.over > 0, "the overrun is reported so the panel can flag it");
  assert.equal(r.ext, "Supercalifragilistic");
});

test("ext and full are the written-out description, whatever rung was taken", () => {
  const written = "White Oak Character Solid Saw Cut 30 sheen";
  assert.equal(fitDescription(P, 200).full, written);
  assert.equal(fitDescription(P, 30).full, written);
  assert.equal(fitDescription(P, 10).ext, written);
});

test("textParts: unstructured text has no short rung — it fits or it splits", () => {
  const long = "Anatolia Tile Carrara Bianco Polished Rectified";
  assert.equal(fitDescription(textParts(long), 200).tier, "full");
  const r = fitDescription(textParts(long), 24);
  assert.equal(r.tier, "split");
  assert.ok(r.main.endsWith("+"));
  assert.ok(!/\S\+$/.test(r.main), "the marker is spaced off, not glued to a word");
  assert.equal(r.ext, long);
  assert.ok(long.startsWith(r.main.replace(/ \+$/, "")), "clipped at a word boundary");
  assert.equal(fitDescription(textParts(""), 10).main, "");
});

// --- pinned parts (the order tail — SKU, coverage; Marcus 2026-08-26) ----------

const PINNED = [
  { full: "White Oak", short: "WO", rank: 0 },
  { full: "Character", short: "Char", rank: 0 },
  { full: "SKU-1234", pin: true },
  { full: "15.5 SF/CT", pin: true },
];

test("pinned parts never drop — the body clips and the tail rides after the marker", () => {
  const r = fitDescription(PINNED, 24);
  assert.equal(r.tier, "split");
  assert.equal(r.main, "WO + SKU-1234 15.5 SF/CT");
  assert.ok(r.main.length <= 24);
  assert.equal(r.ext, "White Oak Character SKU-1234 15.5 SF/CT");
});

test("pins wider than the field overrun honestly instead of being lost", () => {
  const r = fitDescription(PINNED, 10);
  assert.ok(r.main.includes("SKU-1234 15.5 SF/CT"), "the tail survives any limit");
  assert.ok(r.over > 0, "the overrun is reported so the panel can flag it");
});

test("pins still take the ordinary rungs when the line fits", () => {
  assert.equal(fitDescription(PINNED, 60).tier, "full");
  const r = fitDescription(PINNED, 30);
  assert.equal(r.tier, "short");
  assert.equal(r.main, "WO Char SKU-1234 15.5 SF/CT");
});

// --- soft parts (the brand, "Collection" — owner 2026-08-26) -------------------

test("a line whose only losses are soft parts renders without the marker", () => {
  const parts = [
    { full: '12x12"', rank: 0 },
    { full: "Glazzio", rank: 3, soft: true },
    { full: "Colonial Hex", rank: 0 },
    { full: "SKU-1", pin: true },
  ];
  // Full is 33 — over a 28 field; dropping the soft brand leaves the identity
  // whole, so no "+", and the ext copy still holds the full line.
  const r = fitDescription(parts, 28);
  assert.equal(r.tier, "split");
  assert.equal(r.main, '12x12" Colonial Hex SKU-1');
  assert.ok(!r.main.includes("+"), "nothing identifying was lost — no announcement");
  assert.equal(r.ext, '12x12" Glazzio Colonial Hex SKU-1');
  assert.equal(r.over, 0);
  assert.equal(r.cut, false, "soft-only losses don't count as a cut");
});

test("the marker stays when identity text is cut, even after softs drop", () => {
  const parts = [
    { full: '12x12"', rank: 0 },
    { full: "Collection", rank: 4, soft: true },
    { full: "Long Hex Village Square", rank: 0 },
    { full: "SKU-1", pin: true },
  ];
  const r = fitDescription(parts, 20);
  assert.equal(r.tier, "split");
  assert.ok(r.main.includes(" + "), "identity was clipped — the cut announces itself");
  assert.ok(r.main.endsWith("SKU-1"), "the pin still rides after the marker");
  assert.equal(r.cut, true, "an identity cut is reported for the panel's warning");
});

test("softs drop least-important first, and only as many as the field requires", () => {
  const parts = [
    { full: "Body", rank: 0 },
    { full: "Brand", rank: 3, soft: true },
    { full: "Collection", rank: 4, soft: true },
  ];
  // Dropping Collection alone (rank 4 before rank 3) already fits — the brand stays.
  const r = fitDescription(parts, 10);
  assert.equal(r.main, "Body Brand");
  assert.ok(!r.main.includes("+"));
});

// --- the vocabulary mirrors the real descriptions ------------------------------
// descParts() restates what calcFloor/calcStocked put in the snapshotted
// description. If either side changes without the other, the abbreviation would
// silently describe a different floor than the row records — so assert the join
// across the whole configuration space, not a sample.

const joinFull = (parts) => parts.map((p) => p.full).filter(Boolean).join(" ");

test("descParts joins back to the exact floor description, every configuration", () => {
  let checked = 0;
  for (const sp of SPECIES) for (const w of WIDTHS) for (const cons of ["solid", "eng"]) for (const grade of ["clear", "char"])
    for (const tex of TEXTURES) for (const fin of FINISHES) {
      const cfg = { ...defaultConfig("floor"), sp, w, cons, grade, tex: tex.id, finish: fin.id, stain: fin.id === "est" ? "Toasted Acorn" : "" };
      const built = calcConfig({ mode: "floor", cfg }, 400);
      const parts = descParts({ mode: "floor", cfg });
      if (!built || !parts) continue;
      assert.equal(joinFull(parts), built.desc);
      checked++;
    }
  assert.ok(checked > 5000, `expected a broad sweep, got ${checked}`);
});

test("descParts joins back to the exact stocked description", () => {
  let checked = 0;
  for (const it of STOCKED) for (const grade of ["clear", "char"]) for (const w of STOCKED_WIDTHS[grade]) {
    const cfg = { sp: it.sp, color: it.color, grade, w, sheen: "" };
    const built = calcConfig({ mode: "stocked", cfg }, 0);
    const parts = descParts({ mode: "stocked", cfg });
    if (!built || !parts) continue;
    assert.equal(joinFull(parts), built.desc);
    checked++;
  }
  assert.ok(checked > 50, `expected a broad sweep, got ${checked}`);
});

test("short forms are unambiguous within a category", () => {
  // Two species abbreviating the same would order the wrong wood.
  const shorts = new Map();
  for (const sp of SPECIES) {
    const cfg = { ...defaultConfig("floor"), sp, w: sp.includes("Live Sawn") ? 5.25 : 3.25 };
    const parts = descParts({ mode: "floor", cfg });
    if (!parts) continue;
    const s = parts[1].short;
    assert.ok(!shorts.has(s), `${sp} and ${shorts.get(s)} both abbreviate to "${s}"`);
    shorts.set(s, sp);
  }
  assert.ok(shorts.size >= 8);
});

test("an ordinary configuration fits 30 characters without splitting", () => {
  const cfg = { ...defaultConfig("floor"), sp: "White Oak", w: 5.25, grade: "char", cons: "solid", finish: "t1" };
  const built = calcConfig({ mode: "floor", cfg }, 400);
  const r = fitDescription(descParts({ mode: "floor", cfg }), DEFAULT_DESC_LIMIT);
  assert.equal(r.tier, "short");
  // The species (+7) overruns, so the grade takes the room instead.
  assert.equal(r.main, '5¼" WO Character Sol T-1 30sh');
  assert.equal(r.full, built.desc);
  assert.equal(r.ext, null);
});

test("descParts declines the modes whose descriptions aren't a flat enum join", () => {
  assert.equal(descParts({ mode: "hb", cfg: { sp: "White Oak", w: 5.25, cons: "solid", band: 0 } }), null);
  assert.equal(descParts({ mode: "vent", cfg: defaultConfig("vent") }), null);
  assert.equal(descParts({ fee: true }), null);
  assert.equal(descParts(null), null);
});
