import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { queryHit, parseQuery, querySummary, seedFromQuery } from "./schluterquery.js";

// The boot chunk's copy of the Schluter recognizer (task 6, wediquery's
// sibling). Same idiom as wediquery.test.js: schluter.js re-exports these
// four, but the row search must never pay for the registry-fed engine, so
// this file has to stand up without it.

test("trade words hit", () => {
  for (const q of ["sch", "schluter", "kerdi", "kerdi-board", "kerdi board 48x48", "vario"])
    assert.equal(queryHit(q), true, q);
});

test("non-hits stay quiet", () => {
  for (const q of ["wedi", "mannington", "grout", "12x24 tile"])
    assert.equal(queryHit(q), false, q);
});

test("size parse seeds the room", () => {
  assert.deepEqual(parseQuery("kerdi shower 48x60").size, { w: 48, d: 60 });
});

test("schluter search entry: what pins the configurator and where it lands", () => {
  assert.ok(queryHit("KST") && queryHit("kslt") && queryHit("kbsc"), "queryHit family part-number prefixes");
  assert.ok(queryHit("38x60 tray"), "queryHit '38x60 tray' (weak word + size)");
  assert.ok(!queryHit("porcelain 12x24") && !queryHit("wedi reducer") && !queryHit("ditra"),
    "queryHit ignores unrelated trade text, wedi, and the floor-product ditra (binding word-list decision)");
  assert.ok((() => {
    const p = parseQuery("kerdi 48x60 curbless");
    return p.size.w === 48 && p.size.d === 60 && p.curbed === false && p.tab === "custom";
  })(), "parseQuery 'kerdi 48x60 curbless' -> 48x60 curbless custom");
  assert.ok((() => {
    const p = parseQuery("kerdi 3'x5' tray");
    return p.size.w === 36 && p.size.d === 60;
  })(), "parseQuery reads feet: \"kerdi 3'x5'\" -> 36x60");
  assert.equal(parseQuery("kerdi 3x5 shower").size.w, 36, "parseQuery bare 3x5 reads as feet");
  assert.equal(parseQuery("kerdi-line vario 32x72").drain, "linear", "parseQuery 'vario' -> linear drain");
  assert.equal(parseQuery("kerdi niche").tab, "browse", "parseQuery 'kerdi niche' -> browse tab");
  assert.equal(parseQuery("schluter").tab, "kits", "parseQuery bare 'schluter' -> kits tab");
  assert.ok((() => {
    const s = seedFromQuery("kerdi 48x66 curbed");
    return s.tab === "custom" && s.input.w === 48 && s.input.d === 66 && s.input.curbed === true;
  })(), "seedFromQuery gives a solver input");
  assert.ok(/48×66/.test(querySummary(parseQuery("kerdi 48x66 curbed"))), "querySummary reads as one line");
});

test("seedFromQuery hands the popup a tab, an input and the leftover words", () => {
  const s = seedFromQuery("kerdi niche 12x12");
  assert.equal(s.tab, "custom");
  assert.equal(s.search, "");
  const b = seedFromQuery("kerdi vario bench");
  assert.equal(b.tab, "browse");
  assert.equal(b.search, "vario bench", "the browse tab keeps the query minus the brand word");
  const bare = seedFromQuery("");
  assert.ok(bare.input.w === 36 && bare.input.d === 60 && bare.input.curbed === true && bare.input.drain === "point",
    "no size typed -> the solver opens on a 36x60 curbed point-drain default");
  assert.equal(querySummary(""), querySummary(parseQuery("")));
});

test("schluterquery is the boot half: it must not import the engine", () => {
  const src = readFileSync(new URL("./schluterquery.js", import.meta.url), "utf8");
  assert.ok(!/from\s+["'][^"']*schluter\.js["']/.test(src) && !/import\(["'][^"']*schluter\.js["']\)/.test(src),
    "schluterquery.js imports schluter.js — that would drag the registry-fed engine into the boot chunk (ADR 0026)");
});
