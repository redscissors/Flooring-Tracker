import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { queryHit, parseQuery, querySummary, seedFromQuery } from "./wediquery.js";

// The boot chunk's copy of the wedi recognizer. Same assertions as the
// prototype's "search entry" section (proto-engine.js), run against this module
// on its own — wedi.js re-exports these four, but the row search must never pay
// for the catalog, so this file has to stand up without it.

test("wedi search entry: what pins the configurator and where it lands", () => {
  assert.ok(queryHit("wedi") && queryHit("wed"), "queryHit 'wedi' / 'wed'");
  assert.ok(queryHit("shower pan") && queryHit("niche") && queryHit("curbless"),
    "queryHit 'shower pan', 'niche', 'curbless'");
  assert.ok(queryHit("36x60 pan"), "queryHit '36x60 pan' (weak word + size)");
  assert.ok(!queryHit("porcelain 12x24") && !queryHit("schluter reducer") && !queryHit("grout"),
    "queryHit ignores unrelated trade text");
  assert.ok((() => {
    const p = parseQuery("wedi 36x60 curbless");
    return p.w === 36 && p.d === 60 && p.curb === "curbless" && p.tab === "custom";
  })(), "parseQuery 'wedi 36x60 curbless' → 36×60 curbless custom");
  assert.ok((() => {
    const p = parseQuery("wedi 3'x5' pan");
    return p.w === 36 && p.d === 60;
  })(), "parseQuery reads feet: \"wedi 3'x5'\" → 36×60");
  assert.equal(parseQuery("wedi 3x5 shower").w, 36, "parseQuery bare 3x5 reads as feet");
  assert.equal(parseQuery("wedi linear 32x72").drain, "linear", "parseQuery 'linear' → linear drain");
  assert.equal(parseQuery("wedi niche").tab, "browse", "parseQuery 'wedi niche' → browse tab");
  assert.equal(parseQuery("wedi").tab, "kits", "parseQuery bare 'wedi' → kits tab");
  assert.ok((() => {
    const s = seedFromQuery("wedi 48x66 curbed");
    return s.tab === "custom" && s.input.w === 48 && s.input.d === 66 && s.input.curb === "curbed";
  })(), "seedFromQuery gives a solver input");
  assert.ok(/48×66/.test(querySummary(parseQuery("wedi 48x66 curbed"))), "querySummary reads as one line");
});

test("seedFromQuery hands the popup a tab, an input and the leftover words", () => {
  const s = seedFromQuery("wedi niche 12x12");
  assert.equal(s.tab, "custom");
  assert.equal(s.search, "");
  const b = seedFromQuery("wedi sanoasa bench");
  assert.equal(b.tab, "browse");
  assert.equal(b.search, "sanoasa bench", "the browse tab keeps the query minus the brand word");
  const bare = seedFromQuery("");
  assert.ok(bare.input.w === 36 && bare.input.d === 60 && bare.input.curb === "curbed" && bare.input.drain === "any",
    "no size typed → the solver opens on a 36×60 curbed default");
  assert.equal(querySummary(""), querySummary(parseQuery("")));
});

test("wediquery is the boot half: it must not import the catalog module", () => {
  const src = readFileSync(new URL("./wediquery.js", import.meta.url), "utf8");
  assert.ok(!/from\s+["'][^"']*wedi\.js["']/.test(src) && !/import\(["'][^"']*wedi\.js["']\)/.test(src),
    "wediquery.js imports wedi.js — that would drag ~2 000 catalog rows into the boot chunk (ADR 0026)");
});
