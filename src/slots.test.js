import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS, SLOT_LABEL, isSlot } from "./slots.js";

test("every slot has a label and isSlot knows the list", () => {
  for (const s of SLOTS) assert.equal(typeof SLOT_LABEL[s], "string");
  assert.equal(isSlot("drainBody"), true);
  assert.equal(isSlot("nope"), false);
});
