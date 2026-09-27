import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS, SLOT_LABEL, isSlot, GROUPS, groupOf, groupLabel } from "./slots.js";

test("every slot has a label and isSlot knows the list", () => {
  for (const s of SLOTS) assert.equal(typeof SLOT_LABEL[s], "string");
  assert.equal(isSlot("drainBody"), true);
  assert.equal(isSlot("nope"), false);
});

test("GROUPS holds every slot exactly once, in the owner's order", () => {
  assert.deepEqual(GROUPS.map((g) => g.label),
    ["Base", "Drain", "Curb", "Walls", "Seams", "Niches", "Bench", "Setting", "Extras"]);
  const all = GROUPS.flatMap((g) => g.slots);
  assert.deepEqual([...all].sort(), [...SLOTS].sort());
  assert.equal(new Set(all).size, all.length);
});

test("groupOf reads a slot's group; an unknown slot is an extra", () => {
  assert.equal(groupOf("tray"), "base");
  assert.equal(groupOf("grate"), "drain");
  assert.equal(groupOf("wallMembrane"), "walls");
  assert.equal(groupOf("corners"), "seams");
  assert.equal(groupOf("niche"), "niches");
  assert.equal(groupOf("setting"), "setting");
  assert.equal(groupOf("nope"), "extras");
  assert.equal(groupOf(undefined), "extras");
  assert.equal(groupLabel("niches"), "Niches");
});
