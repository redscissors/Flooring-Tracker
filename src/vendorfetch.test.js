import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVendorLink, entryProblems, buildVendorUrl, entryFileName, entryKey,
  decodeHandoff, bookmarkletSource, classifySheetBytes,
} from "./vendorfetch.js";

// Real link shape from connect24, with placeholder account/session values.
const LINK =
  "https://connect24.virginiatile.com/danciko/dancik-ows/d24/getPrettyPriceList/xls" +
  "?d24_uid=1071&d24_filename=AOT%20EFT%2026%2002%2019&d24_type=X&d24user=C00000XX" +
  "&d24sesid=Ab3dEf9hIjKlMnOpQrSt&filename=AOT%20EFT%2026%2002%2019.xls&content-disposition=inline&rand=412";

test("parseVendorLink reads a connect24 price-list link", () => {
  const e = parseVendorLink(LINK);
  assert.deepEqual(e, {
    vendor: "dancik",
    host: "connect24.virginiatile.com",
    uid: "1071",
    filename: "AOT EFT 26 02 19",
    user: "C00000XX",
    sesid: "Ab3dEf9hIjKlMnOpQrSt",
  });
  assert.equal(entryProblems(e), null);
  assert.equal(entryFileName(e), "AOT EFT 26 02 19.xls");
});

test("parseVendorLink rejects other hosts, paths, and protocols", () => {
  assert.equal(parseVendorLink(LINK.replace("connect24.virginiatile.com", "evil.example.com")), null);
  assert.equal(parseVendorLink("https://connect24.virginiatile.com/other/path?d24_uid=1"), null);
  assert.equal(parseVendorLink(LINK.replace("https:", "http:")), null);
  assert.equal(parseVendorLink("not a url"), null);
  assert.equal(parseVendorLink(""), null);
});

test("entryProblems catches tampered fields", () => {
  const e = parseVendorLink(LINK);
  assert.equal(entryProblems({ ...e, host: "evil.example.com" }), "host not allowlisted");
  assert.equal(entryProblems({ ...e, vendor: "nope" }), "unknown vendor");
  assert.equal(entryProblems({ ...e, uid: "1; drop" }), "bad uid");
  assert.equal(entryProblems({ ...e, sesid: "a/../b" }), "bad sesid");
  assert.equal(entryProblems({ ...e, filename: "x".repeat(200) }), "bad filename");
  assert.equal(entryProblems({ ...e, user: "" }), "bad user");
});

test("buildVendorUrl rebuilds the download URL from a validated entry", () => {
  const e = parseVendorLink(LINK);
  const url = new URL(buildVendorUrl(e));
  assert.equal(url.hostname, "connect24.virginiatile.com");
  assert.equal(url.pathname, "/danciko/dancik-ows/d24/getPrettyPriceList/xls");
  assert.equal(url.searchParams.get("d24_uid"), "1071");
  assert.equal(url.searchParams.get("d24_type"), "X");
  assert.equal(url.searchParams.get("d24sesid"), "Ab3dEf9hIjKlMnOpQrSt");
  assert.equal(url.searchParams.get("filename"), "AOT EFT 26 02 19.xls");
  // Round-trips through the parser to the same entry.
  assert.deepEqual(parseVendorLink(url.href), e);
});

test("decodeHandoff parses, validates, and dedupes bookmarklet links", () => {
  const other = LINK.replace("d24_uid=1071", "d24_uid=1045").replace(/AOT%20EFT%2026%2002%2019/g, "ANA%20EFT%2025%2006%2004");
  const raw = btoa(JSON.stringify({ v: 1, links: [LINK, LINK, other, "https://evil.example.com/x", "junk"] }));
  const entries = decodeHandoff(raw);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.uid), ["1071", "1045"]);
  assert.equal(new Set(entries.map(entryKey)).size, 2);
});

test("decodeHandoff returns null on garbage or empty payloads", () => {
  assert.equal(decodeHandoff("!!!"), null);
  assert.equal(decodeHandoff(btoa(JSON.stringify({ v: 2, links: [LINK] }))), null);
  assert.equal(decodeHandoff(btoa(JSON.stringify({ v: 1, links: ["junk"] }))), null);
});

test("bookmarkletSource embeds the app origin and stays one line", () => {
  const src = bookmarkletSource("https://floortrack.example.com");
  assert.ok(src.startsWith("javascript:"));
  assert.ok(src.includes('"https://floortrack.example.com"'));
  assert.ok(src.includes("getPrettyPriceList"));
  assert.ok(!src.includes("\n"));
});

test("classifySheetBytes tells sheets from login bounces", () => {
  assert.equal(classifySheetBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0])), "sheet"); // .xls OLE
  assert.equal(classifySheetBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), "sheet"); // .xlsx zip
  const enc = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  assert.equal(classifySheetBytes(enc("<html><body><table><tr><td>1</td></tr></table>")), "sheet"); // HTML export
  assert.equal(classifySheetBytes(enc("<html><form>Please LOGIN with your password")), "login");
  assert.equal(classifySheetBytes(enc("random bytes")), "unknown");
});
