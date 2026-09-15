import { test } from "node:test";
import assert from "node:assert/strict";
import { splitAddress, deliverToRows, deliverToLabel, deliverToSequence } from "./deliverto.js";

test("splitAddress reads a Google-formatted street, city, state ZIP line", () => {
  assert.deepEqual(splitAddress("224 Hammersley Dr, Tuscarawas, OH 44682"),
    { street: "224 Hammersley Dr", apt: "", city: "Tuscarawas", state: "OH", zip: "44682", ok: true });
});

test("splitAddress pulls a unit written as its own part into Apt/suite", () => {
  assert.deepEqual(splitAddress("224 Hammersley Dr, PO Box 288, Tuscarawas, OH 44682"),
    { street: "224 Hammersley Dr", apt: "PO Box 288", city: "Tuscarawas", state: "OH", zip: "44682", ok: true });
});

test("splitAddress pulls a unit off the end of the street part", () => {
  assert.deepEqual(splitAddress("9500 Euclid Ave Suite 200, Cleveland, OH 44195"),
    { street: "9500 Euclid Ave", apt: "Suite 200", city: "Cleveland", state: "OH", zip: "44195", ok: true });
  assert.deepEqual(splitAddress("9500 Euclid Ave #4, Cleveland, OH 44195-1234"),
    { street: "9500 Euclid Ave", apt: "#4", city: "Cleveland", state: "OH", zip: "44195-1234", ok: true });
  assert.equal(splitAddress("120 W Main St Apt. 3B, Wooster, OH 44691").apt, "Apt. 3B");
});

test("splitAddress keeps a street that merely ends in a number", () => {
  assert.equal(splitAddress("5063 County Road 314, Millersburg, OH 44654").street, "5063 County Road 314");
  assert.equal(splitAddress("1 State Route 39, Sugarcreek, OH 44681").street, "1 State Route 39");
});

test("splitAddress reads a hand-typed line with no ZIP or with a spelled-out state", () => {
  assert.deepEqual(splitAddress("5063 County Road 314, Millersburg OH"),
    { street: "5063 County Road 314", apt: "", city: "Millersburg", state: "OH", zip: "", ok: true });
  assert.deepEqual(splitAddress("214 Old Mill Rd, Berlin, Ohio 44610"),
    { street: "214 Old Mill Rd", apt: "", city: "Berlin", state: "OH", zip: "44610", ok: true });
  assert.deepEqual(splitAddress("214 Old Mill Rd, Berlin, OH, 44610"),
    { street: "214 Old Mill Rd", apt: "", city: "Berlin", state: "OH", zip: "44610", ok: true });
});

test("splitAddress keeps a leading place name with the street rather than dropping it", () => {
  assert.deepEqual(splitAddress("Cleveland Clinic, 9500 Euclid Ave, Cleveland, OH 44195"),
    { street: "Cleveland Clinic, 9500 Euclid Ave", apt: "", city: "Cleveland", state: "OH", zip: "44195", ok: true });
});

test("splitAddress puts a line it cannot read whole into Street and says so", () => {
  assert.deepEqual(splitAddress("the blue house past the church"),
    { street: "the blue house past the church", apt: "", city: "", state: "", zip: "", ok: false });
  assert.deepEqual(splitAddress(""), { street: "", apt: "", city: "", state: "", zip: "", ok: true });
});

test("deliverToRows lays the fields out in ERP 1's order", () => {
  const rows = deliverToRows({ custName: "Joe Mazzoleni", address: "224 Hammersley Dr, PO Box 288, Tuscarawas, OH 44682", phone: "330-432-7374" });
  assert.deepEqual(rows.map((r) => [r.key, r.label, r.value]), [
    ["name", "Delivery name", "Joe Mazzoleni"],
    ["street", "Street", "224 Hammersley Dr"],
    ["apt", "Apt/suite", "PO Box 288"],
    ["city", "City", "Tuscarawas"],
    ["state", "State", "OH"],
    ["zip", "ZIP code", "44682"],
    ["phone", "Phone number", "330-432-7374"],
  ]);
});

test("deliverToLabel reads as the mailing label, city/state/ZIP on one line, blanks dropped", () => {
  const rows = deliverToRows({ custName: "Joe Mazzoleni", address: "224 Hammersley Dr, PO Box 288, Tuscarawas, OH 44682", phone: "330-432-7374" });
  assert.equal(deliverToLabel(rows), "Joe Mazzoleni\n224 Hammersley Dr\nPO Box 288\nTuscarawas, OH 44682\n330-432-7374");
  const noApt = deliverToRows({ custName: "Joe Mazzoleni", address: "224 Hammersley Dr, Tuscarawas, OH 44682", phone: "" });
  assert.equal(deliverToLabel(noApt), "Joe Mazzoleni\n224 Hammersley Dr\nTuscarawas, OH 44682");
  assert.equal(deliverToLabel(deliverToRows({ address: "5063 County Road 314, Millersburg OH" })), "5063 County Road 314\nMillersburg, OH");
});

test("deliverToSequence writes the fields last-to-first, then the label, so Win+V lists them in form order under it", () => {
  const rows = deliverToRows({ custName: "Joe Mazzoleni", address: "224 Hammersley Dr, PO Box 288, Tuscarawas, OH 44682", phone: "330-432-7374" });
  assert.deepEqual(deliverToSequence(rows), [
    "330-432-7374", "44682", "OH", "Tuscarawas", "PO Box 288", "224 Hammersley Dr", "Joe Mazzoleni",
    "Joe Mazzoleni\n224 Hammersley Dr\nPO Box 288\nTuscarawas, OH 44682\n330-432-7374",
  ]);
});

test("deliverToSequence skips blank fields", () => {
  const rows = deliverToRows({ custName: "Joe Mazzoleni", address: "224 Hammersley Dr, Tuscarawas, OH 44682", phone: "" });
  assert.deepEqual(deliverToSequence(rows), ["44682", "OH", "Tuscarawas", "224 Hammersley Dr", "Joe Mazzoleni", "Joe Mazzoleni\n224 Hammersley Dr\nTuscarawas, OH 44682"]);
});
