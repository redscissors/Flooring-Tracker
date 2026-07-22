import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = { addEventListener() { }, removeEventListener() { } };
const { escPush, handleEscKey, isTextEntry } = await import("./escstack.js");

const esc = (target) => ({ key: "Escape", repeat: false, defaultPrevented: false, target });

test("closes only the top of the stack, in last-opened-first order", () => {
  const hits = [];
  const pop1 = escPush(() => hits.push("nav"));
  const pop2 = escPush(() => hits.push("modal"));
  handleEscKey(esc(null));
  assert.deepEqual(hits, ["modal"]);
  pop2();
  handleEscKey(esc(null));
  assert.deepEqual(hits, ["modal", "nav"]);
  pop1();
});

test("popping a middle entry leaves the rest in order", () => {
  const hits = [];
  const pop1 = escPush(() => hits.push("a"));
  const pop2 = escPush(() => hits.push("b"));
  const pop3 = escPush(() => hits.push("c"));
  pop2();
  handleEscKey(esc(null));
  assert.deepEqual(hits, ["c"]);
  pop3();
  handleEscKey(esc(null));
  assert.deepEqual(hits, ["c", "a"]);
  pop1();
  pop2(); // double-pop is a no-op
  handleEscKey(esc(null));
  assert.deepEqual(hits, ["c", "a"]);
});

test("a text-entry target blurs instead of closing a layer", () => {
  const hits = [];
  let blurred = false;
  const pop = escPush(() => hits.push("layer"));
  handleEscKey(esc({ tagName: "INPUT", blur: () => { blurred = true; } }));
  assert.equal(blurred, true);
  assert.deepEqual(hits, []);
  handleEscKey(esc({ tagName: "DIV" }));
  assert.deepEqual(hits, ["layer"]);
  pop();
});

test("ignores non-Escape, key repeat, and already-handled events", () => {
  const hits = [];
  const pop = escPush(() => hits.push("layer"));
  handleEscKey({ key: "Enter", repeat: false, defaultPrevented: false, target: null });
  handleEscKey({ key: "Escape", repeat: true, defaultPrevented: false, target: null });
  handleEscKey({ key: "Escape", repeat: false, defaultPrevented: true, target: null });
  assert.deepEqual(hits, []);
  pop();
});

test("isTextEntry covers the field kinds with their own Escape semantics", () => {
  assert.equal(isTextEntry({ tagName: "INPUT" }), true);
  assert.equal(isTextEntry({ tagName: "TEXTAREA" }), true);
  assert.equal(isTextEntry({ tagName: "SELECT" }), true);
  assert.equal(isTextEntry({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextEntry({ tagName: "BUTTON" }), false);
  assert.equal(isTextEntry(null), false);
});
