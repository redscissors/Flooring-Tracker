import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify } from "./schluter.js";

test("fixture loads", () => assert.equal(FIXTURE_ITEMS.length >= 55, true));
test("classify exists", () => assert.equal(typeof classify, "function"));
