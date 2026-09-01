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

// Autocomplete predictions omit postal codes by design, so a picked suggestion
// needs a Place Details lookup by placeId to get the complete formatted address
// (ADR 0036 amendment, owner 2026-09-01).
test("relayProblems accepts a details request carrying a placeId", () => {
  assert.equal(relayProblems({ op: "details", placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4" }), null);
});

test("relayProblems rejects a details request with no usable placeId", () => {
  assert.equal(relayProblems({ op: "details" }), "missing placeId");
  assert.equal(relayProblems({ op: "details", placeId: "   " }), "missing placeId");
});

// The placeId is interpolated into the upstream URL path, so anything that
// could steer that path — a slash, a dot segment, a query mark — is refused
// here rather than sanitized downstream.
test("relayProblems refuses a placeId that could reshape the upstream URL", () => {
  for (const bad of ["a/b", "../secrets", "a?b=1", "a#b", "a b", "a%2Fb"]) {
    assert.equal(relayProblems({ op: "details", placeId: bad }), "bad placeId", `should refuse ${bad}`);
  }
});

test("relayProblems caps a runaway placeId", () => {
  assert.equal(relayProblems({ op: "details", placeId: "A".repeat(513) }), "bad placeId");
});

// The session token pairs an autocomplete burst with its terminating details
// call for Google's session pricing. Optional everywhere; when present it is
// also interpolated into a URL, so it gets the same treatment.
test("relayProblems allows an absent or well-formed session token", () => {
  assert.equal(relayProblems({ op: "suggest", input: "4905 Harris" }), null);
  assert.equal(relayProblems({ op: "suggest", input: "4905 Harris", sessionToken: "b6d7f0e2-1c3a-4f55-9a2b-77c1d0e4a8f9" }), null);
  assert.equal(relayProblems({ op: "details", placeId: "ChIJabc", sessionToken: "b6d7f0e2-1c3a-4f55-9a2b-77c1d0e4a8f9" }), null);
});

test("relayProblems refuses a malformed session token", () => {
  assert.equal(relayProblems({ op: "suggest", input: "4905 Harris", sessionToken: "not a token" }), "bad sessionToken");
  assert.equal(relayProblems({ op: "details", placeId: "ChIJabc", sessionToken: "x".repeat(200) }), "bad sessionToken");
});
