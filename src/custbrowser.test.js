import test from "node:test";
import assert from "node:assert/strict";
import { salesNameOf, browserRows, quickRows, filterRows, filterBySales, sortRows, groupBySales, NO_SALES, shortDate, BROWSER_COLS, normColOrder, moveCol } from "./custbrowser.js";

const people = [
  { id: "c1", name: "Sarah Jones", phone: "(330) 555-0101", address: "4905 Harris Rd", builderId: "b1", createdAt: 100, updatedAt: 150 },
  { id: "c2", name: "Troy Sutton", phone: "(740) 555-0202", address: "5063 County Road 314", builderId: null, createdAt: 300, updatedAt: 300 },
  { id: "c3", name: "amy adams", phone: "", address: "", builderId: null, createdAt: 200, updatedAt: 900 },
];
const projects = [
  { id: "p1", customerId: "c1", name: "Kitchen remodel", updatedAt: 500, sales: "Marcus Mast" },
  { id: "p2", customerId: "c1", name: "Master bath", updatedAt: 700, sales: "" },
  { id: "p3", customerId: "c2", name: "Whole house", updatedAt: 400, salesperson: { name: "Gina Boyd" }, _full: true },
  { id: "p4", customerId: null, name: "Quick price", quick: true, updatedAt: 999, sales: "Marcus Mast" },
];
const builders = [{ id: "b1", name: "Peak Custom Homes" }];
const rows = () => browserRows({ people, projects, builders });

test("salesNameOf reads the full-row snapshot or the light row's projection", () => {
  assert.equal(salesNameOf({ salesperson: { name: "Gina Boyd" } }), "Gina Boyd");
  assert.equal(salesNameOf({ sales: "Marcus Mast" }), "Marcus Mast");
  assert.equal(salesNameOf({ salesperson: { name: " " }, sales: "Marcus Mast" }), "Marcus Mast");
  assert.equal(salesNameOf({}), "");
});

test("browserRows: one row per customer with builder, activity, salesperson", () => {
  const [r1, r2, r3] = rows();
  assert.equal(r1.builderName, "Peak Custom Homes");
  // activity = latest of the customer's own edit and their projects'
  assert.equal(r1.activity, 700);
  assert.equal(r2.activity, 400);
  assert.equal(r3.activity, 900);
  // sales = most recently touched project that carries a name (p2 has none → p1's)
  assert.equal(r1.sales, "Marcus Mast");
  assert.equal(r2.sales, "Gina Boyd");
  assert.equal(r3.sales, "");
  // projects newest-first, quick prices never counted against a customer
  assert.deepEqual(r1.projs.map((p) => p.id), ["p2", "p1"]);
  assert.equal(rows().every((r) => r.projs.every((p) => !p.quick)), true);
});

test("quickRows: customer-less quick drafts only, newest edit first, searched", () => {
  const projs = [
    ...projects,
    { id: "p6", customerId: null, name: "Q-Arctic White-7/20", quick: true, updatedAt: 500, sales: "Gina Boyd" },
    { id: "p7", customerId: "c1", name: "Promoted job", quick: true, updatedAt: 800 },
  ];
  assert.deepEqual(quickRows(projs).map((p) => p.id), ["p4", "p6"]);
  assert.deepEqual(quickRows(projs, "arctic").map((p) => p.id), ["p6"]);
  assert.deepEqual(quickRows(projs, "gina").map((p) => p.id), ["p6"]);
  assert.equal(quickRows(projs, "zzz").length, 0);
  assert.equal(quickRows().length, 0);
});

test("filterRows spans name, phone, address, builder, and project names", () => {
  const all = rows();
  assert.deepEqual(filterRows(all, "sutton").map((r) => r.id), ["c2"]);
  assert.deepEqual(filterRows(all, "555-0101").map((r) => r.id), ["c1"]);
  assert.deepEqual(filterRows(all, "county road").map((r) => r.id), ["c2"]);
  assert.deepEqual(filterRows(all, "peak custom").map((r) => r.id), ["c1"]);
  assert.deepEqual(filterRows(all, "master bath").map((r) => r.id), ["c1"]);
  assert.equal(filterRows(all, "").length, 3);
  assert.equal(filterRows(all, "zzz").length, 0);
});

test("filterBySales matches any project's salesperson, case-blind substring", () => {
  const all = rows();
  assert.deepEqual(filterBySales(all, "marcus").map((r) => r.id), ["c1"]);
  assert.deepEqual(filterBySales(all, "gina boyd").map((r) => r.id), ["c2"]);
  // c1's derived sales is Marcus (latest named project), but an older project's
  // salesperson still matches
  const shared = browserRows({
    people, builders,
    projects: [...projects, { id: "p5", customerId: "c1", name: "Porch", updatedAt: 1, sales: "Gina Boyd" }],
  });
  assert.deepEqual(filterBySales(shared, "gina").map((r) => r.id), ["c1", "c2"]);
  assert.equal(filterBySales(all, "").length, 3);
  assert.equal(filterBySales(all, "nobody").length, 0);
});

test("sortRows: created/modified newest-first, name A–Z case-blind", () => {
  assert.deepEqual(sortRows(rows(), "created").map((r) => r.id), ["c2", "c3", "c1"]);
  assert.deepEqual(sortRows(rows(), "modified").map((r) => r.id), ["c3", "c1", "c2"]);
  assert.deepEqual(sortRows(rows(), "name").map((r) => r.id), ["c3", "c1", "c2"]);
});

test("groupBySales: salespeople A–Z, no-salesperson group last, row order kept", () => {
  const groups = groupBySales(sortRows(rows(), "name"));
  assert.deepEqual(groups.map((g) => g.sales), ["Gina Boyd", "Marcus Mast", NO_SALES]);
  assert.deepEqual(groups[1].rows.map((r) => r.id), ["c1"]);
  assert.deepEqual(groups[2].rows.map((r) => r.id), ["c3"]);
});

test("normColOrder: defaults on junk, drops unknowns/dupes, appends new columns", () => {
  assert.deepEqual(normColOrder(null), BROWSER_COLS);
  assert.deepEqual(normColOrder("phone"), BROWSER_COLS);
  assert.deepEqual(
    normColOrder(["phone", "ghost", "phone", "builder"]),
    ["phone", "builder", ...BROWSER_COLS.filter((k) => k !== "phone" && k !== "builder")]);
  // A full saved order round-trips untouched
  const shuffled = [...BROWSER_COLS].reverse();
  assert.deepEqual(normColOrder(shuffled), shuffled);
});

test("moveCol inserts before a key, null moves to the end, bad moves no-op", () => {
  const order = ["a", "b", "c", "d"];
  assert.deepEqual(moveCol(order, "d", "b"), ["a", "d", "b", "c"]);
  assert.deepEqual(moveCol(order, "a", null), ["b", "c", "d", "a"]);
  assert.equal(moveCol(order, "a", "a"), order);
  assert.equal(moveCol(order, "ghost", "b"), order);
  assert.equal(moveCol(order, "a", "ghost"), order);
});

test("shortDate renders M/D/YY and empty for missing", () => {
  assert.equal(shortDate(new Date(2026, 6, 22).getTime()), "7/22/26");
  assert.equal(shortDate(0), "");
});
