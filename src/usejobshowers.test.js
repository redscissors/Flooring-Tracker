import test from "node:test";
import assert from "node:assert/strict";
import { hasShowerData } from "./usejobshowers.js";

test("hasShowerData: only a placed kit or a row with a breakdown loads the engines", () => {
  assert.equal(hasShowerData(undefined), false);
  assert.equal(hasShowerData([{ products: [{ id: "a" }] }]), false);
  assert.equal(hasShowerData([{ products: [{ wedi: { part: "X" } }] }]), false);
  assert.equal(hasShowerData([{ products: [{ wedi: { mode: "kit", cfg: {} } }] }]), true);
  assert.equal(hasShowerData([{ products: [{ schluter: { mode: "kit", cfg: {} } }] }]), true);
  assert.equal(hasShowerData([{ products: [{ sfParts: [{ kind: "extra", label: "Hall", sf: 1 }] }] }]), true);
});
