import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVendorLink, entryProblems, buildVendorUrl, entryFileName, entryKey,
  decodeHandoff, bookmarkletSource, harvestVendorLinks, mergeEntries,
  sheetRecord, recordKey, mergeRecords, applySesid, classifySheetBytes,
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

test("parseVendorLink reads an OVF (ovf400) price-list link — second Dancik host", () => {
  const e = parseVendorLink(
    "https://ovf400.ovf.com/danciko/dancik-ows/d24/getPrettyPriceList/xls" +
    "?d24_uid=196&d24_filename=ovf-tarkett-home-lvt&d24_type=X&d24user=OVF00000XX" +
    "&d24sesid=Ab3dEf9hIjKlMnOpQrSt&filename=ovf-tarkett-home-lvt.xls&content-disposition=inline&rand=374");
  assert.equal(e.vendor, "dancik");
  assert.equal(e.host, "ovf400.ovf.com");
  assert.equal(e.uid, "196");
  assert.equal(e.filename, "ovf-tarkett-home-lvt");
  assert.equal(entryProblems(e), null);
  assert.equal(new URL(buildVendorUrl(e)).hostname, "ovf400.ovf.com");
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

test("harvestVendorLinks finds URLs in dropdowns and handlers, not just <a> tags", () => {
  const rel = "/danciko/dancik-ows/d24/getPrettyPriceList/xls?d24_uid=1071&amp;d24_filename=AOT&amp;d24user=C00000XX&amp;d24sesid=Ab3dEf9h";
  const html = `
    <select name="pricelist">
      <option value="${rel}">AOT EFT</option>
      <option value="${rel.replace("1071", "1045")}">ANA EFT</option>
    </select>
    <button onclick="window.open('${LINK}')">View</button>
    <a href="/somewhere/else">not a price list</a>`;
  const links = harvestVendorLinks(html, "https://connect24.virginiatile.com/danciko/page");
  assert.equal(links.length, 3);
  assert.ok(links.every((u) => u.startsWith("https://connect24.virginiatile.com/")));
  // Entity-decoded and resolved links parse into valid entries.
  const entries = links.map(parseVendorLink).filter((e) => e && !entryProblems(e));
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((e) => e.uid).sort(), ["1045", "1071", "1071"].sort());
});

test("harvestVendorLinks dedupes and survives junk", () => {
  assert.deepEqual(harvestVendorLinks(`<a href="${LINK}"></a><option value="${LINK}">`, "https://connect24.virginiatile.com/"), [LINK]);
  assert.deepEqual(harvestVendorLinks("no links here", "https://connect24.virginiatile.com/"), []);
  assert.deepEqual(harvestVendorLinks(null, "https://connect24.virginiatile.com/"), []);
});

test("bookmarkletSource embeds the app origin and stays one line", () => {
  const src = bookmarkletSource("https://floortrack.example.com");
  assert.ok(src.startsWith("javascript:"));
  assert.ok(src.includes('"https://floortrack.example.com"'));
  assert.ok(src.includes("getPrettyPriceList"));
  assert.ok(src.includes('"ftvfetch"')); // named window: repeat clicks reuse one FloorTrack tab
  assert.ok(!src.includes("\n"));
});

test("mergeEntries stacks hand-offs, replacing same-sheet entries with the fresher token", () => {
  const a = parseVendorLink(LINK);
  const b = { ...a, uid: "1045", filename: "ANA EFT 25 06 04" };
  const aFresh = { ...a, sesid: "NewTokenAfterRelogin1" };
  assert.deepEqual(mergeEntries([], [a]), [a]);
  assert.deepEqual(mergeEntries([a], [b]), [a, b]); // different sheet appends
  assert.deepEqual(mergeEntries([a, b], [aFresh]), [b, aFresh]); // same sheet: new token wins
  assert.deepEqual(mergeEntries([{ ...a, host: "evil.example.com" }], [b]), [b]); // stale junk dropped
});

test("remembered sheets: record drops the token, applySesid restores a fetchable entry", () => {
  const e = parseVendorLink(LINK);
  const rec = sheetRecord(e);
  assert.equal(rec.sesid, undefined);
  assert.deepEqual(Object.keys(rec).sort(), ["filename", "host", "uid", "user", "vendor"]);
  const back = applySesid(rec, "FreshToken123");
  assert.equal(entryProblems(back), null);
  assert.equal(back.sesid, "FreshToken123");
});

test("mergeRecords replaces same-sheet records (fresh filename wins) and strips tokens", () => {
  const a = sheetRecord(parseVendorLink(LINK));
  const b = { ...a, uid: "1045", filename: "ANA EFT 25 06 04" };
  const aNewRelease = { ...a, filename: "AOT EFT 26 05 20", sesid: "ShouldNotPersist1" };
  assert.equal(recordKey(aNewRelease), recordKey(a)); // filename is not identity
  const merged = mergeRecords([a, b], [aNewRelease]);
  assert.deepEqual(merged.map((r) => r.filename), ["ANA EFT 25 06 04", "AOT EFT 26 05 20"]);
  assert.ok(merged.every((r) => r.sesid === undefined));
});

test("classifySheetBytes tells sheets from login bounces", () => {
  assert.equal(classifySheetBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0])), "sheet"); // .xls OLE
  assert.equal(classifySheetBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), "sheet"); // .xlsx zip
  const enc = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  assert.equal(classifySheetBytes(enc("<html><body><table><tr><td>1</td></tr></table>")), "sheet"); // HTML export
  assert.equal(classifySheetBytes(enc("<html><form>Please LOGIN with your password")), "login");
  assert.equal(classifySheetBytes(enc("random bytes")), "unknown");
});
