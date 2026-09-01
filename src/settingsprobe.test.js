import test from "node:test";
import assert from "node:assert/strict";
import { probeText } from "./probetext.js";

// probeText's real caller (SettingsWorkspace.jsx) passes widgets.jsx's
// lookupErrText as errText — that file is JSX, which node --test's plain ESM
// loader can't import, so this stub stands in. Its two branches are
// transcribed verbatim from widgets.jsx's LOOKUP_ERR map and its unmapped-code
// fallback, so the "not-configured"/unmapped-code assertions below match the
// real copy a user would see; a future change to widgets.jsx's text would not
// fail this test, only a divergence in probeText's own branching/formatting.
const errText = (code) =>
  code === "not-configured" ? "Address lookup needs a Google key — see Settings" : "Address lookup is unavailable right now";

test("probeText: key not configured at all", () => {
  assert.equal(probeText({ error: "not-configured" }, errText), "Address lookup needs a Google key — see Settings");
});

test("probeText: both APIs answered 200", () => {
  assert.equal(
    probeText({ ok: true, keyPresent: true, places: 200, routes: 200 }, errText),
    "Working — Places and Routes both answered.",
  );
});

test("probeText: Places 403, Routes 200 — names Places and its status", () => {
  assert.equal(
    probeText({ ok: false, keyPresent: true, places: 403, routes: 200 }, errText),
    "Key is set, but Places 403 did not answer 200 — the API may not be enabled, the key may be restricted from it, or the quota/billing may be exhausted.",
  );
});

test("probeText: both Places and Routes return 403 — names both", () => {
  assert.equal(
    probeText({ ok: false, keyPresent: true, places: 403, routes: 403 }, errText),
    "Key is set, but Places 403, Routes 403 did not answer 200 — the API may not be enabled, the key may be restricted from it, or the quota/billing may be exhausted.",
  );
});

test("probeText: Routes alone failing — names Routes and its status, not Places", () => {
  assert.equal(
    probeText({ ok: false, keyPresent: true, places: 200, routes: 500 }, errText),
    "Key is set, but Routes 500 did not answer 200 — the API may not be enabled, the key may be restricted from it, or the quota/billing may be exhausted.",
  );
});

test("probeText: an unmapped relay error code still says something", () => {
  assert.equal(probeText({ error: "some-unmapped-code" }, errText), "Address lookup is unavailable right now");
});

// The probe is the one tool built to answer "is the key reaching the function",
// so a missing key must come back in its OWN vocabulary — keyPresent:false —
// rather than as the generic not-configured every other op returns. The relay
// special-cases probe for exactly this reason (netlify/functions/maps.mjs).
test("probeText: nothing reached the function — names the three Netlify causes", () => {
  assert.equal(
    probeText({ ok: false, keyPresent: false, keyLen: 0 }, errText),
    "No key reached the function — GOOGLE_MAPS_KEY is unset or empty for this deploy. Check it covers all deploy contexts, includes the Functions scope, and is not marked \"Contains secret values\", then redeploy.",
  );
});

// A truncated or partly-pasted key is otherwise indistinguishable from a
// disabled API — both surface as a Google 4xx. The character count is the only
// thing that separates them, and it never reveals the key itself.
test("probeText: a set key reports its length, so a truncated paste is visible", () => {
  assert.equal(
    probeText({ ok: false, keyPresent: true, keyLen: 12, places: 400, routes: 400 }, errText),
    "Key is set (12 chars), but Places 400, Routes 400 did not answer 200 — the API may not be enabled, the key may be restricted from it, or the quota/billing may be exhausted.",
  );
});

test("probeText: without a length it still reads correctly", () => {
  assert.equal(
    probeText({ ok: false, keyPresent: true, places: 403, routes: 200 }, errText),
    "Key is set, but Places 403 did not answer 200 — the API may not be enabled, the key may be restricted from it, or the quota/billing may be exhausted.",
  );
});
