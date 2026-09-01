import { test } from "node:test";
import assert from "node:assert/strict";
import { relayProblems, MAX_INPUT } from "./mapsrelay.js";

test("relayProblems rejects an unknown or missing op", () => {
  assert.equal(relayProblems({ op: "delete-everything" }), "unknown op");
  assert.equal(relayProblems({}), "unknown op");
  assert.equal(relayProblems(null), "unknown op");
});

test("relayProblems passes a probe with no other fields", () => {
  assert.equal(relayProblems({ op: "probe" }), null);
});

test("relayProblems needs enough typed input to be worth a suggest call", () => {
  assert.equal(relayProblems({ op: "suggest", input: "49" }), "input too short");
  assert.equal(relayProblems({ op: "suggest", input: "   " }), "input too short");
  assert.equal(relayProblems({ op: "suggest", input: "4905 Harris" }), null);
});

test("relayProblems caps input so a pasted page cannot be forwarded", () => {
  assert.equal(relayProblems({ op: "suggest", input: "x".repeat(MAX_INPUT + 1) }), "input too long");
});

test("relayProblems compares the TRIMMED length, matching shouldSuggest's gate", () => {
  // 200 chars of content plus trailing whitespace: untrimmed length is over
  // MAX_INPUT, but the trimmed value is what's actually sent upstream, and
  // shouldSuggest (mapslookup.js) already let it through on that basis.
  const padded = "x".repeat(MAX_INPUT) + "   ";
  assert.equal(relayProblems({ op: "suggest", input: padded }), null);
});

test("relayProblems requires both ends of a distance request", () => {
  assert.equal(relayProblems({ op: "distance", destination: "b" }), "missing origin");
  assert.equal(relayProblems({ op: "distance", origin: "a" }), "missing destination");
  assert.equal(relayProblems({ op: "distance", origin: " ", destination: "b" }), "missing origin");
  assert.equal(relayProblems({ op: "distance", origin: "a", destination: "b" }), null);
});

test("relayProblems caps both distance addresses", () => {
  const long = "x".repeat(MAX_INPUT + 1);
  assert.equal(relayProblems({ op: "distance", origin: long, destination: "b" }), "address too long");
  assert.equal(relayProblems({ op: "distance", origin: "a", destination: long }), "address too long");
});
