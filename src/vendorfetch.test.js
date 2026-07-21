import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVendorLink, entryProblems, buildVendorUrl, entryFileName, entryKey,
  decodeHandoff, bookmarkletSource, harvestVendorLinks, mergeEntries,
  sheetRecord, recordKey, mergeRecords, applySesid, classifySheetBytes,
  migrateVendorSheets, normVendorGroups, groupName, newGroup, groupForSheet,
  sheetMatchesGroup, moveSheetInGroups, vendorForHost, rememberIntoGroups,
  setSheetBook, normSession, decodeHandoffSession, poolSession,
  HANDOFF_MARK, stripHandoffMark,
  poolPendingReview, removePendingReview, pendingForSheet, sheetsForBook,
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

test("entryFileName only assumes .xls when the sheet has no extension of its own", () => {
  const f = (filename) => entryFileName({ filename });
  assert.equal(f("AOT EFT 26 02 19"), "AOT EFT 26 02 19.xls"); // the common case
  assert.equal(f("Mirage_Product_Chart.pdf"), "Mirage_Product_Chart.pdf"); // not .pdf.xls
  assert.equal(f("Cartons Detail.PDF"), "Cartons Detail.PDF");
  assert.equal(f("book.xlsx"), "book.xlsx");
  assert.equal(f(""), "price list.xls");
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

test("bookmarkletSource copies a marked payload to the clipboard, one line", () => {
  const src = bookmarkletSource();
  assert.ok(src.startsWith("javascript:"));
  assert.ok(src.includes("getPrettyPriceList"));
  assert.ok(src.includes("clipboard")); // copies rather than opening a tab
  assert.ok(src.includes("writeText"));
  assert.ok(src.includes(JSON.stringify(HANDOFF_MARK))); // marked so paste can recognize it
  assert.ok(!src.includes("window.open")); // the tab-opening path is gone
  assert.ok(!src.includes("\n"));
});

test("bookmarkletSource also grabs the bare session token off the portal", () => {
  const src = bookmarkletSource();
  assert.ok(src.includes("localStorage")); // reads the portal's own storage
  assert.ok(src.includes("d24sesid"));
  assert.ok(src.includes("d24user"));
  assert.ok(src.includes("payload.session")); // and ships it in the copied blob
});

test("stripHandoffMark unwraps a marked clipboard blob, leaves plain text alone", () => {
  const raw = btoa(JSON.stringify({ v: 1, links: [LINK] }));
  assert.equal(stripHandoffMark(HANDOFF_MARK + raw), raw);
  assert.equal(stripHandoffMark("  " + HANDOFF_MARK + raw + "  "), raw); // trims first
  assert.equal(stripHandoffMark(LINK), LINK); // a plain URL passes through
  assert.deepEqual(decodeHandoff(stripHandoffMark(HANDOFF_MARK + raw)).length, 1);
});

test("normSession validates an allowlisted host + token, user optional", () => {
  assert.deepEqual(normSession({ host: "connect24.virginiatile.com", user: "C00000XX", sesid: "0rG8CPrTweBjbuKBgPvI" }),
    { vendor: "dancik", host: "connect24.virginiatile.com", user: "C00000XX", sesid: "0rG8CPrTweBjbuKBgPvI" });
  // user is optional (menu portals may not expose it)
  assert.deepEqual(normSession({ host: "connect24.virginiatile.com", sesid: "AbcDef123" }),
    { vendor: "dancik", host: "connect24.virginiatile.com", user: "", sesid: "AbcDef123" });
  assert.equal(normSession({ host: "evil.example.com", sesid: "AbcDef123" }), null); // host not allowlisted
  assert.equal(normSession({ host: "connect24.virginiatile.com", sesid: "a/../b" }), null); // bad token
  assert.equal(normSession({ host: "connect24.virginiatile.com", user: "bad user!", sesid: "Abc" }), null); // bad user
  assert.equal(normSession(null), null);
  assert.equal(normSession({}), null);
});

test("decodeHandoffSession pulls a session out of the bookmarklet payload", () => {
  const raw = btoa(JSON.stringify({ v: 1, links: [], session: { host: "connect24.virginiatile.com", user: "C00000XX", sesid: "Tok123" } }));
  assert.deepEqual(decodeHandoffSession(raw), { vendor: "dancik", host: "connect24.virginiatile.com", user: "C00000XX", sesid: "Tok123" });
  assert.equal(decodeHandoffSession(btoa(JSON.stringify({ v: 1, links: [LINK] }))), null); // no session field
  assert.equal(decodeHandoffSession(btoa(JSON.stringify({ v: 2, session: { host: "connect24.virginiatile.com", sesid: "x" } }))), null);
  assert.equal(decodeHandoffSession("!!!"), null);
});

test("poolSession keys a known account, fans an unknown one across remembered accounts", () => {
  const S = { host: "connect24.virginiatile.com", user: "C00000XX", sesid: "FreshTok1" };
  // Known account: one pooled entry keyed host|user.
  assert.deepEqual(poolSession([], S, []), [{ vendor: "dancik", host: S.host, user: "C00000XX", sesid: "FreshTok1" }]);
  // A fresh token upserts (replaces) the same account's stale one.
  const stale = [{ vendor: "dancik", host: S.host, user: "C00000XX", sesid: "OldTok0" }];
  assert.deepEqual(poolSession(stale, S, []), [{ vendor: "dancik", host: S.host, user: "C00000XX", sesid: "FreshTok1" }]);
  // Unknown user: fan the token out to every remembered account on that host.
  const groups = migrateVendorSheets([VT, VT2]); // C00000XX on connect24
  const fanned = poolSession([], { host: S.host, sesid: "FreshTok1" }, groups);
  assert.deepEqual(fanned.map((e) => e.user), ["C00000XX"]);
  assert.equal(fanned[0].sesid, "FreshTok1");
  // Unknown user, nothing remembered on that host: nothing to unlock.
  assert.deepEqual(poolSession([], { host: S.host, sesid: "FreshTok1" }, []), []);
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

// --- sign-in groups ---------------------------------------------------------

const VT = sheetRecord(parseVendorLink(LINK)); // Virginia Tile · C00000XX
const VT2 = { ...VT, uid: "1045", filename: "ANA EFT 25 06 04" }; // same account, other sheet
const OVF = sheetRecord(parseVendorLink(
  "https://ovf400.ovf.com/danciko/dancik-ows/d24/getPrettyPriceList/xls" +
  "?d24_uid=196&d24_filename=ovf-tarkett-home-lvt&d24_type=X&d24user=OVF00000XX" +
  "&d24sesid=Zz9&filename=ovf-tarkett-home-lvt.xls&content-disposition=inline"));

test("groupName labels a portal with the distributor label + dealer account", () => {
  assert.equal(groupName({ host: "connect24.virginiatile.com", user: "C00000XX" }), "Virginia Tile connect24 · C00000XX");
  assert.equal(groupName({ host: "ovf400.ovf.com", user: "OVF00000XX" }), "OVF (ovf400) · OVF00000XX");
  assert.equal(groupName(null), "Vendor sign-in");
  assert.equal(vendorForHost("connect24.virginiatile.com"), "dancik");
  assert.equal(vendorForHost("evil.example.com"), null);
});

test("migrateVendorSheets buckets a flat list by {host,user} dealer account", () => {
  const groups = migrateVendorSheets([VT, OVF, VT2, VT]); // duplicate VT ignored
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, "Virginia Tile connect24 · C00000XX");
  assert.deepEqual(groups[0].sheets.map((s) => s.uid), ["1071", "1045"]);
  assert.deepEqual(groups[0].portal, { host: "connect24.virginiatile.com", user: "C00000XX" });
  assert.equal(groups[0].loginUrl, "");
  assert.ok(groups[0].id.startsWith("vg_"));
  assert.equal(groups[1].sheets.length, 1); // OVF account
  assert.notEqual(groups[0].id, groups[1].id);
});

test("migrateVendorSheets skips malformed records", () => {
  assert.deepEqual(migrateVendorSheets([{ vendor: "dancik", host: "", uid: "1", user: "x" }, null, {}]), []);
  assert.deepEqual(migrateVendorSheets(null), []);
});

test("normVendorGroups accepts the new shape and coerces bad fields", () => {
  const groups = normVendorGroups({ vendorGroups: [
    { id: "g1", name: "My VT", loginUrl: "https://connect24.virginiatile.com/login", portal: { host: "connect24.virginiatile.com", user: "C00000XX" }, sheets: [VT, VT2] },
    { name: "", portal: { host: "bad" }, sheets: [VT, { junk: true }, OVF] }, // no id/name, bad portal, one bad sheet
  ] });
  assert.equal(groups[0].id, "g1");
  assert.equal(groups[0].loginUrl, "https://connect24.virginiatile.com/login");
  assert.ok(groups[1].id.startsWith("vg_")); // generated
  assert.equal(groups[1].portal, null);       // {host:"bad"} has no user → null
  assert.equal(groups[1].name, "Vendor sign-in"); // no portal to name from
  assert.deepEqual(groups[1].sheets.map((s) => s.uid), ["1071", "196"]); // junk dropped
  assert.ok(groups[1].sheets.every((s) => s.sesid === undefined)); // tokens never persist
});

test("normVendorGroups migrates a legacy flat vendorSheets array", () => {
  const groups = normVendorGroups({ vendorSheets: [VT, VT2, OVF] });
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].sheets.map((s) => s.uid), ["1071", "1045"]);
});

test("normVendorGroups returns [] when there is nothing to remember", () => {
  assert.deepEqual(normVendorGroups({}), []);
  assert.deepEqual(normVendorGroups({ vendorGroups: [] }), []);
});

test("sheetMatchesGroup flags cross-portal sheets; portal-less groups accept all", () => {
  const vtGroup = { portal: { host: "connect24.virginiatile.com", user: "C00000XX" } };
  assert.equal(sheetMatchesGroup(VT, vtGroup), true);
  assert.equal(sheetMatchesGroup(OVF, vtGroup), false); // different portal
  assert.equal(sheetMatchesGroup(OVF, { portal: null }), true);
});

test("moveSheetInGroups moves by recordKey, dedups, and no-ops sensibly", () => {
  const groups = migrateVendorSheets([VT, VT2, OVF]);
  const [vt, ovfG] = groups;
  const moved = moveSheetInGroups(groups, VT2, vt.id, ovfG.id);
  assert.deepEqual(moved.find((g) => g.id === vt.id).sheets.map((s) => s.uid), ["1071"]);
  assert.deepEqual(moved.find((g) => g.id === ovfG.id).sheets.map((s) => s.uid), ["196", "1045"]);
  assert.equal(moveSheetInGroups(groups, VT2, vt.id, vt.id), groups); // same group: untouched ref
  const twice = moveSheetInGroups(moved, VT2, vt.id, ovfG.id); // already moved: no-op
  assert.equal(twice, moved);
  assert.equal(groupForSheet(VT2, moved).id, ovfG.id);
});

test("rememberIntoGroups refreshes known sheets in place and files new ones by account", () => {
  const groups = migrateVendorSheets([VT]); // one VT group, contains VT (uid 1071)
  // A fresh capture of VT with a new filename refreshes it in place, no new group.
  const r1 = rememberIntoGroups(groups, [{ ...VT, filename: "AOT EFT 26 05 20" }]);
  assert.equal(r1.length, 1);
  assert.equal(r1[0].sheets.length, 1);
  assert.equal(r1[0].sheets[0].filename, "AOT EFT 26 05 20");
  // VT2 (same account, new sheet) joins the existing VT group.
  assert.deepEqual(rememberIntoGroups(groups, [VT2])[0].sheets.map((s) => s.uid), ["1071", "1045"]);
  // A brand-new account spawns its own group.
  const r3 = rememberIntoGroups(groups, [OVF]);
  assert.equal(r3.length, 2);
  assert.equal(r3[1].portal.host, "ovf400.ovf.com");
  // A sheet the user dragged into a foreign group is refreshed THERE, not re-filed.
  const dragged = [{ id: "solo", name: "Mixed", loginUrl: "", portal: null, sheets: [VT] }];
  assert.equal(rememberIntoGroups(dragged, [{ ...VT, filename: "x" }]).length, 1);
});

test("sheetRecord keeps a valid bookId + lastFetched but drops junk", () => {
  const r = sheetRecord({ ...VT, bookId: "bk1", lastFetched: 123, sesid: "SECRET", junk: 1 });
  assert.equal(r.bookId, "bk1");
  assert.equal(r.lastFetched, 123);
  assert.equal(r.sesid, undefined);
  assert.equal(r.junk, undefined);
  const bad = sheetRecord({ ...VT, bookId: 7, lastFetched: "soon" });
  assert.equal("bookId" in bad, false);
  assert.equal("lastFetched" in bad, false);
});

test("rememberIntoGroups preserves a sheet's bookId link across a re-fetch", () => {
  const groups = [{ id: "g", name: "VT", loginUrl: "", portal: { host: VT.host, user: VT.user }, sheets: [{ ...VT, bookId: "bk1" }] }];
  // A re-fetch carries base fields + a fresh lastFetched, no bookId — the link must survive.
  const next = rememberIntoGroups(groups, [{ ...VT, filename: "new name", lastFetched: 999 }]);
  assert.equal(next[0].sheets[0].bookId, "bk1");
  assert.equal(next[0].sheets[0].filename, "new name");
  assert.equal(next[0].sheets[0].lastFetched, 999);
});

test("setSheetBook links and unlinks the matching sheet only", () => {
  const groups = [{ id: "g", name: "VT", loginUrl: "", portal: null, sheets: [VT, VT2] }];
  const linked = setSheetBook(groups, VT, "bk9");
  assert.equal(linked[0].sheets[0].bookId, "bk9");
  assert.equal("bookId" in linked[0].sheets[1], false); // VT2 untouched
  const unlinked = setSheetBook(linked, VT, null);
  assert.equal("bookId" in unlinked[0].sheets[0], false);
});

test("newGroup builds an empty, named group from a portal", () => {
  const g = newGroup({ host: "connect24.virginiatile.com", user: "C00000XX" });
  assert.equal(g.name, "Virginia Tile connect24 · C00000XX");
  assert.deepEqual(g.sheets, []);
  assert.equal(newGroup().portal, null);
  assert.equal(newGroup().name, "New sign-in");
});

test("pending-review pool keys by recordKey and replaces on re-pool", () => {
  const sheetA = { vendor: "dancik", host: "connect24.virginiatile.com", uid: "1071", filename: "AOT EFT", user: "C00000XX", bookId: "bk1" };
  const sheetB = { ...sheetA, uid: "2088", filename: "MSI EFT", bookId: undefined };
  const f1 = { name: "a.xls" }, f2 = { name: "a2.xls" }, f3 = { name: "b.xls" };

  let pool = poolPendingReview([], { sheet: sheetA, file: f1, at: 111 });
  pool = poolPendingReview(pool, { sheet: sheetB, file: f3, at: 222 });
  assert.equal(pool.length, 2);
  assert.equal(pool[0].file, f1);
  assert.equal(pool[0].sheet.bookId, "bk1"); // bookId survives sheetRecord
  assert.equal(pool[0].at, 111);

  // Re-fetching the same sheet replaces the parked file (and keeps one entry).
  pool = poolPendingReview(pool, { sheet: sheetA, file: f2, at: 333 });
  assert.equal(pool.length, 2);
  assert.equal(pendingForSheet(pool, sheetA).file, f2);
  assert.equal(pendingForSheet(pool, sheetA).at, 333);

  pool = removePendingReview(pool, sheetA);
  assert.equal(pool.length, 1);
  assert.equal(pendingForSheet(pool, sheetA), null);
  assert.equal(pendingForSheet(pool, sheetB).file, f3);
});

test("sheetsForBook finds a linked sheet and its group", () => {
  const s1 = { vendor: "dancik", host: "connect24.virginiatile.com", uid: "1", filename: "A", user: "U1", bookId: "bkA" };
  const s2 = { vendor: "dancik", host: "connect24.virginiatile.com", uid: "2", filename: "B", user: "U1" };
  const groups = [{ id: "g1", name: "G", loginUrl: "", portal: null, sheets: [s2, s1] }];
  assert.equal(sheetsForBook(groups, "bkA").length, 1);
  assert.equal(sheetsForBook(groups, "bkA")[0].sheet.uid, "1");
  assert.equal(sheetsForBook(groups, "bkA")[0].group.id, "g1");
  assert.deepEqual(sheetsForBook(groups, "bkNope"), []);
  assert.deepEqual(sheetsForBook([], "bkA"), []);
});

// A book fed by several files (Mirage: flooring + trim + product chart). These
// used to be silently hidden behind the first match — the book page showed one
// feed and "Refresh" re-pulled only that one.
test("sheetsForBook returns every sheet feeding a book, across groups", () => {
  const mk = (uid, bookId, user = "U1") => ({ vendor: "dancik", host: "connect24.virginiatile.com", uid, filename: `f${uid}`, user, bookId });
  const groups = [
    { id: "g1", name: "G1", loginUrl: "", portal: null, sheets: [mk("1", "bkA"), mk("2", "bkB"), mk("3", "bkA")] },
    { id: "g2", name: "G2", loginUrl: "", portal: null, sheets: [mk("4", "bkA", "U2")] },
  ];
  const hits = sheetsForBook(groups, "bkA");
  assert.deepEqual(hits.map((h) => h.sheet.uid), ["1", "3", "4"]);
  assert.deepEqual(hits.map((h) => h.group.id), ["g1", "g1", "g2"]); // each carries its own group
});

// ---- Emser (sessionless vendor, ADR 0019 Emser amendment) -------------------

const EMSER_LINK = "https://www.emser.com/api/v1/custom/customerDocuments/1374258-Jul2026-ISPL.xlsx";

test("parseVendorLink reads an Emser customer-document link — token-free", () => {
  const e = parseVendorLink(EMSER_LINK);
  assert.deepEqual(e, {
    vendor: "emser",
    host: "www.emser.com",
    uid: "1374258",
    filename: "1374258-Jul2026-ISPL.xlsx",
    user: "1374258",
    sesid: "",
  });
  assert.equal(entryProblems(e), null);
  assert.equal(entryFileName(e), "1374258-Jul2026-ISPL.xlsx"); // keeps its own extension
  assert.equal(buildVendorUrl(e), EMSER_LINK); // relay rebuilds the exact URL
});

test("Emser entries reject tokens, foreign hosts, and account-less filenames", () => {
  const e = parseVendorLink(EMSER_LINK);
  assert.equal(entryProblems({ ...e, sesid: "abc" }), "bad sesid"); // token-free by design
  assert.equal(parseVendorLink(EMSER_LINK.replace("www.emser.com", "evil.example.com")), null);
  assert.equal(entryProblems(parseVendorLink("https://www.emser.com/api/v1/custom/customerDocuments/pricelist.xlsx")), "bad uid");
});

test("applySesid keeps a sessionless vendor's entry token-free", () => {
  const e = parseVendorLink(EMSER_LINK);
  assert.equal(applySesid(e, "none-needed").sesid, ""); // the panel's liveness sentinel never reaches the relay
  assert.equal(applySesid({ vendor: "dancik", host: "connect24.virginiatile.com", uid: "1", user: "U", filename: "F" }, "tok").sesid, "tok");
});

test("normSession never pools a session for a sessionless host", () => {
  assert.equal(normSession({ host: "www.emser.com", user: "1374258", sesid: "sometoken" }), null);
  assert.equal(normSession({ host: "www.emser.com", user: "1374258", sesid: "" }), null);
});

test("an Emser sign-in groups and labels by dealer account", () => {
  assert.equal(groupName({ host: "www.emser.com", user: "1374258" }), "Emser Tile · 1374258");
  assert.equal(vendorForHost("www.emser.com"), "emser");
  const rec = sheetRecord(parseVendorLink(EMSER_LINK));
  assert.equal(recordKey(rec), "emser:www.emser.com:1374258:1374258");
  const groups = rememberIntoGroups([], [rec]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].portal, { host: "www.emser.com", user: "1374258" });
});

test("harvestVendorLinks picks up customerDocuments URLs", () => {
  const html = '<a href="/api/v1/custom/customerDocuments/1374258-Jul2026-ISPL.xlsx">July price list</a>';
  assert.deepEqual(harvestVendorLinks(html, "https://www.emser.com/account"), [EMSER_LINK]);
});
