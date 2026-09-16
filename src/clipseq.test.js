import { test } from "node:test";
import assert from "node:assert/strict";
import { writeSequence, CLIP_GAP_MS } from "./clipseq.js";

const harness = () => {
  const log = [];
  return {
    log,
    write: async (t) => { log.push(["write", t]); },
    wait: async (ms) => { log.push(["wait", ms]); },
  };
};

test("writeSequence writes every entry in order with the gap between, none before the first", async () => {
  const h = harness();
  await writeSequence(["a", "b", "c"], { write: h.write, wait: h.wait, gapMs: 400 });
  assert.deepEqual(h.log, [["write", "a"], ["wait", 400], ["write", "b"], ["wait", 400], ["write", "c"]]);
});

test("writeSequence reports progress as each entry goes out", async () => {
  const h = harness();
  const seen = [];
  await writeSequence(["a", "b"], { write: h.write, wait: h.wait, onProgress: (i, n) => seen.push([i, n]) });
  assert.deepEqual(seen, [[1, 2], [2, 2]]);
});

test("writeSequence defaults to a gap long enough for Windows clipboard history", async () => {
  const h = harness();
  await writeSequence(["a", "b"], { write: h.write, wait: h.wait });
  assert.deepEqual(h.log[1], ["wait", CLIP_GAP_MS]);
  assert.ok(CLIP_GAP_MS >= 300);
});
